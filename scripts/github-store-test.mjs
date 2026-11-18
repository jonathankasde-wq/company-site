// 用假的 GitHub API 測試「GitHub 資料分支」儲存層：
//   node scripts/github-store-test.mjs
import http from 'node:http';
import { createGithubStore } from '../lib/store.js';

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

const state = {
  branch: null, // data 分支是否存在
  file: null, // { content: base64, sha }
  shaSeq: 1,
  requests: [],
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const body = await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
  state.requests.push({ method: req.method, path: url.pathname, query: url.search, body });

  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (url.pathname === '/repos/o/r/git/ref/heads/main') {
    return json(200, { object: { sha: 'main-sha' } });
  }
  if (url.pathname === '/repos/o/r/git/ref/heads/data') {
    return state.branch ? json(200, { object: { sha: 'data-sha' } }) : json(404, { message: 'Not Found' });
  }
  if (url.pathname === '/repos/o/r/git/refs' && req.method === 'POST') {
    state.branch = 'data';
    return json(201, { ref: 'refs/heads/data' });
  }
  if (url.pathname === '/repos/o/r/contents/site-data.json') {
    if (req.method === 'GET') {
      if (!state.file) return json(404, { message: 'Not Found' });
      return json(200, { content: state.file.content, sha: state.file.sha, type: 'file' });
    }
    if (req.method === 'PUT') {
      const payload = JSON.parse(body || '{}');
      if (state.file && payload.sha !== state.file.sha) return json(409, { message: 'sha does not match' });
      state.shaSeq += 1;
      state.file = {
        content: payload.content,
        sha: `sha-${state.shaSeq}`,
      };
      return json(201, { content: { sha: state.file.sha } });
    }
  }
  json(404, { message: 'Not Found' });
});

await new Promise((r) => server.listen(4398, '127.0.0.1', r));
const API = 'http://127.0.0.1:4398';

// 讓 store 指向本機 mock：覆寫 fetch 的 base
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = String(input).replace('https://api.github.com', API);
  return realFetch(url, init);
};

console.log('\n  GitHub 資料分支儲存層測試\n');

const store = createGithubStore({ owner: 'o', repo: 'r', token: 'x', branch: 'data' });
await store.init();
check('init 成功（空資料）', store.healthy === true);
check('自動建立 data 分支', state.branch === 'data');

await store.write('content', { hero: { title: '測試標題' } });
check('寫入後可同步讀取', store.read('content', null)?.hero?.title === '測試標題');
check('資料已寫入 mock 檔案', Boolean(state.file));
check('寫入用 base64 內容', typeof state.file.content === 'string' && state.file.content.length > 0);
check('有保存 sha', /^sha-\d+$/.test(state.file.sha));

const list = await store.update('inquiries', [], (arr) => {
  arr.push({ ref: 'INQ-1' });
  return arr;
});
check('update 回傳新值', list.length === 1);
check('update 後檔案已更新', state.shaSeq >= 3);

// 模擬 Render 重啟：重新建立 store，應由 GitHub 載入
const store2 = createGithubStore({ owner: 'o', repo: 'r', token: 'x', branch: 'data' });
await store2.init();
check('重啟後內容仍在（重點）', store2.read('content', null)?.hero?.title === '測試標題');
check('重啟後查詢仍在', store2.read('inquiries', [])?.length === 1);

// 連唔到時：healthy=false，寫入要報錯
const broken = createGithubStore({ owner: 'o', repo: 'missing', token: 'x', branch: 'data' });
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

globalThis.fetch = realFetch;
server.close();
console.log(`\n  結果：${pass} 通過${fails.length ? `，${fails.length} 失敗` : '，全部通過 ✓'}\n`);
if (fails.length) process.exitCode = 1;
