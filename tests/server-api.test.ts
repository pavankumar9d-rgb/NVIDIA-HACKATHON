import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import app, { resetLiveCallsBudgetForTesting, getLiveCallsCountForTesting, resetRateLimiterForTesting, isOriginAllowed } from '../server/index';
import type { Server } from 'http';

describe('Server API Endpoints & Gateway Security', () => {
  let server: Server;
  const PORT = 3099;
  const baseUrl = `http://localhost:${PORT}`;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/health returns healthy status without leaking internal state', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toContain('ProofLedger');
  });

  it('enforces defensive HTTP security headers on all responses and disables X-Powered-By', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('x-xss-protection')).toBe('0');
    expect(res.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('enforces Cache-Control: no-store on sensitive /api/ai/status and /api/investigate endpoints', async () => {
    const statusRes = await fetch(`${baseUrl}/api/ai/status`);
    expect(statusRes.headers.get('cache-control')).toContain('no-store');

    const investigateRes = await fetch(`${baseUrl}/api/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(investigateRes.headers.get('cache-control')).toContain('no-store');
  });

  it('GET /api/ai/status returns configuration state and NEVER leaks the API key', async () => {
    const res = await fetch(`${baseUrl}/api/ai/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('configured');
    expect(body).toHaveProperty('allowLiveAI');
    expect(body).toHaveProperty('modelId');
    // Critical security check: API key field must not exist in response
    expect(body).not.toHaveProperty('apiKey');
    expect(body).not.toHaveProperty('key');
    expect(body).not.toHaveProperty('token');
  });

  it('POST /api/investigate rejects requests missing explicit user consent with 400', async () => {
    const res = await fetch(`${baseUrl}/api/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exceptionId: 'EXP-TEST-01',
        exceptionType: 'AMOUNT_MISMATCH',
        amountDeltaRupees: '240.00',
        dateDeltaDays: 1,
        consentGranted: false, // Disallowed!
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid Request Payload');
  });

  it('POST /api/investigate returns truthful LOCAL_MODE when live AI is disabled', async () => {
    const res = await fetch(`${baseUrl}/api/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exceptionId: 'EXP-TEST-02',
        exceptionType: 'AMOUNT_MISMATCH',
        amountDeltaRupees: '-240.00',
        dateDeltaDays: 0,
        consentGranted: true,
        bankEvidence: {
          id: 'BNK-010',
          date: '2026-09-13',
          amountRupees: '49760.00',
          direction: 'credit',
          sanitizedDescription: 'Client Payment Zenith',
        },
        ledgerEvidence: {
          id: 'LDG-010',
          date: '2026-09-13',
          amountRupees: '50000.00',
          direction: 'credit',
          sanitizedDescription: 'Zenith Brand Invoice',
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // Must be truthful local mode when live key is unconfigured
    expect(['LOCAL_MODE', 'AI_SUCCESS']).toContain(body.status);
    if (body.status === 'LOCAL_MODE') {
      expect(body.message).toContain('Deterministic local investigation active');
    }
  });

  it('POST /api/investigate rejects request with unpermitted extra properties', async () => {
    const res = await fetch(`${baseUrl}/api/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exceptionId: 'EXP-TEST-03',
        exceptionType: 'AMOUNT_MISMATCH',
        amountDeltaRupees: '100.00',
        dateDeltaDays: 0,
        consentGranted: true,
        injectedAttackerField: 'steal_credentials_or_bypass', // Disallowed!
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_PAYLOAD');
  });

  it('POST /api/investigate independently sanitizes PII before forwarding to upstream inference', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-test-key-12345';
    process.env.ALLOW_LIVE_AI = 'true';

    let interceptedRequestBody: any = null;

    globalThis.fetch = async (input: any, init?: any) => {
      // If fetching upstream chat completions, capture the body and return mock response
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        interceptedRequestBody = JSON.parse(init?.body || '{}');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    exceptionId: 'EXP-TEST-04',
                    classification: 'BANK_FEE_OR_SURCHARGE',
                    summary: 'Standard processing fee detected.',
                    evidenceRowIds: ['BNK-010', 'LDG-010'],
                    evidenceExplanation: 'Matches bank charges.',
                    missingEvidence: [],
                    recommendedAction: 'Post journal entry.',
                    confidence: 'HIGH',
                    uncertaintyNotes: '',
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      // Client maliciously sends raw bank account and phone number in allegedly "sanitizedDescription"
      const res = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-TEST-04',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010',
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Transfer to AC 918273645102 from 9876543210',
          },
          ledgerEvidence: {
            id: 'LDG-010',
            date: '2026-09-13',
            amountRupees: '50000.00',
            direction: 'credit',
            sanitizedDescription: 'Zenith Invoice ABCDE1234F',
          },
        }),
      });

      expect(res.status).toBe(200);
      expect(interceptedRequestBody).not.toBeNull();

      const userPrompt = interceptedRequestBody.messages.find((m: any) => m.role === 'user')?.content || '';
      
      // Crucial privacy verification: Raw account, phone, and PAN MUST NOT exist in upstream prompt
      expect(userPrompt).not.toContain('918273645102');
      expect(userPrompt).not.toContain('9876543210');
      expect(userPrompt).not.toContain('ABCDE1234F');

      // Redacted tokens MUST be present
      expect(userPrompt).toContain('[ACCT-REDACTED]');
      expect(userPrompt).toContain('[PHONE-REDACTED]');
      expect(userPrompt).toContain('[PAN-REDACTED]');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate rejects model output with a fabricated row ID (422 PROVENANCE_VIOLATION)', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';

    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    exceptionId: 'EXP-PROV-01',
                    classification: 'BANK_FEE_OR_SURCHARGE',
                    summary: 'Hypothetical fee.',
                    evidenceRowIds: ['BNK-010', 'LDG-999'], // LDG-999 is fabricated!
                    evidenceExplanation: 'Fabricated explanation citing ghost ID.',
                    missingEvidence: [],
                    recommendedAction: 'Check files.',
                    confidence: 'HIGH',
                    uncertaintyNotes: '',
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-PROV-01',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010',
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Client Payment',
          },
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('PROVENANCE_VIOLATION');
      expect(body.invalidIds).toContain('LDG-999');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate rejects model output citing an existing but unauthorized row ID (422 PROVENANCE_VIOLATION)', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';

    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    exceptionId: 'EXP-PROV-02',
                    classification: 'BANK_FEE_OR_SURCHARGE',
                    summary: 'Hypothetical fee.',
                    evidenceRowIds: ['BNK-001'], // BNK-001 exists in session but was NOT in this exception!
                    evidenceExplanation: 'Citing unauthorized row from another transaction.',
                    missingEvidence: [],
                    recommendedAction: 'Check files.',
                    confidence: 'HIGH',
                    uncertaintyNotes: '',
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-PROV-02',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010', // Only BNK-010 is authorized!
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Client Payment',
          },
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('PROVENANCE_VIOLATION');
      expect(body.invalidIds).toContain('BNK-001');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate rejects model output with a mismatched exception ID (422 EXCEPTION_ID_MISMATCH)', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';

    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    exceptionId: 'EXP-MISMATCH-999', // Mismatched!
                    classification: 'BANK_FEE_OR_SURCHARGE',
                    summary: 'Valid summary text.',
                    evidenceRowIds: ['BNK-010'],
                    evidenceExplanation: 'Valid explanation text.',
                    missingEvidence: [],
                    recommendedAction: 'Valid action text.',
                    confidence: 'HIGH',
                    uncertaintyNotes: '',
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-PROV-03',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010',
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Client Payment',
          },
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('EXCEPTION_ID_MISMATCH');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate rejects model output with malformed JSON (422 MODEL_JSON_PARSE_ERROR)', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';

    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Sorry, I am an AI and cannot return JSON right now: { invalid json',
                },
              },
            ],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-PROV-04',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010',
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Client Payment',
          },
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('MODEL_JSON_PARSE_ERROR');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate rejects model output with schema violations or invalid classifications (422 SCHEMA_VIOLATION)', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';

    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    exceptionId: 'EXP-PROV-05',
                    classification: 'INVALID_UNSUPPORTED_TYPE', // Invalid classification!
                    summary: 'Summary here.',
                    evidenceRowIds: ['BNK-010'],
                    evidenceExplanation: 'Explanation here.',
                    missingEvidence: [],
                    recommendedAction: 'Action here.',
                    confidence: 'HIGH',
                    uncertaintyNotes: '',
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-PROV-05',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010',
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Client Payment',
          },
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('SCHEMA_VIOLATION');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate handles upstream provider errors with 502 UPSTREAM_ERROR', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';

    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-PROV-06',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010',
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Client Payment',
          },
        }),
      });

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.code).toBe('UPSTREAM_ERROR');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate blocks unauthorized browser origins with 403 FORBIDDEN_ORIGIN', async () => {
    const res = await fetch(`${baseUrl}/api/investigate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious-phishing-site.com',
      },
      body: JSON.stringify({
        exceptionId: 'EXP-SEC-01',
        exceptionType: 'AMOUNT_MISMATCH',
        amountDeltaRupees: '-240.00',
        dateDeltaDays: 0,
        consentGranted: true,
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('POST /api/investigate enforces process-level live call budget limits with 429 LIVE_BUDGET_EXHAUSTED', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalMaxCalls = process.env.MAX_LIVE_CALLS_PER_PROCESS;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';
    process.env.MAX_LIVE_CALLS_PER_PROCESS = '1'; // Budget = 1 call max
    resetLiveCallsBudgetForTesting();

    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    exceptionId: 'EXP-BUDGET-01',
                    classification: 'BANK_FEE_OR_SURCHARGE',
                    summary: 'Fee confirmed.',
                    evidenceRowIds: ['BNK-010'],
                    evidenceExplanation: 'Explanation.',
                    missingEvidence: [],
                    recommendedAction: 'Action.',
                    confidence: 'HIGH',
                    uncertaintyNotes: '',
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      // Call 1: succeeds and consumes the budget
      const res1 = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-BUDGET-01',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010',
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Client Payment',
          },
        }),
      });
      expect(res1.status).toBe(200);

      // Call 2: Must be blocked by process budget cap!
      const res2 = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-BUDGET-01',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-240.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-010',
            date: '2026-09-13',
            amountRupees: '49760.00',
            direction: 'credit',
            sanitizedDescription: 'Client Payment',
          },
        }),
      });

      expect(res2.status).toBe(429);
      const body2 = await res2.json();
      expect(body2.code).toBe('LIVE_BUDGET_EXHAUSTED');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      process.env.MAX_LIVE_CALLS_PER_PROCESS = originalMaxCalls;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate: failed upstream attempt consumes budget slot upfront and blocks subsequent calls', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalMaxCalls = process.env.MAX_LIVE_CALLS_PER_PROCESS;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';
    process.env.MAX_LIVE_CALLS_PER_PROCESS = '1';
    resetLiveCallsBudgetForTesting();
    resetRateLimiterForTesting();

    // Mock upstream failure: HTTP 503 from Nebius
    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      // Call 1: Upstream fails with 502, but slot is consumed upfront
      const res1 = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-FAIL-01',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-100.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-001',
            date: '2026-09-13',
            amountRupees: '1000.00',
            direction: 'debit',
            sanitizedDescription: 'Vendor Payment',
          },
        }),
      });
      expect(res1.status).toBe(502);
      expect(getLiveCallsCountForTesting()).toBe(1);

      // Call 2: Should immediately hit 429 budget exhaustion because slot was not refunded
      const res2 = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-FAIL-02',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-100.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-001',
            date: '2026-09-13',
            amountRupees: '1000.00',
            direction: 'debit',
            sanitizedDescription: 'Vendor Payment',
          },
        }),
      });
      expect(res2.status).toBe(429);
      const body2 = await res2.json();
      expect(body2.code).toBe('LIVE_BUDGET_EXHAUSTED');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      process.env.MAX_LIVE_CALLS_PER_PROCESS = originalMaxCalls;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate: upstream timeout consumes budget slot upfront and blocks subsequent calls', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalMaxCalls = process.env.MAX_LIVE_CALLS_PER_PROCESS;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';
    process.env.MAX_LIVE_CALLS_PER_PROCESS = '1';
    resetLiveCallsBudgetForTesting();
    resetRateLimiterForTesting();

    // Mock upstream timeout via AbortError
    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      return originalFetch(input, init);
    };

    try {
      const res1 = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-TIMEOUT-01',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-100.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-001',
            date: '2026-09-13',
            amountRupees: '1000.00',
            direction: 'debit',
            sanitizedDescription: 'Vendor Payment',
          },
        }),
      });
      expect(res1.status).toBe(504);
      expect(getLiveCallsCountForTesting()).toBe(1);

      // Call 2: Blocked by budget cap
      const res2 = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-TIMEOUT-02',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-100.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-001',
            date: '2026-09-13',
            amountRupees: '1000.00',
            direction: 'debit',
            sanitizedDescription: 'Vendor Payment',
          },
        }),
      });
      expect(res2.status).toBe(429);
      const body2 = await res2.json();
      expect(body2.code).toBe('LIVE_BUDGET_EXHAUSTED');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      process.env.MAX_LIVE_CALLS_PER_PROCESS = originalMaxCalls;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate: invalid model JSON output consumes budget slot upfront and blocks subsequent calls', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalMaxCalls = process.env.MAX_LIVE_CALLS_PER_PROCESS;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';
    process.env.MAX_LIVE_CALLS_PER_PROCESS = '1';
    resetLiveCallsBudgetForTesting();
    resetRateLimiterForTesting();

    // Mock upstream response with malformed non-JSON
    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'MALFORMED NON-JSON RESPONSE' } }],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      const res1 = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-JSON-01',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-50.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-001',
            date: '2026-09-13',
            amountRupees: '500.00',
            direction: 'debit',
            sanitizedDescription: 'Test Debit',
          },
        }),
      });
      expect(res1.status).toBe(422);
      expect(getLiveCallsCountForTesting()).toBe(1);

      // Call 2: Blocked by budget cap
      const res2 = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-JSON-02',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-50.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-001',
            date: '2026-09-13',
            amountRupees: '500.00',
            direction: 'debit',
            sanitizedDescription: 'Test Debit',
          },
        }),
      });
      expect(res2.status).toBe(429);
      const body2 = await res2.json();
      expect(body2.code).toBe('LIVE_BUDGET_EXHAUSTED');
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      process.env.MAX_LIVE_CALLS_PER_PROCESS = originalMaxCalls;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate: concurrent requests cannot exceed configured budget cap', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalMaxCalls = process.env.MAX_LIVE_CALLS_PER_PROCESS;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';
    process.env.MAX_LIVE_CALLS_PER_PROCESS = '2'; // Cap = 2
    resetLiveCallsBudgetForTesting();
    resetRateLimiterForTesting();

    let concurrentInFlight = 0;
    let maxSeenInFlight = 0;
    let totalDispatched = 0;

    globalThis.fetch = async (input: any, init?: any) => {
      if (typeof input === 'string' && input.includes('tokenfactory.nebius.com')) {
        totalDispatched++;
        concurrentInFlight++;
        maxSeenInFlight = Math.max(maxSeenInFlight, concurrentInFlight);
        // Simulate network turnaround delay
        await new Promise((r) => setTimeout(r, 25));
        concurrentInFlight--;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    exceptionId: 'EXP-CONCURRENT',
                    classification: 'TIMING_DIFFERENCE',
                    summary: 'Timing matched.',
                    evidenceRowIds: ['BNK-001'],
                    evidenceExplanation: 'Explanation.',
                    missingEvidence: [],
                    recommendedAction: 'Action.',
                    confidence: 'HIGH',
                    uncertaintyNotes: '',
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return originalFetch(input, init);
    };

    try {
      const payload = {
        exceptionId: 'EXP-CONCURRENT',
        exceptionType: 'TIMING_DIFFERENCE',
        amountDeltaRupees: '0.00',
        dateDeltaDays: 1,
        consentGranted: true,
        bankEvidence: {
          id: 'BNK-001',
          date: '2026-09-13',
          amountRupees: '500.00',
          direction: 'credit',
          sanitizedDescription: 'Wire Transfer',
        },
      };

      // Launch 5 concurrent requests simultaneously
      const promises = Array.from({ length: 5 }).map(() =>
        originalFetch(`${baseUrl}/api/investigate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);

      const count200 = statuses.filter((s) => s === 200).length;
      const count429 = statuses.filter((s) => s === 429).length;

      expect(count200).toBe(2);
      expect(count429).toBe(3);
      expect(totalDispatched).toBe(2);
      expect(getLiveCallsCountForTesting()).toBe(2);
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      process.env.MAX_LIVE_CALLS_PER_PROCESS = originalMaxCalls;
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/investigate: invalid budget configuration fails safely by disallowing calls', async () => {
    const originalApiKey = process.env.NEBIUS_API_KEY;
    const originalAllowLive = process.env.ALLOW_LIVE_AI;
    const originalMaxCalls = process.env.MAX_LIVE_CALLS_PER_PROCESS;
    const originalFetch = globalThis.fetch;

    process.env.NEBIUS_API_KEY = 'mock-key';
    process.env.ALLOW_LIVE_AI = 'true';
    process.env.MAX_LIVE_CALLS_PER_PROCESS = 'not-a-number'; // Invalid non-numeric cap
    resetLiveCallsBudgetForTesting();
    resetRateLimiterForTesting();

    try {
      const res = await originalFetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: 'EXP-SAFE-01',
          exceptionType: 'AMOUNT_MISMATCH',
          amountDeltaRupees: '-10.00',
          dateDeltaDays: 0,
          consentGranted: true,
          bankEvidence: {
            id: 'BNK-001',
            date: '2026-09-13',
            amountRupees: '100.00',
            direction: 'debit',
            sanitizedDescription: 'Check',
          },
        }),
      });

      // Must fail closed with 429 rather than allowing unlimited requests
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.code).toBe('LIVE_BUDGET_EXHAUSTED');
      expect(getLiveCallsCountForTesting()).toBe(0);
    } finally {
      process.env.NEBIUS_API_KEY = originalApiKey;
      process.env.ALLOW_LIVE_AI = originalAllowLive;
      process.env.MAX_LIVE_CALLS_PER_PROCESS = originalMaxCalls;
      globalThis.fetch = originalFetch;
    }
  });

  it('GET /api/ai/status includes live call budget telemetry safely', async () => {
    const res = await fetch(`${baseUrl}/api/ai/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('liveCallsBudget');
    expect(body.liveCallsBudget).toHaveProperty('maxPerProcess');
    expect(body.liveCallsBudget).toHaveProperty('completed');
    expect(body.liveCallsBudget).toHaveProperty('remaining');
  });

  it('GET / serves the built frontend SPA from dist/', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.toLowerCase()).toContain('<!doctype html>');
    expect(text).toContain('id="root"');
  });

  it('GET /workspace serves SPA index.html for client-side routing', async () => {
    const res = await fetch(`${baseUrl}/workspace`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.toLowerCase()).toContain('<!doctype html>');
    expect(text).toContain('id="root"');
  });

  it('GET /api/nonexistent returns 404 JSON and is NOT swallowed by SPA fallback', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.code).toBe('API_NOT_FOUND');
    expect(body.error).toBe('API Endpoint Not Found');
  });

  it('POST /api/unknown/subpath returns 404 JSON and is NOT swallowed by SPA fallback', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/subpath`, { method: 'POST' });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.code).toBe('API_NOT_FOUND');
  });

  it('permits origin matching RENDER_EXTERNAL_URL in production', async () => {
    const originalRenderUrl = process.env.RENDER_EXTERNAL_URL;
    process.env.RENDER_EXTERNAL_URL = 'https://proofledger-ai.onrender.com';
    try {
      const res = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'https://proofledger-ai.onrender.com' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://proofledger-ai.onrender.com');
    } finally {
      process.env.RENDER_EXTERNAL_URL = originalRenderUrl;
    }
  });

  it('in production, rejects unconfigured localhost origins on HTTP endpoints and accepts exact Render origin', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAllowedOrigin = process.env.APP_ALLOWED_ORIGIN;
    const originalRenderUrl = process.env.RENDER_EXTERNAL_URL;

    process.env.NODE_ENV = 'production';
    process.env.APP_ALLOWED_ORIGIN = 'https://proofledger-prod.onrender.com';
    delete process.env.RENDER_EXTERNAL_URL;

    try {
      // 1. Unconfigured localhost must be rejected by CORS in production
      const corsRes = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'http://localhost:5173' },
      });
      expect(corsRes.status).toBe(200);
      expect(corsRes.headers.get('access-control-allow-origin')).toBeNull();

      // 2. Unconfigured localhost must be blocked by originValidator with 403 FORBIDDEN_ORIGIN
      const postRes = await fetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ exceptionId: 'EXP-1' }),
      });
      expect(postRes.status).toBe(403);
      const postBody = await postRes.json();
      expect(postBody.code).toBe('FORBIDDEN_ORIGIN');

      // 3. Configured Render origin must be accepted
      const validRes = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'https://proofledger-prod.onrender.com' },
      });
      expect(validRes.status).toBe(200);
      expect(validRes.headers.get('access-control-allow-origin')).toBe('https://proofledger-prod.onrender.com');

      // 4. Unit checks for isOriginAllowed in production
      expect(isOriginAllowed('http://localhost:5173')).toBe(false);
      expect(isOriginAllowed('http://127.0.0.1:3000')).toBe(false);
      expect(isOriginAllowed('https://proofledger-prod.onrender.com')).toBe(true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.APP_ALLOWED_ORIGIN = originalAllowedOrigin;
      process.env.RENDER_EXTERNAL_URL = originalRenderUrl;
    }
  });

  it('CORS Origin Matrix: verifies allowed origins, blocked origins, and production rejection of localhost', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAllowedOrigin = process.env.APP_ALLOWED_ORIGIN;
    const originalRenderUrl = process.env.RENDER_EXTERNAL_URL;

    try {
      // Test A: Production Mode with explicit allowed origin
      process.env.NODE_ENV = 'production';
      process.env.APP_ALLOWED_ORIGIN = 'https://proofledger-ai.onrender.com';
      delete process.env.RENDER_EXTERNAL_URL;

      // 1. Production permits exact allowed origin
      expect(isOriginAllowed('https://proofledger-ai.onrender.com')).toBe(true);
      const prodAllowedRes = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'https://proofledger-ai.onrender.com' },
      });
      expect(prodAllowedRes.status).toBe(200);
      expect(prodAllowedRes.headers.get('access-control-allow-origin')).toBe('https://proofledger-ai.onrender.com');

      // 2. Production rejects localhost:5173, localhost:3000, 127.0.0.1
      expect(isOriginAllowed('http://localhost:5173')).toBe(false);
      expect(isOriginAllowed('http://localhost:3000')).toBe(false);
      expect(isOriginAllowed('http://127.0.0.1:8080')).toBe(false);
      const prodLocalhostRes = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'http://localhost:5173' },
      });
      expect(prodLocalhostRes.status).toBe(200);
      expect(prodLocalhostRes.headers.get('access-control-allow-origin')).toBeNull();

      // 3. Production rejects arbitrary third-party origins
      expect(isOriginAllowed('https://evil-attacker.com')).toBe(false);
      expect(isOriginAllowed('https://attacker-proofledger.onrender.com')).toBe(false);
      const prodAttackerRes = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'https://evil-attacker.com' },
      });
      expect(prodAttackerRes.status).toBe(200);
      expect(prodAttackerRes.headers.get('access-control-allow-origin')).toBeNull();

      // 4. Production originValidator blocks POST /api/investigate with 403
      const prodBlockedPost = await fetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil-attacker.com',
        },
        body: JSON.stringify({ exceptionId: 'EXP-1' }),
      });
      expect(prodBlockedPost.status).toBe(403);
      const blockedBody = await prodBlockedPost.json();
      expect(blockedBody.code).toBe('FORBIDDEN_ORIGIN');

      // Test B: Absent and null Origin handling (non-browser clients or sandboxed iframes)
      // Note: Direct non-browser HTTP clients (curl, backend jobs) omit the Origin header.
      // CORS is a browser security mechanism, NOT caller authentication or authorization.
      // Even when Origin is absent, request payload validation, rate limiting, and business logic remain enforced.
      expect(isOriginAllowed(undefined)).toBe(true);
      expect(isOriginAllowed('')).toBe(false);
      expect(isOriginAllowed('null')).toBe(false); // Sandboxed iframe or file:// origin 'null' is rejected

      const noOriginHealthRes = await fetch(`${baseUrl}/api/health`);
      expect(noOriginHealthRes.status).toBe(200);
      // No Access-Control-Allow-Origin header is emitted when Origin is absent
      expect(noOriginHealthRes.headers.get('access-control-allow-origin')).toBeNull();

      // Even without Origin header, POST /api/investigate strictly enforces payload validation schema
      const noOriginInvalidPost = await fetch(`${baseUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(noOriginInvalidPost.status).toBe(400);
      const invalidBody = await noOriginInvalidPost.json();
      expect(invalidBody.code).toBe('INVALID_PAYLOAD');

      // Test C: Development Mode permits local loopback origins but blocks arbitrary domains
      process.env.NODE_ENV = 'development';
      process.env.APP_ALLOWED_ORIGIN = 'http://localhost:5173';

      expect(isOriginAllowed('http://localhost:5173')).toBe(true);
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:5173')).toBe(true);
      expect(isOriginAllowed('https://untrusted-external-site.com')).toBe(false);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.APP_ALLOWED_ORIGIN = originalAllowedOrigin;
      process.env.RENDER_EXTERNAL_URL = originalRenderUrl;
    }
  });

  it('strictly rejects wildcard origin configuration across all environments', () => {
    const originalAllowedOrigin = process.env.APP_ALLOWED_ORIGIN;
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.APP_ALLOWED_ORIGIN = '*';
      process.env.NODE_ENV = 'production';
      expect(isOriginAllowed('*')).toBe(false);
      expect(isOriginAllowed('https://malicious.com')).toBe(false);

      process.env.NODE_ENV = 'development';
      expect(isOriginAllowed('*')).toBe(false);
    } finally {
      process.env.APP_ALLOWED_ORIGIN = originalAllowedOrigin;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('in development, permits localhost and 127.0.0.1 loopback origins', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAllowedOrigin = process.env.APP_ALLOWED_ORIGIN;

    try {
      process.env.NODE_ENV = 'development';
      process.env.APP_ALLOWED_ORIGIN = 'http://localhost:5173';

      expect(isOriginAllowed('http://localhost:5173')).toBe(true);
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:4173')).toBe(true);
      expect(isOriginAllowed('https://unauthorized-domain.com')).toBe(false);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.APP_ALLOWED_ORIGIN = originalAllowedOrigin;
    }
  });

  it('enforces 32 KB body size limit on POST requests: accepts legitimate compact requests and returns 413 for oversized payloads', async () => {
    // 1. Schema-valid investigation request (~1-2 KB).
    // Note: InvestigationRequestSchema strictly bounds individual fields:
    // sanitizedDescription <= 300 chars, exceptionType <= 50 chars, amounts <= 20 chars.
    // Consequently, legitimate schema-valid single-exception requests are inherently compact (~1-2 KB).
    // This design prevents bloat, memory exhaustion, and excess token consumption.
    const validCompactPayload = {
      exceptionId: 'EXP-BODY-01',
      exceptionType: 'AMOUNT_MISMATCH',
      amountDeltaRupees: '150.00',
      dateDeltaDays: 1,
      consentGranted: true,
      bankEvidence: {
        id: 'BNK-100',
        date: '2026-09-15',
        amountRupees: '10000.00',
        direction: 'debit',
        sanitizedDescription: 'Vendor Payment for Service Contract Ref 98234'.padEnd(280, ' '),
      },
      ledgerEvidence: {
        id: 'LDG-100',
        date: '2026-09-14',
        amountRupees: '10150.00',
        direction: 'debit',
        sanitizedDescription: 'Vendor Invoice 98234 with Service Tax'.padEnd(280, ' '),
      },
    };

    const legitimateRes = await fetch(`${baseUrl}/api/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCompactPayload),
    });

    // Body parser accepts it; route handles it (returns 200 LOCAL_MODE since live AI is disabled)
    expect(legitimateRes.status).toBe(200);
    const validBody = await legitimateRes.json();
    expect(validBody.status).toBe('LOCAL_MODE');

    // 2. Oversized payload exceeding 32 KB parser limit (~45 KB).
    // The express.json({ limit: '32kb' }) middleware intercepts this before schema validation,
    // triggering the custom JSON error middleware which returns HTTP 413 PAYLOAD_TOO_LARGE.
    const oversizedPayload = {
      exceptionId: 'EXP-BODY-02',
      exceptionType: 'AMOUNT_MISMATCH',
      amountDeltaRupees: '150.00',
      dateDeltaDays: 1,
      consentGranted: true,
      bankEvidence: {
        id: 'BNK-101',
        date: '2026-09-15',
        amountRupees: '10000.00',
        direction: 'debit',
        sanitizedDescription: 'X'.repeat(45000), // ~45 KB string > 32 KB limit
      },
    };

    const oversizedRes = await fetch(`${baseUrl}/api/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(oversizedPayload),
    });

    expect(oversizedRes.status).toBe(413);
    const errorBody = await oversizedRes.json();
    expect(errorBody.code).toBe('PAYLOAD_TOO_LARGE');
    expect(errorBody.error).toBe('Payload Too Large');
    expect(errorBody.message).toContain('32 KB');
  });

  describe('POST /api/account/delete Endpoint Security', () => {
    beforeEach(() => {
      resetRateLimiterForTesting();
    });
    it('rejects unauthenticated requests missing Bearer token with 401', async () => {
      const res = await fetch(`${baseUrl}/api/account/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests with malformed Authorization headers with 401', async () => {
      const res = await fetch(`${baseUrl}/api/account/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic invalid-basic-token',
        },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('returns 503 SERVICE_ROLE_UNCONFIGURED when server administrative key is unset', async () => {
      const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        const res = await fetch(`${baseUrl}/api/account/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-user-access-token-12345',
          },
        });
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.code).toBe('SERVICE_ROLE_UNCONFIGURED');
        expect(body.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
      } finally {
        if (originalServiceKey) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
        }
      }
    });

    it('verifies caller identity against Supabase Auth before processing deletion', async () => {
      const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const originalSupabaseUrl = process.env.VITE_SUPABASE_URL;
      const originalFetch = globalThis.fetch;

      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
      process.env.VITE_SUPABASE_URL = 'https://mock-project.supabase.co';

      let verifiedAuthHeader: string | null = null;
      let historyPurgedForUser: string | null = null;
      let adminDeletedUser: string | null = null;

      globalThis.fetch = async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input.url;

        // Verify user endpoint
        if (urlStr.includes('/auth/v1/user')) {
          verifiedAuthHeader = init?.headers?.Authorization;
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'usr-verified-999', email: 'verified@example.com' }),
          } as any;
        }

        // History delete endpoint
        if (urlStr.includes('/rest/v1/reconciliation_history')) {
          historyPurgedForUser = urlStr;
          return { ok: true, status: 200, json: async () => [] } as any;
        }

        // Admin user delete endpoint
        if (urlStr.includes('/auth/v1/admin/users/usr-verified-999')) {
          adminDeletedUser = 'usr-verified-999';
          return { ok: true, status: 200, json: async () => ({}) } as any;
        }

        return originalFetch(input, init);
      };

      try {
        const res = await originalFetch(`${baseUrl}/api/account/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-user-token-abc',
          },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(verifiedAuthHeader).toBe('Bearer valid-user-token-abc');
        expect(historyPurgedForUser).toContain('user_id=eq.usr-verified-999');
        expect(adminDeletedUser).toBe('usr-verified-999');
      } finally {
        if (originalServiceKey) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
        } else {
          delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        }
        process.env.VITE_SUPABASE_URL = originalSupabaseUrl;
        globalThis.fetch = originalFetch;
      }
    });

    it('POST /api/account/delete handles partial failure when history is purged but identity deletion fails with 502', async () => {
      const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const originalSupabaseUrl = process.env.VITE_SUPABASE_URL;
      const originalFetch = globalThis.fetch;

      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
      process.env.VITE_SUPABASE_URL = 'https://mock-project.supabase.co';

      globalThis.fetch = async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input.url;

        // Verify user endpoint succeeds
        if (urlStr.includes('/auth/v1/user')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'usr-partial-fail-1', email: 'partial@example.com' }),
          } as any;
        }

        // History delete endpoint succeeds
        if (urlStr.includes('/rest/v1/reconciliation_history')) {
          return { ok: true, status: 200, json: async () => [] } as any;
        }

        // Admin user delete endpoint fails
        if (urlStr.includes('/auth/v1/admin/users/')) {
          return {
            ok: false,
            status: 500,
            text: async () => 'Database connection timeout in identity service',
          } as any;
        }

        return originalFetch(input, init);
      };

      try {
        const res = await originalFetch(`${baseUrl}/api/account/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-user-token-partial',
          },
        });

        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.code).toBe('ADMIN_DELETE_FAILED');
        expect(body.message).toContain('Reconciliation history was purged, but identity deletion failed');
      } finally {
        if (originalServiceKey) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
        } else {
          delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        }
        process.env.VITE_SUPABASE_URL = originalSupabaseUrl;
        globalThis.fetch = originalFetch;
      }
    });
  });
});
