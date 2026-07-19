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
        const words = ((item.question || "") + " " + Utils.flattenToText(item.answer) + " " + Utils.flattenToText(item.code))
            .trim().split(/\s+/).filter(Boolean).length;
        const mins = Math.max(1, Math.round(words / 180));
        return `${mins} min read`;
    }

    // Purely decorative difficulty derived from content length so it stays
    // stable for a given question without needing new data fields.
    function estimateDifficulty(item) {
        const len = (item.question || "").length + Utils.flattenToText(item.answer).length;
        if (len < 220) return { label: "Easy", cls: "diff-easy" };
        if (len < 600) return { label: "Medium", cls: "diff-medium" };
        return { label: "Hard", cls: "diff-hard" };
    }

    function escapeAttr(str) {
        return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    }

    // =====================================================================
    // Dynamic, data-driven answer rendering
    //
    // `item.answer` may be:
    //   - a legacy plain string                      -> treated as interviewAnswer
    //   - a rich object of named sections             -> rendered per KNOWN_SECTIONS
    // `item.code` (legacy top-level field) folds into the codeExample section.
    //
    // Any section that is null/undefined/empty string/whitespace/empty
    // array/empty object is skipped entirely — no headings, no empty cards.
    // Any key NOT in KNOWN_SECTIONS still renders automatically via a
    // type-inferred generic renderer, so new sections are plug-and-play.
    // =====================================================================

    const KNOWN_SECTIONS = [
        { key: "interviewAnswer", label: "Interview Answer", type: "prose" },
        { key: "deepDive", label: "Deep Dive", type: "prose" },
        { key: "scenario", label: "Scenario", type: "prose" },
        { key: "realWorldExample", label: "Real World Example", type: "prose" },
        { key: "codeExample", label: "Code Example", type: "code" },
        { key: "diagram", label: "Diagram", type: "diagram" },
        { key: "comparison", label: "Comparison", type: "comparison" },
        { key: "followUpQuestions", label: "Follow-up Questions", type: "list" },
        { key: "commonMistakes", label: "Common Mistakes", type: "list" },
        { key: "optimizationTips", label: "Optimization Tips", type: "list" },
        { key: "keyTakeaway", label: "Key Takeaway", type: "prose" },
        { key: "references", label: "References", type: "list" }
    ];

    function labelFromKey(key) {
        return key
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .replace(/[_-]+/g, " ")
            .replace(/^./, c => c.toUpperCase())
            .trim();
    }

    // Normalizes item.answer + legacy item.code into one ordered map of
    // { key -> { label, type, value } }, known sections first (in the
    // fixed order above), then any other keys in the order they appear.
    function collectAnswerSections(item) {
        const raw = item.answer;
        let data = {};

        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            data = raw;
        } else if (typeof raw === "string" && raw.trim()) {
            data = { interviewAnswer: raw };
        }

        const entries = [];
        const seen = new Set();

        KNOWN_SECTIONS.forEach(def => {
            if (Utils.isMeaningful(data[def.key])) {
                entries.push({ key: def.key, label: def.label, type: def.type, value: data[def.key] });
                seen.add(def.key);
            }
        });

        Object.keys(data).forEach(key => {
            if (seen.has(key)) return;
            if (!Utils.isMeaningful(data[key])) return;
            entries.push({ key, label: labelFromKey(key), type: null, value: data[key] });
        });

        // Legacy top-level `code` field, only if no codeExample already covered it
        if (Utils.isMeaningful(item.code) && !seen.has("codeExample")) {
            entries.push({ key: "codeExample", label: "Code Example", type: "code", value: item.code });
        }

        return entries;
    }

    // ---- lightweight, dependency-free "markdown-lite" for prose fields ----
    function renderProse(text, keyword) {
        const highlighted = Utils.highlight(Utils.escapeHtml(String(text)), keyword);
        const withInlineCode = highlighted.replace(/`([^`]+)`/g, "<code>$1</code>");
        const withBold = withInlineCode.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        const paragraphs = withBold
            .split(/\n{2,}/)
            .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
            .join("");
        return `<div class="prose">${paragraphs}</div>`;
    }

    function renderCode(value) {
        let code = value;
        let lang = "";
        if (value && typeof value === "object" && !Array.isArray(value)) {
            code = value.code || value.snippet || "";
            lang = value.language || value.lang || "";
        }
        if (!Utils.isMeaningful(code)) return "";
        return `
            <pre data-lang="${escapeAttr(lang || "code")}">
<button class="btn btn-light btn-sm" onclick="Utils.copyCode(this)">Copy</button>
<code${lang ? ` class="language-${escapeAttr(lang)}"` : ""}>${Utils.escapeHtml(String(code))}</code>
            </pre>`;
    }

    function renderDiagram(value, keyword) {
        if (typeof value === "string") {
            return `<div class="diagram-panel">${renderProse(value, keyword)}</div>`;
        }
        if (value && typeof value === "object") {
            const src = value.image || value.url || value.src;
            if (src) {
                const alt = escapeAttr(value.alt || value.caption || "Diagram");
                return `<figure class="diagram-figure">
                    <img class="diagram-image" src="${escapeAttr(src)}" alt="${alt}" loading="lazy">
                    ${value.caption ? `<figcaption>${Utils.escapeHtml(value.caption)}</figcaption>` : ""}
                </figure>`;
            }
            if (Utils.isMeaningful(value.description)) {
                return `<div class="diagram-panel">${renderProse(value.description, keyword)}</div>`;
            }
        }
        return "";
    }

    function renderListEntry(entry, keyword) {
        if (typeof entry === "string") {
            return `<li>${Utils.highlight(Utils.escapeHtml(entry), keyword)}</li>`;
        }
        if (entry && typeof entry === "object") {
            // Common shape: follow-up { question, answer }
            if (Utils.isMeaningful(entry.question)) {
                return `<li class="mini-qa">
                    <span class="mini-q">${Utils.highlight(Utils.escapeHtml(entry.question), keyword)}</span>
                    ${Utils.isMeaningful(entry.answer) ? `<span class="mini-a">${Utils.highlight(Utils.escapeHtml(entry.answer), keyword)}</span>` : ""}
                </li>`;
            }
            // Common shape: reference { title, url }
            if (Utils.isMeaningful(entry.url) || Utils.isMeaningful(entry.link)) {
                const url = escapeAttr(entry.url || entry.link);
                const title = Utils.escapeHtml(entry.title || entry.name || entry.url || entry.link);
                return `<li><a class="ref-link" href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></li>`;
            }
            // Generic object entry: key: value pairs
            const parts = Object.entries(entry)
                .filter(([, v]) => Utils.isMeaningful(v))
                .map(([k, v]) => `<span><strong>${labelFromKey(k)}:</strong> ${Utils.escapeHtml(Utils.flattenToText(v))}</span>`)
                .join("");
            return parts ? `<li class="mini-kv">${parts}</li>` : "";
        }
        return "";
    }

    function renderList(value, keyword) {
        const arr = Array.isArray(value) ? value : Object.values(value || {});
        const items = arr.map(entry => renderListEntry(entry, keyword)).filter(Boolean).join("");
        return items ? `<ul class="section-list">${items}</ul>` : "";
    }

    function renderComparisonTable(headers, rows) {
        const head = `<tr>${headers.map(h => `<th>${Utils.escapeHtml(h)}</th>`).join("")}</tr>`;
        const body = rows.map(row => `<tr>${row.map((cell, i) =>
            `<td data-label="${escapeAttr(headers[i] || "")}">${Utils.escapeHtml(Utils.flattenToText(cell))}</td>`
        ).join("")}</tr>`).join("");
        return `<div class="comparison-table-wrap"><table class="comparison-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    }

    function renderComparison(value) {
        if (Array.isArray(value) && value.length && typeof value[0] === "object") {
            const headers = Object.keys(value[0]);
            const rows = value.map(row => headers.map(h => row[h]));
            return renderComparisonTable(headers.map(labelFromKey), rows);
        }
        if (value && typeof value === "object") {
            const keys = Object.keys(value);
            const arrays = keys.every(k => Array.isArray(value[k]));
            if (arrays) {
                const maxLen = Math.max(...keys.map(k => value[k].length));
                const rows = [];
                for (let i = 0; i < maxLen; i++) {
                    rows.push(keys.map(k => value[k][i] ?? ""));
                }
                return renderComparisonTable(keys, rows);
            }
            // Object of scalars -> simple two-column key/value table
            const rows = keys.filter(k => Utils.isMeaningful(value[k])).map(k => [labelFromKey(k), value[k]]);
            return rows.length ? renderComparisonTable(["", ""], rows) : "";
        }
        return "";
    }

    // Renders one section value based on its declared or inferred type.
    function renderSectionValue(entry, keyword) {
        const { type, value } = entry;

        if (type === "code") return renderCode(value);
        if (type === "diagram") return renderDiagram(value, keyword);
        if (type === "comparison") return renderComparison(value);
        if (type === "list") return renderList(value, keyword);
        if (type === "prose") {
            return typeof value === "string" ? renderProse(value, keyword) : renderList(value, keyword);
        }

        // Unknown key: infer a sensible renderer from the value's shape so
        // brand-new fields work without any code changes.
        if (typeof value === "string") return renderProse(value, keyword);
        if (Array.isArray(value)) return renderList(value, keyword);
        if (typeof value === "object") return renderComparison(value) || renderProse(Utils.flattenToText(value), keyword);
        return renderProse(String(value), keyword);
    }

    function renderAnswerBody(item, keyword) {
        const sections = collectAnswerSections(item);
        return sections.map(entry => {
            const body = renderSectionValue(entry, keyword);
            if (!body) return "";
            return `
                <div class="answer-block">
                    <h4 class="answer-block-title">${Utils.escapeHtml(entry.label)}</h4>
                    <div class="answer-block-body">${body}</div>
                </div>`;
        }).join("");
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
                     onclick="UIRenderer.toggleSection(this)"
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
                        const answerHtml = renderAnswerBody(item, keyword);
                        const hasAnswer = answerHtml.trim().length > 0;
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

                            ${hasAnswer ? `
                                <div class="reveal-btn" onclick="UIRenderer.toggleAnswer(this)" role="button" tabindex="0"
                                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" class="reveal-icon"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    <span class="reveal-btn-text">Show Answer</span>
                                </div>

                                <div class="answer hidden">
                                    ${answerHtml}
                                </div>
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

    function toggleSection(titleEl) {
        const content = titleEl.nextElementSibling;
        if (!content) return;
        const isOpening = content.classList.contains("d-none");

        if (isOpening) {
            // Exclusive accordion: collapse every other open section first.
            document.querySelectorAll(".section-title.is-open").forEach((other) => {
                if (other === titleEl) return;
                other.classList.remove("is-open");
                other.nextElementSibling?.classList.add("d-none");
            });
        }

        content.classList.toggle("d-none");
        titleEl.classList.toggle("is-open");
    }

    function closeAnswer(btn) {
        const answer = btn.nextElementSibling;
        const code = answer?.nextElementSibling;
        answer?.classList.add("hidden");
        if (code && code.classList?.contains("hidden") === false && code.tagName === "PRE") {
            code.classList.add("hidden");
        }
        const label = btn.querySelector(".reveal-btn-text");
        if (label) label.textContent = "Show Answer";
        else btn.innerText = "Show Answer";
        btn.classList.remove("is-open");
    }

    function toggleAnswer(btn) {
        const answer = btn.nextElementSibling;
        const code = answer.nextElementSibling;
        const isOpening = answer.classList.contains("hidden");

        if (isOpening) {
            // Exclusive accordion: collapse every other open answer first.
            document.querySelectorAll(".reveal-btn.is-open").forEach((other) => {
                if (other !== btn) closeAnswer(other);
            });
        }

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
        toggleSection,
        toggleAnswer
    };

})();
