import type {
  IdempotencyClaim,
  IdempotencyClaimInput,
  IdempotencyRecord,
  IdempotencyRepository,
} from '../../src/modules/campaigns/campaign.repository.js';
import type { Clock } from '../../src/ports/clock.port.js';

const KEY_TTL_MS = 24 * 60 * 60 * 1000;

export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private records = new Map<string, IdempotencyRecord>();

  constructor(private readonly clock: Clock) {}

  get all(): IdempotencyRecord[] {
    return [...this.records.values()];
  }

  snapshot(): Map<string, IdempotencyRecord> {
    return new Map(this.records);
  }

  restore(snapshot: Map<string, IdempotencyRecord>): void {
    this.records = new Map(snapshot);
  }

  claim(input: IdempotencyClaimInput): Promise<IdempotencyClaim> {
    const now = this.clock.now();
    const existing = this.records.get(input.key);
    // 24 h or more counts as expired (AC-8).
    if (existing && now.getTime() - new Date(existing.createdAt).getTime() < KEY_TTL_MS) {
      return Promise.resolve({ claimed: false, record: { ...existing } });
    }
    this.records.set(input.key, { ...input, createdAt: now.toISOString() });
    return Promise.resolve({ claimed: true });
  }
}
