// Admin panel (head judge): timer, teams, display appearance.
const $ = (id) => document.getElementById(id);
const send = (a) => NET.action(a);

let st = null;
let info = { displays: [], urls: [], controllerUrls: [], ifaces: [] };

const COLOR_KEYS = ['timer', 'alarm', 'frame', 'line'];
const MAX_TEAMS = 8;

// The logo is optional: if there is no logo.png file, hide the image
const logo = $('logo');
const hideLogo = () => (logo.style.display = 'none');
logo.addEventListener('error', hideLogo);
if (logo.complete && logo.naturalWidth === 0) hideLogo();

function exit() { NET.setPIN(''); location.href = '/'; }

// ---------- Element bindings ----------
$('bToggle').onclick = () => send({ type: 'globalToggleTime' });
$('bReset').onclick = () => send({ type: 'globalResetTime' });
$('bResetCounts').onclick = () => send({ type: 'globalResetCounts' });
$('bAddTeam').onclick = () => send({ type: 'teamAdd' });
$('bExit').onclick = exit;
$('bTimerPin').onclick = () => { if (confirm('Выдать хронометристу новый PIN? Старый перестанет работать.')) send({ type: 'timerNewPIN' }); };
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => send({ type: 'globalSetMode', mode: b.dataset.mode })));
document.querySelectorAll('[data-sec]').forEach((b) => (b.onclick = () => send({ type: 'globalSetDuration', sec: +b.dataset.sec })));

const setDuration = () => send({ type: 'globalSetDuration', sec: (+$('mm').value || 0) * 60 + (+$('ss').value || 0) });
$('mm').onchange = setDuration;
$('ss').onchange = setDuration;

// Relay is one of the three timer modes (buttons with data-mode); here — only its settings, shown while the mode is selected
const sendRelay = () => send({ type: 'globalSetRelay', on: true, legs: +$('rLegs').value || 3, carry: $('rCarry').value === '1' });
$('rLegs').onchange = $('rCarry').onchange = sendRelay;

$('showNames').onchange = () => send({ type: 'globalSetShowNames', value: $('showNames').checked });
$('showLeader').onchange = () => send({ type: 'globalSetShowLeader', value: $('showLeader').checked });
$('legsPos').onchange = () => send({ type: 'globalSetLegsPos', value: $('legsPos').value });
$('leaderPos').onchange = () => send({ type: 'globalSetLeaderPos', value: $('leaderPos').value });
$('showFrame').onchange = () => send({ type: 'globalSetFrame', value: $('showFrame').checked });
$('rounded').onchange = () => send({ type: 'globalSetRounded', value: $('rounded').checked });

COLOR_KEYS.forEach((k) => ($('col-' + k).oninput = () => send({ type: 'globalSetColor', key: k, value: $('col-' + k).value })));

// Changing the admin PIN
$('bSetPin').onclick = async () => {
    const p = $('newPin').value.trim();
    const note = $('pinNote');
    note.classList.remove('bad');
    if (!/^[0-9A-Za-z]{4,12}$/.test(p)) { note.classList.add('bad'); note.textContent = 'PIN: 4–12 латинских букв или цифр'; return; }
    if (await send({ type: 'globalSetPIN', newPIN: p })) {
        NET.setPIN(p);
        note.textContent = 'PIN изменён';
        setTimeout(() => location.reload(), 600);   // reconnect with the new PIN
    } else {
        note.classList.add('bad');
        note.textContent = 'Не удалось: такой PIN уже занят командой';
    }
};

// Buttons must not keep focus, otherwise Space fires twice
document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.blur(); });

// Admin panel hotkeys
function keyToAction(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return null;
    const c = e.code;
    const arrows = c === 'ArrowLeft' || c === 'ArrowRight';
    if (e.repeat && !arrows) return null;
    const digit = /^(?:Digit|Numpad)([1-8])$/.exec(c);
    if (digit) {
        const t = st && st.teams[+digit[1] - 1];
        return t ? { type: e.shiftKey ? 'localCountDown' : 'localCountUp', teamid: t.id } : null;
    }
    switch (c) {
        case 'Space': case 'Enter': case 'NumpadEnter': return { type: 'globalToggleTime' };
        case 'Delete': return { type: 'globalResetCounts' };
        case 'KeyR': return { type: 'globalResetTime' };
        case 'KeyT': return { type: 'globalToggleMode' };
        case 'ArrowLeft': return { type: 'globalAdjustDuration', delta: e.shiftKey ? -10 : -60 };
        case 'ArrowRight': return { type: 'globalAdjustDuration', delta: e.shiftKey ? 10 : 60 };
    }
    return null;
}
document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') {
        if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
        return;
    }
    const a = keyToAction(e);
    if (a) { e.preventDefault(); send(a); }
});

// ---------- Team cards ----------
const cards = new Map();   // id -> { el, ...elements }

function makeCard(t) {
    const el = document.createElement('article');
    el.className = 'team';
    el.innerHTML = `
        <div class="team-head"><h2></h2><button class="rm" title="Удалить команду">✕</button></div>
        <p class="where"></p>
        <input class="name" type="text" maxlength="14" spellcheck="false" placeholder="Название" autocomplete="off">
        <p class="cut hidden">На панели не помещается целиком</p>
        <input class="count" type="number" min="0" max="999" value="0">
        <div class="row"><button class="dn">−1</button><button class="go up">+1</button></div>
        <p class="keys"></p>
        <p class="tcolors"><label>Цвет названия <input type="color" class="cn"></label><label>Цвет счёта <input type="color" class="cc"></label><button class="cr" title="Вернуть цвета команды по умолчанию">Сбросить</button></p>
        <p class="tcolors"><label>Огранка на общем табло <input type="color" class="ce"></label><button class="cer" title="Убрать огранку">Убрать</button></p>
        <p class="tcolors"><span>Табло команды:</span><label>Таймер <input type="color" class="dc" data-k="timer"></label><label>Рамка <input type="color" class="dc" data-k="frame"></label><label>Тревога <input type="color" class="dc" data-k="alarm"></label></p>
        <p class="pins tbl"><span>Табло команды:</span><a class="tlink" target="_blank">Открыть</a><button class="tcopy">Копировать адрес</button></p>
        <p class="pins">PIN команды: <span class="pinbox"></span><button class="newpin">Новый PIN</button></p>`;
    const q = (s) => el.querySelector(s);
    const c = {
        el, title: q('h2'), where: q('.where'), name: q('.name'), cut: q('.cut'), count: q('.count'),
        keys: q('.keys'), pin: q('.pinbox'), link: q('.tlink'), cn: q('.cn'), cc: q('.cc'), cr: q('.cr'), ce: q('.ce'), cer: q('.cer')
    };
    c.cn.oninput = () => send({ type: 'teamSetColor', teamid: t.id, part: 'name', value: c.cn.value });
    c.cc.oninput = () => send({ type: 'teamSetColor', teamid: t.id, part: 'count', value: c.cc.value });
    c.ce.oninput = () => send({ type: 'teamSetEdge', teamid: t.id, value: c.ce.value });
    c.cer.onclick = () => send({ type: 'teamSetEdge', teamid: t.id, value: null });
    c.dcs = [...el.querySelectorAll('.dc')];
    c.dcs.forEach((i) => (i.oninput = () => send({ type: 'teamSetDisplayColor', teamid: t.id, key: i.dataset.k, value: i.value })));
    c.cr.onclick = () => {
        ['timer', 'frame', 'alarm'].forEach((k) => send({ type: 'teamSetDisplayColor', teamid: t.id, key: k, value: null })); send({ type: 'teamSetColor', teamid: t.id, part: 'name', value: null }); send({ type: 'teamSetColor', teamid: t.id, part: 'count', value: null }); send({ type: 'teamSetEdge', teamid: t.id, value: null }); };
    q('.tcopy').onclick = (ev) => {
        copyText(c.link.href); ev.target.textContent = 'Скопировано'; setTimeout(() => (ev.target.textContent = 'Копировать адрес'), 1500);
    };
    q('.rm').onclick = () => {
        const nm = c.name.value || c.title.textContent;
        if (confirm(`Удалить команду «${nm}»?`)) send({ type: 'teamRemove', teamid: t.id });
    };
    q('.dn').onclick = () => send({ type: 'localCountDown', teamid: t.id });
    q('.up').onclick = () => send({ type: 'localCountUp', teamid: t.id });
    q('.newpin').onclick = () => { if (confirm('Выдать команде новый PIN? Старый перестанет работать.')) send({ type: 'teamNewPIN', teamid: t.id }); };
    c.count.onchange = () => send({ type: 'localSetCount', teamid: t.id, value: +c.count.value || 0 });
    // The name goes to the display immediately as you type; when done, the field shows the cleaned-up version
    c.name.oninput = () => send({ type: 'teamSetName', teamid: t.id, name: c.name.value });
    c.name.onblur = () => applyState();
    return c;
}

// ---------- Address (IP) used in the links ----------
// The computer may have several adapters (Wi-Fi, cable, VPN, virtual) — the user picks the one the displays can reach.
// By default — the first one. The choice is remembered on this device and is shared by the generator, team cards and the login address.
const HOST_KEY = 'kbHost';
let chosenBase = '';
try { chosenBase = localStorage.getItem(HOST_KEY) || ''; } catch { }

function hostOptions() {
    const src = info.ifaces && info.ifaces.length
        ? info.ifaces
        : (info.base || []).map((u) => ({ url: u, address: u.replace(/^https?:\/\//, ''), name: '' }));
    const list = src.map((i) => ({ url: i.url, label: i.name ? `${i.address} — ${i.name}` : i.address }));
    if (!list.some((o) => o.url === location.origin)) list.push({ url: location.origin, label: `${location.host} — адрес этой страницы` });
    return list;
}
const displayBase = () => { const o = hostOptions(); return (o.find((x) => x.url === chosenBase) || o[0]).url; };

function applyHosts() {
    const sel = $('gHost'), opts = hostOptions(), key = JSON.stringify(opts);
    if (sel.dataset.key !== key) { sel.textContent = ''; opts.forEach((o) => sel.add(new Option(o.label, o.url))); sel.dataset.key = key; }
    sel.value = displayBase();
}
function refreshLinks() {
    if (st) { applyTeams(); applyGenerator(); }
    $('ctlUrl').textContent = displayBase() + '/';
}

function applyTeams() {
    const box = $('teams');
    const ids = new Set(st.teams.map((t) => t.id));
    for (const [id, c] of cards) if (!ids.has(id)) { c.el.remove(); cards.delete(id); }
    st.teams.forEach((t, i) => {
        let c = cards.get(t.id);
        if (!c) { c = makeCard(t); cards.set(t.id, c); }
        if (box.children[i] !== c.el) box.insertBefore(c.el, box.children[i] || null);   // same order as on the display
        const base = KB.teamColor(t, i);
        const nameCol = t.nameColor || base, countCol = t.countColor || base;
        c.el.style.setProperty('--c', countCol);
        c.el.style.setProperty('--c-ink', KB.ink(countCol));
        c.name.style.color = nameCol;
        if (document.activeElement !== c.cn) c.cn.value = nameCol;
        if (document.activeElement !== c.cc) c.cc.value = countCol;
        const dc = t.displayColors || {};
        c.dcs.forEach((inp) => { if (document.activeElement !== inp) inp.value = dc[inp.dataset.k] || st.colors[inp.dataset.k]; });
        if (document.activeElement !== c.ce) c.ce.value = t.edgeColor || base;
        c.cer.disabled = !t.edgeColor;
        c.cr.disabled = !t.nameColor && !t.countColor && !t.edgeColor && !Object.keys(dc).length;
        c.title.textContent = `Команда ${i + 1}`;
        c.keys.textContent = i < 8 ? `Клавиша ${i + 1} — плюс, Shift+${i + 1} — минус` : '';
        c.pin.textContent = t.PIN ?? '';
        c.link.href = `${displayBase()}/display?team=${t.id}`;
        if (document.activeElement !== c.count) c.count.value = t.reps;
        if (document.activeElement !== c.name) c.name.value = t.name;
    });
    $('bAddTeam').disabled = st.teams.length >= MAX_TEAMS;
}

// ---------- State display ----------
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

    const rl = st.relay || { on: false, legs: 3, carry: false };
    const mode = rl.on ? 'relay' : st.mode;   // three modes in one row: countdown / stopwatch / relay
    document.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('on', b.dataset.mode === mode); b.disabled = !idle; });
    const canSet = idle && st.mode === 'down';
    $('relayBox').classList.toggle('hidden', !rl.on);
    if (document.activeElement !== $('rLegs')) $('rLegs').value = rl.legs;
    $('rCarry').value = rl.carry ? '1' : '0';
    $('rLegs').disabled = $('rCarry').disabled = !idle;
    const leg = st.duration / rl.legs, fmtLeg = Number.isInteger(leg) ? KB.fmt(leg) : `${KB.fmt(Math.floor(leg))} (≈${leg.toFixed(1)} с)`;
    $('rInfo').textContent = `Общее время ${KB.fmt(st.duration)}, на каждого из ${rl.legs} — по ${fmtLeg}. Результат участника уходит наверх ячейки команды, когда его время закончилось; в конце внизу — общая сумма. Менять настройки можно, пока таймер сброшен.`;
    document.querySelectorAll('[data-sec]').forEach((b) => (b.disabled = !canSet));
    $('mm').disabled = $('ss').disabled = !canSet;
    if (document.activeElement !== $('mm')) $('mm').value = Math.floor(st.duration / 60);
    if (document.activeElement !== $('ss')) $('ss').value = String(st.duration % 60);

    applyTeams();
    $('timerPin').textContent = st.timerPIN ?? '';
    $('showNames').checked = st.showNames;
    $('showLeader').checked = st.showLeader !== false;
    $('legsPos').value = st.legsPos || 'top';
    $('leaderPos').value = st.leaderPos || 'bottom';
    $('showFrame').checked = st.frame !== false;
    $('rounded').checked = st.rounded !== false;

    const c = st.colors;
    COLOR_KEYS.forEach((k) => { if (document.activeElement !== $('col-' + k)) $('col-' + k).value = c[k] || c.frame; });
    const root = document.documentElement.style;
    root.setProperty('--timer', c.timer); root.setProperty('--frame', c.frame); root.setProperty('--alarm', c.alarm);
    checkFit();
    tick();
}

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');   // fallback: the page is opened by IP without https
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { }
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
            const tm = d.team == null ? 'все команды' : (st && st.teams.find((t) => t.id === d.team)?.name) || `команда ${d.team}`;
            li.textContent = `Табло ${i + 1} (${tm}): ${d.w ? `${d.w}×${d.h} пикселей` : 'подключается…'}`;
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
    if (st) { applyTeams(); applyGenerator(); }
    $('ctlUrl').textContent = displayBase() + '/';
    checkFit();
    tick();
}

// ---------- Display link generator ----------
const G_COLORS = [['timer', 'Таймер'], ['frame', 'Рамка'], ['line', 'Линии'], ['alarm', 'Тревога'],
    ['nameColor', 'Название команды'], ['countColor', 'Счёт команды'], ['edge', 'Огранка (общее табло)']];
const G_FLAGS = [['names', 'Названия'], ['leader', 'Счёт лидера'], ['frame', 'Рамка табло'], ['round', 'Скруглённые цифры']];
const G_POS = [['legsPos', 'Счёт участников эстафеты'], ['leaderPos', 'Счёт лидера']];
const gColor = {};   // key -> { on, val }
let gBuilt = false;

function buildGenerator() {
    if (gBuilt) return;
    gBuilt = true;
    const box = $('gColors');
    G_COLORS.forEach(([k, label]) => {
        const l = document.createElement('label');
        const cb = document.createElement('input'); cb.type = 'checkbox';
        const inp = document.createElement('input'); inp.type = 'color'; inp.value = '#ffffff';
        gColor[k] = { cb, inp };
        cb.onchange = inp.oninput = () => { if (document.activeElement === inp) cb.checked = true; genUpdate(); };
        const sp = document.createElement('span'); sp.append(cb, ' ' + label);
        l.append(sp, inp);
        box.appendChild(l);
    });
    const fl = $('gFlags');
    G_FLAGS.forEach(([k, label]) => {
        const l = document.createElement('label'); l.append(label + ' ');
        const sel = document.createElement('select'); sel.dataset.flag = k;
        sel.innerHTML = '<option value="">как в настройках</option><option value="1">да</option><option value="0">нет</option>';
        sel.onchange = genUpdate;
        l.appendChild(sel); fl.appendChild(l);
    });
    G_POS.forEach(([k, label]) => {
        const l = document.createElement('label'); l.append(label + ' ');
        const sel = document.createElement('select'); sel.dataset.pos = k;
        sel.innerHTML = '<option value="">как в настройках</option><option value="top">сверху</option><option value="bottom">снизу</option><option value="left">слева</option><option value="right">справа</option>';
        sel.onchange = genUpdate;
        l.appendChild(sel); fl.appendChild(l);
    });
    for (const id of ['gTeam', 'gW', 'gH']) $(id).onchange = $(id).oninput = genUpdate;
    $('gHost').onchange = () => {
        chosenBase = $('gHost').value;
        try { localStorage.setItem(HOST_KEY, chosenBase); } catch { }
        refreshLinks();
    };
    $('gCopy').onclick = () => { copyText($('gUrl').textContent); $('gCopy').textContent = 'Скопировано'; setTimeout(() => ($('gCopy').textContent = 'Копировать'), 1500); };
}

function genQuery(extra) {
    const q = [];
    if ($('gTeam').value) q.push('team=' + $('gTeam').value);
    for (const [k] of G_COLORS) if (gColor[k].cb.checked) q.push(k + '=' + gColor[k].inp.value.slice(1));
    document.querySelectorAll('#gFlags select').forEach((s) => { if (s.value) q.push((s.dataset.flag || s.dataset.pos) + '=' + s.value); });
    return q.concat(extra || []);
}

let gPrevSrc = '';
function genUpdate() {
    const q = genQuery();
    const url = displayBase() + '/display' + (q.length ? '?' + q.join('&') : '');
    $('gUrl').textContent = url;
    $('gOpen').href = url;
    const w = Math.max(16, +$('gW').value || 320), h = Math.max(16, +$('gH').value || 192);
    $('gPrev').style.aspectRatio = `${w}/${h}`;
    const src = '/display?' + genQuery(['preview=1']).join('&');
    if (src !== gPrevSrc) { gPrevSrc = src; $('gPrev').src = src; }
}

function applyGenerator() {
    buildGenerator();
    applyHosts();
    const sel = $('gTeam'), cur = sel.value;
    const html = '<option value="">общее (все команды)</option>' + st.teams.map((t) => `<option value="${t.id}">${t.name || 'Команда ' + t.id} (team=${t.id})</option>`).join('');
    if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
    sel.value = st.teams.some((t) => String(t.id) === cur) ? cur : '';
    genUpdate();
}

// The timer updates often, everything else — on events
function tick() {
    if (!st) return;
    const r = $('read');
    r.textContent = KB.fmt(KB.secondsOf(st));
    r.classList.toggle('alarm', KB.isAlarm(st));
}

// There is no preview on the panel; the "doesn't fit" warning remains: the layout is computed on an invisible canvas the size of the real main display
const probe = document.createElement('canvas');
function checkFit() {
    if (!st) return;
    const d = info.displays.find((x) => x.w > 0 && x.team == null);
    const res = d ? KB.draw(probe, st, d.w, d.h) : null;
    st.teams.forEach((t, i) => {
        const c = cards.get(t.id);
        if (!c) return;
        c.cut.classList.toggle('hidden', !(res && res.cut[i]));
        c.where.textContent = res
            ? `${i + 1}-я на общем табло (ряд ${Math.floor(i / res.cols) + 1}, столбец ${(i % res.cols) + 1})`
            : `${i + 1}-я на общем табло`;
    });
}

NET.on('state', (s) => { st = s; applyState(); applyGenerator(); });
NET.on('info', (i) => { info = i; applyInfo(); });
NET.on('auth', exit);   // the PIN doesn't fit — go back to the login page
NET.on('status', (ok) => {
    const el = $('conn');
    el.classList.toggle('off', !ok);
    el.textContent = ok ? 'пульт управления табло' : 'нет связи с сервером…';
});

(async () => {
    let r = { ok: false };
    if (NET.pin) {
        r = await NET.login(NET.pin);
        while (r.error) { await new Promise((ok) => setTimeout(ok, 2000)); r = await NET.login(NET.pin); }   // the server is unavailable — wait
    }
    if (!r.ok) return exit();
    if (r.role !== 'admin') { location.href = r.role === 'timer' ? '/timer' : '/controller'; return; }
    NET.connect('adminpanel');
    setInterval(tick, 100);
})();
