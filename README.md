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
| `assets/js/extras.js` | Writing list, highlights, contributions, lab toys, ⌘K palette |
| `assets/data/articles.js` | Article list |
| `assets/data/quotes.js` | Footer quote bank |

When you change CSS or JS, bump the `?v=` number on its `<script>`/`<link>` tag in `index.html` so browsers fetch the new file.
