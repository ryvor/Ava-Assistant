const SAVED_USERS_KEY = 'ava_saved_users';

window.addEventListener('load', () => {
    AvaUI.applyTheme(AvaUI.readThemeCookie());
    void bootstrapLogin();
});

// Entry point: try to resume a session, otherwise show login UI
async function bootstrapLogin() {
    const preload = document.getElementById('login-preload');
    const page = document.getElementById('login-page');
    try {
        const resumed = await tryResumeSession();
        if (resumed) {
            window.location.href = '/';
            return;
        }
        if (page) page.style.display = 'flex';
        renderSavedUsers();
    } catch (err) {
        console.error('Login bootstrap failed', err);
        if (page) page.style.display = 'flex';
    } finally {
        if (preload) preload.style.display = 'none';
    }
}

async function loginUser() {
    const idInput = document.getElementById('login-id');
    const pinInput = document.getElementById('login-pin');
    const rememberInput = document.getElementById('login-remember');
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';

    const userCode = (idInput?.value || '').trim();
    const pin = (pinInput?.value || '').trim();

    if (!/^[0-9]{6}$/.test(userCode) || !/^[0-9]{4}$/.test(pin)) {
        if (errorEl) errorEl.textContent = 'Enter a 6-digit ID and 4-digit PIN.';
        return;
    }

    try {
        const res = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userCode, pin, rememberMe: !!rememberInput?.checked }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const message = data?.message || 'Invalid ID or PIN.';
            if (errorEl) errorEl.textContent = message;
            return;
        }
        if (rememberInput?.checked && data.sessionToken) {
            AvaUI.writeSessionToken(data.sessionToken);
            saveUserShortcut(data.user);
        } else {
            AvaUI.clearSessionToken();
        }
        window.location.href = '/';
    } catch (err) {
        console.error('Login error', err);
        if (errorEl) errorEl.textContent = 'Network error. Please try again.';
    }
}

// Render quick-select avatars for remembered users (no PIN stored)
function renderSavedUsers() {
    const container = document.getElementById('saved-users');
    if (!container) return;
    const users = readSavedUsers();
    container.innerHTML = '';
    users.forEach((u) => {
        const el = document.createElement('div');
        el.className = 'saved-user';
        el.title = u.name || u.userCode;
        el.dataset.usercode = u.userCode;
        el.innerHTML = `<span>${u.initials}</span>`;
        el.addEventListener('click', () => quickFillUser(u.userCode));
        container.appendChild(el);
    });
    if (users.length === 0) {
        container.style.display = 'none';
    } else {
        container.style.display = 'flex';
    }
}

function quickFillUser(userCode) {
    const idInput = document.getElementById('login-id');
    const pinInput = document.getElementById('login-pin');
    if (idInput) {
        idInput.value = String(userCode || '');
        idInput.focus();
    }
    if (pinInput) pinInput.value = '';
}

function saveUserShortcut(user) {
    try {
        const list = readSavedUsers().filter((u) => u.userCode !== user.userCode);
        const initials = (user?.name || `${user?.firstName || ''} ${user?.lastName || ''}` || 'User')
            .trim()
            .split(/\s+/)
            .map((p) => p[0]?.toUpperCase() || '')
            .join('')
            .slice(0, 3) || 'U';
        list.unshift({
            userCode: user?.userCode || '',
            name: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User',
            initials,
        });
        localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(list.slice(0, 8)));
    } catch (err) {
        console.warn('Could not save user shortcut', err);
    }
    renderSavedUsers();
}

function readSavedUsers() {
    try {
        const raw = localStorage.getItem(SAVED_USERS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((u) => ({
            userCode: u.userCode,
            name: u.name,
            initials: u.initials || (u.name || '').slice(0, 2).toUpperCase(),
        }));
    } catch (err) {
        console.warn('Could not read saved users', err);
        return [];
    }
}

async function tryResumeSession() {
    const token = AvaUI.readSessionToken();
    if (!token) return null;
    try {
        const res = await fetch('/api/users/session', {
            headers: { 'x-session-token': token },
        });
        if (!res.ok) {
            AvaUI.clearSessionToken();
            return null;
        }
        const data = await res.json();
        return data?.user || null;
    } catch (err) {
        console.warn('Session resume failed', err);
        return null;
    }
}
