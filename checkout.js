// Kearns Café — Square-style checkout.
// The register calls Checkout.start({...}) and gets the payment back in onDone(payment).
// All money in this file is in whole cents (e.g. 847 = $8.47) so the math is always exact.

window.Checkout = (function () {
  "use strict";

  // ---------- Settings ----------
  const TIP_PERCENTS = [15, 20, 25];
  // Change practice: the cashier figures out the change before the app shows it.
  // Switched on/off from the cash screen; remembered on this iPad (on unless turned off).
  function changePractice() {
    try { return localStorage.getItem("kearns.changePractice") !== "0"; } catch (e) { return true; }
  }
  function setChangePractice(on) {
    try { localStorage.setItem("kearns.changePractice", on ? "1" : "0"); } catch (e) { /* ignore */ }
  }
  const BILLS = [10000, 5000, 2000, 1000, 500, 100];
  const COINS = [25, 10, 5, 1];
  const COIN_NAMES = { 25: "Quarter", 10: "Dime", 5: "Nickel", 1: "Penny" };
  const CARD_BRANDS = ["Visa", "Mastercard", "Discover", "Kearns Card"];

  const $ = (id) => document.getElementById(id);
  const money = (c) => (c < 0 ? "-" : "") + "$" + (Math.abs(c) / 100).toFixed(2);
  const sound = (name) => { if (window.Sound) window.Sound[name](); };

  let o = null;     // the order being paid for (from the register)
  let pay = null;   // payment details being collected
  let timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---------- Start / finish ----------
  function start(order) {
    o = order;
    pay = { method: null, tip: 0, tendered: 0, change: 0, card: null, receipt: null };
    $("pay-shop").textContent = `${o.shop.emoji} ${o.shop.name}`;
    $("pay-who").textContent = `Order #${o.number}` + (o.name ? ` · ${o.name}` : "");
    renderSummary();
    $("pay").classList.remove("hidden");
    show("tip");
  }

  function close() {
    clearTimers();
    stopScanner();
    $("pay").classList.add("hidden");
  }

  function total() { return o.subtotal + o.tax + pay.tip; }

  // ---------- Order summary (left side) ----------
  function renderSummary() {
    $("pay-lines").innerHTML = o.lines.map((l) => `
      <li>
        <span class="pl-emoji">${l.emoji}</span>
        <span class="pl-main"><b>${l.qty > 1 ? l.qty + " × " : ""}${l.name}</b>${l.mods ? `<small>${l.mods}</small>` : ""}</span>
        <span class="pl-price">${money(l.amount)}</span>
      </li>`).join("");
    $("pay-totals").innerHTML = `
      <div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      <div><span>Tax</span><span>${money(o.tax)}</span></div>
      ${pay.tip ? `<div><span>Tip</span><span>${money(pay.tip)}</span></div>` : ""}
      <div class="pt-total"><span>Total</span><span>${money(total())}</span></div>`;
  }

  // ---------- Steps ----------
  // who: "customer" or "cashier" — changes the look so kids know whose turn it is
  const STEPS = {
    tip:          { who: "customer", render: renderTip },
    method:       { who: "customer", render: renderMethod },
    card:         { who: "customer", render: renderCard },
    scan:         { who: "customer", render: renderScan },
    cashHandoff:  { who: "customer", render: renderCashHandoff },
    cashTender:   { who: "cashier",  render: renderCashTender },
    cashChange:   { who: "cashier",  render: renderCashChange },
    receipt:      { who: "customer", render: renderReceiptChoice },
    thanks:       { who: "customer", render: renderThanks },
  };

  function show(step) {
    clearTimers();
    stopScanner();
    const s = STEPS[step];
    const el = $("pay");
    el.classList.toggle("is-cashier", s.who === "cashier");
    $("pay-role").textContent = s.who === "cashier" ? "🧑‍💼 Cashier"
      : o.auto ? `${o.auto.face} ${o.auto.name}` : "🙂 Customer";
    $("pay-cancel").classList.toggle("hidden", step === "thanks" || step === "receipt");
    const stage = $("pay-stage");
    stage.innerHTML = "";
    stage.className = "pay-stage step-" + step;
    s.render(stage);
    if (o.auto) autoPlay(step, stage);
  }

  function button(label, cls, onClick) {
    const b = document.createElement("button");
    b.className = cls;
    b.innerHTML = label;
    b.onclick = onClick;
    return b;
  }

  function h(html) {
    const d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  // Step 1: tip
  function renderTip(stage) {
    stage.appendChild(h(`<div class="pay-title">Add a tip?</div>`));
    stage.appendChild(h(`<div class="pay-sub">Thanks for visiting ${o.shop.name}!</div>`));
    const grid = h(`<div class="tip-grid"></div>`);
    TIP_PERCENTS.forEach((pct) => {
      const amt = Math.round(o.subtotal * pct / 100);
      grid.appendChild(button(`<span class="tip-pct">${pct}%</span><span class="tip-amt">${money(amt)}</span>`, "tip-btn", () => {
        pay.tip = amt; renderSummary(); show("method");
      }));
    });
    grid.appendChild(button(`<span class="tip-pct">No Tip</span>`, "tip-btn tip-none", () => {
      pay.tip = 0; renderSummary(); show("method");
    }));
    stage.appendChild(grid);
  }

  // Step 2: card or cash
  function renderMethod(stage) {
    stage.appendChild(h(`<div class="pay-title">Total</div>`));
    stage.appendChild(h(`<div class="pay-big">${money(total())}</div>`));
    stage.appendChild(h(`<div class="pay-sub">How would you like to pay?</div>`));
    const row = h(`<div class="method-row"></div>`);
    row.appendChild(button(`<span class="m-emoji">💳</span>Card or Phone`, "method-btn", () => show("card")));
    row.appendChild(button(`<span class="m-emoji">💵</span>Cash`, "method-btn", () => show("cashHandoff")));
    stage.appendChild(row);
    stage.appendChild(button("← Change tip", "pay-link", () => show("tip")));
  }

  // Step 3a: tap (pretend card) or scan a printed Kearns card
  function renderCard(stage) {
    stage.appendChild(h(`<div class="pay-big">${money(total())}</div>`));
    const zone = h(`
      <button class="tap-zone">
        <span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span>
        <span class="tap-icon">)))</span>
      </button>`);
    stage.appendChild(zone);
    const msg = h(`<div class="pay-sub">Tap your card or phone here</div>`);
    stage.appendChild(msg);
    const row = h(`<div class="method-row"></div>`);
    if (window.Scanner && window.Cards) {
      row.appendChild(button("📷 Scan My Card", "pay-secondary", () => show("scan")));
    }
    stage.appendChild(row);
    const back = button("← Pay another way", "pay-link", () => show("method"));
    stage.appendChild(back);

    zone.onclick = () => {
      if (zone.dataset.busy) return;
      zone.dataset.busy = "1";
      row.classList.add("hidden");
      back.classList.add("hidden");
      processCard(stage, zone, msg, null);
    };
  }

  // Step 3a-2: camera scanner
  let scanner = null;
  function stopScanner() {
    if (scanner) { scanner.stop(); scanner = null; }
  }

  function renderScan(stage) {
    stage.appendChild(h(`<div class="pay-title">Hold your card up to the camera</div>`));
    const view = h(`<div class="scan-wrap"></div>`);
    stage.appendChild(view);
    const msg = h(`<div class="pay-sub">Show the QR code on your Kearns card</div>`);
    stage.appendChild(msg);
    stage.appendChild(button("← Back", "pay-link", () => show("card")));

    scanner = window.Scanner.open(view, (text) => {
      const card = window.Cards.fromScan(text);
      if (!card) {
        sound("buzz");
        msg.innerHTML = `<span class="bad-text">That's not a Kearns card. Try again!</span>`;
        return true;
      }
      scanner = null;
      stage.innerHTML = "";
      stage.className = "pay-stage step-card";
      stage.appendChild(h(`<div class="pay-big">${money(total())}</div>`));
      const zone = h(`<div class="tap-zone"><span class="tap-icon">💳</span></div>`);
      stage.appendChild(zone);
      const m = h(`<div class="pay-sub"></div>`);
      stage.appendChild(m);
      processCard(stage, zone, m, card);
      return false;
    });
  }

  // Shared by tap & scan. card = a saved Kearns card, or null for a pretend tap
  function processCard(stage, zone, msg, card) {
    sound("beep");
    zone.classList.add("processing");
    msg.innerHTML = `<span class="spinner"></span> Processing…`;
    later(() => {
      zone.classList.remove("processing");

      if (card) {
        const result = window.Cards.charge(card.id, total());
        if (!result.ok) {
          sound("buzz");
          zone.classList.add("declined");
          zone.innerHTML = `<span class="tap-check">✕</span>`;
          msg.innerHTML = `<b class="bad-text">Declined</b><br>Not enough money on this gift card.<br>Balance: ${money(result.balance)}`;
          const row = h(`<div class="method-row"></div>`);
          row.appendChild(button("Try another card", "pay-secondary", () => show("card")));
          row.appendChild(button("💵 Pay with cash", "pay-secondary", () => show("cashHandoff")));
          stage.appendChild(row);
          return;
        }
        const star = window.Cards.addStar(card.id);
        pay.card = {
          id: card.id,
          name: card.name,
          brand: card.type === "gift" ? "Kearns Gift" : "Kearns Card",
          last4: card.last4,
          gift: card.type === "gift",
          balance: result.balance,
          stars: star.stars,
          reward: star.reward,
        };
      } else {
        pay.card = {
          brand: CARD_BRANDS[Math.floor(Math.random() * CARD_BRANDS.length)],
          last4: String(1000 + Math.floor(Math.random() * 9000)),
        };
      }

      pay.method = "card";
      sound("approved");
      zone.classList.add("approved");
      zone.innerHTML = `<span class="tap-check">✓</span>`;
      const c = pay.card;
      let html = `<b>Approved</b><br>${c.name && !/gift card/i.test(c.name) ? esc(c.name) + " · " : ""}${c.brand} •••• ${c.last4}`;
      if (c.gift) html += `<br>Balance left: <b>${money(c.balance)}</b>`;
      if (c.id) {
        html += c.reward
          ? `<div class="reward">🎁 You earned a FREE TREAT!<br><small>Ask the cashier for your treat</small></div>`
          : `<div class="stars">${starRow(c.stars)}<br><small>+1 star! ${c.stars} of ${window.Cards.STARS_FOR_REWARD}</small></div>`;
      }
      msg.innerHTML = html;
      if (c.reward) later(() => sound("yay"), 600);
      later(() => show("receipt"), c.id ? 3500 : 1500);
    }, 1600);
  }

  function starRow(n) {
    let s = "";
    for (let i = 0; i < window.Cards.STARS_FOR_REWARD; i++) s += i < n ? "⭐" : "☆";
    return s;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  // Step 3b: cash — hand the iPad back to the cashier
  function renderCashHandoff(stage) {
    stage.appendChild(h(`<div class="pay-emoji">💵</div>`));
    stage.appendChild(h(`<div class="pay-title">Paying with cash</div>`));
    stage.appendChild(h(`<div class="pay-sub">Please hand the iPad back to the cashier<br>and give them your money.</div>`));
    stage.appendChild(button("I'm the cashier →", "pay-primary", () => show("cashTender")));
    stage.appendChild(button("← Pay another way", "pay-link", () => show("method")));
  }

  // Step 4: cashier counts the money the customer gave
  function renderCashTender(stage) {
    const due = total();
    const auto = o.auto;
    if (auto && !auto.given) auto.given = auto.cashFor(due);
    if (auto) {
      stage.appendChild(h(`<div class="auto-given">${auto.face} ${esc(auto.name)} hands you: <b>${esc(auto.describeMoney(auto.given))}</b></div>`));
    }
    stage.appendChild(h(`<div class="due-row"><span>Total due</span><b>${money(due)}</b></div>`));
    const given = h(`<div class="given"><span>Customer gave</span><b id="given-amt">$0.00</b><small id="given-note"></small></div>`);
    stage.appendChild(given);

    const money_ = h(`<div class="cash-pad"></div>`);
    BILLS.forEach((c) => money_.appendChild(button(`$${c / 100}`, "bill", () => add(c))));
    COINS.forEach((c) => money_.appendChild(button(`${c}¢`, "coin coin-" + c, () => add(c))));
    stage.appendChild(money_);

    const row = h(`<div class="cash-actions"></div>`);
    row.appendChild(button("Clear", "pay-secondary", () => { pay.tendered = 0; update(); }));
    if (!auto) row.appendChild(button("Exact amount", "pay-secondary", () => { pay.tendered = due; update(); }));
    const open = button("Open Drawer 💰", "pay-primary", () => {
      pay.method = "cash";
      pay.change = pay.tendered - due;
      sound("chaChing");
      show("cashChange");
    });
    row.appendChild(open);
    stage.appendChild(row);
    const practice = button("", "practice-toggle", () => {
      setChangePractice(!changePractice());
      labelPractice();
    });
    const labelPractice = () => {
      const on = changePractice();
      practice.textContent = `🧮 Figure out the change myself: ${on ? "ON" : "OFF"}`;
      practice.classList.toggle("on", on);
    };
    labelPractice();
    stage.appendChild(practice);
    stage.appendChild(button("← Back", "pay-link", () => { pay.tendered = 0; show("method"); }));

    function add(c) { pay.tendered += c; update(); }
    function update() {
      $("given-amt").textContent = money(pay.tendered);
      const short = due - pay.tendered;
      $("given-note").textContent = pay.tendered === 0 ? "Tap the bills and coins they gave you" :
        short > 0 ? `Still need ${money(short)} more` : "That's enough!";
      $("given-note").className = short > 0 ? "" : "ok";
      open.disabled = short > 0;
      if (auto) {
        // Must match what the pretend customer actually handed over
        const right = pay.tendered === auto.given;
        $("given-note").textContent = pay.tendered === 0 ? "Tap the bills and coins they gave you"
          : right ? "That's what they gave you!" : pay.tendered > auto.given ? "Too much! Check what they handed you." : "Keep counting…";
        $("given-note").className = right ? "ok" : "";
        open.disabled = !right;
      }
    }
    update();
  }

  // Step 5: figure out the change
  function renderCashChange(stage) {
    const change = pay.change;
    if (change === 0) {
      stage.appendChild(h(`<div class="pay-emoji">🎉</div>`));
      stage.appendChild(h(`<div class="pay-title">Exact change!</div>`));
      stage.appendChild(h(`<div class="pay-sub">No change needed. Close the drawer.</div>`));
      stage.appendChild(button("Turn to customer →", "pay-primary", () => show("receipt")));
      return;
    }

    const showAnswer = () => {
      stage.innerHTML = "";
      stage.appendChild(h(`<div class="pay-title">Give back <span class="hl">${money(change)}</span></div>`));
      stage.appendChild(changeBreakdown(change));
      stage.appendChild(button("Change given · Turn to customer →", "pay-primary", () => show("receipt")));
    };

    if (!changePractice()) { showAnswer(); return; }

    let typed = 0;
    let misses = 0;
    stage.appendChild(h(`<div class="pay-title">How much change?</div>`));
    stage.appendChild(h(`<div class="math">${money(pay.tendered)} − ${money(total())} = ?</div>`));
    const display = h(`<div class="keypad-display">$0.00</div>`);
    stage.appendChild(display);
    const feedback = h(`<div class="feedback"></div>`);
    stage.appendChild(feedback);

    const pad = h(`<div class="keypad"></div>`);
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].forEach((k) => {
      pad.appendChild(button(k, "key" + (/\d/.test(k) ? "" : " key-fn"), () => {
        if (k === "C") typed = 0;
        else if (k === "⌫") typed = Math.floor(typed / 10);
        else if (typed < 100000) typed = typed * 10 + Number(k);
        display.textContent = money(typed);
        feedback.textContent = "";
      }));
    });
    stage.appendChild(pad);

    const row = h(`<div class="cash-actions"></div>`);
    const hint = button("Show me", "pay-secondary hidden", showAnswer);
    row.appendChild(hint);
    row.appendChild(button("Check ✓", "pay-primary", () => {
      if (typed === change) {
        sound("yay");
        feedback.className = "feedback ok";
        feedback.textContent = "Correct! Great job! 🎉";
        later(showAnswer, 1200);
      } else {
        sound("buzz");
        misses++;
        feedback.className = "feedback bad";
        feedback.textContent = typed > change ? "Too much! Try again." : "Not enough! Try again.";
        if (misses >= 2) hint.classList.remove("hidden");
      }
    }));
    stage.appendChild(row);
    stage.appendChild(button("Turn off change practice", "pay-link", () => { setChangePractice(false); showAnswer(); }));
  }

  // Which bills and coins to hand back, fewest pieces first
  function changeBreakdown(cents) {
    const wrap = h(`<div class="breakdown"></div>`);
    let left = cents;
    BILLS.concat(COINS).forEach((d) => {
      const n = Math.floor(left / d);
      left -= n * d;
      if (!n) return;
      const isBill = d >= 100;
      const piece = isBill
        ? `<span class="bill-pic">$${d / 100}</span>`
        : `<span class="coin-pic coin-${d}">${d}¢</span>`;
      let label = isBill ? `$${d / 100} bill` : COIN_NAMES[d];
      if (n > 1) label = d === 1 ? "Pennies" : label + "s";
      wrap.appendChild(h(`<div class="bd-row"><span class="bd-n">${n} ×</span>${piece}<span class="bd-label">${label}</span></div>`));
    });
    return wrap;
  }

  // Step 6: receipt?
  function renderReceiptChoice(stage) {
    stage.appendChild(h(`<div class="pay-emoji">🧾</div>`));
    stage.appendChild(h(`<div class="pay-title">Would you like a receipt?</div>`));
    const grid = h(`<div class="receipt-grid"></div>`);
    const sent = (how) => {
      pay.receipt = how;
      stage.innerHTML = "";
      stage.appendChild(h(`<div class="pay-emoji">📨</div>`));
      stage.appendChild(h(`<div class="pay-title">Receipt sent by ${how}!</div>`));
      later(() => show("thanks"), 1400);
    };
    grid.appendChild(button("🖨️<br>Print", "receipt-btn", () => { pay.receipt = "print"; printReceipt(stage); }));
    grid.appendChild(button("📱<br>Text", "receipt-btn", () => sent("text")));
    grid.appendChild(button("✉️<br>Email", "receipt-btn", () => sent("email")));
    grid.appendChild(button("🚫<br>No receipt", "receipt-btn", () => { pay.receipt = "none"; show("thanks"); }));
    stage.appendChild(grid);
  }

  function printReceipt(stage) {
    stage.innerHTML = "";
    const now = new Date();
    const lines = o.lines.map((l) => `
      <div class="r-line"><span>${l.qty} ${l.name}</span><span>${money(l.amount)}</span></div>
      ${l.mods ? `<div class="r-mods">${l.mods}</div>` : ""}`).join("");
    const c = pay.card || {};
    const payment = pay.method === "card"
      ? `<div class="r-line"><span>${c.brand} •••• ${c.last4}</span><span>${money(total())}</span></div>
         <div class="r-mods">APPROVED${c.name ? " · " + esc(c.name.toUpperCase()) : ""}</div>
         ${c.gift ? `<div class="r-line"><span>Gift card balance</span><span>${money(c.balance)}</span></div>` : ""}
         ${c.id ? `<div class="r-center">${c.reward ? "🎁 FREE TREAT EARNED!" : `⭐ STARS: ${c.stars} OF ${window.Cards.STARS_FOR_REWARD}`}</div>` : ""}`
      : `<div class="r-line"><span>Cash</span><span>${money(pay.tendered)}</span></div><div class="r-line"><span>Change</span><span>${money(pay.change)}</span></div>`;
    const paper = h(`
      <div class="paper-wrap"><div class="paper">
        <div class="r-shop">${o.shop.emoji} ${o.shop.name.toUpperCase()}</div>
        <div class="r-center">${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
        <div class="r-center">ORDER #${o.number} · ${o.type.toUpperCase()}${o.name ? "<br>" + esc(o.name.toUpperCase()) : ""}</div>
        <div class="r-rule"></div>
        ${lines}
        <div class="r-rule"></div>
        <div class="r-line"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
        <div class="r-line"><span>Tax</span><span>${money(o.tax)}</span></div>
        ${pay.tip ? `<div class="r-line"><span>Tip</span><span>${money(pay.tip)}</span></div>` : ""}
        <div class="r-line r-total"><span>TOTAL</span><span>${money(total())}</span></div>
        <div class="r-rule"></div>
        ${payment}
        <div class="r-rule"></div>
        <div class="r-center">THANK YOU!<br>COME AGAIN SOON</div>
      </div></div>`);
    stage.appendChild(paper);
    stage.appendChild(button("Done ✓", "pay-primary", () => show("thanks")));
    if (o.auto) later(() => show("thanks"), 3500);
  }

  // Step 7: thank you
  function renderThanks(stage) {
    sound("ding");
    stage.appendChild(h(`<div class="pay-emoji">${o.shop.emoji}</div>`));
    stage.appendChild(h(`<div class="pay-title">Thank you${o.name ? ", " + esc(o.name) : ""}!</div>`));
    stage.appendChild(h(`<div class="pay-sub">Your order number is</div>`));
    stage.appendChild(h(`<div class="pay-big order-big">#${o.number}</div>`));
    stage.appendChild(button("Next Customer →", "pay-primary", () => {
      const result = { ...pay, total: total() };
      const cb = o.onDone;
      close();
      cb(result);
    }));
  }

  // ---------- Pretend customer (Surprise Customer mode) ----------
  // Taps the customer's buttons after a short "thinking" pause
  function autoPlay(step, stage) {
    const a = o.auto;
    const tap = (selector, text, ms) => later(() => {
      const b = [...stage.querySelectorAll(selector)].find((el) => el.textContent.includes(text));
      if (b) { b.classList.add("auto-pick"); later(() => b.click(), 450); }
    }, ms);
    if (step === "tip") tap(".tip-btn", a.tipPct ? a.tipPct + "%" : "No Tip", 1600);
    if (step === "method") tap(".method-btn", a.method === "card" ? "Card" : "Cash", 1400);
    if (step === "card") later(() => { const z = stage.querySelector(".tap-zone"); if (z) z.click(); }, 1500);
    if (step === "cashHandoff") tap(".pay-primary", "cashier", 1800);
    if (step === "receipt") {
      const label = { print: "Print", text: "Text", email: "Email", none: "No receipt" }[a.receipt];
      tap(".receipt-btn", label, 1500);
    }
  }

  // ---------- Cancel ----------
  function wireCancel() {
    $("pay-cancel").onclick = () => {
      if (pay.method && !confirm("Payment is done. Cancel anyway?")) return;
      const cb = o.onCancel;
      close();
      if (cb) cb();
    };
  }

  document.addEventListener("DOMContentLoaded", wireCancel);
  if (document.readyState !== "loading") wireCancel();

  return { start, changeBreakdown, _money: money };
})();
