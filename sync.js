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
  let reconnectTimer = null;

  // Be gentle with the free PeerJS server: every failed attempt waits longer than the
  // last (it blocks addresses that reconnect too often). Resets once linked.
  let failures = 0;
  let nextTryAt = 0;
  let waitSeconds = 0;
  function backoff(base, max) {
    const ms = Math.min(base * Math.pow(2, failures), max);
    failures++;
    nextTryAt = Date.now() + ms;
    waitSeconds = Math.round(ms / 1000);
    return ms;
  }
  function succeeded() { failures = 0; nextTryAt = 0; }
  const handlers = {};      // message type -> [fn]   (e.g. "intercom")
  const callHandlers = [];  // incoming audio calls (intercom)
  function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); }
  function fire(type, msg) { (handlers[type] || []).forEach((fn) => { try { fn(msg); } catch (e) { /* ignore */ } }); }
  function onCall(fn) { callHandlers.push(fn); }
  function listenForCalls(p) { p.on("call", (call) => callHandlers.forEach((fn) => fn(call))); }

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
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
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
  // Server trouble: wait 5s, 10s, 20s… up to 5 minutes
  function retryOffline() { const ms = backoff(5000, 300000); setStatus("offline"); retry(ms); }
  // Other iPad not answering: wait 2s, 4s, 8s… up to 1 minute
  function retrySoon() { retry(backoff(2000, 60000)); }

  // Lost touch with the server (links already made keep working); reconnect later, not instantly
  function reconnectLater(p) {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (peer === p && p.disconnected && !p.destroyed) { try { p.reconnect(); } catch (e) { /* ignore */ } }
    }, backoff(5000, 300000));
  }

  // Try to be the host (claim the code's ID). If it's taken, the other iPad is host.
  function tryHost() {
    setStatus("connecting");
    const p = new window.Peer(PREFIX + code.toLowerCase(), { debug: 0 });
    peer = p;
    p.on("open", () => {
      if (peer !== p) return;
      role = "host";
      succeeded();
      setStatus(conns.length ? "linked" : "waiting");
    });
    p.on("connection", (conn) => setupConn(conn));
    listenForCalls(p);
    p.on("disconnected", () => { if (peer === p && !p.destroyed) reconnectLater(p); });
    p.on("error", (err) => {
      if (peer !== p) return;
      if (err.type === "unavailable-id") {
        p.destroy();
        tryGuest();
      } else if (conns.some((c) => c.open)) {
        reconnectLater(p);    // still linked directly; just lost the server for now
      } else {
        retryOffline();
      }
    });
  }

  function tryGuest() {
    setStatus("connecting");
    const p = new window.Peer({ debug: 0 });
    peer = p;
    listenForCalls(p);
    p.on("open", () => {
      if (peer !== p) return;
      role = "guest";
      const conn = p.connect(PREFIX + code.toLowerCase(), { reliable: true });
      setupConn(conn);
      // If the host never answers (e.g. it's asleep), start over
      clearTimeout(connectTimer);
      connectTimer = setTimeout(() => { if (!conn.open) retrySoon(); }, 10000);
    });
    p.on("disconnected", () => { if (peer === p && !p.destroyed) reconnectLater(p); });
    p.on("error", (err) => {
      if (peer !== p) return;
      if (err.type === "peer-unavailable") {
        // Host went away: try again (maybe becoming the host ourselves) after a pause
        setStatus("connecting");
        retrySoon();
      } else if (conns.some((c) => c.open)) {
        reconnectLater(p);
      } else {
        retryOffline();
      }
    });
  }

  function setupConn(conn) {
    conn.on("open", () => {
      clearTimeout(connectTimer);
      conns.push(conn);
      succeeded();
      setStatus("linked");
      // Swap everything we know; each side keeps the newest copy
      conn.send({ type: "hello", cards: window.Cards ? window.Cards.all() : {}, tickets: window.Kitchen ? window.Kitchen.all() : {} });
      fire("_linked", { peerId: conn.peer });
    });
    conn.on("data", (msg) => receive(msg, conn));
    const gone = () => {
      conns = conns.filter((c) => c !== conn);
      fire("_unlinked", { peerId: conn.peer });
      if (role === "guest") { setStatus("connecting"); retrySoon(); }
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
    } else if (msg.type === "bell" && window.Kitchen) {
      window.Kitchen.rang(msg.info);
    } else if (msg.type === "ticket" && msg.ticket && window.Kitchen) {
      window.Kitchen.merge({ [msg.ticket.id]: msg.ticket });
    } else if (handlers[msg.type]) {
      fire(msg.type, { ...msg, from: from.peer });
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
    offline: ["🔴", "Can't reach the link server"],
  };

  function renderStatus() {
    const [dot, text] = LABELS[status];
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set("link-dot", dot);
    set("btn-link", status === "off" ? "🔗 Link iPads" : `${dot} ${status === "linked" ? "Linked" : "Linking…"}`);
    const extra = status === "offline" ? ` — trying again in ${waitSeconds < 90 ? waitSeconds + " sec" : Math.round(waitSeconds / 60) + " min"}` : "";
    set("link-status", `${dot} ${text}${extra}` + (code && status !== "off" ? `  (code ${code})` : ""));
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
      succeeded();
      start(c);
    };
    $("link-unlink").onclick = () => stop(true);

    // Send our changes to the other iPad as they happen
    if (window.Cards) window.Cards.onChange((card) => send({ type: "card", card }));
    if (window.Kitchen) window.Kitchen.onChange((ticket) => send({ type: "ticket", ticket }));
    if (window.Kitchen) window.Kitchen.onBell((info) => send({ type: "bell", info }));

    // iPads drop connections while asleep; reconnect when the app comes back
    document.addEventListener("visibilitychange", () => {
      // Coming back to the app: try now, unless we're still waiting out a backoff
      if (document.visibilityState === "visible" && code && status !== "linked" && Date.now() >= nextTryAt) start(code);
    });
    setInterval(() => {
      if (!code) return;
      if (role === "guest" && !conns.some((c) => c.open) && status === "linked") retrySoon();
    }, 10000);

    let saved = null;
    try { saved = localStorage.getItem("kearns.linkCode"); } catch (e) { /* ignore */ }
    if (saved) start(saved);
    else renderStatus();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    start, stop,
    status: () => status,
    role: () => role,
    // for intercom.js
    on, onCall,
    send: (msg) => send(msg),
    peer: () => peer,
    linkedPeers: () => conns.filter((c) => c.open).map((c) => c.peer),
    // testing: pretend a message arrived from another device
    _inject: (msg) => receive(msg, { peer: msg.pid || "test" }),
  };
})();
