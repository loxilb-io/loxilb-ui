# loxilb-oss E2E suite

Playwright coverage for this UI driving **plain upstream loxilb**
(`github.com/loxilb-io/loxilb`), as opposed to `e2e/tests/**`, which drives
**loxilb-inference-gateway**.

```bash
npm run e2e            # gateway suite  (project 'gw',  e2e/tests/**)
npm run e2e-oss        # loxilb-oss suite (project 'oss', e2e/oss/tests/**)
npm run e2e-oss:headed # same, with a visible browser
```

## Why a separate tree rather than one tagged suite

The two backends share the `/netlox/v1` base and the gateway is a strict
additive superset of loxilb — but the overlap is not behaviourally identical,
and the differences are the whole point of this suite:

| behaviour | gateway | loxilb-oss |
|---|---|---|
| duplicate LB POST | `200`, upserts | **`409` `lbrule-exists`** |
| per-VIP LB `GET`/`PATCH` | supported | **`405`** (only `DELETE`) |
| LB `serviceArguments` edit | merge-patch | **`DELETE` + re-`POST`** |
| LB endpoint-only edit | merge-patch | plain re-`POST` reconciles |
| LB probe types | tcp/http/https/tls-hello | **connect probes only** |
| `sel` | 0–10 (incl. `chwbl`) | **0–6** (incl. `n2`/`n3`) |
| `security` | 0–3 | **0–2** |
| `EndPoint.probeType` | + `tls-hello` | rejects it (`422`) |
| gateway-only bodies fields | applied | **accepted and silently dropped** |
| `GET /logs` | cursor pagination | no cursor — single page |
| Prometheus names | `loxilb_*_total`, `system_*` | third naming generation, no `system_*` |
| endpoint families | ai, ipsec, sni, ipfilter, securityrate, ipv6, trace, l7policy, snapshots | **404** |

Branching on flavor inside one spec made those assertions unreadable, and a
shared spec edited for a gateway feature silently changed what ran against
loxilb. Two trees keep each product's real semantics explicit.

## What is shared, and what is not

Shared (**do not duplicate**):

- `e2e/fixtures.ts` — console guard + no-error-page guard
- `e2e/auth.setup.ts` — the single login per run (the OAM rate-limits logins)
- `e2e/helpers/**` — api, table, dialogs, form, and `loxilb-contract.ts`
- `e2e/tests/oam/**` — auth, users, RBAC, profile, instance registration.
  These exercise the **OAM**, which is identical regardless of which backend
  is registered behind it. They run on the gateway leg only, by design.

Not shared: everything under `e2e/oss/tests/**`, which is authored against
`api-spec/loxilb-swagger.yml`.

## Instance pinning (safety)

The OAM registers both backends, so a run that lands on the wrong one asserts
nothing useful **and mutates the wrong box**. Two independent mechanisms:

1. `e2e/oss/_loxilb.ts` sets `E2E_FLAVOR=loxilb` at import, so
   `helpers/api.ts` resolves `E2E_INSTANCE_LOXILB` — this holds for a bare
   `playwright test --project=oss` and IDE runs too, not just the npm script.
2. `requireLoxilbInstance()` runs in every suite's `beforeAll` and fails fast
   unless the instance both lacks the gateway `product` id on `/version` **and**
   404s a gateway-only path. The second check catches gateways too old to
   self-identify.

```bash
# .env.e2e.local
E2E_INSTANCE_GATEWAY=<oam registration name of the gateway>
E2E_INSTANCE_LOXILB=<oam registration name of the plain loxilb>
```

`E2E_INSTANCE_NAME` still overrides both, for a one-off run.

## Spec map

| Spec | Subject |
|---|---|
| `contract-guard.spec.ts` | **The backward-compat spec.** Intercepts every browser→loxilb request and fails on any path/method/field/enum/query-param upstream does not declare. Oracle: `src/api/gen/loxilb-capability-map.json`. |
| `gating.spec.ts` | The flavor gate itself — hidden nav/routes, filtered form options, flavor chip. |
| `read-surface.spec.ts` | The upstream read APIs the UI depends on (`/meta`, `/config/params`, cistate, export, `/logs` shape). |
| `dashboard.spec.ts` | Dashboard on loxilb: `/status`-derived usage, honest N/A instead of fabricated zeros. |
| `lb.spec.ts` … `settings.spec.ts` | Per-page CRUD parity with the gateway tree, asserting upstream semantics. |
| `zz-cleanup.spec.ts` | Safety-net sweep + leak detector (runs last). |

## Findings from the first runs (2026-08-18, loxilb 0.9.8-dev)

| ID | Finding | Status |
|---|---|---|
| **LX-EP-DEFAULTS** | `EndpointListForm.handleAdd` seeds every endpoint row with `ep_role: 0, nixl_port: 0`, so both gateway-only fields ship in the POST body on **every** LB create — including to loxilb, which has neither. The controls are correctly gated behind `pd_disagg_mode`; the defaults are not. Upstream silently drops them today, so nothing visibly breaks, but it is the exact "hidden control, field still shipped" class the guard exists to catch. Found by `contract-guard.spec.ts` on its first run. | **Open** — narrowly waived in `LX-CONTRACT-2` with a pointer to this entry. Fix belongs in shared code (project outgoing endpoints through `hasField()`), affects the gateway build too. |
| **LX-N3-UDP** | `sel=n3` (6) passes swagger validation and is then refused by the datapath unless the rule is UDP: `400 non-udp-n3-args`. The form offers n3 for any protocol. Reproduced on **both** products. | Covered by `V-n3-proto` in **both** suites. A client-side block (like the existing UDP+fullproxy one) would be the real fix. |
| **LX-ROUTE-NEXTHOP** | The route specs derived their on-link nexthop from the "first non-lo device", but the backend returns that list in Go map order — a different order every call. When the draw landed on a per-rule `llb-rule-<vip>` pseudo-device (a `/32`), the route create failed `500 network is unreachable`. | **Fixed in both trees** — candidates are now sorted, `llb-rule-*` skipped, and prefixes narrower than `/30` rejected. |
| **LX-VLAN-WEDGE** | Upstream can leave a vid permanently wedged: still listed by `GET /config/vlan/all`, but every `DELETE` (member and vlan) answers `404 Link not found`. Vid 3991 is wedged on the current loxilb testbed; 3999 was burned the same way earlier. | **Worked around** — `TEST_VLAN_IDS` is now a pool and the VLAN spec picks free vids at runtime, so one wedge costs a slot instead of every future run. |
| **LX-METRICS-200** | With Prometheus disabled, upstream answers `GET /metrics` with `200` and the plain string `"Prometheus option is disabled."` — the gateway returns `503`. A status-only check would treat that as a valid exposition. | Covered by `LX-READ-6`; the connector already parses it to an empty snapshot, which is why the cards stay honest. |

### Known flake

`route.spec.ts` `V-dest` occasionally times out waiting for the Add dialog when
the route table is long (the loxilb box accumulates auto-created `/32`s). It
passes in isolation and in most full runs. Re-run the file before treating it
as a regression.

## Conventions

- Every suite title is prefixed `@loxilb`, so `-g @loxilb` still selects the
  whole tree even though selection is by project now.
- Test entities are `e2e-` named and use RFC 5737/3849 documentation ranges;
  the sweeps in `helpers/api.ts` can only ever match those, never real config.
- `capabilityMap()` is read from disk at runtime — regenerating it with
  `npm run gen:api` re-aims the contract guard without touching test code.
