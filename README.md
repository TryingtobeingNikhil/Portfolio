# tryingtobenikhil.space

Personal site of Nikhil Mourya. Plain HTML, CSS and JS: no framework, no build step.
Netlify deploys every push to `main`.

## Add a new article

1. Open `assets/data/articles.js`.
2. Copy an existing line into the right series and change the `title`, `url` and `date`.
3. Commit and push:

   ```bash
   git add assets/data/articles.js
   git commit -m "Add article: <title>"
   git push
   ```

The Writing section, the series counts, the article total in Highlights and ⌘K search all update from that file.

## Add a quote

The footer shows a random quote from `assets/data/quotes.js` on every visit. Add a line with `text`, `by` and (optionally) `source`, set `mine: true` for your own favourites, then commit and push.

## Spotify "Now playing / Last played"

The row in About is fed by a Netlify Function (`netlify/functions/now-playing.mjs`) at `/api/now-playing`.
It stays hidden until these three environment variables are set in Netlify
(Site configuration → Environment variables): `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`.

1. Create an app at https://developer.spotify.com/dashboard and add the Redirect URI `http://127.0.0.1:8888/callback`.
2. Get the refresh token (runs locally, only talks to Spotify):

   ```bash
   SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/spotify-token.mjs
   ```

3. Add the three values in Netlify and redeploy. Never commit them.

## Run it locally

```bash
python3 -m http.server 5501
```

Then open http://localhost:5501.

## Where things live

| File | What it is |
| --- | --- |
| `index.html` | All page content |
| `assets/css/main.css` | Styles |
| `assets/js/field.js` | Hero neural-net / matrix canvas |
| `assets/js/main.js` | Nav, reveals, portrait, KV-cache demo, GitHub stars |
| `assets/js/trail.js` | Binary 0/1 cursor trail (desktop only) |
| `assets/js/showcase.js` | Speculative decoding demo (Lab) |
| `assets/js/extras.js` | Writing list, highlights, contributions, lab toys, ⌘K palette |
| `assets/data/articles.js` | Article list |
| `assets/data/quotes.js` | Quote bank |
| `netlify/functions/now-playing.mjs` | Spotify now playing / last played API |
| `scripts/spotify-token.mjs` | One-time Spotify token helper |

When you change CSS or JS, bump the `?v=` number on its `<script>`/`<link>` tag in `index.html` so browsers fetch the new file.
