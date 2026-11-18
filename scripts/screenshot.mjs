// 用 headless Edge/Chrome 截「電腦版 + 手機版」圖，方便給客人或存檔。
// 用法：node scripts/screenshot.mjs [網址]
// 預設網址 http://127.0.0.1:4321，輸出 shots/desktop.png 與 shots/mobile.png
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL_TARGET = process.argv[2] || 'http://127.0.0.1:4321/';
const OUT_DIR = path.join(process.cwd(), 'shots');
const PORT = 9444;

const EDGE =
  process.env.EDGE_PATH ||
  [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].find((p) => fs.existsSync(p));

if (!EDGE) {
  console.error('找不到 Edge 或 Chrome，請設定環境變數 EDGE_PATH。');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const profile = path.join(os.tmpdir(), `site-shot-${Date.now()}`);
const browser = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let page = null;
for (let i = 0; i < 60; i += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    page = list.find((t) => t.type === 'page');
    if (page) break;
  } catch {
    /* 等瀏覽器起身 */
  }
  await sleep(250);
}
if (!page) {
  browser.kill();
  console.error('瀏覽器沒有啟動成功。');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await new Promise((r) => (ws.onopen = r));
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

async function shot(name, width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  });
  await send('Page.navigate', { url: `${URL_TARGET}?shot=${Date.now()}` });
  await sleep(2600);
  const png = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(png.result.data, 'base64'));
  console.log(`✓ shots/${name}  (${width}×${height}${mobile ? ' 手機' : ' 電腦'})`);
}

await shot('desktop.png', 1440, 900, false);
await shot('mobile.png', 390, 844, true);

ws.close();
browser.kill();
console.log('完成。');
