
/* =========================================================
   HELIX REELS — STAGE 7 / SHARE
   Share panel, Helix friends, send Reel, copy link.
   Reels-only UI/controller. Uses existing Helix DM/network APIs.
   ========================================================= */

(() => {
    "use strict";

    let panel = null;
    let friendList = null;
    let shareStatus = null;
    let currentReelId = null;
    let currentReelUrl = "";
    let buttonObserver = null;
    let boundShareButtons = new WeakSet();

    const escapeHTML = (value) => {
        const element = document.createElement("div");
        element.textContent = String(value == null ? "" : value);
        return element.innerHTML;
    };

    const getReelUrl = (reelId) => {
        const url = new URL(window.location.href);
        url.hash = "reel=" + encodeURIComponent(reelId);
        return url.toString();
    };

    const getReelTitle = (reelId) => {
        const card = document.querySelector(
            '#reels-view .reels-stage3-card[data-reel-id="' +
            CSS.escape(reelId) +
            '"]'
        );

        return card?.querySelector(
            ".reels-creator .helix-reel-author-info strong"
        )?.textContent || "Helix Reel";
    };

    const setStatus = (message, isError) => {
        if (!shareStatus) return;
        shareStatus.textContent = message || "";
        shareStatus.classList.toggle("is-error", Boolean(isError));
    };

    const normalizeFriend = (friend) => {
        if (typeof friend === "string") {
            return {
                username: friend,
                displayName: friend
            };
        }

        return {
            username: friend?.username || friend?.displayName || "",
            displayName: friend?.displayName || friend?.username || "Helix friend"
        };
    };

    const renderFriends = (friends) => {
        if (!friendList) return;

        if (!friends.length) {
            friendList.innerHTML =
                '<div class="reels-share-empty">' +
                    '<span aria-hidden="true">◎</span>' +
                    '<strong>No connected Helix friends</strong>' +
                    '<small>Your connected friends will appear here.</small>' +
                "</div>";
            return;
        }

        friendList.innerHTML = friends.map((friend) => {
            const user = normalizeFriend(friend);
            const initials = user.username.slice(0, 2).toUpperCase();

            return (
                '<button class="reels-share-friend" type="button" ' +
                'data-share-friend="' + escapeHTML(user.username) + '">' +
                    '<span class="reels-share-friend-avatar">' +
                        escapeHTML(initials || "HX") +
                    "</span>" +
                    '<span class="reels-share-friend-copy">' +
                        "<strong>" + escapeHTML(user.displayName) + "</strong>" +
                        "<small>@" + escapeHTML(user.username) + "</small>" +
                    "</span>" +
                    '<span class="reels-share-friend-send" aria-hidden="true">↗</span>' +
                "</button>"
            );
        }).join("");
    };

    const loadFriends = async () => {
        if (!friendList) return;

        friendList.innerHTML =
            '<div class="reels-share-loading">' +
                '<span class="reels-share-spinner" aria-hidden="true"></span>' +
                "Loading Helix friends…" +
            "</div>";

        try {
            const response = await fetch("/api/network/state", {
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Network unavailable");
            }

            const state = await response.json();
            const friends = Array.isArray(state.friends)
                ? state.friends
                : [];

            renderFriends(friends);
        } catch {
            renderFriends([]);
            setStatus(
                "Friends are unavailable until the Helix server is running.",
                true
            );
        }
    };

    const ensurePanel = () => {
        if (panel) return true;

        const reelsView = document.getElementById("reels-view");
        if (!reelsView) return false;

        reelsView.insertAdjacentHTML(
            "beforeend",
            '<aside class="reels-share-panel-wrap" id="reels-share-panel-wrap" aria-hidden="true" hidden>' +
                '<button class="reels-share-backdrop" type="button" data-share-close aria-label="Close share panel"></button>' +
                '<section class="reels-share-panel" role="dialog" aria-modal="true" aria-labelledby="reels-share-title">' +
                    '<header class="reels-share-header">' +
                        '<div>' +
                            '<span class="reels-share-kicker">HELIX / SHARE</span>' +
                            '<h2 id="reels-share-title">Share Reel</h2>' +
                            '<p class="reels-share-reel-name" id="reels-share-reel-name">Helix Reel</p>' +
                        '</div>' +
                        '<button class="reels-share-close" type="button" data-share-close aria-label="Close share panel">×</button>' +
                    '</header>' +

                    '<div class="reels-share-body">' +
                        '<div class="reels-share-section-heading">' +
                            '<span>HELIX FRIENDS</span>' +
                            '<small>Send directly in Messages</small>' +
                        '</div>' +
                        '<div class="reels-share-friend-list" id="reels-share-friend-list"></div>' +

                        '<div class="reels-share-section-heading reels-share-link-heading">' +
                            '<span>LINK</span>' +
                            '<small>Copy this Reel</small>' +
                        '</div>' +
                        '<div class="reels-share-link-row">' +
                            '<span class="reels-share-link-value" id="reels-share-link-value"></span>' +
                            '<button class="reels-share-copy" type="button" data-share-copy>Copy link</button>' +
                        '</div>' +

                        '<p class="reels-share-status" id="reels-share-status" role="status" aria-live="polite"></p>' +
                    '</div>' +
                '</section>' +
            '</aside>'
        );

        panel = document.getElementById("reels-share-panel-wrap");
        friendList = document.getElementById("reels-share-friend-list");
        shareStatus = document.getElementById("reels-share-status");

        if (!panel || !friendList) return false;

        panel.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target.closest("[data-share-close]")) {
                closePanel();
                return;
            }

            const copyButton = target.closest("[data-share-copy]");
            if (copyButton) {
                await copyCurrentLink(copyButton);
                return;
            }

            const friendButton = target.closest("[data-share-friend]");
            if (friendButton) {
                await sendToFriend(
                    friendButton.getAttribute("data-share-friend"),
                    friendButton
                );
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && panel && !panel.hidden) {
                closePanel();
            }
        });

        return true;
    };

    const openPanel = async (reelId) => {
        if (!ensurePanel()) return;

        currentReelId = reelId;
        currentReelUrl = getReelUrl(reelId);

        const name = getReelTitle(reelId);
        const nameElement = document.getElementById("reels-share-reel-name");
        const linkElement = document.getElementById("reels-share-link-value");

        if (nameElement) {
            nameElement.textContent = "from @" + name;
        }

        if (linkElement) {
            linkElement.textContent = currentReelUrl;
        }

        setStatus("");
        renderFriends([]);

        panel.hidden = false;
        panel.setAttribute("aria-hidden", "false");

        requestAnimationFrame(() => {
            panel.classList.add("is-open");
        });

        await loadFriends();
    };

    const closePanel = () => {
        if (!panel) return;

        panel.classList.remove("is-open");
        panel.setAttribute("aria-hidden", "true");

        window.setTimeout(() => {
            if (panel && !panel.classList.contains("is-open")) {
                panel.hidden = true;
            }
        }, 230);
    };

    const copyCurrentLink = async (button) => {
        if (!currentReelUrl) return;

        try {
            await navigator.clipboard.writeText(currentReelUrl);
            setStatus("Reel link copied.");
            if (button) {
                const original = button.textContent;
                button.textContent = "Copied";
                window.setTimeout(() => {
                    if (button) button.textContent = original;
                }, 1300);
            }
        } catch {
            const helper = document.createElement("textarea");
            helper.value = currentReelUrl;
            helper.setAttribute("readonly", "");
            helper.style.position = "fixed";
            helper.style.opacity = "0";
            document.body.appendChild(helper);
            helper.select();

            try {
                document.execCommand("copy");
                setStatus("Reel link copied.");
            } catch {
                setStatus("Could not copy the link.", true);
            }

            helper.remove();
        }
    };

    const sendToFriend = async (username, button) => {
        if (!username || !currentReelId) return;

        const reelName = getReelTitle(currentReelId);
        const message =
            "Shared a Helix Reel with you: " + reelName + "\n" +
            currentReelUrl;

        if (button) {
            button.disabled = true;
            button.classList.add("is-sending");
        }

        try {
            if (!window.HelixDMApi?.sendMessage) {
                throw new Error("DM service unavailable");
            }

            await window.HelixDMApi.sendMessage(username, message);

            if (button) {
                button.classList.remove("is-sending");
                button.classList.add("is-sent");

                const sendMark =
                    button.querySelector(".reels-share-friend-send");

                if (sendMark) sendMark.textContent = "✓";
            }

            setStatus("Reel sent to @" + username + ".");
        } catch {
            if (button) {
                button.disabled = false;
                button.classList.remove("is-sending");
            }

            setStatus(
                "Could not send the Reel. Please try again.",
                true
            );
        }
    };

    const bindShareButtons = () => {
        document
            .querySelectorAll(
                "#reels-view .reels-stage3-card .reels-static-actions .helix-reel-action"
            )
            .forEach((button) => {
                const actions = button.parentElement;
                if (!actions) return;

                const buttons = actions.querySelectorAll(
                    ".helix-reel-action"
                );

                const shareButton = buttons[2];
                if (button !== shareButton) return;
                if (boundShareButtons.has(shareButton)) return;

                boundShareButtons.add(shareButton);
                shareButton.classList.add("reels-share-button");

                shareButton.addEventListener("click", (event) => {
                    event.stopPropagation();

                    const card =
                        shareButton.closest(".reels-stage3-card");

                    const reelId =
                        card?.getAttribute("data-reel-id");

                    if (reelId) {
                        openPanel(reelId);
                    }
                });
            });
    };

    const start = () => {
        ensurePanel();
        bindShareButtons();

        const feed = document.getElementById("reels-feed");
        if (feed) {
            buttonObserver?.disconnect();
            buttonObserver = new MutationObserver(() => {
                bindShareButtons();
            });

            buttonObserver.observe(feed, {
                childList: true,
                subtree: true
            });
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }

    window.HelixReelsShare = {
        open: openPanel,
        close: closePanel
    };
})();
