# loxilb-ui → loxilb-inference-gateway — Implementation Plan

**Status:** Ready for team assignment (2026-07-17)
**Design doc:** `INFERENCE_GATEWAY_REFACTORING_DESIGN.md` (read first — decisions AD-1…AD-4)

---

## 0. Deployment topology (context for all workstreams)

The three-tier layout (static React UI + **loxilb-oam** control plane + N gateway
instances) is the standard industry pattern for multi-instance management
(cf. NGINX One/Instance Manager, HAProxy Fusion, Kong Konnect, AVI controller —
all separate control planes; only single-instance products embed their UI in the
proxy like Traefik/Kong Manager). **We keep OAM, but slimmed:**

- OAM keeps: auth (local login only — **OAuth is removed**, see quality plan
  P0-5; on-premise focus), users, RBAC/licenses, instance registry, reverse
  proxy (`/loxilbs/{id}/netlox/v1/*`), config export/import.
- OAM gains: `prometheus_url` per instance + `/loxilbs/{id}/prom/*` proxy route.
- OAM loses: alert storage/engine (`/alerts`, `/alerts/history`, acknowledge).
- Its DB now holds only management config (users/instances/licenses) — no
  time-series, no alert state. This is normal config storage, not the "local DB"
  anti-pattern removed from the data plane.
- **Optional (Phase 3, decide later): standalone mode** — UI served directly by a
  single gateway with instance list in local config, for dev/community
  single-instance use. Not in Phase 1 scope.

## 1. Page-by-page impact matrix

Legend: **KEEP** = works as-is against gateway (verify only) · **REBIND** =
same page, new data source · **REBUILD** = significant rework · **DELETE**.

| Page (route) | Action | Notes |
|---|---|---|
| Login / Setup / User mgmt / Instance / ConfigManagement | KEEP | OAM-side, untouched |
| OAuthCallbackPage + OAuth login flow | DELETE | on-premise focus; quality plan P0-5 (also removes the token-leak logging finding) |
| All `network/*` pages (BFD, BGP×4, FDB, IP, Port, Neighbor, Route, VLAN, VXLAN) | KEEP | classic `/config/*` unchanged in gateway |
| LBRulePage | KEEP (Phase 1) | Phase 2 adds inference fields (sse_mode, P/D, CHWBL, endpoint role) + per-rule stats |
| EndpointPage, FirewallPage, MirrorPage, QoSPage, SNICertificatesPage | KEEP | |
| SYNFloodPage, IPFilterPage, SecurityRatePage | KEEP | optional Phase-3 sparklines from `security_*` series |
| Status pages (Device, FS, Process, HA, Logs, InstanceSetting) | KEEP | |
| DashboardPage (`/instance/dashboard`) | REBIND | alert cards → `usePromAlerts`; rate/history cards → `usePromRangeQuery`; sub-5s "live" cards keep JSON `/metrics/*` polling; remove cache-stats/live-metrics cards |
| ConntrackPage | REBIND | table stays on `/config/conntrack/all`; history chart → `query_range(active_conntrack_count)` |
| NTopPage | REBIND | `topk(N, rate(endpoint_traffic_bytes[5m]))` etc. replace `/api/v1/metrics/db/query` |
| NetworkTopologyPage | REBIND | live topology from `/nodegraph/*` (kept); traffic overlays from Prometheus |
| AlertManagementPage | REBUILD | read-only: Prometheus `/api/v1/alerts` + `/api/v1/rules` (design §5) |
| AdvancedMetricsPage | REBUILD | becomes Prometheus metrics explorer: metric picker (table-driven from mapping file), time-range picker, query_range charts |
| AlertManagerPage (rule CRUD) | DELETE | route, nav entry, page, hooks |
| BackupManagerPage | DELETE | no DB to back up |
| SystemPage | REBIND | drop OAM alert-history section; rest KEEP |
| Dead: DashboardPage_orig, HomePage, TelecomPage | DELETE | hygiene |

## 2. Workstreams & tasks

### W1 — Gateway compatibility pass (Phase 0) — ~2–3 dev-days

1. Point a dev OAM at a loxilb-inference-gateway instance; smoke-test every KEEP
   page. Same basePath/auth verified by spec diff — expect no code change.
2. Confirm no references to `/config/llm-catalogs` (analysis found none).
3. Verify error-envelope handling in `fetcher_base.ts` (`createDetailedErrorMessage`
   expects `{result,message,fields}`) against gateway responses; fix edge cases.
4. ~~Replace repo `swagger.yml` with the gateway's `api/swagger.yml`~~ — **done**
   (commit `f7d7d4c` on `feat/inference-gateway-integration`). Still to do:
   delete `metrics-api-swagger.yaml` (dead API). Swagger stays reference-only
   (no codegen today).
5. Environment: run the pass against the Naver Cloud testbed —
   gateway on kv-loxilb, OAM on kv-client, UI local dev server
   (see `docs/internal/TESTBED.md`, Workflow A).

### W2 — Prometheus datasource (Phase 1 core) — ~2 dev-weeks UI + small OAM task

**OAM (backend team, ~2–3 days):**
1. Add `prometheus_url` (nullable) to instance model + CRUD + UI field on
   InstancePage form.
2. Add reverse-proxy route `GET/POST /loxilbs/{id}/prom/*` → instance
   `prometheus_url` (same auth middleware as existing instance proxy).

**UI:**
3. `src/connector/prometheus/fetcher_prom.ts` — Prometheus envelope
   (`{status, data}`, error/warnings handling), URL builder on the proxy route.
4. `src/connector/prometheus/query.ts` — `query`, `query_range` (auto step:
   range/250 px, min = scrape interval).
5. `src/connector/prometheus/alerts.ts` — alerts + rules readers.
6. Hooks: `usePromQuery`, `usePromRangeQuery` (returns chart-ready series,
   React Query cached), `usePromAlerts`.
7. **Single mapping file** `src/config/promMetrics.ts`: cardKey → {promql,
   legend, unit, kind: gauge|rate}. All PromQL lives here (design §8 item 3,
   metric-rename risk). Seed from design §6 table.
8. Reusable `PromRangeChart` card component (MUI x-charts line/area, time-range
   prop, empty-state when no `prometheus_url`).
9. Degradation UX: shared `usePrometheusAvailable(instance)` hook; cards render
   "Connect Prometheus" empty state (link to instance settings) when absent.

### W3 — View rebinding/rebuilds (Phase 1) — ~2 dev-weeks

1. DashboardPage card-by-card rebind (see matrix). Keep react-grid-layout config;
   layout keys unchanged where possible so saved user layouts survive.
2. ConntrackPage, NTopPage, NetworkTopologyPage rebinds.
3. AlertManagementPage rebuild (read-only, severity filters client-side).
4. AdvancedMetricsPage rebuild as metrics explorer.
5. SystemPage alert-history removal.

### W4 — Removals & hygiene (Phase 1) — ~3–4 dev-days

1. Delete connectors/hooks/types per design §7 (advancedMetrics/alerts/backup/
   compression connector files, duplicate block in `metrics.ts`,
   `advancedMetricsHook.ts`, `connector/oam/alerts.ts`).
2. Delete pages/routes/nav: AlertManagerPage, BackupManagerPage, dead pages.
3. Prune types (`types/advancedMetrics.ts` storage sections, alert CRUD types,
   backup/compression types).
4. Remove legacy `react-query` v3 from package.json (verify no imports first).
5. i18n cleanup for removed strings.

### W5 — Ops artifacts & docs (Phase 1) — ~2–3 dev-days

1. Reference Prometheus scrape config: gateway `:11111/netlox/v1/metrics`,
   `loxilb-ai-controller` and `loxilb-kv-agent` sidecar ports; consistent
   `instance` external label (needed for future cluster aggregation).
2. Example alert-rule files (endpoint down, error-rate spike, conntrack
   capacity, LCU saturation, cert expiry if applicable).
3. Update README/deploy docs: Prometheus is required for history/alert views;
   everything else works without it.

### Phase 2 — AI-gateway configuration UI (separate estimate after Phase 1)

1. LB rule form: inference fields (`sse_mode`, `pd_disagg_mode`,
   `pd_cache_aware`, `kvExactMode`, ZMQ KV port, CHWBL block, endpoint
   `role` prefill/decode, `10-wrr-hash` selector) + per-rule stats/status.
2. AI API keys page (`/config/ai/apikey*`), tenant rate limits
   (`/config/ai/tenant/ratelimit*`).
3. Safety pages: PII (`/config/pii/*`), LlamaFirewall (`/config/llamafirewall/*`),
   OPA watcher.
4. Cert store (`/config/cert*`), L7 policy, trace config (L4/L7, OTLP),
   config import/export against gateway.
5. IPsec + IPv6 pages (non-AI backlog).

### Phase 3 — AI observability & extras

1. LLM dashboard: `loxilb_ai_requests_total`, `loxilb_ai_tokens_total` (tokens/s),
   TTFT p50/p95/p99 from `loxilb_ai_pd_decode_ttft_seconds` histogram, P/D
   session-hit rates, `loxilb_ai_rate_limit_hits_total`, per-model breakdowns;
   `loxilb_pd_ctrl_*` controller state panel.
2. DPU counters page (`/config/dpu/hwcounters`), KV inventory
   (`/config/ai/kv/inventory`).
3. Optional: Alertmanager silences, cluster-aggregated dashboards, standalone
   (OAM-less) mode, security-page sparklines.

## 3. Suggested sequencing & parallelism

```
Phase 0: W1 ──┐
Phase 1:      ├─ W2(OAM) ─ W2(UI 3–9) ─┬─ W3 ─┬─ release
              └─ W4 (parallel w/ W2)    └─ W5 ─┘
```
W4 removals can start immediately (they only delete dead API usage). W3 depends
on W2 hooks. Total Phase 0+1 ≈ **5–6 dev-weeks** single UI dev + 3 OAM days;
~3–4 weeks with two devs.

## 4. Acceptance criteria (Phase 1)

1. UI fully functional against loxilb-inference-gateway with **zero** calls to
   any `/api/v1/*` storage endpoint (verify via network trace on full click-through).
2. With `prometheus_url` set: Dashboard rate/history cards, Conntrack history,
   NTop, AlertManagement show live Prometheus-backed data for 5m/1h/6h/24h ranges.
3. With `prometheus_url` unset: no broken cards — live JSON cards work, history
   cards show the connect-Prometheus empty state.
4. Alert views reflect firing state of the shipped example rules within one
   evaluation interval.
5. All KEEP pages pass smoke tests against the gateway.
6. Bundle contains no dead monitoring code (removed files, no react-query v3).

## 5. Test plan

- Unit: promMetrics mapping table (every entry parses/queries against a
  test Prometheus), fetcher_prom envelope/error paths, step calculation.
- Integration: full stack — either local docker-compose or the remote testbed
  (`docs/internal/TESTBED.md`, Workflow B: gateway on kv-loxilb + OAM/UI/
  Prometheus on kv-client) — with traffic generator; scripted checks of query
  results vs. JSON counter endpoints (sanity: same order of magnitude).
- Regression: existing page smoke suite against gateway (W1 output becomes CI).

## 6. Risks (delta from design §8)

- OAM proxy work slips → mitigate: UI can temporarily hit Prometheus directly in
  dev via `REACT_APP_PROM_URL` override + CORS-enabled Prometheus.
- Saved dashboard layouts break if card keys change → keep keys, version the
  localStorage layout schema (existing length-check already resets gracefully).
- Sidecar scrape jobs forgotten in user deployments → Phase-3 dashboards must
  show per-job "no data from job X" hints, and W5 docs make the scrape config
  copy-pasteable.
