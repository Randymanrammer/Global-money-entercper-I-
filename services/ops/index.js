const express = require('express');
const os = require('os');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8084;
const METRICS = [];
const MAX_METRICS = 1000;

function snapshot() {
  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    loadAvg: os.loadavg(),
    freeMem: os.freemem(),
    totalMem: os.totalmem(),
  };
}

setInterval(() => {
  METRICS.push(snapshot());
  if (METRICS.length > MAX_METRICS) METRICS.shift();
}, 10000);

app.get('/health', (_req, res) => {
  res.json({ service: 'ops', status: 'ok', env: process.env.NODE_ENV || 'development' });
});

app.get('/config', (_req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: PORT,
    serviceName: process.env.SERVICE_NAME || 'ops',
    platform: os.platform(),
    arch: os.arch(),
  });
});

app.get('/metrics', (_req, res) => {
  res.json({ count: METRICS.length, latest: snapshot(), history: METRICS.slice(-100) });
});

app.post('/receive', (req, res) => {
  METRICS.push({ event: req.body, timestamp: new Date().toISOString() });
  res.json({ service: 'ops', action: 'logged', event: req.body });
});

app.listen(PORT, () => {
  console.log(`[ops] listening on port ${PORT}`);
});

module.exports = app;
