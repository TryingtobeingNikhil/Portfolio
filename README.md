# tryingtobenikhil.space

Personal site of Nikhil Mourya. Plain HTML, CSS and JS: no framework, no build step.
Netlify deploys every push to `main`.

## Add a new article (from the site)

The quickest way: publish straight from the site, no commit needed.

1. One-time setup: in Netlify, go to Site configuration → Environment variables and add `ADMIN_TOKEN`
   with a long random value (for example the output of `openssl rand -hex 24`). Redeploy once.
2. Open https://tryingtobenikhil.space/#publish and paste that token. It is checked by the server and
   remembered in that browser only.
3. From then on, Writing shows **+ Add article** (also in ⌘K). Paste the link and headline, pick the
   series, optionally add a line in your own words, and press Publish. It is live for everyone immediately.

Articles added this way live in Netlify Blobs (`netlify/functions/articles.mjs`), are merged into the
series from `assets/data/articles.js`, and can be edited (views too) or deleted from the same panel.
The newest article, from either source, gets the "Latest" row with your note.

## Add a new article (in code)

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

## Hidden bits

- **Backtick (`)** opens a terminal: `help`, `ls`, `cd writing`, `open pageserve`, `articles rlforge`, `temp 1.4`, `quantize int2`, `sudo hire nikhil`.
- **↑↑↓↓←→←→BA** toggles debug mode: every chapter is outlined with its token count, DOM nodes and height.
- **Writing filters are links**: `/#writing/rlforge` opens the library on one series.

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
| `assets/js/ask.js` | "Ask this page": BM25 search over the page with a refusal threshold |
| `assets/js/extras.js` | Writing list, highlights, contributions, lab toys, ⌘K palette |
| `assets/data/articles.js` | Article list |
| `assets/data/quotes.js` | Quote bank |
| `assets/js/chapters.js` | Work index (filters, rows that open), git-log Highlights, "Right now" strip |
| `assets/js/fun.js` | Portrait precision slider, temperature dial, reading meter, terminal, Konami debug, GridWorld agent, tokenizer |
| `404.html` | "Token not in vocabulary" page with nearest-page suggestions |
| `assets/js/publish.js` | Private "Add article" panel (opens with `#publish`) |
| `netlify/functions/articles.mjs` | Articles added from the site (Netlify Blobs) |
| `netlify/functions/now-playing.mjs` | Spotify now playing / last played API |
| `scripts/spotify-token.mjs` | One-time Spotify token helper |

When you change CSS or JS, bump the `?v=` number on its `<script>`/`<link>` tag in `index.html` so browsers fetch the new file.
