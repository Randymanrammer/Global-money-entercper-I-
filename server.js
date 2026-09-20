const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;
const BASE_DOMAIN = (process.env.BASE_DOMAIN || '').toLowerCase().replace(/^\./, '');

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Global Money Interceptor Core',
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res, next) => {
  const host = req.headers.host || '';
  const hostname = host.split(':')[0].toLowerCase();
  const parts = hostname.split('.').filter(Boolean);

  req.subdomain = null;

  if (BASE_DOMAIN && hostname.endsWith(`.${BASE_DOMAIN}`)) {
    const suffixLength = BASE_DOMAIN.length + 1;
    const candidate = hostname.slice(0, -suffixLength);
    const labels = candidate.split('.').filter(Boolean);
    req.subdomain = labels.length ? labels[labels.length - 1] : null;
    return next();
  }

  if (BASE_DOMAIN && hostname === BASE_DOMAIN) {
    return next();
  }

  if (!BASE_DOMAIN && parts.length > 2 && hostname !== 'localhost') {
    req.subdomain = parts[0];
  }

  next();
});

app.use((req, res, next) => {
  if (req.subdomain === 'api' && req.path === '/status') {
    return res.status(200).json({ api: 'online', mode: 'interceptor' });
  }

  return next();
});

app.get('/', (req, res) => {
  if (req.subdomain && req.subdomain !== 'www') {
    return res.status(200).json({
      message: `Connected to deployment variant subdomain: ${req.subdomain}`,
      status: 'active',
    });
  }

  return res
    .status(200)
    .send('Instant Online Success Inc. - Master Platform Operational');
});

app.listen(PORT, () => {
  console.log(`Interceptor service active on port ${PORT}`);
});
