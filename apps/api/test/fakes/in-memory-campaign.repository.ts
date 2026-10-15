import type { Campaign } from '@pulse/shared';
import { SegmentNotFoundError } from '../../src/errors.js';
import type {
  CampaignChanges,
  CampaignRepository,
  ListCampaignsParams,
  NewCampaign,
} from '../../src/modules/campaigns/campaign.repository.js';
import type { Clock } from '../../src/ports/clock.port.js';

export class InMemoryCampaignRepository implements CampaignRepository {
  private rows = new Map<string, Campaign>();
  private readonly segments = new Set<string>();

  constructor(private readonly clock: Clock) {}

  /** Segments are a stub table in 001; tests register the ids that "exist". */
  addSegment(id: string): void {
    this.segments.add(id);
  }

  /** Inserts a row as-is, bypassing checks. For `sending`/`sent` rows and tied `createdAt` values. */
  seed(campaign: Campaign): void {
    this.rows.set(campaign.id, { ...campaign, tags: [...campaign.tags] });
  }

  get all(): Campaign[] {
    return [...this.rows.values()];
  }

  snapshot(): Map<string, Campaign> {
    return new Map(this.rows);
  }

  restore(snapshot: Map<string, Campaign>): void {
    this.rows = new Map(snapshot);
  }

  insert(campaign: NewCampaign): Promise<Campaign> {
    this.assertSegment(campaign.segmentId);
    const now = this.clock.now().toISOString();
    const row: Campaign = {
      ...campaign,
      tags: [...campaign.tags],
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return Promise.resolve(clone(row));
  }

  findById(id: string): Promise<Campaign | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? clone(row) : null);
  }

  findByIdForUpdate(id: string): Promise<Campaign | null> {
    return this.findById(id);
  }

  update(id: string, changes: CampaignChanges): Promise<Campaign> {
    const row = this.rows.get(id);
    if (!row) return Promise.reject(new Error(`update: campaign ${id} does not exist`));
    if (changes.segmentId !== undefined) this.assertSegment(changes.segmentId);

    const next: Campaign = { ...row, version: row.version + 1, updatedAt: this.clock.now().toISOString() };
    if (changes.name !== undefined) next.name = changes.name;
    if (changes.segmentId !== undefined) next.segmentId = changes.segmentId;
    if (changes.channel !== undefined) next.channel = changes.channel;
    if (changes.message !== undefined) next.message = changes.message;
    if (changes.description !== undefined) next.description = changes.description;
    if (changes.tags !== undefined) next.tags = [...changes.tags];
    if (changes.scheduledAt !== undefined) next.scheduledAt = changes.scheduledAt;
    if (changes.status !== undefined) next.status = changes.status;

    this.rows.set(id, next);
    return Promise.resolve(clone(next));
  }

  delete(id: string): Promise<void> {
    this.rows.delete(id);
    return Promise.resolve();
  }

  list({ status, limit, after }: ListCampaignsParams): Promise<Campaign[]> {
    const items = [...this.rows.values()]
      .filter((c) => status === undefined || c.status === status)
      .sort((a, b) => compareDesc(a.createdAt, b.createdAt) || compareDesc(a.id, b.id))
      .filter(
        (c) =>
          after === undefined ||
          compareDesc(c.createdAt, after.createdAt) > 0 ||
          (c.createdAt === after.createdAt && compareDesc(c.id, after.id) > 0),
      )
      .slice(0, limit)
      .map(clone);
    return Promise.resolve(items);
  }

  private assertSegment(segmentId: string): void {
    if (!this.segments.has(segmentId)) throw new SegmentNotFoundError(segmentId);
  }
}

/** Positive when `a` sorts after `b` in descending order. */
function compareDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

function clone(c: Campaign): Campaign {
  return { ...c, tags: [...c.tags] };
}
