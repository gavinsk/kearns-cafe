// Kearns Café — sound effects, made with the Web Audio API (no sound files needed).
// Use: Sound.click(), Sound.beep(), Sound.approved(), Sound.chaChing(), Sound.ding(), Sound.buzz()

window.Sound = (function () {
  "use strict";

  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem("kearns.muted") === "true"; } catch (e) { /* ignore */ }

  // iPads only allow sound after the first touch, so create the audio engine then.
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // One tone: frequency (Hz), start delay (s), length (s), volume, wave shape
  function tone(freq, delay, length, volume, type) {
    const a = audio();
    if (!a || muted) return;
    const t = a.currentTime + delay;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  // A short burst of static (for the cash drawer sliding open)
  function noise(delay, length, volume) {
    const a = audio();
    if (!a || muted) return;
    const t = a.currentTime + delay;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * length), a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = a.createBufferSource();
    const gain = a.createGain();
    const filter = a.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2500;
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(filter).connect(gain).connect(a.destination);
    src.start(t);
  }

  return {
    unlock: audio,
    isMuted: () => muted,
    setMuted(m) {
      muted = m;
      try { localStorage.setItem("kearns.muted", String(m)); } catch (e) { /* ignore */ }
    },
    click()    { tone(1400, 0, 0.04, 0.08, "square"); },
    beep()     { tone(1900, 0, 0.14, 0.25, "sine"); },
    approved() { tone(1900, 0, 0.12, 0.25); tone(2500, 0.15, 0.25, 0.25); },
    buzz()     { tone(160, 0, 0.3, 0.2, "sawtooth"); },
    chaChing() {
      noise(0, 0.18, 0.5);                      // drawer slides
      tone(1318, 0.16, 0.7, 0.25, "triangle");  // bell
      tone(1760, 0.24, 0.9, 0.25, "triangle");
      tone(2637, 0.24, 0.6, 0.12, "sine");
    },
    ding() { tone(1568, 0, 1.2, 0.3); tone(2093, 0.02, 1.0, 0.15); },
    // Service-desk bell: "ding-ding"
    bell() {
      [0, 0.32].forEach((t) => {
        tone(2637, t, 1.1, 0.28, "triangle");
        tone(3951, t + 0.005, 0.7, 0.1, "sine");
        tone(5274, t + 0.01, 0.35, 0.05, "sine");
      });
    },
    pop()  { tone(600, 0, 0.08, 0.2, "sine"); tone(900, 0.05, 0.1, 0.18, "sine"); },
    yay()  { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.25, 0.2, "triangle")); },
  };
})();

// Every button makes a little click
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button:not(:disabled)")) window.Sound.click();
}, { passive: true });
