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

## Roadmap
- [x] Phase 1 – Register: shops, menus, options, tax, totals
- [ ] Phase 2 – Square-style customer checkout: tips, tap to pay, cash and change, receipts, sounds
- [ ] Phase 3 – Printable QR "credit cards", camera scanning, gift-card balances, rewards
- [ ] Phase 4 – Two-iPad sync: kitchen tickets, order-up board
- [ ] Phase 5 – Parent menu editor, sales report, drive-thru, surprise customers
