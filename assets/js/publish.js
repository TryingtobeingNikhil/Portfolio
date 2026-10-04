/* Private "Add article" button.
   Open the site with #publish once and enter the ADMIN_TOKEN set on Netlify; from then
   on this browser shows "Add article" in Writing (and in ⌘K). Articles are saved by
   netlify/functions/articles.mjs and appear for every visitor straight away: no
   commit, no redeploy. Visitors never see any of this. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const dlg = $('#publish');
  if (!dlg || !window.WRITING || typeof dlg.showModal !== 'function') return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const KEY = 'publish:token';
  const token = () => { try { return localStorage.getItem(KEY) || ''; } catch (_) { return ''; } };
  const remember = v => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (_) {} };

  const form = $('[data-publish-form]', dlg);
  const f = form.elements;
  const msg = $('[data-publish-msg]', dlg);
  const submit = $('[data-publish-submit]', dlg);
  const list = $('[data-publish-list]', dlg);
  const preview = $('[data-publish-preview]', dlg);
  const NEW = '__new';
  let mode = 'unlock', editing = null, busy = false;

  const today = () => {
    const d = new Date(); // local date, not UTC, so a late-night post gets tonight's date
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const say = (text, kind = '') => { msg.textContent = text; msg.dataset.kind = kind; };

  async function api(method, body, query = '') {
    const res = await fetch(`/api/articles${query}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { remember(''); syncAdmin(); }
    if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status})`);
    return data;
  }

  /* ---------- form state ---------- */
  function latestSeries() {
    const data = window.ARTICLES_MERGED || [];
    let best = null;
    data.forEach(s => s.items.forEach(a => { const k = `${a.date || ''}|${a.added || ''}`; if (!best || k > best.k) best = { k, s: s.series }; }));
    return best ? best.s : '';
  }
  function fillSeries(selected) {
    const all = window.WRITING.series();
    f.series.innerHTML = all.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('') + `<option value="${NEW}">New series…</option>`;
    f.series.value = all.some(s => s.name === selected) ? selected : (all[0] ? all[0].name : NEW);
    syncSeries();
  }
  function syncSeries() {
    const isNew = f.series.value === NEW;
    const s = window.WRITING.series().find(x => x.name === f.series.value);
    $('[data-new-series]', dlg).hidden = !isNew;
    $('[data-tag]', dlg).hidden = !(isNew || (s && !s.numbered));
    // where it will land, so a wrong series is obvious before publishing
    const name = isNew ? (f.newSeries.value.trim() || 'a new series') : f.series.value;
    let where = name;
    if (s && s.numbered && !editing) {
      const col = (window.ARTICLES_MERGED || []).find(x => x.series === s.name);
      where = `${name}, part ${(col ? col.items.length : 0) + 1}`;
    }
    preview.textContent = `Lands in ${where}${editing ? '' : ', and shows as Latest'}.`;
  }
  function reset() {
    form.reset();
    editing = null;
    f.date.value = today();
    fillSeries(latestSeries());
  }

  function renderList() {
    const items = window.WRITING.extra().slice().reverse();
    list.hidden = mode !== 'edit' || !items.length;
    if (list.hidden) { list.innerHTML = ''; return; }
    list.innerHTML = `<p class="publish__k">Added from here</p><ul>${items.map(a => `
      <li data-id="${esc(a.id)}" class="${a.id === editing ? 'is-editing' : ''}">
        <span class="publish__item"><b>${esc(a.title)}</b><small>${esc(a.series)} · ${esc(a.date || '')}${a.views ? ` · ${a.views.toLocaleString('en-US')} views` : ''}</small></span>
        <button type="button" data-act="edit">Edit</button>
        <button type="button" data-act="delete">Delete</button>
      </li>`).join('')}</ul>`;
  }

  function setMode(next) {
    mode = next;
    $$('[data-step]', dlg).forEach(el => { el.hidden = el.dataset.step !== mode; });
    $('[data-publish-title]', dlg).textContent = mode === 'unlock' ? 'Unlock publishing' : editing ? 'Edit article' : 'Add an article';
    submit.textContent = mode === 'unlock' ? 'Unlock' : editing ? 'Save changes' : 'Publish';
    $('[data-publish-signout]', dlg).hidden = mode === 'unlock';
    $('[data-publish-cancel]', dlg).hidden = !editing;
    f.url.required = f.title.required = mode === 'edit';
    renderList();
  }

  function open() {
    say('');
    if (token()) { reset(); setMode('edit'); } else setMode('unlock');
    if (!dlg.open) dlg.showModal();
    (mode === 'unlock' ? f.token : f.url).focus();
  }

  /* ---------- actions ---------- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    busy = true; submit.disabled = true;
    try {
      if (mode === 'unlock') {
        const t = f.token.value.trim();
        if (!t) throw new Error('Paste your admin token');
        remember(t);
        say('Checking…');
        await api('GET', null, '?check=1');
        f.token.value = '';
        syncAdmin();
        reset(); setMode('edit');
        say('Unlocked in this browser.', 'ok');
        f.url.focus();
        return;
      }
      const url = f.url.value.trim(), title = f.title.value.trim();
      if (!/^https:\/\/\S+$/.test(url)) { f.url.focus(); throw new Error('Paste the article link (https://…)'); }
      if (!title) { f.title.focus(); throw new Error('Add the headline'); }
      const series = f.series.value === NEW ? f.newSeries.value.trim() : f.series.value;
      if (!series) { f.newSeries.focus(); throw new Error('Name the new series'); }
      const body = { url, title, series, note: f.note.value.trim(), date: f.date.value || today(), views: f.views.value };
      if (!$('[data-tag]', dlg).hidden) body.tag = f.tag.value.trim();
      say(editing ? 'Saving…' : 'Publishing…');
      const d = editing ? await api('PATCH', { id: editing, ...body }) : await api('POST', body);
      window.WRITING.set(d.items);
      const was = editing;
      reset(); setMode('edit');
      say(was ? 'Saved. The site is updated.' : `“${title}” is live on the site.`, 'ok');
    } catch (err) {
      if (mode === 'unlock') remember('');
      say(err.message, 'err');
      if (!token() && mode === 'edit') setMode('unlock');
    } finally {
      busy = false; submit.disabled = false;
    }
  });

  list.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || busy) return;
    const id = btn.closest('li').dataset.id;
    const a = window.WRITING.extra().find(x => x.id === id);
    if (!a) return;
    if (btn.dataset.act === 'edit') {
      editing = id;
      f.url.value = a.url; f.title.value = a.title; f.note.value = a.note || '';
      f.date.value = a.date || today(); f.views.value = a.views || '';
      f.tag.value = a.tag || '';
      fillSeries(a.series);
      setMode('edit');
      say('');
      f.title.focus();
      return;
    }
    // delete asks twice
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1'; btn.textContent = 'Sure?';
      setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Delete'; }, 3000);
      return;
    }
    busy = true;
    try {
      const d = await api('DELETE', null, `?id=${encodeURIComponent(id)}`);
      window.WRITING.set(d.items);
      if (editing === id) reset();
      setMode('edit');
      say('Removed from the site.', 'ok');
    } catch (err) { say(err.message, 'err'); }
    finally { busy = false; }
  });

  f.series.addEventListener('change', syncSeries);
  f.newSeries.addEventListener('input', syncSeries);
  $('[data-publish-close]', dlg).addEventListener('click', () => dlg.close());
  $('[data-publish-cancel]', dlg).addEventListener('click', () => { reset(); setMode('edit'); say(''); });
  $('[data-publish-signout]', dlg).addEventListener('click', () => { remember(''); syncAdmin(); setMode('unlock'); say('Signed out of this browser.'); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); // backdrop
  document.addEventListener('writing:render', () => { if (dlg.open && mode === 'edit') renderList(); });

  /* ---------- entry points ---------- */
  function syncAdmin() { $$('[data-publish-open]').forEach(b => { b.hidden = !token(); }); }
  $$('[data-publish-open]').forEach(b => b.addEventListener('click', open));
  syncAdmin();
  const fromHash = () => {
    if (!/^#publish$/i.test(location.hash)) return;
    history.replaceState(null, '', location.pathname + location.search);
    open();
  };
  fromHash();
  window.addEventListener('hashchange', fromHash);

  window.PUBLISH = { isAdmin: () => !!token(), open };
})();
