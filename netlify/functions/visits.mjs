// Netlify Function: /api/visits
// GET  → { visits } (the running total)
// POST → counts one visit and returns the new total
// The count lives in Netlify Blobs (private to this site). The page only POSTs
// once per browser every 12 hours, and never from automated browsers.
import { getStore } from '@netlify/blobs';

const KEY = 'visits';
// Blobs belong to one Netlify site. The count on the previous site (Oct 2026) was 260,
// so a fresh store starts from there instead of from zero.
const CARRIED_OVER = 260;
const json = body =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export default async req => {
  try {
    const store = getStore({ name: 'site-stats', consistency: 'strong' });
    let visits = Number(await store.get(KEY)) || CARRIED_OVER;
    if (req.method === 'POST') {
      visits += 1;
      await store.set(KEY, String(visits));
    }
    return json({ visits });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
};

export const config = { path: '/api/visits', method: ['GET', 'POST'] };
