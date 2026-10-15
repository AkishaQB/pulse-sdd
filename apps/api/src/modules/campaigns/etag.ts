import { PreconditionRequiredError, ValidationError } from '../../errors.js';

export function formatEtag(version: number): string {
  return `"${version}"`;
}

/**
 * Parses `If-Match: "<positive integer>"` into the version.
 * @throws PreconditionRequiredError when absent (AC-16), ValidationError when malformed (AC-17).
 */
export function parseIfMatch(header: string | undefined): number {
  if (header === undefined) throw new PreconditionRequiredError();
  const match = /^"([1-9][0-9]*)"$/.exec(header);
  const version = match?.[1] === undefined ? NaN : Number(match[1]);
  if (!Number.isSafeInteger(version)) {
    throw new ValidationError('If-Match must be a strong ETag like "1"');
  }
  return version;
}
