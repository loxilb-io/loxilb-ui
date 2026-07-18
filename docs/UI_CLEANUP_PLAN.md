# UI Cleanup + License-Removal Plan — RESUME HERE

Created 2026-07-18. Durable handoff for the production-readiness cleanup after
the E2E fix→validate loop (that loop is COMPLETE + committed — see
`docs/E2E_FIX_PROGRESS.md`). Context was cleared mid-task; this doc + memory
`[[e2e-run-findings-2026-07-18]]`, `[[naver-cloud-testbed]]` are the source of truth.

## User decision (2026-07-18, explicit)

Execute **Tier 1 + Tier 2 dead-code removal** AND **comprehensively remove the
ENTIRE license-management feature across all three repos** (UI + OAM +
loxilb-inference-gateway). Quote: *"We want to remove whole license management
part in UI + OAM + loxilb-inference-gateway comprehensively. Will not use any
more."*

Guiding principles (standing): production-ready, concise, correctness first,
UI/UX matters, don't over-feature. Validate changes in the browser via
playwright-mcp; build/typecheck before committing; commit UI and OAM separately;
nothing pushed without the user's say-so.

## Prereqs for the resumed session

- Fresh session (playwright + codegraph + MCP reconnect).
- Dev server (HTTP): `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/netlox/` → 200.
- **Testbed still provisioned** (do NOT re-create): users `e2e_admin`/`e2e_operator`/`e2e_viewer`
  (pw `E2eTestPass1!`), and a test license for `e2e_admin`. Browser was logged in as
  `e2e_admin`. If tokens died, log in again (respect Phase-4 lockout: never loop retries).
- Per-user-license + PBKDF2-over-SSH gotchas: see `[[naver-cloud-testbed]]`.
  (Once license removal ships on OAM, the per-user-license 402 problem disappears.)

## TODO — ordered

### T1. Tier 1 + Tier 2 dead-code removal (loxilb-ui) — NON-license items first
Delete the files/symbols below, then `npx tsc --noEmit` (or build) + spot-check
key screens in browser (instances, LB rule, user mgmt, config mgmt), then commit
`chore(cleanup): remove dead components and unused exports`.

**Dead components (21 + 2 css) — HIGH, 0 imports:**
- `src/components/view/BGPActionView.tsx`, `BGPConditionView.tsx`, `BGPDefinedSetView.tsx`
- `src/components/card/AlertCard.tsx`, `CurrentRateCard.tsx`
- `src/components/element/DateSelector.tsx`, `DateTimeSelector.tsx`, `MiniGraph.tsx`,
  `MiniLineGraph.tsx`, `SimpleLineGraph.tsx`, `SimpleBarChart.tsx`
- `src/components/animation/Aurora.tsx` (+`Aurora.css`), `Threads.tsx` (+`Threads.css`)
- `src/components/menu/ButtonMenu.tsx`
- `src/components/modal/InstanceBaseFormDialog.tsx`
- `src/components/input/UESessionInputForm.tsx`, `UlclInputForm.tsx`  (5G UE/ULCL slice)
- `src/components/table/traffic/UESessionTable.tsx`, `ULCLTable.tsx`
- `src/components/table/networks/BGPApplyTable.tsx` (BGPApplyPage does NOT import it)

**Duplicate / stray:**
- `src/components/card/SystemLogCard copy.tsx` (literal editor copy)
- Empty scaffold dirs (contain only auto-gen `CLAUDE.md`): `src/src/`, `src/actions/`,
  `src/examples/`, `src/docs/`, `src/components/common/`, `src/components/LicenseManagement/`

**Dead exported symbols (drop the whole symbol; some are whole modules) — HIGH:**
- `src/common.ts`: `allow_scroll_x`, `allow_scroll_y`, `detectRateUnit`, `getMaxFromFormat`, `getScaleInfo`, `verify_params`
- `src/atoms.tsx`: `feature_access_cache_atom`, `is_logged_in_atom`, `license_loading_atom`, `license_status_atom`, `setup_loading_atom`, `setup_state_atom`, `setup_wizard_state_atom`
- `src/connector/extracts.ts`: whole module 0 external importers (`extractLBRuleData`, `extractTopDiskUsageData`, `extractTopMemoryUsageData`)
- `src/connector/oam/oam.ts`: `request_firmware_install_start`, `request_firmware_install_stop`, `request_get_instance_by_id`, `request_upload_firmware` (firmware — verify not license); `query_get_license_status` → covered by T3
- `src/connector/oam/configApi.ts`: `query_get_config_exports`
- `src/connector/fetcher/fetcher_oam.ts`: `PATCH_OAM`
- `src/connector/fetcher/fetcher_base.ts`: `check_token`, `save_token` (KEEP `load_token`/`remove_token` — used)
- `src/connector/instance/cert.ts`: `query_get_cert_pem`
- `src/connector/instance/load_balancer.ts`: `request_delete_all_load_balancers`, `request_delete_lb_by_name`, `request_delete_lb_by_hosturl_ip_port_proto`, `request_delete_lb_by_hosturl_ip_portrange_proto`
- `src/connector/instance/bgp.ts`: `request_get_defined_set`
- `src/utils/setupDetection.ts`: whole module, 0 importers (MEDIUM — verify vs `simpleSetup.ts`/`apiProxy.ts`)

**Export-only-internal (LOW — just drop `export`, don't delete the symbol):**
`common.ts` `get_packet_rate_str`, `get_speed_rate_str`, `isValidIPv4/6(+Cidr)`, `parse_log_line`;
`hooks/query/common.ts` `MAX_DATA_POINTS`, `POLLING_INTERVAL_MS`; `hooks/inputFormHook.ts` `getDefaultValueFromParams`.
⚠️ `isValidIPAddress` (common.ts) IS used by LBInputForm now — keep exported.

Audit method note: no `lazy()`/dynamic/`import()` in src (only `reportWebVitals`), so
filename-import matching is authoritative. Scanner scripts were left in scratchpad
(`scan.py`, `exports2.py`) but scratchpad is session-scoped — re-audit if unsure.

### T2. Comprehensive LICENSE-management removal (the big one)
User will not use licensing at all. Remove end-to-end across three repos. Do OAM
first (so the proxy stops requiring a license), then UI, then gateway. Validate
each. This also permanently resolves the per-user-license 402 problem and F7.

**T2a — OAM (`/Users/gongseoghwan/go/src/oam-loxilb`), branch `main`:**
- Remove `LicenseValidationMiddleware` and its use on the `licensed` route group in
  `internal/routes/routes.go` — the proxy + firmware routes become auth-only
  (keep `TokenAuthMiddleware` + `RequireGatewayCapability`/`RequireCapability`).
- Remove license routes/handlers: `/license/install`, `/license/validate`,
  `/license/feature-access`, `/users/licenses*` (GetUserLicenses, GetLicenseStatus,
  InstallLicense, UpdateLicense, DeactivateLicense, CheckFeatureAccess) in routes.go + handler.go.
- Remove license services/models/queries: license bits in `internal/services/user_service.go`
  (or a license_service), `active_licenses` table usage, `OAM_LICENSE_SIGNING_SECRET`,
  `cmd/generate_license`, `cmd/enterprise_license`, `cmd/validate_license`,
  `cmd/regenerate_trial_license`, `cmd/test_enterprise_license`, `internal/utils/license.go`.
- Decide DB: drop `active_licenses` table + related migration, and the trial-history/license
  export fields (careful — config export/import touches trial_history; keep those columns or
  clean the importer too). Grep `licen`, `trial`, `feature_access` across the repo.
- Rebuild + redeploy to testbed-client (recipe in `[[naver-cloud-testbed]]`); verify proxy now
  returns 200 for ANY authed user WITHOUT a license (that's the acceptance test).

**T2b — UI (`loxilb-ui`), branch `feat/inference-gateway-integration`:**
- Remove the **License tab** from `UserManagementPage` and all license UI:
  `LicenseManagementTable`, `LicenseUpdateForm`, `LicenseUpdateModal`, license panel/buttons.
- Remove `src/hooks/query/licenseHooks.ts` (`useLicenseStatus`, `useFeatureAccess`,
  `upgradeLicense`, `useUserLicenseStatus`), the license atoms (already in T1 list),
  `oam.ts` license endpoints (`query_get_license_status`, install/validate/feature-access,
  `/users/licenses*`), `types/license.ts`, and any License-warning popup / instance-count
  license gate on the instance page (the "License Warning: 0 instances" dialog).
- Grep `licen`, `License`, `feature_access`, `trial` across `src`. Validate in browser:
  User mgmt shows only Profile + User List (admin), no License tab; instance page has no
  license warning; LB/AI/gateway still work.

**T2c — Gateway (`/Users/gongseoghwan/go/src/loxilb-inference-gateway`):**
- Grep for license/entitlement code; remove if present. (Lower priority — the 402 the UI saw
  came from OAM's LicenseValidationMiddleware, not the gateway. Confirm the gateway itself has
  no separate license gate before spending effort.)

### T3. F11 fix (OAM, optional, MED) — batch with the T2a OAM rebuild
`PUT /oam/users/{id}` (`UpdateUser` / `userService.UpdateUser`) returns **500** when a
field (email/username) is set to its identical current value. Fix: treat a no-op/same-value
update as success (or 400 "no changes"), not 500. Validate: viewer PUT same email → 200.

### T4. Final testbed teardown (LAST, only when all work + validation done)
Delete temp users + license via MySQL (base64-encode SQL — see `[[naver-cloud-testbed]]`):
`DELETE FROM api_tokens WHERE user_id IN (11,12,13); DELETE FROM active_licenses WHERE user_id=11;
DELETE FROM users WHERE username IN ('e2e_admin','e2e_operator','e2e_viewer');`
(ids: e2e_admin=11, e2e_operator=12, e2e_viewer=13; real admin=1 stays.) Remove any stray
`e2e-` LB rules/exports. Sign out. Remove local scratch (`.playwright-mcp/`, F4/F9 pngs are
untracked evidence — leave or delete per preference).

## Commit convention
`chore(cleanup): …` / `refactor(license): remove license management` etc.;
footer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. UI and OAM commit separately.
