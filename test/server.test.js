const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp, normalizeBaseDomain } = require('../server');

function request(app, { path = '/', host = 'localhost' } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
          headers: { Host: host },
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            server.close((closeError) => {
              if (closeError) {
                reject(closeError);
                return;
              }

              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body,
              });
            });
          });
        },
      );

      req.on('error', (error) => {
        server.close(() => reject(error));
      });

      req.end();
    });
  });
}

test('health endpoint reports service status', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    path: '/health',
    host: 'example.com',
  });

  assert.equal(response.statusCode, 200);

  const payload = JSON.parse(response.body);
  assert.equal(payload.status, 'OK');
  assert.equal(payload.baseDomain, 'example.com');
  assert.equal(payload.routingMode, 'managed-domain');
});

test('apex domain serves the root platform page', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    host: 'example.com',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, 'Instant Online Success Inc. - Master Platform Operational');
});

test('www subdomain is treated as the root platform host', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    host: 'www.example.com',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, 'Instant Online Success Inc. - Master Platform Operational');
});

test('api subdomain exposes the status endpoint', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    path: '/status',
    host: 'api.example.com:8080',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { api: 'online', mode: 'interceptor' });
});

test('single-label deployment subdomains resolve to active variants', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    host: 'clienthub.example.com',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    message: 'Connected to deployment variant subdomain: clienthub',
    status: 'active',
  });
});

test('localhost remains valid for local client verification', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    host: 'localhost:3000',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, 'Instant Online Success Inc. - Master Platform Operational');
});

test('hosts outside the configured base domain are rejected', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    host: 'malicious.test',
  });

  assert.equal(response.statusCode, 421);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Host is not mapped to this service',
    reason: 'external-host',
    hostname: 'malicious.test',
    baseDomain: 'example.com',
  });
});

test('nested subdomains are rejected when a managed base domain is configured', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    host: 'alpha.beta.example.com',
  });

  assert.equal(response.statusCode, 421);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Host is not mapped to this service',
    reason: 'nested-subdomain',
    hostname: 'alpha.beta.example.com',
    baseDomain: 'example.com',
  });
});

test('fallback mode still supports generic subdomains when no base domain is configured', async () => {
  const response = await request(createApp({ baseDomain: '' }), {
    host: 'preview.anything.test',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    message: 'Connected to deployment variant subdomain: preview',
    status: 'active',
  });
});

test('normalizeBaseDomain trims leading/trailing whitespace', () => {
  assert.equal(normalizeBaseDomain('  example.com  '), 'example.com');
});

test('normalizeBaseDomain strips leading dots', () => {
  assert.equal(normalizeBaseDomain('.example.com'), 'example.com');
  assert.equal(normalizeBaseDomain('..example.com'), 'example.com');
});

test('normalizeBaseDomain handles leading whitespace and dots together', () => {
  assert.equal(normalizeBaseDomain('   .example.com  '), 'example.com');
});

test('normalizeBaseDomain handles non-string values', () => {
  assert.equal(normalizeBaseDomain(null), '');
  assert.equal(normalizeBaseDomain(undefined), '');
  assert.equal(normalizeBaseDomain(123), '');
  assert.equal(normalizeBaseDomain({}), '');
});
