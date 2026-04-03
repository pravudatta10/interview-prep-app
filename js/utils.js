const Utils = (() => {

    function copyCode(btn) {
        const code = btn.nextElementSibling.innerText;
        navigator.clipboard.writeText(code);
    }

    function highlight(text, keyword) {
        if (!keyword) return text;
        return text.replace(new RegExp(`(${keyword})`, "gi"), `<mark>$1</mark>`);
    }

    return { copyCode, highlight };

})();