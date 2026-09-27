// Netlify Function: GET /api/now-playing
// Returns the track Nikhil is playing on Spotify right now, or the last one he played.
// Credentials never touch the browser or the repo; they live in Netlify environment
// variables: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN.
// Get the refresh token once with: node scripts/spotify-token.mjs

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const PLAYER = 'https://api.spotify.com/v1/me/player';

// Netlify's CDN caches each answer briefly, so Spotify is called at most a few times a minute
// no matter how many people load the page.
const json = (body, status = 200, cdnSeconds = 30) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': `public, s-maxage=${cdnSeconds}, stale-while-revalidate=60`,
    },
  });

async function accessToken() {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) return null;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  return (await res.json()).access_token;
}

// Only the fields the page needs: no account details leave this function.
function shape(track) {
  if (!track || track.type !== 'track') return null;
  const images = track.album?.images ?? [];
  const art = images.filter(i => (i.width ?? 0) >= 120).at(-1) ?? images[0]; // crisp at 56px on retina
  return {
    title: track.name,
    artist: (track.artists ?? []).map(a => a.name).join(', '),
    album: track.album?.name ?? '',
    art: art?.url ?? '',
    url: track.external_urls?.spotify ?? '',
  };
}

export default async () => {
  try {
    const token = await accessToken();
    if (!token) return json({ error: 'not configured' }, 503, 300);
    const headers = { Authorization: `Bearer ${token}` };

    // 1) something playing (or paused) right now? 204 means the player is idle.
    const now = await fetch(`${PLAYER}/currently-playing?additional_types=track`, { headers });
    if (now.status === 200) {
      const d = await now.json();
      const t = shape(d.item);
      if (t) return json({ ...t, playing: Boolean(d.is_playing) }, 200, d.is_playing ? 15 : 60);
    }

    // 2) otherwise, the most recent track in history
    const recent = await fetch(`${PLAYER}/recently-played?limit=1`, { headers });
    if (!recent.ok) throw new Error(`recently-played failed: ${recent.status}`);
    const item = (await recent.json()).items?.[0];
    const t = item && shape(item.track);
    return t ? json({ ...t, playing: false, playedAt: item.played_at }, 200, 60) : json({ error: 'nothing played yet' }, 404, 300);
  } catch (err) {
    console.error(err);
    return json({ error: 'spotify unavailable' }, 502, 30);
  }
};

export const config = { path: '/api/now-playing' };
