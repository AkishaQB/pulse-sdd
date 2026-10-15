import type {
  TransactionRepositories,
  UnitOfWork,
} from '../../src/modules/campaigns/campaign.repository.js';
import type { InMemoryCampaignRepository } from './in-memory-campaign.repository.js';
import type { InMemoryIdempotencyRepository } from './in-memory-idempotency.repository.js';
import type { InMemoryOutboxRepository } from './in-memory-outbox.repository.js';

export interface FakeStores {
  campaigns: InMemoryCampaignRepository;
  outbox: InMemoryOutboxRepository;
  idempotency: InMemoryIdempotencyRepository;
}

/**
 * Runs `fn` against the shared fakes and restores all three stores if it throws, so
 * AC-39 can assert nothing was committed. It does not model locking or concurrency;
 * those are covered by the integration tests.
 */
export class FakeUnitOfWork implements UnitOfWork {
  constructor(private readonly stores: FakeStores) {}

  async run<T>(fn: (tx: TransactionRepositories) => Promise<T>): Promise<T> {
    const { campaigns, outbox, idempotency } = this.stores;
    const saved = {
      campaigns: campaigns.snapshot(),
      outbox: outbox.snapshot(),
      idempotency: idempotency.snapshot(),
    };
    try {
      return await fn({ campaigns, outbox, idempotency });
    } catch (err) {
      campaigns.restore(saved.campaigns);
      outbox.restore(saved.outbox);
      idempotency.restore(saved.idempotency);
      throw err;
    }
  }
}
