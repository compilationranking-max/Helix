/* =========================================================
   HELIX REELS — STAGE 2 REAL VIDEO CONTROLLER
   Reels-only. Real video playback controls only; no likes/comments/backend.
   ========================================================= */

(() => {
    "use strict";

    const reelMarkup = () => `
        <article class="helix-reel-card reels-static-card" aria-label="Sample Reel preview">
            <div class="helix-reel-media">
                <video
                    class="reels-stage2-video"
                    preload="metadata"
                    playsinline
                    poster="reels/reel-poster.svg"
                    aria-label="Sample Helix Reel video"
                >
                    <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4">
                </video>

                <div class="reels-stage2-video-fallback" aria-hidden="true">
                    <div class="reels-static-visual">
                        <div class="reels-visual-grid"></div>
                        <div class="reels-visual-orbit reels-orbit-a"></div>
                        <div class="reels-visual-orbit reels-orbit-b"></div>
                        <div class="reels-visual-core">
                            <span>HELIX</span>
                            <strong>REEL / 01</strong>
                        </div>
                        <div class="reels-visual-scanline"></div>
                    </div>
                </div>

                <button class="reels-stage2-play" type="button" aria-label="Play video" aria-pressed="false">
                    <span aria-hidden="true">▶</span>
                </button>

                <button class="reels-stage2-mute" type="button" aria-label="Unmute video" aria-pressed="true">
                    <span aria-hidden="true">🔇</span>
                </button>

                <div class="reels-stage2-progress" aria-label="Video progress">
                    <div class="reels-stage2-progress-track">
                        <span class="reels-stage2-progress-fill"></span>
                    </div>
                    <span class="reels-stage2-time">0:00 / 0:00</span>
                </div>

                <div class="reels-stage2-loading" hidden>LOADING MEDIA…</div>
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

    const bindStage2Video = () => {
        const card = document.querySelector("#reels-view .reels-static-card");
        if (!card || card.dataset.stage2Bound === "true") return;

        const video = card.querySelector(".reels-stage2-video");
        const playButton = card.querySelector(".reels-stage2-play");
        const muteButton = card.querySelector(".reels-stage2-mute");
        const progressFill = card.querySelector(".reels-stage2-progress-fill");
        const timeLabel = card.querySelector(".reels-stage2-time");
        const fallback = card.querySelector(".reels-stage2-video-fallback");
        const loading = card.querySelector(".reels-stage2-loading");

        if (!video || !playButton || !muteButton || !progressFill || !timeLabel) return;

        card.dataset.stage2Bound = "true";
        video.muted = true;

        const formatTime = (seconds) => {
            if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
            const whole = Math.floor(seconds);
            const minutes = Math.floor(whole / 60);
            const remainder = String(whole % 60).padStart(2, "0");
            return `${minutes}:${remainder}`;
        };

        const syncPlayButton = () => {
            const playing = !video.paused && !video.ended;
            playButton.setAttribute("aria-pressed", String(playing));
            playButton.setAttribute("aria-label", playing ? "Pause video" : "Play video");
            playButton.querySelector("span").textContent = playing ? "❚❚" : "▶";
            playButton.classList.toggle("is-playing", playing);
        };

        const syncMuteButton = () => {
            const muted = video.muted || video.volume === 0;
            muteButton.setAttribute("aria-pressed", String(muted));
            muteButton.setAttribute("aria-label", muted ? "Unmute video" : "Mute video");
            muteButton.querySelector("span").textContent = muted ? "🔇" : "🔊";
            muteButton.classList.toggle("is-muted", muted);
        };

        const syncProgress = () => {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
            progressFill.style.width = percent + "%";
            timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
        };

        playButton.addEventListener("click", async () => {
            try {
                if (video.paused || video.ended) {
                    await video.play();
                } else {
                    video.pause();
                }
            } catch {
                loading.hidden = false;
                setTimeout(() => { loading.hidden = true; }, 1200);
            }
            syncPlayButton();
        });

        muteButton.addEventListener("click", () => {
            video.muted = !video.muted;
            syncMuteButton();
        });

        video.addEventListener("play", syncPlayButton);
        video.addEventListener("pause", syncPlayButton);
        video.addEventListener("ended", () => {
            syncPlayButton();
            syncProgress();
        });
        video.addEventListener("volumechange", syncMuteButton);
        video.addEventListener("timeupdate", syncProgress);
        video.addEventListener("loadedmetadata", syncProgress);
        video.addEventListener("loadeddata", () => {
            loading.hidden = true;
            if (fallback) fallback.hidden = true;
            syncProgress();
        });
        video.addEventListener("waiting", () => { loading.hidden = false; });
        video.addEventListener("canplay", () => { loading.hidden = true; });
        video.addEventListener("error", () => {
            loading.hidden = false;
            loading.textContent = "VIDEO UNAVAILABLE";
            if (fallback) fallback.hidden = false;
        });

        const progressTrack = card.querySelector(".reels-stage2-progress-track");
        if (progressTrack) {
            progressTrack.addEventListener("click", (event) => {
                if (!Number.isFinite(video.duration) || video.duration <= 0) return;
                const rect = progressTrack.getBoundingClientRect();
                const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                video.currentTime = ratio * video.duration;
                syncProgress();
            });
        }

        syncPlayButton();
        syncMuteButton();
        syncProgress();
    };

    // app.js calls this name whenever the Reels section opens.
    // Reels-only override; app navigation remains untouched.
    window.renderHelixReels = renderStage1;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            renderStage1();
            bindStage2Video();
        }, { once: true });
    } else {
        renderStage1();
        bindStage2Video();
    }

    window.addEventListener("load", bindStage2Video, { once: true });
})();
