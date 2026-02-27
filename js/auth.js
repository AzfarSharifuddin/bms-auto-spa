import { initDefaults, login, getSession } from './store.js';

initDefaults();

// If already logged in, redirect
const session = getSession();
if (session) {
    window.location.href = session.role === 'admin' ? '/pages/admin.html' : '/pages/dashboard.html';
}

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    const session = login(username, password);
    if (session) {
        window.location.href = session.role === 'admin' ? '/pages/admin.html' : '/pages/dashboard.html';
    } else {
        errorEl.classList.add('show');
        setTimeout(() => errorEl.classList.remove('show'), 3000);
    }
});
