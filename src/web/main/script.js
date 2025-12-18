/*
    Main chat UI logic for Ava.
    Handles session resume, messaging, history paging, theming, and basic UI toggles.
*/

// --- Core state -------------------------------------------------------------
let currentUser = null;
let typingRow = null;
let isSending = false;

const REMEMBER_KEY = "ava_session_token";
const PENDING_CHAT_KEY = "ava_pending_chat";
const THEME_COOKIE = "ava_theme";

const HISTORY_PAGE_SIZE = 30;
let historyOffset = 0;
let historyHasMore = true;
let isLoadingHistory = false;
let pendingPoll = null;

// --- Bootstrap --------------------------------------------------------------
window.addEventListener("load", () => {
    applyTheme(readThemeCookie());
    bindThemeToggle();
    registerServiceWorker();
    bindChatInput();
    bindHistoryScroll();
    bindSidebarAutoHide();
    bootstrapApp();
});

async function bootstrapApp() {
    const preloadEl = document.querySelector(".preload-page");
    const chatEl = document.querySelector(".chat-page");
    if (chatEl) chatEl.style.display = "none";
    if (preloadEl) preloadEl.style.display = "flex";

    try {
        const resumed = await tryResumeSession();
        if (!resumed) {
            window.location.href = "/login";
            return;
        }
        const normalized = setActiveUser(resumed);
        await showChatPage(normalized);
        const pending = getPendingChat();
        if (pending) {
            startPendingPoll(pending.startedAt);
        } else {
            inferPendingFromHistory();
        }
    } catch (err) {
        console.error("Failed to load user status", err);
        window.location.href = "/login";
    } finally {
        if (preloadEl) preloadEl.style.display = "none";
        if (chatEl) chatEl.style.display = "flex";
    }
}

// --- User/session -----------------------------------------------------------
function setActiveUser(user) {
    const displayName =
        user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
    const accountNumberValue = user?.userCode || user?.accountNumber;
    if (!displayName || !accountNumberValue) {
        throw new Error("Invalid user data; missing display name or account number");
    }
    currentUser = { displayName, accountNumber: accountNumberValue };
    return currentUser;
}

async function showChatPage(user) {
    const active = user?.displayName ? user : currentUser;
    if (!active || !active.accountNumber) {
        window.location.href = "/login";
        return;
    }
    currentUser = active;
    updateUserMeta(currentUser);
    resetChatHistory();
    await loadHistory(true);
    inferPendingFromHistory();
    const input = document.getElementById("msg");
    if (input) input.focus();
}

function updateUserMeta(user) {
    if (!user || !user.accountNumber || !user.displayName) {
        window.location.href = "/login";
        return;
    }
    const accountNumber = formatAccountNumber(user.accountNumber);
    document.querySelectorAll(".chat-page .user-name").forEach((el) => {
        el.textContent = user.displayName;
    });
    document.querySelectorAll(".chat-page .user-account").forEach((el) => {
        el.textContent = accountNumber;
    });
}

function readSessionToken() {
    try {
        return localStorage.getItem(REMEMBER_KEY);
    } catch (err) {
        console.warn("Could not read session token", err);
        return null;
    }
}

function clearSessionToken() {
    try {
        localStorage.removeItem(REMEMBER_KEY);
    } catch (err) {
        console.warn("Could not clear session token", err);
    }
}

async function tryResumeSession() {
    const token = readSessionToken();
    if (!token) return null;
    try {
        const res = await fetch("/api/users/session", {
            headers: { "x-session-token": token },
        });
        if (!res.ok) {
            clearSessionToken();
            return null;
        }
        const data = await res.json();
        const user = data?.user || null;
        if (!user) {
            clearSessionToken();
            return null;
        }
        return user;
    } catch (err) {
        console.warn("Session resume failed", err);
        return null;
    }
}

function logout() {
    const token = readSessionToken();
    if (token) {
        void fetch("/api/users/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-session-token": token },
            body: JSON.stringify({ sessionToken: token }),
        }).catch(() => {});
    }
    clearSessionToken();
    window.location.href = "/login";
}

// --- Messaging --------------------------------------------------------------
function bindChatInput() {
    const input = document.querySelector(".message-send");
    if (!input) return;
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });
}

async function sendMessage() {
    const input = document.getElementById("msg");
    if (!input) return;

    const text = input.value.trim();
    if (!text || isSending) return;
    isSending = true;

    addMessageBubble("me", text);
    scrollChatToBottom(true);

    input.value = "";
    showTypingIndicator();
    savePendingChat();

    const startedAt = Date.now();
    savePendingChat(startedAt);
    startPendingPoll(startedAt);

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": readSessionToken() || "",
            },
            body: JSON.stringify({ message: text }),
        });

        let data = {};
        try {
            data = await res.json();
        } catch {
            data = {};
        }

        if (!res.ok || !data.reply) {
            showToast("Sorry, something went wrong.", "error");
        } else {
            addMessageBubble("ava", data.reply);
            scrollChatToBottom(true);
        }
    } catch (err) {
        console.error("Chat error", err);
        showToast("Could not reach Ava. Please try again.", "error");
    } finally {
        hideTypingIndicator();
        isSending = false;
        clearPendingChat();
        input.focus();
    }
}

function addMessageBubble(sender, text) {
    return renderMessageBubble(sender, text, false);
}

function renderMessageBubble(sender, text, prepend = false) {
    const container = document.querySelector(".chat-content");
    if (!container) return null;

    const row = document.createElement("div");
    row.classList.add("msg-row");
    if (sender === "me") row.classList.add("me");

    const bubble = document.createElement("div");
    bubble.classList.add("msg-bubble");
    bubble.innerHTML = formatMessageForWeb(text);

    row.appendChild(bubble);
    if (prepend && container.firstChild) {
        container.insertBefore(row, container.firstChild);
    } else {
        container.appendChild(row);
    }
    return row;
}

function formatMessageForWeb(raw) {
    const escaped = (raw || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    let formatted = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/`([^`]+?)`/g, "<code>$1</code>");
    formatted = formatted.replace(/\n/g, "<br>");
    return formatted;
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

function scrollChatToBottom(force = false) {
    const chat = document.querySelector(".chat-content");
    if (!chat) return;

    const nearBottom = chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 60;
    if (force || nearBottom) {
        chat.scrollTop = chat.scrollHeight;
    }
}

// --- History (lazy load) ----------------------------------------------------
function bindHistoryScroll() {
    const chat = document.querySelector(".chat-content");
    if (!chat) return;
    chat.addEventListener("scroll", () => {
        if (chat.scrollTop <= 5) {
            loadHistory(false);
        }
    });
}

function resetChatHistory() {
    const container = document.querySelector(".chat-content");
    if (container) container.innerHTML = "";
    historyOffset = 0;
    historyHasMore = true;
    isLoadingHistory = false;
}

async function loadHistory(initial = false) {
    if (isLoadingHistory || !historyHasMore) return [];
    isLoadingHistory = true;

    const container = document.querySelector(".chat-content");
    const prevScrollHeight = container?.scrollHeight || 0;
    const prevScrollTop = container?.scrollTop || 0;
    let messages = [];
    try {
        const res = await fetch(`/api/chat/history?offset=${historyOffset}&limit=${HISTORY_PAGE_SIZE}`, {
            headers: { "x-session-token": readSessionToken() || "" },
        });
        if (!res.ok) throw new Error("Failed to load history");
        const data = await res.json();
        messages = data?.messages || [];
        historyOffset = data?.nextOffset ?? historyOffset;
        historyHasMore = !!data?.hasMore;
        const atTopBefore = container ? container.scrollTop <= 10 : false;

        for (const msg of messages) {
            renderMessageBubble(msg.sender === "ava" ? "ava" : "me", msg.message, initial ? false : true);
        }

        if (initial || atTopBefore) {
            scrollChatToBottom(true);
        } else if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
        }
    } catch (err) {
        console.error("Error loading history", err);
        showToast("Could not load previous messages.", "error");
        historyHasMore = false;
    } finally {
        isLoadingHistory = false;
    }
    return messages;
}

// --- Theme ------------------------------------------------------------------
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
    const parts = document.cookie.split(";").map((c) => c.trim());
    for (const part of parts) {
        if (part.startsWith(`${THEME_COOKIE}=`)) {
            return part.split("=", 2)[1];
        }
    }
    return "light";
}

// --- Service worker ---------------------------------------------------------
function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
        console.error("Service worker registration failed", err);
    });
}

// --- Sidebar/info panes -----------------------------------------------------
function showSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) sidebar.focus();
}

function bindSidebarAutoHide() {
    document.addEventListener("click", (e) => {
        const sidebar = document.querySelector(".sidebar");
        if (!sidebar) return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const isToggle = target.closest(".button.icon");
        if (window.innerWidth > 900) return;
        if (sidebar.contains(target) || isToggle) return;
        if (sidebar === document.activeElement) {
            sidebar.blur();
        }
    });
}

function showGeneralInfo() {
    const info = document.querySelector(".info-body");
    if (info) info.focus();
}

function hideGeneralInfo() {
    const info = document.querySelector(".info-body");
    if (info) info.blur();
}

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const sidebar = document.querySelector(".sidebar");
    if (sidebar && sidebar === document.activeElement) {
        sidebar.blur();
    }
});

// --- Toast notifications ----------------------------------------------------
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.classList.add("toast", `toast--${type}`);

    const iconSpan = document.createElement("span");
    iconSpan.classList.add("toast-icon");
    if (type === "success") iconSpan.textContent = "OK";
    else if (type === "error") iconSpan.textContent = "!";
    else if (type === "alert") iconSpan.textContent = "!";
    else iconSpan.textContent = "i";

    const msgSpan = document.createElement("div");
    msgSpan.classList.add("toast-message");
    msgSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.addEventListener("click", () => hideToast(toast));
    container.appendChild(toast);

    setTimeout(() => hideToast(toast), 4000);
}

function hideToast(toast) {
    toast.classList.add("hide");
    toast.addEventListener(
        "animationend",
        () => {
            toast.remove();
        },
        { once: true }
    );
}

// --- Helpers ----------------------------------------------------------------
function savePendingChat(startedAt) {
    try {
        sessionStorage.setItem(PENDING_CHAT_KEY, JSON.stringify({ startedAt }));
    } catch {}
}

function clearPendingChat() {
    try {
        sessionStorage.removeItem(PENDING_CHAT_KEY);
    } catch {}
}

function getPendingChat() {
    try {
        const raw = sessionStorage.getItem(PENDING_CHAT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.startedAt) return null;
        return parsed;
    } catch {
        return null;
    }
}

function startPendingPoll(startedAt) {
    if (!startedAt) return;
    showTypingIndicator();
    if (pendingPoll) clearTimeout(pendingPoll);
    let attempts = 0;
    const poll = async () => {
        attempts += 1;
        try {
            const res = await fetch(`/api/chat/history?offset=0&limit=5`, {
                headers: { "x-session-token": readSessionToken() || "" },
            });
            if (res.ok) {
                const data = await res.json();
                const messages = Array.isArray(data?.messages) ? data.messages : [];
                const found = messages.find((m) => {
                    if (m.sender !== "ava" || !m.created_at) return false;
                    const ts = new Date(m.created_at).getTime();
                    return Number.isFinite(ts) && ts > startedAt;
                });
                if (found) {
                    clearPendingChat();
                    hideTypingIndicator();
                    resetChatHistory();
                    await loadHistory(true);
                    return;
                }
            }
        } catch {}

        if (attempts >= 30) {
            clearPendingChat();
            hideTypingIndicator();
            return;
        }
        pendingPoll = setTimeout(poll, 2000);
    };
    poll();
}

function inferPendingFromHistory() {
    // Look at the latest few messages to infer an unfinished reply
    fetch(`/api/chat/history?offset=0&limit=5`, {
        headers: { "x-session-token": readSessionToken() || "" },
    })
        .then((res) => res.json())
        .then((data) => {
            const messages = Array.isArray(data?.messages) ? data.messages : [];
            if (!messages.length) return;
            const last = messages[messages.length - 1];
            const lastTime = last?.created_at ? new Date(last.created_at).getTime() : null;
            if (last?.sender === "user" && Number.isFinite(lastTime)) {
                savePendingChat(lastTime);
                startPendingPoll(lastTime);
            }
        })
        .catch(() => {});
}

function formatAccountNumber(value) {
    const clean = (value || "").toString().padStart(6, "0").slice(-6);
    return clean.replace(/(\d{3})(\d{3})/, "$1 $2") || "000 000";
}
