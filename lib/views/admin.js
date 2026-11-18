import { esc } from './html.js';
import { DEFAULT_CONTENT, SECTION_ORDER, labelFor } from '../content.js';
import { formatTime } from './site.js';

const NAV = [
  { key: 'dashboard', href: '/admin', label: '總覽', icon: '▦' },
  { key: 'content', href: '/admin/content', label: '網站內容', icon: '✎' },
  { key: 'inquiries', href: '/admin/inquiries', label: '客戶查詢', icon: '✉' },
  { key: 'settings', href: '/admin/settings', label: '設定', icon: '⚙' },
];

export function renderLogin({ error = '', notice = '' } = {}) {
  return `<!doctype html>
<html lang="zh-Hant-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>登入後台</title>
<link rel="stylesheet" href="/assets/admin.css">
</head>
<body class="login-body">
  <form class="login-card" method="post" action="/admin/login">
    <div class="login-mark">後台</div>
    <h1>管理員登入</h1>
    <p class="muted">修改網站內容、查看與回覆客戶查詢。</p>
    ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ''}
    ${notice ? `<div class="alert">${esc(notice)}</div>` : ''}
    <label class="f"><span>帳號</span><input name="username" value="admin" autocomplete="username" required></label>
    <label class="f"><span>密碼</span><input name="password" type="password" autocomplete="current-password" required autofocus></label>
    <button class="btn btn-block" type="submit">登入</button>
    <p class="login-hint">忘記密碼：在專案資料夾執行 <code>node scripts/reset-password.js</code></p>
  </form>
</body>
</html>`;
}

export function adminLayout({ active, title, body, counts = {}, flash = null }) {
  const nav = NAV.map((item) => {
    const badge =
      item.key === 'inquiries' && counts.new > 0 ? `<span class="nav-badge">${counts.new}</span>` : '';
    return `<a class="side-link ${active === item.key ? 'is-active' : ''}" href="${item.href}">
      <i aria-hidden="true">${item.icon}</i><span>${item.label}</span>${badge}</a>`;
  }).join('');

  return `<!doctype html>
<html lang="zh-Hant-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}｜後台</title>
<link rel="stylesheet" href="/assets/admin.css">
</head>
<body class="admin-body">
  <aside class="side">
    <a class="side-brand" href="/admin"><b>管理後台</b><span>網站內容與客戶查詢</span></a>
    <nav class="side-nav">${nav}</nav>
    <div class="side-foot">
      <a class="side-link" href="/" target="_blank" rel="noopener"><i aria-hidden="true">↗</i><span>查看網站</span></a>
      <form method="post" action="/admin/logout"><button class="side-link side-logout" type="submit"><i aria-hidden="true">⏻</i><span>登出</span></button></form>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <button class="menu-btn" id="menuBtn" type="button" aria-label="開啟選單">☰</button>
      <h1>${esc(title)}</h1>
      ${active === 'inquiries' ? '<a class="btn btn-sm" href="/admin/inquiries.csv">匯出 CSV</a>' : ''}
      ${active === 'content' ? '<a class="btn btn-sm" href="/" target="_blank" rel="noopener">預覽網站</a>' : ''}
    </header>
    ${flash?.ok ? `<div class="flash flash-ok">${esc(flash.ok)}</div>` : ''}
    ${flash?.err ? `<div class="flash flash-err">${esc(flash.err)}</div>` : ''}
    <div class="content">${body}</div>
  </div>
  <script src="/assets/admin.js" defer></script>
</body>
</html>`;
}

export function renderDashboard({ content, inquiries, counts, serverInfo }) {
  const recent = inquiries.slice(0, 6);
  const rows = recent.length
    ? recent
        .map(
          (q) => `<tr>
        <td><a class="mono" href="/admin/inquiries/${esc(q.id)}">${esc(q.ref)}</a></td>
        <td>${esc(q.name)}${q.company ? `<small>${esc(q.company)}</small>` : ''}</td>
        <td>${esc(q.type || '-')}</td>
        <td class="clip">${esc(q.message)}</td>
        <td>${esc(formatTime(q.createdAt))}</td>
        <td><span class="badge badge-${esc(q.status)}">${statusLabel(q.status)}</span></td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="empty">還沒有查詢。客戶在官網填表後會出現在這裡。</td></tr>';

  return `
  <div class="stat-grid">
    <div class="stat-card"><span>新查詢（未處理）</span><b>${counts.new}</b><a href="/admin/inquiries?status=new">去處理 →</a></div>
    <div class="stat-card"><span>本週新查詢</span><b>${counts.week}</b><small>過去 7 日</small></div>
    <div class="stat-card"><span>累計查詢</span><b>${counts.total}</b><small>已回覆 ${counts.replied} · 已結案 ${counts.closed}</small></div>
    <div class="stat-card"><span>網站狀態</span><b class="ok">運作中</b><small>${esc(serverInfo)}</small></div>
  </div>

  <section class="panel">
    <div class="panel-head"><h2>最新查詢</h2><a href="/admin/inquiries">查看全部 →</a></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>編號</th><th>客戶</th><th>類型</th><th>內容</th><th>時間</th><th>狀態</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>

  <div class="two-col">
    <section class="panel">
      <div class="panel-head"><h2>快速上手</h2></div>
      <ol class="tips">
        <li><b>改網站文字</b>：去「網站內容」，像填表一樣改完按儲存，官網即時更新。</li>
        <li><b>回覆查詢</b>：點查詢編號看詳情，寫回覆後客戶可在「查詢進度」頁看到。</li>
        <li><b>換主色</b>：去「設定」改主題色，全站按鈕與重點色會跟著變。</li>
        <li><b>通知</b>：在「設定」填 Webhook（Slack / 飛書 / Telegram 中轉），有新查詢即時通知。</li>
      </ol>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>內容概覽</h2></div>
      <ul class="mini-list">
        <li><span>服務項目</span><b>${content.services.items.length} 項</b></li>
        <li><span>合作案例</span><b>${content.cases.items.length} 個</b></li>
        <li><span>流程步驟</span><b>${content.process.steps.length} 步</b></li>
        <li><span>常見問題</span><b>${content.faq.items.length} 條</b></li>
        <li><span>導航連結</span><b>${content.navLinks.length} 個</b></li>
      </ul>
      <p class="hint">所有上述內容都可在「網站內容」即時編輯，不需要寫程式。</p>
    </section>
  </div>`;
}

/* ---------- 內容編輯器 ---------- */

function isLongString(value) {
  return typeof value === 'string' && (value.length > 90 || value.includes('\n'));
}

function fieldHTML(key, value) {
  const label = esc(labelFor(key));
  if (isLongString(value)) {
    return `<label class="f" data-field="1" data-key="${esc(key)}"><span>${label}</span>
      <textarea rows="${Math.min(10, Math.max(3, Math.ceil(value.length / 60)))}" maxlength="4000">${esc(value)}</textarea></label>`;
  }
  const type = key === 'email' ? 'email' : 'text';
  return `<label class="f" data-field="1" data-key="${esc(key)}"><span>${label}</span>
    <input type="${type}" value="${esc(value)}" maxlength="4000"></label>`;
}

function linesHTML(key, arr) {
  return `<label class="f" data-lines="1" data-key="${esc(key)}"><span>${esc(labelFor(key))}</span>
    <textarea rows="${Math.min(8, Math.max(2, arr.length + 1))}">${esc((arr || []).join('\n'))}</textarea></label>`;
}

function blankOf(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) out[k] = [];
    else if (v && typeof v === 'object') out[k] = blankOf(v);
    else out[k] = '';
  }
  return out;
}

function itemHTML(obj, index) {
  const inner = Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) return linesHTML(k, v);
      if (v && typeof v === 'object') return groupHTML(k, v, true);
      return fieldHTML(k, v);
    })
    .join('');
  return `<div class="item" data-item="1">
    <div class="item-head"><b>項目 <span class="no">${index + 1}</span></b>
      <div class="item-tools">
        <button type="button" class="icon-btn" data-move="-1" title="上移">↑</button>
        <button type="button" class="icon-btn" data-move="1" title="下移">↓</button>
        <button type="button" class="icon-btn danger" data-remove="1" title="移除">✕</button>
      </div>
    </div>
    <div class="fields">${inner}</div>
  </div>`;
}

function groupHTML(key, obj, nested = false) {
  const inner = Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) return linesHTML(k, v);
      if (v && typeof v === 'object') return groupHTML(k, v, true);
      return fieldHTML(k, v);
    })
    .join('');
  if (nested) {
    return `<div class="group" data-group="1" data-key="${esc(key)}"><h3>${esc(labelFor(key))}</h3>${inner}</div>`;
  }
  return inner;
}

function listHTML(sectionKey, key, arr) {
  const items = arr.map((item, i) => itemHTML(item, i)).join('');
  const blank = itemHTML(blankOf(arr[0] || {}), 0);
  const addLabel = sectionKey === 'navLinks' || sectionKey === 'links' ? '新增連結' : '新增一項';
  return `<div class="list" data-list="1" data-key="${esc(key)}">
    <div class="list-head"><span>${esc(labelFor(key))}</span><small>${arr.length} 項，可新增、排序、刪除</small></div>
    ${items}
    <button type="button" class="add-btn" data-add="1">＋ ${addLabel}</button>
    <template>${blank}</template>
  </div>`;
}

function renderSection(key, value) {
  let body = '';
  const isArray = Array.isArray(value);
  if (isArray) {
    body = listHTML('root', key, value);
  } else if (value && typeof value === 'object') {
    body = Object.entries(value)
      .map(([k, v]) => {
        if (Array.isArray(v)) return listHTML(key, k, v);
        if (v && typeof v === 'object') return groupHTML(k, v, true);
        return fieldHTML(k, v);
      })
      .join('');
  } else {
    body = fieldHTML(key, value);
  }
  return `<section class="card" data-group="1"${isArray ? '' : ` data-key="${esc(key)}"`}>
    <header class="card-head"><h2>${esc(sectionLabelOf(key))}</h2><code>${esc(key)}</code></header>
    <div class="fields">${body}</div>
  </section>`;
}

function sectionLabelOf(key) {
  const map = {
    brand: '品牌資料',
    navLinks: '導航選單',
    hero: '首頁主視覺',
    services: '服務項目',
    process: '合作流程',
    cases: '合作案例',
    about: '關於我們',
    faq: '常見問題',
    contact: '聯絡與查詢表單',
    footer: '頁尾',
    privacy: '私隱政策頁',
    seo: '搜尋引擎資料（Google 標題與描述）',
  };
  return map[key] || key;
}

export function renderContentEditor(content) {
  const sections = SECTION_ORDER.map((key) => renderSection(key, content[key])).join('');
  return `<form id="contentForm">
    <div class="editor-intro panel">
      <h2>直接改，即時生效</h2>
      <p>這裡的欄位對應官網上的文字。改完按右下角「儲存並發佈」，重新整理官網就會看到。刪除的項目會即時消失；不確定就先改幾個字試試。</p>
      <p class="hint">小提示：\`要點\`、\`標籤\` 這類欄位是「每行一項」；空的列表區塊可以按「＋ 新增一項」加回來。</p>
    </div>
    <div id="editorRoot" data-root="1">${sections}</div>
    <div class="savebar">
      <span id="saveState">未變更</span>
      <div class="savebar-actions">
        <button type="button" class="btn btn-ghost" id="resetReload">放棄變更</button>
        <button type="submit" class="btn" id="saveBtn">儲存並發佈</button>
      </div>
    </div>
  </form>`;
}

/* ---------- 查詢 ---------- */

export function statusLabel(status) {
  return { new: '未處理', replied: '已回覆', closed: '已結案' }[status] || status;
}

export function renderInquiryList({ inquiries, counts, status = 'all', q = '' }) {
  const tabs = [
    { key: 'all', label: '全部', n: counts.total },
    { key: 'new', label: '未處理', n: counts.new },
    { key: 'replied', label: '已回覆', n: counts.replied },
    { key: 'closed', label: '已結案', n: counts.closed },
  ]
    .map(
      (t) =>
        `<a class="tab ${status === t.key ? 'is-active' : ''}" href="/admin/inquiries?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ''}">${t.label} <span>${t.n}</span></a>`,
    )
    .join('');

  const rows = inquiries.length
    ? inquiries
        .map(
          (i) => `<tr class="${i.status === 'new' ? 'row-new' : ''}">
        <td><a class="mono" href="/admin/inquiries/${esc(i.id)}">${esc(i.ref)}</a></td>
        <td><a href="/admin/inquiries/${esc(i.id)}">${esc(i.name)}</a>${i.company ? `<small>${esc(i.company)}</small>` : ''}</td>
        <td>${esc(i.email)}</td>
        <td>${esc(i.type || '-')}</td>
        <td class="clip">${esc(i.message)}</td>
        <td>${esc(formatTime(i.createdAt))}</td>
        <td><span class="badge badge-${esc(i.status)}">${statusLabel(i.status)}</span></td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="7" class="empty">${q ? '找不到符合的查詢。' : '暫時沒有查詢。'}</td></tr>`;

  return `
  <div class="toolbar">
    <div class="tabs">${tabs}</div>
    <form class="search" method="get" action="/admin/inquiries">
      <input type="hidden" name="status" value="${esc(status)}">
      <input name="q" value="${esc(q)}" placeholder="搜尋姓名、電郵、編號…">
      <button class="btn btn-sm" type="submit">搜尋</button>
    </form>
  </div>
  <div class="panel">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>編號</th><th>客戶</th><th>電郵</th><th>類型</th><th>內容</th><th>時間</th><th>狀態</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

export function renderInquiryDetail({ inquiry }) {
  const replies = (inquiry.replies || [])
    .map(
      (r) => `<li class="reply">
        <div class="reply-head"><b>你的回覆</b><span>${esc(formatTime(r.at))}</span></div>
        <p>${esc(r.text)}</p>
      </li>`,
    )
    .join('');

  return `
  <div class="detail-top">
    <a class="back" href="/admin/inquiries">← 返回查詢列表</a>
    <div class="detail-actions">
      <a class="btn btn-ghost btn-sm" href="/track?ref=${encodeURIComponent(inquiry.ref)}&email=${encodeURIComponent(inquiry.email)}" target="_blank" rel="noopener">客戶視角</a>
    </div>
  </div>

  <div class="detail-grid">
    <div>
      <section class="panel">
        <div class="detail-head">
          <div><span class="kicker">查詢編號</span><h2 class="mono">${esc(inquiry.ref)}</h2></div>
          <span class="badge badge-${esc(inquiry.status)}">${statusLabel(inquiry.status)}</span>
        </div>
        <dl class="meta-grid">
          <div><dt>姓名</dt><dd>${esc(inquiry.name)}</dd></div>
          <div><dt>公司</dt><dd>${esc(inquiry.company || '—')}</dd></div>
          <div><dt>電郵</dt><dd><a href="mailto:${esc(inquiry.email)}">${esc(inquiry.email)}</a></dd></div>
          <div><dt>電話</dt><dd>${esc(inquiry.phone || '—')}</dd></div>
          <div><dt>類型</dt><dd>${esc(inquiry.type || '—')}</dd></div>
          <div><dt>預算</dt><dd>${esc(inquiry.budget || '—')}</dd></div>
          <div><dt>送出時間</dt><dd>${esc(formatTime(inquiry.createdAt))}</dd></div>
          <div><dt>來源 IP</dt><dd class="mono">${esc(inquiry.ip || '—')}</dd></div>
        </dl>
        <div class="message-box"><span class="kicker">客戶留言</span><p>${esc(inquiry.message)}</p></div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>回覆</h2><span class="hint">回覆後客戶可在「查詢進度」頁看到</span></div>
        ${replies ? `<ul class="replies">${replies}</ul>` : '<p class="muted">尚未回覆。</p>'}
        <form class="reply-form" method="post" action="/admin/inquiries/${esc(inquiry.id)}/reply">
          <label class="f"><span>回覆內容</span><textarea name="text" rows="5" required minlength="2" maxlength="4000" placeholder="例如：你好，多謝查詢。我們下星期二下午可以安排 30 分鐘視像會議，方便嗎？"></textarea></label>
          <div class="reply-actions">
            <button class="btn" type="submit">送出回覆</button>
            <a class="btn btn-ghost" href="mailto:${esc(inquiry.email)}?subject=${encodeURIComponent(`回覆你的查詢 ${inquiry.ref}`)}">用電郵回覆</a>
            ${inquiry.phone ? `<a class="btn btn-ghost" href="https://wa.me/${esc(String(inquiry.phone).replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          </div>
        </form>
      </section>
    </div>

    <aside>
      <section class="panel">
        <div class="panel-head"><h2>狀態</h2></div>
        <div class="status-actions">
          ${['new', 'replied', 'closed']
            .map(
              (s) => `<form method="post" action="/admin/inquiries/${esc(inquiry.id)}/status">
                <input type="hidden" name="status" value="${s}">
                <button class="btn btn-sm ${inquiry.status === s ? '' : 'btn-ghost'}" type="submit" ${inquiry.status === s ? 'disabled' : ''}>${statusLabel(s)}</button>
              </form>`,
            )
            .join('')}
        </div>
        <hr>
        <form method="post" action="/admin/inquiries/${esc(inquiry.id)}/delete" onsubmit="return confirm('確定刪除這筆查詢？此動作不可復原。')">
          <button class="btn btn-sm btn-danger" type="submit">刪除查詢</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>跟進提示</h2></div>
        <ul class="tips small">
          <li>48 小時內回覆，成交率高很多。</li>
          <li>回覆時給出具體下一步（時間、會議、報價範圍）。</li>
          <li>完成後把狀態設為「已結案」，列表就不會擋住新查詢。</li>
        </ul>
      </section>
    </aside>
  </div>`;
}

export function renderSettings({ settings, passwordChangedAt, siteUrl, storage = { mode: 'local' } }) {
  const isCloud = storage.mode === 'supabase';
  const storageBadge = isCloud
    ? `<span class="badge badge-replied">Supabase 雲端</span>`
    : `<span class="badge badge-new">本機檔案</span>`;
  const storageWarning =
    !isCloud && process.env.NODE_ENV === 'production'
      ? '<p class="hint warn">目前用本機檔案儲存，免費主機（Render/Koyeb）重啟或重新部署會清空資料。請設定 SUPABASE_URL 與 SUPABASE_SERVICE_KEY。</p>'
      : isCloud && storage.healthy === false
        ? `<p class="hint warn">雲端資料庫連線異常：${esc(storage.lastError || '未知錯誤')}</p>`
        : '';

  return `
  <div class="two-col settings">
    <section class="panel">
      <div class="panel-head"><h2>網站設定</h2></div>
      <form method="post" action="/admin/settings" class="stack">
        <label class="f"><span>主題色（全站按鈕與重點色）</span>
          <span class="color-row"><input type="color" name="accent" value="${esc(settings.accent)}"><input name="accentText" value="${esc(settings.accent)}" pattern="^#[0-9a-fA-F]{6}$" maxlength="7"></span>
        </label>
        <label class="f"><span>網站網址（用於通知與分享連結）</span><input name="siteUrl" value="${esc(siteUrl)}" placeholder="https://www.example.com"></label>
        <label class="f"><span>新查詢通知 Webhook（可留空）</span><input name="webhookUrl" value="${esc(settings.webhookUrl || '')}" placeholder="https://hooks.slack.com/services/…">
          <small>支援 Slack、飛書、Discord、n8n / Zapier 等自訂 Webhook：新查詢時會 POST 一段 JSON。</small>
        </label>
        <label class="f"><span>通知電郵（可留空）</span><input name="notifyEmail" type="email" value="${esc(settings.notifyEmail || '')}" placeholder="boss@example.com">
          <small>只在有設定 SMTP 時才會寄出；目前先記錄在後台。</small>
        </label>
        <button class="btn" type="submit">儲存設定</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>帳戶安全</h2></div>
      <form method="post" action="/admin/password" class="stack">
        <label class="f"><span>目前密碼</span><input name="current" type="password" autocomplete="current-password" required></label>
        <label class="f"><span>新密碼（至少 8 位）</span><input name="next" type="password" autocomplete="new-password" minlength="8" required></label>
        <label class="f"><span>再輸入新密碼</span><input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label>
        <button class="btn" type="submit">更新密碼</button>
        ${passwordChangedAt ? `<p class="hint">上次更新：${esc(formatTime(passwordChangedAt))}</p>` : ''}
      </form>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>資料與備份</h2>${storageBadge}</div>
      ${
        isCloud
          ? `<ul class="mini-list">
        <li><span>內容</span><code>Supabase · site_kv / content</code></li>
        <li><span>查詢紀錄</span><code>Supabase · site_kv / inquiries</code></li>
        <li><span>登入密碼</span><code>Supabase · site_kv / auth</code></li>
      </ul>
      <p class="hint">資料存在雲端 Postgres，重新部署或重啟都唔會消失。備份可在 Supabase → Database → Backups 或匯出 SQL。</p>`
          : `<ul class="mini-list">
        <li><span>內容</span><code>data/content.json</code></li>
        <li><span>查詢紀錄</span><code>data/inquiries.json</code></li>
        <li><span>登入密碼</span><code>data/auth.json</code></li>
      </ul>
      <p class="hint">備份方法：把整個 <code>data</code> 資料夾複製一份即可（建議每週一次，或交給我們設自動備份）。</p>`
      }
      ${storageWarning}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>下一步可以做什麼</h2></div>
      <ul class="tips small">
        <li>上線：把專案放上主機，配域名與 HTTPS（詳見 README）。</li>
        <li>加 SMTP：回覆查詢時直接寄出電郵。</li>
        <li>加驗證碼：公開上線後可接 Cloudflare Turnstile 擋機器人。</li>
        <li>加分析：導入 GA4 / Plausible 看哪些內容帶來查詢。</li>
      </ul>
    </section>
  </div>`;
}

export function defaultContentForPreview() {
  return DEFAULT_CONTENT;
}
