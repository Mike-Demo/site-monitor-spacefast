import { withErrors, json } from "../_core/http";
import { ensureSchema, seedSites, all, first, type RouteEnv } from "../_core/db";

/**
 * GET /api/sites — every site with its latest check, plus 24h uptime %.
 */
const handler = withErrors(async (_request: Request, env: Record<string, unknown>): Promise<Response> => {
  const { DB } = env as unknown as RouteEnv;
  await ensureSchema(DB);
  await seedSites(DB);

  const sites = await all(DB, `SELECT id, name, url, enabled FROM sites ORDER BY name`);
  const since = Date.now() - 24 * 3_600_000;

  const out = await Promise.all(
    sites.map(async (s) => {
      const siteId = String(s.id);
      const latest = await first(
        DB,
        `SELECT * FROM checks WHERE site_id = ? ORDER BY checked_at DESC LIMIT 1`,
        siteId,
      );
      const day = await all(
        DB,
        `SELECT ok FROM checks WHERE site_id = ? AND checked_at >= ?`,
        siteId,
        since,
      );
      const uptime24h =
        day.length > 0
          ? Math.round((day.filter((c) => Number(c.ok) === 1).length / day.length) * 100)
          : null;
      return {
        id: siteId,
        name: s.name,
        url: s.url,
        enabled: Number(s.enabled) === 1,
        latest: latest
          ? {
              checked_at: latest.checked_at,
              ok: Number(latest.ok) === 1,
              status_code: latest.status_code,
              response_ms: latest.response_ms,
              content_changed: Number(latest.content_changed) === 1,
              ssl_days_left: latest.ssl_days_left,
              error: latest.error,
            }
          : null,
        uptime_24h: uptime24h,
        checks_24h: day.length,
      };
    }),
  );

  return json({ sites: out });
});

export const GET = handler;
