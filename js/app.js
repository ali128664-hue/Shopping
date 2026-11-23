// Hash-router SPA: #/en, #/ar/shop, #/en/product/3, #/en/cart ...
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  let cart = store.get("cart", []);
  const API = { ok: false, config: null };
  async function api(path, opts = {}) {
    const r = await fetch(path, { method: opts.method || (opts.body ? "POST" : "GET"), headers: { "Content-Type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || "Request failed"); e.fields = j.fields; e.status = r.status; throw e; }
    return j;
  }
  const checkout = { coupon: store.get("coupon", ""), shipping: "standard", payment: "cod", quote: null };
  let wish = store.get("wish", []);
  let lang = "en";
  window.STORE = { t: (k) => t(k), name: (p) => name(p), get lang() { return lang; }, toast: (m) => toast(m), icons: null };
  const SITE = window.SITE || { lang: "en", dir: "ltr", bcp47: "en", langs: [{ code: "en", name: "English" }], dict: {} };
  lang = SITE.lang;
  const t = (k) => SITE.dict[k] ?? k;
  const name = (p) => p.name || t("p" + p.id);
  window.PRODUCTS = SITE.products || window.PRODUCTS || [];
  window.CATEGORIES = ["tshirts", "hoodies", "jackets", "pants", "shirts", "shoes", "hats"];
  const HERO_IMG = "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1400&q=80";
  const COUNTRIES = SITE.countries || [];
  const SET = SITE.settings || {};
  let COUNTRY = SITE.country || { code: "US", currency: "USD", rate: 1, decimals: 2, standard: 0, express: 0, freeOver: null, cod: false, standardDays: "", expressDays: "" };
  const regionName = (code) => { try { return new Intl.DisplayNames([SITE.bcp47], { type: "region" }).of(code); } catch { return code; } };
  const flag = (code) => `<img class="flag-img" src="https://flagcdn.com/w40/${code.toLowerCase()}.png" alt="" width="20" height="15" loading="lazy">`;
  const pick = (i) => PRODUCTS[i % Math.max(1, PRODUCTS.length)];
  // fmt: an amount already in the country currency; money: a USD catalog price shown in the visitor's currency
  const fmt = (n, cur = COUNTRY.currency, dec = COUNTRY.decimals) => new Intl.NumberFormat(SITE.bcp47, { style: "currency", currency: cur, minimumFractionDigits: Number.isInteger(+n) ? 0 : dec, maximumFractionDigits: dec }).format(n);
  const local = (usd) => { const f = 10 ** COUNTRY.decimals; return Math.round(usd * COUNTRY.rate * f) / f; };
  const money = (usd) => fmt(local(usd));
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const link = (path = "") => `/${lang}${path ? "/" + path : ""}`;
  const two = (thin, bold, tag = "h2") => `<${tag} class="two"><span>${t(thin)}</span> <b>${t(bold)}</b></${tag}>`;
  const kicker = (k) => `<span class="kicker">${t(k)}</span>`;

  // icons
  const I = {
    bag: '<svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
    bagPlus: '<svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0M12 12v5M9.5 14.5h5"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16m0 4v-4h-4"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/></svg>',
    badge: '<svg viewBox="0 0 24 24"><path d="m12 2 2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.2 3 1.2 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.2-3-1.2-3 2.8-1.6.9-3.1 3.2.3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    hanger: '<svg viewBox="0 0 24 24"><path d="M12 7.5a2 2 0 1 1 2-2c0 1.2-2 1.6-2 3v1.2L3 15.5a1.4 1.4 0 0 0 .8 2.5h16.4a1.4 1.4 0 0 0 .8-2.5L12 9.7"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3Z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    ruler: '<svg viewBox="0 0 24 24"><path d="M3 16.5 16.5 3 21 7.5 7.5 21 3 16.5Z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><path d="M4 11h16v10H4zM2 7h20v4H2zM12 7v14M12 7S10.5 3 8 3a2 2 0 0 0 0 4h4Zm0 0s1.5-4 4-4a2 2 0 0 1 0 4h-4Z"/></svg>',
    star: '<svg viewBox="0 0 24 24" class="fill"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>'
  };

  window.STORE.icons = I;
  // ---------- cart ----------
  function saveCart() { store.set("cart", cart); updateCounts(); }
  function addToCart(id, size = "M", qty = 1) {
    const prod = PRODUCTS.find((x) => x.id === id);
    const inCart = cart.filter((i) => i.id === id).reduce((s, i) => s + i.qty, 0);
    if (prod && prod.stock !== undefined && inCart + qty > prod.stock) return toast(prod.stock - inCart > 0 ? t("onlyLeft").replace("{n}", prod.stock - inCart) : t("outOfStock"));
    const item = cart.find((i) => i.id === id && i.size === size);
    item ? (item.qty += qty) : cart.push({ id, size, qty });
    saveCart(); openDrawer();
  }
  function updateCounts() {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll(".cart-count").forEach((el) => { el.textContent = n; el.hidden = !n; });
    document.querySelectorAll(".wish-count").forEach((el) => { el.textContent = wish.length; el.hidden = !wish.length; });
  }
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2000);
  }

  // ---------- components ----------
  function productCard(p) {
    const liked = wish.includes(p.id);
    return `
    <article class="pcard reveal">
      <a href="${link("product/" + p.id)}" class="pcard-img"><img src="${p.img}" alt="${name(p)}" loading="lazy"></a>
      <button class="round heart ${liked ? "on" : ""}" data-wish="${p.id}" aria-label="Wishlist">${I.heart}</button>
      <button class="round hanger" data-try="${p.id}" aria-label="${t("frTry")}" title="${t("frTry")}">${I.hanger}</button>
      ${p.reviewCount ? `<span class="rating">${I.star}${p.rating}</span>` : ""}
      ${p.stock === 0 ? `<span class="tag oos">${t("outOfStock")}</span>` : p.isNew ? `<span class="tag">${t("new")}</span>` : ""}
      <div class="pcard-body">
        <div>
          <a href="${link("product/" + p.id)}" class="pname">${name(p)}</a>
          <div class="price">${money(p.price)} ${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}</div>
        </div>
        <button class="add" data-add="${p.id}" aria-label="${t("addToCart")}" ${p.stock === 0 ? "disabled" : ""}>${I.bagPlus}</button>
      </div>
    </article>`;
  }

  function header() {
    const route = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") + location.search;
    const cur = SITE.langs.find((l) => l.code === lang) || SITE.langs[0];
    const ann = SET.announcement || freeText();
    return `
    ${ann ? `<div class="announce-bar">${I.gift}<span>${esc(ann)}</span></div>` : ""}
    <header class="header">
      <div class="wrap">
        <div class="bar">
          <button class="icon menu-btn" data-menu aria-label="Menu">${I.menu}</button>
          <nav class="nav-links" id="navLinks">
            <a href="${link()}">${t("home")}</a>
            <a href="${link("shop")}">${t("shop")}</a>
            <a href="${link("shop?new=1")}">${t("newArrivals")}</a>
            <a href="${link("shop?sale=1")}">${t("sale")}</a>
          </nav>
          <a href="${link()}" class="logo">STORE</a>
          <div class="actions">
            <details class="lang-menu country-menu">
              <summary class="pill lang" aria-label="${t("shipTo")}">${flag(COUNTRY.code)}<span>${COUNTRY.currency}</span></summary>
              <div class="lang-list country-list"><p class="menu-title">${t("shipTo")}</p>${COUNTRIES.map((c) => `<a href="/${c.lang}${route}" data-country="${c.code}" class="${c.code === COUNTRY.code ? "on" : ""}">${flag(c.code)}<span>${esc(regionName(c.code))}</span><small>${c.currency}</small></a>`).join("")}</div>
            </details>
            <details class="lang-menu">
              <summary class="pill lang" aria-label="${t("language")}">${I.globe}<span>${cur.code.toUpperCase()}</span></summary>
              <div class="lang-list">${SITE.langs.map((l) => `<a href="/${l.code}${route}" hreflang="${l.code}" lang="${l.code}" class="${l.code === lang ? "on" : ""}" data-lang>${l.name}</a>`).join("")}</div>
            </details>
            <button class="icon" data-theme aria-label="Theme">${I.moon}</button>
            <button class="pill search-pill" data-open-search>${I.search}<span>${t("searchLbl")}</span><kbd>Ctrl+K</kbd></button>
            <a class="icon hide-sm" href="${link("wishlist")}" aria-label="${t("wishlist")}">${I.heart}<span class="cart-count wish-count" hidden>0</span></a>
            <a class="icon cart-btn" href="${link("cart")}" aria-label="${t("cart")}">${I.bag}<span class="cart-count" hidden>0</span></a>
          </div>
        </div>
      </div>
    </header>
    <div class="search-modal" id="searchModal" hidden>
      <div class="search-box">
        <div class="search-input">${I.search}<input id="searchInput" placeholder="${t("search")}"><kbd>Esc</kbd></div>
        <div id="searchResults"></div>
      </div>
    </div>`;
  }

  function footer() {
    return `
    <section class="wrap section">
      <div class="newsletter reveal">
        <div>${kicker("newsletter")}<h2 class="two"><b>${t("newsletter")}</b></h2><p>${t("newsletterText")}</p></div>
        <form class="subscribe" data-subscribe>
          <input type="email" required placeholder="${t("email")}">
          <button class="btn">${t("subscribe")} ${I.arrow}</button>
        </form>
      </div>
    </section>
    <footer class="footer">
      <div class="wrap footer-grid">
        <div><a class="logo" href="${link()}">STORE</a><p>${t("footerText")}</p></div>
        <div><h4>${t("shop")}</h4>${CATEGORIES.slice(0, 5).map((c) => `<a href="${link("category/" + c)}">${t(c)}</a>`).join("")}</div>
        <div><h4>${t("help")}</h4><a href="${link("contact")}">${t("shipping")}</a><a href="${link("contact")}">${t("returns")}</a><a href="${link("contact")}">${t("faq")}</a><a href="${link("track")}">${t("track")}</a></div>
        <div><h4>${t("company")}</h4><a href="${link("about")}">${t("about")}</a><a href="${link("contact")}">${t("contact")}</a><a href="mailto:hello@store.com">hello@store.com</a></div>
      </div>
      <div class="wrap copy">© ${new Date().getFullYear()} STORE. ${t("rights")}</div>
    </footer>`;
  }

  // ---------- pages ----------
  function home() {
    if (!PRODUCTS.length) return notFound();
    const edits = [8, 9, 7].map(pick);
    const fresh = PRODUCTS.filter((p) => p.isNew).slice(0, 2);
    const best = [...PRODUCTS].sort((a, b) => (b.reviewCount ? b.rating : 0) - (a.reviewCount ? a.rating : 0) || b.reviewCount - a.reviewCount).slice(0, 8);
    return `
    <section class="wrap">
      <div class="hero">
        <div class="hero-text">
          ${kicker("heroKicker")}
          <h1><span class="thin">${t("heroThin")}</span><span class="bold">${t("heroBold")}</span></h1>
          <p>${t("heroText")}</p>
          <div class="btns">
            <a class="btn" href="${link("shop")}">${t("shopNow")} ${I.arrow}</a>
            <a class="btn ghost" href="${link("shop?new=1")}">${t("newArrivals")}</a>
          </div>
        </div>
        <div class="hero-img"><img src="${HERO_IMG}" alt=""></div>
      </div>
      <div class="features">
        ${[["truck", 1], ["refresh", 2], ["shield", 3], ["badge", 4]].map(([ic, i]) => `
          <div class="feature"><span class="ficon">${I[ic]}</span><div><strong>${t("f" + i + "t")}</strong><small>${i === 1 ? freeText() : t("f" + i + "d")}</small></div></div>`).join("")}
      </div>
    </section>

    <section class="wrap section">
      <div class="head reveal"><div>${kicker("curateKicker")}${two("curateThin", "curateBold")}</div><a class="more" href="${link("shop")}">${t("viewAll")} ${I.arrow}</a></div>
      <div class="edits">
        ${edits.map((p, i) => `
          <a class="edit-card reveal" href="${link("category/" + p.cat)}">
            <span class="roman">${["I", "II", "III"][i]}</span>
            <div class="edit-img"><img src="${p.img}" alt="" loading="lazy"></div>
            <small>${t("edit")} ${["I", "II", "III"][i]}</small>
            <h3>${t("e" + (i + 1))}</h3>
          </a>`).join("")}
      </div>
    </section>

    <section class="wrap section">
      <div class="arrivals">
        <a class="drop-card reveal" href="${link("product/" + pick(0).id)}">
          <img src="${pick(0).img.replace("w=800", "w=1200")}" alt="" loading="lazy">
          <div class="drop-text">${kicker("justDropped")}${two("springThin", "springBold", "h3")}</div>
        </a>
        <div class="arrivals-side">
          <div class="reveal">${kicker("naKicker")}${two("naThin", "naBold")}<p class="muted">${t("naText")}</p>
          <a class="link-arrow" href="${link("shop?new=1")}">${t("viewNew")} ${I.arrowUp}</a></div>
          <div class="grid two-col">${fresh.map(productCard).join("")}</div>
        </div>
      </div>
    </section>

    <section class="wrap section">
      <div class="head reveal"><div>${kicker("catKicker")}${two("catThin", "catBold")}</div><a class="more" href="${link("shop")}">${t("viewAll")} ${I.arrow}</a></div>
      <div class="cats">
        ${CATEGORIES.map((c) => `
          <a class="cat reveal" href="${link("category/" + c)}"><div class="cat-img"><img src="${(PRODUCTS.find((p) => p.cat === c) || pick(0)).img}" alt="" loading="lazy"></div><span>${t(c)}</span></a>`).join("")}
      </div>
    </section>

    <section class="wrap section">
      <div class="head reveal"><div>${kicker("bestKicker")}${two("bestThin", "bestBold")}</div><a class="more" href="${link("shop")}">${t("viewAll")} ${I.arrow}</a></div>
      <div class="grid">${best.map(productCard).join("")}</div>
    </section>

    <section class="wrap section">
      <div class="promo reveal">
        <div>${kicker("promoKicker")}<h2 class="two"><span>${t("promoThin")}</span> <b>${t("promoBold")}</b></h2><p>${t("promoText")}</p>
        <a class="btn" href="${link("shop?sale=1")}">${t("shopNow")} ${I.arrow}</a></div>
        <img src="${pick(7).img}" alt="" loading="lazy">
      </div>
    </section>

    <section class="wrap section">
      <div class="head reveal"><div>${kicker("testiKicker")}${two("testiThin", "testiBold")}</div></div>
      <div class="testis">
        ${[1, 2, 3].map((i) => `
          <figure class="testi reveal"><div class="stars">${I.star.repeat(5)}</div><blockquote>“${t("t" + i)}”</blockquote><figcaption><span class="avatar">${t("t" + i + "n")[0]}</span>${t("t" + i + "n")}</figcaption></figure>`).join("")}
      </div>
    </section>`;
  }

  function shop(params, routeCat) {
    const cat = routeCat || params.get("cat") || "all";
    const q = (params.get("q") || "").toLowerCase();
    const sort = params.get("sort") || "default";
    let list = PRODUCTS.filter((p) =>
      (cat === "all" || p.cat === cat) &&
      (!params.get("new") || p.isNew) &&
      (!params.get("sale") || p.oldPrice) &&
      (!q || name(p).toLowerCase().includes(q)));
    if (sort === "low") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
    const title = params.get("new") ? t("newArrivals") : params.get("sale") ? t("sale") : cat !== "all" ? t(cat) : t("shop");
    return `
    <section class="wrap"><div class="page-head">${kicker("catKicker")}<h1 class="two"><b>${title}</b></h1></div></section>
    <section class="wrap section tight">
      <div class="toolbar">
        <div class="chips">${["all", ...CATEGORIES].map((c) => `<a class="chip ${c === cat ? "active" : ""}" href="${c === "all" ? link("shop") : link("category/" + c)}">${t(c)}</a>`).join("")}</div>
        <div class="tools">
          <input class="field" type="search" placeholder="${t("search")}" value="${q}" data-search>
          <select class="field" data-sort>
            <option value="default" ${sort === "default" ? "selected" : ""}>${t("sortDefault")}</option>
            <option value="low" ${sort === "low" ? "selected" : ""}>${t("sortLow")}</option>
            <option value="high" ${sort === "high" ? "selected" : ""}>${t("sortHigh")}</option>
          </select>
        </div>
      </div>
      <p class="muted count">${list.length} ${t("products")}</p>
      ${list.length ? `<div class="grid">${list.map(productCard).join("")}</div>` : `<p class="empty">${t("noResults")}</p>`}
    </section>`;
  }

  function product(id) {
    const p = PRODUCTS.find((x) => x.id === +id);
    if (!p) return shop(new URLSearchParams());
    const related = PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id).concat(PRODUCTS.filter((x) => x.cat !== p.cat)).slice(0, 4);
    const sizes = p.cat === "shoes" ? ["40", "41", "42", "43", "44"] : p.cat === "hats" ? ["S/M", "L/XL"] : ["S", "M", "L", "XL", "XXL"];
    return `
    <section class="wrap section tight product">
      <div class="product-img"><img src="${p.img.replace("w=800", "w=1200")}" alt="${name(p)}"></div>
      <div class="product-info">
        <a href="${link("category/" + p.cat)}" class="kicker">${t(p.cat)}</a>
        <h1>${name(p)}</h1>
        ${p.reviewCount ? `<a class="rating-line" href="#reviews">${stars(p.rating)} <span>${p.rating} · ${t("basedOn").replace("{n}", p.reviewCount)}</span></a>` : ""}
        <div class="price big">${money(p.price)} ${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}</div>
        <p class="muted">${esc(p.desc || t("productDesc"))}</p>
        ${p.stock === 0 ? `<p class="stock-note out">${t("outOfStock")}</p>` : p.stock !== undefined && p.stock <= 5 ? `<p class="stock-note">${t("onlyLeft").replace("{n}", p.stock)}</p>` : ""}
        <div class="label-row"><label class="label">${t("size")}</label><button class="link-btn sg-link" data-size-guide="${p.cat}">${I.ruler}${t("sizeGuide")}</button></div>
        <div class="sizes">${sizes.map((s, i) => `<button class="size ${i === 1 ? "active" : ""}" data-size="${s}">${s}</button>`).join("")}</div>
        <label class="label">${t("qty")}</label>
        <div class="qty"><button data-q="-1">−</button><span id="qtyVal">1</span><button data-q="1">+</button></div>
        <div class="buy-row">
          <button class="btn grow" data-add-detail="${p.id}" data-default-size="${sizes[1]}" ${p.stock === 0 ? "disabled" : ""}>${t("addToCart")} ${I.bag}</button>
          <button class="round big-heart hanger" data-try="${p.id}" title="${t("frTry")}">${I.hanger}</button>
          <button class="round big-heart heart ${wish.includes(p.id) ? "on" : ""}" data-wish="${p.id}">${I.heart}</button>
        </div>
        ${SET.whatsapp ? `<a class="btn wa full" data-wa-product="${p.id}" target="_blank" rel="noopener" href="#">${I.whatsapp} ${t("orderWhatsApp")}</a>` : ""}
        <ul class="perks"><li>${I.truck}${freeText()}</li><li>${I.refresh}${t("f2d")}</li><li>${I.shield}${t("f3d")}</li></ul>
      </div>
    </section>
    <section class="wrap section" id="reviews">
      <div class="reviews panel">
        <div class="rv-head"><div><h2 class="two"><b>${t("reviews")}</b></h2>${p.reviewCount ? `<p class="rv-avg">${stars(p.rating)} <b>${p.rating}</b> <span class="muted">· ${t("basedOn").replace("{n}", p.reviewCount)}</span></p>` : ""}</div>
          <button class="btn ghost" data-write-review>${t("writeReview")}</button></div>
        <form class="rv-form" id="reviewForm" data-product="${p.id}" hidden>
          <div class="star-input" role="radiogroup" aria-label="${t("yourRating")}">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" value="${n}" id="st${n}" ${n === 5 ? "checked" : ""}><label for="st${n}" title="${n}">${I.star}</label>`).join("")}</div>
          <input class="field" name="name" required maxlength="60" placeholder="${t("name")}">
          <textarea class="field" name="text" required rows="3" maxlength="1500" placeholder="${t("yourReview")}"></textarea>
          <button class="btn">${t("submitReview")}</button>
        </form>
        <div id="reviewList"><p class="muted">${t("noReviews")}</p></div>
      </div>
    </section>
    <section class="wrap section">
      <div class="head"><div>${kicker("bestKicker")}<h2 class="two"><b>${t("related")}</b></h2></div></div>
      <div class="grid">${related.map(productCard).join("")}</div>
    </section>
    ${recentSection(p.id)}
    <div class="sticky-buy" id="stickyBuy">
      <img src="${p.img}" alt=""><div><b>${esc(name(p))}</b><span class="price">${money(p.price)}</span></div>
      <button class="btn" data-add-detail="${p.id}" ${p.stock === 0 ? "disabled" : ""}>${t("addToCart")}</button>
    </div>`;
  }

  function cartPage() {
    const items = cart.map((i) => ({ ...i, p: PRODUCTS.find((p) => p.id === i.id) })).filter((i) => i.p);
    if (!items.length) return `<section class="wrap section"><div class="panel empty-cart"><span class="big-icon">${I.bag}</span><h1 class="two"><b>${t("yourCart")}</b></h1><p class="muted">${t("emptyCart")}</p><a class="btn" href="${link("shop")}">${t("continueShopping")} ${I.arrow}</a></div></section>`;
    const sub = items.reduce((s, i) => s + local(i.p.price) * i.qty, 0);
    const ship = COUNTRY.freeOver !== null && COUNTRY.freeOver !== undefined && sub >= COUNTRY.freeOver ? 0 : COUNTRY.standard;
    return `
    <section class="wrap section tight">
      <h1 class="two"><b>${t("yourCart")}</b></h1>
      <div class="cart-layout">
        <div class="panel">
          ${items.map((i, idx) => `
          <div class="cart-item">
            <img src="${i.p.img}" alt="">
            <div class="ci-info"><a href="${link("product/" + i.p.id)}">${name(i.p)}</a><small class="muted">${t("size")}: ${i.size}</small><span class="price">${money(i.p.price)}</span></div>
            <div class="qty small"><button data-cq="${idx}" data-d="-1">−</button><span>${i.qty}</span><button data-cq="${idx}" data-d="1">+</button></div>
            <button class="link-btn" data-remove="${idx}">${t("remove")}</button>
          </div>`).join("")}
        </div>
        <aside class="panel summary">
          ${freeBar(sub)}
          <div><span>${t("subtotal")}</span><span>${fmt(sub)}</span></div>
          <div><span>${t("shippingFee")} · ${flag(COUNTRY.code)} ${esc(regionName(COUNTRY.code))}</span><span>${ship ? fmt(ship) : t("free")}</span></div>
          <div class="total"><span>${t("total")}</span><span>${fmt(sub + ship)}</span></div>
          <a class="btn full" href="${link("checkout")}">${t("checkout")} ${I.arrow}</a>
          <a class="muted center" href="${link("shop")}">${t("continueShopping")}</a>
        </aside>
      </div>
    </section>`;
  }

  function about() {
    return `
    <section class="wrap"><div class="page-head">${kicker("company")}<h1 class="two"><b>${t("aboutTitle")}</b></h1></div></section>
    <section class="wrap section tight"><div class="panel about"><img src="${pick(8).img}" alt=""><p>${t("aboutText")}</p></div></section>`;
  }

  function contact() {
    return `
    <section class="wrap"><div class="page-head">${kicker("help")}<h1 class="two"><b>${t("contactTitle")}</b></h1></div></section>
    <section class="wrap section tight"><form class="panel contact-form" data-contact>
      <input class="field" required placeholder="${t("name")}">
      <input class="field" type="email" required placeholder="${t("email")}">
      <textarea class="field" required rows="5" placeholder="${t("message")}"></textarea>
      <button class="btn">${t("send")} ${I.arrow}</button>
    </form></section>`;
  }

  function freeText() { return COUNTRY.freeOver ? t("freeOverX").replace("{amount}", fmt(COUNTRY.freeOver)) : `${regionName(COUNTRY.code)} · ${t("standard")} ${fmt(COUNTRY.standard)}`; }
  function setCountry(code) {
    try { document.cookie = `country=${code}; path=/; max-age=31536000; SameSite=Lax`; } catch {}
  }

  // ---------- checkout ----------
  function field(name, label, type = "text", attrs = "") {
    return `<label class="fl"><span>${label}</span><input class="field" name="${name}" type="${type}" ${attrs}><small class="err" data-err="${name}"></small></label>`;
  }
  function checkoutPage() {
    if (!cart.length) return cartPage();
    const saved = store.get("customer", {});
    const radio = (group, val, title, desc, extra = "") => `
      <label class="opt"><input type="radio" name="${group}" value="${val}" ${checkout[group] === val ? "checked" : ""}>
        <span class="opt-body"><b>${title}</b><small>${desc}</small></span>${extra}</label>`;
    if (!COUNTRY.cod && checkout.payment === "cod") checkout.payment = "bank";
    const countrySelect = `<label class="fl"><span>${t("country")}</span><select class="field" name="countrySel" autocomplete="country">${COUNTRIES.map((c) => `<option value="${c.code}" ${c.code === COUNTRY.code ? "selected" : ""}>${esc(regionName(c.code))}</option>`).join("")}</select></label>`;
    return `
    <section class="wrap section tight">
      <h1 class="two"><b>${t("checkoutTitle")}</b></h1>
      ${API.ok ? "" : `<p class="notice">${t("serverOff")}</p>`}
      <form class="checkout-layout" id="checkoutForm" novalidate>
        <div class="co-main">
          <div class="panel">
            <h3 class="co-h">1. ${t("contactInfo")}</h3>
            <div class="row2">${field("name", t("fullName"), "text", 'autocomplete="name" required')}${field("phone", t("phone"), "tel", 'autocomplete="tel" required')}</div>
            ${field("email", t("email"), "email", 'autocomplete="email" required')}
          </div>
          <div class="panel">
            <h3 class="co-h">2. ${t("shippingAddress")}</h3>
            ${field("address", t("address"), "text", 'autocomplete="street-address" required')}
            <div class="row3">${field("city", t("city"), "text", 'autocomplete="address-level2" required')}${countrySelect}${field("postal", t("postal"), "text", 'autocomplete="postal-code"')}</div>
            <label class="fl"><span>${t("notes")}</span><textarea class="field" name="notes" rows="2"></textarea></label>
          </div>
          <div class="panel">
            <h3 class="co-h">3. ${t("shippingMethod")}</h3>
            <div class="opts">
              ${radio("shipping", "standard", t("standard"), `${COUNTRY.standardDays} ${t("days")}${COUNTRY.freeOver ? " · " + freeText() : ""}`, `<em>${COUNTRY.standard ? fmt(COUNTRY.standard) : t("free")}</em>`)}
              ${radio("shipping", "express", t("express"), `${COUNTRY.expressDays} ${t("days")}`, `<em>${COUNTRY.express ? fmt(COUNTRY.express) : t("free")}</em>`)}
            </div>
          </div>
          <div class="panel">
            <h3 class="co-h">4. ${t("paymentMethod")}</h3>
            <div class="opts">
              ${COUNTRY.cod ? radio("payment", "cod", t("cod"), t("codDesc"), "<em>💵</em>") : ""}
              ${radio("payment", "bank", t("bank"), t("bankDesc"), "<em>🏦</em>")}
            </div>
          </div>
        </div>
        <aside class="panel summary co-summary">
          <h3 class="co-h">${t("orderSummary")}</h3>
          <div id="summaryBox"><div class="skeleton"></div></div>
          <div class="coupon">
            <input class="field" id="couponInput" placeholder="${t("coupon")}" value="${esc(checkout.coupon)}">
            <button type="button" class="btn ghost" data-coupon>${t("apply")}</button>
          </div>
          <small id="couponMsg" class="muted"></small>
          <button class="btn full" id="placeBtn" ${API.ok ? "" : "disabled"}>${t("placeOrder")} ${I.arrow}</button>
          <small class="muted center">🔒 ${t("secure")}</small>
        </aside>
      </form>
    </section>`;
  }

  async function refreshQuote() {
    const box = $("#summaryBox"); if (!box) return;
    const msg = $("#couponMsg");
    if (!API.ok) {
      const sub = cart.reduce((s, i) => s + (PRODUCTS.find((p) => p.id === i.id)?.price || 0) * i.qty, 0);
      box.innerHTML = `<div class="sum-row"><span>${t("subtotal")}</span><span>${money(sub)}</span></div>`; return;
    }
    try {
      const q = await api("/api/quote", { body: { items: cart, coupon: checkout.coupon, shipping: checkout.shipping, country: COUNTRY.code } });
      const m = (n) => fmt(n, q.currency, q.decimals);
      checkout.quote = q;
      box.innerHTML = `
        <div class="sum-lines">${q.lines.map((l) => `<div class="sum-line"><span class="sl-img"><img src="${l.img}" alt=""><b>${l.qty}</b></span><span>${esc(pname(l))}<small class="muted">${esc(l.size)}</small></span><span>${m(l.total)}</span></div>`).join("")}</div>
        <div class="sum-row"><span>${t("subtotal")}</span><span>${m(q.subtotal)}</span></div>
        ${q.discount ? `<div class="sum-row disc"><span>${t("discount")} (${q.coupon})</span><span>−${m(q.discount)}</span></div>` : ""}
        <div class="sum-row"><span>${t("shippingFee")}</span><span>${q.shipping ? m(q.shipping) : t("free")}</span></div>
        <div class="sum-row total"><span>${t("total")}</span><span>${m(q.total)}</span></div>`;
      if (msg) {
        msg.className = q.couponError ? "err" : "ok";
        msg.textContent = q.couponError === "invalid" ? t("couponBad") : q.couponError === "min" ? `${t("couponMin")} ${m(q.couponMin)}` : q.coupon ? `✓ ${t("couponOk")}` : "";
      }
    } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  async function placeOrder(form) {
    const fd = Object.fromEntries(new FormData(form));
    form.querySelectorAll("[data-err]").forEach((el) => (el.textContent = ""));
    form.querySelectorAll(".field.bad").forEach((el) => el.classList.remove("bad"));
    let bad = false;
    ["name", "phone", "email", "address", "city"].forEach((k) => {
      const v = (fd[k] || "").trim();
      const wrong = !v ? "required" : k === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "invalid" : k === "phone" && !/^[+\d][\d\s\-()]{6,}$/.test(v) ? "invalid" : "";
      if (wrong) { bad = true; form.querySelector(`[data-err="${k}"]`).textContent = t(wrong); form.querySelector(`[name="${k}"]`).classList.add("bad"); }
    });
    if (bad) return form.querySelector(".field.bad").focus();
    const btn = $("#placeBtn"); btn.disabled = true; btn.textContent = t("placing");
    const customer = { name: fd.name, email: fd.email, phone: fd.phone, address: fd.address, city: fd.city, postal: fd.postal };
    try {
      const order = await api("/api/orders", { body: { customer, notes: fd.notes, items: cart, shipping: checkout.shipping, payment: checkout.payment, coupon: checkout.coupon, country: COUNTRY.code, lang } });
      store.set("customer", customer);
      store.set("lastOrder", { number: order.number, email: order.customer.email });
      cart = []; saveCart(); checkout.coupon = ""; store.set("coupon", "");
      navigate(`/${lang}/order/${order.number}?email=${encodeURIComponent(order.customer.email)}&new=1`);
    } catch (e) {
      toast(e.message);
      if (e.fields) Object.entries(e.fields).forEach(([k, v]) => { const el = form.querySelector(`[data-err="${k}"]`); if (el) { el.textContent = t(v); form.querySelector(`[name="${k}"]`).classList.add("bad"); } });
      btn.disabled = false; btn.innerHTML = `${t("placeOrder")} ${I.arrow}`;
      refreshCatalog().then(refreshQuote);
    }
  }

  const pname = (l) => { const p = PRODUCTS.find((x) => x.id === l.id); return p ? name(p) : l.name; };
  function orderPage() { return `<section class="wrap section tight"><div id="orderBox" class="panel"><div class="skeleton"></div></div></section>`; }

  async function loadOrder(number, email, isNew) {
    const box = $("#orderBox"); if (!box) return;
    try {
      const o = await api(`/api/orders/${encodeURIComponent(number)}?email=${encodeURIComponent(email)}`);
      const steps = ["pending", "confirmed", "shipped", "delivered"];
      const m = (n) => fmt(n, o.currency || "USD", o.decimals ?? 2);
      const cur = steps.indexOf(o.status);
      box.innerHTML = `
        <div class="order-head">
          ${isNew ? `<span class="big-check">✓</span><h1 class="two"><b>${t("thanks")}</b></h1><p class="muted">${t("orderConfirm")}</p>` : `${kicker("track")}<h1 class="two"><b>${t("orderNo")} ${esc(o.number)}</b></h1>`}
        </div>
        <div class="order-meta">
          <div><small>${t("orderNo")}</small><b>${esc(o.number)}</b></div>
          <div><small>${t("placedOn")}</small><b>${new Date(o.createdAt).toLocaleDateString(SITE.bcp47, { day: "numeric", month: "short", year: "numeric" })}</b></div>
          <div><small>${t("payment")}</small><b>${t(o.payment)}</b></div>
          <div><small>${t("total")}</small><b class="price">${m(o.total)}</b></div>
        </div>
        ${o.status === "cancelled" ? `<p class="notice">${t("status")}: ${t("cancelled")}</p>` : `
        <ol class="timeline">${steps.map((s, i) => `<li class="${i <= cur ? "done" : ""}"><span></span>${t(s)}</li>`).join("")}</ol>`}
        ${o.bank && o.status === "pending" ? `<div class="bank-box"><h3>🏦 ${t("bankDetails")}</h3>
          <div><small>${t("bankName")}</small><b>${esc(o.bank.bank)}</b></div><div><small>${t("accTitle")}</small><b>${esc(o.bank.title)}</b></div>
          <div><small>${t("iban")}</small><b>${esc(o.bank.iban)}</b></div><p class="muted">${t("bankRef")}</p></div>` : ""}
        <div class="order-cols">
          <div><h3 class="co-h">${t("items")}</h3>${o.items.map((l) => `<div class="sum-line"><span class="sl-img"><img src="${l.img}" alt=""><b>${l.qty}</b></span><span>${esc(pname(l))}<small class="muted">${esc(l.size)}</small></span><span>${m(l.total)}</span></div>`).join("")}
            <div class="sum-row"><span>${t("subtotal")}</span><span>${m(o.subtotal)}</span></div>
            ${o.discount ? `<div class="sum-row disc"><span>${t("discount")}</span><span>−${m(o.discount)}</span></div>` : ""}
            <div class="sum-row"><span>${t("shippingFee")} · ${t(o.shippingMethod)}</span><span>${o.shipping ? m(o.shipping) : t("free")}</span></div>
            <div class="sum-row total"><span>${t("total")}</span><span>${m(o.total)}</span></div></div>
          <div><h3 class="co-h">${t("deliverTo")}</h3><p>${esc(o.customer.name)}<br>${esc(o.customer.address)}<br>${esc(o.customer.city)}, ${esc(o.customer.country)}<br><span class="muted">${esc(o.customer.email)}</span></p></div>
        </div>
        <div class="btns">${SET.whatsapp && o.status === "pending" ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(t("waOrder").replace("{number}", o.number).replace("{total}", m(o.total)))}">${I.whatsapp} ${t("confirmWhatsApp")}</a>` : ""}<a class="btn" href="${link("shop")}">${t("continueShopping")} ${I.arrow}</a><a class="btn ghost" href="${link("track")}">${t("track")}</a></div>`;
    } catch (e) {
      box.innerHTML = `<div class="empty-cart"><h1 class="two"><b>${t("orderNotFound")}</b></h1><p class="muted">${esc(API.ok ? e.message : t("serverOff"))}</p><a class="btn" href="${link("track")}">${t("track")}</a></div>`;
    }
  }

  function trackPage() {
    const last = store.get("lastOrder", {});
    return `
    <section class="wrap"><div class="page-head">${kicker("help")}<h1 class="two"><b>${t("trackTitle")}</b></h1><p class="muted">${t("trackText")}</p></div></section>
    <section class="wrap section tight"><form class="panel contact-form" data-track>
      <input class="field" name="number" required placeholder="${t("orderNo")} (ST-1001)" value="${esc(last.number || "")}">
      <input class="field" name="email" type="email" required placeholder="${t("email")}" value="${esc(last.email || "")}">
      <button class="btn">${t("track")} ${I.arrow}</button>
    </form></section>`;
  }

  // ---------- sales helpers ----------
  const stars = (r) => `<span class="stars-inline">${[1, 2, 3, 4, 5].map((i) => `<i class="${r >= i - 0.25 ? "on" : r >= i - 0.75 ? "half" : ""}">${I.star}</i>`).join("")}</span>`;
  const waLink = (text) => `https://wa.me/${SET.whatsapp}?text=${encodeURIComponent(text)}`;
  const cartSubtotal = () => cart.reduce((s, i) => { const p = PRODUCTS.find((x) => x.id === i.id); return s + (p ? local(p.price) * i.qty : 0); }, 0);
  function freeBar(sub) {
    if (COUNTRY.freeOver === null || COUNTRY.freeOver === undefined || !cart.length) return "";
    const left = Math.max(0, COUNTRY.freeOver - sub), pct = Math.min(100, (sub / COUNTRY.freeOver) * 100);
    return `<div class="free-bar ${left ? "" : "done"}"><p>${left ? t("freeShipLeft").replace("{amount}", `<b>${fmt(Math.round(left * 10 ** COUNTRY.decimals) / 10 ** COUNTRY.decimals)}</b>`) : "🎉 " + t("freeShipDone")}</p><span><i style="width:${pct}%"></i></span></div>`;
  }

  // slide-out cart
  const drawerRoot = document.createElement("div"); drawerRoot.id = "drawer"; document.body.appendChild(drawerRoot);
  function drawerHtml() {
    const items = cart.map((i, idx) => ({ ...i, idx, p: PRODUCTS.find((p) => p.id === i.id) })).filter((i) => i.p);
    const sub = cartSubtotal();
    const inCart = new Set(cart.map((i) => i.id)), cats = new Set(items.map((i) => i.p.cat));
    const upsell = PRODUCTS.filter((p) => !inCart.has(p.id) && !cats.has(p.cat) && p.stock !== 0).slice(0, 2);
    return `
      <div class="drawer-bg" data-drawer-close></div>
      <aside class="drawer-panel" role="dialog" aria-label="${t("yourCart")}">
        <header><h3>${t("yourCart")} <span class="muted">(${cart.reduce((s, i) => s + i.qty, 0)})</span></h3><button class="icon" data-drawer-close aria-label="Close">${I.close}</button></header>
        ${freeBar(sub)}
        <div class="drawer-items">${items.length ? items.map((i) => `
          <div class="d-item"><img src="${i.p.img}" alt=""><div><a href="${link("product/" + i.p.id)}">${esc(name(i.p))}</a><small class="muted">${t("size")}: ${esc(i.size)}</small>
            <div class="qty small"><button data-cq="${i.idx}" data-d="-1">−</button><span>${i.qty}</span><button data-cq="${i.idx}" data-d="1">+</button></div></div>
            <b class="price">${fmt(local(i.p.price) * i.qty)}</b></div>`).join("") : `<p class="muted center empty">${t("emptyCart")}</p>`}
          ${items.length && upsell.length ? `<div class="upsell"><p class="kicker">${t("completeLook")}</p>${upsell.map((p) => `<div class="u-item"><img src="${p.img}" alt=""><a href="${link("product/" + p.id)}">${esc(name(p))}<span class="price">${money(p.price)}</span></a><button class="add" data-add="${p.id}" aria-label="${t("addToCart")}">${I.bagPlus}</button></div>`).join("")}</div>` : ""}
        </div>
        ${items.length ? `<footer><div class="sum-row total"><span>${t("subtotal")}</span><span>${fmt(sub)}</span></div>
          <a class="btn full" href="${link("checkout")}">${t("checkout")} ${I.arrow}</a><a class="btn ghost full" href="${link("cart")}">${t("viewCart")}</a></footer>` : `<footer><a class="btn full" href="${link("shop")}">${t("continueShopping")}</a></footer>`}
      </aside>`;
  }
  function openDrawer() { drawerRoot.innerHTML = drawerHtml(); requestAnimationFrame(() => drawerRoot.classList.add("open")); document.body.classList.add("no-scroll"); }
  function closeDrawer() { drawerRoot.classList.remove("open"); document.body.classList.remove("no-scroll"); }
  function refreshDrawer() { if (drawerRoot.classList.contains("open")) drawerRoot.innerHTML = drawerHtml(); }

  // generic modal (size guide, popup)
  const modalRoot = document.createElement("div"); modalRoot.id = "siteModal"; document.body.appendChild(modalRoot);
  function openModal(html, cls = "") { modalRoot.innerHTML = `<div class="m-bg" data-modal-close></div><div class="m-box ${cls}" role="dialog"><button class="icon m-x" data-modal-close aria-label="Close">${I.close}</button>${html}</div>`; modalRoot.classList.add("open"); }
  function closeModal() { modalRoot.classList.remove("open"); modalRoot.innerHTML = ""; }

  function sizeGuide(cat) {
    const shoes = cat === "shoes", bottoms = cat === "pants";
    const rows = shoes ? [["40", "6.5", "7.5"], ["41", "7.5", "8.5"], ["42", "8", "9"], ["43", "9", "10"], ["44", "9.5", "10.5"]]
      : bottoms ? [["S", "76–81", "79"], ["M", "81–86", "81"], ["L", "86–91", "83"], ["XL", "91–97", "84"], ["XXL", "97–104", "85"]]
      : [["S", "88–94", "73–79"], ["M", "94–100", "79–85"], ["L", "100–106", "85–91"], ["XL", "106–112", "91–97"], ["XXL", "112–118", "97–103"]];
    const head = shoes ? ["EU", "UK", "US"] : bottoms ? [t("size"), t("waist"), t("inseam")] : [t("size"), t("chest"), t("waist")];
    openModal(`<h3>${I.ruler} ${t("sizeGuide")}</h3><p class="muted">${shoes ? t("sgShoes") : bottoms ? t("sgBottoms") : t("sgTops")}</p>
      <table class="sg-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
  }

  // welcome discount popup
  function maybePopup(page) {
    const pop = SET.popup;
    if (!pop || store.get("popupSeen", false) || ["checkout", "order", "cart"].includes(page)) return;
    clearTimeout(maybePopup.t);
    maybePopup.t = setTimeout(() => {
      if (modalRoot.classList.contains("open") || drawerRoot.classList.contains("open")) return;
      store.set("popupSeen", true);
      openModal(`<div class="pop"><span class="pop-icon">${I.gift}</span><h3 class="two"><b>${t("popTitle").replace("{pct}", pop.pct)}</b></h3><p class="muted">${t("popText")}</p>
        <form id="popForm" class="subscribe"><input type="email" required placeholder="${t("email")}"><button class="btn">${t("popBtn")}</button></form>
        <button class="link-btn" data-modal-close>${t("noThanks")}</button></div>`, "pop-box");
    }, (pop.delay || 8) * 1000);
  }

  // recently viewed
  function remember(id) { const r = store.get("recent", []).filter((x) => x !== id); r.unshift(id); store.set("recent", r.slice(0, 10)); }
  function recentSection(skip) {
    const list = store.get("recent", []).filter((id) => id !== skip).map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean).slice(0, 4);
    return list.length ? `<section class="wrap section"><div class="head"><div><h2 class="two"><b>${t("recentlyViewed")}</b></h2></div></div><div class="grid">${list.map(productCard).join("")}</div></section>` : "";
  }

  function wishlistPage() {
    const list = wish.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
    return `<section class="wrap"><div class="page-head">${kicker("wishlist")}<h1 class="two"><b>${t("wishlist")}</b></h1></div></section>
      <section class="wrap section tight">${list.length ? `<div class="grid">${list.map(productCard).join("")}</div>` : `<div class="panel empty-cart"><span class="big-icon">${I.heart}</span><p class="muted">${t("wishEmpty")}</p><a class="btn" href="${link("shop")}">${t("shopNow")} ${I.arrow}</a></div>`}</section>${recentSection()}`;
  }

  async function loadReviews(id) {
    const box = $("#reviewList"); if (!box || !API.ok) return;
    try {
      const list = await api(`/api/reviews/${id}`);
      if (list.length) box.innerHTML = list.map((r) => `<article class="rv"><div class="rv-top"><span class="avatar">${esc(r.name[0])}</span><div><b>${esc(r.name)}</b><small class="muted">${new Date(r.at).toLocaleDateString(SITE.bcp47, { day: "numeric", month: "short", year: "numeric" })}</small></div>${stars(r.rating)}</div><p>${esc(r.text)}</p></article>`).join("");
    } catch {}
  }

  // ---------- router ----------
  let detailSize = null, detailQty = 1, rendered = false;
  function pageTitle(page, arg) {
    const p = page === "product" && PRODUCTS.find((x) => x.id === +arg);
    const map = { "": t("metaHomeTitle"), shop: t("metaShopTitle") + " | STORE", category: t(arg) + " | STORE", product: p ? `${name(p)} — ${money(p.price)} | STORE` : "STORE", cart: t("yourCart") + " | STORE", checkout: t("checkoutTitle") + " | STORE", order: t("orderNo") + " | STORE", track: t("trackTitle") + " | STORE", wishlist: t("wishlist") + " | STORE", about: t("aboutTitle") + " | STORE", contact: t("contactTitle") + " | STORE" };
    return map[page] || "STORE";
  }
  function notFound() {
    return `<section class="wrap section"><div class="panel empty-cart"><h1 class="two"><b>404</b></h1><p class="muted">${t("noResults")}</p><a class="btn" href="${link("shop")}">${t("continueShopping")} ${I.arrow}</a></div></section>`;
  }
  function render() {
    const parts = location.pathname.split("/").filter(Boolean);
    const page = parts[1] || "", arg = parts[2] ? decodeURIComponent(parts[2]) : "";
    const params = new URLSearchParams(location.search);
    document.documentElement.lang = lang;
    document.documentElement.dir = SITE.dir;
    if (rendered) document.title = pageTitle(page, arg);
    rendered = true;
    const view = { "": home, shop: () => shop(params), category: () => shop(params, arg), product: () => product(arg), cart: cartPage, about, contact, checkout: checkoutPage, order: orderPage, track: trackPage, wishlist: wishlistPage }[page] || notFound;
    app.innerHTML = header() + `<main id="main-content">${view()}</main>` + footer();
    window.dispatchEvent(new CustomEvent("store:render"));
    if (SET.whatsapp && !$("#waFab")) document.body.insertAdjacentHTML("beforeend", `<a id="waFab" class="wa-fab" target="_blank" rel="noopener" href="${waLink("")}" aria-label="${t("chatWhatsApp")}">${I.whatsapp}<span>${t("chatWhatsApp")}</span></a>`);
    stickyCheck();
    detailSize = $("[data-default-size]")?.dataset.defaultSize || "M"; detailQty = 1;
    updateCounts();
    observe();
    if (page === "checkout" && cart.length) {
      const saved = store.get("customer", {}); const f = $("#checkoutForm");
      Object.entries(saved).forEach(([k, v]) => { const el = f.querySelector(`[name="${k}"]`); if (el) el.value = v; });
      refreshQuote();
    }
    if (page === "product" && PRODUCTS.some((x) => x.id === +arg)) { remember(+arg); loadReviews(+arg); }
    maybePopup(page);
    if (page === "order") loadOrder(decodeURIComponent(arg || ""), params.get("email") || "", params.get("new") === "1");
  }

  function observe() {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  function navigate(url, replace = false) {
    history[replace ? "replaceState" : "pushState"]({}, "", url);
    render(); if (!replace) window.scrollTo(0, 0);
  }
  function setParam(key, val) {
    const p = new URLSearchParams(location.search);
    val && val !== "all" && val !== "default" ? p.set(key, val) : p.delete(key);
    navigate(location.pathname + (p.toString() ? "?" + p : ""), key === "q");
  }

  // search modal
  function openSearch() {
    const m = $("#searchModal"); m.hidden = false; const inp = $("#searchInput"); inp.value = ""; inp.focus(); runSearch("");
  }
  function closeSearch() { const m = $("#searchModal"); if (m) m.hidden = true; }
  function runSearch(q) {
    q = q.toLowerCase();
    const res = PRODUCTS.filter((p) => !q || name(p).toLowerCase().includes(q)).slice(0, 6);
    $("#searchResults").innerHTML = res.length ? res.map((p) => `<a class="sr" href="${link("product/" + p.id)}"><img src="${p.img}" alt=""><span>${name(p)}</span><b>${money(p.price)}</b></a>`).join("") : `<p class="muted empty">${t("noResults")}</p>`;
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-drawer-close]")) return closeDrawer();
    if (e.target.closest("[data-modal-close]")) return closeModal();
    const sg = e.target.closest("[data-size-guide]"); if (sg) return sizeGuide(sg.dataset.sizeGuide);
    if (e.target.closest("[data-write-review]")) { const f = $("#reviewForm"); f.hidden = !f.hidden; if (!f.hidden) f.querySelector("[name=name]").focus(); return; }
    const wa = e.target.closest("[data-wa-product]");
    if (wa) { const p = PRODUCTS.find((x) => x.id === +wa.dataset.waProduct); wa.href = waLink(t("waProduct").replace("{name}", name(p)).replace("{size}", detailSize).replace("{price}", money(p.price)).replace("{url}", location.origin + link("product/" + p.id))); return; }
    const cb = e.target.closest("[data-copy]"); if (cb) { navigator.clipboard?.writeText(cb.dataset.copy).catch(() => {}); cb.textContent = t("copied"); return; }
    if (e.target.closest(".cart-btn") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); return openDrawer(); }
    if (e.target.id === "searchModal") return closeSearch();
    if (e.target.closest(".sr")) closeSearch();
    const el = e.target.closest("[data-add],[data-add-detail],[data-size],[data-q],[data-cq],[data-remove],[data-filter],[data-menu],[data-theme],[data-checkout],[data-wish],[data-open-search],[data-coupon]");
    if (!el) { if (e.target.closest(".nav-links a")) $("#navLinks")?.classList.remove("open"); return; }
    const d = el.dataset;
    if (d.add) addToCart(+d.add);
    if (d.addDetail) addToCart(+d.addDetail, detailSize, detailQty);
    if (d.size) { detailSize = d.size; document.querySelectorAll(".size").forEach((b) => b.classList.toggle("active", b === el)); }
    if (d.q) { detailQty = Math.max(1, detailQty + +d.q); $("#qtyVal").textContent = detailQty; }
    if (d.cq !== undefined) {
      const it = cart[+d.cq], prod = PRODUCTS.find((x) => x.id === it.id);
      if (+d.d > 0 && prod && cart.filter((i) => i.id === it.id).reduce((s, i) => s + i.qty, 0) >= prod.stock) return toast(t("onlyLeft").replace("{n}", prod.stock));
      it.qty += +d.d; if (it.qty < 1) cart.splice(+d.cq, 1); saveCart();
      if (drawerRoot.classList.contains("open")) refreshDrawer(); if (location.pathname.endsWith("/cart")) render();
    }
    if (d.remove !== undefined) { cart.splice(+d.remove, 1); saveCart(); render(); }
    if (d.filter) setParam(d.filter, d.val);
    if (d.menu !== undefined) $("#navLinks").classList.toggle("open");
    if (d.theme !== undefined) store.set("dark", document.documentElement.classList.toggle("dark"));
    if (el.matches("[data-coupon]")) { checkout.coupon = $("#couponInput").value.trim(); store.set("coupon", checkout.coupon); refreshQuote(); }
    if (d.openSearch !== undefined) openSearch();
    if (d.wish) {
      const id = +d.wish; wish = wish.includes(id) ? wish.filter((x) => x !== id) : [...wish, id]; store.set("wish", wish);
      document.querySelectorAll(`[data-wish="${id}"]`).forEach((b) => b.classList.toggle("on", wish.includes(id)));
      updateCounts(); if (location.pathname.endsWith("/wishlist")) render();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "couponInput") { e.preventDefault(); checkout.coupon = e.target.value.trim(); refreshQuote(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    if (e.key === "Escape") { closeSearch(); closeDrawer(); closeModal(); }
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-sort]")) setParam("sort", e.target.value);
    if (e.target.name === "shipping") { checkout.shipping = e.target.value; refreshQuote(); }
    if (e.target.name === "countrySel") {
      const c = COUNTRIES.find((x) => x.code === e.target.value); if (!c) return;
      const f = $("#checkoutForm"); store.set("customer", { ...store.get("customer", {}), ...Object.fromEntries([...new FormData(f)].filter(([k]) => ["name", "phone", "email", "address", "city", "postal", "notes"].includes(k))) });
      setCountry(c.code); COUNTRY = c; render();
    }
    if (e.target.name === "payment") checkout.payment = e.target.value;
  });
  let st;
  document.addEventListener("input", (e) => {
    if (e.target.id === "searchInput") runSearch(e.target.value);
    if (e.target.matches("[data-search]")) {
      clearTimeout(st); const v = e.target.value;
      st = setTimeout(() => { setParam("q", v); setTimeout(() => { const s = $("[data-search]"); s.focus(); s.setSelectionRange(v.length, v.length); }); }, 400);
    }
  });
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === "checkoutForm") return placeOrder(f);
    if (f.id === "popForm") {
      const email = f.querySelector("input").value;
      (API.ok ? api("/api/newsletter", { body: { email } }) : Promise.resolve()).then(() => {
        checkout.coupon = SET.popup.code; store.set("coupon", SET.popup.code);
        f.outerHTML = `<div class="code-box"><small>${t("popCode")}</small><b>${SET.popup.code}</b><button type="button" class="btn ghost" data-copy="${SET.popup.code}">${t("copy")}</button></div>`;
      }).catch((err) => toast(err.message));
      return;
    }
    if (f.id === "reviewForm") {
      const d = Object.fromEntries(new FormData(f));
      api("/api/reviews", { body: { productId: +f.dataset.product, name: d.name, rating: +d.rating, text: d.text, lang } })
        .then(() => { f.outerHTML = `<p class="notice">✓ ${t("reviewThanks")}</p>`; }).catch((err) => toast(err.message));
      return;
    }
    if (f.matches("[data-track]")) { const d = Object.fromEntries(new FormData(f)); navigate(`/${lang}/order/${encodeURIComponent(d.number.trim())}?email=${encodeURIComponent(d.email.trim())}`); return; }
    if (f.matches("[data-subscribe]")) {
      const email = f.querySelector("input").value;
      (API.ok ? api("/api/newsletter", { body: { email } }) : Promise.resolve()).then(() => { toast(t("subscribed")); f.reset(); }).catch((err) => toast(err.message));
    }
    if (f.matches("[data-contact]")) {
      const [name, email, message] = [...f.querySelectorAll(".field")].map((x) => x.value);
      (API.ok ? api("/api/contact", { body: { name, email, message } }) : Promise.resolve()).then(() => { toast(t("sent")); f.reset(); }).catch((err) => toast(err.message));
    }
  });

  window.addEventListener("popstate", () => render());
  function stickyCheck() { const sticky = $("#stickyBuy"), buy = $(".buy-row"); if (sticky && buy) sticky.classList.toggle("show", buy.getBoundingClientRect().bottom < 0); }
  window.addEventListener("scroll", stickyCheck, { passive: true });
  // client-side navigation for links inside the current language (other languages load a fresh, server-rendered page)
  document.addEventListener("click", (e) => {
    const cc = e.target.closest("[data-country]");
    if (cc) { setCountry(cc.dataset.country); if (new URL(cc.href).pathname === location.pathname) { e.preventDefault(); location.reload(); } return; }
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(`/${lang}`) || a.hasAttribute("data-lang")) return;
    e.preventDefault();
    document.querySelectorAll("details.lang-menu[open]").forEach((d) => d.removeAttribute("open"));
    $("#navLinks")?.classList.remove("open");
    navigate(url.pathname + url.search);
  });
  if (store.get("dark", false)) document.documentElement.classList.add("dark");

  // load live prices/stock from the backend (falls back to js/data.js when opened without the server)
  async function refreshCatalog() {
    const list = await api("/api/products?lang=" + lang);
    const ids = new Set(list.map((p) => p.id));
    list.forEach((sp) => { const p = PRODUCTS.find((x) => x.id === sp.id); if (p) Object.assign(p, sp); else PRODUCTS.push(sp); });
    for (let i = PRODUCTS.length - 1; i >= 0; i--) if (!ids.has(PRODUCTS[i].id)) PRODUCTS.splice(i, 1);
    cart = cart.filter((i) => ids.has(i.id)); saveCart();
  }
  (async () => {
    if (location.protocol.startsWith("http")) {
      try { API.config = await api("/api/config"); await refreshCatalog(); API.ok = true; window.STORE.config = API.config; } catch {}
    }
    render();
  })();
})();
