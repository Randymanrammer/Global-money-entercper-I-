const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8081;

app.get('/health', (_req, res) => {
  res.json({ service: 'holodeck', status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/stage', (_req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'stage.html'));
});

app.post('/receive', (req, res) => {
  res.json({ service: 'holodeck', action: 'staged', received: req.body });
});

app.listen(PORT, () => {
  console.log(`[holodeck] listening on port ${PORT}`);
});

module.exports = app;
