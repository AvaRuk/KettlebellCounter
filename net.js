// Общий сетевой код для пульта и табло: подписка на состояние, отправка команд, синхронизация часов.
(function () {
  const id = Math.random().toString(36).slice(2, 10);
  const handlers = { state() {}, info() {}, status() {} };
  let pin = '';
  try { pin = localStorage.getItem('kbPin') || ''; } catch {}

  // Часы разных компьютеров расходятся, а таймер считается от времени сервера.
  // Узнаём поправку: несколько запросов, берём тот, где задержка меньше всего.
  async function syncClock() {
    let best = null;
    for (let i = 0; i < 6; i++) {
      try {
        const t0 = performance.now(), w0 = Date.now();
        const r = await fetch('/api/time', { cache: 'no-store' });
        const j = await r.json();
        const rtt = performance.now() - t0;
        if (!best || rtt < best.rtt) best = { rtt, offset: j.t - w0 - rtt / 2 };
      } catch {}
    }
    if (best && window.KB) KB.setClockOffset(best.offset);
  }

  function connect(role) {
    const es = new EventSource(`/events?role=${role}&id=${id}`);
    es.addEventListener('state', (e) => handlers.state(JSON.parse(e.data)));
    es.addEventListener('info', (e) => handlers.info(JSON.parse(e.data)));
    es.onopen = () => { handlers.status(true); syncClock(); };
    es.onerror = () => handlers.status(false);   // EventSource переподключается сам
  }

  async function action(a, retry = true) {
    try {
      const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-pin': pin }, body: JSON.stringify(a) });
      if (r.status === 401 && retry) {
        const p = window.prompt('PIN-код пульта:');
        if (p !== null) { pin = p; try { localStorage.setItem('kbPin', pin); } catch {} return action(a, false); }
      }
    } catch { handlers.status(false); }
  }

  function reportSize(w, h) {
    fetch('/api/display-size', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, w, h }) }).catch(() => {});
  }

  window.NET = { id, connect, action, reportSize, syncClock, on: (k, f) => { handlers[k] = f; } };
  setInterval(syncClock, 30000);
})();
