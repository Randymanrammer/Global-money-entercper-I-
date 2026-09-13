const telemetry = {
  startedAt: new Date().toISOString(),
  requests: {},
  events: []
};

function recordRequest(serviceName, route, method, statusCode, durationMs) {
  telemetry.requests[serviceName] = telemetry.requests[serviceName] || {
    total: 0,
    byStatus: {},
    recentRoutes: []
  };

  const bucket = telemetry.requests[serviceName];
  bucket.total += 1;
  bucket.byStatus[statusCode] = (bucket.byStatus[statusCode] || 0) + 1;
  bucket.recentRoutes.unshift({ route, method, statusCode, durationMs, timestamp: new Date().toISOString() });
  bucket.recentRoutes = bucket.recentRoutes.slice(0, 10);
}

function recordEvent(serviceName, eventType, payload) {
  telemetry.events.unshift({
    serviceName,
    eventType,
    payload,
    timestamp: new Date().toISOString()
  });
  telemetry.events = telemetry.events.slice(0, 25);
}

function getSnapshot() {
  return {
    startedAt: telemetry.startedAt,
    uptimeSeconds: Math.round((Date.now() - Date.parse(telemetry.startedAt)) / 1000),
    requests: telemetry.requests,
    recentEvents: telemetry.events
  };
}

function attachTelemetry(app, serviceName) {
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      recordRequest(serviceName, req.path, req.method, res.statusCode, Date.now() - started);
    });
    next();
  });
}

module.exports = {
  attachTelemetry,
  getSnapshot,
  recordEvent,
  telemetry
};
