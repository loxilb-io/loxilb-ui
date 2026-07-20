# CICD-Scenario E2E Test Plan (Playwright, UI-config + REST validation)

Internal plan for **scenario-based** browser tests that replay every
qualifying `loxilb-inference-gateway/cicd/*` scenario as a **UI
configuration recipe** and validate the result against the **REST API
response** — for **loxilb core + inference-gateway both**. No real traffic
is generated; each spec drives the loxilb-ui, then asserts the gateway
accepted and returns the exact configuration.

This is the scenario companion to `docs/E2E_CRUD_TEST_PLAN.md` (per-page
field-complete CRUD). That plan proves each *form* works; this plan proves
each *cicd recipe* is reproducible from the UI and round-trips through the
gateway. They share the same runner, fixtures, and helpers.

Source: `/Users/gongseoghwan/go/src/loxilb-inference-gateway/cicd`
(148 dirs surveyed 2026-07-20).

---

## 0. Governing principle — cicd is the source of truth

**If a cicd scenario configures something the UI or OAM cannot express,
that is a GAP to FIX in `loxilb-ui` / `oam-loxilb` — not a test to skip.**

Each in-scope scenario is either:

- **✅ Configurable** — UI already exposes every field the cicd recipe
  sets → write the spec, it should pass.
- **⚠️ Gap** — UI/OAM is missing a field, enum value, mode, or route the
  cicd recipe needs → file it in §7 Gap Backlog, fix the product, then the
  spec lights up. The spec is written to the cicd recipe regardless (it
  fails/red until the gap is closed), so it documents the target.

The only legitimate skip is a *data-plane / traffic-only* assertion (which
this plan deliberately excludes) or a *multi-node topology* the single-node
testbed cannot stand up (recorded per-scenario, config slice still tested).

---

## 1. Scope & filtering decisions (recorded 2026-07-20)

### Excluded by rule (user constraint)

All Kubernetes / cloud scenarios: `k8s-*`, `k3s-*`, `k0s-*`, `docker-k*`,
`eks`, `microk8s-*`, `k8slbsim`, and `vllm-loxilb-kvcache-aws-small`
(~47 dirs). Plus meta/infra dirs that are not scenarios: `api`, `common`,
`cicd`, `data-store`, `pkg-smoke`, and the shell-glob artifact dirs
(`mcp*`, `sglang-*`, `vllm-*`, `ipsec*`).

### Excluded by decision

| Group | Dirs | Decision & why |
|---|---|---|
| **Perf / load** | `perf`, `tcpepscale`, `tcpkali`, `tcplbcps`, `tcpsctpperf`, `iperf3lb`, `sctplb-seagull`, `sctpmh-seagull` | **Exclude.** Validate throughput/scale via real traffic generators; the only UI-configurable part is a basic LB rule already covered. |
| **ULCL / 5G session** | `ulcltcplb`, `ulclsctplb` | **Exclude — feature deprecated.** ULCL (`sessionulcl`) will not be supported going forward. (`UlclArgumentInputForm.tsx` / `session_ulcl.ts` are candidates for later removal.) |
| **Multi-node HA (full)** | `sync` (Vagrant/VirtualBox), full 2-node data-plane behavior of `cluster*`/`ha1` | **Exclude the multi-node behavior.** Single-node testbed can't stand up peers. The **config slice** (HA/cistate, BGP neighbor/global) is kept — see Group F. |

### Included

L4 LB (all modes/selects/probes/timeouts), L7 proxy (http/https/e2ehttps/
host/prefix/mtls/grpc/http2), NAT (nat64/66, masquerade), IPsec
tunnel+LB combos, security filter, HA/BGP **config slices**, and the
AI-gateway set (ai-*, plus vllm/sglang/mcp **collapsed to config
surfaces**).

### Granularity decisions

- **L4 / L7 / NAT variants → one spec per cicd dir** (max traceability;
  each spec header cites its `cicd/<dir>`).
- **AI LLM-backend variants (vllm/sglang/mcp) → collapsed to config
  surfaces** (proxy modes, WRR weights, KV-cache routing, PD-disagg,
  MCP session-header). Real GPU/LLM backends are never required — only
  the LB+AI config is exercised.
- **Cluster/HA → config-only slices** (2 specs: HA cistate, BGP).

---

## 2. Methodology — per scenario

Each spec follows the same shape (no traffic anywhere):

1. **Read the cicd recipe.** Extract the exact config the scenario's
   `config.sh` creates (VIP, ports, protocol, mode, select, security,
   host, probe, timeout, endpoints+weights, AI flags, firewall/snat,
   ipsec tunnel).
2. **Drive the UI.** Reproduce that recipe through the real loxilb-ui
   forms (LB / Firewall / IPsec / BGP / HA / AI pages), using
   documentation IPs and `e2e-cicd-<scenario>` names.
3. **Assert the POST/PUT payload** (`page.waitForRequest`) carries every
   field from the recipe verbatim — this is where UI→gateway fidelity is
   proven.
4. **Assert the REST response / read-back.** Re-`GET` the resource via the
   gateway (`helpers/api.ts`) and assert the returned object matches the
   recipe (mode, sel, sec, endpoints, weights, AI params …). This is the
   "validation based on REST API response" the plan is named for.
5. **Assert app health** — zero uncaught console errors, no full-app
   error-page redirect (F15 guard), inherited from `fixtures.ts`.
6. **Cleanup** — every mutation paired with delete; `zz-cleanup` leak
   detector sweeps `e2e-cicd-*` / documentation-IP strays.

Values reuse the CRUD-plan safety envelope: documentation IPs
(`203.0.113.0/24`, `198.51.100.0/24`, `2001:db8::/32`), VLAN/VXLAN 3999,
inert-high thresholds, and read-modify-restore for any global/shared
config (BGP global, HA, SYN-flood).

---

## 3. Layout — `e2e/tests/cicd/`

New subtree, distinct from the per-page CRUD specs, sharing
`e2e/fixtures.ts` + `e2e/helpers/*`:

```
e2e/tests/cicd/
  lb-l4/        # TCP/UDP/SCTP LB modes, selects, probes, timeouts (1 spec/dir)
  l7-proxy/     # http/https/e2ehttps/host/prefix/mtls/grpc/http2 (1 spec/dir)
  nat/          # nat64/66, ip-masquerade (1 spec/dir)
  ipsec/        # ipsec tunnel + LB combos (1 spec/dir)
  security/     # secfilter
  ha/           # HA cistate + BGP config slices (from cluster*/ha1)
  ai-gateway/   # ai-* + collapsed vllm/sglang/mcp config surfaces
  _recipes.ts   # shared recipe constants (VIP/port/endpoint fixtures per scenario)
```

Each spec file names its origin in the header comment, e.g.
`// cicd source: cicd/tcplbdsr1 — TCP LB, select=hash, mode=dsr`.

---

## 4. Group A — L4 Load Balancer (`cicd/lb-l4/`, one spec per dir)

Route `/instance/traffic/lb` · `POST/PATCH/DELETE /config/loadbalancer*`.
Recipe columns are the exact `create_lb_rule` / `loxicmd create lb` flags.

### TCP

| Spec (cicd dir) | proto/ports | mode | select | endpoints / notes | REST assert | Status |
|---|---|---|---|---|---|---|
| `tcplb` | tcp 2020:8080 | dnat | rr | 3 eps w1; also port-range 1000-2000 rule | rule + 3 eps + range | ✅ |
| `tcplb-local` | tcp 2020:8080 | dnat | rr | ep = VIP host (local) | rule created | ✅ |
| `tcplb-src` | tcp 2020:8080 | dnat | rr | `--sources=10.10.10.1/32` → allowedSources[] | allowedSources in body | ✅ |
| `tcplbhash` | tcp 2020:8080 | dnat | **hash** | 3 eps | sel=hash | ✅ |
| `tcplblc` | tcp 2020:8080 | dnat | **lc** | 3 eps | sel=lc | ✅ |
| `wrrtcplb1` | tcp 2020:8080 | dnat | **priority** | eps weighted 80/20 | weights in body | ✅ |
| `wrrtcplb2` | tcp 2020:8080 | dnat | **priority** | eps 40/40/20 | weights | ✅ |
| `tcplbdsr1` | tcp 2020:2020 | **dsr** | hash | 3 eps | mode=dsr | ✅ |
| `tcplbdsr2` | tcp 2020:2020 | **dsr** | hash | 3 eps (variant) | mode=dsr | ✅ |
| `tcplbl3dsr` | tcp 8080:8080 | **dsr** | hash | L3DSR eps | mode=dsr | ⚠️ verify L3DSR flag |
| `tcplbl3dsrha` | tcp 8080:8080 | dsr | hash | + BGP/HA (config slice only) | mode=dsr; HA→Group F | ⚠️ HA slice |
| `tcptunlb` | tcp 2020:8080 | dnat (tunnel topo) | rr | remote VIP 88.88.88.88 | rule created | ⚠️ verify tunnel endpoint |
| `tcplbmark` | tcp 2020:8080 | dnat | rr | `--mark=10` + firewall mark rule | mark in body + fw rule | ⚠️ verify LB mark field |
| `tcplbepmod` | tcp 2020:8080 | dnat | rr | endpoint modify (PATCH weight) | E-patch weight | ✅ |
| `tcplbmaxep` | tcp 2020:8080 | dnat | rr | many eps (16+) | all eps persisted | ✅ |
| `tcplbmon` | tcp 2020:8080 | dnat | rr | `--monitor` | monitor=true | ✅ |
| `tcplbmon6` | tcp 2020:8080 (+v6 VIP) | dnat | rr | monitor + IPv6 VIP | monitor + v6 | ✅ |
| `lbtimeout` | tcp 2020:8080 | dnat | rr | `--inatimeout=30` | inactiveTimeOut=30 | ✅ |
| `lb6timeout` | tcp (+v6) | dnat | rr | inatimeout + IPv6 | timeout + v6 | ✅ |

### UDP

| Spec | proto/ports | select | notes | Status |
|---|---|---|---|---|
| `udplb` | udp 2020:8080 | rr | 3 eps | ✅ |
| `udplbmon` | udp 2020:8080 | rr | `--monitor` | ✅ |
| `udplb-persist` | udp 2020:8080 | **persist** | select=persist | ✅ |

### SCTP

| Spec | proto/ports | mode | select | notes | Status |
|---|---|---|---|---|---|
| `sctplb` | sctp 2020:8080 (+tcp companion) | dnat | rr | 3 eps | ✅ |
| `sctplblc` | sctp 2020:8080 | dnat | **lc** | | ✅ |
| `sctplbdsr` | sctp 2020:2020 | **dsr** | hash | | ✅ |
| `sctplbmon` | sctp 2020:8080 | dnat | rr | `--monitor` | ✅ |
| `sctpfullnat` | sctp 38412:38412 | **fullnat** | rr | 2 eps | ✅ |
| `sctpfullnatl2` | sctp 38412:38412 | **fullnat** | rr | L2 variant | ✅ |
| `sctponearm` | sctp 38412:38412 | **onearm** | rr | | ✅ |
| `sctptunlb` | sctp 2020:8080 | dnat (tunnel) | rr | remote VIP 88.88.88.88 | ⚠️ verify tunnel |
| `sctpmh` | sctp 2020:9999 | **fullnat** | rr | `--name` + `--secips` (secondaryIPs[2]) multihoming; HA ka → slice | ✅ (secips) / ⚠️ HA slice |

### Onearm / egress

| Spec | recipe | Status |
|---|---|---|
| `onearml2` | tcp 2020:8080, `--mode=onearm`, eps on 100.100.100.0/24 | ✅ |
| `egresslb` | lb 88.88.88.88 + lb 0.0.0.0:9999 + `firewall` + `cistate` (egress) | ⚠️ verify egress/cistate UI |

**Group A REST assertion pattern:** after create, `GET
/config/loadbalancer/all` → find the rule by name/VIP:port → assert
`serviceArguments.{sel,mode,inactiveTimeOut,block,monitor}` and
`endpoints[].{endpointIP,targetPort,weight}` equal the recipe.

---

## 5. Group B — L7 Proxy (`cicd/l7-proxy/`, one spec per dir)

All `mode=fullproxy`; differ by `security`, `host`, `path_prefix`,
`path_match_mode`, `backend_protocol`, mTLS.

| Spec (cicd dir) | security | host | extras | Status |
|---|---|---|---|---|
| `httpproxy` | Plain | 10.10.10.254 | fullproxy | ✅ |
| `httpproxy-prefix` | Plain | — | path_prefix + path_match_mode=prefix | ✅ |
| `httpsproxy` | **https** | 10.10.10.254 | TLS terminate | ✅ |
| `httpsproxy-prefix` | https | — | + path_prefix/prefix | ✅ |
| `httpsproxy-mtls` | https | — | **client-cert / mTLS** | ⚠️ verify mTLS control |
| `httpshostproxy` | https | **loxilb.io** | host-based routing (`--proxyonlymode`) | ✅ |
| `httpsep` | — | — | endpoint `probetype=https` (probe, not LB sec) | ✅ |
| `e2ehttpsproxy` | **e2ehttps** | 10.10.10.254 | end-to-end TLS | ✅ |
| `e2ehttpsproxy-prefix` | e2ehttps | — | + path_prefix/prefix | ✅ |
| `e2ehttpsproxy-mtls` | e2ehttps | — | + **mTLS** | ⚠️ verify mTLS control |
| `e2ehttpsproxy-grpc` | e2ehttps | — | **gRPC backend** (backend_protocol) | ⚠️ verify grpc (http2?) |
| `http2ep` | — | — | `backend_protocol=http2` | ✅ |
| `http2-prefix-lb` | — | — | http2 + path_prefix/prefix | ✅ |

**REST assert:** `serviceArguments.{security, host, pathPrefix,
pathMatchMode, backendProtocol, proxyProtocolV2}` match recipe.

**Known gap candidates (→ §7):** mTLS client-cert control and an explicit
gRPC backend option. `securities.json` has no `mtls`; `backend_protocols`
has no `grpc`. If cicd requires them as distinct config, add them.

---

## 6. Group C — NAT (`cicd/nat/`), D — IPsec (`cicd/ipsec/`), E — Security

### C. NAT — one spec per dir

| Spec | recipe | UI surface | Status |
|---|---|---|---|
| `nat64tcp` | lb on IPv6 VIP `2001::1`, IPv4 eps | LB (v6 VIP + v4 eps) | ✅ |
| `nat66tcp` | v6 VIP + v6 eps, tcp | LB | ✅ |
| `nat66udp` | v6 VIP + v6 eps, udp | LB | ✅ |
| `nat66sctp` | v6 VIP + v6 eps, sctp | LB | ✅ |
| `ipmasquerade` | `firewall --snat=10.10.10.254` (portName rule) | Firewall (doSnat/toIP) | ✅ |
| `ipmasquerade6` | v6 lb + masquerade | LB + Firewall | ✅ |

### D. IPsec — one spec per dir (`/config/ipsec/tunnels*` + `/config/loadbalancer`)

| Spec | recipe | Status |
|---|---|---|
| `ipsec1` | ipsec tunnel(s) + `lb 20.20.20.1 tcp 2020:8080` (dnat) | ✅ tunnel+LB |
| `ipsec2` | ipsec tunnel(s) + LB (variant proposals) | ✅ |
| `ipsec3` | ipsec + `lb 192.168.10.200 --mode=onearm` | ✅ |
| `ipsec-e2e` | ipsec + `lb --mode=fullnat` + endpoints | ✅ |

Reuses the tunnel form patterns from `e2e/tests/ipsec/tunnels.spec.ts`
(PSK, IKE/ESP proposals, subnets, DPD). No traffic — assert tunnel row
DOWN + LB rule created + both round-trip via REST. Multi-node peer
liveness is out of scope (single-node testbed).

### E. Security — `cicd/security/secfilter.spec.ts`

`create_lb_rule` + security/XDP filter. Reproduce the LB rule + the
associated IP-filter/security config; assert both via REST. Overlaps
`e2e/tests/security/ipfilter.spec.ts` — reuse its helpers.

---

## 7. Group F — HA / BGP config slices (`cicd/ha/`)

Per the cluster/HA decision: **config-only**, single-node. Two specs
distilled from `cluster1/2/3`, `cluster-intKA(-vip)`, `ha1`:

| Spec | From | Config exercised | Assert (no failover) | Status |
|---|---|---|---|---|
| `ha-cistate.spec.ts` | `ha1`, `cluster*` (`--with-ka`) | HA / cluster instance state (`/config/cistate`), fullnat LB rule used by HA scenarios | PUT fires; read-back state; **restore** | ⚠️ verify cistate UI (`status/ha`) |
| `bgp-neighbor.spec.ts` | `cluster1/2/3`, `intKA` (`--with-bgp`) | BGP neighbor (`remoteAs 64512`, VLAN-11 peer), BGP global assert-render only | neighbor POST/read-back; global read-modify-restore | ✅ (network/bgp) |

Reuses `e2e/tests/network/bgp.spec.ts` + `e2e/tests/status/ha.spec.ts`
patterns; BGP global stays assert-render + V-only (a bad global config is
the one mutation that can disturb testbed routing).

---

## 8. Group G — AI Gateway (`cicd/ai-gateway/`, collapsed to config surfaces)

`ai-*` map 1:1; `vllm-*`/`sglang-*`/`mcp-*` collapse to the distinct config
surface each demonstrates (real backends never required).

| Spec | cicd source(s) | Config surface (UI → POST) | Status |
|---|---|---|---|
| `ai-apikey.spec.ts` | `ai-apikey` | `/config/ai/apikey` CRUD, tenant ratelimit (extends existing `ai/apikey.spec.ts`) | ✅ (auto-skip if no `--userservice`) |
| `ai-model-routing.spec.ts` | `ai-model-routing` | LB rules with `model_name` (llama-70b / mistral-7b / wildcard); assert routing rules via REST | ✅ |
| `ai-sse-quota.spec.ts` | `ai-sse-quota` | LB `sse_mode=true`, `inactiveTimeOut`, `max_stream_duration_sec`, `backend_keepalive_interval_sec` | ✅ |
| `ai-proxy-modes.spec.ts` | `vllm-httpproxy`, `vllm-fullproxy`, `mcp-httpproxy`, `mcp-fullproxy`, `mcp-e2ehttps` | mode=fullproxy + `llm_type`, security (https/e2ehttps), host — param loop | ✅ / ⚠️ verify `llm_type` field |
| `ai-wrr.spec.ts` | `vllm-httpproxy-wrr`, `vllm-fullproxy-wrr` | weighted endpoints under proxy mode (select=priority) | ✅ |
| `ai-kvcache-routing.spec.ts` | `vllm-kvcache-routing-cpu`, `sglang-loxilb-kvcache` | `select=chwbl(8)`, `chwbl_prefix_hash_level`, `kvExactMode`, `kvBlockSize`, `kvHashAlgo`, `kvZmqPort` | ✅ (chwbl present) |
| `ai-pd-disagg.spec.ts` | `vllm-pd-disagg` | `pd_disagg_mode`, `pd_cache_aware_mode`, `pd_session_ttl_sec`, `endpoints[].ep_role`(prefill/decode), `nixl_port` | ✅ (ep_roles present) |
| `ai-mcp-session.spec.ts` | `mcp-fullproxy`, `mcp-direct-test(-https)` | `session_header_name=mcp-session-id` + host + fullproxy/https | ✅ |

These reuse the AI-gateway matrix already proven in
`e2e/tests/traffic/lb.spec.ts` (C-aigw-stream/pd/kv). AI-apikey/ratelimit
auto-skip on a testbed without `--userservice` (probe → 501), matching the
existing convention.

---

## 9. Gap backlog — features to fix in loxilb-ui / oam-loxilb

Where the UI/OAM cannot yet express a cicd recipe, the spec is written to
the cicd target and stays red until fixed. Verify each during
implementation; promote confirmed gaps to tickets.

Status legend: **BUILD** = confirmed product change to make (user decision
2026-07-20); **VERIFY** = confirm whether already covered before writing red.

| # | Gap | cicd needing it | Where | Action | Status |
|---|---|---|---|---|---|
| CG-1 | **mTLS client-cert** control on L7 proxy | `httpsproxy-mtls`, `e2ehttpsproxy-mtls` | loxilb-ui LB `SecurityOptionsForm` (+ connector, + gateway if needed) | **Add mTLS control** — client CA / verify mode fields | **BUILD** |
| CG-2 | **gRPC backend** protocol option | `e2ehttpsproxy-grpc` | `backend_protocols.json` (+ LB subform + connector) | **Add `grpc`** as a distinct backend protocol value | **BUILD** |
| CG-3 | **LB `--mark`** (fwmark on rule) | `tcplbmark` | LB form / `IServiceConfiguration` | Verify `block`/mark field maps; add if missing | VERIFY |
| CG-4 | **Egress LB / cistate** surface | `egresslb` | LB egress + `/config/cistate` | **Add egress UI controls** (egress rule + cistate) | **BUILD** |
| CG-5 | **Tunnel endpoint** (tunlb) control | `tcptunlb`, `sctptunlb` | LB endpoint config | **Add tunnel-endpoint UI control** (remote-VIP / tunnel type) | **BUILD** |
| CG-6 | **HA cistate** edit round-trip on single node | `ha1`, `cluster*` | `status/ha` page / OAM | Confirm PUT + read-back works standalone | VERIFY |
| CG-7 | **L3DSR** distinct flag | `tcplbl3dsr` | LB mode/args | Confirm dsr vs l3dsr distinction in gateway metadata | VERIFY |
| CG-8 | **`llm_type`** field surfaced | `vllm-*` proxy modes | LB AI subform | Verify present in AI-gateway sub-form | VERIFY |
| CG-9 | **AI userservice** on CI gateway | `ai-apikey`, `ai-sse-quota` | oam-loxilb / gateway launch | **Enable `--userservice`** on the CI gateway so AI specs run for real (no auto-skip) | **BUILD** |

**Build items (CG-1, CG-2, CG-4, CG-5, CG-9)** are prerequisites: land the
product change first, then the corresponding cicd spec goes green. Each
spec header links its CG-#. CG-1/CG-2/CG-4/CG-5 are loxilb-ui (and
possibly gateway) changes; CG-9 is an oam-loxilb / gateway launch change.

(Most Group-A/B/C rows are ✅ — the UI already exposes modes dnat/onearm/
fullnat/dsr/fullproxy/hostonearm/aigw, selects rr/hash/priority/persist/
lc/chwbl, securities Plain/https/tls/e2ehttps, backend http1/http2/both,
probe tcp/udp/sctp/http/https/ping, path prefix/exact, ep_role prefill/
decode. The gaps above are the narrow residue.)

---

## 10. Infrastructure reuse

Same toolchain as `docs/E2E_CRUD_TEST_PLAN.md` §0 — nothing new to build:

- Runner `@playwright/test` 1.61.x, `playwright.config.ts`
  (baseURL `.../netlox`, HTTP dev server, workers=1).
- `e2e/auth.setup.ts` (storageState per role), `e2e/fixtures.ts`
  (console-error + F15 guards, auto).
- Helpers: `table.ts`, `dialogs.ts`, `form.ts`, `api.ts` (request-capture
  assertions + gateway read-back + per-resource cleanup sweeps).
- New: `e2e/tests/cicd/_recipes.ts` — the per-scenario recipe constants
  (VIP/port/proto/mode/sel/eps) so specs read like the cicd table above.

Selector gotchas already catalogued in CRUD plan §10 apply verbatim
(ParamBox aria-label regex, MUI Select onChange-on-change, accordion
tooltip interception, `baseURL` trailing slash).

---

## 11. Execution, sequencing & DoD

- **Order:** OAM auth (storageState) → `cicd/lb-l4` → `l7-proxy` → `nat`
  → `security` → `ipsec` → `ha` → `ai-gateway`. Serial (workers=1;
  shared live gateway). `zz-cleanup.spec.ts` leak detector runs last and
  hard-fails on any `e2e-cicd-*` / documentation-IP stray.
- **Per-spec DoD:**
  1. UI recipe drives the exact cicd config.
  2. POST/PUT payload asserted field-for-field against the recipe.
  3. Gateway read-back (GET) asserted equal to the recipe (the REST
     validation).
  4. App health: no console errors, no error-page redirect.
  5. Every mutation cleaned up; read-modify-restore for shared/global.
  6. Green 2× consecutively (flake check) — OR red with a CG-# gap ticket
     linked in the spec header if a gap blocks it.
- **Run cadence:** nightly/manual against the live testbed (tens of
  minutes serial), not per-commit, until CI wiring is decided.

---

## 12. Scenario count (in-scope)

| Group | Specs | Notes |
|---|---|---|
| A — L4 LB | ~31 | one per dir (TCP 19, UDP 3, SCTP 9) |
| B — L7 proxy | 13 | one per dir |
| C — NAT | 6 | one per dir |
| D — IPsec | 4 | one per dir |
| E — Security | 1 | secfilter |
| F — HA/BGP slice | 2 | distilled from cluster*/ha1 |
| G — AI gateway | 8 | ai-* 1:1 + vllm/sglang/mcp collapsed |
| **Total** | **~65** | |

Excluded: ~47 k8s/cloud, 8 perf/load, 2 ULCL (deprecated), `sync` + full
multi-node HA behavior, meta/infra dirs.

---

## 13. Resolved decisions (2026-07-20)

1. **AI userservice (CG-9): ENABLE.** `--userservice` will be enabled on
   the CI gateway so `ai-apikey`/`ai-sse-quota` run for real. AI specs
   keep the 501 auto-skip guard only as a safety net for non-CI runs.
2. **mTLS / gRPC (CG-1/CG-2): BUILD.** Both are real product gaps —
   **add an mTLS client-cert control** to the L7 proxy security form and
   **add `grpc`** as a distinct backend-protocol value (not aliased to
   http2). Land these in loxilb-ui (+ gateway metadata if needed) before
   the `*-mtls` / `*-grpc` specs.
3. **Tunnel & egress (CG-4/CG-5): BUILD new UI controls.** Add explicit
   tunnel-endpoint config (`tcptunlb`/`sctptunlb`) and egress LB + cistate
   controls (`egresslb`) to the UI, rather than approximating with plain
   rules.
4. **IPsec single-node: config-created only.** Specs assert the tunnel +
   LB config is created and round-trips via REST; peer liveness / real
   tunnel bring-up is out of scope (no second node stood up).
5. **Overlap with CRUD plan: thin wrappers.** cicd specs are thin,
   scenario-named wrappers over the shared helpers (`_recipes.ts` +
   `helpers/*`), asserting recipe fidelity + REST read-back — they do not
   re-implement the field-complete assertions already in
   `traffic/lb.spec.ts` etc.

### Build-first sequencing

Product changes land before their specs go green:
`CG-9 (userservice)` → AI group · `CG-1/CG-2 (mTLS/gRPC)` → l7-proxy
`*-mtls`/`*-grpc` · `CG-4/CG-5 (egress/tunnel)` → `egresslb`/`*tunlb`.
Everything else (✅ rows) can be implemented immediately against today's
UI. Recommended build order: scaffold `_recipes.ts` + `cicd/lb-l4`
(all ✅) first as the reference group, then l7-proxy/nat, then the
BUILD-gated specs as their product changes merge.

---

## 14. Confirmed loxilb-ui gaps (code-grounded, 2026-07-20)

Reading the actual LB form corrected the §9 "✅ vs verify" estimate — the
LB dialog exposes **fewer** fields than the enum JSONs imply. `LBInputForm`
renders `Basic / Advanced / AIGateway / SecondaryIP / AllowedSources /
Endpoints` only. `SecurityOptionsForm` is **imported but never mounted**
(and still uses the pre-F19 stale-spread `onChange({...value})`), and the
Security/Block/Egress/SNAT/ProxyProtocolV2/PrivateIP controls in
`AdvancedSettingsForm` are **commented out**. So today's dialog offers
**none** of them.

Good news: `IServiceArguments` already types `security, block, snat,
egress, proxyprotocolv2, privateIP`; the connector POSTs `serviceArguments`
wholesale (no field stripping except probe-when-monitor-off); and i18n
labels already exist. So these are **re-enablement** (uncomment + convert
to the delta `onChange({[field]:v})` pattern), not net-new — the gateway
already accepts them (cicd proves it).

| Gap feature | Type? | i18n? | cicd scenarios blocked | Effort |
|---|---|---|---|---|
| **Security** dropdown (Plain/https/tls/e2ehttps), fullproxy-gated | ✅ | ✅ | all `httpsproxy*`, `e2ehttpsproxy*`, `httpshostproxy`, AI proxy TLS | re-enable |
| **Block** (fwmark on rule) | ✅ | ✅ | `tcplbmark` (CG-3) | re-enable |
| **Egress** | ✅ | ✅ | `egresslb` (part of CG-4) | re-enable |
| **SNAT** | ✅ | ✅ | `egresslb`/masquerade-style | re-enable |
| **Proxy Protocol v2** | ✅ | ✅ | (no direct cicd; parity) | re-enable |
| **Private IP** (fullnat source) | ✅ | ✅ | fullnat scenarios that set it | re-enable |
| **mTLS** client-cert control | ✗ add | ✗ add | `httpsproxy-mtls`, `e2ehttpsproxy-mtls` (CG-1) | **net-new** (+ gateway?) |
| **gRPC** backend_protocol value | ✗ add | ✗ add | `e2ehttpsproxy-grpc` (CG-2) | net-new (enum + connector) |
| **Tunnel endpoint** control | ✗ add | ✗ add | `tcptunlb`, `sctptunlb` (CG-5) | net-new (+ gateway?) |
| **Egress/cistate** topology (beyond `egress` bool) | partial | — | `egresslb` full (CG-4) | verify + maybe net-new |

Re-enablement note: mount the fields inside `AdvancedSettingsForm` (which
already uses the correct delta `onChange`), NOT by remounting the stale
`SecurityOptionsForm` (would reintroduce the F19 sibling-clobber). Gate
`security`/`proxyprotocolv2` to `mode===4` like `host`/`path_*`.

---

## 15. Phased implementation plan (execution order)

Each phase: **implement any gated feature → author the group's specs live
via playwright-mcp against the testbed → green 2× → commit.** Product
changes always land before the specs that depend on them.

| Phase | Deliverable | Depends on |
|---|---|---|
| **P0 — Scaffold** | `e2e/tests/cicd/_recipes.ts` (recipe constants + shared LB drive/assert helpers) + one reference spec `cicd/lb-l4/tcplb.spec.ts` green 2×. (Runner already matches `tests/cicd/**` — no config change.) | — |
| **P1 — L4 LB group (✅ subset)** | `cicd/lb-l4/*.spec.ts` for every TCP/UDP/SCTP scenario needing NO new field: basic, select(hash/lc/priority/persist), mode(dnat/onearm/fullnat/dsr), monitor/probe, timeout, multi-ep, secips, src. (~27 specs.) | P0 |
| **P2 — LB-form re-enable [FEATURE]** | loxilb-ui: re-enable Security(fullproxy-gated)/Block/Egress/SNAT/ProxyProtocolV2/PrivateIP in `AdvancedSettingsForm` (delta pattern). Live-validate. Unblocks Group B + `tcplbmark`. | P0 |
| **P3 — L7 proxy group** | `cicd/l7-proxy/*.spec.ts` for http/https/e2ehttps/host/prefix/http2 (Security now reachable) + the deferred `tcplbmark`, `sctpfullnat` privateIP. (~11 specs.) | P2 |
| **P4 — mTLS + gRPC [FEATURE]** | loxilb-ui (+ gateway if needed): add mTLS client-cert control + `grpc` backend value. Then `*-mtls`/`*-grpc` specs. | P3 |
| **P5 — NAT group** | `cicd/nat/*.spec.ts`: nat64/66 (v6 VIP LB), ipmasquerade/6 (firewall SNAT). (~6 specs.) | P0 |
| **P6 — Tunnel + egress [FEATURE]** | loxilb-ui: tunnel-endpoint control + egress/cistate. Then `tcptunlb`/`sctptunlb`/`egresslb` specs. | P5 |
| **P7 — Security + IPsec** | `cicd/security/secfilter.spec.ts`; `cicd/ipsec/ipsec{1,2,3,-e2e}.spec.ts` (config-created only). | P0 |
| **P8 — HA/BGP slices** | `cicd/ha/{ha-cistate,bgp-neighbor}.spec.ts` (verify CG-6 cistate round-trip). | P0 |
| **P9 — AI-gateway [needs CG-9]** | Enable `--userservice` on CI gateway (oam-loxilb), then `cicd/ai-gateway/*.spec.ts` (ai-* + collapsed vllm/sglang/mcp surfaces). | CG-9 |
| **P10 — Suite wire-up + CI** | cicd suite ordering into `npm run e2e`, extend `zz-cleanup` sweeps for any new entity kinds, nightly CI job. | all |

Parallelizable: P1/P5/P7/P8 need no feature and can proceed right after
P0. P2→P3 and P4, P6, P9 are feature-gated. Authoring loop per spec uses
**playwright-mcp** live against the testbed (drive → observe → fix →
capture as native spec), matching the existing `lb.spec.ts` workflow.

## 16. Findings — real defects surfaced (the actual deliverable)

The specs are a *probe*: their value is the product bugs they expose, not a
green table. Fixes land in whichever repo owns the defect.

### F-CICD-1 — `AccordionBox` tooltip intercepts clicks on the next section (loxilb-ui, FIXED)
- **Symptom:** `cicd/udplb` intermittently failed to expand the *Endpoints*
  accordion — an interactive MUI tooltip (`MuiTooltip-popperInteractive`,
  "Define the list of allowed source IP addresses…") overlaid the summary and
  swallowed the click.
- **RCA:** `src/components/element/AccordionBox.tsx` wrapped its
  `AccordionSummary` in a **bare `<Tooltip>`**. MUI v5 tooltips are
  *interactive by default* (popper keeps `pointer-events: auto` + a leave
  delay), so a section header's hover tooltip lingers over the adjacent
  section below (default `placement="bottom"`) and intercepts its click. A
  real user hovering one section header then clicking the next hits this. The
  sibling `ParamBox.tsx` already did it right (`disableInteractive leaveDelay={0}`);
  `AccordionBox` never got those props.
- **Fix:** `AccordionBox` tooltip → `arrow placement="top" leaveDelay={0} disableInteractive`,
  mirroring `ParamBox`. Verified: full L4 suite green 2× with **no** test-side
  workaround (the fix alone resolves the interception).
- **Scope check:** the DataTable toolbar tooltips (Add/Edit/Delete/Refresh) use
  `placement="top"` and are clicked constantly across the green Group 1/4/5
  suites without flaking → empirically fine, not churned. AccordionBox's
  bottom-placement-over-stacked-sections was the unique broken geometry.

### Test-hardening from the same review
- `assertLbReadback` now validates the **full endpoint tuple** (IP +
  `targetPort` + `weight`), not just the IP set — so the weighted (`wrrtcplb1/2`)
  scenarios actually prove weights round-trip. A dropped/coerced weight is a
  real gateway/UI bug that IP-only assertion hid.

### P1 status
L4 group complete: `_recipes.ts` extended (`monitor`, `allowedSources`, full
endpoint-fidelity readback) + 24 new specs (one per in-scope cicd L4 dir).
Suite (26 specs + setup) green 2× on the Naver testbed.

### F-CICD-2 — gateway does not echo `privateIP` (write-only) and mode-subsumes `snat` on read-back (loxilb-inference-gateway, FOR THE GATEWAY TEAM)
Surfaced by the P2 re-enable validation (`advanced-fields.spec.ts`, fullnat).
- **UI side is correct** — the re-enabled AdvancedSettingsForm controls emit
  `snat`, `privateIP`, `proxyprotocolv2`, `block` in the POST body (proven by
  runLbScenario's body assertion). This is the P2 deliverable and it passes.
- **Gateway side:** create is accepted (2xx) but the read-back omits `snat`
  and `privateIP` for a fullnat rule, while `block`/`proxyprotocolv2`/`mode`
  persist. RCA in `pkg/loxinet/rules.go`:
  - `privateIP` — parsed and used at create (`rules.go:2671`) but the GET
    serializer (~`rules.go:1150-1235`) has **no `ret.Serv.PrivateIP =`**
    assignment (unlike `Bgp`/`BlockNum`/`ProxyProtocolV2`/`Snat`). It is a
    **write-only** field: consumed for NAT setup, never echoed — yet
    `LoadbalanceEntry.serviceArguments.privateIP` is declared in the GET schema.
    → real read-back gap; the gateway team should populate it in the GET path.
  - `snat` — only echoed when `act.actType == RtActSnat` (`rules.go:1234`). A
    fullnat rule's actType is the NAT mode's, not `RtActSnat`, so the standalone
    snat flag is subsumed by the mode. Mode-dependent (echoes on a plain rule
    whose act becomes RtActSnat), not a plain drop. Documented, not asserted on
    fullnat read-back.
- **Test stance:** pinned via `readbackOmit: ['snat','privateIP']` on the
  fullnat recipe — UI-wiring proof (POST body) is kept; the two fields are
  excluded from the read-back match only, so the gap is documented rather than
  silently green. NOTE: cannot commit to the gateway repo (engineers own it,
  see git-authorship rule) — this is a hand-off finding.
- **Secondary (schema):** GET `serviceArguments.security` enum is `0|1|2` but
  `securities.json`/the create path allow `3` (e2ehttps) — a GET-schema
  under-declaration to flag alongside.

### P2 status
LB-form Advanced controls re-enabled in `AdvancedSettingsForm.tsx` (Security
fullproxy-gated, Block, SNAT, Egress, Proxy Protocol v2, Private IP) using the
delta-onChange pattern (SecurityOptionsForm left unmounted — F19-buggy).
Validated: `tcplbmark` (Block) + fullproxy Security=https round-trip; fullnat
SNAT/privateIP/ppv2/block UI-wiring proven (F-CICD-2 for the gateway). P1 (26
specs) green with the shared-form change — no regression.
