# Kearns Café 🍩🍔

A pretend cash register for playing restaurant on an iPad.
Two shops: **Kearns Donut Co.** and **Kearns Burger Barn**.

## Try it on the Mac
Double-click `index.html` to open it in Safari or Chrome.

## Put it on GitHub Pages
1. On github.com, create a new **public** repository, e.g. `kearns-cafe`.
2. Upload all the files in this folder (keep the `menus` and `icons` folders).
3. In the repo: **Settings → Pages → Source: Deploy from a branch → `main` / root → Save**.
4. After a minute it's live at `https://YOUR-USERNAME.github.io/kearns-cafe/`.

## Add it to the iPad home screen
1. Open the link in **Safari** on the iPad.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the new icon. It runs full-screen and works without internet.

## Changing the menu
Edit `menus/donuts.js` or `menus/burgers.js`. Each item is one line:

```js
{ id: "glazed", cat: "donuts", name: "Glazed", emoji: "🍩", price: 1.49 },
```

- `id` must be unique, `cat` must match a category id.
- `options: ["size", "milk"]` makes it ask questions, using the option groups at the bottom of the file.

Tax rate and the quick-pick customer names are at the top of `app.js`.

**Item pictures:** every item has a cartoon icon drawn in code in `icons.js`, matched by the item's `id`.
A new item without a recipe there just shows its `emoji` until one is added.

## Printable menus
Open `menu.html` (the **🖨️ Menus** button on the start screen) and print, or use `Kearns-Cafe-Menus.pdf`.
The menu page is built from the same menu files as the register, so it always matches.

## Surprise Customers
Tap **🎲** on the register and pick **Easy**, **Medium**, or **Hard**. A pretend customer walks up and says
their order out loud (🔊 to repeat; on Hard the words stay hidden unless you tap 👀 Peek). Ring it up and tap
Charge — a right order earns points (Easy +10, Medium +20, Hard +30); a wrong one loses points (−5/−10/−15)
and the customer grumbles but still pays. They tip and pay on their own;
for cash, tap in exactly what they hand you and make change. Slow service on Medium/Hard makes them grumpy
(and stingy with tips). The score line counts customers served, perfect orders, and tips.

## Two iPads: kitchen & order board
1. On each iPad, tap **🔗 Link iPads** on the start screen, type the **same code** on both, and tap **Link**.
   (Both need internet to find each other. The 🟢 dot in the register's top bar means linked.)

   **No internet?** Tap **📷 Link with QR codes** instead. On the first iPad tap **1️⃣ Show a code**,
   on the second tap **2️⃣ Scan a code** and point it at the first; then the first iPad scans the
   reply code. Both must be on the same Wi-Fi. No outside server is used. This link ends when an
   iPad sleeps or the app closes, so scan the two codes again next time.
2. One iPad runs the register; the other opens **👩‍🍳 Kitchen** or **📺 Order Board**.
3. Orders appear in the kitchen as they're paid. Tap **Start → Ready → Picked up**.
   The board announces ready orders, and the register gets a pop-up.

**Kitchen game:** on a ticket in the Making column, tap **🍳 Make it!** and drag each item from the shelf
onto the tray, then tap **Done** — the order goes out either way: perfect is +10 points, wrong is −5 (🏆 score in the
kitchen header; ↺ resets it). Drag an item off the tray to remove it. **🐣 Easy shelf** shows only the
ticket's items plus a few extras; **🧸 Free Play** (kitchen header) lets anyone build whatever they like.

**Drive-thru intercom:** on the second iPad tap **🚗 Drive-Thru** for a menu board with **🎤 Hold to Talk** and
**🚗 I'm here!**. The register then shows a **🎧** button — hold it to talk back. Voices get a crackly
speaker-box sound. Each iPad asks for the microphone the first time someone talks.

**Phone orders:** on a **phone** (linked with the same code), the start screen shows **📞 Call Restaurant**
instead of Drive-Thru. Pick a shop and it rings the register; the cashier taps **Answer** and you can both
talk freely (with Mute and End), while the phone shows the menu to order from. Phone orders are set to To Go.

Gift card balances and stars sync too. Linking uses PeerJS: its free public server only
introduces the iPads; orders go directly between them over an encrypted WebRTC link.
Unlinked, everything still works on a single iPad.

## Roadmap
- [x] Phase 1 – Register: shops, menus, options, tax, totals
- [x] Phase 2 – Square-style customer checkout: tips, tap to pay, cash and change, receipts, sounds
- [x] Phase 3 – Printable QR "credit cards", camera scanning, gift-card balances, rewards
- [x] Phase 4 – Two-iPad sync: kitchen tickets, order-up board
- [ ] Phase 5 – Parent menu editor, sales report, drive-thru, surprise customers
