// Kearns Café — cartoon food icons (drawn in code as SVG).
//
// Every menu item has a recipe below, keyed by its id in menus/*.js.
// Icons.html(id, emoji) gives an <img> for the item (or the emoji if there's no icon).
// All icons share one style: chunky shapes, dark outlines, a white shine.

window.Icons = (function () {
  "use strict";

  // ---------- Style ----------
  const INK = "#4A2A16";
  const OL = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
  const OL2 = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
  const BUN = "#EFAE58", BUN_DARK = "#DE9E4F", PATTY = "#683C24", CHEESE = "#FFC83A", LETTUCE = "#5DBB46";
  const TOMATO = "#E53935", DOUGH = "#E8A95E", DOUGH_SIDE = "#C47F3C", DOUGH_IN = "#D9944C";

  // ---------- Little drawing helpers ----------
  const P = (d, fill, extra = OL) => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const E = (cx, cy, rx, ry, fill, extra = OL) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" ${extra}/>`;
  const C = (cx, cy, r, fill, extra = OL) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" ${extra}/>`;
  const R = (x, y, w, h, rx, fill, extra = OL) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}" fill="${fill}" ${extra}/>`;
  const n = (v) => Math.round(v * 10) / 10;
  const shine = (d, w = 5, op = 0.8) => `<path d="${d}" stroke="#fff" stroke-width="${w}" stroke-linecap="round" fill="none" opacity="${op}"/>`;
  const ground = (cy = 120, rx = 46) => `<ellipse cx="64" cy="${cy}" rx="${rx}" ry="6" fill="#000" opacity="0.12"/>`;
  const badge = (cx, cy, r, text, color) =>
    C(cx, cy, r, "#fff", OL2) +
    `<text x="${cx}" y="${n(cy + r * 0.36)}" font-family="-apple-system, Helvetica, Arial, sans-serif" font-weight="900" font-size="${n(r * 1.05)}" text-anchor="middle" fill="${color}">${text}</text>`;

  // Repeatable "random" numbers (sprinkles land in the same place every time)
  function rng(seed) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  // Ellipse with a wavy edge (frosting)
  function wavy(cx, cy, rx, ry, amp, waves, phase = 0.5) {
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      const r = 1 + amp * Math.sin(waves * t + phase);
      pts.push(`${n(cx + rx * r * Math.cos(t))},${n(cy + ry * r * Math.sin(t))}`);
    }
    return `M${pts.join(" L")} Z`;
  }
  // Wavy horizontal band (lettuce, bacon)
  function waveBand(x1, x2, top, bottom, bumps = 10, depth = 5) {
    const w = (x2 - x1) / bumps;
    let d = `M${x1} ${bottom} L${x1} ${top + depth}`;
    for (let i = 0; i < bumps; i++) d += ` Q${n(x1 + w * i + w / 2)} ${i % 2 ? top + depth * 2 : top - depth} ${n(x1 + w * (i + 1))} ${top + depth}`;
    return d + ` L${x2} ${bottom} Z`;
  }
  // Specks scattered on an ellipse (sugar, cinnamon, sesame)
  function specks(cx, cy, rx, ry, count, color, size, seed, avoidHole) {
    const r = rng(seed);
    let s = "";
    for (let i = 0; i < count; i++) {
      const t = r() * Math.PI * 2, k = Math.sqrt(r()) * 0.9;
      const x = cx + rx * k * Math.cos(t), y = cy + ry * k * Math.sin(t);
      if (avoidHole && Math.abs(x - cx) < 24 && Math.abs(y - cy) < 15) continue;
      s += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${size}" ry="${n(size * 0.6)}" fill="${color}" transform="rotate(${Math.round(r() * 180)} ${n(x)} ${n(y)})"/>`;
    }
    return s;
  }
  function sprinkles(cx, cy, rx, ry, count, seed, avoidHole = true) {
    const r = rng(seed);
    const colors = ["#ff5d8f", "#ffd23f", "#3bceac", "#5e60ce", "#ffffff", "#ff8c42"];
    let s = "";
    for (let i = 0; i < count; i++) {
      const t = r() * Math.PI * 2, k = 0.4 + r() * 0.52;
      const x = cx + rx * k * Math.cos(t), y = cy + ry * k * Math.sin(t);
      if (avoidHole && Math.abs(x - cx) < 26 && Math.abs(y - cy) < 17) continue;
      s += `<rect x="${n(x - 4.5)}" y="${n(y - 1.7)}" width="9" height="3.4" rx="1.7" fill="${colors[i % colors.length]}" transform="rotate(${Math.round(r() * 180)} ${n(x)} ${n(y)})"/>`;
    }
    return s;
  }

  const wrap = (body, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;

  // =====================================================================
  //  DONUTS & BAKERY
  // =====================================================================
  // opts: frost (color) | glaze | sprinkles | drizzle | hole | sugar | cinnamon | jelly | cream | seeds | colors
  function donut(o) {
    const hole = o.hole !== false;
    const top = o.top || DOUGH, side = o.side || DOUGH_SIDE, inner = o.inner || DOUGH_IN;
    let g = E(64, 76, 60, 40, side);
    g += E(64, 64, 60, 40, top, "");
    if (o.frost) {
      g += P(wavy(64, 62, 51, 33, o.glaze ? 0.025 : 0.07, 9), o.frost, o.glaze ? OL2 + ' opacity="0.95"' : OL2);
    }
    if (o.sugar) g += specks(64, 62, 54, 34, 70, "#fff", 1.6, 11, hole);
    if (o.cinnamon) g += specks(64, 62, 54, 34, 55, "#8B4A1C", 1.8, 5, hole) + specks(64, 62, 54, 34, 40, "#FFF3DC", 1.4, 9, hole);
    if (o.seeds) g += specks(64, 62, 52, 33, 26, "#FFF3D6", 2.6, 4, hole);
    if (hole) g += E(64, 60, 22, 14, inner, OL2);
    if (o.sprinkles) g += sprinkles(64, 62, 51, 33, 30, 7, hole);
    if (o.drizzle) {
      const sq = (y, flip) => `<path d="M24 ${y} q7 ${flip * -7} 14 0 t14 0 t14 0 t14 0 t14 0 t14 0" stroke="${o.drizzle}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      g += sq(44, 1) + sq(80, -1) + `<path d="M20 62 q4 -6 8 0 M100 62 q4 -6 8 0" stroke="${o.drizzle}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    }
    if (o.jelly) g += P("M112 58 Q126 60 124 72 Q122 80 116 78 Q118 88 110 88 Q106 80 108 72 Z", "#C2185B", OL2) + shine("M116 64 Q120 64 120 70", 2.5, 0.7);
    g += o.glaze
      ? shine("M28 52 Q50 32 86 36", 6, 0.75) + shine("M44 82 Q64 90 88 80", 3.5, 0.45)
      : shine("M26 58 Q32 42 50 37", 5, 0.75);
    const mask = hole ? `<mask id="m"><rect width="128" height="128" fill="#fff"/><ellipse cx="64" cy="59" rx="15" ry="9" fill="#000"/></mask>` : "";
    return wrap(ground(116, 52) + `<g ${hole ? 'mask="url(#m)"' : ""}>${g}</g>` + (hole ? E(64, 59, 15, 9, "none", OL2) : ""), mask);
  }

  // Box with things peeking out the top and a number badge (dozen, donut holes)
  function box({ color, lid, peek, label, labelColor, bag }) {
    let b = ground(121, 48);
    if (lid) b += P("M20 22 L108 22 L102 52 L26 52 Z", lid);
    b += peek;
    if (bag) {
      b += P("M24 54 L104 54 L98 120 L30 120 Z", color);
      b += P("M24 54 L104 54 L102 64 L26 64 Z", "#C99A5B", OL2);
    } else {
      b += R(14, 58, 100, 62, 8, color);
      b += R(14, 58, 100, 12, 6, "#fff", OL2 + ' opacity="0.35"');
    }
    b += badge(64, 92, 19, label, labelColor);
    return wrap(b);
  }
  function miniDonut(cx, cy, frost) {
    return E(cx, cy + 3, 15, 9, DOUGH_SIDE, OL2) + E(cx, cy, 15, 9, frost, OL2) + E(cx, cy - 0.5, 4.5, 2.6, INK, "");
  }
  function ball(cx, cy, r, color, dots) {
    return C(cx, cy, r, color, OL2) + (dots ? specks(cx, cy, r * 0.8, r * 0.8, 8, dots, 1.2, Math.round(cx), false) : "") +
      `<path d="M${n(cx - r * 0.5)} ${n(cy - r * 0.2)} Q${n(cx - r * 0.3)} ${n(cy - r * 0.6)} ${n(cx + r * 0.1)} ${n(cy - r * 0.65)}" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  }
  function holesPeek(count) {
    const spots = [[38, 52], [56, 46], [74, 50], [92, 54], [47, 58], [83, 58], [64, 56]];
    const colors = [["#F7D9A6"], ["#5A3420"], ["#FFFFFF", "#E9C9C9"], [DOUGH, "#8B4A1C"], ["#F48FB1"], ["#F7D9A6"], ["#5A3420"]];
    return spots.slice(0, count).map(([x, y], i) => ball(x, y, 11, colors[i][0], colors[i][1])).join("");
  }

  function bagel() { return donut({ top: "#E9B66B", side: "#B9772F", inner: "#C98A44", seeds: true }); }

  function croissant() {
    // Crescent made of puffy segments
    let b = ground(116, 50);
    const segs = [[24, 84, 14, 11, -40], [40, 68, 17, 15, -20], [64, 60, 21, 19, 0], [88, 68, 17, 15, 20], [104, 84, 14, 11, 40]];
    segs.forEach(([x, y, rx, ry, a], i) => {
      b += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${i === 2 ? "#F2B55E" : "#E8A04A"}" ${OL} transform="rotate(${a} ${x} ${y})"/>`;
    });
    b += shine("M54 52 Q62 44 74 46", 4.5, 0.7) + shine("M32 64 Q36 58 44 56", 3.5, 0.6);
    return wrap(b);
  }

  function muffin() {
    let b = ground(120, 40);
    b += P("M34 70 L94 70 L86 118 L42 118 Z", "#4FA3E0");
    for (let x = 44; x <= 84; x += 8) b += `<path d="M${x} 72 L${x + (x - 64) * 0.08} 116" stroke="${INK}" stroke-width="1.8" opacity="0.45"/>`;
    b += P("M22 74 C14 30 114 30 106 74 Q64 84 22 74 Z", "#D9944C");
    [[44, 52], [70, 44], [86, 60], [56, 64], [78, 72]].forEach(([x, y]) => (b += C(x, y, 5, "#3F51B5", OL2)));
    b += shine("M34 58 Q40 42 56 38", 5, 0.6);
    return wrap(b);
  }

  function hashBrown() {
    let b = ground(112, 50);
    b += E(64, 74, 54, 32, "#C9852E");
    b += E(64, 66, 54, 32, "#F0B44C", "");
    b += E(64, 66, 54, 32, "none", OL);
    for (let i = -3; i <= 3; i++) b += `<path d="M${64 + i * 13 - 16} 44 L${64 + i * 13 + 16} 88" stroke="#C9852E" stroke-width="2.4" opacity="0.6"/>`;
    b += shine("M24 62 Q32 46 52 40", 5, 0.7);
    return wrap(b);
  }

  function wrapIcon() {
    let b = ground(118, 50);
    b += `<g transform="translate(64 68) scale(1.25) translate(-64 -68) rotate(-28 64 70)">`;
    b += R(20, 46, 88, 48, 22, "#F3D9A4");
    b += `<path d="M34 50 Q36 70 34 90 M54 48 Q56 70 54 92" stroke="#D9B878" stroke-width="2.5" fill="none"/>`;
    b += E(96, 70, 14, 24, "#FFE07A");
    b += C(92, 62, 5, "#E53935", "") + C(100, 76, 5, LETTUCE, "") + C(94, 80, 4, "#8D5A2B", "");
    b += `</g>`;
    b += shine("M30 70 Q40 52 62 42", 5, 0.6);
    return wrap(b);
  }

  // =====================================================================
  //  BURGERS & SANDWICHES (built from layers, bottom to top)
  // =====================================================================
  const LAYERS = {
    lettuce: { h: 10, draw: (y) => P(waveBand(8, 120, y, y + 10, 10, 3), LETTUCE) },
    patty: { h: 18, draw: (y) => R(8, y, 112, 18, 9, PATTY) + shine(`M18 ${y + 5} L40 ${y + 5}`, 3, 0.35) },
    cheese: { h: 8, draw: (y) => P(`M6 ${y} H122 L117 ${y + 8} H108 L104 ${y + 20} L99 ${y + 8} H80 L74 ${y + 24} L68 ${y + 8} H50 L44 ${y + 22} L38 ${y + 8} H24 L19 ${y + 16} L15 ${y + 8} Z`, CHEESE) },
    tomato: { h: 9, draw: (y) => R(14, y, 100, 9, 4.5, TOMATO) },
    onion: { h: 7, draw: (y) => R(18, y, 92, 7, 3.5, "#F3E5F5") },
    bacon: { h: 20, draw: (y) =>
      P(`M-2 ${y + 4} Q-9 ${y + 11} -2 ${y + 20} L12 ${y + 18} L12 ${y + 4} Z`, "#D9534F", OL2) +
      P(`M130 ${y + 4} Q137 ${y + 11} 130 ${y + 20} L116 ${y + 18} L116 ${y + 4} Z`, "#D9534F", OL2) +
      P(waveBand(2, 126, y + 2, y + 20, 6, 4), "#D9534F") +
      `<path d="M6 ${y + 13} Q22 ${y + 8} 38 ${y + 13} T70 ${y + 13} T102 ${y + 13} T124 ${y + 13}" stroke="#FFD6DE" stroke-width="3.5" fill="none"/>` },
    chicken: { h: 20, draw: (y) => P(waveBand(6, 122, y, y + 20, 12, 3), "#E9A23B") + specks(64, y + 11, 52, 6, 24, "#C67A1E", 1.6, 9, false) },
    egg: { h: 18, draw: (y) => P(`M4 ${y + 16} Q8 ${y - 2} 36 ${y + 2} Q64 ${y - 4} 92 ${y + 2} Q122 ${y - 2} 124 ${y + 16} Q64 ${y + 24} 4 ${y + 16} Z`, "#FFFDF5") + E(64, y + 8, 18, 8, "#FFB300", OL2) + shine(`M56 ${y + 5} Q60 ${y + 2} 66 ${y + 3}`, 2.5, 0.8) },
  };

  // Little round "sticker" in the top-right corner: what makes this sandwich different
  function cornerBadge(kind) {
    const cx = 103, cy = 25;
    let b = C(cx, cy, 22, "#FFF8E7", OL);
    if (kind === "bacon") {
      // two wavy strips: dark outline, red meat, pink fat stripe
      const strip = (y) => {
        const d = `M${cx - 15} ${y} q3.75 -6 7.5 0 t7.5 0 t7.5 0 t7.5 0`;
        return `<path d="${d}" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/>` +
          `<path d="${d}" stroke="#D9534F" stroke-width="6" fill="none" stroke-linecap="round"/>` +
          `<path d="${d}" stroke="#FFD6DE" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      };
      b += strip(cy - 5) + strip(cy + 7);
    } else if (kind === "cheese") {
      b += P(`M${cx - 14} ${cy + 10} L${cx + 14} ${cy + 10} L${cx + 14} ${cy - 2} L${cx - 14} ${cy - 12} Z`, CHEESE, OL2);
      b += C(cx - 4, cy + 3, 3, "#E0A800", "") + C(cx + 7, cy + 4, 2.2, "#E0A800", "") + C(cx + 3, cy - 3, 1.8, "#E0A800", "");
    } else if (kind === "double") {
      b += `<text x="${cx}" y="${cy + 8}" font-family="-apple-system, Helvetica, Arial, sans-serif" font-weight="900" font-size="22" text-anchor="middle" fill="#D62828">2×</text>`;
    } else if (kind === "chicken") {
      b += `<g transform="rotate(35 ${cx} ${cy})">` + E(cx, cy - 4, 10, 12, "#C9772B", OL2) +
        R(cx - 2.5, cy + 6, 5, 11, 2, "#FFF3D6", OL2) + C(cx - 3, cy + 18, 3.2, "#FFF3D6", OL2) + C(cx + 3, cy + 18, 3.2, "#FFF3D6", OL2) + `</g>`;
    }
    return b;
  }

  // layers: list from bottom to top; bun: { color, top: height of the dome, seeds }
  function burger(layers, opts = {}) {
    const bun = opts.bun || BUN, bunBottom = opts.bunBottom || BUN_DARK;
    let y = 118, parts = "";
    parts += R(12, y - 20, 104, 20, 10, bunBottom);
    y -= 17;
    layers.forEach((name) => {
      const L = LAYERS[name];
      parts += L.draw(y - L.h);
      y -= L.h - 3;
    });
    const domeH = opts.dome || 46;
    const base = y + 4;
    let top = P(`M8 ${base} C8 ${base - domeH * 1.15} 120 ${base - domeH * 1.15} 120 ${base} Z`, bun);
    if (opts.seeds !== false) {
      const r = rng(3);
      for (let i = 0; i < 9; i++) {
        const sx = 28 + r() * 72, sy = base - domeH * 0.75 + r() * domeH * 0.45;
        top += `<ellipse cx="${n(sx)}" cy="${n(sy)}" rx="4" ry="2.1" fill="#FFF3D6" transform="rotate(${Math.round(r() * 60 - 30)} ${n(sx)} ${n(sy)})"/>`;
      }
    }
    if (opts.muffinTop) top += specks(64, base - domeH * 0.45, 46, domeH * 0.3, 18, "#F7E2B5", 1.6, 2, false);
    top += shine(`M22 ${n(base - 14)} Q28 ${n(base - domeH * 0.8)} 46 ${n(base - domeH * 0.9)}`, 5, 0.7);
    if (opts.flag) top += `<path d="M64 ${n(base - domeH * 0.85)} L64 ${n(base - domeH * 0.85 - 22)}" stroke="${INK}" stroke-width="3"/>` + P(`M64 ${n(base - domeH * 0.85 - 22)} L84 ${n(base - domeH * 0.85 - 16)} L64 ${n(base - domeH * 0.85 - 10)} Z`, "#D62828", OL2);
    let body = parts + top;
    // Shrink tall stacks to fit
    const highest = base - domeH * 0.9 - (opts.flag ? 24 : 0);
    if (highest < 6) {
      const s = (118 - 6) / (118 - highest);
      body = `<g transform="translate(64 118) scale(${n(s * 100) / 100}) translate(-64 -118)">${body}</g>`;
    }
    return wrap(ground(121, 54) + body + (opts.badge ? cornerBadge(opts.badge) : ""));
  }

  // =====================================================================
  //  CHICKEN, SIDES
  // =====================================================================
  function nuggetBox(count) {
    let b = ground(121, 46);
    const blob = (cx, cy, rx, ry, a) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#E9A23B" ${OL} transform="rotate(${a} ${cx} ${cy})"/>`;
    b += blob(40, 44, 19, 14, -20) + blob(68, 34, 19, 14, 15) + blob(92, 46, 17, 13, 30) + blob(56, 52, 18, 13, 5) + blob(80, 54, 16, 12, -10);
    b += P("M18 54 L110 54 L99 120 L29 120 Z", "#E53935");
    b += P("M20 56 L108 56 L106 68 L22 68 Z", "#fff", 'opacity="0.3"');
    b += badge(64, 92, 19, count, "#E53935");
    return wrap(b);
  }

  function tenders() {
    let b = ground(118, 52);
    const strip = (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">${R(x - 12, y - 36, 24, 72, 12, "#E9A23B")}${specks(x, y, 9, 30, 10, "#C67A1E", 1.6, x, false)}</g>`;
    b += strip(44, 58, -18) + strip(64, 52, 4) + strip(84, 58, 22);
    b += P("M10 78 L118 78 L104 116 L24 116 Z", "#fff");
    for (let x = 22; x < 110; x += 12) b += `<rect x="${x}" y="80" width="6" height="34" fill="#E53935" opacity="0.8"/>`;
    b += P("M10 78 L118 78 L104 116 L24 116 Z", "none");
    return wrap(b);
  }

  function fries() {
    let b = ground(121, 42);
    const r = rng(8);
    for (let i = 0; i < 9; i++) {
      const x = 32 + i * 8, h = 34 + r() * 18, a = (r() - 0.5) * 16;
      b += `<rect x="${x}" y="${78 - h}" width="9" height="${h + 20}" rx="2" fill="#FFD54F" ${OL2} transform="rotate(${n(a)} ${x + 4} 80)"/>`;
    }
    b += P("M22 62 Q64 76 106 62 L96 120 L32 120 Z", "#E53935");
    b += shine("M34 76 L40 110", 5, 0.5);
    return wrap(b);
  }

  function onionRings() {
    let b = ground(120, 50);
    b += P("M12 92 L116 92 L106 118 L22 118 Z", "#F5E6C8");
    const ring = (cx, cy, rx, ry, a) =>
      `<g transform="rotate(${a} ${cx} ${cy})">${E(cx, cy, rx, ry, "#E9A23B")}${E(cx, cy, rx * 0.5, ry * 0.5, "#F5E6C8", OL2)}</g>`;
    b += ring(44, 70, 28, 20, -15) + ring(84, 64, 28, 20, 18) + ring(64, 44, 26, 18, 0);
    b += shine("M28 62 Q32 52 42 50", 3.5, 0.6);
    return wrap(b);
  }

  function appleSlices() {
    let b = ground(120, 50);
    // whole apple behind
    b += P("M50 30 Q34 16 22 30 Q8 48 18 72 Q28 92 50 86 Q72 92 82 72 Q92 48 78 30 Q66 16 50 30 Z", "#D32F2F");
    b += `<path d="M50 30 Q50 18 56 10" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` + P("M56 16 Q68 6 76 14 Q66 22 56 16 Z", LETTUCE, OL2);
    b += shine("M26 42 Q30 32 40 30", 5, 0.7);
    // slices in front: half-moons with red skin edge and seeds
    const slice = (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">${P(`M${x - 26} ${y} A26 26 0 0 1 ${x + 26} ${y} Z`, "#D32F2F")}${P(`M${x - 21} ${y} A21 21 0 0 1 ${x + 21} ${y} Z`, "#FFF6D8", "")}${E(x - 5, y - 8, 2, 3.5, INK, "")}${E(x + 5, y - 8, 2, 3.5, INK, "")}${P(`M${x - 26} ${y} A26 26 0 0 1 ${x + 26} ${y} Z`, "none")}</g>`;
    b += slice(68, 112, -10) + slice(98, 108, 14);
    return wrap(b);
  }

  function salad() {
    let b = ground(120, 50);
    b += P(waveBand(14, 114, 40, 78, 9, 7), LETTUCE);
    b += P(waveBand(24, 104, 50, 80, 7, 6), "#8BD46A", OL2);
    b += C(44, 58, 8, TOMATO, OL2) + C(82, 56, 8, TOMATO, OL2) + C(64, 50, 5, "#FF9800", OL2);
    b += P("M8 70 L120 70 Q116 116 64 118 Q12 116 8 70 Z", "#fff");
    b += P("M8 70 L120 70", "none");
    b += shine("M20 82 Q28 104 48 110", 4.5, 0.0) + `<path d="M20 84 Q30 104 50 110" stroke="#E0E0E0" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    return wrap(b);
  }

  // =====================================================================
  //  DRINKS
  // =====================================================================
  function straw(color = "#2E9E5B", x = 76) {
    return `<g transform="rotate(12 ${x} 30)">${R(x - 4, 2, 9, 46, 3, color)}<rect x="${x - 4}" y="10" width="9" height="5" fill="#fff" opacity="0.7"/><rect x="${x - 4}" y="24" width="9" height="5" fill="#fff" opacity="0.7"/></g>`;
  }
  function cube(x, y, a) {
    return `<rect x="${x}" y="${y}" width="17" height="15" rx="4" fill="#fff" opacity="0.75" stroke="#fff" stroke-width="1.5" transform="rotate(${a} ${x + 8} ${y + 7})"/>`;
  }
  // Clear plastic cup: liquid color, optional cream layer, ice, straw, topping
  function clearCup({ liquid, cream, ice = true, strawColor = "#2E9E5B", top, garnish }) {
    let b = ground(121, 38);
    if (strawColor) b += straw(strawColor);
    b += P("M26 32 L102 32 L91 120 L37 120 Z", "#EEF3F5", "");
    b += P(`M28.5 ${top ? 40 : 50} L99.5 ${top ? 40 : 50} L91 120 L37 120 Z`, liquid, "");
    if (cream) b += P("M28.5 50 L99.5 50 L98 66 Q82 74 64 66 Q46 58 30 68 Z", cream, "");
    if (ice) b += cube(36, 40, -12) + cube(70, 36, 14) + cube(52, 54, 6);
    b += P("M26 32 L102 32 L91 120 L37 120 Z", "none");
    if (top) b += top;
    else b += R(20, 24, 88, 11, 5.5, "#F2F6F8");
    if (garnish) b += garnish;
    b += shine("M36 42 L44 112", 6, 0.8);
    return wrap(b);
  }
  // Paper cup with lid (hot coffee, soda)
  function paperCup({ cup, band, sleeve, strawColor, steam, stripe }) {
    let b = ground(121, 38);
    if (steam) b += `<path d="M48 18 Q42 10 48 2 M64 16 Q58 8 64 0 M80 18 Q74 10 80 2" stroke="#B0BEC5" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    if (strawColor) b += straw(strawColor);
    b += P("M28 34 L100 34 L90 120 L38 120 Z", cup);
    if (band) b += P("M30.4 54 L97.6 54 L96.2 66 L31.8 66 Z", band, OL2);
    if (stripe) b += P("M32 80 Q50 70 64 82 Q78 94 96 82 L94.5 96 Q78 106 64 94 Q50 82 33.5 92 Z", stripe, "");
    if (sleeve) b += P("M33 72 L95 72 L92 100 L36 100 Z", sleeve, OL2);
    b += R(22, 24, 84, 13, 6.5, "#fff");
    if (!strawColor) b += R(54, 16, 20, 10, 4, "#fff", OL2);
    b += shine("M38 44 L44 112", 5, 0.6);
    return wrap(b);
  }
  // Mug with a fancy top (hot chocolate, latte)
  function mug({ color, inside, top, glass }) {
    let b = ground(121, 44);
    b += `<path d="M96 56 Q122 58 116 82 Q110 100 94 96" stroke="${INK}" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    b += `<path d="M96 56 Q122 58 116 82 Q110 100 94 96" stroke="${glass ? "#E3F2FD" : color}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    b += R(20, 44, 80, 74, 14, glass ? "#E8F1F5" : color);
    if (glass) b += R(24, 60, 72, 54, 10, inside, "") + R(24, 52, 72, 16, 8, "#FFF4E0", "") + R(20, 44, 80, 74, 14, "none");
    b += E(60, 46, 40, 10, glass ? "#FFF4E0" : inside);
    b += top || "";
    b += shine("M30 60 L30 104", 5, 0.6);
    return wrap(b);
  }
  function glassTumbler({ liquid, garnish }) {
    let b = ground(121, 38);
    b += P("M30 38 L98 38 L92 120 L36 120 Z", "#EEF3F5", "");
    b += P("M31.5 56 L96.5 56 L92 120 L36 120 Z", liquid, "");
    b += E(64, 56, 32.5, 6, liquid, OL2);
    b += P("M30 38 L98 38 L92 120 L36 120 Z", "none");
    b += garnish || "";
    b += shine("M40 48 L46 112", 6, 0.8);
    return wrap(b);
  }
  function milkCarton() {
    let b = ground(121, 40);
    b += P("M30 44 L64 22 L98 44 Z", "#64B5F6");
    b += P("M84 44 L98 44 L98 120 L84 120 Z", "#E3EEF8");
    b += R(30, 44, 54, 76, 3, "#fff");
    b += R(30, 44, 54, 14, 3, "#64B5F6", OL2);
    b += P("M57 72 Q57 64 64 58 Q71 64 71 72 Q71 80 64 80 Q57 80 57 72 Z", "#64B5F6", OL2);
    b += `<text x="57" y="104" font-family="-apple-system, Helvetica, Arial, sans-serif" font-weight="900" font-size="15" text-anchor="middle" fill="#1E88E5">MILK</text>`;
    b += P("M64 22 L64 12 L74 12 L74 28", "#E3EEF8", OL2);
    return wrap(b);
  }
  function waterBottle() {
    let b = ground(122, 32);
    b += R(52, 4, 24, 16, 4, "#1565C0");
    b += P("M50 20 L78 20 L80 30 Q96 38 96 54 L96 112 Q96 120 88 120 L40 120 Q32 120 32 112 L32 54 Q32 38 48 30 Z", "#D6EEFF");
    b += R(32, 64, 64, 30, 2, "#42A5F5", OL2);
    b += P("M58 84 Q58 76 64 70 Q70 76 70 84 Q70 90 64 90 Q58 90 58 84 Z", "#fff", "");
    b += shine("M42 44 L42 110", 6, 0.8);
    return wrap(b);
  }
  function juiceBox() {
    let b = ground(121, 38);
    b += `<g transform="rotate(-12 80 20)">${R(76, 2, 7, 34, 2, "#FDD835")}</g>`;
    b += P("M88 36 L104 28 L104 112 L88 120 Z", "#558B2F");
    b += P("M28 36 L44 28 L104 28 L88 36 Z", "#8BC34A");
    b += R(28, 36, 60, 84, 3, "#7CB342");
    b += C(58, 76, 16, "#E53935", OL2) + P("M58 60 Q60 52 66 50", "none", OL2) + E(66, 56, 6, 3, LETTUCE, OL2);
    b += shine("M36 46 L36 110", 5, 0.6);
    return wrap(b);
  }
  function shakeGlass() {
    let b = ground(122, 34);
    b += straw("#E53935", 80);
    b += P("M30 40 L98 40 L86 104 L42 104 Z", "#F8BBD0");
    b += R(56, 104, 16, 10, 2, "#EEF3F5") + R(40, 112, 48, 8, 4, "#EEF3F5");
    b += P("M28 42 Q30 22 48 26 Q56 10 72 18 Q90 12 96 30 Q104 36 98 42 Z", "#FFFDF5");
    b += C(70, 12, 8, "#D32F2F", OL2) + `<path d="M70 4 Q74 -4 82 -2" stroke="${INK}" stroke-width="2.5" fill="none"/>`;
    b += shine("M38 52 L46 98", 5, 0.7);
    return wrap(b);
  }

  // =====================================================================
  //  DESSERTS
  // =====================================================================
  function cone() {
    let b = ground(124, 22);
    b += P("M40 62 L88 62 L64 124 Z", "#E0A050");
    b += `<path d="M46 70 L72 112 M58 66 L80 92 M70 64 L84 76 M82 70 L56 112 M70 66 L48 92 M58 64 L44 76" stroke="${INK}" stroke-width="2" opacity="0.4"/>`;
    b += P("M32 64 Q28 48 44 46 Q38 30 56 28 Q54 12 68 10 Q74 22 80 28 Q96 30 88 46 Q102 50 96 64 Z", "#FFF8E7");
    b += `<path d="M40 50 Q64 58 86 48 M48 34 Q64 40 78 32" stroke="#E8DCC4" stroke-width="3" fill="none"/>`;
    b += shine("M42 40 Q46 30 54 28", 4, 0.8);
    return wrap(b);
  }
  function sundae() {
    let b = ground(122, 34);
    b += R(56, 96, 16, 16, 2, "#E8F1F5") + R(38, 110, 52, 9, 4.5, "#E8F1F5");
    b += C(46, 58, 20, "#FFF8E7") + C(82, 58, 20, "#FFF8E7") + C(64, 44, 20, "#FFF8E7");
    b += P("M30 52 Q40 66 46 56 Q54 70 60 58 Q68 72 74 58 Q84 70 98 52 L96 64 Q82 80 74 70 Q66 82 58 70 Q48 80 40 68 Q34 72 30 64 Z", "#5D3A1A", OL2);
    b += C(64, 22, 8, "#D32F2F", OL2) + `<path d="M64 14 Q68 4 78 6" stroke="${INK}" stroke-width="2.5" fill="none"/>`;
    b += P("M22 66 L106 66 Q102 98 64 100 Q26 98 22 66 Z", "#E8F1F5");
    b += shine("M32 74 Q36 88 48 94", 4, 0.8);
    return wrap(b);
  }
  function cookie() {
    let b = ground(116, 50);
    b += P(wavy(64, 66, 52, 44, 0.03, 11), "#DFA65A");
    [[44, 48], [74, 42], [88, 66], [58, 72], [40, 84], [72, 90], [62, 56]].forEach(([x, y], i) => {
      b += `<path d="M${x - 5} ${y} L${x} ${y - 6} L${x + 5} ${y} Z" fill="#4E2A17" transform="rotate(${i * 40} ${x} ${y})"/>`;
    });
    b += shine("M26 56 Q32 36 52 28", 5, 0.6);
    return wrap(b);
  }
  function pie() {
    let b = ground(118, 54);
    const topFace = "M10 86 L96 34 Q122 50 116 86 Z";
    // side: crust, apple filling, bottom crust
    b += P("M10 86 L116 86 L116 106 L10 102 Z", "#F7C35F");
    b += P("M10 98 L116 100 L116 106 L10 102 Z", "#D99A3E", OL2);
    b += `<path d="M24 90 Q30 96 36 90 M50 92 Q56 98 62 92 M78 92 Q84 98 90 92" stroke="#E0A030" stroke-width="3" fill="none"/>`;
    b += P("M10 86 L116 86 L116 106 L10 102 Z", "none");
    // top with lattice
    b += `<clipPath id="pc"><path d="${topFace}"/></clipPath>`;
    b += P(topFace, "#F7C35F", "");
    b += `<g clip-path="url(#pc)" stroke="#E9B66B" stroke-width="9" stroke-linecap="round">` +
      `<path d="M20 100 L80 20 M44 100 L104 20 M68 100 L128 20 M92 100 L140 36"/>` +
      `<path d="M10 60 L120 92 M20 40 L130 72 M40 24 L140 52"/></g>`;
    b += P(topFace, "none");
    // thick crust edge on the round back
    b += `<path d="M96 34 Q122 50 116 86" stroke="${INK}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M96 34 Q122 50 116 86" stroke="#E9B66B" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    return wrap(b);
  }
  function kidsMeal(peek) {
    let b = ground(121, 46);
    b += `<path d="M40 50 Q40 22 64 22 Q88 22 88 50" stroke="${INK}" stroke-width="11" fill="none"/><path d="M40 50 Q40 22 64 22 Q88 22 88 50" stroke="#FFC83A" stroke-width="5" fill="none"/>`;
    b += peek;
    b += P("M18 50 L110 50 L102 120 L26 120 Z", "#E53935");
    b += P("M18 50 L110 50 L108 62 L20 62 Z", "#FFC83A", OL2);
    b += P("M64 72 L69.5 84 L82 85 L72.5 93 L75.5 106 L64 99 L52.5 106 L55.5 93 L46 85 L58.5 84 Z", "#FFC83A", OL2);
    return wrap(b);
  }

  // =====================================================================
  //  THE MENU: item id → icon recipe
  // =====================================================================
  const RECIPES = {
    // Donuts
    "glazed": () => donut({ frost: "#F7D9A6", glaze: true }),
    "choc-frost": () => donut({ frost: "#5A3420" }),
    "sprinkle": () => donut({ frost: "#FFF6EA", sprinkles: true }),
    "strawberry": () => donut({ frost: "#F48FB1", drizzle: "#fff" }),
    "boston": () => donut({ frost: "#5A3420", hole: false }),
    "jelly": () => donut({ hole: false, sugar: true, jelly: true }),
    "maple": () => donut({ frost: "#C98A3E", drizzle: "#F3C886" }),
    "cinnamon": () => donut({ cinnamon: true }),
    "dozen": () => box({ color: "#F06292", lid: "#F48FB1", peek: miniDonut(36, 56, "#5A3420") + miniDonut(64, 52, "#F48FB1") + miniDonut(92, 56, "#F7D9A6"), label: "12", labelColor: "#D81B60" }),
    // Donut holes
    "holes-10": () => box({ color: "#FFB74D", peek: holesPeek(4), label: "10", labelColor: "#E65100" }),
    "holes-25": () => box({ color: "#D7A86E", bag: true, peek: holesPeek(5), label: "25", labelColor: "#8D5A2B" }),
    "holes-50": () => box({ color: "#F06292", lid: "#F48FB1", peek: holesPeek(7), label: "50", labelColor: "#D81B60" }),
    // Coffee
    "hot-coffee": () => paperCup({ cup: "#FFFFFF", sleeve: "#A1673A", steam: true }),
    "iced-coffee": () => clearCup({ liquid: "#87532F", cream: "#D5A774" }),
    "latte": () => mug({ glass: true, inside: "#B07A4D", top: P("M52 44 Q52 38 58 38 Q62 38 62 42 Q62 38 66 38 Q72 38 72 44 Q72 50 62 56 Q52 50 52 44 Z", "#B07A4D", "") }),
    "cold-brew": () => clearCup({ liquid: "#3E2516", strawColor: "#263238" }),
    "frozen": () => clearCup({
      liquid: "#C49A6C", ice: false, strawColor: "#2E9E5B",
      top: P("M24 40 Q22 22 40 24 Q48 10 64 16 Q80 10 88 24 Q106 22 104 40 Z", "#FFFDF5") + `<path d="M34 30 Q46 38 58 28 Q70 38 82 28 Q92 36 98 32" stroke="#C67A1E" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    }),
    // Drinks
    "hot-choc": () => mug({ color: "#D62828", inside: "#5D3A1A", top: P("M28 46 Q26 30 42 32 Q48 18 62 24 Q76 16 82 30 Q98 30 92 46 Z", "#FFFDF5") + R(46, 30, 7, 6, 1.5, "#F8BBD0", OL2) + R(66, 28, 7, 6, 1.5, "#fff", OL2) + R(56, 36, 7, 6, 1.5, "#F8BBD0", OL2) }),
    "lemonade": () => clearCup({ liquid: "#FFE36E", strawColor: "#EC407A", garnish: `<g transform="rotate(-20 32 32)">${C(32, 32, 16, "#FFEB3B")}${C(32, 32, 11, "#FFF59D", OL2)}<path d="M32 21 L32 43 M21 32 L43 32 M24 24 L40 40 M40 24 L24 40" stroke="#F9A825" stroke-width="1.8"/></g>` }),
    "oj": () => glassTumbler({ liquid: "#FFA726", garnish: `<g transform="rotate(-20 96 40)">${P("M78 40 A18 18 0 0 1 114 40 Z", "#FB8C00")}${P("M82 40 A14 14 0 0 1 110 40 Z", "#FFCC80", OL2)}</g>` }),
    "milk": () => milkCarton(),
    "water": () => waterBottle(),
    // Breakfast
    "bagel": () => bagel(),
    "egg-sand": () => burger(["cheese", "egg"], { bun: "#F3D9A4", bunBottom: "#E9C98A", seeds: false, dome: 40, muffinTop: true }),
    "wrap": () => wrapIcon(),
    "hash": () => hashBrown(),
    "muffin": () => muffin(),
    "croissant": () => croissant(),
    // Burgers
    "hamburger": () => burger(["lettuce", "patty", "tomato"]),
    "cheeseburger": () => burger(["lettuce", "patty", "cheese"], { badge: "cheese" }),
    "double": () => burger(["patty", "cheese", "patty", "cheese"], { badge: "double" }),
    "big-barn": () => burger(["lettuce", "tomato", "patty", "cheese", "patty", "cheese", "onion"], { flag: true }),
    "bacon-burger": () => burger(["lettuce", "patty", "cheese", "bacon"], { badge: "bacon" }),
    // Chicken
    "nuggets-6": () => nuggetBox("6"),
    "nuggets-10": () => nuggetBox("10"),
    "chick-sand": () => burger(["lettuce", "chicken"], { dome: 40, badge: "chicken" }),
    "tenders": () => tenders(),
    // Sides
    "fries": () => fries(),
    "onion-rings": () => onionRings(),
    "apples": () => appleSlices(),
    "salad": () => salad(),
    // Burger Barn drinks
    "soda": () => paperCup({ cup: "#E53935", stripe: "#fff", strawColor: "#FFC83A" }),
    "juice": () => juiceBox(),
    // Desserts
    "shake": () => shakeGlass(),
    "cone": () => cone(),
    "sundae": () => sundae(),
    "cookie": () => cookie(),
    "pie": () => pie(),
    // Kids meals
    "kids-burger": () => kidsMeal(`<g transform="translate(64 40) scale(0.42) translate(-64 -64)">${burger(["lettuce", "patty", "cheese"]).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>`),
    "kids-nugget": () => kidsMeal(`<g transform="translate(64 42) scale(0.5) translate(-64 -64)">${'<ellipse cx="40" cy="60" rx="19" ry="14" fill="#E9A23B" ' + OL + ' transform="rotate(-20 40 60)"/><ellipse cx="70" cy="52" rx="19" ry="14" fill="#E9A23B" ' + OL + ' transform="rotate(15 70 52)"/><ellipse cx="92" cy="62" rx="17" ry="13" fill="#E9A23B" ' + OL + ' transform="rotate(30 92 62)"/>'}</g>`),
  };

  // =====================================================================
  //  TILE COLORS: each item's signature color (what makes it special),
  //  picked so items next to each other on the register look different
  // =====================================================================
  const COLORS = {
    // Donuts: the frosting
    "glazed": "#E9C27A", "choc-frost": "#5A3420", "sprinkle": "#3BCEAC", "strawberry": "#F48FB1",
    "boston": "#FFB300", "jelly": "#C2185B", "maple": "#C98A3E", "cinnamon": "#8B4A1C", "dozen": "#F06292",
    "holes-10": "#FFB74D", "holes-25": "#B98952", "holes-50": "#F06292",
    // Coffee: hot is brown, cold is blue
    "hot-coffee": "#8D5A2B", "iced-coffee": "#4FC3F7", "latte": "#D7A86E", "cold-brew": "#1565C0", "frozen": "#9FA8DA",
    // Drinks
    "hot-choc": "#D62828", "lemonade": "#FFD54F", "oj": "#FFA726", "milk": "#64B5F6", "water": "#26C6DA",
    "soda": "#E53935", "juice": "#7CB342", "shake": "#F48FB1",
    // Breakfast
    "bagel": "#8D6E63", "egg-sand": "#FFB300", "wrap": "#7CB342", "hash": "#C9852E", "muffin": "#3F51B5", "croissant": "#F2B55E",
    // Burgers: the special ingredient
    "hamburger": "#8D5A2B", "cheeseburger": "#FFC83A", "double": "#FF8F00", "big-barn": "#B71C1C", "bacon-burger": "#F06292",
    // Chicken
    "nuggets-6": "#F2A900", "nuggets-10": "#E65100", "chick-sand": "#7CB342", "tenders": "#A1673A",
    // Sides
    "fries": "#FFD54F", "onion-rings": "#E9A23B", "apples": "#D32F2F", "salad": "#43A047",
    // Desserts
    "cone": "#FFE082", "sundae": "#6D4C41", "cookie": "#A1673A", "pie": "#E0A030",
    // Kids meals
    "kids-burger": "#D62828", "kids-nugget": "#F2A900",
  };

  // ---------- Public API ----------
  const cache = {};
  function svg(id) {
    if (!RECIPES[id]) return null;
    if (!(id in cache)) cache[id] = RECIPES[id]();
    return cache[id];
  }
  function url(id) {
    const s = svg(id);
    return s ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s) : null;
  }
  // <img> for an item, or the emoji when there's no drawing for it
  function html(id, emoji, cls) {
    const u = id ? url(id) : null;
    if (u) return `<img class="food-ico${cls ? " " + cls : ""}" src="${u}" alt="" draggable="false">`;
    return String(emoji == null ? "" : emoji).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function has(id) { return !!RECIPES[id]; }

  // Signature color for an item's tile (null = use the shop's normal color)
  function color(id) { return COLORS[id] || null; }

  return { svg, url, html, has, color, ids: () => Object.keys(RECIPES) };
})();
