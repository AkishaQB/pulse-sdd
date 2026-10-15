-- Up Migration

-- Stub; 002 alters this table.
CREATE TABLE segments (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  segment_id uuid NOT NULL REFERENCES segments (id) ON DELETE RESTRICT,
  channel text NOT NULL,
  message text NOT NULL,
  description text NULL,
  tags text[] NOT NULL DEFAULT '{}',
  scheduled_at timestamptz NULL,
  status text NOT NULL DEFAULT 'draft',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_channel_check CHECK (channel IN ('line', 'email', 'webhook')),
  CONSTRAINT campaigns_status_check CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  CONSTRAINT campaigns_name_length_check CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT campaigns_message_length_check CHECK (char_length(message) BETWEEN 1 AND 2000),
  CONSTRAINT campaigns_description_length_check CHECK (description IS NULL OR char_length(description) <= 500),
  CONSTRAINT campaigns_tags_count_check CHECK (cardinality(tags) <= 10),
  CONSTRAINT campaigns_version_check CHECK (version >= 1),
  CONSTRAINT campaigns_scheduled_at_check CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL)
);

-- Unfiltered keyset list (AC-12, AC-13).
CREATE INDEX campaigns_created_at_id_idx ON campaigns (created_at DESC, id DESC);
-- Status-filtered keyset list (AC-14).
CREATE INDEX campaigns_status_created_at_id_idx ON campaigns (status, created_at DESC, id DESC);

-- No FK to campaigns: the key must survive a draft delete (AC-9).
CREATE TABLE idempotency_keys (
  key text PRIMARY KEY,
  request_hash text NOT NULL,
  campaign_id uuid NOT NULL,
  response_status int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz NULL
);

-- Relay's "next unpublished rows" query (007).
CREATE INDEX outbox_unpublished_idx ON outbox (id) WHERE published_at IS NULL;

-- Down Migration

DROP TABLE outbox;
DROP TABLE idempotency_keys;
DROP TABLE campaigns;
DROP TABLE segments;
