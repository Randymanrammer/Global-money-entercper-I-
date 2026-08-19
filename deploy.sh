#!/usr/bin/env bash
set -euo pipefail

# Root deployment automation script for Google Cloud Run
# Assumes gcloud CLI is authenticated and configured.

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-global-money-entercper}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
IMAGE="gcr.io/${PROJECT_ID}/global-platform:latest"
SERVICES=(ingress holodeck interceptor vault ops)

echo "[deploy] Building container image..."
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}"

echo "[deploy] Deploying services to Cloud Run..."
for svc in "${SERVICES[@]}"; do
  echo "[deploy] Deploying ${svc}..."
  gcloud run deploy "global-${svc}" \
    --image "${IMAGE}" \
    --region "${REGION}" \
    --platform managed \
    --port 8080 \
    --allow-unauthenticated \
    --set-env-vars "SERVICE_NAME=${svc},PORT=8080" \
    --project "${PROJECT_ID}"
done

echo "[deploy] All services deployed."
