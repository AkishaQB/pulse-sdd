import type pg from 'pg';
import { createPool, DEFAULT_PG_CONNECT_TIMEOUT_MS } from './db/pool.js';
import { SystemClock, type Clock } from './ports/clock.port.js';

export interface Container {
  clock: Clock;
  pool: pg.Pool;
  close(): Promise<void>;
}

/** Wiring only. Repositories and the campaign service are added in T8–T12. */
export function createContainer(env: NodeJS.ProcessEnv = process.env): Container {
  const pool = createPool({
    connectionString: env['DATABASE_URL'] ?? 'postgres://pulse:pulse@localhost:5432/pulse',
    connectTimeoutMs: Number(env['PG_CONNECT_TIMEOUT_MS'] ?? DEFAULT_PG_CONNECT_TIMEOUT_MS),
  });

  return {
    clock: new SystemClock(),
    pool,
    close: () => pool.end(),
  };
}
