// Netlify Function: /api/articles
// Articles added from the site itself (the private "Add article" button), on top of
// the ones written into assets/data/articles.js.
//
// GET    → { items }                       public, what the Writing section merges in
// POST   → add one    { url, title, series, note?, tag?, date?, views? }
// PATCH  → edit one   { id, ...fields }
// DELETE → remove one ?id=...
//
// Writes need `Authorization: Bearer <ADMIN_TOKEN>`. ADMIN_TOKEN lives only in Netlify's
// environment variables; without it set, the endpoint is read-only.
// Items live in Netlify Blobs (private to this site), next to the visit counter.
import { getStore } from '@netlify/blobs';
import { timingSafeEqual, randomUUID } from 'node:crypto';

const KEY = 'items';
const MAX = { url: 600, title: 200, series: 60, note: 400, tag: 24 };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function authorised(req) {
  const want = process.env.ADMIN_TOKEN;
  if (!want) return false;
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Validate and normalise one article; returns [item, error]
function clean(input, base = {}) {
  const out = { ...base };
  if ('url' in input || !base.url) {
    let u;
    try { u = new URL(str(input.url, MAX.url)); } catch (_) { return [null, 'A valid link is required']; }
    if (u.protocol !== 'https:') return [null, 'The link must start with https://'];
    out.url = u.href;
  }
  if ('title' in input || !base.title) {
    out.title = str(input.title, MAX.title);
    if (!out.title) return [null, 'A title is required'];
  }
  if ('series' in input || !base.series) {
    out.series = str(input.series, MAX.series);
    if (!out.series) return [null, 'Pick a series'];
  }
  if ('note' in input) out.note = str(input.note, MAX.note);
  if ('tag' in input) out.tag = str(input.tag, MAX.tag);
  if ('date' in input) {
    const d = str(input.date, 10);
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return [null, 'Date must look like 2026-10-04'];
    out.date = d || new Date().toISOString().slice(0, 10);
  }
  if (!out.date) out.date = new Date().toISOString().slice(0, 10);
  if ('views' in input) {
    const v = input.views === '' || input.views == null ? 0 : Math.round(Number(input.views));
    if (!Number.isFinite(v) || v < 0) return [null, 'Views must be a positive number'];
    out.views = v;
  }
  return [out, null];
}

export default async req => {
  const store = getStore({ name: 'site-articles', consistency: 'strong' });
  const load = async () => (await store.get(KEY, { type: 'json' })) || [];
  const save = items => store.setJSON(KEY, items);

  try {
    if (req.method === 'GET') {
      // ?check=1 lets the admin panel verify a token without changing anything
      if (new URL(req.url).searchParams.has('check')) return json({ ok: authorised(req) }, authorised(req) ? 200 : 401);
      return json({ items: await load() });
    }

    if (!process.env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN is not set on Netlify' }, 503);
    if (!authorised(req)) return json({ error: 'Wrong admin token' }, 401);

    const items = await load();

    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id');
      const next = items.filter(a => a.id !== id);
      if (next.length === items.length) return json({ error: 'Not found' }, 404);
      await save(next);
      return json({ items: next });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Send JSON' }, 400);

    if (req.method === 'POST') {
      const [item, err] = clean(body);
      if (err) return json({ error: err }, 400);
      if (items.some(a => a.url === item.url)) return json({ error: 'That link is already on the site' }, 409);
      item.id = randomUUID();
      item.added = new Date().toISOString();
      items.push(item);
      await save(items);
      return json({ item, items }, 201);
    }

    if (req.method === 'PATCH') {
      const i = items.findIndex(a => a.id === body.id);
      if (i === -1) return json({ error: 'Not found' }, 404);
      const [item, err] = clean(body, items[i]);
      if (err) return json({ error: err }, 400);
      items[i] = item;
      await save(items);
      return json({ item, items });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: 'Storage unavailable' }, 502);
  }
};

export const config = { path: '/api/articles', method: ['GET', 'POST', 'PATCH', 'DELETE'] };
