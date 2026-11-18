// 本機模擬 Supabase PostgREST，用來驗證雲端儲存流程（不需要真帳號）。
//   node scripts/mock-postgrest.mjs 4399
import http from 'node:http';

const port = Number(process.argv[2] || 4399);
const rows = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const body = await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
  const log = `${req.method} ${url.pathname}${url.search}`;

  if (url.pathname !== '/rest/v1/site_kv') {
    res.writeHead(404).end('not found');
    return;
  }
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([...rows.entries()].map(([key, value]) => ({ key, value }))));
    console.log('GET  ', log, '→', rows.size, 'rows');
    return;
  }
  if (req.method === 'POST') {
    try {
      for (const row of JSON.parse(body || '[]')) rows.set(row.key, row.value);
    } catch {
      res.writeHead(400).end('bad json');
      return;
    }
    res.writeHead(201).end();
    console.log('WRITE', log, '→', [...rows.keys()].join(','));
    return;
  }
  res.writeHead(405).end();
});

server.listen(port, '127.0.0.1', () => {
  console.log(`mock postgrest on http://127.0.0.1:${port}`);
});
