/**
 * ProofLedger AI — Server Adapter & Security Gateway
 * 
 * Secure proxy between the client browser and Nebius Token Factory.
 * Strict rules:
 * 1. NEBIUS_API_KEY is NEVER sent to the client.
 * 2. Raw CSVs are rejected; only sanitized single-exception payloads accepted.
 * 3. Rate limiting and 32kb body cap enforced.
 * 4. Outputs validated against strict Zod schema.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import {
  InvestigationRequestSchema,
  InvestigationResultSchema,
  verifyRowIdProvenance,
  NEMOTRON_SYSTEM_PROMPT,
} from '../src/features/investigation/schema';
import { serverSanitizeNarration } from '../src/lib/privacy';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const DIST_DIR = path.resolve(process.cwd(), 'dist');

// Security Hardening: Disable Express fingerprinting
app.disable('x-powered-by');

// Security Hardening: Trust single reverse proxy hop (Render / PaaS) for accurate rate limiting
app.set('trust proxy', 1);

// Security Hardening: Comprehensive Defense-in-Depth HTTP Headers
app.use((_req: Request, res: Response, next: () => void) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tokenfactory.nebius.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Dynamic budget and origin getters for runtime configuration
function getMaxLiveCalls(): number {
  const parsed = parseInt(process.env.MAX_LIVE_CALLS_PER_PROCESS || '50', 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0; // Fail safe: disallow calls on invalid, non-numeric, or negative configuration
  }
  return parsed;
}

/**
 * Browser Origin validation guard (defense-in-depth against unauthorized browser clients).
 * NOTE: Origin checking is browser boundary enforcement, NOT caller authentication.
 * In production, only explicitly configured origins and RENDER_EXTERNAL_URL are permitted.
 * Wildcard ('*') origins are strictly rejected across all environments.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  // If Origin header is undefined or not provided (non-browser clients like curl or server-to-server),
  // CORS does not apply. CORS is a browser security mechanism, not caller authentication.
  if (origin === undefined) return true;

  const trimmedOrigin = origin.trim();
  // Reject wildcard origin requests, empty string origins, and opaque/sandboxed 'null' origins
  if (trimmedOrigin === '*' || trimmedOrigin.length === 0 || trimmedOrigin === 'null') {
    return false;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const rawConfigured = process.env.APP_ALLOWED_ORIGIN || (isProduction ? '' : 'http://localhost:5173');

  // Strip wildcard entries to reject insecure wildcard configuration
  const configuredList = rawConfigured
    .split(',')
    .map((o) => o.trim())
    .filter((o) => Boolean(o) && o !== '*');

  if (process.env.RENDER_EXTERNAL_URL) {
    const renderUrl = process.env.RENDER_EXTERNAL_URL.trim();
    if (renderUrl && renderUrl !== '*') {
      configuredList.push(renderUrl);
    }
  }

  // Exact match against explicitly permitted origins
  if (configuredList.includes(trimmedOrigin)) {
    return true;
  }

  // In production, permit ONLY exact configured origins and RENDER_EXTERNAL_URL
  if (isProduction) {
    return false;
  }

  // In development and test environments, permit local loopback origins
  return trimmedOrigin.startsWith('http://localhost:') || trimmedOrigin.startsWith('http://127.0.0.1:');
}

let liveCallsCount = 0;

// Exported for testing
export function resetLiveCallsBudgetForTesting() {
  liveCallsCount = 0;
}

export function getLiveCallsCountForTesting(): number {
  return liveCallsCount;
}

export function resetRateLimiterForTesting() {
  ipRequestWindow.clear();
}

// 1. Restrictive CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like local dev tools, curl) or matching allowed origin
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-ProofLedger-Client'],
  })
);

// 2. Strict Request Body Size Cap (32 KB max to prevent DoS)
app.use(express.json({ limit: '32kb' }));

// 3. Serve built Vite frontend from dist/ in production
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// 4. In-memory Sliding Window Rate Limiter with Active Cleanup (15 requests per minute per IP)
const ipRequestWindow = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;
const MAX_TRACKED_IPS = 2000;

function cleanupRateLimiter(now: number) {
  for (const [ip, timestamps] of ipRequestWindow.entries()) {
    const active = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (active.length === 0) {
      ipRequestWindow.delete(ip);
    } else {
      ipRequestWindow.set(ip, active);
    }
  }
  if (ipRequestWindow.size > MAX_TRACKED_IPS) {
    ipRequestWindow.clear();
  }
}

const rateLimiter = (req: Request, res: Response, next: () => void) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Periodic cleanup if map grows
  if (ipRequestWindow.size > 50) {
    cleanupRateLimiter(now);
  }

  const timestamps = (ipRequestWindow.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded. Please wait a minute before requesting another AI investigation.',
    });
    return;
  }

  timestamps.push(now);
  ipRequestWindow.set(ip, timestamps);
  next();
};

/**
 * Middleware: Validates that browser Origin matches allowed configuration.
 */
const originValidator = (req: Request, res: Response, next: () => void) => {
  const origin = req.headers.origin;
  if (!isOriginAllowed(origin)) {
    res.status(403).json({
      error: 'Forbidden Origin',
      code: 'FORBIDDEN_ORIGIN',
      message: 'Requests from unauthorized browser origins are blocked by gateway security policy.',
    });
    return;
  }
  next();
};

// 4. Health Check Endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ProofLedger AI Server Gateway',
    timestamp: new Date().toISOString(),
  });
});

// 5. Safe AI Configuration Status Endpoint (Never discloses secrets)
app.get('/api/ai/status', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const hasKey = Boolean(process.env.NEBIUS_API_KEY && process.env.NEBIUS_API_KEY.trim().length > 0);
  const allowLive = process.env.ALLOW_LIVE_AI === 'true';
  const modelId = process.env.NEBIUS_MODEL_ID || 'deterministic-rules-v1';

  res.json({
    configured: hasKey,
    allowLiveAI: allowLive,
    modelId,
    endpoint: 'Deterministic Local Engine (Optional External LLM Prototype Adapter)',
    status: hasKey && allowLive ? 'READY' : 'LOCAL_ONLY',
    liveCallsBudget: {
      maxPerProcess: getMaxLiveCalls(),
      completed: liveCallsCount,
      remaining: Math.max(0, getMaxLiveCalls() - liveCallsCount),
    },
  });
});

// 6. Exception Investigation Endpoint
app.post('/api/investigate', originValidator, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  // Validate inbound payload structure with strict server schema
  const parseResult = InvestigationRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid Request Payload',
      code: 'INVALID_PAYLOAD',
      details: parseResult.error.format(),
    });
    return;
  }

  const payload = parseResult.data;
  const rawKey = process.env.NEBIUS_API_KEY;
  const apiKey = rawKey && rawKey.trim().length > 0 ? rawKey.trim() : null;
  const allowLive = process.env.ALLOW_LIVE_AI === 'true';
  const baseURL = process.env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1/';
  const modelId = process.env.NEBIUS_MODEL_ID || 'nvidia/Llama-3.1-Nemotron-70B-Instruct';

  // Independently sanitize narration text on the server.
  // The server NEVER trusts caller-supplied "sanitizedDescription".
  const bankSanitized = payload.bankEvidence
    ? {
        id: payload.bankEvidence.id,
        date: payload.bankEvidence.date,
        amountRupees: payload.bankEvidence.amountRupees,
        direction: payload.bankEvidence.direction,
        sanitizedDescription: serverSanitizeNarration(payload.bankEvidence.sanitizedDescription),
        referenceMasked: payload.bankEvidence.referenceMasked
          ? serverSanitizeNarration(payload.bankEvidence.referenceMasked)
          : undefined,
      }
    : null;

  const ledgerSanitized = payload.ledgerEvidence
    ? {
        id: payload.ledgerEvidence.id,
        date: payload.ledgerEvidence.date,
        amountRupees: payload.ledgerEvidence.amountRupees,
        direction: payload.ledgerEvidence.direction,
        sanitizedDescription: serverSanitizeNarration(payload.ledgerEvidence.sanitizedDescription),
        referenceMasked: payload.ledgerEvidence.referenceMasked
          ? serverSanitizeNarration(payload.ledgerEvidence.referenceMasked)
          : undefined,
      }
    : null;

  // If live AI is disabled or key is absent, truthfully return local fallback mode
  if (!apiKey || !allowLive) {
    res.json({
      status: 'LOCAL_MODE',
      message: 'Live external AI is unconfigured or ALLOW_LIVE_AI is disabled. Deterministic local investigation active.',
      deterministicAnalysis: {
        exceptionId: payload.exceptionId,
        amountDeltaRupees: payload.amountDeltaRupees,
        dateDeltaDays: payload.dateDeltaDays,
        recommendation: 'Inspect source invoices or bank voucher for reference match.',
      },
    });
    return;
  }

  // Enforce process-level live call budget limit
  const maxCalls = getMaxLiveCalls();
  if (liveCallsCount >= maxCalls) {
    res.status(429).json({
      error: 'Live AI Budget Exhausted',
      code: 'LIVE_BUDGET_EXHAUSTED',
      message: `Inference budget cap of ${maxCalls} calls reached for this server process.`,
    });
    return;
  }

  // Atomically reserve one budget slot BEFORE dispatching the network request.
  // This slot remains consumed regardless of success, timeout, network failure, upstream HTTP error,
  // malformed JSON, or schema violation. The server performs no automatic retries.
  liveCallsCount++;

  try {
    const userPrompt = `Investigate this financial exception:
Exception ID: ${payload.exceptionId}
Type: ${payload.exceptionType}
Amount Variance (INR): ₹${payload.amountDeltaRupees}
Date Lag: ${payload.dateDeltaDays} days
Bank Evidence: ${bankSanitized ? JSON.stringify(bankSanitized) : 'None (Missing Bank Record)'}
Ledger Evidence: ${ledgerSanitized ? JSON.stringify(ledgerSanitized) : 'None (Missing Ledger Record)'}

Analyze whether this is a timing lag, surcharge fee, duplicate, or unrecorded transaction. Return ONLY valid JSON adhering to the required schema.`;

    const chatEndpoint = `${baseURL.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const upstreamResponse = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: NEMOTRON_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2, // Low temperature for factual precision
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!upstreamResponse.ok) {
      console.error(`[Nebius Upstream Error] HTTP Status: ${upstreamResponse.status}`);
      res.status(502).json({
        error: 'Nebius Token Factory Error',
        code: 'UPSTREAM_ERROR',
        status: upstreamResponse.status,
        message: 'Upstream model service responded with an error. Please verify API key and model availability.',
      });
      return;
    }

    const data: any = await upstreamResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      res.status(502).json({
        error: 'Empty Model Response',
        code: 'EMPTY_UPSTREAM_RESPONSE',
        message: 'No completion generated by upstream model.',
      });
      return;
    }

    // Parse model JSON and validate with Zod
    let parsedContent: any;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      res.status(422).json({
        error: 'Malformed JSON from Model',
        code: 'MODEL_JSON_PARSE_ERROR',
      });
      return;
    }

    const validationResult = InvestigationResultSchema.safeParse(parsedContent);
    if (!validationResult.success) {
      res.status(422).json({
        error: 'Model Output Schema Violation',
        code: 'SCHEMA_VIOLATION',
        details: validationResult.error.format(),
      });
      return;
    }

    // 1. Bind returned exceptionId to the requested exception
    if (validationResult.data.exceptionId !== payload.exceptionId) {
      res.status(422).json({
        error: 'Exception ID Mismatch',
        code: 'EXCEPTION_ID_MISMATCH',
        message: `Model returned hypothesis for ${validationResult.data.exceptionId}, expected ${payload.exceptionId}.`,
      });
      return;
    }

    // 2. Build strictly authorized row IDs for THIS exception invocation
    const authorizedRowIds = new Set<string>();
    if (bankSanitized?.id) authorizedRowIds.add(bankSanitized.id);
    if (ledgerSanitized?.id) authorizedRowIds.add(ledgerSanitized.id);

    // 3. Provenance check: Citations to unrelated or fabricated rows are strictly rejected
    const provenance = verifyRowIdProvenance(validationResult.data.evidenceRowIds, authorizedRowIds);
    if (!provenance.isValid) {
      res.status(422).json({
        error: 'Evidence Provenance Violation',
        code: 'PROVENANCE_VIOLATION',
        message: 'The model cited transaction row IDs that were not present in the authorized evidence for this exception.',
        invalidIds: provenance.invalidIds,
      });
      return;
    }

    // 4. Mandatory evidence citation: Must cite at least one authorized row if evidence was provided
    if (authorizedRowIds.size > 0 && validationResult.data.evidenceRowIds.length === 0) {
      res.status(422).json({
        error: 'Missing Mandatory Evidence Citation',
        code: 'MISSING_EVIDENCE_CITATION',
        message: 'The model failed to cite any authorized evidence row IDs.',
      });
      return;
    }

    // Budget slot was reserved upfront prior to network dispatch

    res.json({
      status: 'AI_SUCCESS',
      model: modelId,
      result: validationResult.data,
      usage: data.usage || null,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(504).json({
        error: 'Gateway Timeout',
        code: 'GATEWAY_TIMEOUT',
        message: 'Inference request to Nebius Token Factory timed out after 15 seconds.',
      });
      return;
    }
    console.error('[Internal Gateway Error] Processed exception safely');
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'GATEWAY_ERROR',
      message: 'An unexpected error occurred while proxying to Nebius.',
    });
  }
});

// 7. Account Deletion Endpoint (Protected via Supabase Bearer token)
app.post('/api/account/delete', originValidator, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      message: 'A valid Supabase authorization session bearer token is required to delete an account.',
    });
    return;
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If server-side administrative service key is unconfigured, fail safely and document blocker
  if (!serviceRoleKey || !supabaseUrl) {
    res.status(503).json({
      error: 'Account Deletion Service Unavailable',
      code: 'SERVICE_ROLE_UNCONFIGURED',
      message: 'Server-side Supabase administrative service credentials are not configured on this host. Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the server to invoke administrative user deletion safely.',
    });
    return;
  }

  try {
    // 1. Authenticate the caller using their bearer token
    const authVerifyUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`;
    const verifyRes = await fetch(authVerifyUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceRoleKey,
      },
    });

    if (!verifyRes.ok) {
      res.status(401).json({
        error: 'Invalid or Expired Session',
        code: 'INVALID_SESSION',
        message: 'The provided authentication session is invalid or has expired.',
      });
      return;
    }

    const userData: any = await verifyRes.json();
    const authenticatedUserId = userData?.id;

    if (!authenticatedUserId) {
      res.status(401).json({
        error: 'Authentication Failed',
        code: 'AUTH_FAILED',
        message: 'Unable to resolve authenticated user identity from session.',
      });
      return;
    }

    // 2. Delete all user-owned reconciliation_history records
    const historyDeleteUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/reconciliation_history?user_id=eq.${encodeURIComponent(authenticatedUserId)}`;
    await fetch(historyDeleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });

    // 3. Delete the user identity from Supabase Auth admin API
    const adminDeleteUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(authenticatedUserId)}`;
    const adminDeleteRes = await fetch(adminDeleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });

    if (!adminDeleteRes.ok) {
      const errText = await adminDeleteRes.text();
      console.error('[Account Deletion Error]:', adminDeleteRes.status, errText.slice(0, 100));
      res.status(502).json({
        error: 'Failed to Delete User Identity',
        code: 'ADMIN_DELETE_FAILED',
        message: 'Reconciliation history was purged, but identity deletion failed. Please contact administrator.',
      });
      return;
    }

    res.json({
      success: true,
      message: 'User account and all associated cloud-saved reconciliation records have been permanently deleted.',
    });
  } catch (err: any) {
    console.error('[Account Deletion Error]:', err.message);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'GATEWAY_ERROR',
      message: 'An unexpected error occurred during account deletion.',
    });
  }
});

// 8. Unmatched /api/* routes must return 404 JSON, not SPA HTML
app.all(/^\/api(\/.*)?$/, (_req: Request, res: Response) => {
  res.status(404).json({
    error: 'API Endpoint Not Found',
    code: 'API_NOT_FOUND',
    message: 'The requested /api endpoint does not exist on this server.',
  });
});

// JSON error handling middleware (handles body parser limits like 413 Payload Too Large)
app.use((err: any, _req: Request, res: Response, next: () => void) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    res.status(413).json({
      error: 'Payload Too Large',
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds the strict 32 KB gateway body limit.',
    });
    return;
  }
  next();
});

// 8. Safe SPA fallback for non-API client-side navigation
app.get('{*path}', (req: Request, res: Response, next: () => void) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('ProofLedger AI: Frontend distribution not found. Run `pnpm run build` first.');
  }
});

// Start listening if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ProofLedger Server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[ProofLedger Server] Static Directory: ${DIST_DIR}`);
    console.log(`[ProofLedger Server] CORS Origin allowed: ${process.env.APP_ALLOWED_ORIGIN || 'http://localhost:5173'}`);
    console.log(`[ProofLedger Server] Live AI Enabled: ${process.env.ALLOW_LIVE_AI === 'true'}`);
  });
}

export default app;
