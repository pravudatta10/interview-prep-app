const Utils = (() => {

    function copyCode(btn) {
        const code = btn.nextElementSibling.innerText;
        navigator.clipboard.writeText(code);
    }

    function highlight(text, keyword) {
        if (!keyword) return text;
        return text.replace(new RegExp(`(${keyword})`, "gi"), `<mark>$1</mark>`);
    }

    // ---- Generic, type-agnostic helpers for data-driven rendering ----

    // True only if a value would render as something a person can see:
    // not null/undefined, not an empty/whitespace string, not an empty
    // array, not an object whose values are all themselves empty.
    function isMeaningful(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === "string") return value.trim().length > 0;
        if (Array.isArray(value)) return value.some(isMeaningful);
        if (typeof value === "object") return Object.values(value).some(isMeaningful);
        if (typeof value === "number" || typeof value === "boolean") return true;
        return false;
    }

    // Flattens any nested string/array/object shape down to one plain-text
    // blob, used for read-time estimation and search — works whether
    // `answer` is a legacy string or a rich multi-section object.
    function flattenToText(value) {
        if (value === null || value === undefined) return "";
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        if (Array.isArray(value)) return value.map(flattenToText).join(" ");
        if (typeof value === "object") return Object.values(value).map(flattenToText).join(" ");
        return "";
    }

    function searchableText(item) {
        return [flattenToText(item.question), flattenToText(item.answer), flattenToText(item.code)]
            .join(" ");
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    return { copyCode, highlight, isMeaningful, flattenToText, searchableText, escapeHtml };

})();