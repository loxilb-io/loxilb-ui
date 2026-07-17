# INTERNAL — Naver Cloud Testbed & Dev/Test Workflow

> **⚠ INTERNAL ONLY.** Contains credentials and infrastructure addresses.
> This file (the whole `docs/internal/` directory) is excluded from the public
> OSS release — see `CODE_QUALITY_REFACTORING_PLAN.md` P0-4.

## Topology

```
                 10.0.0.0/24 (private)                    Internet
   ┌──────────────────────┐   ┌──────────────────────┐
   │ kv-client            │   │ kv-loxilb            │
   │ 223.130.142.175 pub  │   │ 110.165.19.107 pub   │
   │ 10.0.0.13 priv       │   │ 10.0.0.12 priv       │
   │                      │   │                      │
   │ • loxilb-oam         │   │ • loxilb-inference-  │
   │ • loxilb-ui (deploy) │──▶│   gateway            │
   │ • loxilb-ai-controller│  │   (image pulled:     │
   └──────────────────────┘   │   ghcr.io/loxilb-io/ │
                              │   loxilb-inference-  │
                              │   gateway:latest-u24)│
                              └──────────────────────┘
```

- SSH: `root` / `Admin@Admin` (password auth; from a shell use
  `sshpass -p 'Admin@Admin' ssh root@<ip>`). Key auth not installed — run
  `ssh-copy-id root@<ip>` once if you want it.
- Source repos (local dev machine): UI `~/go/src/loxilb-ui`,
  OAM `~/go/src/oam-loxilb`, gateway `~/go/src/loxilb-inference-gateway`.

## Workflow A — daily development (preferred)

Run the **UI locally**, everything else remote:

1. OAM runs on kv-client (docker-compose in `/root/oam-loxilb`), configured to
   reach the gateway at `10.0.0.12:11111` via the instance registry.
2. Gateway runs on kv-loxilb (`loxilb` container from the image above).
3. Local UI dev server with `REACT_APP_API_URL` (Vite: `VITE_API_URL` after Q1
   migration) pointing at kv-client's OAM endpoint; use the dev-server proxy to
   avoid CORS. All gateway traffic proxies through OAM
   (`/loxilbs/{id}/netlox/v1/*`), so the UI needs no direct gateway access.

Hot reload, no sync step.

## Workflow B — full-stack verification / e2e

Deployed stack on kv-client, used for the Playwright e2e gate and
playwright-mcp agentic validation (quality plan Q5), and for the W1 gateway
compatibility pass:

1. Sync sources:
   ```
   rsync -az --delete --exclude node_modules --exclude .git --exclude build \
     --exclude .codegraph --exclude .claude --exclude .serena --exclude claudedocs \
     ~/go/src/loxilb-ui/ root@223.130.142.175:/root/loxilb-ui/
   rsync -az --delete --exclude .git --exclude node_modules --exclude data --exclude certs \
     ~/go/src/oam-loxilb/ root@223.130.142.175:/root/oam-loxilb/
   ```
2. Build UI + run behind nginx, OAM via its docker-compose, on kv-client.
3. Register the kv-loxilb gateway instance in OAM (`10.0.0.12:11111`).
4. Run e2e suites against the deployed UI.

Prometheus (needed for the monitoring-replacement views, integration plan W2+)
is deployed on kv-client alongside OAM, scraping the gateway at
`10.0.0.12:11111/netlox/v1/metrics` plus the ai-controller/kv-agent sidecar
ports; the instance's `prometheus_url` in OAM points at it.

## Node inventory (verified 2026-07-17)

| | kv-client | kv-loxilb |
|---|---|---|
| Docker | 28.2.2 | ✓ (loxilb container up) |
| Containers | `loxilb-ai-controller` | `loxilb` |
| Synced dirs | `/root/loxilb-ui`, `/root/oam-loxilb` | — |
