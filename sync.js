// Kearns Café — link two iPads (peer-to-peer, no account needed).
//
// Both iPads type the same link code. The first one to connect becomes the "host";
// the other connects to it. PeerJS's free public server only introduces the iPads;
// orders and cards then travel directly between them over an encrypted WebRTC link.
// Each iPad keeps its own copy of everything, so it all still works when unlinked.

window.Sync = (function () {
  "use strict";

  const PREFIX = "kearns-cafe-v1-";
  const WORDS = ["DONUT", "BAGEL", "BURGER", "FRIES", "SHAKE", "COOKIE", "MUFFIN", "LATTE", "SPRINKLE", "PICKLE", "WAFFLE", "TACO"];

  const $ = (id) => document.getElementById(id);

  let code = null;
  let peer = null;
  let role = null;          // "host" or "guest"
  let conns = [];           // open connections
  let status = "off";       // off | connecting | waiting | linked | offline
  let retryTimer = null;
  let connectTimer = null;

  function setStatus(s) {
    status = s;
    renderStatus();
  }

  // ---------- Start / stop ----------
  function start(newCode) {
    stop(false);
    code = newCode;
    try { localStorage.setItem("kearns.linkCode", code); } catch (e) { /* ignore */ }
    if (!window.Peer) { setStatus("offline"); return; }
    tryHost();
  }

  function stop(forget) {
    clearTimeout(retryTimer);
    clearTimeout(connectTimer);
    conns.forEach((c) => { try { c.close(); } catch (e) { /* ignore */ } });
    conns = [];
    if (peer) { try { peer.destroy(); } catch (e) { /* ignore */ } }
    peer = null;
    role = null;
    if (forget) {
      code = null;
      try { localStorage.removeItem("kearns.linkCode"); } catch (e) { /* ignore */ }
    }
    setStatus("off");
  }

  function retry(ms) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (code) start(code); }, ms);
  }

  // Try to be the host (claim the code's ID). If it's taken, the other iPad is host.
  function tryHost() {
    setStatus("connecting");
    const p = new window.Peer(PREFIX + code.toLowerCase(), { debug: 0 });
    peer = p;
    p.on("open", () => {
      if (peer !== p) return;
      role = "host";
      setStatus(conns.length ? "linked" : "waiting");
    });
    p.on("connection", (conn) => setupConn(conn));
    p.on("disconnected", () => { if (peer === p && !p.destroyed) { try { p.reconnect(); } catch (e) { /* ignore */ } } });
    p.on("error", (err) => {
      if (peer !== p) return;
      if (err.type === "unavailable-id") {
        p.destroy();
        tryGuest();
      } else {
        setStatus("offline");
        retry(5000);
      }
    });
  }

  function tryGuest() {
    setStatus("connecting");
    const p = new window.Peer({ debug: 0 });
    peer = p;
    p.on("open", () => {
      if (peer !== p) return;
      role = "guest";
      const conn = p.connect(PREFIX + code.toLowerCase(), { reliable: true });
      setupConn(conn);
      // If the host never answers (e.g. it's asleep), start over
      clearTimeout(connectTimer);
      connectTimer = setTimeout(() => { if (!conn.open) retry(1000); }, 10000);
    });
    p.on("error", (err) => {
      if (peer !== p) return;
      // Host went away: try to become the host ourselves
      setStatus(err.type === "peer-unavailable" ? "connecting" : "offline");
      retry(err.type === "peer-unavailable" ? 1500 : 5000);
    });
  }

  function setupConn(conn) {
    conn.on("open", () => {
      clearTimeout(connectTimer);
      conns.push(conn);
      setStatus("linked");
      // Swap everything we know; each side keeps the newest copy
      conn.send({ type: "hello", cards: window.Cards ? window.Cards.all() : {}, tickets: window.Kitchen ? window.Kitchen.all() : {} });
    });
    conn.on("data", (msg) => receive(msg, conn));
    const gone = () => {
      conns = conns.filter((c) => c !== conn);
      if (role === "guest") { setStatus("connecting"); retry(2000); }
      else if (role === "host") setStatus(conns.length ? "linked" : "waiting");
    };
    conn.on("close", gone);
    conn.on("error", gone);
  }

  // ---------- Messages ----------
  function receive(msg, from) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "hello") {
      if (window.Cards) window.Cards.merge(msg.cards);
      if (window.Kitchen) window.Kitchen.merge(msg.tickets);
    } else if (msg.type === "card" && msg.card && window.Cards) {
      window.Cards.merge({ [msg.card.id]: msg.card });
    } else if (msg.type === "ticket" && msg.ticket && window.Kitchen) {
      window.Kitchen.merge({ [msg.ticket.id]: msg.ticket });
    }
    // The host passes changes along in case more than two iPads are linked
    if (role === "host" && msg.type !== "hello") send(msg, from);
  }

  function send(msg, except) {
    conns.forEach((c) => { if (c !== except && c.open) { try { c.send(msg); } catch (e) { /* ignore */ } } });
  }

  // ---------- Status display ----------
  const LABELS = {
    off: ["⚪", "Not linked"],
    connecting: ["🟡", "Connecting…"],
    waiting: ["🟡", "Waiting for the other iPad…"],
    linked: ["🟢", "Linked!"],
    offline: ["🔴", "Can't reach the internet — retrying…"],
  };

  function renderStatus() {
    const [dot, text] = LABELS[status];
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set("link-dot", dot);
    set("btn-link", status === "off" ? "🔗 Link iPads" : `${dot} ${status === "linked" ? "Linked" : "Linking…"}`);
    set("link-status", `${dot} ${text}` + (code && status !== "off" ? `  (code ${code})` : ""));
    const unlink = $("link-unlink");
    if (unlink) unlink.classList.toggle("hidden", status === "off");
  }

  // ---------- Link popup ----------
  function randomCode() {
    return WORDS[Math.floor(Math.random() * WORDS.length)] + "-" + String(10000 + Math.floor(Math.random() * 90000));
  }
  function cleanCode(c) {
    return String(c || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 24);
  }

  function openModal() {
    $("link-code").value = code || randomCode();
    renderStatus();
    $("link-modal").classList.remove("hidden");
  }

  function init() {
    $("btn-link").onclick = openModal;
    $("link-dot").onclick = openModal;
    $("link-new").onclick = () => { $("link-code").value = randomCode(); };
    $("link-close").onclick = () => { $("link-modal").classList.add("hidden"); $("link-code").blur(); };
    $("link-go").onclick = () => {
      const c = cleanCode($("link-code").value);
      if (c.length < 4) { $("link-code").focus(); return; }
      $("link-code").value = c;
      $("link-code").blur();
      start(c);
    };
    $("link-unlink").onclick = () => stop(true);

    // Send our changes to the other iPad as they happen
    if (window.Cards) window.Cards.onChange((card) => send({ type: "card", card }));
    if (window.Kitchen) window.Kitchen.onChange((ticket) => send({ type: "ticket", ticket }));

    // iPads drop connections while asleep; reconnect when the app comes back
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && code && status !== "linked") start(code);
    });
    setInterval(() => {
      if (!code) return;
      if (role === "guest" && !conns.some((c) => c.open) && status === "linked") retry(500);
      if (peer && peer.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* ignore */ } }
    }, 10000);

    let saved = null;
    try { saved = localStorage.getItem("kearns.linkCode"); } catch (e) { /* ignore */ }
    if (saved) start(saved);
    else renderStatus();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { start, stop, status: () => status, role: () => role };
})();
