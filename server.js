import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createStore, createSupabaseStore } from './lib/store.js';
import {
  hashPassword,
  verifyPassword,
  randomPassword,
  createSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearCookie,
  clientIp,
} from './lib/session.js';
import { DEFAULT_CONTENT, sanitizeContent } from './lib/content.js';
import { renderSite, renderPrivacy, renderTrack, formatTime } from './lib/views/site.js';
import {
  renderLogin,
  adminLayout,
  renderDashboard,
  renderContentEditor,
  renderInquiryList,
  renderInquiryDetail,
  renderSettings,
} from './lib/views/admin.js';
import { esc } from './lib/views/html.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// 上雲時把 DATA_DIR 指去持久化磁碟（Render / Fly 的 volume），資料才不會隨部署消失。
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');

const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '127.0.0.1';
const COOKIE = 'cf_sid';
const BODY_LIMIT = 512 * 1024;

const DEFAULT_SETTINGS = { accent: '#0f6b4f', webhookUrl: '', notifyEmail: '' };

// 有 Supabase 設定就用雲端資料（免費主機的磁碟係臨時，一定要用）；否則用本機 JSON。
const SUPA_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPA_KEY = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '').trim();
const store =
  SUPA_URL && SUPA_KEY
    ? createSupabaseStore(SUPA_URL, SUPA_KEY, process.env.SUPABASE_TABLE || 'site_kv')
    : createStore(DATA_DIR);
const storageMode = store.mode;
const startedAt = Date.now();

await store.init();

/* ---------------- 啟動初始化 ---------------- */

function loadSecret() {
  const file = path.join(DATA_DIR, 'secret.key');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, { encoding: 'utf8', mode: 0o600 });
  return secret;
}

async function resolveSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (store.mode === 'supabase') {
    let secret = store.read('secret', null);
    if (!secret) {
      secret = crypto.randomBytes(32).toString('hex');
      await store.write('secret', secret);
    }
    return secret;
  }
  return loadSecret();
}

const SECRET = await resolveSecret();

async function ensureAuth() {
  const existing = store.read('auth', null);
  if (existing && existing.hash) return existing;

  const envPassword = process.env.ADMIN_PASSWORD;
  const password = envPassword || randomPassword(12);
  const record = { username: 'admin', ...hashPassword(password), updatedAt: new Date().toISOString() };
  await store.write('auth', record);

  if (envPassword) {
    console.log('  已使用環境變數 ADMIN_PASSWORD 作為管理員密碼。');
  } else if (store.mode === 'local') {
    const file = path.join(DATA_DIR, '管理員密碼.txt');
    fs.writeFileSync(
      file,
      `第一次登入密碼：${password}\n登入後請到「設定 → 帳戶安全」修改。\n（把本檔刪除，或記在你的密碼管理器。）\n`,
      'utf8',
    );
    console.log(`\n  首次登入密碼：${password}\n  已寫入：${file}\n  登入網址：http://${HOST}:${PORT}/admin\n`);
  } else {
    console.log(`\n  首次登入密碼：${password}（只會顯示一次，請即刻記低）\n`);
  }
  return record;
}

const auth = await ensureAuth();

if (store.read('content', null) === null) {
  await store.write('content', DEFAULT_CONTENT);
}
let content = sanitizeContent(store.read('content', DEFAULT_CONTENT));
let settings = { ...DEFAULT_SETTINGS, ...store.read('settings', {}) };
settings.accent = /^#[0-9a-fA-F]{6}$/.test(String(settings.accent)) ? settings.accent : DEFAULT_SETTINGS.accent;

/* ---------------- 工具 ---------------- */

function isHttps(req) {
  return (
    String(settings.siteUrl || '').startsWith('https://') ||
    req.headers['x-forwarded-proto'] === 'https' ||
    Boolean(req.socket?.encrypted)
  );
}

function securityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "base-uri 'none'",
    ].join('; '),
  );
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function sendHTML(res, status, html) {
  send(res, status, html, { 'Content-Type': 'text/html; charset=utf-8' });
}

function sendJSON(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
}

function redirect(res, location) {
  res.writeHead(303, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function notFound(res) {
  sendHTML(
    res,
    404,
    `<!doctype html><html lang="zh-Hant-HK"><meta charset="utf-8"><title>找不到頁面</title>
     <style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f6f3ed;color:#161a18}
     a{color:#0f6b4f}</style><div style="text-align:center"><h1>404</h1><p>找不到這個頁面。</p><a href="/">返回首頁</a></div></html>`,
  );
}

async function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(Object.assign(new Error('內容太大'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readBody(req) {
  const raw = await readRaw(req);
  if (!raw.length) return {};
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/json')) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return {};
    }
  }
  const params = new URLSearchParams(raw.toString('utf8'));
  return Object.fromEntries(params.entries());
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return verifySession(SECRET, cookies[COOKIE]);
}

function isAdmin(req) {
  return Boolean(getSession(req));
}

/** 檢查表單來源，擋掉跨站提交（配合 SameSite=Lax 已足夠，再加一層）。 */
function sameOrigin(req) {
  const host = req.headers.host;
  const origin = req.headers.origin;
  if (!origin) return true; // 同源表單不一定帶 Origin（老瀏覽器），靠 SameSite 把關
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function flashFrom(url) {
  return { ok: url.searchParams.get('m') || '', err: url.searchParams.get('e') || '' };
}

/* ---- 限流 ---- */
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) if (now > entry.reset) buckets.delete(key);
}, 60_000).unref();

/* ---- 查詢資料 ---- */
function loadInquiries() {
  const list = store.read('inquiries', []);
  return Array.isArray(list) ? list : [];
}

function computeCounts(list) {
  const now = Date.now();
  return {
    total: list.length,
    new: list.filter((i) => i.status === 'new').length,
    replied: list.filter((i) => i.status === 'replied').length,
    closed: list.filter((i) => i.status === 'closed').length,
    week: list.filter((i) => now - new Date(i.createdAt).getTime() < 7 * 864e5).length,
  };
}

function makeRef() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `INQ-${stamp}${rand}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateInquiry(input) {
  const errors = [];
  const data = {
    name: String(input.name || '').trim().slice(0, 80),
    company: String(input.company || '').trim().slice(0, 120),
    email: String(input.email || '').trim().slice(0, 160),
    phone: String(input.phone || '').trim().slice(0, 40),
    type: String(input.type || '').trim().slice(0, 40),
    budget: String(input.budget || '').trim().slice(0, 40),
    message: String(input.message || '').trim().slice(0, 2000),
  };

  if (data.name.length < 1) errors.push('請填姓名');
  if (!EMAIL_RE.test(data.email)) errors.push('請填有效的電郵');
  if (data.message.length < 10) errors.push('請簡單描述你的需求（至少 10 字）');
  if (String(input.website || '').trim()) errors.push('送出失敗');

  return { errors, data };
}

function deepMerge(base, patch) {
  if (patch === undefined) return base;
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) out[key] = deepMerge(out[key], value);
  return out;
}

async function notifyNewInquiry(inquiry) {
  console.log(`[查詢] ${inquiry.ref} ${inquiry.name} <${inquiry.email}> ${inquiry.type || ''}`);
  const url = String(settings.webhookUrl || '').trim();
  if (!url) return;
  const text = [
    `🔔 新查詢 ${inquiry.ref}`,
    `${inquiry.name}${inquiry.company ? `（${inquiry.company}）` : ''}`,
    `${inquiry.type || '一般查詢'} · ${inquiry.budget || '預算未定'}`,
    `電郵：${inquiry.email}${inquiry.phone ? ` · 電話：${inquiry.phone}` : ''}`,
    '',
    inquiry.message.slice(0, 500),
  ].join('\n');

  const payload = {
    text,
    msg_type: 'text',
    content: { text },
    inquiry: {
      ref: inquiry.ref,
      name: inquiry.name,
      email: inquiry.email,
      type: inquiry.type,
      message: inquiry.message,
      createdAt: inquiry.createdAt,
    },
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });
  } catch (err) {
    console.error('[webhook] 通知失敗：', err.message);
  }
}

/* ---------------- 靜態檔 ---------------- */

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  const name = decodeURIComponent(pathname.replace(/^\/assets\//, ''));
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return notFound(res);
  const file = path.join(PUBLIC_DIR, name);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return notFound(res);
  fs.readFile(file, (err, data) => {
    if (err) return notFound(res);
    const ext = path.extname(file).toLowerCase();
    send(res, 200, data, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=300',
    });
  });
}

/* ---------------- 路由 ---------------- */

async function handle(req, res) {
  securityHeaders(req, res);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;
  const method = req.method || 'GET';

  if (method === 'GET' || method === 'HEAD') {
    if (pathname === '/robots.txt') {
      const base = String(settings.siteUrl || '').replace(/\/$/, '');
      return send(
        res,
        200,
        `User-agent: *\nAllow: /\nDisallow: /admin\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`,
        { 'Content-Type': 'text/plain; charset=utf-8' },
      );
    }
    if (pathname === '/sitemap.xml') {
      const base = String(settings.siteUrl || '').replace(/\/$/, '');
      if (!base) return notFound(res);
      return send(
        res,
        200,
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(base)}/</loc></url><url><loc>${esc(base)}/privacy</loc></url></urlset>`,
        { 'Content-Type': 'application/xml; charset=utf-8' },
      );
    }
    if (pathname.startsWith('/assets/')) return serveStatic(req, res, pathname);
  }

  /* ---------- 公開頁面 ---------- */

  if (pathname === '/' && method === 'GET') {
    return sendHTML(res, 200, renderSite(content, { accent: settings.accent }));
  }

  if (pathname === '/privacy' && method === 'GET') {
    return sendHTML(res, 200, renderPrivacy(content));
  }

  if (pathname === '/track' && (method === 'GET' || method === 'POST')) {
    const params =
      method === 'GET' ? url.searchParams : new URLSearchParams((await readRaw(req)).toString('utf8'));
    const ref = String(params.get('ref') || params.get('r') || '').trim();
    const email = String(params.get('email') || '').trim();
    if (!ref && !email) return sendHTML(res, 200, renderTrack(content));
    const list = loadInquiries();
    const found = list.find(
      (i) =>
        String(i.ref).toUpperCase() === ref.toUpperCase() &&
        String(i.email).toLowerCase() === email.toLowerCase(),
    );
    if (!found) {
      return sendHTML(res, 404, renderTrack(content, { query: { ref, email }, error: '找不到符合的查詢，請確認編號與電郵是否正確。' }));
    }
    return sendHTML(res, 200, renderTrack(content, { query: { ref, email }, result: found }));
  }

  /* ---------- 公開 API：送出查詢 ---------- */

  if (pathname === '/api/inquiries' && method === 'POST') {
    if (!sameOrigin(req)) return sendJSON(res, 403, { ok: false, error: '來源不被允許' });
    const ip = clientIp(req);
    if (!rateLimit(`inq:${ip}`, 5, 10 * 60_000)) {
      return sendJSON(res, 429, { ok: false, error: '送出太頻繁，請稍後再試，或直接 WhatsApp 我們。' });
    }

    const body = await readBody(req);
    const { errors, data } = validateInquiry(body);
    if (errors.length) return sendJSON(res, 422, { ok: false, error: errors[0], errors });

    const inquiry = {
      id: crypto.randomUUID(),
      ref: makeRef(),
      ...data,
      status: 'new',
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ip,
      ua: String(req.headers['user-agent'] || '').slice(0, 300),
    };

    try {
      await store.update('inquiries', [], (list) => {
        list.unshift(inquiry);
        return list;
      });
    } catch (err) {
      console.error('[inquiry] 寫入失敗：', err.message);
      return sendJSON(res, 503, {
        ok: false,
        error: '暫時未能接收查詢，請稍後再試，或直接 WhatsApp 我們。',
      });
    }

    notifyNewInquiry(inquiry).catch(() => {});
    return sendJSON(res, 201, { ok: true, ref: inquiry.ref });
  }

  /* ---------- 後台登入 ---------- */

  if (pathname === '/admin/login' && method === 'GET') {
    if (isAdmin(req)) return redirect(res, '/admin');
    return sendHTML(res, 200, renderLogin({ notice: url.searchParams.get('m') || '', error: url.searchParams.get('e') || '' }));
  }

  if (pathname === '/admin/login' && method === 'POST') {
    const ip = clientIp(req);
    if (!rateLimit(`login:${ip}`, 8, 10 * 60_000)) {
      return sendHTML(res, 429, renderLogin({ error: '嘗試次數太多，請 10 分鐘後再試。' }));
    }
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (username !== auth.username || !verifyPassword(password, auth)) {
      return sendHTML(res, 401, renderLogin({ error: '帳號或密碼不正確。' }));
    }
    const token = createSession(SECRET, auth.username);
    res.setHeader('Set-Cookie', sessionCookie(token, isHttps(req)));
    return redirect(res, '/admin');
  }

  /* ---------- 後台頁面（需要登入） ---------- */

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!isAdmin(req)) {
      if (pathname.startsWith('/api/admin')) return sendJSON(res, 401, { ok: false, error: '請先登入' });
      return redirect(res, '/admin/login');
    }
    if (method !== 'GET' && !sameOrigin(req)) {
      if (pathname.startsWith('/api/admin')) return sendJSON(res, 403, { ok: false, error: '來源不被允許' });
      return redirect(res, '/admin?e=' + encodeURIComponent('來源不被允許'));
    }
  }

  if (pathname === '/admin/logout' && method === 'POST') {
    res.setHeader('Set-Cookie', clearCookie());
    return redirect(res, '/admin/login');
  }

  if (pathname === '/admin' && method === 'GET') {
    const list = loadInquiries();
    const counts = computeCounts(list);
    const uptimeMin = Math.floor((Date.now() - startedAt) / 60000);
    return sendHTML(
      res,
      200,
      adminLayout({
        active: 'dashboard',
        title: '總覽',
        counts,
        flash: flashFrom(url),
        body: renderDashboard({
          content,
          inquiries: list,
          counts,
          serverInfo: `已運行 ${uptimeMin} 分鐘 · Node ${process.version}`,
        }),
      }),
    );
  }

  if (pathname === '/admin/inquiries' && method === 'GET') {
    const list = loadInquiries();
    const counts = computeCounts(list);
    const status = ['new', 'replied', 'closed'].includes(url.searchParams.get('status'))
      ? url.searchParams.get('status')
      : 'all';
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    let filtered = status === 'all' ? list : list.filter((i) => i.status === status);
    if (q) {
      filtered = filtered.filter((i) =>
        [i.ref, i.name, i.company, i.email, i.phone, i.message]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return sendHTML(
      res,
      200,
      adminLayout({
        active: 'inquiries',
        title: '客戶查詢',
        counts,
        flash: flashFrom(url),
        body: renderInquiryList({ inquiries: filtered, counts, status, q }),
      }),
    );
  }

  if (pathname === '/admin/inquiries.csv' && method === 'GET') {
    const list = loadInquiries();
    const head = ['編號', '姓名', '公司', '電郵', '電話', '類型', '預算', '留言', '狀態', '送出時間', '回覆數'];
    const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = list.map((i) =>
      [
        i.ref,
        i.name,
        i.company,
        i.email,
        i.phone,
        i.type,
        i.budget,
        i.message,
        { new: '未處理', replied: '已回覆', closed: '已結案' }[i.status] || i.status,
        formatTime(i.createdAt),
        (i.replies || []).length,
      ]
        .map(escapeCell)
        .join(','),
    );
    const csv = '\uFEFF' + [head.map(escapeCell).join(','), ...rows].join('\r\n');
    return send(res, 200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }

  const detailMatch = pathname.match(/^\/admin\/inquiries\/([0-9a-fA-F-]{36})$/);
  if (detailMatch && method === 'GET') {
    const list = loadInquiries();
    const inquiry = list.find((i) => i.id === detailMatch[1]);
    if (!inquiry) return notFound(res);
    return sendHTML(
      res,
      200,
      adminLayout({
        active: 'inquiries',
        title: '查詢詳情',
        counts: computeCounts(list),
        flash: flashFrom(url),
        body: renderInquiryDetail({ inquiry }),
      }),
    );
  }

  const actionMatch = pathname.match(/^\/admin\/inquiries\/([0-9a-fA-F-]{36})\/(reply|status|delete)$/);
  if (actionMatch && method === 'POST') {
    const [, id, action] = actionMatch;
    const body = await readBody(req);
    let message = '';

    await store.update('inquiries', [], (list) => {
      const index = list.findIndex((i) => i.id === id);
      if (index === -1) return list;
      const item = list[index];

      if (action === 'reply') {
        const text = String(body.text || '').trim().slice(0, 4000);
        if (text.length >= 2) {
          item.replies = Array.isArray(item.replies) ? item.replies : [];
          item.replies.push({ text, at: new Date().toISOString() });
          item.status = 'replied';
          item.updatedAt = new Date().toISOString();
          message = '已送出回覆，客戶可在查詢進度頁看到。';
        }
      } else if (action === 'status') {
        const status = String(body.status || '');
        if (['new', 'replied', 'closed'].includes(status)) {
          item.status = status;
          item.updatedAt = new Date().toISOString();
          message = '狀態已更新。';
        }
      } else if (action === 'delete') {
        list.splice(index, 1);
        return list;
      }
      return list;
    });

    if (action === 'delete') return redirect(res, '/admin/inquiries?m=' + encodeURIComponent('已刪除查詢。'));
    return redirect(
      res,
      `/admin/inquiries/${id}?` + (message ? 'm=' + encodeURIComponent(message) : ''),
    );
  }

  /* ---------- 內容與設定 ---------- */

  if (pathname === '/admin/content' && method === 'GET') {
    return sendHTML(
      res,
      200,
      adminLayout({
        active: 'content',
        title: '網站內容',
        counts: computeCounts(loadInquiries()),
        flash: flashFrom(url),
        body: renderContentEditor(content),
      }),
    );
  }

  if (pathname === '/api/admin/content' && method === 'POST') {
    const body = await readBody(req);
    const patch = body && body.content ? body.content : body;
    const next = sanitizeContent(deepMerge(content, patch));
    try {
      const current = store.read('content', DEFAULT_CONTENT);
      fs.writeFileSync(path.join(DATA_DIR, 'content.backup.json'), JSON.stringify(current, null, 2), 'utf8');
    } catch {
      /* 備份失敗不影響儲存 */
    }
    try {
      await store.write('content', next);
    } catch (err) {
      console.error('[content] 儲存失敗：', err.message);
      return sendJSON(res, 503, { ok: false, error: '資料庫連線有問題，內容未儲存。請稍後再試。' });
    }
    content = next;
    return sendJSON(res, 200, { ok: true, savedAt: new Date().toISOString() });
  }

  if (pathname === '/admin/settings' && method === 'GET') {
    return sendHTML(
      res,
      200,
      adminLayout({
        active: 'settings',
        title: '設定',
        counts: computeCounts(loadInquiries()),
        flash: flashFrom(url),
        body: renderSettings({
          settings,
          passwordChangedAt: auth.updatedAt,
          siteUrl: settings.siteUrl || `http://${HOST}:${PORT}`,
          storage: { mode: storageMode, healthy: store.healthy, lastError: store.lastError },
        }),
      }),
    );
  }

  if (pathname === '/admin/settings' && method === 'POST') {
    const body = await readBody(req);
    const accent = String(body.accentText || body.accent || '').trim();
    settings = {
      ...settings,
      accent: /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : settings.accent,
      siteUrl: String(body.siteUrl || '').trim().slice(0, 200),
      webhookUrl: String(body.webhookUrl || '').trim().slice(0, 500),
      notifyEmail: String(body.notifyEmail || '').trim().slice(0, 160),
    };
    await store.write('settings', settings);
    return redirect(res, '/admin/settings?m=' + encodeURIComponent('設定已儲存。'));
  }

  if (pathname === '/admin/password' && method === 'POST') {
    const body = await readBody(req);
    const current = String(body.current || '');
    const next = String(body.next || '');
    const confirm = String(body.confirm || '');
    if (!verifyPassword(current, auth)) {
      return redirect(res, '/admin/settings?e=' + encodeURIComponent('目前密碼不正確。'));
    }
    if (next.length < 8) {
      return redirect(res, '/admin/settings?e=' + encodeURIComponent('新密碼至少 8 位。'));
    }
    if (next !== confirm) {
      return redirect(res, '/admin/settings?e=' + encodeURIComponent('兩次輸入的新密碼不一致。'));
    }
    const record = { username: auth.username, ...hashPassword(next), updatedAt: new Date().toISOString() };
    await store.write('auth', record);
    auth.hash = record.hash;
    auth.salt = record.salt;
    auth.updatedAt = record.updatedAt;
    try {
      fs.rmSync(path.join(DATA_DIR, '管理員密碼.txt'), { force: true });
    } catch {
      /* ignore */
    }
    const token = createSession(SECRET, auth.username);
    res.setHeader('Set-Cookie', sessionCookie(token, isHttps(req)));
    return redirect(res, '/admin/settings?m=' + encodeURIComponent('密碼已更新。'));
  }

  return notFound(res);
}

/* ---------------- 啟動 ---------------- */

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[server]', err);
    if (res.headersSent) return res.end();
    if (err.status === 413) return sendJSON(res, 413, { ok: false, error: '送出的內容太大。' });
    if (req.url?.startsWith('/api/')) return sendJSON(res, 500, { ok: false, error: '伺服器錯誤，請稍後再試。' });
    sendHTML(res, 500, '<h1>500</h1><p>伺服器發生錯誤。</p>');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  官網：http://${HOST}:${PORT}`);
  console.log(`  後台：http://${HOST}:${PORT}/admin`);
  console.log(`  儲存：${storageMode === 'supabase' ? 'Supabase 雲端 Postgres' : `本機檔案 ${DATA_DIR}`}`);
  console.log(`  監聽：${HOST}:${PORT}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
