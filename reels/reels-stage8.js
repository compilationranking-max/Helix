
/* =========================================================
   HELIX REELS — STAGE 8 / CREATOR SECTION
   Creator profile, follow state, creator navigation.
   ========================================================= */

(() => {
    "use strict";

    const FOLLOW_STORAGE_KEY = "helix.reels.following.v1";

    let followingCreators = new Set();
    let profilePanel = null;
    let currentCreatorIndex = 0;
    let boundCreatorButtons = new WeakSet();
    let creatorObserver = null;

    try {
        const saved = JSON.parse(
            localStorage.getItem(FOLLOW_STORAGE_KEY) || "[]"
        );

        if (Array.isArray(saved)) {
            followingCreators = new Set(
                saved.filter((value) => typeof value === "string")
            );
        }
    } catch {
        followingCreators = new Set();
    }

    const escapeHTML = (value) => {
        const element = document.createElement("div");
        element.textContent = String(value == null ? "" : value);
        return element.innerHTML;
    };

    const persistFollowing = () => {
        try {
            localStorage.setItem(
                FOLLOW_STORAGE_KEY,
                JSON.stringify(Array.from(followingCreators))
            );
        } catch {
            // Ignore restricted storage environments.
        }
    };

    const getCreatorCards = () =>
        Array.from(document.querySelectorAll(
            "#reels-view .reels-stage3-card"
        ));

    const getCreatorData = (card) => {
        if (!card) return null;

        const profileButton =
            card.querySelector("[data-creator-profile]");

        const avatar =
            profileButton?.querySelector(".reels-creator-avatar")
                ?.textContent.trim() || "HX";

        const info =
            profileButton?.querySelector(".reels-reel-author-info");

        const username =
            profileButton?.querySelector("strong")
                ?.textContent.trim() || "";

        const handle =
            profileButton?.querySelector("span span")
                ?.textContent.trim() || "";

        const strong =
            profileButton?.querySelector(
                ".reels-creator .helix-reel-author-info strong"
            );

        const usernameValue =
            strong?.textContent.trim() ||
            username ||
            "helix.creator";

        const handleValue =
            profileButton?.querySelector(
                ".reels-creator .helix-reel-author-info span"
            )?.textContent.trim() ||
            handle ||
            "@" + usernameValue;

        const caption =
            card.querySelector(".helix-reel-caption")
                ?.textContent
                .replace(
                    card.querySelector(".reels-hashtags")?.textContent || "",
                    ""
                )
                .trim() || "";

        const hashtags =
            card.querySelector(".reels-hashtags")
                ?.textContent.trim() || "";

        return {
            id: card.getAttribute("data-reel-id") || "",
            username: usernameValue,
            handle: handleValue,
            initials: avatar,
            caption,
            hashtags,
            card
        };
    };

    const syncFollowButton = (card) => {
        const data = getCreatorData(card);
        const button = card?.querySelector("[data-creator-follow]");

        if (!data || !button) return;

        const following = followingCreators.has(data.username);

        button.textContent = following ? "Following" : "Follow";
        button.setAttribute("aria-pressed", String(following));
        button.setAttribute(
            "aria-label",
            following
                ? "Unfollow " + data.username
                : "Follow " + data.username
        );

        button.classList.toggle("following", following);
    };

    const toggleFollow = (card) => {
        const data = getCreatorData(card);
        if (!data) return;

        if (followingCreators.has(data.username)) {
            followingCreators.delete(data.username);
        } else {
            followingCreators.add(data.username);
        }

        persistFollowing();
        syncFollowButton(card);

        if (
            profilePanel &&
            !profilePanel.hidden &&
            Number(card.getAttribute("data-reel-index")) === currentCreatorIndex
        ) {
            updateProfile(Number(card.getAttribute("data-reel-index")));
        }
    };

    const ensureProfilePanel = () => {
        if (profilePanel) return true;

        const reelsView = document.getElementById("reels-view");
        if (!reelsView) return false;

        reelsView.insertAdjacentHTML(
            "beforeend",
            '<aside class="reels-creator-panel-wrap" id="reels-creator-panel-wrap" aria-hidden="true" hidden>' +
                '<button class="reels-creator-panel-backdrop" type="button" data-creator-close aria-label="Close creator profile"></button>' +
                '<section class="reels-creator-panel" role="dialog" aria-modal="true" aria-labelledby="reels-creator-panel-title">' +
                    '<header class="reels-creator-panel-header">' +
                        '<div>' +
                            '<span class="reels-creator-panel-kicker">HELIX / CREATOR</span>' +
                            '<h2 id="reels-creator-panel-title">Creator Profile</h2>' +
                        '</div>' +
                        '<button class="reels-creator-panel-close" type="button" data-creator-close aria-label="Close creator profile">×</button>' +
                    '</header>' +

                    '<div class="reels-creator-profile-main">' +
                        '<div class="reels-creator-profile-avatar" id="reels-profile-avatar">HX</div>' +
                        '<div class="reels-creator-profile-identity">' +
                            '<strong id="reels-profile-username">@creator</strong>' +
                            '<span id="reels-profile-handle">@creator</span>' +
                        '</div>' +
                        '<button class="reels-profile-follow" id="reels-profile-follow" type="button" aria-pressed="false">Follow</button>' +
                    '</div>' +

                    '<div class="reels-creator-profile-body">' +
                        '<div class="reels-creator-profile-section">' +
                            '<span>CAPTION</span>' +
                            '<p id="reels-profile-caption"></p>' +
                        '</div>' +
                        '<div class="reels-creator-profile-section">' +
                            '<span>HASHTAGS</span>' +
                            '<p class="reels-profile-hashtags" id="reels-profile-hashtags"></p>' +
                        '</div>' +
                    '</div>' +

                    '<div class="reels-creator-navigation">' +
                        '<button type="button" id="reels-creator-prev" aria-label="Previous creator">← <span>Previous</span></button>' +
                        '<button type="button" id="reels-creator-view-reel">View Reel <span>↗</span></button>' +
                        '<button type="button" id="reels-creator-next" aria-label="Next creator"><span>Next</span> →</button>' +
                    '</div>' +
                '</section>' +
            '</aside>'
        );

        profilePanel =
            document.getElementById("reels-creator-panel-wrap");

        if (!profilePanel) return false;

        profilePanel.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target.closest("[data-creator-close]")) {
                closeProfile();
                return;
            }

            if (target.closest("#reels-profile-follow")) {
                const cards = getCreatorCards();
                const card = cards[currentCreatorIndex];
                if (card) toggleFollow(card);
                return;
            }

            if (target.closest("#reels-creator-prev")) {
                navigateCreator(-1);
                return;
            }

            if (target.closest("#reels-creator-next")) {
                navigateCreator(1);
                return;
            }

            if (target.closest("#reels-creator-view-reel")) {
                const cards = getCreatorCards();
                const card = cards[currentCreatorIndex];

                closeProfile();

                if (card) {
                    card.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            }
        });

        document.addEventListener("keydown", (event) => {
            if (!profilePanel || profilePanel.hidden) return;

            if (event.key === "Escape") {
                closeProfile();
                return;
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                navigateCreator(-1);
                return;
            }

            if (event.key === "ArrowRight") {
                event.preventDefault();
                navigateCreator(1);
            }
        });

        return true;
    };

    const updateProfile = (index) => {
        const cards = getCreatorCards();
        if (!cards.length) return;

        currentCreatorIndex =
            Math.max(0, Math.min(cards.length - 1, index));

        const data = getCreatorData(cards[currentCreatorIndex]);
        if (!data) return;

        const avatar = document.getElementById("reels-profile-avatar");
        const username = document.getElementById("reels-profile-username");
        const handle = document.getElementById("reels-profile-handle");
        const caption = document.getElementById("reels-profile-caption");
        const hashtags = document.getElementById("reels-profile-hashtags");
        const follow = document.getElementById("reels-profile-follow");
        const previous = document.getElementById("reels-creator-prev");
        const next = document.getElementById("reels-creator-next");

        if (avatar) avatar.textContent = data.initials;
        if (username) username.textContent = data.username;
        if (handle) handle.textContent = data.handle;
        if (caption) caption.textContent = data.caption;
        if (hashtags) hashtags.textContent = data.hashtags || "No hashtags";

        const following = followingCreators.has(data.username);

        if (follow) {
            follow.textContent = following ? "Following" : "Follow";
            follow.setAttribute("aria-pressed", String(following));
            follow.classList.toggle("following", following);
        }

        if (previous) {
            previous.disabled = currentCreatorIndex <= 0;
        }

        if (next) {
            next.disabled = currentCreatorIndex >= cards.length - 1;
        }
    };

    const navigateCreator = (direction) => {
        const cards = getCreatorCards();
        if (!cards.length) return;

        const nextIndex =
            Math.max(
                0,
                Math.min(
                    cards.length - 1,
                    currentCreatorIndex + direction
                )
            );

        if (nextIndex === currentCreatorIndex) return;

        updateProfile(nextIndex);
    };

    const openProfile = (index) => {
        if (!ensureProfilePanel()) return;

        updateProfile(index);

        profilePanel.hidden = false;
        profilePanel.setAttribute("aria-hidden", "false");

        requestAnimationFrame(() => {
            profilePanel.classList.add("is-open");
        });
    };

    const closeProfile = () => {
        if (!profilePanel) return;

        profilePanel.classList.remove("is-open");
        profilePanel.setAttribute("aria-hidden", "true");

        window.setTimeout(() => {
            if (
                profilePanel &&
                !profilePanel.classList.contains("is-open")
            ) {
                profilePanel.hidden = true;
            }
        }, 230);
    };

    const bindCreatorButtons = () => {
        getCreatorCards().forEach((card) => {
            const profileButton =
                card.querySelector("[data-creator-profile]");
            const followButton =
                card.querySelector("[data-creator-follow]");

            if (profileButton && !boundCreatorButtons.has(profileButton)) {
                boundCreatorButtons.add(profileButton);

                profileButton.addEventListener("click", (event) => {
                    event.stopPropagation();

                    const index =
                        Number(card.getAttribute("data-reel-index")) || 0;

                    openProfile(index);
                });
            }

            if (followButton && !boundCreatorButtons.has(followButton)) {
                boundCreatorButtons.add(followButton);

                followButton.addEventListener("click", (event) => {
                    event.stopPropagation();
                    toggleFollow(card);
                });
            }

            syncFollowButton(card);
        });
    };

    const start = () => {
        ensureProfilePanel();
        bindCreatorButtons();

        const feed = document.getElementById("reels-feed");
        if (!feed) return;

        creatorObserver?.disconnect();

        creatorObserver = new MutationObserver(() => {
            bindCreatorButtons();
        });

        creatorObserver.observe(feed, {
            childList: true,
            subtree: true
        });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }

    window.HelixReelsCreator = {
        open: openProfile,
        close: closeProfile
    };
})();
