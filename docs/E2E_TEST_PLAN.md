# loxilb-ui End-to-End UI Test Plan (playwright-mcp)

Agent-driven browser E2E suite executed through the
[playwright-mcp](https://github.com/microsoft/playwright-mcp) server
(registered project-scoped in `.mcp.json`). Run it with the `/e2e-ui-test`
skill (`.claude/skills/e2e-ui-test/SKILL.md`), which follows this plan.

The suite validates the real stack end to end: local UI dev server →
testbed-client OAM (`203.0.113.99:8080`) → testbed-gw inference gateway
(`10.0.0.12`). It exercises everything the RBAC/security work shipped:
login/logout with server-side token revocation (H-2), the 3-role model
(Phase 2 server enforcement + Phase 3 UI gating), and every menu page.

## 1. Environment & prerequisites

| Item | Value |
|---|---|
| UI under test | dev server: `npm start` → **https://localhost:3000/netlox** (self-signed cert — `.mcp.json` passes `--ignore-https-errors`) |
| Backend | testbed-client OAM (`.env.development` `REACT_APP_API_URL`) — the live testbed, NOT a mock |
| Browser | Chromium via playwright-mcp (installed in `~/Library/Caches/ms-playwright`) |
| Credentials | `.env.e2e.local` (gitignored): `E2E_ADMIN_USER`, `E2E_ADMIN_PASSWORD`. If absent, ask the operator — the testbed admin password is not stored anywhere |
| Test users | `e2e-operator` / `e2e-viewer` (password `E2eTestPass1!`), created by the suite in S2, deleted in S10 cleanup |

**Safety rules (testbed is shared):**
- Never touch firmware routes, config **import** (dry-run only), or the admin account itself.
- Every mutation the suite makes must be paired with its own cleanup (create → verify → delete).
- Prefix all created entities with `e2e-` so strays are identifiable.

## 2. Suites

Execute in order; S2 provisions the users S3/S4 need. Each step lists the
action and the **expected** observation. Any deviation = FAIL for that step;
continue the suite unless the failure blocks later steps (e.g. login broken).

### S1 — Authentication & session (admin)
1. Navigate to `/netlox/login` → login form renders, no signup tab (removed by design).
2. Submit wrong password → error message shown, still on login page.
3. Submit valid admin credentials → redirected to `/netlox/instance`, header shows username.
4. Deep-link while logged in: navigate to `/netlox/user` → page renders (no login bounce).
5. Sign out via profile menu (confirm popup) → back on login page.
6. **H-2 revocation:** after sign-out, navigate to `/netlox/instance` → bounced to login (RequireAuth); the old token no longer works even if replayed (server returns 401 "Token has been revoked").
7. Log back in as admin for S2.

### S2 — Admin capabilities & user provisioning
1. Header shows **all** icons: Instances, User Management, Config Management, language, profile.
2. `/netlox/user` → tabs: Profile, License, **User List** (admin-only tab visible).
3. User List → Add: role dropdown offers exactly **Viewer (read-only) / Operator / Admin**, default Viewer.
4. Create `e2e-operator` (role Operator) and `e2e-viewer` (role Viewer) → success popups, both appear in the table with role badges.
5. License tab → install/edit/delete buttons **visible** for admin.
6. `/netlox/config-management` loads (admin route guard passes). Export a config (`e2e-` description if the form allows), see it listed; download it. Run an import **dry-run** only.

### S3 — Operator role (login as `e2e-operator`)
1. Header: Config Management icon **hidden**; Instances + User Management visible.
2. Deep-link `/netlox/config-management` → redirected to `/netlox/instance` (RequireAdminRoute).
3. `/netlox/user`: **no User List tab**; License tab shows table but **no** install/edit/delete buttons; Profile tab shows role `operator`.
4. Instance list loads; open instance dashboard (testbed-gw-gateway) → metrics render.
5. **Gateway write allowed:** on a safe CRUD page (Traffic → LB Rule), create an `e2e-` rule → appears in table → delete it → gone. (Server: operator holds `gateway_write`.)
6. Instance mutations denied: the UI shows no instance add card; if an edit control exists on the card, attempting a change surfaces a 403 error popup (server `instance_write` is admin-only) — do not retry.

### S4 — Viewer role (login as `e2e-viewer`)
1. Header: Config Management icon hidden.
2. All side-menu sections visible (viewer may read everything); every page under Traffic/Security/Networks/Status loads with data and **no add/edit/delete buttons** on any table (DataTable viewer gating).
3. Attempt deep-link `/netlox/config-management` → bounced to `/netlox/instance`.
4. `/netlox/user`: Profile shows role `viewer`; License tab read-only; no User List tab.
5. Self-service still works: edit own profile email → success (server allows self-edit).
6. Sanity via devtools/network (snapshot): no mutation request is issued from the read-only pages.

### S5 — Instance & dashboard (admin)
1. Instance list shows `testbed-gw-gateway` with health status; "Check Health" button refreshes without error.
2. Open dashboard → charts/stat tiles render (Prometheus-backed), no console errors, no CORS page.

### S6 — Full menu smoke (admin)
For each menu entry, page loads, table/content renders, no error page or spinner deadlock:
- Traffic: LB Rule, Endpoint, Conntrack, Firewall, QoS, Mirror, SNI Certificates
- Security: IP Filter(XDP), SYN Flood Protection(XDP), Security Rate Limiting(XDP)
- Networks: Port, IP Address, IP Neighbor, IP Route, BFD
- Status: Device Details, File System, High Availability, Process, Logs
- Log Settings

### S7 — Gateway CRUD round-trip (admin)
On LB Rule (and optionally Firewall): create `e2e-` entry → verify in table → edit if supported → delete → verify gone. Confirms the OAM proxy path end-to-end (admin `gateway_write`).

### S8 — OAM logs & archive download (admin)
1. Status → Logs: OAM log lines render.
2. Log archives: list renders; download one archive → progress feedback appears (streaming download feature) and completes.

### S9 — Error handling
1. Navigate to a bogus route → 404 page.
2. While logged in as `e2e-viewer`, have an admin (API) delete that user's token or the user → next UI action redirects to login without crashing. *(Optional if awkward to orchestrate; the H-2 check in S1.6 covers the main path.)*

### S10 — Cleanup (admin)
1. Log in as admin; delete `e2e-operator`, `e2e-viewer`; verify gone from User List.
2. Delete any `e2e-` LB rules/config exports the run left behind.
3. Sign out.

## 3. Reporting

Produce a per-suite table: `Suite | Step | Expected | Observed | PASS/FAIL`,
plus screenshots (playwright-mcp `browser_take_screenshot`) for every FAIL.
File regressions found against `docs/SECURITY_RBAC_PLAN.md` (RBAC) or as
bugs. A full run should end with the testbed in its pre-run state.

## 4. Known constraints

- The dev server must be running before the suite starts (`npm start`, ~30 s warm-up); the skill checks and starts it.
- The suite runs against live gateway state — counts/rows will vary; assert presence/absence of the suite's own `e2e-` entities, not absolute table contents.
- Admin credentials are never persisted by the suite; they live only in the operator-provided `.env.e2e.local`.
- playwright-mcp connects at session start; if the `playwright` MCP server shows as disconnected, restart the Claude Code session.
