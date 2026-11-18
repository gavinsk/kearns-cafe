// Kearns Café — kitchen game: drag menu items onto the tray to build an order.
// Opened from a kitchen ticket ("Make it!") or in Free Play with no ticket.

window.Game = (function () {
  "use strict";

  const EASY_EXTRAS = 4;   // in Easy shelf mode: the ticket's items plus this many others
  const POINTS_RIGHT = 10; // perfect order
  const POINTS_WRONG = 5;  // taken away for a wrong order (score never goes below 0)

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const sound = (name) => { if (window.Sound && window.Sound[name]) window.Sound[name](); };

  let ticket = null;     // kitchen ticket being built, or null for Free Play
  let menu = null;       // shop menu (from menus/*.js)
  let category = null;
  let tray = [];         // [{ uid, name, emoji, icon }]
  const pic = (id, emoji) => (window.Icons ? window.Icons.html(id, emoji) : esc(emoji));
  let easy = false;
  try { easy = localStorage.getItem("kearns.easyShelf") === "1"; } catch (e) { /* ignore */ }

  // ---------- Kitchen score (kept on this iPad until reset) ----------
  function getScore() {
    try { return Number(localStorage.getItem("kearns.kitchenScore")) || 0; } catch (e) { return 0; }
  }
  function setScore(n) {
    try { localStorage.setItem("kearns.kitchenScore", String(Math.max(0, n))); } catch (e) { /* ignore */ }
    renderScore();
  }
  function renderScore() {
    const text = `🏆 ${getScore()}`;
    ["kitchen-score", "build-score"].forEach((id) => { const el = $(id); if (el) el.textContent = text; });
  }

  // ---------- Open / close ----------
  function menuFor(t) {
    const menus = Object.values(window.MENUS);
    if (!t) return menu || menus[0];
    return menus.find((m) => m.id === t.shopId) || menus.find((m) => m.name === t.shopName) || menus[0];
  }

  function open(t) {
    ticket = t || null;
    menu = menuFor(ticket);
    tray = [];
    category = null;
    $("kitchen").classList.add("hidden");
    $("build").classList.remove("hidden");
    $("build-msg").textContent = "";
    $("build-msg").className = "build-msg";
    $("build-done").disabled = false;
    $("build-score").classList.toggle("hidden", !ticket);
    renderScore();
    render();
  }

  function close() {
    $("build").classList.add("hidden");
    $("kitchen").classList.remove("hidden");
    if (window.Kitchen) window.Kitchen.open("kitchen");
  }

  // ---------- What the ticket needs ----------
  function needs() {
    // name -> { qty, emoji, mods[] }  (same item on two lines gets added together)
    const map = {};
    (ticket ? ticket.lines : []).forEach((l) => {
      const n = map[l.name] || (map[l.name] = { qty: 0, emoji: l.emoji, icon: l.icon, mods: [] });
      n.qty += Number(l.qty) || 1;
      if (l.mods) n.mods.push(l.mods);
    });
    return map;
  }
  function trayCounts() {
    const c = {};
    tray.forEach((i) => { c[i.name] = (c[i.name] || 0) + 1; });
    return c;
  }

  // ---------- Drawing ----------
  function render() {
    renderTicket();
    renderShelf();
    renderTray();
  }

  function renderTicket() {
    const box = $("build-ticket");
    $("build-easy").classList.toggle("on", easy);
    $("build-easy").classList.toggle("hidden", !ticket);
    $("build-done").classList.toggle("hidden", !ticket);
    $("build-skip").classList.toggle("hidden", !ticket);
    $("build-shops").classList.toggle("hidden", !!ticket);

    if (!ticket) {
      box.innerHTML = `<div class="bt-title">🧸 Free Play</div><div class="bt-sub">Make anything you want!</div>`;
      const shops = $("build-shops");
      shops.innerHTML = "";
      Object.values(window.MENUS).forEach((m) => {
        const b = document.createElement("button");
        b.className = "btn-small" + (m === menu ? " on" : "");
        b.textContent = m.emoji + " " + m.name.replace("Kearns ", "");
        b.onclick = () => { menu = m; category = null; render(); };
        shops.appendChild(b);
      });
      return;
    }

    const have = trayCounts();
    const list = Object.entries(needs()).map(([name, n]) => {
      const got = have[name] || 0;
      const done = got >= n.qty;
      return `<li class="${done ? "done" : ""}">
        <span class="bt-emoji">${pic(n.icon, n.emoji)}</span>
        <span class="bt-name">${esc(name)}${n.mods.length ? `<small>${esc(n.mods.join(" / "))}</small>` : ""}</span>
        <span class="bt-count">${Math.min(got, 99)}/${n.qty}${done ? " ✓" : ""}</span>
      </li>`;
    }).join("");
    box.innerHTML = `
      <div class="bt-title">#${esc(ticket.number)} ${esc(ticket.name || "")} <span>${esc(ticket.shopEmoji)} ${esc(ticket.type)}</span></div>
      <ul class="bt-lines">${list}</ul>`;
  }

  // Which menu items go on the shelf
  function shelfItems() {
    if (ticket && easy) {
      const wanted = Object.keys(needs());
      const inTicket = menu.items.filter((i) => wanted.includes(i.name));
      const others = menu.items.filter((i) => !wanted.includes(i.name));
      // a few random extras so it's still a choice
      const extras = others.sort((a, b) => (hash(a.id + ticket.id) - hash(b.id + ticket.id))).slice(0, EASY_EXTRAS);
      return inTicket.concat(extras).sort((a, b) => menu.items.indexOf(a) - menu.items.indexOf(b));
    }
    if (!category) category = menu.categories[0].id;
    return menu.items.filter((i) => i.cat === category);
  }
  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function renderShelf() {
    const tabs = $("build-cats");
    tabs.innerHTML = "";
    tabs.classList.toggle("hidden", !!(ticket && easy));
    if (!(ticket && easy)) {
      if (!category) category = menu.categories[0].id;
      menu.categories.forEach((c) => {
        const b = document.createElement("button");
        b.className = "cat-btn" + (c.id === category ? " on" : "");
        b.textContent = `${c.emoji} ${c.name}`;
        b.onclick = () => { category = c.id; renderShelf(); };
        tabs.appendChild(b);
      });
    }
    const shelf = $("build-shelf");
    shelf.innerHTML = "";
    shelfItems().forEach((item) => {
      const tile = document.createElement("div");
      tile.className = "shelf-item";
      tile.innerHTML = `<span class="si-emoji">${pic(item.id, item.emoji)}</span><span class="si-name">${esc(item.name)}</span>`;
      makeDraggable(tile, { name: item.name, emoji: item.emoji, icon: item.id }, "shelf");
      shelf.appendChild(tile);
    });
  }

  function renderTray(popUid) {
    const box = $("build-tray-items");
    box.innerHTML = "";
    tray.forEach((t) => {
      const el = document.createElement("div");
      el.className = "tray-item" + (t.uid === popUid ? " pop" : "");
      el.innerHTML = `<span class="ti-emoji">${pic(t.icon, t.emoji)}</span><span class="ti-name">${esc(t.name)}</span>`;
      makeDraggable(el, t, "tray");
      box.appendChild(el);
    });
    $("build-tray-hint").classList.toggle("hidden", tray.length > 0);
    $("build-clear").classList.toggle("hidden", tray.length === 0);
  }

  // ---------- Dragging (works with fingers and a mouse) ----------
  function makeDraggable(el, item, from) {
    el.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY };
      let ghost = null;

      const move = (ev) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
          ghost = document.createElement("div");
          ghost.className = "drag-ghost";
          ghost.innerHTML = pic(item.icon, item.emoji);
          document.body.appendChild(ghost);
          if (from === "tray") el.classList.add("lifting");
        }
        ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -50%)`;
        $("build-tray").classList.toggle("drop-hover", overTray(ev));
      };

      const up = (ev) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        $("build-tray").classList.remove("drop-hover");
        if (!ghost) {
          // A tap instead of a drag: wiggle to show it needs dragging
          el.classList.remove("wiggle");
          void el.offsetWidth;
          el.classList.add("wiggle");
          return;
        }
        const onTray = ev.type === "pointerup" && overTray(ev);
        if (from === "shelf" && onTray) {
          const added = { uid: Date.now() + Math.random(), name: item.name, emoji: item.emoji, icon: item.icon };
          tray.push(added);
          sound("pop");
          ghost.remove();
          $("build-msg").textContent = "";
          renderTray(added.uid);
          renderTicket();
        } else if (from === "tray" && !onTray) {
          tray = tray.filter((t) => t.uid !== item.uid);
          sound("click");
          ghost.remove();
          renderTray();
          renderTicket();
        } else {
          // Dropped somewhere that doesn't count: float back
          el.classList.remove("lifting");
          const r = el.getBoundingClientRect();
          ghost.classList.add("returning");
          ghost.style.transform = `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px) translate(-50%, -50%) scale(0.6)`;
          setTimeout(() => ghost.remove(), 250);
        }
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    });
  }

  function overTray(e) {
    const r = $("build-tray").getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  // ---------- Checking ----------
  function check() {
    const need = needs();
    const have = trayCounts();
    const missing = [];
    const extra = [];
    Object.entries(need).forEach(([name, n]) => {
      const got = have[name] || 0;
      if (got < n.qty) missing.push(`${n.qty - got} ${name}`);
      if (got > n.qty) extra.push(`${got - n.qty} extra ${name}`);
    });
    Object.keys(have).forEach((name) => { if (!need[name]) extra.push(name); });

    // Right or wrong, the order goes out — the score shows how well it went
    const msg = $("build-msg");
    const perfect = !missing.length && !extra.length;
    if (perfect) {
      sound("yay");
      setScore(getScore() + POINTS_RIGHT);
      msg.className = "build-msg ok";
      msg.textContent = `⭐ +${POINTS_RIGHT} Perfect! Order up!`;
    } else {
      sound("buzz");
      setScore(getScore() - POINTS_WRONG);
      msg.className = "build-msg bad";
      msg.textContent = `😬 −${POINTS_WRONG}: ` + (missing.length ? `forgot ${missing.join(", ")}` : `nobody ordered ${extra.join(", ")}`);
    }
    $("build-done").disabled = true;
    const id = ticket.id;
    setTimeout(() => {
      if (window.Kitchen) window.Kitchen.markReady(id);
      close();
    }, perfect ? 1400 : 2600);
  }

  // ---------- Wire up ----------
  function init() {
    renderScore();
    $("kitchen-score-reset").onclick = () => {
      if (getScore() === 0 || confirm("Start the kitchen score over at 0?")) setScore(0);
    };
    $("build-back").onclick = close;
    $("build-done").onclick = check;
    $("build-clear").onclick = () => { tray = []; renderTray(); renderTicket(); };
    $("build-skip").onclick = () => {
      if (ticket && window.Kitchen) window.Kitchen.markReady(ticket.id);
      close();
    };
    $("build-easy").onclick = () => {
      easy = !easy;
      try { localStorage.setItem("kearns.easyShelf", easy ? "1" : "0"); } catch (e) { /* ignore */ }
      render();
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { open, close };
})();
