/*
 * Enhancements — purely additive UI behaviour.
 * Does not modify App, DataService, UIRenderer, or Utils.
 * Safe to remove without affecting core functionality.
 */
(() => {
    const $ = (sel) => document.querySelector(sel);

    /* ---------------- Dark mode ---------------- */
    const darkToggle = $("#darkModeToggle");
    const iconSun = $("#iconSun");
    const iconMoon = $("#iconMoon");

    function applyDarkMode(on) {
        document.body.classList.toggle("dark-mode", on);
        iconSun?.classList.toggle("hidden", on);
        iconMoon?.classList.toggle("hidden", !on);
        localStorage.setItem("prefDarkMode", on ? "1" : "0");
    }

    const savedDark = localStorage.getItem("prefDarkMode");
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyDarkMode(savedDark ? savedDark === "1" : systemPrefersDark);

    darkToggle?.addEventListener("click", () => {
        applyDarkMode(!document.body.classList.contains("dark-mode"));
    });

    /* ---------------- Keyboard shortcuts ---------------- */
    document.addEventListener("keydown", (e) => {
        const tag = (e.target.tagName || "").toLowerCase();
        const typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;

        // "/" focuses search
        if (e.key === "/" && !typing) {
            e.preventDefault();
            $("#searchInput")?.focus();
        }

        // Ctrl/Cmd+K focuses + selects search (command-style)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            const input = $("#searchInput");
            input?.focus();
            input?.select();
        }

        // Ctrl/Cmd+J toggles dark mode
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
            e.preventDefault();
            applyDarkMode(!document.body.classList.contains("dark-mode"));
        }

        // Escape clears focus from search
        if (e.key === "Escape" && typing) {
            e.target.blur();
        }
    });

    /* ---------------- Reading progress + scroll-to-top ---------------- */
    const progressBar = $("#readingProgressBar");
    const scrollTopBtn = $("#scrollTopBtn");

    function onScroll() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
        if (progressBar) progressBar.style.width = pct + "%";

        if (scrollTopBtn) scrollTopBtn.classList.toggle("hidden", scrollTop < 400);
    }
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    scrollTopBtn?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    /* ---------------- Category label + scroll-to-top-of-content on concept change ---------------- */
    const conceptList = $("#conceptList");
    const categoryLabel = $("#currentCategoryLabel");

    function syncCategoryLabel() {
        const active = conceptList?.querySelector(".active-concept .list-item-label");
        if (active && categoryLabel) categoryLabel.textContent = active.textContent.trim();
    }

    if (conceptList) {
        new MutationObserver(syncCategoryLabel).observe(conceptList, {
            attributes: true,
            attributeFilter: ["class"],
            subtree: true
        });
    }

    /* ---------------- Empty state "clear search" ---------------- */
    $("#clearSearchBtn")?.addEventListener("click", () => {
        const input = $("#searchInput");
        if (!input) return;
        input.value = "";
        input.dispatchEvent(new Event("input"));
        input.focus();
    });

    /* ---------------- Bookmarks (persisted) ---------------- */
    const BOOKMARK_KEY = "bookmarkedQuestions";

    function getBookmarks() {
        try { return new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "[]")); }
        catch { return new Set(); }
    }
    function saveBookmarks(set) {
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...set]));
    }

    function applyBookmarkStates() {
        const bookmarks = getBookmarks();
        document.querySelectorAll(".question-item[data-q-key]").forEach((card) => {
            const key = card.getAttribute("data-q-key");
            card.querySelector(".bookmark-btn")?.classList.toggle("is-bookmarked", bookmarks.has(key));
        });
    }

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".bookmark-btn");
        if (!btn) return;
        const card = btn.closest(".question-item[data-q-key]");
        if (!card) return;
        const key = card.getAttribute("data-q-key");
        const bookmarks = getBookmarks();
        // classList was already toggled by the inline onclick handler
        if (btn.classList.contains("is-bookmarked")) bookmarks.add(key);
        else bookmarks.delete(key);
        saveBookmarks(bookmarks);
    });

    /* ---------------- Viewed-question tracking (header progress) ---------------- */
    const VIEWED_KEY = "viewedQuestionsSession";
    let viewedSet = new Set();
    try { viewedSet = new Set(JSON.parse(sessionStorage.getItem(VIEWED_KEY) || "[]")); } catch {}

    const headerProgressText = $("#headerProgressText");
    function syncHeaderProgress() {
        if (headerProgressText) headerProgressText.textContent = `${viewedSet.size} viewed`;
    }
    syncHeaderProgress();

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".reveal-btn");
        if (!btn) return;
        const card = btn.closest(".question-item[data-q-key]");
        if (!card) return;
        // Fires after the inline handler toggles state; only count opens.
        requestAnimationFrame(() => {
            if (btn.classList.contains("is-open")) {
                viewedSet.add(card.getAttribute("data-q-key"));
                sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...viewedSet]));
                syncHeaderProgress();
            }
        });
    });

    /* ---------------- Recently viewed concepts ---------------- */
    const RECENT_KEY = "recentlyViewedConcepts";
    function pushRecent(name) {
        if (!name) return;
        let list = [];
        try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch {}
        list = [name, ...list.filter((n) => n !== name)].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    }

    if (conceptList) {
        new MutationObserver(() => {
            const active = conceptList.querySelector(".active-concept .list-item-label");
            if (active) pushRecent(active.textContent.trim());
        }).observe(conceptList, { attributes: true, attributeFilter: ["class"], subtree: true });
    }

    $("#recentlyViewedBtn")?.addEventListener("click", () => {
        let list = [];
        try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch {}
        if (list.length === 0) {
            alert("No recently viewed concepts yet — browse a few topics first.");
            return;
        }
        alert("Recently viewed:\n" + list.map((n, i) => `${i + 1}. ${n}`).join("\n"));
    });

    /* ---------------- Re-apply bookmark state + scroll after each render ---------------- */
    const contentContainer = $("#contentContainer");
    if (contentContainer) {
        new MutationObserver(() => {
            applyBookmarkStates();
        }).observe(contentContainer, { childList: true });
    }

    /* ---------------- Sync category label once data has loaded ---------------- */
    window.addEventListener("load", () => {
        setTimeout(syncCategoryLabel, 300);
    });
})();
