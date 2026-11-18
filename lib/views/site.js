import { esc } from './html.js';

const ICONS = {
  spark: '<path d="M12 2l2.2 6.1L20 10l-5.1 3.4L16 20l-4-3.4L8 20l1.1-6.6L4 10l5.8-1.9L12 2z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.6-3h4.8L16 7"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/>',
};

function icon(name) {
  const path = ICONS[name] || ICONS.spark;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const SERVICE_ICONS = ['compass', 'layers', 'chart', 'camera'];

export function renderSite(content, opts = {}) {
  const { accent = '#0f6b4f', inquiryRef = null, adminUrl = '/admin' } = opts;
  const c = content;
  const nav = c.navLinks.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('');

  const services = c.services.items
    .map(
      (s, i) => `
      <article class="card service" data-reveal style="--d:${i * 60}ms">
        <div class="service-icon">${icon(SERVICE_ICONS[i % SERVICE_ICONS.length])}</div>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.desc)}</p>
        ${
          s.points?.length
            ? `<ul class="ticks">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
            : ''
        }
      </article>`,
    )
    .join('');

  const steps = c.process.steps
    .map(
      (s, i) => `
      <li class="step" data-reveal style="--d:${i * 70}ms">
        <span class="step-no">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.desc)}</p>
      </li>`,
    )
    .join('');

  const cases = c.cases.items
    .map(
      (k, i) => `
      <article class="case" data-reveal style="--d:${i * 60}ms">
        <div class="case-thumb" data-variant="${i % 4}">
          <span class="case-industry">${esc(k.industry)}</span>
          <span class="case-result">${esc(k.result)}</span>
        </div>
        <div class="case-body">
          <h3>${esc(k.name)}</h3>
          <p>${esc(k.desc)}</p>
          <ul class="tags">${(k.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
      </article>`,
    )
    .join('');

  const values = c.about.values
    .map(
      (v, i) => `
      <li data-reveal style="--d:${i * 60}ms"><strong>${esc(v.title)}</strong><span>${esc(v.desc)}</span></li>`,
    )
    .join('');

  const paragraphs = String(c.about.body || '')
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');

  const faq = c.faq.items
    .map(
      (f, i) => `
      <details class="faq-item" ${i === 0 ? 'open' : ''}>
        <summary>${esc(f.q)}</summary>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </details>`,
    )
    .join('');

  const stats = c.hero.stats
    .map(
      (s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`,
    )
    .join('');

  const typeOptions = (c.contact.types || [])
    .map((t) => `<option value="${esc(t)}">${esc(t)}</option>`)
    .join('');
  const budgetOptions =
    '<option value="">未確定 / 可商議</option>' +
    (c.contact.budgets || [])
      .map((b) => `<option value="${esc(b)}">${esc(b)}</option>`)
      .join('');

  const footerLinks = (c.footer.links || [])
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('');

  const wa = String(c.contact.whatsapp || '').replace(/\D/g, '');
  const waLink = wa ? `https://wa.me/${wa}` : '';

  return `<!doctype html>
<html lang="zh-Hant-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.seo.title)}</title>
<meta name="description" content="${esc(c.seo.description)}">
<meta property="og:title" content="${esc(c.seo.title)}">
<meta property="og:description" content="${esc(c.seo.description)}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${accent}"/><text x="32" y="43" font-size="32" font-family="Georgia,serif" fill="#fff" text-anchor="middle">${(c.brand.short || 'A').slice(0, 1)}</text></svg>`,
  )}">
<link rel="stylesheet" href="/assets/site.css">
<style>:root{--accent:${esc(accent)}}</style>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: c.brand.name,
    alternateName: c.brand.enName,
    slogan: c.brand.tagline,
    email: c.contact.email,
    telephone: c.contact.phone,
    address: { '@type': 'PostalAddress', streetAddress: c.contact.address },
  }).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#main">跳到主要內容</a>

<header class="nav" id="nav">
  <div class="wrap nav-inner">
    <a class="brand" href="/">
      <span class="brand-mark">${esc((c.brand.short || 'A').slice(0, 1))}</span>
      <span class="brand-text">
        <b>${esc(c.brand.name)}</b>
        <i>${esc(c.brand.enName)}</i>
      </span>
    </a>
    <nav class="nav-links" id="navLinks">${nav}</nav>
    <div class="nav-actions">
      <a class="btn btn-sm" href="${esc(c.hero.primaryHref || '#contact')}">${esc(c.hero.primaryCta)}</a>
      <button class="burger" id="burger" aria-label="開啟選單" aria-expanded="false"><span></span><span></span></button>
    </div>
  </div>
</header>

<main id="main">
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${esc(c.hero.eyebrow)}</p>
        <h1>${esc(c.hero.title)}</h1>
        <p class="lede">${esc(c.hero.subtitle)}</p>
        <div class="hero-actions">
          <a class="btn btn-lg" href="${esc(c.hero.primaryHref || '#contact')}">${esc(c.hero.primaryCta)} <span aria-hidden="true">→</span></a>
          <a class="btn btn-ghost btn-lg" href="${esc(c.hero.secondaryHref || '#cases')}">${esc(c.hero.secondaryCta)}</a>
        </div>
        <div class="stats">${stats}</div>
      </div>

      <div class="hero-visual" aria-hidden="true">
        <div class="showcase">
          <div class="sc-top"><span class="sc-dot"></span><span class="sc-dot"></span><span class="sc-dot"></span><em>品牌系統 / 2026</em></div>
          <div class="sc-block">
            <span class="sc-label">主色與輔色</span>
            <div class="swatches"><i style="--c:#123c2f"></i><i style="--c:#c8b9a0"></i><i style="--c:#f2ede4"></i><i style="--c:${esc(accent)}"></i></div>
          </div>
          <div class="sc-block sc-type">
            <span class="sc-label">字體層級</span>
            <b>品牌，是一種承諾。</b>
            <span>思源宋體 · Inter · 8pt 基準</span>
          </div>
          <div class="sc-block">
            <span class="sc-label">品牌一致性</span>
            <div class="bars"><i style="--h:38%"></i><i style="--h:56%"></i><i style="--h:47%"></i><i style="--h:72%"></i><i style="--h:64%"></i><i style="--h:88%"></i></div>
          </div>
          <div class="sc-foot"><span>專案進度</span><b>每週更新</b></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="services">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(c.services.eyebrow)}</p>
        <h2>${esc(c.services.title)}</h2>
        <p class="section-intro">${esc(c.services.intro)}</p>
      </div>
      <div class="grid grid-2">${services}</div>
    </div>
  </section>

  <section class="section section-dark" id="process">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(c.process.eyebrow)}</p>
        <h2>${esc(c.process.title)}</h2>
        <p class="section-intro">${esc(c.process.intro)}</p>
      </div>
      <ol class="steps">${steps}</ol>
    </div>
  </section>

  <section class="section" id="cases">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(c.cases.eyebrow)}</p>
        <h2>${esc(c.cases.title)}</h2>
        <p class="section-intro">${esc(c.cases.intro)}</p>
      </div>
      <div class="grid grid-2 cases">${cases}</div>
    </div>
  </section>

  <section class="section section-paper" id="about">
    <div class="wrap about-grid">
      <div class="about-copy" data-reveal>
        <p class="eyebrow">${esc(c.about.eyebrow)}</p>
        <h2>${esc(c.about.title)}</h2>
        ${paragraphs}
      </div>
      <ul class="values">${values}</ul>
    </div>
  </section>

  <section class="section" id="faq">
    <div class="wrap narrow">
      <div class="section-head">
        <h2>${esc(c.faq.title)}</h2>
        <p class="section-intro">${esc(c.faq.intro)}</p>
      </div>
      <div class="faq">${faq}</div>
    </div>
  </section>

  <section class="section section-contact" id="contact">
    <div class="wrap contact-grid">
      <div class="contact-info">
        <p class="eyebrow">${esc(c.contact.eyebrow)}</p>
        <h2>${esc(c.contact.title)}</h2>
        <p class="section-intro">${esc(c.contact.intro)}</p>
        <ul class="info-list">
          <li><span>電郵</span><a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></li>
          <li><span>電話</span><a href="tel:${esc(String(c.contact.phone).replace(/\s/g, ''))}">${esc(c.contact.phone)}</a></li>
          ${waLink ? `<li><span>WhatsApp</span><a href="${esc(waLink)}" target="_blank" rel="noopener">${esc(c.contact.phone)}</a></li>` : ''}
          <li><span>地址</span><a href="${esc(c.contact.mapUrl)}" target="_blank" rel="noopener">${esc(c.contact.address)}</a></li>
          <li><span>時間</span><p>${esc(c.contact.hours)}</p></li>
        </ul>
        <p class="contact-note">${esc(c.contact.note)}</p>
      </div>

      <div class="form-card">
        <form id="inquiryForm" class="form" novalidate>
          <div class="form-row">
            <label class="field"><span>姓名 *</span><input name="name" autocomplete="name" required maxlength="80" placeholder="陳大文"></label>
            <label class="field"><span>公司 / 機構</span><input name="company" autocomplete="organization" maxlength="120" placeholder="公司名稱"></label>
          </div>
          <div class="form-row">
            <label class="field"><span>電郵 *</span><input name="email" type="email" autocomplete="email" required maxlength="160" placeholder="you@company.com"></label>
            <label class="field"><span>電話 / WhatsApp</span><input name="phone" autocomplete="tel" maxlength="40" placeholder="+852 9xxx xxxx"></label>
          </div>
          <div class="form-row">
            <label class="field"><span>查詢類型</span><select name="type">${typeOptions}</select></label>
            <label class="field"><span>預算範圍</span><select name="budget">${budgetOptions}</select></label>
          </div>
          <label class="field"><span>想聊什麼？ *</span><textarea name="message" rows="5" required minlength="10" maxlength="2000" placeholder="例如：我們是一間連鎖茶飲店，想重做品牌和官網，希望在 6 月前上線。"></textarea></label>
          <label class="check"><input type="checkbox" name="consent" required> <span>我同意以上資料只用於回覆這次查詢。</span></label>
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="hidden" name="startedAt" value="0">
          <div class="form-foot">
            <button class="btn btn-lg" type="submit" id="submitBtn">送出查詢 <span aria-hidden="true">→</span></button>
            <p class="form-hint">送出後會即時收到查詢編號，可隨時查看進度。</p>
          </div>
          <p class="form-error" id="formError" role="alert" hidden></p>
        </form>

        <div class="form-success" id="formSuccess" hidden>
          <div class="ok-mark" aria-hidden="true">✓</div>
          <h3>${esc(c.contact.success)}</h3>
          <p>你的查詢編號是 <b id="refCode"></b>，請記下它，方便日後跟進。</p>
          <p class="form-hint">我們已通知同事，通常 1 個工作天內回覆。急件請直接 WhatsApp。</p>
          <div class="ok-actions">
            <a class="btn" id="trackLink" href="/track">查看查詢進度</a>
            <button class="btn btn-ghost" type="button" id="againBtn">再送一份</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>

<footer class="footer">
  <div class="wrap footer-grid">
    <div>
      <div class="brand brand-foot">
        <span class="brand-mark">${esc((c.brand.short || 'A').slice(0, 1))}</span>
        <span class="brand-text"><b>${esc(c.brand.name)}</b><i>${esc(c.brand.tagline)}</i></span>
      </div>
      <p class="foot-note">${esc(c.footer.note)}</p>
    </div>
    <nav class="foot-links">${footerLinks}</nav>
    <div class="foot-meta">
      <p>${esc(c.footer.copyright)}</p>
      <a href="${esc(adminUrl)}" rel="nofollow">管理後台</a>
    </div>
  </div>
</footer>

${waLink ? `<a class="fab" href="${esc(waLink)}" target="_blank" rel="noopener" aria-label="WhatsApp 聯絡我們"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm0 2a8 8 0 11-4.1 14.9l-.4-.2-3 .8.8-2.9-.3-.4A8 8 0 0112 4zm-3 4c-.3 0-.6.1-.8.4-.3.4-.8 1-.8 1.9 0 1 .7 2 1.6 2.9 1.3 1.2 2.9 2 4.5 2.1.9 0 1.5-.2 1.9-.5.5-.4.7-1 .7-1.4l-.2-.3-1.7-.8c-.2-.1-.4-.1-.5.1l-.6.8c-.1.2-.3.2-.5.1-.5-.2-1.2-.6-1.8-1.4-.4-.5-.6-1-.6-1.1 0-.2 0-.4.2-.5l.5-.5c.1-.2.1-.4 0-.5l-.7-1.6c-.2-.4-.4-.4-.6-.4H9z"/></svg></a>` : ''}

<script src="/assets/site.js" defer></script>
${inquiryRef ? `<script>window.__lastRef=${JSON.stringify(inquiryRef)}</script>` : ''}
</body>
</html>`;
}

export function renderPrivacy(content) {
  const c = content;
  const body = String(c.privacy.body || '')
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
  return pageShell(c, '私隱政策', `
    <section class="section" style="padding-top:8rem">
      <div class="wrap narrow legal">
        <a class="back" href="/">← 返回首頁</a>
        <h1>${esc(c.privacy.title)}</h1>
        ${body}
        <p class="form-hint">最後更新：${new Date().toISOString().slice(0, 10)}</p>
      </div>
    </section>`);
}

export function renderTrack(content, { query = {}, result = null, error = '' } = {}) {
  const c = content;
  const q = (k) => esc(query[k] || '');
  let panel = '';

  if (error) {
    panel = `<div class="alert">${esc(error)}</div>`;
  } else if (result) {
    const statusMap = {
      new: '已收到，待處理',
      replied: '已回覆',
      closed: '已結案',
    };
    const replies = (result.replies || [])
      .map(
        (r) => `<li class="reply"><div class="reply-meta">回覆 · ${esc(formatTime(r.at))}</div><p>${esc(r.text)}</p></li>`,
      )
      .join('');
    panel = `
      <div class="track-card">
        <div class="track-head">
          <div><span class="kicker">查詢編號</span><b>${esc(result.ref)}</b></div>
          <span class="badge badge-${esc(result.status)}">${statusMap[result.status] || result.status}</span>
        </div>
        <dl class="track-meta">
          <div><dt>姓名</dt><dd>${esc(result.name)}</dd></div>
          <div><dt>類型</dt><dd>${esc(result.type || '-')}</dd></div>
          <div><dt>送出時間</dt><dd>${esc(formatTime(result.createdAt))}</dd></div>
        </dl>
        <div class="track-msg"><span class="kicker">你的留言</span><p>${esc(result.message)}</p></div>
        <div class="track-replies">
          <span class="kicker">回覆紀錄</span>
          ${replies ? `<ul>${replies}</ul>` : '<p class="muted">暫時未回覆，我們通常 1 個工作天內回覆。</p>'}
        </div>
      </div>`;
  }

  return pageShell(c, '查詢進度', `
    <section class="section" style="padding-top:8rem">
      <div class="wrap narrow legal">
        <a class="back" href="/">← 返回首頁</a>
        <h1>查看查詢進度</h1>
        <p class="section-intro">輸入送出查詢時收到的編號與電郵，即可查看我們的最新回覆。</p>
        <form class="form track-form" method="get" action="/track">
          <label class="field"><span>查詢編號</span><input name="ref" value="${q('ref')}" placeholder="INQ-XXXXXXX" required></label>
          <label class="field"><span>電郵</span><input name="email" type="email" value="${q('email')}" placeholder="you@company.com" required></label>
          <button class="btn" type="submit">查看</button>
        </form>
        ${panel}
      </div>
    </section>`);
}

export function pageShell(content, title, inner) {
  return `<!doctype html>
<html lang="zh-Hant-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}｜${esc(content.brand.name)}</title>
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<header class="nav nav-static">
  <div class="wrap nav-inner">
    <a class="brand" href="/">
      <span class="brand-mark">${esc((content.brand.short || 'A').slice(0, 1))}</span>
      <span class="brand-text"><b>${esc(content.brand.name)}</b><i>${esc(content.brand.enName)}</i></span>
    </a>
    <div class="nav-actions"><a class="btn btn-ghost btn-sm" href="/">返回首頁</a></div>
  </div>
</header>
<main>${inner}</main>
<footer class="footer">
  <div class="wrap footer-grid">
    <p>${esc(content.footer.copyright)}</p>
  </div>
</footer>
</body>
</html>`;
}

export function formatTime(iso) {
  try {
    return new Intl.DateTimeFormat('zh-HK', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}
