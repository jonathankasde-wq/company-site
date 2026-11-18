// 忘記密碼時執行：node scripts/reset-password.js
// 會產生一組新密碼、寫入 data/auth.json，並印在畫面上。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, randomPassword } from '../lib/session.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const authFile = path.join(DATA, 'auth.json');

fs.mkdirSync(DATA, { recursive: true });

let username = 'admin';
try {
  const existing = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  if (existing.username) username = existing.username;
} catch {
  /* 沒有舊檔就用預設 */
}

const password = randomPassword(12);
const record = { username, ...hashPassword(password), updatedAt: new Date().toISOString() };
fs.writeFileSync(authFile, JSON.stringify(record, null, 2), 'utf8');
try {
  fs.rmSync(path.join(DATA, '管理員密碼.txt'), { force: true });
  fs.writeFileSync(
    path.join(DATA, '管理員密碼.txt'),
    `重設後密碼：${password}\n登入：http://127.0.0.1:4321/admin\n登入後請到「設定 → 帳戶安全」修改。\n`,
    'utf8',
  );
} catch {
  /* ignore */
}

console.log(`\n  帳號：${username}\n  新密碼：${password}\n  已寫入 data/管理員密碼.txt\n  登入後請立即修改密碼。\n`);
