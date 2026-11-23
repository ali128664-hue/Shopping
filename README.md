# STORE — Premium Menswear E-commerce

A complete bilingual (English / Arabic RTL) fashion store with checkout, order tracking, an admin panel and an AI fitting room.
The backend is plain Node.js, so there is nothing to `npm install`.

## Run it

1. Install Node.js 18 or newer from https://nodejs.org (on Windows you can simply double-click `start-store.bat`)
2. Copy `.env.example` to `.env` and set at least `ADMIN_PASSWORD` (and `GEMINI_API_KEY` for the AI fitting room)
3. In this folder run:

```bash
node server.js
```

4. Open the store at http://localhost:3000 and the admin panel at http://localhost:3000/admin

Orders, stock changes, messages and subscribers are saved in `data/db.json`.

## Features

**Store**
- Home: hero, features, curated edits, new arrivals, categories, best sellers, promo, testimonials, newsletter
- Shop with category filter, search, sorting; product pages with size, quantity, stock warnings
- Cart (saved in the browser), wishlist, search popup (Ctrl+K), dark mode, English ⇄ Arabic (RTL)
- Fitting room: tap the hanger on a product to dress the mannequin; “Generate realistic look” uses Google Gemini through the server (the key never reaches the browser)

**Checkout**
- Contact + shipping address form with validation
- Standard / express shipping (standard is free over $75)
- Cash on delivery or bank transfer (bank details come from `.env`)
- Coupons: `WELCOME10` (10% off), `SAVE20` ($20 off orders over $150), `FREESHIP`
- Prices, discounts, shipping and stock are always calculated on the server
- Order confirmation page and order tracking (order number + email)

**Admin panel** (`/admin`)
- Dashboard: revenue, today’s sales, 14-day chart, top products, low stock, unread messages
- Orders: filter by status, search, change status (cancelling returns stock), order details, CSV export
- Products: edit price, sale price, stock, show/hide
- Contact messages and newsletter subscribers

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/config` | Shipping, payment and AI settings |
| GET | `/api/products` | Products with live price and stock |
| POST | `/api/quote` | Totals for a cart, coupon and shipping method |
| POST | `/api/orders` | Place an order |
| GET | `/api/orders/:number?email=` | Track an order |
| POST | `/api/contact`, `/api/newsletter` | Contact form, newsletter |
| POST | `/api/tryon` | AI fitting room (needs `GEMINI_API_KEY`) |
| * | `/api/admin/...` | Admin endpoints (login required) |

## Notes

- `.env`, `data/` and `js/config.js` are git-ignored — never commit keys or customer data.
- Opening `index.html` directly (without the server) still shows the store, but orders need the server.
- Online card payments (e.g. Stripe) and order emails are not included yet.
- Product data lives in `js/data.js`; images are from Unsplash.
