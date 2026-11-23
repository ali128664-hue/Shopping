// Hash-router SPA: #/en, #/ar/shop, #/en/product/3, #/en/cart ...
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  let cart = store.get("cart", []);
  let wish = store.get("wish", []);
  let lang = "en";
  const t = (k) => I18N[lang][k] ?? k;
  const name = (p) => p[lang];
  const money = (n) => "$" + n;
  const link = (path = "") => `#/${lang}${path ? "/" + path : ""}`;
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
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    star: '<svg viewBox="0 0 24 24" class="fill"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>'
  };

  // ---------- cart ----------
  function saveCart() { store.set("cart", cart); updateCounts(); }
  function addToCart(id, size = "M", qty = 1) {
    const item = cart.find((i) => i.id === id && i.size === size);
    item ? (item.qty += qty) : cart.push({ id, size, qty });
    saveCart(); toast(t("added"));
  }
  function updateCounts() {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll(".cart-count").forEach((el) => { el.textContent = n; el.hidden = !n; });
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
      <span class="rating">${I.star}${p.rating}</span>
      ${p.isNew ? `<span class="tag">${t("new")}</span>` : ""}
      <div class="pcard-body">
        <div>
          <a href="${link("product/" + p.id)}" class="pname">${name(p)}</a>
          <div class="price">${money(p.price)} ${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}</div>
        </div>
        <button class="add" data-add="${p.id}" aria-label="${t("addToCart")}">${I.bagPlus}</button>
      </div>
    </article>`;
  }

  function header() {
    const other = lang === "en" ? "ar" : "en";
    const route = location.hash.replace(/^#\/(en|ar)/, "");
    return `
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
            <a class="pill lang" href="#/${other}${route}"><span class="flag">${lang === "en" ? "🇺🇸" : "🇸🇦"}</span>${lang.toUpperCase()}</a>
            <button class="icon" data-theme aria-label="Theme">${I.moon}</button>
            <button class="pill search-pill" data-open-search>${I.search}<span>${t("searchLbl")}</span><kbd>Ctrl+K</kbd></button>
            <a class="icon hide-sm" href="${link("contact")}" aria-label="Account">${I.user}</a>
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
        <div><h4>${t("shop")}</h4>${CATEGORIES.slice(0, 5).map((c) => `<a href="${link("shop?cat=" + c)}">${t(c)}</a>`).join("")}</div>
        <div><h4>${t("help")}</h4><a href="${link("contact")}">${t("shipping")}</a><a href="${link("contact")}">${t("returns")}</a><a href="${link("contact")}">${t("faq")}</a></div>
        <div><h4>${t("company")}</h4><a href="${link("about")}">${t("about")}</a><a href="${link("contact")}">${t("contact")}</a><a href="mailto:hello@store.com">hello@store.com</a></div>
      </div>
      <div class="wrap copy">© ${new Date().getFullYear()} STORE. ${t("rights")}</div>
    </footer>`;
  }

  // ---------- pages ----------
  function home() {
    const edits = [9, 10, 8].map((id) => PRODUCTS.find((p) => p.id === id));
    const fresh = PRODUCTS.filter((p) => p.isNew).slice(0, 2);
    const best = [...PRODUCTS].sort((a, b) => b.rating - a.rating).slice(0, 8);
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
          <div class="feature"><span class="ficon">${I[ic]}</span><div><strong>${t("f" + i + "t")}</strong><small>${t("f" + i + "d")}</small></div></div>`).join("")}
      </div>
    </section>

    <section class="wrap section">
      <div class="head reveal"><div>${kicker("curateKicker")}${two("curateThin", "curateBold")}</div><a class="more" href="${link("shop")}">${t("viewAll")} ${I.arrow}</a></div>
      <div class="edits">
        ${edits.map((p, i) => `
          <a class="edit-card reveal" href="${link("shop?cat=" + p.cat)}">
            <span class="roman">${["I", "II", "III"][i]}</span>
            <div class="edit-img"><img src="${p.img}" alt="" loading="lazy"></div>
            <small>${t("edit")} ${["I", "II", "III"][i]}</small>
            <h3>${t("e" + (i + 1))}</h3>
          </a>`).join("")}
      </div>
    </section>

    <section class="wrap section">
      <div class="arrivals">
        <a class="drop-card reveal" href="${link("product/1")}">
          <img src="${PRODUCTS[0].img.replace("w=800", "w=1200")}" alt="" loading="lazy">
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
          <a class="cat reveal" href="${link("shop?cat=" + c)}"><div class="cat-img"><img src="${PRODUCTS.find((p) => p.cat === c).img}" alt="" loading="lazy"></div><span>${t(c)}</span></a>`).join("")}
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
        <img src="${PRODUCTS[7].img}" alt="" loading="lazy">
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

  function shop(params) {
    const cat = params.get("cat") || "all";
    const q = (params.get("q") || "").toLowerCase();
    const sort = params.get("sort") || "default";
    let list = PRODUCTS.filter((p) =>
      (cat === "all" || p.cat === cat) &&
      (!params.get("new") || p.isNew) &&
      (!params.get("sale") || p.oldPrice) &&
      (!q || p.en.toLowerCase().includes(q) || p.ar.includes(q)));
    if (sort === "low") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
    const title = params.get("new") ? t("newArrivals") : params.get("sale") ? t("sale") : cat !== "all" ? t(cat) : t("shop");
    return `
    <section class="wrap"><div class="page-head">${kicker("catKicker")}<h1 class="two"><b>${title}</b></h1></div></section>
    <section class="wrap section tight">
      <div class="toolbar">
        <div class="chips">${["all", ...CATEGORIES].map((c) => `<button class="chip ${c === cat ? "active" : ""}" data-filter="cat" data-val="${c}">${t(c)}</button>`).join("")}</div>
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
        <a href="${link("shop?cat=" + p.cat)}" class="kicker">${t(p.cat)}</a>
        <h1>${name(p)}</h1>
        <div class="rating-line">${I.star.repeat(Math.round(p.rating))} <span>${p.rating}</span></div>
        <div class="price big">${money(p.price)} ${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}</div>
        <p class="muted">${t("productDesc")}</p>
        <label class="label">${t("size")}</label>
        <div class="sizes">${sizes.map((s, i) => `<button class="size ${i === 1 ? "active" : ""}" data-size="${s}">${s}</button>`).join("")}</div>
        <label class="label">${t("qty")}</label>
        <div class="qty"><button data-q="-1">−</button><span id="qtyVal">1</span><button data-q="1">+</button></div>
        <div class="buy-row">
          <button class="btn grow" data-add-detail="${p.id}" data-default-size="${sizes[1]}">${t("addToCart")} ${I.bag}</button>
          <button class="round big-heart heart ${wish.includes(p.id) ? "on" : ""}" data-wish="${p.id}">${I.heart}</button>
        </div>
        <ul class="perks"><li>${I.truck}${t("f1d")}</li><li>${I.refresh}${t("f2d")}</li><li>${I.shield}${t("f3d")}</li></ul>
      </div>
    </section>
    <section class="wrap section">
      <div class="head"><div>${kicker("bestKicker")}<h2 class="two"><b>${t("related")}</b></h2></div></div>
      <div class="grid">${related.map(productCard).join("")}</div>
    </section>`;
  }

  function cartPage() {
    const items = cart.map((i) => ({ ...i, p: PRODUCTS.find((p) => p.id === i.id) })).filter((i) => i.p);
    if (!items.length) return `<section class="wrap section"><div class="panel empty-cart"><span class="big-icon">${I.bag}</span><h1 class="two"><b>${t("yourCart")}</b></h1><p class="muted">${t("emptyCart")}</p><a class="btn" href="${link("shop")}">${t("continueShopping")} ${I.arrow}</a></div></section>`;
    const sub = items.reduce((s, i) => s + i.p.price * i.qty, 0);
    const ship = sub >= 75 ? 0 : 9;
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
          <div><span>${t("subtotal")}</span><span>${money(sub)}</span></div>
          <div><span>${t("shippingFee")}</span><span>${ship ? money(ship) : t("free")}</span></div>
          <div class="total"><span>${t("total")}</span><span>${money(sub + ship)}</span></div>
          <button class="btn full" data-checkout>${t("checkout")} ${I.arrow}</button>
          <a class="muted center" href="${link("shop")}">${t("continueShopping")}</a>
        </aside>
      </div>
    </section>`;
  }

  function about() {
    return `
    <section class="wrap"><div class="page-head">${kicker("company")}<h1 class="two"><b>${t("aboutTitle")}</b></h1></div></section>
    <section class="wrap section tight"><div class="panel about"><img src="${PRODUCTS[8].img}" alt=""><p>${t("aboutText")}</p></div></section>`;
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

  // ---------- router ----------
  let detailSize = null, detailQty = 1;
  function render() {
    const hash = location.hash || "#/en";
    const m = hash.match(/^#\/(en|ar)\/?([^?]*)\??(.*)$/);
    if (!m) { location.hash = "#/en"; return; }
    lang = m[1];
    const [page, arg] = m[2].split("/");
    const params = new URLSearchParams(m[3]);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = `STORE | ${lang === "ar" ? "متجر أزياء فاخر" : "Premium Fashion Store"}`;
    const view = { "": home, shop: () => shop(params), product: () => product(arg), cart: cartPage, about, contact }[page] || home;
    app.innerHTML = header() + `<main id="main-content">${view()}</main>` + footer();
    detailSize = $("[data-default-size]")?.dataset.defaultSize || "M"; detailQty = 1;
    updateCounts();
    observe();
  }

  function observe() {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  function setParam(key, val) {
    const [base, qs] = location.hash.split("?");
    const p = new URLSearchParams(qs);
    val && val !== "all" && val !== "default" ? p.set(key, val) : p.delete(key);
    location.hash = base + (p.toString() ? "?" + p : "");
  }

  // search modal
  function openSearch() {
    const m = $("#searchModal"); m.hidden = false; const inp = $("#searchInput"); inp.value = ""; inp.focus(); runSearch("");
  }
  function closeSearch() { const m = $("#searchModal"); if (m) m.hidden = true; }
  function runSearch(q) {
    q = q.toLowerCase();
    const res = PRODUCTS.filter((p) => !q || p.en.toLowerCase().includes(q) || p.ar.includes(q)).slice(0, 6);
    $("#searchResults").innerHTML = res.length ? res.map((p) => `<a class="sr" href="${link("product/" + p.id)}"><img src="${p.img}" alt=""><span>${name(p)}</span><b>${money(p.price)}</b></a>`).join("") : `<p class="muted empty">${t("noResults")}</p>`;
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    if (e.target.id === "searchModal") return closeSearch();
    if (e.target.closest(".sr")) closeSearch();
    const el = e.target.closest("[data-add],[data-add-detail],[data-size],[data-q],[data-cq],[data-remove],[data-filter],[data-menu],[data-theme],[data-checkout],[data-wish],[data-open-search]");
    if (!el) { if (e.target.closest(".nav-links a")) $("#navLinks")?.classList.remove("open"); return; }
    const d = el.dataset;
    if (d.add) addToCart(+d.add);
    if (d.addDetail) addToCart(+d.addDetail, detailSize, detailQty);
    if (d.size) { detailSize = d.size; document.querySelectorAll(".size").forEach((b) => b.classList.toggle("active", b === el)); }
    if (d.q) { detailQty = Math.max(1, detailQty + +d.q); $("#qtyVal").textContent = detailQty; }
    if (d.cq !== undefined) { const it = cart[+d.cq]; it.qty += +d.d; if (it.qty < 1) cart.splice(+d.cq, 1); saveCart(); render(); }
    if (d.remove !== undefined) { cart.splice(+d.remove, 1); saveCart(); render(); }
    if (d.filter) setParam(d.filter, d.val);
    if (d.menu !== undefined) $("#navLinks").classList.toggle("open");
    if (d.theme !== undefined) store.set("dark", document.documentElement.classList.toggle("dark"));
    if (d.checkout !== undefined) toast(t("orderPlaced"));
    if (d.openSearch !== undefined) openSearch();
    if (d.wish) {
      const id = +d.wish; wish = wish.includes(id) ? wish.filter((x) => x !== id) : [...wish, id]; store.set("wish", wish);
      document.querySelectorAll(`[data-wish="${id}"]`).forEach((b) => b.classList.toggle("on", wish.includes(id)));
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    if (e.key === "Escape") closeSearch();
  });
  document.addEventListener("change", (e) => { if (e.target.matches("[data-sort]")) setParam("sort", e.target.value); });
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
    if (e.target.matches("[data-subscribe]")) { toast(t("subscribed")); e.target.reset(); }
    if (e.target.matches("[data-contact]")) { toast(t("sent")); e.target.reset(); }
  });

  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
  if (store.get("dark", false)) document.documentElement.classList.add("dark");
  render();
})();
