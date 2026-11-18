// Kearns Café — pretend cash register
// The register: shop picker, menu, order ticket with options, tax, totals.
// Payment happens in checkout.js; sounds live in sounds.js.

(function () {
  "use strict";

  // ---------- Settings ----------
  const TAX_RATE = 0.055;            // 5.5% sales tax. Set to 0 for no tax.
  const QUICK_NAMES = ["Mom", "Dad", "Grandma", "Grandpa", "Teddy", "Mr. Bear", "Princess", "Superhero"];

  // ---------- Saved data (stays on this iPad) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("kearns." + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("kearns." + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  // ---------- State ----------
  let shop = null;             // current menu object
  let category = null;         // current category id
  let order = null;            // { lines: [...], type: "For Here" }
  let editing = null;          // popup state while choosing options

  const $ = (id) => document.getElementById(id);
  const money = (n) => "$" + n.toFixed(2);
  // Picture for a menu item: its drawn icon (icons.js), or the emoji as a fallback
  const pic = (id, emoji) => (window.Icons ? window.Icons.html(id, emoji) : emoji);
  const round2 = (n) => Math.round(n * 100) / 100;

  // ---------- Shop picker ----------
  function renderPicker() {
    const wrap = $("shop-buttons");
    wrap.innerHTML = "";
    Object.values(window.MENUS).forEach((m) => {
      const b = document.createElement("button");
      b.className = "shop-btn";
      b.style.background = `linear-gradient(160deg, ${m.theme.primary}, ${m.theme.accent})`;
      b.innerHTML = `<span class="big">${m.emoji}</span><span class="name">${m.name}</span><span class="tag">${m.tagline}</span>`;
      b.onclick = () => openShop(m.id);
      wrap.appendChild(b);
    });
  }

  function openShop(id) {
    shop = window.MENUS[id];
    store.set("shop", id);
    const root = document.documentElement.style;
    root.setProperty("--primary", shop.theme.primary);
    root.setProperty("--accent", shop.theme.accent);
    root.setProperty("--bg", shop.theme.bg);

    $("shop-emoji").textContent = shop.emoji;
    $("shop-name").textContent = shop.name;
    $("tax-label").textContent = TAX_RATE ? `Tax (${+(TAX_RATE * 100).toFixed(2)}%)` : "Tax";

    order = store.get("order." + id, null) || newOrder();
    category = shop.categories[0].id;

    $("picker").classList.add("hidden");
    $("register").classList.remove("hidden");
    renderCategories();
    renderItems();
    renderTicket();
    renderOrderType();
    renderOrderNumber();
  }

  function goHome() {
    if (window.Surprise) window.Surprise.stop();
    store.set("shop", null);
    $("register").classList.add("hidden");
    $("picker").classList.remove("hidden");
  }

  // ---------- Order numbers ----------
  // One count for both shops (and both iPads when linked), so every ticket number is different
  function currentOrderNumber() {
    const mine = store.get("orderNum", 1);
    const seen = window.Kitchen ? window.Kitchen.nextNumber() : 1;
    return Math.max(mine, seen);
  }
  function renderOrderNumber() {
    $("order-number").textContent = "Order #" + currentOrderNumber();
  }

  function newOrder() {
    return { lines: [], type: "For Here" };
  }
  function saveOrder() {
    store.set("order." + shop.id, order);
  }

  // ---------- Categories & items ----------
  function renderCategories() {
    const nav = $("categories");
    nav.innerHTML = "";
    shop.categories.forEach((c) => {
      const b = document.createElement("button");
      b.className = "cat-btn" + (c.id === category ? " on" : "");
      b.textContent = `${c.emoji} ${c.name}`;
      b.onclick = () => { category = c.id; renderCategories(); renderItems(); };
      nav.appendChild(b);
    });
  }

  function renderItems() {
    const grid = $("items");
    grid.innerHTML = "";
    grid.scrollTop = 0;
    shop.items.filter((it) => it.cat === category).forEach((it) => {
      const b = document.createElement("button");
      b.className = "item-btn";
      b.innerHTML = `<span class="e">${pic(it.id, it.emoji)}</span><span class="n">${it.name}</span><span class="p">${money(it.price)}</span>`;
      b.onclick = () => tapItem(it);
      grid.appendChild(b);
    });
  }

  function tapItem(item) {
    if (!item.options || item.options.length === 0) {
      addLine(item, {}, 1);
    } else {
      openItemModal(item, null);
    }
  }

  // ---------- Options popup ----------
  function defaultChoices(item) {
    const choices = {};
    (item.options || []).forEach((gid) => {
      const g = shop.optionGroups[gid];
      if (g.type === "one") choices[gid] = [g.choices[0].name];
      else choices[gid] = g.startAll ? g.choices.map((c) => c.name) : [];
    });
    return choices;
  }

  function openItemModal(item, lineIndex) {
    const existing = lineIndex === null ? null : order.lines[lineIndex];
    editing = {
      item,
      lineIndex,
      qty: existing ? existing.qty : 1,
      choices: existing ? JSON.parse(JSON.stringify(existing.choices)) : defaultChoices(item),
    };
    $("im-emoji").innerHTML = pic(item.id, item.emoji);
    $("im-name").textContent = item.name;
    $("im-base").textContent = money(item.price);
    $("im-add").textContent = existing ? "Update" : "Add to Order";
    renderGroups();
    renderModalQty();
    $("item-modal").classList.remove("hidden");
  }

  function renderGroups() {
    const box = $("im-groups");
    box.innerHTML = "";
    editing.item.options.forEach((gid) => {
      const g = shop.optionGroups[gid];
      const sec = document.createElement("div");
      sec.className = "group";
      const hint = g.type === "many" ? (g.startAll ? " <small>(tap to remove)</small>" : " <small>(pick any)</small>") : "";
      sec.innerHTML = `<div class="group-label">${g.label.replace(/\s*\(.*\)$/, "")}${hint}</div>`;
      const chips = document.createElement("div");
      chips.className = "chips";
      g.choices.forEach((c) => {
        const picked = editing.choices[gid].includes(c.name);
        const b = document.createElement("button");
        b.className = "chip" + (picked ? " on" : "") + (g.startAll && !picked ? " off" : "");
        b.innerHTML = c.name + (c.price ? `<span class="plus">+${money(c.price)}</span>` : "");
        b.onclick = () => {
          if (g.type === "one") {
            editing.choices[gid] = [c.name];
          } else {
            const list = editing.choices[gid];
            const i = list.indexOf(c.name);
            if (i >= 0) list.splice(i, 1); else list.push(c.name);
          }
          renderGroups();
          renderModalQty();
        };
        chips.appendChild(b);
      });
      sec.appendChild(chips);
      box.appendChild(sec);
    });
  }

  function renderModalQty() {
    $("im-qty").textContent = editing.qty;
    const each = unitPrice(editing.item, editing.choices);
    const label = editing.lineIndex === null ? "Add to Order" : "Update";
    $("im-add").textContent = `${label} · ${money(each * editing.qty)}`;
  }

  function closeItemModal() {
    $("item-modal").classList.add("hidden");
    editing = null;
  }

  // ---------- Prices & descriptions ----------
  function unitPrice(item, choices) {
    let p = item.price;
    Object.entries(choices).forEach(([gid, names]) => {
      const g = shop.optionGroups[gid];
      if (!g) return;
      names.forEach((n) => {
        const c = g.choices.find((x) => x.name === n);
        if (c) p += c.price;
      });
    });
    return round2(p);
  }

  // Short text under each line on the ticket, e.g. "Medium · Cream · No Pickles"
  function describe(item, choices) {
    const parts = [];
    (item.options || []).forEach((gid) => {
      const g = shop.optionGroups[gid];
      const picked = choices[gid] || [];
      if (g.startAll) {
        g.choices.forEach((c) => { if (!picked.includes(c.name)) parts.push("No " + c.name); });
      } else if (g.type === "one") {
        const n = picked[0];
        if (n && !/^(No |Just )/.test(n)) parts.push(n);
      } else {
        picked.forEach((n) => parts.push(n));
      }
    });
    return parts.join(" · ");
  }

  // ---------- Ticket ----------
  function addLine(item, choices, qty) {
    // If an identical item is already on the ticket, just bump the count
    const key = JSON.stringify(choices);
    const same = order.lines.findIndex((l) => l.itemId === item.id && JSON.stringify(l.choices) === key);
    let flashIndex;
    if (same >= 0) {
      order.lines[same].qty += qty;
      flashIndex = same;
    } else {
      order.lines.push({ itemId: item.id, qty, choices });
      flashIndex = order.lines.length - 1;
    }
    saveOrder();
    renderTicket(flashIndex);
  }

  function totals() {
    let sub = 0;
    order.lines.forEach((l) => {
      const item = findItem(l.itemId);
      if (item) sub += unitPrice(item, l.choices) * l.qty;
    });
    sub = round2(sub);
    const tax = round2(sub * TAX_RATE);
    return { sub, tax, total: round2(sub + tax) };
  }

  function findItem(id) {
    return shop.items.find((i) => i.id === id);
  }

  function renderTicket(flashIndex) {
    // Drop lines whose item was removed from the menu file
    order.lines = order.lines.filter((l) => findItem(l.itemId));

    const ul = $("lines");
    ul.innerHTML = "";
    order.lines.forEach((l, idx) => {
      const item = findItem(l.itemId);
      const li = document.createElement("li");
      li.className = "line" + (idx === flashIndex ? " flash" : "");
      const mods = describe(item, l.choices);
      li.innerHTML = `
        <span class="line-emoji">${pic(item.id, item.emoji)}</span>
        <div class="line-main">
          <div class="line-name">${item.name}</div>
          ${mods ? `<div class="line-mods">${mods}</div>` : ""}
          <div class="line-price">${money(unitPrice(item, l.choices) * l.qty)}</div>
        </div>
        <div class="line-qty">
          <button data-act="minus" aria-label="One less">−</button>
          <span>${l.qty}</span>
          <button data-act="plus" aria-label="One more">+</button>
        </div>`;
      li.querySelector('[data-act="minus"]').onclick = (e) => { e.stopPropagation(); changeQty(idx, -1); };
      li.querySelector('[data-act="plus"]').onclick = (e) => { e.stopPropagation(); changeQty(idx, +1); };
      if (item.options && item.options.length) {
        li.querySelector(".line-main").onclick = () => openItemModal(item, idx);
      }
      ul.appendChild(li);
    });
    if (flashIndex !== undefined && ul.children[flashIndex]) {
      ul.children[flashIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    const t = totals();
    $("subtotal").textContent = money(t.sub);
    $("tax").textContent = money(t.tax);
    $("total").textContent = money(t.total);
    $("btn-charge").textContent = "Charge " + money(t.total);
    $("btn-charge").disabled = order.lines.length === 0;
    $("empty").classList.toggle("hidden", order.lines.length > 0);
    $("lines").classList.toggle("hidden", order.lines.length === 0);
    $("ticket-customer").textContent = order.type;
  }

  function changeQty(idx, delta) {
    order.lines[idx].qty += delta;
    if (order.lines[idx].qty <= 0) order.lines.splice(idx, 1);
    saveOrder();
    renderTicket();
  }

  function renderOrderType() {
    document.querySelectorAll("#order-type button").forEach((b) => {
      b.classList.toggle("on", b.dataset.type === order.type);
    });
  }

  // ---------- Checkout (simple for Phase 1) ----------
  function openCheckout() {
    $("co-name").value = "";
    $("co-total").textContent = money(totals().total);
    const quick = $("co-quick");
    quick.innerHTML = "";
    QUICK_NAMES.forEach((n) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = n;
      b.onclick = () => { $("co-name").value = n; };
      quick.appendChild(b);
    });
    $("checkout-modal").classList.remove("hidden");
  }

  // Hand off to the Square-style customer screen (checkout.js)
  function startPayment() {
    const name = $("co-name").value.trim();
    const num = currentOrderNumber();
    const t = totals();
    const cents = (n) => Math.round(n * 100);

    $("checkout-modal").classList.add("hidden");
    $("co-name").blur();

    const lines = order.lines.map((l) => {
      const item = findItem(l.itemId);
      return {
        emoji: item.emoji,
        icon: item.id,
        name: item.name,
        mods: describe(item, l.choices),
        qty: l.qty,
        amount: cents(unitPrice(item, l.choices) * l.qty),
      };
    });

    window.Checkout.start({
      shop,
      number: num,
      name,
      type: order.type,
      lines,
      subtotal: cents(t.sub),
      tax: cents(t.tax),
      // In Surprise Customer mode the pretend customer tips and pays by themselves
      auto: window.Surprise && window.Surprise.active() ? window.Surprise.payPlan() : null,
      onDone: (payment) => finishOrder(name, num, t, payment, lines),
    });
  }

  function finishOrder(name, num, t, payment, lines) {
    // Send a ticket to the kitchen (and to the other iPad, if linked)
    if (window.Kitchen) window.Kitchen.add({ shop, number: num, name, type: order.type, lines });

    const history = store.get("history", []);
    history.push({
      shop: shop.id,
      number: num,
      name,
      type: order.type,
      lines: order.lines,
      ...t,
      payment,
      time: new Date().toISOString(),
    });
    store.set("history", history.slice(-500));
    store.set("orderNum", num >= 999 ? 1 : num + 1);

    order = newOrder();
    saveOrder();
    renderTicket();
    renderOrderType();
    renderOrderNumber();
    if (window.Surprise && window.Surprise.active()) window.Surprise.served(payment);
  }

  // Charge: in Surprise Customer mode, the customer checks the order first
  function charge() {
    if (window.Surprise && window.Surprise.active()) {
      if (!window.Surprise.checkOrder()) return;
      $("co-name").value = window.Surprise.customerName();
      startPayment();
      return;
    }
    openCheckout();
  }

  // Helpers for surprise.js
  window.Register = {
    getShop: () => shop,
    getOrder: () => order,
    findItem,
    defaultChoices,
    describe,
    refresh() {
      saveOrder();
      renderTicket();
      renderOrderType();
    },
    clearOrder() {
      order = newOrder();
      saveOrder();
      renderTicket();
      renderOrderType();
    },
  };

  function renderMute() {
    $("btn-mute").textContent = window.Sound.isMuted() ? "🔇" : "🔊";
  }

  // ---------- Clock ----------
  function tick() {
    $("clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // ---------- Wire up buttons ----------
  $("btn-home").onclick = goHome;
  $("btn-clear").onclick = () => {
    if (order.lines.length === 0 || confirm("Clear this whole order?")) {
      order.lines = [];
      saveOrder();
      renderTicket();
    }
  };
  $("btn-charge").onclick = charge;
  document.querySelectorAll("#order-type button").forEach((b) => {
    b.onclick = () => { order.type = b.dataset.type; saveOrder(); renderOrderType(); renderTicket(); };
  });

  $("im-minus").onclick = () => { if (editing.qty > 1) { editing.qty--; renderModalQty(); } };
  $("im-plus").onclick = () => { editing.qty++; renderModalQty(); };
  $("im-cancel").onclick = closeItemModal;
  $("im-add").onclick = () => {
    const { item, choices, qty, lineIndex } = editing;
    if (lineIndex === null) {
      addLine(item, choices, qty);
    } else {
      order.lines[lineIndex] = { itemId: item.id, qty, choices };
      saveOrder();
      renderTicket(lineIndex);
    }
    closeItemModal();
  };
  $("item-modal").onclick = (e) => { if (e.target.id === "item-modal") closeItemModal(); };

  $("co-cancel").onclick = () => $("checkout-modal").classList.add("hidden");
  $("co-pay").onclick = startPayment;
  $("co-name").onkeydown = (e) => { if (e.key === "Enter") startPayment(); };
  document.addEventListener("kearns:tickets", () => { if (shop) renderOrderNumber(); });
  $("btn-mute").onclick = () => { window.Sound.setMuted(!window.Sound.isMuted()); renderMute(); };
  renderMute();

  // ---------- Start ----------
  renderPicker();
  tick();
  setInterval(tick, 15000);
  const last = store.get("shop", null);
  if (last && window.MENUS[last]) openShop(last);

  // Offline support (only works when served over http/https, e.g. GitHub Pages)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
