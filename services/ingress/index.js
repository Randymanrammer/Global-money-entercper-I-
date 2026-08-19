const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const SERVICE_TARGETS = {
  holodeck: process.env.HOLODECK_URL || 'http://localhost:8081',
  interceptor: process.env.INTERCEPTOR_URL || 'http://localhost:8082',
  vault: process.env.VAULT_URL || 'http://localhost:8083',
  ops: process.env.OPS_URL || 'http://localhost:8084',
};

app.get('/health', (_req, res) => {
  res.json({ service: 'ingress', status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/communicate', async (_req, res) => {
  try {
    const results = await Promise.all(
      Object.entries(SERVICE_TARGETS).map(async ([name, url]) => {
        try {
          const { data } = await axios.get(`${url}/health`, { timeout: 3000 });
          return { service: name, status: 'reachable', payload: data };
        } catch (err) {
          return { service: name, status: 'unreachable', error: err.message };
        }
      })
    );
    res.json({ service: 'ingress', message: 'inter-service communication scan', results });
  } catch (err) {
    res.status(500).json({ service: 'ingress', error: err.message });
  }
});

app.post('/api/v1/communicate/:service', async (req, res) => {
  const { service } = req.params;
  const target = SERVICE_TARGETS[service];
  if (!target) {
    return res.status(404).json({ error: `Unknown service: ${service}` });
  }
  try {
    const { data } = await axios.post(`${target}/receive`, req.body, { timeout: 5000 });
    res.json({ service, status: 'forwarded', upstream: data });
  } catch (err) {
    res.status(502).json({ service, status: 'error', error: err.message });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`[ingress] listening on port ${PORT}`);
});

module.exports = app;
