/*
 *	UI STATE
 */
const DEFAULT_USER = {
	displayName: 'Guest User',
	accountNumber: '000000'
};
var account_number = DEFAULT_USER.accountNumber;
let typingRow = null;
let isSending = false;
const THEME_COOKIE = 'ava_theme';

/*
 *	ON PAGE LOAD
 */
window.addEventListener('load', () => {
	applyTheme(readThemeCookie());
	bindThemeToggle();
	setPageState('preload');
	registerServiceWorker();

	// Simulate a quick preload, then drop into the chat UI
	setTimeout(() => {
		showChatPage(DEFAULT_USER);
	}, 400);

	const messageInput = document.querySelector('.message-send');
	if (messageInput) {
		messageInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				send();
			}
		});
	}
});

function registerServiceWorker() {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/service-worker.js').catch((err) => {
			console.error('Service worker registration failed', err);
		});
	}
}

function setPageState(state) {
	const loginEl = document.querySelector('.login-page');
	const preloadEl = document.querySelector('.preload-page');
	const chatEl = document.querySelector('.chat-page');

	if (loginEl) loginEl.style.display = state === 'login' ? 'flex' : 'none';
	if (preloadEl) preloadEl.style.display = state === 'preload' ? 'flex' : 'none';
	if (chatEl) chatEl.style.display = state === 'chat' ? 'flex' : 'none';
}

function showChatPage(user = DEFAULT_USER) {
	account_number = user.accountNumber || DEFAULT_USER.accountNumber;
	document.querySelectorAll('.chat-page .user-name').forEach((el) => {
		el.textContent = user.displayName || DEFAULT_USER.displayName;
	});
	document.querySelectorAll('.chat-page .user-account').forEach((el) => {
		el.textContent = formatAccountNumber(account_number);
	});
	setPageState('chat');

	const input = document.getElementById('msg');
	if (input) input.focus();
}

function formatAccountNumber(value) {
	return (value || '').toString().replace(/(\d{3})(\d{3})/, '$1 $2') || '000 000';
}

/*
 *	MESSAGE HANDLING
 */
async function send() {
	const input = document.getElementById('msg');
	if (!input) return;

	const text = input.value.trim();
	if (!text || isSending) return;
	isSending = true;

	addMessageBubble('me', text);
	scrollChatToBottom(true);

	input.value = '';
	showTypingIndicator();

	try {
		const res = await fetch('/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: text })
		});

		let data = {};
		try {
			data = await res.json();
		} catch {
			data = {};
		}

		if (!res.ok || !data.reply) {
			showToast('Sorry, something went wrong.', 'error');
		} else {
			addMessageBubble('ava', data.reply);
			scrollChatToBottom(true);
		}
	} catch (err) {
		console.error('Chat error', err);
		showToast('Could not reach Ava. Please try again.', 'error');
	} finally {
		hideTypingIndicator();
		isSending = false;
		input.focus();
	}
}

function addMessageBubble(sender, text) {
	const container = document.querySelector('.chat-content');
	if (!container) return null;

	const row = document.createElement('div');
	row.classList.add('msg-row');
	if (sender === 'me') row.classList.add('me');

	const bubble = document.createElement('div');
	bubble.classList.add('msg-bubble');
	bubble.textContent = text;

	row.appendChild(bubble);
	container.appendChild(row);
	return row;
}

function showTypingIndicator() {
	hideTypingIndicator();
	const container = document.querySelector('.chat-content');
	if (!container) return;

	const row = document.createElement('div');
	row.classList.add('msg-row', 'typing');

	const bubble = document.createElement('div');
	bubble.classList.add('msg-bubble', 'typing-bubble');

	const dots = document.createElement('span');
	dots.classList.add('typing-dots');
	dots.innerHTML = '<span></span><span></span><span></span>';

	bubble.appendChild(dots);
	row.appendChild(bubble);

	typingRow = container.appendChild(row);
	scrollChatToBottom(true);
}

function hideTypingIndicator() {
	if (typingRow && typingRow.parentNode) {
		typingRow.remove();
	}
	typingRow = null;
}

function scrollChatToBottom(force = false) {
	const chat = document.querySelector('.chat-content');
	if (!chat) return;

	const nearBottom = chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 60;
	if (force || nearBottom) {
		chat.scrollTop = chat.scrollHeight;
	}
}

/*
 *	THEME TOGGLING
 */
function applyTheme(theme) {
	const clean = theme === 'dark' ? 'dark' : 'light';
	document.body.classList.toggle('theme-dark', clean === 'dark');
	updateThemeIcon(clean);
	writeThemeCookie(clean);
}

function toggleTheme() {
	const isDark = document.body.classList.contains('theme-dark');
	applyTheme(isDark ? 'light' : 'dark');
}

function bindThemeToggle() {
	const btn = document.querySelector('.theme-toggle');
	if (!btn) return;
	btn.addEventListener('click', toggleTheme);
	updateThemeIcon(document.body.classList.contains('theme-dark') ? 'dark' : 'light');
}

function updateThemeIcon(theme) {
	const icon = document.querySelector('.theme-toggle i');
	if (!icon) return;
	icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
}

function writeThemeCookie(theme) {
	document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

function readThemeCookie() {
	const parts = document.cookie.split(';').map((c) => c.trim());
	for (const part of parts) {
		if (part.startsWith(`${THEME_COOKIE}=`)) {
			return part.split('=', 2)[1];
		}
	}
	return 'light';
}

// Close sidebar on Escape when focused (mobile UX)
document.addEventListener('keydown', (e) => {
	if (e.key !== 'Escape') return;
	const sidebar = document.querySelector('.sidebar');
	if (!sidebar) return;
	if (sidebar === document.activeElement) {
		sidebar.blur();
	}
});

/*
 *	USER AUTHENTICATION (SIMPLE DEMO PLACEHOLDERS)
 */
async function startAuth() {
	showToast('Welcome back! Loading your workspace…', 'success');
	showChatPage(DEFAULT_USER);
}

async function submitPin() {
	showChatPage(DEFAULT_USER);
	showToast('PIN verified. You are logged in.', 'success');
}

async function submitChallenge() {
	showChatPage(DEFAULT_USER);
	showToast('Challenge complete. Enjoy chatting!', 'success');
}

const codeInputs = document.querySelectorAll('.login-page .code-input input');
codeInputs.forEach((input, index) => {
	input.addEventListener('input', (e) => {
		const value = e.target.value;
		if (!/^\d$/.test(value)) {
			e.target.value = '';
			return;
		}
		if (index < codeInputs.length - 1) {
			codeInputs[index + 1].focus();
		}
	});

	input.addEventListener('keydown', (e) => {
		if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
			codeInputs[index - 1].focus();
		}
	});

	input.addEventListener('paste', (e) => {
		const text = (e.clipboardData || window.clipboardData).getData('text');
		if (/^\d{6}$/.test(text)) {
			for (let i = 0; i < 6; i += 1) {
				codeInputs[i].value = text[i];
			}
			e.preventDefault();
			codeInputs[5].focus();
			startAuth();
		}
	});
});

/*
 *	RESPONSIVE DESIGN
 */
function showSidebar() {
	const sidebar = document.querySelector('.sidebar');
	if (sidebar) sidebar.focus();
}

document.addEventListener('click', (e) => {
	const sidebar = document.querySelector('.sidebar');
	if (!sidebar) return;
	const isToggle = e.target.closest('.button.icon');
	if (window.innerWidth > 900) return;
	if (sidebar.contains(e.target) || isToggle) return;
	if (sidebar === document.activeElement) {
		sidebar.blur();
	}
});

function showGeneralInfo() {
	const info = document.querySelector('.info-body');
	if (info) info.focus();
}

function hideGeneralInfo() {
	const info = document.querySelector('.info-body');
	if (info) info.blur();
}

function logout() {
	showToast('Logged out locally. You can keep chatting!', 'info');
	showChatPage(DEFAULT_USER);
}

/*
 *	TOAST CONTROLS
 */
function showToast(message, type = 'info') {
	const container = document.getElementById('toast-container');
	if (!container) return;

	const toast = document.createElement('div');
	toast.classList.add('toast', `toast--${type}`);

	const iconSpan = document.createElement('span');
	iconSpan.classList.add('toast-icon');

	if (type === 'success') iconSpan.textContent = '✔';
	else if (type === 'error') iconSpan.textContent = '⛒';
	else if (type === 'alert') iconSpan.textContent = '⚠';
	else iconSpan.textContent = 'ⓘ';

	const msgSpan = document.createElement('div');
	msgSpan.classList.add('toast-message');
	msgSpan.textContent = message;

	toast.appendChild(iconSpan);
	toast.appendChild(msgSpan);

	toast.addEventListener('click', () => {
		hideToast(toast);
	});

	container.appendChild(toast);

	setTimeout(() => hideToast(toast), 4000);
}

function hideToast(toast) {
	toast.classList.add('hide');
	toast.addEventListener(
		'animationend',
		() => {
			toast.remove();
		},
		{ once: true }
	);
}
