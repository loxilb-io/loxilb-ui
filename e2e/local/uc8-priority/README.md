# UC-8 request-priority local browser fixture

This fixture renders the actual shared `PriorityClassFields` component and its
request projection functions. It does not connect to OAM, a Gateway, a database
or an inference backend. Passing these checks does not establish that a server
accepted a change or that request priority is enforced.

From the repository root, with locked dependencies and Playwright Chromium
already installed:

```sh
npm run typecheck:e2e
npm run test:browser-local -- --grep UC8-LOCAL
```

The test route handler permits only the loopback fixture origin. The existing
local Playwright configuration starts Vite on `127.0.0.1:4179`; it does not
load the live testbed setup or credentials. To inspect a single case, append
`--headed` or `--debug` to the second command. These interactive options depend
on a working local display.

For a manual inspection, start the server from the repository root:

```sh
node node_modules/vite/bin/vite.js --config e2e/local/vite.config.mjs --host 127.0.0.1 --port 4179 --strictPort
```

Open `http://127.0.0.1:4179/e2e/local/uc8-priority/?scope=key`, expand
**Request Priority**, and verify that the unset key has no additional cap and
that `create-body` reads `{}`. Repeat with `scope=tenant` and `scope=jwt`:
the tenant is held at standard when unset; JWT is unset without an additional
cap and has no objective fields.

Open `?scope=key&edit`; initially `change-body` is `{}`. Select `sheddable`,
then clear **Default Objective**. The output contains the changed class and an
explicit empty default objective. On `?scope=tenant&edit`, clearing **Allowed
Objectives** produces `{"allowed_objectives":[]}`. With `?scope=key`, enter
`missing` as the default objective: the component warns, and the request
projection retains the value.

Stop the Vite process you started when finished. This development fixture is
not a product screen and should not be used as a screenshot for a user manual.
Live setup, traffic, authorization and cleanup require a separately prepared
QA environment and their own tests.
