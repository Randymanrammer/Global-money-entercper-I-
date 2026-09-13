# Global Money Interceptor Platform

This repository contains a modular five-program Node.js platform designed for Google Cloud Run. Each program can be deployed independently from the same codebase by setting `SERVICE_TARGET`.

## Programs

### 1. `/services/ingress`
Public HTTPS ingress service built on Express.

- `GET /health` returns aggregated platform health.
- `POST /api/v1/communicate` accepts external communication payloads, forwards them to the interceptor, optionally routes settlement instructions through the vault, and returns a visualization payload for the holodeck dashboard.
- `GET /dashboard` serves the shared diagnostic dashboard.
- Supports local in-process dispatch or HTTP dispatch to a separately deployed interceptor using `INTERCEPTOR_BASE_URL`.

### 2. `/services/holodeck`
Visual staging and diagnostic UI service.

- Serves the single-file `dashboard.html` interface at `/` and `/dashboard`.
- Publishes `GET /api/v1/visualize` for dashboard-ready cards and telemetry.
- Tracks whether the dashboard template is available for runtime use.

### 3. `/services/interceptor`
Automation and queue-processing service.

- Provides a high-velocity in-memory queue counter with per-job UUIDs.
- `POST /api/v1/queue` accepts direct pipeline jobs.
- `POST /api/v1/webhooks/:source` accepts generic webhook events for automation fan-in.
- Returns queue depth, active jobs, and processed totals from `/health`.

### 4. `/services/vault`
Settlement routing and payload verification service.

- Verifies HMAC SHA-256 payload signatures.
- Applies in-memory rate limiting to settlement verification and routing endpoints.
- Routes settlement instructions to `domestic-usd`, `global-wire`, or `manual-review` tracks.
- Exposes `POST /api/v1/settlements/verify`, `POST /api/v1/settlements/route`, and `GET /health`.

### 5. `/services/ops`
Telemetry, runtime configuration, and deployment metadata service.

- `GET /health` reports runtime state plus dependent service health.
- `GET /api/v1/metrics` returns in-memory request and event telemetry.
- `GET /api/v1/config` returns environment configuration and the deployment matrix.

## Runtime model

The root `server.js` is a shared entrypoint. It reads `SERVICE_TARGET` and starts the matching service module:

- `ingress`
- `holodeck`
- `interceptor`
- `vault`
- `ops`

If `SERVICE_TARGET` is omitted, the platform starts `ingress` by default on port `8080`.

## File map

- `package.json` – root manifest and scripts.
- `server.js` – shared entrypoint for all Cloud Run deployments.
- `dashboard.html` – single-file visual diagnostics dashboard.
- `Dockerfile` – production Cloud Run image definition.
- `deploy.sh` – deploys all five services to Google Cloud Run.
- `.github/workflows/deploy.yml` – CI and Cloud Run deployment workflow.
- `tests/platform.test.js` – runtime verification tests.

## How the programs communicate

1. External clients call the **ingress** service.
2. Ingress normalizes each message and hands it to the **interceptor** queue pipeline, either locally or through `INTERCEPTOR_BASE_URL` over HTTP using Axios.
3. When settlement data is supplied, ingress forwards it to the **vault** for verification and route selection.
4. Ingress requests a visualization summary from the **holodeck** model builder.
5. All services publish request and event data into the **ops** telemetry layer.

## Local development

Install dependencies:

```bash
npm install
```

Run the default ingress target:

```bash
npm start
```

Run a specific program:

```bash
SERVICE_TARGET=holodeck npm start
SERVICE_TARGET=interceptor npm start
SERVICE_TARGET=vault npm start
SERVICE_TARGET=ops npm start
```

Run validation:

```bash
npm test
npm run build
```

## Google Cloud Run deployment

### One-command multi-service deployment

```bash
./deploy.sh
```

The script enables the required Google Cloud APIs and deploys these Cloud Run services:

- `global-money-ingress`
- `global-money-holodeck`
- `global-money-interceptor`
- `global-money-vault`
- `global-money-ops`

### Required environment variables

- `GCP_PROJECT_ID` – Google Cloud project ID.
- `GCP_REGION` – deployment region, defaults to `us-central1`.
- `GCP_SETTLEMENT_SECRET_NAME` – Secret Manager secret name bound into Cloud Run as `SETTLEMENT_SHARED_SECRET`.
- `INTERCEPTOR_QUEUE_LATENCY_MS` – optional queue simulation latency.
- `INTERCEPTOR_BASE_URL` – optional URL for HTTP dispatch from ingress to an external interceptor deployment.

## CI/CD workflow

The GitHub Actions workflow performs these steps on push and pull request events:

1. Installs dependencies with `npm ci`.
2. Runs the Node.js test suite.
3. Verifies the runtime contract with `npm run build`.
4. Smoke-tests each `SERVICE_TARGET`.
5. Builds the production container.
6. Deploys each service to Cloud Run on pushes to `main`.

Deployment binds the settlement secret through Cloud Run secret integration rather than a plaintext environment value.

## Dashboard

The dashboard is a static single-file experience backed by service health responses.

- Works directly from **holodeck** or **ingress** at `/dashboard`.
- Polls `/health` every 15 seconds.
- Surfaces queue depth, settlement ledger depth, and recent telemetry events.
