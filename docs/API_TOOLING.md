# API Toolchain — specs, codegen, guards, tests

How this UI stays type-safe and backward compatible with the backends
(`loxilb-inference-gateway`, `oam-loxilb`). Added 2026-07-17 (hardening
workstreams H1 + H4; see `PRODUCTION_HARDENING_PLAN.md`).

## The pipeline at a glance

```
backend repos                     loxilb-ui
─────────────                     ─────────────────────────────────────────────
gateway api/swagger.yml     ──┐
gateway api/swagger-extras.yml├─ npm run sync:specs ──> api-spec/*  (+SOURCES.json)
oam docs/swagger.json (swag)──┘         │
                                        ▼
                              npm run gen:api ──> src/api/gen/*  (generated types)
                                        │
                                        ▼
                     src/api/index.ts helpers (GwGetResp, OamGetResp, GwSchema…)
                                        │
                                        ▼
                     src/connector/**  (every call typed against the spec)

guards:  npm run gen:api:check      generated types drift from specs → fail
         npm run api:check-mapping  connector calls a route not in spec → fail
         npm test                   wire-shape contract tests → fail on breaking change
```

## Directory & file map

| Path | What it is |
|---|---|
| `api-spec/gateway-swagger.yml` | Vendored gateway spec (source of truth for types) |
| `api-spec/gateway-swagger-extras.yml` | Gateway endpoints served by raw middleware, outside go-swagger codegen |
| `api-spec/oam-swagger.json` | Vendored OAM spec (generated in oam-loxilb by `swag init`) |
| `api-spec/SOURCES.json` | Which backend commits the specs were vendored from, and when |
| `src/api/gen/*` | Generated TypeScript types — **never edit**; `npm run gen:api` |
| `src/api/index.ts` | The only module that imports from `gen/`; exports the helper types |
| `scripts/gen-api-types.mjs` | swagger2openapi → openapi-typescript codegen |
| `scripts/check-api-mapping.mjs` | H4 guard + coverage listing |
| `scripts/sync-specs.sh` | Re-vendor specs from sibling repos + stamp SOURCES.json |
| `src/api/contract.test.ts` | Backward-compat tests: wire keys the UI reads must exist in the specs |
| `docs/API_COVERAGE_REPORT.md` | Which spec operations have no UI yet, prioritized |

## npm scripts

| Script | Purpose |
|---|---|
| `npm run sync:specs` | Re-vendor specs from `../loxilb-inference-gateway` and `../oam-loxilb` (override with `GATEWAY_REPO=` / `OAM_REPO=`) |
| `npm run gen:api` | Regenerate `src/api/gen/*` from `api-spec/*` |
| `npm run gen:api:check` | CI drift check: regen must produce no diff |
| `npm run api:check-mapping` | Assert all connector calls exist in the specs (H4 guard) |
| `npm run api:coverage` | List spec operations with no UI coverage |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest (unit + contract tests) |

CI (`.github/workflows/ci.yml`) runs: typecheck → gen:api:check → api:check-mapping → test → build.

## How to write a typed connector call

```ts
import type {GwGetResp, GwSchema} from 'api';

// GET: the path literal is compile-checked against the spec —
// a typo or a path the gateway doesn't declare is a build error.
const resp = await GET_INST<GwGetResp<'/config/loadbalancer/all'>>(instance, `/config/loadbalancer/all`);
return resp.data?.lbAttr ?? [];            // resp.data is typed from swagger

// Model types come from GwSchema / OamSchema:
function toRow(entry: GwSchema<'LoadbalanceEntry'>) { ... }
```

OAM calls use `OamGetResp<'/oam/...'>` — note the `/oam` prefix exists in the
spec but not in the connector URL (the base URL carries it).

Where an app-facing interface requires fields the spec marks optional, do one
explicit narrow at the connector boundary (`(resp.data?.X ?? []) as IHandType[]`)
— TypeScript still verifies the shapes are compatible. Do not cast an untyped
`resp.data`.

## Bumping the supported backend version

1. Check out the target version in the sibling backend repo(s).
2. `npm run sync:specs` — vendors the new specs, stamps `api-spec/SOURCES.json`.
3. `npm run gen:api` — regenerate types.
4. `npm run typecheck && npm run api:check-mapping && npm test`.

Interpreting failures:
- **typecheck fails** — a field the UI reads changed type/name in the new spec.
- **api:check-mapping fails** — a route the UI calls was removed/renamed, or is
  now tagged `x-not-implemented`.
- **contract tests fail** — a wire key (e.g. `lbAttr`) the UI depends on is
  gone: the bump is not backward compatible; fix connectors/pages or the backend.

Commit `api-spec/*` and `src/api/gen/*` together with any connector fixes, so
every commit is a consistent (spec, types, code) triple.

## Spec truthfulness (verified against gateway source, 2026-07-17)

The gateway spec is **not** blindly trusted — it was audited against the actual
handler wiring:

- Operations tagged `x-not-implemented: true` in the gateway spec are declared
  but have no handler (runtime 501): 12× JSON `GET /metrics/*`, `/nodegraph/*`,
  `GET /config/trace/catalogs`. The mapping guard treats them as non-existent.
  If the gateway implements one later: remove the tag, `sync:specs`, and the
  contract test reminding about the flag will point you at the coverage report.
- `/config/opa/watcher` is tagged `x-raw-middleware: true`: the main-spec stubs
  are unwired; the live contract is in `swagger-extras.yml`.
- The `swagger-extras.yml` endpoints (OPA watcher, DPU debug/hwcounters, AI KV
  inventory, `PATCH /config/ai/apikey/{key_id}`) are served by global
  middleware in `configure_loxilb_rest_api.go` — keep the two in sync by hand.
