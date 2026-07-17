# loxilb-ui ↔ inference-gateway API Gap Analysis & Burndown

**Purpose.** The gateway (`loxilb-inference-gateway`, live testbed reports
`v0.9.8.6-beta`) has moved well ahead of the UI's forms. This document is the
source-of-truth audit *and* the burndown checklist for closing the gap across
GET / POST / PUT(PATCH) / DELETE.

**Source of truth.** `api-spec/gateway-swagger.yml` (vendored latest) and its
codegen `src/api/gen/gateway.ts`. Every field claim here is diffed against that
schema, not memory.

**Live validation.** Each closed row is exercised against the real gateway
through the OAM proxy — no browser/credentials needed:
`http://223.130.142.175:8080/oam/loxilbs/1/netlox/v1/config/<resource>`
(admin bearer token). This validates the exact JSON body the UI builds.

**Scope (agreed 2026-07-17).**
- ✅ **In:** all ~19 existing forms → full field parity; **plus** new pages for
  the mature, self-contained AI-gateway resources: **L7 policy**, **AI API
  keys**, **AI tenant rate-limits**, **IPsec**.
- ❌ **Out (this pass):** features requiring 3rd-party endpoints/integrations —
  **PII**, **LlamaFirewall**, **OPA**. Also deferred: GPU controls, tracing
  (`/config/trace`, `/config/l4trace`), sessions/sessionulcl, CORS, worker
  metrics, cistate. (Listed in §4 for completeness; revisit later.)

---

## 1. Operation-coverage matrix

Legend: ✅ implemented · ◐ partial (works but missing fields) · ❌ missing · — n/a (schema has no such method)

| Resource (gateway root) | Methods in API | UI today | Gap kind |
|---|---|---|---|
| loadbalancer | GET POST PATCH DELETE | ◐ GET/POST/DELETE; ❌ PATCH | **field parity (major)** + no PATCH |
| endpoint | GET POST DELETE | ◐ | field parity (major: P/D + HM member fields) |
| conntrack | GET | ✅ | — |
| firewall | GET POST DELETE | ◐ | field parity |
| ipfilter | GET POST DELETE | ◐ | field parity |
| synflood | GET POST DELETE | ◐ | field parity |
| securityrate | GET POST PUT DELETE | ◐ GET/POST/DELETE; ❌ PUT | field parity + no PUT |
| mirror | GET POST DELETE | ◐ | field parity |
| policy (QoS) | GET POST DELETE | ◐ | field parity |
| route | GET POST DELETE | ✅ | verify |
| neighbor | GET POST DELETE | ✅ | verify |
| ipv4address | GET POST DELETE | ✅ | verify |
| ipv6address | GET POST DELETE | ❌ | missing (v4 only in UI) |
| vlan | GET POST DELETE | ◐ | field parity/verify |
| tunnel/vxlan | GET POST DELETE | ◐ | field parity/verify |
| bfd | GET POST DELETE | ◐ | field parity/verify |
| bgp (neigh/policy/global) | GET POST DELETE | ◐ | field parity/verify |
| fdb | GET POST DELETE | ✅ | verify |
| port | GET | ✅ | — |
| cert (SNI) | GET POST PUT DELETE | ◐ GET/POST/DELETE; ❌ PUT | field parity + no PUT |
| params | GET POST | ◐ GET | verify POST |
| **l7policy** | GET POST DELETE | ❌ | **new resource (in scope)** |
| **ai (apikey)** | GET POST DELETE | ❌ | **new resource (in scope)** |
| **ai (tenant ratelimit)** | GET POST DELETE | ❌ | **new resource (in scope)** |
| **ipsec** (tunnels/certs/ca) | GET POST DELETE | ❌ | **new resource (in scope)** |
| gpu / pii / llamafirewall / opa / trace / l4trace / session / sessionulcl / cors / worker / cistate / metrics | various | ❌ | out of scope this pass (§4) |

---

## 2. Field-level gaps — priority resources

### 2.1 Load balancer (`/config/loadbalancer`, schema `LoadbalanceEntry`)

**`serviceArguments` — present in UI type (`IServiceArguments`):**
name, externalIP, privateIP, port, portMax, protocol, inactiveTimeOut, sel,
bgp, monitor, probetype, probeport, probereq, proberesp, managed, mode,
security, block, probeTimeout, probeRetries, snat, oper, host,
proxyprotocolv2, egress, path_prefix, path_match_mode, llm_type,
backend_protocol.

**`serviceArguments` — MISSING (in schema, not in UI):**

| Field | Type | Meaning |
|---|---|---|
| id | string | Octavia stable opaque LB id (client-supplied or minted) |
| adminStateUp | bool | Octavia lifecycle flag (false = paused) |
| projectId | string | Octavia tenant/project id (opaque) |
| connectionLimit | uint32 | per-service concurrent-connection ceiling |
| annotations | map[string]string | opaque Octavia round-trip map |
| model_name | string | AI model routing key (endpoint-pool selector) |
| trace_type | string | tracing catalog name for deep inspection |
| timeoutMemberConnect | uint32 ms | backend connect timeout (L7 proxy) |
| timeoutMemberData | uint32 ms | member relay idle timeout |
| timeoutTcpInspect | uint32 ms | header-accumulation deadline (slowloris) |
| sse_mode | bool | SSE streaming mode (suppress idle timeout) |
| max_stream_duration_sec | int32 | absolute cap for SSE streams (0 = 24h) |
| backend_keepalive_interval_sec | int32 | SO_KEEPALIVE/TCP_KEEPIDLE on backend |
| pd_disagg_mode | bool | vLLM prefill/decode disaggregation |
| pd_cache_aware_mode | bool | P/D cache-aware routing |
| pd_session_ttl_sec | int32 | session stickiness TTL for P/D |
| pd_cache_threshold | int32 (0-100) | P/D cache match threshold |
| pd_balance_abs_threshold | int32 | P/D load-imbalance threshold |
| kvExactMode | int64 (0-3) | KV-cache exact routing mode |
| kvBlockSize | int64 | token block size for KV hash |
| kvHashAlgo | enum | sha256_cbor / xxhash_cbor |
| kvZmqPort | int (1-65535) | ZMQ PUB port on prefill EPs |
| session_header_name | string | header carrying session key (sel=persist) |
| chwbl_prefix_hash_level | int | CHWBL prefix hash level (sel=8) |
| chwbl_prefix_hash_flags | int | CHWBL prefix hash flags |

**`endpoints[]` — present in UI (`IEndpoint`):** endpointIP, weight, targetPort, state, counter.

**`endpoints[]` — MISSING:**

| Field | Meaning |
|---|---|
| ep_role | P/D role: 0 normal, 1 prefill, 2 decode |
| nixl_port | NIXL side-channel port for KV transfer |
| backup | Octavia standby member |
| subnetId | Octavia member subnet id (opaque) |
| monitorAddress | per-member health-probe address |
| httpMethod | HM method (GET/HEAD) |
| urlPath | HM request path |
| expectedCodes | HM expected codes ("200", "200,202", "200-204") |
| httpVersion | HM HTTP version ("1.0"/"1.1") |
| domainName | HM TLS SNI + Host header |

**Missing operations:** `PATCH /config/loadbalancer` (RFC 7386 merge-patch —
partial update without full re-create; the UI only re-POSTs today).

> Rows 2.2–2.x (firewall, endpoint, mirror, policy, securityrate PUT, cert PUT,
> ipv6, l7policy, ai/apikey, ai/ratelimit, ipsec) are filled in as each is
> audited during burndown — see §3.

---

## 3. Burndown checklist

Each item: audit fields → update type + connector + form → `tsc`/tests →
**validate live** against the gateway via the OAM proxy → commit → tick here.

- [ ] **LB rule** — field parity (serviceArguments + endpoints), keep negative-strip/probe-clean logic; live POST round-trip
- [ ] LB rule — add PATCH (merge-patch) path for edits
- [ ] Endpoint — P/D + HM member fields
- [ ] Firewall — field parity
- [ ] IP filter / synflood / securityrate — field parity; securityrate PUT
- [ ] Mirror / policy(QoS) — field parity
- [ ] SNI cert — PUT (rotate) support
- [ ] ipv6address — new form (parity with ipv4)
- [ ] vlan / vxlan / bfd / bgp — verify + fill gaps
- [ ] **L7 policy** — new resource (GET/POST/DELETE)
- [ ] **AI API keys** — new resource
- [ ] **AI tenant rate-limits** — new resource
- [ ] **IPsec** — tunnels + certificates + ca-certificates

---

## 4. Deferred / out of scope (this pass)

Requires 3rd-party endpoints or lower priority; documented so nothing is
silently dropped: **PII** (`/config/pii/*`), **LlamaFirewall**
(`/config/llamafirewall/*`), **OPA** (`/config/opa/watcher`), **GPU**
(`/config/gpu/*`), **tracing** (`/config/trace/*`, `/config/l4trace/*`),
**sessions** (`/config/session*`, `/config/sessionulcl*`), **CORS**
(`/config/cors/*`), **worker metrics**, **cistate**, **metrics**.
