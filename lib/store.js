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
