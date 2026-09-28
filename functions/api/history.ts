import { withErrors, json, InputError } from "../_core/http";
import { ensureSchema, all, type RouteEnv } from "../_core/db";

/**
 * GET /api/history?site=<id>&hours=24 — recent check rows for one site,
 * newest last (for sparklines).
 */
const handler = withErrors(async (request: Request, env: Record<string, unknown>): Promise<Response> => {
  const { DB } = env as unknown as RouteEnv;
  await ensureSchema(DB);

  const url = new URL(request.url);
  const siteId = url.searchParams.get("site");
  if (!siteId) throw new InputError("missing_site", "Query param ?site=<id> is required.");
  const hours = Math.min(Math.max(Number(url.searchParams.get("hours") ?? "24") || 24, 1), 24 * 30);

  const rows = await all(
    DB,
    `SELECT checked_at, ok, status_code, response_ms, content_changed, ssl_days_left, error
     FROM checks WHERE site_id = ? AND checked_at >= ? ORDER BY checked_at ASC LIMIT 2000`,
    siteId,
    Date.now() - hours * 3_600_000,
  );

  return json({
    site: siteId,
    hours,
    points: rows.map((r) => ({
      at: r.checked_at,
      ok: Number(r.ok) === 1,
      status: r.status_code,
      ms: r.response_ms,
      changed: Number(r.content_changed) === 1,
      ssl_days: r.ssl_days_left,
      error: r.error,
    })),
  });
});

export const GET = handler;
