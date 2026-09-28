import { withErrors, json } from "../../_core/http";
import { ensureSchema, seedSites, type RouteEnv } from "../../_core/db";
import { runCheckPass } from "../../_core/runner";

/**
 * Cron target (sf.jsonc crons, every 5 minutes). Checks all enabled sites,
 * stores one row per site per run, prunes history older than 30 days.
 */
const handler = withErrors(async (_request: Request, env: Record<string, unknown>): Promise<Response> => {
  const { DB } = env as unknown as RouteEnv;
  await ensureSchema(DB);
  await seedSites(DB);
  const result = await runCheckPass(DB);
  return json({ ok: true, ...result });
});

export const GET = handler;
export const POST = handler;
