// Scoreboard server for kettlebell sport.
// Pages:  /  (PIN login)   /adminpanel (head judge)   /controller (team judge)   /timer (timekeeper)   /display (scoreboard)
// Run:    node server.js      (optional: --port=8080 --pin=1234, or PORT=8080 ADMIN_PIN=1234)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DEFAULT_COLORS, TEAM_COLORS } = require('./sites/render.js');   // shared default colors

const args = process.argv.slice(2);
const getArg = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };

//CONSTS
const PORT = Number(getArg('port') || process.env.PORT || 80);
const SITES = path.join(__dirname, 'sites');
const FILES = {
    '/': 'index/index.html',
    '/index.js': 'index/index.js',
    '/adminpanel': 'adminpanel/index.html',
    '/adminpanel.js': 'adminpanel/index.js',
    '/controller': 'controller/index.html',
    '/controller.js': 'controller/index.js',
    '/display': 'display/index.html',
    '/display.js': 'display/index.js',
    '/timer': 'timer/index.html',
    '/timer.js': 'timer/index.js',
    '/net.js': 'net.js',
    '/render.js': 'render.js',
    '/theme.js': 'theme.js',
    '/theme.css': 'theme.css',
    '/logo.png': 'logo.png'
};
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png'
};
const MAX_TEAMS = 8;
const MAX_NAME = 14;
const MAX_LEGS = 6;
const MAX_DURATION = 99 * 60 + 59;
const COLOR_KEYS = ['timer', 'alarm', 'frame'];               // required display colors
const DISPLAY_KEYS = ['timer', 'frame', 'alarm'];             // colors that can be set separately for a single-team display (?team=)
const SET_KEYS = [...COLOR_KEYS, 'line'];                    // can be changed one at a time; line — separators (same as the frame by default)
const HEX = /^#[0-9a-f]{6}$/i;
const PIN_RE = /^[0-9A-Za-z]{4,12}$/;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

//Settings (saved next to the server)
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { settings = {}; }
let saveTimer = null;
function saveSettings() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        settings.duration = STATE.duration;
        settings.mode = STATE.mode;
        settings.colors = STATE.colors;
        settings.rounded = STATE.rounded;
        settings.frame = STATE.frame;
        settings.showNames = STATE.showNames;
        settings.showLeader = STATE.showLeader;
        settings.legsPos = STATE.legsPos;
        settings.leaderPos = STATE.leaderPos;
        settings.relay = STATE.relay;
        settings.adminPIN = adminPIN;
        settings.timerPIN = timerPIN;
        settings.nextTeamId = nextTeamId;
        settings.teams = teams;
        try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch { }
    }, 400);
}

//Helpers
// Names are drawn with the pixel font, so only supported characters are kept
function cleanName(v) {
    return String(v ?? '')
        .toUpperCase()
        .replace(/[^A-ZА-ЯЁ0-9 \-.,'!+:/()]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_NAME);
}
function cleanDisplayColors(o) {
    const out = {};
    if (o && typeof o === 'object') for (const k of DISPLAY_KEYS) if (HEX.test(o[k])) out[k] = o[k].toLowerCase();
    return out;
}
// Each team has its own color: the first one from the list that no other team uses
const pickTeamColor = (taken) => TEAM_COLORS.find((c) => !taken.includes(c)) || TEAM_COLORS[taken.length % TEAM_COLORS.length];

const generate4DigitId = () => Math.floor(1000 + Math.random() * 9000).toString();
// A team's (and the timekeeper's) PIN must not match the admin PIN or any other role's PIN
function uniquePIN() {
    let p;
    do { p = generate4DigitId(); } while (p === adminPIN || p === timerPIN || teams.some((t) => t.PIN === p));
    return p;
}

//Vars
let adminPIN = PIN_RE.test(String(getArg('pin') || process.env.ADMIN_PIN || settings.adminPIN || ''))
    ? String(getArg('pin') || process.env.ADMIN_PIN || settings.adminPIN)
    : '1234';
let timerPIN = '';   // Timekeeper PIN; assigned below, once the team PINs are known
let nextTeamId = Number(settings.nextTeamId) || 1;
let teams = [];
if (Array.isArray(settings.teams)) {
    const taken = [];   // colors already given out (teams saved before per-team colors existed get distinct ones)
    teams = settings.teams.slice(0, MAX_TEAMS).map((t) => ({
        id: Number(t.id),
        name: cleanName(t.name),
        PIN: String(t.PIN),
        reps: clamp(Math.round(Number(t.reps) || 0), 0, 999),
        color: (() => { const c = HEX.test(t.color) ? t.color.toLowerCase() : pickTeamColor(taken); taken.push(c); return c; })(),
        nameColor: HEX.test(t.nameColor) ? t.nameColor : null,
        countColor: HEX.test(t.countColor) ? t.countColor : null,
        edgeColor: HEX.test(t.edgeColor) ? t.edgeColor : null,
        displayColors: cleanDisplayColors(t.displayColors),
        legs: [], legBase: 0
    })).filter((t) => Number.isInteger(t.id) && t.PIN);
    nextTeamId = Math.max(nextTeamId, ...teams.map((t) => t.id + 1), 1);
}
if (!teams.length && !Array.isArray(settings.teams)) {
    for (let i = 0; i < 2; i++) teams.push({ id: nextTeamId++, name: 'КОМАНДА ' + (i + 1), PIN: uniquePIN(), reps: 0, color: pickTeamColor(teams.map((t) => t.color)), nameColor: null, countColor: null, edgeColor: null, displayColors: {}, legs: [], legBase: 0 });
}
// Timekeeper PIN: taken from settings if it still doesn't clash with anything, otherwise a new one
{
    const saved = String(settings.timerPIN || '');
    timerPIN = PIN_RE.test(saved) && saved !== adminPIN && !teams.some((t) => t.PIN === saved) ? saved : uniquePIN();
}

const STATE = {
    running: false, finished: false,
    elapsed: 0, startedAt: 0, duration: 600, mode: 'down',
    colors: { ...DEFAULT_COLORS }, rounded: true, frame: true, showNames: true, showLeader: true,
    legsPos: 'top', leaderPos: 'bottom',   // where the relay results / the leader's score are drawn relative to the main score: top | bottom | left | right
    relay: { on: false, legs: 3, carry: false }   // relay: legs = participants per team, carry = the next participant's count continues from the current value
};
if (settings.duration) STATE.duration = clamp(settings.duration, 10, MAX_DURATION);
if (settings.mode === 'up' || settings.mode === 'down') STATE.mode = settings.mode;
if (settings.colors && COLOR_KEYS.every((k) => HEX.test(settings.colors[k])))
    STATE.colors = { timer: settings.colors.timer, alarm: settings.colors.alarm, frame: settings.colors.frame, line: HEX.test(settings.colors.line) ? settings.colors.line : settings.colors.frame };
if (typeof settings.rounded === 'boolean') STATE.rounded = settings.rounded;
if (typeof settings.frame === 'boolean') STATE.frame = settings.frame;
if (typeof settings.showNames === 'boolean') STATE.showNames = settings.showNames;
if (typeof settings.showLeader === 'boolean') STATE.showLeader = settings.showLeader;
const POSITIONS = ['top', 'bottom', 'left', 'right'];
if (POSITIONS.includes(settings.legsPos)) STATE.legsPos = settings.legsPos;
if (POSITIONS.includes(settings.leaderPos)) STATE.leaderPos = settings.leaderPos;
if (settings.relay && typeof settings.relay === 'object')
    STATE.relay = { on: !!settings.relay.on, legs: clamp(Math.round(Number(settings.relay.legs) || 3), 2, MAX_LEGS), carry: !!settings.relay.carry };
if (STATE.relay.on) STATE.mode = 'down';

const clients = new Set();     // { res, role, id, admin }
const displays = new Map();    // id -> { w, h }

const elapsedNow = () => STATE.elapsed + (STATE.running ? Date.now() - STATE.startedAt : 0);
const isIdle = () => !STATE.running && STATE.elapsed === 0 && !STATE.finished;

//Broadcast
// Everyone sees team names and scores; only the admin receives PIN codes
const publicState = () => ({ ...STATE, teams: teams.map(({ id, name, reps, color, nameColor, countColor, edgeColor, displayColors, legs, legBase }) => ({ id, name, reps, color, nameColor, countColor, edgeColor, displayColors, legs, legBase })) });
const adminState = () => ({ ...STATE, timerPIN, teams: teams.map((t) => ({ ...t })) });

// Network adapters of this computer: the admin panel lets the user choose which IP goes into the links
function lanList() {
    const out = [];
    for (const [name, list] of Object.entries(os.networkInterfaces()))
        for (const i of list || [])
            if (i.family === 'IPv4' && !i.internal) out.push({ name, address: i.address, url: `http://${i.address}${PORT === 80 ? '' : ':' + PORT}` });
    return out;
}
const lanUrls = () => lanList().map((i) => i.url);
const getInfo = () => ({
    ifaces: lanList(),
    displays: [...displays.entries()].map(([id, d]) => ({ id, w: d.w, h: d.h, team: d.team })),
    urls: lanUrls().map((u) => u + '/display'),
    controllerUrls: lanUrls(),
    base: lanUrls()
});
function write(c, event, data) { try { c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { } }
function broadcastState() {
    const pub = publicState(), adm = adminState();
    for (const c of clients) write(c, 'state', c.admin ? adm : pub);
}
function broadcastInfo() {
    const info = getInfo();
    for (const c of clients) if (c.admin) write(c, 'info', info);
}
setInterval(() => { for (const c of clients) { try { c.res.write(': ping\n\n'); } catch { } } }, 15000);

// ----- Relay -----
// The total time is split equally between participants. When a leg ends, the participant's result
// is stored in t.legs, and the counter either resets to zero or continues from the current value (legBase).
function relayBegin() {
    teams.forEach((t) => {
        t.legs = [];
        if (!STATE.relay.carry) t.reps = 0;
        t.legBase = t.reps;
    });
}
function relayClear() { teams.forEach((t) => { t.legs = []; t.legBase = 0; }); }
function relayAdvance() {
    const N = STATE.relay.legs;
    const target = STATE.finished ? N : Math.min(N - 1, Math.floor(elapsedNow() * N / (STATE.duration * 1000)));
    let changed = false;
    for (const t of teams) {
        while (t.legs.length < target) {
            t.legs.push(Math.max(0, t.reps - t.legBase));
            if (t.legs.length < N) { if (STATE.relay.carry) t.legBase = t.reps; else { t.reps = 0; t.legBase = 0; } }
            changed = true;
        }
    }
    return changed;
}
const relayOver = () => STATE.relay.on && STATE.finished;   // after the relay ends the count no longer changes

// The timer ends on the server — all screens see the same thing
setInterval(() => {
    if (STATE.running && STATE.mode === 'down' && elapsedNow() >= STATE.duration * 1000) {
        STATE.elapsed = STATE.duration * 1000; STATE.running = false; STATE.finished = true;
        broadcastState();
    }
    if (STATE.relay.on && (STATE.running || STATE.finished) && relayAdvance()) { saveSettings(); broadcastState(); }
}, 100);

// ----- Modes -----
// relay is stored as STATE.relay.on (the countdown is split between participants); the other two as STATE.mode
const MODES = ['down', 'up', 'relay'];
const currentMode = () => (STATE.relay.on ? 'relay' : STATE.mode);
function setMode(m) {
    if (m === 'relay') { STATE.relay.on = true; STATE.mode = 'down'; }   // relay — countdown only
    else { STATE.relay.on = false; STATE.mode = m; }
    relayClear();
}

//Authorization
// Determine the role by PIN: admin or a judge of one of the teams
function authorize(pin) {
    pin = String(pin ?? '');
    if (!pin) return null;
    if (pin === adminPIN) return { role: 'admin' };
    if (pin === timerPIN) return { role: 'timer' };
    const team = teams.find((t) => t.PIN === pin);
    return team ? { role: 'team', team } : null;
}

//Actions
// Returns true if the action was performed
function handle(a, auth) {
    const admin = auth.role === 'admin';
    const canTime = admin || auth.role === 'timer';   // the admin and the timekeeper control the clock
    // A team judge works only with their own team, the admin with any team (by teamid)
    const team = admin ? teams.find((t) => t.id === Number(a.teamid)) : auth.team;
    const needTeam = () => !!team;

    switch (a.type) {
        // ----- General: admin only -----
        case 'globalStartTime':
            if (!canTime) return false;
            if (STATE.finished || STATE.running) break;
            if (STATE.relay.on && isIdle()) relayBegin();
            STATE.startedAt = Date.now(); STATE.running = true;
            break;
        case 'globalPauseTime':
            if (!canTime) return false;
            if (!STATE.running) break;
            STATE.elapsed = elapsedNow(); STATE.running = false;
            break;
        case 'globalToggleTime':
            if (!canTime) return false;
            if (STATE.finished) break;
            if (STATE.running) { STATE.elapsed = elapsedNow(); STATE.running = false; }
            else { if (STATE.relay.on && isIdle()) relayBegin(); STATE.startedAt = Date.now(); STATE.running = true; }
            break;
        case 'globalResetTime':
            if (!canTime) return false;
            if (!STATE.running) {
                STATE.elapsed = 0; STATE.finished = false;
                if (STATE.relay.on) { relayClear(); teams.forEach((t) => (t.reps = 0)); }   // the relay starts over — the counters too
            }
            break;
        case 'globalResetCounts':
            if (!admin) return false;
            if (!STATE.running) { teams.forEach((t) => (t.reps = 0)); relayClear(); }
            break;
        case 'globalSetDuration':
            if (!canTime || !Number.isFinite(a.sec)) return false;
            if (isIdle()) STATE.duration = clamp(Math.round(a.sec), 10, MAX_DURATION);
            break;
        case 'globalAdjustDuration':
            if (!canTime || !Number.isFinite(a.delta)) return false;
            if (isIdle() && STATE.mode === 'down') STATE.duration = clamp(STATE.duration + a.delta, 10, MAX_DURATION);
            break;
        // Three modes in one row: countdown, stopwatch, relay (a countdown split between participants)
        case 'globalSetMode':
            if (!canTime || !MODES.includes(a.mode)) return false;
            if (isIdle()) setMode(a.mode);
            break;
        case 'globalToggleMode':
            if (!canTime) return false;
            if (isIdle()) setMode(MODES[(MODES.indexOf(currentMode()) + 1) % MODES.length]);
            break;
        case 'globalSetRelay':
            if (!admin) return false;
            if (isIdle()) {
                STATE.relay = {
                    on: a.on === undefined ? STATE.relay.on : !!a.on,
                    legs: clamp(Math.round(Number(a.legs) || STATE.relay.legs), 2, MAX_LEGS),
                    carry: !!a.carry
                };
                if (STATE.relay.on) STATE.mode = 'down';   // relay — countdown only
                relayClear();
            }
            break;
        case 'globalSetPIN': {
            if (!admin) return false;
            const p = String(a.newPIN ?? '');
            if (!PIN_RE.test(p) || p === timerPIN || teams.some((t) => t.PIN === p)) return false;
            adminPIN = p;
            break;
        }
        case 'timerNewPIN':
            if (!admin) return false;
            timerPIN = uniquePIN();
            break;

        // ----- Scoreboard appearance: admin only -----
        case 'globalSetColor':
            if (!admin || !SET_KEYS.includes(a.key) || !HEX.test(a.value)) return false;
            STATE.colors = { ...STATE.colors, [a.key]: a.value.toLowerCase() };
            break;
        case 'globalSetRounded':
            if (!admin) return false;
            STATE.rounded = !!a.value;
            break;
        case 'globalSetFrame':
            if (!admin) return false;
            STATE.frame = !!a.value;
            break;
        case 'globalSetShowNames':
            if (!admin) return false;
            STATE.showNames = !!a.value;
            break;
        case 'globalSetShowLeader':
            if (!admin) return false;
            STATE.showLeader = !!a.value;
            break;
        case 'globalSetLegsPos':
            if (!admin || !POSITIONS.includes(a.value)) return false;
            STATE.legsPos = a.value;
            break;
        case 'globalSetLeaderPos':
            if (!admin || !POSITIONS.includes(a.value)) return false;
            STATE.leaderPos = a.value;
            break;

        // ----- Teams: admin only -----
        case 'teamAdd':
            if (!admin || teams.length >= MAX_TEAMS) return false;
            teams.push({
                id: nextTeamId,
                name: 'КОМАНДА ' + nextTeamId,
                PIN: uniquePIN(),
                reps: 0,
                color: pickTeamColor(teams.map((t) => t.color)),
                nameColor: null,
                countColor: null,
                edgeColor: null,
                displayColors: {},
                legs: [], legBase: 0
            });
            nextTeamId++;
            break;
        case 'teamRemove':
            if (!admin || !needTeam()) return false;
            teams = teams.filter((x) => x !== team);
            break;
        case 'teamNewPIN':
            if (!admin || !needTeam()) return false;
            team.PIN = uniquePIN();
            break;

        // Color of a single team's name / score; value: null — back to the team's own color
        case 'teamSetColor':
            if (!admin || !needTeam() || (a.part !== 'name' && a.part !== 'count')) return false;
            if (a.value !== null && !HEX.test(a.value)) return false;
            team[a.part === 'name' ? 'nameColor' : 'countColor'] = a.value === null ? null : a.value.toLowerCase();
            break;

        // Edge — a colored frame around the team's cell on the main display; value: null — no edge
        case 'teamSetEdge':
            if (!admin || !needTeam()) return false;
            if (a.value !== null && !HEX.test(a.value)) return false;
            team.edgeColor = a.value === null ? null : a.value.toLowerCase();
            break;

        // Timer / frame / alarm color of a single-team display; value: null — same as the main display
        case 'teamSetDisplayColor':
            if (!admin || !needTeam() || !DISPLAY_KEYS.includes(a.key)) return false;
            if (a.value !== null && !HEX.test(a.value)) return false;
            if (a.value === null) delete team.displayColors[a.key];
            else team.displayColors[a.key] = a.value.toLowerCase();
            break;

        // ----- Team: the name is set by the admin only; the team judge sees it read-only -----
        case 'teamSetName':
            if (!admin || !needTeam()) return false;
            team.name = cleanName(a.name);
            break;

        // ----- Score: own judge or admin -----
        case 'localCountUp':
            if (!needTeam()) return false;
            if (relayOver()) break;
            team.reps = Math.min(999, team.reps + 1);
            break;
        case 'localCountDown':
            if (!needTeam()) return false;
            if (relayOver()) break;
            team.reps = Math.max(0, team.reps - 1);
            break;
        case 'localSetCount':
            if (!admin || !needTeam() || !Number.isFinite(a.value)) return false;
            if (relayOver()) break;
            team.reps = clamp(Math.round(a.value), 0, 999);
            break;
        case 'localResetCounts':
            if (!needTeam()) return false;
            if (!STATE.running) { team.reps = 0; team.legs = []; team.legBase = 0; }
            break;

        default:
            return false;
    }
    saveSettings();
    broadcastState();
    broadcastInfo();
    return true;
}

//HTTP
function readBody(req, limit = 10000) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];

        function cleanup() {
            req.off('data', onData);
            req.off('end', onEnd);
            req.off('error', onError);
        }

        function onData(c) {
            size += c.length;
            if (size > limit) {
                cleanup();
                req.destroy();
                reject(new Error('Payload too large'));
            } else {
                chunks.push(c);
            }
        }

        function onEnd() {
            cleanup();
            try {
                const bodyString = Buffer.concat(chunks).toString() || '{}';
                resolve(JSON.parse(bodyString));
            } catch (e) {
                reject(e);
            }
        }

        function onError(err) {
            cleanup();
            reject(err);
        }

        req.on('data', onData);
        req.on('end', onEnd);
        req.on('error', onError);
    });
}

const json = (res, code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const urlp = url.pathname;

    try {
        if (req.method === 'GET') {
            if (urlp === '/events') {
                const role = url.searchParams.get('role');
                // The admin PIN comes in the URL (EventSource can't send headers)
                const admin = role === 'adminpanel' && authorize(url.searchParams.get('pin'))?.role === 'admin';
                if (role === 'adminpanel' && !admin) { res.writeHead(401); return res.end(); }
                res.writeHead(200,
                    {
                        'content-type': 'text/event-stream',
                        'cache-control': 'no-cache, no-transform',
                        'connection': 'keep-alive',
                        'x-accel-buffering': 'no'
                    });
                const c = {
                    res,
                    role: role === 'display' ? 'display' : role === 'adminpanel' ? 'adminpanel' : 'controller',
                    id: String(url.searchParams.get('id') || '').slice(0, 32),
                    admin,
                    team: url.searchParams.get('team') ? Number(url.searchParams.get('team')) : null
                };
                clients.add(c);
                if (c.role === 'display' && c.id) displays.set(c.id, { w: 0, h: 0, team: c.team });
                write(c, 'state', admin ? adminState() : publicState());
                if (admin) write(c, 'info', getInfo());
                broadcastInfo();   // admin panels get the up-to-date list of displays
                req.on('close', () => {
                    clients.delete(c);
                    if (c.role === 'display' && c.id && ![...clients].some((x) => x.id === c.id && x.role === 'display'))
                        displays.delete(c.id);
                    broadcastInfo();
                });
                return;
            }
            else if (urlp === '/api/time') {
                return json(res, 200, { t: Date.now() });
            }
            else if (urlp === '/api/state') {
                return json(res, 200, publicState());
            }
            else if (FILES[urlp]) {
                const file = path.join(SITES, FILES[urlp]);
                fs.readFile(file, (err, data) => {
                    if (err) {
                        res.writeHead(404);
                        return res.end('Not found');
                    }
                    res.writeHead(200,
                        {
                            'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
                            'cache-control': 'no-cache'
                        });
                    res.end(data);
                });
                return;
            }
            res.writeHead(404);
            res.end('Not found');
        }
        else if (req.method === 'POST') {
            if (urlp === '/api/login') {
                // The PIN tells us where to send the user: to the admin panel or to the team counter
                const recreq = await readBody(req);
                const auth = authorize(recreq.PIN);
                if (!auth) return json(res, 401, { ok: false });
                return json(res, 200, auth.role === 'admin' ? { ok: true, role: 'admin' }
                    : auth.role === 'timer' ? { ok: true, role: 'timer' }
                    : { ok: true, role: 'team', teamid: auth.team.id });
            }
            else if (urlp === '/api/action') {
                const recreq = await readBody(req);
                if (!recreq || typeof recreq !== 'object') {
                    res.writeHead(400);
                    return res.end();
                }
                const auth = authorize(req.headers['x-pin']);
                if (!auth) {
                    res.writeHead(401);
                    return res.end();
                }
                res.writeHead(handle(recreq, auth) ? 204 : 400);
                return res.end();
            }
            else if (urlp === '/api/display-size') {
                const b = await readBody(req);
                const d = displays.get(String(b.id || ''));
                if (d && Number.isFinite(b.w) && Number.isFinite(b.h)) {
                    d.w = clamp(Math.round(b.w), 0, 16384);
                    d.h = clamp(Math.round(b.h), 0, 16384);
                    broadcastInfo();
                }
                res.writeHead(204);
                return res.end();
            }
            res.writeHead(404);
            res.end('Not found');
        }
        else {
            res.writeHead(405);
            res.end();
        }
    } catch {
        if (!res.headersSent) res.writeHead(400);
        res.end();
    }
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`\nПорт ${PORT} уже занят. Закройте другую копию или запустите: node server.js --port=8080\n`);
    else if (e.code === 'EACCES') console.error(`\nНет прав на порт ${PORT}. Запустите от администратора или: node server.js --port=8080\n`);
    else console.error(e);
    process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n  Гиревой спорт — табло запущено\n');
    console.log(`  Админ-панель (на этом компьютере):  http://localhost${PORT === 80 ? '' : ':' + PORT}/`);
    console.log(`  PIN администратора: ${adminPIN}`);
    console.log(`  PIN хронометриста:  ${timerPIN}`);
    const urls = lanUrls();
    if (urls.length) urls.forEach((u) => console.log(`  Для судей и табло по сети:  ${u}/   (табло: ${u}/display)`));
    else console.log('  Сеть не найдена: подключитесь к Wi-Fi или кабелю, затем перезапустите.');
    console.log('\n  Остановить: Ctrl+C\n');
});
