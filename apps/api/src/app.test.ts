import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createPool } from './db/pool.js';
import { CampaignNotFoundError } from './errors.js';
import { SystemClock } from './ports/clock.port.js';

const CAMPAIGN_ID = '7b0f3c52-1f4a-4a62-9a67-3f0b1b6b9d11';

let app: FastifyInstance | undefined;

async function build(
  register: (instance: FastifyInstance) => void = () => undefined,
): Promise<FastifyInstance> {
  app = await buildApp({ register });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('error handling', () => {
  it('AC-3f: a non-JSON Content-Type returns 415 UNSUPPORTED_MEDIA_TYPE in the error shape', async () => {
    const instance = await build((a) => {
      a.post('/echo', async () => ({ ok: true }));
    });

    const res = await instance.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'text/plain' },
      payload: 'hello',
    });

    expect(res.statusCode).toBe(415);
    expect(res.json()).toEqual({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: expect.any(String) },
    });
  });

  it('remaps Fastify 413 to PAYLOAD_TOO_LARGE', async () => {
    const instance = await build((a) => {
      a.post('/echo', async () => ({ ok: true }));
    });

    const res = await instance.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ blob: 'x'.repeat(1024 * 1024 + 1) }),
    });

    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: expect.any(String) },
    });
  });

  it('AC-3e/AC-25: unknown body properties are rejected, not stripped', async () => {
    const instance = await build((a) => {
      a.post(
        '/strict',
        {
          schema: {
            body: {
              type: 'object',
              additionalProperties: false,
              properties: { name: { type: 'string' } },
            },
          },
        },
        async () => ({ ok: true }),
      );
    });

    const res = await instance.inject({
      method: 'POST',
      url: '/strict',
      payload: { name: 'a', extra: 1 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
    });
  });

  it('maps a malformed JSON body to 400 VALIDATION_ERROR', async () => {
    const instance = await build((a) => {
      a.post('/echo', async () => ({ ok: true }));
    });

    const res = await instance.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('maps a domain error to its code and status', async () => {
    const instance = await build((a) => {
      a.get('/missing', async () => {
        throw new CampaignNotFoundError(CAMPAIGN_ID);
      });
    });

    const res = await instance.inject({ method: 'GET', url: '/missing' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: { code: 'CAMPAIGN_NOT_FOUND', message: expect.any(String) },
    });
  });

  it('AC-38: a Postgres connection error returns 503 SERVICE_UNAVAILABLE without internals', async () => {
    const instance = await build((a) => {
      a.get('/down', async () => {
        throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), {
          code: 'ECONNREFUSED',
        });
      });
    });

    const res = await instance.inject({ method: 'GET', url: '/down' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      error: { code: 'SERVICE_UNAVAILABLE', message: expect.any(String) },
    });
    expect(res.body).not.toContain('ECONNREFUSED');
    expect(res.body).not.toContain('10.0.0.5');
  });

  it('AC-38: an unreachable pool fails within PG_CONNECT_TIMEOUT_MS + 1 s and maps to 503', async () => {
    const pool = createPool({
      connectionString: 'postgres://pulse:pulse@127.0.0.1:1/pulse',
      connectTimeoutMs: 500,
    });
    const instance = await build((a) => {
      a.get('/db', async () => {
        await pool.query('select 1');
        return { ok: true };
      });
    });

    const started = Date.now();
    const res = await instance.inject({ method: 'GET', url: '/db' });
    const elapsed = Date.now() - started;
    await pool.end();

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('SERVICE_UNAVAILABLE');
    expect(elapsed).toBeLessThan(500 + 1000);
  });

  it('AC-39: an unexpected error returns 500 INTERNAL_ERROR without leaking the cause', async () => {
    const instance = await build((a) => {
      a.post('/boom', async () => {
        throw new Error('outbox insert failed: relation "outbox" is locked');
      });
    });

    const res = await instance.inject({ method: 'POST', url: '/boom' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: expect.any(String) },
    });
    expect(res.body).not.toContain('outbox');
  });
});

describe('SystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
