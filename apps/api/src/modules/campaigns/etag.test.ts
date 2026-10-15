import { describe, expect, it } from 'vitest';
import { PreconditionRequiredError, ValidationError } from '../../errors.js';
import { formatEtag, parseIfMatch } from './etag.js';

describe('etag', () => {
  it('AC-1/AC-10/AC-21: formats the ETag header as a strong tag', () => {
    expect(formatEtag(3)).toBe('"3"');
  });

  it('AC-16: a missing If-Match is PRECONDITION_REQUIRED', () => {
    expect(() => parseIfMatch(undefined)).toThrow(PreconditionRequiredError);
  });

  it('AC-17: parses "<positive integer>"', () => {
    expect(parseIfMatch('"12"')).toBe(12);
  });

  it.each(['*', '12', '"0"', '"-1"', '"1.5"', '"abc"', 'W/"1"', '""', '"01"', '', ' "1" '])(
    'AC-17: rejects %s',
    (value) => {
      expect(() => parseIfMatch(value)).toThrow(ValidationError);
    },
  );
});
