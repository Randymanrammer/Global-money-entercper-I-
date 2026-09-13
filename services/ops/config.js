const serviceTargets = ['ingress', 'holodeck', 'interceptor', 'vault', 'ops'];

function getRuntimeConfig(serviceTarget = process.env.SERVICE_TARGET || 'ingress') {
  if (!serviceTargets.includes(serviceTarget)) {
    throw new Error(`Unknown service target: ${serviceTarget}`);
  }

  return {
    serviceTarget,
    port: Number(process.env.PORT || 8080),
    nodeEnv: process.env.NODE_ENV || 'development',
    gcpProjectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'local-project',
    gcpRegion: process.env.GCP_REGION || 'us-central1',
    settlementSecret: process.env.SETTLEMENT_SHARED_SECRET || 'local-dev-secret',
    settlementSecretName: process.env.GCP_SETTLEMENT_SECRET_NAME || 'settlement-shared-secret',
    queueLatencyMs: Number(process.env.INTERCEPTOR_QUEUE_LATENCY_MS || 25),
    interceptorBaseUrl: process.env.INTERCEPTOR_BASE_URL || ''
  };
}

function createDeploymentMatrix(config = getRuntimeConfig()) {
  return serviceTargets.map((serviceName) => ({
    serviceName,
    cloudRunName: `${config.gcpProjectId}-${serviceName}`,
    region: config.gcpRegion,
    serviceTarget: serviceName
  }));
}

module.exports = {
  createDeploymentMatrix,
  getRuntimeConfig,
  serviceTargets
};
