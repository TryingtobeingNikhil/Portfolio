// One-time helper: gets the Spotify refresh token for the "Last played" row.
// Runs entirely on your machine; nothing is sent anywhere except Spotify.
//
//   1. Create an app at https://developer.spotify.com/dashboard
//      and add this Redirect URI to it:  http://127.0.0.1:8888/callback
//   2. Run (with your app's values):
//        SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/spotify-token.mjs
//   3. Open the URL it prints, approve, and copy the SPOTIFY_REFRESH_TOKEN it prints.
//   4. Put all three values in Netlify → Site configuration → Environment variables.
//
// Never commit these values or paste them anywhere public.

import http from 'node:http';

const id = process.env.SPOTIFY_CLIENT_ID;
const secret = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT = 'http://127.0.0.1:8888/callback';
const SCOPES = 'user-read-currently-playing user-read-recently-played';

if (!id || !secret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first (see the comment at the top of this file).');
  process.exit(1);
}

const state = crypto.randomUUID();
const authUrl = 'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, state });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  if (url.searchParams.get('state') !== state) { res.writeHead(400).end('State mismatch, try again.'); return; }
  if (url.searchParams.get('error')) { res.end(`Spotify said: ${url.searchParams.get('error')}`); process.exit(1); }

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT }),
  });
  const data = await r.json();
  if (!data.refresh_token) {
    res.end('Could not get a token. Check the terminal.');
    console.error('Spotify response:', data);
    process.exit(1);
  }
  res.end('Done. You can close this tab and go back to the terminal.');
  console.log('\nSPOTIFY_REFRESH_TOKEN=' + data.refresh_token);
  console.log('\nAdd SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN in Netlify →');
  console.log('Site configuration → Environment variables, then trigger a redeploy.\n');
  server.close();
  process.exit(0);
});

server.listen(8888, '127.0.0.1', () => {
  console.log('\nOpen this URL in your browser and click "Agree":\n\n' + authUrl + '\n');
});
