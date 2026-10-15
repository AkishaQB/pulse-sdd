import type { ErrorCode } from '@pulse/shared';

/** Base class for errors the central handler maps to an HTTP response. */
export class DomainError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}

export class CampaignNotFoundError extends DomainError {
  constructor(id: string) {
    super('CAMPAIGN_NOT_FOUND', `Campaign ${id} not found`);
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, action: string) {
    super('INVALID_STATUS_TRANSITION', `Cannot ${action} a campaign in status "${from}"`);
  }
}

export class VersionConflictError extends DomainError {
  constructor() {
    super('VERSION_CONFLICT', 'The campaign was modified; reload it and retry');
  }
}

export class SegmentNotFoundError extends DomainError {
  constructor(id: string) {
    super('SEGMENT_NOT_FOUND', `Segment ${id} not found`);
  }
}

export class IdempotencyKeyReusedError extends DomainError {
  constructor() {
    super('IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key was already used with a different body');
  }
}

export class ScheduledAtInvalidError extends DomainError {
  constructor(message: string) {
    super('SCHEDULED_AT_INVALID', message);
  }
}

export class PreconditionRequiredError extends DomainError {
  constructor() {
    super('PRECONDITION_REQUIRED', 'If-Match header is required');
  }
}

export class ServiceUnavailableError extends DomainError {
  constructor() {
    super('SERVICE_UNAVAILABLE', 'Service temporarily unavailable');
  }
}
