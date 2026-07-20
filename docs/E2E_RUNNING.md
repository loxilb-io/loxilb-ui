# Running the E2E test suite

This is the practical "how do I run the browser E2E tests myself" guide. For
what the suite covers and how the specs are designed, see
[`E2E_CRUD_TEST_PLAN.md`](./E2E_CRUD_TEST_PLAN.md) and
[`E2E_TEST_PLAN.md`](./E2E_TEST_PLAN.md).

The suite uses [`@playwright/test`](https://playwright.dev). It drives a **real
browser** against a **locally-served build of this UI** that talks to a **live
LoxiLB stack** (OAM + inference-gateway). There is no mocking — it is a true
end-to-end run, so it needs a reachable testbed.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 22.x | Match CI. `npm ci` to install exact locked deps. |
| Playwright browsers | `npx playwright install chromium` (first time only). |
| A reachable LoxiLB stack | An OAM instance whose registered gateway is **up**. Set the address of your OAM in `E2E_OAM_URL` (internal testbed addresses live in `docs/internal/TESTBED.md`, which is not part of the public repo). |
| Admin credentials | A working OAM admin login for that stack. |

```bash
npm ci
npx playwright install chromium   # first run only
```

## 2. One-time configuration

The runner reads two env files (both are git-ignored — never commit them):

**`.env.e2e.local`** — the testbed admin credentials the suite logs in with:

```dotenv
E2E_ADMIN_USER=admin
E2E_ADMIN_PASSWORD=YourAdminPassword
```

**`.env.development`** — points the dev server at the OAM backend. A working
testbed example:

```dotenv
REACT_APP_API_URL=http://<your-oam-host>:8080/oam
REACT_APP_ENV=local
REACT_APP_PUBLIC_URL=/netlox
PORT=3000
HTTPS=false
WDS_SOCKET_PORT=0
```

> **Why HTTP, not HTTPS?** The testbed OAM is plain `http://`. An HTTPS dev
> server would trip the browser's mixed-content block. This is why you must
> **not** use `npm start` for E2E (it forces HTTPS) — let Playwright boot the
> dev server, or use the exact command in §3.

Optional override: set `E2E_OAM_URL` to point the API helpers at a different
OAM base (defaults to the testbed URL above).

## 3. Run the suite

Playwright **auto-starts the dev server** for you (config `webServer`,
`reuseExistingServer: true`), so in most cases you just run:

```bash
npm run e2e                      # full suite, ~9 min (serial, 1 worker)
npm run e2e:headed               # same, but watch it in a visible browser
```

Run a subset while iterating:

```bash
npx playwright test e2e/tests/traffic          # one group (folder)
npx playwright test e2e/tests/network/vlan.spec.ts
npx playwright test e2e/tests/status/fs.spec.ts:24    # a single test by line
npx playwright test -g "F-NET-1"               # by title substring
npx playwright test --debug e2e/tests/ipsec    # step through with Inspector
```

If you prefer to start the dev server yourself (e.g. to keep it warm across
runs), run this in a separate terminal — Playwright will reuse it:

```bash
HTTPS=false BROWSER=none WDS_SOCKET_PORT=0 npx dotenv -e .env.development react-scripts start
```

Test groups (folders under `e2e/tests/`): `traffic`, `security`, `network`,
`ipsec`, `ai`, `status`, `oam`. `zz-cleanup.spec.ts` sorts **last** and is a
leak detector that fails if a spec left any `e2e-`/doc entity behind.

## 4. Read the results

```bash
npx playwright show-report                 # open the HTML report (playwright-report/)
npx playwright show-trace test-results/<...>/trace.zip   # time-travel a failure
```

On failure the runner keeps a **trace** (`trace: retain-on-failure`) and a
**screenshot** (`screenshot: only-on-failure`) under `test-results/`. Both
directories (`playwright-report/`, `test-results/`) are git-ignored.

## 5. How auth works (and why you shouldn't spam it)

`e2e/auth.setup.ts` runs first and logs in **once per role** (admin, operator,
viewer), saving each session to `.auth/*.json`. Individual specs never log in —
they reuse those storage states. The OAM **rate-limits logins** (burst 10/IP +
an exponential per-user lockout on failures), so avoid re-running in a tight
loop; if you get locked out, wait for the backoff to clear.

The operator/viewer RBAC fixtures (`e2e_operator`, `e2e_viewer`) are
provisioned once via the admin API and are **persistent** — cleanup never
sweeps them (underscore usernames, not the `e2e-` marker).

## 6. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Every gateway call fails / `502` | The gateway VM is down or the container is wedged. Confirm the registered instance's gateway is reachable before blaming the UI. |
| `testbed uptime should be > 1h` fails | The gateway VM was **just rebooted**. `status/device.spec.ts` intentionally asserts the box has been up over an hour; it self-resolves once it has. Not a UI bug. |
| A `status/fs` or `network/vlan` test flakes right after a reboot | Cold-boot transient — re-run that spec; it should pass once the stack settles. |
| Mixed-content / CORS errors in the browser | You're serving HTTPS against an HTTP OAM. Use the §3 HTTP dev-server command; don't use `npm start`. |
| `login as admin did not reach /instance` | Wrong creds in `.env.e2e.local`, or the account is locked out from prior failed logins. |
| Nav lands outside `/netlox` | Specs must use **relative** `page.goto()` paths (`'login'`, not `'/login'`) — the `baseURL` ends in `/netlox/`. |
| Dev server didn't come up | First boot of `react-scripts start` can take ~2 min; the `webServer` timeout is 180 s. Start it manually (§3) and re-run. |

## 7. Notes on running against your own stack

Point `.env.development`'s `REACT_APP_API_URL` and `.env.e2e.local`'s
credentials at any OAM whose registered gateway is healthy. The suite is
**serial and mutating** — it creates and deletes real load balancers, firewall
rules, tunnels, etc. Run it against a **testbed, never production**. It restores
state as it goes and the `zz-cleanup` detector flags anything left behind.
