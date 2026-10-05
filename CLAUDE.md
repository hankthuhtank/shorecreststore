# Working rules for this repo

- Work directly on `main`. Do not create branches or open pull requests unless the owner asks. Pushing to `main` deploys shorecrest.store.
- Plain HTML/CSS/JS, no build step for the site. Products load at runtime from the Worker (`apiBase` in `assets/js/config.js`), with `assets/js/catalog-snapshot.js` as the fallback.
- Never put API tokens or secrets in this repo. The Printify token lives only on the Worker.

## Style rules from the owner

- Headings use Fraunces; body text uses Safi (the founder's handwriting). Keep both.
- No eyebrow labels above headings, no small uppercase letter-spaced or monospace labels, no "big number + label" stat rows, no icon feature grids. Write counts and labels in normal sentence case.
- Keep the homepage short and calm. No long scroll-pinned sequences or dramatic effects.
- Write like a person: plain, specific sentences. Avoid stock marketing phrases.
