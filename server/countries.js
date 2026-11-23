// Countries / markets: default language, currency, exchange rate and shipping per country.
// Everything here is editable in the admin panel; these are only the starting values.
const db = require("./db");

// rate = how much 1 USD is in that currency. Shipping prices and free-shipping limits are in the local currency.
// ⚠ Exchange rates are starting values only — set real rates in Admin → Countries.
const DEFAULTS = [
  { code: "PK", name: "Pakistan", lang: "ur", currency: "PKR", rate: 280, decimals: 0, standard: 250, express: 600, freeOver: 15000, standardDays: "2-4", expressDays: "1-2", cod: true },
  { code: "GB", name: "United Kingdom", lang: "en", currency: "GBP", rate: 0.79, decimals: 2, standard: 4.99, express: 9.99, freeOver: 60, standardDays: "3-5", expressDays: "1-2", cod: false },
  { code: "US", name: "United States", lang: "en", currency: "USD", rate: 1, decimals: 2, standard: 6.99, express: 14.99, freeOver: 75, standardDays: "3-6", expressDays: "1-3", cod: false },
  { code: "AE", name: "United Arab Emirates", lang: "ar", currency: "AED", rate: 3.67, decimals: 2, standard: 25, express: 45, freeOver: 300, standardDays: "2-4", expressDays: "1-2", cod: true },
  { code: "SA", name: "Saudi Arabia", lang: "ar", currency: "SAR", rate: 3.75, decimals: 2, standard: 25, express: 50, freeOver: 300, standardDays: "3-5", expressDays: "1-2", cod: true },
  { code: "IT", name: "Italy", lang: "it", currency: "EUR", rate: 0.92, decimals: 2, standard: 6.9, express: 14.9, freeOver: 70, standardDays: "3-6", expressDays: "1-3", cod: false },
  { code: "DE", name: "Germany", lang: "de", currency: "EUR", rate: 0.92, decimals: 2, standard: 4.95, express: 12.95, freeOver: 70, standardDays: "2-4", expressDays: "1-2", cod: false },
  { code: "OM", name: "Oman", lang: "ar", currency: "OMR", rate: 0.385, decimals: 3, standard: 2.5, express: 5, freeOver: 30, standardDays: "3-5", expressDays: "1-2", cod: true },
  { code: "IR", name: "Iran", lang: "fa", currency: "IRR", rate: 42000, decimals: 0, standard: 400000, express: 900000, freeOver: 4000000, standardDays: "5-8", expressDays: "3-4", cod: true },
  { code: "TR", name: "Turkey", lang: "tr", currency: "TRY", rate: 42, decimals: 2, standard: 150, express: 300, freeOver: 3000, standardDays: "3-5", expressDays: "1-2", cod: true }
].map((c) => ({ ...c, active: true }));

function all() {
  const st = db.load();
  if (!Array.isArray(st.countries)) { st.countries = DEFAULTS.map((c) => ({ ...c })); db.save(); }
  return st.countries;
}
const list = (activeOnly = true) => all().filter((c) => !activeOnly || c.active);
const get = (code) => all().find((c) => c.code === String(code || "").toUpperCase());

function round(n, decimals) { const f = 10 ** decimals; return Math.round(n * f) / f; }
const convert = (usd, c) => round(usd * c.rate, c.decimals);

function cookie(req, name) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

// country for a request: saved choice → a country whose default language is the page language → USA → first active
function pick(req, lang) {
  const active = list();
  const saved = active.find((c) => c.code === cookie(req, "country").toUpperCase());
  if (saved) return saved;
  const region = (req.headers["accept-language"] || "").match(/[a-z]{2,3}-([A-Z]{2})/i);
  const byRegion = region && active.find((c) => c.code === region[1].toUpperCase() && c.lang === lang);
  return byRegion || active.find((c) => c.lang === lang) || active.find((c) => c.code === "US") || active[0];
}

// the client and server-side renderer only need these fields
const publicCountry = (c) => ({ code: c.code, name: c.name, lang: c.lang, currency: c.currency, rate: c.rate, decimals: c.decimals, standard: c.standard, express: c.express, freeOver: c.freeOver, standardDays: c.standardDays, expressDays: c.expressDays, cod: c.cod });

function validate(b, existing = {}) {
  const c = { ...existing };
  const str = (v, max) => String(v ?? "").trim().slice(0, max);
  const num = (v, name, min = 0) => { const n = +v; if (!Number.isFinite(n) || n < min) throw Object.assign(new Error(`Invalid ${name}.`), { status: 400 }); return n; };
  if (b.code !== undefined && !existing.code) { c.code = str(b.code, 2).toUpperCase(); if (!/^[A-Z]{2}$/.test(c.code)) throw Object.assign(new Error("Country code must be 2 letters (e.g. FR)."), { status: 400 }); }
  if (b.name !== undefined) { c.name = str(b.name, 60); if (c.name.length < 2) throw Object.assign(new Error("Country name is required."), { status: 400 }); }
  if (b.lang !== undefined) c.lang = str(b.lang, 5);
  if (b.currency !== undefined) { c.currency = str(b.currency, 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(c.currency)) throw Object.assign(new Error("Currency must be a 3-letter code (e.g. EUR)."), { status: 400 }); }
  if (b.rate !== undefined) { c.rate = num(b.rate, "exchange rate"); if (!c.rate) throw Object.assign(new Error("Exchange rate must be more than 0."), { status: 400 }); }
  if (b.decimals !== undefined) c.decimals = Math.min(3, Math.max(0, Math.floor(num(b.decimals, "decimals"))));
  ["standard", "express", "freeOver"].forEach((k) => { if (b[k] !== undefined) c[k] = b[k] === "" || b[k] === null ? (k === "freeOver" ? null : 0) : num(b[k], k); });
  ["standardDays", "expressDays"].forEach((k) => { if (b[k] !== undefined) c[k] = str(b[k], 10); });
  if (b.cod !== undefined) c.cod = !!b.cod;
  if (b.active !== undefined) c.active = !!b.active;
  return c;
}

module.exports = { DEFAULTS, all, list, get, convert, round, pick, cookie, publicCountry, validate };
