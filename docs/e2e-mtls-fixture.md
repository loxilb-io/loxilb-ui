# Frontend mTLS prerequisites for UI E2E

The two CICD frontend-mTLS scenarios create and read back listener configuration. They do not send TLS traffic and cannot qualify client-certificate enforcement.

A fresh integrated bundle does not contain `/opt/loxilb/cert/client_ca.crt`. That default belongs to the upstream CICD fixture; an absent file makes the gateway reject listener creation with 412. Do not skip the scenario or substitute a server leaf certificate for a CA.

For an isolated test environment:

1. Generate a dedicated, short-lived CA with `basicConstraints=critical,CA:TRUE`. Keep its private key outside Git and build contexts.
2. In **Traffic → SNI Certificates → Upload PEM**, choose **Backend CA bundle**, assign a dedicated ID (for example `ui-test-client-ca`), and upload only the CA certificate. The managed CA bundle contains no key and may be referenced by the frontend's CA path.
3. Verify the managed entry through `GET /config/cert/ui-test-client-ca`, including `usage: ca` and the expected certificate. Set `E2E_MTLS_CLIENT_CA_PATH=/etc/loxilb/certs/ui-test-client-ca/ca.crt` on the Playwright runner.
4. Run `e2e/tests/cicd/l7-proxy/httpsproxy-mtls.spec.ts` and `e2e/tests/cicd/l7-proxy/e2ehttpsproxy-mtls.spec.ts` against the packaged UI. Require successful create and exact configuration readback.
5. After deleting the test listeners, remove only the CA entry owned by that test campaign. Never change an unrelated certificate or overwrite a mounted management TLS volume to satisfy the fixture.

A separate data-plane test needs a matching signed client, a valid frontend server certificate, backend transport configuration, and negative cases for missing and untrusted clients. Passing the configuration scenarios alone is not evidence for those behaviors.
