// Login page: the PIN determines the role and redirects to the right page.
const $ = (id) => document.getElementById(id);

// The logo is optional: if there is no logo.png file, hide the image
const logo = $('logo');
const hideLogo = () => (logo.style.display = 'none');
logo.addEventListener('error', hideLogo);
if (logo.complete && logo.naturalWidth === 0) hideLogo();

function go(r) {
    if (r.role === 'admin') location.href = '/adminpanel';
    else if (r.role === 'timer') location.href = '/timer';
    else location.href = '/controller';
}

// Already logged in on this device — go straight on
(async () => {
    if (!NET.pin) return;
    const r = await NET.login(NET.pin);
    if (r.ok) go(r);
})();

$('form').onsubmit = async (e) => {
    e.preventDefault();
    const pin = $('pin').value.trim();
    if (!pin) return;
    $('go').disabled = true;
    $('err').textContent = '';
    const r = await NET.login(pin);
    $('go').disabled = false;
    if (r.ok) return go(r);
    $('err').textContent = r.error ? 'Нет связи с сервером' : 'Неверный PIN-код';
    $('pin').select();
};
