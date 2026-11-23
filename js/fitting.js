// Fitting room: layered mannequin preview + optional AI try-on with the user's own Gemini API key
(function () {
  const S = window.STORE;
  const t = (k) => S.t(k);
  const $ = (s, r = document) => r.querySelector(s);
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
  const MODEL = "gemini-2.5-flash-image";
  // Optional local key from js/config.js (git-ignored). A key saved in the browser takes priority.
  const serverAI = () => !!(S.config && S.config.aiEnabled);
  const getKey = () => ls.get("fr-key", "") || (window.STORE_CONFIG && window.STORE_CONFIG.GEMINI_API_KEY) || "";

  // category -> body slot
  const SLOT = { tshirts: "top", shirts: "top", hoodies: "top", jackets: "outer", pants: "bottom", shoes: "feet", hats: "head" };
  const ORDER = ["bottom", "feet", "top", "outer", "head"];

  let worn = ls.get("fr-worn", {});          // slot -> product id
  let open = ls.get("fr-open", false);
  let aiImage = null, busy = false;

  // ---------- mannequin SVG ----------
  const P = {
    head: "M100 14c13 0 21 11 21 26s-9 27-21 27-21-12-21-27 8-26 21-26Z",
    neck: "M91 62h18l2 16H89Z",
    torso: "M68 80c10-6 21-8 32-8s22 2 32 8l7 66c-2 26-7 48-11 66H72c-4-18-9-40-11-66Z",
    armL: "M68 80c-9 3-13 10-14 20l-6 88c-1 17 1 32 5 46h9c-1-14-1-28 1-44l9-78Z",
    armR: "M132 80c9 3 13 10 14 20l6 88c1 17-1 32-5 46h-9c1-14 1-28-1-44l-9-78Z",
    legs: "M72 208h56l3 56-8 156h-17l-5-148h-2l-5 148H77l-8-156Z",
    footL: "M77 418h17l2 14H70c0-7 3-12 7-14Z",
    footR: "M106 418h17c4 2 7 7 7 14h-26Z"
  };
  // clip areas for each slot
  const CLIP = {
    top: `<path d="${P.torso}"/><path d="M68 80c-9 3-13 10-14 20l-3 40h17Z"/><path d="M132 80c9 3 13 10 14 20l3 40h-17Z"/>`,
    outer: `<path d="${P.torso}"/><path d="${P.armL}"/><path d="${P.armR}"/><path d="M66 200h68l2 22H64Z"/>`,
    bottom: `<path d="${P.legs}"/>`,
    feet: `<path d="${P.footL}"/><path d="${P.footR}"/><path d="M76 410h20v10H76ZM104 410h20v10h-20Z"/>`,
    head: `<path d="M76 30c2-14 12-20 24-20s22 6 24 20c-6-3-14-5-24-5s-18 2-24 5Z"/><ellipse cx="100" cy="30" rx="30" ry="5"/>`
  };
  const BOX = { top: [50, 70, 100, 150], outer: [44, 68, 112, 170], bottom: [64, 206, 72, 216], feet: [66, 406, 68, 30], head: [68, 6, 64, 34] };

  function mannequinSVG(withClothes = true, id = "mq") {
    const layers = withClothes ? ORDER.filter((s) => worn[s]).map((slot) => {
      const p = PRODUCTS.find((x) => x.id === worn[slot]); if (!p) return "";
      const [x, y, w, h] = BOX[slot];
      return `<clipPath id="${id}-c-${slot}">${CLIP[slot]}</clipPath>
        <g clip-path="url(#${id}-c-${slot})" class="layer">
          <image href="${p.img}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}-shade)"/>
        </g>`;
    }).join("") : "";
    return `<svg viewBox="0 0 200 460" xmlns="http://www.w3.org/2000/svg" class="mannequin">
      <defs>
        <linearGradient id="${id}-skin" x1="0" x2="1"><stop offset="0" stop-color="#b9bcbf"/><stop offset=".45" stop-color="#e4e6e8"/><stop offset="1" stop-color="#a9adb1"/></linearGradient>
        <linearGradient id="${id}-shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
        <radialGradient id="${id}-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="100" cy="440" rx="58" ry="9" fill="url(#${id}-floor)"/>
      <g fill="url(#${id}-skin)">${Object.values(P).map((d) => `<path d="${d}"/>`).join("")}</g>
      ${layers}
    </svg>`;
  }

  // ---------- panel ----------
  const root = document.createElement("div");
  root.id = "fitting";
  document.body.appendChild(root);

  function wornList() {
    return ORDER.filter((s) => worn[s]).map((s) => PRODUCTS.find((p) => p.id === worn[s])).filter(Boolean);
  }

  function render() {
    const I = S.icons, key = getKey();
    const items = wornList();
    root.innerHTML = `
      <button class="fr-fab ${open ? "hide" : ""}" data-fr="open" aria-label="${t("frTitle")}">${I.hanger}<span>${t("frTitle")}</span>${items.length ? `<b>${items.length}</b>` : ""}</button>
      <section class="fr-panel ${open ? "open" : ""}" aria-label="${t("frTitle")}">
        <header><div><h3>${t("frTitle")}</h3><p>${t("frHint")}</p></div><button class="fr-x" data-fr="close" aria-label="Close">×</button></header>
        <div class="fr-stage ${busy ? "busy" : ""}">
          ${aiImage ? `<img class="fr-ai" src="${aiImage}" alt="AI try-on">` : mannequinSVG()}
          ${busy ? `<div class="fr-loading"><span class="spin"></span>${t("frGenerating")}</div>` : ""}
          <button class="fr-zoom" data-fr="zoom" aria-label="Zoom">${I.search}</button>
          ${aiImage ? `<button class="fr-back" data-fr="back">${t("frBack")}</button>` : ""}
        </div>
        ${items.length ? `<div class="fr-items">${items.map((p) => `<span class="fr-chip"><img src="${p.img}" alt="">${S.name(p)}<button data-fr-remove="${p.id}" aria-label="Remove">×</button></span>`).join("")}</div>` : ""}
        ${(key || serverAI()) && items.length ? `<button class="btn full fr-gen" data-fr="generate" ${busy ? "disabled" : ""}>✨ ${t("frGenerate")}</button>` : ""}
        <footer>
          ${serverAI() ? `<span class="fr-ready">✨ AI</span>` : `<button class="btn fr-key" data-fr="key">🔑 ${key ? t("frKeySet") : t("frKey")}</button>`}
          <button class="fr-reset" data-fr="reset">${I.refresh} ${t("frReset")}</button>
        </footer>
      </section>
      <div class="fr-modal" id="frModal" hidden></div>`;
    document.querySelectorAll("[data-try]").forEach((b) => b.classList.toggle("on", Object.values(worn).includes(+b.dataset.try)));
  }

  function save() { ls.set("fr-worn", worn); ls.set("fr-open", open); }

  function wear(id) {
    const p = PRODUCTS.find((x) => x.id === id); if (!p) return;
    const slot = SLOT[p.cat];
    worn[slot] === id ? delete worn[slot] : (worn[slot] = id);
    aiImage = null; open = true; save(); render();
    if (worn[slot]) S.toast(t("frWorn"));
  }

  function modal(html) { const m = $("#frModal"); m.innerHTML = `<div class="fr-dialog">${html}</div>`; m.hidden = false; }
  function closeModal() { const m = $("#frModal"); if (m) m.hidden = true; }

  function keyDialog() {
    const key = ls.get("fr-key", "");
    modal(`
      <h3>🔑 ${t("frKeyTitle")}</h3>
      <p class="muted">${t("frKeyText")}</p>
      <a class="link-arrow" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">${t("frKeyGet")} ${S.icons.arrowUp}</a>
      <input class="field" id="frKeyInput" type="password" placeholder="Paste your API key" value="${key}">
      <div class="fr-actions">
        ${key ? `<button class="link-btn" data-fr="delkey">${t("frRemove")}</button>` : "<span></span>"}
        <div><button class="btn ghost" data-fr="cancel">${t("frCancel")}</button> <button class="btn" data-fr="savekey">${t("frSave")}</button></div>
      </div>`);
    setTimeout(() => $("#frKeyInput")?.focus(), 50);
  }

  // ---------- AI try-on ----------
  function svgToPng(svg, w = 600, h = 1380) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d"); ctx.fillStyle = "#d9dbdd"; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h); res(c.toDataURL("image/png").split(",")[1]);
      };
      img.onerror = rej;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }
  async function urlToB64(url) {
    const blob = await (await fetch(url.replace("w=800", "w=512"))).blob();
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.readAsDataURL(blob); });
  }

  async function generate() {
    const key = getKey(); const items = wornList();
    if (!items.length) return S.toast(t("frEmpty"));
    if (!key && !serverAI()) return keyDialog();
    busy = true; render();
    try {
      const base = await svgToPng(mannequinSVG(false, "base"));
      if (serverAI()) {
        const r = await fetch("/api/tryon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mannequin: base, items: items.map((p) => p.id) }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.image) throw new Error(j.error || "AI error");
        aiImage = j.image; busy = false; return render();
      }
      const garments = await Promise.all(items.map((p) => urlToB64(p.img)));
      const prompt = `Photorealistic fashion studio photo. Dress the plain grey store mannequin in the FIRST image with the clothing items shown in the following images (${items.map((p) => S.name(p)).join(", ")}). Keep the mannequin's pose, full-body framing and neutral light-grey studio background. The garments must fit naturally with realistic folds, shadows and fabric texture. Do not add a real person, face or text.`;
      const body = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/png", data: base } }, ...garments.map((g) => ({ inline_data: { mime_type: "image/jpeg", data: g } }))] }] };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body)
      });
      const j = await r.json();
      const part = j?.candidates?.[0]?.content?.parts?.find((x) => x.inline_data || x.inlineData);
      const data = part && (part.inline_data || part.inlineData);
      if (!r.ok || !data) throw new Error(j?.error?.message || "No image returned");
      aiImage = `data:${data.mime_type || data.mimeType || "image/png"};base64,${data.data}`;
    } catch (err) {
      console.error(err); S.toast(t("frError"));
    }
    busy = false; render();
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const tryBtn = e.target.closest("[data-try]");
    if (tryBtn) { e.preventDefault(); return wear(+tryBtn.dataset.try); }
    const rm = e.target.closest("[data-fr-remove]");
    if (rm) { const id = +rm.dataset.frRemove; for (const s in worn) if (worn[s] === id) delete worn[s]; aiImage = null; save(); return render(); }
    if (e.target.id === "frModal") return closeModal();
    const b = e.target.closest("[data-fr]"); if (!b) return;
    switch (b.dataset.fr) {
      case "open": open = true; save(); render(); break;
      case "close": open = false; save(); render(); break;
      case "reset": worn = {}; aiImage = null; save(); render(); break;
      case "back": aiImage = null; render(); break;
      case "key": keyDialog(); break;
      case "cancel": closeModal(); break;
      case "savekey": { const v = $("#frKeyInput").value.trim(); v ? ls.set("fr-key", v) : ls.del("fr-key"); closeModal(); render(); break; }
      case "delkey": ls.del("fr-key"); closeModal(); render(); break;
      case "generate": generate(); break;
      case "zoom": modal(`<div class="fr-big">${aiImage ? `<img src="${aiImage}" alt="">` : mannequinSVG(true, "zoom")}</div><button class="btn ghost full" data-fr="cancel">${t("frCancel")}</button>`); break;
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  window.addEventListener("store:render", render);
  render();
})();
