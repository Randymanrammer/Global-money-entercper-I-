const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServiceApp } = require('../server');
const { createSignature } = require('../services/vault/server');

async function withServer(serviceTarget, run) {
  const app = createServiceApp(serviceTarget);
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('ingress health exposes downstream services', async () => {
  await withServer('ingress', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.service, 'ingress');
    assert.equal(payload.downstream.interceptor.status, 'ok');
    assert.equal(payload.downstream.vault.status, 'ok');
  });
});

test('ingress communicate queues interceptor work and optional settlement routing', async () => {
  const settlementPayload = { amount: 250, currency: 'USD', beneficiary: 'ops' };
  const signature = createSignature(settlementPayload, 'local-dev-secret');

  await withServer('ingress', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/communicate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: 'test message',
        settlement: {
          ...settlementPayload,
          signature
        }
      })
    });

    assert.equal(response.status, 202);
    const payload = await response.json();
    assert.equal(payload.status, 'accepted');
    assert.equal(payload.interceptor.pipeline, 'ingress-communication');
    assert.equal(payload.settlement.route, 'domestic-usd');
    assert.equal(payload.settlement.verification.verified, true);
  });
});

test('ingress returns structured JSON errors for failed remote interceptor dispatches', async () => {
  const originalBaseUrl = process.env.INTERCEPTOR_BASE_URL;
  process.env.INTERCEPTOR_BASE_URL = 'http://127.0.0.1:1';

  try {
    await withServer('ingress', async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/communicate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'external dispatch' })
      });

      const payload = await response.json();
      assert.equal(response.status, 502);
      assert.equal(payload.status, 'failed');
      assert.match(payload.error, /Unable to dispatch/);
    });
  } finally {
    if (originalBaseUrl === undefined) {
      delete process.env.INTERCEPTOR_BASE_URL;
    } else {
      process.env.INTERCEPTOR_BASE_URL = originalBaseUrl;
    }
  }
});

test('ingress can dispatch to an external interceptor over axios', async () => {
  const originalBaseUrl = process.env.INTERCEPTOR_BASE_URL;
  const stubServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/v1/queue') {
      res.writeHead(202, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        status: 'queued',
        result: {
          pipeline: 'manual-queue',
          jobId: 'remote-job',
          queueDepth: 0,
          payload: { origin: 'remote' }
        }
      }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => stubServer.listen(0, resolve));
  process.env.INTERCEPTOR_BASE_URL = `http://127.0.0.1:${stubServer.address().port}`;

  try {
    await withServer('ingress', async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/communicate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'external dispatch' })
      });

      const payload = await response.json();
      assert.equal(response.status, 202);
      assert.equal(payload.interceptor.transport, 'http');
      assert.equal(payload.interceptor.jobId, 'remote-job');
    });
  } finally {
    if (originalBaseUrl === undefined) {
      delete process.env.INTERCEPTOR_BASE_URL;
    } else {
      process.env.INTERCEPTOR_BASE_URL = originalBaseUrl;
    }
    await new Promise((resolve, reject) => stubServer.close((error) => (error ? reject(error) : resolve())));
  }
});

test('holodeck serves dashboard html', async () => {
  await withServer('holodeck', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/dashboard`);
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.match(text, /Diagnostic Dashboard/);
  });
});

test('vault verify endpoint rejects missing signatures', async () => {
  await withServer('vault', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settlements/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { amount: 10 } })
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.verified, false);
    assert.equal(payload.reason, 'missing-signature');
    assert.equal(Object.hasOwn(payload, 'expectedSignature'), false);
  });
});

test('vault verify endpoint accepts valid signatures', async () => {
  const payload = { amount: 42, currency: 'USD' };
  const signature = createSignature(payload, 'local-dev-secret');

  await withServer('vault', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settlements/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload, signature })
    });

    const result = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(result, { verified: true, reason: 'verified' });
  });
});

test('vault verify endpoint rejects invalid signatures', async () => {
  await withServer('vault', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settlements/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { amount: 42 }, signature: 'invalid-signature' })
    });

    const result = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(result, { verified: false, reason: 'signature-mismatch' });
  });
});

test('vault verify endpoint rate limits repeated requests', async () => {
  await withServer('vault', async (baseUrl) => {
    let lastStatus = 200;

    for (let index = 0; index < 31; index += 1) {
      const response = await fetch(`${baseUrl}/api/v1/settlements/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload: { amount: index }, signature: 'invalid-signature' })
      });
      lastStatus = response.status;
    }

    assert.equal(lastStatus, 429);
  });
});

test('ops config exposes deployment matrix', async () => {
  await withServer('ops', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/config`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.deploymentMatrix.length, 5);
  });
});
