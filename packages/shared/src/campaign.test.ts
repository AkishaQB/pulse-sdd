import { Ajv } from 'ajv';
import addFormatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  campaignIdParamsSchema,
  createCampaignBodySchema,
  createCampaignHeadersSchema,
  ifMatchHeadersSchema,
  listCampaignsQuerySchema,
  patchCampaignBodySchema,
} from './campaign.js';

// ajv-formats ships CJS; under NodeNext the callable is on `.default`.
const addFormats = addFormatsModule.default;

// Mirrors the options the API must give Fastify: reject (not strip) unknown properties.
const ajv = new Ajv({ allErrors: true, removeAdditional: false, coerceTypes: 'array' });
addFormats(ajv);

const validCreate = {
  name: 'Spring sale',
  segmentId: '7f1c2a8e-3b4d-4e5f-9a6b-1c2d3e4f5a6b',
  channel: 'email',
  message: 'Hello',
};

const validateCreate = ajv.compile(createCampaignBodySchema);
const validatePatch = ajv.compile(patchCampaignBodySchema);
const validateList = ajv.compile(listCampaignsQuerySchema);
const validateCreateHeaders = ajv.compile(createCampaignHeadersSchema);
const validateIfMatch = ajv.compile(ifMatchHeadersSchema);
const validateParams = ajv.compile(campaignIdParamsSchema);

describe('createCampaignBodySchema', () => {
  it('AC-1: accepts a valid body with and without optional fields', () => {
    expect(validateCreate({ ...validCreate })).toBe(true);
    expect(
      validateCreate({
        ...validCreate,
        description: 'd',
        tags: ['spring', 'sale-2026'],
        scheduledAt: '2026-11-01T10:00:00.000Z',
      }),
    ).toBe(true);
  });

  it.each(['name', 'segmentId', 'channel', 'message'])('AC-3a: rejects a body missing %s', (field) => {
    const body = Object.fromEntries(Object.entries(validCreate).filter(([key]) => key !== field));
    expect(validateCreate(body)).toBe(false);
  });

  it.each([
    ['empty name', { name: '' }],
    ['name over 120', { name: 'x'.repeat(121) }],
    ['empty message', { message: '' }],
    ['message over 2000', { message: 'x'.repeat(2001) }],
    ['description over 500', { description: 'x'.repeat(501) }],
  ])('AC-3b: rejects %s', (_label, patch) => {
    expect(validateCreate({ ...validCreate, ...patch })).toBe(false);
  });

  it('AC-3b: accepts length boundaries', () => {
    expect(
      validateCreate({ ...validCreate, name: 'x'.repeat(120), message: 'x'.repeat(2000), description: 'x'.repeat(500) }),
    ).toBe(true);
  });

  it.each([
    ['more than 10 tags', Array.from({ length: 11 }, (_, i) => `t${i}`)],
    ['an uppercase tag', ['Spring']],
    ['an empty tag', ['']],
    ['a tag over 32 chars', ['x'.repeat(33)]],
    ['duplicate tags', ['a', 'a']],
  ])('AC-3c: rejects %s', (_label, tags) => {
    expect(validateCreate({ ...validCreate, tags })).toBe(false);
  });

  it('AC-3c: accepts 10 valid tags', () => {
    expect(validateCreate({ ...validCreate, tags: Array.from({ length: 10 }, (_, i) => `t-${i}`) })).toBe(true);
  });

  it.each([
    ['non-UUID segmentId', { segmentId: 'abc' }],
    ['unknown channel', { channel: 'sms' }],
    ['non date-time scheduledAt', { scheduledAt: 'tomorrow' }],
    ['date-only scheduledAt', { scheduledAt: '2026-11-01' }],
  ])('AC-3d: rejects %s', (_label, patch) => {
    expect(validateCreate({ ...validCreate, ...patch })).toBe(false);
  });

  it('AC-3e: rejects an unknown property', () => {
    expect(validateCreate({ ...validCreate, foo: 1 })).toBe(false);
  });
});

describe('createCampaignHeadersSchema', () => {
  it('AC-7: rejects an empty or over-128-char Idempotency-Key', () => {
    expect(validateCreateHeaders({ 'idempotency-key': '' })).toBe(false);
    expect(validateCreateHeaders({ 'idempotency-key': 'k'.repeat(129) })).toBe(false);
  });

  it('AC-7: accepts a missing key and keys of 1 and 128 chars', () => {
    expect(validateCreateHeaders({})).toBe(true);
    expect(validateCreateHeaders({ 'idempotency-key': 'k' })).toBe(true);
    expect(validateCreateHeaders({ 'idempotency-key': 'k'.repeat(128) })).toBe(true);
  });
});

describe('campaignIdParamsSchema', () => {
  it('AC-11b: rejects a non-UUID id', () => {
    expect(validateParams({ id: 'nope' })).toBe(false);
    expect(validateParams({ id: validCreate.segmentId })).toBe(true);
  });
});

describe('listCampaignsQuerySchema', () => {
  it('AC-14: accepts all five status values', () => {
    for (const status of ['draft', 'scheduled', 'sending', 'sent', 'cancelled']) {
      expect(validateList({ status })).toBe(true);
    }
  });

  it('AC-15b: rejects an unknown status', () => {
    expect(validateList({ status: 'paused' })).toBe(false);
  });

  it.each(['0', '101', '1.5', 'ten'])('AC-15c: rejects limit=%s', (limit) => {
    expect(validateList({ limit })).toBe(false);
  });

  it('AC-15c: accepts limit 1 and 100 from a query string', () => {
    expect(validateList({ limit: '1' })).toBe(true);
    expect(validateList({ limit: '100' })).toBe(true);
  });
});

describe('ifMatchHeadersSchema', () => {
  it.each(['*', '1', '"0"', '"-1"', '"01"', '"1.5"', 'W/"1"', '"abc"'])('AC-17: rejects If-Match %s', (value) => {
    expect(validateIfMatch({ 'if-match': value })).toBe(false);
  });

  it('AC-17: accepts a quoted positive integer, and a missing header (428 is handled by the route)', () => {
    expect(validateIfMatch({ 'if-match': '"1"' })).toBe(true);
    expect(validateIfMatch({ 'if-match': '"42"' })).toBe(true);
    expect(validateIfMatch({})).toBe(true);
  });
});

describe('patchCampaignBodySchema', () => {
  it('AC-21: accepts a subset of editable fields', () => {
    expect(validatePatch({ name: 'New name' })).toBe(true);
    expect(validatePatch({ tags: ['a'], channel: 'line' })).toBe(true);
  });

  it('AC-22: accepts null for description and scheduledAt', () => {
    expect(validatePatch({ description: null })).toBe(true);
    expect(validatePatch({ scheduledAt: null })).toBe(true);
  });

  it.each(['name', 'segmentId', 'channel', 'message', 'tags'])('AC-22: rejects null for %s', (field) => {
    expect(validatePatch({ [field]: null })).toBe(false);
  });

  it('AC-23: rejects an empty body', () => {
    expect(validatePatch({})).toBe(false);
  });

  it.each(['id', 'status', 'version', 'createdAt', 'updatedAt'])('AC-25: rejects setting %s', (field) => {
    expect(validatePatch({ name: 'ok', [field]: 'x' })).toBe(false);
  });

  it.each([
    ['empty name', { name: '' }],
    ['message over 2000', { message: 'x'.repeat(2001) }],
    ['description over 500', { description: 'x'.repeat(501) }],
    ['bad tag', { tags: ['Bad'] }],
    ['duplicate tags', { tags: ['a', 'a'] }],
    ['non-UUID segmentId', { segmentId: 'abc' }],
    ['unknown channel', { channel: 'sms' }],
    ['non date-time scheduledAt', { scheduledAt: 'soon' }],
  ])('AC-25: rejects %s', (_label, body) => {
    expect(validatePatch(body)).toBe(false);
  });
});
