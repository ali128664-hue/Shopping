// STORE backend — plain Node.js (18+), no npm packages needed.
// Run:  node server.js   then open http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const ROOT = __dirname;
loadEnv(path.join(ROOT, ".env"));
const db = require("./server/db");
const seo = require("./server/render");
const catalog = require("./server/catalog");
const countries = require("./server/countries");

const PORT = +process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const UPLOADS = path.join(db.DATA_DIR, "uploads");
const HOST = process.env.HOST || "0.0.0.0"; // 0.0.0.0 = reachable from phones on the same Wi-Fi

// addresses other devices on the same network can use (e.g. http://192.168.1.5:3000)
function lanUrls() {
  const real = [], virtual = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (!(a.family === "IPv4" || a.family === 4) || a.internal || a.address.startsWith("169.254.")) continue;
      // virtual adapters (WSL, VirtualBox, VPN…) are listed last
      (/vEthernet|VirtualBox|VMware|WSL|Hyper-V|docker|vbox|tailscale|zerotier|loopback/i.test(name) ? virtual : real).push(`http://${a.address}:${PORT}`);
    }
  }
  return [...real, ...virtual];
}

// ---------- store settings ----------
// starting coupons — managed in Admin → Coupons. Fixed amounts and minimums are in USD.
const DEFAULT_COUPONS = [
  { code: "WELCOME10", type: "percent", value: 10, min: 0 },
  { code: "SAVE20", type: "fixed", value: 20, min: 150 },
  { code: "FREESHIP", type: "shipping", value: 0, min: 0 }
].map((c) => ({ ...c, expires: null, maxUses: null, uses: 0, active: true }));
const DEFAULT_SETTINGS = { whatsapp: "", announcement: {}, popup: { enabled: true, code: "WELCOME10", delay: 8 } };

function coupons() { const st = db.load(); if (!Array.isArray(st.coupons)) { st.coupons = DEFAULT_COUPONS.map((c) => ({ ...c })); db.save(); } return st.coupons; }
function settings() {
  const st = db.load();
  if (!st.settings) { st.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); db.save(); }
  return st.settings;
}
const couponUsable = (c) => c && c.active && (!c.expires || new Date(c.expires + "T23:59:59") >= new Date()) && (c.maxUses === null || c.maxUses === undefined || c.uses < c.maxUses);
function reviews() { const st = db.load(); if (!Array.isArray(st.reviews)) st.reviews = []; return st.reviews; }
function ratingMap() {
  const m = {};
  reviews().filter((r) => r.status === "approved").forEach((r) => { const x = (m[r.productId] = m[r.productId] || { sum: 0, n: 0 }); x.sum += r.rating; x.n++; });
  return m;
}
function publicSettings(lang) {
  const s = settings(), pc = coupons().find((c) => c.code === s.popup.code);
  return {
    whatsapp: s.whatsapp.replace(/[^\d]/g, ""), announcement: (s.announcement && s.announcement[lang]) || "",
    popup: s.popup.enabled && couponUsable(pc) && pc.type === "percent" ? { code: pc.code, pct: pc.value, delay: s.popup.delay } : null
  };
}
const BANK = {
  bank: process.env.BANK_NAME || "Your Bank Name",
  title: process.env.BANK_TITLE || "STORE",
  iban: process.env.BANK_IBAN || "PK00 XXXX 0000 0000 0000 0000"
};
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const seoOverrides = () => { const st = db.load(); if (!st.seo) st.seo = {}; return st.seo; };
const localized = (lang) => {
  const d = seo.dictFor(lang, seoOverrides()), rm = ratingMap();
  return catalog.list().map((p) => { const r = rm[p.id]; return { ...catalog.localize(p, lang, d.productDesc), rating: r ? Math.round((r.sum / r.n) * 10) / 10 : 0, reviewCount: r ? r.n : 0 }; });
};

// ---------- pricing (always computed on the server, in the customer's currency) ----------
function quote({ items, coupon, shipping, country }) {
  const c = countries.list().find((x) => x.code === String(country || "").toUpperCase());
  if (!c) throw httpError(400, "Please choose a country we deliver to.");
  if (!Array.isArray(items) || !items.length) throw httpError(400, "Your cart is empty.");
  if (items.length > 50) throw httpError(400, "Too many items.");
  const R = (n) => countries.round(n, c.decimals);
  const lines = items.map((i) => {
    const p = catalog.list().find((x) => x.id === +i.id);
    const qty = Math.floor(+i.qty);
    if (!p) throw httpError(400, "A product in your cart is no longer available.");
    if (!(qty >= 1 && qty <= 20)) throw httpError(400, "Invalid quantity.");
    const price = countries.convert(p.price, c);
    return { id: p.id, name: catalog.nameOf(p), img: p.img, size: String(i.size || "").slice(0, 10), qty, price, total: R(price * qty), stock: p.stock };
  });
  const subtotal = R(lines.reduce((s, l) => s + l.total, 0));
  const method = shipping === "express" ? "express" : "standard";
  let shippingCost = c[method] || 0;
  if (method === "standard" && c.freeOver !== null && c.freeOver !== undefined && subtotal >= c.freeOver) shippingCost = 0;

  let discount = 0, couponApplied = null, couponError = null;
  const code = String(coupon || "").trim().toUpperCase();
  const k = code ? coupons().find((x) => x.code === code) : null;
  const min = k ? countries.convert(k.min || 0, c) : 0;
  if (code) {
    if (!couponUsable(k)) couponError = "invalid";
    else if (subtotal < min) couponError = "min";
    else {
      couponApplied = code;
      if (k.type === "percent") discount = R(subtotal * k.value / 100);
      if (k.type === "fixed") discount = Math.min(countries.convert(k.value, c), subtotal);
      if (k.type === "shipping") shippingCost = 0;
    }
  }
  return {
    country: c.code, currency: c.currency, decimals: c.decimals, rate: c.rate,
    lines, subtotal, discount: R(discount), shipping: R(shippingCost), shippingMethod: method, total: R(subtotal - discount + shippingCost),
    coupon: couponApplied, couponError, couponMin: min
  };
}

// ---------- validation ----------
const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
function validateCustomer(c = {}) {
  const out = {
    name: clean(c.name, 80), email: clean(c.email, 120).toLowerCase(), phone: clean(c.phone, 30),
    address: clean(c.address, 200), city: clean(c.city, 60), postal: clean(c.postal, 20)
  };
  const errors = {};
  if (out.name.length < 2) errors.name = "required";
  if (!isEmail(out.email)) errors.email = "invalid";
  if (!/^[+\d][\d\s\-()]{6,}$/.test(out.phone)) errors.phone = "invalid";
  if (out.address.length < 5) errors.address = "required";
  if (out.city.length < 2) errors.city = "required";
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
  currency: o.currency || "USD", decimals: o.decimals ?? 2, countryCode: o.countryCode,
  payment: o.payment, coupon: o.coupon, bank: o.payment === "bank" ? BANK : undefined
});
const usd = (o) => o.totalUSD ?? o.total; // orders before multi-currency were in USD

// ---------- API routes ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), handler });

// network details for the shop owner's own computer only (used to show the phone address)
route("GET", "/api/local-network", (req) => {
  const ra = req.socket.remoteAddress || "";
  if (!/^(::1|127\.|::ffff:127\.)/.test(ra)) throw httpError(404, "Not found");
  return { lanUrls: lanUrls(), interfaces: Object.fromEntries(Object.entries(os.networkInterfaces()).map(([n, l]) => [n, (l || []).filter((a) => a.family === "IPv4" || a.family === 4).map((a) => a.address)])) };
});
route("GET", "/api/config", () => ({ aiEnabled: !!GEMINI_API_KEY, bank: BANK, countries: countries.list().map(countries.publicCountry) }));
route("GET", "/api/products", (req, p, url) => { const lang = seo.CODES.includes(url.searchParams.get("lang")) ? url.searchParams.get("lang") : "en"; return localized(lang); });
route("POST", "/api/quote", async (req) => quote(await readBody(req)));

route("POST", "/api/orders", async (req) => {
  rateLimit("order:" + ip(req), 10, 60e3);
  const body = await readBody(req);
  const customer = validateCustomer(body.customer);
  const q = quote(body);
  const c = countries.get(q.country);
  const payments = ["bank", ...(c.cod ? ["cod"] : [])];
  if (!payments.includes(body.payment)) throw httpError(400, "Please choose a payment method.");
  if (q.couponError) throw httpError(400, "The coupon code is not valid for this order.");
  // stock check across lines of the same product
  const need = {};
  q.lines.forEach((l) => (need[l.id] = (need[l.id] || 0) + l.qty));
  for (const id in need) {
    const p = catalog.find(id);
    if (p.stock < need[id]) throw httpError(409, `Only ${p.stock} left of "${catalog.nameOf(p)}".`);
  }
  for (const id in need) catalog.find(id).stock -= need[id];
  if (q.coupon) { const k = coupons().find((x) => x.code === q.coupon); if (k) k.uses = (k.uses || 0) + 1; }
  const st = db.load();
  st.counters.order += 1;
  const now = new Date().toISOString();
  const order = {
    number: "ST-" + st.counters.order, createdAt: now, status: "pending", history: [{ status: "pending", at: now }],
    customer: { ...customer, country: c.name }, countryCode: c.code, lang: seo.CODES.includes(body.lang) ? body.lang : "en",
    notes: clean(body.notes, 500), payment: body.payment, coupon: q.coupon,
    currency: q.currency, decimals: q.decimals, rate: q.rate,
    items: q.lines.map(({ stock, ...l }) => l), subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, shippingMethod: q.shippingMethod, total: q.total,
    totalUSD: Math.round((q.total / q.rate) * 100) / 100
  };
  st.orders.push(order);
  db.save();
  console.log(`[order] ${order.number}  ${order.total} ${order.currency}  ${c.code}  ${customer.email}`);
  return publicOrder(order);
});

route("GET", "/api/orders/:number", (req, p, url) => {
  rateLimit("track:" + ip(req), 30, 60e3);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const o = db.load().orders.find((x) => x.number.toUpperCase() === decodeURIComponent(p.number).toUpperCase());
  if (!o || o.customer.email !== email) throw httpError(404, "We couldn't find an order with that number and email.");
  return publicOrder(o);
});

route("GET", "/api/reviews/:id", (req, p) => reviews().filter((r) => r.productId === +p.id && r.status === "approved").sort((a, b) => b.at.localeCompare(a.at)).map(({ name, rating, text, at, lang }) => ({ name, rating, text, at, lang })));
route("POST", "/api/reviews", async (req) => {
  rateLimit("review:" + ip(req), 3, 10 * 60e3);
  const b = await readBody(req);
  const r = { id: crypto.randomUUID(), productId: +b.productId, name: clean(b.name, 60), rating: Math.round(+b.rating), text: clean(b.text, 1500), lang: seo.CODES.includes(b.lang) ? b.lang : "en", at: new Date().toISOString(), status: "pending" };
  if (!catalog.find(r.productId)) throw httpError(404, "Product not found.");
  if (r.name.length < 2 || !(r.rating >= 1 && r.rating <= 5) || r.text.length < 5) throw httpError(422, "Please add your name, a rating and a short review.");
  reviews().push(r); db.save();
  return { ok: true };
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

async function imageBase64(src) {
  if (src.startsWith("/uploads/")) {
    const file = path.join(UPLOADS, path.basename(src));
    return { mime_type: MIME[path.extname(file)] || "image/jpeg", data: fs.readFileSync(file).toString("base64") };
  }
  const r = await fetch(src.replace("w=800", "w=512"));
  if (!r.ok) throw httpError(502, "Could not load a product image.");
  return { mime_type: r.headers.get("content-type") || "image/jpeg", data: Buffer.from(await r.arrayBuffer()).toString("base64") };
}

// AI try-on proxy — keeps the Gemini key on the server
route("POST", "/api/tryon", async (req) => {
  if (!GEMINI_API_KEY) throw httpError(503, "AI try-on is not configured on the server.");
  rateLimit("ai:" + ip(req), 6, 60e3);
  const b = await readBody(req, 6e6);
  const ids = (Array.isArray(b.items) ? b.items : []).slice(0, 5).map(Number);
  const list = catalog.list().filter((p) => ids.includes(p.id));
  if (!list.length || typeof b.mannequin !== "string") throw httpError(400, "Wear at least one item first.");
  const garments = await Promise.all(list.map(async (p) => ({ inline_data: await imageBase64(p.img) })));
  const prompt = `Photorealistic fashion studio photo. Dress the plain grey store mannequin in the FIRST image with the clothing items shown in the following images (${list.map((p) => catalog.nameOf(p)).join(", ")}). Keep the mannequin's pose, full-body framing and neutral light-grey studio background. The garments must fit naturally with realistic folds, shadows and fabric texture. Do not add a real person, face or text.`;
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
  const sum = (list) => Math.round(list.reduce((s, o) => s + usd(o), 0) * 100) / 100;
  const days = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10); return { day: d, total: sum(live.filter((o) => o.createdAt.startsWith(d))) }; });
  const sold = {}, byCountry = {};
  live.forEach((o) => { o.items.forEach((l) => (sold[l.id] = (sold[l.id] || 0) + l.qty)); const k = o.countryCode || "—"; byCountry[k] = byCountry[k] || { code: k, name: o.customer.country, orders: 0, revenue: 0 }; byCountry[k].orders++; byCountry[k].revenue += usd(o); });
  return {
    revenue: sum(live), orders: st.orders.length,
    pending: st.orders.filter((o) => o.status === "pending").length,
    todayRevenue: sum(live.filter((o) => o.createdAt.startsWith(today))),
    customers: new Set(st.orders.map((o) => o.customer.email)).size,
    subscribers: st.subscribers.length,
    unreadMessages: st.messages.filter((m) => !m.read).length,
    pendingReviews: reviews().filter((r) => r.status === "pending").length,
    lanUrls: lanUrls(),
    lowStock: catalog.list(true).filter((p) => p.stock <= 5).map((p) => ({ id: p.id, name: catalog.nameOf(p), stock: p.stock })),
    topProducts: Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, qty]) => { const p = catalog.find(id); return { id: +id, name: p ? catalog.nameOf(p) : `#${id}`, qty }; }),
    byCountry: Object.values(byCountry).map((x) => ({ ...x, revenue: Math.round(x.revenue * 100) / 100 })).sort((a, b) => b.revenue - a.revenue),
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
  if (dir) o.items.forEach((l) => { const prod = catalog.find(l.id); if (prod) prod.stock = Math.max(0, prod.stock + dir * l.qty); });
  o.status = status; o.history.push({ status, at: new Date().toISOString() });
  db.save();
  return o;
});

route("GET", "/api/admin/orders.csv", (req, p, url) => {
  if (!verify(url.searchParams.get("token"))) throw httpError(401, "Please log in again.");
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Order", "Date", "Status", "Name", "Email", "Phone", "City", "Country", "Items", "Payment", "Total", "Currency", "Total USD"]]
    .concat(db.load().orders.map((o) => [o.number, o.createdAt, o.status, o.customer.name, o.customer.email, o.customer.phone, o.customer.city, o.customer.country, o.items.map((l) => `${l.qty}x ${l.name} (${l.size})`).join("; "), o.payment, o.total, o.currency || "USD", usd(o)]));
  return { __raw: "﻿" + rows.map((r) => r.map(q).join(",")).join("\n"), type: "text/csv; charset=utf-8", file: "orders.csv" };
});

// products
route("GET", "/api/admin/products", (req) => { requireAdmin(req); return catalog.list(true); });
route("POST", "/api/admin/products", async (req) => { requireAdmin(req); return catalog.create(await readBody(req, 2e5)); });
route("PUT", "/api/admin/products/:id", async (req, p) => { requireAdmin(req); return catalog.update(p.id, await readBody(req, 2e5)); });
route("PATCH", "/api/admin/products/:id", async (req, p) => {
  requireAdmin(req);
  const b = await readBody(req), quick = {};
  ["price", "oldPrice", "stock", "active", "isNew"].forEach((k) => { if (b[k] !== undefined) quick[k] = b[k]; });
  return catalog.update(p.id, quick);
});
route("DELETE", "/api/admin/products/:id", (req, p) => { requireAdmin(req); catalog.remove(p.id); return { ok: true }; });

route("POST", "/api/admin/upload", async (req) => {
  requireAdmin(req);
  const { dataUrl } = await readBody(req, 8e6);
  const m = String(dataUrl || "").match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw httpError(400, "Please upload a JPG, PNG or WebP image.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 5e6) throw httpError(413, "Image is too large (max 5 MB).");
  fs.mkdirSync(UPLOADS, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return { url: "/uploads/" + name };
});

// countries
route("GET", "/api/admin/countries", (req) => { requireAdmin(req); return { countries: countries.all(), languages: seo.LANGS }; });
route("PUT", "/api/admin/countries/:code", async (req, p) => {
  requireAdmin(req);
  const b = await readBody(req), list = countries.all(), code = p.code.toUpperCase();
  const i = list.findIndex((c) => c.code === code);
  if (b.lang !== undefined && !seo.CODES.includes(b.lang)) throw httpError(400, "Unknown language.");
  if (i < 0) {
    Object.keys(b).forEach((k) => { if (b[k] === "") delete b[k]; });
    const c = countries.validate({ active: true, cod: false, decimals: 2, standard: 0, express: 0, freeOver: null, standardDays: "3-5", expressDays: "1-2", lang: "en", ...b, code });
    if (!c.name || !c.currency || !c.rate) throw httpError(400, "Name, currency and exchange rate are required.");
    list.push(c); db.save(); return c;
  }
  list[i] = countries.validate(b, list[i]);
  if (!countries.list().length) { list[i].active = true; throw httpError(400, "At least one country must stay active."); }
  db.save(); return list[i];
});

// SEO texts per language
route("GET", "/api/admin/seo", (req) => {
  requireAdmin(req);
  const defaults = Object.fromEntries(seo.CODES.map((l) => [l, Object.fromEntries(seo.SEO_KEYS.map((k) => [k, seo.DICTS[l][k]]))]));
  return { keys: seo.SEO_KEYS, languages: seo.LANGS, defaults, overrides: seoOverrides() };
});
route("PUT", "/api/admin/seo/:lang", async (req, p) => {
  requireAdmin(req);
  if (!seo.CODES.includes(p.lang)) throw httpError(404, "Unknown language.");
  const b = await readBody(req), o = seoOverrides(), cur = { ...(o[p.lang] || {}) };
  for (const k of seo.SEO_KEYS) {
    if (b[k] === undefined) continue;
    const v = clean(b[k], 320);
    if (!v || v === seo.DICTS[p.lang][k]) delete cur[k]; else cur[k] = v;
    if ((k === "metaCatDesc" && v && !v.includes("{cat}")) || (k === "metaProductDesc" && v && !(v.includes("{name}") && v.includes("{price}")))) throw httpError(400, `${k} must keep the ${k === "metaCatDesc" ? "{cat}" : "{name} and {price}"} placeholder.`);
  }
  Object.keys(cur).length ? (o[p.lang] = cur) : delete o[p.lang];
  db.save(); return o[p.lang] || {};
});

route("GET", "/api/admin/settings", (req) => { requireAdmin(req); return { settings: settings(), languages: seo.LANGS, coupons: coupons().map((c) => c.code) }; });
route("PUT", "/api/admin/settings", async (req) => {
  requireAdmin(req);
  const b = await readBody(req), s = settings();
  if (b.whatsapp !== undefined) { const w = clean(b.whatsapp, 20); if (w && !/^\+?[\d\s-]{8,20}$/.test(w)) throw httpError(400, "WhatsApp number must be in international format, e.g. +92 300 1234567."); s.whatsapp = w; }
  if (b.announcement) for (const l of seo.CODES) if (b.announcement[l] !== undefined) { const v = clean(b.announcement[l], 160); v ? (s.announcement[l] = v) : delete s.announcement[l]; }
  if (b.popup) {
    if (b.popup.enabled !== undefined) s.popup.enabled = !!b.popup.enabled;
    if (b.popup.code !== undefined) s.popup.code = clean(b.popup.code, 30).toUpperCase();
    if (b.popup.delay !== undefined) s.popup.delay = Math.min(120, Math.max(0, Math.floor(+b.popup.delay || 0)));
  }
  db.save(); return s;
});
route("GET", "/api/admin/coupons", (req) => { requireAdmin(req); return coupons(); });
route("PUT", "/api/admin/coupons/:code", async (req, p) => {
  requireAdmin(req);
  const code = decodeURIComponent(p.code).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw httpError(400, "Code must be 3–30 letters/numbers (e.g. EID25).");
  const b = await readBody(req), list = coupons();
  const cur = list.find((c) => c.code === code) || { code, uses: 0, active: true, expires: null, maxUses: null, min: 0, value: 0, type: "percent" };
  if (b.type !== undefined) { if (!["percent", "fixed", "shipping"].includes(b.type)) throw httpError(400, "Invalid type."); cur.type = b.type; }
  if (b.value !== undefined) { const v = +b.value; if (!(v >= 0) || (cur.type === "percent" && v > 90)) throw httpError(400, "Invalid discount value (percent max 90)."); cur.value = v; }
  if (b.min !== undefined) { const v = +b.min || 0; if (v < 0) throw httpError(400, "Invalid minimum."); cur.min = v; }
  if (b.expires !== undefined) { if (b.expires && !/^\d{4}-\d{2}-\d{2}$/.test(b.expires)) throw httpError(400, "Invalid expiry date."); cur.expires = b.expires || null; }
  if (b.maxUses !== undefined) cur.maxUses = b.maxUses === "" || b.maxUses === null ? null : Math.max(1, Math.floor(+b.maxUses));
  if (b.active !== undefined) cur.active = !!b.active;
  if (cur.type !== "shipping" && !(cur.value > 0)) throw httpError(400, "Enter a discount value.");
  if (!list.includes(cur)) list.push(cur);
  db.save(); return cur;
});
route("DELETE", "/api/admin/coupons/:code", (req, p) => { requireAdmin(req); const list = coupons(), i = list.findIndex((c) => c.code === decodeURIComponent(p.code)); if (i < 0) throw httpError(404, "Not found."); list.splice(i, 1); db.save(); return { ok: true }; });
route("GET", "/api/admin/reviews", (req) => { requireAdmin(req); return [...reviews()].reverse().map((r) => { const prod = catalog.find(r.productId); return { ...r, product: prod ? catalog.nameOf(prod) : `#${r.productId}`, img: prod && prod.img }; }); });
route("PATCH", "/api/admin/reviews/:id", async (req, p) => {
  requireAdmin(req);
  const { status } = await readBody(req), r = reviews().find((x) => x.id === p.id);
  if (!r) throw httpError(404, "Not found.");
  if (!["approved", "pending", "hidden"].includes(status)) throw httpError(400, "Invalid status.");
  r.status = status; db.save(); return r;
});
route("DELETE", "/api/admin/reviews/:id", (req, p) => { requireAdmin(req); const list = reviews(), i = list.findIndex((x) => x.id === p.id); if (i < 0) throw httpError(404, "Not found."); list.splice(i, 1); db.save(); return { ok: true }; });

route("GET", "/api/admin/messages", (req) => { requireAdmin(req); const st = db.load(); return { messages: [...st.messages].reverse(), subscribers: [...st.subscribers].reverse() }; });
route("PATCH", "/api/admin/messages/:id", (req, p) => { requireAdmin(req); const m = db.load().messages.find((x) => x.id === p.id); if (!m) throw httpError(404, "Not found."); m.read = true; db.save(); return m; });

// ---------- static files ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webp": "image/webp", ".json": "application/json" };
const PUBLIC = [/^\/favicon\.svg$/, /^\/admin\.html$/, /^\/css\/[\w.-]+$/, /^\/js\/(?!config\.js$)[\w.-]+$/, /^\/assets\/[\w./-]+$/];
function serveStatic(req, res, pathname) {
  if (pathname === "/admin") pathname = "/admin.html";
  // the browser-only key file is never served; the server keeps the key in .env instead
  if (pathname === "/js/config.js") { res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }); return res.end("window.STORE_CONFIG = {};"); }
  let file;
  if (/^\/uploads\/[\w-]+\.(jpg|png|webp)$/.test(pathname)) file = path.join(UPLOADS, path.basename(pathname));
  else if (PUBLIC.some((r) => r.test(pathname)) && !pathname.includes("..")) file = path.join(ROOT, pathname);
  else return send(res, 404, "Not found");
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, "Not found");
    const isUpload = pathname.startsWith("/uploads/");
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": isUpload ? "public, max-age=31536000, immutable" : "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(buf);
  });
}

// ---------- pages (SEO: one URL per language and page) ----------
function servePage(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(res, 400, "Bad request"); }
  if (pathname === "/") {
    // saved country decides the language; otherwise the browser language
    const saved = countries.list().find((c) => c.code === countries.cookie(req, "country").toUpperCase());
    const lang = saved ? saved.lang : seo.pickLanguage(req.headers["accept-language"]);
    res.writeHead(302, { Location: `/${lang}`, Vary: "Accept-Language, Cookie" }); return res.end();
  }
  if (pathname === "/sitemap.xml") return send(res, 200, seo.sitemap(catalog.list()), { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
  if (pathname === "/robots.txt") return send(res, 200, seo.robots(), { "Cache-Control": "public, max-age=3600" });
  if (/\.\w{2,5}$/.test(pathname) || pathname === "/admin") return serveStatic(req, res, pathname);
  if (pathname.length > 1 && pathname.endsWith("/")) { res.writeHead(301, { Location: pathname.replace(/\/+$/, "") + url.search }); return res.end(); }
  const all = catalog.list();
  let route = seo.resolve(pathname, all);
  if (!route) {
    // old or language-less links like /shop → send them to the visitor's language
    const lang = seo.pickLanguage(req.headers["accept-language"]);
    const guess = seo.resolve(`/${lang}${pathname}`, all);
    if (guess && guess.page !== "404") { res.writeHead(301, { Location: `/${lang}${pathname}${url.search}` }); return res.end(); }
    route = { lang, page: "404" };
  }
  const dict = seo.dictFor(route.lang, seoOverrides());
  const country = countries.publicCountry(countries.pick(req, route.lang));
  const html = seo.renderPage(route, {
    dict, country,
    countries: countries.list().map(countries.publicCountry),
    products: localized(route.lang),
    settings: publicSettings(route.lang),
    reviews: route.page === "product" ? reviews().filter((r) => r.productId === +route.arg && r.status === "approved").slice(-5) : []
  });
  res.writeHead(route.page === "404" ? 404 : 200, { "Content-Type": "text/html; charset=utf-8", "Content-Language": route.lang, "Cache-Control": "no-cache", Vary: "Cookie", "X-Content-Type-Options": "nosniff" });
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
  catalog.all(); countries.all(); coupons(); settings(); reviews(); db.save(); // create/upgrade the database on start
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") console.error(`\n  ✖ Port ${PORT} is already in use — the store is probably already running in another window. Close it first.\n`);
    else console.error(e);
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    console.log(`\n  STORE is running →  http://localhost:${PORT}   (${seo.CODES.length} languages, ${countries.list().length} countries)`);
    const lan = lanUrls();
    if (lan.length) console.log(`  On your phone    →  ${lan.join("   or   ")}   (same Wi-Fi)`);
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
