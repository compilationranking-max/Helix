(() => {
    function init() {
        const view = document.getElementById("dm-view");
        if (!view || !window.HelixDMActions) return;

        window.HelixDMActions.init();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
