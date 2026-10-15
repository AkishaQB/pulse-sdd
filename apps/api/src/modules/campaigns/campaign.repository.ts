import type { Campaign, CampaignChannel, CampaignEvent, CampaignStatus } from '@pulse/shared';

/** A campaign to insert. The app generates `id` (spec §6); the repository sets version=1 and the timestamps. */
export interface NewCampaign {
  id: string;
  name: string;
  segmentId: string;
  channel: CampaignChannel;
  message: string;
  description: string | null;
  tags: string[];
  scheduledAt: string | null;
}

/** Fields a write may change. The repository also bumps `version` and refreshes `updatedAt`. */
export interface CampaignChanges {
  name?: string;
  segmentId?: string;
  channel?: CampaignChannel;
  message?: string;
  description?: string | null;
  tags?: string[];
  scheduledAt?: string | null;
  status?: CampaignStatus;
}

/** Keyset position: the last item of the previous page. `createdAt` keeps its text precision (spec §5). */
export interface ListAfter {
  createdAt: string;
  id: string;
}

export interface ListCampaignsParams {
  status?: CampaignStatus;
  /** Maximum rows returned. The service asks for `limit + 1` to learn whether a next page exists. */
  limit: number;
  after?: ListAfter;
}

export interface CampaignRepository {
  /** @throws SegmentNotFoundError when `segmentId` doesn't exist (FK 23503). */
  insert(campaign: NewCampaign): Promise<Campaign>;
  findById(id: string): Promise<Campaign | null>;
  /** `SELECT … FOR UPDATE`. Only meaningful inside `UnitOfWork.run`. */
  findByIdForUpdate(id: string): Promise<Campaign | null>;
  /** @throws SegmentNotFoundError when `changes.segmentId` doesn't exist. */
  update(id: string, changes: CampaignChanges): Promise<Campaign>;
  delete(id: string): Promise<void>;
  /** Ordered by `createdAt` desc, then `id` desc. */
  list(params: ListCampaignsParams): Promise<Campaign[]>;
}

export interface OutboxRepository {
  /**
   * Writes one outbox row (`aggregate_type='campaign'`, `aggregate_id`, `event_id` and
   * `occurred_at` taken from the payload). Must be called inside `UnitOfWork.run`.
   */
  append(event: CampaignEvent): Promise<void>;
}

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  campaignId: string;
  responseStatus: number;
  createdAt: string;
}

export interface IdempotencyClaimInput {
  key: string;
  requestHash: string;
  campaignId: string;
  responseStatus: number;
}

export type IdempotencyClaim =
  /** The key was unused, or its previous use was 24 h or more ago (AC-8). The row now belongs to this request. */
  | { claimed: true }
  /** The key is live (< 24 h). The service compares `requestHash` (AC-5) and replays (AC-4, AC-9). */
  | { claimed: false; record: IdempotencyRecord };

export interface IdempotencyRepository {
  /** Must be called inside `UnitOfWork.run`. */
  claim(input: IdempotencyClaimInput): Promise<IdempotencyClaim>;
}

/** Transaction-scoped repositories handed to the service by `UnitOfWork.run`. */
export interface TransactionRepositories {
  campaigns: CampaignRepository;
  outbox: OutboxRepository;
  idempotency: IdempotencyRepository;
}

export interface UnitOfWork {
  /** Commits when `fn` resolves, rolls everything back when it throws (AC-39). */
  run<T>(fn: (tx: TransactionRepositories) => Promise<T>): Promise<T>;
}
