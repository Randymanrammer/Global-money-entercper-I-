const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8083;
const VAULT_SECRET = process.env.VAULT_SECRET || 'dev-secret';

function verifyPayload(payload, signature) {
  const hmac = crypto.createHmac('sha256', VAULT_SECRET);
  hmac.update(JSON.stringify(payload));
  const expected = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
}

const TRANSACTIONS = [];

app.get('/health', (_req, res) => {
  res.json({ service: 'vault', status: 'ok', transactions: TRANSACTIONS.length });
});

app.post('/receive', (req, res) => {
  const { payload, signature, routing } = req.body || {};
  const verified = verifyPayload(payload, signature);
  if (!verified) {
    return res.status(401).json({ service: 'vault', status: 'rejected', reason: 'invalid signature' });
  }
  const tx = { id: crypto.randomUUID(), routing, payload, verified, createdAt: new Date().toISOString() };
  TRANSACTIONS.push(tx);
  res.json({ service: 'vault', action: 'settled', transaction: tx });
});

app.get('/transactions', (_req, res) => {
  res.json({ transactions: TRANSACTIONS });
});

app.listen(PORT, () => {
  console.log(`[vault] listening on port ${PORT}`);
});

module.exports = app;
