import type { Context } from 'hono';
import type { z } from 'zod';
import { badRequest } from './errors.js';

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');
}

export async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw badRequest(formatIssues(result.error), result.error.issues);
  return result.data;
}

export function parseQuery<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) throw badRequest(formatIssues(result.error), result.error.issues);
  return result.data;
}
