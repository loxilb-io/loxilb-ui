# loxilb-ui E2E Findings & Fix Plan — 2026-07-18

Adversarial end-to-end run via playwright-mcp against the live stack (local dev
UI → testbed-client OAM `203.0.113.99:8080` → testbed-gw inference gateway
`10.0.0.12`). This is a **defect + root-cause** report for developers, not a
pass/fail log — passing RBAC steps are recorded only as evidence (§ *Verified
behavior*). Every finding lists a concrete repro, the root cause at
`file:line`, and a proposed fix.

**Method note:** RBAC was tested at the API layer, not just the UI. Live
operator/viewer JWTs were replayed directly against the OAM to confirm the
*server* enforces authorization (hidden buttons alone prove nothing). That is
how F6 and F8 were found.

## Severity summary

| ID | Sev | Area | One-liner | Fix owner |
|----|-----|------|-----------|-----------|
| [F9](#f9) | 🔴 Critical | AI Gateway UI | API Keys & Tenant Rate Limit pages white-screen the whole app on gateway 402 / non-array | UI |
| [F8](#f8) | 🟠 High | User mgmt | Self-service profile edit broken for every non-admin | UI + OAM |
| [F6](#f6) | 🟠 High | Config / RBAC | Any authenticated role can download full config backups | OAM |
| [F4](#f4) | 🟡 Medium | Config import | Invalid file shows "valid and ready for import!" and an error at once | UI |
| [F3](#f3) | 🟡 Medium | Config files | No way to delete config exports (UI or API) | UI + OAM |
| [F7](#f7) | 🟡 Medium | Instances | Health status shows Down while gateway is reachable; fields flap by view | OAM + UI |
| [F1](#f1) | ⚪ Low→Med | Tables | License table renders a duplicate "ID" column | UI |
| [F5](#f5) | ⚪ Low | Config import | Broken error copy "Failed to add configuration validation." | UI |
| [F10](#f10) | ⚪ Low | Routing | Unknown instance sub-route renders blank instead of 404 | UI |

Suggested order: **F9 → F8 → F6 → F4/F5 → F1 → F3 → F7 → F10** (impact-first;
F9/F4/F5/F1 are near one-liners).

---

## F9 — AI Gateway pages white-screen the entire app on gateway 402 {#f9}

**Severity:** Critical. **Files:** `src/pages/ai/AIApiKeyPage.tsx`,
`src/pages/ai/AITenantRateLimitPage.tsx`, plus a missing route-level error boundary.

### Repro
1. Log in (any role that can reach an instance).
2. Open an instance whose gateway has no valid license (testbed: 0-instance license).
3. Navigate **AI Gateway → API Keys** (`/netlox/instance/ai/apikey`).
4. Result: **completely blank page** — the header and side-nav disappear too, not just the content. Same for **AI Gateway → Tenant Rate Limits** (`/netlox/instance/ai/ratelimit`).

Console:
```
GET .../config/ai/apikey → 402 (Payment Required)
TypeError: (intermediate value)... is not iterable      // AIApiKeyPage
TypeError: (intermediate value)....map is not a function // AITenantRateLimitPage
The above error occurred in the <AIApiKeyPage> component ... Consider adding an error boundary.
```

### Root cause
The gateway license-gates AI features with **HTTP 402**, returning a JSON error
*object* (not an array). The list pages assume the query hook always yields an
array:

`AIApiKeyPage.tsx:82`
```tsx
const keys = React.useMemo(
  () => [...(data ?? [])].sort((a, b) => (a.key_id ?? '').localeCompare(b.key_id ?? '')),
  [data]
);
```
`[...(data ?? [])]` spreads `data`; when `data` is the 402 error object,
spreading a non-iterable throws `TypeError: ... is not iterable`.
`AITenantRateLimitPage` has the same class of bug via `data.map(...)`
(`.map is not a function`).

Because **no error boundary** wraps the routed page, the throw unwinds all the
way to `<App>` (visible in the React component stack: `... at Layout at App`),
so the whole shell unmounts → white screen until manual reload.

IPsec list pages do **not** crash — they guard the empty/non-array case — so the
correct pattern already exists in the codebase; it just wasn't applied to the AI
pages.

### Fix
1. **Harden the list pages** — never spread/iterate an unchecked hook result:
   ```tsx
   // AIApiKeyPage.tsx
   const rows = Array.isArray(data) ? data : [];
   const keys = React.useMemo(
     () => [...rows].sort((a, b) => (a.key_id ?? '').localeCompare(b.key_id ?? '')),
     [rows]
   );
   ```
   Apply the equivalent `Array.isArray` guard in `AITenantRateLimitPage` before `.map`.
2. **Normalize the hook** — `useApiKeys` / the tenant-rate-limit hook should
   return `[]` for any non-200 response instead of passing the error body through.
3. **Add a route-level React error boundary** so a single component throw shows a
   fallback and keeps the nav/shell alive.
4. **Surface 402 gracefully** — render an "AI Gateway requires a license" state
   instead of feeding an error body into a list renderer (`move_402()` at
   `src/connector/fetcher/fetcher_base.ts:122` fires but the render crashes first;
   verify whether it is a no-op).

### Audit
Grep every gateway list page for `[...` / `.map(` / `.sort(` applied directly to
a hook `data` and apply the same guard. This is a pattern, not a one-off.

---

## F8 — Self-service profile edit broken for every non-admin {#f8}

**Severity:** High. **Files:** `src/components/modal/UserEditModal.tsx` (UI) +
OAM `PUT /users/{id}` handler.

### Repro
1. Log in as a viewer (or operator).
2. User menu → **Profile → Edit Profile**, change only the email, **Update User**.
3. Result: inline error **"Forbidden: administrator privileges required to change role"**, and the change does **not** persist. The user never touched their role.

### Root cause (two layers)
1. **UI** — `UserEditModal.tsx:52-56` always sends `role`, even for a self-edit:
   ```tsx
   const updateData: IUserUpdateRequest = {
     username: formData.username,
     email: formData.email,
     role: formData.role,      // ← always included
   };
   ```
   The modal receives `isAdmin` / `isCurrentUser` props but doesn't use them to trim the payload.
2. **OAM** — `PUT /users/{id}` rejects a non-admin update whenever the body
   *contains* a `role` field, even when the value is unchanged, rather than
   comparing old vs new.

Proven at the API (viewer JWT, id 10):
```
PUT /users/10 {email}                       → 200 "User updated successfully"
PUT /users/10 {username,email,role:'viewer'} → 403 "administrator privileges required to change role"
```

### Fix
- **UI:** in `UserEditModal.handleSubmit`, include `role` only when
  `isAdmin && !isCurrentUser`; for a self-edit send `{username, email[, password]}`.
- **OAM:** only enforce the admin check when `role` actually changes (compare to
  the stored value).
- Either fix unblocks self-service; do both for defense in depth. Also fix the
  misleading copy — it says "change role" when no role change was attempted.

---

## F6 — Any authenticated role can download full config backups {#f6}

**Severity:** High (broken function-level authorization / info disclosure).
**Owner:** OAM (server). Surfaced through the UI's fetcher.

### Repro (live operator JWT, reproduced with viewer JWT too)
```
POST /config/export                  → 403   (write correctly denied)
GET  /users                          → 403   (user directory correctly denied)
GET  /config/exports                 → 200   (lists backups)
GET  /config/files                   → 200   (lists files + checksums + download_url)
GET  /config/download/{id}           → 200   (full backup: metadata, users[], system_settings,
                                              loxilb_instances, trial_history)
```
`users[]` contains every account's `{username, role, email, created_at}` — the
exact data `GET /users` returns 403 for. Confirmed for **both** operator and
viewer (lowest privilege).

### Root cause
The config **read/download** routes (`GET /config/exports`, `/config/files`,
`/config/download/{id}`) enforce authentication only — they lack the admin-role
authorization applied to `POST /config/export` and `GET /users`. Same aggregated
privileged data, two endpoints, inconsistent authz. (No password hashes are
present in the export, so this is High, not Critical.)

### Fix
Gate all `/config/*` read + download routes behind the same admin RBAC guard as
the write routes. The UI already only calls these from the admin-guarded
ConfigManagementPage, so no UI change is required — but the leak is purely at the
API and route-guarding the page is not sufficient (defense in depth).

---

## F4 — Import dry-run shows contradictory validity for an invalid file {#f4}

**Severity:** Medium. **File:** `src/components/input/ConfigFileUploader.tsx`.

### Repro
1. Config Management → Import.
2. Upload a valid-JSON / wrong-schema file, e.g. `{"totally":"wrong","schema":[1,2,3]}`.
3. Result: simultaneously — an error popup "Failed to add configuration
   validation. Invalid configuration format", a warning "Validation found
   problems", **and** a green "Configuration file is valid and ready for import!".

### Root cause
The OAM dry-run returns `{success:false, errors:[]}` (invalid, but no per-record
errors). `ConfigManagementPage.handleFileSelect` (`src/pages/ConfigManagementPage.tsx:292`)
correctly computes `isValid = (dryRun.success ?? false) && errors.length===0` →
`false`. But the success banner in `ConfigFileUploader.tsx:233` gates on
`errors.length === 0` alone, ignoring `isValid`:
```tsx
{validationResult.errors.length === 0 && !isImportSuccess && (
  <Alert severity="success">Configuration file is valid and ready for import!</Alert>
)}
```
Empty `errors` + `isValid:false` ⇒ green banner shows next to the error.
(`canImport` at `ConfigFileUploader.tsx:113` *does* check `isValid`, so the real
import button stays hidden — only the messaging is wrong.)

### Fix
```tsx
{validationResult.isValid && validationResult.errors.length === 0 && !isImportSuccess && ( ... )}
```
Mirror the `canImport` gate. One-line fix.

---

## F3 — No way to delete config exports (UI or API) {#f3}

**Severity:** Medium. **Files:** `src/pages/ConfigManagementPage.tsx`
(`FileManagementTab`), `src/connector/oam/configApi.ts`, + OAM.

### Repro
Config Management → File Management: each export offers only **Download**. There
is no delete control. At the API, `DELETE /config/exports/{id}`,
`/config/files/{id}`, `/config/download/{id}` all return **404** — no endpoint
exists. Exports accumulate indefinitely; the tab titled "File Management" cannot
manage (remove) files.

### Root cause
`FileManagementTab` (`ConfigManagementPage.tsx:159-214`) renders only a
`Download` button per file; `configApi.ts` has no `request_delete_config_file`;
the OAM exposes no delete route.

### Fix
Add an OAM `DELETE /config/files/{id}` (or `/config/exports/{id}`), wire
`request_delete_config_file` in `configApi.ts`, and add a delete action (with
confirm) per row in `FileManagementTab`.

---

## F7 — Instance health status wrong/inconsistent {#f7}

**Severity:** Medium (misleading operational signal). **Owner:** OAM + UI.

### Repro / evidence
The `testbed-gw-gateway` card showed **Health Status: Down** for admin while
proxied calls to that same gateway succeeded throughout:
`GET /loxilbs/1/netlox/v1/config/loadbalancer/all` → 200, `POST` → 200,
`DELETE` → 200. Minutes later a viewer session showed the same instance as
**Healthy**. HA State also varied by view (Unknown vs NOT_DEFINED) and Activation
Status (Inactive vs Active).

### Root cause (to confirm)
Either (a) OAM's health probe hits a different endpoint/port than the config API
and legitimately reports Down (then the UI faithfully shows a misleading value),
or (b) the UI reads a stale/flapping stored field. Needs an OAM-side check of how
instance health is computed vs. what the proxy exercises, and a review of the
UI's health-field mapping / refresh timing.

### Fix
Align the health probe with actual gateway reachability (or clarify what "health"
means), and ensure the UI reflects a fresh value rather than a stale cache.

---

## F1 — License table renders a duplicate "ID" column {#f1}

**Severity:** Low→Medium (visible dup column + React key collision; MUI warns
duplicate keys may duplicate/omit children). **Files:**
`src/components/table/DataTable.tsx`, `src/components/table/managers/LicenseManagementTable.tsx`.

### Repro
User Management → License (as a role with a license row, e.g. a trial). The grid
shows **two "ID" columns** and the row renders the id value twice. Console:
`Warning: Encountered two children with the same key, 'id'` (on both
`GridColumnHeaders` and `GridRow`).

### Root cause
`DataTable.tsx:128` unconditionally prepends its own id column:
```tsx
cols.unshift({field: 'id', headerName: 'ID', ...});
```
but `LicenseManagementTable.tsx:32-37` *also* declares `{data_key: 'id', header: 'ID'}`.
Both map to MUI `field: 'id'`; DataGrid keys columns by `field` → duplicate key.
The License table is the only caller that redundantly declares `id`.

### Fix
Preferred (defensive, protects every caller): dedupe `field: 'id'` in `DataTable`
before `unshift`. Minimal: remove the `id` column entry from
`LicenseManagementTable.tsx` (DataTable auto-adds it).

---

## F5 — Broken error copy on import validation failure {#f5}

**Severity:** Low. **File:** `src/pages/ConfigManagementPage.tsx`.

`handleFileSelect` calls `showAddError('configuration validation', ...)`
(`ConfigManagementPage.tsx:315,323`); `useErrorPopup.showAddError` formats as
"Failed to **add** {{entity}}." → "Failed to add configuration validation." Use a
validation-specific message ("Failed to validate the configuration file.")
instead of the generic add-error helper.

---

## F10 — Unknown instance sub-route renders blank instead of 404 {#f10}

**Severity:** Low. Navigating to a non-existent instance sub-route (observed with
the singular `/netlox/instance/ipsec/tunnel` vs the real plural `/tunnels`)
renders an empty content area under the shell rather than the 404 page or a
redirect. Add a catch-all/redirect for unmatched instance sub-routes.

---

## Verified behavior (evidence — not bugs)

Server-side RBAC is genuinely enforced (not merely hidden buttons):

| Check | Operator | Viewer |
|---|---|---|
| `POST /users` (create) | 403 | 403 |
| `GET /users` (read directory) | 403 | 403 |
| `POST /loxilbs` (instance write) | 403 | 403 |
| `GET` gateway loadbalancer | 200 | 200 |
| `POST` gateway loadbalancer (gateway_write) | **200** | **403** |
| `POST /config/export` | 403 | 403 |

- Config-management deep-link redirects non-admins to `/instance`; Config icon hidden in header; DataTable hides add/edit/delete for viewers.
- Deleting a user immediately revokes its active token (next request 401) — H-2 revocation holds for deletion, confirmed by self-deleting the temp admin.

## Cleanup performed

Test users `e2e_operator` (9), `e2e_viewer` (10), and DB-provisioned `e2e_admin`
(8) deleted (only real `admin` id 1 remains); operator-created LB rule removed;
local test files removed. **One unavoidable stray:** OAM config export
`config-90dc8b4a9a112742.json` (desc `e2e-export-test`) — no delete endpoint
exists (that is F3). Remove manually on the OAM host if desired.
