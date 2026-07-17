# loxilb-ui → loxilb-inference-gateway Refactoring — Design Document

**Status:** Approved direction (2026-07-17)
**Audience:** Internal UI/dev team
**Companion doc:** `INFERENCE_GATEWAY_IMPLEMENTATION_PLAN.md`

---

## 1. Executive Summary

loxilb-ui was built against the old loxilb API plus an enterprise "storage-based
monitoring" add-on (`/api/v1/metrics/db/*`, alert-rule engine, backup/compression).
The new backend, **loxilb-inference-gateway**, keeps the entire classic API surface
but **removes the storage-based monitoring layer** — by design: the gateway targets
cloud-native deployments where the data plane is stateless and **Prometheus is the
time-series database**.

This refactoring:

1. Re-points the UI at the inference gateway (near zero cost — the gateway is a
   drop-in superset of the classic API: same `basePath /netlox/v1`, same BearerAuth,
   all 113 shared endpoints unchanged).
2. Replaces every storage-backed monitoring view with **Prometheus HTTP API queries
   from the UI** (Kiali pattern — stateless UI backend, no new gateway APIs).
3. Replaces the custom alert engine with **read-only Alertmanager/Prometheus alert
   views**.
4. Stages new AI-gateway features (API keys, KV-cache routing, PII/LlamaFirewall,
   tracing, DPU) as later phases.

## 2. Architecture Decisions

### AD-1 — No local DB in the data plane; Prometheus is the TSDB

Competitor evidence is unanimous for OSS data planes:

| Product | In-product monitoring storage? | Pattern |
|---|---|---|
| Kong OSS/EE | **Removed** ("Vitals" dropped in Gateway 3.5) | Prometheus plugin + published Grafana dashboards |
| Traefik, NGINX Plus, HAProxy | Never had it (live counters only) | Prometheus + official Grafana dashboards |
| Envoy Gateway, Envoy AI Gateway, Gloo AI GW | No UI at all | Prometheus (OTel GenAI conventions) + Grafana |
| Cilium (Hubble UI) | Live stream only (in-memory ring buffer) | `hubble_*` Prometheus metrics + Grafana |
| Kiali (Istio) | **Stateless backend, queries Prometheus HTTP API for all charts** | ← the pattern we adopt |
| LiteLLM | Postgres spend logs — documented scaling pain (`disable_spend_logs` escape hatch) | counter-example |
| AVI/NSX ALB | Own metrics DB — requires 3-node controller cluster | counter-example |

Products that do persist history do it in a separately monetized control plane
(Kong Konnect, Portkey SaaS, HAProxy Fusion, NGINX One), never inside the gateway.

**Decision:** the gateway keeps no metrics storage. Historical data lives in
Prometheus deployed alongside (standard in the target cloud-native environments).

### AD-2 — UI charts query the Prometheus HTTP API directly (Kiali pattern)

The UI gets historical/time-series data by calling Prometheus
`/api/v1/query_range` and `/api/v1/query` at render time. No new gateway APIs, no
UI-side storage. Live/config views keep using the gateway's surviving JSON
endpoints.

Key enabler discovered during analysis: **the gateway's Prometheus registry
(`api/prometheus/metric_names.go`) exposes the exact metric names the UI already
uses** (`rps_bps`, `active_conntrack_count`, `lb_rule_count`,
`processed_bytes_total`, …). The card→metric mapping is therefore nearly 1:1
(see §6).

### AD-3 — Alerting: Alertmanager read-only

The old alert engine (rule CRUD, `first_breach`, acknowledge flow, stored in the
enterprise add-on + OAM) duplicated Prometheus Alertmanager. The UI will **display**
active alerts and configured rules from the Prometheus/Alertmanager APIs
(`/api/v1/alerts`, `/api/v1/rules`). Rule authoring moves to Prometheus rule files
/ GitOps. In-UI rule CRUD is dropped (may be revisited later as a thin
config-management layer if users demand it).

### AD-4 — Monitoring first; AI-gateway features phased

Phase 1 ports the UI and replaces monitoring. Phases 2–3 add UI for the ~56 new
gateway endpoints (AI API keys, tenant rate limits, KV-cache-aware LB fields,
PII/LlamaFirewall/OPA, tracing, DPU, IPsec). See roadmap in §9.

## 3. Current State (what the analysis found)

### 3.1 Two backends, one env var

- **OAM control plane** (`REACT_APP_API_URL`): auth/OAuth, users, licenses,
  instances registry, config export/import, OAM logs, `/alerts` history.
  Connectors: `src/connector/oam/*`, `src/connector/fetcher/fetcher_oam.ts`.
- **Per-instance gateway API**, proxied through OAM:
  `` `${base}/loxilbs/${instance.id}/netlox/v1${path}` `` —
  `src/connector/fetcher/fetcher_inst.ts`. Classic paths `/config/*`, `/status/*`;
  the enterprise add-on nested at `/api/v1/*`.

No codegen — all paths are hand-written string literals in `src/connector/**`;
swagger files in the repo are reference-only.

### 3.2 What survives unchanged (no work beyond re-verification)

All `/config/*`, `/status/*`, auth, logs, SNI, cistate endpoints — i.e. every
network/traffic/security/status page. Same basePath, same auth. Also surviving:
the 12+ JSON live-counter endpoints (`/metrics/flowcount`, `/requestcount`,
`/errorcount`, `/processedtraffic`, `/epdisttraffic`, `/fwdrops`, …) and the
Prometheus exposition endpoint `GET /metrics` + toggle `/config/metrics`.

Only removed classic path: `/config/llm-catalogs` (UI does not call it — verified
no connector references).

### 3.3 What is gone (the refactoring target)

The entire enterprise storage layer, called from
`src/connector/instance/{advancedMetrics,alerts,backup,compression}.ts` and a
duplicate non-prefixed copy inside `src/connector/instance/metrics.ts`:

| Removed API family | Endpoints |
|---|---|
| Historical queries | `/api/v1/metrics/history/{name}`, `/historical`, `/query` |
| DB queries | `/api/v1/metrics/db/query`, `/db/aggregate`, `/db/batch` |
| Live-cache subsystem | `/api/v1/metrics/live`, `/live/advanced`, `/cache/stats`, `/health`, `/value/{name}` |
| Alert engine | `/api/v1/alerts*` (rules CRUD, active, resolve, stats) + OAM `/alerts`, `/alerts/history`, acknowledge |
| DB ops | `/api/v1/backup/*`, `/api/v1/compression/*` |

### 3.4 Affected views

| View | Route | Dependency on removed APIs |
|---|---|---|
| `DashboardPage` | `/instance/dashboard` | Alert cards, rate cards (`rps_*` via live-metrics), health/conntrack cards |
| `AdvancedMetricsPage` | `/instance/managers/metrics` | Live metrics, cache stats, system health — entire page |
| `ConntrackPage` | `/instance/traffic/ct` | Time-series chart (client-accumulated from polling) |
| `NetworkTopologyPage` | `/instance/traffic/topology` | `/api/v1/metrics/db/query` |
| `NTopPage` | `/instance/traffic/ntop` | `/api/v1/metrics/db/query` |
| `AlertManagementPage` | `/instance/traffic/alerts` | Alert list/stats APIs |
| `AlertManagerPage` | `/instance/managers/alert` | Alert-rule CRUD |
| `BackupManagerPage` | `/instance/managers/backup` | Backup APIs — page obsolete |
| `SystemPage` | `/system` | OAM `/alerts/history` section |

## 4. Target Architecture

```
┌───────────┐     auth, users, instances,      ┌──────────────┐
│  Browser   │────config import/export ───────▶│  OAM server   │
│ (React UI) │                                  │              │
│            │──/loxilbs/{id}/netlox/v1/* ────▶│  (proxy)      │──▶ inference-gateway
│            │                                  │              │      /netlox/v1/*
│            │──/loxilbs/{id}/prom/* ─────────▶│  (proxy, NEW) │──▶ Prometheus
└───────────┘                                  └──────────────┘      /api/v1/query_range
                                                                     /api/v1/alerts, /rules

           Prometheus scrapes: gateway :11111/netlox/v1/metrics
                               loxilb-ai-controller :<port>/metrics   (sidecar)
                               loxilb-kv-agent      :<port>/metrics   (sidecar)
```

### 4.1 Prometheus datasource

- **Instance registry gains one field:** `prometheus_url` (per instance or per
  cluster) stored in OAM. Optional.
- **Access path:** OAM adds a transparent reverse-proxy route
  `/loxilbs/{id}/prom/*` → the instance's configured `prometheus_url`. This reuses
  the existing proxy pattern (`fetcher_inst.ts`), inherits OAM bearer-token auth,
  and avoids browser CORS against Prometheus. (Direct browser→Prometheus is
  possible if CORS is configured, but the proxy keeps a single origin and single
  auth model. This is an OAM route, not a gateway API — AD-2 is preserved.)
- **Graceful degradation:** when `prometheus_url` is unset or unreachable, live
  views still work (gateway JSON endpoints); historical charts render an
  informative empty state ("Connect Prometheus to enable history"). Prometheus is
  a soft dependency, unlike Kiali's hard one — loxilb also runs outside K8s.

### 4.2 New UI connector module

```
src/connector/prometheus/
  fetcher_prom.ts    // GET `${base}/loxilbs/${id}/prom${path}`; Prometheus
                     // {status:"success"|"error", data} envelope handling
  query.ts           // query(instance, promql), query_range(instance, promql,
                     // start, end, step)
  alerts.ts          // GET /api/v1/alerts (Prometheus), GET /api/v1/rules
src/hooks/prometheus/
  usePromQuery.ts        // instant vector, React Query
  usePromRangeQuery.ts   // range vector → chart series; replaces the
                         // client-side accumulation in metricsTimeSeriesHook.ts
  usePromAlerts.ts       // active alerts + rules
```

`usePromRangeQuery` is a strict UX upgrade over the old
`metricsTimeSeriesHook.ts` pattern (polling live endpoints and accumulating
points client-side): history survives page reloads, arbitrary time ranges,
consistent data across users.

### 4.3 What does NOT change

- `fetcher_inst.ts` proxy template, bearer auth, 401 handling — unchanged.
- All config/status connectors (`bfd.ts`, `bgp.ts`, `load_balancer.ts`, …) —
  unchanged.
- React Query v5 + Recoil + MUI stack — unchanged (cleanup of leftover
  react-query v3 dependency is in the plan as hygiene).

## 5. Alerting Design (read-only)

- **AlertManagementPage** (`/instance/traffic/alerts`) is rebuilt on:
  - `GET {prom}/api/v1/alerts` — firing/pending alerts (name, severity from
    labels, `activeAt`, annotations).
  - `GET {prom}/api/v1/rules?type=alert` — configured alert rules with health
    and last evaluation.
  - If Alertmanager is deployed, `GET {am}/api/v2/alerts` adds
    silenced/inhibited state; optional second URL field. Phase 1 targets the
    Prometheus endpoints only (always present).
- **Dropped:** rule CRUD (`AlertManagerPage`), manual alerts, resolve/acknowledge
  flows, alert stats API. Acknowledge ≈ Alertmanager silences — out of scope for
  Phase 1, noted as a possible Phase-3 enhancement.
- **Dashboard alert cards** (`ActiveAlertsCard`, `AlertSummaryCard`) re-bind to
  `usePromAlerts` with client-side aggregation for counts by severity.
- We ship example Prometheus alert-rule files for common loxilb conditions
  (endpoint down, error-rate spike, conntrack near capacity, LCU saturation) so
  users get equivalent alerts to the old built-in rules.

## 6. Metric Mapping (old card/field → PromQL)

Gateway registry (`api/prometheus/metric_names.go`) exposes the same names the UI
uses in `src/types/metricsConstants.ts`. `rps_*` are server-computed gauges and can
be charted directly; where a raw counter exists, prefer `rate()` — it is
resolution-independent and standard.

| UI card / metricField | PromQL (Phase 1) |
|---|---|
| Total Traffic Rate (`rps_bps`) | `rate(processed_bytes_total[1m]) * 8` (or gauge `rps_bps`) |
| Total Packet Rate (`rps_pps`) | `rate(processed_packets_total[1m])` (or `rps_pps`) |
| Total Error Rate (`rps_eps`) | `rate(total_errors[1m])` (or `rps_eps`) |
| TCP/UDP/SCTP rates (`rps_tcp_bps` …) | `rate(processed_tcp_bytes[1m]) * 8` etc. |
| Connection Tracking card | `active_conntrack_count`, `active_flow_count_{tcp,udp,sctp}`, `new_flow_count` |
| Endpoint Health card | `healthy_endpoints_count`, `unhealthy_endpoints_count`, `endpoint_health` |
| LB Rules card (`lb_rule_count`) | `lb_rule_count` |
| Requests / errors per service | `total_requests_per_service`, `total_errors_per_service` (labelled series) |
| Firewall drops | `rate(total_fw_drops[5m])`, `total_fw_drops_per_rule` |
| System Usage card | `system_cpu_utilization`, `system_memory_utilization`, `system_disk_utilization` |
| Service/endpoint distribution (NTop, topology) | `service_traffic_bytes`, `endpoint_traffic_bytes`, `service_distribution_ratio`, `client_req_dists_per_service` |
| LCU cards | `consumed_lcus`, `lcu_utilization_ratio`, `lcu_capacity_units_total` |
| Security pages (optional sparkline upgrades) | `security_syn_blocked_total`, `ipfilter_blacklist_packets_total`, … |

Conntrack page history: `active_conntrack_count` via `query_range` replaces the
client-accumulated series. NTop/topology traffic history:
`topk(10, rate(endpoint_traffic_bytes[5m]))`-style queries replace
`/api/v1/metrics/db/query`.

## 7. Removals

| Item | Action |
|---|---|
| `src/connector/instance/advancedMetrics.ts`, `alerts.ts`, `backup.ts`, `compression.ts` | Delete |
| Duplicate non-prefixed API block in `src/connector/instance/metrics.ts` + `hooks/query/advancedMetricsHook.ts` (legacy copy) | Delete |
| `src/connector/oam/alerts.ts` (OAM alert history/ack) | Delete (OAM side deprecates endpoints) |
| `BackupManagerPage`, `AlertManagerPage` | Delete pages + routes + nav entries |
| `AdvancedMetricsPage` | Replace with Prometheus-backed metrics explorer (or fold the useful cards into Dashboard — decide in implementation) |
| `CacheStatsCard`, `SystemHealthCard` (metrics-subsystem health), `LiveMetricsCard` | Delete or re-bind |
| Types: `advancedMetrics.ts` storage/query sections, `alerts.ts` rule-CRUD types | Prune |
| Dead code flagged during inventory: `DashboardPage_orig.tsx`, `HomePage.tsx`, unrouted `TelecomPage` + `session*.ts`, legacy `react-query` v3 dep | Delete (hygiene) |

## 8. Risks & Open Questions

1. **Prometheus deployment ownership** — docs must specify a reference scrape
   config (gateway `:11111/netlox/v1/metrics` + the two sidecars
   `loxilb-ai-controller`, `loxilb-kv-agent`, which expose their own `/metrics`
   ports outside swagger). Without the sidecar scrape jobs, Phase-3 AI dashboards
   will be empty.
2. **Scrape interval bounds chart resolution** (typ. 15–30 s). The old UI's
   1–5 s live cards remain possible via the surviving JSON endpoints; sub-scrape
   "real-time" charts should keep using those, with Prometheus for ≥5 min ranges.
   Cards should state their source.
3. **Metric naming migration** — gateway metric names today lack a `loxilb_`
   prefix except AI ones (`loxilb_ai_*`). If upstream later namespaces them,
   the PromQL layer must be table-driven (single mapping file, §6) so renames are
   one-line changes.
4. **OAM work required** — `prometheus_url` field + `/prom/*` proxy route are OAM
   backend changes (small, but a second repo/team dependency).
5. **Multi-instance/HA semantics** — with 2+ loxilb instances behind HA, users
   may expect aggregated views. Phase 1 keeps per-instance dashboards (matching
   today's UX); cluster aggregation is a Phase-3 candidate (PromQL `sum by`
   across instance labels — needs consistent external labels in scrape config).

## 9. Roadmap (summary — details in implementation plan)

- **Phase 0 — Compatibility verification (small):** point UI at gateway, run
  through all non-monitoring pages, remove `/config/llm-catalogs` references
  (none found), fix envelope edge cases.
- **Phase 1 — Monitoring replacement (core of this design):** Prometheus
  connector + hooks, OAM proxy + `prometheus_url`, rebuild Dashboard/Conntrack/
  NTop/Topology/Alert views, removals (§7), reference scrape config + example
  alert rules.
- **Phase 2 — AI-gateway configuration UI:** API keys, tenant rate limits,
  KV-cache-aware LB rule fields (P/D disaggregation, CHWBL tuning, endpoint
  roles), PII/LlamaFirewall/OPA config pages, cert store, L4/L7 trace config,
  config import/export against gateway.
- **Phase 3 — AI observability:** LLM dashboards from `loxilb_ai_*` and
  `loxilb_pd_ctrl_*` series (tokens/s, TTFT percentiles from
  `loxilb_ai_pd_decode_ttft_seconds`, P/D routing hit rates, rate-limit hits,
  per-model request rates), DPU counters page, KV inventory view, optional
  Alertmanager silences, optional cluster-aggregated views. Follows OTel GenAI
  semantic-convention expectations set by Kong AI / Envoy AI Gateway.
