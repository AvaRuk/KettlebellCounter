// Shared code: scene rendering for the LED panel (any number of teams) and time helper functions.
// Loaded on both the display page and the control page (there — only to check whether the names fit); the server takes the list of color schemes from here.
(function () {
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const U_DIGIT = 0.55, U_COLON = 0.17, U_GAP = 0.16;   // in fractions of the digit height

  // Saturated colors: half-tones are unreadable on LEDs, while warm and cool shades are easy to tell apart
  const PALETTES = [
    // TGASU theme: brand crimson E5007D and blue. Dark blue is invisible on the panel's black background,
    // so a brighter blue is used for the display — adjust to the brand book if needed.
    { name: 'ТГАСУ: малиновый и синий', frame: '#1f5fff', timer: '#ffffff', t1: '#e5007d', t2: '#3d9bff', alarm: '#ff3b30' },
    { name: 'Классика: янтарь, зелёный, голубой', frame: '#ffc400', timer: '#ffc400', t1: '#3cff7a', t2: '#3cc8ff', alarm: '#ff2d2d' },
    { name: 'Огонь и лёд: оранжевый и синий', frame: '#ffffff', timer: '#ffffff', t1: '#ff6a1a', t2: '#2ea8ff', alarm: '#ff2d2d' },
    { name: 'Неон: розовый и бирюзовый', frame: '#8a5cff', timer: '#fff200', t1: '#ff2fa0', t2: '#19f0d2', alarm: '#ff2d2d' },
    { name: 'Всё янтарным (монохромная панель)', frame: '#ffb000', timer: '#ffb000', t1: '#ffb000', t2: '#ffb000', alarm: '#ffb000' },
    { name: 'Всё зелёным (монохромная панель)', frame: '#00ff00', timer: '#00ff00', t1: '#00ff00', t2: '#00ff00', alarm: '#00ff00' },
    { name: 'Всё красным (монохромная панель)', frame: '#ff0000', timer: '#ff0000', t1: '#ff0000', t2: '#ff0000', alarm: '#ff0000' },
  ];

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

  // Relay results row above the score: "42 38 -" (one slot per participant). The scale is computed for 3 digits per slot
  function legsFit(N, cw, ch) {
    const none = { s: 0, h: 0 };
    if (!N) return none;
    const chars = 4 * N - 1;
    const s = Math.min(Math.floor(cw / (6 * chars - 1)), Math.floor((ch * 0.22) / 9));
    return s < 1 ? none : { s, h: 8 * s + Math.max(1, Math.floor(s / 2)) };
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
  function plan(W, H, m, rows, cols, n, sample, names, show, legsN) {
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
    const rf = legsFit(legsN, cw, ch);
    const dh = n ? fitDh(sample, cw, ch - nf.h - rf.h) : 0;
    return { rows, cols, timer: { x: m, y: m, w: aw, h: th }, cells, lines, nf, rf, dh, pad, line };
  }

  // Try all grids (single column, single row, square) and pick the one where the score ends up largest
  function bestPlan(W, H, m, n, sample, names, show, legsN) {
    if (n <= 1) return plan(W, H, m, 1, 1, n, sample, names, show, legsN);
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      if ((cols - 1) * rows >= n) continue;   // the last column would be empty
      const p = plan(W, H, m, rows, cols, n, sample, names, show, legsN);
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

  // Team color by index: even and odd teams get different colors
  const teamColor = (colors, i) => (i % 2 === 0 ? colors.t1 : colors.t2);

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
    const colors = st.colors || PALETTES[0];
    const round = st.rounded !== false;
    const f = st.frame !== false ? Math.max(1, Math.round(Math.min(W, H) * 0.02)) : 0;   // frame thickness
    const m = Math.max(1, Math.round(Math.min(W, H) * 0.04)) + f;
    const sample = '000';   // computed for 3 digits so the layout doesn't jump at 99 → 100
    const legsN = st.relay && st.relay.on ? st.relay.legs : 0;
    const L = bestPlan(W, H, m, n, sample, names, show, legsN);

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
      const h = nh + L.rf.h;   // height of the name and the relay results row
      const base = teamColor(colors, i + (st.colorOffset || 0));
      const nameCol = teams[i].nameColor || base, countCol = teams[i].countColor || base;   // colorOffset — a single-team display keeps that team's color
      if (s > 0 && names[i]) {
        const txt = names[i].slice(0, maxChars);
        const tw = txt.length * 6 * s - s;
        drawText(ctx, txt, c.x + Math.floor((c.w - tw) / 2), c.y, s, nameCol);
        cut[i] = names[i].length > maxChars;
      } else if (show && names[i]) {
        cut[i] = true;   // there is no room for names at all
      }
      // Relay: participants' results above the score; when time is up, the score below is the overall total
      let big = teams[i].reps ?? 0;
      if (legsN) {
        const lg = teams[i].legs || [];
        if (L.rf.s > 0) {
          const txt = Array.from({ length: legsN }, (_, k) => (lg[k] === undefined ? '-' : String(lg[k]))).join(' ');
          const tw = txt.length * 6 * L.rf.s - L.rf.s;
          drawText(ctx, txt, c.x + Math.max(0, Math.floor((c.w - tw) / 2)), c.y + nh, L.rf.s, countCol);
        }
        if (st.finished) big = teamTotal(st, teams[i]);   // during a leg — the participant's counter (from zero or from the current value), at the end — the overall total
      }
      // Single-team display: at the bottom of the cell — the "ЛИДЕР" (leader) line and the leader's score
      let lh = 0;
      if (st.leader && n === 1) {
        lh = Math.floor((c.h - h) * 0.36);
        const ls = Math.min(Math.floor(lh / 9), Math.floor((c.w * 0.45) / 29));
        if (ls >= 1) {
          // The label and the number form one group centered in the cell; the number width is computed for 3 digits so the group doesn't "wander"
          const ly = c.y + c.h - lh, tw = 29 * ls, gapL = 2 * ls;
          const ndh = Math.max(3, fitDh('000', c.w - tw - gapL, lh));
          const nw = Math.min(c.w - tw - gapL, geometry('000', ndh).total);
          const gx0 = c.x + Math.floor((c.w - (tw + gapL + nw)) / 2);
          drawText(ctx, 'ЛИДЕР', gx0, ly + Math.floor((lh - 7 * ls) / 2), ls, st.leader.color);
          drawNumber(ctx, String(st.leader.reps), gx0 + tw + gapL, ly, nw, lh, st.leader.color, round);
        } else lh = 0;
      }
      drawNumber(ctx, String(big), c.x, c.y + h, c.w, c.h - h - lh, countCol, round);
    });
    return { rows: L.rows, cols: L.cols, cut };
  }

  const KB = { PALETTES, teamTotal, relayLeg, draw, elapsedOf, secondsOf, fmt, isAlarm, teamColor, setClockOffset: (v) => { clockOffset = v; }, _font: FONT };
  if (typeof window !== 'undefined') window.KB = KB;
  if (typeof module !== 'undefined' && module.exports) module.exports = KB;
})();
