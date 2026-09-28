/**
 * Minimal wrapper around SpaceFast's env.DB (D1-shaped API over MySQL/MariaDB).
 * Timestamps are epoch milliseconds stored as BIGINT.
 */

export interface DbStatement {
  bind(...params: unknown[]): DbResult;
}

export interface DbResult {
  all(): Promise<{ results: Record<string, unknown>[] }>;
  first(): Promise<Record<string, unknown> | null>;
  run(): Promise<unknown>;
}

export interface SpacefastDb {
  prepare(sql: string): DbStatement;
}

export interface RouteEnv {
  DB: SpacefastDb;
}

function toDbValue(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

export function q(db: SpacefastDb, sql: string, ...params: unknown[]): DbResult {
  return db.prepare(sql).bind(...params.map(toDbValue));
}

export async function all(
  db: SpacefastDb,
  sql: string,
  ...params: unknown[]
): Promise<Record<string, unknown>[]> {
  const res = await q(db, sql, ...params).all();
  return res.results ?? [];
}

export async function first(
  db: SpacefastDb,
  sql: string,
  ...params: unknown[]
): Promise<Record<string, unknown> | null> {
  return (await q(db, sql, ...params).first()) ?? null;
}

export async function run(db: SpacefastDb, sql: string, ...params: unknown[]): Promise<void> {
  await q(db, sql, ...params).run();
}

const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS sites (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL,
    enabled TINYINT NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS checks (
    id VARCHAR(64) PRIMARY KEY,
    site_id VARCHAR(64) NOT NULL,
    checked_at BIGINT NOT NULL,
    ok TINYINT NOT NULL,
    status_code INT NULL,
    response_ms INT NULL,
    content_hash VARCHAR(64) NULL,
    content_changed TINYINT NOT NULL DEFAULT 0,
    ssl_expires_at BIGINT NULL,
    ssl_days_left INT NULL,
    error VARCHAR(512) NULL,
    INDEX idx_checks_site_time (site_id, checked_at)
  )`,
];

export async function ensureSchema(db: SpacefastDb): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    await run(db, sql);
  }
}

/** Seed the monitored sites on first run. Safe to call repeatedly (INSERT IGNORE). */
const SEED_SITES: Array<[string, string, string]> = [
  ["mikedemo-com", "mikedemo.com", "https://mikedemo.com/"],
  ["mikedemo-dev", "mikedemo.dev", "https://mikedemo.dev/"],
  ["mikedemo-work", "mikedemo.work", "https://mikedemo.work/"],
  ["mikedemo-cv", "mikedemo.cv", "https://mikedemo.cv/"],
  ["mikedemo-one", "mikedemo.one", "https://mikedemo.one/"],
  ["pretend-pro", "pretend.pro", "https://pretend.pro/"],
  ["skills", "skills.mikedemo.dev", "https://skills.mikedemo.dev/"],
  ["queercade", "queercade.mikedemo.dev", "https://queercade.mikedemo.dev/"],
  ["tweet", "tweet.mikedemo.dev", "https://tweet.mikedemo.dev/"],
  ["freshink", "freshink.art", "https://freshink.art/"],
  ["ceoowl", "ceoowl.com", "https://ceoowl.com/"],
  ["dice-roller", "2d20.space", "https://2d20.space/"],
  ["umami-lite", "umami-lite (SpaceFast)", "https://umami-lite.view.fast/"],
  ["skill-finder-preview", "Skill Finder preview", "https://skill-finder-preview.view.fast/"],
  ["crosspost-preview", "Crosspost preview", "https://crosspost-preview.view.fast/"],
  ["queercade-preview", "QueerCade preview", "https://queercade-preview.view.fast/"],
  ["ceo-owl-preview", "CEO Owl preview", "https://ceo-owl-preview.view.fast/"],
  ["freshink-preview", "FreshInk preview", "https://freshink-preview.view.fast/"],
];

export async function seedSites(db: SpacefastDb): Promise<void> {
  const now = Date.now();
  for (const [id, name, url] of SEED_SITES) {
    await run(
      db,
      `INSERT IGNORE INTO sites (id, name, url, enabled, created_at) VALUES (?, ?, ?, 1, ?)`,
      id,
      name,
      url,
      now,
    );
  }
}
