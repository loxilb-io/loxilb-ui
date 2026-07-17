# loxilb-ui — Production Hardening Plan

**Status:** Approved direction (2026-07-17)
**Companion docs:** `CODE_QUALITY_REFACTORING_PLAN.md`, `INFERENCE_GATEWAY_IMPLEMENTATION_PLAN.md`, `INFERENCE_GATEWAY_REFACTORING_DESIGN.md`
**Basis:** post-refactor product review + full end-to-end validation on the Naver Cloud testbed (OAM + inference-gateway 0.9.8.6-beta), 2026-07-17.

---

## 1. Where we are (entry state for the next session)

The P0 OSS-release blockers and the gateway API-sync (W4 deletions + live-metrics rebind) are **done and pushed** to `feat/inference-gateway-integration` (through commit `e8f4556`). Full stack was validated end-to-end through the OAM proxy against a live gateway (Playwright + real Chromium): every page renders correct live data, zero request failures. Two real bugs were caught and fixed by that run (the `/metrics` 406 Accept-header, and dead protocol-rate cards).

**Validated facts the plan below relies on:**
- All 86 instance-side `GET_INST(...)` calls resolve to real gateway swagger paths (zero mismatches).
- `swagger.yml` is currently used **nowhere** in code — it is a dead reference file. The runtime API contract is the gateway's `/meta` endpoint.
- `/meta`-driven forms: 19 of 31 input components use `useFormWithParams` (runtime field discovery). 9 more have hand-rolled `validateForm` — **two parallel validation systems**.
- Current correctness smells (post-refactor counts): **28** silent-failure `(resp.data as X) ?? {}`, **273** `any`, **48** raw `console.*`, **17** copy-pasted table CRUD controllers, **0** error boundaries.

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

## 4. Suggested execution order

```
H7 (toolchain: at least ESLint+CI skeleton)  →  H1 (codegen types)  →  H4 (mapping guard)
   →  H2 (zod validation)  →  H3 (error handling)  →  H5 (retire /meta)  →  H6 (dedupe)
```

H1 + H4 are the highest-leverage, lowest-risk first moves. H2 + H3 are where user-facing correctness improves most. H5 + H6 are cleanup that depends on H1.

## 5. Definition of done (production-quality bar)

- Zero `any` in `src/connector/**`; generated types throughout the API boundary.
- Invalid network input (IP/CIDR/port) cannot be submitted.
- No silent empty-success on read failure; error boundary catches render throws.
- CI fails on: lint error, type error, test failure, connector-path-not-in-swagger.
- `/meta` runtime dependency removed; forms build from swagger.
- One `useTableController`; no per-table CRUD copy-paste.
