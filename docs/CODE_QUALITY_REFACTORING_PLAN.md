# loxilb-ui — Code Quality Refactoring Plan (Open-Source Release Readiness)

**Status:** Approved direction (2026-07-17)
**Audience:** Internal UI/dev team
**Companion docs:** `INFERENCE_GATEWAY_REFACTORING_DESIGN.md`, `INFERENCE_GATEWAY_IMPLEMENTATION_PLAN.md`
**Basis:** three code audits (validation, logging/error-handling, structure/OSS readiness), 2026-07-17. All findings carry file:line evidence in the audit summaries embedded below.

---

## 1. Executive summary

The codebase works, but it is not releasable as professional open source today.
Audit headline numbers:

| Area | Finding |
|---|---|
| License | **No LICENSE file** — README §License falsely claims MIT and links a nonexistent file (legal blocker) |
| Secrets | `.env.development/.local/.production` **tracked in git** with internal host `oam-1.loxilb.io`; same host hardcoded in `nginx-simple.conf:30`, `nginx-https.conf:62` (history scrub required) |
| Logging | 84 raw `console.*`; **OAuth token + PII logged to console** (`OAuthCallbackPage.tsx:65,73`, `user.ts:14,16,56,58`, `fetcher_base.ts:125`); no logger, no levels |
| Error handling | GET connectors return `(resp.data as X) ?? {}` — **read failures rendered as empty success**; no React error boundary anywhere; fetch layer navigates via `window.location` on substring-matched server prose |
| Validation | Format validation is **display-only** — invalid IPs/ports still submit; react-hook-form used in 1 of ~35 forms; buggy inline CIDR regex accepts `999.999.999.999/99` (`IPFilterInputForm.tsx:41`); `isValidPort` accepts 0; `verify_params` is a `return true` stub |
| Types | 355 `any`, concentrated in the fetcher core and shared `TableBase` (typed `columns: any; rows: any`) |
| Duplication | `metrics.ts` re-declares 10 alert/backup/compression functions with **different URLs** than the dedicated connectors (latent wrong-endpoint bug); 40 of 42 table components + ~31 pages repeat one copy-pasted CRUD controller |
| Naming | ~532 snake_case symbols mixed with camelCase, both inside single files; misspelled `device_neghbors.ts` |
| Tests | **0 test files** |
| Tooling | No ESLint/Prettier config, no CI, no lint/test scripts, CRA (`react-scripts`, deprecated), both `react-query@3` (0 imports) and `@tanstack/react-query@5` in deps, `.npmrc` with `strict-ssl=false` |
| Repo | No CONTRIBUTING/SECURITY/CODE_OF_CONDUCT; `package.json` metadata invalid for OSS (`name: "LoxiLB"`, no license field, `homepage: ""`); AI-tooling dirs (`.claude/`, `.serena/`, `.codegraph/`, `claudedocs/`, per-dir `CLAUDE.md`) and internal docs in tree |

**Session decisions incorporated:**
- **OAuth is removed** (on-premise focus; local auth only). This also deletes the worst token-leak files outright.
- **Toolchain migrates CRA → Vite + Vitest** (CRA is EOL; needed for professional contributor experience).
- **Testing includes playwright-mcp agentic UI validation** alongside a deterministic Playwright CI gate.
- **Sequencing is coordinated with the gateway refactor** (companion plan): code that gateway-W4 deletes (storage-monitoring connectors, alert CRUD, backup/compression, dead pages) is *not* polished — it is deleted first. This resolves several audit findings (incl. the diverging-URL duplicate connectors) by deletion.

## 2. P0 — Release blockers (do immediately, independent of everything else)

| # | Task | Detail |
|---|---|---|
| P0-1 | **Add LICENSE** | Real MIT text (or chosen license — confirm with management); add `"license"` to package.json; fix README §License. Until then the repo grants no rights. |
| P0-2 | **Secrets/env purge + history scrub** | `git rm --cached .env.development .env.local .env.production`; keep only `.env.example` with placeholder values; fix `.gitignore` (CRA env lines are commented out). Parameterize `nginx-simple.conf`/`nginx-https.conf` to `${BACKEND_URL}` like the existing template. Because `oam-1.loxilb.io` is in git history, plan a **history rewrite (git filter-repo) before the public push**, or publish from a fresh, squashed public repo (recommended — simpler and guarantees clean history). |
| P0-3 | **Purge token/PII console logs** | Delete `OAuthCallbackPage.tsx:65,73` + OAuth flow logs (superseded by P0-5), `user.ts:14,16,56,58,107,130`, `oauth.ts:61`, `fetcher_base.ts:125`. Do not wait for the logger workstream. |
| P0-4 | **Strip internal artifacts from public tree** | `.claude/`, `.serena/`, `.codegraph/`, `claudedocs/`, `claude-agents/`, per-dir `CLAUDE.md`, `docs/license-management/`, internal roadmap docs, `docker-compose.commercial.yml`, `deploy.ps1`/`make-package.ps1` (move to internal repo or `.github`-excluded packaging repo). Decide doc-by-doc for `docs/` (the two gateway docs + this one can ship once scrubbed of internal hosts). Remove `.npmrc` insecure flags (`strict-ssl=false`, `audit=false`, `force=true`). |
| P0-5 | **Remove OAuth** | Delete `src/pages/OAuthCallbackPage.tsx`, `src/connector/oauth.ts`, `/oauth/callback` route in `App.tsx`, OAuth UI on `LoginPage`, oauth fields from UI `IUser` usage, related i18n keys. Keep `LoginPage` calling a single auth connector (clean seam for future OIDC). OAM's `/oauth/*` endpoints become unreferenced (backend may keep or drop). |
| P0-6 | **package.json metadata** | `name: "loxilb-ui"`, real `version` (align with README badge), `license`, `repository`, `description`, `keywords`, `author`. Add CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md. |

**Estimate:** 3–4 dev-days total (excluding the license/legal decision itself).

## 3. Workstream Q1 — Toolchain & enforcement (the foundation; do before code refactors)

Nothing else sticks without enforcement. Order matters: tooling first, so every
subsequent workstream lands pre-checked.

1. **Vite + Vitest migration** (replaces deprecated CRA/react-scripts). React 18 +
   TS is a near-drop-in: `vite.config.ts` with `@vitejs/plugin-react`, env vars
   `REACT_APP_*` → `VITE_*` (touchpoints: `fetcher_oam.ts`, `common.ts`,
   `App.tsx` basename), `index.html` move, `tsconfig` update. Also upgrade
   TypeScript 4.9 → 5.x. (~3–4 days incl. verification of all pages.)
2. **ESLint (flat config) + Prettier** with: `@typescript-eslint` recommended-type-checked,
   `react-hooks`, `no-console: error` (allow `logger` only), naming-convention rule
   (camelCase; see Q5-4 migration note), `import/order`. Prettier for format.
   Initial run in **warning mode** with a baseline; ratchet to error per-rule as
   workstreams land.
3. **tsconfig**: re-enable `noUnusedLocals`/`noUnusedParameters` (currently
   commented out at `tsconfig.json:20-21`).
4. **CI (GitHub Actions)**: PR workflow = typecheck + lint + unit tests + build;
   nightly/main workflow additionally runs the Playwright e2e job (Q6). Add a
   `test`, `lint`, `format` script trio to package.json.
5. **Dependency cleanup**: remove `react-query@3` (0 imports), audit/remove
   `archiver`, `glob` (runtime deps that are build tooling), evaluate `ogl`
   (only used by topology backdrop) and plan Recoil → keep for now (Q5 decides).

**Estimate:** ~1.5 dev-weeks.

## 4. Workstream Q2 — Logging & error handling

Target architecture (grounded in existing deps — React Query v5, Recoil, MUI):

1. **`src/utils/logger.ts`** — `logger.debug/info/warn/error`, level-gated
   (`import.meta.env.PROD` → warn+ only), with a serialization redaction list
   (`token`, `access_token`, `password`, `email`, `username`). Replace all 84
   `console.*`; **delete** (not downgrade) the ~42 debug leftovers (emoji traces
   in `Mirror*InputForm.tsx`, payload dumps in `nTopHooks.ts`, etc.).
   ESLint `no-console` then locks it in.
2. **Unify the API contract on `ApiResult<T>`** (the good pattern the mutation
   connectors already use): GET wrappers return
   `{status: 'success'|'error', data?, error?}` — **eliminate every
   `(resp.data as X) ?? {}` / `?? []` fallback** (`oam/alerts.ts:15,31`,
   `oam/oam.ts:27,113,203`, + instance connectors) so React Query `isError`
   actually fires. One error-envelope parser; delete the three divergent ones
   (`createDetailedErrorMessage`, `user.ts:23-27`, `alerts.ts:36`). User-visible
   message = clean `message` only; diagnostic detail goes to `logger.error`.
3. **React Query v5 global handlers**: `QueryCache({onError})` +
   `MutationCache({onError})` on the `QueryClient` (`App.tsx:82`) routing to one
   notification surface. Removes the per-call-site popup boilerplate and the
   silent-failure class. Migrate the hand-rolled `useEffect`+fetch loaders
   (`DashboardPage`, `AdvancedMetricsPage`, `ConfigManagementPage`) to `useQuery`.
4. **Error boundaries**: root boundary + per-route boundary inside the layout
   route (`react-error-boundary`, MUI fallback with reset). **Remove
   `window.location` navigation from the fetch layer** (`move_402/404/500/503`,
   substring match on `'not running'` at `fetcher_base.ts:129-134`) — map HTTP
   status → typed error; boundaries/handlers decide UX. Background poll failures
   must never navigate the app.
5. **Notification surface**: toast (MUI Snackbar wrapper or notistack) for
   transient errors; reserve the Recoil popup for confirmations. Replace
   `alert()` in `ConfigFileUploader.tsx:54,60` with the component's existing
   inline validation state.
6. **Async hygiene**: `.catch` on the bootstrap restore promise (`App.tsx:93` —
   currently a permanent-blank-screen risk), typed result for `DOWNLOAD_FILE`
   (returns `undefined` on error today), fix empty `catch {}` blocks
   (`ManualAlertForm.tsx:70,88`, `localStorageHook.ts:35,51`).

**Estimate:** ~2 dev-weeks. **Sequencing note:** do 2–3 *after* gateway-W4
deletes the storage connectors (don't refactor `advancedMetrics.ts`/`alerts.ts` —
they're being deleted).

## 5. Workstream Q3 — Validation

Target: schema-driven validation where invalid input **cannot** submit.

1. **Add `zod` + `@hookform/resolvers`** (react-hook-form@7 already installed).
   Standard form pattern: `useForm({resolver: zodResolver(schema)})`; submit is
   blocked on schema errors by construction.
2. **`src/validation/` module** with network primitives as zod schemas +
   plain predicates: `ipv4`, `ipv6`, `ipAddress`, `cidr`, `mac`,
   `port` (`int().min(1).max(65535)` — fixes the port-0 bug centrally),
   `portRange` (min ≤ max), `vlanId` (1–4094), `asNumber` (0–4294967295).
   Migrate the correct validators out of `common.ts:511-564`; delete the
   duplicated/buggy inline regexes (`IPFilterInputForm.tsx:41` — accepts
   `999.999.999.999/99`; `MACAddressBox.tsx:10`). Delete the `verify_params`
   no-op stub (`common.ts:602`). **These primitives are the first unit tests
   of the new suite** (Q6).
3. **Immediate bug fixes** (before the full migration): make `isValid`/`enableYes`
   gates include format (today: `IPAddressBox`/`PortBox` intentionally propagate
   invalid values and pages gate on presence only — `BGPNeighborPage.tsx:47`,
   `LBInputForm.tsx:64-77`, `EndpointInputForm.tsx:42-70`); `isValidPort` port-0;
   remove the `isEdit ? 'string' : 'ipaddress'` validation-off-on-edit downgrade
   (`BasicSettingsForm.tsx:65,70-71`); wire the port-range check into submit.
4. **Form migration order** (highest-risk first): LB rule → BGP (neighbor/policy)
   → firewall/ipfilter → IP/VLAN/VXLAN/FDB/route → the rest. ~35 forms; the
   shared `useFormWithParams`/`ParamBox` plumbing is replaced by the RHF+zod
   pattern with a thin field-component layer (keep the `*Box` visual components,
   drive them from RHF `Controller`).
5. **Dynamic instead of static**: derive enums (protocols, selectors, severities)
   from the `useMetadata`/swagger data already fetched instead of hardcoded
   lists and `assets/json/protocols.json`; route every validation message
   through `t()` (en/ko/ja files exist; `inputFormHook.ts:18-30`,
   `InstanceBaseFormDialog.tsx:40-44` are raw English today).

**Estimate:** ~2.5–3 dev-weeks (item 3 is ~2 days and ships first).
Gateway-Phase-2 LB inference fields (P/D, CHWBL) are specified with zod schemas
from day one.

## 6. Workstream Q4 — Structure, typing, naming

1. **Deletion first** (coordinated with gateway-W4; some already listed there):
   dead pages (`DashboardPage_orig.tsx`, `HomePage.tsx`, `TelecomPage.tsx`),
   `src/examples/`, dead cards (`CurrentRateCard`, `PacketCard`, `card/copy`),
   dead hook `advancedMetricsHook.ts` (singular), and the entire
   `metrics.ts:236-442` duplicate block (10 functions whose URLs diverge from
   `alerts.ts`/`backup.ts`/`compression.ts` — a latent wrong-endpoint bug that
   deletion resolves).
2. **Type the boundaries**: `fetcher_base.ts` generics (`GET<T>(...): Promise<ApiResult<T>>`),
   `TableBase.tsx` (`columns: any; rows: any` → generic `<Row>`), then the
   connector layer. Target: 355 `any` → <50, enforced by
   `@typescript-eslint/no-explicit-any` ratchet (warn → error per directory).
3. **Extract the CRUD-page controller**: one `useCrudTable<T>` hook +
   generic `<CrudTablePage>` composition (selection state, add/edit/delete
   popups, refresh, hash-based sort — the pattern currently copy-pasted across
   ~31 pages and 40 of 42 table components). Pilot on 2 pages (VLAN, FDB),
   then mechanical rollout. This is the single biggest LOC reduction
   (~40–60% of page/table code) and makes every future page cheap.
4. **Naming convention**: camelCase for TS symbols going forward, enforced by
   ESLint naming-convention on **new/modified code only**; bulk-rename the
   ~532 snake_case symbols mechanically per-directory as files are touched by
   other workstreams (avoid one big-bang rename commit; exception: API-mirroring
   type fields stay snake_case to match backend JSON). Fix
   `device_neghbors.ts` → `deviceNeighbors.ts`.
5. **Split oversized files** (11 files >400 lines) as they are touched:
   `UserManagementPage.tsx` (722), topology cards (705 + 496 — near-duplicates,
   merge into one), `PerformanceRankingCard` (633), etc. Rule of thumb: pages
   compose, components render, hooks fetch.
6. **Folder coherence**: `connector/` (typed API), `hooks/` (React Query wrappers,
   one file per domain), `validation/`, `utils/`. Collapse `hooks/` vs
   `hooks/query/` split.

**Estimate:** ~3 dev-weeks spread across the cycle (items 3 and 2 dominate).

## 7. Workstream Q5 — Testing & agentic UI validation

From 0 tests to an enforced pyramid. Tests are written **as each area is
refactored** — never for code scheduled for deletion.

1. **Unit (Vitest)**: `src/validation/` primitives (first tests in the repo),
   logger redaction, `fetcher` envelope/error mapping, `promMetrics` mapping
   table (from the gateway plan), pure utils in `common.ts`.
2. **API-layer tests (Vitest + MSW)**: connector `ApiResult` behavior on 200/4xx/
   5xx/network-error/malformed-JSON; kills the silent-`?? {}` bug class
   permanently.
3. **Hook tests** (`@testing-library/react` + MSW): key React Query hooks incl.
   new `usePromRangeQuery`/`usePromAlerts`.
4. **Component tests**: the shared primitives — `CrudTablePage`, form field
   components, `PromRangeChart` empty/error/data states.
5. **E2E — deterministic CI gate (`@playwright/test`)**: against the
   docker-compose dev stack (gateway + Prometheus + OAM + UI). Smoke: login →
   every route renders without console errors → one CRUD round-trip per domain
   (LB rule, VLAN, firewall) → dashboard shows Prometheus-backed data.
   Merge-blocking on main.
6. **Agentic validation (microsoft/playwright-mcp)** — two uses:
   - **Dev-time:** `.mcp.json` in-repo configures `npx @playwright/mcp@latest`;
     Claude Code drives the running UI to verify changes, reproduce UI bugs, and
     **author/maintain the deterministic Playwright specs** (how we scale from
     0 tests realistically).
   - **CI (non-blocking):** scheduled / PR-labeled workflow boots the compose
     stack and runs the agent headless against a versioned checklist prompt
     (`e2e/agentic-checklist.md`): visit every route; assert **zero console
     output** (locks in the logger cleanup); flag broken layouts, untranslated
     strings, unexplained empty states, validation fields that accept garbage.
     Findings posted as a PR comment.
7. **Coverage ratchet**: start with thresholds at measured baseline after Q3
   lands (~expect 25–30%), raise in CI config each release; new `src/validation`
   and `src/connector` code held to 80%+.

**Deliverables:** `vitest.config.ts`, `playwright.config.ts`, `.mcp.json`,
`e2e/` suite + agentic checklist, MSW handlers under `src/test/msw/`,
2 GitHub Actions workflows.
**Estimate:** ~2 dev-weeks initial infrastructure + ongoing per-workstream tests.

## 8. Sequencing (coordinated with the gateway integration plan)

```
Week 0      P0 release blockers (license, secrets, PII logs, OAuth removal, metadata)
Weeks 1–2   Q1 toolchain (Vite/Vitest, ESLint/Prettier, CI)  ──┐ parallel with
            Gateway W1 compatibility pass + W4 deletions      ──┘ (deletions first!)
Weeks 2–4   Q2 logging/error handling  +  Q3 item-3 validation bug fixes
            Gateway W2 Prometheus datasource (OAM + UI)
Weeks 4–7   Q3 zod form migration  +  Q4 structure (CrudTable extraction, typing)
            Gateway W3 view rebinds/rebuilds (built on new patterns, not old)
Weeks 5–8   Q5 test pyramid fills in behind each workstream; e2e gate turns on
Week 8+     Public-release checklist review; fresh-repo publish (P0-2 strategy)
```

Two hard ordering rules:
1. **Delete before polishing** — gateway-W4 removals and Q4-1 dead-code deletion
   run before any refactor touches those areas.
2. **New patterns before mass migration** — logger, `ApiResult`, zod pattern,
   `CrudTablePage` are each proven on 1–2 pilot files, reviewed, then rolled out
   mechanically (good candidates for agent-assisted bulk migration with the
   deterministic tests as the safety net).

**Total added effort over the gateway plan:** ≈ 8–10 dev-weeks single dev;
≈ 5–6 weeks with two devs (high parallelism between Q-workstreams and gateway
workstreams).

## 9. Definition of done (public-release quality gate)

- [ ] LICENSE present and consistent (repo, package.json, README)
- [ ] Fresh public repo (or scrubbed history); no internal hosts/secrets anywhere incl. nginx configs; `.env.example` only
- [ ] No OAuth code; local auth documented
- [ ] CI green: typecheck, ESLint (`no-console`, `no-explicit-any` ≤ agreed baseline), Prettier, unit+MSW tests, Playwright smoke
- [ ] Zero `console.*` in `src` (logger only); zero browser-console output in e2e run
- [ ] All forms schema-validated; invalid input cannot reach the API (e2e-verified with garbage-input tests)
- [ ] No `(resp.data as X) ?? {}` pattern; every query surfaces errors; error boundaries in place
- [ ] No dead files/deps (`react-query@3` gone); no duplicate connector functions
- [ ] README rewritten for OSS (quickstart with docker-compose, screenshots, architecture diagram, contribution guide links)
- [ ] CONTRIBUTING, SECURITY, CODE_OF_CONDUCT present
