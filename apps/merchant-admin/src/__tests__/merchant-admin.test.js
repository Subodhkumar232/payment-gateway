import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Database } from '@youpi/db';
import { getAdminToken } from '@youpi/common';
import { startAdminServer } from '../index.js';

describe('Merchant Admin Integration Tests', () => {
  let serverInstance;
  let baseUrl;
  let testDb;

  before(async () => {
    testDb = new Database({ inMemory: true });
    serverInstance = await startAdminServer(6101, { db: testDb });
    baseUrl = `http://localhost:${serverInstance.port}`;
  });

  after(async () => {
    await serverInstance.close();
    testDb.close();
  });

  function get(path, headers = {}) {
    return new Promise((resolve, reject) => {
      http.get(`${baseUrl}${path}`, { headers }, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        });
      }).on('error', reject);
    });
  }

  function post(path, body = {}, headers = {}) {
    return new Promise((resolve, reject) => {
      const dataStr = JSON.stringify(body);
      const req = http.request(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataStr),
          ...headers
        }
      }, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        });
      });
      req.on('error', reject);
      req.write(dataStr);
      req.end();
    });
  }

  test('GET /health returns UP', async () => {
    const res = await get('/health');
    assert.equal(res.status, 200);
    const json = JSON.parse(res.text);
    assert.equal(json.status, 'UP');
    assert.equal(json.service, 'merchant-admin');
  });

  test('GET / unauthenticated redirects to /login via auth middleware', async () => {
    const res = await get('/');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/login');
  });

  test('GET /login serves dedicated singular login page (no modal)', async () => {
    const res = await get('/login');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.text.includes('Merchant Admin Sign In'));
    assert.ok(res.text.includes('id="loginUsername"'));
    assert.ok(res.text.includes('id="loginPassword"'));
    assert.ok(res.text.includes('id="loginSubmitBtn"'));
    assert.ok(res.text.includes('PBKDF2 SHA-512'));
    // Ensure token is never leaked on login page
    assert.equal(res.text.includes(getAdminToken()), false);
  });

  test('GET /login redirects already authenticated user to /', async () => {
    const res = await get('/login', { Authorization: `Bearer ${getAdminToken()}` });
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/');
  });

  test('GET / renders dashboard when authenticated with Bearer or Cookie without leaking token', async () => {
    // 1. With Authorization header
    const resBearer = await get('/', { Authorization: `Bearer ${getAdminToken()}` });
    assert.equal(resBearer.status, 200);
    assert.ok(resBearer.headers['content-type'].includes('text/html'));
    assert.ok(resBearer.text.includes('Real-Time Receiving Account Slot Ownership'));
    assert.ok(resBearer.text.includes('Active Slot (5-Minute Window)'));
    assert.ok(resBearer.text.includes('Live Counter Payment Requests'));
    assert.equal(resBearer.text.includes(getAdminToken()), false);

    // 2. With Cookie
    const resCookie = await get('/', { Cookie: `youpi_admin_token=${getAdminToken()}` });
    assert.equal(resCookie.status, 200);
    assert.ok(resCookie.text.includes('Real-Time Receiving Account Slot Ownership'));
  });

  test('GET /logout revokes session, clears cookie, and redirects to /login', async () => {
    const res = await get('/logout', { Cookie: `youpi_admin_token=${getAdminToken()}` });
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/login');
    assert.ok(res.headers['set-cookie']);
    assert.ok(res.headers['set-cookie'][0].includes('youpi_admin_token=;'));
  });

  test('GET /api/admin/tickets requires the admin token', async () => {
    const anonymous = await get('/api/admin/tickets');
    assert.equal(anonymous.status, 401);

    const res = await get('/api/admin/tickets', { Authorization: `Bearer ${getAdminToken()}` });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.text);
    assert.ok(Array.isArray(json));
  });

  test('GET /api/admin/auth/verify enforces admin token authentication', async () => {
    const anonymous = await get('/api/admin/auth/verify');
    assert.equal(anonymous.status, 401);
    assert.equal(JSON.parse(anonymous.text).code, 'AUTH_REQUIRED');

    const wrong = await get('/api/admin/auth/verify', { Authorization: 'Bearer invalid_token' });
    assert.equal(wrong.status, 401);

    const valid = await get('/api/admin/auth/verify', { Authorization: `Bearer ${getAdminToken()}` });
    assert.equal(valid.status, 200);
    const json = JSON.parse(valid.text);
    assert.equal(json.success, true);
    assert.equal(json.authenticated, true);
  });

  test('GET /api/services/status rejects anonymous requests without admin token', async () => {
    const anonymous = await get('/api/services/status');
    assert.equal(anonymous.status, 401);
    assert.equal(JSON.parse(anonymous.text).code, 'AUTH_REQUIRED');
  });

  test('POST /api/admin/auth/login validates credentials & sets session cookie', async () => {
    // 1. Wrong username
    const badUser = await post('/api/admin/auth/login', { username: 'intruder', password: 'AdminSecurePassword123!' });
    assert.equal(badUser.status, 401);
    assert.equal(JSON.parse(badUser.text).code, 'INVALID_CREDENTIALS');

    // 2. Wrong password
    const badPass = await post('/api/admin/auth/login', { username: 'admin', password: 'wrongpassword' });
    assert.equal(badPass.status, 401);
    assert.equal(JSON.parse(badPass.text).code, 'INVALID_CREDENTIALS');

    // 3. Valid username + password -> returns time-limited database access token & sets cookie
    const valid = await post('/api/admin/auth/login', { username: 'admin', password: 'AdminSecurePassword123!' });
    assert.equal(valid.status, 200);
    const validJson = JSON.parse(valid.text);
    assert.equal(validJson.success, true);
    assert.ok(validJson.token.startsWith('adm_'));
    assert.ok(validJson.expiresAt);
    assert.ok(validJson.expiresInSeconds > 0);
    assert.equal(validJson.user.username, 'admin');

    // Verify Set-Cookie header is returned with the session token
    assert.ok(valid.headers['set-cookie']);
    assert.ok(valid.headers['set-cookie'][0].includes('youpi_admin_token=adm_'));

    // Verify the dynamic database token can authenticate protected requests via Cookie
    const verifyWithCookie = await get('/api/admin/auth/verify', { Cookie: `youpi_admin_token=${validJson.token}` });
    assert.equal(verifyWithCookie.status, 200);

    // 4. Valid email + password
    const validEmail = await post('/api/admin/auth/login', { username: 'admin@youpi.local', password: 'AdminSecurePassword123!' });
    assert.equal(validEmail.status, 200);

    // 5. Direct master token as password also returns session token
    const tokenLogin = await post('/api/admin/auth/login', { username: 'admin', password: getAdminToken() });
    assert.equal(tokenLogin.status, 200);
    assert.ok(JSON.parse(tokenLogin.text).token);
  });

  test('POST /api/admin/auth/logout revokes database session and clears cookie', async () => {
    // Login to get session token
    const loginRes = await post('/api/admin/auth/login', { username: 'admin', password: 'AdminSecurePassword123!' });
    const sessionToken = JSON.parse(loginRes.text).token;

    // Verify session is active
    const activeCheck = await get('/api/admin/auth/verify', { Authorization: `Bearer ${sessionToken}` });
    assert.equal(activeCheck.status, 200);

    // Logout and revoke session
    const res = await post('/api/admin/auth/logout', {}, { Authorization: `Bearer ${sessionToken}` });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.text).loggedOut, true);
    assert.ok(res.headers['set-cookie']);
    assert.ok(res.headers['set-cookie'][0].includes('youpi_admin_token=;'));

    // Verify revoked session is rejected
    const postLogoutCheck = await get('/api/admin/auth/verify', { Authorization: `Bearer ${sessionToken}` });
    assert.equal(postLogoutCheck.status, 401);
  });
});
