const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../server');

function request(app, { path = '/', host = 'localhost', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
          headers: { Host: host, ...headers },
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

test('hub endpoint exposes the operations-center definition and top actions', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    path: '/hub',
    host: 'example.com',
  });

  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.purpose, 'operations-center');
  assert.equal(payload.topActions.length, 3);
  assert.equal(payload.realtime.authRequired, true);
});

test('improvements endpoint returns the 100-item prioritized backlog', async () => {
  const response = await request(createApp({ baseDomain: 'example.com' }), {
    path: '/hub/improvements',
    host: 'example.com',
  });

  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.total, 100);
  assert.deepEqual(payload.waves, { critical: 10, 'high-value': 30, optimization: 60 });
});

test('status system endpoint requires authentication token', async () => {
  const app = createApp({ baseDomain: 'example.com', hubToken: 'secure-token' });
  const unauthorized = await request(app, {
    path: '/status/system',
    host: 'example.com',
  });
  assert.equal(unauthorized.statusCode, 401);

  const authorized = await request(app, {
    path: '/status/system',
    host: 'example.com',
    headers: { 'x-hub-token': 'secure-token' },
  });
  assert.equal(authorized.statusCode, 200);
});

test('polling fallback requires auth and role/channel authorization', async () => {
  const app = createApp({ baseDomain: 'example.com', hubToken: 'secure-token' });

  const missingAuth = await request(app, {
    path: '/events/poll?role=client&channel=customer',
    host: 'example.com',
  });
  assert.equal(missingAuth.statusCode, 401);

  const forbiddenChannel = await request(app, {
    path: '/events/poll?role=client&channel=office',
    host: 'example.com',
    headers: { 'x-hub-token': 'secure-token' },
  });
  assert.equal(forbiddenChannel.statusCode, 403);

  const allowed = await request(app, {
    path: '/events/poll?role=client&channel=customer',
    host: 'example.com',
    headers: { 'x-hub-token': 'secure-token' },
  });
  assert.equal(allowed.statusCode, 200);
  const payload = JSON.parse(allowed.body);
  assert.equal(payload.mode, 'polling-fallback');
});
