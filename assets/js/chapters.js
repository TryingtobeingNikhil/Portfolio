/* Chapter furniture: the Work index (filter + open in place), the git-log
   highlights, and the "Right now" strip (local status + latest public commit).
   Spotify and the contribution calendar fill the rest of the strip from extras.js. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Work: filter by kind, open a row in place ---------------- */
  (function work() {
    const list = $('[data-wx-list]'), chips = $('[data-wf-chips]');
    if (!list) return;
    const rows = $$('.wx', list);
    const setOpen = (li, open) => {
      li.classList.toggle('is-open', open);
      $('.wx__row', li).setAttribute('aria-expanded', String(open));
    };
    const filter = cat => {
      rows.forEach(li => { li.hidden = cat !== 'all' && li.dataset.cat !== cat; });
      if (chips) $$('[data-wf]', chips).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wf === cat)));
    };
    list.addEventListener('click', e => {
      const btn = e.target.closest('.wx__row');
      if (btn) setOpen(btn.parentElement, !btn.parentElement.classList.contains('is-open'));
    });
    if (chips) chips.addEventListener('click', e => { const b = e.target.closest('[data-wf]'); if (b) filter(b.dataset.wf); });

    window.WORK = {
      filter(cat, scroll) {
        filter(cat);
        if (scroll) $('#works').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      },
      open(li) {
        if (li.hidden) filter('all');
        setOpen(li, true);
        li.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      },
    };
  })();

  /* ---------------- Highlights as a git log ---------------- */
  // The hashes are content hashes of each line (FNV-1a), so they stay put
  // until the line itself changes, like a real commit would.
  (function gitlog() {
    const log = $('[data-gitlog]');
    if (!log) return;
    const fnv = str => { let h = 0x811c9dc5; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0').slice(0, 7); };
    $$('[data-hash]', log).forEach(el => { el.textContent = fnv(el.parentElement.textContent.replace(/\s+/g, ' ').trim()); });
    const more = $('[data-gitlog-more]');
    const total = $$('li', log).length, extra = $$('li[data-more]', log).length;
    if (!more || !extra) { if (more) more.hidden = true; return; }
    const label = () => {
      const all = log.classList.contains('is-all');
      more.firstChild.textContent = all ? 'git log -n 5 ' : 'git log --all ';
      $('[data-gitlog-n]', more).textContent = all ? '' : `(${total})`;
      more.setAttribute('aria-expanded', String(all));
    };
    more.addEventListener('click', () => { log.classList.toggle('is-all'); label(); });
    label();
  })();

  /* ---------------- Right now: what Jaipur time says about me ---------------- */
  (function mood() {
    const v = $('[data-now-mood]'), sub = $('[data-now-sub]');
    if (!v) return;
    const hourIST = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date())) % 24;
    const MOODS = [
      [0, 2, 'Up late, losing an argument with a stack trace', 'Replies tomorrow, after coffee'],
      [2, 7, 'Asleep. Probably.', 'Replies after 10am IST'],
      [7, 10, 'Awake, but coffee first', 'Replies in a few hours'],
      [10, 17, 'In class, or pretending to be while building', 'Replies usually within a day'],
      [17, 21, 'Building something', 'Good time to say hi'],
      [21, 24, 'Maintaining eye contact with a single code block', 'Replies usually within a day'],
    ];
    const set = () => {
      const h = hourIST();
      const m = MOODS.find(([a, b]) => h >= a && h < b) || MOODS[4];
      v.textContent = m[2]; sub.textContent = m[3];
    };
    set(); setInterval(set, 5 * 60 * 1000);
  })();

  /* ---------------- Right now: latest public commit ---------------- */
  // Two unauthenticated GitHub calls (most recently pushed repo, then its newest
  // commit), cached for 15 minutes so a visitor never comes close to the rate limit.
  (function commit() {
    const box = $('[data-commit]');
    if (!box) return;
    const USER = 'TryingtobeingNikhil', KEY = 'gh:last-commit';
    const ago = iso => {
      const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
      if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
      if (s < 86400) return `${Math.round(s / 3600)}h ago`;
      const d = Math.round(s / 86400); return `${d} day${d === 1 ? '' : 's'} ago`;
    };
    const show = c => {
      $('[data-commit-msg]', box).textContent = c.msg;
      $('[data-commit-repo]', box).textContent = c.repo;
      $('[data-commit-ago]', box).textContent = ago(c.date);
      box.href = c.url;
      box.hidden = false;
    };
    try {
      const hit = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (hit && Date.now() - hit.t < 15 * 60 * 1000) { show(hit.c); return; }
    } catch (_) { /* storage unavailable */ }
    const gh = path => fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json' } }).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
    gh(`/users/${USER}/repos?sort=pushed&per_page=5`)
      .then(repos => {
        const repo = repos.find(r => !r.fork && !r.private) || repos[0];
        if (!repo) throw new Error('no repos');
        return gh(`/repos/${repo.full_name}/commits?per_page=1`).then(([c]) => ({
          msg: c.commit.message.split('\n')[0].slice(0, 90),
          date: c.commit.committer?.date || c.commit.author?.date,
          repo: repo.name,
          url: c.html_url,
        }));
      })
      .then(c => { show(c); try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), c })); } catch (_) {} })
      .catch(() => { /* rate-limited or offline: the cell stays hidden */ });
  })();
})();
