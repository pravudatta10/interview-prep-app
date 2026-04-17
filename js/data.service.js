const DataService = (() => {

    const files = ["java.json", "spring-microservice.json"];
    let cache = [];

    async function loadAll() {
        cache = await Promise.all(
            files.map(f => fetch(`data/${f}`).then(r => r.json()))
        );
        return cache;
    }

    return { loadAll };

})();