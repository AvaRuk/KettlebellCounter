const $ = (id) => document.getElementById(id);
const send = (a) => NET.action(a);

let st = null;
let info = { displays: [], urls: [], pinRequired: false };
let connected = false;
let stacked = true;

const PREVIEW_SIZES = [[64, 128], [96, 192], [32, 64], [128, 64], [192, 64], [256, 128], [64, 64]];
const COLOR_KEYS = ['timer', 't1', 't2', 'alarm', 'frame'];

// ---------- Привязка элементов ----------
$('bToggle').onclick = () => send({ type: 'toggle' });
$('bReset').onclick = () => send({ type: 'reset' });
$('bResetCounts').onclick = () => send({ type: 'resetCounts' });
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => send({ type: 'setMode', mode: b.dataset.mode })));
document.querySelectorAll('[data-sec]').forEach((b) => (b.onclick = () => send({ type: 'setDuration', sec: +b.dataset.sec })));
document.querySelectorAll('[data-team]').forEach((b) => (b.onclick = () => send({ type: 'count', team: +b.dataset.team, delta: +b.dataset.d })));

const setDuration = () => send({ type: 'setDuration', sec: (+$('mm').value || 0) * 60 + (+$('ss').value || 0) });
$('mm').onchange = setDuration;
$('ss').onchange = setDuration;
[0, 1].forEach((t) => {
  $('c' + t).onchange = () => send({ type: 'setCount', team: t, value: +$('c' + t).value || 0 });
  // Название уходит на табло сразу, пока вы печатаете; по окончании поле показывает очищенный вариант
  $('n' + t).oninput = () => send({ type: 'setName', team: t, name: $('n' + t).value });
  $('n' + t).onblur = () => applyState();
});
$('showNames').onchange = () => send({ type: 'setShowNames', value: $('showNames').checked });
$('showFrame').onchange = () => send({ type: 'setFrame', value: $('showFrame').checked });
$('rounded').onchange = () => send({ type: 'setRounded', value: $('rounded').checked });

KB.PALETTES.forEach((p, i) => $('pal').add(new Option(p.name, i)));
$('pal').add(new Option('Свои цвета', -1));
$('pal').onchange = () => { const v = +$('pal').value; if (v >= 0) send({ type: 'setPal', pal: v }); };
COLOR_KEYS.forEach((k) => ($('col-' + k).oninput = () => send({ type: 'setColor', key: k, value: $('col-' + k).value })));

// Размер превью: по умолчанию как у подключённого табло, иначе один из типовых размеров панелей
$('previewSize').add(new Option('Как у подключённого табло', 'auto'));
PREVIEW_SIZES.forEach(([w, h]) => $('previewSize').add(new Option(`${w}×${h}`, `${w}x${h}`)));
try { $('previewSize').value = localStorage.getItem('kbPreview') || 'auto'; } catch {}
if (!$('previewSize').value) $('previewSize').value = 'auto';
$('previewSize').onchange = () => { try { localStorage.setItem('kbPreview', $('previewSize').value); } catch {} tick(); };

// Кнопки не должны удерживать фокус, иначе Пробел сработает дважды
document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.blur(); });

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT') {
    if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
    return;
  }
  const a = KB.keyToAction(e);
  if (a) { e.preventDefault(); send(a); }
});

// ---------- Отображение состояния ----------
function applyState() {
  if (!st) return;
  const idle = !st.running && st.elapsed === 0 && !st.finished;
  const paused = !st.running && !st.finished && st.elapsed > 0;

  const bt = $('bToggle');
  bt.textContent = st.running ? 'Пауза' : paused ? 'Продолжить' : 'Старт';
  bt.className = st.running ? 'warn' : 'go';
  bt.disabled = st.finished;
  $('bReset').disabled = st.running || idle;
  $('bResetCounts').disabled = st.running;
  $('status').textContent = st.finished ? 'Время вышло' : st.running ? 'Идёт' : paused ? 'Пауза' : 'Готов';

  document.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('on', b.dataset.mode === st.mode); b.disabled = !idle; });
  const canSet = idle && st.mode === 'down';
  document.querySelectorAll('[data-sec]').forEach((b) => (b.disabled = !canSet));
  $('mm').disabled = $('ss').disabled = !canSet;
  if (document.activeElement !== $('mm')) $('mm').value = Math.floor(st.duration / 60);
  if (document.activeElement !== $('ss')) $('ss').value = String(st.duration % 60);

  [0, 1].forEach((t) => {
    if (document.activeElement !== $('c' + t)) $('c' + t).value = st.count[t];
    if (document.activeElement !== $('n' + t)) $('n' + t).value = st.names[t];
  });
  $('showNames').checked = st.showNames;
  $('showFrame').checked = st.frame !== false;
  $('rounded').checked = st.rounded !== false;

  const c = st.colors;
  $('pal').value = KB.PALETTES.findIndex((p) => p.timer === c.timer && p.t1 === c.t1 && p.t2 === c.t2 && p.frame === c.frame);
  COLOR_KEYS.forEach((k) => { if (document.activeElement !== $('col-' + k)) $('col-' + k).value = c[k]; });
  const root = document.documentElement.style;
  root.setProperty('--timer', c.timer); root.setProperty('--frame', c.frame); root.setProperty('--alarm', c.alarm);
  root.setProperty('--t1', c.t1); root.setProperty('--t2', c.t2);
  tick();
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');   // запасной способ: страница открыта по IP без https
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch {}
  ta.remove();
}

function applyInfo() {
  const ds = info.displays;
  const list = $('displays');
  list.innerHTML = '';
  if (!ds.length) {
    const li = document.createElement('li'); li.className = 'none'; li.textContent = 'Табло не подключено'; list.appendChild(li);
  } else {
    ds.forEach((d, i) => {
      const li = document.createElement('li');
      li.textContent = `Табло ${i + 1}: ${d.w ? `${d.w}×${d.h} пикселей` : 'подключается…'}`;
      list.appendChild(li);
    });
  }

  const urls = $('urls');
  urls.innerHTML = '';
  const addrs = info.urls.length ? info.urls : [`${location.origin}/display`];
  addrs.forEach((u) => {
    const row = document.createElement('div'); row.className = 'url';
    const code = document.createElement('code'); code.textContent = u;
    const copy = document.createElement('button'); copy.textContent = 'Копировать';
    copy.onclick = () => { copyText(u); copy.textContent = 'Скопировано'; setTimeout(() => (copy.textContent = 'Копировать'), 1500); };
    const open = document.createElement('a'); open.href = u; open.target = '_blank'; open.textContent = 'Открыть';
    row.append(code, copy, open);
    urls.appendChild(row);
  });
  tick();
}

function previewSize() {
  const v = $('previewSize').value;
  if (v !== 'auto') { const [w, h] = v.split('x').map(Number); return { w, h, real: false }; }
  const d = info.displays.find((x) => x.w > 0);
  return d ? { w: d.w, h: d.h, real: true } : { w: 64, h: 128, real: false };
}

// Таймер и превью обновляются часто, остальное — по событиям
function tick() {
  if (!st) return;
  const r = $('read');
  r.textContent = KB.fmt(KB.secondsOf(st));
  r.classList.toggle('alarm', KB.isAlarm(st));

  const { w, h, real } = previewSize();
  $('dim').textContent = real ? `Размер табло: ${w}×${h} пикселей` : `Превью ${w}×${h} (табло не подключено или выбран свой размер)`;
  const res = KB.draw($('preview'), st, w, h);
  stacked = res.stacked;
  [0, 1].forEach((t) => $('x' + t).classList.toggle('hidden', !res.cut[t]));
  const boxW = $('previewBox').clientWidth - 22, boxH = Math.max(160, window.innerHeight * 0.4);
  const k = Math.min(boxW / w, boxH / h);
  $('preview').style.width = Math.max(1, Math.floor(w * k)) + 'px';
  $('preview').style.height = Math.max(1, Math.floor(h * k)) + 'px';
  $('w0').textContent = stacked ? 'вверху' : 'слева';
  $('w1').textContent = stacked ? 'внизу' : 'справа';
}

NET.on('state', (s) => { st = s; applyState(); });
NET.on('info', (i) => { info = i; applyInfo(); });
NET.on('status', (ok) => {
  connected = ok;
  const el = $('conn');
  el.classList.toggle('off', !ok);
  el.textContent = ok ? 'пульт управления табло' : 'нет связи с сервером…';
});
NET.connect('control');
setInterval(tick, 100);
window.addEventListener('resize', tick);
