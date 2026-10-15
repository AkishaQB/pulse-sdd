import { ValidationError } from '../../errors.js';
import type { ListAfter } from './campaign.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Postgres `timestamptz::text`, e.g. "2026-10-15 09:30:00.123456+00". Kept as text, never a Date.
const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

/** Calendar/clock range check on the text form, deliberately not via `Date` (µs precision, spec §5). */
function isValidTimestamp(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!m) return false;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number) as [
    number, number, number, number, number, number,
  ];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (daysInMonth === undefined || year < 1 || day < 1 || day > daysInMonth) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  const offset = /([+-])(\d{2})(?::?(\d{2}))?$/.exec(text);
  if (offset) {
    const offsetHour = Number(offset[2]);
    const offsetMinute = Number(offset[3] ?? 0);
    if (offsetHour > 15 || offsetMinute > 59) return false;
  }
  return true;
}

export function encodeCursor(after: ListAfter): string {
  return Buffer.from(JSON.stringify({ c: after.createdAt, i: after.id })).toString('base64url');
}

/** @throws ValidationError when the cursor isn't base64url JSON of shape `{c, i}` (AC-15a). */
export function decodeCursor(cursor: string): ListAfter {
  const invalid = new ValidationError('cursor is invalid');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw invalid;
  const record = parsed as Record<string, unknown>;
  const { c, i } = record;
  if (Object.keys(record).length !== 2) throw invalid;
  if (typeof c !== 'string' || !PG_TIMESTAMP.test(c) || !isValidTimestamp(c)) throw invalid;
  if (typeof i !== 'string' || !UUID.test(i)) throw invalid;
  return { createdAt: c, id: i };
}
