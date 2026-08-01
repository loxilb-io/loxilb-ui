# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.0]

### Added
- Initial public release of loxilb-ui: React single-page web console for managing LoxiLB instances.
- Dashboard, load-balancer, networking, security, and IPsec management views over the OAM and gateway APIs.
- Client-side authentication and role-aware navigation (admin/operator/viewer).
- Configuration snapshot and file-management workflows.
- Vendored API specs with generated types kept in sync and a connector-to-route mapping guard.
- Docker (multi-stage Node build served by nginx) and Kubernetes deployment manifests.
- CI (typecheck, API-sync checks, unit + contract tests, production build, container image build), end-to-end tests, and secret scanning.

[Unreleased]: https://github.com/loxilb-io/loxilb-ui/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/loxilb-io/loxilb-ui/releases/tag/v0.9.0
