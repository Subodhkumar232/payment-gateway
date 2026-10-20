import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { getDatabase, MerchantRepository, SupportTicketRepository, AdminUserRepository } from '@youpi/db';
import { getAdminToken, safeEqual } from '@youpi/common';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Security headers applied to every response served by the merchant admin. */
const BASE_SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'"
});

/**
 * Extracts admin token from Bearer header, cookie, or query parameter.
 */
function getAuthTokenFromReq(req, url) {
  let token = '';
  const match = /^Bearer\s+(.+)$/i.exec(req.headers?.['authorization'] || '');
  if (match) token = match[1].trim();
  if (!token && req.headers?.cookie) {
    const cookieMatch = /(?:^|;\s*)youpi_admin_token=([^;]+)/.exec(req.headers.cookie);
    if (cookieMatch) {
      try {
        token = decodeURIComponent(cookieMatch[1].trim());
      } catch {
        token = cookieMatch[1].trim();
      }
    }
  }
  if (!token && url && typeof url.searchParams?.get === 'function') {
    token = (url.searchParams.get('token') || '').trim();
  }
  return token;
}

/**
 * Validates whether the caller presented a valid admin credential:
 * Either the master machine token, or an unexpired database-backed session token.
 */
function checkAdminToken(req, url, adminUserRepo) {
  const token = getAuthTokenFromReq(req, url);
  if (!token) return false;

  // 1. Static Master Token check
  if (safeEqual(token, getAdminToken())) return true;

  // 2. Dynamic Database Access Token check (with expiration check in SQLite)
  if (adminUserRepo) {
    try {
      const session = adminUserRepo.validateSession(token);
      if (session && session.valid) return true;
    } catch {}
  }
  return false;
}

function hasAdminToken(req, url, adminUserRepo) {
  return checkAdminToken(req, url, adminUserRepo);
}

/**
 * Strips headers a browser must not be able to spoof when relaying to an internal service.
 */
function sanitizedForwardHeaders(req, targetHost) {
  const headers = { ...req.headers, host: targetHost };
  for (const name of Object.keys(headers)) {
    const lower = name.toLowerCase();
    if (lower === 'x-internal-render' || lower === 'x-internal-token') {
      delete headers[name];
    }
  }
  return headers;
}

// In production, reliably ensure environment variables from .env are loaded if not already provided
if (!process.env.BASE_PAYMENT_API_URL && typeof process.loadEnvFile === 'function') {
  try {
    const rootEnv = path.resolve(__dirname, '../../../.env');
    if (fs.existsSync(rootEnv)) {
      process.loadEnvFile(rootEnv);
    }
  } catch {}
}

export class AdminServer {
  /**
   * @param {{
   *   db?: import('@youpi/db').Database,
   *   apiBaseUrl?: string
   * }} options
   */
  constructor(options = {}) {
    this.db = options.db || getDatabase();
    this.apiBaseUrl = options.apiBaseUrl || process.env.BASE_PAYMENT_API_URL || 'http://localhost:6100';
    this.merchantRepo = new MerchantRepository(this.db);
    this.ticketRepo = new SupportTicketRepository(this.db);
    this.adminUserRepo = new AdminUserRepository(this.db);
    this.htmlTemplatePath = path.join(__dirname, 'views', 'admin.html');
    this.template = fs.readFileSync(this.htmlTemplatePath, 'utf8');
    this.loginTemplatePath = path.join(__dirname, 'views', 'login.html');
    this.loginTemplate = fs.existsSync(this.loginTemplatePath)
      ? fs.readFileSync(this.loginTemplatePath, 'utf8')
      : '';
  }

  rebuildJsxIfNeeded() {
    try {
      const viewsDir = path.resolve(__dirname, 'views');
      const clientBundle = path.resolve(__dirname, '../public/js/admin.bundle.js');
      const ssrBundle = path.resolve(__dirname, '../public/js/admin.ssr.cjs');

      let bundleTime = 0;
      if (fs.existsSync(clientBundle)) {
        bundleTime = fs.statSync(clientBundle).mtimeMs;
      }

      let needsRebuild = bundleTime === 0;
      if (!needsRebuild) {
        const checkDir = (dir) => {
          if (!fs.existsSync(dir)) return;
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const full = path.join(dir, f);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
              checkDir(full);
            } else if (f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.html')) {
              if (stat.mtimeMs > bundleTime) {
                needsRebuild = true;
                break;
              }
            }
          }
        };
        checkDir(viewsDir);
      }

      if (needsRebuild) {
        const esbuild = require('esbuild');
        const outDir = path.resolve(__dirname, '../public/js');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        // 1. Client Browser Bundle (Unminified for clean human-readable dev inspection)
        esbuild.buildSync({
          entryPoints: [path.join(viewsDir, 'index.jsx')],
          bundle: true,
          outfile: clientBundle,
          minify: false,
          format: 'iife',
          target: ['es2020'],
          define: {
            'process.env.NODE_ENV': '"production"'
          }
        });

        // 2. SSR Bundle
        esbuild.buildSync({
          entryPoints: [path.join(viewsDir, 'App.jsx')],
          bundle: true,
          outfile: ssrBundle,
          format: 'cjs',
          target: ['node18'],
          define: {
            'process.env.NODE_ENV': '"production"'
          }
        });

        
        // 3. Login SSR Bundle
        const ssrLoginBundle = path.resolve(__dirname, '../public/js/login.ssr.cjs');
        esbuild.buildSync({
          entryPoints: [path.join(viewsDir, 'LoginPage.jsx')],
          bundle: true,
          outfile: ssrLoginBundle,
          format: 'cjs',
          target: ['node18'],
          define: {
            'process.env.NODE_ENV': '"production"'
          }
        });
        console.log('[AdminServer] Auto-recompiled React JSX components on demand.');
      }
    } catch (err) {
      console.warn('[AdminServer] On-demand JSX build failed, serving cached bundle:', err.message);
    }
  }

  async rebuildCssIfNeeded() {
    try {
      const cssPath = path.resolve(__dirname, '../public/css/admin.css');
      const inputCssPath = path.resolve(__dirname, 'styles/input.css');
      const tailwindConfigPath = path.resolve(__dirname, '../tailwind.config.js');

      let cssTime = 0;
      if (fs.existsSync(cssPath)) {
        cssTime = fs.statSync(cssPath).mtimeMs;
      }

      let needsRebuild = cssTime === 0;
      if (!needsRebuild && fs.existsSync(inputCssPath)) {
        if (fs.statSync(inputCssPath).mtimeMs > cssTime) {
          needsRebuild = true;
        }
      }
      if (!needsRebuild && fs.existsSync(tailwindConfigPath)) {
        if (fs.statSync(tailwindConfigPath).mtimeMs > cssTime) {
          needsRebuild = true;
        }
      }

      if (!needsRebuild) {
        const viewsDir = path.resolve(__dirname, 'views');
        const checkViews = (dir) => {
          if (!fs.existsSync(dir)) return;
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const full = path.join(dir, f);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
              checkViews(full);
              if (needsRebuild) break;
            } else if (f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.html')) {
              if (stat.mtimeMs > cssTime) {
                needsRebuild = true;
                break;
              }
            }
          }
        };
        checkViews(viewsDir);
      }

      if (needsRebuild) {
        const postcss = require('postcss');
        const tailwindcss = require('tailwindcss');
        const autoprefixer = require('autoprefixer');

        const outDir = path.resolve(__dirname, '../public/css');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        const rawCss = fs.readFileSync(inputCssPath, 'utf8');
        const result = await postcss([
          tailwindcss(tailwindConfigPath),
          autoprefixer
        ]).process(rawCss, { from: inputCssPath });

        fs.writeFileSync(cssPath, result.css, 'utf8');
        console.log('[AdminServer] Auto-recompiled Tailwind CSS on demand.');
      }
    } catch (err) {
      console.warn('[AdminServer] On-demand CSS build failed:', err.message);
    }
  }

  renderHtml() {
    this.rebuildJsxIfNeeded();
    try {
      this.template = fs.readFileSync(this.htmlTemplatePath, 'utf8');
    } catch {}

    let html = this.template;

    // Server-Side Rendering (SSR) for React JSX components
    const ssrBundlePath = path.resolve(__dirname, '../public/js/admin.ssr.cjs');
    if (html.includes('<!-- SSR_APP_ROOT -->')) {
      let ssrMarkup = '';
      if (fs.existsSync(ssrBundlePath)) {
        try {
          const resolvedPath = path.resolve(ssrBundlePath);
          delete require.cache[resolvedPath];
          const App = require(resolvedPath).default || require(resolvedPath);
          ssrMarkup = ReactDOMServer.renderToString(React.createElement(App));
        } catch (err) {
          console.warn('[AdminServer] SSR rendering error, falling back to client-side mount:', err.message);
        }
      }
      html = html.replace('<!-- SSR_APP_ROOT -->', ssrMarkup);
    }

    // Resolve modular partial includes: <!-- include:partials/<filename>.html -->
    const includeRegex = /<!--\s*include:([a-zA-Z0-9_\-\/.]+)\s*-->/g;
    html = html.replace(includeRegex, (match, partialPath) => {
      try {
        const fullPartialPath = path.resolve(__dirname, 'views', partialPath);
        if (fs.existsSync(fullPartialPath)) {
          return fs.readFileSync(fullPartialPath, 'utf8');
        }
        console.warn(`[AdminServer] Partial file not found: ${fullPartialPath}`);
        return `<!-- Missing partial: ${partialPath} -->`;
      } catch (err) {
        console.error(`[AdminServer] Error reading partial ${partialPath}:`, err);
        return `<!-- Error including partial: ${partialPath} -->`;
      }
    });

    // Always use empty string '' so client fetch calls hit the merchant admin's own /api proxy!
    // This completely eliminates CORS errors, tunnel downtime 530s, and cross-origin failures.
    const clientApiBase = '';
    html = html.replaceAll('{{API_BASE_URL}}', clientApiBase);
    html = html.replaceAll('{{ADMIN_TOKEN}}', '');
    return html;
  }

  renderLoginHtml() {
    this.rebuildJsxIfNeeded();
    try {
      if (fs.existsSync(this.loginTemplatePath)) {
        this.loginTemplate = fs.readFileSync(this.loginTemplatePath, 'utf8');
      }
    } catch {}

    let html = this.loginTemplate;
    const ssrLoginBundle = path.resolve(__dirname, '../public/js/login.ssr.cjs');
    if (html.includes('<!-- SSR_LOGIN_ROOT -->')) {
      let ssrMarkup = '';
      if (fs.existsSync(ssrLoginBundle)) {
        try {
          const resolvedPath = path.resolve(ssrLoginBundle);
          delete require.cache[resolvedPath];
          const LoginPage = require(resolvedPath).default || require(resolvedPath);
          ssrMarkup = ReactDOMServer.renderToString(React.createElement(LoginPage));
        } catch (err) {
          console.warn('[AdminServer] SSR Login rendering error, falling back to client-side mount:', err.message);
        }
      }
      html = html.replace('<!-- SSR_LOGIN_ROOT -->', ssrMarkup);
    }
    return html;
  }

  createServer() {
    return http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
      }

      // Health
      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'UP', service: 'merchant-admin' }));
        return;
      }

      // Admin Auth Login: POST /api/admin/auth/login
      if (pathname === '/api/admin/auth/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
          if (body.length > 65536) req.destroy();
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const inputUsername = (data.username || data.loginId || data.email || '').trim();
            const inputPassword = (data.password || '').trim();

            if (!inputUsername || !inputPassword) {
              res.writeHead(400, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                ...BASE_SECURITY_HEADERS
              });
              res.end(JSON.stringify({ error: 'Username and password are required', code: 'MISSING_CREDENTIALS' }));
              return;
            }

            // 1. Verify credentials against SQLite database (admin_users table)
            const dbCheck = this.adminUserRepo.verifyCredentials(inputUsername, inputPassword);

            // 2. Direct master token bypass (e.g. CLI/tests entering token directly as password)
            const isDirectToken = safeEqual(inputPassword, getAdminToken()) || safeEqual(inputUsername, getAdminToken());

            let authenticatedUser = null;
            if (dbCheck.valid) {
              authenticatedUser = dbCheck.user;
            } else if (isDirectToken) {
              authenticatedUser = this.adminUserRepo.findByUsernameOrEmail('admin') || {
                id: '00000000-0000-0000-0000-000000000009',
                username: 'admin',
                email: 'admin@youpi.local',
                role: 'superadmin'
              };
            }

            if (authenticatedUser) {
              // 3. Issue time-limited access token in SQLite database (admin_sessions table)
              const ttlHours = Number(process.env.ADMIN_SESSION_TTL_HOURS || 24);
              const ipAddress = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || null;
              const userAgent = req.headers['user-agent'] || null;
              const session = this.adminUserRepo.createSession(authenticatedUser.id, {
                ttlHours,
                ipAddress,
                userAgent
              });

              const sessionCookie = `youpi_admin_token=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlHours * 3600}`;
              res.writeHead(200, {
                'Set-Cookie': sessionCookie,
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                ...BASE_SECURITY_HEADERS
              });
              res.end(JSON.stringify({
                success: true,
                token: session.token,
                expiresAt: session.expiresAt,
                expiresInSeconds: session.expiresInSeconds,
                user: session.user || {
                  id: authenticatedUser.id,
                  username: authenticatedUser.username,
                  email: authenticatedUser.email,
                  role: authenticatedUser.role
                }
              }));
              return;
            }

            res.writeHead(401, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              ...BASE_SECURITY_HEADERS
            });
            res.end(JSON.stringify({
              error: 'Invalid username or password',
              code: 'INVALID_CREDENTIALS'
            }));
          } catch (err) {
            res.writeHead(400, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              ...BASE_SECURITY_HEADERS
            });
            res.end(JSON.stringify({ error: 'Invalid JSON payload', code: 'BAD_REQUEST' }));
          }
        });
        return;
      }

      // Admin Auth Logout: POST or GET /api/admin/auth/logout
      if (pathname === '/api/admin/auth/logout') {
        const token = getAuthTokenFromReq(req, url);
        if (token && this.adminUserRepo) {
          this.adminUserRepo.revokeSession(token);
        }
        const clearCookie = 'youpi_admin_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': clearCookie,
          'Access-Control-Allow-Origin': '*',
          ...BASE_SECURITY_HEADERS
        });
        res.end(JSON.stringify({ success: true, loggedOut: true }));
        return;
      }

      // Logout Redirect: GET /logout
      if (pathname === '/logout') {
        const token = getAuthTokenFromReq(req, url);
        if (token && this.adminUserRepo) {
          this.adminUserRepo.revokeSession(token);
        }
        const clearCookie = 'youpi_admin_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
        res.writeHead(302, {
          'Location': '/login',
          'Set-Cookie': clearCookie,
          ...BASE_SECURITY_HEADERS
        });
        res.end();
        return;
      }

      // Admin Auth Verification: POST or GET /api/admin/auth/verify
      if (pathname === '/api/admin/auth/verify') {
        const token = getAuthTokenFromReq(req, url);
        if (!token || !checkAdminToken(req, url, this.adminUserRepo)) {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            ...BASE_SECURITY_HEADERS
          });
          res.end(JSON.stringify({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }));
          return;
        }

        let user = { username: 'admin' };
        if (this.adminUserRepo && token) {
          try {
            const session = this.adminUserRepo.validateSession(token);
            if (session && session.user) {
              user = session.user;
            }
          } catch {}
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          ...BASE_SECURITY_HEADERS
        });
        res.end(JSON.stringify({ success: true, authenticated: true, token, user }));
        return;
      }

      // Admin Tickets API: GET /api/admin/tickets
      if (pathname === '/api/admin/tickets') {
        if (!hasAdminToken(req, url, this.adminUserRepo)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }));
          return;
        }
        const merchants = this.merchantRepo.findAll();
        const mId = merchants[0]?.id || '00000000-0000-0000-0000-000000000001';
        const tickets = this.ticketRepo.findTicketsByMerchant(mId);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          ...BASE_SECURITY_HEADERS
        });
        res.end(JSON.stringify(tickets));
        return;
      }

      // Merged Control Center Supervisor Proxy: /api/services/* and /api/logs/stream -> Control Center on port 8090
      // Relaying this unauthenticated would republish process control and every service's
      // stdout/stderr on the internet-facing admin host, so the admin token is required.
      if (pathname.startsWith('/api/services') || pathname === '/api/logs/stream') {
        if (!hasAdminToken(req, url, this.adminUserRepo)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }));
          return;
        }
        const ccPort = Number(process.env.CONTROL_CENTER_PORT || 8090);
        const proxyReq = http.request({
          hostname: '127.0.0.1',
          port: ccPort,
          path: req.url,
          method: req.method,
          headers: {
            ...sanitizedForwardHeaders(req, `localhost:${ccPort}`),
            authorization: `Bearer ${getAdminToken()}`
          }
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Control center supervisor unavailable', details: err.message }));
          }
        });

        req.pipe(proxyReq);
        return;
      }

      // Transparent API Proxy: /api/* -> Payment Core REST API
      if (pathname.startsWith('/api/')) {
        const targetPort = Number(process.env.PAYMENT_API_PORT || 6100);
        const defaultMerchant = this.merchantRepo.getDefault ? this.merchantRepo.getDefault() : (this.merchantRepo.findById('00000000-0000-0000-0000-000000000001') || this.merchantRepo.findAll()[0]);
        const defaultMerchantId = defaultMerchant?.id || '00000000-0000-0000-0000-000000000001';
        const proxyReq = http.request({
          hostname: '127.0.0.1',
          port: targetPort,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            'x-merchant-id': req.headers['x-merchant-id'] || defaultMerchantId,
            host: `localhost:${targetPort}`,
            'x-forwarded-host': req.headers.host || '',
            'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http'
          }
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Gateway API unavailable', details: err.message }));
          }
        });

        req.pipe(proxyReq);
        return;
      }

      // Download Android Companion APK
      if (pathname === '/youpi-sms-gateway.apk' || pathname === '/api/v1/admin/sms-gateway/download-apk') {
        const apkCandidates = [
          path.resolve(__dirname, '../public/youpi-sms-gateway.apk'),
          path.resolve(__dirname, '../../payment-api/public/youpi-sms-gateway.apk'),
          path.resolve(__dirname, '../../android-observer-app/youpi-sms-gateway.apk')
        ];
        let apkPath = null;
        for (const p of apkCandidates) {
          if (fs.existsSync(p)) {
            apkPath = p;
            break;
          }
        }
        if (apkPath) {
          const stat = fs.statSync(apkPath);
          res.writeHead(200, {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': 'attachment; filename="youpi-sms-gateway.apk"',
            'Content-Length': stat.size,
            'Access-Control-Allow-Origin': '*'
          });
          const stream = fs.createReadStream(apkPath);
          stream.pipe(res);
          return;
        }
      }



      // CSS: /src/styles/input.css or /css/*
      if (pathname === '/src/styles/input.css' || pathname.startsWith('/css/')) {
        await this.rebuildCssIfNeeded();
        const cssPath = path.resolve(__dirname, '../public/css/admin.css');
        if (fs.existsSync(cssPath)) {
          const content = fs.readFileSync(cssPath, 'utf8');
          res.writeHead(200, {
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(content);
          return;
        }
      }

      // Vite Module / Source Entry: GET /src/*
      if (pathname.startsWith('/src/')) {
        if (pathname === '/src/views/index.jsx' || pathname.endsWith('.jsx')) {
          this.rebuildJsxIfNeeded();
          const clientBundle = path.resolve(__dirname, '../public/js/admin.bundle.js');
          if (fs.existsSync(clientBundle)) {
            const content = fs.readFileSync(clientBundle, 'utf8');
            res.writeHead(200, {
              'Content-Type': 'application/javascript; charset=utf-8',
              'Cache-Control': 'no-cache',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
            return;
          }
        }
      }

      // Static JavaScript: GET /js/*
      if (pathname.startsWith('/js/')) {
        const jsFile = path.basename(pathname);
        if (jsFile === 'admin.bundle.js') {
          this.rebuildJsxIfNeeded();
        }
        const jsPath = path.resolve(__dirname, '../public/js', jsFile);
        if (fs.existsSync(jsPath)) {
          const content = fs.readFileSync(jsPath, 'utf8');
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(content);
          return;
        }
      }

      // Dedicated Login Page: GET /login
      if (pathname === '/login') {
        if (hasAdminToken(req, url, this.adminUserRepo)) {
          res.writeHead(302, {
            'Location': '/',
            ...BASE_SECURITY_HEADERS
          });
          res.end();
          return;
        }

        const loginHtml = this.renderLoginHtml();
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          ...BASE_SECURITY_HEADERS
        });
        res.end(loginHtml);
        return;
      }

      // Dashboard View: GET / or GET /admin
      if (pathname === '/' || pathname === '/admin') {
        // Server-side Authentication Middleware
        if (!hasAdminToken(req, url, this.adminUserRepo)) {
          res.writeHead(302, {
            'Location': '/login',
            ...BASE_SECURITY_HEADERS
          });
          res.end();
          return;
        }

        const html = this.renderHtml();
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          ...BASE_SECURITY_HEADERS
        });
        res.end(html);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Admin Route Not Found');
    });
  }
}
