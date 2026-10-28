import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Error with an HTTP status and a stable machine-readable code. */
export class ApiError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'You must be signed in.') =>
  new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have permission to do that.') =>
  new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);
