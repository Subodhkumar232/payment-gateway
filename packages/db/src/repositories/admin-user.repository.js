import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from '@youpi/common';

export class AdminUserRepository {
  /**
   * @param {import('../database.js').Database} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Hash a raw session token to store in the DB (prevents replay if DB leaked)
   * @param {string} token
   * @returns {string}
   */
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Finds an admin user by lowercase username
   * @param {string} username
   */
  findByUsername(username) {
    if (!username) return null;
    return this.db.queryOne(
      'SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?)',
      [username.trim()]
    );
  }

  /**
   * Finds an admin user by lowercase email
   * @param {string} email
   */
  findByEmail(email) {
    if (!email) return null;
    return this.db.queryOne(
      'SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );
  }

  /**
   * Finds an admin user by either username or email
   * @param {string} identifier
   */
  findByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return this.db.queryOne(
      'SELECT * FROM admin_users WHERE LOWER(username) = ? OR LOWER(email) = ?',
      [clean, clean]
    );
  }

  /**
   * Finds an admin user by ID
   * @param {string} id
   */
  findById(id) {
    if (!id) return null;
    return this.db.queryOne('SELECT * FROM admin_users WHERE id = ?', [id]);
  }

  /**
   * Creates a new admin user in the database
   * @param {{
   *   id?: string,
   *   username: string,
   *   email: string,
   *   password?: string,
   *   passwordHash?: string,
   *   role?: string
   * }} data
   */
  create(data) {
    const id = data.id || crypto.randomUUID();
    const username = data.username.trim().toLowerCase();
    const email = data.email.trim().toLowerCase();
    const passwordHash = data.passwordHash || (data.password ? hashPassword(data.password) : '');
    const role = data.role || 'admin';
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO admin_users (id, username, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `;

    this.db.execute(sql, [id, username, email, passwordHash, role, now, now]);

    return {
      id,
      username,
      email,
      role,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Verifies an admin's password against the database record
   * @param {string} identifier (username or email)
   * @param {string} password
   * @returns {{ valid: boolean, user?: any, reason?: string }}
   */
  verifyCredentials(identifier, password) {
    if (!identifier || !password) {
      return { valid: false, reason: 'MISSING_CREDENTIALS' };
    }

    const user = this.findByUsernameOrEmail(identifier);
    if (!user) {
      return { valid: false, reason: 'USER_NOT_FOUND' };
    }

    if (!user.is_active) {
      return { valid: false, reason: 'USER_INACTIVE' };
    }

    const matches = verifyPassword(password, user.password_hash);
    if (!matches) {
      return { valid: false, reason: 'INVALID_PASSWORD' };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  }

  /**
   * Creates a time-limited active session for an admin
   * @param {string} adminUserId
   * @param {{
   *   ttlHours?: number,
   *   ipAddress?: string,
   *   userAgent?: string
   * }} [options={}]
   */
  createSession(adminUserId, options = {}) {
    const id = crypto.randomUUID();
    const token = `adm_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = AdminUserRepository.hashToken(token);
    const ttlHours = options.ttlHours || 24; // 24 hours default
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 3600 * 1000);

    const sql = `
      INSERT INTO admin_sessions (id, admin_user_id, token_hash, expires_at, is_active, ip_address, user_agent, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
    `;

    this.db.execute(sql, [
      id,
      adminUserId,
      tokenHash,
      expiresAt.toISOString(),
      options.ipAddress || null,
      options.userAgent || null,
      now.toISOString(),
      now.toISOString()
    ]);

    const user = this.findById(adminUserId);

    return {
      sessionId: id,
      token,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: ttlHours * 3600,
      user: user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      } : null
    };
  }

  /**
   * Validates an access token against active database sessions
   * @param {string} token
   * @returns {{ valid: boolean, user?: any, expiresAt?: string } | null}
   */
  validateSession(token) {
    if (!token || typeof token !== 'string') return null;
    const tokenHash = AdminUserRepository.hashToken(token.trim());

    const sql = `
      SELECT s.id as session_id, s.expires_at, s.is_active as session_active,
             u.id as user_id, u.username, u.email, u.role, u.is_active as user_active
      FROM admin_sessions s
      JOIN admin_users u ON s.admin_user_id = u.id
      WHERE s.token_hash = ? AND s.is_active = 1
    `;

    const row = this.db.queryOne(sql, [tokenHash]);
    if (!row) return null;

    if (!row.user_active) {
      return null;
    }

    const expiryTime = new Date(row.expires_at).getTime();
    if (Date.now() > expiryTime) {
      // Mark session expired in database
      try {
        this.db.execute('UPDATE admin_sessions SET is_active = 0 WHERE id = ?', [row.session_id]);
      } catch {}
      return null;
    }

    return {
      valid: true,
      sessionId: row.session_id,
      expiresAt: row.expires_at,
      user: {
        id: row.user_id,
        username: row.username,
        email: row.email,
        role: row.role
      }
    };
  }

  /**
   * Revokes an active session token (Logout)
   * @param {string} token
   */
  revokeSession(token) {
    if (!token) return false;
    const tokenHash = AdminUserRepository.hashToken(token.trim());
    this.db.execute('UPDATE admin_sessions SET is_active = 0 WHERE token_hash = ?', [tokenHash]);
    return true;
  }

  /**
   * Revokes all active sessions for an admin user
   * @param {string} adminUserId
   */
  revokeAllUserSessions(adminUserId) {
    if (!adminUserId) return false;
    this.db.execute('UPDATE admin_sessions SET is_active = 0 WHERE admin_user_id = ?', [adminUserId]);
    return true;
  }
}
