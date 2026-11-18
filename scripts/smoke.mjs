// 端到端冒煙測試：node scripts/smoke.mjs（需先啟動 server.js）
// 會建一筆測試查詢、登入後台、改內容、回覆，最後清掉測試資料。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4321';

let pass = 0;
const fails = [];
function check(name, ok, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name} ${extra}`);
    console.log(`  ✗ ${name} ${extra}`);
  }
}

function readPassword() {
  if (process.env.SMOKE_PW) return process.env.SMOKE_PW;
  const file = path.join(ROOT, 'data', '管理員密碼.txt');
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/密碼：(\S+)/);
  return m ? m[1] : '';
}

const password = readPassword();
const testEmail = `smoke-${Date.now()}@example.com`;
let cookie = '';
let ref = '';
let inquiryId = '';

async function req(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  return fetch(BASE + pathname, { redirect: 'manual', ...options, headers });
}

console.log(`\n  測試對象：${BASE}\n`);

/* 1. 公開頁面 */
{
  const res = await req('/');
  const html = await res.text();
  check('首頁 200', res.status === 200, `(got ${res.status})`);
  check('首頁有品牌名', html.includes('嶼光整合營銷'));
  check('首頁有查詢表單', html.includes('id="inquiryForm"'));
  check('首頁有 CSP 標頭', Boolean(res.headers.get('content-security-policy')));
}

{
  const res = await req('/assets/site.css');
  check('CSS 200', res.status === 200 && (res.headers.get('content-type') || '').includes('text/css'));
}

{
  const res = await req('/privacy');
  check('私隱頁 200', res.status === 200);
}

/* 2. 送出查詢 */
{
  const res = await req('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '冒煙測試',
      company: '測試公司',
      email: testEmail,
      phone: '+852 9000 0000',
      type: '報價需求',
      budget: 'HK$50,000-100,000',
      message: '這是一筆自動測試查詢，用來確認表單、通知與後台流程正常。',
    }),
  });
  const json = await res.json();
  ref = json.ref || '';
  check('送出查詢 201', res.status === 201, `(got ${res.status})`);
  check('回傳查詢編號', /^INQ-[0-9A-Z]+$/.test(ref), `(ref=${ref})`);
}

{
  const res = await req('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x', email: 'not-an-email', message: '太短' }),
  });
  check('無效電郵被拒 422', res.status === 422, `(got ${res.status})`);
}

{
  const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'inquiries.json'), 'utf8'));
  const found = list.find((i) => i.ref === ref);
  inquiryId = found ? found.id : '';
  check('查詢已寫入資料檔', Boolean(inquiryId));
}

{
  const res = await req(`/track?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(testEmail)}`);
  const html = await res.text();
  check('客戶可查進度 200', res.status === 200);
  check('進度頁顯示留言', html.includes('自動測試查詢'));
}

/* 3. 登入 */
{
  const res = await req('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'admin', password: 'wrong-password' }),
  });
  check('錯密碼被拒 401', res.status === 401, `(got ${res.status})`);
}

{
  const res = await req('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'admin', password }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/cf_sid=([^;]+)/);
  cookie = m ? `cf_sid=${m[1]}` : '';
  check('登入成功 303', res.status === 303, `(got ${res.status})`);
  check('取得工作階段 Cookie', Boolean(cookie));
  check('Cookie 有 HttpOnly', /HttpOnly/i.test(setCookie));
}

{
  const res = await req('/admin');
  const html = await res.text();
  check('後台總覽 200', res.status === 200);
  check('總覽顯示最新查詢', html.includes('最新查詢'));
}

{
  const res = await req('/admin/content');
  const html = await res.text();
  check('內容編輯器 200', res.status === 200);
  check('編輯器有欄位', html.includes('editorRoot') && html.includes('data-key="hero"'));
}

{
  const res = await req('/admin/inquiries');
  const html = await res.text();
  check('查詢列表 200', res.status === 200);
  check('列表含測試查詢', html.includes(ref));
}

{
  const res = await req('/admin/inquiries.csv');
  const text = await res.text();
  check('CSV 匯出', res.status === 200 && text.includes(ref));
}

/* 4. 修改內容 */
{
  const original = await req('/');
  const originalHtml = await original.text();
  const res = await req('/api/admin/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: {
        hero: { title: '測試標題：內容可即時修改' },
      },
    }),
  });
  const json = await res.json();
  check('儲存內容 200', res.status === 200 && json.ok === true, `(got ${res.status})`);

  const after = await (await req('/')).text();
  check('官網即時反映新標題', after.includes('測試標題：內容可即時修改'));

  // 還原：重新讀取原始內容物件（只還原 hero.title）
  const originalTitle = (originalHtml.match(/<h1>([^<]+)<\/h1>/) || [])[1] || '讓好品牌，被更多人看見。';
  await req('/api/admin/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { hero: { title: originalTitle } } }),
  });
  check('內容可還原', (await (await req('/')).text()).includes(originalTitle));
}

/* 5. 回覆 */
{
  const res = await req(`/admin/inquiries/${inquiryId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text: '你好，這是自動測試的回覆內容。' }),
  });
  check('送出回覆 303', res.status === 303, `(got ${res.status})`);

  const track = await (await req(`/track?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(testEmail)}`)).text();
  check('客戶看到回覆', track.includes('自動測試的回覆內容'));
  check('狀態已回覆', track.includes('已回覆'));
}

/* 6. 未登入保護 */
{
  cookie = '';
  const res = await req('/admin');
  check('未登入導向登入頁', res.status === 303 && (res.headers.get('location') || '').includes('/admin/login'));
  const api = await req('/api/admin/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: {} }),
  });
  check('未登入不可改內容 401', api.status === 401, `(got ${api.status})`);
}

/* 7. 清理測試查詢（重新登入） */
{
  const res = await req('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'admin', password }),
  });
  const m = (res.headers.get('set-cookie') || '').match(/cf_sid=([^;]+)/);
  cookie = m ? `cf_sid=${m[1]}` : '';
  const del = await req(`/admin/inquiries/${inquiryId}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({}),
  });
  check('刪除測試查詢', del.status === 303);
  const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'inquiries.json'), 'utf8'));
  check('資料檔已無測試查詢', !list.some((i) => i.ref === ref));
}

console.log(`\n  結果：${pass} 通過${fails.length ? `，${fails.length} 失敗` : '，全部通過 ✓'}\n`);
if (fails.length) {
  console.log('  失敗項目：');
  for (const f of fails) console.log(`   - ${f}`);
  process.exitCode = 1;
}
