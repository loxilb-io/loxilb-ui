# E2E Fix → Validate Loop — Progress Tracker

Live state for the fix/validate cycle that follows the 2026-07-18 E2E run.
Source of truth for findings + RCA + patches: **`docs/E2E_FINDINGS_2026-07-18.md`**.
This file is the loop's checkpoint — update the Status column after each iteration
so work survives a context clear.

## Decisions locked (2026-07-18)

- **Validation login:** DB-provision a temp `e2e_admin` (role admin, pw
  `E2eTestPass1!`) in kv-client MySQL at loop start; delete it (and its
  `api_tokens` rows) at the end. Recipe: `E2E_TEST_PLAN.md` §1. Also provision an
  `e2e_operator` + `e2e_viewer` when validating F8 (needs a non-admin). Never use
  the real `admin`; respect Phase-4 login lockout.
- **Scope:** UI queue in this repo **and** the server-side findings in the OAM
  repo. Do the UI queue here first, then switch repos for OAM.
  - OAM server code = **oam-loxilb** repo (config routes, `PUT /users/{id}`,
    `DELETE /config/files`, instance-health). Location + deploy: see memory
    `[[oam-security-findings]]`, `[[naver-cloud-testbed]]`; gateway build/deploy
    recipe: `[[ipsec-api-followup]]`. OAM fixes need rebuild + redeploy to
    kv-client before their E2E re-validation.
  - OAM-side items: **F6** (admin-gate `/config` read+download), **F8-server**
    (only enforce admin when role changes), **F3-server** (`DELETE /config/files/{id}`),
    **F7** (health probe). After each OAM fix, redeploy then re-run that finding's
    validation from the UI.

## The loop (one iteration)

1. Pick the topmost `TODO` **UI** finding in the table below.
2. Read its entry in `E2E_FINDINGS_2026-07-18.md` (repro + RCA + fix).
3. Apply the fix in this repo (dev server hot-reloads — no rebuild needed).
4. **Validate in the browser** via the playwright MCP (see *Validation* below):
   reproduce the original symptom is GONE + no console error/crash.
5. Update Status → `FIXED (validated)`; note the commit if you commit per-fix.
6. Repeat. Stop when all UI findings are `FIXED (validated)`.

## ⚠️ Prerequisites for a resumed session (read first)

- **playwright MCP** connects at session start — must be a fresh session; if the
  `playwright` server shows disconnected, restart.
- **Dev server (plain HTTP):** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/netlox/`
  should be 200. If not, start per `docs/E2E_TEST_PLAN.md` §1 (HTTP, not `npm start`).
- **LOGIN CREDENTIALS ARE GONE.** The 2026-07-18 run deleted all temp users
  (`e2e_admin/operator/viewer`) in cleanup. Validation needs an admin login to
  reach an instance. Before validating, re-provision a temp admin:
  either put `E2E_ADMIN_USER`/`E2E_ADMIN_PASSWORD` in `.env.e2e.local`, **or**
  DB-provision `e2e_admin` (role admin, pw `E2eTestPass1!`) in kv-client MySQL per
  `E2E_TEST_PLAN.md` §1, and delete it again at the end. Do NOT use the real
  `admin` account. Respect Phase-4 login lockout: never loop-retry a failed login.
- **F9 validation needs a 402 gateway** — the testbed's unlicensed gateway
  returns 402 for `/config/ai/*`, which is exactly the crash trigger. Good enough
  to validate the guard + error boundary.

## Findings status

Order = impact-first. **UI** = fixable in this repo. **OAM** = server-side
(kv-loxilb / oam-loxilb repo) — out of scope for this repo's loop; hand off separately.

| ID | Sev | Layer | Status | Fix summary (see findings doc for full RCA) |
|----|-----|-------|--------|---------------------------------------------|
| F9 | 🔴 Crit | UI | **FIXED (validated)** | Normalized `query_get_apikey_all` to `Array.isArray`; `Array.isArray` guards in `AIApiKeyPage`/`AITenantRateLimitPage`; new `RouteErrorBoundary` wraps NavLayout `<Outlet/>`. Validated under live 402 (`?name=kv-loxilb-gateway`): both pages render shell+empty table, only the 402 network error in console, no `is not iterable`/`.map` crash. Audit: `resp.data ?? []` list-body pattern was AI-only (IPsec uses nested props → degrades safely). |
| F8 | 🟠 High | UI + OAM | **FIXED (validated, UI+OAM)** | UI: `UserEditModal.handleSubmit` sends `role` only when `isCreateMode \|\| (isAdmin && !isCurrentUser)` — validated in browser (viewer self-edit email → success, role unchanged). OAM: `UpdateUser` now enforces admin only when the role actually CHANGES (compares NormalizeRole vs caller's), else drops the field. API-validated on redeployed OAM: viewer PUT `{…,role:viewer}`→200, PUT `{role:admin}`→403, DB role stays viewer. **NOTE (new, separate):** `UpdateUser` returns 500 when a field is set to its identical current value — pre-existing, not F8; see F11 below. |
| F4 | 🟡 Med | UI | **FIXED (validated)** | `ConfigFileUploader.tsx` success banner now gated on `validationResult.isValid && errors.length===0`. Validated: wrong-schema upload shows only "Validation found problems", NO green "valid and ready for import!" banner. |
| F5 | ⚪ Low | UI | **FIXED (validated)** | `ConfigManagementPage` validation failures now call `showErrorPopup(t('Failed to validate the configuration file.'), …)` instead of `showAddError`. Validated: popup reads "Failed to validate the configuration file." |
| F1 | ⚪ Low→Med | UI | **FIXED (validated)** | `DataTable` prepends the implicit `id` column only when no caller declares one (`!cols.some(c=>c.field==='id')`). Validated: License tab shows exactly one "ID" column, zero duplicate-key React warnings. |
| F3 | 🟡 Med | UI + OAM | **FIXED (validated)** | OAM: `DELETE /config/files/:id` (admin-only) + `ConfigService.DeleteExport` (row + file, 404 on missing). UI: `request_delete_config_file` + confirm-and-delete row action in `FileManagementTab`. Validated: API admin 200 / operator+viewer 403 / bogus 404 / download-after-delete 404; browser confirm→delete→refetch removed the row. Also cleared the prior-run `e2e-export-test` stray. |
| F10 | ⚪ Low | UI | **FIXED (validated)** | Added `<Route path="*" element={<Page404/>}/>` inside `/instance/*`. Validated: bogus `/instance/ipsec/tunnel` renders the 404 page within the instance shell, not blank. |
| F6 | 🟠 High | OAM | **FIXED (validated)** | All `/config/*` routes now carry `RequireCapability(ActConfigWrite)` (admin-only). API-validated on redeployed OAM: `GET /config/exports\|files\|download/{id}` → admin 200, operator 403, viewer 403. |
| F7 | 🟡 Med | UI | **FIXED (validated)** | Root cause: health is a client-side probe `GET /version` **through the OAM licensed proxy**; a 0-license gateway returns 402 for every proxied call (`/version` and `/config/loadbalancer/all` alike), so a reachable-but-unlicensed gateway showed "Down" (flapping across sessions as license state changed + 5-min client cache). Fix: `query_instance_health` now returns the HTTP `code`; `InstanceCard` shows a distinct **"License required"** (warning) on 402 instead of "Down". Validated in browser: card reads "License required". (Not an OAM outage — no server change needed.) |

## New findings surfaced during the fix loop

| ID | Sev | Layer | Status | Notes |
|----|-----|-------|--------|-------|
| F11 | 🟡 Med | OAM | OPEN | `PUT /oam/users/{id}` (`UpdateUser`) returns **500** when a field (email/username) is set to its identical current value. Surfaced while API-validating F8 (echoing the same email → 500; a new value → 200). Not caused by the F8 change; a real production wart (user clicks "Update" without changing anything → 500). Root cause likely in `userService.UpdateUser` (unique-constraint/self-collision handling). Fix: treat no-op / same-value updates as success (or 400 "no changes"), not 500. |
| F12 | 🔴 Crit | UI | **FIXED (validated)** | Opening the LB **Add/Edit** rule form threw **"Maximum update depth exceeded"** (infinite render loop, 16+/open) in `LBInputForm` — a `setState`-in-`useEffect` validation pattern with unstable callback deps. Rewrote: validation derived via `useMemo` (no `setErrors` state), parent notified through a `useEffect` keyed only on `[formData, isValid, errors]` with `onChange`/`onValidation` held in refs, and memoized `handleChange`. Validated live: opening Add/Edit now yields **0** console errors. |
| F13 | 🟡 Med | UI | **FIXED (validated)** | LB form-level `isValid` only checked `externalIP`+`name` non-empty, so invalid rules (port 0, malformed IP, **zero endpoints**) could be submitted. Tightened `LBInputForm` validation to the gateway `LoadbalanceEntry` contract: valid IP (`isValidIPAddress`), port 1–65535, `portMax≥port` when set, and **≥1 endpoint** each with valid IP + targetPort 1–65535 + weight ≥1. Validated live: Create stays disabled until a fully valid rule; full CRUD round-trip (POST/GET/merge-PATCH/DELETE) confirmed against the licensed gateway. |

**UI-only queue for the loop:** F9 → F8(UI) → F4 → F5 → F1 → F10. (F3-UI waits on
OAM endpoint; F6 and F7 are server-side handoffs — track but don't attempt here.)

## Validation quick-reference (per finding)

- **F9:** log in → open an instance → AI Gateway → **API Keys**, then **Tenant Rate
  Limits**. Expect: page renders a table or a graceful "license required" state,
  header/nav stay visible, no `is not iterable` / `map is not a function` in console.
- **F8:** log in as a non-admin → Profile → Edit Profile → change email → Update.
  Expect: success, email persists, no "administrator privileges required to change role".
  (Needs an operator/viewer test user in addition to admin.)
- **F4:** Config Mgmt → Import → upload valid-JSON/wrong-schema
  (`{"totally":"wrong","schema":[1,2,3]}`). Expect: error only — no green
  "valid and ready for import!".
- **F5:** same upload as F4 (malformed) → error popup reads a sensible validate message.
- **F1:** User Mgmt → License (role with a license row) → exactly one "ID" column,
  no duplicate-key console warning.
- **F10:** navigate a bogus instance sub-route → 404 or redirect, not blank.

## Commit convention (optional per-fix)
`fix(e2e): <Fn> <short> — <file>` ; footer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
Branch: continue on `feat/inference-gateway-integration` or a `fix/e2e-findings` branch.
