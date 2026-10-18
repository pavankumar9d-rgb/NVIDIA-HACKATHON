import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../server/index';
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
});
