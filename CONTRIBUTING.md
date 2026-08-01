# Contributing to LoxiLB UI

Thank you for your interest in contributing! This document explains how to get set up and how changes are accepted.

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.development` and point it at your OAM backend.
4. Start the dev server:
   ```bash
   npm start
   ```

## Making changes

- Create a feature branch from `main` (e.g. `feat/my-feature`, `fix/my-bug`).
- Keep pull requests focused — one logical change per PR.
- Follow the existing code style of the files you touch (TypeScript, camelCase for new symbols).
- Do not commit environment files, credentials, or generated artifacts.

## Commit messages

Use conventional-commit style prefixes:

- `feat:` new user-facing functionality
- `fix:` bug fixes
- `refactor:` code changes that neither fix a bug nor add a feature
- `docs:` documentation only
- `chore:` build, tooling, or repo maintenance

## Pull requests

- Describe **what** changed and **why**.
- Make sure the project type-checks and builds: `npx tsc --noEmit && npm run build`.
- Link related issues where applicable.

## Reporting bugs / requesting features

Open a GitHub issue with steps to reproduce (for bugs) or the use case you want addressed (for features). Screenshots are very helpful for UI issues.

## Security issues

Please do **not** open public issues for security vulnerabilities — see [SECURITY.md](SECURITY.md).
