// Display page: only shows the state. Controlled from the control panel.
const canvas = document.getElementById('c');
let st = null, lastW = 0, lastH = 0;
// /display — all teams; /display?team=3 — a display for team number 3 only (the team id is shown in the admin panel)
const teamParam = new URLSearchParams(location.search).get('team');
const teamId = teamParam === null || teamParam === '' ? null : Number(teamParam);

// ---------- Settings from the address bar (override the server settings for this display only) ----------
// team=3 — single-team display; pal=0..6 — a ready-made color scheme;
// timer, frame, line, alarm, t1, t2 — colors (hex without #, e.g. timer=ffffff);
// nameColor, countColor, edge — colors of team name, score and edge; names, leader, frame, round — 0 or 1.
const Q = new URLSearchParams(location.search);
const HEXQ = /^#?([0-9a-f]{6})$/i;
const qColor = (k) => { const m = HEXQ.exec(Q.get(k) || ''); return m ? '#' + m[1].toLowerCase() : null; };
const qBool = (k) => (Q.get(k) === '1' ? true : Q.get(k) === '0' ? false : null);
const preview = Q.get('preview') === '1';   // preview in the admin panel: not counted as a connected display
const palQ = Q.has('pal') && KB.PALETTES[Number(Q.get('pal'))] ? KB.PALETTES[Number(Q.get('pal'))] : null;

// For a single-team display keep only that team; the color is taken from its position in the overall list
function view(s) {
  const i = teamId === null ? -1 : s.teams.findIndex((t) => t.id === teamId);
  const t = i < 0 ? null : s.teams[i];
  // Colors: server settings < scheme from the URL < the team's own display colors < individual colors from the URL
  let colors = { ...s.colors };
  if (palQ) colors = { timer: palQ.timer, t1: palQ.t1, t2: palQ.t2, alarm: palQ.alarm, frame: palQ.frame, line: palQ.frame };
  if (teamId !== null && t && !palQ) Object.assign(colors, t.displayColors);
  for (const k of ['timer', 'frame', 'line', 'alarm', 't1', 't2']) { const c = qColor(k); if (c) colors[k] = c; }
  if (qColor('frame') && !qColor('line')) colors.line = colors.frame;   // lines default to the frame color
  const nameC = qColor('nameColor'), countC = qColor('countColor'), edgeC = qColor('edge');
  const own = (x) => ({ ...x, nameColor: nameC || x.nameColor, countColor: countC || x.countColor, edgeColor: edgeC || x.edgeColor });
  const flags = {};
  for (const [q, k] of [['names', 'showNames'], ['leader', 'showLeader'], ['frame', 'frame'], ['round', 'rounded']]) { const v = qBool(q); flags[k] = v === null ? s[k] : v; }
  const base = { ...s, ...flags, colors };
  if (teamId === null) return { ...base, teams: s.teams.map(own) };

  // Leader — the team with the highest score (the first in the list on a tie); we show its score next to the team's own
  let leader = null;
  if (t && base.showLeader !== false) {
    let li = 0;
    s.teams.forEach((x, k) => { if (KB.teamTotal(s, x) > KB.teamTotal(s, s.teams[li])) li = k; });
    const L = own(s.teams[li]);
    leader = { reps: KB.teamTotal(s, L), color: L.countColor || KB.teamColor(colors, li), self: li === i };
  }
  // The edge is needed only on the main display: a single-team display has its own frame
  return { ...base, leader, teams: t ? [{ ...own(t), edgeColor: null }] : [], colorOffset: Math.max(0, i) };
}

function draw() {
  if (!st) return;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(window.innerWidth * dpr));
  const H = Math.max(1, Math.round(window.innerHeight * dpr));
  KB.draw(canvas, view(st), W, H);
  if (!preview && (W !== lastW || H !== lastH)) { lastW = W; lastH = H; NET.reportSize(W, H); }   // the control panel will show the display's real size
}

NET.on('state', (s) => { st = s; draw(); });
NET.on('status', (ok) => { if (ok) { lastW = 0; lastH = 0; } });   // after reconnecting, report the size again
NET.connect(preview ? 'preview' : 'display', teamId === null ? '' : `&team=${teamId}`);

// Full screen: the F key or a double click (the browser only allows it on a user action)
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
window.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !e.ctrlKey && !e.altKey && !e.metaKey) toggleFullscreen(); });
window.addEventListener('dblclick', toggleFullscreen);
window.addEventListener('resize', draw);
setInterval(draw, 50);
