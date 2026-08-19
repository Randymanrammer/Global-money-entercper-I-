const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8082;
const QUEUE = [];

function enqueue(payload) {
  QUEUE.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, payload, status: 'pending', createdAt: new Date().toISOString() });
  return QUEUE[QUEUE.length - 1];
}

function processQueue() {
  const item = QUEUE.find((i) => i.status === 'pending');
  if (!item) return;
  item.status = 'processing';
  // Simulate high-velocity processing
  setTimeout(() => {
    item.status = 'completed';
    item.completedAt = new Date().toISOString();
    console.log(`[interceptor] processed job ${item.id}`);
  }, 250);
}

setInterval(processQueue, 500);

app.get('/health', (_req, res) => {
  res.json({ service: 'interceptor', status: 'ok', pending: QUEUE.filter((i) => i.status === 'pending').length });
});

app.post('/receive', (req, res) => {
  const item = enqueue(req.body);
  res.status(202).json({ service: 'interceptor', action: 'queued', item });
});

app.post('/webhook/:source', (req, res) => {
  const { source } = req.params;
  const item = enqueue({ source, ...req.body });
  res.status(202).json({ service: 'interceptor', action: 'webhook-received', item });
});

app.get('/queue', (_req, res) => {
  res.json({ queue: QUEUE });
});

app.listen(PORT, () => {
  console.log(`[interceptor] listening on port ${PORT}`);
});

module.exports = app;
