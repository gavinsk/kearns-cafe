// Kearns Café — Kearns Bank: pretend credit cards & gift cards with QR codes.
//
// Each printed card's QR code holds everything an iPad needs to know about it:
//   KEARNS|1|<type c=credit g=gift>|<id>|<last4>|<starting balance in cents>|<name>
// so a card made on one device works when scanned on another. Balances and stars
// are then tracked on each iPad (they'll sync between iPads in Phase 4).

window.Cards = (function () {
  "use strict";

  // ---------- Settings ----------
  const STARS_FOR_REWARD = 8;      // card payments needed for a free treat
  const GIFT_AMOUNTS = [1000, 2000, 2500, 5000];
  const RELOAD_AMOUNTS = [500, 1000, 2000];
  const COLORS = [
    { a: "#1e3a8a", b: "#3b82f6" },   // ocean
    { a: "#9d174d", b: "#ec4899" },   // berry
    { a: "#14532d", b: "#22c55e" },   // forest
    { a: "#9a3412", b: "#f59e0b" },   // sunset
    { a: "#4c1d95", b: "#a78bfa" },   // grape
    { a: "#111827", b: "#4b5563" },   // night
  ];
  const GIFT_COLOR = { a: "#b8327a", b: "#f7a531" };

  const $ = (id) => document.getElementById(id);
  const money = (c) => "$" + (c / 100).toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const sound = (name) => { if (window.Sound) window.Sound[name](); };

  // ---------- Saved cards (on this iPad) ----------
  function load() {
    try { return JSON.parse(localStorage.getItem("kearns.cards")) || {}; } catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem("kearns.cards", JSON.stringify(all)); } catch (e) { /* ignore */ }
  }
  function list() {
    return Object.values(load()).sort((x, y) => x.created - y.created);
  }

  function randomId() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function cleanName(n) {
    return String(n || "").replace(/\|/g, "").trim().slice(0, 18) || "Card";
  }

  function create({ name, type, start, color }) {
    const all = load();
    const card = {
      id: randomId(),
      type: type === "gift" ? "gift" : "credit",
      name: cleanName(name),
      last4: String(1000 + Math.floor(Math.random() * 9000)),
      start: type === "gift" ? (start || 0) : 0,
      balance: type === "gift" ? (start || 0) : 0,
      stars: 0,
      color: color || 0,
      created: Date.now(),
    };
    all[card.id] = card;
    save(all);
    return card;
  }

  // First visit: a couple of example cards so there's something to print
  function seed() {
    if (localStorage.getItem("kearns.cardsSeeded")) return;
    try { localStorage.setItem("kearns.cardsSeeded", "1"); } catch (e) { /* ignore */ }
    if (list().length) return;
    create({ name: "Mom", type: "credit", color: 1 });
    create({ name: "Dad", type: "credit", color: 0 });
    create({ name: "Gift Card", type: "gift", start: 2500 });
  }

  // ---------- QR payload ----------
  function encode(card) {
    return ["KEARNS", "1", card.type === "gift" ? "g" : "c", card.id, card.last4, card.start || 0, card.name].join("|");
  }

  function parse(text) {
    const p = String(text || "").split("|");
    if (p.length < 7 || p[0] !== "KEARNS" || p[1] !== "1") return null;
    if (!/^[a-z0-9]{4,12}$/.test(p[3]) || !/^\d{4}$/.test(p[4])) return null;
    return {
      type: p[2] === "g" ? "gift" : "credit",
      id: p[3],
      last4: p[4],
      start: Math.max(0, parseInt(p[5], 10) || 0),
      name: cleanName(p.slice(6).join("|")),
    };
  }

  // Find the card this QR code belongs to, adding it to this iPad if it's new here
  function fromScan(text) {
    const info = parse(text);
    if (!info) return null;
    const all = load();
    if (!all[info.id]) {
      all[info.id] = { ...info, balance: info.start, stars: 0, color: 0, created: Date.now() };
      save(all);
    }
    return all[info.id];
  }

  // ---------- Paying ----------
  // Returns { ok, balance } — gift cards need enough money on them
  function charge(id, cents) {
    const all = load();
    const card = all[id];
    if (!card) return { ok: false, balance: 0 };
    if (card.type === "gift") {
      if (card.balance < cents) return { ok: false, balance: card.balance };
      card.balance -= cents;
    }
    save(all);
    return { ok: true, balance: card.balance };
  }

  // Adds a star. Returns { stars, reward } — reward is true when they earned a free treat
  function addStar(id) {
    const all = load();
    const card = all[id];
    if (!card) return { stars: 0, reward: false };
    card.stars = (card.stars || 0) + 1;
    let reward = false;
    if (card.stars >= STARS_FOR_REWARD) { card.stars = 0; reward = true; }
    save(all);
    return { stars: card.stars, reward };
  }

  function reload(id, cents) {
    const all = load();
    if (!all[id]) return;
    all[id].balance += cents;
    save(all);
  }

  function remove(id) {
    const all = load();
    delete all[id];
    save(all);
  }

  // ---------- Card picture ----------
  function qrSvg(card) {
    const qr = window.qrcode(0, "M");
    qr.addData(encode(card));
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }

  function faceHTML(card) {
    const c = card.type === "gift" ? GIFT_COLOR : (COLORS[card.color] || COLORS[0]);
    return `
      <div class="ccard ${card.type === "gift" ? "is-gift" : ""}" style="--ca:${c.a};--cb:${c.b}">
        <div class="cc-left">
          <div class="cc-bank">KEARNS BANK</div>
          <div class="cc-type">${card.type === "gift" ? "🎁 GIFT CARD" : "⭐ REWARDS CARD"}</div>
          <div class="cc-chip"></div>
          <div class="cc-num">•••• ${esc(card.last4)}</div>
          <div class="cc-name">${esc(card.name.toUpperCase())}</div>
        </div>
        <div class="cc-qr">${qrSvg(card)}</div>
      </div>`;
  }

  // ---------- Kearns Bank screen ----------
  let scanner = null;

  function openBank() {
    seed();
    $("picker").classList.add("hidden");
    $("bank").classList.remove("hidden");
    renderBank();
  }

  function closeBank() {
    stopScan();
    $("bank").classList.add("hidden");
    $("picker").classList.remove("hidden");
  }

  function renderBank() {
    const cards = list();
    const grid = $("bank-cards");
    grid.innerHTML = cards.length ? "" : `<div class="bank-empty">No cards yet. Tap <b>+ New Card</b> to make one!</div>`;
    cards.forEach((card) => {
      const tile = document.createElement("div");
      tile.className = "bank-tile";
      tile.innerHTML = faceHTML(card) + `
        <div class="bank-info">
          ${card.type === "gift" ? `<span class="bank-bal">Balance <b>${money(card.balance)}</b></span>` : `<span class="bank-bal">Credit card</span>`}
          <span class="bank-stars">⭐ ${card.stars || 0} / ${STARS_FOR_REWARD}</span>
        </div>
        <div class="bank-actions"></div>`;
      const actions = tile.querySelector(".bank-actions");
      if (card.type === "gift") {
        RELOAD_AMOUNTS.forEach((amt) => {
          const b = document.createElement("button");
          b.className = "btn-small";
          b.textContent = "+" + money(amt).replace(".00", "");
          b.onclick = () => { reload(card.id, amt); sound("chaChing"); renderBank(); };
          actions.appendChild(b);
        });
      }
      const del = document.createElement("button");
      del.className = "btn-small bank-del";
      del.textContent = "Delete";
      del.onclick = () => {
        if (confirm(`Delete ${card.name}'s card from this iPad?`)) { remove(card.id); renderBank(); }
      };
      actions.appendChild(del);
      grid.appendChild(tile);
    });
  }

  // New card popup
  let draft = null;
  function openNewCard() {
    draft = { name: "", type: "credit", start: GIFT_AMOUNTS[1], color: Math.floor(Math.random() * COLORS.length) };
    $("nc-name").value = "";
    renderNewCard();
    $("newcard-modal").classList.remove("hidden");
  }

  function renderNewCard() {
    const chip = (label, on, fn) => {
      const b = document.createElement("button");
      b.className = "chip" + (on ? " on" : "");
      b.innerHTML = label;
      b.onclick = () => { fn(); renderNewCard(); };
      return b;
    };
    const types = $("nc-types");
    types.innerHTML = "";
    types.appendChild(chip("💳 Credit Card", draft.type === "credit", () => { draft.type = "credit"; }));
    types.appendChild(chip("🎁 Gift Card", draft.type === "gift", () => { draft.type = "gift"; }));

    $("nc-amount-row").classList.toggle("hidden", draft.type !== "gift");
    const amts = $("nc-amounts");
    amts.innerHTML = "";
    GIFT_AMOUNTS.forEach((a) => amts.appendChild(chip(money(a).replace(".00", ""), draft.start === a, () => { draft.start = a; })));

    $("nc-color-row").classList.toggle("hidden", draft.type !== "credit");
    const colors = $("nc-colors");
    colors.innerHTML = "";
    COLORS.forEach((c, i) => {
      const b = chip("", draft.color === i, () => { draft.color = i; });
      b.classList.add("swatch");
      b.style.background = `linear-gradient(135deg, ${c.a}, ${c.b})`;
      colors.appendChild(b);
    });

    draft.name = $("nc-name").value;
    $("nc-preview").innerHTML = faceHTML({
      type: draft.type, name: draft.name || (draft.type === "gift" ? "Gift Card" : "Your Name"),
      last4: "1234", id: "preview", start: draft.start, color: draft.color,
    });
  }

  function saveNewCard() {
    draft.name = $("nc-name").value.trim() || (draft.type === "gift" ? "Gift Card" : "");
    if (!draft.name) { $("nc-name").focus(); return; }
    create(draft);
    $("newcard-modal").classList.add("hidden");
    $("nc-name").blur();
    renderBank();
  }

  // ---------- Printing ----------
  function printCards() {
    const cards = list();
    if (!cards.length) return;
    $("print-sheet").innerHTML = cards.map(faceHTML).join("");
    window.print();
  }

  // ---------- "Check a card" (scan at the bank) ----------
  function startScan() {
    $("bank-scan").classList.remove("hidden");
    $("bank-scan-msg").textContent = "Hold a Kearns card up to the camera";
    scanner = window.Scanner.open($("bank-scan-view"), (text) => {
      const card = fromScan(text);
      if (!card) {
        sound("buzz");
        $("bank-scan-msg").textContent = "That's not a Kearns card!";
        return true;      // keep scanning
      }
      sound("beep");
      stopScan();
      renderBank();
      const msg = card.type === "gift" ? `${card.name}: ${money(card.balance)} left · ⭐ ${card.stars}/${STARS_FOR_REWARD}`
                                       : `${card.name}'s card · ⭐ ${card.stars}/${STARS_FOR_REWARD}`;
      setTimeout(() => alert(msg), 50);
      return false;
    });
  }
  function stopScan() {
    if (scanner) { scanner.stop(); scanner = null; }
    $("bank-scan").classList.add("hidden");
  }

  // ---------- Wire up ----------
  function init() {
    $("btn-bank").onclick = openBank;
    $("bank-back").onclick = closeBank;
    $("bank-new").onclick = openNewCard;
    $("bank-print").onclick = printCards;
    $("bank-check").onclick = startScan;
    $("bank-scan-close").onclick = stopScan;
    $("nc-name").oninput = renderNewCard;
    $("nc-cancel").onclick = () => { $("newcard-modal").classList.add("hidden"); $("nc-name").blur(); };
    $("nc-save").onclick = saveNewCard;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { parse, encode, fromScan, charge, addStar, reload, create, list, faceHTML, seed, STARS_FOR_REWARD };
})();
