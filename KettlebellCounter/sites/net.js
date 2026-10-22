// Shared network code for all pages: PIN login, state subscription, sending actions, clock synchronization.
(function () {
    const id = Math.random().toString(36).slice(2, 10);
    const handlers = { state() { }, info() { }, status() { }, auth() { } };
    let PIN = '';
    try { PIN = localStorage.getItem('kbPin') || ''; } catch { }

    // Closing the page also closes its EventSource. That must not look like a rejected PIN,
    // otherwise a reload would log the admin out and erase the remembered code.
    let leaving = false;
    addEventListener('pagehide', () => { leaving = true; });
    addEventListener('beforeunload', () => { leaving = true; });
    addEventListener('pageshow', () => { leaving = false; });

    function setPIN(p) {
        PIN = String(p || '');
        try { PIN ? localStorage.setItem('kbPin', PIN) : localStorage.removeItem('kbPin'); } catch { }
    }

    // Clocks of different computers drift apart, while the timer runs on server time.
    // Find the offset: several requests, keep the one with the lowest latency.
    async function syncClock() {
        let best = null;
        for (let i = 0; i < 6; i++) {
            try {
                const t0 = performance.now(), w0 = Date.now();
                const r = await fetch('/api/time', { cache: 'no-store' });
                const j = await r.json();
                const rtt = performance.now() - t0;
                if (!best || rtt < best.rtt) best = { rtt, offset: j.t - w0 - rtt / 2 };
            } catch { }
        }
        if (best && window.KB) KB.setClockOffset(best.offset);
    }

    // role: 'display' | 'controller' | 'adminpanel' (the admin panel needs a PIN)
    function connect(role, extra = '') {
        const pin = role === 'adminpanel' ? `&pin=${encodeURIComponent(PIN)}` : '';
        const es = new EventSource(`/events?role=${role}&id=${id}${pin}${extra}`);
        es.addEventListener('state', (e) => handlers.state(JSON.parse(e.data)));
        es.addEventListener('info', (e) => handlers.info(JSON.parse(e.data)));
        es.onopen = () => { handlers.status(true); syncClock(); };
        es.onerror = () => {
            handlers.status(false);   // EventSource reconnects by itself
            if (!leaving && role === 'adminpanel' && es.readyState === EventSource.CLOSED) handlers.auth();   // the server refused: wrong PIN
        };
    }

    // PIN check: { ok, role: 'admin' | 'team', teamid }
    async function login(pin) {
        try {
            const r = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ PIN: pin })
            });
            if (!r.ok) return { ok: false };
            const j = await r.json();
            setPIN(pin);
            return j;
        } catch { return { ok: false, error: true }; }
    }

    // Sending an action; on a wrong PIN the page receives an auth event and goes back to the login
    async function action(a) {
        try {
            const r = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-pin': PIN },
                body: JSON.stringify(a)
            });
            if (r.status === 401 && !leaving) handlers.auth();
            return r.ok;
        } catch { handlers.status(false); return false; }
    }

    function reportSize(w, h) {
        fetch('/api/display-size', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, w, h })
        }).catch(() => { });
    }

    window.NET = {
        id, connect, login, action, reportSize, syncClock, setPIN,
        get pin() { return PIN; },
        on: (k, f) => { handlers[k] = f; }
    };
    setInterval(syncClock, 30000);
})();
