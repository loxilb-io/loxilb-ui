# Security Review & RBAC Implementation Plan

**Scope:** the loxilb-ui ↔ oam-loxilb ↔ loxilb-inference-gateway auth/authorization surface.
**Date:** 2026-07-17. **Basis:** full source audit of both repos + live verification on the Naver testbed.
**Companion:** `PRODUCTION_HARDENING_PLAN.md`, `API_COVERAGE_REPORT.md`.

> ⚠️ This document records **critical, verified vulnerabilities** in the OAM backend. Several are unauthenticated remote takeover primitives. They must be treated as release blockers. Items marked **[FIXED 2026-07-17]** were remediated in this pass; the rest are planned/flagged and need owner decisions (some require deployment/secret-rotation coordination).

---

## 1. Signup vs admin-provisioning — the product question (RESOLVED)

**Decision: admin-provisioned users ("supervisor mode"), no public self-signup. This is correct and matches industry norm for infrastructure control planes.**

Comparison — none of these offer public self-signup; all use bootstrap-admin + admin-provisioning and/or enterprise SSO:

| Product | Model |
|---|---|
| Grafana | self-signup disabled by default (`allow_sign_up=false`); admin-created users or SSO |
| Argo CD | no signup; bootstrap admin + OIDC/Dex; local users defined by admin |
| Rancher | bootstrap admin; users via admin or auth provider |
| Kubernetes Dashboard | no local user DB; token/SSO only |
| vCenter / pfSense / UniFi | admin-provisioned only |

Self-signup is a consumer-SaaS pattern; on a network control plane it lets anyone with network reach mint an account that can push LB/firewall/routing config. The original request (remove OAuth) plus the current closed model is the right end state. Future "log in with company accounts" = **enterprise SSO (OIDC/LDAP)**, a licensed OAM feature — distinct from the consumer Google/GitHub OAuth that was removed, and it does not reopen signup.

**[FIXED 2026-07-17]** Dead self-signup path removed from the UI: `signup_and_login`/`check_username_availability` (connector), signup mode in `AuthForm` (now login-only), the login/signup tabs in `LoginPage`, and the orphaned `AuthMode`/`IAuthFormData`/`IAuthFormErrors` types. Admin user creation (`create_user`, User Management page) is retained.

---

## 2. Threat findings (verified)

Severity uses CVSS-style qualitative rating. "Verified" = confirmed against the live testbed (non-destructively) or by direct source read.

### CRITICAL

| # | Finding | Evidence | Status |
|---|---|---|---|
| C-1 | **Unauthenticated admin takeover via `POST /oam/admin/reset`.** Only "protection" was a JSON `confirm:true` flag. Reset admin to the known default password and returned it. Any anonymous caller with network reach → admin. | `handler.go:2647-2690`, `user_service.go:1686`. | **[FIXED + DEPLOYED]** HTTP route & handler removed; reset is now the local-only `cmd/reset_admin` CLI. Live testbed: route returns **404**. |
| C-2 | **No authorization on user management.** `CreateUser`/`UpdateUser`/`DeleteUser`/`GetUsers` never checked the caller's role. Any authenticated user could create an **admin**, change another user's password/role (take over admin), or delete users. | `handler.go` CreateUser:306 / UpdateUser:370 / DeleteUser:460; `routes.go` token-only group. | **[FIXED + DEPLOYED]** RBAC middleware + handler authz (see §4). Live: non-admin gets **403** on GET/POST/DELETE `/users` and on changing another user's password. |
| C-3 | **Hardcoded JWT signing key** `netlox_secret_key` (HS256). Anyone with the source can forge a token for `username:"admin"` → full access, bypassing login entirely. | `utils/jwt.go:15`. | **[FIXED + DEPLOYED]** Sourced from `OAM_JWT_SECRET` (public fallback + startup warning). Testbed running with a fresh random key; old forgeable tokens invalidated. |
| C-4 | **Hardcoded license HMAC secret** `presto@123` used to both mint and validate trial/enterprise licenses. Anyone with the repo can forge enterprise licenses. | `config/constants.go:21`, `user_service.go:907/956`, `utils/license.go:253`. | **[FIXED — env-wired]** Sourced from `OAM_LICENSE_SIGNING_SECRET` (public fallback + startup warning). Testbed keeps the old value so existing licenses validate; **production must set a new secret AND reissue licenses.** |

### HIGH

| # | Finding | Evidence | Status |
|---|---|---|---|
| H-1 | **Password hashes serialized in API responses.** `models.User.Password` had `json:"password"`; `GetUsers`/`GetMe` return `User` directly. | `model.go:10`; live `/users/me` returns a `password` field. | **[FIXED]** `json:"-"` on the field |
| H-2 | **Token revocation is non-functional.** Logout deletes a DB token row, but `TokenAuthMiddleware` only checks JWT signature+expiry — never the DB/blacklist. A "logged-out" token works until natural 24h expiry. UI logout never even called `/oam/logout`. | `middleware/auth.go`, `user_service.go:670`; UI `ProfileMenu.tsx:18`. | **[FIXED + DEPLOYED]** `TokenAuthMiddleware(userService)` now also requires the token in the `api_tokens` store (fail-closed). Live: token → 200, logout → 200, same token → **401 "Token has been revoked"**. Residual: a token can outlive revocation by ≤5 min via the in-process validation cache only if deleted from the DB out-of-band (logout purges the cache). |
| H-3 | **Proxy grants full read+write data-plane control to any licensed user; no method distinction.** `ProxyToLoxiLB` forwards all methods identically; a `viewer` could POST/DELETE gateway config. | `proxy_service.go:111`, `routes.go` licensed group. | **[FIXED + DEPLOYED]** RBAC Phase 2: proxy method-gated (`RequireGatewayCapability`) — GET/HEAD/OPTIONS any role, mutating methods need `gateway_write` (admin/operator). Live: viewer POST/DELETE proxy → **403**; operator/admin writes forwarded. |
| H-4 | **CORS `Allow-Origin: *` with `Allow-Credentials: true`.** Unsafe/spec-violating combination. | `middleware/cors.go`. | **[FIXED + DEPLOYED 2026-07-18]** `OAM_ALLOWED_ORIGINS` allowlist: matching origin reflected with credentials + `Vary: Origin`; non-matching gets no CORS headers. Unset = `*` **without** credentials (dev fallback + startup SECURITY warning). Live-verified all three modes. |

### MEDIUM

| # | Finding | Evidence | Status |
|---|---|---|---|
| M-1 | Weak password hashing: PBKDF2-HMAC-SHA256 at **10,000** rounds (OWASP ≈600k). | `pkg/utils/password.go:14`. | **[FIXED + DEPLOYED 2026-07-18]** 600k rounds in versioned format `pbkdf2-sha256$<rounds>$<salt>$<hash>`; legacy + bcrypt still verify and are transparently **rehashed on login**. Live-verified: legacy hash upgraded in DB on first login. |
| M-2 | Weak brute-force lockout: 5 attempts → **30-second** lock; no rate-limit on reset/setup/proxy. | `config/constants.go:71`. | **[FIXED + DEPLOYED 2026-07-18]** Exponential lockout: 1m base doubling per further failure, 15m cap. Per-IP token-bucket rate limits: login/setup 0.5 rps burst 10, proxy 50 rps burst 100. Live-verified: lockout 60s→120s; 15 concurrent logins → 10×401 + 5×429. |
| M-3 | No token expiry/refresh in UI; 24h opaque token in `localStorage` (XSS-exfiltratable). | UI `fetcher_base.ts`; `constants.go:25`. | **[PARTIAL — TTL FIXED + DEPLOYED 2026-07-18]** Token TTL now `OAM_TOKEN_TTL_MINUTES` (default **480 = 8h**, was 24h); JWT and `api_tokens` row lifetimes unified. Live-verified 8h. Residual: token still in `localStorage`; httpOnly-cookie migration deferred (needs CSRF + UI rework). |
| M-4 | Hardcoded OAuth client secrets committed (real Google/GitHub secrets in git history). | `config/oauth.go:13`. | **[FIXED — env-wired]** Secrets removed from source; loaded from `OAM_OAUTH_<PROVIDER>_CLIENT_ID/_SECRET`. **Rotate the leaked Google/GitHub secrets at the provider** (git history still holds them). |
| M-5 | Default admin password hardcoded in 7+ files, incl. imported-user default. | `config/constants.go:65`, `main.go:232`. | **[FIXED — env-wired]** All functional refs route through `config.DefaultConfigPassword` (env `OAM_DEFAULT_ADMIN_PASSWORD`, public fallback + startup warning). |

---

## 3. Current authorization model (as-was)

- **Identity:** JWT with a single claim (`username`), 24h, HS256, hardcoded key. No role or user-id in the token.
- **Roles:** `users.role ENUM('admin','user')` exists in schema and `models.User`, but was **used only for license pooling**, never for access control. UI also references a `viewer` role in a few type unions, but the OAM enum only has `admin`/`user`.
- **Enforcement layers:** `TokenAuthMiddleware` (authn only) → `LicenseValidationMiddleware` (billing gate, not authz). **No role/permission middleware existed.**
- **UI:** no route guards at all; role gating existed **only** inside the User Management page (`role === 'admin'` show/hide). Enforcement was entirely reactive (redirect on 401).

---

## 4. What was fixed in this pass (RBAC Phase 1)

**OAM backend (`oam-loxilb`, source only — needs rebuild/redeploy to take effect):**
- New `internal/middleware/rbac.go`: `RequireAdmin(userService)` — resolves the caller from JWT claims, loads the user, 403 unless `role=="admin"`. `ResolveCaller` helper for self-vs-admin logic.
- `routes.go`: `GET /oam/users`, `POST /oam/users`, `DELETE /oam/users/:id` now require admin.
- `UpdateUser` handler: self-or-admin (a non-admin may edit only their own account) **and** a privilege-escalation guard (only admins may change `role`). Closes C-2's password/role-takeover vector while preserving self-service profile edits.
- `models.User.Password` → `json:"-"` (H-1 fixed; requests use DTOs so binding is unaffected).
- `@securityDefinitions.apikey BearerAuth` in `main.go` + `@Security BearerAuth` on the user/logout/license handlers, so the regenerated swagger reflects that these require auth (previously `security: none`). Re-vendored into `loxilb-ui/api-spec/oam-swagger.json`.
- `go build ./...` clean; `swag init` regenerated; UI `tsc`/mapping-guard/tests all green.

**UI (`loxilb-ui`):**
- Dead signup path removed (§1).
- Logout now calls `POST /oam/logout` (best-effort) before clearing local state and redirecting — H-2 client half. Server-side revocation was completed in a follow-up pass (see §6).

> **Deploy note:** the OAM changes are committed to source but the testbed still runs the old binary. Role enforcement is **not live** until OAM is rebuilt and redeployed on kv-client. The current admin session is unaffected (same key, admin role).

---

## 5. RBAC target model & phased plan

### 5.1 Role model

Adopt three roles (align OAM enum + UI):

| Role | Intent | Capabilities |
|---|---|---|
| `admin` | Operator/owner | Everything: user admin, instance CRUD, gateway read+write, config import/export, licenses |
| `operator` (rename of `user`) | Day-to-day operator | Gateway read+write, instance read, own profile; **no** user admin, **no** instance delete |
| `viewer` | Read-only / audit | GET-only everywhere (dashboard, logs, config read); no mutations |

Keep it **role-based, not full ABAC** — matches the product scale and the comparison set. Model as a capability matrix in one place (a `permissions.go` table keyed by role) so routes/handlers ask `can(role, action)` rather than hardcoding `role=="admin"`.

### 5.2 Token carries identity

Add `role` and `user_id` to JWT claims so middleware avoids a DB lookup per request and the UI can gate menus without a second call. (Invalidates existing tokens on rollout — schedule with C-3's key rotation.)

### 5.3 Phases

**Phase 1 — Admin gate on user administration.** ✅ done this pass (§4).

**Phase 2 — Role-aware enforcement across all mutating routes (the real win for H-3).** ✅ **done + deployed 2026-07-17** (see §6).
- Capability table; a `RequireCapability(action)` middleware.
- Gate instance CRUD, config import/export, firmware, and — critically — the **proxy** by HTTP method: `viewer` → GET only; `operator`/`admin` → write. Enforce at `ProxyToLoxiLB` before forwarding (inspect `c.Request.Method`).
- Add `@Security` to **all** remaining protected handlers (Phase 1 did user/logout/license only).

**Phase 3 — UI role-awareness (defense-in-depth + UX).** ✅ **done 2026-07-17** (see §6).
- Fetch role once (from `/users/me` or the new claim) into a small context/atom (`is_logged_in_atom` is currently unused).
- Add `roles?: string[]` to `IMenuItem` (`types/menu.ts`) and filter in `SideMenu`/`TopNavMenu`; gate write buttons (create/delete/apply) on capability. Choke points already identified: `MENU_LIST`, `Header.tsx:39/53`.
- Route-level guard component wrapping `<Layout>` routes (there is none today).
- Note: UI gating is UX only — **server-side (Phase 2) is the security boundary.**

**Phase 4 — Harden the auth primitives (the CRITICAL/HIGH backend items).**
- **C-1:** require a valid admin token on `/oam/admin/reset`, OR gate it to first-boot only (allow unauthenticated reset only when no admin exists / DB uninitialized), OR remove the HTTP route and keep only the `cmd/reset_admin` local CLI. **Recommend: remove the HTTP route; reset is a break-glass local op.**
- **C-3 / C-4 / M-4 / M-5:** move JWT key, license HMAC secret, OAuth secrets, and default admin password to environment variables / mounted secrets; fail closed if unset in production. Rotate on deploy (invalidates tokens/licenses — coordinate).
- **H-2:** ~~make `TokenAuthMiddleware` consult the token store/blacklist so logout actually revokes~~ **DONE** (store check in middleware, fail-closed). Follow-up idea: revoke ALL of a user's tokens on password change (`DELETE FROM api_tokens WHERE user_id = ?` + cache flush) — today only the presented token is revoked on logout.
- **H-4:** reflect a specific allowed origin (env-driven) instead of `*` when credentials are allowed.
- **M-1:** raise PBKDF2 to ≥600k rounds (or migrate to argon2id), rehash-on-login.
- **M-2:** exponential/again-longer lockout; rate-limit reset/setup/proxy.
- **M-3:** shorten token TTL; consider httpOnly cookie instead of `localStorage` to remove the XSS exfil path (needs CORS/CSRF rework).

### 5.4 Sequencing

```
Phase 1 (done) → Phase 4 criticals C-1,C-3,C-4 (release blockers) →
Phase 2 (route/proxy capability enforcement) → Phase 3 (UI) → Phase 4 remainder (H/M hardening)
```

C-1 and C-3 are the highest priority: either alone is a full remote-admin-compromise. They gate any exposure of OAM beyond a trusted network.

---

## 5.5 OAM security environment variables (added 2026-07-17)

Set these in production (docker `-e` / compose `environment:` / k8s Secret). Each has a public built-in fallback so dev/test runs unconfigured; OAM logs a `SECURITY:` warning at startup for every one left unset.

| Env var | Purpose | Rotation impact |
|---|---|---|
| `OAM_JWT_SECRET` | JWT signing key | Rotating invalidates all active tokens (users re-login) |
| `OAM_LICENSE_SIGNING_SECRET` | License HMAC secret | Rotating invalidates existing licenses — **reissue them** |
| `OAM_DEFAULT_ADMIN_PASSWORD` | Bootstrap admin + imported-user password | Affects only fresh installs / new imports |
| `OAM_OAUTH_GOOGLE_CLIENT_ID` / `_CLIENT_SECRET` | Google OAuth (if used) | — |
| `OAM_OAUTH_GITHUB_CLIENT_ID` / `_CLIENT_SECRET` | GitHub OAuth (if used) | — |
| `OAM_TOKEN_TTL_MINUTES` | JWT / API-token lifetime (default 480 = 8h; explicit `-token-expiration` flag wins) | Applies to newly issued tokens only |
| `OAM_ALLOWED_ORIGINS` | Comma-separated CORS origin allowlist (H-4). Unset = `*` without credentials + startup warning | — |

Testbed (kv-client) is currently deployed with `OAM_JWT_SECRET` (fresh random) and `OAM_LICENSE_SIGNING_SECRET=presto@123` (kept so the installed trial license still validates).

## 6. Status & NEXT WORK (updated 2026-07-17, deployed)

**Done + deployed to kv-client** (OAM `9327bf2`, `2006208`; UI `d7cf9d5`, `13831f9`): RBAC Phase 1 (admin gate + self-vs-admin + role-escalation guard), C-1 reset route removed, C-3/C-4/M-4/M-5 secrets env-wired, H-1 password-leak fixed, H-2 client half (UI calls logout). All live-verified (§2 table).

**H-2 server half — FIXED + DEPLOYED (2026-07-17, follow-up pass):**
- `TokenAuthMiddleware(userService)` now requires, after the JWT signature+expiry check, that the token still exists in the `api_tokens` store (`UserService.ValidateToken`); missing → **401 "Token has been revoked"**, store lookup error → fail-closed 401.
- `ValidateToken` reworked: absence (`sql.ErrNoRows`) is a definitive `(false, nil)` — not retried — so rejected tokens don't pay the 2s retry sleep on every request. Positive results are cached 5 min; logout purges cache + DB row, so revocation is immediate.
- `UpdateAdminCredentials` now saves its newly issued token via `SaveToken` (it previously returned a JWT that existed nowhere in the store — the store check would have rejected it).
- Logger `init()` falls back to stderr when `/var/log/loxioam.log` is unwritable (was `log.Fatalf`, which also blocked running tests locally).
- Live-verified on kv-client: login → `/users/me` 200 → logout 200 → same token **401 revoked** → re-login 200; garbage token 401; licensed proxy route 200 with valid token.

**RBAC Phase 2 — FIXED + DEPLOYED (2026-07-17, OAM commit `643c442`):**
- 3-role model **admin / operator / viewer** live: DB enum extended (`migrations/002_add_rbac_roles.sql`, applied on testbed), legacy `user` rows migrated to `operator` and `user` accepted on input as an operator alias; **new-user default is now least-privilege `viewer`** (was `user`).
- Capability matrix in `middleware/rbac.go` (single source of truth): admin = everything; operator = `gateway_write` + `alert_write`; viewer = read-only. `RequireCapability(userService, action)` resolves the role from the **DB** per request (role changes apply immediately; JWT claims are not trusted for authz). `RequireAdmin` = `RequireCapability(user_admin)`.
- Routes gated: proxy method-gated (H-3 fixed), instance CRUD + firmware admin-only, config import/export admin-only, alert create/ack admin+operator, license install/update/deactivate admin-only (non-admins use the admin license pool).
- JWT claims now include `role` + `user_id` (informational, for Phase 3 UI gating; old tokens still work — no forced re-login).
- `@Security BearerAuth` added to the remaining 25 protected handlers; swagger regenerated and re-vendored (`api-spec/oam-swagger.json`).
- Tests: capability-matrix + sqlmock proxy method-gating tests (`tests/local/rbac`). Live-verified full matrix on kv-client: viewer 12/12 (all reads 200, all writes 403 incl. proxy POST/DELETE), operator 9/9 (proxy write + alert ack pass RBAC; instance/config/license/user-admin 403), admin passes everything; invalid role on create → 400; H-2 logout-revocation regression passed on the new binary.

**RBAC Phase 3 — DONE (2026-07-17, UI commit `4dd597d`):**
- `useRole()` (`hooks/query/oamHooks.ts`) derives role + capability flags from `/users/me` via the existing react-query cache (no new atom needed); `normalize_role` maps legacy `user` → operator.
- Route guards (`components/layout/RouteGuards.tsx`): `RequireAuth` wraps all authenticated routes; `RequireAdminRoute` gates `/config-management`.
- Header Config icon admin-only; `DataTable` hides add/edit/delete for viewers (single choke point for every resource table); license panel mutation buttons admin-only; `UserEditForm` role dropdown = Viewer/Operator/Admin with viewer default; `IMenuItem.roles?` + SideMenu filtering mechanism added (no entry restricted yet).
- All UX-only — server (Phase 2) remains the security boundary. tsc + 79 unit tests + CRA build green. Browser-level validation planned via the Playwright E2E suite.

**Phase 4 hardening — DONE + DEPLOYED (2026-07-18):**
- **M-1**: PBKDF2 600k rounds, versioned hash format, transparent rehash-on-login (legacy + bcrypt hashes upgrade on first successful login). Unit tests in `tests/local/password`.
- **M-2**: exponential lockout (1m base, doubles per failure, 15m cap) + per-IP token-bucket rate limiting (`middleware/ratelimit.go`, no new deps) on `/oam/login`, `/oam/setup/update-admin` (0.5 rps / burst 10) and the gateway proxy (50 rps / burst 100).
- **M-3**: token TTL env-driven (`OAM_TOKEN_TTL_MINUTES`, default 480 = 8h); explicit `-token-expiration` flag wins; Dockerfile CMD no longer forces 1440. JWT + DB token row lifetimes unified.
- **H-4**: CORS origin allowlist via `OAM_ALLOWED_ORIGINS` (reflect + credentials + `Vary: Origin` for matches; nothing for non-matches; `*` without credentials + startup warning when unset).
- All live-verified on kv-client (legacy-hash upgrade observed in DB; 429 lockout growth 60s→120s; concurrent burst 10×401+5×429; CORS all three modes; viewer proxy GET 200; 8h token TTL).
- Testbed note: deployed WITHOUT `OAM_ALLOWED_ORIGINS` (wildcard fallback) so the local-UI dev loop keeps working; set it in production.

**Remaining security work, in priority order — resume here:**

1. **M-3 residual**: httpOnly-cookie session storage to close the XSS-exfiltration path (needs CSRF protection + UI rework; token currently in `localStorage`).
2. **H-2 follow-up idea**: revoke ALL of a user's tokens on password change (today only the presented token is revoked on logout).

**Login-latency wart — FIXED + DEPLOYED (2026-07-18):** failed logins took ~2s. Two causes, both fixed: `ValidateUser` returned `sql.ErrNoRows` through `RetryOperation` (now a definitive `notFound`, mirroring the H-2 `ValidateToken` pattern), and `RetryOperation` itself slept **after the final attempt** — with `MaxRetries=1` that was a pure 2s penalty on every failing DB call, benefiting all ~39 call sites. Live-verified: bad-username login 2.0s → **~50ms**; lockout still fires (6th attempt, 60s); rehash-on-login still works.

**Owner actions (not code):**
- Log back into the UI — the JWT-key rotation invalidated the old session token.
- **Rotate the leaked Google/GitHub OAuth secrets at the provider** (scrubbed from source but still in git history).
- Commit the pending swagger edits in `loxilb-inference-gateway` (Logs pagination, `/logs` params, `x-not-implemented`/`x-raw-middleware` tags, log-archive `produces` override).
- Set the §5.5 env vars in any non-testbed deployment (prod must set a NEW license secret and reissue licenses).
