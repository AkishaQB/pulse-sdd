import pg from 'pg';

export const DEFAULT_PG_CONNECT_TIMEOUT_MS = 2000;

export interface PoolOptions {
  connectionString: string;
  connectTimeoutMs?: number;
}

/** Spec §10: connections fail fast after `PG_CONNECT_TIMEOUT_MS` (default 2000). */
export function createPool(options: PoolOptions): pg.Pool {
  return new pg.Pool({
    connectionString: options.connectionString,
    connectionTimeoutMillis: options.connectTimeoutMs ?? DEFAULT_PG_CONNECT_TIMEOUT_MS,
  });
}

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'EPIPE',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
]);

/** True when `err` means Postgres can't be reached (AC-38), as opposed to a query failure. */
export function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && (CONNECTION_ERROR_CODES.has(code) || code.startsWith('08'))) {
    return true;
  }
  // pg raises plain Errors for pool timeouts and dropped connections.
  return /timeout exceeded when trying to connect|Connection terminated|Client has encountered a connection error/i.test(
    err.message,
  );
}
