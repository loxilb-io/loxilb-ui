# Per-page CRUD E2E Test Plan (Playwright, field-complete)

Production-grade browser test plan for every loxilb-ui page, executed with
**native `@playwright/test`** specs under `e2e/` (`npm run e2e`). This is the
detailed companion to `docs/E2E_TEST_PLAN.md` (which stays as the
agent-driven smoke/RBAC suite). Decisions recorded 2026-07-18:

- **Format:** native Playwright TypeScript specs, one spec file per page,
  grouped by menu section. Shared fixtures for auth/table/dialog handling.
- **Coverage:** **field-complete** — every POST/PUT/PATCH payload field is
  exercised by at least one case, plus boundary/invalid cases per field
  group. Assertions are made at BOTH levels: the UI table/detail panel and
  the network request payload (via `page.waitForRequest`).
- **Environment:** **full live CRUD** against the testbed-client testbed
  (user decision; includes network-mutating resources). Every mutation is
  paired with its own cleanup; all entities use the `e2e-` prefix or
  reserved-documentation IPs (`203.0.113.0/24`, `198.51.100.0/24`) and
  high dummy IDs (VLAN 3999, VXLAN 3999) so strays are identifiable and
  inert. Tests must assert on their OWN entities only (shared testbed;
  the gateway also auto-creates FW allow-rules for dnat LB VIPs).

## 0. Infrastructure

| Item | Value |
|---|---|
| Runner | `@playwright/test` (pinned to installed `playwright` 1.61.x) |
| Config | `playwright.config.ts` — `baseURL=http://localhost:3000/netlox`, `webServer` boots the HTTP dev server (`HTTPS=false … dotenv -e .env.development react-scripts start`), workers=1 (shared live gateway: no parallel mutation) |
| Auth | `e2e/auth.setup.ts` project logs in once per role and saves `storageState` (`.auth/admin.json`, later `.auth/operator.json`, `.auth/viewer.json`). Credentials from `.env.e2e.local` |
| Helpers | `e2e/helpers/table.ts` (MUI DataGrid: select rows by cell text, toolbar buttons by aria-label), `e2e/helpers/dialogs.ts` (confirm/success popups), `e2e/helpers/api.ts` (request-capture assertions + direct OAM API for seeding/cleanup-verify) |
| Safety net | Global `afterAll` per spec re-lists the resource via API and deletes any leftover `e2e-`/documentation-IP entities |
| Login discipline | OAM rate limits logins (burst 10/IP) + exponential per-user lockout. storageState keeps this to ~1 login per role per run |

### Case notation used below

- **C-min** — create with required fields only; assert POST body has no
  spurious keys, row appears, then delete.
- **C-full** — create with every optional field set to a non-default;
  assert each field lands in the POST body verbatim.
- **C-<group>** — targeted case exercising one field group (when C-full
  can't combine them, e.g. mutually exclusive modes).
- **V-*** — validation case: form must block submit (or the gateway must
  4xx and the UI must surface an error popup, not crash).
- **E-*** — edit path (PUT/PATCH); assert only changed keys for PATCH.
- **D-*** — delete path: single, multi-select (regression F16), and
  delete-while-stale (row removed out-of-band → refetch shows reality).

Every spec also asserts: zero uncaught console errors, and no full-app
error-page redirect (F15 regression guard) during its flow.

---

## Group 1 — Traffic (`e2e/tests/traffic/`)

### 1.1 LB Rule — `lb.spec.ts` (largest matrix)

Route `/instance/traffic/lb` · POST/PATCH/DELETE `/config/loadbalancer*`
· payload `IServiceConfiguration`

Field-complete matrix over `serviceArguments` + `endpoints[]` +
`secondaryIPs[]` + `allowedSources[]`:

| Case | Fields exercised | Values | Assert |
|---|---|---|---|
| C-min | name, externalIP, port(min=max), protocol, endpoints[1]{endpointIP,targetPort,weight} | `e2e-lb-min` / 203.0.113.10:8080/tcp → 198.51.100.1:8080 w1 | POST body minimal; row `rr/dnat` defaults |
| C-basic-range | portMax > port | 8000–8010 | portMax in body; row shows range |
| C-adv-l4 | sel(rr/hash/priority/persist/lc), mode(dnat/onearm/fullnat/fullproxy), inactiveTimeOut, block, bgp, snat, oper | one case per sel via param loop; fullnat needs privateIP | Sel/Mode columns + detail panel |
| C-adv-l7 | mode=fullproxy + host, path_prefix, path_match_mode(prefix/exact), backend_protocol(http1/http2/both), proxyprotocolv2, security | `e2e.example.com` `/v1/chat` | L7 Proxy panel values |
| C-aigw-stream | llm_type, model_name, trace_type, session_header_name, sse_mode, max_stream_duration_sec, backend_keepalive_interval_sec | sse on, 600s, 30s | fields in POST |
| C-aigw-pd | pd_disagg_mode, pd_cache_aware_mode, pd_session_ttl_sec, pd_cache_threshold(0/50/100), pd_balance_abs_threshold, endpoints[].ep_role(1,2), endpoints[].nixl_port | 2 endpoints prefill+decode | body verbatim |
| C-aigw-kv | sel=8(CHWBL) + chwbl_prefix_hash_level/flags, kvExactMode(0–3), kvBlockSize, kvHashAlgo(sha256_cbor/xxhash_cbor), kvZmqPort | boundary: kvBlockSize=1, kvZmqPort=65535 | body verbatim |
| C-probe | monitor=true + probetype(tcp/http/ping), probeport, probereq, proberesp, probeTimeout, probeRetries | http + req/resp strings | Probe panel + Monitor col `Enabled` |
| C-lists | secondaryIPs[2], allowedSources[2] | 203.0.113.11-12; 198.51.100.0/25 ×2 | detail tabs list them |
| C-multi-ep | endpoints[3] with distinct weights 1/5/10 | | Endpoints tab rows |
| V-port | port 0 / 65536 / min>max | form blocks (F4/F13 regression) |
| V-ip | externalIP `999.1.1.1`, endpoint IP empty | form blocks |
| V-dup | same VIP:port/proto twice | gateway 4xx → error popup, no crash |
| E-patch | PATCH endpoint weight, inactiveTimeOut, host | only changed keys in PATCH body (RFC 7386 regression) |
| E-immutable | verify name/protocol/VIP disabled in edit dialog | |
| D-single / D-multi | 1 row; 3 rows select-all | N DELETE requests, count-aware popup |

Note: LB create on dnat auto-creates a gateway FW allow-rule that
survives LB delete (known gateway quirk) — LB spec cleanup must also
sweep `/config/firewall` for its VIP tuples.

### 1.2 Firewall — `fw.spec.ts`

POST/DELETE `/config/firewall` · payload `{ruleArguments, opts}`

| Case | Fields |
|---|---|
| C-min | sourceIP, destinationIP, protocol + one action (drop) |
| C-args-full | minSourcePort/maxSourcePort, minDestinationPort/maxDestinationPort, portName, preference, hwOffload |
| C-act-allow / C-act-trap / C-act-record | mutually exclusive action flags; record combinable |
| C-redirect | redirect + redirectPortName |
| C-snat | doSnat + toIP + toPort |
| C-mark | fwMark, onDefault |
| V-cidr | `10.0.0.0/33` blocked; V-ports min>max blocked |
| D-single / **D-multi (F16 regression, 3 rows)** / D-partial (2 of 3) | one DELETE per row with correct tuple query params |

### 1.3 Endpoint — `endpoint.spec.ts`

POST/PUT/DELETE `/config/endpoint*` · payload `IEndpointInput`

| Case | Fields |
|---|---|
| C-min | hostName (203.0.113.20) |
| C-full | name `e2e-ep`, probeType(ping/tcp/http/https), probePort, probeReq, probeResp, probeDuration, inactiveReTries |
| E-update | change probeDuration + retries via edit (PUT) |
| V-host | empty/garbage hostname blocked |
| D-single/D-multi | |

### 1.4 Conntrack — `conntrack.spec.ts` (read + delete)

Table renders live flows; stats widgets consistent with rows. D-entry:
delete a selected flow (tolerant: flow may age out first — assert either
the DELETE fired or row already gone). No create path.

### 1.5 QoS — `qos.spec.ts`

POST/DELETE `/config/qos*` · payload `{policyIdent, policyInfo, targetObject}`

| Case | Fields |
|---|---|
| C-min | policyIdent `e2e-qos`, committedInfoRate, peakInfoRate |
| C-full | type, colorAware, committedBlkSize, excessBlkSize, targetObject{attachment, polObjName} |
| V-rates | peak < committed blocked (or gateway 4xx surfaced) |
| E-* | edit if UI exposes; else skip with comment |
| D-single/D-multi | |

### 1.6 Mirror — `mirror.spec.ts`

POST/DELETE `/config/mirror*` · `{mirrorIdent, mirrorInfo, targetObject}`

| Case | Fields |
|---|---|
| C-span | type=0 + port (real port `eth0` — SPAN is passive/safe) |
| C-rspan | type=1 + vlan 3999 |
| C-erspan | type=2 + sourceIP/remoteIP/tunnelID (documentation IPs) |
| targetObject | attachment + mirrObjName each case |
| V-type | missing target blocked |
| D-single/D-multi | |

### 1.7 SNI Certificates — `sni-certs.spec.ts`

Upload (multipart POST) + DELETE. Generate a disposable self-signed cert
+ key in the spec (node `crypto`/openssl via fixture) for host
`e2e.test.local`; upload; row appears; delete. V-mismatch: key that
doesn't match cert → gateway error surfaced.

---

## Group 2 — AI Gateway (`e2e/tests/ai/`)

Gateway serves `/config/ai/*` only with `--userservice` (not enabled on
the shared testbed → 501 by design; see UI_API_GAP_ANALYSIS §2.2).
Specs are written for full CRUD and **auto-skip** when a probe GET
returns 501 (`test.skip(gatewayLacksUserservice)`), so they light up
unchanged on a userservice-enabled gateway. What always runs on the
testbed: page renders, 501 degrades to empty table with no crash (F15).

### 2.1 API Keys — `apikey.spec.ts`

| Case | Fields (`ApiKeyCreateRequest`) |
|---|---|
| C-min | tenant_id `e2e-tenant`, name `e2e-key` |
| C-full | allowed_models[], rate_limit_rps, burst_size, tokens_per_min, expires_at (ISO future), enabled=false |
| Assert | 201 shows one-time `raw_key` dialog exactly once; masked afterwards |
| E-patch | PATCH enable toggle + allowed_models; persists after reload |
| V-expiry | past expires_at blocked/4xx surfaced |
| D-single | delete by key_id |

### 2.2 Tenant Rate Limits — `ratelimit.spec.ts` (menu-hidden route)

POST upsert `{tenant_id, rate_limit_rps, burst_size, tokens_per_min}`;
GET only per-tenant; no DELETE (assert UI doesn't offer one). E-upsert:
re-POST with changed rps and assert overwrite.

---

## Group 3 — IPsec VPN (`e2e/tests/ipsec/`)

### 3.1 Tunnels — `tunnels.spec.ts`

POST/PUT/DELETE `/config/ipsec/tunnels*` + `/action` + `/peerconfig`

| Case | Fields (`IPsecTunnelMod`) |
|---|---|
| C-min-psk | name `e2e-tun`, localIP 10.0.0.12, remoteIP 203.0.113.99, psk |
| C-full | subnets (local/remote CIDR), policy preset default/aws/azure (3 param cases), advanced: ike/esp proposals, lifetimes, DPD (delay/timeout/action), startup mode |
| C-cert | authMode=cert (only if a cert exists from 3.2; else skip) |
| Assert | row DOWN; detail panel IKE/ESP/PFS values; peerconfig download content mirrors left/right + subnets + PSK |
| E-put | change remote subnet, PSK blank → carries over (regression) |
| A-initiate | action=initiate against dead peer → CONNECTING then error/DOWN within ~15 s, no crash |
| V-name | duplicate name → 4xx surfaced; V-cidr bad subnet blocked |
| D-single | delete; strongswan conn gone (list empty via API) |

Known UI issue to fix before this spec: dialog action buttons fall below
the fold at 741 px viewport (use ≥900 px viewport until fixed).

### 3.2 Certificates — `certs.spec.ts`

Upload cert/CA-cert (multipart, generated disposable PEM), validate
endpoint (`/certificates/validate`), delete both. V-garbage: non-PEM
upload → error surfaced.

---

## Group 4 — Security/XDP (`e2e/tests/security/`)

### 4.1 IP Filter — `ipfilter.spec.ts`

| Case | Fields (`IIPFilterEntry`) |
|---|---|
| C-white / C-black | filterType whitelist/blacklist, cidr 203.0.113.0/28, action allow/drop |
| C-full | zone, priority |
| V-cidr | /33 or garbage blocked |
| D-single/D-multi | delete by cidr+type params |

Safety: never filter `0.0.0.0/0`, the OAM host IP, or SSH source ranges.

### 4.2 SYN Flood — `synflood.spec.ts` (edit-only)

E-edit `{enabled, synThreshold, cookieThreshold, whitelistIps[]}`:
enable with high thresholds (100000/200000 — inert), whitelist
`10.0.0.0/24` (keeps mgmt safe), verify persists, then **restore
original values** (read-modify-restore pattern; capture before-state via
API in `beforeAll`). V-thresholds: negative/zero blocked.

### 4.3 Security Rate Limiting — `securityrate.spec.ts` (edit-only)

Same read-modify-restore pattern over `ISecurityRateConfigMod`:
synEnabled/synThreshold/cookieThreshold, connRateEnabled/ratePerSec/
concurrentLimit, udpEnabled/udpPktThreshold/udpBandwidthMB, whitelistIps.
Use inert-high values; always restore in `finally`.

---

## Group 5 — Networks (`e2e/tests/network/`)

Full-live per user decision, but payloads still choose values that
cannot cut the mgmt path: documentation IPs, VLAN/VXLAN 3999, routes to
203.0.113.0/24 via an on-link gateway.

| Page | Spec | Ops | Field-complete cases |
|---|---|---|---|
| IP Address | `ip.spec.ts` | update+delete (no add button — E-update is the create path: dev + ipAddress CIDR) | E: add 203.0.113.30/32 on `eth0`; V bad CIDR; D removes it |
| IPv6 Address | `ip6.spec.ts` | same page family=ipv6 | E: `2001:db8::30/128`; D |
| IP Neighbor | `neighbor.spec.ts` | add/delete `{ipAddress, dev, macAddress}` | C-min 203.0.113.40 + local MAC on eth0; V bad MAC; D |
| IP Route | `route.spec.ts` | add/delete `{destinationIPNet, gateway, protocol?}` | C-min 203.0.113.0/26 via 10.0.0.1; C-proto static; V bad prefix; D-single/multi |
| BFD | `bfd.spec.ts` | add/delete `IBfdInput` | C-full instance `e2e-bfd`, remoteIp 203.0.113.50, sourceIp 10.0.0.12, interval(µs)≥boundary, retryCount 1/255; row state; D. (Gateway 500 "bfd session not running" in `-p` mode → auto-skip like AI group) |
| FDB (route-only) | `fdb.spec.ts` | add/delete `{dev, macAddress}` | C on VLAN dev from vlan spec or eth0; D |
| VLAN (route-only) | `vlan.spec.ts` | add/delete vid + members | C vid 3999; member add eth0 tagged=true (tagged is non-disruptive); remove member; D vlan |
| VXLAN (route-only) | `vxlan.spec.ts` | add/delete `{vxlanID, epIntf}` + peers | C 3999 on eth0; peer add 203.0.113.60; D |
| BGP set/def/apply/neighbor/global (route-only) | `bgp.spec.ts` | neighbor: C `{ipAddress 203.0.113.70, remoteAs 64512, remotePort, setMultiHop}` → D. defined-set/policy: C/D one of each. global/apply: **assert-render + V-cases only** — a bad global BGP config is the one mutation that could disturb routing; do read-modify-restore if edit is attempted |
| Port | `port.spec.ts` | read-only page: render + per-port detail assertions (SW/HW/L2/L3/stats groups present) |

---

## Group 6 — Status & Logs (`e2e/tests/status/`)

| Page | Spec | Assertions |
|---|---|---|
| Device Details | `device.spec.ts` | machine-id/hostname/boot-id non-empty; matches `/status/device` API |
| File System | `fs.spec.ts` | ≥1 mount row; usage % parses |
| High Availability | `ha.spec.ts` | row renders; **E-edit** HA config (read-modify-restore; on the single-node testbed only assert the PUT fires and UI reflects; restore NOT_DEFINED state) |
| Process | `process.spec.ts` | loxilb process row present |
| Logs | `logs.spec.ts` | live lines stream; filter by level+keyword narrows rows; archive list; download completes with non-empty file; **D-archive** delete one archive (create nothing — only delete if ≥2 archives, else skip) |
| Log Settings | `settings.spec.ts` | read current level; set each level (debug/info/warn/error) asserting PUT; restore original |

---

## Group 7 — OAM control plane (`e2e/tests/oam/`)

| Spec | Coverage |
|---|---|
| `auth.spec.ts` | login wrong-pw error (single attempt — lockout discipline), login ok, deep-link while authed, logout confirm, H-2 replay → 401 revoked |
| `users.spec.ts` | C-min username/email/password/role(viewer default); C-role operator/admin; V-dup username 4xx surfaced; V-weak password; E-edit email (+F11 same-value regression), E-password change; D-single; **D-self blocked** (cannot delete own account) |
| `rbac.spec.ts` | three storageState projects: operator (no Config Mgmt icon/route, no User List, gateway write allowed), viewer (read-only toolbars everywhere — parameterized over all Group-1..6 routes, asserting zero add/edit/delete buttons and zero mutation requests), admin (all visible) |
| `config-mgmt.spec.ts` | export with `e2e-` description → file listed; download non-empty JSON; import **dry-run only** (assert diff preview, never apply); D-file |
| `profile.spec.ts` | self email edit persists after reload (catches the stale-menu-cache issue observed 2026-07-18) |
| `instances.spec.ts` | Check Health round-trip; dashboard widgets render; instance edit dialog V-cases (bad host/port) — no create/delete of the real instance |

---

## 8. Execution order & sequencing

Specs run **serially** (workers=1). Order: Group 7 auth first (creates
storage states) → 1 → 4 → 5 → 3 → 2 → 6 → final sweep. A last
`zz-cleanup.spec.ts` lists every resource via API and fails the run if
any `e2e-`/documentation-IP entity remains (leak detector).

## 9. Definition of done per spec

- All C/E/D cases assert both UI state and request payloads.
- All V cases assert the app stays healthy (no error-page redirect, no
  uncaught console errors).
- Read-modify-restore specs restore in `finally` even on failure.
- Spec passes 2× consecutively against the live testbed (flake check).

## 10. Implementation status

**Plan under review — nothing implemented yet** (decision 2026-07-18:
implementation starts in a dedicated session after plan review).

Build order when we start:
1. Toolchain: `npm i -D @playwright/test@1.61.x` + `playwright.config.ts`
   + `auth.setup.ts` + helpers (`table.ts`, `dialogs.ts`, `api.ts`)
2. Reference specs first: `traffic/fw.spec.ts` (simplest, carries the F16
   regression) and `traffic/lb.spec.ts` (largest matrix) — run green 2×
3. Remaining Group 1, then Groups 4 → 5 → 3 → 2 → 6 → 7 + leak detector

## 11. Open points for review

1. **Viewport**: IPsec/LB dialogs clip their action buttons below ~741 px
   viewport height (observed 2026-07-18). Plan assumes a 1280×900 test
   viewport; alternatively fix the dialog scroll first.
2. **BGP global/apply**: kept assert-render + validation-only despite the
   full-live decision — a bad BGP global config is the one payload that
   could disturb testbed routing. Confirm or override.
3. **Known-bug backlog encoded as regressions**: F16 (fw multi-delete),
   F15 (pass-through degrade), F11 (same-value PUT), merge-PATCH keys,
   PSK carry-over. Additional latent F16-siblings (single-`selected_rows[0]`
   delete handlers) exist on other pages — D-multi cases will surface
   them per page; decide whether to pre-fix them all or let specs drive.
4. **AI group** auto-skips on the shared testbed (501 without
   `--userservice`); full CRUD activates only against a
   userservice-enabled gateway. OK?
5. **Run cadence**: serial full run will take tens of minutes against the
   live testbed. Nightly/manual, not per-commit? CI wiring is out of
   scope until decided.
