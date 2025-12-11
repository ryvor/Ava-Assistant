/*
 *	VARIABLES
 */
var account_number = -1;
let typingRow = null;
let isSending = false;
const THEME_COOKIE = "ava_theme";

/*
 *	ON PAGE LOAD
 */
window.addEventListener("load", async () => {
	applyTheme(readThemeCookie());
	bindThemeToggle();

	// Show preload page
	document.querySelector(".login-page").style.display = "none";
	document.querySelector(".preload-page").style.display = "flex";
	document.querySelector(".chat-page").style.display = "none";

	// Register service worker for PWA shell
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.register("/service-worker.js").catch((err) => {
			console.error("Service worker registration failed", err);
		});
	}

	const res = await fetch("/api/getUser", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
	});
	const responseContent = await res.json();

	if (responseContent.user) {
		// Set global account number
		account_number = responseContent.user;
		//
		document.querySelectorAll(".chat-page .user-name").forEach(el => {
			el.textContent = responseContent.displayName || "User";
		});
		document.querySelectorAll(".chat-page .user-account").forEach(el => {
			el.textContent = account_number.toString().replace(/(\d{3})(\d{3})/, "$1 $2") || "XXX XXX";
		});
		document.querySelector(".login-page").style.display = "none";
		document.querySelector(".preload-page").style.display = "none";
		document.querySelector(".chat-page").style.display = "flex";
		// Focus message input
		document.querySelector('#msg').focus();
	} else {
		document.querySelector(".login-page").style.display = "flex";
		document.querySelector(".preload-page").style.display = "none";
		document.querySelector(".chat-page").style.display = "none";
		
		// Focus code input
		const firstInput = document.querySelector("#login-step-code .code-input input");
		if (firstInput) firstInput.focus();
	}
});

/*
 *	MESSAGE HANDLING
 */

async function send() {
	const input = document.getElementById("msg");
	const text = input.value.trim();
	if (!text) return;
	if (isSending) return;
	isSending = true;

	// Append your local "user message" bubble here
	sentMessage = addMessageBubble("me", text);
	scrollChatToBottom(true);

	input.value = "";
	showTypingIndicator();

	try {
		const res = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: text, account_number: account_number }),
		});
	
		const data = await res.json()
	
		if (res.status === 401) {
			console.log(data.error);
			sentMessage.remove();
			if (data.error) {
				showToast(data.error, "warning");
			} else {
				showToast("An unknown error occurred", "warning");
			}
			return;
		}
	
		;
	
		// Add Ava's reply
		addMessageBubble("ava", data.reply);
		scrollChatToBottom(true);
	} catch (err) {
		console.error("Chat error", err);
		showToast("Could not reach Ava. Please try again.", "error");
	} finally {
		hideTypingIndicator();
		isSending = false;
	}
}

function addMessageBubble(sender, text) {
	const container = document.querySelector(".chat-content");

	const row = document.createElement("div");
	row.classList.add("msg-row");
	if (sender === "me") row.classList.add("me");

	const bubble = document.createElement("div");
	bubble.classList.add("msg-bubble");
	bubble.textContent = text;

	row.appendChild(bubble);
	return container.appendChild(row);
}

function showTypingIndicator() {
	hideTypingIndicator();
	const container = document.querySelector(".chat-content");
	if (!container) return;

	const row = document.createElement("div");
	row.classList.add("msg-row", "typing");

	const bubble = document.createElement("div");
	bubble.classList.add("msg-bubble", "typing-bubble");

	const dots = document.createElement("span");
	dots.classList.add("typing-dots");
	dots.innerHTML = "<span></span><span></span><span></span>";

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

/*
 *	THEME TOGGLING
 */
function applyTheme(theme) {
	const clean = theme === "dark" ? "dark" : "light";
	document.body.classList.toggle("theme-dark", clean === "dark");
	updateThemeIcon(clean);
	writeThemeCookie(clean);
}

function toggleTheme() {
	const isDark = document.body.classList.contains("theme-dark");
	applyTheme(isDark ? "light" : "dark");
}

function bindThemeToggle() {
	const btn = document.querySelector(".theme-toggle");
	if (!btn) return;
	btn.addEventListener("click", toggleTheme);
	updateThemeIcon(document.body.classList.contains("theme-dark") ? "dark" : "light");
}

function updateThemeIcon(theme) {
	const icon = document.querySelector(".theme-toggle i");
	if (!icon) return;
	icon.className = theme === "dark" ? "ph ph-sun" : "ph ph-moon";
}

function writeThemeCookie(theme) {
	document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

function readThemeCookie() {
	const parts = document.cookie.split(";").map(c => c.trim());
	for (const part of parts) {
		if (part.startsWith(`${THEME_COOKIE}=`)) {
			return part.split("=", 2)[1];
		}
	}
	return "light";
}

document.querySelector(".message-send").addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault(); // stops newline
		send();
	}
});

// Close sidebar on Escape when focused (mobile UX)
document.addEventListener("keydown", (e) => {
	if (e.key !== "Escape") return;
	const sidebar = document.querySelector(".sidebar");
	if (!sidebar) return;
	if (sidebar === document.activeElement) {
		sidebar.blur();
	}
});

/*
 *	USER AUTHENTICATION
 */

async function startAuth() {
	const digits = [...document.querySelectorAll('#login-step-code .code-input input')].map(i => i.value).join('');
	if (digits.length !== 6)
		return showToast("Please Enter all 6 digits", "alert");

	const res = await fetch("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ account_number: digits })
	});
	const data = await res.json();
	account_number = digits;

	if (data.status !== "challenge_required")
		return showToast("Code not recognised", "error");

	// Move to challenge step
	document.querySelectorAll(".login-step.active").forEach(el => el.classList.remove("active"));
	switch (data.security_type) {
		case "PIN":
			document.querySelector("#login-step-pin").classList.add("active");
			document.querySelectorAll('#login-step-pin .code-input input')[0].focus();
			break;
		case "challenge":
			document.querySelector("#login-step-challenge").classList.add("active");
			document.querySelector("#challenge-question").textContent = data.question;
			break;
		default:
			return showToast("Unknown authentication stage", "error");
	}
}

async function submitPin() {
	const pinDigits = [...document.querySelectorAll('#login-step-pin .code-input input')]
	.map(i => i.value).join('');

	if (pinDigits.length !== 4) return showToast("Please Enter all 6 digits", "alert");

	const res = await fetch("/api/auth/verifyPin", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ account_number: account_number, pin: pinDigits })
	});

	const data = await res.json();

	if (data.status === "SUCCESS") {
		showToast("Authentication Successful!", "success");
		document.querySelector(".login-page").style.display = "none";
		document.querySelector(".chat-page").style.display = "flex";
	} else {
		showToast("Incorrect PIN, please try again", "error");
	}
}

function scrollChatToBottom(force = false) {
	const chat = document.querySelector(".chat-content");

	if (!chat) return;

	// If forced or user is already near the bottom
	const nearBottom =
	chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 60;

	if (force || nearBottom) {
		chat.scrollTop = chat.scrollHeight;
	}
}
const codeInputs = document.querySelectorAll(".login-page .code-input input")
codeInputs.forEach((input, index) => {
	input.addEventListener("input", e => {
		const value = e.target.value;

		// Allow only digits
		if (!/^\d$/.test(value)) {
			e.target.value = "";
			return;
		}

		// Move to next input if exists
		if (index < codeInputs.length - 1) {
			codeInputs[index + 1].focus();
		} else {
			// Last box filled: optionally auto-submit
			// startAuth();
		}
	});

	input.addEventListener("keydown", e => {
		// Backspace logic
		if (e.key === "Backspace" && e.target.value === "") {
			if (index > 0) {
				codeInputs[index - 1].focus();
			}
		}
	});

	// Handle pasting a 6-digit code
	input.addEventListener("paste", e => {
		const text = (e.clipboardData || window.clipboardData).getData("text");
		if (/^\d{6}$/.test(text)) {
			// Fill all inputs
			for (let i = 0; i < 6; i++) {
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
	console.log("Setting focus on sidebar");
	document.querySelector('.sidebar').focus();
}

// Hide the sidebar when clicking outside (mobile)
document.addEventListener("click", (e) => {
	const sidebar = document.querySelector(".sidebar");
	if (!sidebar) return;
	const isToggle = e.target.closest(".button.icon");
	if (window.innerWidth > 900) return; // desktop unaffected
	if (sidebar.contains(e.target) || isToggle) return;
	if (sidebar === document.activeElement) {
		sidebar.blur();
	}
});

function showGeneralInfo() {
	console.log("Setting focus on information page");
	document.querySelector('.info-body').focus();
}

function hideGeneralInfo() {
	console.log("Removing focus from information page");
	document.querySelector('.info-body').blur();
}

async function logout() {
	try {
		await fetch("/api/logout", { method: "POST" });
	} catch (err) {
		console.error("Logout error", err);
	}
	account_number = -1;
	document.querySelector(".chat-page").style.display = "none";
	document.querySelector(".login-page").style.display = "flex";
	document.querySelectorAll(".login-page .login-step").forEach(el => el.classList.remove("active"));
	document.querySelector("#login-step-code").classList.add("active");
	const firstInput = document.querySelector("#login-step-code .code-input input");
	if (firstInput) firstInput.focus();
	showToast("Logged out", "info");
}

/*
 *	TOAST CONTROLS
 */

function showToast(message, type = "info") {
	const container = document.getElementById("toast-container");
	if (!container) return;

	const toast = document.createElement("div");
	toast.classList.add("toast", `toast--${type}`);

	const iconSpan = document.createElement("span");
	iconSpan.classList.add("toast-icon");

	if (type === "success") iconSpan.textContent = "✔";
	else if (type === "error") iconSpan.textContent = "⛒";
	else if (type === "alert") iconSpan.textContent = "⚠";
	else iconSpan.textContent = "ⓘ";

	const msgSpan = document.createElement("div");
	msgSpan.classList.add("toast-message");
	msgSpan.textContent = message;

	toast.appendChild(iconSpan);
	toast.appendChild(msgSpan);

	// Click to dismiss
	toast.addEventListener("click", () => {
		hideToast(toast);
	});

	container.appendChild(toast);

	// Auto hide after 4s
	setTimeout(() => hideToast(toast), 4000);
}

function hideToast(toast) {
	toast.classList.add("hide");
	toast.addEventListener("animationend", () => {
		toast.remove();
	}, { once: true });
}
