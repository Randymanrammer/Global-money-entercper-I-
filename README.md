# Global-money-entercper-I-

Production-ready baseline for publishing a public web platform with GitHub Actions, Azure Web App deployment, and ingress health verification.

## What this repository provides

- Autonomous CI/CD workflow for build, test, and publish on `main`
- Safe deployment gate requiring explicit publish configuration
- Public ingress verification after deployment
- Security policy and vulnerability reporting guidance

## Required repository configuration

Set these before expecting live public publishing:

- Repository Variable: `AZURE_WEBAPP_NAME`
- Repository Secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
- Optional Repository Variable: `INGRESS_HEALTHCHECK_URL`

## Publish flow

1. Push to `main` (or run `workflow_dispatch`)
2. Workflow builds/tests when `package.json` exists
3. Artifact is deployed to Azure Web App when publish configuration is valid
4. Ingress health endpoint is checked when configured

## Business and content standards

- Keep public-facing content clear, accurate, and professional
- Avoid placeholder values in production configuration
- Review security updates regularly and report vulnerabilities responsibly
