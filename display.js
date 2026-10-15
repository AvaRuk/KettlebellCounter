// Страница табло: только показывает состояние. Управляется с пульта.
const canvas = document.getElementById('c');
let st = null, lastW = 0, lastH = 0;

function draw() {
  if (!st) return;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(window.innerWidth * dpr));
  const H = Math.max(1, Math.round(window.innerHeight * dpr));
  KB.draw(canvas, st, W, H);
  if (W !== lastW || H !== lastH) { lastW = W; lastH = H; NET.reportSize(W, H); }   // пульт покажет реальный размер табло
}

NET.on('state', (s) => { st = s; draw(); });
NET.on('status', (ok) => { if (ok) { lastW = 0; lastH = 0; } });   // после переподключения сообщаем размер заново
NET.connect('display');

// Полный экран: клавиша F или двойной щелчок (браузер разрешает только по действию пользователя)
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
window.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !e.ctrlKey && !e.altKey && !e.metaKey) toggleFullscreen(); });
window.addEventListener('dblclick', toggleFullscreen);
window.addEventListener('resize', draw);
setInterval(draw, 50);
