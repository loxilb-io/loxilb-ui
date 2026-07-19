# loxilb-ui End-to-End UI Test Plan (playwright-mcp)

Agent-driven browser E2E suite executed through the
[playwright-mcp](https://github.com/microsoft/playwright-mcp) server
(registered project-scoped in `.mcp.json`). Run it with the `/e2e-ui-test`
skill (`.claude/skills/e2e-ui-test/SKILL.md`), which follows this plan.

The suite validates the real stack end to end: local UI dev server →
kv-client OAM (`223.130.142.175:8080`) → kv-loxilb inference gateway
(`10.0.0.12`). It exercises everything the RBAC/security work shipped:
login/logout with server-side token revocation (H-2), the 3-role model
(Phase 2 server enforcement + Phase 3 UI gating), and every menu page —
including the 2026-07-18 additions: AI API Keys, IPsec VPN (tunnels +
certificates), the LB merge-PATCH edit path, and Phase 4 login hardening
(rate limits + exponential lockout, which the suite must respect — see
safety rules).

## 1. Environment & prerequisites

| Item | Value |
|---|---|
| UI under test | dev server on **plain HTTP**: `HTTPS=false WDS_SOCKET_PORT=0 BROWSER=none npx dotenv -e .env.development react-scripts start` → **http://localhost:3000/netlox**. Do NOT use `npm start` — it hardcodes `HTTPS=true` (and `.env.local` does too), and an HTTPS page cannot call the HTTP testbed OAM (browser mixed-content block ⇒ every API call fails with "Failed to fetch") |
| Backend | kv-client OAM (`.env.development` `REACT_APP_API_URL`) — the live testbed, NOT a mock |
| Browser | Chromium via playwright-mcp (installed in `~/Library/Caches/ms-playwright`) |
| Credentials | `.env.e2e.local` (gitignored): `E2E_ADMIN_USER`, `E2E_ADMIN_PASSWORD`. If absent, provision a temporary `e2e-admin` user (role `admin`, password `E2eTestPass1!`) directly in the kv-client MySQL (`docker exec oam-mysql mysql -unetlox -p… loxioam`, hash via `pkg/utils` format) and delete it in S11 — do NOT ask for or use the real admin account |
| Test users | `e2e-operator` / `e2e-viewer` (password `E2eTestPass1!`), created by the suite in S2, deleted in S11 cleanup |

**Safety rules (testbed is shared):**
- Never touch firmware routes, config **import** (dry-run only), or the real admin account.
- Every mutation the suite makes must be paired with its own cleanup (create → verify → delete).
- Prefix all created entities with `e2e-` so strays are identifiable.
- **Login discipline (Phase 4 hardening is live):** logins are rate-limited per IP (burst 10, ~30/min) and 5 failed attempts on one username trigger an exponential lockout (1m → 2m → … → 15m). Never loop login retries; if a login fails twice, stop and diagnose instead of retrying. The single wrong-password step in S1 is safe (counter clears on the following successful login).
- IPsec tunnel **initiate** against a dead peer is safe but blocks ~12 s before timing out (no second strongSwan endpoint on the testbed); keep tunnel actions optional.

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
4. Instance list loads; open instance dashboard (kv-loxilb-gateway) → metrics render.
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
1. Instance list shows `kv-loxilb-gateway` with health status; "Check Health" button refreshes without error.
2. Open dashboard → charts/stat tiles render (Prometheus-backed), no console errors, no CORS page.

### S6 — Full menu smoke (admin)
For each menu entry, page loads, table/content renders, no error page or spinner deadlock:
- Traffic: LB Rule, Endpoint, Conntrack, Firewall, QoS, Mirror, SNI Certificates
- AI Gateway: API Keys *(Tenant Rate Limits is menu-hidden by design — instead deep-link `/netlox/instance/ai/ratelimit` and confirm the route still renders)*
- IPsec VPN: Tunnels, Certificates
- Security: IP Filter(XDP), SYN Flood Protection(XDP), Security Rate Limiting(XDP)
- Networks: Port, IP Address, IPv6 Address, IP Neighbor(ARP/NDP), IP Route, BFD
- Status: Device Details, File System, High Availability, Process, Logs
- Log Settings

### S7 — Gateway CRUD round-trip (admin)
1. LB Rule: create `e2e-` entry → verify in table.
2. **Edit the rule (required, regression for the RFC 7386 merge-PATCH edit path, 2026-07-18):** change a mutable field (e.g. endpoint weight) → save → table reflects the change, no error popup.
3. Delete → verify gone. Confirms the OAM proxy path end-to-end (admin `gateway_write`).
4. Optionally repeat create/delete on Firewall.

### S8 — New feature pages CRUD (admin) — AI Gateway & IPsec (added 2026-07-18)
1. AI Gateway → API Keys: create an `e2e-` key → one-time key value shown; row appears in table. Edit (allowed models / enabled toggle — exercises the apikey PATCH) → change persists after refresh. Delete → gone.
2. IPsec → Tunnels: create tunnel `e2e-tun` (PSK mode, bogus-but-valid remote peer IP, PFS on) → appears with state `down`. Open the **peer config** viewer → mirrored conn block renders. Edit via the form (PUT path; e.g. change subnets, leave PSK empty → key carries over) → change persists. *(Optional: initiate action — expect timeout error toast after ~12 s, state stays down.)* Delete → gone.
3. IPsec → Certificates: page lists cert slots; upload/delete only if a disposable `e2e-` cert is available, otherwise read-only check.

### S9 — OAM logs & archive download (admin)
1. Status → Logs: OAM log lines render.
2. Log archives: list renders; download one archive → progress feedback appears (streaming download feature) and completes.

### S10 — Error handling
1. Navigate to a bogus route → 404 page.
2. While logged in as `e2e-viewer`, have an admin (API) delete that user's token or the user → next UI action redirects to login without crashing. *(Optional if awkward to orchestrate; the H-2 check in S1.6 covers the main path.)*

### S11 — Cleanup (admin)
1. Log in as admin; delete `e2e-operator`, `e2e-viewer`; verify gone from User List.
2. Delete any `e2e-` LB rules, API keys, IPsec tunnels, or config exports the run left behind.
3. If a temporary `e2e-admin` was DB-provisioned (see §1), delete it (and its `api_tokens` rows) via MySQL last.
4. Sign out.

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
