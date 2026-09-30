(() => {
    const state = window.HelixDMState.state;

    const get = (id) => document.getElementById(id);
    const currentUsername = () =>
        localStorage.getItem("helixLoggedIn") || "";

    const ICONS = {
        messages:
            '<path d="M7 9.5A3.5 3.5 0 0 1 10.5 6h27A3.5 3.5 0 0 1 41 9.5v16A3.5 3.5 0 0 1 37.5 29H22l-8.5 6.5V29h-3A3.5 3.5 0 0 1 7 25.5z"/><path d="M15 15h18M15 21h12"/>',
        back:
            '<path d="m29 9-15 15 15 15"/><path d="M15 24h24"/>',
        search:
            '<circle cx="21" cy="21" r="11"/><path d="m30 30 8 8"/>',
        send:
            '<path d="m6 8 32 16-32 16 6-16z"/><path d="M12 24h18"/>',
        more:
            '<circle cx="12" cy="24" r="1.6" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="1.6" fill="currentColor" stroke="none"/><circle cx="36" cy="24" r="1.6" fill="currentColor" stroke="none"/>',
        moreVertical:
            '<circle cx="24" cy="10" r="1.6" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="1.6" fill="currentColor" stroke="none"/><circle cx="24" cy="38" r="1.6" fill="currentColor" stroke="none"/>',
        edit:
            '<path d="M9 35.5V39h3.5L34 20.5l-7-7z"/><path d="m31 10 7 7"/><path d="M9 39h30"/>',
        delete:
            '<path d="M10 13h28M19 13V9h10v4M16 13l2 25h12l2-25M21 19v13M27 19v13"/>',
        copy:
            '<rect x="10" y="10" width="23" height="26" rx="3"/><path d="M17 10V7h17a4 4 0 0 1 4 4v22h-5"/>',
        reaction:
            '<path d="M10 12h28v20H22l-7 6v-6h-5z"/><path d="M18 22h.01M24 22h.01M30 22h.01"/>',
        emoji:
            '<circle cx="24" cy="24" r="15"/><path d="M18 21h.01M30 21h.01M17 28c4 4 10 4 14 0"/>',
        pin:
            '<path d="m18 8 12 12"/><path d="m28 10 7 7-5 5 3 8-4 4-8-3-5 5-7-7 5-5-3-8 4-4 8 3z"/><path d="m24 28-9 9"/>',
        pinnedMessage:
            '<path d="M9 12.5A4.5 4.5 0 0 1 13.5 8h21A4.5 4.5 0 0 1 39 12.5v12A4.5 4.5 0 0 1 34.5 29H24l-6 5v-5h-4.5A4.5 4.5 0 0 1 9 24.5z"/><path d="M24 14.5v7"/><path d="M20.8 17.5h6.4"/>',
        unpin:
            '<path d="M16 7.5 32 23.5"/><path d="m29 9 4.5 4.5-4 4 2.5 6.5-3.5 3.5-6.5-2.5-4 4-4.5-4.5 4-4-2.5-6.5 3.5-3.5 6.5 2.5z"/><path d="m24 28-7.5 7.5"/>',
        privateNickname:
            '<path d="M10 13.5 23.5 6l14.5 8-14.5 8z"/><path d="M10 13.5v12L23.5 33l13.5-7.5v-12"/><path d="M19 18.5h9"/><path d="M19 22.5h6"/>',
        forward:
            '<path d="M31 10 41 20 31 30"/><path d="M41 20H19a10 10 0 0 0-10 10v8"/>',
        reply:
            '<path d="m18 10-10 10 10 10"/><path d="M9 20h17a12 12 0 0 1 12 12v4"/>',
        close:
            '<path d="m13 13 22 22M35 13 13 35"/>',
        retry:
            '<path d="M11 20a14 14 0 1 1 4 13"/><path d="M11 10v10h10"/>',
        warning:
            '<path d="m24 7 16 29H8z"/><path d="M24 17v10M24 31h.01"/>',
        refresh:
            '<path d="M10 20a14 14 0 0 1 24-7l3 3"/><path d="M37 9v8h-8"/><path d="M38 28a14 14 0 0 1-24 7l-3-3"/><path d="M11 39v-8h8"/>',
        check:
            '<path d="m10 24 9 9 19-20"/>',
        checkDouble:
            '<path d="m7 24 8 8 17-18"/><path d="m18 25 5 5 18-19"/>',
        attachment:
            '<path d="M17 32 29.5 19.5a5 5 0 0 1 7 7L23 40a8 8 0 1 1-11.3-11.3l12.7-12.7a5.5 5.5 0 0 1 7.8 7.8l-11.6 11.6a3 3 0 0 1-4.3-4.2L26 22"/>',
        info:
            '<circle cx="24" cy="24" r="16"/><path d="M24 21v11M24 15h.01"/>',
        image:
            '<rect x="7" y="9" width="34" height="30" rx="4"/><circle cx="18" cy="19" r="3"/><path d="m11 34 9-9 6 6 4-4 7 7"/>',
        video:
            '<rect x="7" y="11" width="26" height="26" rx="4"/><path d="m33 19 8-5v20l-8-5z"/>',
        file:
            '<path d="M14 6h14l7 7v29H14z"/><path d="M28 6v8h7"/>'
    };

    function make(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function makeIcon(name, label) {
        const svg = document.createElement("svg");
        svg.className = "dm-icon";
        svg.setAttribute("viewBox", "0 0 48 48");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.4");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");

        if (label) {
            svg.setAttribute("role", "img");
            svg.setAttribute("focusable", "false");
        }

        svg.innerHTML = ICONS[name] || "";
        return svg;
    }

    function iconButton(className, icon, title) {
        const button = make("button", className);
        button.type = "button";
        button.appendChild(makeIcon(icon, title));

        if (title) {
            button.title = title;
            button.setAttribute("aria-label", title);
        }

        return button;
    }

    function textButton(className, text, title) {
        const button = make("button", className, text);
        button.type = "button";

        if (title) {
            button.title = title;
            button.setAttribute("aria-label", title);
        }

        return button;
    }

    function initials(value) {
        return String(value || "U")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0] || "")
            .join("")
            .toUpperCase() || "U";
    }

    function formatTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";

        return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function formatDay(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";

        const options = {
            month: "short",
            day: "numeric"
        };

        if (date.getFullYear() !== new Date().getFullYear()) {
            options.year = "numeric";
        }

        return date.toLocaleDateString([], options);
    }

    function formatFileSize(bytes) {
        const value = Number(bytes || 0);

        if (!value) return "0 B";
        if (value < 1024) return value + " B";
        if (value < 1024 * 1024) {
            return (value / 1024).toFixed(1) + " KB";
        }

        return (value / (1024 * 1024)).toFixed(1) + " MB";
    }

    function previewText(message, max = 80) {
        if (!message) return "";

        let value = "";

        if (message.text) {
            value = String(message.text)
                .replace(/\s+/g, " ")
                .trim();
        } else if (message.mediaKind === "video") {
            value = "Video";
        } else if (message.mediaKind === "image") {
            value = "Photo";
        } else if (message.isDeleted) {
            value = "Message deleted";
        }

        if (value.length > max) {
            return value.slice(0, max - 1) + "…";
        }

        return value;
    }

    function setAvatar(element, user) {
        if (!element) return;

        element.replaceChildren();
        element.classList.toggle(
            "has-profile-photo",
            Boolean(user?.profilePhoto)
        );

        if (user?.profilePhoto) {
            const image = document.createElement("img");
            image.src = user.profilePhoto;
            image.alt = "";
            image.loading = "lazy";
            image.referrerPolicy = "no-referrer";
            element.appendChild(image);
            return;
        }

        element.textContent = initials(
            user?.nickname ||
            user?.displayName ||
            user?.username
        );
    }

    function activeConversation() {
        return state.conversations.find(
            (item) => item.username === state.activeConversation
        ) || null;
    }

    function findMessage(messageId) {
        return state.messages.find(
            (item) => String(item.id) === String(messageId)
        ) || null;
    }

    function renderSearchStatus() {
        const element = get("dm-message-search-count");
        if (!element) return;

        const query = state.messageSearch.trim().toLowerCase();

        if (!query) {
            element.textContent = "";
            return;
        }

        const count = state.messages.filter((message) => {
            const textMatch = String(message.text || "")
                .toLowerCase()
                .includes(query);

            const mediaMatch = String(message.mediaName || "")
                .toLowerCase()
                .includes(query);

            return textMatch || mediaMatch;
        }).length;

        element.textContent =
            count + "/" + state.messages.length;
    }

    function renderConversationList() {
        const legacyCount = get("dm-legacy-count");
        const legacyFriendsCount = get("dm-legacy-friends-count");
        const list = get("dm-conversation-list");
        const status = get("dm-conversation-status");

        if (!list) return;

        list.replaceChildren();

        if (status) {
            if (state.loadingConversations) {
                status.textContent = "SYNCING";
            } else if (state.conversationError) {
                status.textContent = "ERROR";
            } else {
                status.textContent =
                    state.conversations.length +
                    " " +
                    (state.conversations.length === 1
                        ? "connection"
                        : "connections");
            }
        }

        if (legacyCount) {
            const unreadTotal = state.conversations.reduce(
                (sum, conversation) =>
                    sum + Number(conversation.unreadCount || 0),
                0
            );
            legacyCount.textContent = String(unreadTotal);
        }

        if (legacyFriendsCount) {
            legacyFriendsCount.textContent = String(
                state.conversations.length
            );
        }

        if (state.loadingConversations) {
            const wrap = make("div", "dm-list-skeletons");
            wrap.setAttribute("aria-label", "Loading conversations");

            for (let i = 0; i < 4; i += 1) {
                const row = make("div", "dm-conversation-skeleton");
                row.append(
                    make("span", "dm-skeleton-avatar"),
                    make("span", "dm-skeleton-copy")
                );
                wrap.appendChild(row);
            }

            list.appendChild(wrap);
            return;
        }

        if (state.conversationError) {
            const box = make(
                "div",
                "dm-list-state dm-list-state-error"
            );

            const mark = make(
                "span",
                "dm-list-state-mark"
            );
            mark.appendChild(makeIcon("warning"));

            box.append(
                mark,
                make("strong", "", "Messages are unavailable"),
                make("small", "", state.conversationError)
            );

            const retry = iconButton(
                "dm-inline-button dm-icon-button-with-label",
                "retry",
                "Retry conversation loading"
            );
            retry.dataset.dmAction = "refresh-conversations";
            retry.appendChild(make("span", "", "Retry"));

            box.appendChild(retry);
            list.appendChild(box);
            return;
        }

        if (!state.conversations.length) {
            const box = make("div", "dm-list-state");
            const mark = make("span", "dm-list-state-mark");
            mark.appendChild(makeIcon("messages"));

            box.append(
                mark,
                make("strong", "", "No conversations yet"),
                make(
                    "small",
                    "",
                    "Start a new conversation with someone from your Friends list."
                )
            );

            list.appendChild(box);
            return;
        }

        const query =
            state.conversationSearch.trim().toLowerCase();
        const filter =
            state.conversationFilter || "all";

        list.querySelectorAll(".dm-inbox-tab").forEach((button) => {
            const active =
                button.dataset.dmConversationFilter === filter;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        let filteredConversations = state.conversations;

        if (filter === "unread") {
            filteredConversations = state.conversations.filter(
                (conversation) => Number(conversation.unreadCount || 0) > 0
            );
        } else if (filter === "requests") {
            // Helix currently only permits DMs between accepted friends,
            // so there is no separate DM-request queue to populate.
            filteredConversations = [];
        }

        const visible = filteredConversations.filter(
            (conversation) => {
                if (!query) return true;

                return [
                    conversation.username,
                    conversation.displayName,
                    conversation.nickname,
                    conversation.latestMessage?.text,
                    conversation.latestMessage?.mediaKind
                ].some((value) =>
                    String(value || "")
                        .toLowerCase()
                        .includes(query)
                );
            }
        );

        if (!visible.length) {
            const box = make("div", "dm-list-state");
            const mark = make("span", "dm-list-state-mark");
            mark.appendChild(
                makeIcon(
                    filter === "requests"
                        ? "messages"
                        : "search"
                )
            );

            const emptyTitle =
                filter === "requests"
                    ? "No message requests"
                    : filter === "unread"
                        ? "No unread messages"
                        : state.conversationSearch.trim()
                            ? "No matching conversations"
                            : "No conversations yet";

            const emptyDescription =
                filter === "requests"
                    ? "Helix DMs are currently limited to friends, so message requests are not used."
                    : filter === "unread"
                        ? "Unread conversations will appear here."
                        : state.conversationSearch.trim()
                            ? "Try another display name or username."
                            : "Add a friend in Friends to start a conversation.";

            box.append(
                mark,
                make("strong", "", emptyTitle),
                make("small", "", emptyDescription)
            );

            list.appendChild(box);
            return;
        }

        visible.forEach((conversation) => {
            const row = make(
                "button",
                "dm-conversation" +
                    (conversation.username === state.activeConversation
                        ? " is-active"
                        : "") +
                    (Number(conversation.unreadCount || 0) > 0
                        ? " has-unread"
                        : "")
            );

            row.type = "button";
            row.dataset.username = conversation.username;
            row.title =
                "Open " +
                (conversation.nickname ||
                    conversation.displayName ||
                    conversation.username);
            row.setAttribute(
                "aria-label",
                row.title
            );

            const avatar = make(
                "span",
                "dm-conversation-avatar"
            );
            setAvatar(avatar, conversation);

            const copy = make(
                "span",
                "dm-conversation-copy"
            );

            copy.append(
                make(
                    "strong",
                    "",
                    conversation.nickname ||
                        conversation.displayName ||
                        conversation.username
                )
            );

            const latest = conversation.latestMessage;
            const latestValue = latest
                ? previewText(latest)
                : "Start a conversation";

            const preview = make(
                "span",
                "dm-conversation-preview"
            );

            if (latest?.mediaKind) {
                const mediaIcon = make(
                    "span",
                    "dm-conversation-preview-icon"
                );
                mediaIcon.appendChild(
                    makeIcon(
                        latest.mediaKind === "video"
                            ? "video"
                            : "image"
                    )
                );
                preview.append(
                    mediaIcon,
                    make("span", "", latestValue)
                );
            } else {
                preview.textContent = latestValue;
            }

            copy.appendChild(preview);

            const meta = make(
                "span",
                "dm-conversation-meta"
            );

            const usernameLabel = make(
                "span",
                "dm-conversation-username",
                "-" + conversation.username
            );
            meta.appendChild(usernameLabel);

            if (Number(conversation.unreadCount || 0) > 0) {
                const unread = make(
                    "span",
                    "dm-unread-badge",
                    conversation.unreadCount > 99
                        ? "99+"
                        : String(conversation.unreadCount)
                );
                meta.appendChild(unread);
            }

            row.append(avatar, copy, meta);
            list.appendChild(row);
        });
    }

    function renderHeader() {
        const title = get("dm-chat-title");
        const username = get("dm-chat-username");
        const avatar = get("dm-chat-avatar");
        const infoButton = get("dm-info-button");
        const nicknameButton = get("dm-nickname-button");
        const pinsButton = get("dm-pins-button");
        const friendStatus = get("dm-chat-friend-status");

        if (!state.activeConversation) {
            if (title) title.textContent = "Your messages";
            if (username) {
                username.textContent =
                    "Select a conversation to start messaging.";
            }
            if (avatar) {
                avatar.replaceChildren();
                avatar.classList.remove("has-profile-photo");
                avatar.textContent = "DM";
            }
            if (infoButton) infoButton.disabled = true;
            if (nicknameButton) nicknameButton.disabled = true;
            if (pinsButton) pinsButton.disabled = true;
            if (friendStatus) friendStatus.hidden = true;
            return;
        }

        const conversation = activeConversation();

        if (!conversation) return;

        if (title) {
            title.textContent =
                conversation.nickname ||
                conversation.displayName ||
                conversation.username;
        }

        if (username) {
            username.textContent =
                "-" + conversation.username;
        }

        if (friendStatus) {
            friendStatus.hidden = false;
        }

        if (avatar) {
            setAvatar(avatar, conversation);
        }

        if (infoButton) infoButton.disabled = false;
        if (nicknameButton) nicknameButton.disabled = false;
        if (pinsButton) pinsButton.disabled = false;
    }

    function renderMessageStatus() {
        const element = get("dm-message-status");
        if (!element) return;

        if (!state.activeConversation) {
            element.textContent = "";
            return;
        }

        if (state.loadingMessages) {
            element.textContent = "SYNCING";
            return;
        }

        if (state.messageError) {
            element.textContent = "ERROR";
            return;
        }

        element.textContent =
            state.messages.length +
            " " +
            (state.messages.length === 1
                ? "message"
                : "messages");
    }

    function renderReactionStrip(message) {
        const reactions = Array.isArray(message.reactions)
            ? message.reactions
            : [];

        if (!reactions.length) return null;

        const strip = make(
            "div",
            "dm-reaction-strip"
        );

        reactions.forEach((reaction) => {
            const pill = textButton(
                "dm-reaction-pill" +
                    (reaction.reacted ? " is-reacted" : ""),
                String(reaction.emoji || ""),
                reaction.reacted
                    ? "Remove your reaction"
                    : "React with " + reaction.emoji
            );

            pill.dataset.dmReaction =
                reaction.emoji;
            pill.dataset.messageId =
                message.id;

            strip.appendChild(pill);
        });

        return strip;
    }

    function renderReplyReference(message) {
        if (!message?.replyToId) return null;

        const reference = make(
            "button",
            "dm-reply-reference"
        );
        reference.type = "button";
        reference.dataset.replyMessageId =
            String(message.replyToId);
        reference.title =
            "Jump to original message";
        reference.setAttribute(
            "aria-label",
            "Jump to original message"
        );

        const bar = make(
            "span",
            "dm-reply-reference-bar"
        );

        const copy = make(
            "span",
            "dm-reply-reference-copy"
        );

        copy.appendChild(
            make(
                "strong",
                "",
                "@" +
                    String(
                        message.replySender ||
                        "user"
                    )
            )
        );

        const content = make(
            "span",
            "dm-reply-reference-content"
        );

        if (message.replyDeleted) {
            content.appendChild(
                make(
                    "span",
                    "dm-reply-reference-text is-deleted",
                    "Original message deleted"
                )
            );
        } else if (message.replyMediaKind) {
            const thumb = make(
                "span",
                "dm-reply-reference-thumb"
            );

            if (message.replyMediaKind === "video") {
                const video =
                    document.createElement("video");
                video.src =
                    message.replyMediaUrl || "";
                video.muted = true;
                video.playsInline = true;
                video.preload = "metadata";
                video.setAttribute(
                    "aria-hidden",
                    "true"
                );
                thumb.appendChild(video);
            } else if (message.replyMediaUrl) {
                const image =
                    document.createElement("img");
                image.src =
                    message.replyMediaUrl;
                image.alt = "";
                image.loading = "lazy";
                thumb.appendChild(image);
            } else {
                thumb.appendChild(
                    makeIcon("image")
                );
            }

            const label =
                message.replyText ||
                (
                    message.replyMediaKind === "video"
                        ? "Video"
                        : "Photo"
                );

            content.append(
                thumb,
                make(
                    "span",
                    "dm-reply-reference-text",
                    label
                )
            );
        } else {
            content.appendChild(
                make(
                    "span",
                    "dm-reply-reference-text",
                    message.replyText ||
                        message.replyMediaName ||
                        "Original message"
                )
            );
        }

        copy.appendChild(content);
        reference.append(bar, copy);

        return reference;
    }

    function renderMedia(message) {
        if (!message.mediaUrl || message.isDeleted) {
            return null;
        }

        const wrapper = make(
            "div",
            "dm-message-media"
        );

        if (message.mediaKind === "video") {
            const video = document.createElement("video");
            video.className =
                "dm-message-video";
            video.src = message.mediaUrl;
            video.controls = true;
            video.preload = "metadata";
            video.playsInline = true;
            video.setAttribute(
                "aria-label",
                message.mediaName ||
                    "Shared video"
            );

            wrapper.appendChild(video);
        } else {
            const button = make(
                "button",
                "dm-message-image-button"
            );
            button.type = "button";
            button.dataset.dmAction =
                "open-media";
            button.dataset.messageId =
                message.id;
            button.title =
                "Open photo";

            const image =
                document.createElement("img");

            image.className =
                "dm-message-image";
            image.src = message.mediaUrl;
            image.alt =
                message.mediaName ||
                "Shared photo";
            image.loading = "lazy";

            button.appendChild(image);
            wrapper.appendChild(button);
        }

        if (message.mediaName) {
            const meta = make(
                "div",
                "dm-message-media-meta"
            );

            const icon = make("span", "");
            icon.appendChild(
                makeIcon(
                    message.mediaKind ===
                        "video"
                        ? "video"
                        : "image"
                )
            );

            meta.append(
                icon,
                make(
                    "span",
                    "",
                    message.mediaName
                ),
                make(
                    "small",
                    "",
                    formatFileSize(
                        message.mediaSize
                    )
                )
            );

            wrapper.appendChild(meta);
        }

        return wrapper;
    }

    function renderMessageActions(message) {
        const actions = make("div", "dm-message-actions");

        if (message.isDeleted) {
            return actions;
        }

        const reply = iconButton(
            "dm-message-tool",
            "reply",
            "Reply"
        );
        reply.dataset.dmAction = "reply";
        reply.dataset.messageId = message.id;
        actions.appendChild(reply);

        ["❤️", "😂", "😮", "😢", "😡", "👍"].forEach((emoji) => {
            const existing = (message.reactions || []).find(
                (reaction) => reaction.emoji === emoji
            );

            const reaction = textButton(
                "dm-message-tool dm-message-quick-reaction" +
                (existing?.reacted ? " is-reacted" : ""),
                emoji,
                existing?.reacted
                    ? "Remove your reaction"
                    : "React with " + emoji
            );

            reaction.dataset.dmQuickReaction = emoji;
            reaction.dataset.messageId = message.id;
            actions.appendChild(reaction);
        });

        const emoji = iconButton(
            "dm-message-tool",
            "emoji",
            "Open full emoji picker"
        );
        emoji.dataset.dmEmojiPicker = "open";
        emoji.dataset.messageId = message.id;
        actions.appendChild(emoji);

        const more = iconButton(
            "dm-message-tool",
            "moreVertical",
            "More message actions"
        );
        more.dataset.dmAction = "context-menu";
        more.dataset.messageId = message.id;
        actions.appendChild(more);

        return actions;
    }

    function renderMessage(message) {
        const sent = message.sender === currentUsername();

        const row = make(
            "article",
            "dm-message-row " +
            (sent ? "is-sent" : "is-received") +
            (message.isDeleted ? " is-deleted" : "")
        );

        row.dataset.messageId = String(message.id);

        const bubble = make("div", "dm-message-bubble");

        const trimmedText = String(message.text || "").trim();
        const singleEmoji =
            !message.isDeleted &&
            !message.mediaKind &&
            Boolean(trimmedText) &&
            window.HELIX_ALL_EMOJI_SET instanceof Set &&
            window.HELIX_ALL_EMOJI_SET.has(trimmedText);

        if (singleEmoji) {
            bubble.classList.add("dm-emoji-only");
        }

        const reference = renderReplyReference(message);
        if (reference) {
            bubble.appendChild(reference);
        }

        if (state.editingMessageId === String(message.id)) {
            const editor = document.createElement("textarea");
            editor.className = "dm-inline-editor";
            editor.dataset.editMessageId = String(message.id);
            editor.value = message.text || "";
            editor.maxLength = 4000;
            editor.rows = Math.max(
                2,
                Math.min(
                    6,
                    Math.ceil(String(message.text || "").length / 55)
                )
            );

            const controls = make("div", "dm-inline-editor-actions");

            const cancel = iconButton(
                "dm-inline-editor-button",
                "close",
                "Cancel editing"
            );
            cancel.dataset.dmEditAction = "cancel";
            cancel.dataset.messageId = String(message.id);

            const save = textButton(
                "dm-inline-editor-button is-primary",
                "Save",
                "Save edited message"
            );
            save.dataset.dmEditAction = "save";
            save.dataset.messageId = String(message.id);

            controls.append(cancel, save);
            bubble.append(editor, controls);
        } else if (message.isDeleted) {
            const deleted = make("div", "dm-deleted-message");
            const icon = make("span", "dm-deleted-icon");
            icon.appendChild(makeIcon("delete"));
            deleted.append(
                icon,
                make("span", "", "Message deleted")
            );
            bubble.appendChild(deleted);
        } else {
            const media = renderMedia(message);
            if (media) bubble.appendChild(media);

            if (message.text) {
                bubble.appendChild(
                    make("p", "dm-message-text", message.text)
                );
            }
        }

        if (state.editingMessageId !== String(message.id)) {
            bubble.appendChild(renderMessageActions(message));
        }

        row.appendChild(bubble);

        const meta = make("div", "dm-message-meta");
        meta.appendChild(
            make("time", "", formatTime(message.createdAt))
        );

        if (message.editedAt) {
            meta.appendChild(
                make("span", "dm-edited-label", "Edited")
            );
        }

        if (sent) {
            const status = make("span", "dm-message-status");
            const readable = message.readAt ? "Read" : "Sent";
            status.title = "Message status: " + readable;
            status.setAttribute("aria-label", readable);
            status.appendChild(
                makeIcon(message.readAt ? "checkDouble" : "check")
            );
            meta.appendChild(status);
        }

        if (message.isPinned) {
            const pin = make("span", "dm-pinned-label");
            pin.appendChild(makeIcon("pin"));
            pin.appendChild(make("span", "", "Pinned"));
            meta.appendChild(pin);
        }

        row.appendChild(meta);

        const reactions = renderReactionStrip(message);
        if (reactions) {
            row.appendChild(reactions);
        }

        return row;
    }

    function visibleMessages() {
        const query =
            state.messageSearch.trim().toLowerCase();

        if (!query) {
            return state.messages;
        }

        return state.messages.filter(
            (message) =>
                String(
                    message.text || ""
                )
                    .toLowerCase()
                    .includes(query) ||
                String(
                    message.mediaName || ""
                )
                    .toLowerCase()
                    .includes(query)
        );
    }

    function renderMessages() {
        const list = get(
            "dm-message-list"
        );

        if (!list) return;

        const wasNearBottom =
            list.scrollHeight -
                list.scrollTop -
                list.clientHeight <
            90;

        list.replaceChildren();
        renderSearchStatus();

        if (!state.activeConversation) {
            const box = make(
                "div",
                "dm-chat-state"
            );
            const mark = make(
                "span",
                "dm-chat-state-mark"
            );
            mark.appendChild(
                makeIcon("messages")
            );

            box.append(
                mark,
                make(
                    "strong",
                    "",
                    "Select a friend"
                ),
                make(
                    "p",
                    "",
                    "Send private messages, photos, reactions and more from one place."
                )
            );

            list.appendChild(box);
            return;
        }

        if (state.loadingMessages) {
            const wrap = make(
                "div",
                "dm-message-skeletons"
            );
            wrap.setAttribute(
                "role",
                "status"
            );
            wrap.setAttribute(
                "aria-label",
                "Loading messages"
            );

            for (let i = 0; i < 5; i += 1) {
                const row = make(
                    "div",
                    "dm-message-skeleton " +
                        (i % 2
                            ? "is-left"
                            : "is-right")
                );

                row.appendChild(
                    make(
                        "span",
                        "dm-skeleton-bubble"
                    )
                );

                wrap.appendChild(row);
            }

            list.appendChild(wrap);
            return;
        }

        if (state.messageError) {
            const box = make(
                "div",
                "dm-chat-state dm-chat-state-error"
            );

            const mark = make(
                "span",
                "dm-chat-state-mark"
            );
            mark.appendChild(
                makeIcon("warning")
            );

            box.append(
                mark,
                make(
                    "strong",
                    "",
                    "Conversation unavailable"
                ),
                make(
                    "p",
                    "",
                    state.messageError
                )
            );

            const retry = iconButton(
                "dm-inline-button dm-icon-button-with-label",
                "retry",
                "Retry loading messages"
            );

            retry.dataset.dmAction =
                "retry-conversation";
            retry.appendChild(
                make("span", "", "Retry")
            );

            box.appendChild(retry);
            list.appendChild(box);
            return;
        }

        const messages = visibleMessages();

        if (!state.messages.length) {
            const box = make(
                "div",
                "dm-chat-state"
            );
            const mark = make(
                "span",
                "dm-chat-state-mark"
            );
            mark.appendChild(
                makeIcon("messages")
            );

            box.append(
                mark,
                make(
                    "strong",
                    "",
                    "No messages yet"
                ),
                make(
                    "p",
                    "",
                    "Send a message to start the conversation."
                )
            );

            list.appendChild(box);
            return;
        }

        if (!messages.length) {
            const box = make(
                "div",
                "dm-chat-state"
            );
            const mark = make(
                "span",
                "dm-chat-state-mark"
            );
            mark.appendChild(
                makeIcon("search")
            );

            box.append(
                mark,
                make(
                    "strong",
                    "",
                    "No matching messages"
                ),
                make(
                    "p",
                    "",
                    "Try another search term."
                )
            );

            list.appendChild(box);
            return;
        }

        let previousDay = "";

        messages.forEach((message) => {
            const currentDay =
                formatDay(message.createdAt);

            if (
                currentDay &&
                currentDay !== previousDay
            ) {
                list.appendChild(
                    make(
                        "div",
                        "dm-date-separator",
                        currentDay
                    )
                );
                previousDay = currentDay;
            }

            list.appendChild(
                renderMessage(message)
            );
        });

        if (wasNearBottom) {
            list.scrollTop = list.scrollHeight;
        }
    }

    function scrollToBottom(smooth = false) {
        const list = get("dm-message-list");

        if (!list) return false;

        const targetTop = Math.max(
            0,
            list.scrollHeight - list.clientHeight
        );

        try {
            list.scrollTo({
                top: targetTop,
                behavior: smooth ? "smooth" : "auto"
            });
        } catch {
            list.scrollTop = targetTop;
        }

        return true;
    }

    function renderPinnedPanel() {
        const panel = get("dm-pins-panel");
        const list = get("dm-pins-list");

        if (!panel || !list) return;

        list.replaceChildren();

        if (state.loadingPins) {
            const loading = make(
                "div",
                "dm-list-skeletons"
            );

            for (let i = 0; i < 3; i += 1) {
                const row = make(
                    "div",
                    "dm-pin-skeleton"
                );

                row.append(
                    make(
                        "span",
                        "dm-skeleton-line dm-skeleton-line-wide"
                    ),
                    make(
                        "span",
                        "dm-skeleton-line"
                    )
                );

                loading.appendChild(row);
            }

            list.appendChild(loading);
        } else if (!state.pinnedMessages.length) {
            const empty = make(
                "div",
                "dm-panel-state"
            );
            const mark = make(
                "span",
                "dm-list-state-mark"
            );
            mark.appendChild(
                makeIcon("pin")
            );

            empty.append(
                mark,
                make(
                    "strong",
                    "",
                    "No pinned messages"
                ),
                make(
                    "small",
                    "",
                    "Pinned messages in this conversation will appear here."
                )
            );

            list.appendChild(empty);
        } else {
            state.pinnedMessages.forEach(
                (message) => {
                    const row = make(
                        "article",
                        "dm-pinned-item"
                    );
                    row.dataset.messageId =
                        String(message.id);
                    row.dataset.dmAction = "jump-to-message";
                    row.tabIndex = 0;
                    row.setAttribute("role", "button");
                    row.setAttribute(
                        "aria-label",
                        "Jump to pinned message"
                    );

                    const icon =
                        make(
                            "span",
                            "dm-pinned-icon"
                        );
                    icon.appendChild(
                        makeIcon("pinnedMessage")
                    );

                    const copy =
                        make(
                            "div",
                            "dm-pinned-copy"
                        );

                    const previewRow = make(
                        "span",
                        "dm-pinned-text"
                    );
                    if (message.mediaKind) {
                        const mediaIcon = make(
                            "span",
                            "dm-pinned-media-icon"
                        );
                        mediaIcon.appendChild(
                            makeIcon(
                                message.mediaKind === "video"
                                    ? "video"
                                    : "image"
                            )
                        );
                        previewRow.append(
                            mediaIcon,
                            make(
                                "span",
                                "",
                                previewText(message, 120) || "Media"
                            )
                        );
                    } else {
                        previewRow.textContent =
                            previewText(message, 120) || "Message";
                    }

                    copy.append(
                        make(
                            "strong",
                            "",
                            message.sender ===
                                currentUsername()
                                ? "You"
                                : "@" + message.sender
                        ),
                        previewRow,
                        make(
                            "small",
                            "dm-pinned-time",
                            formatTime(
                                message.pinnedAt ||
                                message.createdAt
                            )
                        )
                    );

                    const unpin =
                        iconButton(
                            "dm-pinned-unpin",
                            "unpin",
                            "Unpin message"
                        );
                    unpin.dataset.dmAction =
                        "unpin-message";
                    unpin.dataset.messageId =
                        String(message.id);

                    row.append(
                        icon,
                        copy,
                        unpin
                    );

                    list.appendChild(row);
                }
            );
        }

        panel.hidden =
            !panel.classList.contains(
                "is-open"
            );
    }


    const EMOJI = window.HELIX_ALL_EMOJI || [];
    const EMOJI_CATEGORIES = window.HELIX_EMOJI_CATEGORIES || [
        "Smileys & People",
        "Animals & Nature",
        "Food & Drink",
        "Activities",
        "Travel & Places",
        "Objects",
        "Symbols",
        "Flags"
    ];
    const EMOJI_DATA = window.HELIX_EMOJI_DATA || {};
    const EMOJI_POPULAR = window.HELIX_EMOJI_POPULAR || [];

    const EMOJI_CATEGORY_ICONS = {
        "All": "✨",
        "Popular": "🔥",
        "Smileys & People": "😀",
        "Animals & Nature": "🐻",
        "Food & Drink": "🍔",
        "Activities": "⚽",
        "Travel & Places": "🚗",
        "Objects": "💡",
        "Symbols": "🔣",
        "Flags": "🌐"
    };

    function normalizeEmojiSearch(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    }

    function emojiItemsForCategory(category) {
        if (category === "Popular") {
            const byEmoji = new Map();

            Object.values(EMOJI_DATA).forEach((entries) => {
                if (!Array.isArray(entries)) return;
                entries.forEach((item) => {
                    const emoji = String(item?.[0] || "");
                    if (emoji && !byEmoji.has(emoji)) {
                        byEmoji.set(emoji, item);
                    }
                });
            });

            return EMOJI_POPULAR
                .map((emoji) => byEmoji.get(emoji) || [emoji, "", []])
                .filter((item) => item?.[0]);
        }

        const source = EMOJI_DATA[category];

        if (Array.isArray(source) && source.length) {
            return source;
        }

        return [];
    }

    function emojiSearchText(item, category) {
        const emoji = String(item?.[0] || "");
        const name = String(item?.[1] || "");
        const keywords = Array.isArray(item?.[2]) ? item[2] : [];

        return [emoji, name, ...keywords, category]
            .join(" ")
            .toLowerCase();
    }

    function updateEmojiPickerView() {
        const picker = get("dm-emoji-picker");

        if (!picker) return;

        const query = normalizeEmojiSearch(state.emojiSearch);
        const activeCategory = query
            ? "All"
            : (state.emojiCategory || "Popular");

        let visibleCount = 0;

        picker.querySelectorAll("[data-emoji-section]").forEach((section) => {
            const category = section.dataset.emojiSection || "";
            const categoryAllowed =
                activeCategory === "All"
                    ? category !== "Popular"
                    : category === activeCategory;

            let sectionVisibleCount = 0;

            section.querySelectorAll("[data-emoji]").forEach((option) => {
                const matches =
                    !query ||
                    String(option.dataset.search || "").includes(query);

                const visible =
                    categoryAllowed && matches;

                option.hidden = !visible;

                if (visible) {
                    sectionVisibleCount += 1;
                    visibleCount += 1;
                }
            });

            section.hidden = sectionVisibleCount === 0;
        });

        picker.querySelectorAll("[data-dm-emoji-category]").forEach((button) => {
            const category =
                button.dataset.dmEmojiCategory || "";

            const active =
                category === activeCategory ||
                (category === "All" && Boolean(query));

            button.classList.toggle("is-active", active);
            button.setAttribute(
                "aria-selected",
                active ? "true" : "false"
            );
        });

        const count =
            picker.querySelector("#dm-emoji-result-count");

        if (count) {
            count.textContent = query
                ? String(visibleCount) +
                    " result" +
                    (visibleCount === 1 ? "" : "s")
                : String(visibleCount) + " emoji";
        }

        const empty =
            picker.querySelector(".dm-emoji-empty");

        if (empty) {
            empty.hidden = visibleCount !== 0;
        }
    }

    function setEmojiPickerCategory(category) {
        const next =
            category === "All" ||
            category === "Popular" ||
            EMOJI_CATEGORIES.includes(category)
                ? category
                : "Popular";

        state.emojiCategory = next;
        state.emojiSearch = "";

        const search = get("dm-emoji-search");
        if (search) {
            search.value = "";
        }

        updateEmojiPickerView();

        search?.focus();
    }

    function renderEmojiPicker() {
        const picker = get("dm-emoji-picker");

        if (!picker) return;

        picker.replaceChildren();

        const header = make(
            "div",
            "dm-emoji-picker-header"
        );

        const title = make(
            "div",
            "dm-emoji-picker-title"
        );

        title.append(
            make("strong", "", "Emoji"),
            make("span", "dm-emoji-result-count", "")
        );

        const close = iconButton(
            "dm-panel-close dm-close-control",
            "close",
            "Close emoji picker"
        );
        close.setAttribute("data-close-glyph", "×");

        close.dataset.dmAction =
            "close-emoji-picker";

        header.append(title, close);

        const searchWrap = make(
            "div",
            "dm-emoji-search-wrap"
        );

        const searchIcon = make(
            "span",
            "dm-emoji-search-icon"
        );

        searchIcon.setAttribute(
            "aria-hidden",
            "true"
        );

        searchIcon.appendChild(
            makeIcon("search")
        );

        const search = document.createElement("input");

        search.id = "dm-emoji-search";
        search.type = "search";
        search.placeholder =
            "Search emoji, e.g. heart, laugh, rocket";
        search.autocomplete = "off";
        search.spellcheck = false;
        search.value = state.emojiSearch || "";
        search.setAttribute(
            "aria-label",
            "Search emoji"
        );

        searchWrap.append(
            searchIcon,
            search
        );

        const categories = make(
            "div",
            "dm-emoji-category-tabs"
        );

        categories.setAttribute(
            "role",
            "tablist"
        );

        categories.setAttribute(
            "aria-label",
            "Emoji categories"
        );

        ["All", "Popular", ...EMOJI_CATEGORIES].forEach((category) => {
            const button = make(
                "button",
                "dm-emoji-category-tab"
            );

            button.type = "button";
            button.dataset.dmEmojiCategory =
                category;
            button.setAttribute(
                "role",
                "tab"
            );
            button.setAttribute(
                "aria-selected",
                "false"
            );
            button.setAttribute(
                "aria-label",
                category
            );

            const icon = make(
                "span",
                "dm-emoji-category-icon",
                EMOJI_CATEGORY_ICONS[category] || "•"
            );

            icon.setAttribute(
                "aria-hidden",
                "true"
            );

            const label = make(
                "span",
                "dm-emoji-category-label",
                category
            );

            button.append(
                icon,
                label
            );

            categories.appendChild(button);
        });

        const content = make(
            "div",
            "dm-emoji-picker-content"
        );

        ["Popular", ...EMOJI_CATEGORIES].forEach((category) => {
            const section = make(
                "section",
                "dm-emoji-section"
            );

            section.dataset.emojiSection =
                category;

            const heading = make(
                "div",
                "dm-emoji-section-heading"
            );

            heading.append(
                make(
                    "span",
                    "dm-emoji-section-icon",
                    EMOJI_CATEGORY_ICONS[category] || "•"
                ),
                make(
                    "h4",
                    "",
                    category
                )
            );

            const grid = make(
                "div",
                "dm-emoji-grid"
            );

            emojiItemsForCategory(category).forEach((item) => {
                const emoji =
                    String(item?.[0] || "");

                if (!emoji) return;

                const name =
                    String(item?.[1] || "");

                const option = textButton(
                    "dm-emoji-option",
                    emoji,
                    name
                        ? "Insert " + name
                        : "Insert " + emoji
                );

                option.dataset.emoji = emoji;
                option.dataset.search =
                    emojiSearchText(
                        item,
                        category
                    );

                grid.appendChild(option);
            });

            section.append(
                heading,
                grid
            );

            content.appendChild(section);
        });

        const empty = make(
            "div",
            "dm-emoji-empty",
            "No matching emoji found."
        );

        empty.hidden = true;

        const footer = make(
            "div",
            "dm-emoji-footer",
            "Enter sends • Shift + Enter adds a new line"
        );

        picker.append(
            header,
            searchWrap,
            categories,
            content,
            empty,
            footer
        );

        picker.hidden =
            !state.emojiPickerOpen;

        updateEmojiPickerView();
    }

    function filterEmojiPicker(value) {
        state.emojiSearch =
            String(value || "");

        if (state.emojiSearch.trim()) {
            state.emojiCategory = "All";
        }

        updateEmojiPickerView();
    }

    function renderForwardPanel() {
        const panel = get(
            "dm-forward-modal"
        );
        const list = get(
            "dm-forward-list"
        );

        if (!panel || !list) return;

        list.replaceChildren();

        if (!state.forwardPanelOpen) {
            panel.hidden = true;
            return;
        }

        const source =
            findMessage(state.forwardMessageId);

        if (source) {
            const preview =
                get("dm-forward-preview");

            if (preview) {
                preview.replaceChildren();

                if (source.mediaKind) {
                    const icon =
                        make(
                            "span",
                            "dm-forward-preview-icon"
                        );
                    icon.appendChild(
                        makeIcon(
                            source.mediaKind ===
                                "video"
                                ? "video"
                                : "image"
                        )
                    );
                    preview.appendChild(icon);
                }

                preview.appendChild(
                    make(
                        "span",
                        "",
                        previewText(
                            source,
                            120
                        ) ||
                            "Message"
                    )
                );
            }
        }

        if (!state.conversations.length) {
            list.appendChild(
                make(
                    "div",
                    "dm-panel-state",
                    "Add another friend before forwarding."
                )
            );
        } else {
            state.conversations
                .filter(
                    (conversation) =>
                        conversation.username !==
                        state.activeConversation
                )
                .forEach((conversation) => {
                    const row = make(
                        "button",
                        "dm-forward-target"
                    );

                    row.type = "button";
                    row.dataset.username =
                        conversation.username;

                    const avatar =
                        make(
                            "span",
                            "dm-forward-avatar"
                        );
                    setAvatar(
                        avatar,
                        conversation
                    );

                    const copy =
                        make(
                            "span",
                            "dm-forward-copy"
                        );

                    copy.append(
                        make(
                            "strong",
                            "",
                            conversation.nickname ||
                                conversation.displayName ||
                                conversation.username
                        ),
                        make(
                            "small",
                            "",
                            "-" +
                                conversation.username
                        )
                    );

                    const check =
                        make(
                            "span",
                            "dm-forward-check"
                        );
                    check.appendChild(
                        makeIcon("forward")
                    );

                    row.append(
                        avatar,
                        copy,
                        check
                    );

                    list.appendChild(row);
                });
        }

        panel.hidden = false;
    }

    function renderInfoPanel() {
        const panel = get("dm-info-panel");
        if (!panel) return;

        const conversation = activeConversation();

        if (!state.infoPanelOpen || !conversation) {
            panel.hidden = true;
            panel.replaceChildren();
            return;
        }

        panel.hidden = false;
        panel.replaceChildren();

        const header = make("div", "dm-info-header");
        const heading = make("div");
        heading.append(
            make("p", "system-label", "HELIX / CONVERSATION"),
            make("h3", "", "Conversation info")
        );

        const close = iconButton(
            "dm-panel-close dm-close-control",
            "close",
            "Close conversation info"
        );
        close.setAttribute("data-close-glyph", "×");
        close.dataset.dmAction = "close-info";
        header.append(heading, close);
        panel.appendChild(header);

        if (state.loadingInfo) {
            const loading = make("div", "dm-info-loading");
            const icon = make("span", "dm-info-loading-icon");
            icon.appendChild(makeIcon("info"));
            loading.append(
                icon,
                make("strong", "", "Loading conversation info"),
                make("small", "", "Syncing profile and shared media…")
            );
            panel.appendChild(loading);
            return;
        }

        if (state.infoError) {
            const error = make("div", "dm-info-loading dm-info-error");
            const icon = make("span", "dm-info-loading-icon");
            icon.appendChild(makeIcon("warning"));
            error.append(
                icon,
                make("strong", "", "Conversation info unavailable"),
                make("small", "", state.infoError)
            );

            const retry = iconButton(
                "dm-inline-button dm-icon-button-with-label",
                "retry",
                "Retry conversation info"
            );
            retry.dataset.dmAction = "retry-info";
            retry.appendChild(make("span", "", "Retry"));
            error.appendChild(retry);

            panel.appendChild(error);
            return;
        }

        const info = state.info || {};

        const profile = make("div", "dm-info-profile");
        const avatar = make("span", "dm-info-avatar");
        setAvatar(avatar, {
            username: info.conversation?.username || conversation.username,
            displayName: info.conversation?.displayName || conversation.displayName,
            nickname: conversation.nickname,
            profilePhoto:
                info.conversation?.profilePhoto ||
                conversation.profilePhoto
        });

        const displayName = make(
            "h2",
            "",
            conversation.nickname ||
            info.conversation?.displayName ||
            conversation.displayName ||
            conversation.username
        );

        const username = make(
            "p",
            "",
            "-" + (
                info.conversation?.username ||
                conversation.username
            )
        );

        const friendship = make("span", "dm-info-status");
        friendship.append(
            makeIcon("check"),
            make(
                "span",
                "",
                info.conversation?.friendship ||
                "Friends on Helix"
            )
        );

        profile.append(
            avatar,
            displayName,
            username,
            friendship
        );
        panel.appendChild(profile);

        const actions = make("div", "dm-info-actions");
        const nicknameButton = iconButton(
            "dm-info-action dm-private-nickname-button",
            "privateNickname",
            "Edit private nickname"
        );
        nicknameButton.dataset.dmAction = "private-nickname";

        const nicknameIcon = make(
            "span",
            "dm-private-nickname-icon"
        );
        nicknameIcon.appendChild(
            makeIcon("privateNickname")
        );

        const nicknameCopy = make(
            "span",
            "dm-private-nickname-copy"
        );
        nicknameCopy.append(
            make(
                "strong",
                "",
                "Private nickname"
            ),
            make(
                "small",
                "",
                conversation.nickname
                    ? "Change the name shown only to you"
                    : "Set a private name for this conversation"
            )
        );

        const nicknameArrow = make(
            "span",
            "dm-private-nickname-arrow",
            "›"
        );
        nicknameArrow.setAttribute(
            "aria-hidden",
            "true"
        );

        nicknameButton.replaceChildren(
            nicknameIcon,
            nicknameCopy,
            nicknameArrow
        );
        actions.appendChild(nicknameButton);
        panel.appendChild(actions);

        const mediaSection = make("section", "dm-info-section");
        const mediaHeading = make("div", "dm-info-section-heading");
        mediaHeading.appendChild(make("h4", "", "Shared media"));

        const media = Array.isArray(info.sharedMedia)
            ? info.sharedMedia
            : [];

        mediaHeading.appendChild(
            make(
                "span",
                "",
                media.length ? String(media.length) : ""
            )
        );

        mediaSection.appendChild(mediaHeading);

        const mediaList = make(
            "div",
            "dm-info-media-grid"
        );

        if (media.length) {
            media.forEach((item) => {
                const mediaButton = make(
                    "button",
                    "dm-info-media-item"
                );
                mediaButton.type = "button";
                mediaButton.dataset.dmAction = "open-media";
                mediaButton.dataset.messageId = String(item.id);
                mediaButton.title = item.mediaName || "Shared media";

                if (item.mediaKind === "video") {
                    const wrapper = make(
                        "span",
                        "dm-info-media-video"
                    );
                    wrapper.appendChild(makeIcon("video"));
                    mediaButton.appendChild(wrapper);
                } else {
                    const image = document.createElement("img");
                    image.src = item.mediaUrl;
                    image.alt = item.mediaName || "Shared photo";
                    image.loading = "lazy";
                    mediaButton.appendChild(image);
                }

                mediaList.appendChild(mediaButton);
            });
        }

        mediaSection.appendChild(mediaList);

        if (!media.length) {
            mediaSection.appendChild(
                make(
                    "div",
                    "dm-info-empty",
                    "No shared media yet."
                )
            );
        }

        panel.appendChild(mediaSection);

        const filesSection = make("section", "dm-info-section");
        filesSection.appendChild(
            make(
                "div",
                "dm-info-section-heading",
                ""
            )
        );
        filesSection.querySelector(".dm-info-section-heading").appendChild(
            make("h4", "", "Files")
        );
        filesSection.appendChild(
            make(
                "div",
                "dm-info-empty",
                Array.isArray(info.files) && info.files.length
                    ? String(info.files.length) + " shared file" +
                        (info.files.length === 1 ? "" : "s")
                    : "No shared files yet."
            )
        );
        panel.appendChild(filesSection);
    }

    function renderMediaViewer() {
        const viewer = get(
            "dm-media-viewer"
        );
        if (!viewer) return;

        viewer.replaceChildren();

        if (!state.mediaViewerOpen) {
            viewer.hidden = true;
            return;
        }

        const message =
            findMessage(
                state.mediaViewerMessageId
            );

        if (!message?.mediaUrl) {
            viewer.hidden = true;
            return;
        }

        const backdrop =
            make(
                "button",
                "dm-media-viewer-backdrop"
            );
        backdrop.type = "button";
        backdrop.dataset.dmAction =
            "close-media";

        const panel =
            make(
                "section",
                "dm-media-viewer-panel"
            );
        panel.setAttribute(
            "role",
            "dialog"
        );
        panel.setAttribute(
            "aria-modal",
            "true"
        );
        panel.setAttribute(
            "aria-label",
            message.mediaName ||
                "Media viewer"
        );

        const close =
            iconButton(
                "dm-media-viewer-close dm-close-control",
                "close",
                "Close media"
            );
        close.dataset.dmAction =
            "close-media";

        panel.appendChild(close);

        if (message.mediaKind === "video") {
            const video =
                document.createElement(
                    "video"
                );
            video.className =
                "dm-media-viewer-media";
            video.src =
                message.mediaUrl;
            video.controls = true;
            video.autoplay = false;
            video.playsInline = true;
            panel.appendChild(video);
        } else {
            const img =
                document.createElement(
                    "img"
                );
            img.className =
                "dm-media-viewer-media";
            img.src =
                message.mediaUrl;
            img.alt =
                message.mediaName ||
                "Shared photo";
            panel.appendChild(img);
        }

        const caption =
            make(
                "div",
                "dm-media-viewer-caption"
            );
        caption.append(
            make(
                "strong",
                "",
                message.mediaName ||
                    "Shared media"
            ),
            make(
                "small",
                "",
                formatFileSize(
                    message.mediaSize
                )
            )
        );

        panel.appendChild(caption);
        viewer.append(
            backdrop,
            panel
        );

        viewer.hidden = false;
    }

    function renderContextMenu() {
        const menu =
            get("dm-context-menu");

        if (!menu) return;

        menu.replaceChildren();

        if (!state.contextMenu.open) {
            menu.hidden = true;
            return;
        }

        const message =
            findMessage(
                state.contextMenu.messageId
            );

        if (!message) {
            menu.hidden = true;
            return;
        }

        function addAction(
            label,
            icon,
            action,
            options = {}
        ) {
            const item = iconButton(
                "dm-context-item" +
                    (options.danger
                        ? " is-danger"
                        : ""),
                icon,
                label
            );

            item.dataset.dmContextAction =
                action;
            item.dataset.messageId =
                message.id;
            item.setAttribute("role", "menuitem");

            const text =
                make(
                    "span",
                    "",
                    label
                );

            item.appendChild(text);
            menu.appendChild(item);
        }

        if (!message.isDeleted) {
            addAction(
                "Reply",
                "reply",
                "reply"
            );

            if (
                message.sender === currentUsername() &&
                !message.mediaUrl
            ) {
                addAction(
                    "Edit message",
                    "edit",
                    "edit-message"
                );
            }

            addAction(
                "React",
                "reaction",
                "react"
            );

            addAction(
                "Copy message",
                "copy",
                "copy-message"
            );

            addAction(
                "Forward",
                "forward",
                "forward-message"
            );

            addAction(
                message.isPinned
                    ? "Unpin message"
                    : "Pin message",
                "pin",
                "toggle-pin"
            );

            if (message.sender === currentUsername()) {
                addAction(
                    "Delete message",
                    "delete",
                    "delete-message",
                    { danger: true }
                );
            }
        } else {
            addAction(
                "Copy message",
                "copy",
                "copy-message"
            );
        }

        menu.hidden = false;

        const width = menu.offsetWidth || 210;
        const height = menu.offsetHeight || 300;
        const gap = 8;

        const left = Math.max(
            gap,
            Math.min(
                state.contextMenu.x,
                window.innerWidth - width - gap
            )
        );

        const top = Math.max(
            gap,
            Math.min(
                state.contextMenu.y,
                window.innerHeight - height - gap
            )
        );

        menu.style.left = left + "px";
        menu.style.top = top + "px";
        if (state.contextMenu.open) {
            window.setTimeout(() => {
                if (!state.contextMenu.open) return;
                menu.querySelector(".dm-context-item")?.focus();
            }, 0);
        }
    }

    function renderComposerState() {
        const replyBar = get("dm-reply-bar");
        const attachment = state.pendingAttachment;

        if (replyBar) {
            if (!state.reply) {
                replyBar.hidden = true;
            } else {
                replyBar.hidden = false;

                const conversation = activeConversation();
                const senderName =
                    state.reply.sender === currentUsername()
                        ? "You"
                        : "@" + (
                            state.reply.sender ||
                            conversation?.username ||
                            "user"
                        );

                const avatar = get("dm-reply-bar-avatar");
                if (avatar) {
                    setAvatar(
                        avatar,
                        state.reply.sender === currentUsername()
                            ? {
                                username: currentUsername(),
                                displayName: "You",
                                profilePhoto:
                                    localStorage.getItem(
                                        "helixProfilePhoto:" +
                                        currentUsername()
                                    )
                            }
                            : {
                                username: state.reply.sender,
                                displayName: senderName,
                                profilePhoto: conversation?.profilePhoto || null
                            }
                    );
                }

                const label = get("dm-reply-bar-label");
                const sender = get("dm-reply-bar-sender");
                const text = get("dm-reply-bar-text");
                const thumb = get("dm-reply-bar-thumb");

                if (label) label.textContent = "REPLYING TO";
                if (sender) sender.textContent = senderName;
                if (text) {
                    text.textContent =
                        state.reply.text ||
                        (
                            state.reply.mediaKind === "video"
                                ? "Video"
                                : state.reply.mediaKind === "image"
                                    ? "Photo"
                                    : "Original message"
                        );
                }

                if (thumb) {
                    thumb.replaceChildren();

                    if (state.reply.mediaUrl) {
                        thumb.hidden = false;

                        if (state.reply.mediaKind === "video") {
                            const video = document.createElement("video");
                            video.src = state.reply.mediaUrl;
                            video.muted = true;
                            video.playsInline = true;
                            video.preload = "metadata";
                            thumb.appendChild(video);
                        } else {
                            const image = document.createElement("img");
                            image.src = state.reply.mediaUrl;
                            image.alt = "";
                            image.loading = "lazy";
                            thumb.appendChild(image);
                        }
                    } else {
                        thumb.hidden = true;
                    }
                }
            }
        }

        const preview = get("dm-media-preview");
        const previewThumb = get("dm-media-preview-thumb");
        const previewName = get("dm-media-preview-name");
        const previewSize = get("dm-media-preview-size");
        const error = get("dm-attachment-error");

        if (preview) {
            preview.hidden = !attachment;

            if (attachment) {
                if (previewName) {
                    previewName.textContent =
                        attachment.name || "Attachment";
                }

                if (previewSize) {
                    previewSize.textContent =
                        formatFileSize(attachment.size);
                }

                if (previewThumb) {
                    previewThumb.replaceChildren();

                    if (attachment.previewUrl) {
                        if (attachment.kind === "video") {
                            const video = document.createElement("video");
                            video.src = attachment.previewUrl;
                            video.muted = true;
                            video.playsInline = true;
                            video.preload = "metadata";
                            previewThumb.appendChild(video);
                        } else {
                            const image = document.createElement("img");
                            image.src = attachment.previewUrl;
                            image.alt = "Selected photo";
                            previewThumb.appendChild(image);
                        }
                    }
                }
            } else {
                previewThumb?.replaceChildren();
            }
        }

        if (error) {
            error.hidden = !state.attachmentError;
            error.textContent = state.attachmentError || "";
        }
    }

    function renderAll() {
        renderConversationList();
        renderHeader();
        renderMessages();
        renderMessageStatus();
        renderPinnedPanel();
        renderForwardPanel();
        renderInfoPanel();
        renderMediaViewer();
        renderContextMenu();
        renderComposerState();
    }

    window.HelixDMRender = {
        renderAll,
        renderConversationList,
        renderHeader,
        renderMessages,
        renderMessageStatus,
        renderPinnedPanel,
        renderForwardPanel,
        renderInfoPanel,
        renderMediaViewer,
        renderContextMenu,
        renderComposerState,
        renderEmojiPicker,
        filterEmojiPicker,
        setEmojiPickerCategory,
        renderReplyReference,
        renderMessage,
        renderReactionStrip,
        scrollToBottom,
        findMessage,
        previewText,
        formatFileSize,
        scrollToMessage: (messageId) => {
            const row =
                get(
                    "dm-message-list"
                )?.querySelector(
                    '[data-message-id="' +
                        CSS.escape(
                            String(
                                messageId
                            )
                        ) +
                    '"]'
                );

            if (!row) return false;

            row.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            row.classList.add(
                "is-jumped"
            );

            window.setTimeout(() => {
                row.classList.remove(
                    "is-jumped"
                );
            }, 1000);

            return true;
        }
    };
})();
