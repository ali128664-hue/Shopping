// Simple hash-router SPA: #/en, #/ar/shop, #/en/product/3, #/en/cart ...
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  let cart = store.get("cart", []);
  let lang = "en";
  const t = (k) => I18N[lang][k] ?? k;
  const name = (p) => p[lang];
  const money = (n) => "$" + n.toFixed(2);
  const link = (path = "") => `#/${lang}${path ? "/" + path : ""}`;

  // ---------- cart ----------
  function saveCart() { store.set("cart", cart); updateCartCount(); }
  function addToCart(id, size = "M", qty = 1) {
    const item = cart.find((i) => i.id === id && i.size === size);
    item ? (item.qty += qty) : cart.push({ id, size, qty });
    saveCart();
    toast(t("added"));
  }
  function updateCartCount() {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll(".cart-count").forEach((el) => { el.textContent = n; el.hidden = !n; });
  }
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2000);
  }

  // ---------- components ----------
  function productCard(p) {
    return `
    <article class="card">
      <a href="${link("product/" + p.id)}" class="card-img">
        <img src="${p.img}" alt="${name(p)}" loading="lazy">
        ${p.badge ? `<span class="badge ${p.badge}">${t(p.badge)}</span>` : ""}
      </a>
      <button class="quick-add" data-add="${p.id}">${t("addToCart")}</button>
      <div class="card-body">
        <span class="card-cat">${t(p.cat)}</span>
        <a href="${link("product/" + p.id)}" class="card-title">${name(p)}</a>
        <div class="price">${money(p.price)} ${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}</div>
      </div>
    </article>`;
  }

  function header() {
    const other = lang === "en" ? "ar" : "en";
    const route = location.hash.replace(/^#\/(en|ar)/, "");
    return `
    <div class="announce">${t("announce")}</div>
    <header class="header">
      <div class="container nav">
        <button class="icon-btn menu-btn" aria-label="Menu" data-menu>☰</button>
        <a href="${link()}" class="logo">${t("brand")}</a>
        <nav class="nav-links" id="navLinks">
          <a href="${link()}">${t("home")}</a>
          <a href="${link("shop")}">${t("shop")}</a>
          <a href="${link("about")}">${t("about")}</a>
          <a href="${link("contact")}">${t("contact")}</a>
        </nav>
        <div class="nav-actions">
          <a class="lang" href="#/${other}${route}">${other === "ar" ? "العربية" : "EN"}</a>
          <button class="icon-btn" data-theme aria-label="Theme">◐</button>
          <a href="${link("cart")}" class="icon-btn cart-btn" aria-label="${t("cart")}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
            <span class="cart-count" hidden>0</span>
          </a>
        </div>
      </div>
    </header>`;
  }

  function footer() {
    return `
    <section class="newsletter">
      <div class="container narrow center">
        <h2>${t("newsletter")}</h2>
        <p>${t("newsletterText")}</p>
        <form class="subscribe" data-subscribe>
          <input type="email" required placeholder="${t("email")}">
          <button class="btn">${t("subscribe")}</button>
        </form>
      </div>
    </section>
    <footer class="footer">
      <div class="container footer-grid">
        <div><div class="logo">${t("brand")}</div><p>${t("footerText")}</p></div>
        <div><h4>${t("shop")}</h4>${CATEGORIES.map((c) => `<a href="${link("shop?cat=" + c)}">${t(c)}</a>`).join("")}</div>
        <div><h4>${t("help")}</h4><a href="${link("contact")}">${t("shipping")}</a><a href="${link("contact")}">${t("returns")}</a><a href="${link("contact")}">${t("faq")}</a></div>
        <div><h4>${t("contact")}</h4><a href="mailto:hello@store.com">hello@store.com</a><span>+1 (555) 123-4567</span></div>
      </div>
      <div class="container copy">© ${new Date().getFullYear()} ${t("brand")}. ${t("rights")}</div>
    </footer>`;
  }

  // ---------- pages ----------
  function home() {
    return `
    <section class="hero">
      <img src="https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=1800&q=80" alt="">
      <div class="hero-overlay"></div>
      <div class="container hero-content">
        <span class="kicker">${t("heroKicker")}</span>
        <h1>${t("heroTitle")}</h1>
        <p>${t("heroText")}</p>
        <div class="hero-btns">
          <a href="${link("shop")}" class="btn btn-light">${t("shopNow")}</a>
          <a href="${link("shop")}" class="btn btn-outline-light">${t("explore")}</a>
        </div>
      </div>
    </section>

    <section class="features container">
      ${[1, 2, 3, 4].map((i) => `<div class="feature"><span class="f-icon">${["✈", "↺", "🔒", "★"][i - 1]}</span><div><strong>${t("f" + i + "t")}</strong><small>${t("f" + i + "d")}</small></div></div>`).join("")}
    </section>

    <section class="section container">
      <div class="section-head"><h2>${t("categories")}</h2></div>
      <div class="cat-grid">
        ${CATEGORIES.map((c) => `
          <a class="cat" href="${link("shop?cat=" + c)}"><img src="${PRODUCTS.find((x) => x.cat === c).img}" alt="" loading="lazy"><span>${t(c)}</span></a>`).join("")}
      </div>
    </section>

    <section class="section container">
      <div class="section-head"><h2>${t("featured")}</h2><a href="${link("shop")}" class="more">${t("viewAll")} →</a></div>
      <div class="grid">${PRODUCTS.slice(0, 8).map(productCard).join("")}</div>
    </section>

    <section class="banner">
      <img src="https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=1800&q=80" alt="" loading="lazy">
      <div class="hero-overlay"></div>
      <div class="container banner-content">
        <h2>${t("bannerTitle")}</h2><p>${t("bannerText")}</p>
        <a href="${link("shop?cat=suits")}" class="btn btn-light">${t("shopNow")}</a>
      </div>
    </section>`;
  }

  function shop(params) {
    const cat = params.get("cat") || "all";
    const q = (params.get("q") || "").toLowerCase();
    const sort = params.get("sort") || "default";
    let list = PRODUCTS.filter((p) => (cat === "all" || p.cat === cat) && (!q || p.en.toLowerCase().includes(q) || p.ar.includes(q)));
    if (sort === "low") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
    return `
    <section class="page-head"><div class="container"><h1>${t("shop")}</h1></div></section>
    <section class="container section">
      <div class="toolbar">
        <div class="chips">
          ${["all", ...CATEGORIES].map((c) => `<button class="chip ${c === cat ? "active" : ""}" data-filter="cat" data-val="${c}">${t(c)}</button>`).join("")}
        </div>
        <div class="tools">
          <input class="search" type="search" placeholder="${t("search")}" value="${q}" data-search>
          <select data-sort>
            <option value="default" ${sort === "default" ? "selected" : ""}>${t("sortDefault")}</option>
            <option value="low" ${sort === "low" ? "selected" : ""}>${t("sortLow")}</option>
            <option value="high" ${sort === "high" ? "selected" : ""}>${t("sortHigh")}</option>
          </select>
        </div>
      </div>
      <p class="muted">${list.length} ${t("products")}</p>
      ${list.length ? `<div class="grid">${list.map(productCard).join("")}</div>` : `<p class="empty">${t("noResults")}</p>`}
    </section>`;
  }

  function product(id) {
    const p = PRODUCTS.find((x) => x.id === +id);
    if (!p) return shop(new URLSearchParams());
    const related = PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id).concat(PRODUCTS.filter((x) => x.cat !== p.cat)).slice(0, 4);
    return `
    <section class="container section product">
      <div class="product-img"><img src="${p.img.replace("w=800", "w=1200")}" alt="${name(p)}"></div>
      <div class="product-info">
        <a href="${link("shop?cat=" + p.cat)}" class="card-cat">${t(p.cat)}</a>
        <h1>${name(p)}</h1>
        <div class="price big">${money(p.price)} ${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}</div>
        <p class="muted">${t("productDesc")}</p>
        <label class="label">${t("size")}</label>
        <div class="sizes">${["S", "M", "L", "XL", "XXL"].map((s) => `<button class="size ${s === "M" ? "active" : ""}" data-size="${s}">${s}</button>`).join("")}</div>
        <label class="label">${t("qty")}</label>
        <div class="qty"><button data-q="-1">−</button><span id="qtyVal">1</span><button data-q="1">+</button></div>
        <button class="btn btn-block" data-add-detail="${p.id}">${t("addToCart")}</button>
        <ul class="perks"><li>✈ ${t("f1d")}</li><li>↺ ${t("f2d")}</li></ul>
      </div>
    </section>
    <section class="container section">
      <div class="section-head"><h2>${t("related")}</h2></div>
      <div class="grid">${related.map(productCard).join("")}</div>
    </section>`;
  }

  function cartPage() {
    const items = cart.map((i) => ({ ...i, p: PRODUCTS.find((p) => p.id === i.id) })).filter((i) => i.p);
    if (!items.length) return `<section class="container section center empty-cart"><h1>${t("yourCart")}</h1><p class="muted">${t("emptyCart")}</p><a class="btn" href="${link("shop")}">${t("continueShopping")}</a></section>`;
    const sub = items.reduce((s, i) => s + i.p.price * i.qty, 0);
    const ship = sub >= 150 ? 0 : 15;
    return `
    <section class="container section">
      <h1>${t("yourCart")}</h1>
      <div class="cart-layout">
        <div class="cart-items">
          ${items.map((i, idx) => `
          <div class="cart-item">
            <img src="${i.p.img}" alt="">
            <div class="ci-info"><a href="${link("product/" + i.p.id)}">${name(i.p)}</a><small class="muted">${t("size")}: ${i.size}</small><span>${money(i.p.price)}</span></div>
            <div class="qty small"><button data-cq="${idx}" data-d="-1">−</button><span>${i.qty}</span><button data-cq="${idx}" data-d="1">+</button></div>
            <button class="link-btn" data-remove="${idx}">${t("remove")}</button>
          </div>`).join("")}
        </div>
        <aside class="summary">
          <div><span>${t("subtotal")}</span><span>${money(sub)}</span></div>
          <div><span>${t("shippingFee")}</span><span>${ship ? money(ship) : t("free")}</span></div>
          <div class="total"><span>${t("total")}</span><span>${money(sub + ship)}</span></div>
          <button class="btn btn-block" data-checkout>${t("checkout")}</button>
          <a class="muted center-block" href="${link("shop")}">${t("continueShopping")}</a>
        </aside>
      </div>
    </section>`;
  }

  function about() {
    return `
    <section class="page-head"><div class="container"><h1>${t("aboutTitle")}</h1></div></section>
    <section class="container section about">
      <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80" alt="">
      <p>${t("aboutText")}</p>
    </section>`;
  }

  function contact() {
    return `
    <section class="page-head"><div class="container"><h1>${t("contactTitle")}</h1></div></section>
    <section class="container narrow section">
      <form class="contact-form" data-contact>
        <input required placeholder="${t("name")}">
        <input type="email" required placeholder="${t("email")}">
        <textarea required rows="5" placeholder="${t("message")}"></textarea>
        <button class="btn">${t("send")}</button>
      </form>
    </section>`;
  }

  // ---------- router ----------
  function render() {
    const hash = location.hash || "#/en";
    const m = hash.match(/^#\/(en|ar)\/?([^?]*)\??(.*)$/);
    if (!m) { location.hash = "#/en"; return; }
    lang = m[1];
    const [page, arg] = m[2].split("/");
    const params = new URLSearchParams(m[3]);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = `${t("brand")} | ${lang === "ar" ? "متجر أزياء فاخر" : "Premium Fashion Store"}`;
    const view = { "": home, shop: () => shop(params), product: () => product(arg), cart: cartPage, about, contact }[page] || home;
    app.innerHTML = header() + `<main id="main-content">${view()}</main>` + footer();
    updateCartCount();
    window.scrollTo(0, 0);
  }

  function setParam(key, val) {
    const [base, qs] = location.hash.split("?");
    const p = new URLSearchParams(qs);
    val && val !== "all" && val !== "default" ? p.set(key, val) : p.delete(key);
    location.hash = base + (p.toString() ? "?" + p : "");
  }

  // ---------- events ----------
  let detailSize = "M", detailQty = 1;
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-add],[data-add-detail],[data-size],[data-q],[data-cq],[data-remove],[data-filter],[data-menu],[data-theme],[data-checkout]");
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
    if (d.theme !== undefined) { const dark = document.documentElement.classList.toggle("dark"); store.set("dark", dark); }
    if (d.checkout !== undefined) toast(t("orderPlaced"));
  });
  document.addEventListener("change", (e) => { if (e.target.matches("[data-sort]")) setParam("sort", e.target.value); });
  let st;
  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-search]")) { clearTimeout(st); const v = e.target.value; st = setTimeout(() => { setParam("q", v); setTimeout(() => { const s = $("[data-search]"); s.focus(); s.setSelectionRange(v.length, v.length); }); }, 400); }
  });
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.matches("[data-subscribe]")) { toast(t("subscribed")); e.target.reset(); }
    if (e.target.matches("[data-contact]")) { toast(t("sent")); e.target.reset(); }
  });

  window.addEventListener("hashchange", () => { detailSize = "M"; detailQty = 1; render(); });
  if (store.get("dark", false)) document.documentElement.classList.add("dark");
  render();
})();
