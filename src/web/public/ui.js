// Shared UI helpers for Ava web pages
(() => {
    const REMEMBER_KEY = "ava_session_token";
    const THEME_COOKIE = "ava_theme";

    function applyTheme(theme) {
        const clean = theme === "dark" ? "dark" : "light";
        document.body.classList.toggle("theme-dark", clean === "dark");
        writeThemeCookie(clean);
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

    function registerServiceWorker() {
        if (!("serviceWorker" in navigator)) return;
        navigator.serviceWorker.register("/service-worker.js").catch((err) => {
            console.error("Service worker registration failed", err);
        });
    }

    function showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.classList.add("toast", `toast--${type}`);

        const iconSpan = document.createElement("span");
        iconSpan.classList.add("toast-icon");
        if (type === "success") iconSpan.textContent = "✓";
        else if (type === "error") iconSpan.textContent = "!";
        else if (type === "alert") iconSpan.textContent = "!";
        else iconSpan.textContent = "ℹ";

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
        if (!toast) return;
        toast.classList.add("hide");
        toast.addEventListener(
            "animationend",
            () => {
                toast.remove();
            },
            { once: true }
        );
    }

    function writeSessionToken(token) {
        try {
            localStorage.setItem(REMEMBER_KEY, token);
        } catch (err) {
            console.warn("Could not persist session token", err);
        }
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

    function formatAccountNumber(value) {
        const clean = (value || "").toString().padStart(6, "0").slice(-6);
        return clean.replace(/(\d{3})(\d{3})/, "$1 $2") || "000 000";
    }

    window.AvaUI = {
        applyTheme,
        readThemeCookie,
        registerServiceWorker,
        showToast,
        hideToast,
        writeSessionToken,
        readSessionToken,
        clearSessionToken,
        formatAccountNumber,
    };
})();
