import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../database.js';
import { runMigrations } from '../migrate.js';
import { AdminUserRepository } from '../repositories/admin-user.repository.js';

describe('AdminUserRepository & Session Engine Tests', () => {
  let db;
  let repo;

  before(() => {
    db = new Database({ inMemory: true });
    runMigrations(db);
    repo = new AdminUserRepository(db);
  });

  after(() => {
    db.close();
  });

  test('default admin is pre-seeded in SQLite database', () => {
    const admin = repo.findByUsername('admin');
    assert.ok(admin);
    assert.equal(admin.username, 'admin');
    assert.equal(admin.email, 'admin@youpi.local');
    assert.equal(admin.role, 'superadmin');
    assert.equal(admin.is_active, 1);
    assert.ok(admin.password_hash.startsWith('100000:'));
  });

  test('finds user case-insensitively by username or email', () => {
    const byUser = repo.findByUsernameOrEmail('ADMIN');
    assert.ok(byUser);
    assert.equal(byUser.id, '00000000-0000-0000-0000-000000000009');

    const byEmail = repo.findByUsernameOrEmail('Admin@Youpi.Local');
    assert.ok(byEmail);
    assert.equal(byEmail.id, '00000000-0000-0000-0000-000000000009');
  });

  test('verifies correct and incorrect passwords', () => {
    const ok = repo.verifyCredentials('admin', 'AdminSecurePassword123!');
    assert.equal(ok.valid, true);
    assert.equal(ok.user.username, 'admin');

    const wrong = repo.verifyCredentials('admin', 'IncorrectPassword');
    assert.equal(wrong.valid, false);
    assert.equal(wrong.reason, 'INVALID_PASSWORD');

    const nonExistent = repo.verifyCredentials('nonexistent', 'any');
    assert.equal(nonExistent.valid, false);
    assert.equal(nonExistent.reason, 'USER_NOT_FOUND');
  });

  test('creates time-limited session with TTL and validates it', () => {
    const admin = repo.findByUsername('admin');
    const session = repo.createSession(admin.id, { ttlHours: 2 });

    assert.ok(session.token.startsWith('adm_'));
    assert.equal(session.expiresInSeconds, 7200);
    assert.ok(new Date(session.expiresAt).getTime() > Date.now());

    // Validation passes
    const validated = repo.validateSession(session.token);
    assert.ok(validated);
    assert.equal(validated.valid, true);
    assert.equal(validated.user.username, 'admin');
  });

  test('rejects expired sessions and marks them inactive', () => {
    const admin = repo.findByUsername('admin');
    // Session expired 1 hour ago
    const session = repo.createSession(admin.id, { ttlHours: -1 });

    const validated = repo.validateSession(session.token);
    assert.equal(validated, null);
  });

  test('revoking a session invalidates subsequent requests', () => {
    const admin = repo.findByUsername('admin');
    const session = repo.createSession(admin.id, { ttlHours: 12 });

    const beforeRevoke = repo.validateSession(session.token);
    assert.ok(beforeRevoke);

    repo.revokeSession(session.token);

    const afterRevoke = repo.validateSession(session.token);
    assert.equal(afterRevoke, null);
  });
});
