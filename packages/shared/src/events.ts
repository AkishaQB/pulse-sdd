import type { CampaignChannel, CampaignStatus } from './campaign.js';

/** Spec §7. Written to `outbox` with `aggregate_type='campaign'`. */
export const CAMPAIGN_AGGREGATE_TYPE = 'campaign';

export interface CampaignScheduledPayload {
  eventId: string;
  campaignId: string;
  segmentId: string;
  channel: CampaignChannel;
  scheduledAt: string;
  version: number;
  occurredAt: string;
}

export interface CampaignCancelledPayload {
  eventId: string;
  campaignId: string;
  previousStatus: Extract<CampaignStatus, 'draft' | 'scheduled'>;
  version: number;
  occurredAt: string;
}

export type CampaignEvent =
  | { eventType: 'CampaignScheduled'; payload: CampaignScheduledPayload }
  | { eventType: 'CampaignCancelled'; payload: CampaignCancelledPayload };

export type CampaignEventType = CampaignEvent['eventType'];
