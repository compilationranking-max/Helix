
/* =========================================================
   HELIX REELS — STAGE 6 / COMMENTS DRAWER
   Open/close, comment list, add comment, replies, comment likes.
   No backend or share functionality.
   ========================================================= */

(() => {
    "use strict";

    const COMMENT_DATA = {
        "helix-reel-01": [
            {
                id: "c1",
                initials: "AX",
                username: "aether.x",
                text: "This visual direction is seriously clean.",
                likes: 24,
                liked: false,
                replies: [
                    {
                        id: "c1-r1",
                        initials: "NS",
                        username: "nova.signal",
                        text: "Appreciate it. More signal, less noise.",
                        likes: 7,
                        liked: false
                    }
                ]
            },
            {
                id: "c2",
                initials: "CY",
                username: "cypher.yard",
                text: "The Helix aesthetic goes hard.",
                likes: 13,
                liked: false,
                replies: []
            },
            {
                id: "c3",
                initials: "RK",
                username: "rhea.kode",
                text: "Would love to see this as a full creator feed.",
                likes: 9,
                liked: false,
                replies: []
            }
        ],
        "helix-reel-02": [
            {
                id: "c4",
                initials: "NS",
                username: "nova.signal",
                text: "The interface should disappear when the idea takes over.",
                likes: 31,
                liked: false,
                replies: []
            },
            {
                id: "c5",
                initials: "LM",
                username: "lumen.mode",
                text: "That transition idea is great.",
                likes: 12,
                liked: false,
                replies: []
            }
        ],
        "helix-reel-03": [
            {
                id: "c6",
                initials: "AX",
                username: "aether.x",
                text: "Shipping is the best part of the loop.",
                likes: 18,
                liked: false,
                replies: []
            },
            {
                id: "c7",
                initials: "NS",
                username: "nova.signal",
                text: "Prototype first, polish second.",
                likes: 8,
                liked: false,
                replies: []
            }
        ]
    };

    let currentReelId = null;
    let drawer = null;
    let commentsList = null;
    let commentsForm = null;
    let commentsInput = null;
    let commentsTitle = null;
    let commentsCount = null;
    let drawerObserver = null;
    let boundButtons = new WeakSet();

    const getUserInitials = () => {
        const name =
            localStorage.getItem("helixDisplayName") ||
            localStorage.getItem("helixUsername") ||
            "You";

        const parts = name.trim().split(/\\s+/).filter(Boolean);

        if (parts.length > 1) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }

        return name.slice(0, 2).toUpperCase() || "YO";
    };

    const getUserName = () =>
        localStorage.getItem("helixDisplayName") ||
        localStorage.getItem("helixUsername") ||
        "You";

    const escapeHTML = (value) => {
        const el = document.createElement("div");
        el.textContent = String(value == null ? "" : value);
        return el.innerHTML;
    };

    const ensureComments = (reelId) => {
        if (!COMMENT_DATA[reelId]) {
            COMMENT_DATA[reelId] = [];
        }
        return COMMENT_DATA[reelId];
    };

    const findComment = (reelId, commentId) => {
        const comments = ensureComments(reelId);

        for (const comment of comments) {
            if (comment.id === commentId) {
                return { comment, parent: null };
            }

            const replies = Array.isArray(comment.replies)
                ? comment.replies
                : [];

            const reply = replies.find((item) => item.id === commentId);

            if (reply) {
                return { comment: reply, parent: comment };
            }
        }

        return null;
    };

    const totalCommentCount = (reelId) => {
        return ensureComments(reelId).reduce((total, comment) => {
            return total + 1 + (Array.isArray(comment.replies)
                ? comment.replies.length
                : 0);
        }, 0);
    };

    const commentMarkup = (comment, isReply) => {
        const replies = Array.isArray(comment.replies)
            ? comment.replies
            : [];

        const replySection = !isReply && replies.length
            ? '<div class="reels-comment-replies" data-replies-for="' +
              escapeHTML(comment.id) + '">' +
              replies.map((reply) => commentMarkup(reply, true)).join("") +
              "</div>"
            : "";

        const replyActions = !isReply
            ? '<button class="reels-comment-reply" type="button" data-comment-reply="' +
              escapeHTML(comment.id) + '">Reply</button>' +
              (replies.length
                ? '<button class="reels-comment-view-replies" type="button" data-comment-toggle-replies="' +
                  escapeHTML(comment.id) + '">' +
                  replies.length + " " +
                  (replies.length === 1 ? "reply" : "replies") +
                  "</button>"
                : "")
            : "";

        const replyForm = !isReply
            ? '<form class="reels-reply-form" data-reply-form="' +
              escapeHTML(comment.id) + '" hidden>' +
              '<input class="reels-reply-input" type="text" maxlength="280" placeholder="Write a reply..." autocomplete="off">' +
              '<button type="submit">Send</button>' +
              "</form>"
            : "";

        return '<article class="reels-comment-item' +
            (isReply ? " is-reply" : "") +
            '" data-comment-id="' + escapeHTML(comment.id) + '">' +
            '<div class="reels-comment-avatar" aria-hidden="true">' +
            escapeHTML(comment.initials || "?") +
            "</div>" +
            '<div class="reels-comment-body">' +
            '<div class="reels-comment-topline"><strong>' +
            escapeHTML(comment.username) +
            "</strong></div>" +
            "<p>" + escapeHTML(comment.text) + "</p>" +
            '<div class="reels-comment-actions">' +
            '<button class="reels-comment-like' +
            (comment.liked ? " liked" : "") +
            '" type="button" data-comment-like="' +
            escapeHTML(comment.id) +
            '" aria-label="' +
            (comment.liked ? "Unlike comment" : "Like comment") +
            '" aria-pressed="' + String(Boolean(comment.liked)) + '">' +
            "<span aria-hidden=\"true\">" +
            (comment.liked ? "♥" : "♡") +
            "</span><span>" + comment.likes + "</span></button>" +
            replyActions +
            "</div>" +
            replySection +
            replyForm +
            "</div></article>";
    };

    const renderComments = () => {
        if (!commentsList || !currentReelId) return;

        const comments = ensureComments(currentReelId);

        commentsList.innerHTML = comments.length
            ? comments.map((comment) => commentMarkup(comment, false)).join("")
            : '<div class="reels-comments-empty">' +
              '<span aria-hidden="true">◌</span>' +
              "<strong>No comments yet</strong>" +
              "<small>Start the conversation.</small>" +
              "</div>";

        if (commentsCount) {
            commentsCount.textContent = String(
                totalCommentCount(currentReelId)
            );
        }
    };

    const ensureDrawer = () => {
        if (drawer) return true;

        const reelsView = document.getElementById("reels-view");
        if (!reelsView) return false;

        reelsView.insertAdjacentHTML(
            "beforeend",
            '<aside class="reels-comments-drawer" id="reels-comments-drawer" aria-label="Reel comments" aria-hidden="true" hidden>' +
                '<button class="reels-comments-backdrop" type="button" data-comments-close aria-label="Close comments"></button>' +
                '<section class="reels-comments-panel" role="dialog" aria-modal="true" aria-labelledby="reels-comments-title">' +
                    '<header class="reels-comments-header">' +
                        "<div>" +
                            '<span class="reels-comments-kicker">HELIX / COMMUNITY</span>' +
                            '<h2 id="reels-comments-title">Comments</h2>' +
                            '<span class="reels-comments-count"><span id="reels-comments-count">0</span> comments</span>' +
                        "</div>" +
                        '<button class="reels-comments-close" type="button" data-comments-close aria-label="Close comments">×</button>' +
                    "</header>" +
                    '<div class="reels-comments-list" id="reels-comments-list" aria-live="polite"></div>' +
                    '<form class="reels-comment-composer" id="reels-comment-form">' +
                        '<div class="reels-comment-composer-avatar" aria-hidden="true">' +
                            escapeHTML(getUserInitials()) +
                        "</div>" +
                        '<input id="reels-comment-input" type="text" maxlength="280" placeholder="Add a comment..." autocomplete="off" aria-label="Add a comment">' +
                        '<button type="submit" aria-label="Post comment"><span aria-hidden="true">↑</span></button>' +
                    "</form>" +
                "</section>" +
            "</aside>"
        );

        drawer = document.getElementById("reels-comments-drawer");
        commentsList = document.getElementById("reels-comments-list");
        commentsForm = document.getElementById("reels-comment-form");
        commentsInput = document.getElementById("reels-comment-input");
        commentsTitle = document.getElementById("reels-comments-title");
        commentsCount = document.getElementById("reels-comments-count");

        if (!drawer || !commentsList || !commentsForm || !commentsInput) {
            return false;
        }

        drawer.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target.closest("[data-comments-close]")) {
                closeDrawer();
                return;
            }

            const likeButton = target.closest("[data-comment-like]");
            if (likeButton) {
                toggleCommentLike(likeButton.getAttribute("data-comment-like"));
                return;
            }

            const replyButton = target.closest("[data-comment-reply]");
            if (replyButton) {
                openReplyForm(replyButton.getAttribute("data-comment-reply"));
                return;
            }

            const repliesButton =
                target.closest("[data-comment-toggle-replies]");

            if (repliesButton) {
                const id =
                    repliesButton.getAttribute("data-comment-toggle-replies");
                const replies =
                    drawer.querySelectorAll("[data-replies-for]");

                let targetReplies = null;

                replies.forEach((node) => {
                    if (node.getAttribute("data-replies-for") === id) {
                        targetReplies = node;
                    }
                });

                if (targetReplies) {
                    targetReplies.classList.toggle("is-collapsed");

                    const match = findComment(currentReelId, id);
                    const count = match && Array.isArray(match.comment.replies)
                        ? match.comment.replies.length
                        : 0;

                    repliesButton.textContent =
                        targetReplies.classList.contains("is-collapsed")
                            ? count + " " + (count === 1 ? "reply" : "replies")
                            : "Hide replies";
                }
            }
        });

        commentsList.addEventListener("submit", (event) => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement)) return;

            const commentId = form.getAttribute("data-reply-form");
            if (!commentId) return;

            event.preventDefault();

            const input = form.querySelector(".reels-reply-input");
            const text = input ? input.value.trim() : "";

            if (!text) return;

            addReply(commentId, text);
        });

        commentsForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const text = commentsInput.value.trim();
            if (!text || !currentReelId) return;

            addComment(text);
            commentsInput.value = "";
            commentsInput.focus();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && drawer && !drawer.hidden) {
                closeDrawer();
            }
        });

        return true;
    };

    const openDrawer = (reelId) => {
        if (!ensureDrawer()) return;

        currentReelId = reelId;

        const cards = document.querySelectorAll(
            "#reels-view .reels-stage3-card"
        );

        let reelCard = null;

        cards.forEach((card) => {
            if (card.getAttribute("data-reel-id") === reelId) {
                reelCard = card;
            }
        });

        const creator = reelCard
            ? reelCard.querySelector(
                ".reels-creator .helix-reel-author-info strong"
            )
            : null;

        if (commentsTitle) {
            commentsTitle.textContent =
                "Comments" + (creator ? " on " + creator.textContent : "");
        }

        renderComments();

        drawer.hidden = false;
        drawer.setAttribute("aria-hidden", "false");

        requestAnimationFrame(() => {
            drawer.classList.add("is-open");
        });

        window.setTimeout(() => {
            if (commentsInput) commentsInput.focus();
        }, 180);
    };

    const closeDrawer = () => {
        if (!drawer) return;

        drawer.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");

        window.setTimeout(() => {
            if (drawer && !drawer.classList.contains("is-open")) {
                drawer.hidden = true;
            }
        }, 220);
    };

    const toggleCommentLike = (commentId) => {
        if (!currentReelId) return;

        const match = findComment(currentReelId, commentId);
        if (!match) return;

        match.comment.liked = !match.comment.liked;
        match.comment.likes = Math.max(
            0,
            match.comment.likes + (match.comment.liked ? 1 : -1)
        );

        renderComments();
    };

    const addComment = (text) => {
        ensureComments(currentReelId).unshift({
            id: "comment-" + Date.now(),
            initials: getUserInitials(),
            username: getUserName(),
            text,
            likes: 0,
            liked: false,
            replies: []
        });

        renderComments();
    };

    const addReply = (commentId, text) => {
        const comments = ensureComments(currentReelId);
        const parent = comments.find((comment) => comment.id === commentId);

        if (!parent) return;

        parent.replies = Array.isArray(parent.replies)
            ? parent.replies
            : [];

        parent.replies.push({
            id: "reply-" + Date.now(),
            initials: getUserInitials(),
            username: getUserName(),
            text,
            likes: 0,
            liked: false
        });

        renderComments();

        requestAnimationFrame(() => {
            const replyForms = drawer
                ? drawer.querySelectorAll("[data-replies-for]")
                : [];

            replyForms.forEach((replies) => {
                if (
                    replies.getAttribute("data-replies-for") === commentId
                ) {
                    replies.classList.remove("is-collapsed");
                }
            });
        });
    };

    const openReplyForm = (commentId) => {
        if (!drawer) return;

        drawer.querySelectorAll(".reels-reply-form").forEach((form) => {
            form.hidden = true;
        });

        const forms = drawer.querySelectorAll("[data-reply-form]");
        let targetForm = null;

        forms.forEach((form) => {
            if (form.getAttribute("data-reply-form") === commentId) {
                targetForm = form;
            }
        });

        if (!targetForm) return;

        targetForm.hidden = false;

        const input = targetForm.querySelector(".reels-reply-input");
        if (input) input.focus();
    };

    const bindCommentButtons = () => {
        document
            .querySelectorAll("#reels-view .reels-stage3-card")
            .forEach((card) => {
                const buttons = card.querySelectorAll(
                    ".reels-static-actions .helix-reel-action"
                );

                const button = buttons[1];
                if (!button || boundButtons.has(button)) return;

                boundButtons.add(button);
                button.classList.add("reels-comment-button");

                button.addEventListener("click", (event) => {
                    event.stopPropagation();
                    const reelId = card.getAttribute("data-reel-id");

                    if (reelId) {
                        openDrawer(reelId);
                    }
                });
            });
    };

    const start = () => {
        ensureDrawer();
        bindCommentButtons();

        const feed = document.getElementById("reels-feed");
        if (!feed) return;

        drawerObserver?.disconnect();

        drawerObserver = new MutationObserver(() => {
            bindCommentButtons();
        });

        drawerObserver.observe(feed, {
            childList: true,
            subtree: true
        });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }

    window.HelixReelsComments = {
        open: openDrawer,
        close: closeDrawer
    };
})();
