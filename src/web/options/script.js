(async function loadUser() {
    const preload = document.getElementById('options-preload');
    try {
        if (preload) preload.style.display = 'flex';
        const res = await fetch('/api/users/status');
        if (!res.ok) return;
        const data = await res.json();
        const user = data?.user;
        const nameEl = document.getElementById('opt-name');
        const idEl = document.getElementById('opt-id');
        if (user) {
            if (nameEl) nameEl.textContent = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
            if (idEl) idEl.textContent = user.userCode || user.id || '-';
        } else {
            if (nameEl) nameEl.textContent = 'No user';
            if (idEl) idEl.textContent = '-';
        }
    } catch (err) {
        console.warn('Could not load user', err);
        AvaUI.showToast('Could not load user details', 'error');
    } finally {
        if (preload) preload.style.display = 'none';
    }
})();

