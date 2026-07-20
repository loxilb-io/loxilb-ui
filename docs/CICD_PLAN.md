# loxilb-ui CI/CD & repository hardening plan

Status: **proposal for review**. Scope: bring the GitHub Actions setup and
repository governance to professional quality ahead of making `loxilb-ui`
public.

Decisions locked with the maintainer (2026-07-19):
- **E2E in CI** → runs on a **self-hosted runner inside the testbed network**
  (no testbed creds leave GitHub-hosted infra; no firewall opening).
- **Image publishing** → build & push to **`ghcr.io/loxilb-io/loxilb-ui`** on
  release tags (`v*`); build-only (no push) on PRs.
- **This document is plan-only.** No workflow files are created until it's
  reviewed and approved.

---

## 1. Where we are today

**One workflow**, `.github/workflows/ci.yml`, a single `verify` job on
`ubuntu-latest`:

```
checkout → setup-node@v4 (node 22, npm cache) → npm ci → typecheck
→ gen:api:check → api:check-mapping (H4) → npm test → production build
```

What's **good**: it already gates typecheck, spec/type sync, the
connector↔spec mapping guard, unit + contract tests, and a real build.

What's **wrong / missing** (the reasons CI is "incorrect"):

| # | Gap | Impact |
|---|---|---|
| C1 | The `verify` run was **red** because the H4 guard flagged `DELETE /oam/config/files/{id}` as an orphan call. | *Fixed* in commit `012b04a` — the vendored OAM spec was stale (missing the handler's `@Router` annotation). |
| C2 | `actions/checkout@v4` + `setup-node@v4` emit a **Node 20 deprecation** warning (forced onto Node 24). | Cosmetic now, breaks later. Bump to `@v5`. |
| C3 | **No lint gate.** No ESLint config or `lint` script; `react-scripts build` only lints incidentally and CI sets `CI=false` to *not* fail on warnings. | Style/quality drift; the code comment even says "lint gates arrive with H7". |
| C4 | **No security scanning** — no CodeQL, no dependency review, no secret-scanning/push-protection documented. | Table stakes for a public repo. |
| C5 | **No dependency automation** (Dependabot / Renovate). | Deps rot; CVEs linger. |
| C6 | **No Docker image build in CI**, despite `Dockerfile` + compose + k8s manifests being the deploy artifact. | Dockerfile breakage caught only at deploy time; no published image. |
| C7 | **No E2E in CI** — the suite exists but runs only locally. | Regressions in real flows caught only by manual runs. |
| C8 | **Single monolithic job** — install/lint/test/build not parallelised; slower feedback, no fail-fast granularity. | Slower PRs. |
| C9 | **Repo hygiene**: `.playwright-mcp/` and `F*.png` screenshots are **not git-ignored**; no `.nvmrc`; node version hardcoded in one place only. | Accidental junk commits; drift between local and CI Node. |
| C10 | **No governance scaffolding**: no issue/PR templates, `CODEOWNERS`, or documented branch-protection / required-status-checks. | Inconsistent contributions once public. |

Present already (good baseline): `LICENSE`, `README.md`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`, `SECURITY.md`, and correct git-ignoring of `.env*` and
`.auth/`.

---

## 2. Target architecture

Five workflows, each with a single clear responsibility. Every workflow uses
`concurrency` with `cancel-in-progress` to kill superseded runs, and pins the
Node version via a checked-in `.nvmrc`.

### 2.1 `ci.yml` — hermetic PR/push checks (GitHub-hosted)

Triggers: `pull_request`, `push` to `main`/`feat/**`/`fix/**`. No secrets, no
network beyond npm. Split into parallel jobs sharing a warmed npm cache:

| Job | Runs | Gate |
|---|---|---|
| `install` | `npm ci` | primes the `actions/setup-node` cache for the rest |
| `lint` | `npm run lint` | **non-blocking at first** (`continue-on-error`), flipped to blocking once the baseline is clean (see §4) |
| `typecheck` | `npm run typecheck` | blocking |
| `spec-sync` | `npm run gen:api:check` | blocking — generated types match vendored specs |
| `api-mapping` | `npm run api:check-mapping` | blocking — the H4 guard (the check that just broke) |
| `test` | `npm test` | blocking — 78 unit + backend-contract tests |
| `build` | `npm run build` (CRA) | blocking |
| `docker-build` | `docker build` (no push), buildx cache | blocking — catches Dockerfile breakage on every PR |

Upgrades vs today: `actions/checkout@v5`, `actions/setup-node@v5`; matrix on
Node `[22]` (room to add `20`/`24` later); `permissions: contents: read` by
default (least privilege).

### 2.2 `e2e.yml` — full browser suite (**self-hosted runner on the testbed**)

Triggers: `workflow_dispatch` (manual button, with an optional `grep` input to
run a subset) **and** a nightly `schedule`. Never triggered by `pull_request`
from forks.

- `runs-on: [self-hosted, loxilb-testbed]` — a runner registered inside the
  testbed network, so it reaches OAM/gateway over the private net and **no
  credentials leave the network**.
- Secrets: `E2E_ADMIN_USER`, `E2E_ADMIN_PASSWORD` (repo/environment secrets)
  written to `.env.e2e.local` at runtime; `.env.development` templated to the
  testbed OAM URL.
- Steps: `npm ci` → `npx playwright install --with-deps chromium` → start dev
  server (or let Playwright's `webServer` boot it) → `npm run e2e` → **always**
  upload `playwright-report/` + `test-results/` as artifacts.
- Guard rails: a pre-flight step that pings the gateway through OAM and
  **skips with a clear message** if the testbed is down (avoids the cold-boot
  `uptime > 1h` and transient failures documented in `E2E_RUNNING.md`).
- A GitHub **Environment** (`testbed`) holds the secrets and can require
  maintainer approval before the job runs.

> Runner setup is a one-time ops task (documented in a runbook, see §5): install
> the Actions runner on a testbed-adjacent host, label it `loxilb-testbed`,
> register it as a repo runner, run it as a service.

### 2.3 `codeql.yml` — static security analysis

`github/codeql-action` for `javascript-typescript`. Triggers: `pull_request`,
`push` to `main`, and a weekly `schedule`. Results surface in the Security tab.

### 2.4 `dependency-review.yml` — PR dependency gate

`actions/dependency-review-action` on `pull_request` — blocks a PR that
introduces a dependency with a known vulnerability or a disallowed license.

### 2.5 `release.yml` — tagged image + GitHub Release

Triggers: `push` tags matching `v*`.

- `docker/setup-buildx` + `docker/build-push-action`, multi-arch
  (`linux/amd64,linux/arm64`), push to `ghcr.io/loxilb-io/loxilb-ui` tagged with
  the version and `latest`.
- `docker/metadata-action` for tags/labels; `permissions: packages: write,
  contents: write`; GHCR auth via the built-in `GITHUB_TOKEN`.
- Create a **GitHub Release** with an auto-generated changelog.
- Optional hardening: build provenance / SBOM attestation
  (`actions/attest-build-provenance`).

### 2.6 Optional niceties (later)

- PR-title lint enforcing Conventional Commits (the repo already uses
  `fix(ux):`, `test(e2e):`… style).
- `actions/stale` for issue/PR triage once traffic justifies it.

---

## 3. Repository governance & hygiene

Non-workflow changes needed for a professional public repo:

- **`.gitignore`**: add `.playwright-mcp/`, `F*.png` (and any other local test
  scratch) so they can't be committed by accident.
- **`.nvmrc`**: pin `22` so local and CI agree; workflows read it via
  `setup-node` `node-version-file`.
- **`package.json`**: add `"engines": { "node": ">=22" }` and a `"lint"` script.
- **`.github/dependabot.yml`**: weekly updates for `npm` and
  `github-actions` ecosystems, grouped minor/patch.
- **`.github/CODEOWNERS`**: route reviews (e.g. `* @loxilb-io/ui-maintainers`).
- **`.github/ISSUE_TEMPLATE/`**: `bug_report.yml`, `feature_request.yml`
  (+ `config.yml` linking discussions/security).
- **`.github/PULL_REQUEST_TEMPLATE.md`**: checklist (typecheck/tests/lint,
  screenshots for UI changes, spec re-vendor note).
- **README badges**: swap the static badges for live **Actions status** +
  coverage once CI is green.
- **GitHub settings (manual, documented in the runbook)**:
  - Branch protection on `main`: require PR review + the blocking status checks
    from §2.1 (`typecheck`, `spec-sync`, `api-mapping`, `test`, `build`,
    `docker-build`), linear history, no force-push.
  - **Secret scanning + push protection** ON (free for public repos).
  - Restrict who can run the `testbed` environment / dispatch `e2e.yml`.

---

## 4. Lint rollout (avoid a wall of red)

CRA ships ESLint, but there's no standalone config/gate. Introducing one on a
mature codebase usually surfaces hundreds of pre-existing warnings, so stage it:

1. Add a flat `eslint.config.js` (or extend `react-app`) + `"lint"` script.
2. Land it as **non-blocking** (`continue-on-error: true`) so PRs see the
   report without being blocked.
3. Burn the baseline down (autofix + targeted commits).
4. Flip `lint` to **blocking** and drop `CI=false` from the build step so
   warnings-as-errors is back on.

---

## 5. Rollout phases

| Phase | Deliverable | Risk | State |
|---|---|---|---|
| **P0** | Fix the red CI (H4 orphan) | none | ✅ done — `012b04a` |
| **P1** | Repo hygiene: `.gitignore`, `.nvmrc`, `engines`, `docker-build` on PR, bump action versions, split `ci.yml` into parallel jobs | low | proposed |
| **P2** | Security: `codeql.yml`, `dependency-review.yml`, `dependabot.yml`, enable secret scanning + push protection | low | proposed |
| **P3** | ESLint config + non-blocking `lint` job → later blocking | medium (noise) | proposed |
| **P4** | Self-hosted runner + `e2e.yml` (manual + nightly) | medium (ops) | proposed |
| **P5** | `release.yml` → GHCR image + GitHub Release on `v*` tags | medium | proposed |
| **P6** | Governance: CODEOWNERS, issue/PR templates, branch protection, README status badges | low | proposed |

Recommended order: P1 → P2 → P3 → P6 → P4 → P5. P4/P5 need out-of-band setup
(a runner host; confirming the GHCR namespace/permissions under `loxilb-io`).

---

## 6. Secrets & infrastructure inventory

| Secret / resource | Used by | Where |
|---|---|---|
| `E2E_ADMIN_USER`, `E2E_ADMIN_PASSWORD` | `e2e.yml` | repo/`testbed` environment secrets |
| Self-hosted runner labelled `loxilb-testbed` | `e2e.yml` | a testbed-adjacent host, registered to the repo |
| `GITHUB_TOKEN` (built-in) | `release.yml` GHCR push, `codeql.yml` | automatic; needs `packages: write` on the release job |
| GHCR namespace `ghcr.io/loxilb-io/loxilb-ui` | `release.yml` | confirm the org allows the repo to publish |

---

## 7. Open questions for the maintainer

1. **Runner host** — which machine hosts the self-hosted E2E runner, and can it
   reach the testbed OAM/gateway over the private network?
2. **GHCR namespace** — publish under `ghcr.io/loxilb-io/loxilb-ui`, or a
   personal namespace until the repo moves into the org?
3. **Node matrix** — gate on 22 only, or also test 20/24 for contributor
   breadth?
4. **Lint severity** — OK to land ESLint non-blocking first and tighten, or
   hold lint entirely until the baseline is clean?
5. **Nightly E2E** — desired, or manual-dispatch only to start?

---

## 8. Concrete file inventory (once approved)

```
.github/
  workflows/
    ci.yml                 # rewritten: parallel jobs, docker-build, v5 actions
    e2e.yml                # new: self-hosted testbed runner
    codeql.yml             # new
    dependency-review.yml  # new
    release.yml            # new: GHCR + GitHub Release on v* tags
  dependabot.yml           # new
  CODEOWNERS               # new
  ISSUE_TEMPLATE/
    bug_report.yml         # new
    feature_request.yml    # new
    config.yml             # new
  PULL_REQUEST_TEMPLATE.md # new
.nvmrc                     # new
eslint.config.js           # new (P3)
docs/
  E2E_RUNNING.md           # added (this session)
  CICD_PLAN.md             # this document
package.json               # + engines, + lint script
.gitignore                 # + .playwright-mcp/, F*.png
```
