const UIRenderer = (() => {

    // Small deterministic helpers for purely decorative UI (no effect on data/logic)
    const SIDEBAR_ICONS = [
        '<path d="M4 17V7a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/>',
        '<path d="M12 2 3 7l9 5 9-5-9-5Z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
        '<path d="M4 4h16v4H4z"/><path d="M4 12h16v8H4z"/>',
        '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
    ];

    function iconFor(index) {
        const d = SIDEBAR_ICONS[index % SIDEBAR_ICONS.length];
        return `<svg class="concept-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    }

    function countQuestions(concept) {
        return (concept.sections || []).reduce((sum, s) => sum + (s.items ? s.items.length : 0), 0);
    }

    function renderSidebar(data) {
        const desktop = document.getElementById("conceptList");
        const mobile = document.getElementById("mobileConceptList");

        const html = data.map((d, i) => `
            <li id="concept-${i}" class="list-item" onclick="App.loadConcept(${i})" role="button" tabindex="0"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();App.loadConcept(${i})}">
                <span class="list-item-main">
                    ${iconFor(i)}
                    <span class="list-item-label">${d.concept}</span>
                </span>
                <span class="list-item-count">${countQuestions(d)}</span>
            </li>
        `).join("");

        desktop.innerHTML = html;
        mobile.innerHTML = html;
    }

    function setActiveConcept(index) {
        document.querySelectorAll(".list-item")
            .forEach(el => el.classList.remove("active-concept"));

        document.querySelector(`#concept-${index}`)?.classList.add("active-concept");
    }

    function estimateReadTime(item) {
        const words = ((item.question || "") + " " + (item.answer || "") + " " + (item.code || ""))
            .trim().split(/\s+/).filter(Boolean).length;
        const mins = Math.max(1, Math.round(words / 180));
        return `${mins} min read`;
    }

    // Purely decorative difficulty derived from content length so it stays
    // stable for a given question without needing new data fields.
    function estimateDifficulty(item) {
        const len = (item.question || "").length + (item.answer || "").length;
        if (len < 220) return { label: "Easy", cls: "diff-easy" };
        if (len < 600) return { label: "Medium", cls: "diff-medium" };
        return { label: "Hard", cls: "diff-hard" };
    }

    function escapeAttr(str) {
        return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    }

    function renderSections(sections) {
        const keyword = document.getElementById("searchInput").value;
        const container = document.getElementById("contentContainer");

        if (!sections || sections.length === 0) {
            container.innerHTML = "";
            document.getElementById("emptyState")?.classList.remove("hidden");
            return;
        }
        document.getElementById("emptyState")?.classList.add("hidden");

        container.innerHTML = sections.map((section, sIdx) => `
            <div class="mb-3 question-section" style="--section-delay:${sIdx * 40}ms">

                <div class="section-title"
                     onclick="this.nextElementSibling.classList.toggle('d-none'); this.classList.toggle('is-open')"
                     role="button" tabindex="0"
                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
                    <span class="section-title-text">${section.title}</span>
                    <span class="section-title-meta">
                        <span class="section-count">${section.items.length}</span>
                        <svg class="section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                </div>

                <div class="section-content d-none">
                    ${section.items.map((item, i) => {
                        const diff = estimateDifficulty(item);
                        return `
                        <div class="question-item" style="--card-delay:${i * 30}ms" data-q-key="${escapeAttr(section.title + '::' + item.question)}">
                            <div class="question-item-head">
                                <span class="q-badge">${i + 1}</span>
                                <div class="q-title">${Utils.highlight(item.question, keyword)}</div>
                                <button class="bookmark-btn" type="button" aria-label="Bookmark this question" onclick="this.classList.toggle('is-bookmarked')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
                                </button>
                            </div>

                            <div class="question-meta-row">
                                <span class="diff-badge ${diff.cls}">${diff.label}</span>
                                <span class="meta-dot">·</span>
                                <span class="read-time">${estimateReadTime(item)}</span>
                            </div>

                            <div class="reveal-btn" onclick="UIRenderer.toggleAnswer(this)" role="button" tabindex="0"
                                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" class="reveal-icon"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span class="reveal-btn-text">Show Answer</span>
                            </div>

                            <div class="answer hidden">
                                ${Utils.highlight(item.answer, keyword)}
                            </div>

                            ${item.code ? `
                                <pre class="hidden">
<button class="btn btn-light btn-sm" onclick="Utils.copyCode(this)">Copy</button>
<code>${item.code}</code>
                                </pre>
                            ` : ''}

                        </div>
                    `;}).join("")}
                </div>

            </div>
        `).join("");

        if (window.hljs) {
            hljs.highlightAll();
        }
    }

    function toggleAnswer(btn) {
        const answer = btn.nextElementSibling;
        const code = answer.nextElementSibling;

        answer.classList.toggle("hidden");
        if (code) code.classList.toggle("hidden");

        const isHidden = answer.classList.contains("hidden");
        const label = btn.querySelector(".reveal-btn-text");
        if (label) {
            label.textContent = isHidden ? "Show Answer" : "Hide Answer";
        } else {
            btn.innerText = isHidden ? "Show Answer" : "Hide Answer";
        }
        btn.classList.toggle("is-open", !isHidden);
    }

    return {
        renderSidebar,
        renderSections,
        setActiveConcept,
        toggleAnswer
    };

})();
