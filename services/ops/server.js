const express = require('express');
const { attachTelemetry } = require('./telemetry');
const { createDeploymentMatrix } = require('./config');
const { getHealth: getInterceptorHealth } = require('../interceptor/server');
const { getHealth: getVaultHealth } = require('../vault/server');
const { getHealth: getHolodeckHealth } = require('../holodeck/server');

function getHealth(telemetrySnapshot, config) {
  return {
    service: 'ops',
    status: 'ok',
    runtime: {
      serviceTarget: config.serviceTarget,
      nodeEnv: config.nodeEnv,
      gcpProjectId: config.gcpProjectId,
      gcpRegion: config.gcpRegion
    },
    services: {
      holodeck: getHolodeckHealth(),
      interceptor: getInterceptorHealth(),
      vault: getVaultHealth()
    },
    telemetry: telemetrySnapshot
  };
}

function createApp({ config, telemetry }) {
  const app = express();
  attachTelemetry(app, 'ops');

  app.get('/health', (req, res) => {
    res.json(getHealth(telemetry.getSnapshot(), config));
  });

  app.get('/api/v1/metrics', (req, res) => {
    res.json(telemetry.getSnapshot());
  });

  app.get('/api/v1/config', (req, res) => {
    res.json({
      runtime: config,
      deploymentMatrix: createDeploymentMatrix(config)
    });
  });

  return app;
}

module.exports = {
  createApp,
  getHealth
};
