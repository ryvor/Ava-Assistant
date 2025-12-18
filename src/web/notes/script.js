let currentUser = null;
let notes = [];
let saveTimer = null;

window.addEventListener('load', () => {
    AvaUI.applyTheme(AvaUI.readThemeCookie());
    AvaUI.registerServiceWorker();
    bindThemeToggle();
    bindSidebarAutoHide();
    bootstrapNotes();
});

async function bootstrapNotes() {
    const preload = document.querySelector('.preload-page');
    const page = document.querySelector('.chat-page');
    if (page) page.style.display = 'none';
    try {
        const user = await resumeSession();
        if (!user) {
            window.location.href = '/login';
            return;
        }
        setActiveUser(user);
        updateUserMeta(currentUser);
        await loadNotes();
        renderNotes();
        if (page) page.style.display = 'flex';
    } catch (err) {
        console.error('Failed to load notes page', err);
        window.location.href = '/login';
    } finally {
        if (preload) preload.style.display = 'none';
    }
}

async function resumeSession() {
    const token = AvaUI.readSessionToken();
    if (!token) return null;
    const res = await fetch('/api/users/session', { headers: { 'x-session-token': token } });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.user || null;
}

function setActiveUser(user) {
    const displayName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    const accountNumberValue = user?.userCode || user?.accountNumber;
    if (!displayName || !accountNumberValue) {
        throw new Error('Invalid user data');
    }
    currentUser = { displayName, accountNumber: accountNumberValue };
}

function updateUserMeta(user) {
    if (!user) return;
    const acct = AvaUI.formatAccountNumber(user.accountNumber);
    document.querySelectorAll('.user-name').forEach((el) => (el.textContent = user.displayName));
    document.querySelectorAll('.user-account').forEach((el) => (el.textContent = acct));
}

function bindThemeToggle() {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('theme-dark');
        AvaUI.applyTheme(isDark ? 'light' : 'dark');
        updateThemeIcon(isDark ? 'light' : 'dark');
    });
    updateThemeIcon(document.body.classList.contains('theme-dark') ? 'dark' : 'light');
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-toggle i');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
}

function bindSidebarAutoHide() {
    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const isToggle = target.closest('.button.icon');
        if (window.innerWidth > 900) return;
        if (sidebar.contains(target) || isToggle) return;
        if (sidebar === document.activeElement) sidebar.blur();
    });
}

function showSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.focus();
}

async function loadNotes() {
    try {
        setStatus('Loading...');
        const res = await fetch('/api/notes', {
            headers: { 'x-session-token': AvaUI.readSessionToken() || '' },
        });
        if (!res.ok) throw new Error('Failed to load notes');
        const data = await res.json();
        notes = Array.isArray(data?.notes) ? data.notes : [];
        setStatus(notes.length ? 'Loaded' : 'Empty');
    } catch (err) {
        console.error('Notes load failed', err);
        notes = [];
        setStatus('Error');
        AvaUI.showToast('Could not load notes', 'error');
    }
}

function scheduleSave(note) {
    setStatus('Unsaved');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        void syncNote(note);
    }, 400);
}

async function syncNote(note) {
    try {
        if (!note.id || String(note.id).startsWith('temp')) {
            const created = await apiCreateNote(note.title, note.body, note.position ?? 0);
            const idx = notes.findIndex((n) => n.id === note.id);
            if (idx >= 0) notes[idx] = created;
        } else {
            await apiUpdateNote(note);
        }
        setStatus('Saved');
    } catch (err) {
        console.error('Note sync failed', err);
        setStatus('Error');
        AvaUI.showToast('Could not save note', 'error');
    }
}

function renderNotes() {
    const grid = document.getElementById('notes-grid');
    const empty = document.getElementById('notes-empty');
    if (!grid || !empty) return;
    grid.innerHTML = '';
    if (notes.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    notes.forEach((note, idx) => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.draggable = true;
        card.dataset.id = note.id;

        const title = document.createElement('input');
        title.className = 'note-title';
        title.value = note.title || 'Untitled';
        title.placeholder = 'Title';
        title.addEventListener('input', (e) => {
            note.title = e.target.value;
            scheduleSave(note);
        });

        const body = document.createElement('textarea');
        body.className = 'note-body';
        body.value = note.body || '';
        body.placeholder = 'Write something...';
        body.addEventListener('input', (e) => {
            note.body = e.target.value;
            scheduleSave(note);
        });

        const footer = document.createElement('div');
        footer.className = 'note-footer';

        const del = document.createElement('button');
        del.className = 'note-btn';
        del.title = 'Delete note';
        del.innerHTML = '<i class=\"ph ph-trash\"></i>';
        del.addEventListener('click', () => deleteNote(note.id));

        footer.appendChild(del);
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(footer);

        card.addEventListener('dragstart', (e) => onDragStart(e, idx));
        card.addEventListener('dragover', (e) => onDragOver(e, idx));
        card.addEventListener('drop', (e) => onDrop(e, idx));
        card.addEventListener('dragend', onDragEnd);

        grid.appendChild(card);
    });
}

function addNote() {
    const newNote = {
        id: crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`,
        title: 'New note',
        body: '',
        position: 0,
        updated: Date.now(),
    };
    // push existing notes down
    notes = [{ ...newNote }, ...notes.map((n, idx) => ({ ...n, position: idx + 1 }))];
    renderNotes();
    scheduleSave(newNote);
}

function deleteNote(id) {
    void deleteNoteServer(id);
}

let dragSrcIndex = null;

function onDragStart(event, idx) {
    dragSrcIndex = idx;
    event.dataTransfer?.setData('text/plain', String(idx));
    event.currentTarget.classList.add('dragging');
}

function onDragOver(event, idx) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function onDrop(event, idx) {
    event.preventDefault();
    if (dragSrcIndex === null || dragSrcIndex === idx) return;
    const moved = notes.splice(dragSrcIndex, 1)[0];
    notes.splice(idx, 0, moved);
    notes = notes.map((n, i) => ({ ...n, position: i }));
    dragSrcIndex = null;
    renderNotes();
    void syncOrder();
}

function onDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    dragSrcIndex = null;
}

async function syncOrder() {
    try {
        await Promise.all(
            notes.map((n, idx) => apiUpdateNote({ ...n, position: idx }))
        );
        setStatus('Saved');
    } catch (err) {
        console.error('Order sync failed', err);
        setStatus('Error');
    }
}

async function deleteNoteServer(id) {
    try {
        const target = notes.find((n) => n.id === id);
        if (!target) return;
        if (!String(id).startsWith('temp')) {
            await apiDeleteNote(id);
        }
        notes = notes.filter((n) => n.id !== id).map((n, idx) => ({ ...n, position: idx }));
        renderNotes();
        setStatus('Saved');
    } catch (err) {
        console.error('Delete failed', err);
        AvaUI.showToast('Could not delete note', 'error');
    }
}

function apiHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-session-token': AvaUI.readSessionToken() || '',
    };
}

async function apiCreateNote(title, body, position) {
    const res = await fetch('/api/notes', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ title, body, position }),
    });
    if (!res.ok) throw new Error('Create failed');
    const data = await res.json();
    return data.note;
}

async function apiUpdateNote(note) {
    const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({ title: note.title, body: note.body, position: note.position ?? 0 }),
    });
    if (!res.ok) throw new Error('Update failed');
}

async function apiDeleteNote(id) {
    const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: apiHeaders(),
    });
    if (!res.ok) throw new Error('Delete failed');
}

function setStatus(text) {
    const status = document.getElementById('notes-status');
    if (status) status.textContent = text;
}

function logout() {
    const token = AvaUI.readSessionToken();
    if (token) {
        void fetch('/api/users/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-token': token },
            body: JSON.stringify({ sessionToken: token }),
        }).catch(() => {});
    }
    AvaUI.clearSessionToken();
    window.location.href = '/login';
}
