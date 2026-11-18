import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * 兩種儲存後端，介面一致：
 *   read(name, fallback)        同步，讀記憶體快取
 *   write(name, value)          async，寫入後端（本機：JSON 檔；雲端：Supabase）
 *   update(name, fallback, fn)  async，序列化的讀-改-寫
 *   init()                      async，啟動時載入資料
 *
 * 本機開發用 JSON 檔（零依賴）；上免費主機（Render/Koyeb 磁碟係臨時）時，
 * 設定 SUPABASE_URL + SUPABASE_SERVICE_KEY 就會改用 Supabase Postgres，
 * 重啟／重新部署都唔會唔見查詢。
 */

/* ---------------- 本機 JSON ---------------- */

export function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });

  const cache = new Map();
  const queues = new Map();

  const fileOf = (name) => path.join(dir, `${name}.json`);

  function read(name, fallback) {
    if (cache.has(name)) return cache.get(name);
    let value = fallback;
    try {
      const raw = fs.readFileSync(fileOf(name), 'utf8');
      value = raw.trim() ? JSON.parse(raw) : fallback;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`[store] 讀取 ${name} 失敗，使用預設值：`, err.message);
      }
    }
    cache.set(name, value);
    return value;
  }

  function writeFile(name, value) {
    const file = fileOf(name);
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  function write(name, value) {
    writeFile(name, value);
    cache.set(name, value);
    return Promise.resolve(value);
  }

  /** 序列化同一份資料的更新，避免競態。 */
  async function update(name, fallback, mutator) {
    const previous = queues.get(name) || Promise.resolve();
    const next = previous.then(async () => {
      const current = read(name, fallback);
      const result = await mutator(current);
      const value = result === undefined ? current : result;
      writeFile(name, value);
      cache.set(name, value);
      return value;
    });
    queues.set(
      name,
      next.catch(() => {}),
    );
    return next;
  }

  return {
    mode: 'local',
    healthy: true,
    lastError: null,
    async init() {},
    read,
    write,
    update,
    fileOf,
  };
}

/* ---------------- Supabase Postgres（REST） ---------------- */

export function createSupabaseStore(baseUrl, serviceKey, table = 'site_kv') {
  const base = String(baseUrl).replace(/\/+$/, '');
  const tableName = table || 'site_kv';
  const cache = new Map();

  let healthy = false;
  let lastError = null;
  let queue = Promise.resolve();

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  async function request(pathAndQuery, options = {}) {
    const res = await fetch(base + pathAndQuery, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Supabase ${res.status} ${detail.slice(0, 180)}`);
    }
    return res;
  }

  function read(name, fallback) {
    return cache.has(name) ? cache.get(name) : fallback;
  }

  async function init() {
    try {
      const res = await request(`/rest/v1/${tableName}?select=key,value`);
      const rows = await res.json();
      for (const row of rows) cache.set(row.key, row.value);
      healthy = true;
      console.log(`[store] Supabase 已連線（${tableName}），載入 ${rows.length} 筆資料`);
    } catch (err) {
      lastError = err.message;
      console.error('[store] Supabase 連線失敗：', err.message);
      console.error('[store] 網站仍可瀏覽，但表單／後台儲存會失敗，請檢查環境變數與 SQL 是否已建立。');
    }
  }

  function write(name, value) {
    cache.set(name, value);
    const run = async () => {
      try {
        await request(`/rest/v1/${tableName}?on_conflict=key`, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ key: name, value, updated_at: new Date().toISOString() }]),
        });
        healthy = true;
        lastError = null;
      } catch (err) {
        lastError = err.message;
        healthy = false;
        console.error('[store] 寫入 Supabase 失敗：', err.message);
        throw err;
      }
    };
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next.then(() => value);
  }

  async function update(name, fallback, mutator) {
    const current = read(name, fallback);
    const result = await mutator(current);
    const value = result === undefined ? current : result;
    await write(name, value);
    return value;
  }

  return {
    mode: 'supabase',
    get healthy() {
      return healthy;
    },
    get lastError() {
      return lastError;
    },
    init,
    read,
    write,
    update,
  };
}

/* ---------------- GitHub 私有資料分支（不需要額外資料庫帳號） ---------------- */

/**
 * 把整個資料集（內容、查詢、auth、secret）存成 repo 某個分支上的一個 JSON 檔。
 * Render 只會監聽 main，所以寫入 data 分支唔會觸發重新部署。
 * 每次寫入 = 一個 commit（有版本紀錄，誤刪可回溯）。
 */
export function createGithubStore({ owner, repo, token, branch = 'data', file = 'site-data.json' }) {
  const API = 'https://api.github.com';
  const filePath = `/repos/${owner}/${repo}/contents/${file}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'company-site-store',
    'Content-Type': 'application/json',
  };

  const cache = new Map();
  let sha = null;
  let healthy = false;
  let lastError = null;
  let queue = Promise.resolve();

  async function raw(pathname, options = {}) {
    return fetch(API + pathname, {
      ...options,
      headers,
      signal: AbortSignal.timeout(15000),
    });
  }

  async function ensureBranch() {
    const res = await raw(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    if (res.ok) return;
    if (res.status !== 404) throw new Error(`檢查分支失敗（${res.status}）`);
    const main = await raw(`/repos/${owner}/${repo}/git/ref/heads/main`);
    if (!main.ok) throw new Error(`讀取 main 分支失敗（${main.status}）`);
    const mainSha = (await main.json()).object.sha;
    const created = await raw(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainSha }),
    });
    if (!created.ok && created.status !== 422) {
      throw new Error(`建立 ${branch} 分支失敗（${created.status}）`);
    }
  }

  function snapshot() {
    return Object.fromEntries(cache);
  }

  async function load() {
    try {
      const res = await raw(`${filePath}?ref=${branch}`);
      if (res.status === 404) {
        await ensureBranch();
        healthy = true;
        console.log(`[store] GitHub 資料檔尚未建立，第一次寫入時會建立（${owner}/${repo}@${branch}）`);
        return;
      }
      if (!res.ok) throw new Error(`讀取資料失敗（${res.status}）`);
      const data = await res.json();
      const parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8') || '{}');
      for (const [key, value] of Object.entries(parsed)) cache.set(key, value);
      sha = data.sha;
      healthy = true;
      console.log(`[store] GitHub 資料已載入（${owner}/${repo}@${branch}，${Object.keys(parsed).length} 筆）`);
    } catch (err) {
      lastError = err.message;
      console.error('[store] GitHub 資料載入失敗：', err.message);
    }
  }

  async function push() {
    const body = {
      message: `data: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
      content: Buffer.from(JSON.stringify(snapshot(), null, 2)).toString('base64'),
      branch,
    };
    if (sha) body.sha = sha;

    let res = await raw(filePath, { method: 'PUT', body: JSON.stringify(body) });
    if (res.status === 409) {
      // sha 過期（例如另一個請求已更新），重新讀取再試一次
      const latest = await raw(`${filePath}?ref=${branch}`);
      if (latest.ok) sha = (await latest.json()).sha;
      body.sha = sha;
      res = await raw(filePath, { method: 'PUT', body: JSON.stringify(body) });
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`寫入 GitHub 失敗（${res.status}）${detail.slice(0, 120)}`);
    }
    const json = await res.json();
    sha = json.content.sha;
    healthy = true;
    lastError = null;
  }

  function read(name, fallback) {
    return cache.has(name) ? cache.get(name) : fallback;
  }

  function write(name, value) {
    cache.set(name, value);
    const run = async () => {
      try {
        await push();
      } catch (err) {
        lastError = err.message;
        healthy = false;
        console.error('[store] GitHub 寫入失敗：', err.message);
        throw err;
      }
    };
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next.then(() => value);
  }

  async function update(name, fallback, mutator) {
    const current = read(name, fallback);
    const result = await mutator(current);
    const value = result === undefined ? current : result;
    await write(name, value);
    return value;
  }

  return {
    mode: 'github',
    get healthy() {
      return healthy;
    },
    get lastError() {
      return lastError;
    },
    init: load,
    read,
    write,
    update,
  };
}
