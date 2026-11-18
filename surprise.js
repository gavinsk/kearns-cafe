// Kearns Café — Surprise Customer mode.
// The app plays the customer: it makes up an order, says it out loud, checks the
// cashier's work when they tap Charge, and then pays (tip, card or cash) by itself.

window.Surprise = (function () {
  "use strict";

  const LEVELS = {
    easy:   { label: "Easy",   lines: [1, 2], qty: [1, 2], options: "none", checkType: false, patience: 0,   hideWords: false },
    medium: { label: "Medium", lines: [2, 3], qty: [1, 2], options: "some", checkType: true,  patience: 240, hideWords: false },
    hard:   { label: "Hard",   lines: [3, 4], qty: [1, 3], options: "all",  checkType: true,  patience: 120, hideWords: true },
  };
  // [name, face, voice: "f" = higher voice, "m" = deeper voice, "x" = any, extra voice settings]
  const CUSTOMERS = [
    ["Captain Pancake", "🧔", "m"], ["Princess Sprinkles", "👸", "f"], ["Mr. Waffles", "👴", "m", { rate: 0.85 }],
    ["Dr. Noodle", "🧑‍⚕️", "x"], ["Grandma Gertie", "👵", "f", { rate: 0.85 }], ["Sir Fries-a-Lot", "🤴", "m"],
    ["Lady Lemonade", "👩‍🦰", "f"], ["Coach Crunch", "🧢", "x", { rate: 1.05 }], ["Professor Pickle", "🧑‍🏫", "x"],
    ["Astronaut Amy", "🧑‍🚀", "f"], ["Farmer Fred", "🧑‍🌾", "m"], ["Detective Donut", "🕵️", "x", { rate: 0.9 }],
    ["Robot 3000", "🤖", "x", { pitch: 0.6, rate: 0.85 }], ["Cowboy Carl", "🤠", "m", { rate: 0.88 }],
    ["Wizard Wally", "🧙", "m", { pitch: 0.8 }], ["Super Sam", "🦸", "x", { rate: 1.05 }],
    ["Baby Bear", "🐻", "x", { pitch: 1.5 }], ["Chef Charlie", "🧑‍🍳", "x"], ["Firefighter Fran", "🧑‍🚒", "f"],
    ["Pirate Pete", "🏴‍☠️", "m", { pitch: 0.8 }],
  ];
  const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five"];
  // Option groups that read best in front of the item name ("Spicy Chicken Sandwich")
  const ADJECTIVE_GROUPS = ["temp", "shake", "cone", "soda", "milkType", "bagel", "muffin", "chickenStyle"];
  // How some items sound when said out loud
  const SPOKEN = { "egg-sand": "Egg & Cheese Sandwich" };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const sound = (name) => { if (window.Sound && window.Sound[name]) window.Sound[name](); };
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  const between = ([a, b]) => a + rand(b - a + 1);
  const money = (c) => "$" + (c / 100).toFixed(2);

  let level = null;          // null = not playing
  let customer = null;       // { name, face, lines, type, sentence, arrived, mistakes }
  let score = { served: 0, perfect: 0, tips: 0 };
  let moodTimer = null;
  let peek = false;

  const R = () => window.Register;   // register helpers from app.js

  // ---------- Making up an order ----------
  function chooseOptions(item, shop) {
    const choices = R().defaultChoices(item);
    const mode = LEVELS[level].options;
    if (mode === "none") return choices;
    (item.options || []).forEach((gid) => {
      const g = shop.optionGroups[gid];
      if (g.type === "one") {
        if (mode === "all" || Math.random() < 0.6) choices[gid] = [pick(g.choices).name];
      } else if (mode === "all") {
        if (g.startAll) {
          // Leave off 0-2 toppings ("no pickles")
          const off = g.choices.map((c) => c.name).sort(() => Math.random() - 0.5).slice(0, rand(3));
          choices[gid] = g.choices.map((c) => c.name).filter((n) => !off.includes(n));
        } else {
          choices[gid] = g.choices.map((c) => c.name).sort(() => Math.random() - 0.5).slice(0, rand(3));
        }
      }
    });
    return choices;
  }

  function newCustomer() {
    const shop = R().getShop();
    const cfg = LEVELS[level];
    // Easy customers order plain things (items with no options) when possible
    let pool = shop.items;
    if (cfg.options === "none") {
      const plain = shop.items.filter((i) => !i.options || !i.options.length);
      if (plain.length >= 4) pool = plain;
    }
    const lines = [];
    const count = between(cfg.lines);
    for (let i = 0; i < count; i++) {
      const item = pick(pool);
      const choices = chooseOptions(item, shop);
      const qty = between(cfg.qty);
      const same = lines.find((l) => l.itemId === item.id && key(item, l.choices) === key(item, choices));
      if (same) same.qty += qty;
      else lines.push({ itemId: item.id, choices, qty });
    }
    const [name, face, voice, voiceOpts] = pick(CUSTOMERS);
    customer = {
      name, face, lines, voice, voiceOpts: voiceOpts || {},
      type: cfg.checkType ? pick(["For Here", "For Here", "To Go", "Drive-Thru"]) : "For Here",
      arrived: Date.now(),
      mistakes: 0,
    };
    customer.sentence = sentence(shop);
    peek = false;
    render();
    sound("ding");
    say(customer.sentence);
  }

  // ---------- Saying the order ----------
  function itemPhrase(line, shop) {
    const item = R().findItem(line.itemId);
    const adjectives = [];
    const withs = [];
    const nos = [];
    let meal = "";
    (item.options || []).forEach((gid) => {
      const g = shop.optionGroups[gid];
      const picked = line.choices[gid] || [];
      if (g.startAll) {
        g.choices.forEach((c) => { if (!picked.includes(c.name)) nos.push(c.name); });
      } else if (g.type === "one") {
        const n = picked[0];
        const isDefault = n === g.choices[0].name;
        if (gid === "meal") { if (!isDefault) meal = n.startsWith("Large") ? " as a large meal" : " as a meal"; }
        else if (/size/i.test(gid)) adjectives.push(n);                                  // "Large Iced Coffee"
        else if (ADJECTIVE_GROUPS.includes(gid)) { if (!isDefault) adjectives.push(n); } // "Chocolate Milkshake"
        else if (!isDefault) withs.push(n);                                              // "with Cream"
      } else {
        picked.forEach((n) => withs.push(n));
      }
    });
    let base = SPOKEN[item.id] || item.name;
    if (item.cat === "donuts" && !/donut/i.test(base)) base += " Donut";       // "Glazed Donut"
    let name = [...adjectives, base].join(" ");
    const isDozen = /^Dozen/.test(name);
    if (line.qty > 1 && !isDozen) name = plural(name);
    let count = line.qty === 1 ? (/^[AEIOU]/i.test(name) ? "an" : "a") : (NUMBER_WORDS[line.qty] || line.qty);
    // "Chicken Tenders", "10 Nuggets", "Onion Rings" → "an order of Chicken Tenders"
    if (line.qty === 1 && !isDozen && (/^\d/.test(name) || /s$/i.test(name))) count = "an order of";
    let text = `${count} ${name}${meal}`;
    if (withs.length) text += ` with ${listJoin(withs)}`;
    if (nos.length) text += `, no ${listJoin(nos)}`;
    return text;
  }

  // "Cookie" → "Cookies", "Sandwich" → "Sandwiches"; names like "10 Nuggets" become "orders of 10 Nuggets"
  function plural(name) {
    if (/^\d/.test(name) || /s$/i.test(name)) return "orders of " + name;
    if (/(ch|sh|x)$/i.test(name)) return name + "es";
    if (/[^aeiou]y$/i.test(name)) return name.slice(0, -1) + "ies";
    return name + "s";
  }

  function listJoin(arr) {
    if (arr.length <= 1) return arr.join("");
    return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
  }

  function sentence(shop) {
    const greet = pick(["Hi!", "Hello!", "Hey there!", "Good morning!"]);
    const ask = pick(["Can I please get", "I'd like", "Can I have"]);
    const items = customer.lines.map((l) => itemPhrase(l, shop));
    let s = `${greet} ${ask} ${listJoin(items)}${ask.startsWith("I'd") ? "." : "?"}`;
    if (LEVELS[level].checkType) {
      s += customer.type === "For Here" ? " That's for here." : customer.type === "To Go" ? " That's to go." : " I'm in the drive-thru.";
    }
    return s;
  }

  // Each customer talks in their own voice (see voice.js)
  function say(text) {
    if (!window.Voice || !customer) return;
    window.Voice.speak(text, { as: customer.name, gender: customer.voice, ...customer.voiceOpts });
  }

  // ---------- Mood (Medium & Hard customers get impatient) ----------
  function mood() {
    const limit = LEVELS[level].patience;
    if (!limit) return { emoji: "😀", tip: 20 };
    const used = (Date.now() - customer.arrived) / 1000 / limit + customer.mistakes * 0.15;
    if (used < 0.5) return { emoji: "😀", tip: pick([20, 25]) };
    if (used < 0.8) return { emoji: "🙂", tip: 15 };
    if (used < 1) return { emoji: "😐", tip: pick([15, 0]) };
    return { emoji: "😤", tip: 0 };
  }

  // ---------- Checking the cashier's order ----------
  function key(item, choices) {
    return item.id + "|" + (item.options || []).map((g) => (choices[g] || []).slice().sort().join("+")).join("|");
  }
  function units(lines) {
    const out = [];
    lines.forEach((l) => {
      const item = R().findItem(l.itemId);
      if (!item) return;
      for (let i = 0; i < l.qty; i++) out.push({ item, choices: l.choices, key: key(item, l.choices) });
    });
    return out;
  }

  function optionComplaint(want, got, shop) {
    const item = want.item;
    for (const gid of item.options || []) {
      const g = shop.optionGroups[gid];
      const w = want.choices[gid] || [];
      const h = got.choices[gid] || [];
      if (g.type === "one" && w[0] !== h[0]) return `My ${item.name} should be ${w[0]}, not ${h[0]}!`;
      const missing = w.filter((n) => !h.includes(n));
      const extra = h.filter((n) => !w.includes(n));
      if (g.startAll) {
        if (extra.length) return `I said NO ${extra[0]} on my ${item.name}!`;
        if (missing.length) return `Hey, I wanted ${missing[0]} on my ${item.name}!`;
      } else {
        if (missing.length) return `I asked for ${missing[0]} with my ${item.name}!`;
        if (extra.length) return `I didn't ask for ${extra[0]} with my ${item.name}!`;
      }
    }
    return `That's not quite my ${item.name}!`;
  }

  // Returns true if the order on the register matches what the customer asked for
  function checkOrder() {
    const shop = R().getShop();
    const reg = R().getOrder();
    const want = units(customer.lines);
    const have = units(reg.lines);
    // Take away everything that matches exactly
    for (let i = want.length - 1; i >= 0; i--) {
      const j = have.findIndex((u) => u.key === want[i].key);
      if (j >= 0) { have.splice(j, 1); want.splice(i, 1); }
    }
    const problems = [];
    want.forEach((w) => {
      const j = have.findIndex((u) => u.item.id === w.item.id);
      if (j >= 0) { problems.push(optionComplaint(w, have[j], shop)); have.splice(j, 1); }
      else problems.push(`You forgot my ${w.item.name}!`);
    });
    have.forEach((h) => problems.push(`I didn't order a ${h.item.name}!`));
    if (LEVELS[level].checkType && reg.type !== customer.type) problems.push(`I said ${customer.type}!`);

    if (!problems.length) {
      if (!customer.mistakes) score.perfect++;
      sound("yay");
      return true;
    }
    customer.mistakes++;
    sound("buzz");
    const unique = [...new Set(problems)].slice(0, 2);
    complain(unique.join(" "));
    say(unique.join(" "));
    return false;
  }

  function complain(text) {
    const bubble = $("sb-bubble");
    bubble.innerHTML = `<span class="sb-complaint">😕 ${esc(text)}</span>`;
    bubble.classList.add("shake");
    setTimeout(() => { bubble.classList.remove("shake"); renderBubble(); }, 4500);
  }

  // ---------- How the customer pays ----------
  // Breaks an amount into bills & coins, e.g. 2025 → "$20 bill, 1 quarter"
  function describeMoney(cents) {
    const parts = [];
    const denoms = [[10000, "$100 bill"], [5000, "$50 bill"], [2000, "$20 bill"], [1000, "$10 bill"], [500, "$5 bill"], [100, "$1 bill"], [25, "quarter"], [10, "dime"], [5, "nickel"], [1, "penny"]];
    let left = cents;
    denoms.forEach(([d, name]) => {
      const n = Math.floor(left / d);
      left -= n * d;
      if (n) parts.push(`${n} ${n > 1 ? (name === "penny" ? "pennies" : name + "s") : name}`);
    });
    return listJoin(parts);
  }

  // How much cash the customer hands over for a total (worked out after they pick a tip).
  // Usually rounded up to a handy bill; Hard customers sometimes add coins so the change is even.
  function cashFor(totalCents) {
    const bills = [100, 500, 1000, 2000, 5000, 10000];
    const nextDollar = Math.ceil(totalCents / 100) * 100;
    const options = [];
    bills.forEach((b) => { const amt = Math.ceil(totalCents / b) * b; if (amt >= totalCents && !options.includes(amt)) options.push(amt); });
    let given = level === "easy"
      ? (options.find((a) => a % 500 === 0) || nextDollar)
      : pick(options.slice(0, 4));
    if (level === "hard" && totalCents % 100 && Math.random() < 0.4) {
      const bill = options.find((a) => a > totalCents && a % 500 === 0) || nextDollar + 500;
      given = bill - Math.floor(totalCents / 100) * 100 >= 100 ? bill + (totalCents % 100) : given;
    }
    return given >= totalCents ? given : nextDollar;
  }

  function payPlan() {
    const m = mood();
    const lvl = level;
    return {
      name: customer.name,
      face: customer.face,
      mood: m.emoji,
      tipPct: m.tip,
      method: Math.random() < 0.45 ? "card" : "cash",
      cashFor: (total) => { const saved = level; level = lvl; const g = cashFor(total); level = saved; return g; },
      describeMoney,
      receipt: pick(["none", "none", "print", "text", "email"]),
    };
  }

  // ---------- After the customer leaves ----------
  function served(payment) {
    score.served++;
    score.tips += payment.tip || 0;
    customer = null;
    renderScore();
    setTimeout(() => { if (level) newCustomer(); }, 900);
  }

  // ---------- Drawing ----------
  function render() {
    const bar = $("surprise-bar");
    bar.classList.toggle("hidden", !level);
    $("btn-surprise").classList.toggle("on", !!level);
    if (!level || !customer) return;
    $("sb-face").textContent = customer.face;
    $("sb-name").innerHTML = `${esc(customer.name)} <span class="sb-level">${LEVELS[level].label}</span>`;
    $("sb-peek").classList.toggle("hidden", !LEVELS[level].hideWords);
    $("sb-peek").textContent = peek ? "🙈 Hide" : "👀 Peek";
    renderBubble();
    renderMood();
    renderScore();
  }

  function renderBubble() {
    if (!customer) return;
    const hidden = LEVELS[level].hideWords && !peek;
    $("sb-bubble").innerHTML = hidden
      ? `<span class="sb-hidden">🎧 Listen carefully! Tap 🔊 to hear it again.</span>`
      : esc(customer.sentence);
  }

  function renderMood() {
    if (!level || !customer) return;
    $("sb-mood").textContent = mood().emoji;
  }

  function renderScore() {
    $("sb-score").textContent = `😀 ${score.served} served · ⭐ ${score.perfect} perfect · 💰 ${money(score.tips)} tips`;
  }

  // ---------- Start / stop ----------
  function start(lvl) {
    level = lvl;
    score = { served: 0, perfect: 0, tips: 0 };
    $("surprise-modal").classList.add("hidden");
    R().clearOrder();
    clearInterval(moodTimer);
    moodTimer = setInterval(renderMood, 5000);
    newCustomer();
  }

  function stop() {
    level = null;
    customer = null;
    clearInterval(moodTimer);
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    $("surprise-modal").classList.add("hidden");
    render();
  }

  function openModal() {
    $("surprise-stop").classList.toggle("hidden", !level);
    $("surprise-modal-score").textContent = level ? `This round: ${$("sb-score").textContent}` : "";
    $("surprise-modal").classList.remove("hidden");
  }

  function init() {
    $("btn-surprise").onclick = openModal;
    document.querySelectorAll("#surprise-levels [data-level]").forEach((b) => { b.onclick = () => start(b.dataset.level); });
    $("surprise-close").onclick = () => $("surprise-modal").classList.add("hidden");
    $("surprise-stop").onclick = stop;
    $("sb-say").onclick = () => { if (customer) say(customer.sentence); };
    $("sb-peek").onclick = () => { peek = !peek; render(); };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    active: () => !!(level && customer),
    playing: () => !!level,
    checkOrder,
    payPlan,
    served,
    stop,
    customerName: () => (customer ? customer.name : ""),
    _describeMoney: describeMoney,
    _customer: () => customer,
  };
})();
