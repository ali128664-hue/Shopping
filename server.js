// STORE backend — plain Node.js (18+), no npm packages needed.
// Run:  node server.js   then open http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = __dirname;
loadEnv(path.join(ROOT, ".env"));
const db = require("./server/db");
const seo = require("./server/render");

const PORT = +process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const DEFAULT_STOCK = 25;

// ---------- store settings ----------
const SHIPPING = {
  standard: { price: 9, freeOver: 75, days: "3-5" },
  express: { price: 19, freeOver: null, days: "1-2" }
};
const PAYMENTS = ["cod", "bank"];
const COUPONS = {
  WELCOME10: { type: "percent", value: 10, min: 0 },
  SAVE20: { type: "fixed", value: 20, min: 150 },
  FREESHIP: { type: "shipping", value: 0, min: 0 }
};
const BANK = {
  bank: process.env.BANK_NAME || "Your Bank Name",
  title: process.env.BANK_TITLE || "STORE",
  iban: process.env.BANK_IBAN || "PK00 XXXX 0000 0000 0000 0000"
};
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

// ---------- products: js/data.js is the catalog, db keeps price/stock edits ----------
const CATALOG = (() => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8"), ctx);
  return ctx.window.PRODUCTS;
})();

function products(includeInactive = false) {
  const st = db.load();
  return CATALOG.map((p) => {
    const o = st.products[p.id] || {};
    return {
      id: p.id, cat: p.cat, en: seo.DICTS.en["p" + p.id], img: p.img, rating: p.rating, isNew: !!p.isNew,
      price: o.price ?? p.price,
      oldPrice: o.oldPrice !== undefined ? o.oldPrice : (p.oldPrice ?? null),
      stock: o.stock ?? DEFAULT_STOCK,
      active: o.active ?? true
    };
  }).filter((p) => includeInactive || p.active);
}

// ---------- pricing (always computed on the server) ----------
function quote({ items, coupon, shipping }) {
  if (!Array.isArray(items) || !items.length) throw httpError(400, "Your cart is empty.");
  if (items.length > 50) throw httpError(400, "Too many items.");
  const list = products();
  const lines = items.map((i) => {
    const p = list.find((x) => x.id === +i.id);
    const qty = Math.floor(+i.qty);
    if (!p) throw httpError(400, "A product in your cart is no longer available.");
    if (!(qty >= 1 && qty <= 20)) throw httpError(400, "Invalid quantity.");
    return { id: p.id, name: p.en, img: p.img, size: String(i.size || "").slice(0, 10), qty, price: p.price, total: p.price * qty, stock: p.stock };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const method = SHIPPING[shipping] ? shipping : "standard";
  const ship = SHIPPING[method];
  let shippingCost = ship.freeOver !== null && subtotal >= ship.freeOver ? 0 : ship.price;

  let discount = 0, couponApplied = null, couponError = null;
  const code = String(coupon || "").trim().toUpperCase();
  if (code) {
    const c = COUPONS[code];
    if (!c) couponError = "invalid";
    else if (subtotal < c.min) couponError = "min";
    else {
      couponApplied = code;
      if (c.type === "percent") discount = Math.round(subtotal * c.value) / 100;
      if (c.type === "fixed") discount = Math.min(c.value, subtotal);
      if (c.type === "shipping") shippingCost = 0;
    }
  }
  const round = (n) => Math.round(n * 100) / 100;
  return { lines, subtotal: round(subtotal), discount: round(discount), shipping: round(shippingCost), shippingMethod: method, total: round(subtotal - discount + shippingCost), coupon: couponApplied, couponError, couponMin: code && COUPONS[code] ? COUPONS[code].min : 0 };
}

// ---------- validation ----------
const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
function validateCustomer(c = {}) {
  const out = {
    name: clean(c.name, 80), email: clean(c.email, 120).toLowerCase(), phone: clean(c.phone, 30),
    address: clean(c.address, 200), city: clean(c.city, 60), country: clean(c.country, 60), postal: clean(c.postal, 20)
  };
  const errors = {};
  if (out.name.length < 2) errors.name = "required";
  if (!isEmail(out.email)) errors.email = "invalid";
  if (!/^[+\d][\d\s\-()]{6,}$/.test(out.phone)) errors.phone = "invalid";
  if (out.address.length < 5) errors.address = "required";
  if (out.city.length < 2) errors.city = "required";
  if (out.country.length < 2) errors.country = "required";
  if (Object.keys(errors).length) { const e = httpError(422, "Please check the highlighted fields."); e.fields = errors; throw e; }
  return out;
}

// ---------- auth ----------
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body + "." + crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
}
function verify(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const good = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  return data.exp > Date.now() ? data : null;
}
function requireAdmin(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!verify(token)) throw httpError(401, "Please log in again.");
}
const attempts = new Map();
function rateLimit(key, max, ms) {
  const now = Date.now(), list = (attempts.get(key) || []).filter((t) => now - t < ms);
  if (list.length >= max) throw httpError(429, "Too many attempts. Please wait a minute.");
  list.push(now); attempts.set(key, list);
}
function safeEqual(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// ---------- helpers ----------
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
function send(res, status, data, headers = {}) {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  res.writeHead(status, { "Content-Type": typeof data === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}
function readBody(req, limit = 1e5) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(httpError(413, "Request too large.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(httpError(400, "Invalid JSON.")); } });
    req.on("error", reject);
  });
}
function ip(req) { return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(); }
const publicOrder = (o) => ({
  number: o.number, createdAt: o.createdAt, status: o.status, history: o.history,
  customer: { name: o.customer.name, city: o.customer.city, country: o.customer.country, address: o.customer.address, email: o.customer.email },
  items: o.items, subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, shippingMethod: o.shippingMethod, total: o.total,
  payment: o.payment, coupon: o.coupon, bank: o.payment === "bank" ? BANK : undefined
});

// ---------- API routes ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), handler });

route("GET", "/api/config", () => ({ aiEnabled: !!GEMINI_API_KEY, shipping: SHIPPING, payments: PAYMENTS, bank: BANK, currency: "USD" }));
route("GET", "/api/products", () => products());
route("POST", "/api/quote", async (req) => quote(await readBody(req)));

route("POST", "/api/orders", async (req) => {
  rateLimit("order:" + ip(req), 10, 60e3);
  const body = await readBody(req);
  const customer = validateCustomer(body.customer);
  if (!PAYMENTS.includes(body.payment)) throw httpError(400, "Please choose a payment method.");
  const q = quote(body);
  if (q.couponError) throw httpError(400, "The coupon code is not valid for this order.");
  const st = db.load();
  // stock check across lines of the same product
  const need = {};
  q.lines.forEach((l) => (need[l.id] = (need[l.id] || 0) + l.qty));
  for (const id in need) {
    const p = products().find((x) => x.id === +id);
    if (p.stock < need[id]) throw httpError(409, `Only ${p.stock} left of "${p.en}".`);
  }
  for (const id in need) {
    const p = products(true).find((x) => x.id === +id);
    st.products[id] = { ...(st.products[id] || {}), stock: p.stock - need[id] };
  }
  st.counters.order += 1;
  const now = new Date().toISOString();
  const order = {
    number: "ST-" + st.counters.order, createdAt: now, status: "pending", history: [{ status: "pending", at: now }],
    customer, notes: clean(body.notes, 500), payment: body.payment, coupon: q.coupon,
    items: q.lines.map(({ stock, ...l }) => l), subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, shippingMethod: q.shippingMethod, total: q.total
  };
  st.orders.push(order);
  db.save();
  console.log(`[order] ${order.number}  $${order.total}  ${customer.email}`);
  return publicOrder(order);
});

route("GET", "/api/orders/:number", (req, p, url) => {
  rateLimit("track:" + ip(req), 30, 60e3);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const o = db.load().orders.find((x) => x.number.toUpperCase() === decodeURIComponent(p.number).toUpperCase());
  if (!o || o.customer.email !== email) throw httpError(404, "We couldn't find an order with that number and email.");
  return publicOrder(o);
});

route("POST", "/api/contact", async (req) => {
  rateLimit("contact:" + ip(req), 5, 60e3);
  const b = await readBody(req);
  const m = { name: clean(b.name, 80), email: clean(b.email, 120), message: clean(b.message, 2000), at: new Date().toISOString(), read: false };
  if (m.name.length < 2 || !isEmail(m.email) || m.message.length < 3) throw httpError(422, "Please fill in all fields.");
  const st = db.load(); st.messages.push({ id: crypto.randomUUID(), ...m }); db.save();
  return { ok: true };
});

route("POST", "/api/newsletter", async (req) => {
  rateLimit("news:" + ip(req), 5, 60e3);
  const email = clean((await readBody(req)).email, 120).toLowerCase();
  if (!isEmail(email)) throw httpError(422, "Please enter a valid email.");
  const st = db.load();
  if (!st.subscribers.some((s) => s.email === email)) { st.subscribers.push({ email, at: new Date().toISOString() }); db.save(); }
  return { ok: true };
});

// AI try-on proxy — keeps the Gemini key on the server
route("POST", "/api/tryon", async (req) => {
  if (!GEMINI_API_KEY) throw httpError(503, "AI try-on is not configured on the server.");
  rateLimit("ai:" + ip(req), 6, 60e3);
  const b = await readBody(req, 6e6);
  const ids = (Array.isArray(b.items) ? b.items : []).slice(0, 5).map(Number);
  const list = products().filter((p) => ids.includes(p.id));
  if (!list.length || typeof b.mannequin !== "string") throw httpError(400, "Wear at least one item first.");
  const garments = await Promise.all(list.map(async (p) => {
    const r = await fetch(p.img.replace("w=800", "w=512"));
    if (!r.ok) throw httpError(502, "Could not load a product image.");
    return { inline_data: { mime_type: r.headers.get("content-type") || "image/jpeg", data: Buffer.from(await r.arrayBuffer()).toString("base64") } };
  }));
  const prompt = `Photorealistic fashion studio photo. Dress the plain grey store mannequin in the FIRST image with the clothing items shown in the following images (${list.map((p) => p.en).join(", ")}). Keep the mannequin's pose, full-body framing and neutral light-grey studio background. The garments must fit naturally with realistic folds, shadows and fabric texture. Do not add a real person, face or text.`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/png", data: b.mannequin } }, ...garments] }] })
  });
  const j = await r.json().catch(() => ({}));
  const part = j?.candidates?.[0]?.content?.parts?.find((x) => x.inline_data || x.inlineData);
  const data = part && (part.inline_data || part.inlineData);
  if (!r.ok || !data) { console.warn("[ai]", r.status, j?.error?.message || "no image"); throw httpError(502, j?.error?.message || "The AI did not return an image."); }
  return { image: `data:${data.mime_type || data.mimeType || "image/png"};base64,${data.data}` };
});

// ---------- admin ----------
route("POST", "/api/admin/login", async (req) => {
  rateLimit("login:" + ip(req), 5, 60e3);
  const { password } = await readBody(req);
  if (!safeEqual(password || "", ADMIN_PASSWORD)) throw httpError(401, "Wrong password.");
  return { token: sign({ role: "admin", exp: Date.now() + 12 * 3600e3 }) };
});

route("GET", "/api/admin/stats", (req) => {
  requireAdmin(req);
  const st = db.load(), live = st.orders.filter((o) => o.status !== "cancelled");
  const today = new Date().toISOString().slice(0, 10);
  const days = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10); return { day: d, total: live.filter((o) => o.createdAt.startsWith(d)).reduce((s, o) => s + o.total, 0) }; });
  const sold = {};
  live.forEach((o) => o.items.forEach((l) => (sold[l.id] = (sold[l.id] || 0) + l.qty)));
  return {
    revenue: live.reduce((s, o) => s + o.total, 0),
    orders: st.orders.length,
    pending: st.orders.filter((o) => o.status === "pending").length,
    todayRevenue: live.filter((o) => o.createdAt.startsWith(today)).reduce((s, o) => s + o.total, 0),
    customers: new Set(st.orders.map((o) => o.customer.email)).size,
    subscribers: st.subscribers.length,
    unreadMessages: st.messages.filter((m) => !m.read).length,
    lowStock: products(true).filter((p) => p.stock <= 5).map((p) => ({ id: p.id, name: p.en, stock: p.stock })),
    topProducts: Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, qty]) => ({ id: +id, name: seo.DICTS.en["p" + id], qty })),
    days
  };
});

route("GET", "/api/admin/orders", (req) => { requireAdmin(req); return [...db.load().orders].reverse(); });

route("PATCH", "/api/admin/orders/:number", async (req, p) => {
  requireAdmin(req);
  const { status } = await readBody(req);
  if (!STATUSES.includes(status)) throw httpError(400, "Invalid status.");
  const st = db.load(), o = st.orders.find((x) => x.number === p.number);
  if (!o) throw httpError(404, "Order not found.");
  if (o.status === status) return o;
  // give stock back when cancelling, take it again when un-cancelling
  const dir = status === "cancelled" ? 1 : o.status === "cancelled" ? -1 : 0;
  if (dir) o.items.forEach((l) => { const cur = products(true).find((x) => x.id === l.id); st.products[l.id] = { ...(st.products[l.id] || {}), stock: Math.max(0, cur.stock + dir * l.qty) }; });
  o.status = status; o.history.push({ status, at: new Date().toISOString() });
  db.save();
  return o;
});

route("GET", "/api/admin/orders.csv", (req, p, url) => {
  const token = url.searchParams.get("token");
  if (!verify(token)) throw httpError(401, "Please log in again.");
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Order", "Date", "Status", "Name", "Email", "Phone", "City", "Country", "Items", "Payment", "Total"]]
    .concat(db.load().orders.map((o) => [o.number, o.createdAt, o.status, o.customer.name, o.customer.email, o.customer.phone, o.customer.city, o.customer.country, o.items.map((l) => `${l.qty}x ${l.name} (${l.size})`).join("; "), o.payment, o.total]));
  return { __raw: rows.map((r) => r.map(q).join(",")).join("\n"), type: "text/csv; charset=utf-8", file: "orders.csv" };
});

route("GET", "/api/admin/products", (req) => { requireAdmin(req); return products(true); });

route("PATCH", "/api/admin/products/:id", async (req, p) => {
  requireAdmin(req);
  const id = +p.id; if (!CATALOG.some((x) => x.id === id)) throw httpError(404, "Product not found.");
  const b = await readBody(req), st = db.load(), cur = { ...(st.products[id] || {}) };
  if (b.price !== undefined) { const v = +b.price; if (!(v > 0 && v < 1e6)) throw httpError(400, "Invalid price."); cur.price = Math.round(v * 100) / 100; }
  if (b.oldPrice !== undefined) { const v = b.oldPrice === null || b.oldPrice === "" ? null : +b.oldPrice; if (v !== null && !(v > 0)) throw httpError(400, "Invalid old price."); cur.oldPrice = v; }
  if (b.stock !== undefined) { const v = Math.floor(+b.stock); if (!(v >= 0 && v < 1e6)) throw httpError(400, "Invalid stock."); cur.stock = v; }
  if (b.active !== undefined) cur.active = !!b.active;
  st.products[id] = cur; db.save();
  return products(true).find((x) => x.id === id);
});

route("GET", "/api/admin/messages", (req) => { requireAdmin(req); const st = db.load(); return { messages: [...st.messages].reverse(), subscribers: [...st.subscribers].reverse() }; });
route("PATCH", "/api/admin/messages/:id", (req, p) => { requireAdmin(req); const m = db.load().messages.find((x) => x.id === p.id); if (!m) throw httpError(404, "Not found."); m.read = true; db.save(); return m; });

// ---------- static files ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webp": "image/webp", ".json": "application/json" };
const PUBLIC = [/^\/favicon\.svg$/, /^\/admin\.html$/, /^\/css\/[\w.-]+$/, /^\/js\/(?!config\.js$)[\w.-]+$/, /^\/assets\/[\w./-]+$/];
function serveStatic(req, res, pathname) {
  if (pathname === "/admin") pathname = "/admin.html";
  // the browser-only key file is never served; the server keeps the key in .env instead
  if (pathname === "/js/config.js") { res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }); return res.end("window.STORE_CONFIG = {};"); }
  if (!PUBLIC.some((r) => r.test(pathname)) || pathname.includes("..")) return send(res, 404, "Not found");
  const file = path.join(ROOT, pathname);
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(buf);
  });
}

// ---------- pages (SEO: one URL per language and page) ----------
function servePage(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(res, 400, "Bad request"); }
  if (pathname === "/") {
    const lang = seo.pickLanguage(req.headers["accept-language"]);
    res.writeHead(302, { Location: `/${lang}`, Vary: "Accept-Language" }); return res.end();
  }
  if (pathname === "/sitemap.xml") return send(res, 200, seo.sitemap(products()), { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
  if (pathname === "/robots.txt") return send(res, 200, seo.robots(), { "Cache-Control": "public, max-age=3600" });
  if (/\.\w{2,5}$/.test(pathname) || pathname === "/admin") return serveStatic(req, res, pathname);
  if (pathname.length > 1 && pathname.endsWith("/")) { res.writeHead(301, { Location: pathname.replace(/\/+$/, "") + url.search }); return res.end(); }
  const list = products();
  let route = seo.resolve(pathname, list);
  if (!route) {
    // old or language-less links like /shop → send them to the visitor's language
    const lang = seo.pickLanguage(req.headers["accept-language"]);
    const guess = seo.resolve(`/${lang}${pathname}`, list);
    if (guess && guess.page !== "404") { res.writeHead(301, { Location: `/${lang}${pathname}${url.search}` }); return res.end(); }
    route = { lang, page: "404" };
  }
  const html = seo.renderPage(route, list);
  res.writeHead(route.page === "404" ? 404 : 200, { "Content-Type": "text/html; charset=utf-8", "Content-Language": route.lang, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
  res.end(req.method === "HEAD" ? undefined : html);
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    return servePage(req, res, url);
  }
  for (const r of routes) {
    const m = r.method === req.method && url.pathname.match(r.re);
    if (!m) continue;
    try {
      const out = await r.handler(req, m.groups || {}, url);
      if (out && out.__raw !== undefined) return send(res, 200, out.__raw, { "Content-Type": out.type, "Content-Disposition": `attachment; filename="${out.file}"` });
      return send(res, 200, out);
    } catch (e) {
      if (!e.status) console.error(e);
      return send(res, e.status || 500, { error: e.status ? e.message : "Something went wrong.", fields: e.fields });
    }
  }
  send(res, 404, { error: "Not found" });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n  STORE is running →  http://localhost:${PORT}   (${seo.CODES.length} languages)`);
    console.log(`  Admin panel      →  http://localhost:${PORT}/admin`);
    console.log(`  AI try-on        →  ${GEMINI_API_KEY ? "enabled" : "disabled (add GEMINI_API_KEY to .env)"}`);
    if (!process.env.ADMIN_PASSWORD) console.log("  ⚠  Using default admin password 'admin123' — set ADMIN_PASSWORD in .env");
    console.log("");
  });
}
module.exports = server;

// minimal .env loader
function loadEnv(file) {
  try {
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    });
  } catch {}
}
