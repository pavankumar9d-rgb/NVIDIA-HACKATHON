import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app, { resetLiveCallsBudgetForTesting } from '../server/index';
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

  it('GET /api/ai/status includes live call budget telemetry safely', async () => {
    const res = await fetch(`${baseUrl}/api/ai/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('liveCallsBudget');
    expect(body.liveCallsBudget).toHaveProperty('maxPerProcess');
    expect(body.liveCallsBudget).toHaveProperty('completed');
    expect(body.liveCallsBudget).toHaveProperty('remaining');
  });
});
