import { CAMPAIGN_AGGREGATE_TYPE, type CampaignEvent } from '@pulse/shared';
import type { OutboxRepository } from '../../src/modules/campaigns/campaign.repository.js';

export interface OutboxRow {
  id: number;
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: CampaignEvent['eventType'];
  payload: CampaignEvent['payload'];
  occurredAt: string;
  publishedAt: string | null;
}

export class InMemoryOutboxRepository implements OutboxRepository {
  private items: OutboxRow[] = [];
  private nextId = 1;
  /** Set to make the next `append` calls throw, to simulate AC-39. */
  failWith: Error | null = null;

  get rows(): readonly OutboxRow[] {
    return this.items;
  }

  snapshot(): { items: OutboxRow[]; nextId: number } {
    return { items: [...this.items], nextId: this.nextId };
  }

  restore(snapshot: { items: OutboxRow[]; nextId: number }): void {
    this.items = [...snapshot.items];
    this.nextId = snapshot.nextId;
  }

  append(event: CampaignEvent): Promise<void> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.items.push({
      id: this.nextId++,
      eventId: event.payload.eventId,
      aggregateType: CAMPAIGN_AGGREGATE_TYPE,
      aggregateId: event.payload.campaignId,
      eventType: event.eventType,
      payload: event.payload,
      occurredAt: event.payload.occurredAt,
      publishedAt: null,
    });
    return Promise.resolve();
  }
}
