# Global-money-entercper-I-

Express ingress service for the Global Money Interceptor platform.

## Network map

### Application-owned behavior
- Port `8080` is the only runtime port for the service.
- `GET /health` returns service health for root and allowed hosts.
- `GET /status` is reserved for the `api` subdomain.
- Apex domain (`BASE_DOMAIN`) serves the primary client/root experience.
- `www.<BASE_DOMAIN>` is treated as the same root experience.
- Single-label custom subdomains such as `clienthub.<BASE_DOMAIN>` are treated as deployment variants.

### External infrastructure dependencies
- DNS records for the apex domain and each allowed single-label subdomain.
- Cloud Run domain mappings and ingress configuration.
- TLS certificates for the apex domain and mapped subdomains.
- Repository variable `BASE_DOMAIN` and Google Cloud deployment credentials.

## Routing rules

- Allowed managed hosts:
  - `<BASE_DOMAIN>`
  - `www.<BASE_DOMAIN>`
  - `api.<BASE_DOMAIN>`
  - `<single-label>.<BASE_DOMAIN>`
- Local verification hosts remain allowed:
  - `localhost`
  - `127.0.0.1`
  - `::1`
  - `*.localhost`
- Rejected hosts:
  - Any host outside the configured `BASE_DOMAIN`
  - Nested managed subdomains such as `alpha.beta.<BASE_DOMAIN>`

When `BASE_DOMAIN` is not configured, the service falls back to permissive development behavior and treats generic multi-label hosts as preview-style subdomains.

## Deployment verification

The Google Cloud Run workflow in `/home/runner/work/Global-money-entercper-I-/Global-money-entercper-I-/.github/workflows/deploy-cloud-run.yml` is expected to:
- deploy on port `8080`
- inject `BASE_DOMAIN` from repository variables
- publish the container through Artifact Registry before Cloud Run deployment

## Readiness checklist

- [ ] `BASE_DOMAIN` is set to the production apex domain
- [ ] Cloud Run domain mappings exist for the apex domain and required subdomains
- [ ] DNS points the apex domain and required subdomains to Cloud Run
- [ ] TLS is active for each mapped domain
- [ ] `npm test` passes locally and in CI
- [ ] `/health` responds on the root domain
- [ ] `api.<BASE_DOMAIN>/status` responds successfully
- [ ] Required client or hub subdomains resolve as single-label subdomains
- [ ] No unsupported nested subdomains are routed to this service

## Local validation

```bash
npm test
npm start
```
