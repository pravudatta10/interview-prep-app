const UIRenderer = (() => {

    function renderSidebar(data) {
        const desktop = document.getElementById("conceptList");
        const mobile = document.getElementById("mobileConceptList");

        const html = data.map((d, i) => `
            <li id="concept-${i}" class="list-item" onclick="App.loadConcept(${i})">
                ${d.concept}
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

    function renderSections(sections) {
        const keyword = document.getElementById("searchInput").value;
        const container = document.getElementById("contentContainer");

        container.innerHTML = sections.map(section => `
            <div class="mb-3">

                <div class="section-title"
                     onclick="this.nextElementSibling.classList.toggle('d-none')">
                    ${section.title}
                </div>

                <div>
                    ${section.items.map((item, i) => `
                        <div class="question-item">

                            <div><strong>Q${i + 1}.</strong> ${Utils.highlight(item.question, keyword)}</div>

                            <div class="reveal-btn" onclick="UIRenderer.toggleAnswer(this)">
                                Show Answer
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
                    `).join("")}
                </div>

            </div>
        `).join("");

        hljs.highlightAll();
    }

    function toggleAnswer(btn) {
        const answer = btn.nextElementSibling;
        const code = answer.nextElementSibling;

        answer.classList.toggle("hidden");
        if (code) code.classList.toggle("hidden");

        btn.innerText = answer.classList.contains("hidden")
            ? "Show Answer"
            : "Hide Answer";
    }

    return {
        renderSidebar,
        renderSections,
        setActiveConcept,
        toggleAnswer
    };

})();