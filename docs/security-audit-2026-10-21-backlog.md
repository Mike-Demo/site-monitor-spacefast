# Security audit backlog — 2026-10-21

Issue creation is not available in this session. The following prioritized
issue drafts are ready to file and link to parent issue [#1](https://github.com/Mike-Demo/site-monitor-spacefast/issues/1).
No code changes are included; the three execution- or intent-dependent leads
remain validation items, not confirmed findings.

## Priority

1. **Bound the actual response body size.** Both confirmed findings are low
   severity and reachable through responses from monitored sites. An absent
   or misleading `Content-Length` allows a monitored or redirect-target server
   to make `checkSite` buffer an arbitrarily large response, creating the
   clearest direct resource-exhaustion risk. Streaming with a byte cap is a
   localized fix.
2. **Keep the fetch timeout active through body consumption.** A slow-drip
   response can stall a check pass (including other sites awaited by
   `Promise.all`), and this also affects the independent `crt.sh` JSON read.
   The fix is similarly localized but requires the timeout lifecycle to span
   both response-header and body-reading phases.

These findings have distinct root causes and should be filed separately.

## Remediation issue drafts

### `[security][low] Bound actual response body size in site checks`

**Parent:** #1

**Finding:** The `checkSite` response-size guard can be bypassed by an absent
or lying `Content-Length` header, allowing an unbounded body read into memory.

**Evidence:** In `functions/_core/checker.ts`, lines 83–85 use
`Number(res.headers.get("content-length") ?? "0")` and read the response with
`await res.text()` when the parsed value is zero or below 5,000,000. A missing
header therefore passes the guard, and a small false value does too. No
streamed byte count or other body-size cap is applied before buffering.

**Root cause:** The size decision trusts a remote server's declared
`Content-Length` instead of measuring the bytes actually received.

**Smallest fix:** In `checkSite`, ignore `Content-Length` for the size decision
and consume `res.body` as a stream, counting actual bytes and aborting or
cancelling once 5,000,000 bytes are exceeded, before hashing.

### `[security][low] Keep fetch timeout active through body consumption`

**Parent:** #1

**Finding:** The 20-second fetch timeout ends when response headers arrive, so
a slow-drip body read in `checkSite` or the `crt.sh` lookup is unbounded.

**Evidence:** In `functions/_core/checker.ts`, `fetchWithTimeout` clears its
`AbortController` timer in a `finally` block immediately after `await fetch()`
resolves (lines 36–44). `checkSite` subsequently awaits `res.text()` (lines
83–86), and `getSslExpiry` awaits `res.json()` (lines 49–54), without a
deadline. The runner awaits checks together, so one stalled body can stall the
pass.

**Root cause:** `fetchWithTimeout` scopes its abort timer to receiving response
headers rather than consuming the response body.

**Smallest fix:** Keep the abort controller alive until the response body has
been consumed. For example, return the response with a dispose callback cleared
only after `res.text()` or `res.json()` completes, or pass the controller into
the consumers and clear it in their `finally` blocks.

## Needs-validation issue draft

### `[security][needs-validation] Audit leads to validate`

**Parent:** #1

Validate each lead and record the missing fact before deciding whether a code
change is needed. These are leads, not confirmed findings; no severity is
assigned.

- [ ] **Server-side fetch follows redirects with no destination validation,
  possible SSRF oracle via a monitored site redirect**
  - Fingerprint: `seeded-fetch-redirect-follow-no-destination-validation`
  - Claimed root cause: `checkSite` uses redirect follow with no destination
    validation on the initial URL or any redirect hop, and the fetch result
    fields are reflected to unauthenticated callers.
  - Missing fact: Whether SpaceFast's fetch runtime follows redirects to
    private, link-local, or metadata addresses versus blocking them, and
    whether any non-public service is reachable from the function's egress.
- [ ] **Unauthenticated sites and history endpoints disclose the full
  monitored inventory including preview URLs**
  - Fingerprint: `unauthenticated-sites-history-disclosure`
  - Claimed root cause: The sites and history handlers perform no
    authentication and `sf.jsonc` declares public access, so the full
    inventory and history are returned to any anonymous caller.
  - Missing fact: Whether the owner intends a fully public status page
    (accepted exposure for all seeded sites including preview view.fast URLs
    and the umami-lite health endpoint) or an operator-only dashboard that
    SpaceFast access control was meant to gate.
- [ ] **Unauthenticated check-now and cron handlers trigger a full outbound
  check pass**
  - Fingerprint: `unauthenticated-trigger-full-check-pass`
  - Claimed root cause: The check-now and cron handlers invoke
    `runCheckPass` without any authentication, scheduler-secret, rate-limit,
    cooldown, or single-flight check in source.
  - Missing fact: Whether SpaceFast restricts `/api/cron/*` to the scheduler
    and/or imposes platform rate limits on `/api/check-now` and
    `/api/cron/check`, and whether the owner intends anonymous public callers
    to be able to trigger check-now passes without limit.
