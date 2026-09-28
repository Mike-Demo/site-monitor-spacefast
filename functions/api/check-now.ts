import { withErrors, json } from "../_core/http";
import { ensureSchema, seedSites, type RouteEnv } from "../_core/db";
import { runCheckPass } from "../_core/runner";

/** POST /api/check-now — run the full check suite on demand. */
const handler = withErrors(async (_request: Request, env: Record<string, unknown>): Promise<Response> => {
  const { DB } = env as unknown as RouteEnv;
  await ensureSchema(DB);
  await seedSites(DB);
  const result = await runCheckPass(DB);
  return json({ ok: true, ...result });
});

export const POST = handler;
