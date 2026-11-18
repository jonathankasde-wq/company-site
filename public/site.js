// 官網前端互動：選單、滾動效果、逐項進場、查詢表單送出
(() => {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  const links = document.getElementById('navLinks');

  if (burger && links) {
    burger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
    document.body.classList.toggle('is-scrolled', window.scrollY > 320);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // 逐項進場
  const reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  // 查詢表單
  const form = document.getElementById('inquiryForm');
  if (!form) return;

  const errorBox = document.getElementById('formError');
  const successBox = document.getElementById('formSuccess');
  const submitBtn = document.getElementById('submitBtn');
  const refCode = document.getElementById('refCode');
  const trackLink = document.getElementById('trackLink');
  const startedAt = document.querySelector('input[name="startedAt"]');
  if (startedAt) startedAt.value = String(Date.now());

  const showError = (msg) => {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.hidden = false;
  };
  const clearError = () => {
    if (errorBox) errorBox.hidden = true;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = Boolean(data.consent);

    submitBtn.disabled = true;
    const original = submitBtn.innerHTML;
    submitBtn.textContent = '送出中…';

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        showError(json.error || '送出失敗，請稍後再試，或直接 WhatsApp 我們。');
        return;
      }

      if (refCode) refCode.textContent = json.ref;
      if (trackLink) {
        trackLink.href = `/track?ref=${encodeURIComponent(json.ref)}&email=${encodeURIComponent(data.email)}`;
      }
      form.hidden = true;
      if (successBox) {
        successBox.hidden = false;
        successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch {
      showError('網絡連線有問題，請稍後再試。');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  });

  const again = document.getElementById('againBtn');
  if (again) {
    again.addEventListener('click', () => {
      form.reset();
      form.hidden = false;
      if (successBox) successBox.hidden = true;
      if (startedAt) startedAt.value = String(Date.now());
      const name = form.querySelector('input[name="name"]');
      if (name) name.focus();
    });
  }
})();
