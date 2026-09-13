const express = require('express');
const { attachTelemetry, recordEvent } = require('../ops/telemetry');
const { handleCommunication, getHealth: getInterceptorHealth } = require('../interceptor/server');
const { buildVisualizationModel, getHealth: getHolodeckHealth, readDashboardHtml } = require('../holodeck/server');
const { routeTransaction, getHealth: getVaultHealth } = require('../vault/server');

function validateCommunicationRequest(body = {}) {
  if (!body.message || typeof body.message !== 'string') {
    return 'A string `message` field is required.';
  }

  if (body.settlement && typeof body.settlement !== 'object') {
    return 'The optional `settlement` field must be an object.';
  }

  return null;
}

function createHealthResponse(telemetry) {
  return {
    service: 'ingress',
    status: 'ok',
    downstream: {
      holodeck: getHolodeckHealth(),
      interceptor: getInterceptorHealth(),
      vault: getVaultHealth()
    },
    telemetry: telemetry.getSnapshot()
  };
}

function createApp({ config, telemetry }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  attachTelemetry(app, 'ingress');

  app.get('/health', (req, res) => {
    res.json(createHealthResponse(telemetry));
  });

  app.get('/dashboard', (req, res) => {
    res.type('html').send(readDashboardHtml());
  });

  app.post('/api/v1/communicate', async (req, res) => {
    const validationError = validateCommunicationRequest(req.body);
    if (validationError) {
      return res.status(400).json({ status: 'rejected', error: validationError });
    }

    const trackingId = `msg-${Date.now()}`;
    const interceptorResult = await handleCommunication({
      origin: req.body.origin || 'public-ingress',
      message: req.body.message,
      metadata: { ...(req.body.metadata || {}), trackingId }
    }, {
      queueLatencyMs: config.queueLatencyMs,
      pipeline: 'ingress-communication'
    });

    const settlement = req.body.settlement ? routeTransaction(req.body.settlement, config.settlementSecret) : null;
    const visualization = buildVisualizationModel(telemetry.getSnapshot());

    recordEvent('ingress', 'communication.completed', { trackingId, settlementRouted: Boolean(settlement) });

    return res.status(202).json({
      status: 'accepted',
      trackingId,
      acceptedAt: new Date().toISOString(),
      interceptor: interceptorResult,
      settlement,
      visualization
    });
  });

  return app;
}

module.exports = {
  createApp,
  createHealthResponse,
  validateCommunicationRequest
};
