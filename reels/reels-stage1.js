/* =========================================================
   HELIX REELS — STAGE 1 STATIC CONTROLLER
   Reels-only. No navigation, backend, or interaction behavior.
   ========================================================= */

(() => {
    "use strict";

    const reelMarkup = () => `
        <article class="helix-reel-card reels-static-card" aria-label="Sample Reel preview">
            <div class="helix-reel-media">
                <div class="reels-static-visual" aria-hidden="true">
                    <div class="reels-visual-grid"></div>
                    <div class="reels-visual-orbit reels-orbit-a"></div>
                    <div class="reels-visual-orbit reels-orbit-b"></div>
                    <div class="reels-visual-core">
                        <span>HELIX</span>
                        <strong>REEL / 01</strong>
                    </div>
                    <div class="reels-visual-scanline"></div>
                </div>

                <div class="reels-static-topline">
                    <span class="reels-live-marker"></span>
                    <span>DISCOVER SIGNAL</span>
                </div>
            </div>

            <div class="helix-reel-bottom reels-static-overlay">
                <div class="reels-creator">
                    <span class="helix-reel-avatar reels-creator-avatar">NS</span>
                    <div class="helix-reel-author-info">
                        <strong>nova.signal</strong>
                        <span>@nova.signal</span>
                    </div>
                </div>

                <p class="helix-reel-caption">
                    Build the future in public. Small signals become big systems.
                    <span class="reels-hashtags">#HELIX #BUILD #FUTURE</span>
                </p>
            </div>

            <div class="helix-reel-actions reels-static-actions" aria-label="Reel actions">
                <button class="helix-reel-action" type="button" aria-label="Like Reel">
                    <span class="helix-action-icon" aria-hidden="true">♡</span>
                    <span class="helix-action-count">1.2K</span>
                </button>
                <button class="helix-reel-action" type="button" aria-label="Comment on Reel">
                    <span class="helix-action-icon" aria-hidden="true">◌</span>
                    <span class="helix-action-count">184</span>
                </button>
                <button class="helix-reel-action" type="button" aria-label="Share Reel">
                    <span class="helix-action-icon" aria-hidden="true">↗</span>
                    <span class="helix-action-count">76</span>
                </button>
                <button class="helix-reel-action" type="button" aria-label="Save Reel">
                    <span class="helix-action-icon" aria-hidden="true">⌑</span>
                    <span class="helix-action-count">Save</span>
                </button>
            </div>
        </article>
    `;

    const renderStage1 = () => {
        const feed = document.getElementById("reels-feed");
        if (!feed) return;

        feed.innerHTML = reelMarkup();
    };

    // app.js calls this name whenever the Reels section opens.
    // Replacing it here keeps Stage 1 visual-only without changing app.js.
    window.renderHelixReels = renderStage1;

    // Keep the static preview mounted after the document is ready.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderStage1, { once: true });
    } else {
        renderStage1();
    }
})();
