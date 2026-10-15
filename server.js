// Сервер табло: хранит состояние, раздаёт страницы «пульт» и «табло» по сети.
// Запуск:  node server.js   (необязательно: --port=3000 --pin=1234)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PALETTES } = require('./render.js');   // общий список цветовых схем

const args = process.argv.slice(2);
const getArg = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const PORT = Number(getArg('port') || process.env.PORT || 3000);
const PIN = String(getArg('pin') || process.env.PIN || '');   // если задан — управлять можно только с PIN-кодом

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Настройки (сохраняются рядом с сервером) ----------
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { settings = {}; }
let saveTimer = null;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch {} }, 400);
}

// ---------- Состояние: единый источник правды для всех страниц ----------
const COLOR_KEYS = ['timer', 't1', 't2', 'alarm', 'frame'];
const HEX = /^#[0-9a-f]{6}$/i;
function presetColors(i) { const { timer, t1, t2, alarm, frame } = PALETTES[i]; return { timer, t1, t2, alarm, frame }; }
const sameScheme = (c, p) => c.timer === p.timer && c.t1 === p.t1 && c.t2 === p.t2 && c.frame === p.frame;

const S = {
  count: [0, 0], running: false, finished: false, elapsed: 0, startedAt: 0, duration: 600, mode: 'down',
  colors: presetColors(0), rounded: true, frame: true,
  names: ['КОМАНДА 1', 'КОМАНДА 2'], showNames: true,
};

// Названия рисуются пиксельным шрифтом, поэтому оставляем только поддерживаемые символы
const MAX_NAME = 14;
function cleanName(v) {
  return String(v ?? '')
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/[^A-ZА-Я0-9 \-.,'!+:/()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

if (settings.duration) S.duration = clamp(settings.duration, 10, 99 * 60 + 59);
if (settings.mode === 'up' || settings.mode === 'down') S.mode = settings.mode;
if (Array.isArray(settings.names)) S.names = [cleanName(settings.names[0]), cleanName(settings.names[1])];
if (typeof settings.showNames === 'boolean') S.showNames = settings.showNames;
if (settings.colors && COLOR_KEYS.every((k) => HEX.test(settings.colors[k]))) S.colors = { ...settings.colors };
if (typeof settings.rounded === 'boolean') S.rounded = settings.rounded;
if (typeof settings.frame === 'boolean') S.frame = settings.frame;

const elapsedNow = () => S.elapsed + (S.running ? Date.now() - S.startedAt : 0);
const isIdle = () => !S.running && S.elapsed === 0 && !S.finished;

function handle(a) {
  switch (a.type) {
    case 'toggle':
      if (S.finished) break;
      if (S.running) { S.elapsed = elapsedNow(); S.running = false; }
      else { S.startedAt = Date.now(); S.running = true; }
      break;
    case 'reset':
      if (!S.running) { S.elapsed = 0; S.finished = false; }
      break;
    case 'count':
      if ((a.team === 0 || a.team === 1) && Number.isFinite(a.delta))
        S.count[a.team] = clamp(S.count[a.team] + (a.delta > 0 ? 1 : -1), 0, 999);
      break;
    case 'setCount':
      if ((a.team === 0 || a.team === 1) && Number.isFinite(a.value)) S.count[a.team] = clamp(Math.round(a.value), 0, 999);
      break;
    case 'resetCounts':
      if (!S.running) S.count = [0, 0];
      break;
    case 'setDuration':
      if (isIdle() && Number.isFinite(a.sec)) { S.duration = clamp(Math.round(a.sec), 10, 99 * 60 + 59); settings.duration = S.duration; }
      break;
    case 'adjust':
      if (isIdle() && S.mode === 'down' && Number.isFinite(a.delta)) { S.duration = clamp(S.duration + a.delta, 10, 99 * 60 + 59); settings.duration = S.duration; }
      break;
    case 'setMode':
      if (isIdle() && (a.mode === 'down' || a.mode === 'up')) { S.mode = a.mode; settings.mode = S.mode; }
      break;
    case 'toggleMode':
      if (isIdle()) { S.mode = S.mode === 'down' ? 'up' : 'down'; settings.mode = S.mode; }
      break;
    case 'setName':
      if (a.team === 0 || a.team === 1) { S.names[a.team] = cleanName(a.name); settings.names = S.names; }
      break;
    case 'setShowNames':
      S.showNames = !!a.value; settings.showNames = S.showNames;
      break;
    case 'setPal':
      if (Number.isInteger(a.pal) && PALETTES[a.pal]) { S.colors = presetColors(a.pal); settings.colors = S.colors; }
      break;
    case 'cyclePal': {
      const cur = PALETTES.findIndex((p) => sameScheme(S.colors, p));
      S.colors = presetColors((cur + 1) % PALETTES.length); settings.colors = S.colors;
      break;
    }
    case 'setColor':
      if (COLOR_KEYS.includes(a.key) && HEX.test(a.value)) {
        S.colors = { ...S.colors, [a.key]: a.value.toLowerCase() }; settings.colors = S.colors;
      }
      break;
    case 'setRounded':
      S.rounded = !!a.value; settings.rounded = S.rounded;
      break;
    case 'setFrame':
      S.frame = !!a.value; settings.frame = S.frame;
      break;
    default:
      return false;
  }
  saveSettings();
  broadcast('state', S);
  return true;
}

// Таймер заканчивается на сервере — все экраны видят одно и то же
setInterval(() => {
  if (S.running && S.mode === 'down' && elapsedNow() >= S.duration * 1000) {
    S.elapsed = S.duration * 1000; S.running = false; S.finished = true;
    broadcast('state', S);
  }
}, 100);

// ---------- Подключённые страницы (SSE) ----------
const clients = new Set();        // { res, role, id }
const displays = new Map();       // id -> { w, h }

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${PORT}/display`);
  return out;
}
const getInfo = () => ({
  displays: [...displays.entries()].map(([id, d]) => ({ id, w: d.w, h: d.h })),
  urls: lanUrls(),
  pinRequired: !!PIN,
});
function write(c, event, data) { try { c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} }
function broadcast(event, data, role) { for (const c of clients) if (!role || c.role === role) write(c, event, data); }
const broadcastInfo = () => broadcast('info', getInfo(), 'control');

setInterval(() => { for (const c of clients) { try { c.res.write(': ping\n\n'); } catch {} } }, 15000);

// ---------- HTTP ----------
const FILES = {
  '/': 'control.html', '/control': 'control.html', '/display': 'display.html',
  '/render.js': 'render.js', '/net.js': 'net.js', '/control.js': 'control.js', '/display.js': 'display.js',
  '/logo.png': 'logo.png',
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  try {
    if (req.method === 'GET' && p === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      const c = { res, role: url.searchParams.get('role') === 'display' ? 'display' : 'control', id: String(url.searchParams.get('id') || '').slice(0, 32) };
      clients.add(c);
      if (c.role === 'display' && c.id) displays.set(c.id, { w: 0, h: 0 });
      write(c, 'state', S);
      broadcastInfo();   // пульты, включая этот, получают актуальный список табло
      req.on('close', () => {
        clients.delete(c);
        if (c.role === 'display' && c.id && ![...clients].some((x) => x.id === c.id && x.role === 'display')) displays.delete(c.id);
        broadcastInfo();
      });
      return;
    }

    if (req.method === 'GET' && p === '/api/time') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ t: Date.now() }));
    }

    if (req.method === 'GET' && p === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ state: S, info: getInfo() }));
    }

    if (req.method === 'POST' && p === '/api/action') {
      if (PIN && req.headers['x-pin'] !== PIN) { res.writeHead(401); return res.end(); }
      const a = await readBody(req);
      const ok = a && typeof a === 'object' && handle(a);
      res.writeHead(ok ? 204 : 400); return res.end();
    }

    if (req.method === 'POST' && p === '/api/display-size') {
      const b = await readBody(req);
      const d = displays.get(String(b.id || ''));
      if (d && Number.isFinite(b.w) && Number.isFinite(b.h)) { d.w = clamp(Math.round(b.w), 0, 16384); d.h = clamp(Math.round(b.h), 0, 16384); broadcastInfo(); }
      res.writeHead(204); return res.end();
    }

    if (req.method === 'GET' && FILES[p]) {
      const file = path.join(__dirname, FILES[p]);
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
      return;
    }

    res.writeHead(404); res.end('Not found');
  } catch {
    if (!res.headersSent) res.writeHead(400);
    res.end();
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\nПорт ${PORT} уже занят. Закройте другую копию или запустите: node server.js --port=3001\n`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  Гиревой спорт — табло запущено\n');
  console.log(`  Пульт (на этом компьютере):  http://localhost:${PORT}/control`);
  const urls = lanUrls();
  if (urls.length) urls.forEach((u) => console.log(`  Табло (на компьютере панели): ${u}`));
  else console.log('  Сеть не найдена: подключитесь к Wi-Fi или кабелю, затем перезапустите.');
  if (PIN) console.log('\n  Управление защищено PIN-кодом.');
  console.log('\n  Остановить: Ctrl+C\n');
});
