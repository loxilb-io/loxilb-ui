# Instance Snapshots UI — Design (replaces Config Management)

**Status**: APPROVED — implementation in progress

## 0. Implementation status (living section — update per task)

| ID | Status | Summary |
|----|--------|---------|
| U-0 | ✅ done (`2e2aa31`) | Legacy Config Management fully removed per §2 (page, forms, connector, types, route+guard, header icon, contract-test rows, `config-mgmt.spec.ts`, e2e config-export sweep helpers). rbac spec now asserts the surface is gone for admin (no icon, 404). Verified: tsc, vitest 80/80, api:check-mapping, live browser pass vs testbed (0 console errors). Legacy strings were never in the locale JSONs — nothing to remove. |
| U-1 | ✅ done | OAM spec re-vendored (snapshot endpoints) + `src/api/gen/oam.ts` regenerated. Gateway spec deliberately NOT re-vendored (upstream branch moved 16+ commits and removed `/config/synflood/*` — the live testbed gateway 404s it; UI compat sweep for that bump is a separate task, note in `api-spec/SOURCES.json`). |
| U-2 | ✅ done | `src/connector/oam/snapshotApi.ts` (+ `PATCH_OAM` fetcher, `src/types/snapshot.ts`, `src/hooks/query/snapshotHooks.ts`). Key contract encoded + unit-tested: OAM answers 200 with `gateway_status`/`gateway_response` even when the gateway restore failed — the wizard renders the outcome body, never the OAM code. 8 connector tests (`snapshotApi.test.ts`). Download uses `DOWNLOAD_FILE_STREAM` (throws with the server body — honest failures). |
| U-3 | ✅ done | Route `/instance/*/maintenance/snapshots`, `Maintenance` MENU_LIST group, `SnapshotPage` + `SnapshotTable` (new shared `chip` DataTable cell type). Live-verified. |
| U-4 | ✅ done | Take / Pre-Upgrade (auto-pin + rename to the REAL `gateway_version` from the take response via the pin PATCH) / Upload / Pin / typed-confirm Delete (pinned rows blocked until unpin) / streaming Download. All live-verified on the testbed incl. verbatim 502 with the gateway stopped. |
| U-5 | ✅ done | `RestoreWizard` + pure `wizardLogic.ts` (unit-tested: dry-run gating, 3 result branches, unknown-result ⇒ never success). Full commit loop live-verified: LB captured → deleted → dry-run plan (`loadbalancer to_apply 1`) → typed confirm → commit ok → `pre_restore` row → LB back on the gateway. Tampered doc blocked at dry-run with the gateway checksum error verbatim. |
| U-6 | ✅ done | Schedule dialog (bounds 1–168 h / 1–100 validated) + strip; live-verified incl. scheduler fire + keep-N retention trim observed. |
| U-7 | ✅ done | 86 keys added to en/ko/ja (append-only diff); chips carry text labels, wizard is `role="dialog"` + `aria-labelledby`, typed-confirm inputs labeled. |
| §9.3 | ✅ done | `e2e/tests/snapshot/snapshots.spec.ts` — 10 admin cases + viewer case, **13/13 green ×2 consecutive** vs the live testbed. Includes the two post-review adversarial cases (9: stale-row 404 stays inline; 10: double-click = one commit). Snapshot helpers + prefix-aware sweep in `e2e/helpers/api.ts`. |
| §9.4 | ✅ done ×2 | Full upgrade runbook UI-only, twice: Pre-Upgrade (pin) → `docker rm -f` + host `snapshot.json` wiped (upgrade-loses-local-state scenario) → fresh empty gateway → UI dry-run → typed-confirm commit → **ok** → LB restored with endpoint health `active`. Testbed left clean (0 lb / 0 snapshots / schedule off). |

**Adversarial-round findings (all FIXED + regression-covered)**:
1. *Wizard stuck forever on network death* — `fetch` rejections (OAM host truly
   unreachable) propagated uncaught, freezing the non-dismissable "committing"
   screen. Fix: every `snapshotApi` mutation catches and returns an honest
   error result (unit + spec case 3).
2. *Stale-row action ejected the user to the global /404-/500 pages* — the
   fetcher's app-wide redirect fired for OAM snapshot endpoints; snapshots are
   user-deletable rows, so per-row 404/5xx must surface inline. Fix:
   `isInlineErrorEndpoint` carve-out in `fetcher_base.ts` (spec case 9).
3. *"Restore Now" double-click double-committed* (2 restores + duplicate
   pre_restore snapshots) — both clicks ran before React re-rendered the step.
   Fix: ref guard in `RestoreWizard.handleCommit` (spec case 10).
4. Row-mapping (chip labels, Corrupt only on explicit `checksum_ok=false`,
   verbatim unknown trigger types) now unit-tested (`SnapshotTable.test.ts`).

**§9.3 case-4 correction (learned live)**: OAM's upload checks only the
envelope and *cannot* recompute the gateway's canonical-JSON checksum
(`snapshot_service.go`), so a content-tampered file is ACCEPTED at upload;
the protection fires at restore dry-run (gateway VALIDATE, verbatim checksum
mismatch, Commit disabled). The spec asserts that actual contract.

**⚠ Testbed incident 2026-07-20**: `docker stop loxilb` during the §9.2
gateway-down test took the whole kv-loxilb VM off the network (XDP/eBPF
datapath left attached with no daemon — 100% packet loss incl. SSH/ICMP on
both NICs). Requires a cloud-console reboot; afterwards the gateway
boot-restores from its host-volume `snapshot.json`. Do NOT plain-`docker
stop` the gateway on this testbed — use the OAM-side abort or an
unreachable-host instance fixture to simulate outages.

**Scope**: loxilb-ui (this repo). Phase 3 of the snapshot feature.
**Master docs** (read first):
`loxilb-inference-gateway/docs/SNAPSHOT-DESIGN.md` (document format, restore engine),
`oam-loxilb/docs/SNAPSHOT_ORCHESTRATION_DESIGN.md` (the API this UI consumes, §3/§8).
**Author**: 2026-07-20

---

## 1. Purpose

Replace the current **Config Management** page — which exports OAM's own
database (users/settings/instance records) while presenting itself as loxilb
config backup — with an **instance-scoped Snapshots page** built on the new
OAM snapshot orchestration API. The page serves the operator upgrade runbook
(OAM doc §4): take → pin → upgrade → dry-run → commit → verify.

Design rules carried over from the rest of the app:

1. **The gateway/OAM response is the truth** — render server results verbatim,
   never invent client-side success (lesson from the download-404 saga).
2. Reads throw through `assertOk` so tables show the *"Couldn't load … (Retry)"*
   banner, never a false "No rows" (F-UX-3, `src/connector/fetcher/fetcher_base.ts:72`).
3. Destructive actions use the shared named-confirm dialog (F-UX-2).
4. All wire types are generated from the OAM swagger (`OamGetResp<...>`), no
   hand-rolled shapes (lesson from `ConfigFileInfo` drift, `src/types/config.ts:52-55`).

---

## 2. What is removed (U-0)

The legacy page is misleading (it never touched loxilb config) and its backend
is being deleted (OAM doc §1.1, task O-6). Full removal inventory:

| Artifact | Location |
|---|---|
| Route + admin guard + import | `src/App.tsx:70,136-139` |
| Header icon button "Config Management" | `src/components/layout/Header.tsx:49-56` |
| Page (Export / Import / File Management tabs) | `src/pages/ConfigManagementPage.tsx` |
| Form components | `src/components/input/ConfigExportForm.tsx`, `src/components/input/ConfigFileUploader.tsx` |
| Connector | `src/connector/oam/configApi.ts` |
| Types (legacy half) | `src/types/config.ts` (delete; UI-state types below replace it) |
| Locale keys | `src/locales/*` (config-management strings) |
| Vendored OAM spec paths `/oam/config/*` | `src/api` vendored spec (CI validates it — same class of break as 012b04a; regen, don't hand-edit) |
| E2E spec coverage of the old page | `e2e/` (replace with the new spec, §9) |

U-0 ships **immediately** (P0, pre-release): the old page must not appear in a
public release. The replacement page lands later without a gap in truthfulness —
between U-0 and U-6 there is simply no config page, which is honest.

---

## 3. Information architecture

Snapshots are **per-instance** (API: `/oam/instances/:id/snapshots`), so the
page lives under the instance nav, not as a global admin page:

- **Route**: `/instance/*/maintenance/snapshots` — registered in `src/App.tsx`
  inside the `NavLayout` route (sibling of `traffic`, `status`, …), resolving
  the instance via the existing `useInstanceFromURL` pattern.
- **Menu**: new `MENU_LIST` group in `src/types/menu.ts`:
  `{name: 'Maintenance', icon: SettingsBackupRestoreIcon, path: 'maintenance',
  items: [{name: 'Snapshots', path: 'snapshots'}]}` — room for future items
  (upgrade assistant, log bundles).
- **RBAC**: page renders for any authenticated user; every mutating control
  (Take, Restore, Upload, Pin, Delete, Schedule) is gated by the existing
  `useRole` capability check (same pattern `DataTable` already uses). Download
  is also gated (OAM requires `ActConfigWrite` for it — snapshots contain
  IPsec secrets).

---

## 4. Page layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Snapshots — <instance-name>                                          │
│ [Take Snapshot] [Pre-Upgrade Snapshot] [Upload] [Schedule ⚙] [Refresh]│
│ ┌─ Schedule strip (only when enabled) ─────────────────────────────┐ │
│ │ ⏱ Every 24h · keep 10 · last run 2026-07-20 03:00 OK             │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ ┌─ DataTable ──────────────────────────────────────────────────────┐ │
│ │ Name | Trigger | GW ver | Size | Created by/at | 📌 | Last restore │ │
│ │ pre-upgrade-v0.9.7 [pre_upgrade] 0.9.7 214 KB admin 07-20 📌  ok  │ │
│ │  ⋮ row actions: [Restore…] [Download] [Pin/Unpin] [Delete]       │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Details:

- **DataTable** (shared component): columns `name` (+ description tooltip),
  `trigger_type` as a colored `Chip` (`manual` default / `scheduled` info /
  `pre_upgrade` warning / `pre_restore` secondary), `gateway_version`,
  `size` (humanized via the shared formatter), `created_by` / `created_at`
  (locale string), pinned icon, `last_restore_result` chip
  (`ok` success / `rolled_back` warning / `rollback_failed` **error**).
  A snapshot whose integrity sweep flagged `checksum_ok=false` renders a red
  "Corrupt" chip and disables Restore/Download.
- **Pre-Upgrade Snapshot** button = Take with `trigger_type='pre_upgrade'`,
  name pre-filled `pre-upgrade-<gateway_version>`, and **auto-pin** — one
  click for runbook step 1+2.
- Empty state: explanatory text + a prominent Take Snapshot button, not a bare
  "No rows".
- Load failure: F-UX-3 error banner with Retry (reads go through `assertOk`).

---

## 5. Flows

### 5.1 Take / Upload

- **Take**: dialog (name — required, ≤128 chars; description — optional) →
  `POST /oam/instances/:id/snapshots` → on success, global `usePopUp` Success
  + list refetch. On failure, `ErrorPopUp` with the OAM/gateway error verbatim
  (`createDetailedErrorMessage` pattern).
- **Upload**: file picker (.json, client-side 16 MB cap mirroring the server's
  413) → `POST /oam/instances/:id/snapshots/upload` → same result handling.
  No client-side parsing of the document — the envelope check is OAM's job.

### 5.2 Restore wizard (the critical flow)

Two-step modal, mirroring the API's dry-run-first contract:

```
[Restore…] ──▶ Step 1: DRY-RUN (automatic on open)
               POST /oam/snapshots/:sid/restore {mode:"dry-run"}
               ┌────────────────────────────────────────────────┐
               │ Compatibility: schema 1.0 ✓ · snapshot GW 0.9.7 │
               │  → target GW 0.9.8 (note) · cross-instance ⚠?   │
               │ Plan table: domain | to_delete | to_apply       │
               │ Errors (if any) — Commit disabled               │
               └────────────────────────────────────────────────┘
               [Cancel]                [Continue to Restore ▸]
           ──▶ Step 2: COMMIT confirmation
               "This wipes the live configuration of <instance>
                and applies snapshot '<name>'. A pre-restore
                snapshot is taken automatically."
               Type the instance name to enable: [__________]
               [Cancel]                [Restore Now]
           ──▶ Result screen (rendered from the commit response, verbatim):
               result: ok → Success summary + per-domain applied counts
               result: rolled-back → WARNING panel: restore failed and was
                       rolled back; original config is intact; error list
               result: ROLLBACK-FAILED → ERROR panel (red, no soft-pedaling):
                       manual recovery required; show
                       pre_restore_snapshot_persisted path + gateway errors
```

- The wizard is a purpose-built modal (not the global `PopUp`) because of the
  multi-step content; it still mounts under `.MuiModal-root` so the E2E dialog
  helpers keep working.
- While commit is in flight: modal is non-dismissable, buttons disabled,
  `LinearProgress` shown (restores are seconds-scale; no polling needed —
  single awaited request).
- After any commit (ok or not): refetch the list (a `pre_restore` snapshot row
  appeared) and refetch instance status.

### 5.3 Delete / Pin / Download / Schedule

- **Delete**: shared named-confirm ("type the snapshot name") — pinned
  snapshots additionally require unpinning first (UI mirrors the API's
  `force` semantics rather than silently passing `force=true`).
- **Pin/Unpin**: `PATCH /oam/snapshots/:sid {pinned}` — optimistic toggle with
  rollback on error.
- **Download**: `DOWNLOAD_FILE_OAM` → blob save with `Content-Disposition`
  filename; failure shows the server error (no HTML-sniffing hacks — the new
  API returns proper JSON errors, and the blob path only ever streams a real
  file).
- **Schedule dialog**: enabled switch, interval (hours, 1–168), retain count
  (1–100); `PUT /oam/instances/:id/snapshot-schedule`; strip shows
  `last_run_at`/`last_run_result`.

---

## 6. Data layer

- **Connector**: `src/connector/oam/snapshotApi.ts` —
  `query_get_snapshots(instanceId, {limit, offset})`,
  `query_get_snapshot_schedule(instanceId)`,
  `request_take_snapshot`, `request_upload_snapshot`,
  `request_restore_snapshot(sid, mode)`, `request_patch_snapshot`,
  `request_delete_snapshot`, `request_download_snapshot`,
  `request_put_snapshot_schedule`.
  Reads call `assertOk`; mutations return `ApiResult` with
  `createDetailedErrorMessage` payloads — identical to every other connector.
- **Types**: regenerate `src/api` from the updated OAM swagger after O-3 lands;
  page/UI-only types (wizard step state, etc.) live in
  `src/types/snapshot.ts`. **No wire shapes are hand-written.**
- **react-query**: `useSnapshots(instanceId)` (key
  `['oam','snapshots',instanceId,page]`), `useSnapshotSchedule(instanceId)`;
  mutations invalidate both. No background polling — the list changes only
  through user actions and the scheduler (Refresh button covers the latter).

---

## 7. i18n & a11y

- Every string through `t()`; keys added to **all** locale files in the same
  change (the config-management page's late i18n retrofit is the cautionary
  tale).
- Wizard steps are `role="dialog"` with `aria-labelledby`; the typed-confirm
  input is labeled; chips carry text, never color alone (`rollback_failed`
  reads "Rollback failed", not just red).

---

## 8. Implementation plan

| ID | Task | Files | Size | Depends on |
|----|------|-------|------|-----------|
| U-0 | **Remove legacy page** (full inventory §2) + regen vendored OAM spec | see §2 | M | none — **ship now (P0)** |
| U-1 | Regen `src/api` types from new OAM swagger | `src/api` | S | OAM O-3 |
| U-2 | `snapshotApi.ts` connector + query hooks | `src/connector/oam/`, `src/hooks/query/` | M | U-1 |
| U-3 | Route + Maintenance menu group + page skeleton with DataTable list | `src/App.tsx`, `src/types/menu.ts`, `src/pages/maintenance/SnapshotPage.tsx` | M | U-2 |
| U-4 | Take / Pre-Upgrade / Upload / Pin / Delete / Download actions | page + dialogs | M | U-3 |
| U-5 | Restore wizard (§5.2) + result rendering | `src/components/snapshot/RestoreWizard.tsx` | L | U-3 |
| U-6 | Schedule dialog + strip | page | S | U-3 |
| U-7 | i18n sweep (all locales) + a11y pass | `src/locales/*` | S | U-4..U-6 |

Sequencing: **U-0 now**; U-1…U-7 start once OAM O-3 is deployed on the testbed
(build against the live API, not mocks — matches how every other page here was
validated).

---

## 9. Test plan

Three tiers, in order. All E2E tiers run against the **practical remote
testbed** (local UI dev server → testbed OAM → live testbed gateway — the
same environment and workflow as every prior E2E campaign; host/credential
specifics live in `.env.e2e.local` and the internal runbook, never in this
doc). Nothing ships validated against mocks.

### 9.1 Unit (Vitest)

Connector error paths (assertOk throw on 500/502), wizard state machine
(dry-run errors disable Commit; typed-confirm gating; the three result
branches), schedule form validation bounds.

### 9.2 Interactive adversarial pass (playwright-mcp) — during development

Per the project's E2E philosophy (`docs/E2E_TEST_PLAN.md`): the goal is to
**find bugs and root-cause them**, not to certify a happy path. Each U-task's
implementation ends with a driven playwright-mcp session against the testbed
that inspects actual component state, not just outcomes:

- **Component-level checks** on every screen state: chip colors/labels per
  `trigger_type` and `last_restore_result`, disabled-state correctness
  (Restore/Download on a `checksum_ok=false` row, Commit before typed-confirm
  matches, mutating controls under a read-only role), tooltip content, dialog
  ARIA roles/labels, focus trap in the wizard, table behavior with 0 / 1 /
  paginated-many rows and with long names (wordBreak).
- **Console + network audit on every action**: zero uncaught console errors;
  every failed request must surface in the UI (no swallowed 4xx/5xx — the
  legacy page's silent `console.error` fetch failures are the anti-pattern,
  `ConfigManagementPage.tsx:104-105`).
- **Break-it scenarios driven live**: stop OAM mid-wizard; stop the gateway
  and attempt Take (expect the 502 passthrough verbatim); double-click Take
  rapidly (no duplicate rows); navigate away during commit and back (state
  consistent after refetch); expired/deleted snapshot row acted on after
  another session removed it.
- Every finding gets an RCA and a fix before the task closes; findings that
  reveal generalizable failure modes are codified into 9.3.

### 9.3 Codified regression spec (Playwright) — `e2e/snapshots.spec.ts`

Runs against the same testbed via the existing runner (`docs/E2E_RUNNING.md`);
reuses the shared dialog helpers (`e2e/helpers/dialogs.ts`). Baseline cases —
extended by whatever 9.2 uncovers:

  1. Take → row appears with correct chips/metadata → Download → file
     checksum matches `X-Snapshot-Checksum`.
  2. Full restore wizard happy path: dry-run plan renders → typed confirm →
     commit ok → `pre_restore` row appeared.
  3. **Break it**: restore with OAM stopped mid-flight → wizard surfaces the
     error, no fake success; reload → list state consistent.
  4. Upload a corrupted file (bit-flipped) → server rejection rendered
     verbatim, no row created.
  5. Delete pinned snapshot → blocked until unpin; named-confirm mismatch
     keeps Delete disabled.
  6. Read-only role: all mutating controls absent/disabled; list still loads.
  7. Legacy check: `/config-management` returns the 404 page; no Header icon.
  8. Pre-Upgrade button: one click yields a pinned `pre_upgrade` row with the
     version-stamped name.

### 9.4 Full-stack sign-off

Before the feature is declared done: execute the operator upgrade runbook
(OAM doc §4) end-to-end **through the UI only** on the testbed — snapshot,
pin, real gateway container redeploy, dry-run review, typed-confirm commit,
traffic verification — with a playwright-mcp session capturing each step.
This is the acceptance test for the feature as a whole, across all three
repos.

### Acceptance criteria

- `/config-management` and every artifact in §2 are gone (grep-clean for
  `configApi|ConfigExportForm|ConfigFileUploader|config-management`).
- The page never reports success that the server didn't return; the three
  restore outcomes (`ok` / `rolled-back` / `ROLLBACK-FAILED`) each render
  distinctly and honestly.
- All reads show the F-UX-3 banner on failure; typecheck + unit + E2E green;
  every string localized in all locales.
- The interactive adversarial pass (9.2) ran on the remote testbed for every
  U-task with zero unresolved findings, and the full-stack UI-only upgrade
  runbook (9.4) completed successfully at least twice.
