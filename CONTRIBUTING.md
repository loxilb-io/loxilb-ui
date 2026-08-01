# Contributing to LoxiLB UI

Thanks for your interest in improving LoxiLB UI. This document describes how to
set up a development environment and the conventions we follow.

## Getting started

1. Fork the repository and clone your fork.
2. Install Node.js 22+ and npm.
3. Install dependencies and copy the environment file:

   ```bash
   npm ci
   cp .env.example .env.development   # point it at your OAM backend
   ```

4. Start the dev server and run the tests:

   ```bash
   npm start
   npm test
   ```

## Development workflow

- Create a topic branch off `main` (e.g. `fix/token-refresh`, `feat/ipsec-presets`).
- Keep changes focused; unrelated cleanups belong in separate PRs.
- Ensure the following pass before opening a PR:

  ```bash
  npm run typecheck         # tsc --noEmit
  npm run gen:api:check     # generated API types are in sync with the vendored specs
  npm run api:check-mapping # every connector call maps to a declared backend route
  npm test                  # unit + backend-contract tests
  npm run build             # production build
  ```

- Update or add tests for any behavior change.
- If you change how the app talks to the backend, regenerate the typed API layer
  (`npm run gen:api`) and keep the vendored specs in sync (`npm run sync:specs`).
- Update documentation (`README.md`, `docs/`) when you change user-facing behavior
  or configuration.

## Coding conventions

- TypeScript throughout; follow the existing style of the files you touch
  (camelCase for new symbols, functional React components with hooks).
- Prefer the typed API helpers in `src/api/` over hand-written fetch calls — a
  wrong path literal should be a compile error, not a runtime one.
- Never commit secrets, `.env*` files, or generated artifacts. Secrets come from
  environment variables; use placeholder values in example manifests.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/), e.g.:

```
feat(ipsec): add AWS/Azure tunnel presets
fix(auth): clear the session token on 401
docs(readme): document the Caddy edge deployment
```

## Sign your commits (DCO)

We require a [Developer Certificate of Origin (DCO)](https://developercertificate.org/) sign-off on
every commit. The sign-off certifies that you wrote the change or otherwise have the right to submit it
under the project's license.

Add a `Signed-off-by` line to each commit — it must match the git author name and email:

```
Signed-off-by: Your Name <your.name@example.com>
```

Git adds it automatically with the `-s` flag:

```bash
git commit -s -m "feat(ipsec): add AWS/Azure tunnel presets"
```

If you forgot on an unpushed commit, amend it with `git commit --amend -s`. PRs whose commits are not
signed off will be blocked by the DCO check.

## Pull request policy

All changes land through pull requests — direct pushes to `main` are disabled.

### Opening a PR
- Push your topic branch to your fork and open a PR against `main`.
- Fill in the PR template: describe the motivation and the change, and link any related issue
  (e.g. `Closes #123`).
- Give the PR a [Conventional Commits](https://www.conventionalcommits.org/) style title — it becomes
  the squash-merge commit message.
- Keep the PR focused and reasonably small; unrelated changes belong in separate PRs.

### Requirements to merge
- **At least one approving review from a LoxiLB maintainer is required.** Maintainers are the code
  owners in [.github/CODEOWNERS](.github/CODEOWNERS); GitHub requests their review automatically, and
  branch protection blocks the merge until a maintainer approves.
- All CI checks pass — typecheck, the API-sync and route-mapping guards, unit/contract tests, the
  production build, the container image build, the secret scan, the hygiene gate, and the DCO check.
- All commits are signed off (DCO) — see [Sign your commits](#sign-your-commits-dco).
- New or changed behavior is covered by tests, and docs are updated where relevant.
- The branch is up to date with `main` and all review threads are resolved.

Project roles and how maintainer decisions are made are described in [GOVERNANCE.md](GOVERNANCE.md).

### Review process
- A maintainer will review as soon as they can and may request changes; please be responsive.
- Address feedback with follow-up commits. Avoid force-pushing once a review has started so reviewers
  can follow incremental changes — the PR is squash-merged at the end, so intermediate commits don't
  matter.
- Authors cannot approve or merge their own PRs. Once it has a maintainer approval and green CI, a
  maintainer merges it via squash.
- A new approval is required after any further changes (branch protection dismisses stale approvals on
  new commits).
- PRs with no author activity for an extended period may be marked stale; reopen when you're ready to
  continue.

## Security

Do **not** open public issues for security vulnerabilities. Follow the process in
[SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
