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
`http://203.0.113.99:8080/oam/loxilbs/1/netlox/v1/config/<resource>`
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
| **l7policy** | GET/all POST DELETE+GET by id | ⏸ deferred | gateway feature unreleased (see §2.3) |
| **ai (apikey)** | GET POST DELETE (+PATCH via raw middleware) | ✅ built | UI done; **gateway needs `--userservice`** (see §2.2) |
| **ai (tenant ratelimit)** | POST + GET/{tenant_id} only (no DELETE, no list-all) | ✅ built (menu hidden) | UI done; **gateway needs `--userservice`** (see §2.2) |
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

**`serviceArguments` — MISSING but EXCLUDED (Octavia, unstable — per decision 2026-07-17):**
id, adminStateUp, projectId, connectionLimit, annotations, timeoutMemberConnect,
timeoutMemberData, timeoutTcpInspect. Not added to the UI type/form.

**`serviceArguments` — MISSING and IN SCOPE (AI-gateway, added):**

| Field | Type | Meaning |
|---|---|---|
| model_name | string | AI model routing key (endpoint-pool selector) |
| trace_type | string | tracing catalog name for deep inspection |
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

**`endpoints[]` — MISSING and IN SCOPE (AI-gateway, added):**

| Field | Meaning |
|---|---|
| ep_role | P/D role: 0 normal, 1 prefill, 2 decode |
| nixl_port | NIXL side-channel port for KV transfer |

**`endpoints[]` — MISSING but EXCLUDED (Octavia member/HM, unstable):**
backup, subnetId, monitorAddress, httpMethod, urlPath, expectedCodes,
httpVersion, domainName.

**Missing operations:** `PATCH /config/loadbalancer` (RFC 7386 merge-patch —
partial update without full re-create; the UI only re-POSTs today).

### 2.2 AI API keys + tenant rate limits (`/config/ai/apikey`, `/config/ai/tenant/ratelimit`)

**Built 2026-07-17** (`types/ai.ts`, `connector/instance/ai.ts`,
`pages/ai/AIApiKeyPage.tsx`, `pages/ai/AITenantRateLimitPage.tsx`). Types are
derived from the generated swagger types (`GwSchema<…>`), so they cannot drift.

**Schema notes (corrections to the §1 matrix as first drafted):**
- apikey: `POST` (201 returns `raw_key` **exactly once** — UI shows a one-time
  copy dialog), `GET` list (optional `tenant_id` filter), `GET`/`DELETE` by
  `key_id`. The gateway also serves `PATCH /config/ai/apikey/{key_id}` via raw
  middleware (enable/disable + limit updates, not in the vendored swagger) —
  a candidate follow-up for an enable/disable toggle in the UI.
- tenant ratelimit: `POST` is an **upsert**; `GET` exists **only per-tenant**
  (`/{tenant_id}`); there is **no DELETE and no list-all**. The UI derives the
  tenant list from tenants seen on API keys plus manual lookups.

**Tenant ≠ Octavia (decision 2026-07-17).** `tenant_id` here is the AI
gateway's own API-key quota grouping (validated per LLM request in
`ai_gateway_dp.go`, aggregate caps across a tenant's keys) — unrelated to the
excluded Octavia `projectId` on LB rules. It is server-side mandatory on key
creation, so it cannot be removed from the form. The **Tenant Rate Limits menu
item is hidden** (page + route remain at `/instance/ai/ratelimit`).

**Deployment finding (blocker for live validation).** On the testbed gateway
all four endpoints return **501 stubs**: the handlers are registered only when
the gateway runs with `--userservice --databasehost <mariadb>` (exactly how the
`ai-apikey` CICD scenario boots it, logging in as `admin`/`Admin123!` for a
JWT). With `--userservice` enabled the gateway enforces JWT auth on **every**
API call, which the current OAM proxy does not forward — so enabling the
feature on the shared testbed would break all other UI pages. Live validation
is **deferred** until either (a) an isolated gateway instance is spun up with
userservice + MariaDB, or (b) the OAM proxy learns to log into the gateway and
attach tokens. UI correctness was instead validated against the gateway
handler source (`api/restapi/handler/ai_apikey.go`) and the CICD request
bodies, which the UI-built JSON matches field-for-field.

### 2.3 L7 policy (`/config/l7policy`) — DEFERRED (decision 2026-07-17)

Gateway-source audit (requested before building the UI): the implementation is
**real end-to-end, not a mock** — `handler/l7policy.go` (609 lines, Octavia
validation, attach-before-store, 19 unit tests) → `NetL7PolicyApply` →
`DpProxyAttachL7Policy` CGO → `sockproxy_l7policy.c` (1,250 lines; matching,
FORWARD/REDIRECT/REJECT dispatch) invoked from the live request path
(`sockproxy_ep.c:410` HTTP/1, `sockproxy_h2.c:2457` HTTP/2).

**Deferred anyway because the feature is pre-release:** the handler comments
say "unreleased"; the policy registry is **in-memory only** (lost on gateway
restart); there is **no CICD scenario**; and the deployed testbed image 404s
`/config/l7policy/*` (feature exists only in source). Revisit when the gateway
ships it in an image with a CICD scenario. Ops when built: `GET /all`, `POST`
(policy references the LB's stable opaque `id`), `GET`/`DELETE /id/{id}`.

### 2.4 IPsec (`/config/ipsec/*`) — BUILT + live-validated (2026-07-17)

UI designed from a cross-product research pass (pfSense, OPNsense, FortiGate,
PAN-OS, Cisco, Meraki, strongSwan, MikroTik, AWS, Azure — see the session's
research report). Design choices applied:
- **Single tunnel form with P1/P2 sections** (matches the API's flat named-tunnel
  model), required fields = name/peers/auth/selectors, everything else defaulted
  behind an Advanced toggle (pfSense/FortiGate pattern).
- **Named policy presets** Default/AWS/Azure fill the proposal fields (Meraki
  pattern), all editable.
- **Cert auth = dropdowns into the cert store** (never inline upload), backed by
  the Certificates page with server-side **validate-before-install** feedback and
  expiry status columns.
- **Tunnels page** joins read-only SA data per tunnel + aggregate stats tiles;
  global settings (fast-path/HW offload/MTU) via dialog.
- **Edit = explicit delete+recreate** with warning (no tunnel update op; PSK
  must be re-entered — GET never returns it).

Pages: `pages/ipsec/IPsecTunnelPage.tsx`, `IPsecCertificatePage.tsx`; menu
section "IPsec VPN". **Live-validated on the testbed gateway** (deployed image
serves the full IPsec API): tunnel create 204 + full field round-trip on GET
(auto=add passive; PSK correctly withheld), delete 200; cert upload 201 with
parsed subject/issuer; CA upload 201; validate 200 with valid/keySize/warnings
(NOTE: validate requires `name` in the body); stats reflects tunnel counts.
Deployed-build quirk: cert notBefore/notAfter return zero-time (parsing gap) —
UI expiry status tolerates it.

**Gateway API gaps identified (authorized to add; not yet implemented):**
1. `POST /config/ipsec/tunnels/{name}/action` {initiate|terminate|restart} —
   every commercial product has per-tunnel connect/disconnect; the gateway even
   has an internal `initiateConnection()` not exposed via REST.
2. `PUT /config/ipsec/tunnels/{name}` — in-place update (server-side del+add)
   to replace the UI's delete+recreate edit.
3. Swagger default for `ikeEncryption` ("aes256-sha256-modp2048") is misleading —
   the conf generator composes `<enc>-<integrity>-<dh>` from single tokens.
4. `espDhGroup` is accepted but never written to the strongSwan `esp=` line —
   PFS is silently ignored.
5. The generated `ike=`/`esp=` lines always append a weak
   `aes128-sha1[-modp1024]` compatibility fallback — should be opt-in.

> Rows 2.5–2.x (firewall, endpoint, mirror, policy, securityrate PUT, cert PUT,
> ipv6) are filled in as each is
> audited during burndown — see §3.

---

## 3. Burndown checklist

Each item: audit fields → update type + connector + form → `tsc`/tests →
**validate live** against the gateway via the OAM proxy → commit → tick here.

- [x] **LB rule** — field parity (AI-gateway serviceArguments + endpoint P/D fields); Octavia fields excluded. **Validated live** (2026-07-17): POST 200 for a full aigw rule; 17/20 serviceArguments + both endpoint fields round-trip on GET; the 3 `None` (session_header_name, chwbl_*) are sel-conditional — confirmed round-trip under sel=8/sel=3. Finding: `pd_disagg_mode` requires `mode=fullproxy` (gateway 500s on aigw); delete-by-name is more reliable than the externalipaddress path for fullproxy rules.
- [x] LB rule — PATCH (merge-patch) edit path (2026-07-17): edit dialog now diffs
  against the original and PATCHes only changed mutable fields at
  `/config/loadbalancer/externalipaddress/{ip}/port/{port}/protocol/{proto}`;
  falls back to re-POST when the immutable VIP/port/proto key was changed.
  **Validated live**: PATCH inactiveTimeOut→120 round-trips (200); immutable
  `mode` correctly rejected 400 "cannot modify immutable field".
- [ ] Endpoint — P/D + HM member fields
- [ ] Firewall — field parity
- [ ] IP filter / synflood / securityrate — field parity; securityrate PUT
- [ ] Mirror / policy(QoS) — field parity
- [ ] SNI cert — PUT (rotate) support
- [ ] ipv6address — new form (parity with ipv4)
- [ ] vlan / vxlan / bfd / bgp — verify + fill gaps
- [~] **L7 policy** — DEFERRED (2026-07-17): gateway impl verified real end-to-end
  but unreleased (in-memory store, no CICD, not in deployed image) — see §2.3.
- [x] **AI API keys** — new resource (2026-07-17): table + create form + one-time
  raw-key dialog + delete; under new "AI Gateway" menu. Live validation deferred
  (gateway `--userservice` requirement — §2.2); contract validated against
  gateway handler source + CICD bodies.
- [x] **AI tenant rate-limits** — new resource (2026-07-17): upsert form + per-tenant
  lookup + table (tenants derived from API keys; API has no list-all/DELETE).
  Menu item hidden by decision; route live at `/instance/ai/ratelimit`. Same
  `--userservice` caveat as API keys.
- [x] **IPsec** — tunnels + certificates + ca-certificates (2026-07-17): research-driven
  UI (presets, advanced toggle, cert-store dropdowns, SA join, stats, global
  settings). **Live-validated end-to-end** on the testbed gateway — see §2.4.
  Follow-up: gateway tunnel action/update APIs (§2.4 gap list).

---

## 3a. CICD cross-check (gateway `cicd/run_local_cicd.sh`)

The gateway's required use-cases were cross-checked against the UI's field
coverage. Config bodies come from each scenario's `config.sh`.

| CICD scenario | Key fields used | UI covers? |
|---|---|---|
| tcplb / tcplbhash / tcplbmark / dsr variants | mode, sel, protocol | ✅ |
| tcplbmon / udplbmon / sctplbmon / tcplbmon6 | monitor, probetype/port/req/resp/timeout/retries | ✅ |
| sctplb / sctponearm / sctplbdsr | protocol=sctp, mode | ✅ (endpoint sctp probe added) |
| httpproxy / httpproxy-prefix | mode=4, host, path_prefix, path_match_mode, backend_protocol | ✅ |
| httpsproxy / -prefix | mode=4, security=1, host, backend_protocol | ✅ |
| e2ehttpsproxy / -prefix / -grpc | mode=4, security=2, host | ✅ |
| httpsproxy-mtls / e2ehttpsproxy-mtls | security + client-CA cert (mTLS) | ◐ verify SNI-cert/mTLS form |
| vllm-fullproxy / -wrr, vllm-httpproxy / -wrr | mode=4, sel, model routing | ✅ |
| **ai-model-routing** | model_name, path_prefix, path_match_mode | ✅ (model_name added) |
| **ai-sse-quota** | sse_mode + tenant rate-limit (`/config/ai/tenant/ratelimit`) | ✅ (rate-limit page built; menu hidden — §2.2) |
| **vllm-pd-disagg** | pd_disagg_mode, pd_cache_aware_mode, sse_mode, session_header_name, ep_role, nixl_port | ✅ (all added + live-validated) |
| **sglang-loxilb-kvcache** | kvExactMode, kvBlockSize, kvHashAlgo, kvZmqPort | ✅ (all added) |
| **ai-apikey** | `POST /config/ai/apikey` {tenant_id, name, allowed_models, rate_limit_rps, burst_size, tokens_per_min, expires_at, enabled} | ✅ (API Keys page built — §2.2; needs `--userservice` gateway) |
| mcp-fullproxy | mode=4 proxy | ✅ |

**Conclusion:** every classic + LB-level AI use case in CICD is now expressible
in the UI after the LB/endpoint field-parity work. The only CICD scenarios not
yet UI-configurable are the two **new resources already in our scope**: AI API
keys and AI tenant rate-limits (plus a verify pass on the mTLS SNI-cert form).

## 3b. Meta API finding (`GET /meta`)

The UI drives form field types/enums/validation/defaults from the gateway's
`GET /meta` (via `useFormWithParams`). **It is NOT stale.** `/meta` is
auto-generated from the gateway's embedded swagger
(`handler/metadata.go` → `AutoGenerateMetaData(EmbeddedSwagger)`), so it cannot
drift from the live API. Verified on the testbed: `/meta` already describes
every new LB field (model_name, sse_mode, pd_*, kv*, trace_type, …) and the new
resources (`/config/ai/apikey`, `/config/ai/tenant/ratelimit`, `/config/l7policy`,
`/config/ipsec/tunnels`). The form gaps were **not** caused by `/meta`; they were
caused by the form JSX hardcoding which fields to render. So: no gateway `/meta`
change is needed, and removing the meta-validation logic is optional (see the
recommendation in the session notes) — the higher-leverage option is to render
high-churn resource fields *from* `/meta` so new gateway fields appear
automatically.

## 4. Deferred / out of scope (this pass)

Requires 3rd-party endpoints or lower priority; documented so nothing is
silently dropped: **Octavia LB fields** (unstable — id, adminStateUp, projectId,
connectionLimit, annotations, timeoutMember*, timeoutTcpInspect, and the Octavia
member/health-monitor endpoint fields), **PII** (`/config/pii/*`), **LlamaFirewall**
(`/config/llamafirewall/*`), **OPA** (`/config/opa/watcher`), **GPU**
(`/config/gpu/*`), **tracing** (`/config/trace/*`, `/config/l4trace/*`),
**sessions** (`/config/session*`, `/config/sessionulcl*`), **CORS**
(`/config/cors/*`), **worker metrics**, **cistate**, **metrics**.
