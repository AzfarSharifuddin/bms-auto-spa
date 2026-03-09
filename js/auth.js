import { login, getSession } from './store.js';

// If already logged in, redirect
(async () => {
    const session = await getSession();
    if (session) {
        window.location.href = session.role === 'admin' ? '/pages/admin.html' : '/pages/dashboard.html';
        return;
    }

    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        // Support both email and shorthand username
        let email = emailInput;
        if (!email.includes('@')) {
            email = `${email}@bmsautospa.com`;
        }

        const session = await login(email, password);
        if (session) {
            window.location.href = session.role === 'admin' ? '/pages/admin.html' : '/pages/dashboard.html';
        } else {
            errorEl.classList.add('show');
            setTimeout(() => errorEl.classList.remove('show'), 3000);
        }
    });
})();
