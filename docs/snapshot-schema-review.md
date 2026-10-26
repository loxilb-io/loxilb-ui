# Snapshot schema review through 1.12

The UI transports snapshot documents without reconstructing their domains. The exact schema allowlist in the download E2E test records reviewed formats; it is not the gateway compatibility gate. The gateway owns checksum validation, version migration, domain planning, external dependencies and restore execution. A new schema still needs review before extending the list.

Reviewed against Gateway `fe4e001d318caa62d790fc692cb17309e1fe749d`, `pkg/snapshot/doc.go` and the following owner tests:

| Schema | Additions | Owner coverage |
|---|---|---|
| 1.10 | LB default reservation and max tokens | `lb_fullfield_test.go`, `golden_test.go` |
| 1.11 | Network identity; JWT priority class; objective strictness | `netidentity_test.go`, `codec_test.go`, `lb_fullfield_test.go` |
| 1.12 | BGP policy assignment; priority wake/band/queue knobs | `bgppolicyassignment_test.go`, `lb_fullfield_test.go` |

Additive domains do not widen the coverage of migrated older documents. Builds that cannot understand a newer minor schema refuse it. The UI must retain the gateway's domain names, warnings and external recovery requirements rather than infer successful recovery from a version string.

The live full-restore UI test now seeds reservation, objective and all added priority-band fields, deletes that rule and checks every configured value after restoration. This covers configuration fidelity, not model execution or admission behavior. The gateway owner suite covers network identity and BGP assignment semantics with injected hooks; this is not live BGP routing qualification. Existing UI selected-domain, external recovery, checksum-tamper and full restore tests remain required.
