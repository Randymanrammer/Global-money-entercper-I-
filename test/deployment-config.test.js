const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const deployWorkflow = fs.readFileSync(
  path.join(repoRoot, '.github/workflows/deploy-cloud-run.yml'),
  'utf8',
);
const deploymentSites = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'ops-site-deployments.json'), 'utf8'),
);
const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');

test('Cloud Run workflow deploys on port 8080 and passes per-site BASE_DOMAIN', () => {
  assert.match(deployWorkflow, /--port 8080 \\/);
  assert.match(deployWorkflow, /--set-env-vars NODE_ENV=production,BASE_DOMAIN=\$\{\{ steps\.base-domain\.outputs\.base_domain \}\}/);
  assert.match(deployWorkflow, /matrix:\s*\$\{\{ fromJson\(needs\.prepare-matrix\.outputs\.matrix\) \}\}/);
});

test('Deployment config defines 20 unique site targets', () => {
  assert.equal(Array.isArray(deploymentSites.sites), true);
  assert.equal(deploymentSites.sites.length, 20);

  const ids = deploymentSites.sites.map((site) => site.id);
  const serviceNames = deploymentSites.sites.map((site) => site.serviceName);
  const baseDomainEnvKeys = deploymentSites.sites.map((site) => site.baseDomainEnv);

  assert.equal(new Set(ids).size, 20);
  assert.equal(new Set(serviceNames).size, 20);
  assert.equal(new Set(baseDomainEnvKeys).size, 20);
  assert.equal(deploymentSites.sites.some((site) => site.deployOnPush), true);
});

test('Docker image exposes the same application port as Cloud Run', () => {
  assert.match(dockerfile, /EXPOSE 8080/);
});
