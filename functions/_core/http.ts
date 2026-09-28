/** HTTP helpers: JSON responses and a flat error envelope. */

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function apiError(status: number, code: string, message: string): Response {
  return json({ error: message, code }, status);
}

export class InputError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InputError";
    this.code = code;
  }
}

/** Wrap a handler with centralized error mapping. */
export function withErrors(
  handler: (request: Request, env: Record<string, unknown>) => Promise<Response>,
): (request: Request, context: { env: Record<string, unknown> }) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context.env ?? {});
    } catch (e) {
      if (e instanceof InputError) return apiError(400, e.code, e.message);
      return apiError(500, "internal_error", "Something went wrong.");
    }
  };
}
