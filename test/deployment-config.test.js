const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const deployWorkflow = fs.readFileSync(
  path.join(repoRoot, '.github/workflows/deploy-cloud-run.yml'),
  'utf8',
);
const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');

test('Cloud Run workflow deploys on port 8080 and passes BASE_DOMAIN', () => {
  assert.match(deployWorkflow, /--port 8080 \\/);
  assert.match(deployWorkflow, /--set-env-vars NODE_ENV=production,BASE_DOMAIN=\$BASE_DOMAIN/);
  assert.match(deployWorkflow, /BASE_DOMAIN: \$\{\{ vars\.BASE_DOMAIN \}\}/);
});

test('Docker image exposes the same application port as Cloud Run', () => {
  assert.match(dockerfile, /EXPOSE 8080/);
});
