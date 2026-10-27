# Reviewing API and metric updates

The UI records its exact API and metric producers in `api-spec/SOURCES.json`.
Generated TypeScript is a contract artifact, not evidence that the forms,
serializers, readback confirmation or monitoring views support every newer
producer feature. Inspect the pinned sources before interpreting compatibility.

## Checks required before replacing the pinned artifacts

| Check | Required evidence |
|---|---|
| Service argument confirmation | Every added argument has a reviewed write/readback rule, including omission, zero, replacement and rejection semantics. |
| Flow-control fields | Declared writable `fc_*` fields are supported by the form and serializer, or the update remains deferred. A field is not supported merely because generation accepts it. |
| Metric applicability | Review family class, packaging, activation and prerequisites. Absence is not an observed zero. |
| Custom-collector metric types | Independently verify collector value types before adding `DESC_RUNTIME_TYPES` pins. Copying a type from the manifest being checked is not independent evidence. |
| Generated output | Generation, mapping, contract tests, typechecking and the production build must pass without relaxing the checks above. |

## Deferred intake reviewed during the UI campaign closeout

An uncommitted candidate using producer revision
`ef8813af4d75dc3db0bc5a9d7e02e9abd3e46bd1` was reviewed using the existing
UI-side artifacts. It is **not adopted** by this closeout. The currently pinned
API specs, metric manifest and generated output remain unchanged.

The candidate fails five contract assertions, grouped as follows:

| Assertion | Disposition |
|---|---|
| All service arguments have readback confirmation rules | Defer: 12 newly declared arguments lack reviewed UI confirmation rules. |
| All declared writable flow-control fields are supported | Defer: nine of the added arguments are writable `fc_*` controls. |
| Gateway-applicable family inventory | Defer: the packaged/default inventory changes from 258 to 292. Counts alone cannot establish reviewed applicability. |
| Custom-collector family/type inventory | Defer: the inventory grows from 83 to 101 families. |
| Every custom-collector family has an independent type pin | Defer: 18 families lack independently reviewed pins. |

The added arguments are `ai_default_max_tokens`, `ai_default_reservation`,
`ai_objective_strict`, `fc_band_min_share_pct`, `fc_band_queue_pct`,
`fc_band_wait_ms`, `fc_band_weights`, `fc_critical_reserve_pct`,
`fc_llmd_headers`, `fc_shed_queue`, `fc_tenant_wake` and `fc_wake_policy`.
These omissions are not resolved by changing expected lists or counts.
A subsequent intake needs the evidence above and a separate compatibility
review. This review makes no claim about the behavior of a deployed producer.

## Local browser regression versus integrated qualification

Run `npm run test:browser-local` for the real Process page and DataGrid with
fixture server-facing hooks. It uses a loopback-only Vite server, blocks
nonlocal browser requests, and requires no credentials or testbed setup.
Selection uses real pointer actions followed by retrying checkbox and detail
panel assertions; it also checks deselection, refresh and successful emptiness.
The same selection helper is used by the standard integrated Process spec.

This is local UI regression evidence. It does not validate process collection,
management authentication, a packaged deployment or a live backend. Integrated
E2E remains a separate testbed workflow. Earlier partial reruns cannot be added
together and reported as a fresh full-suite pass; skipped cases and CLI/UI
coverage gaps retain their original evidence boundaries.
