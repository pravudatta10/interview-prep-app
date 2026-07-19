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

    /* ---------------- Collapse all answers ---------------- */
    $("#collapseAllBtn")?.addEventListener("click", () => {
        window.UIRenderer?.collapseAllAnswers();
    });

    /* ---------------- Sync category label once data has loaded ---------------- */
    window.addEventListener("load", () => {
        setTimeout(syncCategoryLabel, 300);
    });

    /* ---------------- Bottom navigation (mobile) ---------------- */
    const navHome = $("#navHome");
    const navLearn = $("#navLearn");
    const navCoding = $("#navCoding");
    const navBookmarks = $("#navBookmarks");
    const navSettings = $("#navSettings");
    const navButtons = [navHome, navLearn, navCoding, navBookmarks, navSettings].filter(Boolean);

    function setActiveNav(btn) {
        navButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
    }

    function openMobileSidebar() {
        const el = document.getElementById("mobileSidebar");
        if (!el || !window.bootstrap) return;
        (bootstrap.Offcanvas.getOrCreateInstance(el)).show();
    }

    let bookmarksViewActive = false;
    let lastMeaningfulNav = navHome;

    function exitBookmarksView() {
        bookmarksViewActive = false;
        const input = $("#searchInput");
        if (input) { input.value = ""; input.dispatchEvent(new Event("input")); }
    }

    function hideBuiltInEmptyState() {
        $("#emptyState")?.classList.add("hidden");
    }

    function showNoBookmarksMessage() {
        const container = $("#contentContainer");
        if (!container) return;
        container.insertAdjacentHTML("beforeend", `
            <div class="coming-soon-panel" id="noBookmarksPanel">
                <div class="coming-soon-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                </div>
                <h3>No bookmarks here yet</h3>
                <p>Tap the bookmark icon on any question in this topic to save it. (Bookmarks are shown per topic, not across all topics yet.)</p>
            </div>`);
    }

    navHome?.addEventListener("click", () => {
        setActiveNav(navHome);
        lastMeaningfulNav = navHome;
        exitBookmarksView();
        hideBuiltInEmptyState();
        renderComingSoon(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    navLearn?.addEventListener("click", () => {
        setActiveNav(navLearn);
        lastMeaningfulNav = navLearn;
        openMobileSidebar();
    });

    function renderComingSoon(show) {
        const container = $("#contentContainer");
        if (!container) return;
        if (show) {
            hideBuiltInEmptyState();
            container.innerHTML = `
                <div class="coming-soon-panel">
                    <div class="coming-soon-icon">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="m8 9-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>
                    <h3>Coding section is on its way</h3>
                    <p>DSA problems with brute-force to optimal walkthroughs are coming soon. Tap Home to get back to your concepts.</p>
                </div>`;
        }
    }

    navCoding?.addEventListener("click", () => {
        setActiveNav(navCoding);
        lastMeaningfulNav = navCoding;
        bookmarksViewActive = false;
        renderComingSoon(true);
    });

    navBookmarks?.addEventListener("click", () => {
        setActiveNav(navBookmarks);
        lastMeaningfulNav = navBookmarks;
        renderComingSoon(false);
        hideBuiltInEmptyState();
        bookmarksViewActive = true;

        const bookmarks = getBookmarks();
        let anyVisible = false;
        document.querySelectorAll(".question-item[data-q-key]").forEach((card) => {
            const key = card.getAttribute("data-q-key");
            const match = bookmarks.has(key);
            card.style.display = match ? "" : "none";
            if (match) anyVisible = true;
        });
        document.querySelectorAll(".question-section").forEach((section) => {
            const visibleCards = section.querySelectorAll('.question-item[data-q-key]:not([style*="display: none"])');
            section.style.display = visibleCards.length ? "" : "none";
            const content = section.querySelector(".section-content");
            const title = section.querySelector(".section-title");
            if (visibleCards.length && content?.classList.contains("d-none")) {
                content.classList.remove("d-none");
                title?.classList.add("is-open");
            }
        });

        $("#noBookmarksPanel")?.remove();
        if (!anyVisible) showNoBookmarksMessage();
    });

    navSettings?.addEventListener("click", () => {
        lastMeaningfulNav = navButtons.find((b) => b.classList.contains("is-active")) || navHome;
        openSettingsSheet();
    });

    // Re-apply bookmarks filter after a fresh render if the view is active
    if (contentContainer) {
        new MutationObserver(() => {
            if (bookmarksViewActive) navBookmarks?.click();
        }).observe(contentContainer, { childList: true });
    }

    /* ---------------- Settings sheet ---------------- */
    const settingsBackdrop = $("#settingsSheetBackdrop");
    const sheetDarkToggle = $("#sheetDarkToggle");

    function syncSheetDarkToggle() {
        sheetDarkToggle?.classList.toggle("is-on", document.body.classList.contains("dark-mode"));
    }

    function openSettingsSheet() {
        syncSheetDarkToggle();
        settingsBackdrop?.classList.add("is-open");
    }
    function closeSettingsSheet() {
        settingsBackdrop?.classList.remove("is-open");
        setActiveNav(lastMeaningfulNav);
    }

    settingsBackdrop?.addEventListener("click", (e) => {
        if (e.target === settingsBackdrop) closeSettingsSheet();
    });

    $("#sheetCloseBtn")?.addEventListener("click", closeSettingsSheet);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && settingsBackdrop?.classList.contains("is-open")) {
            closeSettingsSheet();
        }
    });

    sheetDarkToggle?.addEventListener("click", () => {
        applyDarkMode(!document.body.classList.contains("dark-mode"));
        syncSheetDarkToggle();
    });

    $("#sheetRecentBtn")?.addEventListener("click", () => {
        $("#recentlyViewedBtn")?.click();
    });

    /* ---------------- Sticky current-section header (mobile) ---------------- */
    const stickyHeader = $("#stickySectionHeader");
    if (stickyHeader && "IntersectionObserver" in window) {
        let currentTitle = "";
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const title = entry.target.querySelector(".section-title-text")?.textContent;
                    if (title) currentTitle = title;
                }
            });
            if (currentTitle) {
                stickyHeader.textContent = currentTitle;
                stickyHeader.classList.add("is-visible");
            } else {
                stickyHeader.classList.remove("is-visible");
            }
        }, { rootMargin: `-${120}px 0px -70% 0px`, threshold: 0 });

        function observeSections() {
            document.querySelectorAll(".question-section").forEach((s) => observer.observe(s));
        }

        if (contentContainer) {
            new MutationObserver(() => {
                stickyHeader.classList.remove("is-visible");
                observeSections();
            }).observe(contentContainer, { childList: true });
        }
        observeSections();
    }
})();
