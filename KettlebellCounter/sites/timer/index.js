// Timekeeper panel: controls only the clock (start, pause, reset, mode, duration).
// Team scores are shown for viewing only.
const $ = (id) => document.getElementById(id);

let st = null;

const logo = $('logo');
const hideLogo = () => (logo.style.display = 'none');
logo.addEventListener('error', hideLogo);
if (logo.complete && logo.naturalWidth === 0) hideLogo();

function exit() { NET.setPIN(''); location.href = '/'; }

const send = (a) => NET.action(a);
const buzz = () => { try { navigator.vibrate && navigator.vibrate(15); } catch { } };

$('bToggle').onclick = () => { buzz(); send({ type: 'globalToggleTime' }); };
$('bReset').onclick = () => { buzz(); send({ type: 'globalResetTime' }); };
$('bExit').onclick = exit;
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => send({ type: 'globalSetMode', mode: b.dataset.mode })));
document.querySelectorAll('[data-sec]').forEach((b) => (b.onclick = () => send({ type: 'globalSetDuration', sec: +b.dataset.sec })));
document.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => send({ type: 'globalAdjustDuration', delta: +b.dataset.d })));

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); return; }   // the theme picker: arrows / Space belong to it
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    let a = null;
    switch (e.code) {
        case 'Space': case 'Enter': case 'NumpadEnter': if (!e.repeat) a = { type: 'globalToggleTime' }; break;
        case 'KeyR': if (!e.repeat) a = { type: 'globalResetTime' }; break;
        case 'KeyT': if (!e.repeat) a = { type: 'globalToggleMode' }; break;
        case 'ArrowLeft': a = { type: 'globalAdjustDuration', delta: e.shiftKey ? -10 : -60 }; break;
        case 'ArrowRight': a = { type: 'globalAdjustDuration', delta: e.shiftKey ? 10 : 60 }; break;
    }
    if (a) { e.preventDefault(); send(a); }
});
// Volume buttons: up — start / pause, down — reset the timer
window.onVolume = (dir) => {
    try { navigator.vibrate && navigator.vibrate(15); } catch { }
    send({ type: dir === 'up' ? 'globalToggleTime' : 'globalResetTime' });
};
// Buttons must not keep focus, otherwise Space fires twice
document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.blur(); });

function applyTeams() {
    const box = $('teams');
    box.textContent = '';
    if (!st.teams.length) { const d = document.createElement('div'); d.className = 'none'; d.textContent = 'Команд нет'; box.appendChild(d); return; }
    st.teams.forEach((t, i) => {
        const base = KB.teamColor(t, i);
        const row = document.createElement('div'); row.className = 'tm';
        const n = document.createElement('span'); n.className = 'n'; n.textContent = t.name || `Команда ${i + 1}`; n.style.color = t.nameColor || base;
        const s = document.createElement('span'); s.className = 's'; s.textContent = t.reps; s.style.color = t.countColor || base;
        row.append(n, s);
        box.appendChild(row);
    });
}

function apply() {
    if (!st) return;
    const idle = !st.running && st.elapsed === 0 && !st.finished;
    const paused = !st.running && !st.finished && st.elapsed > 0;

    const bt = $('bToggle');
    bt.textContent = st.running ? 'Пауза' : paused ? 'Продолжить' : 'Старт';
    bt.className = st.running ? 'warn' : 'go';
    bt.disabled = st.finished;
    $('bReset').disabled = st.running || idle;
    $('status').textContent = st.finished ? 'Время вышло' : st.running ? 'Идёт' : paused ? 'Пауза' : 'Готов';

    const rl = st.relay || { on: false, legs: 3 };
    const mode = rl.on ? 'relay' : st.mode;   // three modes: countdown / stopwatch / relay
    document.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('on', b.dataset.mode === mode); b.disabled = !idle; });
    const canSet = idle && st.mode === 'down';
    document.querySelectorAll('[data-sec], [data-d]').forEach((b) => (b.disabled = !canSet));
    $('setupHint').textContent = !idle ? 'Время и режим меняются только при сброшенном таймере.'
        : mode === 'up' ? 'В режиме секундомера время не задаётся.'
        : mode === 'relay' ? `Эстафета: общее время ${KB.fmt(st.duration)}, участников в команде — ${rl.legs} (задаёт администратор). Клавиши: ← → ±1 мин, Shift+← → ±10 с.`
        : 'Установлено: ' + KB.fmt(st.duration) + '. Клавиши: ← → ±1 мин, Shift+← → ±10 с.';

    const root = document.documentElement.style;
    root.setProperty('--timer', st.colors.timer);
    root.setProperty('--alarm', st.colors.alarm);
    applyTeams();
    tick();
}

function tick() {
    if (!st) return;
    const r = $('read');
    r.textContent = KB.fmt(KB.secondsOf(st));
    r.classList.toggle('alarm', KB.isAlarm(st));
}

NET.on('state', (s) => { st = s; apply(); });
NET.on('auth', exit);
NET.on('status', (ok) => {
    const el = $('conn');
    el.classList.toggle('off', !ok);
    el.textContent = ok ? 'на связи' : 'нет связи…';
});

(async () => {
    let r = { ok: false };
    if (NET.pin) {
        r = await NET.login(NET.pin);
        while (r.error) { await new Promise((ok) => setTimeout(ok, 2000)); r = await NET.login(NET.pin); }   // the server is unavailable — wait
    }
    if (!r.ok) return exit();
    if (r.role === 'admin') { location.href = '/adminpanel'; return; }
    if (r.role === 'team') { location.href = '/controller'; return; }
    NET.connect('timer');
    setInterval(tick, 100);
})();
