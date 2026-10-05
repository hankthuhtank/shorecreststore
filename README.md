# shorecrest.store

The Shorecrest storefront: canvas, shirts, mugs, puzzles and hats made from original photographs.
A static site (GitHub, push to `main`) plus a small Cloudflare Worker that serves the live Printify catalog.
Checkout happens on the Printify Pop-Up Store (shorecrest.printify.me).

## How products get onto the site

```
Printify  ->  Worker (Shorecrest_Worker, Cloudflare)  ->  this site
```

Publish or edit a product in Printify and it shows up here on its own, usually within 15 minutes.
Nothing in this repo needs to change.

- **Categories** are detected automatically (canvas, shirts, mugs, puzzles, hats). To force one, add a Printify tag like `type:canvas`.
- **Canvas + Framed canvas** of the same photo appear as one design with a Style choice (titles that match apart from the word "Framed").
- **Logo variations** of a tee or cap (same title, e.g. "Copy of ...") appear as one product with a Logo choice. Name them in `variationLabels` in `assets/js/config.js`.
- **The original photograph**: put the photo code (for example `SC-019`) in a product title or tag and its page links to that photo and its story.
- **Order** follows the product order in your Pop-Up Store.
- **Buy now** opens that exact product on the Pop-Up Store.

## One-time setup

1. **Deploy the Worker.** Double-click `Shorecrest_Worker/DEPLOY.bat` (same as your SafiSolutions Worker).
   It works right away without a Printify token: it reads your Pop-Up Store's public product feed.
2. **Optional: add your Printify API token** with `Shorecrest_Worker/SET_SECRETS.bat`
   (Printify > Account > Connections > API tokens, read-only `shops.read` + `products.read`). The Worker then uses the official API.
3. **Check it:** open `https://shorecrest-store-api.safisolutions.workers.dev/api/health` and look for `"ok": true`.
   If your workers.dev subdomain is different, update `apiBase` in `assets/js/config.js`.
4. **Push this folder to `main`.** Your existing CNAME/domain setup stays as it is.

Until the Worker is live, the site shows a saved snapshot of the catalog (`assets/js/catalog-snapshot.js`):
real products and working Buy links, just not live. It's also the backup if the Worker is ever unreachable.

## Settings: `assets/js/config.js`

| Setting | What it does |
|---|---|
| `apiBase` | The Worker address |
| `popupUrl` | Your Pop-Up Store (checkout, privacy and terms links) |
| `variationLabels` | Names for logo/style variations, by Printify product ID |
| `buyLinks` | Override the Buy link for a specific product |
| `featured` | Printify product IDs to show first on the homepage |
| `supportEmail` | Shown on Help and Contact |
| `newsletter` | Paste your email platform's form endpoint |
| `social` | Instagram / TikTok links (hidden until set) |
| `policies` | Shipping and returns text for product pages and Help |

## Refresh the snapshot and sitemap

```
cd Shorecrest_Worker
node snapshot.mjs
```

Run this after big catalog changes so the backup and `sitemap.xml` (every product page) stay current. No token needed.

## Preview locally

```
python tools/serve.py
```

Then open http://localhost:8417.

## Photos

`tools/build.py` turns the original photographs in `../Shorecrest/Masters` into web images (`assets/img/photo`) and writes
`assets/js/catalog.js`. Captions and alt text live in `tools/scene-notes.json`. Requires `pip install pillow fonttools brotli`.

## What's where

```
index.html        home
shop.html         the shop (filters, search, places)
product.html      product pages (product.html?id=<Printify product ID>)
story.html        our story + the road map
faq.html          help, ordering, contact
404.html          lost page
assets/css/site.css
assets/js/        config, core (scroll, header, menus), store (catalog + cards), page scripts, hero water effect
assets/fonts/     Fraunces (headings) and Safi (the founder's handwriting, body text)
```
