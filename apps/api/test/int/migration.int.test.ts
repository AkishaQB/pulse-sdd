import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { runner } from 'node-pg-migrate';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../db/migrations');

const SEGMENT_ID = '00000000-0000-4000-8000-000000000001';

let container: StartedPostgreSqlContainer;
let client: pg.Client;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  await runner({
    databaseUrl: container.getConnectionUri(),
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => undefined,
  });
  client = new pg.Client({ connectionString: container.getConnectionUri() });
  await client.connect();
  await client.query(`INSERT INTO segments (id, name) VALUES ($1, 'stub')`, [SEGMENT_ID]);
}, 120_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

async function columns(table: string): Promise<Record<string, { type: string; nullable: boolean; default: string | null }>> {
  const { rows } = await client.query<{ column_name: string; udt_name: string; is_nullable: string; column_default: string | null }>(
    `SELECT column_name, udt_name, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return Object.fromEntries(
    rows.map((r) => [r.column_name, { type: r.udt_name, nullable: r.is_nullable === 'YES', default: r.column_default }]),
  );
}

async function pgError(sql: string, params: unknown[] = []): Promise<string | undefined> {
  await client.query('SAVEPOINT s');
  try {
    await client.query(sql, params);
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT s');
  }
}

async function indexDef(name: string): Promise<string | undefined> {
  const { rows } = await client.query<{ indexdef: string }>(
    `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
    [name],
  );
  return rows[0]?.indexdef;
}

const insertCampaign = `INSERT INTO campaigns (id, name, segment_id, channel, message, description, tags, scheduled_at, status, version)
  VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`;

function campaign(overrides: Partial<Record<'name' | 'segment' | 'channel' | 'message' | 'description' | 'tags' | 'scheduledAt' | 'status' | 'version', unknown>> = {}): unknown[] {
  const v = { name: 'n', segment: SEGMENT_ID, channel: 'email', message: 'm', description: null, tags: [], scheduledAt: null, status: 'draft', version: 1, ...overrides };
  return [v.name, v.segment, v.channel, v.message, v.description, v.tags, v.scheduledAt, v.status, v.version];
}

describe('001 migration (§6 data model)', () => {
  it('§6: creates segments stub table', async () => {
    const c = await columns('segments');
    expect(c).toEqual({
      id: { type: 'uuid', nullable: false, default: null },
      name: { type: 'text', nullable: false, default: null },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    });
  });

  it('§6: creates campaigns table with the specified columns and defaults', async () => {
    const c = await columns('campaigns');
    expect(Object.keys(c).sort()).toEqual(
      ['channel', 'created_at', 'description', 'id', 'message', 'name', 'scheduled_at', 'segment_id', 'status', 'tags', 'updated_at', 'version'].sort(),
    );
    expect(c.id).toMatchObject({ type: 'uuid', nullable: false });
    expect(c.description).toMatchObject({ type: 'text', nullable: true });
    expect(c.tags).toMatchObject({ type: '_text', nullable: false, default: "'{}'::text[]" });
    expect(c.scheduled_at).toMatchObject({ type: 'timestamptz', nullable: true });
    expect(c.status).toMatchObject({ type: 'text', nullable: false, default: "'draft'::text" });
    expect(c.version).toMatchObject({ type: 'int4', nullable: false, default: '1' });
    expect(c.created_at).toMatchObject({ type: 'timestamptz', nullable: false, default: 'now()' });
    expect(c.updated_at).toMatchObject({ type: 'timestamptz', nullable: false, default: 'now()' });
  });

  it('§6: creates idempotency_keys table without an FK to campaigns (AC-9)', async () => {
    const c = await columns('idempotency_keys');
    expect(Object.keys(c).sort()).toEqual(['campaign_id', 'created_at', 'key', 'request_hash', 'response_status']);
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'idempotency_keys' AND constraint_type = 'FOREIGN KEY'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('§6: creates outbox table with unique event_id', async () => {
    const c = await columns('outbox');
    expect(Object.keys(c).sort()).toEqual(
      ['aggregate_id', 'aggregate_type', 'event_id', 'event_type', 'id', 'occurred_at', 'payload', 'published_at'].sort(),
    );
    expect(c.id).toMatchObject({ type: 'int8' });
    expect(c.payload).toMatchObject({ type: 'jsonb', nullable: false });
    expect(c.published_at).toMatchObject({ nullable: true });
    const insert = `INSERT INTO outbox (event_id, aggregate_type, aggregate_id, event_type, payload, occurred_at)
      VALUES ('00000000-0000-4000-8000-0000000000aa', 'campaign', gen_random_uuid(), 'CampaignScheduled', '{}', now())`;
    await client.query('BEGIN');
    try {
      await client.query(insert);
      expect(await pgError(insert)).toBe('23505');
    } finally {
      await client.query('ROLLBACK');
    }
  });

  describe('campaigns constraints', () => {
    beforeAll(() => client.query('BEGIN'));
    afterAll(() => client.query('ROLLBACK'));

    it('§6: accepts a valid row', async () => {
      expect(await pgError(insertCampaign, campaign())).toBeUndefined();
    });

    it('§6: segment_id FK violation raises 23503 (AC-2, AC-26)', async () => {
      expect(await pgError(insertCampaign, campaign({ segment: '00000000-0000-4000-8000-0000000000ff' }))).toBe('23503');
    });

    it('§6: segment delete is restricted while referenced', async () => {
      await client.query('SAVEPOINT ref');
      await client.query(insertCampaign, campaign());
      expect(await pgError(`DELETE FROM segments WHERE id = $1`, [SEGMENT_ID])).toBe('23503');
      await client.query('ROLLBACK TO SAVEPOINT ref');
      const { rows } = await client.query<{ confdeltype: string }>(
        `SELECT confdeltype FROM pg_constraint WHERE conrelid = 'campaigns'::regclass AND contype = 'f'`,
      );
      expect(rows).toEqual([{ confdeltype: 'r' }]);
    });

    it.each([
      ['channel not in line|email|webhook', { channel: 'sms' }],
      ['unknown status', { status: 'paused' }],
      ['empty name', { name: '' }],
      ['name over 120 chars', { name: 'x'.repeat(121) }],
      ['empty message', { message: '' }],
      ['message over 2000 chars', { message: 'x'.repeat(2001) }],
      ['description over 500 chars', { description: 'x'.repeat(501) }],
      ['more than 10 tags', { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
      ['version below 1', { version: 0 }],
      ['scheduled without scheduled_at', { status: 'scheduled', scheduledAt: null }],
    ])('§6: CHECK rejects %s', async (_label, overrides) => {
      expect(await pgError(insertCampaign, campaign(overrides))).toBe('23514');
    });

    it.each([
      ['name of 120 chars', { name: 'x'.repeat(120) }],
      ['message of 2000 chars', { message: 'x'.repeat(2000) }],
      ['description of 500 chars', { description: 'x'.repeat(500) }],
      ['10 tags', { tags: Array.from({ length: 10 }, (_, i) => `t${i}`) }],
      ['scheduled with scheduled_at', { status: 'scheduled', scheduledAt: '2030-01-01T00:00:00Z' }],
      ['each allowed status', { status: 'sent' }],
    ])('§6: CHECK accepts %s', async (_label, overrides) => {
      expect(await pgError(insertCampaign, campaign(overrides))).toBeUndefined();
    });
  });

  describe('indexes', () => {
    it('AC-12: campaigns (created_at desc, id desc) index exists', async () => {
      expect(await indexDef('campaigns_created_at_id_idx')).toMatch(/\(created_at DESC, id DESC\)$/);
    });

    it('AC-14: campaigns (status, created_at desc, id desc) index exists', async () => {
      expect(await indexDef('campaigns_status_created_at_id_idx')).toMatch(/\(status, created_at DESC, id DESC\)$/);
    });

    it('§6: partial outbox index on unpublished rows exists', async () => {
      expect(await indexDef('outbox_unpublished_idx')).toMatch(/\(id\) WHERE \(published_at IS NULL\)$/);
    });

    it('§6: no campaigns(segment_id) index in 001', async () => {
      const { rows } = await client.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'campaigns'`,
      );
      expect(rows.some((r) => /\(segment_id\)/.test(r.indexdef))).toBe(false);
    });
  });
});
