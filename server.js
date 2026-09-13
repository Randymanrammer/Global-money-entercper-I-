const http = require('http');
const { getRuntimeConfig, serviceTargets } = require('./services/ops/config');
const telemetry = require('./services/ops/telemetry');
const { createApp: createIngressApp } = require('./services/ingress/server');
const { createApp: createHolodeckApp } = require('./services/holodeck/server');
const { createApp: createInterceptorApp } = require('./services/interceptor/server');
const { createApp: createVaultApp } = require('./services/vault/server');
const { createApp: createOpsApp } = require('./services/ops/server');

const factories = {
  ingress: createIngressApp,
  holodeck: createHolodeckApp,
  interceptor: createInterceptorApp,
  vault: createVaultApp,
  ops: createOpsApp
};

function createServiceApp(serviceTarget = process.env.SERVICE_TARGET) {
  const config = getRuntimeConfig(serviceTarget);
  const factory = factories[config.serviceTarget];

  if (!factory) {
    throw new Error(`Unsupported SERVICE_TARGET: ${config.serviceTarget}. Expected one of ${serviceTargets.join(', ')}`);
  }

  return factory({ config, telemetry });
}

function startServer() {
  const app = createServiceApp();
  const config = getRuntimeConfig();
  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`[${config.serviceTarget}] listening on port ${config.port}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServiceApp,
  startServer
};
