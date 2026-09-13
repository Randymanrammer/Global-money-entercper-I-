const fs = require('fs');
const path = require('path');
const express = require('express');
const { attachTelemetry } = require('../ops/telemetry');
const { getHealth: getInterceptorHealth } = require('../interceptor/server');
const { getHealth: getVaultHealth } = require('../vault/server');

const dashboardPath = path.resolve(__dirname, '..', '..', 'dashboard.html');

function readDashboardHtml() {
  return fs.readFileSync(dashboardPath, 'utf8');
}

function buildVisualizationModel(telemetrySnapshot) {
  return {
    generatedAt: new Date().toISOString(),
    cards: [
      {
        service: 'ingress',
        focus: 'Public HTTPS routing and request normalization'
      },
      {
        service: 'interceptor',
        focus: `Queue depth ${getInterceptorHealth().queueDepth}, processed ${getInterceptorHealth().processed}`
      },
      {
        service: 'vault',
        focus: `Ledger depth ${getVaultHealth().ledgerDepth}`
      },
      {
        service: 'ops',
        focus: `Recent event count ${telemetrySnapshot.recentEvents.length}`
      }
    ],
    telemetry: telemetrySnapshot
  };
}

function getHealth() {
  return {
    service: 'holodeck',
    status: 'ok',
    dashboard: '/dashboard',
    templateLoaded: fs.existsSync(dashboardPath)
  };
}

function createApp({ telemetry }) {
  const app = express();
  attachTelemetry(app, 'holodeck');

  app.get('/health', (req, res) => {
    res.json(getHealth());
  });

  app.get(['/', '/dashboard'], (req, res) => {
    res.type('html').send(readDashboardHtml());
  });

  app.get('/api/v1/visualize', (req, res) => {
    res.json(buildVisualizationModel(telemetry.getSnapshot()));
  });

  return app;
}

module.exports = {
  buildVisualizationModel,
  createApp,
  getHealth,
  readDashboardHtml
};
