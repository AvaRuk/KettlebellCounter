// Shared code: scene rendering for the LED panel (any number of teams) and time helper functions.
// Loaded on both the display page and the control page (there — only to check whether the names fit); the server takes the default colors from here.
(function () {
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const U_DIGIT = 0.55, U_COLON = 0.17, U_GAP = 0.16;   // in fractions of the digit height

  // Saturated colors: half-tones are unreadable on LEDs, while warm and cool shades are easy to tell apart.
  // Colors of the display itself (timer, frame, separators, alarm) — the same for all teams:
  const DEFAULT_COLORS = { timer: '#ffffff', alarm: '#ff3b30', frame: '#1f5fff', line: '#1f5fff' };
  // Every team has its own color (name, score, card). New teams get the first color of this list that no other team uses.
  // Dark blue is invisible on the panel's black background, so a brighter blue is used — adjust to the brand book if needed.
  const TEAM_COLORS = ['#e5007d', '#3d9bff', '#3cff7a', '#ff8a1a', '#a56bff', '#19e0c8', '#ffd400', '#ff5a5a'];

  // ---------- 5×7 pixel font (Latin, Cyrillic, digits) ----------
  const F = (s) => s.split('/');
  const FONT = {
    ' ': F('...../...../...../...../...../...../.....'),
    '-': F('...../...../...../#####/...../...../.....'),
    '.': F('...../...../...../...../...../...../..#..'),
    ',': F('...../...../...../...../...../..#../.#...'),
    "'": F('..#../..#../.#.../...../...../...../.....'),
    '!': F('..#../..#../..#../..#../..#../...../..#..'),
    '+': F('...../..#../..#../#####/..#../..#../.....'),
    ':': F('...../..#../...../...../..#../...../.....'),
    '/': F('....#/....#/...#./..#../.#.../#..../#....'),
    '(': F('...#./..#../.#.../.#.../.#.../..#../...#.'),
    ')': F('.#.../..#../...#./...#./...#./..#../.#...'),
    0: F('.###./#...#/#..##/#.#.#/##..#/#...#/.###.'),
    1: F('..#../.##../..#../..#../..#../..#../.###.'),
    2: F('.###./#...#/....#/...#./..#../.#.../#####'),
    3: F('####./....#/....#/.###./....#/....#/####.'),
    4: F('...#./..##./.#.#./#..#./#####/...#./...#.'),
    5: F('#####/#..../####./....#/....#/#...#/.###.'),
    6: F('.###./#..../#..../####./#...#/#...#/.###.'),
    7: F('#####/....#/...#./..#../.#.../.#.../.#...'),
    8: F('.###./#...#/#...#/.###./#...#/#...#/.###.'),
    9: F('.###./#...#/#...#/.####/....#/....#/.###.'),
    A: F('.###./#...#/#...#/#####/#...#/#...#/#...#'),
    B: F('####./#...#/#...#/####./#...#/#...#/####.'),
    C: F('.###./#...#/#..../#..../#..../#...#/.###.'),
    D: F('####./#...#/#...#/#...#/#...#/#...#/####.'),
    E: F('#####/#..../#..../####./#..../#..../#####'),
    F: F('#####/#..../#..../####./#..../#..../#....'),
    G: F('.###./#...#/#..../#.###/#...#/#...#/.####'),
    H: F('#...#/#...#/#...#/#####/#...#/#...#/#...#'),
    I: F('.###./..#../..#../..#../..#../..#../.###.'),
    J: F('..###/...#./...#./...#./...#./#..#./.##..'),
    K: F('#...#/#..#./#.#../##.../#.#../#..#./#...#'),
    L: F('#..../#..../#..../#..../#..../#..../#####'),
    M: F('#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#'),
    N: F('#...#/##..#/#.#.#/#..##/#...#/#...#/#...#'),
    O: F('.###./#...#/#...#/#...#/#...#/#...#/.###.'),
    P: F('####./#...#/#...#/####./#..../#..../#....'),
    Q: F('.###./#...#/#...#/#...#/#.#.#/#..#./.##.#'),
    R: F('####./#...#/#...#/####./#.#../#..#./#...#'),
    S: F('.####/#..../#..../.###./....#/....#/####.'),
    T: F('#####/..#../..#../..#../..#../..#../..#..'),
    U: F('#...#/#...#/#...#/#...#/#...#/#...#/.###.'),
    V: F('#...#/#...#/#...#/#...#/#...#/.#.#./..#..'),
    W: F('#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#'),
    X: F('#...#/#...#/.#.#./..#../.#.#./#...#/#...#'),
    Y: F('#...#/#...#/.#.#./..#../..#../..#../..#..'),
    Z: F('#####/....#/...#./..#../.#.../#..../#####'),
    'А': F('.###./#...#/#...#/#####/#...#/#...#/#...#'),
    'В': F('####./#...#/#...#/####./#...#/#...#/####.'),
    'Е': F('#####/#..../#..../####./#..../#..../#####'),
    'К': F('#...#/#..#./#.#../##.../#.#../#..#./#...#'),
    'М': F('#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#'),
    'Н': F('#...#/#...#/#...#/#####/#...#/#...#/#...#'),
    'О': F('.###./#...#/#...#/#...#/#...#/#...#/.###.'),
    'Р': F('####./#...#/#...#/####./#..../#..../#....'),
    'С': F('.###./#...#/#..../#..../#..../#...#/.###.'),
    'Т': F('#####/..#../..#../..#../..#../..#../..#..'),
    'Х': F('#...#/#...#/.#.#./..#../.#.#./#...#/#...#'),
    'У': F('#...#/#...#/#...#/.####/....#/....#/.###.'),
    'Ё': F('.#.#./#####/#..../####./#..../#..../#####'),
    'Б': F('#####/#..../#..../####./#...#/#...#/####.'),
    'Г': F('#####/#..../#..../#..../#..../#..../#....'),
    'Д': F('..##./.#.#./.#.#./.#.#./.#.#./#####/#...#'),
    'Ж': F('#.#.#/#.#.#/.###./..#../.###./#.#.#/#.#.#'),
    'З': F('.###./#...#/....#/..##./....#/#...#/.###.'),
    'И': F('#...#/#...#/#..##/#.#.#/##..#/#...#/#...#'),
    'Й': F('.#.#./#...#/#..##/#.#.#/##..#/#...#/#...#'),
    'Л': F('..###/.#..#/.#..#/.#..#/.#..#/#...#/#...#'),
    'П': F('#####/#...#/#...#/#...#/#...#/#...#/#...#'),
    'Ф': F('..#../.###./#.#.#/#.#.#/#.#.#/.###./..#..'),
    'Ц': F('#..#./#..#./#..#./#..#./#..#./#####/....#'),
    'Ч': F('#...#/#...#/#...#/.####/....#/....#/....#'),
    'Ш': F('#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#####'),
    'Щ': F('#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#####/....#'),
    'Ъ': F('##.../.#.../.#.../.###./.#..#/.#..#/.###.'),
    'Ы': F('#...#/#...#/#...#/###.#/#.#.#/#.#.#/###.#'),
    'Ь': F('#..../#..../#..../####./#...#/#...#/####.'),
    'Э': F('.###./#...#/....#/..###/....#/#...#/.###.'),
    'Ю': F('#..#./#.#.#/#.#.#/###.#/#.#.#/#.#.#/#..#.'),
    'Я': F('.####/#...#/#...#/.####/..#.#/.#..#/#...#'),
  };
  // Prepare glyphs: for each row — a list of runs [column, length], to draw fewer rectangles
  const GLYPHS = {};
  for (const [ch, rows] of Object.entries(FONT)) {
    GLYPHS[ch] = rows.map((row) => {
      const runs = [];
      for (let c = 0; c < 5; c++) {
        if (row[c] !== '#') continue;
        let n = 1;
        while (c + n < 5 && row[c + n] === '#') n++;
        runs.push([c, n]);
        c += n;
      }
      return runs;
    });
  }
  const glyph = (ch) => GLYPHS[ch] || null;

  // Draws a string with the pixel font, each "dot" is an s×s square. Letter pitch: 6·s
  function drawText(ctx, str, x, y, s, color) {
    ctx.fillStyle = color;
    for (const ch of str) {
      const g = glyph(ch);
      if (g) for (let r = 0; r < 7; r++) for (const [c, n] of g[r]) ctx.fillRect(x + c * s, y + r * s, n * s, s);
      x += 6 * s;
    }
  }

  // Which integer font scale fits into a team cell (no more than ~30% of its height)
  function nameFit(names, cw, ch, show) {
    const none = { s: 0, h: 0, maxChars: 0 };
    if (!show) return none;
    const n = names.reduce((m, x) => Math.max(m, x.length), 0);
    if (n === 0) return none;
    let sH = 0;
    for (let s = 1; s <= 40; s++) { if (9 * s > ch * 0.3) break; sH = s; }
    if (sH === 0) return none;
    const sW = Math.floor(cw / (6 * n - 1));
    const s = Math.min(sH, Math.max(1, sW));
    const maxChars = Math.floor((cw + s) / (6 * s));
    if (maxChars < 1) return none;
    return { s, h: 8 * s + Math.max(1, Math.floor(s / 2)), maxChars };
  }

  // Sides where the relay results and the leader can be placed relative to the main score
  const POS = ['top', 'bottom', 'left', 'right'];
  const DEFAULT_LEGS_POS = 'top', DEFAULT_LEADER_POS = 'bottom';
  const normPos = (v, def) => (POS.includes(v) ? v : def);

  // Relay results: on top/bottom — one row "42 38 -" (one slot per participant, scale computed for 3 digits per slot),
  // on left/right — a column, one participant per line. Returns the scale s and the band size (height for a row, width for a column)
  function legsFit(N, cw, ch, pos, availH) {
    const none = { s: 0, size: 0 };
    if (!N) return none;
    if (pos === 'left' || pos === 'right') {
      const s = Math.min(Math.floor((cw * 0.22) / 17), Math.floor(availH / (8 * N)));
      return s < 1 ? none : { s, size: 17 * s + 2 * s };
    }
    const chars = 4 * N - 1;
    const s = Math.min(Math.floor(cw / (6 * chars - 1)), Math.floor((ch * 0.22) / 9));
    return s < 1 ? none : { s, size: 8 * s + Math.max(1, Math.floor(s / 2)) };
  }

  // Cuts a band of the given size from the rectangle on the given side; returns { band, rest }
  function carve(r, pos, size) {
    size = Math.max(0, Math.min(size, pos === 'top' || pos === 'bottom' ? r.h : r.w));
    if (pos === 'top') return { band: { x: r.x, y: r.y, w: r.w, h: size }, rest: { x: r.x, y: r.y + size, w: r.w, h: r.h - size } };
    if (pos === 'bottom') return { band: { x: r.x, y: r.y + r.h - size, w: r.w, h: size }, rest: { x: r.x, y: r.y, w: r.w, h: r.h - size } };
    if (pos === 'left') return { band: { x: r.x, y: r.y, w: size, h: r.h }, rest: { x: r.x + size, y: r.y, w: r.w - size, h: r.h } };
    return { band: { x: r.x + r.w - size, y: r.y, w: size, h: r.h }, rest: { x: r.x, y: r.y, w: r.w - size, h: r.h } };
  }

  // Leader block ("ЛИДЕР" + score) inside its band: top/bottom — in one line, left/right — the label above the number.
  // Returns { ls, vertical, nw, ndh } or null if it doesn't fit
  function leaderFit(band, pos) {
    if (pos === 'left' || pos === 'right') {
      const ls = Math.min(Math.floor(band.w / 29), Math.floor(band.h * 0.14 / 7));
      if (ls < 1) return null;
      const gapL = 2 * ls;
      const ndh = Math.max(3, fitDh('000', band.w, Math.max(3, Math.floor(band.h * 0.4))));
      const nw = Math.min(band.w, geometry('000', ndh).total);
      return { ls, vertical: true, gapL, nw, ndh, total: 7 * ls + gapL + ndh };
    }
    const lh = band.h;
    const ls = Math.min(Math.floor(lh / 9), Math.floor((band.w * 0.45) / 29));
    if (ls < 1) return null;
    // The label and the number form one group centered in the band; the number width is computed for 3 digits so the group doesn't "wander"
    const tw = 29 * ls, gapL = 2 * ls;
    const ndh = Math.max(3, fitDh('000', band.w - tw - gapL, lh));
    const nw = Math.min(band.w - tw - gapL, geometry('000', ndh).total);
    return { ls, vertical: false, tw, gapL, nw, ndh };
  }

  // Layout inside a team cell (relative to the cell's corner): name on top, then the relay results band, the leader band
  // (each on its own side) and the main score in what is left. opt: { legsN, legsPos, leader, leaderPos }
  function cellLayout(cw, ch, nh, opt) {
    let rest = { x: 0, y: nh, w: cw, h: ch - nh };
    let legs = null, leader = null;
    if (opt.legsN) {
      const lp = normPos(opt.legsPos, DEFAULT_LEGS_POS);
      const f = legsFit(opt.legsN, cw, ch, lp, rest.h);
      if (f.s > 0) {
        const r = carve(rest, lp, f.size);
        legs = { ...f, pos: lp, rect: r.band };
        rest = r.rest;
      }
    }
    if (opt.leader) {
      const ldp = normPos(opt.leaderPos, DEFAULT_LEADER_POS);
      const size = ldp === 'top' || ldp === 'bottom' ? Math.floor(rest.h * 0.36) : Math.floor(rest.w * 0.3);
      const r = carve(rest, ldp, size);
      const f = leaderFit(r.band, ldp);
      if (f) {
        leader = { ...f, pos: ldp, rect: r.band };
        rest = r.rest;
      }
    }
    return { legs, leader, main: rest };
  }

  // ---------- Seven-segment digits ----------
  function geometry(str, dh) {
    const t = Math.max(1, Math.round(dh * U_COLON));
    const dw = Math.max(3, Math.round(dh * U_DIGIT));
    const gap = Math.max(1, Math.round(dh * U_GAP));
    let total = 0;
    for (let i = 0; i < str.length; i++) {
      total += str[i] === ':' ? t : dw;
      if (i < str.length - 1) total += gap;
    }
    return { t, dw, gap, total };
  }

  function fitDh(str, aw, ah) {
    let units = 0;
    for (let i = 0; i < str.length; i++) units += (str[i] === ':' ? U_COLON : U_DIGIT) + (i < str.length - 1 ? U_GAP : 0);
    return Math.floor(Math.min(ah, aw / units));
  }

  // ---------- Rounded digits ----------
  // A digit is drawn with strokes with round caps and corners, then hard-binarized (no half-tones),
  // so that only fully lit or fully unlit pixels remain on the panel.
  // The result is cached: on each frame the digits are simply copied.
  const spriteCache = new Map();
  let cachePx = 0;
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  function makeSprite(w, h, color, paint) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = g.strokeStyle = '#000';
    g.lineCap = 'round'; g.lineJoin = 'round';
    paint(g);
    const img = g.getImageData(0, 0, w, h), d = img.data, [r, gr, b] = hexRgb(color);
    for (let i = 0; i < d.length; i += 4) {
      const on = d[i + 3] >= 128;
      d[i] = r; d[i + 1] = gr; d[i + 2] = b; d[i + 3] = on ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  // The cache is limited by area so memory doesn't grow while the window is being resized
  function cached(key, w, h, color, paint) {
    let v = spriteCache.get(key);
    if (!v) {
      if (cachePx + w * h > 24e6) { spriteCache.clear(); cachePx = 0; }
      v = makeSprite(w, h, color, paint);
      spriteCache.set(key, v);
      cachePx += w * h;
    }
    return v;
  }
  function digitSprite(ch, dw, dh, t, color) {
    return cached(`${ch}|${dw}|${dh}|${t}|${color}`, dw, dh, color, (g) => {
      const h2 = t / 2, x0 = h2, x1 = dw - h2, y0 = h2, y1 = dh - h2;
      const ym = Math.round((dh - t) / 2) + h2;
      const P = { a: [x0, y0, x1, y0], b: [x1, y0, x1, ym], c: [x1, ym, x1, y1], d: [x0, y1, x1, y1],
                  e: [x0, ym, x0, y1], f: [x0, y0, x0, ym], g: [x0, ym, x1, ym] };
      g.lineWidth = t;
      g.beginPath();
      for (const sg of SEG[ch]) { const [a, b, c, d] = P[sg]; g.moveTo(a, b); g.lineTo(c, d); }
      g.stroke();
    });
  }
  function colonSprite(t, dh, color) {
    return cached(`:|${t}|${dh}|${color}`, t, dh, color, (g) => {
      const h2 = t / 2, off = Math.round(dh * 0.28);
      for (const cy of [off + h2, dh - off - t + h2]) { g.beginPath(); g.arc(h2, cy, h2, 0, Math.PI * 2); g.fill(); }
    });
  }

  // Frame around the display: with rounded corners (like the digits) or plain
  function drawFrame(ctx, W, H, f, color, round) {
    if (f < 1) return;
    if (round && typeof document !== 'undefined') {
      const r = Math.max(2, Math.min(40, Math.round(Math.min(W, H) * 0.06)));
      const spr = cached(`F|${W}|${H}|${f}|${r}|${color}`, W, H, color, (g) => {
        const x = f / 2, y = f / 2, w = W - f, h = H - f;
        g.lineWidth = f;
        g.beginPath();
        g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
        g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
        g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
        g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r);
        g.closePath(); g.stroke();
      });
      ctx.drawImage(spr, 0, 0);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, f); ctx.fillRect(0, H - f, W, f);
      ctx.fillRect(0, f, f, H - 2 * f); ctx.fillRect(W - f, f, f, H - 2 * f);
    }
  }

  // Team cell edge: a frame of thickness t inside the rectangle x, y, w, h (rounded or plain)
  function drawBox(ctx, x, y, w, h, t, color, round) {
    if (t < 1 || w < 2 * t + 2 || h < 2 * t + 2) return;
    if (round && typeof document !== 'undefined') {
      const r = Math.max(2, Math.min(24, Math.round(Math.min(w, h) * 0.08)));
      const spr = cached(`B|${w}|${h}|${t}|${r}|${color}`, w, h, color, (g) => {
        const a = t / 2;
        g.lineWidth = t;
        g.beginPath();
        g.moveTo(a + r, a); g.lineTo(w - a - r, a); g.arcTo(w - a, a, w - a, a + r, r);
        g.lineTo(w - a, h - a - r); g.arcTo(w - a, h - a, w - a - r, h - a, r);
        g.lineTo(a + r, h - a); g.arcTo(a, h - a, a, h - a - r, r);
        g.lineTo(a, a + r); g.arcTo(a, a, a + r, a, r);
        g.closePath(); g.stroke();
      });
      ctx.drawImage(spr, x, y);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, t); ctx.fillRect(x, y + h - t, w, t);
      ctx.fillRect(x, y + t, t, h - 2 * t); ctx.fillRect(x + w - t, y + t, t, h - 2 * t);
    }
  }

  // Digits: rounded (default) or classic ones made of rectangles
  function drawNumber(ctx, str, ax, ay, aw, ah, color, round) {
    if (aw < 3 || ah < 3) return;
    let dh = fitDh(str, aw, ah);
    if (dh < 3) return;
    let g = geometry(str, dh);
    while (g.total > aw && dh > 3) g = geometry(str, --dh);

    const { t, dw, gap, total } = g;
    const sprites = round && typeof document !== 'undefined';
    let x = ax + Math.floor((aw - total) / 2);
    const y = ay + Math.floor((ah - dh) / 2);
    const mid = Math.round((dh - t) / 2);
    ctx.fillStyle = color;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === ':') {
        if (sprites) ctx.drawImage(colonSprite(t, dh, color), x, y);
        else {
          ctx.fillRect(x, y + Math.round(dh * 0.28), t, t);
          ctx.fillRect(x, y + dh - Math.round(dh * 0.28) - t, t, t);
        }
        x += t + gap;
        continue;
      }
      if (sprites) ctx.drawImage(digitSprite(ch, dw, dh, t, color), x, y);
      else {
        const R = {
          a: [0, 0, dw, t], g: [0, mid, dw, t], d: [0, dh - t, dw, t],
          f: [0, 0, t, mid + t], b: [dw - t, 0, t, mid + t],
          e: [0, mid, t, dh - mid], c: [dw - t, mid, t, dh - mid],
        };
        for (const sg of SEG[ch]) {
          const [rx, ry, rw, rh] = R[sg];
          ctx.fillRect(x + rx, y + ry, rw, rh);
        }
      }
      x += dw + gap;
    }
  }

  // Layout: timer on top, below it a grid of team cells (rows × cols), with separators between cells.
  // Each cell has the name on top and the score below it.
  function plan(W, H, m, rows, cols, n, sample, names, show, opt) {
    const aw = W - 2 * m;
    let frac;
    if (n === 0) frac = 0.6;
    else if (cols === 1) frac = Math.min(0.34, Math.max(0.14, 0.34 - 0.03 * rows));
    else frac = rows === 1 ? 0.36 : 0.26;
    const tMax = Math.round(H * frac) - m;
    const th = Math.max(0, Math.min(tMax, fitDh('00:00', aw, H)));
    const by = m + th + m, bh = H - by - m;
    const line = Math.max(1, Math.round(Math.min(W, H) * 0.02));
    const pad = Math.max(1, Math.round(m / 2));
    const gx = 2 * pad + line, gy = 2 * pad + line;
    const cw = Math.max(0, Math.floor((aw - (cols - 1) * gx) / cols));
    const ch = Math.max(0, Math.floor((bh - (rows - 1) * gy) / rows));
    const cells = [];
    const lines = [];
    const usedRows = n ? Math.ceil(n / cols) : 0;
    const rowCount = (r) => Math.min(cols, n - r * cols);
    // Center an incomplete last row so it doesn't "slide" to the left
    const rowX = (r) => m + Math.floor(((cols - rowCount(r)) * (cw + gx)) / 2);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      cells.push({ x: rowX(r) + c * (cw + gx), y: by + r * (ch + gy), w: cw, h: ch });
    }
    // Vertical separators only between existing cells; between full rows the line runs through the horizontal one
    for (let r = 0; r < usedRows; r++) {
      const k = rowCount(r);
      const through = r < usedRows - 1 && k === cols && rowCount(r + 1) === cols;
      for (let c = 0; c < k - 1; c++)
        lines.push({ x: rowX(r) + (c + 1) * cw + c * gx + pad, y: by + r * (ch + gy), w: line, h: ch + (through ? gy : 0) });
    }
    for (let r = 0; r < usedRows - 1; r++) lines.push({ x: m, y: by + (r + 1) * ch + r * gy + pad, w: aw, h: line });
    const nf = nameFit(names, cw, ch, show);
    const inner = cellLayout(cw, ch, nf.h, opt);
    const dh = n ? fitDh(sample, inner.main.w, inner.main.h) : 0;
    return { rows, cols, timer: { x: m, y: m, w: aw, h: th }, cells, lines, nf, inner, dh, pad, line };
  }

  // Try all grids (single column, single row, square) and pick the one where the score ends up largest
  function bestPlan(W, H, m, n, sample, names, show, opt) {
    if (n <= 1) return plan(W, H, m, 1, 1, n, sample, names, show, opt);
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      if ((cols - 1) * rows >= n) continue;   // the last column would be empty
      const p = plan(W, H, m, rows, cols, n, sample, names, show, opt);
      if (!best || p.dh > best.dh) best = p;
    }
    return best;
  }

  // A team's total score: in a relay — the sum of participants' results plus the current leg (after time is up — just the sum)
  function teamTotal(st, t) {
    if (!st.relay || !st.relay.on) return t.reps ?? 0;
    const sum = (t.legs || []).reduce((a, b) => a + b, 0);
    return st.finished ? sum : sum + Math.max(0, (t.reps ?? 0) - (t.legBase || 0));
  }
  // Index of the current relay leg (zero-based)
  function relayLeg(st) {
    const N = st.relay.legs;
    return Math.min(N - 1, Math.floor(elapsedOf(st) * N / (st.duration * 1000)));
  }

  // A team's own color; if it has none (old data), a default one by position in the list
  const teamColor = (t, i) => (t && /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : TEAM_COLORS[(i || 0) % TEAM_COLORS.length]);
  // Text color (black or white) that stays readable on top of the given background color
  const ink = (hex) => { const [r, g, b] = hexRgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000' : '#fff'; };

  // ---------- Time ----------
  // The timer is based on server time: net.js computes the offset to this computer's clock
  let clockOffset = 0;
  const now = () => Date.now() + clockOffset;
  function elapsedOf(st) {
    let e = st.elapsed + (st.running ? Math.max(0, now() - st.startedAt) : 0);
    if (st.mode === 'down') e = Math.min(e, st.duration * 1000);
    return e;
  }
  function secondsOf(st) {
    const e = elapsedOf(st);
    return st.mode === 'down' ? Math.max(0, Math.ceil((st.duration * 1000 - e) / 1000)) : Math.floor(e / 1000);
  }
  function fmt(sec) {
    sec = Math.min(sec, 99 * 60 + 59);
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }
  const isAlarm = (st) => st.finished || (st.mode === 'down' && st.running && secondsOf(st) <= 10);

  // Draws the scene into a canvas of W×H. st.teams — a list of { name, reps }.
  // Returns { rows, cols, cut }: cut[i] — the i-th team's name is truncated or hidden
  function draw(canvas, st, W, H) {
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const teams = Array.isArray(st.teams) ? st.teams : [];
    const n = teams.length;
    const names = teams.map((t) => String(t.name ?? ''));
    const show = st.showNames !== false;
    const colors = st.colors || DEFAULT_COLORS;
    const round = st.rounded !== false;
    const f = st.frame !== false ? Math.max(1, Math.round(Math.min(W, H) * 0.02)) : 0;   // frame thickness
    const m = Math.max(1, Math.round(Math.min(W, H) * 0.04)) + f;
    const sample = '000';   // computed for 3 digits so the layout doesn't jump at 99 → 100
    const legsN = st.relay && st.relay.on ? st.relay.legs : 0;
    const L = bestPlan(W, H, m, n, sample, names, show, { legsN, legsPos: st.legsPos, leader: !!st.leader && n === 1, leaderPos: st.leaderPos });

    const blink = Math.floor(now() / 500) % 2 === 0;
    const paused = !st.running && !st.finished && st.elapsed > 0;

    if (!(st.finished || paused) || blink) {
      const t = L.timer;
      drawNumber(ctx, fmt(secondsOf(st)), t.x, t.y, t.w, t.h, isAlarm(st) ? colors.alarm : colors.timer, round);
    }
    // Frame and separators use the brand color; when time is up, the frame lights up in the alarm color
    drawFrame(ctx, W, H, f, st.finished ? colors.alarm : (colors.frame || colors.timer), round);
    ctx.fillStyle = colors.line || colors.frame || colors.timer;
    for (const l of L.lines) ctx.fillRect(l.x, l.y, l.w, l.h);

    // Team edge — a frame around its cell; sits in the gap between cells and doesn't overlap the display frame
    L.cells.forEach((c, i) => {
      const e = teams[i].edgeColor;
      if (e) drawBox(ctx, c.x - L.pad, c.y - L.pad, c.w + 2 * L.pad, c.h + 2 * L.pad, L.line, e, round);
    });

    const cut = names.map(() => false);
    L.cells.forEach((c, i) => {
      const { s, h: nh, maxChars } = L.nf;
      const { legs, leader, main } = L.inner;
      const base = teamColor(teams[i], i);
      const nameCol = teams[i].nameColor || base, countCol = teams[i].countColor || base;
      if (s > 0 && names[i]) {
        const txt = names[i].slice(0, maxChars);
        const tw = txt.length * 6 * s - s;
        drawText(ctx, txt, c.x + Math.floor((c.w - tw) / 2), c.y, s, nameCol);
        cut[i] = names[i].length > maxChars;
      } else if (show && names[i]) {
        cut[i] = true;   // there is no room for names at all
      }
      // Relay: participants' results next to the score (on the chosen side); when time is up, the score is the overall total
      let big = teams[i].reps ?? 0;
      if (legsN) {
        const lg = teams[i].legs || [];
        const val = (k) => (lg[k] === undefined ? '-' : String(lg[k]));
        if (legs) {
          const r = legs.rect, ls = legs.s;
          if (legs.pos === 'left' || legs.pos === 'right') {
            // A column: one participant per line, centered in the band
            const colH = legsN * 8 * ls - ls, y0 = c.y + r.y + Math.max(0, Math.floor((r.h - colH) / 2));
            const inner = r.w - 2 * ls;   // the band has a gap of 2·ls on the side facing the score
            const x0 = c.x + r.x + (legs.pos === 'left' ? 0 : 2 * ls);
            for (let k = 0; k < legsN; k++) {
              const txt = val(k), tw = txt.length * 6 * ls - ls;
              drawText(ctx, txt, x0 + Math.max(0, Math.floor((inner - tw) / 2)), y0 + k * 8 * ls, ls, countCol);
            }
          } else {
            const txt = Array.from({ length: legsN }, (_, k) => val(k)).join(' ');
            const tw = txt.length * 6 * ls - ls;
            drawText(ctx, txt, c.x + r.x + Math.max(0, Math.floor((r.w - tw) / 2)), c.y + r.y, ls, countCol);
          }
        }
        if (st.finished) big = teamTotal(st, teams[i]);   // during a leg — the participant's counter (from zero or from the current value), at the end — the overall total
      }
      // Single-team display: the "ЛИДЕР" (leader) label and the leader's score, on the chosen side of the score
      if (leader) {
        const r = leader.rect, { ls } = leader, col = st.leader.color;
        if (leader.vertical) {
          const y0 = c.y + r.y + Math.max(0, Math.floor((r.h - leader.total) / 2));
          const lx = c.x + r.x + Math.floor((r.w - 29 * ls) / 2);
          drawText(ctx, 'ЛИДЕР', lx, y0, ls, col);
          drawNumber(ctx, String(st.leader.reps), c.x + r.x, y0 + 7 * ls + leader.gapL, r.w, leader.ndh, col, round);
        } else {
          const gx0 = c.x + r.x + Math.floor((r.w - (leader.tw + leader.gapL + leader.nw)) / 2);
          drawText(ctx, 'ЛИДЕР', gx0, c.y + r.y + Math.floor((r.h - 7 * ls) / 2), ls, col);
          drawNumber(ctx, String(st.leader.reps), gx0 + leader.tw + leader.gapL, c.y + r.y, leader.nw, r.h, col, round);
        }
      }
      drawNumber(ctx, String(big), c.x + main.x, c.y + main.y, main.w, main.h, countCol, round);
    });
    return { rows: L.rows, cols: L.cols, cut };
  }

  const KB = { DEFAULT_COLORS, TEAM_COLORS, POS, DEFAULT_LEGS_POS, DEFAULT_LEADER_POS, teamTotal, relayLeg, draw, elapsedOf, secondsOf, fmt, isAlarm, teamColor, ink, setClockOffset: (v) => { clockOffset = v; }, _font: FONT };
  if (typeof window !== 'undefined') window.KB = KB;
  if (typeof module !== 'undefined' && module.exports) module.exports = KB;
})();
