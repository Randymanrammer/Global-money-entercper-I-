const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Global Money Interceptor Core',
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res, next) => {
  const host = req.headers.host || '';
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  if (parts.length > 2) {
    req.subdomain = parts.slice(0, -2).join('.').toLowerCase();
  } else {
    req.subdomain = null;
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
