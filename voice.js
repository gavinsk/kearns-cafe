// Kearns Café — talking. Picks the best voice installed on the iPad.
//
// iPads can download much better "Enhanced" and "Premium" voices:
//   Settings → Accessibility → Read & Speak (or Spoken Content) → Voices → English
// This file finds them, uses the best one for announcements, and gives each
// Surprise Customer their own voice.

window.Voice = (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const synth = window.speechSynthesis;

  // Old novelty / robotic voices we never pick on purpose
  const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Kathy|Ralph|Deranged|Hysterical|Pipe Organ)$/i;
  // Voices we know are male or female, so Grandma doesn't get a deep voice
  const FEMALE = /^(Samantha|Ava|Allison|Susan|Zoe|Karen|Moira|Tessa|Fiona|Victoria|Nicky|Serena|Kate|Joelle|Noelle|Evelyn|Veena|Isha|Martha|Catherine|Shelley|Sandy|Flo|Grandma|Siri Female|Tina|Kathy)/i;
  const MALE = /^(Alex|Tom|Aaron|Daniel|Evan|Nathan|Oliver|Arthur|Gordon|Lee|Reed|Rocko|Eddy|Grandpa|Rishi|Jamie|Fred|Ralph|Albert|Siri Male|Junior)/i;

  let voices = [];
  let chosenURI = null;
  let mixVoices = true;
  let showDetails = false;   // parent view: what Safari actually reports for each voice
  try {
    chosenURI = localStorage.getItem("kearns.voice");
    mixVoices = localStorage.getItem("kearns.voiceMix") !== "0";
  } catch (e) { /* ignore */ }

  // ---------- Finding voices ----------
  function quality(v) {
    const id = (v.voiceURI + " " + v.name).toLowerCase();
    if (id.includes("premium")) return 3;
    if (id.includes("enhanced")) return 2;
    if (id.includes("eloquence")) return 0;        // the very robotic ones (Eddy, Flo, Grandpa…)
    if (NOVELTY.test(v.name)) return -1;
    return 1;
  }
  function shortName(v) {
    return v.name.replace(/\s*\((Premium|Enhanced|English.*?)\)\s*/gi, " ").trim();
  }
  function gender(v) {
    const n = shortName(v);
    if (FEMALE.test(n)) return "f";
    if (MALE.test(n)) return "m";
    return "x";
  }

  function load() {
    if (!synth) return;
    const all = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang) && quality(v) >= 0);
    // Best first; US English before other accents when the quality is the same
    all.sort((a, b) => quality(b) - quality(a) || usFirst(a) - usFirst(b) || a.name.localeCompare(b.name));
    voices = all;
    if (!$("voice-modal").classList.contains("hidden")) renderPicker();
  }
  function usFirst(v) { return /en[-_]US/i.test(v.lang) ? 0 : 1; }

  function main() {
    return voices.find((v) => v.voiceURI === chosenURI) || voices[0] || null;
  }
  function best() { return voices.length ? quality(voices[0]) : 0; }

  // A steady voice for each customer name (same customer always sounds the same)
  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function characterVoice(name, want) {
    if (!mixVoices || !voices.length) return main();
    const top = quality(voices[0]);
    // Use the good voices; only fall back to standard ones if that's all we have
    let pool = voices.filter((v) => quality(v) >= Math.min(top, 2));
    if (pool.length < 3) pool = voices.filter((v) => quality(v) >= 1);
    if (want && want !== "x") {
      const matching = pool.filter((v) => gender(v) === want);
      if (matching.length) pool = matching;
    }
    return pool[hash(name) % pool.length];
  }

  // ---------- Talking ----------
  // opts: { as: "Grandma Gertie", gender: "f", pitch: 1.1, rate: 0.9 }
  function speak(text, opts) {
    opts = opts || {};
    if (!synth || (window.Sound && window.Sound.isMuted())) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = opts.as ? characterVoice(opts.as, opts.gender) : main();
      if (v) { u.voice = v; u.lang = v.lang; }
      // A little variety per character, unless asked for something specific
      const h = opts.as ? hash(opts.as) : 0;
      u.pitch = opts.pitch || (opts.as ? 0.9 + (h % 5) * 0.06 : 1);
      u.rate = opts.rate || (opts.as ? 0.9 + (h % 3) * 0.04 : 0.95);
      synth.speak(u);
    } catch (e) { /* no voice available */ }
  }

  // ---------- Voice picker ----------
  const BADGE = { 3: "⭐ Premium", 2: "✨ Enhanced", 1: "Standard", 0: "Basic" };

  function renderPicker() {
    const list = $("voice-list");
    list.innerHTML = "";
    const current = main();
    if (!voices.length) {
      list.innerHTML = `<div class="voice-empty">No English voices found yet.</div>`;
    }
    voices.forEach((v) => {
      const row = document.createElement("div");
      row.className = "voice-row" + (current && v.voiceURI === current.voiceURI ? " on" : "");
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      row.innerHTML = `
        <span class="voice-name">${esc(shortName(v))}${showDetails ? `<small class="voice-uri">${esc(v.name)} · ${esc(v.voiceURI)}${v.localService ? "" : " · online"}</small>` : ""}</span>
        <span class="voice-badge q${quality(v)}">${BADGE[quality(v)]}</span>
        <span class="voice-lang">${v.lang}</span>`;
      const test = document.createElement("button");
      test.className = "btn-small";
      test.textContent = "▶";
      test.setAttribute("aria-label", "Test this voice");
      test.onclick = (e) => {
        e.stopPropagation();
        const u = new SpeechSynthesisUtterance("Welcome to Kearns Café! Order 12 is ready!");
        u.voice = v; u.lang = v.lang; u.rate = 0.95;
        synth.cancel(); synth.speak(u);
      };
      row.appendChild(test);
      row.onclick = () => {
        chosenURI = v.voiceURI;
        try { localStorage.setItem("kearns.voice", chosenURI); } catch (e) { /* ignore */ }
        renderPicker();
      };
      list.appendChild(row);
    });
    const more = document.createElement("button");
    more.className = "voice-details-btn";
    const total = synth ? synth.getVoices().length : 0;
    more.textContent = showDetails
      ? `🔍 Hide details · Safari shared ${total} voices (${voices.length} English shown)`
      : "🔍 Show voice details";
    more.onclick = () => { showDetails = !showDetails; renderPicker(); };
    list.appendChild(more);
    $("voice-tip").classList.toggle("hidden", best() >= 2);
    $("voice-mix").classList.toggle("on", mixVoices);
    $("voice-mix").textContent = mixVoices ? "🎭 Different voice for each customer: ON" : "🎭 Different voice for each customer: OFF";
  }

  function openPicker() {
    load();
    renderPicker();
    $("voice-modal").classList.remove("hidden");
  }

  function init() {
    if (synth) {
      load();
      // Safari fills the voice list in a moment after the page loads
      if ("onvoiceschanged" in synth) synth.addEventListener("voiceschanged", load);
      setTimeout(load, 500);
      setTimeout(load, 2000);
    }
    $("btn-voices").onclick = openPicker;
    $("voice-close").onclick = () => { $("voice-modal").classList.add("hidden"); };
    $("voice-mix").onclick = () => {
      mixVoices = !mixVoices;
      try { localStorage.setItem("kearns.voiceMix", mixVoices ? "1" : "0"); } catch (e) { /* ignore */ }
      renderPicker();
    };
    $("voice-demo").onclick = () => {
      const names = [["Grandma Gertie", "f"], ["Pirate Pete", "m"], ["Princess Sprinkles", "f"]];
      const [n, g] = names[Math.floor(Math.random() * names.length)];
      speak(`Hi, I'm ${n}! Can I please get a large iced coffee with cream?`, { as: n, gender: g });
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { speak, list: () => voices.slice(), main, quality };
})();
