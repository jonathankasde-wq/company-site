// 後台前端：選單、內容編輯器（讀取/儲存）、提示訊息
(() => {
  /* ---------- 手機選單 ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const side = document.querySelector('.side');
  if (menuBtn && side) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      side.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (side.classList.contains('open') && !side.contains(e.target) && e.target !== menuBtn) {
        side.classList.remove('open');
      }
    });
  }

  /* ---------- Flash 自動淡出 ---------- */
  const flash = document.querySelector('.flash');
  if (flash) setTimeout(() => flash.classList.add('flash-out'), 4500);

  /* ---------- Toast ---------- */
  let toastEl = null;
  let toastTimer = null;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  window.__toast = toast;

  /* ---------- 內容編輯器 ---------- */
  const root = document.getElementById('editorRoot');
  const form = document.getElementById('contentForm');
  if (!root || !form) return;

  const saveBtn = document.getElementById('saveBtn');
  const saveState = document.getElementById('saveState');
  const resetBtn = document.getElementById('resetReload');
  let dirty = false;

  function markDirty() {
    if (dirty) return;
    dirty = true;
    if (saveState) {
      saveState.textContent = '有未儲存的變更';
      saveState.classList.add('dirty');
    }
  }

  /** 把 DOM 讀回成內容物件（欄位靠 data-key，清單靠 data-list + .item） */
  function readNode(el) {
    const out = {};
    for (const child of el.children) {
      if (child.tagName === 'TEMPLATE') continue;
      const key = child.dataset ? child.dataset.key : null;

      if (key && child.dataset.list === '1') {
        out[key] = Array.from(child.querySelectorAll(':scope > .item')).map(readNode);
        continue;
      }
      if (key && child.dataset.field === '1') {
        const input = child.querySelector('input, textarea');
        out[key] = input ? input.value : '';
        continue;
      }
      if (key && child.dataset.lines === '1') {
        const ta = child.querySelector('textarea');
        out[key] = String(ta ? ta.value : '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        continue;
      }
      if (key) {
        out[key] = readNode(child);
        continue;
      }
      // 無 key 的包裝層（.fields / .item-head）往內合併
      Object.assign(out, readNode(child));
    }
    return out;
  }

  function renumber(list) {
    const items = list.querySelectorAll(':scope > .item');
    items.forEach((item, i) => {
      const no = item.querySelector('.item-head .no');
      if (no) no.textContent = String(i + 1);
    });
    const head = list.querySelector('.list-head small');
    if (head) head.textContent = `${items.length} 項，可新增、排序、刪除`;
  }

  root.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const list = add.closest('[data-list]');
      const tpl = list.querySelector('template');
      if (!tpl) return;
      const clone = tpl.content.cloneNode(true);
      list.insertBefore(clone, add);
      renumber(list);
      markDirty();
      const first = list.querySelector('.item:last-of-type input, .item:last-of-type textarea');
      if (first) first.focus();
      return;
    }

    const remove = e.target.closest('[data-remove]');
    if (remove) {
      const item = remove.closest('.item');
      const list = item.parentElement;
      if (!confirm('移除這一項？（按「儲存並發佈」後才會真正生效）')) return;
      item.remove();
      renumber(list);
      markDirty();
      return;
    }

    const move = e.target.closest('[data-move]');
    if (move) {
      const item = move.closest('.item');
      const list = item.parentElement;
      const delta = Number(move.dataset.move);
      const sibling = delta < 0 ? item.previousElementSibling : item.nextElementSibling;
      if (!sibling || !sibling.classList.contains('item')) return;
      if (delta < 0) list.insertBefore(item, sibling);
      else list.insertBefore(sibling, item);
      renumber(list);
      markDirty();
    }
  });

  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!dirty || confirm('放棄所有未儲存的變更並重新載入？')) location.reload();
    });
  }

  let saving = false;
  async function save() {
    if (saving) return;
    saving = true;
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中…';

    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ content: readNode(root) }),
      });
      if (res.status === 401) {
        location.href = '/admin/login';
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || '儲存失敗');

      dirty = false;
      if (saveState) {
        const time = new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
        saveState.textContent = `已儲存 · ${time}`;
        saveState.classList.remove('dirty');
      }
      toast('已發佈，官網已更新');
    } catch (err) {
      toast(`儲存失敗：${err.message}`);
      if (saveState) {
        saveState.textContent = '儲存失敗，請再試一次';
        saveState.classList.add('dirty');
      }
    } finally {
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
})();
