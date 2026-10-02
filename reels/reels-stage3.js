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
            shares: "76",
            likeCount: 1200,
            liked: false,
            saved: false
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
            shares: "42",
            likeCount: 946,
            liked: false,
            saved: false
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
            shares: "119",
            likeCount: 2400,
            liked: false,
            saved: false
        }
    ];

    const SAVED_STORAGE_KEY = "helix.reels.saved.v1";

    let savedReelIds = new Set();

    try {
        const stored = JSON.parse(
            localStorage.getItem(SAVED_STORAGE_KEY) || "[]"
        );

        if (Array.isArray(stored)) {
            savedReelIds = new Set(
                stored.filter((value) => typeof value === "string")
            );
        }
    } catch {
        savedReelIds = new Set();
    }

    let observer = null;
    let scrollFrame = 0;
    let wheelLockUntil = 0;
    let activeIndex = -1;
    let renderGeneration = 0;

    REELS.forEach((reel) => {
        reel.saved = savedReelIds.has(reel.id);
    });

    const persistSavedReels = () => {
        try {
            localStorage.setItem(
                SAVED_STORAGE_KEY,
                JSON.stringify(Array.from(savedReelIds))
            );
        } catch {
            // Persistence can fail in restricted browser storage contexts.
        }
    };

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
                    preload="metadata"
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
                    <button
                        class="reels-creator-profile-button"
                        type="button"
                        data-creator-profile
                        aria-label="Open creator profile for ${reel.username}"
                    >
                        <span class="helix-reel-avatar reels-creator-avatar">
                            ${reel.initials}
                        </span>
                        <span class="helix-reel-author-info">
                            <strong>${reel.username}</strong>
                            <span>${reel.handle}</span>
                        </span>
                    </button>

                    <button
                        class="reels-follow-button"
                        type="button"
                        data-creator-follow
                        aria-pressed="false"
                        aria-label="Follow ${reel.username}"
                    >
                        Follow
                    </button>
                </div>

                <p class="helix-reel-caption">
                    ${reel.caption}
                    <span class="reels-hashtags">${reel.hashtags}</span>
                </p>
            </div>

            <div class="helix-reel-actions reels-static-actions"
                 aria-label="Reel actions">
                <button
                    class="helix-reel-action reels-like-button"
                    type="button"
                    aria-label="Like Reel"
                    aria-pressed="false"
                >
                    <span class="helix-action-icon" aria-hidden="true">♡</span>
                    <span class="helix-action-count reels-like-count">${reel.likeCount}</span>
                </button>
                <button class="helix-reel-action" type="button" aria-label="Comment on Reel">
                    <span class="helix-action-icon" aria-hidden="true">◌</span>
                    <span class="helix-action-count">${reel.comments}</span>
                </button>
                <button class="helix-reel-action" type="button" aria-label="Share Reel">
                    <span class="helix-action-icon" aria-hidden="true">↗</span>
                    <span class="helix-action-count">${reel.shares}</span>
                </button>
                <button
                    class="helix-reel-action reels-save-button"
                    type="button"
                    aria-label="Save Reel"
                    aria-pressed="false"
                >
                    <span class="helix-action-icon" aria-hidden="true">⌑</span>
                    <span class="helix-action-count reels-save-label">Save</span>
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

    const syncSaveButton = (card) => {
        const index = Number(card?.dataset.reelIndex);
        const reel = REELS[index];
        const button = card?.querySelector(".reels-save-button");
        const label = card?.querySelector(".reels-save-label");

        if (!reel || !button || !label) return;

        button.classList.toggle("saved", reel.saved);
        button.setAttribute("aria-pressed", String(reel.saved));
        button.setAttribute(
            "aria-label",
            reel.saved ? "Unsave Reel" : "Save Reel"
        );

        const icon = button.querySelector(".helix-action-icon");
        if (icon) icon.textContent = reel.saved ? "⌑" : "⌑";

        label.textContent = reel.saved ? "Saved" : "Save";
    };

    const setSaveState = (card, saved) => {
        const index = Number(card?.dataset.reelIndex);
        const reel = REELS[index];
        if (!reel || !card) return;

        reel.saved = Boolean(saved);

        if (reel.saved) {
            savedReelIds.add(reel.id);
        } else {
            savedReelIds.delete(reel.id);
        }

        persistSavedReels();
        syncSaveButton(card);
    };

    const toggleSave = (card) => {
        const index = Number(card?.dataset.reelIndex);
        const reel = REELS[index];
        if (!reel) return;

        setSaveState(card, !reel.saved);
    };

    const formatLikeCount = (count) => {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
        }

        if (count >= 1000) {
            return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K";
        }

        return String(count);
    };

    const syncLikeButton = (card) => {
        const index = Number(card?.dataset.reelIndex);
        const reel = REELS[index];
        const button = card?.querySelector(".reels-like-button");
        const count = card?.querySelector(".reels-like-count");

        if (!reel || !button || !count) return;

        button.classList.toggle("liked", reel.liked);
        button.setAttribute("aria-pressed", String(reel.liked));
        button.setAttribute(
            "aria-label",
            reel.liked ? "Unlike Reel" : "Like Reel"
        );

        const icon = button.querySelector(".helix-action-icon");
        if (icon) icon.textContent = reel.liked ? "♥" : "♡";

        count.textContent = formatLikeCount(reel.likeCount);
    };

    const animateLike = (card) => {
        const burst = document.createElement("span");
        burst.className = "reels-like-burst";
        burst.setAttribute("aria-hidden", "true");
        burst.textContent = "♥";
        card.appendChild(burst);

        requestAnimationFrame(() => {
            burst.classList.add("is-visible");
        });

        window.setTimeout(() => burst.remove(), 720);
    };

    const setLikeState = (card, liked) => {
        const index = Number(card?.dataset.reelIndex);
        const reel = REELS[index];
        if (!reel || !card) return;

        if (reel.liked === liked) {
            syncLikeButton(card);
            return;
        }

        reel.liked = liked;
        reel.likeCount = Math.max(
            0,
            reel.likeCount + (liked ? 1 : -1)
        );

        syncLikeButton(card);

        if (liked) {
            animateLike(card);
        }
    };

    const toggleLike = (card) => {
        if (!card) return;
        const index = Number(card.dataset.reelIndex);
        const reel = REELS[index];
        if (!reel) return;

        setLikeState(card, !reel.liked);
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

        const reelsSection = document.getElementById("reels-view");
        if (!reelsSection || reelsSection.hidden) return;

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
        const likeButton = card.querySelector(".reels-like-button");
        const saveButton = card.querySelector(".reels-save-button");

        likeButton?.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleLike(card);
        });

        saveButton?.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleSave(card);
        });

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
        syncLikeButton(card);
        syncSaveButton(card);
    };

    const goToReel = (index) => {
        const cards = getCards();
        const feed = getFeed();
        if (!feed || !cards.length) return;

        const targetIndex = Math.max(0, Math.min(cards.length - 1, index));
        const target = cards[targetIndex];
        if (!target) return;

        target.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        window.setTimeout(() => {
            if (targetIndex !== activeIndex) {
                updatePlayback(targetIndex, true);
            }
        }, 140);
    };

    const toggleActivePlayback = async () => {
        const cards = getCards();
        const card = cards[activeIndex >= 0 ? activeIndex : 0];
        const video = getVideo(card);
        if (!video) return;

        try {
            if (video.paused || video.ended) {
                await updatePlayback(
                    Number(card.dataset.reelIndex),
                    true
                );
            } else {
                video.pause();
                syncPlayButton(card);
            }
        } catch {
            syncPlayButton(card);
        }
    };

    const setupReelsInput = () => {
        const feed = getFeed();
        if (!feed || feed.dataset.stage3InputBound === "true") return;

        feed.dataset.stage3InputBound = "true";

        /*
         * Mouse wheel:
         * one wheel gesture = one Reel movement.
         */
        feed.addEventListener("wheel", (event) => {
            if (Math.abs(event.deltaY) < 8) return;
            if (event.ctrlKey || event.metaKey || event.shiftKey) return;

            const now = Date.now();
            if (now < wheelLockUntil) {
                event.preventDefault();
                return;
            }

            event.preventDefault();
            wheelLockUntil = now + 520;

            if (event.deltaY > 0) {
                goToReel(activeIndex + 1);
            } else {
                goToReel(activeIndex - 1);
            }
        }, { passive: false });

        /*
         * Keyboard navigation:
         * ArrowDown = next Reel
         * ArrowUp = previous Reel
         * Space = play/pause current Reel
         */
        document.addEventListener("keydown", (event) => {
            const target = event.target;
            const tag = target?.tagName?.toLowerCase();
            const typing =
                tag === "input" ||
                tag === "textarea" ||
                tag === "select" ||
                target?.isContentEditable;

            if (typing) return;

            const reelsSection = document.getElementById("reels-view");
            if (!reelsSection || reelsSection.hidden) return;

            if (event.key === "ArrowDown") {
                event.preventDefault();
                goToReel(activeIndex + 1);
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                goToReel(activeIndex - 1);
                return;
            }

            if (event.code === "Space") {
                event.preventDefault();
                toggleActivePlayback();
                return;
            }

            if (event.key.toLowerCase() === "m") {
                event.preventDefault();

                const cards = getCards();
                const card = cards[activeIndex >= 0 ? activeIndex : 0];
                const video = getVideo(card);

                if (video) {
                    video.muted = !video.muted;
                    syncMuteButton(card);
                }
            }
        });

        /*
         * Click/tap the Reel media surface itself to play/pause.
         * Interactive controls are deliberately excluded.
         */
        let tapTimer = 0;

        feed.addEventListener("dblclick", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (
                target.closest("button, a, input, textarea, select") ||
                target.closest(".reels-stage3-progress-track")
            ) {
                return;
            }

            const card = target.closest(".reels-stage3-card");
            if (!card) return;

            window.clearTimeout(tapTimer);
            tapTimer = 0;

            const index = Number(card.dataset.reelIndex);
            if (index !== activeIndex) {
                goToReel(index);
                setLikeState(card, true);
                return;
            }

            setLikeState(card, true);
        });

        feed.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (
                target.closest("button, a, input, textarea, select") ||
                target.closest(".reels-stage3-progress-track")
            ) {
                return;
            }

            const card = target.closest(".reels-stage3-card");
            if (!card) return;

            window.clearTimeout(tapTimer);

            tapTimer = window.setTimeout(() => {
                tapTimer = 0;

                const index = Number(card.dataset.reelIndex);
                if (index !== activeIndex) {
                    goToReel(index);
                    return;
                }

                toggleActivePlayback();
            }, 220);
        });
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

        if (feed.dataset.stage3ScrollBound !== "true") {
            feed.addEventListener("scroll", () => {
                if (scrollFrame) return;

                scrollFrame = requestAnimationFrame(() => {
                    scrollFrame = 0;
                    chooseActiveCard();
                });
            }, { passive: true });

            feed.dataset.stage3ScrollBound = "true";
        }

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

        setupReelsInput();

        const reelsSection = document.getElementById("reels-view");
        if (reelsSection && !reelsSection.hidden) {
            setupScrollObserver();
            updatePlayback(0, true);
            preloadNext(0);
        }
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
