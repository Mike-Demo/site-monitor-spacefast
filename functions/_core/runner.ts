import { all, first, run, type SpacefastDb } from "./db";
import { checkSite } from "./checker";

/** Run one full check pass over all enabled sites. Shared by the cron route and /api/check-now. */
export async function runCheckPass(db: SpacefastDb): Promise<{
  checked: number;
  up: number;
  down: number;
  at: number;
  results: Array<{ site: string; ok: boolean; ms: number | null }>;
}> {
  const sites = await all(db, `SELECT id, name, url, enabled FROM sites WHERE enabled = 1`);
  const now = Date.now();
  const results: Array<{ site: string; ok: boolean; ms: number | null }> = [];

  await Promise.all(
    sites.map(async (s) => {
      const siteId = String(s.id);
      const last = await first(
        db,
        `SELECT content_hash FROM checks WHERE site_id = ? AND content_hash IS NOT NULL ORDER BY checked_at DESC LIMIT 1`,
        siteId,
      );
      const lastHash = last ? String(last.content_hash) : null;
      const r = await checkSite(
        { id: siteId, name: String(s.name), url: String(s.url), enabled: 1 },
        lastHash,
      );
      await run(
        db,
        `INSERT INTO checks (id, site_id, checked_at, ok, status_code, response_ms, content_hash, content_changed, ssl_expires_at, ssl_days_left, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(),
        siteId,
        now,
        r.ok,
        r.status_code,
        r.response_ms,
        r.content_hash,
        r.content_changed,
        r.ssl_expires_at,
        r.ssl_days_left,
        r.error,
      );
      results.push({ site: siteId, ok: r.ok, ms: r.response_ms });
    }),
  );

  await run(db, `DELETE FROM checks WHERE checked_at < ?`, now - 30 * 86_400_000);

  const up = results.filter((r) => r.ok).length;
  return { checked: results.length, up, down: results.length - up, at: now, results };
}
