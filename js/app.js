const App = (() => {

    let allData = [];
    let currentConceptIndex = 0;

    async function init() {
        allData = await DataService.loadAll();

        UIRenderer.renderSidebar(allData);

        const saved = localStorage.getItem("lastConcept");
        loadConcept(saved ? parseInt(saved) : 0);

        bindSearch();
    }

    function loadConcept(index) {
        currentConceptIndex = index;

        const concept = allData[index];

        UIRenderer.renderSections(concept.sections);
        UIRenderer.setActiveConcept(index);

        localStorage.setItem("lastConcept", index);

        updatePlaceholder();

        // reset scroll to top when changing concept
        const contentContainer = document.getElementById('contentContainer');
        if (contentContainer) contentContainer.scrollTop = 0;

        const offcanvasEl = document.getElementById('mobileSidebar');
        const bs = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (bs) bs.hide();
    }

    function updatePlaceholder() {
        const name = allData[currentConceptIndex].concept;
        document.getElementById("searchInput").placeholder =
            `Search in ${name}...`;
    }

    function bindSearch() {
        document.getElementById("searchInput")
            .addEventListener("input", function () {

                const keyword = this.value.toLowerCase();
                const sections = allData[currentConceptIndex].sections;

                const filtered = sections.map(sec => ({
                    title: sec.title,
                    items: sec.items.filter(item =>
                        item.question.toLowerCase().includes(keyword) ||
                        item.answer.toLowerCase().includes(keyword)
                    )
                })).filter(sec => sec.items.length > 0);

                UIRenderer.renderSections(filtered);
            });
    }

    return {
        init,
        loadConcept
    };

})();

App.init();