/* =========================================================
   HELIX REELS — STAGE 3
   Vertical feed, scroll snap, active Reel playback, next preload.
   Reels-only. No likes/comments/share/save/backend behavior.
   ========================================================= */

(() => {
    "use strict";

    const VIDEO_SRC =
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
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
    let scrollFrame = 0;
    let activeIndex = -1;
    let renderGeneration = 0;

    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
        const whole = Math.floor(seconds);
        const minutes = Math.floor(whole / 60);
        const remainder = String(whole % 60).padStart(2, "0");
        return `${minutes}:${remainder}`;
    };

    const getFeed = () => document.getElementById("reels-feed");

    const getCards = () =>
        Array.from(document.querySelectorAll(
            "#reels-view .reels-stage3-card"
        ));

    const getVideo = (card) =>
        card ? card.querySelector(".reels-stage3-video") : null;

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
                    preload="${index === 0 || index === 1 ? "auto" : "metadata"}"
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

                <button class="reels-stage2-play reels-stage3-play"
                        type="button"
                        aria-label="Play video"
                        aria-pressed="false">
                    <span aria-hidden="true">▶</span>
                </button>

                <button class="reels-stage2-mute reels-stage3-mute"
                        type="button"
                        aria-label="Unmute video"
                        aria-pressed="true">
                    <span aria-hidden="true">🔇</span>
                </button>

                <div class="reels-stage2-progress reels-stage3-progress"
                     aria-label="Video progress">
                    <div class="reels-stage2-progress-track reels-stage3-progress-track">
                        <span class="reels-stage2-progress-fill reels-stage3-progress-fill"></span>
                    </div>
                    <span class="reels-stage2-time reels-stage3-time">0:00 / 0:00</span>
                </div>

                <div class="reels-stage2-loading reels-stage3-loading" hidden>
                    LOADING MEDIA…
                </div>
            </div>

            <div class="helix-reel-bottom reels-static-overlay">
                <div class="reels-creator">
                    <span class="helix-reel-avatar reels-creator-avatar">
                        ${reel.initials}
                    </span>
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

            <div class="helix-reel-actions reels-static-actions"
                 aria-label="Reel actions">
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
    };

    const syncProgress = (card) => {
        const video = getVideo(card);
        const fill = card?.querySelector(".reels-stage3-progress-fill");
        const label = card?.querySelector(".reels-stage3-time");
        if (!video || !fill || !label) return;

        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        const percent =
            duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

        fill.style.width = percent + "%";
        label.textContent =
            `${formatTime(current)} / ${formatTime(duration)}`;
    };

    const pauseVideo = (video) => {
        if (!video) return;
        try {
            video.pause();
        } catch {
            // Ignore browser-specific media teardown errors.
        }
    };

    const preloadNext = (index) => {
        const cards = getCards();
        const nextCard = cards[index + 1];
        if (!nextCard) return;

        const nextVideo = getVideo(nextCard);
        if (!nextVideo) return;

        nextVideo.preload = "auto";

        if (nextVideo.readyState === HTMLMediaElement.HAVE_NOTHING) {
            nextVideo.load();
        }
    };

    const updatePlayback = async (index, shouldAutoplay = true) => {
        const cards = getCards();
        const card = cards[index];
        if (!card) return;

        activeIndex = index;

        cards.forEach((item, itemIndex) => {
            const video = getVideo(item);
            const isActive = itemIndex === index;

            item.dataset.reelActive = String(isActive);

            if (!isActive) {
                pauseVideo(video);
                syncPlayButton(item);
            }
        });

        const video = getVideo(card);
        if (!video) return;

        preloadNext(index);

        if (!shouldAutoplay) {
            syncPlayButton(card);
            return;
        }

        video.muted = true;
        syncMuteButton(card);

        try {
            if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                video.load();
            }
            await video.play();
        } catch {
            // Autoplay may be rejected by the browser; the Play control remains usable.
        }

        syncPlayButton(card);
        syncProgress(card);
    };

    const chooseActiveCard = () => {
        const feed = getFeed();
        const cards = getCards();
        if (!feed || !cards.length) return;

        const feedRect = feed.getBoundingClientRect();
        const center = feedRect.top + (feedRect.height / 2);

        let bestIndex = activeIndex >= 0 ? activeIndex : 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        cards.forEach((card, index) => {
            const rect = card.getBoundingClientRect();
            const cardCenter = rect.top + (rect.height / 2);
            const distance = Math.abs(cardCenter - center);

            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });

        if (bestIndex !== activeIndex) {
            updatePlayback(bestIndex, true);
        }
    };

    const bindCard = (card, generation) => {
        if (!card || card.dataset.stage3Bound === "true") return;

        const video = getVideo(card);
        if (!video) return;

        card.dataset.stage3Bound = "true";
        video.muted = true;

        const playButton = card.querySelector(".reels-stage3-play");
        const muteButton = card.querySelector(".reels-stage3-mute");
        const progressTrack =
            card.querySelector(".reels-stage3-progress-track");
        const fallback =
            card.querySelector(".reels-stage2-video-fallback");
        const loading =
            card.querySelector(".reels-stage3-loading");

        playButton?.addEventListener("click", async (event) => {
            event.stopPropagation();

            try {
                if (video.paused || video.ended) {
                    await updatePlayback(
                        Number(card.dataset.reelIndex),
                        true
                    );
                } else {
                    video.pause();
                }
            } catch {
                // Keep the custom control responsive even when playback is blocked.
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

            if (!Number.isFinite(video.duration) || video.duration <= 0) {
                return;
            }

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

        if (generation !== renderGeneration) return;

        syncPlayButton(card);
        syncMuteButton(card);
        syncProgress(card);
    };

    const setupScrollObserver = () => {
        const feed = getFeed();
        const cards = getCards();
        if (!feed || !cards.length) return;

        observer?.disconnect();

        observer = new IntersectionObserver((entries) => {
            let best = null;
            let bestRatio = 0;

            entries.forEach((entry) => {
                if (entry.intersectionRatio > bestRatio) {
                    best = entry.target;
                    bestRatio = entry.intersectionRatio;
                }
            });

            if (!best || bestRatio < 0.6) return;

            const index = Number(best.dataset.reelIndex);
            if (index !== activeIndex) {
                updatePlayback(index, true);
            }
        }, {
            root: feed,
            threshold: [0.6, 0.75, 0.9, 1]
        });

        cards.forEach((card) => observer.observe(card));

        feed.addEventListener("scroll", () => {
            if (scrollFrame) return;

            scrollFrame = requestAnimationFrame(() => {
                scrollFrame = 0;
                chooseActiveCard();
            });
        }, { passive: true });

        chooseActiveCard();
    };

    const renderStage3 = () => {
        const feed = getFeed();
        if (!feed) return;

        renderGeneration += 1;
        activeIndex = -1;

        observer?.disconnect();
        observer = null;

        feed.innerHTML = REELS.map(reelMarkup).join("");

        const generation = renderGeneration;
        getCards().forEach((card) => bindCard(card, generation));

        setupScrollObserver();
        updatePlayback(0, true);
        preloadNext(0);
    };

    const protectFeedFromLegacyRenderers = () => {
        const feed = getFeed();
        if (!feed) return;

        const cardCount = getCards().length;
        if (cardCount !== REELS.length) {
            renderStage3();
        }
    };

    /*
     * app.js already invokes these names when the Reels section opens.
     * Stage 3 deliberately owns both hooks without editing app.js.
     */
    window.renderHelixReels = renderStage3;
    window.setupReelObserver = setupScrollObserver;
    window.HelixReelsStage3 = {
        render: renderStage3,
        setup: setupScrollObserver
    };

    const start = () => {
        renderStage3();

        const feed = getFeed();
        if (feed) {
            const legacyGuard = new MutationObserver(() => {
                if (feed.dataset.reelsStage3Rendering === "true") return;

                feed.dataset.reelsStage3Rendering = "true";
                protectFeedFromLegacyRenderers();
                queueMicrotask(() => {
                    delete feed.dataset.reelsStage3Rendering;
                });
            });

            legacyGuard.observe(feed, { childList: true });
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
