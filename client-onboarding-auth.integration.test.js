const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL;
if (!BASE_URL) {
  throw new Error('API_BASE_URL is required for integration tests');
}

describe('Client Onboarding & Auth Lifecycle Integration Tests', () => {
  let authToken = '';
  let clientId = '';
  let onboardResponse = null;
  const createdClients = [];

  const testClientPayload = {
    organizationName: 'Clean Code Corp',
    email: `test-${Date.now()}@example.com`,
    role: 'client_admin',
  };

  beforeAll(async () => {
    const res = await axios.post(`${BASE_URL}/v1/onboard`, testClientPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res || res.status !== 201) {
      throw new Error('beforeAll onboarding failed: expected HTTP 201 response');
    }
    if (!res.data || !res.data.clientId || !res.data.accessToken) {
      throw new Error('beforeAll onboarding failed: missing clientId/accessToken in response');
    }

    onboardResponse = res;
    clientId = res.data.clientId;
    authToken = res.data.accessToken;
    createdClients.push({
      id: res.data.clientId,
      token: res.data.accessToken,
    });
  });

  afterAll(async () => {
    await Promise.allSettled(
      createdClients.map(({ id, token }) =>
        axios.delete(`${BASE_URL}/v1/clients/${id}`, {
          headers: { Authorization: 'Bearer ' + token },
        }),
      ),
    );
  });

  test('Step 1: Onboard new client and verify clean payload response', async () => {
    expect(onboardResponse).toBeTruthy();
    expect(onboardResponse.status).toBe(201);
    expect(onboardResponse.data).toHaveProperty('clientId');
    expect(onboardResponse.data).toHaveProperty('accessToken');
    expect(onboardResponse.data).not.toHaveProperty('dbConnectionString');
  });

  test('Step 2: Validate token scope and authorized route access', async () => {
    const res = await axios.get(`${BASE_URL}/v1/clients/${clientId}/status`, {
      headers: { Authorization: 'Bearer ' + authToken },
    });

    expect(res.status).toBe(200);
    expect(res.data.status).toBe('active');
  });

  test('Step 3: Reject unauthorized or scope-escalated actions', async () => {
    await expect(
      axios.delete(`${BASE_URL}/v1/admin/tenants/${clientId}`, {
        headers: { Authorization: 'Bearer ' + authToken },
      }),
    ).rejects.toMatchObject({
      response: { status: 403 },
    });
  });

  test('Step 4: Verify input sanitization and clean content handling', async () => {
    const dirtyPayload = {
      organizationName: 'Clean <script>alert(1)</script> Corp ',
      email: `test-xss-${Date.now()}@example.com`,
      role: 'client_admin',
    };

    const res = await axios.post(`${BASE_URL}/v1/onboard`, dirtyPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('clientId');
    expect(res.data).toHaveProperty('accessToken');
    expect(res.data).toHaveProperty('organizationName');

    createdClients.push({
      id: res.data.clientId,
      token: res.data.accessToken,
    });

    expect(res.data.organizationName).not.toContain('<script>');
    expect(res.data.organizationName).not.toContain('</script>');
    expect(res.data.organizationName).toBe(res.data.organizationName.trim());
  });
});
