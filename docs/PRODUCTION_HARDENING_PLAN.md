# loxilb-ui — Production Hardening Plan

**Status:** Approved direction (2026-07-17)
**Companion docs:** `CODE_QUALITY_REFACTORING_PLAN.md`, `INFERENCE_GATEWAY_IMPLEMENTATION_PLAN.md`, `INFERENCE_GATEWAY_REFACTORING_DESIGN.md`
**Basis:** post-refactor product review + full end-to-end validation on the Naver Cloud testbed (OAM + inference-gateway 0.9.8.6-beta), 2026-07-17.

---

## 1. Where we are (entry state for the next session — updated 2026-07-17 evening)

Done on `feat/inference-gateway-integration` through commit `56ddf12`:
- **P0 blockers, W4 API-sync, testbed e2e** (see git history / memory).
- **H1 swagger codegen** (`88ac1e4`) — specs vendored, types generated, every connector GET typed; wrong path literal = compile error.
- **H4 mapping guard** (`006d937`) — `npm run api:check-mapping` over all 119 connector calls; gateway spec audited against handler wiring (15 ops tagged `x-not-implemented`); gateway swagger fixed for `/logs` pagination + `cursor`/`file` params.
- **Tests + CI** (`5aa4902`, pulled forward from H7) — Vitest (74 tests incl. backend-contract suite), `.github/workflows/ci.yml`, `npm run sync:specs` + `api-spec/SOURCES.json` version pinning.
- Developer guide for all of the above: **`docs/API_TOOLING.md`**. UI gap analysis: **`docs/API_COVERAGE_REPORT.md`**.

⚠️ Sibling repos hold uncommitted changes from this work (commit them there): `loxilb-inference-gateway/api/swagger.yml` (Logs fields, /logs params, x-not-implemented/x-raw-middleware tags), `oam-loxilb/docs/*` (regenerated swagger incl. `/oam/setup/*`).

**Facts the remaining plan relies on:**
- `/meta`-driven forms: 19 of 31 input components use `useFormWithParams` (runtime field discovery). 9 more have hand-rolled `validateForm` — **two parallel validation systems**.
- Remaining correctness smells: silent-failure `?? []`/`?? {}` reads still mask errors-vs-empty (H3), ~48 raw `console.*`, 17 copy-pasted table CRUD controllers, 0 error boundaries. `any` in `src/connector` is down to generic defaults + POST bodies (typed further in H2).

---

## 2. The architectural decision: `/meta` vs swagger (RESOLVED)

**Decision: swagger becomes the single source of truth for types; `/meta` is phased out (not ripped out).**

Rationale:
- `/meta` only exposes `type` / `required` / `enum`. It **structurally cannot** express IP/CIDR validity, port ranges, string formats, or cross-field rules — the exact bug class the audits found. So `/meta` alone can never reach production-grade validation.
- Swagger strictly dominates `/meta` on schema richness (`format`, `pattern`, `min/max`) **and** yields compile-time types.
- The only thing `/meta` offers that swagger doesn't is per-deployment field discovery — unnecessary for a versioned product shipped against a known gateway version.

**Sequencing rule (delete-before-polish, applied):** do NOT delete `/meta` until a swagger-generated form-metadata replacement is proven. `/meta` currently drives 19 working forms; removing it first would regress them.

---

## 3. Workstreams (ordered; 1–4 are the production-quality core, mostly non-breaking)

### H1 — Swagger codegen for types  *(foundation — do first)*  ✅ DONE (2026-07-17)
- **Landed:** specs vendored to `api-spec/` (gateway `swagger.yml` + `swagger-extras.yml` from the loxilb-inference-gateway repo, OAM from `oam-loxilb/docs/swagger.json` via `swag init`); `npm run gen:api` (swagger2openapi → openapi-typescript) emits `src/api/gen/*`; `src/api/index.ts` exposes `GwSchema/GwGetResp/GwPostBody/Oam*` helpers; fetchers are generic (`SimpleResponse<T>`, `GET_INST<T>`, …); every GET in `src/connector/instance/*` + `src/connector/oam/*` + `user.ts` is typed against the spec (a wrong path literal is now a compile error). `npm run gen:api:check` fails on drift (wire into CI in H7). Stale root spec copies deleted.
- **Spec gaps found (fix upstream):** gateway `/logs` returns `next_cursor`/`has_more`/`log_count` but the `Logs` model doesn't declare them (typed locally in `status.ts` with a SPEC GAP comment); the BGP defined-sets "all" listing rides `/config/bgp/policy/definedsets/{defineset_type}/{type_name}` with `type_name=all` (no dedicated route); defined-set entries carry no `definedType` on the wire — the UI tags it client-side (was silently `undefined` before typing).
- Add `openapi-typescript` (types-only, lightest) or `orval` (types + typed React-Query client) against `swagger.yml` (gateway) + the OAM spec.
- Wire a `gen:api` npm script; commit generated output; add a CI check that regen produces no diff (drift = build failure).
- Replace `any` at the connector boundary with generated request/response types. Target: collapse the **273 `any`** substantially (start with `src/connector/**` and `src/types/metrics.ts`).
- **Non-breaking**; unblocks everything below.
- DoD: `src/connector/instance/*` and `src/connector/oam/*` import generated types; no `(resp.data as SomeHandType)` casts in those files.

### H2 — zod validation layer  *(where correctness actually lives)*
- `src/validation/` network primitives: `ipv4`, `ipv6`, `cidr`, `port` (reject 0 and >65535), `macAddress`, `hostname`. Fix the known-buggy checks (CIDR accepting `999.999.999.999/99`, `isValidPort` accepting 0).
- Pilot on one high-traffic form (LB rule or IP filter) with `@hookform/resolvers`, then roll out.
- Consolidate the **two validation systems**: hand-rolled `validateForm` in 9 components → zod schemas; keep `useFormWithParams` for field *shape* only, delegate *validity* to zod.
- DoD: submitting an invalid IP/port is blocked at the form (not just styled red); one form fully migrated as the reference pattern.

### H3 — Error-handling hardening  *(no more silent failures / blank screens)*
- Replace the **28** `(resp.data as X) ?? {}` sites with an `ApiResult`-style unwrap that distinguishes error from empty (a failed GET must surface an error, not an empty table).
- React Query global `onError` (central logger, not `window.location`).
- Top-level + per-route error boundary (currently **zero**).
- Central logger to absorb the remaining **48** `console.*`.
- DoD: a forced 500 on a list endpoint shows an error state, not an empty table; a thrown render shows a boundary fallback, not a blank page.

### H4 — Mapping-correctness CI guard  *(make the win permanent)*  ✅ DONE (2026-07-17)
- **Landed:** `npm run api:check-mapping` (scripts/check-api-mapping.mjs) statically extracts all 119 connector calls and fails on any path/method not in the vendored specs; ops tagged `x-not-implemented` in the gateway spec count as non-existent (guards the 501-endpoint regression class). `npm run api:coverage` lists spec ops without UI. Wired into `.github/workflows/ci.yml` together with typecheck, `gen:api:check`, vitest (incl. `src/api/contract.test.ts` backward-compat guard), and the production build. `npm run sync:specs` + `api-spec/SOURCES.json` pin the backend versions the UI is built against. Backend audit results + UI gap priorities: `docs/API_COVERAGE_REPORT.md`.
- CI script: extract every `GET_INST/POST_INST/PUT_INST/DELETE_INST` path from `src/connector/**`, assert each matches a path in the gateway `swagger.yml` (params normalized). Fail the build on any orphan.
- Optional: a smoke job that curls each declared path against a reference gateway and flags `501`/`406` (would have caught both testbed bugs pre-merge).
- DoD: CI red if a connector calls a path not in swagger.

### H5 — Phase out `/meta`  *(after H1–H2 land)*
- Generate the form-field metadata `useFormWithParams` needs **from swagger at build time** (same generic-form engine, static input instead of a runtime fetch).
- Remove `query_get_metadata` / `useMetadata` runtime dependency once the generated equivalent drives all 19 forms.
- DoD: no runtime `/meta` call; forms build from generated schema; `/meta` connector deleted.

### H6 — De-duplication  *(complexity reduction)*
- One shared `useTableController` hook to replace the **17** copy-pasted table CRUD controllers (selection, refresh, sort-by-hash, batch delete, detail panel).
- Fold snake_case → camelCase at the typed boundary (generated types make this mechanical).

### H7 — Toolchain underneath (from CODE_QUALITY plan Q1)
- CRA → Vite + Vitest; ESLint flat config (`no-console: error`, naming-convention) + Prettier; GitHub Actions CI running lint + typecheck + test + the H4 guard.
- Land this early enough that H1–H6 arrive pre-checked; see `CODE_QUALITY_REFACTORING_PLAN.md` §3 for detail.

---

## 4. Execution order & NEXT TODO (updated 2026-07-17)

Done: ~~H1 (codegen types)~~ → ~~H4 (mapping guard)~~ + tests/CI (part of H7 pulled forward).

**Next session — start here, in this order:**

1. **H2 — zod validation layer** *(top priority; user-facing correctness)*
   - `npm i zod @hookform/resolvers`; create `src/validation/` with network primitives: `ipv4`, `ipv6`, `cidr` (reject `999.999.999.999/99`), `port` (reject 0 and >65535), `macAddress`, `hostname`.
   - Unit-test the primitives first (Vitest is ready — same table-driven style as `src/connector/user.test.ts`).
   - Pilot on the LB rule form (highest traffic), then the 9 hand-rolled `validateForm` components; `useFormWithParams` keeps field *shape*, zod owns *validity*.
   - DoD: invalid IP/CIDR/port cannot be submitted; one form is the documented reference pattern.
2. **H3 — error-handling hardening**
   - Replace silent `?? []` / `?? {}` reads with an unwrap that distinguishes error from empty (failed GET ⇒ error state, not an empty table).
   - React Query global `onError` + central logger (absorb the ~48 `console.*`); top-level + per-route error boundaries (currently 0).
   - Include the small OAM gap found in H4: call `POST /oam/logout` on logout (today the token is only cleared locally).
3. **P1 UI coverage components** (from `docs/API_COVERAGE_REPORT.md` §P1; each is connector + hooks + page, all typed via `GwGetResp`/`GwSchema`):
   - AI API-key management (`/config/ai/apikey*`) — flagship inference-gateway feature.
   - Tenant rate limits (`/config/ai/tenant/ratelimit*`).
   - GPU routing status/enable (`/config/gpu/*`) — dashboard card + settings.
   - L7 policy table (`/config/l7policy*`) — clone the firewall page pattern.
   - LB per-rule stats/status/PATCH — detail panel in the existing LB page.
4. **H5 — retire `/meta`** (after H2: generate form metadata from swagger at build time; only then delete `query_get_metadata`).
5. **H6 — dedupe**: one `useTableController` replacing the 17 copy-pasted CRUD controllers (do after H3 so the shared controller bakes in the new error handling).
6. **H7 remainder — CRA → Vite migration + ESLint flat config + Prettier** (vitest/CI already landed; Prettier will finish the LF normalization). After migration, fold the standalone vitest config into vite.config.
7. **Backend follow-ups (gateway repo):** commit the swagger.yml fixes; optionally emit `definedType` in BGP defined-set GET responses; decide implement-or-remove for the 15 `x-not-implemented` ops (if implemented, unflag + build UI per coverage report).

## 5. Definition of done (production-quality bar)

- Zero `any` in `src/connector/**`; generated types throughout the API boundary.
- Invalid network input (IP/CIDR/port) cannot be submitted.
- No silent empty-success on read failure; error boundary catches render throws.
- CI fails on: lint error, type error, test failure, connector-path-not-in-swagger.
- `/meta` runtime dependency removed; forms build from swagger.
- One `useTableController`; no per-table CRUD copy-paste.
