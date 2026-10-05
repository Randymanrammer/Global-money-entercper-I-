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

## Standardized multi-site deployment

The Google Cloud Run workflow in `/home/runner/work/Global-money-entercper-I-/Global-money-entercper-I-/.github/workflows/deploy-cloud-run.yml` now uses one repeatable pipeline for multiple sites:

- deployment targets are sourced from `/home/runner/work/Global-money-entercper-I-/Global-money-entercper-I-/ops-site-deployments.json`
- push deployments use only targets where `deployOnPush` is `true`
- manual deployments can deploy one site (`site-01` ... `site-20`) or all sites
- each site resolves its own `BASE_DOMAIN` from `BASE_DOMAIN_SITE_XX` repository variables

### Per-site configuration contract

Each entry in `ops-site-deployments.json` must include:
- `id` (example: `site-01`)
- `serviceName` (Cloud Run service name)
- `baseDomainEnv` (repository variable key such as `BASE_DOMAIN_SITE_01`)
- `deployOnPush` (`true` or `false`)

## Workforce rollout checklist (20-site deployment)

- [ ] Confirm all 20 site entries are present and correct in `ops-site-deployments.json`
- [ ] Confirm `serviceName` values map to existing Cloud Run services
- [ ] Set repository variables `BASE_DOMAIN_SITE_01` ... `BASE_DOMAIN_SITE_20`
- [ ] Confirm DNS and Cloud Run domain mappings for each site apex/domain
- [ ] Run workflow manually with `target_site=site-01` as canary
- [ ] Run workflow manually with `target_site=all` after canary validation
- [ ] Verify `/health` and `api.<BASE_DOMAIN>/status` on each deployed site
- [ ] Confirm no nested subdomain routing leaks per site

## Local validation

```bash
npm test
npm start
```
