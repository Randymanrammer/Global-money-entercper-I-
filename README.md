# Global Money Entercper Platform

A multi-tier Node.js platform organized into five communicating services:

1. **Ingress** — public HTTPS gateway and API router
2. **Holodeck** — web visual staging and single-file dashboard UI
3. **Interceptor** — automation pipeline with queue handlers and webhook processors
4. **Vault** — settlement gateway with transaction routing and payload verification
5. **Ops** — telemetry, health monitoring, and environment configuration

## Quick start

```bash
npm install
npm start          # starts ingress on port 8080
```

Run other services locally on separate ports:

```bash
PORT=8081 node services/holodeck/index.js
PORT=8082 node services/interceptor/index.js
PORT=8083 node services/vault/index.js
PORT=8084 node services/ops/index.js
```

## Project layout

```
.
├── package.json
├── Dockerfile
├── deploy.sh
├── dashboard.html
├── README.md
└── services
    ├── ingress      # Express gateway: /health, /api/v1/communicate
    ├── holodeck     # Visual staging + stage.html template
    ├── interceptor  # Queue + webhook automation
    ├── vault        # Settlement + HMAC payload verification
    └── ops          # Telemetry, metrics, config
```

## Service communication

- Ingress exposes `/api/v1/communicate` and scans every service's `/health` endpoint.
- Ingress forwards `POST /api/v1/communicate/:service` to the matching service's `/receive` endpoint.
- Each service exposes `/health` and `/receive` for uniform inter-service messaging.

## Deployment

The production container exposes port `8080` and is configured for Google Cloud Run.

```bash
npm run deploy     # or: bash deploy.sh
```

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs tests, lint, and deploys on pushes to `main` or `master`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP port (Cloud Run) |
| `HOLODECK_URL` | `http://localhost:8081` | Holodeck service URL |
| `INTERCEPTOR_URL` | `http://localhost:8082` | Interceptor service URL |
| `VAULT_URL` | `http://localhost:8083` | Vault service URL |
| `OPS_URL` | `http://localhost:8084` | Ops service URL |
| `VAULT_SECRET` | `dev-secret` | HMAC secret for payload verification |

## Scripts

- `npm start` — run ingress
- `npm run dev` — run ingress with file watching
- `npm test` — run Node.js built-in tests
- `npm run lint` — lint all services
- `npm run deploy` — deploy to Google Cloud Run
