import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors.js';
import { decodeCursor, encodeCursor } from './cursor.js';

const ID = '7b0f3c52-1f4a-4a62-9a67-3f0b1b6b9d11';
const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('cursor', () => {
  it('AC-12: round-trips created_at text at microsecond precision', () => {
    const after = { createdAt: '2026-10-15 09:30:00.123456+00', id: ID };
    expect(decodeCursor(encodeCursor(after))).toEqual(after);
  });

  it('AC-12: encodes as base64url JSON {c, i}', () => {
    const encoded = encodeCursor({ createdAt: '2026-10-15 09:30:00.000001+00', id: ID });
    expect(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))).toEqual({
      c: '2026-10-15 09:30:00.000001+00',
      i: ID,
    });
  });

  it.each([
    ['not base64url JSON', '!!!not-a-cursor!!!'],
    ['JSON but not an object', b64([1, 2])],
    ['missing id', b64({ c: '2026-10-15 09:30:00+00' })],
    ['id not a UUID', b64({ c: '2026-10-15 09:30:00+00', i: 'abc' })],
    ['timestamp not a timestamp', b64({ c: 'yesterday', i: ID })],
    ['an impossible month/day/hour', b64({ c: '2026-13-45 99:99:99+00', i: ID })],
    ['a non-existent leap day', b64({ c: '2027-02-29 09:30:00+00', i: ID })],
    ['extra property', b64({ c: '2026-10-15 09:30:00+00', i: ID, x: 1 })],
  ])('AC-15a: rejects a cursor that is %s', (_label, cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(ValidationError);
  });
});
