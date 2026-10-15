import { createHash } from 'node:crypto';
import type { CreateCampaignBody } from '@pulse/shared';

/**
 * SHA-256 of the canonical (sorted-key) JSON of the body with defaults applied (spec §6).
 * Keys are derived from the body, so a field added to `CreateCampaignBody` is hashed automatically.
 */
export function hashCreateRequest(body: CreateCampaignBody): string {
  const withDefaults: Record<string, unknown> = { description: null, scheduledAt: null, tags: [] };
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) withDefaults[key] = value;
  }
  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(withDefaults).sort()) canonical[key] = withDefaults[key];
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
