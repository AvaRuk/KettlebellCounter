// Site theme: picked per device and remembered in localStorage. Loaded in <head> so the theme is applied before the page is drawn.
// Every page has <select class="themepick" id="themeSel"> in its header; this script fills it.
(function () {
    const THEMES = [['tgasu', 'ТГАСУ'], ['amoled', 'Amoled'], ['graphite', 'Графит'], ['light', 'Светлая'], ['contrast', 'Контрастная']];
    const KEY = 'kbTheme';
    const valid = (v) => THEMES.some((t) => t[0] === v);
    const apply = (v) => { document.documentElement.dataset.theme = v; };

    let cur = THEMES[0][0];
    try { const v = localStorage.getItem(KEY); if (valid(v)) cur = v; } catch { }
    apply(cur);

    document.addEventListener('DOMContentLoaded', () => {
        const sel = document.getElementById('themeSel');
        if (!sel) return;
        THEMES.forEach(([id, name]) => sel.add(new Option(name, id)));
        sel.value = cur;
        // Picked with the mouse / finger: give the focus back to the page, so its hotkeys (Space, arrows…) work again.
        // Picked with the keyboard: keep the focus, otherwise the next keypress would go to the page as a hotkey
        // (on the judge's page Space is "+1") — Enter / Escape leave the select.
        let byKey = false;
        sel.addEventListener('keydown', () => { byKey = true; });
        sel.addEventListener('pointerdown', () => { byKey = false; });
        sel.onchange = () => {
            cur = sel.value;
            apply(cur);
            try { localStorage.setItem(KEY, cur); } catch { }
            if (!byKey) sel.blur();
        };
    });

    // Another tab of the same browser changed the theme
    window.addEventListener('storage', (e) => {
        if (e.key !== KEY || !valid(e.newValue)) return;
        cur = e.newValue; apply(cur);
        const sel = document.getElementById('themeSel'); if (sel) sel.value = cur;
    });
})();
