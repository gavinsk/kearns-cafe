// Kearns Café — kitchen tickets and the "order up" board.
// Orders flow: register → Kitchen.add() → new → making → ready → done.
// Works on one iPad by itself; with Sync linked, tickets show up on the other iPad too.

window.Kitchen = (function () {
  "use strict";

  const STEPS = ["new", "making", "ready", "done"];
  const KEEP_DONE_MINUTES = 30;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const sound = (name) => { if (window.Sound) window.Sound[name](); };

  const listeners = [];     // Sync listens here to send changes to the other iPad
  let view = null;          // "kitchen", "board", or null
  let timer = null;

  // ---------- Saved tickets ----------
  function load() {
    try { return JSON.parse(localStorage.getItem("kearns.tickets")) || {}; } catch (e) { return {}; }
  }
  function save(all) {
    // Forget finished tickets after a while so the list doesn't grow forever
    const cutoff = Date.now() - KEEP_DONE_MINUTES * 60000;
    Object.values(all).forEach((t) => { if (t.status === "done" && t.updated < cutoff) delete all[t.id]; });
    try { localStorage.setItem("kearns.tickets", JSON.stringify(all)); } catch (e) { /* ignore */ }
  }
  function all() { return load(); }

  // Next order number after the highest one on any ticket we know about (from either iPad)
  function nextNumber() {
    const nums = Object.values(load()).map((t) => Number(t.number) || 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return max >= 999 ? 1 : max + 1;
  }
  function onChange(fn) { listeners.push(fn); }

  function deviceId() {
    let id = null;
    try { id = localStorage.getItem("kearns.device"); } catch (e) { /* ignore */ }
    if (!id) {
      id = Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem("kearns.device", id); } catch (e) { /* ignore */ }
    }
    return id;
  }

  function put(ticket) {
    ticket.updated = Date.now();
    const tickets = load();
    tickets[ticket.id] = ticket;
    save(tickets);
    listeners.forEach((fn) => fn(ticket));
    refresh();
  }

  // ---------- From the register ----------
  function add(order) {
    put({
      id: deviceId() + "-" + Date.now(),
      shopEmoji: order.shop.emoji,
      shopName: order.shop.name,
      number: order.number,
      name: order.name,
      type: order.type,
      lines: order.lines,           // [{ emoji, name, mods, qty }]
      status: "new",
      created: Date.now(),
    });
  }

  function advance(id) {
    const t = load()[id];
    if (!t) return;
    const next = STEPS[Math.min(STEPS.indexOf(t.status) + 1, STEPS.length - 1)];
    t.status = next;
    if (next === "ready") sound("yay");
    put(t);
  }

  // ---------- From the other iPad ----------
  function merge(remote) {
    const mine = load();
    const news = [];
    Object.values(remote || {}).forEach((t) => {
      if (!t || !t.id) return;
      const local = mine[t.id];
      if (!local || (t.updated || 0) > (local.updated || 0)) {
        if (!local && t.status === "new") news.push(t);
        if (local && local.status !== "ready" && t.status === "ready") news.push({ ...t, justReady: true });
        mine[t.id] = t;
      }
    });
    save(mine);
    news.forEach(announce);
    refresh();
    document.dispatchEvent(new Event("kearns:tickets"));
  }

  // Sounds & pop-ups when something happens on the other iPad
  function announce(t) {
    if (t.justReady) {
      if (view === "board") sayReady(t);
      else sound("ding");
      toast(`🔔 Order #${t.number}${t.name ? " for " + t.name : ""} is ready!`);
    } else if (view === "kitchen") {
      sound("ding");
    }
  }

  // ---------- Screens ----------
  function open(which) {
    view = which;
    $("picker").classList.add("hidden");
    $(which === "kitchen" ? "kitchen" : "board").classList.remove("hidden");
    refresh();
    clearInterval(timer);
    timer = setInterval(refresh, 20000);   // keep the "3 min ago" times fresh
  }

  function close() {
    view = null;
    clearInterval(timer);
    $("kitchen").classList.add("hidden");
    $("board").classList.add("hidden");
    $("picker").classList.remove("hidden");
  }

  function refresh() {
    if (view === "kitchen") renderKitchen();
    if (view === "board") renderBoard();
  }

  function sorted(status) {
    return Object.values(load()).filter((t) => t.status === status).sort((a, b) => a.created - b.created);
  }

  function age(t) {
    const m = Math.floor((Date.now() - t.created) / 60000);
    return m < 1 ? "just now" : m + " min";
  }

  function renderKitchen() {
    const cols = [
      { status: "new", title: "🆕 New", btn: "Start ▶" },
      { status: "making", title: "🔥 Making", btn: "Ready ✓" },
      { status: "ready", title: "✅ Ready", btn: "Picked up" },
    ];
    const wrap = $("kitchen-cols");
    wrap.innerHTML = "";
    cols.forEach((c) => {
      const col = document.createElement("div");
      col.className = "k-col k-" + c.status;
      const list = sorted(c.status);
      col.innerHTML = `<div class="k-col-head">${c.title} <span>${list.length}</span></div>`;
      const body = document.createElement("div");
      body.className = "k-col-body";
      list.forEach((t) => {
        const card = document.createElement("div");
        card.className = "ticket-card";
        card.innerHTML = `
          <div class="tk-head">
            <span class="tk-num">#${esc(t.number)}</span>
            <span class="tk-name">${esc(t.name || "")}</span>
            <span class="tk-shop">${esc(t.shopEmoji)}</span>
          </div>
          <div class="tk-meta">${esc(t.type)} · ${age(t)}</div>
          <ul class="tk-lines">${(t.lines || []).map((l) => `
            <li><b>${esc(l.qty)}×</b> ${esc(l.emoji)} ${esc(l.name)}${l.mods ? `<small>${esc(l.mods)}</small>` : ""}</li>`).join("")}
          </ul>`;
        const b = document.createElement("button");
        b.className = "tk-btn";
        b.textContent = c.btn;
        b.onclick = () => advance(t.id);
        card.appendChild(b);
        body.appendChild(card);
      });
      if (!list.length) body.innerHTML = `<div class="k-empty">No orders</div>`;
      col.appendChild(body);
      wrap.appendChild(col);
    });
  }

  function renderBoard() {
    const chip = (t) => `<div class="b-chip"><span class="b-shop">${esc(t.shopEmoji)}</span><span class="b-num">${esc(t.number)}</span><span class="b-name">${esc(t.name || "")}</span></div>`;
    const preparing = sorted("new").concat(sorted("making"));
    const ready = sorted("ready");
    $("board-preparing").innerHTML = preparing.map(chip).join("") || `<div class="b-empty">—</div>`;
    $("board-ready").innerHTML = ready.map(chip).join("") || `<div class="b-empty">—</div>`;
  }

  // Board says the order out loud (iPad voice)
  function sayReady(t) {
    sound("ding");
    try {
      const words = `Order ${t.number}${t.name ? " for " + t.name : ""}, is ready!`;
      const u = new SpeechSynthesisUtterance(words);
      u.rate = 0.95;
      setTimeout(() => window.speechSynthesis.speak(u), 900);
    } catch (e) { /* no voice available */ }
  }

  // ---------- Pop-up message (works on any screen) ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 5000);
  }

  // Ready on this same iPad also shows on the board / register
  onChange((t) => {
    if (t.status === "ready" && view !== "kitchen") toast(`🔔 Order #${t.number}${t.name ? " for " + t.name : ""} is ready!`);
  });

  // ---------- Wire up ----------
  function init() {
    $("btn-kitchen").onclick = () => open("kitchen");
    $("btn-board").onclick = () => { open("board"); try { window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch (e) { /* unlock voice */ } };
    $("kitchen-back").onclick = close;
    $("board-back").onclick = close;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { add, advance, all, merge, onChange, toast, open, close, nextNumber };
})();
