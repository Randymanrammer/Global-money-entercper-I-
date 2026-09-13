const express = require('express');
const { attachTelemetry, recordEvent } = require('../ops/telemetry');

const interceptorState = {
  queueDepth: 0,
  processed: 0,
  activeJobs: 0,
  webhooksReceived: 0,
  recentJobs: []
};

function normalizePayload(payload = {}) {
  return {
    origin: payload.origin || 'ingress',
    message: payload.message || 'No message supplied',
    metadata: payload.metadata || {},
    receivedAt: new Date().toISOString()
  };
}

async function executeJob(job, latencyMs = Number(process.env.INTERCEPTOR_QUEUE_LATENCY_MS || 25)) {
  interceptorState.queueDepth += 1;
  interceptorState.activeJobs += 1;
  await new Promise((resolve) => setTimeout(resolve, latencyMs));
  interceptorState.queueDepth -= 1;
  interceptorState.activeJobs -= 1;
  interceptorState.processed += 1;

  const result = {
    queueDepth: interceptorState.queueDepth,
    jobId: `job-${Date.now()}`,
    pipeline: job.pipeline,
    processedAt: new Date().toISOString(),
    payload: job.payload
  };

  interceptorState.recentJobs.unshift(result);
  interceptorState.recentJobs = interceptorState.recentJobs.slice(0, 10);
  return result;
}

async function handleCommunication(payload, options = {}) {
  const normalized = normalizePayload(payload);
  recordEvent('interceptor', 'communication.accepted', { origin: normalized.origin });
  return executeJob({ pipeline: options.pipeline || 'communicate', payload: normalized }, options.queueLatencyMs);
}

async function processWebhook(source, payload, options = {}) {
  interceptorState.webhooksReceived += 1;
  recordEvent('interceptor', 'webhook.received', { source });
  return executeJob({
    pipeline: `webhook:${source}`,
    payload: {
      source,
      event: payload.event || 'unknown',
      body: payload
    }
  }, options.queueLatencyMs);
}

function getHealth() {
  return {
    service: 'interceptor',
    status: 'ok',
    queueDepth: interceptorState.queueDepth,
    activeJobs: interceptorState.activeJobs,
    processed: interceptorState.processed,
    webhooksReceived: interceptorState.webhooksReceived,
    recentJobs: interceptorState.recentJobs
  };
}

function createApp({ config }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  attachTelemetry(app, 'interceptor');

  app.get('/health', (req, res) => {
    res.json(getHealth());
  });

  app.post('/api/v1/queue', async (req, res) => {
    const result = await handleCommunication(req.body, { queueLatencyMs: config.queueLatencyMs, pipeline: 'manual-queue' });
    res.status(202).json({ status: 'queued', result });
  });

  app.post('/api/v1/webhooks/:source', async (req, res) => {
    const result = await processWebhook(req.params.source, req.body, { queueLatencyMs: config.queueLatencyMs });
    res.status(202).json({ status: 'accepted', result });
  });

  return app;
}

module.exports = {
  createApp,
  getHealth,
  handleCommunication,
  processWebhook
};
