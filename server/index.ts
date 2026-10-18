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
import {
  InvestigationRequestSchema,
  InvestigationResultSchema,
  verifyRowIdProvenance,
  NEMOTRON_SYSTEM_PROMPT,
} from '../src/features/investigation/schema';
import { serverSanitizeNarration } from '../src/lib/privacy';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
// Dynamic budget and origin getters for runtime configuration
function getMaxLiveCalls(): number {
  return parseInt(process.env.MAX_LIVE_CALLS_PER_PROCESS || '50', 10);
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const configured = process.env.APP_ALLOWED_ORIGIN || 'http://localhost:5173';
  return origin === configured || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
}

let liveCallsCount = 0;

// Exported for testing
export function resetLiveCallsBudgetForTesting() {
  liveCallsCount = 0;
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

// 3. In-memory Sliding Window Rate Limiter with Active Cleanup (15 requests per minute per IP)
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
  const hasKey = Boolean(process.env.NEBIUS_API_KEY && process.env.NEBIUS_API_KEY.trim().length > 0);
  const allowLive = process.env.ALLOW_LIVE_AI === 'true';
  const modelId = process.env.NEBIUS_MODEL_ID || 'nvidia/Llama-3.1-Nemotron-70B-Instruct';

  res.json({
    configured: hasKey,
    allowLiveAI: allowLive,
    modelId,
    endpoint: 'Nebius Token Factory (OpenAI-compatible)',
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
  const apiKey = process.env.NEBIUS_API_KEY;
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
      message: 'Nebius API Key is unconfigured or ALLOW_LIVE_AI is disabled. Deterministic local investigation active.',
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
  if (liveCallsCount >= getMaxLiveCalls()) {
    res.status(429).json({
      error: 'Live AI Budget Exhausted',
      code: 'LIVE_BUDGET_EXHAUSTED',
      message: `Inference budget cap of ${getMaxLiveCalls()} calls reached for this server process.`,
    });
    return;
  }

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

    // Increment process live call budget counter
    liveCallsCount++;

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

// Start listening if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[ProofLedger Server] Listening on http://localhost:${PORT}`);
    console.log(`[ProofLedger Server] CORS Origin allowed: ${ALLOWED_ORIGIN}`);
    console.log(`[ProofLedger Server] Live AI Enabled: ${process.env.ALLOW_LIVE_AI === 'true'}`);
  });
}

export default app;
