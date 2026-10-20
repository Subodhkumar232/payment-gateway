import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PaymentObserverClient } from '@youpi/observer-sdk';
import { getObserverToken } from '@youpi/common';
import { BankEmailParser, redactSensitiveData, isAuthorizedBankEmailSender } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

function extractBodyFromGmailPayload(payload) {
  if (!payload) return '';
  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, 'base64url').toString('utf8');
    } catch {}
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try {
          return Buffer.from(part.body.data, 'base64url').toString('utf8');
        } catch {}
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        try {
          const html = Buffer.from(part.body.data, 'base64url').toString('utf8');
          return html.replace(/<[^>]+>/g, ' ');
        } catch {}
      }
    }
    for (const part of payload.parts) {
      if (part.body?.data) {
        try {
          return Buffer.from(part.body.data, 'base64url').toString('utf8');
        } catch {}
      }
    }
  }
  return '';
}

export class GmailPoller {
  /**
   * @param {{
   *   apiBaseUrl?: string,
   *   receivingAccountId?: string,
   *   pollIntervalMs?: number,
   *   storagePath?: string
   * }} options
   */
  constructor(options = {}) {
    const isLocalhost = process.env.YOUPI_MODE === 'localhost' || !process.env.YOUPI_MODE;
    this.apiBaseUrl = options.apiBaseUrl || (isLocalhost ? `http://127.0.0.1:${process.env.PAYMENT_API_PORT || 6100}` : (process.env.BASE_PAYMENT_API_URL || 'http://localhost:6100'));
    this.receivingAccountId = options.receivingAccountId || process.env.RECEIVING_ACCOUNT_ID || null;
    this.pollIntervalMs = options.pollIntervalMs || Number(process.env.GMAIL_POLL_INTERVAL_MS || 5000);
    this.storagePath = options.storagePath || path.join(rootDir, 'data', 'gmail_processed_ids.json');
    this.observerClient = new PaymentObserverClient({
      apiBaseUrl: this.apiBaseUrl,
      sourceName: 'GMAIL'
    });

    this.isRunning = false;
    this.timer = null;
    this.lastPollAt = null;
    this.observedCount = 0;
    this.credentials = null;
    this.cachedAccessToken = null;
    this.tokenExpiresAt = 0;
    this.processedMessageIds = new Set();
    this.loadProcessedIdsFromDisk();
  }

  loadProcessedIdsFromDisk() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.processedMessageIds = new Set(list);
        }
      }
    } catch {}
  }

  saveProcessedIdsToDisk() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(Array.from(this.processedMessageIds)), 'utf8');
    } catch {}
  }

  setCredentials(creds) {
    this.credentials = { ...(this.credentials || {}), ...creds };
  }

  async fetchCredentialsFromPaymentApi() {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/v1/admin/gmail/credentials`, { headers: { Authorization: `Bearer ${getObserverToken()}` } });
      if (res.ok) {
        const data = await res.json();
        const conf = data.gmailConfig || data;
        if (conf.refreshToken || conf.clientId) {
          this.setCredentials({
            clientId: conf.clientId,
            clientSecret: conf.clientSecret,
            refreshToken: conf.refreshToken,
            connectedEmail: conf.connectedEmail
          });
        }
      }
    } catch {}
  }

  async getAccessToken() {
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedAccessToken;
    }

    if (!this.credentials?.refreshToken || !this.credentials?.clientId || !this.credentials?.clientSecret) {
      await this.fetchCredentialsFromPaymentApi();
    }

    const { clientId, clientSecret, refreshToken } = this.credentials || {};
    if (!clientId || !clientSecret || !refreshToken) {
      console.log('[Gmail Observer] Gmail OAuth2 credentials (clientId, clientSecret, refreshToken) not configured. OAuth setup required.');
      return null;
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!tokenRes.ok) {
        return null;
      }

      const tokenData = await tokenRes.json();
      this.cachedAccessToken = tokenData.access_token;
      this.tokenExpiresAt = Date.now() + ((tokenData.expires_in || 3500) - 120) * 1000;
      return this.cachedAccessToken;
    } catch (err) {
      console.warn('[Gmail Observer] Failed to refresh Google access token:', redactSensitiveData(err.message));
      return null;
    }
  }

  /**
   * Ingests an email directly (e.g. from webhook, push notification, or manual poll).
   * Fails closed if no receivingAccountId is configured (dynamic account guessing is prohibited).
   * Treats email content as untrusted input with spoofing rejection and duplicate protection.
   * @param {{ subject: string, body: string, date?: string | Date, from?: string, id?: string, messageId?: string }} email
   */
  async processEmail(email) {
    if (!this.receivingAccountId) {
      console.warn('[Gmail Observer] Dropping observation: no receivingAccountId configured (fail-closed, dynamic guessing prohibited)');
      return null;
    }

    const messageId = email.id || email.messageId;
    if (messageId && this.processedMessageIds.has(messageId)) {
      console.log(`[Gmail Observer] Skipping already-processed message ID: ${messageId}`);
      return { accepted: false, duplicate: true, reason: 'MESSAGE_ALREADY_PROCESSED' };
    }

    const sender = email.from || email.sender || 'alerts@retail.bank.in';

    // Treat email as untrusted input: Validate official bank sender domain (Spoof protection)
    if (email.from && !isAuthorizedBankEmailSender(email.from)) {
      console.warn(`[Gmail Observer] Rejected untrusted sender domain: ${redactSensitiveData(sender)} (Spoof protection)`);
      return { accepted: false, rejected: true, reason: 'UNAUTHORIZED_SENDER_DOMAIN' };
    }

    let parsed = null;
    try {
      parsed = BankEmailParser.parse(email);
    } catch {}

    // Malformed or non-credit handling
    if (!parsed || !parsed.amountPaise) {
      console.warn(`[Gmail Observer] Ignoring message from ${redactSensitiveData(sender)}: non-credit or malformed amount.`);
      return { accepted: false, rejected: true, reason: 'MALFORMED_OR_NON_CREDIT' };
    }

    const rawContent = `${email.subject || ''}\n${email.body || ''}`.trim();

    try {
      const result = await this.observerClient.submitObservation({
        receivingAccountId: this.receivingAccountId,
        amountPaise: parsed ? parsed.amountPaise : undefined,
        amount: parsed ? parsed.amount : undefined,
        observedAt: email.date ? new Date(email.date) : new Date(),
        bankReferenceNumber: parsed?.bankReferenceNumber,
        senderVpa: parsed?.senderVpa,
        sender,
        rawText: rawContent,
        rawPayload: {
          messageId: messageId || `gmail_${Date.now()}`,
          subject: email.subject || '',
          body: email.body || '',
          snippet: parsed?.rawSnippet || (email.body || '').substring(0, 200),
          from: sender,
          sender,
          source: 'GMAIL',
          internalDate: email.internalDate || (email.date ? new Date(email.date).getTime() : Date.now())
        }
      });

      if (messageId) {
        this.processedMessageIds.add(messageId);
        if (this.processedMessageIds.size > 1000) {
          const firstKey = this.processedMessageIds.values().next().value;
          this.processedMessageIds.delete(firstKey);
        }
        this.saveProcessedIdsToDisk();
      }

      this.observedCount++;
      return result;
    } catch (err) {
      console.error(`[Gmail Observer] Submission failed: ${redactSensitiveData(err.message)}`);
      throw err;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Gmail Observer] Poller started (interval: ${this.pollIntervalMs}ms)`);

    // Run first poll cycle immediately
    this.pollCycle().catch(() => {});

    this.timer = setInterval(() => {
      this.pollCycle().catch(() => {});
    }, this.pollIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this._isPolling = false;
    console.log('[Gmail Observer] Poller stopped.');
  }

  async pollCycle() {
    if (this._isPolling) return;
    this._isPolling = true;

    try {
      this.lastPollAt = new Date();
      const accessToken = await this.getAccessToken();
      if (!accessToken) return;

      // Strict bank transaction alert filter (read-only search)
      const query = encodeURIComponent('subject:(credit OR credited OR received OR upi OR deposit OR alert)');
      const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${query}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8000)
      });

      if (!listRes.ok) {
        if (listRes.status === 401) {
          this.cachedAccessToken = null;
        }
        return;
      }

      const listData = await listRes.json();
      const messages = listData.messages || [];

      for (const m of messages) {
        if (this.processedMessageIds.has(m.id)) continue;

        try {
          const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(8000)
          });
          if (!msgRes.ok) continue;

          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
          const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
          const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
          const body = extractBodyFromGmailPayload(msgData.payload) || msgData.snippet || '';

          await this.processEmail({
            id: m.id,
            messageId: m.id,
            subject,
            body,
            from,
            date: dateStr ? new Date(dateStr) : new Date(Number(msgData.internalDate || Date.now()))
          });
        } catch (msgErr) {
          console.warn(`[Gmail Observer] Error fetching message:`, redactSensitiveData(msgErr.message));
        }
      }
    } catch (err) {
      console.warn('[Gmail Observer] pollCycle error:', redactSensitiveData(err.message));
    } finally {
      this._isPolling = false;
    }
  }
}
