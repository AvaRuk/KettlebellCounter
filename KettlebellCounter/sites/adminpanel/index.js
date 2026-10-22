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

// ---------- Toast ----------
let toastTimer = null;
function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

// ---------- In-page confirmation ----------
// A plain Android WebView silently cancels native confirm(), so destructive actions use this
// dialog. It also looks the same in every browser and follows the current site theme.
const dlg = { root: $('dialog'), title: $('dialogTitle'), text: $('dialogText'), ok: $('dialogOk'), cancel: $('dialogCancel') };
let dlgResolve = null;
let dlgPreviousFocus = null;

function uiConfirm(message, opts = {}) {
    return new Promise((resolve) => {
        if (dlgResolve) { dlgResolve(false); dlgResolve = null; }
        dlgPreviousFocus = document.activeElement;
        dlg.title.textContent = opts.title || 'Подтвердите действие';
        dlg.text.textContent = message;
        dlg.ok.textContent = opts.ok || 'Удалить';
        dlg.ok.className = 'btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger');
        dlg.cancel.textContent = opts.cancel || 'Отмена';
        dlg.root.hidden = false;
        document.body.classList.add('modal-open');
        dlgResolve = resolve;
        setTimeout(() => dlg.cancel.focus(), 0);   // the safe choice is focused first
    });
}

function closeDialog(ok) {
    if (!dlgResolve) return;
    const resolve = dlgResolve;
    dlgResolve = null;
    dlg.root.hidden = true;
    document.body.classList.remove('modal-open');
    resolve(ok);
    if (dlgPreviousFocus && typeof dlgPreviousFocus.focus === 'function') dlgPreviousFocus.focus();
    dlgPreviousFocus = null;
}

dlg.ok.onclick = () => closeDialog(true);
dlg.cancel.onclick = () => closeDialog(false);
dlg.root.addEventListener('click', (e) => { if (e.target === dlg.root) closeDialog(false); });
document.addEventListener('keydown', (e) => {
    if (!dlg.root.hidden && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDialog(false); }
}, true);

// ---------- Element bindings ----------
$('bToggle').onclick = () => send({ type: 'globalToggleTime' });
$('bReset').onclick = () => send({ type: 'globalResetTime' });
$('bResetCounts').onclick = async () => {
    if (await uiConfirm('Обнулить счётчики всех команд? Это действие нельзя отменить.', { title: 'Обнулить все счётчики?', ok: 'Обнулить' }))
        send({ type: 'globalResetCounts' });
};
$('bAddTeam').onclick = () => send({ type: 'teamAdd' });
$('bExit').onclick = exit;
$('bTimerPin').onclick = async () => {
    if (await uiConfirm('Выдать хронометристу новый PIN? Старый перестанет работать.', { title: 'Новый PIN хронометриста', ok: 'Выдать' }))
        send({ type: 'timerNewPIN' });
};
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
        toast('PIN администратора изменён');
        setTimeout(() => location.reload(), 700);   // reconnect with the new PIN
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
    if (!dlg.root.hidden) return;   // the confirmation dialog owns the keyboard
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
        <div class="team-head">
            <div class="team-title"><h3></h3><p class="where"></p></div>
            <button type="button" class="icon-btn rm" title="Удалить команду" aria-label="Удалить команду">✕</button>
        </div>
        <label class="field"><span class="label">Название</span><input class="name" type="text" maxlength="14" spellcheck="false" placeholder="Название команды" autocomplete="off"></label>
        <p class="cut hidden">На табло не помещается целиком</p>
        <input class="count" type="number" min="0" max="999" value="0" aria-label="Счёт команды">
        <div class="score-buttons"><button type="button" class="dn" aria-label="Минус один">−1</button><button type="button" class="up" aria-label="Плюс один">+1</button></div>
        <div class="team-meta">
            <p class="keys"></p>
            <span class="team-pin">PIN <span class="pinbox"></span></span>
        </div>
        <div class="team-actions">
            <button type="button" class="newpin btn btn-sm">Новый PIN</button>
            <a class="tlink btn btn-sm" target="_blank" rel="noopener">Табло команды ↗</a>
            <button type="button" class="tcopy btn btn-sm">Копировать адрес</button>
        </div>
        <details class="team-style">
            <summary>Оформление команды</summary>
            <div class="style-grid">
                <label>Цвет названия <input type="color" class="cn"></label>
                <label>Цвет счёта <input type="color" class="cc"></label>
                <label>Огранка на общем табло <input type="color" class="ce"></label>
                <label>Таймер табло <input type="color" class="dc" data-k="timer"></label>
                <label>Рамка табло <input type="color" class="dc" data-k="frame"></label>
                <label>Тревога <input type="color" class="dc" data-k="alarm"></label>
            </div>
            <div class="style-actions">
                <button type="button" class="cr btn btn-sm">Вернуть цвета по схеме</button>
                <button type="button" class="cer btn btn-sm">Убрать огранку</button>
            </div>
        </details>`;
    const q = (s) => el.querySelector(s);
    const c = {
        el, title: q('h3'), where: q('.where'), name: q('.name'), cut: q('.cut'), count: q('.count'),
        keys: q('.keys'), pin: q('.pinbox'), link: q('.tlink'), cn: q('.cn'), cc: q('.cc'), cr: q('.cr'), ce: q('.ce'), cer: q('.cer')
    };
    c.cn.oninput = () => send({ type: 'teamSetColor', teamid: t.id, part: 'name', value: c.cn.value });
    c.cc.oninput = () => send({ type: 'teamSetColor', teamid: t.id, part: 'count', value: c.cc.value });
    c.ce.oninput = () => send({ type: 'teamSetEdge', teamid: t.id, value: c.ce.value });
    c.cer.onclick = () => send({ type: 'teamSetEdge', teamid: t.id, value: null });
    c.dcs = [...el.querySelectorAll('.dc')];
    c.dcs.forEach((i) => (i.oninput = () => send({ type: 'teamSetDisplayColor', teamid: t.id, key: i.dataset.k, value: i.value })));
    c.cr.onclick = () => {
        ['timer', 'frame', 'alarm'].forEach((k) => send({ type: 'teamSetDisplayColor', teamid: t.id, key: k, value: null }));
        send({ type: 'teamSetColor', teamid: t.id, part: 'name', value: null });
        send({ type: 'teamSetColor', teamid: t.id, part: 'count', value: null });
        send({ type: 'teamSetEdge', teamid: t.id, value: null });
    };
    q('.tcopy').onclick = async () => {
        await copyText(c.link.href);
        toast('Адрес табло скопирован');
    };
    q('.rm').onclick = async () => {
        const nm = c.name.value.trim() || c.title.textContent;
        if (await uiConfirm(`Команда «${nm}» будет удалена вместе со своим счётом и PIN-кодом.`, { title: 'Удалить команду?', ok: 'Удалить' }))
            send({ type: 'teamRemove', teamid: t.id });
    };
    q('.dn').onclick = () => send({ type: 'localCountDown', teamid: t.id });
    q('.up').onclick = () => send({ type: 'localCountUp', teamid: t.id });
    q('.newpin').onclick = async () => {
        if (await uiConfirm('Выдать команде новый PIN? Старый перестанет работать.', { title: 'Новый PIN команды', ok: 'Выдать' }))
            send({ type: 'teamNewPIN', teamid: t.id });
    };
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
    $('teamCount').textContent = `${st.teams.length} из ${MAX_TEAMS}`;
}

// ---------- State display ----------
function applyState() {
    if (!st) return;
    const idle = !st.running && st.elapsed === 0 && !st.finished;
    const paused = !st.running && !st.finished && st.elapsed > 0;

    const bt = $('bToggle');
    bt.textContent = st.running ? 'Пауза' : paused ? 'Продолжить' : 'Старт';
    bt.className = 'btn btn-xl ' + (st.running ? 'btn-warn' : 'btn-primary');
    bt.disabled = st.finished;
    $('bReset').disabled = st.running || idle;
    $('bResetCounts').disabled = st.running;
    const state = st.finished ? 'finished' : st.running ? 'running' : paused ? 'paused' : 'idle';
    $('status').dataset.state = state;
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
    $('legsPos').value = st.legsPos || KB.DEFAULT_LEGS_POS;
    $('leaderPos').value = st.leaderPos || KB.DEFAULT_LEADER_POS;
    $('showFrame').checked = st.frame !== false;
    $('rounded').checked = st.rounded !== false;

    const c = st.colors;
    COLOR_KEYS.forEach((k) => { if (document.activeElement !== $('col-' + k)) $('col-' + k).value = c[k] || c.frame; });
    const root = document.documentElement.style;
    root.setProperty('--timer', c.timer); root.setProperty('--frame', c.frame); root.setProperty('--alarm', c.alarm);
    checkFit();
    tick();
}

async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return; }
    } catch { }
    const ta = document.createElement('textarea');   // fallback: the page is opened by IP without https
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { }
    ta.remove();
}

function applyInfo() {
    const ds = info.displays;
    $('displayCount').textContent = ds.length ? `${ds.length} в сети` : 'нет';
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
        const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn btn-sm'; copy.textContent = 'Копировать';
        copy.onclick = async () => { await copyText(u); toast('Адрес табло скопирован'); };
        const open = document.createElement('a'); open.className = 'btn btn-sm btn-ghost'; open.href = u; open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'Открыть ↗';
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
    const fl = $('gFlags'), gp = $('gPos');
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
        l.appendChild(sel); gp.appendChild(l);
    });
    // The leader's position only makes sense while the leader's score is visible
    const leaderVis = fl.querySelector('select[data-flag="leader"]');
    const leaderPos = gp.querySelector('select[data-pos="leaderPos"]');
    const syncLeaderPos = () => { if (leaderPos) leaderPos.disabled = leaderVis.value === '0'; };
    leaderVis.addEventListener('change', syncLeaderPos);
    syncLeaderPos();
    for (const id of ['gTeam', 'gW', 'gH']) $(id).onchange = $(id).oninput = genUpdate;
    $('gHost').onchange = () => {
        chosenBase = $('gHost').value;
        try { localStorage.setItem(HOST_KEY, chosenBase); } catch { }
        refreshLinks();
    };
    $('gCopy').onclick = async () => { await copyText($('gUrl').textContent); toast('Ссылка на табло скопирована'); };
}

function genQuery(extra) {
    const q = [];
    if ($('gTeam').value) q.push('team=' + $('gTeam').value);
    for (const [k] of G_COLORS) if (gColor[k].cb.checked) q.push(k + '=' + gColor[k].inp.value.slice(1));
    const leaderOff = document.querySelector('#gFlags select[data-flag="leader"]').value === '0';
    document.querySelectorAll('#gFlags select, #gPos select').forEach((s) => {
        if (!s.value || (leaderOff && s.dataset.pos === 'leaderPos')) return;
        q.push((s.dataset.flag || s.dataset.pos) + '=' + s.value);
    });
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

    const total = Math.max(1, st.duration);
    const done = st.mode === 'down'
        ? 1 - Math.min(1, KB.secondsOf(st) / total)
        : Math.min(1, KB.secondsOf(st) / total);
    const bar = $('progress');
    if (bar) {
        bar.style.width = (done * 100).toFixed(1) + '%';
        $('progressBar').classList.toggle('alarm', KB.isAlarm(st));
    }
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
    el.textContent = ok ? 'на связи' : 'нет связи…';
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
