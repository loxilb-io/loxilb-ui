# API Coverage Report — loxilb-ui vs backend specs

**Snapshot:** 2026-07-17 · regenerate the raw list any time with `npm run api:coverage`
**Inputs:** `api-spec/gateway-swagger.yml` + `gateway-swagger-extras.yml` (loxilb-inference-gateway), `api-spec/oam-swagger.json` (oam-loxilb)
**Guard:** `npm run api:check-mapping` — CI-fails if a connector calls a path/method not declared in the specs, or one marked `x-not-implemented`.

## 1. Verification result (code-level, not just spec-level)

The gateway spec was audited against the actual implementation (`api/restapi/configure_loxilb_rest_api.go` wiring + raw middleware):

- **181 of 199** declared operations are wired to real handlers.
- **15 operations are declared but NOT implemented** (go-swagger stub → runtime `501`): 12× `GET /metrics/*` (JSON metric endpoints), `GET /nodegraph/all`, `GET /nodegraph/{service}`, `GET /config/trace/catalogs`. These are now tagged `x-not-implemented: true` in the gateway `swagger.yml`, and the UI mapping guard treats them as non-existent — building UI against them fails CI.
- **`/config/opa/watcher` (GET/POST/DELETE)** is declared in the main spec but its stubs are unwired — the route is actually served by **raw global middleware**; the real contract lives in `swagger-extras.yml`. Tagged `x-raw-middleware: true`.
- **Spec args the backend implements that swagger was missing — fixed in the gateway spec (2026-07-17):** `Logs` response pagination fields (`next_cursor`, `has_more`, `log_count`, `log_file`, `total_size`) and `GET /logs` query params `cursor`, `file`.
- **Known remaining wire gap:** BGP defined-set GET responses carry no `definedType` (model + gobgp handler don't emit it); the UI tags it client-side from the query it made. Optional backend enhancement.

## 2. UI coverage summary

119 connector calls cover **64 of 184 implemented gateway operations** and **22 of 35 OAM operations**. The uncovered operations below are grouped by product area with a build-priority recommendation.

### P1 — Core inference-gateway features with no UI (build next)

| Area | Operations | Suggested UI |
|---|---|---|
| AI API keys | `GET/POST /config/ai/apikey`, `GET/DELETE /config/ai/apikey/{key_id}`, `PATCH /config/ai/apikey/{key_id}` (raw middleware) | API-key management page (list/create/revoke/patch limits) |
| Tenant rate limits | `POST /config/ai/tenant/ratelimit`, `GET /config/ai/tenant/ratelimit/{tenant_id}` | Per-tenant rate-limit panel (pairs with Security section) |
| GPU / LLM routing | `GET /config/gpu/status`, `POST /config/gpu/enable|disable`, `POST /config/gpu/conversations/cleanup` | GPU-aware routing card on dashboard + settings toggle |
| L7 policy | `GET/POST /config/l7policy`, `GET/DELETE /config/l7policy/id/{id}` | L7 policy table (same pattern as firewall page) |
| LB per-rule detail | `GET .../protocol/{proto}/stats`, `GET .../protocol/{proto}/status`, `GET /config/loadbalancer/id/{id}`, `GET .../protocol/{proto}`, `PATCH .../protocol/{proto}` | Per-rule detail/stats panel in the existing LB page; PATCH enables partial edit instead of delete+recreate |

### P2 — Security & guardrail features (product differentiators)

| Area | Operations | Suggested UI |
|---|---|---|
| PII guard | `POST /config/pii/enable|configure|url-patterns`, `GET /config/pii/status|stats` | PII protection tab in Security section |
| LlamaFirewall | `POST /config/llamafirewall/enable|configure|scanners|health`, `GET /config/llamafirewall/status|stats` | LLM-firewall tab in Security section |
| TLS cert store | `POST /config/cert`, `GET/PUT/DELETE /config/cert/{certId}` | Certificate manager (SNI page covers only `/sni/certificates`) |
| CORS | `POST /config/cors`, `GET /config/cors/all`, `DELETE /config/cors/{cors_url}` | CORS allow-list editor |

### P3 — Advanced networking / observability (as demand appears)

- IPsec suite (18 ops: tunnels, SAs, certs, CA certs, stats)
- IPv6 addresses (`/config/ipv6address*` — IP page today is IPv4-only)
- Deep tracing (`/config/trace/*` enable/disable/status/parsers/otlp/catalog-parser) and L4 trace (`/config/l4trace/*`)
- Worker metrics config (`GET/POST /config/worker/metrics`), metrics collection config (`GET/POST/DELETE /config/metrics`)
- DPU debug/hwcounters, AI KV inventory (raw middleware; admin/debug UI)
- Gateway-level config export/import (`GET /config/export`, `POST /config/import`) — UI covers only the OAM-level equivalents
- `POST /config/endpointhoststate` (endpoint host state override)
- `DELETE /config/bgp/policy/apply` (UI can apply but not un-apply a BGP policy)

### Not applicable / intentionally uncovered

- Gateway `/auth/*`, `/oauth/*` — the UI authenticates against OAM only (post-refactor design); direct gateway auth is for standalone API use.
- `/config/session*`, `/config/sessionulcl*` — 5G/telecom features dropped from this product's UI scope (W4).
- 12× `GET /metrics/*` JSON + `/nodegraph/*` + `/config/trace/catalogs` — `x-not-implemented` (501).
- OAM `/oam/oauth/*` — OAuth removed by decision; `/oam/admin/reset` — bootstrap/recovery, not a UI feature; `/oam/loxilbs/{id}/netlox/` — the proxy wildcard the UI already rides implicitly.

### Real OAM gaps worth noting

- `POST /oam/logout` — the UI clears the token locally but never invalidates it server-side. Small fix, do with H3.
- `GET/POST /oam/alerts`, `GET /oam/alerts/history`, `PUT /oam/alerts/{id}/acknowledge` — alerts UI was deleted in W4; a read-only alerts view is planned (W2/W3) and the endpoints are live.
