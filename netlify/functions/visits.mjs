// Netlify Function: /api/visits
// GET  → { visits } (the running total)
// POST → counts one visit and returns the new total
// The count lives in Netlify Blobs (private to this site). The page only POSTs
// once per browser every 12 hours, and never from automated browsers.
import { getStore } from '@netlify/blobs';

const KEY = 'visits';
const json = body =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export default async req => {
  try {
    const store = getStore({ name: 'site-stats', consistency: 'strong' });
    let visits = Number(await store.get(KEY)) || 0;
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
