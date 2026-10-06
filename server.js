const express = require('express');
const http = require('node:http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const DEFAULT_PORT = Number.parseInt(process.env.PORT || '8080', 10);
const SERVICE_NAME = 'Global Money Interceptor Core';
const SOCKET_HEARTBEAT_TIMEOUT_MS = 90_000;
const SOCKET_HEARTBEAT_CHECK_INTERVAL_MS = 30_000;
const SOCKET_RATE_LIMIT_WINDOW_MS = 10_000;
const SOCKET_RATE_LIMIT_MAX_MESSAGES = 20;

const HUB_PURPOSE = 'operations-center';
const HUB_TOP_ACTIONS = [
  'Monitor live customer and office traffic',
  'Respond to alerts and incidents in real time',
  'Coordinate deployment variant readiness',
];

const ROLE_CHANNELS = {
  admin: ['office', 'alerts', 'customer'],
  staff: ['office', 'customer'],
  client: ['customer'],
};

const IMPROVEMENT_CATEGORIES = ['ux', 'reliability', 'growth', 'security', 'analytics', 'automation'];

const IMPROVEMENT_TITLES = {
  ux: [
    'Unified hub navigation', 'Quick action launcher', 'Saved dashboard layouts', 'Personalized widget ordering',
    'Office-mode high contrast', 'Keyboard-first workflow', 'Smart empty-state guidance', 'Guided onboarding checklist',
    'Real-time notification center', 'Multi-language hub labels', 'Bulk customer action tools', 'Single-click incident view',
    'Timeline rewind view', 'Session handoff panel', 'Contextual help popovers', 'Compact mobile workspace',
    'Accessibility audit pass', 'Adaptive font sizing'
  ],
  reliability: [
    'Socket reconnect telemetry', 'Automatic degraded-mode banner', 'Retry queue for failed sends', 'Region-aware health checks',
    'Error budget tracking', 'Connection churn dashboard', 'Graceful restart drain mode', 'Circuit breaker on event floods',
    'Read replica failover drills', 'Dependency timeout guards', 'Dead letter event stream', 'Heartbeat anomaly detection',
    'Canary release guardrails', 'Chaos test schedule', 'SLO report publishing', 'Incident template automation',
    'Queue depth autoscaling', 'Cold-start watchdog'
  ],
  growth: [
    'Customer activity scoring', 'Lead qualification alerts', 'Referral campaign tracking', 'Trial conversion nudges',
    'Revenue heatmap tiles', 'Segment-based broadcasts', 'Retention milestone reminders', 'Upsell opportunity feed',
    'Campaign attribution tags', 'Partner performance cards', 'Self-serve invite links', 'Landing conversion tracker',
    'Churn risk prediction hooks', 'Outbound sequence triggers', 'AB messaging framework', 'KPI goal progress cards',
    'Lifecycle journey mapping'
  ],
  security: [
    'Token rotation scheduler', 'IP reputation blocking', 'Role escalation alerts', 'Audit log tamper checks',
    'Socket payload schema enforcement', 'Rate limit adaptive controls', 'Sensitive field redaction', 'Session hijack heuristics',
    'MFA prompt integration', 'Least-privilege room policy', 'Secret leak pattern scans', 'Geo-anomaly login alerts',
    'Signed event envelopes', 'Trust boundary documentation', 'Quarterly access recertification', 'Secure defaults verifier',
    'Privilege drift reports'
  ],
  analytics: [
    'Live latency percentile chart', 'Message throughput dashboard', 'Route-level response histograms', 'User session funnel',
    'Real-time error taxonomy', 'Forecasted load projections', 'Retention cohort comparison', 'Team productivity indicators',
    'Alert precision/recall tracking', 'Customer intent classification', 'Hub adoption analytics', 'Feature usage heatmap',
    'Operational cost analytics', 'SLA breach early warning', 'Anomaly root cause assistant', 'Data freshness monitor',
    'Executive summary digest'
  ],
  automation: [
    'Runbook one-click actions', 'Auto-remediation playbooks', 'Scheduled smoke probes', 'Continuous config drift detection',
    'CI deployment verification bots', 'Incident severity auto-tagging', 'Automatic stakeholder notifications', 'Synthetic user journeys',
    'Failover dry-run orchestrator', 'Backup restore rehearsal jobs', 'Workflow dependency visualizer', 'Policy as code checks',
    'Bot-assisted triage queue', 'Escalation matrix automation', 'Postmortem draft generator', 'Compliance evidence collector',
    'Nightly reliability scorecards'
  ],
};

function createImprovementBacklog() {
  const items = [];
  let id = 1;

  IMPROVEMENT_CATEGORIES.forEach((category) => {
    const titles = IMPROVEMENT_TITLES[category];
    titles.forEach((title) => {
      const wave = id <= 10 ? 'critical' : id <= 40 ? 'high-value' : 'optimization';
      items.push({ id, category, wave, title });
      id += 1;
    });
  });

  const fillerByCategory = {
    ux: 'UX enhancement',
    reliability: 'Reliability hardening',
    growth: 'Growth acceleration',
    security: 'Security reinforcement',
    analytics: 'Analytics insight',
    automation: 'Automation uplift',
  };

  while (items.length < 100) {
    const category = IMPROVEMENT_CATEGORIES[items.length % IMPROVEMENT_CATEGORIES.length];
    const wave = items.length + 1 <= 10 ? 'critical' : items.length + 1 <= 40 ? 'high-value' : 'optimization';
    items.push({
      id: items.length + 1,
      category,
      wave,
      title: `${fillerByCategory[category]} #${Math.ceil((items.length + 1) / IMPROVEMENT_CATEGORIES.length)}`,
    });
  }

  return items.slice(0, 100);
}

function createHubState() {
  return {
    startedAt: new Date().toISOString(),
    socketEnabled: false,
    socketConnected: 0,
    socketRejected: 0,
    socketMessagesPublished: 0,
    socketErrors: 0,
    lastSocketError: null,
    requestCount: 0,
    requestLatencyMs: { average: 0, latest: 0 },
    events: [],
    nextEventId: 1,
    improvements: createImprovementBacklog(),
  };
}

function pushHubEvent(state, event) {
  const entry = {
    id: state.nextEventId,
    createdAt: new Date().toISOString(),
    ...event,
  };
  state.nextEventId += 1;
  state.events.push(entry);
  if (state.events.length > 500) {
    state.events.shift();
  }
  return entry;
}

function allowedChannelsForRole(role) {
  return ROLE_CHANNELS[role] || [];
}

function authenticateSocketToken(token, expectedToken) {
  return Boolean(token && expectedToken && token === expectedToken);
}

function isAllowedRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLE_CHANNELS, role);
}

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

function createApp({ baseDomain = process.env.BASE_DOMAIN, hubToken = process.env.HUB_TOKEN } = {}) {
  const app = express();
  const normalizedBaseDomain = normalizeBaseDomain(baseDomain);
  const hubState = createHubState();
  const effectiveHubToken = `${hubToken || 'office-hub-demo-token'}`;
  const authenticatedRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many authenticated requests' },
  });
  app.locals.hubState = hubState;
  app.locals.hubToken = effectiveHubToken;

  app.use(express.json({ limit: '50kb' }));

  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      hubState.requestCount += 1;
      const latency = Date.now() - started;
      hubState.requestLatencyMs.latest = latency;
      if (hubState.requestCount === 1) {
        hubState.requestLatencyMs.average = latency;
      } else {
        const previous = hubState.requestLatencyMs.average;
        hubState.requestLatencyMs.average = Math.round(
          ((previous * (hubState.requestCount - 1)) + latency) / hubState.requestCount,
        );
      }
    });

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
      sockets: {
        enabled: hubState.socketEnabled,
        connected: hubState.socketConnected,
        rejected: hubState.socketRejected,
      },
    });
  });

  app.get('/hub', (req, res) => {
    res.status(200).json({
      purpose: HUB_PURPOSE,
      topActions: HUB_TOP_ACTIONS,
      realtime: {
        channels: ['office', 'alerts', 'customer'],
        authRequired: true,
      },
    });
  });

  app.get('/hub/improvements', (req, res) => {
    res.status(200).json({
      total: hubState.improvements.length,
      waves: { critical: 10, 'high-value': 30, optimization: 60 },
      items: hubState.improvements,
    });
  });

  app.get('/status/system', authenticatedRateLimiter, (req, res) => {
    const token = req.headers['x-hub-token'];
    if (!authenticateSocketToken(token, effectiveHubToken)) {
      return res.status(401).json({ error: 'Unauthorized status access' });
    }

    return res.status(200).json({
      service: SERVICE_NAME,
      uptimeSeconds: Math.floor((Date.now() - Date.parse(hubState.startedAt)) / 1000),
      socket: {
        enabled: hubState.socketEnabled,
        connected: hubState.socketConnected,
        rejected: hubState.socketRejected,
        published: hubState.socketMessagesPublished,
        errors: hubState.socketErrors,
        lastError: hubState.lastSocketError,
      },
      http: {
        requests: hubState.requestCount,
        latencyMs: hubState.requestLatencyMs,
      },
    });
  });

  app.get('/events/poll', authenticatedRateLimiter, (req, res) => {
    const token = req.headers['x-hub-token'];
    const role = `${req.query.role || 'client'}`;
    const channel = `${req.query.channel || 'customer'}`;
    const since = Number.parseInt(`${req.query.since || 0}`, 10);

    if (!authenticateSocketToken(token, effectiveHubToken)) {
      return res.status(401).json({ error: 'Unauthorized event polling' });
    }

    if (!isAllowedRole(role)) {
      return res.status(403).json({ error: 'Invalid role' });
    }

    if (!allowedChannelsForRole(role).includes(channel)) {
      return res.status(403).json({ error: 'Role cannot access channel' });
    }

    return res.status(200).json({
      mode: 'polling-fallback',
      channel,
      events: hubState.events.filter((event) => event.id > since && event.channel === channel),
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

function attachRealtimeHub(server, app, { hubToken = app.locals.hubToken } = {}) {
  const hubState = app.locals.hubState || createHubState();
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25_000,
    pingTimeout: 60_000,
  });
  const socketMeta = new Map();
  hubState.socketEnabled = true;

  function recordSocketError(reason, details = null) {
    hubState.socketErrors += 1;
    hubState.lastSocketError = { reason, details, at: new Date().toISOString() };
  }

  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    const token = auth.token || socket.handshake.headers['x-hub-token'];
    const role = `${auth.role || socket.handshake.query.role || 'client'}`;

    if (!authenticateSocketToken(token, hubToken)) {
      hubState.socketRejected += 1;
      return next(new Error('unauthorized'));
    }

    if (!isAllowedRole(role)) {
      hubState.socketRejected += 1;
      return next(new Error('invalid-role'));
    }

    socket.data.role = role;
    socket.data.allowedChannels = allowedChannelsForRole(role);
    return next();
  });

  io.on('connection', (socket) => {
    hubState.socketConnected += 1;
    socketMeta.set(socket.id, {
      messageTimestamps: [],
      lastHeartbeatAt: Date.now(),
    });

    const heartbeatTimer = setInterval(() => {
      const meta = socketMeta.get(socket.id);
      if (!meta) {
        return;
      }
      if (Date.now() - meta.lastHeartbeatAt > SOCKET_HEARTBEAT_TIMEOUT_MS) {
        recordSocketError('heartbeat-timeout', socket.id);
        socket.disconnect(true);
      }
    }, SOCKET_HEARTBEAT_CHECK_INTERVAL_MS);

    socket.on('heartbeat', () => {
      const meta = socketMeta.get(socket.id);
      if (meta) {
        meta.lastHeartbeatAt = Date.now();
      }
    });

    socket.on('subscribe', ({ channel } = {}) => {
      if (!channel || !socket.data.allowedChannels.includes(channel)) {
        return socket.emit('channel_error', { error: 'Channel not allowed' });
      }
      socket.join(channel);
      return socket.emit('subscribed', { channel });
    });

    socket.on('publish', ({ channel, type, payload } = {}) => {
      const meta = socketMeta.get(socket.id);
      if (!meta) {
        return;
      }

      meta.messageTimestamps = meta.messageTimestamps.filter(
        (timestamp) => Date.now() - timestamp < SOCKET_RATE_LIMIT_WINDOW_MS,
      );
      if (meta.messageTimestamps.length >= SOCKET_RATE_LIMIT_MAX_MESSAGES) {
        recordSocketError('rate-limit', socket.id);
        return socket.emit('rate_limited', { error: 'Too many messages' });
      }
      meta.messageTimestamps.push(Date.now());

      if (!channel || !socket.data.allowedChannels.includes(channel)) {
        return socket.emit('publish_error', { error: 'Channel not allowed' });
      }
      if (typeof type !== 'string' || !type.trim()) {
        return socket.emit('publish_error', { error: 'Event type is required' });
      }
      if (payload !== null && payload !== undefined && typeof payload !== 'object') {
        return socket.emit('publish_error', { error: 'Payload must be an object' });
      }
      if (payload && JSON.stringify(payload).length > 8_000) {
        return socket.emit('publish_error', { error: 'Payload too large' });
      }

      const event = pushHubEvent(hubState, {
        channel,
        type: type.trim(),
        payload: payload || {},
        sourceRole: socket.data.role,
      });
      hubState.socketMessagesPublished += 1;
      io.to(channel).emit('event', event);
    });

    socket.on('disconnect', () => {
      clearInterval(heartbeatTimer);
      socketMeta.delete(socket.id);
      hubState.socketConnected = Math.max(hubState.socketConnected - 1, 0);
    });
  });

  return io;
}

function startServer({ port = DEFAULT_PORT, baseDomain = process.env.BASE_DOMAIN } = {}) {
  const app = createApp({ baseDomain });
  const server = http.createServer(app);
  attachRealtimeHub(server, app);
  server.listen(port, () => {
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
  attachRealtimeHub,
  createHubState,
  createImprovementBacklog,
  normalizeBaseDomain,
  parseHostname,
  startServer,
};
