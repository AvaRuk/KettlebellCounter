// Team judge page: a large +1 / −1 counter for their own team.
const $ = (id) => document.getElementById(id);

let st = null;
let teamid = null;

const logo = $('logo');
const hideLogo = () => (logo.style.display = 'none');
logo.addEventListener('error', hideLogo);
if (logo.complete && logo.naturalWidth === 0) hideLogo();

function exit() { NET.setPIN(''); location.href = '/'; }

const send = (a) => NET.action(a);
const buzz = () => { try { navigator.vibrate && navigator.vibrate(15); } catch { } };

$('bUp').onclick = () => { buzz(); send({ type: 'localCountUp' }); };
$('bDown').onclick = () => { buzz(); send({ type: 'localCountDown' }); };
window.onVolume = (dir) => send({ type: dir === 'up' ? 'localCountUp' : 'localCountDown' }); // For integration mobile app
$('bReset').onclick = () => { if (confirm('Обнулить счёт команды?')) send({ type: 'localResetCounts' }); };
$('bExit').onclick = exit;
// The name goes to the display immediately as you type; when done, the field shows the cleaned-up version
$('name').oninput = () => send({ type: 'teamSetName', name: $('name').value });
$('name').onblur = () => apply();

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) send({ type: 'localCountUp' }); }
    else if (e.code === 'ArrowDown' || e.code === 'Backspace') { e.preventDefault(); if (!e.repeat) send({ type: 'localCountDown' }); }
});
// Buttons must not keep focus, otherwise Space fires twice
document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.blur(); });

function apply() {
    if (!st || teamid === null) return;
    const team = st.teams.find((t) => t.id === teamid);
    $('team').classList.toggle('hidden', !team);
    $('gone').classList.toggle('hidden', !!team);
    if (!team) return;

    const idx = st.teams.indexOf(team);
    const root = document.documentElement.style;
    root.setProperty('--c', team.countColor || KB.teamColor(st.colors, idx));
    $('name').style.color = team.nameColor || KB.teamColor(st.colors, idx);
    root.setProperty('--timer', st.colors.timer);
    root.setProperty('--alarm', st.colors.alarm);

    $('count').textContent = team.reps;
    if (document.activeElement !== $('name')) $('name').value = team.name;
    $('bReset').disabled = st.running;
    const paused = !st.running && !st.finished && st.elapsed > 0;
    const leg = st.relay && st.relay.on && !st.finished && (st.running || paused) ? ` · этап ${KB.relayLeg(st) + 1} из ${st.relay.legs}` : '';
    $('status').textContent = (st.finished ? 'Время вышло' : st.running ? 'Идёт' : paused ? 'Пауза' : 'Готов') + leg;
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
    // The admin can open this page too — send them to their panel
    if (r.role === 'admin') { location.href = '/adminpanel'; return; }
    if (r.role === 'timer') { location.href = '/timer'; return; }
    teamid = r.teamid;
    NET.connect('controller');
    setInterval(tick, 100);
})();
