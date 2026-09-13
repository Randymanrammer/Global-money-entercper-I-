const { randomUUID } = require('crypto');
const axios = require('axios');
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

async function dispatchCommunication(payload, config) {
  if (!config.interceptorBaseUrl) {
    return handleCommunication(payload, {
      queueLatencyMs: config.queueLatencyMs,
      pipeline: 'ingress-communication'
    });
  }

  const response = await axios.post(
    `${config.interceptorBaseUrl.replace(/\/$/, '')}/api/v1/queue`,
    payload,
    {
      timeout: 5000,
      headers: {
        'content-type': 'application/json'
      }
    }
  );

  return {
    transport: 'http',
    ...response.data.result
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

    try {
      const trackingId = randomUUID();
      const interceptorResult = await dispatchCommunication({
        origin: req.body.origin || 'public-ingress',
        message: req.body.message,
        metadata: { ...(req.body.metadata || {}), trackingId }
      }, config);

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
    } catch (error) {
      recordEvent('ingress', 'communication.failed', { message: error.message });
      return res.status(502).json({
        status: 'failed',
        error: 'Unable to dispatch communication request.',
        details: error.message
      });
    }
  });

  return app;
}

module.exports = {
  createApp,
  createHealthResponse,
  dispatchCommunication,
  validateCommunicationRequest
};
