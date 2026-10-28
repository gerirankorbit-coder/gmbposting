import type { PostgrestError } from '@supabase/supabase-js';
import { ApiError, notFound } from '../lib/errors.js';

/** Maps a PostgREST/Postgres error to an ApiError with a safe, human-readable message. */
export function dbError(error: PostgrestError, context?: string): ApiError {
  const where = context ? `${context}: ` : '';
  switch (error.code) {
    case '23505':
      return new ApiError(409, 'conflict', `${where}a record with these values already exists.`);
    case '23503':
      return new ApiError(400, 'invalid_reference', `${where}a referenced record does not exist.`);
    case '23514':
      return new ApiError(400, 'constraint_violation', `${where}a value is not allowed.`);
    case '22P02':
      return new ApiError(400, 'invalid_input', `${where}an identifier or value is malformed.`);
    default:
      console.error('[db]', context ?? '', error.code, error.message);
      return new ApiError(500, 'database_error', `${where}database request failed.`);
  }
}

type Result<T> = { data: T; error: PostgrestError | null };

/**
 * Returns `data` or throws a mapped ApiError. On success PostgREST list/insert-select data is
 * never null, so the result is narrowed accordingly.
 */
export function unwrap<T>(result: Result<T>, context?: string): NonNullable<T> {
  if (result.error) throw dbError(result.error, context);
  return result.data as NonNullable<T>;
}

/** Like `unwrap` for `.maybeSingle()` queries, throwing 404 when the row is missing. */
export function unwrapOne<T>(result: Result<T | null>, what = 'Record'): NonNullable<T> {
  if (result.error) throw dbError(result.error, what);
  if (result.data === null || result.data === undefined) throw notFound(`${what} not found.`);
  return result.data as NonNullable<T>;
}

/** True for Postgres unique-violation errors (used for insert-or-ignore flows). */
export function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === '23505';
}

/** Splits an array into chunks (PostgREST `in` filters and bulk inserts have size limits). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Escapes a user search term for use inside a PostgREST `ilike` pattern. */
export function ilikePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (m) => `\\${m}`).replace(/[,()]/g, ' ')}%`;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (Math.max(1, page) - 1) * pageSize;
  return [from, from + pageSize - 1];
}
