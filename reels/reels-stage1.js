/* =========================================================
   HELIX REELS — STAGE 3 / SCROLL EXPERIENCE
   Reels-only. Video playback + vertical snap + preload.
   Likes/comments/share/save remain presentation-only.
   ========================================================= */

(() => {
    "use strict";

    const VIDEO_SRC = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
    const POSTER_SRC = "reels/reel-poster.svg";

    const REELS = [
        {
            id: "helix-reel-01",
            initials: "NS",
            username: "nova.signal",
            handle: "@nova.signal",
            caption: "Build the future in public. Small signals become big systems.",
            hashtags: "#HELIX #BUILD #FUTURE",
            likes: "1.2K",
            comments: "184",
            shares: "76"
        },
        {
            id: "helix-reel-02",
            initials: "AX",
            username: "aether.x",
            handle: "@aether.x",
            caption: "Ideas move faster when the interface gets out of the way.",
            hashtags: "#HELIX #DESIGN #SIGNAL",
            likes: "946",
            comments: "118",
            shares: "42"
        },
        {
            id: "helix-reel-03",
            initials: "CY",
            username: "cypher.yard",
            handle: "@cypher.yard",
            caption: "Prototype today. Refine tomorrow. Keep shipping the signal.",
            hashtags: "#HELIX #CREATE #SHIP",
            likes: "2.4K",
            comments: "301",
            shares: "119"
        }
    ];

    let observer = null;
    let visibilityRatios = new Map();
    let activeIndex = 0;
    let renderToken = 0;

    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
        const whole = Math.floor(seconds);
        const minutes = Math.floor(whole / 60);
        const remainder = String(whole % 60).padStart(2, "0");
        return `${minutes}:${remainder}`;
    };

    const reelMarkup = (reel, index) => `
        <article
            class="helix-reel-card reels-static-card reels-stage3-card"
            data-reel-index="${index}"
            data-reel-id="${reel.id}"
            aria-label="Reel from ${reel.username}"
        >
            <div class="helix-reel-media">
                <video
                    class="reels-stage2-video reels-stage3-video"
                    preload="${index === 0 ? "auto" : "metadata"}"
                    playsinline
                    muted
                    poster="${POSTER_SRC}"
                    aria-label="Helix Reel video from ${reel.username}"
                >
                    <source src="${VIDEO_SRC}" type="video/mp4">
                </video>

                <div class="reels-stage2-video-fallback" aria-hidden="true">
                    <div class="reels-static-visual">
                        <div class="reels-visual-grid"></div>
                        <div class="reels-visual-orbit reels-orbit-a"></div>
                        <div class="reels-visual-orbit reels-orbit-b"></div>
                        <div class="reels-visual-core">
                            <span>HELIX</span>
                            <strong>REEL / 0${index + 1}</strong>
                        </div>
                        <div class="reels-visual-scanline"></div>
                    </div>
                </div>

                <div class="reels-static-topline">
                    <span class="reels-live-marker"></span>
                    <span>DISCOVER SIGNAL</span>
                </div>

                <button class="reels-stage2-play reels-stage3-play" type="button" aria-label="Play video" aria-pressed="false">
                    <span aria-hidden="true">▶</span>
                </button>

                <button class="reels-stage2-mute reels-stage3-mute" type="button" aria-label="Unmute video" aria-pressed="true">
                    <span aria-hidden="true">🔇</span>
                </button>

                <div class="reels-stage2-progress reels-stage3-progress" aria-label="Video progress">
                    <div class="reels-stage2-progress-track reels-stage3-progress-track">
                        <span class="reels-stage2-progress-fill reels-stage3-progress-fill"></span>
                    </div>
                    <span class="reels-stage2-time reels-stage3-time">0:00 / 0:00</span>
                </div>

                <div class="reels-stage2-loading reels-stage3-loading" hidden>LOADING MEDIA…</div>
            </div>

            <div class="helix-reel-bottom reels-static-overlay">
                <div class="reels-creator">
                    <span class="helix-reel-avatar reels-creator-avatar">${reel.initials}</span>
                    <div class="helix-reel-author-info">
                        <strong>${reel.username}</strong>
                        <span>${reel.handle}</span>
                    </div>
                </div>

                <p class="helix-reel-caption">
                    ${reel.caption}
                    <span class="reels-hashtags">${reel.hashtags}</span>
                </p>
            </div>

            <div class="helix-reel-actions reels-static-actions" aria-label="Reel actions">
                <button class="helix-reel-action" type="button" aria-label="Like Reel">
                    <span class="helix-action-icon" aria-hidden="true">♡</span>
                    <span class="helix-action-count">${reel.likes}</span>
                </button>
                <button class="helix-reel-action" type="button" aria-label="Comment on Reel">
                    <span class="helix-action-icon" aria-hidden="true">◌</span>
                    <span class="helix-action-count">${reel.comments}</span>
                </button>
                <button class="helix-reel-action" type="button" aria-label="Share Reel">
                    <span class="helix-action-icon" aria-hidden="true">↗</span>
                    <span class="helix-action-count">${reel.shares}</span>
                </button>
                <button class="helix-reel-action" type="button" aria-label="Save Reel">
                    <span class="helix-action-icon" aria-hidden="true">⌑</span>
                    <span class="helix-action-count">Save</span>
                </button>
            </div>
        </article>
    `;

    const getCards = () => Array.from(
        document.querySelectorAll("#reels-view .reels-stage3-card")
    );

    const getVideo = (card) => card?.querySelector(".reels-stage3-video");

    const syncPlayButton = (card) => {
        const video = getVideo(card);
        const button = card?.querySelector(".reels-stage3-play");
        if (!video || !button) return;

        const playing = !video.paused && !video.ended;
        button.setAttribute("aria-pressed", String(playing));
        button.setAttribute("aria-label", playing ? "Pause video" : "Play video");

        const icon = button.querySelector("span");
        if (icon) icon.textContent = playing ? "❚❚" : "▶";

        button.classList.toggle("is-playing", playing);
    };

    const syncMuteButton = (card) => {
        const video = getVideo(card);
        const button = card?.querySelector(".reels-stage3-mute");
        if (!video || !button) return;

        const muted = video.muted || video.volume === 0;
        button.setAttribute("aria-pressed", String(muted));
        button.setAttribute("aria-label", muted ? "Unmute video" : "Mute video");

        const icon = button.querySelector("span");
        if (icon) icon.textContent = muted ? "🔇" : "🔊";

        button.classList.toggle("is-muted", muted);
    };

    const syncProgress = (card) => {
        const video = getVideo(card);
        const fill = card?.querySelector(".reels-stage3-progress-fill");
        const time = card?.querySelector(".reels-stage3-time");
        if (!video || !fill || !time) return;

        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

        fill.style.width = percent + "%";
        time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    };

    const pauseAllExcept = (keepVideo = null) => {
        getCards().forEach((card) => {
            const video = getVideo(card);
            if (!video || video === keepVideo) return;
            if (!video.paused) video.pause();
            video.currentTime = video.currentTime;
            syncPlayButton(card);
        });
    };

    const preloadAround = (index) => {
        const cards = getCards();

        cards.forEach((card, cardIndex) => {
            const video = getVideo(card);
            if (!video) return;

            if (cardIndex === index || cardIndex === index + 1) {
                video.preload = "auto";
                if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
                    video.load();
                }
            } else {
                video.preload = "metadata";
            }
        });
    };

    const autoplayCard = async (card, index) => {
        const video = getVideo(card);
        if (!video) return;

        activeIndex = index;
        preloadAround(index);
        pauseAllExcept(video);

        video.muted = true;
        syncMuteButton(card);

        try {
            await video.play();
        } catch {
            // Browser playback policies can reject play(). The visible Play control remains available.
        }

        syncPlayButton(card);
    };

    const bindCard = (card, token) => {
        if (!card || card.dataset.stage3Bound === "true") return;
        const video = getVideo(card);
        if (!video) return;

        card.dataset.stage3Bound = "true";
        video.muted = true;

        const playButton = card.querySelector(".reels-stage3-play");
        const muteButton = card.querySelector(".reels-stage3-mute");
        const progressTrack = card.querySelector(".reels-stage3-progress-track");
        const fallback = card.querySelector(".reels-stage2-video-fallback");
        const loading = card.querySelector(".reels-stage3-loading");

        playButton?.addEventListener("click", async (event) => {
            event.stopPropagation();
            try {
                if (video.paused || video.ended) {
                    await video.play();
                } else {
                    video.pause();
                }
            } catch {
                if (loading) {
                    loading.hidden = false;
                    loading.textContent = "PLAYBACK BLOCKED";
                    window.setTimeout(() => {
                        if (token === renderToken) loading.hidden = true;
                    }, 1200);
                }
            }
            syncPlayButton(card);
        });

        muteButton?.addEventListener("click", (event) => {
            event.stopPropagation();
            video.muted = !video.muted;
            syncMuteButton(card);
        });

        progressTrack?.addEventListener("click", (event) => {
            event.stopPropagation();
            if (!Number.isFinite(video.duration) || video.duration <= 0) return;

            const rect = progressTrack.getBoundingClientRect();
            const ratio = Math.min(
                1,
                Math.max(0, (event.clientX - rect.left) / rect.width)
            );

            video.currentTime = ratio * video.duration;
            syncProgress(card);
        });

        video.addEventListener("play", () => syncPlayButton(card));
        video.addEventListener("pause", () => syncPlayButton(card));
        video.addEventListener("volumechange", () => syncMuteButton(card));

        video.addEventListener("timeupdate", () => syncProgress(card));
        video.addEventListener("loadedmetadata", () => syncProgress(card));

        video.addEventListener("loadeddata", () => {
            if (fallback) fallback.hidden = true;
            if (loading) loading.hidden = true;
            syncProgress(card);
        });

        video.addEventListener("waiting", () => {
            if (card.dataset.reelActive === "true" && loading) {
                loading.hidden = false;
                loading.textContent = "LOADING MEDIA…";
            }
        });

        video.addEventListener("canplay", () => {
            if (loading) loading.hidden = true;
        });

        video.addEventListener("error", () => {
            if (loading) {
                loading.hidden = false;
                loading.textContent = "VIDEO UNAVAILABLE";
            }
            if (fallback) fallback.hidden = false;
        });

        video.addEventListener("ended", () => {
            syncPlayButton(card);
            syncProgress(card);
        });

        syncPlayButton(card);
        syncMuteButton(card);
        syncProgress(card);
    };

    const setupObserver = () => {
        const feed = document.getElementById("reels-feed");
        const cards = getCards();
        if (!feed || !cards.length) return;

        if (observer) observer.disconnect();

        visibilityRatios = new Map(cards.map((card) => [card, 0]));

        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                visibilityRatios.set(entry.target, entry.intersectionRatio);
            });

            let bestCard = null;
            let bestRatio = 0;

            visibilityRatios.forEach((ratio, card) => {
                if (ratio > bestRatio) {
                    bestRatio = ratio;
                    bestCard = card;
                }
            });

            if (!bestCard || bestRatio < 0.65) return;

            const index = Number(bestCard.dataset.reelIndex);
            cards.forEach((card) => {
                card.dataset.reelActive = String(card === bestCard);
            });

            autoplayCard(bestCard, index);
        }, {
            root: feed,
            threshold: [0.25, 0.5, 0.65, 0.8, 0.95]
        });

        cards.forEach((card) => observer.observe(card));

        cards.forEach((card) => {
            visibilityRatios.set(card, card === cards[0] ? 1 : 0);
        });

        cards[0].dataset.reelActive = "true";
        autoplayCard(cards[0], 0);
    };

    const renderStage3 = () => {
        const feed = document.getElementById("reels-feed");
        if (!feed) return;

        renderToken += 1;
        const token = renderToken;

        if (observer) {
            observer.disconnect();
            observer = null;
        }

        feed.innerHTML = REELS.map(reelMarkup).join("");

        const cards = getCards();
        cards.forEach((card) => bindCard(card, token));
        setupObserver();
    };

    // app.js calls this name whenever the Reels section opens.
    // Reels-only override; global navigation remains untouched.
    window.renderHelixReels = renderStage3;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderStage3, { once: true });
    } else {
        renderStage3();
    }

    window.addEventListener("load", renderStage3, { once: true });
})();
