(() => {
    function init() {
        const view = document.getElementById("dm-view");
        if (!view || !window.HelixDMActions) return;

        if (view.classList.contains("dm-blank-stage-view")) {
            return;
        }

        window.HelixDMActions.init();

        const nav = document.getElementById("nav-console");
        nav?.addEventListener("click", () => {
            window.setTimeout(() => {
                window.HelixDMActions.refreshConversations();
            }, 0);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
