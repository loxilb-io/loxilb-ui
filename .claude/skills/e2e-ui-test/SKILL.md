---
name: e2e-ui-test
description: Run the full loxilb-ui end-to-end browser test suite via the playwright MCP server against the local dev server + Naver Cloud testbed. Use when asked to run UI E2E tests, validate the UI in a browser, or regression-test RBAC/login flows. Optionally pass suite IDs (e.g. "S1 S4") to run a subset.
---

# loxilb-ui E2E UI test run

Execute the suites defined in `docs/E2E_TEST_PLAN.md` (read it first — it is
the single source of truth for steps, expected results, and safety rules)
using the `playwright` MCP server's browser tools.

## Preflight

1. **MCP**: confirm the `playwright` MCP tools are available (ToolSearch
   "+playwright browser"). If not connected, tell the user to restart the
   session — the server is registered in `.mcp.json`.
2. **Dev server**: check `curl -sk https://localhost:3000/netlox/` returns
   HTML. If not, start it in the background: `npm start` (repo root, ~30 s;
   it targets the testbed OAM via `.env.development`). Confirm the testbed
   OAM answers: `curl -s http://223.130.142.175:8080/oam/health`.
3. **Credentials**: read `E2E_ADMIN_USER` / `E2E_ADMIN_PASSWORD` from
   `.env.e2e.local` in the repo root. If the file is missing, ask the user
   for the testbed admin credentials (never store them elsewhere).
4. If the user passed suite IDs as arguments, run only those (S2 must run
   before S3/S4 in the same session because it provisions the test users;
   S10 cleanup is mandatory whenever S2 ran).

## Execution

- Drive the browser with the playwright MCP tools (`browser_navigate`,
  `browser_snapshot`, `browser_click`, `browser_type`,
  `browser_take_screenshot`, ...). Prefer snapshots + accessibility roles
  over pixel positions.
- Base URL: `https://localhost:3000/netlox` (self-signed cert — the MCP
  server already runs with `--ignore-https-errors`).
- Follow the plan's safety rules strictly: no firmware, no config import
  (dry-run only), never modify the admin account, pair every mutation with
  cleanup, prefix created entities with `e2e-`.
- Screenshot every FAIL immediately, into the session scratchpad.

## Reporting

End with the plan §3 format: per-suite `Step | Expected | Observed |
PASS/FAIL` tables, an overall verdict, and a list of any `e2e-` artifacts
that could not be cleaned up. If RBAC behavior deviates, cross-reference
the relevant finding in `docs/SECURITY_RBAC_PLAN.md`.
