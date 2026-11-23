// Server-side page rendering for SEO: per-language URLs, meta tags, hreflang, JSON-LD,
// crawlable HTML content, sitemap.xml and robots.txt.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "languages.json"), "utf8"));
const CODES = LANGS.map((l) => l.code);
const HREFLANG = { zh: "zh-Hans", pt: "pt-BR" };
const BCP47 = { zh: "zh-CN", pt: "pt-BR" };
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "en.json"), "utf8"));
const DICTS = Object.fromEntries(CODES.map((c) => [c, { ...EN, ...JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", c + ".json"), "utf8")) }]));
const CATEGORIES = ["tshirts", "hoodies", "jackets", "pants", "shirts", "shoes", "hats"];
const INDEXABLE = new Set(["", "shop", "category", "product", "about", "contact"]);

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const siteUrl = () => (process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
const langInfo = (code) => LANGS.find((l) => l.code === code);

function money(n, lang) {
  return new Intl.NumberFormat(BCP47[lang] || lang, { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(+n) ? 0 : 2 }).format(n);
}

// best language from the Accept-Language header
function pickLanguage(header = "") {
  const wanted = header.split(",").map((p) => { const [tag, q] = p.trim().split(";q="); return { tag: tag.toLowerCase(), q: q ? +q : 1 }; }).sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) { const base = tag.split("-")[0]; if (CODES.includes(base)) return base; }
  return "en";
}

// resolve /:lang/:page/:arg into a page description (or null for 404)
function resolve(pathname, products) {
  const parts = pathname.split("/").filter(Boolean);
  const lang = parts[0];
  if (!CODES.includes(lang)) return null;
  const page = parts[1] || "", arg = parts[2] ? decodeURIComponent(parts[2]) : "";
  const known = ["", "shop", "category", "product", "cart", "checkout", "order", "track", "about", "contact"];
  if (!known.includes(page) || parts.length > 3) return { lang, page: "404" };
  if (page === "category" && !CATEGORIES.includes(arg)) return { lang, page: "404" };
  if (page === "product" && !products.some((p) => p.id === +arg)) return { lang, page: "404" };
  if (["", "shop", "cart", "checkout", "track", "about", "contact"].includes(page) && arg) return { lang, page: "404" };
  return { lang, page, arg };
}

function pagePath(lang, page, arg) { return `/${lang}${page ? "/" + page : ""}${arg ? "/" + arg : ""}`; }

function meta(route, products) {
  const { lang, page, arg } = route, d = DICTS[lang];
  const base = siteUrl();
  let title, desc, image = products[0] && products[0].img, ld = [];
  const crumbs = [{ name: d.breadcrumbHome, url: base + pagePath(lang, "") }];
  switch (page) {
    case "": title = d.metaHomeTitle; desc = d.metaHomeDesc;
      ld.push({ "@context": "https://schema.org", "@type": "OnlineStore", name: "STORE", url: base + "/", logo: base + "/favicon.svg", description: desc },
        { "@context": "https://schema.org", "@type": "WebSite", name: "STORE", url: base + pagePath(lang, ""), inLanguage: lang });
      break;
    case "shop": title = `${d.metaShopTitle} | STORE`; desc = d.metaShopDesc; crumbs.push({ name: d.shop, url: base + pagePath(lang, "shop") }); break;
    case "category": title = `${d[arg]} | STORE`; desc = d.metaCatDesc.replace("{cat}", d[arg]);
      image = (products.find((p) => p.cat === arg) || {}).img;
      crumbs.push({ name: d.shop, url: base + pagePath(lang, "shop") }, { name: d[arg], url: base + pagePath(lang, "category", arg) }); break;
    case "product": {
      const p = products.find((x) => x.id === +arg), name = d["p" + p.id];
      title = `${name} — ${money(p.price, lang)} | STORE`; desc = d.metaProductDesc.replace("{name}", name).replace("{price}", money(p.price, lang)); image = p.img.replace("w=800", "w=1200");
      crumbs.push({ name: d[p.cat], url: base + pagePath(lang, "category", p.cat) }, { name, url: base + pagePath(lang, "product", p.id) });
      ld.push({
        "@context": "https://schema.org", "@type": "Product", name, image: [image], description: d.productDesc, sku: "ST-" + p.id, category: d[p.cat],
        brand: { "@type": "Brand", name: "STORE" },
        offers: { "@type": "Offer", url: base + pagePath(lang, "product", p.id), priceCurrency: "USD", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition" }
      });
      break;
    }
    case "about": title = `${d.aboutTitle} | STORE`; desc = d.metaAboutDesc; crumbs.push({ name: d.about, url: base + pagePath(lang, "about") }); break;
    case "contact": title = `${d.contactTitle} | STORE`; desc = d.metaContactDesc; crumbs.push({ name: d.contact, url: base + pagePath(lang, "contact") }); break;
    case "cart": title = `${d.yourCart} | STORE`; desc = d.metaHomeDesc; break;
    case "checkout": title = `${d.checkoutTitle} | STORE`; desc = d.metaHomeDesc; break;
    case "order": title = `${d.orderNo} | STORE`; desc = d.metaHomeDesc; break;
    case "track": title = `${d.trackTitle} | STORE`; desc = d.trackText; break;
    default: title = `404 | STORE`; desc = d.noResults;
  }
  if (crumbs.length > 1) ld.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })) });

  const indexable = INDEXABLE.has(page);
  const self = base + pagePath(lang, page, arg);
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta name="robots" content="${indexable ? "index, follow, max-image-preview:large" : "noindex, follow"}">`
  ];
  if (indexable) {
    tags.push(`<link rel="canonical" href="${esc(self)}">`);
    LANGS.forEach((l) => tags.push(`<link rel="alternate" hreflang="${HREFLANG[l.code] || l.code}" href="${esc(base + pagePath(l.code, page, arg))}">`));
    tags.push(`<link rel="alternate" hreflang="x-default" href="${esc(base + pagePath("en", page, arg))}">`);
  }
  const info = langInfo(lang);
  const fonts = "family=Plus+Jakarta+Sans:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,700;1,800&family=Cormorant+Garamond:ital,wght@1,400"
    + (lang === "ar" ? "&family=Cairo:wght@300;400;600;700;800" : "") + (lang === "ur" ? "&family=Noto+Nastaliq+Urdu:wght@400;700&family=Cairo:wght@400;700" : "") + (lang === "fa" ? "&family=Vazirmatn:wght@300;400;600;700;800" : "");
  tags.push(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">`);
  tags.push(
    `<meta property="og:type" content="${page === "product" ? "product" : "website"}">`,
    `<meta property="og:site_name" content="STORE">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(self)}">`,
    `<meta property="og:locale" content="${info.locale}">`,
    ...LANGS.filter((l) => l.code !== lang).map((l) => `<meta property="og:locale:alternate" content="${l.locale}">`),
    image ? `<meta property="og:image" content="${esc(image)}">` : "",
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : "",
    ...ld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`)
  );
  return tags.filter(Boolean).join("\n  ");
}

// crawlable HTML that is shown before JavaScript runs (and replaced by the app afterwards)
function ssrBody(route, products) {
  const { lang, page, arg } = route, d = DICTS[lang];
  const L = (p, a) => pagePath(lang, p, a);
  const card = (p) => `<li><a href="${L("product", p.id)}"><img src="${esc(p.img)}" alt="${esc(d["p" + p.id])}" width="400" height="400" loading="lazy"><span>${esc(d["p" + p.id])}</span></a> <b>${money(p.price, lang)}</b></li>`;
  let main;
  if (page === "") main = `<h1>${esc(d.heroThin)} ${esc(d.heroBold)}</h1><p>${esc(d.heroText)}</p>
    <h2>${esc(d.catThin)} ${esc(d.catBold)}</h2><ul>${CATEGORIES.map((c) => `<li><a href="${L("category", c)}">${esc(d[c])}</a></li>`).join("")}</ul>
    <h2>${esc(d.bestThin)} ${esc(d.bestBold)}</h2><ul>${products.map(card).join("")}</ul>`;
  else if (page === "shop") main = `<h1>${esc(d.shop)}</h1><p>${esc(d.metaShopDesc)}</p><ul>${products.map(card).join("")}</ul>`;
  else if (page === "category") main = `<h1>${esc(d[arg])}</h1><p>${esc(d.metaCatDesc.replace("{cat}", d[arg]))}</p><ul>${products.filter((p) => p.cat === arg).map(card).join("")}</ul>`;
  else if (page === "product") {
    const p = products.find((x) => x.id === +arg);
    main = `<nav><a href="${L()}">${esc(d.breadcrumbHome)}</a> › <a href="${L("category", p.cat)}">${esc(d[p.cat])}</a></nav>
      <h1>${esc(d["p" + p.id])}</h1><img src="${esc(p.img.replace("w=800", "w=1200"))}" alt="${esc(d["p" + p.id])}" width="800" height="800">
      <p><b>${money(p.price, lang)}</b>${p.oldPrice ? ` <s>${money(p.oldPrice, lang)}</s>` : ""}</p><p>${esc(d.productDesc)}</p>
      <h2>${esc(d.related)}</h2><ul>${products.filter((x) => x.cat === p.cat && x.id !== p.id).map(card).join("")}</ul>`;
  }
  else if (page === "about") main = `<h1>${esc(d.aboutTitle)}</h1><p>${esc(d.aboutText)}</p>`;
  else if (page === "contact") main = `<h1>${esc(d.contactTitle)}</h1><p>${esc(d.metaContactDesc)}</p>`;
  else main = `<h1>STORE</h1>`;
  return `<div class="ssr">
    <header><a href="${L()}">STORE</a> <nav><a href="${L()}">${esc(d.home)}</a> <a href="${L("shop")}">${esc(d.shop)}</a> <a href="${L("about")}">${esc(d.about)}</a> <a href="${L("contact")}">${esc(d.contact)}</a></nav></header>
    <main id="main-content">${main}</main>
    <footer><nav aria-label="${esc(d.language)}">${LANGS.map((l) => `<a href="${pagePath(l.code, page === "404" ? "" : page, arg)}" hreflang="${HREFLANG[l.code] || l.code}" lang="${l.code}">${esc(l.name)}</a>`).join(" ")}</nav></footer>
  </div>`;
}

let TEMPLATE = null;
function renderPage(route, products) {
  if (!TEMPLATE || process.env.NODE_ENV !== "production") TEMPLATE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const info = langInfo(route.lang);
  const site = { lang: route.lang, dir: info.dir, bcp47: BCP47[route.lang] || route.lang, langs: LANGS, dict: DICTS[route.lang] };
  return TEMPLATE
    .replace("{{LANG}}", route.lang).replace("{{DIR}}", info.dir)
    .replace("<!--HEAD-->", meta(route, products))
    .replace("<!--SSR-->", ssrBody(route, products))
    .replace("<!--SITE-->", `<script>window.SITE = ${JSON.stringify(site).replace(/</g, "\\u003c")};</script>`);
}

function sitemap(products) {
  const base = siteUrl();
  const pages = [["", ""], ["shop", ""], ["about", ""], ["contact", ""], ...CATEGORIES.map((c) => ["category", c]), ...products.map((p) => ["product", String(p.id)])];
  const urls = [];
  for (const [page, arg] of pages) for (const l of LANGS) {
    const alts = LANGS.map((a) => `    <xhtml:link rel="alternate" hreflang="${HREFLANG[a.code] || a.code}" href="${base}${pagePath(a.code, page, arg)}"/>`).join("\n");
    urls.push(`  <url>\n    <loc>${base}${pagePath(l.code, page, arg)}</loc>\n${alts}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${base}${pagePath("en", page, arg)}"/>\n    <changefreq>${page === "product" || page === "" ? "daily" : "weekly"}</changefreq>\n    <priority>${page === "" ? "1.0" : page === "product" || page === "category" ? "0.8" : "0.5"}</priority>\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

function robots() {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n${CODES.map((c) => `Disallow: /${c}/cart\nDisallow: /${c}/checkout\nDisallow: /${c}/order/\nDisallow: /${c}/track`).join("\n")}\n\nSitemap: ${siteUrl()}/sitemap.xml\n`;
}

module.exports = { CODES, LANGS, DICTS, pickLanguage, resolve, renderPage, sitemap, robots };
