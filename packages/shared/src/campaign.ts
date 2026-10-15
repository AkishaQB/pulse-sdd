export const CAMPAIGN_CHANNELS = ['line', 'email', 'webhook'] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'cancelled'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Spec §5. Timestamps are ISO-8601 UTC with microsecond precision. */
export interface Campaign {
  id: string;
  name: string;
  segmentId: string;
  channel: CampaignChannel;
  message: string;
  description: string | null;
  tags: string[];
  scheduledAt: string | null;
  status: CampaignStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignBody {
  name: string;
  segmentId: string;
  channel: CampaignChannel;
  message: string;
  description?: string;
  tags?: string[];
  scheduledAt?: string;
}

/** `null` clears `description` / `scheduledAt` (AC-22). */
export interface PatchCampaignBody {
  name?: string;
  segmentId?: string;
  channel?: CampaignChannel;
  message?: string;
  description?: string | null;
  tags?: string[];
  scheduledAt?: string | null;
}

export interface ListCampaignsQuery {
  status?: CampaignStatus;
  limit?: number;
  cursor?: string;
}

export interface ListCampaignsResponse {
  items: Campaign[];
  nextCursor: string | null;
}

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;

// Field rules shared by create and patch (AC-3b–3d, AC-25).
const nameSchema = { type: 'string', minLength: 1, maxLength: 120 } as const;
const segmentIdSchema = { type: 'string', format: 'uuid' } as const;
const channelSchema = { type: 'string', enum: CAMPAIGN_CHANNELS } as const;
const messageSchema = { type: 'string', minLength: 1, maxLength: 2000 } as const;
const descriptionSchema = { type: 'string', maxLength: 500 } as const;
const tagsSchema = {
  type: 'array',
  maxItems: 10,
  uniqueItems: true,
  items: { type: 'string', pattern: '^[a-z0-9-]{1,32}$' },
} as const;
const scheduledAtSchema = { type: 'string', format: 'date-time' } as const;

export const createCampaignBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'segmentId', 'channel', 'message'],
  properties: {
    name: nameSchema,
    segmentId: segmentIdSchema,
    channel: channelSchema,
    message: messageSchema,
    description: descriptionSchema,
    tags: tagsSchema,
    scheduledAt: scheduledAtSchema,
  },
} as const;

export const patchCampaignBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: nameSchema,
    segmentId: segmentIdSchema,
    channel: channelSchema,
    message: messageSchema,
    description: { anyOf: [descriptionSchema, { type: 'null' }] },
    tags: tagsSchema,
    scheduledAt: { anyOf: [scheduledAtSchema, { type: 'null' }] },
  },
} as const;

export const listCampaignsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: CAMPAIGN_STATUSES },
    limit: { type: 'integer', minimum: 1, maximum: LIST_MAX_LIMIT },
    // Shape is checked by the cursor decoder (AC-15a).
    cursor: { type: 'string', minLength: 1 },
  },
} as const;

export const campaignIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

/** Header names are lower-case, as Fastify presents them. */
export const createCampaignHeadersSchema = {
  type: 'object',
  properties: {
    'idempotency-key': { type: 'string', minLength: 1, maxLength: 128 },
  },
} as const;

/** Format only (AC-17). A missing `If-Match` is a 428, handled by the route (AC-16). */
export const ifMatchHeadersSchema = {
  type: 'object',
  properties: {
    'if-match': { type: 'string', pattern: '^"[1-9][0-9]*"$' },
  },
} as const;
