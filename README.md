# Global-money-entercper-I-

A starter repository for building and deploying a web application with GitHub Actions and Azure Web Apps.

## Repository status

This repository now includes a concrete implementation baseline for:

- target architecture definitions
- BigQuery, DNS, and ingress policy artifacts
- phased delivery execution controls
- 100-item delivery backlog
- client support and quality-gate readiness

## Core implementation artifacts

- `/architecture/target-architecture.yaml`
- `/ops/delivery-backlog-100.yaml`
- `/ops/phased-execution.yaml`
- `/ops/first-10-high-impact-items.yaml`
- `/ops/quality-gate.yaml`
- `/infra/bigquery/schema/v1_transaction_events.sql`
- `/infra/bigquery/ingestion-policy.yaml`
- `/infra/dns/dns-zones.example.yaml`
- `/infra/ingress/ingress-policy.yaml`
- `/support/client-support-model.yaml`

## Existing repository controls

- `/SECURITY.md` — vulnerability reporting policy
- `/.github/ISSUE_TEMPLATE/custom.md` — structured issue intake
- `/.github/workflows/azure-webapps-node.yml` — CI/CD workflow with safe defaults

## Azure deployment workflow setup

To enable deployment from GitHub Actions:

1. Create an Azure Web App.
2. Add repository secret `AZURE_WEBAPP_PUBLISH_PROFILE` with your publish profile XML.
3. Add repository variable `AZURE_WEBAPP_NAME` with your Azure Web App name.
4. (Optional) Add repository variable `AZURE_WEBAPP_PACKAGE_PATH` if your deploy path is not repository root.

The workflow skips Node build/test automatically if no `package.json` exists.

## Next execution step

Start applying backlog items in priority order, promoting validated controls from `dev` to `stage` to `prod` with evidence for each phase exit criterion.
