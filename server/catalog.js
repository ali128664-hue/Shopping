// Product catalog stored in the database, with names, descriptions and SEO text per language.
// On first start it is filled from js/data.js and the product names in i18n/*.json.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const db = require("./db");

const ROOT = path.join(__dirname, "..");
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "languages.json"), "utf8")).map((l) => l.code);
const CATEGORIES = ["tshirts", "hoodies", "jackets", "pants", "shirts", "shoes", "hats"];

function seedProducts(st) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8"), ctx);
  const dicts = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", l + ".json"), "utf8"))]));
  const old = st.products || {}; // price/stock edits from earlier versions
  return ctx.window.PRODUCTS.map((p) => {
    const o = old[p.id] || {};
    const names = {};
    LANGS.forEach((l) => { if (dicts[l]["p" + p.id]) names[l] = dicts[l]["p" + p.id]; });
    return {
      id: p.id, cat: p.cat, img: p.img, rating: p.rating, isNew: !!p.isNew,
      price: o.price ?? p.price, oldPrice: o.oldPrice !== undefined ? o.oldPrice : (p.oldPrice ?? null),
      stock: o.stock ?? 25, active: o.active ?? true,
      names, descs: {}, seo: {}, createdAt: new Date().toISOString()
    };
  });
}

function all() {
  const st = db.load();
  if (!Array.isArray(st.catalog)) {
    st.catalog = seedProducts(st);
    st.counters.product = Math.max(0, ...st.catalog.map((p) => p.id));
    db.save();
  }
  return st.catalog;
}
const list = (includeInactive = false) => all().filter((p) => includeInactive || p.active);
const find = (id) => all().find((p) => p.id === +id);
const nameOf = (p, lang = "en") => (p.names && (p.names[lang] || p.names.en)) || `#${p.id}`;

// what the storefront needs for one language
function localize(p, lang, fallbackDesc = "") {
  const seo = (p.seo && p.seo[lang]) || {};
  return {
    id: p.id, cat: p.cat, img: p.img, rating: p.rating, isNew: !!p.isNew, price: p.price, oldPrice: p.oldPrice ?? null, stock: p.stock,
    name: nameOf(p, lang), desc: (p.descs && (p.descs[lang] || p.descs.en)) || fallbackDesc,
    seoTitle: seo.title || "", seoDesc: seo.desc || ""
  };
}

function validate(b, existing = {}) {
  const err = (m) => Object.assign(new Error(m), { status: 400 });
  const p = { ...existing, names: { ...(existing.names || {}) }, descs: { ...(existing.descs || {}) }, seo: JSON.parse(JSON.stringify(existing.seo || {})) };
  if (b.cat !== undefined) { if (!CATEGORIES.includes(b.cat)) throw err("Choose a category."); p.cat = b.cat; }
  if (b.img !== undefined) { const v = String(b.img).trim(); if (!/^(https:\/\/[^\s"'<>]+|\/uploads\/[\w.-]+)$/.test(v)) throw err("Image must be an https:// link or an uploaded image."); p.img = v; }
  if (b.price !== undefined) { const v = +b.price; if (!(v > 0 && v < 1e6)) throw err("Invalid price."); p.price = Math.round(v * 100) / 100; }
  if (b.oldPrice !== undefined) { const v = b.oldPrice === null || b.oldPrice === "" ? null : +b.oldPrice; if (v !== null && !(v > 0 && v < 1e6)) throw err("Invalid old price."); p.oldPrice = v; }
  if (b.stock !== undefined) { const v = Math.floor(+b.stock); if (!(v >= 0 && v < 1e6)) throw err("Invalid stock."); p.stock = v; }
  if (b.rating !== undefined) { const v = +b.rating; if (!(v >= 0 && v <= 5)) throw err("Rating must be between 0 and 5."); p.rating = Math.round(v * 10) / 10; }
  if (b.active !== undefined) p.active = !!b.active;
  if (b.isNew !== undefined) p.isNew = !!b.isNew;
  const text = (v, max) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
  for (const l of LANGS) {
    if (b.names && b.names[l] !== undefined) { const v = text(b.names[l], 120); v ? (p.names[l] = v) : delete p.names[l]; }
    if (b.descs && b.descs[l] !== undefined) { const v = text(b.descs[l], 2000); v ? (p.descs[l] = v) : delete p.descs[l]; }
    if (b.seo && b.seo[l]) {
      const s = { title: text(b.seo[l].title, 120), desc: text(b.seo[l].desc, 320) };
      s.title || s.desc ? (p.seo[l] = s) : delete p.seo[l];
    }
  }
  if (!p.names.en) throw err("The English name is required.");
  if (!p.cat) throw err("Choose a category.");
  if (!p.img) throw err("Add an image.");
  if (!(p.price > 0)) throw err("Invalid price.");
  return p;
}

function create(b) {
  const st = db.load(); all();
  const p = validate({ stock: 0, active: true, isNew: true, rating: 0, ...b });
  st.counters.product = Math.max(st.counters.product || 0, ...st.catalog.map((x) => x.id)) + 1;
  p.id = st.counters.product; p.createdAt = new Date().toISOString();
  st.catalog.push(p); db.save();
  return p;
}
function update(id, b) {
  const st = db.load(), i = all().findIndex((p) => p.id === +id);
  if (i < 0) throw Object.assign(new Error("Product not found."), { status: 404 });
  st.catalog[i] = validate(b, st.catalog[i]); db.save();
  return st.catalog[i];
}
function remove(id) {
  const st = db.load(), i = all().findIndex((p) => p.id === +id);
  if (i < 0) throw Object.assign(new Error("Product not found."), { status: 404 });
  const [p] = st.catalog.splice(i, 1); db.save();
  return p;
}

module.exports = { LANGS, CATEGORIES, all, list, find, nameOf, localize, create, update, remove };
