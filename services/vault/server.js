const crypto = require('crypto');
const express = require('express');
const { attachTelemetry, recordEvent } = require('../ops/telemetry');

const settlementLedger = [];

function stableSort(value) {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = stableSort(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function createSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(stableSort(payload))).digest('hex');
}

function verifyPayload(payload, signature, secret) {
  if (!signature) {
    return { verified: false, reason: 'missing-signature' };
  }

  const expectedSignature = createSignature(payload, secret);
  const sameLength = typeof signature === 'string' && signature.length === expectedSignature.length;
  const verified = sameLength && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  return {
    verified,
    expectedSignature,
    signature,
    reason: verified ? 'verified' : 'signature-mismatch'
  };
}

function routeTransaction(settlement = {}, secret = process.env.SETTLEMENT_SHARED_SECRET || 'local-dev-secret') {
  const amount = Number(settlement.amount || 0);
  const route = amount >= 10000 ? 'manual-review' : settlement.currency === 'USD' ? 'domestic-usd' : 'global-wire';
  const verificationPayload = settlement.payload || Object.fromEntries(Object.entries(settlement).filter(([key]) => key !== 'signature'));
  const verification = verifyPayload(verificationPayload, settlement.signature, secret);
  const record = {
    transactionId: settlement.transactionId || `txn-${Date.now()}`,
    route,
    amount,
    currency: settlement.currency || 'USD',
    beneficiary: settlement.beneficiary || 'unspecified-beneficiary',
    verification,
    acceptedAt: new Date().toISOString()
  };

  settlementLedger.unshift(record);
  settlementLedger.splice(20);
  recordEvent('vault', 'settlement.routed', { route: record.route, verified: verification.verified });
  return record;
}

function getHealth() {
  return {
    service: 'vault',
    status: 'ok',
    recentSettlements: settlementLedger.slice(0, 5),
    ledgerDepth: settlementLedger.length
  };
}

function createApp({ config }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  attachTelemetry(app, 'vault');

  app.get('/health', (req, res) => {
    res.json(getHealth());
  });

  app.post('/api/v1/settlements/verify', (req, res) => {
    const { payload = {}, signature } = req.body || {};
    res.json(verifyPayload(payload, signature, config.settlementSecret));
  });

  app.post('/api/v1/settlements/route', (req, res) => {
    const record = routeTransaction(req.body || {}, config.settlementSecret);
    res.status(202).json({ status: 'accepted', record });
  });

  return app;
}

module.exports = {
  createApp,
  createSignature,
  getHealth,
  routeTransaction,
  verifyPayload
};
