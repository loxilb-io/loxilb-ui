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
| C-1 | **Unauthenticated admin takeover via `POST /oam/admin/reset`.** Only "protection" is a JSON `confirm:true` flag; the code comment "Optional: Verify super admin authorization" is unimplemented. Resets admin to the known default password and returns it in the body. Any anonymous caller with network reach → admin. | `handler.go:2647-2690`, `user_service.go:1686`. Live: `/oam/admin/reset` reachable with no token (OPTIONS 200). | **OPEN — flagged** |
| C-2 | **No authorization on user management.** `CreateUser`/`UpdateUser`/`DeleteUser`/`GetUsers` never checked the caller's role. Any authenticated user could create an **admin**, change another user's password/role (take over admin), or delete users. | `handler.go` CreateUser:306 / UpdateUser:370 / DeleteUser:460; `routes.go` token-only group. | **[FIXED]** RBAC middleware + handler authz (see §4) |
| C-3 | **Hardcoded JWT signing key** `netlox_secret_key` (HS256). Anyone with the source can forge a token for `username:"admin"` → full access, bypassing login entirely. | `utils/jwt.go:15`. | **OPEN — flagged** (needs env secret + token invalidation) |
| C-4 | **Hardcoded license HMAC secret** `presto@123` used to both mint and validate trial/enterprise licenses. Anyone with the repo can forge enterprise licenses. | `config/constants.go:21`, `user_service.go:907/956`, `utils/license.go:253`. | **OPEN — flagged** |

### HIGH

| # | Finding | Evidence | Status |
|---|---|---|---|
| H-1 | **Password hashes serialized in API responses.** `models.User.Password` had `json:"password"`; `GetUsers`/`GetMe` return `User` directly. | `model.go:10`; live `/users/me` returns a `password` field. | **[FIXED]** `json:"-"` on the field |
| H-2 | **Token revocation is non-functional.** Logout deletes a DB token row, but `TokenAuthMiddleware` only checks JWT signature+expiry — never the DB/blacklist. A "logged-out" token works until natural 24h expiry. UI logout never even called `/oam/logout`. | `middleware/auth.go`, `user_service.go:670`; UI `ProfileMenu.tsx:18`. | **[PARTIAL]** UI now calls logout (see §4); server-side revocation still OPEN |
| H-3 | **Proxy grants full read+write data-plane control to any licensed user; no method distinction.** `ProxyToLoxiLB` forwards all methods identically; a `viewer` could POST/DELETE gateway config. | `proxy_service.go:111`, `routes.go` licensed group. | **OPEN — needs RBAC Phase 2** |
| H-4 | **CORS `Allow-Origin: *` with `Allow-Credentials: true`.** Unsafe/spec-violating combination. | `middleware/cors.go`. | **OPEN — flagged** |

### MEDIUM

| # | Finding | Evidence | Status |
|---|---|---|---|
| M-1 | Weak password hashing: PBKDF2-HMAC-SHA256 at **10,000** rounds (OWASP ≈600k). | `pkg/utils/password.go:14`. | OPEN |
| M-2 | Weak brute-force lockout: 5 attempts → **30-second** lock; no rate-limit on reset/setup/proxy. | `config/constants.go:71`. | OPEN |
| M-3 | No token expiry/refresh in UI; 24h opaque token in `localStorage` (XSS-exfiltratable). | UI `fetcher_base.ts`; `constants.go:25`. | OPEN |
| M-4 | Hardcoded OAuth client secrets committed. | `config/oauth.go:13`. | OPEN (OAuth being removed) |
| M-5 | Default admin password hardcoded in 7+ files, incl. imported-user default. | `config/constants.go:65`, `main.go:232`. | OPEN |

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
- Logout now calls `POST /oam/logout` (best-effort) before clearing local state and redirecting — H-2 client half. Server-side revocation (making `TokenAuthMiddleware` honor the logout) remains OPEN in Phase 4.

> **Deploy note:** the OAM changes are committed to source but the testbed still runs the old binary. Role enforcement is **not live** until OAM is rebuilt and redeployed on testbed-client. The current admin session is unaffected (same key, admin role).

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

**Phase 2 — Role-aware enforcement across all mutating routes (the real win for H-3).**
- Capability table; a `RequireCapability(action)` middleware.
- Gate instance CRUD, config import/export, firmware, and — critically — the **proxy** by HTTP method: `viewer` → GET only; `operator`/`admin` → write. Enforce at `ProxyToLoxiLB` before forwarding (inspect `c.Request.Method`).
- Add `@Security` to **all** remaining protected handlers (Phase 1 did user/logout/license only).

**Phase 3 — UI role-awareness (defense-in-depth + UX).**
- Fetch role once (from `/users/me` or the new claim) into a small context/atom (`is_logged_in_atom` is currently unused).
- Add `roles?: string[]` to `IMenuItem` (`types/menu.ts`) and filter in `SideMenu`/`TopNavMenu`; gate write buttons (create/delete/apply) on capability. Choke points already identified: `MENU_LIST`, `Header.tsx:39/53`.
- Route-level guard component wrapping `<Layout>` routes (there is none today).
- Note: UI gating is UX only — **server-side (Phase 2) is the security boundary.**

**Phase 4 — Harden the auth primitives (the CRITICAL/HIGH backend items).**
- **C-1:** require a valid admin token on `/oam/admin/reset`, OR gate it to first-boot only (allow unauthenticated reset only when no admin exists / DB uninitialized), OR remove the HTTP route and keep only the `cmd/reset_admin` local CLI. **Recommend: remove the HTTP route; reset is a break-glass local op.**
- **C-3 / C-4 / M-4 / M-5:** move JWT key, license HMAC secret, OAuth secrets, and default admin password to environment variables / mounted secrets; fail closed if unset in production. Rotate on deploy (invalidates tokens/licenses — coordinate).
- **H-2:** make `TokenAuthMiddleware` consult the token store/blacklist so logout actually revokes; or move to short-lived access tokens + refresh.
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

## 6. Verification & follow-ups

- OAM: `go build ./...` ✅. Rebuild + redeploy to testbed-client to activate Phase 1 enforcement, then re-run the live probes (non-admin token must get 403 on `POST /oam/users`).
- UI: `tsc` ✅, 76 tests ✅, production build ✅, mapping guard ✅.
- **Owner decisions needed** before Phase 4: secret-management mechanism (env vs vault), whether to keep `/oam/admin/reset` as an HTTP route, token-TTL/refresh strategy.
- Backend commits pending in `oam-loxilb` (RBAC + swagger regen) and `loxilb-inference-gateway` (earlier swagger fixes) must be committed in those repos.
