import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Database, runMigrations } from '../index.js';
import { PaymentSessionRepository } from '../repositories/payment-session.repository.js';
import { MerchantRepository } from '../repositories/merchant.repository.js';

test('runMigrations upgrades idx_single_active_session_per_order to exclude SUSPICIOUS on existing databases', () => {
  // Build a database that simulates a pre-SUSPICIOUS deployment: schema tables present
  // but the index carries the old WHERE clause without 'SUSPICIOUS'.
  const db = new Database({ inMemory: true, autoMigrate: false });

  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      webhook_url TEXT,
      webhook_secret TEXT NOT NULL,
      api_key_hash TEXT,
      branding TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payment_receiving_accounts (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      upi_id TEXT NOT NULL,
      payee_name TEXT NOT NULL,
      is_merchant_enabled INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_slot_busy INTEGER NOT NULL DEFAULT 0,
      current_active_session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payment_sessions (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      customer_id TEXT,
      receiving_account_id TEXT,
      order_id TEXT NOT NULL,
      attempt_id TEXT,
      amount_paise INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      method TEXT NOT NULL DEFAULT 'UPI',
      status TEXT NOT NULL DEFAULT 'INITIATED',
      queue_position INTEGER DEFAULT 0,
      slot_acquired_at TEXT,
      expires_at TEXT,
      processing_started_at TEXT,
      processing_expires_at TEXT,
      completed_at TEXT,
      return_url TEXT,
      attributed_observation_id TEXT,
      idempotency_key TEXT,
      device_id TEXT,
      verification_level INTEGER DEFAULT 0,
      verification_sources TEXT DEFAULT '[]',
      verification_tag TEXT DEFAULT 'UNVERIFIED',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Install the old index without 'SUSPICIOUS' in its predicate.
  db.exec(`CREATE UNIQUE INDEX idx_single_active_session_per_order
    ON payment_sessions (merchant_id, order_id)
    WHERE status NOT IN ('FAILED', 'EXPIRED', 'CANCELLED');`);

  // Confirm the old definition is in place before migration.
  const before = db.queryOne("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_single_active_session_per_order'");
  assert.ok(before && before.sql, 'index must exist before migration');
  assert.ok(!before.sql.includes('SUSPICIOUS'), 'old index must not mention SUSPICIOUS');

  // Run migrations; they must upgrade the index.
  runMigrations(db);

  const after = db.queryOne("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_single_active_session_per_order'");
  assert.ok(after && after.sql, 'index must still exist after migration');
  assert.ok(after.sql.includes('SUSPICIOUS'), 'index must include SUSPICIOUS after migration');

  // Resolve the default merchant created by runMigrations.
  const merchantRepo = new MerchantRepository(db);
  const merchant = merchantRepo.findAll()[0];
  assert.ok(merchant, 'default merchant must exist');

  const sessionRepo = new PaymentSessionRepository(db);

  // Insert a SUSPICIOUS session for ORDER-001.
  sessionRepo.create({ merchantId: merchant.id, orderId: 'ORDER-001', amountPaise: 10000n, status: 'SUSPICIOUS' });

  // A new session for the same order must now be accepted (SUSPICIOUS is terminal for index purposes).
  let newSession;
  assert.doesNotThrow(() => {
    newSession = sessionRepo.create({ merchantId: merchant.id, orderId: 'ORDER-001', amountPaise: 10000n });
  }, 'creating a session for an order with a SUSPICIOUS session must not throw');
  assert.ok(newSession && newSession.id, 'new session must be created');

  // A second active session for the same order must still be rejected.
  assert.throws(() => {
    sessionRepo.create({ merchantId: merchant.id, orderId: 'ORDER-001', amountPaise: 10000n });
  }, 'a second non-terminal session for the same order must violate the unique index');

  // Running migrations a second time must be idempotent.
  assert.doesNotThrow(() => {
    runMigrations(db);
  }, 'running migrations again must not throw');

  const afterSecond = db.queryOne("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_single_active_session_per_order'");
  assert.ok(afterSecond && afterSecond.sql.includes('SUSPICIOUS'), 'index must still be correct after second migration run');

  db.close();
});
