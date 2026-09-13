#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-us-central1}"
SERVICES=(ingress holodeck interceptor vault ops)

if [[ -z "${PROJECT_ID}" ]]; then
  echo "[error] No active Google Cloud project found. Set GCP_PROJECT_ID or run 'gcloud config set project ...'." >&2
  exit 1
fi

echo "Deploying ${#SERVICES[@]} services to project ${PROJECT_ID} in ${REGION}"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${PROJECT_ID}"

for service in "${SERVICES[@]}"; do
  cloud_run_name="global-money-${service}"
  echo "--- Deploying ${cloud_run_name} ---"
  gcloud run deploy "${cloud_run_name}" \
    --source . \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --allow-unauthenticated \
    --set-env-vars="SERVICE_TARGET=${service},GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION}"
done

echo "Deployment finished for: ${SERVICES[*]}"
