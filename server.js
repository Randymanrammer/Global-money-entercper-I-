const express = require('express');

const DEFAULT_PORT = Number.parseInt(process.env.PORT || '8080', 10);
const SERVICE_NAME = 'Global Money Interceptor Core';

function normalizeBaseDomain(baseDomain = '') {
  return baseDomain.toLowerCase().replace(/^\./, '').trim();
}

function parseHostname(host = '') {
  const trimmedHost = `${host}`.trim().toLowerCase();

  if (!trimmedHost) {
    return '';
  }

  if (trimmedHost.startsWith('[')) {
    const closingIndex = trimmedHost.indexOf(']');
    return closingIndex === -1 ? trimmedHost : trimmedHost.slice(1, closingIndex);
  }

  return trimmedHost.split(':')[0];
}

function isLocalHostname(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname.endsWith('.localhost');
}

function analyzeHost(host, baseDomain) {
  const hostname = parseHostname(host);
  const normalizedBaseDomain = normalizeBaseDomain(baseDomain);
  const result = {
    hostname,
    baseDomain: normalizedBaseDomain || null,
    isAllowed: true,
    isLocal: isLocalHostname(hostname),
    isApex: false,
    subdomain: null,
    fullSubdomain: null,
    rejectionReason: null,
  };

  if (!hostname) {
    result.isApex = true;
    return result;
  }

  if (result.isLocal) {
    if (hostname.endsWith('.localhost')) {
      const labels = hostname.split('.').slice(0, -1).filter(Boolean);
      result.fullSubdomain = labels.length ? labels.join('.') : null;
      result.subdomain = labels.length ? labels[0] : null;
    }

    if (!result.subdomain) {
      result.isApex = true;
    }

    return result;
  }

  if (!normalizedBaseDomain) {
    const parts = hostname.split('.').filter(Boolean);

    if (parts.length <= 2) {
      result.isApex = true;
      return result;
    }

    result.fullSubdomain = parts.slice(0, -2).join('.');
    result.subdomain = parts[0];
    return result;
  }

  if (hostname === normalizedBaseDomain) {
    result.isApex = true;
    return result;
  }

  if (!hostname.endsWith(`.${normalizedBaseDomain}`)) {
    result.isAllowed = false;
    result.rejectionReason = 'external-host';
    return result;
  }

  const candidate = hostname.slice(0, -(normalizedBaseDomain.length + 1));
  const labels = candidate.split('.').filter(Boolean);

  if (labels.length === 0) {
    result.isApex = true;
    return result;
  }

  if (labels.length > 1) {
    result.isAllowed = false;
    result.rejectionReason = 'nested-subdomain';
    result.fullSubdomain = labels.join('.');
    result.subdomain = labels[0];
    return result;
  }

  result.fullSubdomain = labels[0];
  result.subdomain = labels[0];

  return result;
}

function createApp({ baseDomain = process.env.BASE_DOMAIN } = {}) {
  const app = express();
  const normalizedBaseDomain = normalizeBaseDomain(baseDomain);

  app.use((req, res, next) => {
    const routing = analyzeHost(req.headers.host || '', normalizedBaseDomain);
    req.routing = routing;
    req.subdomain = routing.subdomain;
    next();
  });

  app.use((req, res, next) => {
    if (req.routing.isAllowed) {
      return next();
    }

    return res.status(421).json({
      error: 'Host is not mapped to this service',
      reason: req.routing.rejectionReason,
      hostname: req.routing.hostname,
      baseDomain: req.routing.baseDomain,
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
      baseDomain: normalizedBaseDomain || null,
      routingMode: normalizedBaseDomain ? 'managed-domain' : 'fallback',
    });
  });

  app.use((req, res, next) => {
    if (req.subdomain === 'api' && req.path === '/status') {
      return res.status(200).json({ api: 'online', mode: 'interceptor' });
    }

    return next();
  });

  app.get('/', (req, res) => {
    if (req.subdomain && !['www', 'api'].includes(req.subdomain)) {
      return res.status(200).json({
        message: `Connected to deployment variant subdomain: ${req.subdomain}`,
        status: 'active',
      });
    }

    return res
      .status(200)
      .send('Instant Online Success Inc. - Master Platform Operational');
  });

  return app;
}

function startServer({ port = DEFAULT_PORT, baseDomain = process.env.BASE_DOMAIN } = {}) {
  const app = createApp({ baseDomain });
  const server = app.listen(port, () => {
    console.log(`Interceptor service active on port ${port}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  analyzeHost,
  createApp,
  normalizeBaseDomain,
  parseHostname,
  startServer,
};
