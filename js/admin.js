// STORE admin panel
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const root = $("#admin");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n, cur = "USD", dec = 2) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: Number.isInteger(+n) ? 0 : dec, maximumFractionDigits: dec }).format(n); } catch { return `${cur} ${n}`; } };
  const date = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const flag = (code) => /^[A-Z]{2}$/.test(code || "") ? `<img class="flag-img" src="https://flagcdn.com/w40/${code.toLowerCase()}.png" alt="" width="20" height="15">` : "";
  const CATS = ["tshirts", "hoodies", "jackets", "pants", "shirts", "shoes", "hats"];
  const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  let token = sessionStorage.getItem("adminToken") || "";
  let tab = location.hash.slice(1) || "dashboard";
  let ordersCache = [], filter = "all", search = "";
  let productsCache = [], LANGS = [], seoData = null, seoLang = "en", editing = null, editLang = "en";

  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  async function api(path, opts = {}) {
    const r = await fetch(path, { method: opts.method || (opts.body ? "POST" : "GET"), headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== "/api/admin/login") { logout(); throw new Error(j.error || "Please log in again."); }
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  }

  function logout() { token = ""; sessionStorage.removeItem("adminToken"); login(); }

  function login(err = "") {
    root.innerHTML = `
      <div class="login">
        <form class="panel login-card" id="loginForm">
          <a class="logo" href="/">STORE</a>
          <p class="muted">Admin panel</p>
          <input class="field" type="password" name="password" placeholder="Password" autocomplete="current-password" required autofocus>
          <small class="err">${esc(err)}</small>
          <button class="btn full">Log in</button>
        </form>
      </div>`;
  }

  function shell(content) {
    const nav = [["dashboard", "Dashboard"], ["orders", "Orders"], ["products", "Products"], ["countries", "Countries & Shipping"], ["coupons", "Coupons"], ["reviews", "Reviews"], ["seo", "SEO"], ["settings", "Settings"], ["messages", "Messages"]];
    root.innerHTML = `
      <aside class="side">
        <a class="logo" href="/">STORE</a>
        <nav>${nav.map(([k, v]) => `<a href="#${k}" class="${tab === k ? "active" : ""}">${v}</a>`).join("")}</nav>
        <div class="side-foot"><a href="/" target="_blank">View store ↗</a><button class="link-btn" data-logout>Log out</button></div>
      </aside>
      <main class="admin-main">${content}</main>`;
  }

  // ---------- dashboard ----------
  async function dashboard() {
    const s = await api("/api/admin/stats");
    const max = Math.max(1, ...s.days.map((d) => d.total));
    shell(`
      <h1>Dashboard</h1>
      <div class="kpis">
        <div class="kpi"><small>Total revenue (USD)</small><b>${money(s.revenue)}</b></div>
        <div class="kpi"><small>Today (USD)</small><b>${money(s.todayRevenue)}</b></div>
        <div class="kpi"><small>Orders</small><b>${s.orders}</b><a href="#orders">${s.pending} pending →</a></div>
        <div class="kpi"><small>Customers</small><b>${s.customers}</b><span>${s.subscribers} subscribers</span></div>
      </div>
      <div class="a-grid">
        <section class="panel">
          <h3>Revenue · last 14 days (USD)</h3>
          <div class="bars">${s.days.map((d) => `<div class="bar" title="${d.day}: ${money(d.total)}"><span style="height:${Math.max(2, (d.total / max) * 100)}%"></span><small>${d.day.slice(8)}</small></div>`).join("")}</div>
          <h3 style="margin-top:24px">Sales by country</h3>
          ${s.byCountry.length ? `<ul class="toplist">${s.byCountry.map((c) => `<li><span>${flag(c.code)} ${esc(c.name)}</span><b>${c.orders} orders · ${money(c.revenue)}</b></li>`).join("")}</ul>` : `<p class="muted">No sales yet.</p>`}
        </section>
        <section class="panel">
          <h3>Top products</h3>
          ${s.topProducts.length ? `<ol class="toplist">${s.topProducts.map((p) => `<li><span>${esc(p.name)}</span><b>${p.qty} sold</b></li>`).join("")}</ol>` : `<p class="muted">No sales yet.</p>`}
          <h3 style="margin-top:22px">Low stock</h3>
          ${s.lowStock.length ? `<ul class="toplist">${s.lowStock.map((p) => `<li><span>${esc(p.name)}</span><b class="${p.stock ? "warn" : "danger"}">${p.stock} left</b></li>`).join("")}</ul>` : `<p class="muted">All products are well stocked.</p>`}
          ${s.pendingReviews ? `<p style="margin-top:18px"><a class="more" href="#reviews">${s.pendingReviews} review(s) waiting for approval →</a></p>` : ""}
          ${s.unreadMessages ? `<p style="margin-top:18px"><a class="more" href="#messages">${s.unreadMessages} unread message(s) →</a></p>` : ""}
        </section>
      </div>`);
  }

  // ---------- orders ----------
  const om = (o, n) => money(n, o.currency || "USD", o.decimals ?? 2);
  function orderRows() {
    const q = search.toLowerCase();
    const list = ordersCache.filter((o) => (filter === "all" || o.status === filter) && (!q || [o.number, o.customer.name, o.customer.email, o.customer.phone, o.customer.country].join(" ").toLowerCase().includes(q)));
    if (!list.length) return `<tr><td colspan="8" class="muted center">No orders found.</td></tr>`;
    return list.map((o) => `
      <tr>
        <td><button class="link-btn strong" data-open="${esc(o.number)}">${esc(o.number)}</button></td>
        <td>${date(o.createdAt)}</td>
        <td>${esc(o.customer.name)}<small class="muted block">${esc(o.customer.phone)}</small></td>
        <td>${flag(o.countryCode)} ${esc(o.customer.country)}</td>
        <td>${o.items.reduce((s, l) => s + l.qty, 0)}</td>
        <td>${o.payment === "cod" ? "Cash" : "Bank"}</td>
        <td><b>${om(o, o.total)}</b></td>
        <td><select class="status s-${o.status}" data-status="${esc(o.number)}">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
      </tr>`).join("");
  }

  async function orders() {
    ordersCache = await api("/api/admin/orders");
    const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: ordersCache.filter((o) => o.status === s).length }), {});
    shell(`
      <div class="a-head"><h1>Orders</h1><a class="btn ghost" href="/api/admin/orders.csv?token=${encodeURIComponent(token)}">Export CSV</a></div>
      <div class="a-tools">
        <div class="chips">${["all", ...STATUSES].map((s) => `<button class="chip ${filter === s ? "active" : ""}" data-filter="${s}">${s}${s !== "all" ? ` (${counts[s]})` : ""}</button>`).join("")}</div>
        <input class="field" id="orderSearch" placeholder="Search order, name, email, phone, country" value="${esc(search)}">
      </div>
      <div class="panel table-wrap"><table>
        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Country</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead>
        <tbody id="orderBody">${orderRows()}</tbody>
      </table></div>`);
  }

  function modal(html, wide = true) {
    $("#adminModal")?.remove();
    const m = document.createElement("div"); m.className = "fr-modal"; m.id = "adminModal";
    m.innerHTML = `<div class="fr-dialog ${wide ? "wide" : ""}">${html}</div>`;
    document.body.appendChild(m);
    return m;
  }

  function orderModal(number) {
    const o = ordersCache.find((x) => x.number === number); if (!o) return;
    modal(`
        <div class="a-head"><h2>${esc(o.number)}</h2><button class="fr-x dark" data-close>×</button></div>
        <p class="muted">${date(o.createdAt)} · ${flag(o.countryCode)} ${esc(o.customer.country)} · ${o.payment === "cod" ? "Cash on delivery" : "Bank transfer"} · ${esc(o.shippingMethod)} shipping${o.coupon ? ` · coupon ${esc(o.coupon)}` : ""}${o.lang ? ` · language ${esc(o.lang)}` : ""}</p>
        <div class="order-cols">
          <div>${o.items.map((l) => `<div class="sum-line"><span class="sl-img"><img src="${esc(l.img)}" alt=""><b>${l.qty}</b></span><span>${esc(l.name)}<small class="muted">Size ${esc(l.size)} · ${om(o, l.price)}</small></span><span>${om(o, l.total)}</span></div>`).join("")}
            <div class="sum-row"><span>Subtotal</span><span>${om(o, o.subtotal)}</span></div>
            ${o.discount ? `<div class="sum-row disc"><span>Discount</span><span>−${om(o, o.discount)}</span></div>` : ""}
            <div class="sum-row"><span>Shipping</span><span>${om(o, o.shipping)}</span></div>
            <div class="sum-row total"><span>Total</span><span>${om(o, o.total)}</span></div>
            ${o.currency && o.currency !== "USD" ? `<p class="muted" style="font-size:12px">≈ ${money(o.totalUSD)} at 1 USD = ${o.rate} ${o.currency}</p>` : ""}</div>
          <div><h3 class="co-h">Customer</h3><p>${esc(o.customer.name)}<br><a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a><br><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></p>
            <h3 class="co-h" style="margin-top:14px">Address</h3><p>${esc(o.customer.address)}<br>${esc(o.customer.city)} ${esc(o.customer.postal)}<br>${esc(o.customer.country)}</p>
            ${o.notes ? `<h3 class="co-h" style="margin-top:14px">Notes</h3><p>${esc(o.notes)}</p>` : ""}
            <h3 class="co-h" style="margin-top:14px">History</h3><ul class="toplist">${o.history.map((h) => `<li><span>${esc(h.status)}</span><small class="muted">${date(h.at)}</small></li>`).join("")}</ul></div>
        </div>`);
  }

  // ---------- products ----------
  async function loadLangs() { if (!LANGS.length) LANGS = (await api("/api/admin/seo")).languages; }

  async function products() {
    await loadLangs();
    productsCache = await api("/api/admin/products");
    shell(`
      <div class="a-head"><h1>Products</h1><button class="btn" data-new-product>+ Add product</button></div>
      <p class="muted">Prices are in USD and shown to each customer in their country's currency. Price, sale price and stock save when you leave a field. Use Edit for names, descriptions and SEO in every language.</p>
      <div class="panel table-wrap"><table>
        <thead><tr><th></th><th>Product</th><th>Price ($)</th><th>Old price ($)</th><th>Stock</th><th>Languages</th><th>Visible</th><th></th></tr></thead>
        <tbody>${productsCache.map((p) => `
          <tr class="${p.active ? "" : "dim"}">
            <td><img class="thumb" src="${esc(p.img)}" alt=""></td>
            <td><b>${esc(p.names.en)}</b><small class="muted block">${esc(p.cat)} · #${p.id}${p.isNew ? " · new" : ""}</small></td>
            <td><input class="field num" type="number" min="1" step="0.01" value="${p.price}" data-p="${p.id}" data-k="price"></td>
            <td><input class="field num" type="number" min="0" step="0.01" value="${p.oldPrice ?? ""}" placeholder="—" data-p="${p.id}" data-k="oldPrice"></td>
            <td><input class="field num ${p.stock <= 5 ? "low" : ""}" type="number" min="0" step="1" value="${p.stock}" data-p="${p.id}" data-k="stock"></td>
            <td><span class="pill-count ${Object.keys(p.names).length < LANGS.length ? "warn" : ""}">${Object.keys(p.names).length}/${LANGS.length}</span></td>
            <td><label class="switch"><input type="checkbox" ${p.active ? "checked" : ""} data-p="${p.id}" data-k="active"><span></span></label></td>
            <td class="row-actions"><button class="btn ghost sm" data-edit="${p.id}">Edit</button><button class="link-btn danger" data-delete="${p.id}">Delete</button></td>
          </tr>`).join("")}</tbody>
      </table></div>`);
  }

  function productModal(p) {
    editing = p ? JSON.parse(JSON.stringify(p)) : { cat: "shirts", img: "", price: "", oldPrice: null, stock: 10, rating: 0, isNew: true, active: true, names: {}, descs: {}, seo: {} };
    editLang = "en";
    const m = modal(`
      <div class="a-head"><h2>${p ? "Edit product #" + p.id : "Add product"}</h2><button class="fr-x dark" data-close>×</button></div>
      <form id="productForm" class="pe-grid">
        <div class="pe-left">
          <div class="pe-img"><img id="peImg" src="${esc(editing.img)}" alt="" ${editing.img ? "" : "hidden"}><span id="peNoImg" ${editing.img ? "hidden" : ""}>No image</span></div>
          <label class="btn ghost full upload-btn">Upload image<input type="file" id="peFile" accept="image/jpeg,image/png,image/webp" hidden></label>
          <label class="fl"><span>…or image link (https://)</span><input class="field" name="img" value="${esc(editing.img)}" placeholder="https://"></label>
        </div>
        <div class="pe-right">
          <div class="row3">
            <label class="fl"><span>Category</span><select class="field" name="cat">${CATS.map((c) => `<option ${c === editing.cat ? "selected" : ""}>${c}</option>`).join("")}</select></label>
            <label class="fl"><span>Price (USD)</span><input class="field" name="price" type="number" min="0.01" step="0.01" value="${editing.price}" required></label>
            <label class="fl"><span>Old price (USD)</span><input class="field" name="oldPrice" type="number" min="0" step="0.01" value="${editing.oldPrice ?? ""}" placeholder="—"></label>
          </div>
          <div class="row3">
            <label class="fl"><span>Stock</span><input class="field" name="stock" type="number" min="0" step="1" value="${editing.stock}"></label>
            <div class="checks"><label><input type="checkbox" name="isNew" ${editing.isNew ? "checked" : ""}> “New” badge</label><label><input type="checkbox" name="active" ${editing.active ? "checked" : ""}> Visible in store</label></div>
          </div>
          <div class="lang-tabs" id="langTabs"></div>
          <div id="langPanel"></div>
        </div>
      </form>
      <div class="a-head"><small class="muted">English name is required. Empty languages fall back to English.</small><div class="btns"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-save-product>${p ? "Save changes" : "Add product"}</button></div></div>`);
    renderLangPanel();
    m.querySelector("#peFile").addEventListener("change", uploadImage);
    m.querySelector('[name="img"]').addEventListener("input", (e) => setImg(e.target.value.trim()));
  }

  function setImg(url) {
    editing.img = url;
    const img = $("#peImg"); img.src = url; img.hidden = !url; $("#peNoImg").hidden = !!url;
  }

  async function uploadImage(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5e6) return toast("Image is too large (max 5 MB).");
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    try { const { url } = await api("/api/admin/upload", { body: { dataUrl } }); setImg(url); $('[name="img"]').value = url; toast("Image uploaded"); }
    catch (err) { toast(err.message); }
  }

  function saveLangInputs() {
    const panel = $("#langPanel"); if (!panel || !editing) return;
    const v = (n) => panel.querySelector(`[name="${n}"]`)?.value ?? "";
    editing.names[editLang] = v("lname"); editing.descs[editLang] = v("ldesc");
    editing.seo[editLang] = { title: v("lseoTitle"), desc: v("lseoDesc") };
  }

  function renderLangPanel() {
    const filled = (l) => editing.names[l] && String(editing.names[l]).trim();
    $("#langTabs").innerHTML = LANGS.map((l) => `<button type="button" class="lt ${l.code === editLang ? "on" : ""} ${filled(l.code) ? "ok" : ""}" data-elang="${l.code}" title="${esc(l.name)}">${l.code.toUpperCase()}</button>`).join("");
    const info = LANGS.find((l) => l.code === editLang), seo = editing.seo[editLang] || {};
    $("#langPanel").innerHTML = `
      <div dir="${info.dir}" lang="${info.code}" class="lang-fields">
        <p class="muted" style="font-size:13px">${esc(info.name)}${editLang === "en" ? " · required" : " · optional, falls back to English"}</p>
        <label class="fl"><span>Name</span><input class="field" name="lname" maxlength="120" value="${esc(editing.names[editLang] || "")}" placeholder="${esc(editLang === "en" ? "" : editing.names.en || "")}"></label>
        <label class="fl"><span>Description</span><textarea class="field" name="ldesc" rows="3" maxlength="2000" placeholder="Default product text is used when empty">${esc(editing.descs[editLang] || "")}</textarea></label>
        <label class="fl"><span>SEO title <small class="count" data-for="lseoTitle"></small></span><input class="field" name="lseoTitle" maxlength="120" value="${esc(seo.title || "")}" placeholder="Automatic: name — price | STORE"></label>
        <label class="fl"><span>SEO description <small class="count" data-for="lseoDesc"></small></span><textarea class="field" name="lseoDesc" rows="2" maxlength="320" placeholder="Automatic from the SEO template">${esc(seo.desc || "")}</textarea></label>
      </div>`;
    updateCounters();
  }

  function updateCounters() {
    document.querySelectorAll(".count[data-for]").forEach((c) => {
      const el = document.querySelector(`[name="${c.dataset.for}"]`); if (!el) return;
      const max = /title|Title/.test(c.dataset.for) ? 60 : 160, n = el.value.length;
      c.textContent = `${n}/${max}`; c.classList.toggle("over", n > max);
    });
  }

  async function saveProduct() {
    saveLangInputs();
    const f = $("#productForm"), v = (n) => f.querySelector(`[name="${n}"]`);
    const body = {
      cat: v("cat").value, img: v("img").value.trim() || editing.img, price: v("price").value, oldPrice: v("oldPrice").value,
      stock: v("stock").value, isNew: v("isNew").checked, active: v("active").checked,
      names: {}, descs: {}, seo: {}
    };
    LANGS.forEach((l) => { body.names[l.code] = editing.names[l.code] || ""; body.descs[l.code] = editing.descs[l.code] || ""; body.seo[l.code] = editing.seo[l.code] || { title: "", desc: "" }; });
    try {
      const saved = editing.id ? await api(`/api/admin/products/${editing.id}`, { method: "PUT", body }) : await api("/api/admin/products", { body });
      $("#adminModal")?.remove(); toast(`Saved · ${saved.names.en}`); products();
    } catch (err) { toast(err.message); }
  }

  // ---------- countries ----------
  async function countriesView() {
    const { countries, languages } = await api("/api/admin/countries");
    const langOpts = (sel) => languages.map((l) => `<option value="${l.code}" ${l.code === sel ? "selected" : ""}>${esc(l.name)}</option>`).join("");
    const row = (c, isNew) => `
      <tr data-country="${isNew ? "" : c.code}" class="${c.active || isNew ? "" : "dim"}">
        <td>${isNew ? `<input class="field xs" name="code" maxlength="2" placeholder="FR">` : `<label class="switch"><input type="checkbox" name="active" ${c.active ? "checked" : ""}><span></span></label>`}</td>
        <td class="cname">${isNew ? `<input class="field" name="name" placeholder="France">` : `${flag(c.code)} <input class="field" name="name" value="${esc(c.name)}">`}</td>
        <td><select class="field" name="lang">${langOpts(c.lang)}</select></td>
        <td><input class="field xs" name="currency" maxlength="3" value="${esc(c.currency || "")}" placeholder="EUR"></td>
        <td><input class="field num" name="rate" type="number" step="any" min="0" value="${c.rate ?? ""}"></td>
        <td><input class="field xs" name="decimals" type="number" min="0" max="3" value="${c.decimals ?? 2}"></td>
        <td><input class="field num" name="standard" type="number" step="any" min="0" value="${c.standard ?? ""}"></td>
        <td><input class="field xs" name="standardDays" value="${esc(c.standardDays || "")}"></td>
        <td><input class="field num" name="express" type="number" step="any" min="0" value="${c.express ?? ""}"></td>
        <td><input class="field xs" name="expressDays" value="${esc(c.expressDays || "")}"></td>
        <td><input class="field num" name="freeOver" type="number" step="any" min="0" value="${c.freeOver ?? ""}" placeholder="never"></td>
        <td><label class="switch"><input type="checkbox" name="cod" ${c.cod ? "checked" : ""}><span></span></label></td>
        <td><button class="btn sm" data-save-country>${isNew ? "Add" : "Save"}</button></td>
      </tr>`;
    shell(`
      <h1>Countries & Shipping</h1>
      <p class="muted">Each country has its own language (chosen automatically when a customer picks the country), currency, exchange rate and shipping prices.
      Shipping prices and the free-shipping limit are in that country's currency. <b>Check the exchange rates</b> — they convert your USD product prices.</p>
      <div class="panel table-wrap"><table class="countries">
        <thead><tr><th>On</th><th>Country</th><th>Language</th><th>Currency</th><th>1 USD =</th><th>Dec.</th><th>Standard</th><th>Days</th><th>Express</th><th>Days</th><th>Free over</th><th>COD</th><th></th></tr></thead>
        <tbody>${countries.map((c) => row(c)).join("")}${row({ lang: "en", decimals: 2, cod: false }, true)}</tbody>
      </table></div>`);
  }

  async function saveCountry(tr) {
    const v = (n) => tr.querySelector(`[name="${n}"]`);
    const body = {};
    ["name", "lang", "currency", "rate", "decimals", "standard", "standardDays", "express", "expressDays", "freeOver"].forEach((k) => (body[k] = v(k).value));
    body.cod = v("cod").checked;
    let code = tr.dataset.country;
    if (code) body.active = v("active").checked; else code = v("code").value.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return toast("Enter a 2-letter country code (e.g. FR).");
    try { const c = await api(`/api/admin/countries/${code}`, { method: "PUT", body }); toast(`Saved · ${c.name}`); countriesView(); }
    catch (err) { toast(err.message); }
  }

  // ---------- SEO ----------
  const SEO_LABELS = {
    metaHomeTitle: ["Home page — title", 60], metaHomeDesc: ["Home page — description", 160],
    metaShopTitle: ["Shop page — title", 60], metaShopDesc: ["Shop page — description", 160],
    metaCatDesc: ["Category pages — description (use {cat})", 160], metaProductDesc: ["Product pages — description (use {name} and {price})", 160],
    metaAboutDesc: ["About page — description", 160], metaContactDesc: ["Contact page — description", 160]
  };
  async function seoView() {
    seoData = await api("/api/admin/seo");
    const info = seoData.languages.find((l) => l.code === seoLang);
    const val = (k) => (seoData.overrides[seoLang] || {})[k] ?? seoData.defaults[seoLang][k];
    shell(`
      <div class="a-head"><h1>SEO</h1>
        <select class="field" id="seoLang">${seoData.languages.map((l) => `<option value="${l.code}" ${l.code === seoLang ? "selected" : ""}>${esc(l.name)} (${l.code})${seoData.overrides[l.code] ? " · edited" : ""}</option>`).join("")}</select></div>
      <p class="muted">Titles and descriptions Google shows for each page, per language. Keep titles under ~60 characters and descriptions under ~160. Product-specific SEO is in Products → Edit.</p>
      <div class="a-grid">
        <form class="panel seo-form" id="seoForm" dir="${info.dir}" lang="${info.code}">
          ${seoData.keys.map((k) => `
            <label class="fl"><span>${SEO_LABELS[k][0]} <small class="count" data-for="${k}"></small>
              ${(seoData.overrides[seoLang] || {})[k] !== undefined ? `<button type="button" class="link-btn" data-reset-seo="${k}">reset</button>` : ""}</span>
              ${SEO_LABELS[k][1] > 60 ? `<textarea class="field" name="${k}" rows="2">${esc(val(k))}</textarea>` : `<input class="field" name="${k}" value="${esc(val(k))}">`}
            </label>`).join("")}
          <button class="btn">Save ${esc(info.name)}</button>
        </form>
        <section class="panel">
          <h3>Google preview</h3>
          <div class="serp" dir="${info.dir}"><small>your-domain.com › ${seoLang}</small><b id="serpTitle"></b><p id="serpDesc"></p></div>
          <p class="muted" style="font-size:13px;margin-top:14px">Set <code>SITE_URL</code> in <code>.env</code> to your real domain and submit <code>/sitemap.xml</code> in Google Search Console.</p>
        </section>
      </div>`);
    seoCounters();
  }
  function seoCounters() {
    document.querySelectorAll("#seoForm .count").forEach((c) => {
      const el = document.querySelector(`#seoForm [name="${c.dataset.for}"]`), max = SEO_LABELS[c.dataset.for][1];
      c.textContent = `${el.value.length}/${max}`; c.classList.toggle("over", el.value.length > max);
    });
    const t = $("#serpTitle"); if (t) { t.textContent = $('#seoForm [name="metaHomeTitle"]').value; $("#serpDesc").textContent = $('#seoForm [name="metaHomeDesc"]').value; }
  }

  // ---------- coupons ----------
  async function couponsView() {
    const list = await api("/api/admin/coupons");
    const row = (c, isNew) => `
      <tr data-coupon="${isNew ? "" : esc(c.code)}" class="${c.active || isNew ? "" : "dim"}">
        <td>${isNew ? `<input class="field" name="code" placeholder="EID25" maxlength="30">` : `<b>${esc(c.code)}</b>`}</td>
        <td><select class="field" name="type">${[["percent", "% off"], ["fixed", "$ off"], ["shipping", "Free shipping"]].map(([v, l]) => `<option value="${v}" ${c.type === v ? "selected" : ""}>${l}</option>`).join("")}</select></td>
        <td><input class="field num" name="value" type="number" min="0" step="any" value="${c.value ?? ""}"></td>
        <td><input class="field num" name="min" type="number" min="0" step="any" value="${c.min || ""}" placeholder="0"></td>
        <td><input class="field" name="expires" type="date" value="${c.expires || ""}"></td>
        <td><input class="field xs" name="maxUses" type="number" min="1" value="${c.maxUses ?? ""}" placeholder="∞"></td>
        <td>${isNew ? "—" : `${c.uses || 0}`}</td>
        <td>${isNew ? "" : `<label class="switch"><input type="checkbox" name="active" ${c.active ? "checked" : ""}><span></span></label>`}</td>
        <td class="row-actions"><button class="btn sm" data-save-coupon>${isNew ? "Add" : "Save"}</button>${isNew ? "" : `<button class="link-btn danger" data-del-coupon="${esc(c.code)}">Delete</button>`}</td>
      </tr>`;
    shell(`
      <h1>Coupons</h1>
      <p class="muted">Discount codes customers type at checkout. “$ off” and the minimum order are in USD and converted to each country's currency. Leave expiry and max uses empty for no limit.</p>
      <div class="panel table-wrap"><table class="countries">
        <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min order ($)</th><th>Expires</th><th>Max uses</th><th>Used</th><th>On</th><th></th></tr></thead>
        <tbody>${list.map((c) => row(c)).join("")}${row({ type: "percent", active: true }, true)}</tbody>
      </table></div>`);
  }
  async function saveCoupon(tr) {
    const v = (n) => tr.querySelector(`[name="${n}"]`);
    const code = tr.dataset.coupon || v("code").value.trim().toUpperCase();
    const body = { type: v("type").value, value: v("value").value || 0, min: v("min").value, expires: v("expires").value, maxUses: v("maxUses").value };
    if (v("active")) body.active = v("active").checked;
    try { await api(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: "PUT", body }); toast(`Saved · ${code}`); couponsView(); } catch (err) { toast(err.message); }
  }

  // ---------- reviews ----------
  async function reviewsView() {
    const list = await api("/api/admin/reviews");
    const pending = list.filter((r) => r.status === "pending").length;
    shell(`
      <h1>Reviews</h1>
      <p class="muted">Customer reviews appear on the product page after you approve them. Approved reviews also show star ratings in Google.${pending ? ` <b>${pending} waiting.</b>` : ""}</p>
      <div class="panel">${list.length ? list.map((r) => `
        <article class="msg ${r.status === "pending" ? "unread" : ""}">
          <div class="a-head"><span class="rv-prod"><img class="thumb sm" src="${esc(r.img || "")}" alt=""> <b>${esc(r.product)}</b></span><small class="muted">${date(r.at)} · ${esc(r.lang)} · <span class="st st-${r.status}">${r.status}</span></small></div>
          <div><b>${esc(r.name)}</b> <span class="stars-txt">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></div>
          <p>${esc(r.text)}</p>
          <div class="row-actions">${r.status !== "approved" ? `<button class="btn sm" data-review="${r.id}" data-st="approved">Approve</button>` : `<button class="btn ghost sm" data-review="${r.id}" data-st="hidden">Hide</button>`}<button class="link-btn danger" data-del-review="${r.id}">Delete</button></div>
        </article>`).join("") : `<p class="muted">No reviews yet.</p>`}</div>`);
  }

  // ---------- settings ----------
  let annLang = "en";
  async function settingsView() {
    const { settings: st, languages, coupons } = await api("/api/admin/settings");
    LANGS = languages;
    shell(`
      <h1>Settings</h1>
      <form class="a-grid" id="settingsForm">
        <section class="panel set-sec">
          <h3>WhatsApp</h3>
          <p class="muted">Shows a chat button, “Order on WhatsApp” on products and “Confirm on WhatsApp” after checkout. Leave empty to hide.</p>
          <label class="fl"><span>WhatsApp number (with country code)</span><input class="field" name="whatsapp" value="${esc(st.whatsapp)}" placeholder="+92 300 1234567"></label>
          <h3 style="margin-top:18px">Welcome popup</h3>
          <p class="muted">New visitors get a discount code for their email. Uses a “% off” coupon.</p>
          <label class="checks"><label><input type="checkbox" name="popupEnabled" ${st.popup.enabled ? "checked" : ""}> Show the popup</label></label>
          <div class="row2">
            <label class="fl"><span>Coupon</span><select class="field" name="popupCode">${coupons.map((c) => `<option ${c === st.popup.code ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
            <label class="fl"><span>Show after (seconds)</span><input class="field" name="popupDelay" type="number" min="0" max="120" value="${st.popup.delay}"></label>
          </div>
        </section>
        <section class="panel set-sec">
          <h3>Announcement bar</h3>
          <p class="muted">The line at the very top of the store. Empty = automatic free-shipping message for the customer's country.</p>
          <div class="lang-tabs">${languages.map((l) => `<button type="button" class="lt ${l.code === annLang ? "on" : ""} ${st.announcement[l.code] ? "ok" : ""}" data-ann="${l.code}">${l.code.toUpperCase()}</button>`).join("")}</div>
          ${languages.map((l) => `<label class="fl ann-field" data-ann-field="${l.code}" ${l.code === annLang ? "" : "hidden"}><span>${esc(l.name)}</span><input class="field" name="ann_${l.code}" dir="${l.dir}" maxlength="160" value="${esc(st.announcement[l.code] || "")}" placeholder="e.g. Eid Sale — 20% off everything"></label>`).join("")}
        </section>
        <button class="btn">Save settings</button>
      </form>`);
  }

  // ---------- messages ----------
  async function messages() {
    const d = await api("/api/admin/messages");
    shell(`
      <h1>Messages</h1>
      <div class="a-grid">
        <section class="panel">
          <h3>Contact messages</h3>
          ${d.messages.length ? d.messages.map((m) => `
            <article class="msg ${m.read ? "" : "unread"}">
              <div class="a-head"><b>${esc(m.name)}</b><small class="muted">${date(m.at)}</small></div>
              <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>
              <p>${esc(m.message)}</p>
              ${m.read ? "" : `<button class="link-btn" data-read="${esc(m.id)}">Mark as read</button>`}
            </article>`).join("") : `<p class="muted">No messages yet.</p>`}
        </section>
        <section class="panel">
          <h3>Newsletter subscribers (${d.subscribers.length})</h3>
          ${d.subscribers.length ? `<ul class="toplist">${d.subscribers.map((s) => `<li><span>${esc(s.email)}</span><small class="muted">${date(s.at)}</small></li>`).join("")}</ul>` : `<p class="muted">No subscribers yet.</p>`}
        </section>
      </div>`);
  }

  async function show() {
    if (!token) return login();
    tab = location.hash.slice(1) || "dashboard";
    try { await ({ dashboard, orders, products, countries: countriesView, coupons: couponsView, reviews: reviewsView, seo: seoView, settings: settingsView, messages }[tab] || dashboard)(); }
    catch (e) { if (token) { shell(`<p class="notice">${esc(e.message)}</p>`); } }
  }

  // ---------- events ----------
  document.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (e.target.id === "loginForm") {
      try {
        const { token: t } = await api("/api/admin/login", { body: { password: e.target.password.value } });
        token = t; sessionStorage.setItem("adminToken", t); show();
      } catch (err) { login(err.message); }
    }
    if (e.target.id === "settingsForm") {
      const f = e.target, v = (n) => f.querySelector(`[name="${n}"]`);
      const body = { whatsapp: v("whatsapp").value, popup: { enabled: v("popupEnabled").checked, code: v("popupCode").value, delay: v("popupDelay").value }, announcement: {} };
      LANGS.forEach((l) => (body.announcement[l.code] = v("ann_" + l.code).value));
      try { await api("/api/admin/settings", { method: "PUT", body }); toast("Settings saved"); settingsView(); } catch (err) { toast(err.message); }
    }
    if (e.target.id === "seoForm") {
      const body = Object.fromEntries(new FormData(e.target));
      try { await api(`/api/admin/seo/${seoLang}`, { method: "PUT", body }); toast("SEO saved"); seoView(); } catch (err) { toast(err.message); }
    }
  });
  document.addEventListener("click", async (e) => {
    if (e.target.id === "adminModal") return e.target.remove();
    const b = e.target.closest("[data-logout],[data-filter],[data-open],[data-close],[data-read],[data-new-product],[data-edit],[data-delete],[data-elang],[data-save-product],[data-save-country],[data-reset-seo],[data-save-coupon],[data-del-coupon],[data-review],[data-del-review],[data-ann]");
    if (!b) return;
    if (b.matches("[data-logout]")) logout();
    if (b.dataset.filter) { filter = b.dataset.filter; orders(); }
    if (b.dataset.open) orderModal(b.dataset.open);
    if (b.matches("[data-close]")) { $("#adminModal")?.remove(); editing = null; }
    if (b.dataset.read) { await api(`/api/admin/messages/${b.dataset.read}`, { method: "PATCH", body: {} }); messages(); }
    if (b.matches("[data-new-product]")) productModal(null);
    if (b.dataset.edit) productModal(productsCache.find((p) => p.id === +b.dataset.edit));
    if (b.dataset.delete) {
      const p = productsCache.find((x) => x.id === +b.dataset.delete);
      if (p && window.confirm(`Delete “${p.names.en}” permanently? Existing orders keep their copy. To only hide it, use the Visible switch instead.`)) {
        try { await api(`/api/admin/products/${p.id}`, { method: "DELETE" }); toast("Product deleted"); products(); } catch (err) { toast(err.message); }
      }
    }
    if (b.dataset.elang) { saveLangInputs(); editLang = b.dataset.elang; renderLangPanel(); }
    if (b.matches("[data-save-product]")) saveProduct();
    if (b.matches("[data-save-country]")) saveCountry(b.closest("tr"));
    if (b.matches("[data-save-coupon]")) saveCoupon(b.closest("tr"));
    if (b.dataset.delCoupon && window.confirm(`Delete coupon ${b.dataset.delCoupon}?`)) { try { await api(`/api/admin/coupons/${encodeURIComponent(b.dataset.delCoupon)}`, { method: "DELETE" }); toast("Coupon deleted"); couponsView(); } catch (err) { toast(err.message); } }
    if (b.dataset.review) { try { await api(`/api/admin/reviews/${b.dataset.review}`, { method: "PATCH", body: { status: b.dataset.st } }); toast(`Review ${b.dataset.st}`); reviewsView(); } catch (err) { toast(err.message); } }
    if (b.dataset.delReview && window.confirm("Delete this review?")) { await api(`/api/admin/reviews/${b.dataset.delReview}`, { method: "DELETE" }); toast("Review deleted"); reviewsView(); }
    if (b.dataset.ann) { annLang = b.dataset.ann; document.querySelectorAll("[data-ann]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-ann-field]").forEach((x) => (x.hidden = x.dataset.annField !== annLang)); }
    if (b.dataset.resetSeo) { const el = $(`#seoForm [name="${b.dataset.resetSeo}"]`); el.value = seoData.defaults[seoLang][b.dataset.resetSeo]; seoCounters(); }
  });
  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.id === "seoLang") { seoLang = el.value; return seoView(); }
    if (el.closest("#productForm") || el.closest("table.countries") || el.closest("#settingsForm")) return;
    try {
      if (el.dataset.status) {
        const o = await api(`/api/admin/orders/${encodeURIComponent(el.dataset.status)}`, { method: "PATCH", body: { status: el.value } });
        const i = ordersCache.findIndex((x) => x.number === o.number); ordersCache[i] = o;
        el.className = "status s-" + o.status; toast(`${o.number} → ${o.status}`);
      }
      if (el.dataset.p) {
        const v = el.type === "checkbox" ? el.checked : el.value;
        const p = await api(`/api/admin/products/${el.dataset.p}`, { method: "PATCH", body: { [el.dataset.k]: v } });
        const i = productsCache.findIndex((x) => x.id === p.id); productsCache[i] = p;
        el.closest("tr").classList.toggle("dim", !p.active);
        if (el.dataset.k === "stock") el.classList.toggle("low", p.stock <= 5);
        toast(`Saved · ${p.names.en}`);
      }
    } catch (err) { toast(err.message); show(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "orderSearch") { search = e.target.value; $("#orderBody").innerHTML = orderRows(); }
    if (e.target.closest("#langPanel")) updateCounters();
    if (e.target.closest("#seoForm")) seoCounters();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#adminModal")?.remove(); });
  window.addEventListener("hashchange", show);
  show();
})();
