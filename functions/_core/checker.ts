/**
 * Site checking logic: uptime, response time, content-hash change detection,
 * and SSL certificate expiry (via crt.sh).
 *
 * Each check is independent and fault-tolerant: a failure in one probe does
 * not fail the others. All probes run with timeouts so a hung site cannot
 * stall the whole run.
 */

export interface SiteRow {
  id: string;
  name: string;
  url: string;
  enabled: number;
}

export interface CheckResult {
  ok: boolean;
  status_code: number | null;
  response_ms: number | null;
  content_hash: string | null;
  content_changed: boolean;
  ssl_expires_at: number | null;
  ssl_days_left: number | null;
  error: string | null;
}

const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "SiteMonitor/1.0 (+https://site-monitor.view.fast/)";

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Look up the latest certificate expiry for a hostname via crt.sh. */
async function getSslExpiry(hostname: string): Promise<{ expires_at: number; days_left: number } | null> {
  try {
    const res = await fetchWithTimeout(
      `https://crt.sh/?q=${encodeURIComponent(hostname)}&output=json`,
    );
    if (!res.ok) return null;
    const certs = (await res.json()) as Array<{ not_after?: string }>;
    let latest = 0;
    for (const c of certs) {
      if (!c.not_after) continue;
      const t = Date.parse(c.not_after);
      if (Number.isFinite(t) && t > latest) latest = t;
    }
    if (!latest || latest < Date.now()) return null;
    return { expires_at: latest, days_left: Math.floor((latest - Date.now()) / 86_400_000) };
  } catch {
    return null;
  }
}

export async function checkSite(site: SiteRow, lastHash: string | null): Promise<CheckResult> {
  const started = Date.now();
  let status_code: number | null = null;
  let response_ms: number | null = null;
  let content_hash: string | null = null;
  let content_changed = false;
  let error: string | null = null;

  try {
    const res = await fetchWithTimeout(site.url, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    });
    response_ms = Date.now() - started;
    status_code = res.status;
    // Only hash reasonably-sized bodies to avoid memory blowups.
    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength === 0 || contentLength < 5_000_000) {
      const body = await res.text();
      content_hash = await sha256Hex(body);
      content_changed = lastHash !== null && content_hash !== lastHash;
    }
    if (!res.ok) {
      error = `HTTP ${res.status}`;
    }
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 200) : "fetch failed";
  }

  // SSL expiry probe (independent of the fetch result).
  let ssl_expires_at: number | null = null;
  let ssl_days_left: number | null = null;
  try {
    const host = new URL(site.url).hostname;
    if (site.url.startsWith("https://")) {
      const ssl = await getSslExpiry(host);
      if (ssl) {
        ssl_expires_at = ssl.expires_at;
        ssl_days_left = ssl.days_left;
      }
    }
  } catch {
    // Leave SSL fields null on any failure.
  }

  return {
    ok: error === null,
    status_code,
    response_ms,
    content_hash,
    content_changed,
    ssl_expires_at,
    ssl_days_left,
    error,
  };
}
