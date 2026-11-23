// STORE admin panel
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const root = $("#admin");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(+n) ? 0 : 2, maximumFractionDigits: 2 });
  const date = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  let token = sessionStorage.getItem("adminToken") || "";
  let tab = location.hash.slice(1) || "dashboard";
  let ordersCache = [], filter = "all", search = "";

  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2200);
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
    const nav = [["dashboard", "Dashboard"], ["orders", "Orders"], ["products", "Products"], ["messages", "Messages"]];
    root.innerHTML = `
      <aside class="side">
        <a class="logo" href="/">STORE</a>
        <nav>${nav.map(([k, v]) => `<a href="#${k}" class="${tab === k ? "active" : ""}">${v}</a>`).join("")}</nav>
        <div class="side-foot"><a href="/" target="_blank">View store ↗</a><button class="link-btn" data-logout>Log out</button></div>
      </aside>
      <main class="admin-main">${content}</main>`;
  }

  // ---------- views ----------
  async function dashboard() {
    const s = await api("/api/admin/stats");
    const max = Math.max(1, ...s.days.map((d) => d.total));
    shell(`
      <h1>Dashboard</h1>
      <div class="kpis">
        <div class="kpi"><small>Total revenue</small><b>${money(s.revenue)}</b></div>
        <div class="kpi"><small>Today</small><b>${money(s.todayRevenue)}</b></div>
        <div class="kpi"><small>Orders</small><b>${s.orders}</b><a href="#orders">${s.pending} pending →</a></div>
        <div class="kpi"><small>Customers</small><b>${s.customers}</b><span>${s.subscribers} subscribers</span></div>
      </div>
      <div class="a-grid">
        <section class="panel">
          <h3>Revenue · last 14 days</h3>
          <div class="bars">${s.days.map((d) => `<div class="bar" title="${d.day}: ${money(d.total)}"><span style="height:${Math.max(2, (d.total / max) * 100)}%"></span><small>${d.day.slice(8)}</small></div>`).join("")}</div>
        </section>
        <section class="panel">
          <h3>Top products</h3>
          ${s.topProducts.length ? `<ol class="toplist">${s.topProducts.map((p) => `<li><span>${esc(p.name)}</span><b>${p.qty} sold</b></li>`).join("")}</ol>` : `<p class="muted">No sales yet.</p>`}
          <h3 style="margin-top:22px">Low stock</h3>
          ${s.lowStock.length ? `<ul class="toplist">${s.lowStock.map((p) => `<li><span>${esc(p.name)}</span><b class="${p.stock ? "warn" : "danger"}">${p.stock} left</b></li>`).join("")}</ul>` : `<p class="muted">All products are well stocked.</p>`}
          ${s.unreadMessages ? `<p style="margin-top:18px"><a class="more" href="#messages">${s.unreadMessages} unread message(s) →</a></p>` : ""}
        </section>
      </div>`);
  }

  function orderRows() {
    const q = search.toLowerCase();
    const list = ordersCache.filter((o) => (filter === "all" || o.status === filter) && (!q || [o.number, o.customer.name, o.customer.email, o.customer.phone].join(" ").toLowerCase().includes(q)));
    if (!list.length) return `<tr><td colspan="7" class="muted center">No orders found.</td></tr>`;
    return list.map((o) => `
      <tr>
        <td><button class="link-btn strong" data-open="${esc(o.number)}">${esc(o.number)}</button></td>
        <td>${date(o.createdAt)}</td>
        <td>${esc(o.customer.name)}<small class="muted block">${esc(o.customer.phone)}</small></td>
        <td>${o.items.reduce((s, l) => s + l.qty, 0)}</td>
        <td>${o.payment === "cod" ? "Cash" : "Bank"}</td>
        <td><b>${money(o.total)}</b></td>
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
        <input class="field" id="orderSearch" placeholder="Search order, name, email, phone" value="${esc(search)}">
      </div>
      <div class="panel table-wrap"><table>
        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead>
        <tbody id="orderBody">${orderRows()}</tbody>
      </table></div>`);
  }

  function orderModal(number) {
    const o = ordersCache.find((x) => x.number === number); if (!o) return;
    const m = document.createElement("div"); m.className = "fr-modal"; m.id = "orderModal";
    m.innerHTML = `
      <div class="fr-dialog wide">
        <div class="a-head"><h2>${esc(o.number)}</h2><button class="fr-x dark" data-close>×</button></div>
        <p class="muted">${date(o.createdAt)} · ${o.payment === "cod" ? "Cash on delivery" : "Bank transfer"} · ${esc(o.shippingMethod)} shipping${o.coupon ? ` · coupon ${esc(o.coupon)}` : ""}</p>
        <div class="order-cols">
          <div>${o.items.map((l) => `<div class="sum-line"><span class="sl-img"><img src="${esc(l.img)}" alt=""><b>${l.qty}</b></span><span>${esc(l.name)}<small class="muted">Size ${esc(l.size)} · ${money(l.price)}</small></span><span>${money(l.total)}</span></div>`).join("")}
            <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
            ${o.discount ? `<div class="sum-row disc"><span>Discount</span><span>−${money(o.discount)}</span></div>` : ""}
            <div class="sum-row"><span>Shipping</span><span>${money(o.shipping)}</span></div>
            <div class="sum-row total"><span>Total</span><span>${money(o.total)}</span></div></div>
          <div><h3 class="co-h">Customer</h3><p>${esc(o.customer.name)}<br><a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a><br><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></p>
            <h3 class="co-h" style="margin-top:14px">Address</h3><p>${esc(o.customer.address)}<br>${esc(o.customer.city)} ${esc(o.customer.postal)}<br>${esc(o.customer.country)}</p>
            ${o.notes ? `<h3 class="co-h" style="margin-top:14px">Notes</h3><p>${esc(o.notes)}</p>` : ""}
            <h3 class="co-h" style="margin-top:14px">History</h3><ul class="toplist">${o.history.map((h) => `<li><span>${esc(h.status)}</span><small class="muted">${date(h.at)}</small></li>`).join("")}</ul></div>
        </div>
      </div>`;
    document.body.appendChild(m);
  }

  async function products() {
    const list = await api("/api/admin/products");
    shell(`
      <h1>Products</h1>
      <p class="muted">Edit price, sale price and stock. Changes are saved when you leave a field.</p>
      <div class="panel table-wrap"><table>
        <thead><tr><th></th><th>Product</th><th>Price ($)</th><th>Old price ($)</th><th>Stock</th><th>Visible</th></tr></thead>
        <tbody>${list.map((p) => `
          <tr class="${p.active ? "" : "dim"}">
            <td><img class="thumb" src="${esc(p.img)}" alt=""></td>
            <td><b>${esc(p.en)}</b><small class="muted block">${esc(p.cat)} · #${p.id}</small></td>
            <td><input class="field num" type="number" min="1" step="0.01" value="${p.price}" data-p="${p.id}" data-k="price"></td>
            <td><input class="field num" type="number" min="0" step="0.01" value="${p.oldPrice ?? ""}" placeholder="—" data-p="${p.id}" data-k="oldPrice"></td>
            <td><input class="field num ${p.stock <= 5 ? "low" : ""}" type="number" min="0" step="1" value="${p.stock}" data-p="${p.id}" data-k="stock"></td>
            <td><label class="switch"><input type="checkbox" ${p.active ? "checked" : ""} data-p="${p.id}" data-k="active"><span></span></label></td>
          </tr>`).join("")}</tbody>
      </table></div>`);
  }

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
    try { await ({ dashboard, orders, products, messages }[tab] || dashboard)(); }
    catch (e) { if (token) { shell(`<p class="notice">${esc(e.message)}</p>`); } }
  }

  // ---------- events ----------
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "loginForm") return;
    e.preventDefault();
    try {
      const { token: t } = await api("/api/admin/login", { body: { password: e.target.password.value } });
      token = t; sessionStorage.setItem("adminToken", t); show();
    } catch (err) { login(err.message); }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-logout],[data-filter],[data-open],[data-close],[data-read]");
    if (e.target.id === "orderModal") return e.target.remove();
    if (!b) return;
    if (b.matches("[data-logout]")) logout();
    if (b.dataset.filter) { filter = b.dataset.filter; orders(); }
    if (b.dataset.open) orderModal(b.dataset.open);
    if (b.matches("[data-close]")) $("#orderModal")?.remove();
    if (b.dataset.read) { await api(`/api/admin/messages/${b.dataset.read}`, { method: "PATCH", body: {} }); messages(); }
  });
  document.addEventListener("change", async (e) => {
    const el = e.target;
    try {
      if (el.dataset.status) {
        const o = await api(`/api/admin/orders/${encodeURIComponent(el.dataset.status)}`, { method: "PATCH", body: { status: el.value } });
        const i = ordersCache.findIndex((x) => x.number === o.number); ordersCache[i] = o;
        el.className = "status s-" + o.status; toast(`${o.number} → ${o.status}`);
      }
      if (el.dataset.p) {
        const v = el.type === "checkbox" ? el.checked : el.value;
        const p = await api(`/api/admin/products/${el.dataset.p}`, { method: "PATCH", body: { [el.dataset.k]: v } });
        el.closest("tr").classList.toggle("dim", !p.active);
        if (el.dataset.k === "stock") el.classList.toggle("low", p.stock <= 5);
        toast(`Saved · ${p.en}`);
      }
    } catch (err) { toast(err.message); show(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "orderSearch") { search = e.target.value; $("#orderBody").innerHTML = orderRows(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#orderModal")?.remove(); });
  window.addEventListener("hashchange", show);
  show();
})();
