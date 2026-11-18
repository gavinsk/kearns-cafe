// Kearns Café — drive-thru intercom (push-to-talk between linked iPads).
//
// One iPad opens the "🚗 Drive-Thru" speaker screen (menu board + Hold to Talk).
// The register iPad gets a 🎧 Hold to Talk button while the speaker is online.
// Audio goes straight between the iPads over the existing link (sync.js / PeerJS).
// The talker's voice is filtered on the way out so it sounds like a drive-thru speaker.
//
// On a phone, the same link becomes a pretend phone call: the phone "calls the restaurant",
// the register rings, and once answered both sides can talk freely.

window.Intercom = (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const sound = (name) => { if (window.Sound && window.Sound[name]) window.Sound[name](); };
  const money = (n) => "$" + n.toFixed(2);

  let isPost = false;        // this iPad is showing the drive-thru speaker screen
  let postOnline = false;    // (register) the other iPad's speaker screen is open
  let talking = false;
  let mic = null, ctx = null, gain = null, sendStream = null;
  const calls = {};          // peerId -> outgoing call carrying our voice
  let audioEl = null;

  // ---------- Messages to the other iPad ----------
  function tell(kind, extra) {
    if (window.Sync) window.Sync.send({ type: "intercom", kind, who: isPost ? "post" : "register", pid: myPid(), ...(extra || {}) });
  }
  function myPid() { return window.Sync && window.Sync.peer() ? window.Sync.peer().id : null; }

  function received(msg) {
    // Messages meant for a different device
    if (msg.to && msg.to !== myPid()) {
      // Another register answered the call that was ringing here
      if (msg.kind === "call-connected" && callState === "ringing" && msg.pid === callPeer) dismissRing();
      return;
    }
    switch (msg.kind) {
      case "call-ring": incomingCall(msg); break;
      case "call-answer": if (callState === "dialing") { callPeer = msg.pid; tell("call-connected", { to: callPeer }); connected(); } break;
      case "call-connected": if (callState === "answering" && msg.pid === callPeer) connected(); break;
      case "call-decline": if (callState === "dialing") endCall("The line is busy. Try again in a minute!"); break;
      case "call-cancel": if (callState === "ringing" && msg.pid === callPeer) { dismissRing(); if (window.Kitchen) window.Kitchen.toast("📞 Missed call"); } break;
      case "call-end": if (msg.pid === callPeer && callState !== "idle") endCall("They hung up. Call ended."); break;
      case "post-on": postOnline = true; renderRegister(); tellShop(); break;
      case "ping": if (isPost) tell("post-on"); break;    // register asking "is a speaker open?" 
      case "shop": if (isPost) { tell("post-on"); if (msg.shopId && window.MENUS[msg.shopId]) { saveDriveShop(msg.shopId); renderBoard(); } } break;
      case "post-off": postOnline = false; renderRegister(); break;
      case "talk-start": if (msg.who === "post") { postOnline = true; renderRegister(); } showRemoteTalking(true, msg.who); sound("radio"); break;
      case "talk-stop": showRemoteTalking(false, msg.who); sound("radio"); break;
      case "car": postOnline = true; renderRegister(); carArrived(); break;
    }
  }

  // ---------- Microphone with a drive-thru speaker sound ----------
  async function ensureMic() {
    if (sendStream) return true;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch (e) {
      setStatus("🎤 Microphone is blocked. Allow it in Settings to talk.");
      return false;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const src = ctx.createMediaStreamSource(mic);
    // A light "speaker box" sound that keeps words clear: trim the deepest lows and
    // the very top, with just a touch of grit. (Raise GRIT for more drive-thru crackle.)
    const GRIT = 2;
    const low = ctx.createBiquadFilter(); low.type = "highpass"; low.frequency.value = 250;
    const high = ctx.createBiquadFilter(); high.type = "lowpass"; high.frequency.value = 5000;
    const crunch = ctx.createWaveShaper(); crunch.curve = distortion(GRIT); crunch.oversample = "4x";
    gain = ctx.createGain(); gain.gain.value = 0;   // silent until the button is held
    const out = ctx.createMediaStreamDestination();
    src.connect(low).connect(high).connect(crunch).connect(gain).connect(out);
    sendStream = out.stream;
    return true;
  }
  function distortion(k) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return curve;
  }

  // Keep one outgoing audio call open to each linked iPad
  function ensureCalls() {
    if (!window.Sync || !sendStream) return;
    const peer = window.Sync.peer();
    if (!peer) return;
    window.Sync.linkedPeers().forEach((id) => {
      if (calls[id] && calls[id].open) return;
      try {
        const call = peer.call(id, sendStream);
        calls[id] = call;
        const drop = () => { if (calls[id] === call) delete calls[id]; };
        call.on("close", drop);
        call.on("error", drop);
      } catch (e) { /* will retry next time */ }
    });
  }

  function ensureCallTo(pid) {
    if (!window.Sync || !sendStream || !pid) return;
    const peer = window.Sync.peer();
    if (!peer || (calls[pid] && calls[pid].open)) return;
    try {
      const call = peer.call(pid, sendStream);
      calls[pid] = call;
      const drop = () => { if (calls[pid] === call) delete calls[pid]; };
      call.on("close", drop);
      call.on("error", drop);
    } catch (e) { /* ignore */ }
  }

  // Someone else's voice coming in
  function answer(call) {
    call.answer();   // listen only; our own voice goes out on our own call
    call.on("stream", (remote) => {
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.setAttribute("playsinline", "");
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = remote;
      audioEl.play().catch(() => setStatus("🔈 Tap anywhere to turn on the speaker"));
    });
  }
  // iPads only play sound after a tap
  document.addEventListener("pointerdown", () => { if (audioEl && audioEl.paused && audioEl.srcObject) audioEl.play().catch(() => {}); }, { passive: true });

  // ---------- Push to talk ----------
  async function startTalk() {
    if (talking) return;
    if (!window.Sync || !window.Sync.linkedPeers().length) {
      setStatus("🔗 Link the iPads first (start screen → Link iPads)");
      sound("buzz");
      return;
    }
    talking = true;
    renderButtons();
    const ok = await ensureMic();
    if (!ok) { talking = false; renderButtons(); return; }
    if (ctx.state === "suspended") ctx.resume();
    ensureCalls();
    if (!talking) return;   // let go while the mic was starting
    sound("radio");
    gain.gain.setTargetAtTime(1.4, ctx.currentTime, 0.02);
    tell("talk-start");
    setStatus("🎤 Talking… let go when you're done");
  }

  function stopTalk() {
    if (!talking) return;
    talking = false;
    if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    sound("radio");
    tell("talk-stop");
    renderButtons();
    setStatus(isPost ? "Hold the button to talk to the cashier" : "Hold to talk to the drive-thru");
    renderRegister();
  }

  function wireTalkButton(btn) {
    btn.addEventListener("pointerdown", (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } startTalk(); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => btn.addEventListener(ev, stopTalk));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ---------- Showing what's happening ----------
  function setStatus(text) {
    [$("drive-status"), $("intercom-status")].forEach((el) => { if (el) el.textContent = text; });
  }
  function renderButtons() {
    [$("drive-talk"), $("intercom-talk")].forEach((b) => { if (b) b.classList.toggle("talking", talking); });
  }
  function showRemoteTalking(on, who) {
    const grille = $("drive-grille");
    if (grille) grille.classList.toggle("live", on && isPost);
    const head = $("intercom-talk");
    if (head) head.classList.toggle("hearing", on && !isPost);
    if (on) setStatus(isPost ? "🔊 The cashier is talking…" : "🔊 The customer is talking…");
    else setStatus(isPost ? "Hold the button to talk to the cashier" : "Hold to talk to the drive-thru");
  }
  // The register's 🎧 shows whenever the iPads are linked
  function renderRegister() {
    const box = $("intercom");
    if (!box) return;
    const linked = !!(window.Sync && window.Sync.linkedPeers().length);
    box.classList.toggle("hidden", !linked || isPost || callState !== "idle");   // phone call bar takes this spot
    box.classList.toggle("waiting", !postOnline);
    if (!talking && !isPost) {
      const st = $("intercom-status");
      if (st) st.textContent = postOnline ? "Hold to talk to the drive-thru" : "Open 🚗 Drive-Thru on the other iPad";
    }
  }

  // A car pulled up: beep beep, pop-up, and switch the register to Drive-Thru
  function carArrived() {
    sound("honk");
    if (window.Kitchen) window.Kitchen.toast("🚗 A car is at the drive-thru!");
    if (window.Register && window.Register.setType) window.Register.setType("Drive-Thru");
  }

  // The register tells the speaker which shop is open, so the menu board matches
  function tellShop() {
    const shop = window.Register && window.Register.getShop();
    if (!isPost && shop) tell("shop", { shopId: shop.id });
    renderRegister();
  }
  function saveDriveShop(id) {
    try { localStorage.setItem("kearns.driveShop", id); } catch (e) { /* ignore */ }
  }

  // ---------- Drive-thru speaker screen ----------
  function shopForPost() {
    let id = null;
    try { id = localStorage.getItem("kearns.driveShop"); } catch (e) { /* ignore */ }
    return window.MENUS[id] || Object.values(window.MENUS)[0];
  }

  function renderBoard() {
    const m = shopForPost();
    $("drive").style.setProperty("--primary", m.theme.primary);
    $("drive").style.setProperty("--accent", m.theme.accent);
    $("drive-shop-name").textContent = `${m.emoji} ${m.name}`;
    const shops = $("drive-shops");
    shops.innerHTML = "";
    Object.values(window.MENUS).forEach((s) => {
      const b = document.createElement("button");
      b.className = "btn-small" + (s === m ? " on" : "");
      b.textContent = s.emoji;
      b.setAttribute("aria-label", s.name);
      b.onclick = () => { saveDriveShop(s.id); renderBoard(); };
      shops.appendChild(b);
    });
    const pic = (it) => (window.Icons ? window.Icons.html(it.id, it.emoji) : esc(it.emoji));
    $("drive-board").innerHTML = m.categories.map((c) => `
      <section class="db-cat">
        <h3>${esc(c.emoji)} ${esc(c.name)}</h3>
        ${m.items.filter((i) => i.cat === c.id).map((i) => `
          <div class="db-item"><span class="db-pic">${pic(i)}</span><span class="db-name">${esc(i.name)}</span><span class="db-price">${money(i.price)}</span></div>`).join("")}
      </section>`).join("");
  }

  function openPost() {
    isPost = true;
    $("picker").classList.add("hidden");
    $("drive").classList.remove("hidden");
    renderBoard();
    renderLink();
    setStatus("Hold the button to talk to the cashier");
    tell("post-on");
  }
  function closePost() {
    stopTalk();
    tell("post-off");
    isPost = false;
    $("drive").classList.add("hidden");
    $("picker").classList.remove("hidden");
  }
  function renderLink() {
    const linked = window.Sync && window.Sync.linkedPeers().length > 0;
    const el = $("drive-link");
    if (el) {
      el.textContent = linked ? "🟢 Linked to the register" : "⚪ Not linked — use 🔗 Link iPads on the start screen";
      el.classList.toggle("ok", linked);
    }
  }

  // =====================================================================
  //  PRETEND PHONE CALLS
  // =====================================================================
  const RING_TIMEOUT = 30000;
  let callState = "idle";      // idle | dialing (phone) | ringing / answering (register) | incall
  let callPeer = null;         // the other device's id
  let callShop = null;
  let ringLoop = null, noAnswerTimer = null, clockTimer = null, callStart = 0;
  let muted = false;

  // Phones have a small screen in both directions; iPads don't
  function isPhone() { return Math.min(screen.width, screen.height) < 600; }
  function registerOpen() { const r = $("register"); return r && !r.classList.contains("hidden"); }

  function openLine(on) { if (gain && ctx) gain.gain.setTargetAtTime(on && !muted ? 1.4 : 0, ctx.currentTime, 0.02); }
  function startRingLoop(kind) { stopRingLoop(); sound(kind); ringLoop = setInterval(() => sound(kind), kind === "ring" ? 2600 : 4000); }
  function stopRingLoop() { clearInterval(ringLoop); ringLoop = null; }
  function clock() {
    const t = Math.floor((Date.now() - callStart) / 1000);
    const txt = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
    [$("pc-timer"), $("callbar-time")].forEach((el) => { if (el) el.textContent = txt; });
  }
  function shopName(id) { const m = window.MENUS[id]; return m ? `${m.emoji} ${m.name}` : "the restaurant"; }

  // --- Phone (the caller) ---
  function openPhone() {
    $("picker").classList.add("hidden");
    $("phonecall").classList.remove("hidden");
    renderPhone(callState === "idle" ? "pick" : callState);
  }
  function closePhone() {
    if (callState !== "idle") hangUp();
    $("phonecall").classList.add("hidden");
    $("picker").classList.remove("hidden");
  }

  async function dial(shopId) {
    if (!window.Sync || !window.Sync.linkedPeers().length) { renderPhone("pick", "🔗 Link this phone first: on the start screen tap Link iPads and use the same code."); return; }
    callShop = shopId;
    callState = "dialing";
    renderPhone("dialing");
    const ok = await ensureMic();
    if (!ok) { endCall("🎤 The microphone is blocked. Allow it in Settings to call."); return; }
    if (ctx.state === "suspended") ctx.resume();
    startRingLoop("ringback");
    tell("call-ring", { shopId });
    clearTimeout(noAnswerTimer);
    noAnswerTimer = setTimeout(() => {
      if (callState === "dialing") { tell("call-cancel"); endCall("No answer. Is someone at the register?"); }
    }, RING_TIMEOUT);
  }

  function hangUp() {
    if (callState === "dialing") tell("call-cancel");
    else if (callState === "ringing" || callState === "answering") tell("call-decline", { to: callPeer });
    else if (callState === "incall") tell("call-end", { to: callPeer });
    endCall("Call ended. Thanks for calling!");
  }

  // Both sides: the call is live
  function connected() {
    stopRingLoop();
    clearTimeout(noAnswerTimer);
    callState = "incall";
    muted = false;
    sound("pickup");
    ensureCallTo(callPeer);
    openLine(true);
    callStart = Date.now();
    clearInterval(clockTimer);
    clockTimer = setInterval(clock, 1000);
    clock();
    $("callin").classList.add("hidden");
    renderRegister();
    if (isPhone() && !$("phonecall").classList.contains("hidden")) renderPhone("incall");
    else {
      $("callbar").classList.remove("hidden");
      renderMute();
      if (window.Register && window.Register.setType) window.Register.setType("To Go");   // phone orders are pickups
    }
  }

  function endCall(message) {
    const wasLive = callState === "incall";
    stopRingLoop();
    clearTimeout(noAnswerTimer);
    clearInterval(clockTimer);
    openLine(false);
    callState = "idle";
    callPeer = null;
    muted = false;
    if (wasLive) sound("hangup");
    $("callin").classList.add("hidden");
    $("callbar").classList.add("hidden");
    renderRegister();
    if (!$("phonecall").classList.contains("hidden")) renderPhone("ended", message);
  }

  function toggleMute() {
    muted = !muted;
    openLine(callState === "incall");
    renderMute();
    if (!$("phonecall").classList.contains("hidden")) renderPhone("incall");
  }
  function renderMute() {
    const b = $("callbar-mute");
    if (b) { b.textContent = muted ? "🎤 Unmute" : "🔇 Mute"; b.classList.toggle("on", muted); }
  }

  function renderPhone(stage, message) {
    const body = $("pc-body");
    const shops = Object.values(window.MENUS);
    if (stage === "pick" || stage === "ended") {
      body.innerHTML = `
        ${message ? `<div class="pc-note">${esc(message)}</div>` : ""}
        <div class="pc-title">Who do you want to call?</div>
        ${shops.map((m) => `<button class="pc-shop" data-shop="${m.id}" style="--c:${m.theme.primary}"><span class="pc-shop-emoji">${m.emoji}</span><span>${esc(m.name)}</span><span class="pc-shop-call">📞</span></button>`).join("")}`;
      body.querySelectorAll(".pc-shop").forEach((b) => { b.onclick = () => dial(b.dataset.shop); });
    } else if (stage === "dialing") {
      const m = window.MENUS[callShop];
      body.innerHTML = `
        <div class="pc-avatar ringing" style="--c:${m.theme.primary}">${m.emoji}</div>
        <div class="pc-name">${esc(m.name)}</div>
        <div class="pc-sub">Calling…</div>
        <button class="pc-end" id="pc-end">📞 End</button>`;
      $("pc-end").onclick = hangUp;
    } else if (stage === "incall") {
      const m = window.MENUS[callShop];
      const pic = (it) => (window.Icons ? window.Icons.html(it.id, it.emoji) : esc(it.emoji));
      body.innerHTML = `
        <div class="pc-incall">
          <div class="pc-avatar small" style="--c:${m.theme.primary}">${m.emoji}</div>
          <div><div class="pc-name">${esc(m.name)}</div><div class="pc-sub"><span class="pc-live"></span> On the phone · <span id="pc-timer">0:00</span></div></div>
        </div>
        <div class="pc-controls">
          <button class="pc-mute${muted ? " on" : ""}" id="pc-mute">${muted ? "🎤 Unmute" : "🔇 Mute"}</button>
          <button class="pc-end" id="pc-end">📞 End</button>
        </div>
        <div class="pc-menu-title">📋 Menu — tell them what you'd like!</div>
        <div class="pc-menu">${m.categories.map((c) => `
          <div class="pc-cat">${esc(c.emoji)} ${esc(c.name)}</div>
          ${m.items.filter((i) => i.cat === c.id).map((i) => `<div class="pc-item"><span class="pc-pic">${pic(i)}</span><span class="pc-iname">${esc(i.name)}</span><span class="pc-price">${money(i.price)}</span></div>`).join("")}`).join("")}
        </div>`;
      $("pc-end").onclick = hangUp;
      $("pc-mute").onclick = toggleMute;
      clock();
    }
  }

  // --- Register (the restaurant) ---
  function incomingCall(msg) {
    if (isPhone() || !registerOpen()) return;              // only a register screen rings
    if (callState !== "idle") { tell("call-decline", { to: msg.pid }); return; }   // already on a call
    callState = "ringing";
    callPeer = msg.pid;
    callShop = msg.shopId;
    $("callin-sub").textContent = `Phone order · ${shopName(callShop)}`;
    $("callin").classList.remove("hidden");
    startRingLoop("ring");
  }
  async function answerCall() {
    if (callState !== "ringing") return;
    stopRingLoop();
    callState = "answering";
    $("callin-sub").textContent = "Connecting…";
    const ok = await ensureMic();
    if (!ok) { tell("call-decline", { to: callPeer }); endCall(); return; }
    if (ctx.state === "suspended") ctx.resume();
    tell("call-answer", { to: callPeer });
  }
  function dismissRing() {
    stopRingLoop();
    callState = "idle";
    callPeer = null;
    $("callin").classList.add("hidden");
  }

  // ---------- Wire up ----------
  function init() {
    if (!$("drive")) return;
    // On a phone, the start screen offers a phone call instead of the drive-thru speaker
    if (isPhone()) {
      $("btn-drive").textContent = "📞 Call Restaurant";
      $("btn-drive").onclick = openPhone;
    } else {
      $("btn-drive").onclick = openPost;
    }
    $("pc-back").onclick = closePhone;
    $("callin-answer").onclick = answerCall;
    $("callin-decline").onclick = () => { tell("call-decline", { to: callPeer }); dismissRing(); };
    $("callbar-mute").onclick = toggleMute;
    $("callbar-end").onclick = hangUp;
    $("drive-back").onclick = closePost;
    $("drive-car").onclick = () => { sound("honk"); tell("car"); setStatus("🚗 Beep beep! The cashier knows you're here."); };
    wireTalkButton($("drive-talk"));
    wireTalkButton($("intercom-talk"));

    if (window.Sync) {
      window.Sync.on("intercom", received);
      window.Sync.onCall(answer);
      // When the link (re)connects, tell the other iPad the speaker is open, and reopen our audio
      window.Sync.on("_linked", () => {
        if (isPost) tell("post-on");
        else tell("ping");
        renderRegister();
        if (sendStream) setTimeout(ensureCalls, 800);
        renderLink();
      });
      window.Sync.on("_unlinked", (m) => {
        delete calls[m.peerId];
        if (callState !== "idle" && m.peerId === callPeer) endCall("The call dropped.");
        if (window.Sync.linkedPeers().length === 0) postOnline = false;
        renderRegister();
        renderLink();
      });
    }
    // Let the register know when this iPad leaves the page
    window.addEventListener("pagehide", () => { if (isPost) tell("post-off"); });
    renderRegister();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { openPost, closePost, tellShop, openPhone, isPost: () => isPost, postOnline: () => postOnline, callState: () => callState };
})();
