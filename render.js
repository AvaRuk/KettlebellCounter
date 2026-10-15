// Общий код: отрисовка сцены для LED-панели и клавиатурные команды.
// Подключается и на странице табло, и на странице пульта (там — для превью); сервер берёт отсюда список цветовых схем.
(function () {
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const U_DIGIT = 0.55, U_COLON = 0.17, U_GAP = 0.16;   // в долях высоты цифры

  // Насыщенные цвета: на светодиодах полутона не читаются, зато тёплые и холодные оттенки хорошо различимы
  const PALETTES = [
    // Тема ТГАСУ: фирменный малиновый E5007D и синий. Тёмный синий на чёрном фоне панели не виден,
    // поэтому для табло синий взят ярче — при необходимости поправьте под брендбук.
    { name: 'ТГАСУ: малиновый и синий', frame: '#1f5fff', timer: '#ffffff', t1: '#e5007d', t2: '#3d9bff', alarm: '#ff3b30' },
    { name: 'Классика: янтарь, зелёный, голубой', frame: '#ffc400', timer: '#ffc400', t1: '#3cff7a', t2: '#3cc8ff', alarm: '#ff2d2d' },
    { name: 'Огонь и лёд: оранжевый и синий', frame: '#ffffff', timer: '#ffffff', t1: '#ff6a1a', t2: '#2ea8ff', alarm: '#ff2d2d' },
    { name: 'Неон: розовый и бирюзовый', frame: '#8a5cff', timer: '#fff200', t1: '#ff2fa0', t2: '#19f0d2', alarm: '#ff2d2d' },
    { name: 'Всё янтарным (монохромная панель)', frame: '#ffb000', timer: '#ffb000', t1: '#ffb000', t2: '#ffb000', alarm: '#ffb000' },
    { name: 'Всё зелёным (монохромная панель)', frame: '#00ff00', timer: '#00ff00', t1: '#00ff00', t2: '#00ff00', alarm: '#00ff00' },
    { name: 'Всё красным (монохромная панель)', frame: '#ff0000', timer: '#ff0000', t1: '#ff0000', t2: '#ff0000', alarm: '#ff0000' },
  ];

  // ---------- Пиксельный шрифт 5×7 (латиница, кириллица, цифры) ----------
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
  // Кириллические буквы, совпадающие по начертанию с латинскими
  const ALIAS = { 'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y' };

  // Готовим глифы: для каждой строки — список отрезков [столбец, длина], чтобы рисовать меньше прямоугольников
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
  const glyph = (ch) => GLYPHS[ch] || GLYPHS[ALIAS[ch]] || null;

  // Рисует строку пиксельным шрифтом, каждая «точка» — квадрат s×s. Шаг букв: 6·s
  function drawText(ctx, str, x, y, s, color) {
    ctx.fillStyle = color;
    for (const ch of str) {
      const g = glyph(ch);
      if (g) for (let r = 0; r < 7; r++) for (const [c, n] of g[r]) ctx.fillRect(x + c * s, y + r * s, n * s, s);
      x += 6 * s;
    }
  }

  // Какой целый масштаб шрифта влезает в ячейку команды (не больше ~30% её высоты)
  function nameFit(names, cw, ch, show) {
    const none = { s: 0, h: 0, maxChars: 0 };
    if (!show) return none;
    const n = Math.max(names[0].length, names[1].length);
    if (n === 0) return none;
    let sH = 0;
    for (let s = 1; s <= 40; s++) { if (8 * s > ch * 0.3) break; sH = s; }
    if (sH === 0) return none;
    const sW = Math.floor(cw / (6 * n - 1));
    const s = Math.min(sH, Math.max(1, sW));
    const maxChars = Math.floor((cw + s) / (6 * s));
    if (maxChars < 1) return none;
    return { s, h: 8 * s, maxChars };
  }

  // ---------- Семисегментные цифры ----------
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

  // ---------- Скруглённые цифры ----------
  // Цифра рисуется штрихами с круглыми концами и углами, затем жёстко бинаризуется (без полутонов),
  // чтобы на панели остались только полностью включённые или выключенные пиксели.
  // Результат кэшируется: на каждом кадре цифры просто копируются.
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
  // Кэш ограничен по площади, чтобы при перетаскивании размера окна память не росла
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

  // Рамка вокруг табло: со скруглёнными углами (как и цифры) или обычная
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

  // Цифры: скруглённые (по умолчанию) или классические из прямоугольников
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

  // Раскладка: таймер сверху; команды друг под другом (вертикальная панель) или рядом (горизонтальная).
  // В каждой ячейке команды сверху название, под ним счёт.
  function plan(W, H, m, stacked, sample, names, show) {
    const aw = W - 2 * m;
    const tMax = Math.round(H * (stacked ? 0.28 : 0.36)) - m;
    const th = Math.max(0, Math.min(tMax, fitDh('00:00', aw, H)));
    const by = m + th + m, bh = H - by - m;
    const line = Math.max(1, Math.round(Math.min(W, H) * 0.02));
    const pad = Math.max(1, Math.round(m / 2));
    let c1, c2, ln;
    if (stacked) {
      const ch = Math.floor((bh - line - 2 * pad) / 2);
      c1 = { x: m, y: by, w: aw, h: ch };
      ln = { x: m, y: by + ch + pad, w: aw, h: line };
      c2 = { x: m, y: by + ch + 2 * pad + line, w: aw, h: ch };
    } else {
      const cw = Math.floor((aw - line - 2 * pad) / 2);
      c1 = { x: m, y: by, w: cw, h: bh };
      ln = { x: m + cw + pad, y: by, w: line, h: bh };
      c2 = { x: m + cw + 2 * pad + line, y: by, w: cw, h: bh };
    }
    const nf = nameFit(names, c1.w, c1.h, show);
    return { stacked, timer: { x: m, y: m, w: aw, h: th }, c1, c2, ln, nf, dh: fitDh(sample, c1.w, c1.h - nf.h) };
  }

  // ---------- Время ----------
  // Таймер считается по времени сервера: net.js вычисляет поправку к часам этого компьютера
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

  // Рисует сцену в canvas размером W×H.
  // Возвращает { stacked, cut }: stacked — команды друг под другом; cut[i] — название i-й команды обрезано или скрыто
  function draw(canvas, st, W, H) {
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const names = [String(st.names?.[0] ?? ''), String(st.names?.[1] ?? '')];
    const show = st.showNames !== false;
    const colors = st.colors || PALETTES[0];
    const round = st.rounded !== false;
    const f = st.frame !== false ? Math.max(1, Math.round(Math.min(W, H) * 0.02)) : 0;   // толщина рамки
    const m = Math.max(1, Math.round(Math.min(W, H) * 0.04)) + f;
    const sample = '000';   // считаем под 3 цифры, чтобы раскладка не прыгала при 99 → 100
    const a = plan(W, H, m, true, sample, names, show), b = plan(W, H, m, false, sample, names, show);
    const L = b.dh > a.dh ? b : a;

    const blink = Math.floor(now() / 500) % 2 === 0;
    const paused = !st.running && !st.finished && st.elapsed > 0;

    if (!(st.finished || paused) || blink) {
      const t = L.timer;
      drawNumber(ctx, fmt(secondsOf(st)), t.x, t.y, t.w, t.h, isAlarm(st) ? colors.alarm : colors.timer, round);
    }
    // Рамка и разделитель — фирменный цвет; когда время вышло, рамка загорается цветом тревоги
    drawFrame(ctx, W, H, f, st.finished ? colors.alarm : (colors.frame || colors.timer), round);
    ctx.fillStyle = colors.frame || colors.timer;
    ctx.fillRect(L.ln.x, L.ln.y, L.ln.w, L.ln.h);

    const cut = [false, false];
    [L.c1, L.c2].forEach((c, i) => {
      const { s, h, maxChars } = L.nf;
      if (s > 0 && names[i]) {
        const txt = names[i].slice(0, maxChars);
        const tw = txt.length * 6 * s - s;
        drawText(ctx, txt, c.x + Math.floor((c.w - tw) / 2), c.y, s, i === 0 ? colors.t1 : colors.t2);
        cut[i] = names[i].length > maxChars;
      } else if (show && names[i]) {
        cut[i] = true;   // места на названия нет совсем
      }
      drawNumber(ctx, String(st.count[i]), c.x, c.y + h, c.w, c.h - h, i === 0 ? colors.t1 : colors.t2, round);
    });
    return { stacked: L.stacked, cut };
  }

  // ---------- Клавиши (одинаково в обоих окнах) ----------
  function keyToAction(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return null;
    const c = e.code;
    const arrows = c === 'ArrowLeft' || c === 'ArrowRight';
    if (e.repeat && !arrows) return null;
    switch (c) {
      case 'Space': case 'Enter': case 'NumpadEnter': return { type: 'toggle' };
      case 'KeyQ': case 'Numpad7': return { type: 'count', team: 0, delta: 1 };
      case 'KeyA': case 'Numpad1': return { type: 'count', team: 0, delta: -1 };
      case 'KeyP': case 'Numpad9': return { type: 'count', team: 1, delta: 1 };
      case 'KeyL': case 'Numpad3': return { type: 'count', team: 1, delta: -1 };
      case 'Delete': return { type: 'resetCounts' };
      case 'KeyR': return { type: 'reset' };
      case 'KeyT': return { type: 'toggleMode' };
      case 'KeyC': return { type: 'cyclePal' };
      case 'ArrowLeft': return { type: 'adjust', delta: e.shiftKey ? -10 : -60 };
      case 'ArrowRight': return { type: 'adjust', delta: e.shiftKey ? 10 : 60 };
    }
    return null;
  }

  const KB = { PALETTES, draw, elapsedOf, secondsOf, fmt, isAlarm, keyToAction, setClockOffset: (v) => { clockOffset = v; }, _font: FONT };
  if (typeof window !== 'undefined') window.KB = KB;
  if (typeof module !== 'undefined' && module.exports) module.exports = KB;
})();
