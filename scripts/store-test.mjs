// 用一個假的 PostgREST 伺服器測試 Supabase 儲存層（不需要真帳號）：
//   node scripts/store-test.mjs
import http from 'node:http';
import { createSupabaseStore } from '../lib/store.js';

let pass = 0;
const fails = [];
function check(name, ok, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(name);
    console.log(`  ✗ ${name} ${extra}`);
  }
}

// ---- 模擬 PostgREST ----
const rows = new Map();
const requests = [];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const body = await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
  requests.push({ method: req.method, path: url.pathname, query: url.search, body, headers: req.headers });

  if (req.method === 'GET' && url.pathname === '/rest/v1/site_kv') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([...rows.entries()].map(([key, value]) => ({ key, value }))));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/rest/v1/site_kv') {
    const payload = JSON.parse(body || '[]');
    for (const row of payload) rows.set(row.key, row.value);
    res.writeHead(201);
    res.end();
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((r) => server.listen(4399, '127.0.0.1', r));
const base = 'http://127.0.0.1:4399';

console.log('\n  Supabase 儲存層測試\n');

const store = createSupabaseStore(base, 'test-service-key');
check('mode 是 supabase', store.mode === 'supabase');

await store.init();
check('init 連線成功', store.healthy === true);
check('init 有帶 apikey', requests[0]?.headers.apikey === 'test-service-key');
check('init 有帶 Authorization', requests[0]?.headers.authorization === 'Bearer test-service-key');

check('未寫入時回傳 fallback', JSON.stringify(store.read('nope', { a: 1 })) === '{"a":1}');

await store.write('content', { hero: { title: '測試' } });
check('寫入後可同步讀取', store.read('content', null)?.hero?.title === '測試');
check('已寫入假資料庫', rows.get('content')?.hero?.title === '測試');
check('寫入用 upsert（on_conflict=key）', requests.at(-1).query.includes('on_conflict=key'));
check('寫入用 merge-duplicates', String(requests.at(-1).headers.prefer).includes('resolution=merge-duplicates'));

const updated = await store.update('inquiries', [], (list) => {
  list.push({ ref: 'INQ-1' });
  return list;
});
check('update 回傳新值', updated.length === 1 && updated[0].ref === 'INQ-1');
check('update 已落地', rows.get('inquiries')?.length === 1);

// 重新建立 store（模擬 Render 重啟）→ 資料應該要還在
const store2 = createSupabaseStore(base, 'test-service-key');
await store2.init();
check('重啟後資料仍在（重點）', store2.read('inquiries', [])?.length === 1);
check('重啟後內容仍在', store2.read('content', null)?.hero?.title === '測試');

// 連錯網址：init 不應拋錯，但 healthy=false、寫入要報錯
const broken = createSupabaseStore('http://127.0.0.1:4398', 'k');
await broken.init();
check('連線失敗時 init 不拋錯', true);
check('連線失敗時 healthy=false', broken.healthy === false);
let threw = false;
try {
  await broken.write('x', 1);
} catch {
  threw = true;
}
check('連線失敗時寫入會報錯（不會假成功）', threw);

server.close();
console.log(`\n  結果：${pass} 通過${fails.length ? `，${fails.length} 失敗` : '，全部通過 ✓'}\n`);
if (fails.length) process.exitCode = 1;
