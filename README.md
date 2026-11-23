# STORE — Premium Menswear E-commerce

A responsive, bilingual (English / Arabic with RTL) fashion store front-end, with a clean, light, card-based design.

## Features
- Home: hero, features strip, shop-by-category, featured products, promo banner, newsletter
- Shop: category filters, search, price sorting
- Product page: size & quantity selection, related products
- Cart: quantity update, remove, subtotal / free shipping over $75 (saved in localStorage)
- About & Contact pages
- Fitting room: tap the hanger on any product to dress the mannequin; add your own Google Gemini API key for a realistic AI try-on (key stays in your browser, or put it in a local `js/config.js` — see `js/config.example.js`; that file is git-ignored)
- Search popup (Ctrl+K), wishlist, English ⇄ Arabic (RTL), light / dark mode, mobile menu

## Tech
Plain HTML, CSS and JavaScript — no build step, no dependencies.

## Run locally
```bash
python3 -m http.server 8000
# open http://localhost:8000/#/en
```

## Deploy
Works as-is on GitHub Pages, Netlify or Vercel (static site). Product data lives in `js/data.js`.

Images are from Unsplash.
