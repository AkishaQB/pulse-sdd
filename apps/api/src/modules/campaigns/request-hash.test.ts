import { describe, expect, it } from 'vitest';
import type { CreateCampaignBody } from '@pulse/shared';
import { hashCreateRequest } from './request-hash.js';

const base: CreateCampaignBody = {
  name: 'Spring sale',
  segmentId: '7b0f3c52-1f4a-4a62-9a67-3f0b1b6b9d11',
  channel: 'email',
  message: 'Hello',
};

describe('request-hash', () => {
  it('AC-4: identical bodies hash equal, as a SHA-256 hex digest', () => {
    expect(hashCreateRequest({ ...base })).toBe(hashCreateRequest({ ...base }));
    expect(hashCreateRequest(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('AC-4: key order does not matter', () => {
    const reordered: CreateCampaignBody = {
      message: base.message,
      channel: base.channel,
      segmentId: base.segmentId,
      name: base.name,
    };
    expect(hashCreateRequest(reordered)).toBe(hashCreateRequest(base));
  });

  it('AC-4: omitted optionals hash the same as their defaults', () => {
    const explicit: CreateCampaignBody = { ...base, tags: [] };
    expect(hashCreateRequest(explicit)).toBe(hashCreateRequest(base));
  });

  it('AC-5: any additional body field changes the hash', () => {
    const extended = { ...base, futureField: 1 } as CreateCampaignBody;
    expect(hashCreateRequest(extended)).not.toBe(hashCreateRequest(base));
  });

  it.each<[string, Partial<CreateCampaignBody>]>([
    ['name', { name: 'Other' }],
    ['segmentId', { segmentId: '11111111-1111-4111-8111-111111111111' }],
    ['channel', { channel: 'line' }],
    ['message', { message: 'Bye' }],
    ['description', { description: 'd' }],
    ['tags', { tags: ['a'] }],
    ['scheduledAt', { scheduledAt: '2027-01-01T00:00:00Z' }],
  ])('AC-5: a different %s changes the hash', (_field, change) => {
    expect(hashCreateRequest({ ...base, ...change })).not.toBe(hashCreateRequest(base));
  });
});
