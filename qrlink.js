// Kearns Café — link two iPads with QR codes (no internet or outside server needed).
//
// iPad 1 shows a QR code with its "how to reach me" details; iPad 2 scans it and shows
// a reply code; iPad 1 scans that. Then they talk directly over the home Wi-Fi.
// The connection looks just like a PeerJS one to sync.js and intercom.js, so tickets,
// cards, the bell, the drive-thru intercom and phone calls all work the same way.
// It ends when an iPad sleeps or the app closes; just scan the two codes again.

window.QRLink = (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const CHUNK = 16000;

  function waitForCandidates(pc, ms) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const done = () => { clearTimeout(t); pc.removeEventListener("icegatheringstatechange", check); resolve(); };
      const check = () => { if (pc.iceGatheringState === "complete") done(); };
      const t = setTimeout(done, ms);
      pc.addEventListener("icegatheringstatechange", check);
    });
  }

  // ---------- Squeeze the connection details into a small QR code ----------
  // Only the few parts that differ between devices are sent; the rest is rebuilt.
  function pack(kind, id, sdp) {
    const get = (re) => (sdp.match(re) || [])[1] || "";
    const fpm = sdp.match(/a=fingerprint:(\S+) ([0-9A-Fa-f:]+)/);
    if (!fpm) throw new Error("no fingerprint");
    const fpBytes = fpm[2].split(":").map((h) => String.fromCharCode(parseInt(h, 16))).join("");
    const cands = [];
    sdp.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host/i);
      if (m && cands.length < 6 && !cands.includes(m[1] + " " + m[2])) cands.push(m[1] + " " + m[2]);
    });
    return ["KLINK", "1", kind, id, get(/a=ice-ufrag:(\S+)/), get(/a=ice-pwd:(\S+)/),
      fpm[1] + "~" + btoa(fpBytes), get(/a=setup:(\S+)/), get(/a=mid:(\S+)/), cands.join(",")].join("|");
  }

  function unpack(text) {
    const p = String(text || "").split("|");
    if (p[0] !== "KLINK" || p[1] !== "1" || p.length < 10) return null;
    const [, , kind, id, ufrag, pwd, fp, setup, mid, cands] = p;
    try {
      const [algo, b64] = fp.split("~");
      const hex = Array.from(atob(b64)).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()).join(":");
      const lines = [
        "v=0", "o=- " + Math.floor(Math.random() * 1e9) + " 2 IN IP4 127.0.0.1", "s=-", "t=0 0",
        "a=group:BUNDLE " + mid, "a=msid-semantic: WMS",
        "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0",
      ];
      cands.split(",").filter(Boolean).forEach((c, i) => {
        const [addr, port] = c.split(" ");
        lines.push(`a=candidate:${i + 1} 1 udp ${2113937151 - i} ${addr} ${port} typ host generation 0`);
      });
      lines.push("a=ice-ufrag:" + ufrag, "a=ice-pwd:" + pwd, "a=ice-options:trickle",
        "a=fingerprint:" + algo + " " + hex, "a=setup:" + setup, "a=mid:" + mid,
        "a=sctp-port:5000", "a=max-message-size:262144");
      return { kind, id, sdp: lines.join("\r\n") + "\r\n" };
    } catch (e) { return null; }
  }

  // ---------- One direct link (looks like a PeerJS connection + peer) ----------
  function createLink() {
    const myId = "qr-" + Math.random().toString(36).slice(2, 10);
    const pc = new RTCPeerConnection({ iceServers: [] });
    const dc = pc.createDataChannel("kearns", { negotiated: true, id: 0, ordered: true });
    let closed = false;
    const parts = {};
    const calls = {};

    function emitter(obj) {
      const ev = {};
      obj.on = (t, fn) => { (ev[t] = ev[t] || []).push(fn); return obj; };
      obj.emit = (t, a) => (ev[t] || []).slice().forEach((fn) => { try { fn(a); } catch (e) { /* ignore */ } });
      return obj;
    }

    // The data connection sync.js uses
    const conn = emitter({ peer: null, open: false });
    conn.send = (obj) => {
      if (dc.readyState !== "open") return;
      const s = JSON.stringify(obj);
      if (s.length <= CHUNK) { dc.send(s); return; }
      const k = Math.random().toString(36).slice(2), n = Math.ceil(s.length / CHUNK);
      for (let i = 0; i < n; i++) dc.send(JSON.stringify({ __k: k, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) }));
    };
    conn.close = () => shutdown();
    const onOpen = conn.on;
    conn.on = (t, fn) => { onOpen(t, fn); if (t === "open" && conn.open) setTimeout(fn, 0); return conn; };

    dc.onopen = () => { conn.open = true; conn.emit("open"); };
    dc.onclose = () => shutdown();
    dc.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg && msg.__k) {
        const b = (parts[msg.__k] = parts[msg.__k] || []);
        b[msg.i] = msg.d;
        if (b.filter((x) => x !== undefined).length < msg.n) return;
        delete parts[msg.__k];
        try { msg = JSON.parse(b.join("")); } catch (err) { return; }
      }
      if (msg && typeof msg.type === "string" && msg.type.indexOf("_call") === 0) callMessage(msg);
      else conn.emit("data", msg);
    };
    let dropTimer = null;
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      clearTimeout(dropTimer);
      if (s === "failed" || s === "closed") shutdown();
      else if (s === "disconnected") dropTimer = setTimeout(() => { if (pc.connectionState !== "connected") shutdown(); }, 6000);
    };

    function shutdown() {
      if (closed) return;
      closed = true;
      clearTimeout(dropTimer);
      Object.keys(calls).forEach((cid) => calls[cid].close());
      try { dc.close(); } catch (e) { /* ignore */ }
      try { pc.close(); } catch (e) { /* ignore */ }
      const wasOpen = conn.open;
      conn.open = false;
      if (wasOpen) conn.emit("close");
      else conn.emit("error", new Error("closed"));
    }

    // ---------- Audio calls (intercom + pretend phone), set up over the data link ----------
    function makeCall(cid, remoteId) {
      const call = emitter({ peer: remoteId, open: false, cid, pc: null });
      call.close = () => {
        if (call.done) return;
        call.done = true;
        call.open = false;
        delete calls[cid];
        try { if (call.pc) call.pc.close(); } catch (e) { /* ignore */ }
        conn.send({ type: "_callend", cid });
        call.emit("close");
      };
      calls[cid] = call;
      return call;
    }
    function watchCall(call) {
      call.pc.onconnectionstatechange = () => {
        const s = call.pc.connectionState;
        if (s === "connected") call.open = true;
        if (s === "failed" || s === "closed") call.close();
      };
    }

    const peer = {
      id: myId,
      get open() { return !closed; },
      get destroyed() { return closed; },
      onIncomingCall: null,
      call(remoteId, stream) {
        const call = makeCall(Math.random().toString(36).slice(2), remoteId);
        call.open = true;   // counts as "in progress" so callers don't start a second one
        const cpc = (call.pc = new RTCPeerConnection({ iceServers: [] }));
        watchCall(call);
        stream.getTracks().forEach((t) => cpc.addTrack(t, stream));
        (async () => {
          await cpc.setLocalDescription(await cpc.createOffer());
          await waitForCandidates(cpc, 3000);
          conn.send({ type: "_call", cid: call.cid, from: myId, sdp: cpc.localDescription.sdp });
        })().catch(() => call.close());
        return call;
      },
      destroy: shutdown,
    };

    async function callMessage(msg) {
      const call = calls[msg.cid];
      if (msg.type === "_call") {
        const c = makeCall(msg.cid, msg.from);
        c.answer = () => {
          if (c.pc || c.done) return;   // only answer once
          const cpc = (c.pc = new RTCPeerConnection({ iceServers: [] }));
          watchCall(c);
          cpc.ontrack = (e) => c.emit("stream", e.streams[0] || new MediaStream([e.track]));
          (async () => {
            await cpc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
            await cpc.setLocalDescription(await cpc.createAnswer());
            await waitForCandidates(cpc, 3000);
            c.open = true;
            conn.send({ type: "_callans", cid: c.cid, sdp: cpc.localDescription.sdp });
          })().catch(() => c.close());
        };
        if (peer.onIncomingCall) peer.onIncomingCall(c);
      } else if (msg.type === "_callans" && call && call.pc) {
        call.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp }).catch(() => call.close());
      } else if (msg.type === "_callend" && call) {
        call.done = true;
        call.open = false;
        delete calls[msg.cid];
        try { if (call.pc) call.pc.close(); } catch (e) { /* ignore */ }
        call.emit("close");
      }
    }

    return {
      peer, conn, pc,
      // iPad 1: make the first code
      async makeOffer() {
        await pc.setLocalDescription(await pc.createOffer());
        await waitForCandidates(pc, 4000);
        return pack("o", myId, pc.localDescription.sdp);
      },
      // iPad 2: read the first code, make the reply code
      async acceptOffer(info) {
        conn.peer = info.id;
        await pc.setRemoteDescription({ type: "offer", sdp: info.sdp });
        await pc.setLocalDescription(await pc.createAnswer());
        await waitForCandidates(pc, 4000);
        return pack("a", myId, pc.localDescription.sdp);
      },
      // iPad 1: read the reply code
      async acceptAnswer(info) {
        conn.peer = info.id;
        await pc.setRemoteDescription({ type: "answer", sdp: info.sdp });
      },
      close: shutdown,
    };
  }

  // ---------- The popup ----------
  let link = null;
  let scanner = null;
  let waitTimer = null;

  function qrSvg(text) {
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }

  function stopScanner() { if (scanner) { scanner.stop(); scanner = null; } }

  function cleanup() {
    stopScanner();
    clearTimeout(waitTimer);
    // An unfinished link that sync.js never took over
    if (link && !link.taken) link.close();
    link = null;
  }

  function render(stage, extra) {
    const body = $("qrlink-body");
    if (!body) return;
    stopScanner();
    if (stage === "choose") {
      body.innerHTML = `
        <div class="sheet-sub">Both iPads need to be on the <b>same Wi-Fi</b>. No internet needed!</div>
        <div class="qrlink-choices">
          <button class="btn-primary qrlink-choice" id="qrlink-show"><span>1️⃣</span>Show a code<small>on the first iPad</small></button>
          <button class="btn-primary qrlink-choice" id="qrlink-scan"><span>2️⃣</span>Scan a code<small>on the second iPad</small></button>
        </div>
        ${extra ? `<div class="qrlink-msg">${extra}</div>` : ""}`;
      $("qrlink-show").onclick = startFirst;
      $("qrlink-scan").onclick = startSecond;
    } else if (stage === "busy") {
      body.innerHTML = `<div class="qrlink-msg">⏳ ${extra}</div>`;
    } else if (stage === "show-offer") {
      body.innerHTML = `
        <div class="sheet-sub"><b>Step 1:</b> On the other iPad tap <b>📷 Link with QR codes → 2️⃣ Scan a code</b> and point its camera here.</div>
        <div class="qrlink-code">${qrSvg(extra)}</div>
        <button class="btn-primary" id="qrlink-next">Next: scan their code 📷</button>`;
      $("qrlink-next").onclick = scanAnswer;
    } else if (stage === "show-answer") {
      body.innerHTML = `
        <div class="sheet-sub"><b>Step 2:</b> Now let the <b>first iPad</b> scan this code.</div>
        <div class="qrlink-code">${qrSvg(extra)}</div>
        <div class="qrlink-msg">🟡 Waiting for the first iPad…</div>`;
    } else if (stage === "scan") {
      body.innerHTML = `
        <div class="sheet-sub">${extra}</div>
        <div id="qrlink-scan-view" class="qrlink-scan"></div>
        <div id="qrlink-hint" class="qrlink-msg"></div>`;
    } else if (stage === "linked") {
      body.innerHTML = `<div class="qrlink-done">🟢 Linked!</div><div class="sheet-sub">Orders, cards, the bell and the intercom now go straight between the iPads.</div>`;
    }
  }

  function fail(why) {
    cleanup();
    render("choose", "😕 " + why);
  }

  function hint(text) { const h = $("qrlink-hint"); if (h) h.textContent = text; }

  function scanFor(kind, prompt, done) {
    render("scan", prompt);
    scanner = window.Scanner.open($("qrlink-scan-view"), (text) => {
      const info = unpack(text);
      if (!info) { hint("That's not a link code. Point the camera at the code on the other iPad."); return true; }
      if (info.kind !== kind) {
        hint(kind === "a" ? "That's this iPad's own kind of code. Scan the code on the second iPad." : "That's a reply code. Scan the code that says Step 1.");
        return true;
      }
      scanner = null;
      done(info);
      return false;
    });
  }

  // When the link opens, hand it to sync.js
  function handOver() {
    const l = link;
    l.conn.on("open", () => {
      if (link !== l) return;
      clearTimeout(waitTimer);
      l.taken = true;
      window.Sync.attachQr(l);
      render("linked");
      setTimeout(() => { if ($("qrlink-modal") && link === l) close(); }, 1800);
    });
  }

  async function startFirst() {
    cleanup();
    if (!window.RTCPeerConnection) { fail("This browser can't link directly."); return; }
    render("busy", "Making a code…");
    try {
      link = createLink();
      handOver();
      const l = link;
      const text = await l.makeOffer();
      if (link !== l) return;
      if (text.endsWith("|")) { fail("This iPad couldn't find the Wi-Fi. Check that Wi-Fi is on and try again."); return; }
      render("show-offer", text);
    } catch (e) { fail("Couldn't make a code. Try again."); }
  }

  function scanAnswer() {
    const l = link;
    scanFor("a", "<b>Step 3:</b> Point this camera at the code on the <b>second iPad</b>.", async (info) => {
      render("busy", "Linking…");
      try {
        await l.acceptAnswer(info);
        waitTimer = setTimeout(() => { if (link === l && !l.taken) fail("Couldn't link. Make sure both iPads are on the same Wi-Fi, then try again."); }, 20000);
      } catch (e) { fail("That code didn't work. Start over on both iPads."); }
    });
  }

  function startSecond() {
    cleanup();
    if (!window.RTCPeerConnection) { fail("This browser can't link directly."); return; }
    scanFor("o", "Point this camera at the code on the <b>first iPad</b>.", async (info) => {
      render("busy", "Making a reply code…");
      try {
        link = createLink();
        handOver();
        const l = link;
        const text = await l.acceptOffer(info);
        if (link !== l) return;
        render("show-answer", text);
        waitTimer = setTimeout(() => { if (link === l && !l.taken) fail("Didn't hear back. Start over on both iPads."); }, 120000);
      } catch (e) { fail("That code didn't work. Make a new one on the first iPad."); }
    });
  }

  function open() {
    cleanup();
    const lm = $("link-modal");
    if (lm) lm.classList.add("hidden");
    render("choose");
    $("qrlink-modal").classList.remove("hidden");
  }

  function close() {
    cleanup();
    $("qrlink-modal").classList.add("hidden");
  }

  function init() {
    const b = $("link-qr");
    if (b) b.onclick = open;
    const c = $("qrlink-close");
    if (c) c.onclick = close;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { open, close, _test: { pack, unpack, createLink } };
})();
