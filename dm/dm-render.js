(() => {
    const state = window.HelixDMState.state;
    const loggedInUser = () => localStorage.getItem("helixLoggedIn") || "";

    const get = (id) => document.getElementById(id);

    function make(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    const ICONS = {
        messages: '<path d="M7 9.5A3.5 3.5 0 0 1 10.5 6h27A3.5 3.5 0 0 1 41 9.5v16A3.5 3.5 0 0 1 37.5 29H22l-8.5 6.5V29h-3A3.5 3.5 0 0 1 7 25.5z"/><path d="M15 15h18M15 21h12"/>',
        back: '<path d="m29 9-15 15 15 15"/><path d="M15 24h24"/>',
        search: '<circle cx="21" cy="21" r="11"/><path d="m30 30 8 8"/>',
        send: '<path d="m6 8 32 16-32 16 6-16z"/><path d="M12 24h18"/>',
        more: '<circle cx="12" cy="24" r="1.6" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="1.6" fill="currentColor" stroke="none"/><circle cx="36" cy="24" r="1.6" fill="currentColor" stroke="none"/>',
        edit: '<path d="M9 35.5V39h3.5L34 20.5l-7-7z"/><path d="m31 10 7 7"/><path d="M9 39h30"/>',
        delete: '<path d="M10 13h28M19 13V9h10v4M16 13l2 25h12l2-25M21 19v13M27 19v13"/>',
        copy: '<rect x="10" y="10" width="23" height="26" rx="3"/><path d="M17 10V7h17a4 4 0 0 1 4 4v22h-5"/>',
        reaction: '<path d="M10 12h28v20H22l-7 6v-6h-5z"/><path d="M18 22h.01M24 22h.01M30 22h.01"/>',
        emoji: '<circle cx="24" cy="24" r="15"/><path d="M18 21h.01M30 21h.01M17 28c4 4 10 4 14 0"/>',
        pin: '<path d="m18 8 12 12"/><path d="m28 10 7 7-5 5 3 8-4 4-8-3-5 5-7-7 5-5-3-8 4-4 8 3z"/><path d="m24 28-9 9"/>',
        forward: '<path d="M31 10 41 20 31 30"/><path d="M41 20H19a10 10 0 0 0-10 10v8"/>',
        close: '<path d="m13 13 22 22M35 13 13 35"/>',
        retry: '<path d="M11 20a14 14 0 1 1 4 13"/><path d="M11 10v10h10"/>',
        warning: '<path d="m24 7 16 29H8z"/><path d="M24 17v10M24 31h.01"/>',
        refresh: '<path d="M10 20a14 14 0 0 1 24-7l3 3"/><path d="M37 9v8h-8"/><path d="M38 28a14 14 0 0 1-24 7l-3-3"/><path d="M11 39v-8h8"/>',
        check: '<path d="m10 24 9 9 19-20"/>',
        moreVertical: '<circle cx="24" cy="10" r="1.7" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="1.7" fill="currentColor" stroke="none"/><circle cx="24" cy="38" r="1.7" fill="currentColor" stroke="none"/>',
        empty: '<rect x="9" y="11" width="30" height="26" rx="5"/><path d="M15 18h18M15 24h12M15 30h7"/>'
    };

    function makeIcon(name, label, className = "") {
        const svg = document.createElement("svg");
        svg.className = ("dm-icon " + className).trim();
        svg.setAttribute("viewBox", "0 0 48 48");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.4");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");

        if (label) {
            svg.setAttribute("focusable", "false");
        }

        svg.innerHTML = ICONS[name] || "";
        return svg;
    }

    function iconButton(className, name, title) {
        const element = make("button", className);
        element.type = "button";
        element.appendChild(makeIcon(name, title));
        if (title) {
            element.title = title;
            element.setAttribute("aria-label", title);
        }
        return element;
    }

    function button(className, label, title) {
        const element = make("button", className, label);
        element.type = "button";
        if (title) {
            element.title = title;
            element.setAttribute("aria-label", title);
        }
        return element;
    }

    function initials(name) {
        return String(name || "U")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0] || "")
            .join("")
            .toUpperCase() || "U";
    }

    function time(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    function day(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const options = { month: "short", day: "numeric" };
        if (date.getFullYear() !== new Date().getFullYear()) {
            options.year = "numeric";
        }
        return date.toLocaleDateString([], options);
    }

    function setAvatar(element, user) {
        element.replaceChildren();

        if (user && user.profilePhoto) {
            const image = document.createElement("img");
            image.src = user.profilePhoto;
            image.alt = "";
            image.loading = "lazy";
            image.referrerPolicy = "no-referrer";
            element.appendChild(image);
            return;
        }

        element.textContent = initials(
            user && (user.nickname || user.displayName || user.username)
        );
    }

    function currentConversation() {
        return state.conversations.find(
            (item) => item.username === state.activeConversation
        ) || null;
    }

    function renderConversationList() {
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
                    state.conversations.length + " " +
                    (state.conversations.length === 1 ? "connection" : "connections");
            }
        }

        if (state.loadingConversations) {
            {
                const loadingWrap = make("div", "dm-list-skeletons");
                for (let i = 0; i < 4; i += 1) {
                    const skeleton = make("div", "dm-conversation-skeleton");
                    skeleton.append(
                        make("span", "dm-skeleton-avatar"),
                        make("span", "dm-skeleton-copy")
                    );
                    loadingWrap.appendChild(skeleton);
                }
                list.appendChild(loadingWrap);
            }
            return;
        }

        if (state.conversationError) {
            const box = make("div", "dm-list-state dm-list-state-error");
            box.appendChild(make("strong", "", "Could not load messages"));
            box.appendChild(make("small", "", state.conversationError));
            const retry = iconButton("dm-inline-button dm-icon-button-with-label", "retry", "Retry conversation loading"); retry.appendChild(make("span", "", "Retry"));
            retry.dataset.dmAction = "refresh-conversations";
            box.appendChild(retry);
            list.appendChild(box);
            return;
        }

        if (!state.conversations.length) {
            const box = make("div", "dm-list-state");
            {
                const mark = make("span", "dm-list-state-mark");
                mark.appendChild(makeIcon("messages"));
                box.appendChild(mark);
            }
            box.appendChild(make("strong", "", "No friends available"));
            box.appendChild(
                make(
                    "small",
                    "",
                    "Add a friend in Friends to start a direct message."
                )
            );
            list.appendChild(box);
            return;
        }

        const query = state.conversationSearch.trim().toLowerCase();
        const visible = state.conversations.filter((item) => {
            if (!query) return true;

            return [
                item.username,
                item.displayName,
                item.nickname,
                item.latestMessage && item.latestMessage.text
            ].some((value) =>
                String(value || "").toLowerCase().includes(query)
            );
        });

        if (!visible.length) {
            list.appendChild(
                make("div", "dm-list-state", "No conversations match that search.")
            );
            return;
        }

        visible.forEach((conversation) => {
            const row = button(
                "dm-conversation" +
                (state.activeConversation === conversation.username ? " is-active" : ""),
                "",
                "Open " + (conversation.displayName || conversation.username)
            );
            row.dataset.username = conversation.username;

            const avatar = make("span", "dm-conversation-avatar");
            setAvatar(avatar, conversation);

            const copy = make("span", "dm-conversation-copy");
            copy.appendChild(
                make(
                    "strong",
                    "",
                    conversation.nickname ||
                    conversation.displayName ||
                    conversation.username
                )
            );
            copy.appendChild(make("small", "", "-" + conversation.username));

            const latestText =
                conversation.latestMessage && conversation.latestMessage.text
                    ? conversation.latestMessage.text.replace(/\s+/g, " ").trim()
                    : "No messages yet";

            copy.appendChild(
                make("span", "dm-conversation-preview", latestText)
            );

            const meta = make("span", "dm-conversation-meta");

            if (conversation.latestMessage && conversation.latestMessage.createdAt) {
                meta.appendChild(
                    make("time", "", time(conversation.latestMessage.createdAt))
                );
            }

            if (Number(conversation.unreadCount || 0) > 0) {
                meta.appendChild(
                    make(
                        "span",
                        "dm-unread-badge",
                        conversation.unreadCount > 99
                            ? "99+"
                            : String(conversation.unreadCount)
                    )
                );
            }

            row.append(avatar, copy, meta);
            list.appendChild(row);
        });
    }

    function renderHeader() {
        const title = get("dm-chat-title");
        const username = get("dm-chat-username");
        const avatar = get("dm-chat-avatar");

        if (!state.activeConversation) {
            if (title) title.textContent = "Select a friend";
            if (username) username.textContent = "Choose a conversation to begin.";
            if (avatar) {
                avatar.replaceChildren();
                avatar.textContent = "DM";
            }
            return;
        }

        const conversation = currentConversation();
        if (!conversation) return;

        if (title) {
            title.textContent =
                conversation.nickname ||
                conversation.displayName ||
                conversation.username;
        }

        if (username) {
            username.textContent = "-" + conversation.username;
        }

        if (avatar) {
            setAvatar(avatar, conversation);
        }
    }

    function renderStatus() {
        const element = get("dm-message-status");
        if (!element) return;

        if (!state.activeConversation) {
            element.textContent = "";
        } else if (state.loadingMessages) {
            element.textContent = "LOADING";
        } else if (state.messageError) {
            element.textContent = "ERROR";
        } else {
            element.textContent =
                state.messages.length + " " +
                (state.messages.length === 1 ? "message" : "messages");
        }
    }

    function visibleMessages() {
        const query = state.messageSearch.trim().toLowerCase();

        if (!query) return state.messages;

        return state.messages.filter((message) =>
            String(message.text || "").toLowerCase().includes(query)
        );
    }

    function renderSearchCount() {
        const element = get("dm-message-search-count");
        if (!element) return;

        if (!state.messageSearch.trim()) {
            element.textContent = "";
            return;
        }

        element.textContent =
            visibleMessages().length + "/" + state.messages.length + " matches";
    }

    function renderReactionStrip(message) {
        const reactions = Array.isArray(message.reactions)
            ? message.reactions
            : [];

        if (!reactions.length) return null;

        const strip = make("div", "dm-reaction-strip");

        reactions.forEach((reaction) => {
            const item = button(
                "dm-reaction-pill" + (reaction.reacted ? " is-reacted" : ""),
                "",
                "Toggle " + reaction.emoji + " reaction"
            );
            item.dataset.dmReaction = reaction.emoji;
            item.dataset.messageId = message.id;

            item.append(
                make("span", "dm-reaction-emoji", reaction.emoji),
                make("span", "dm-reaction-count", String(reaction.count))
            );

            strip.appendChild(item);
        });

        return strip;
    }

    function renderMessageActions(message) {
        const tools = make("div", "dm-message-actions");
        const quick = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

        quick.forEach((emoji) => {
            const current = (message.reactions || []).find(
                (reaction) => reaction.emoji === emoji
            );

            const item = button(
                "dm-message-tool dm-message-quick-reaction" +
                (current && current.reacted ? " is-reacted" : ""),
                emoji,
                "React with " + emoji
            );

            item.dataset.dmQuickReaction = emoji;
            item.dataset.messageId = message.id;
            tools.appendChild(item);
        });

        const emoji = iconButton("dm-message-tool", "emoji", "Open full emoji picker");
        emoji.dataset.dmEmojiPicker = "open";
        emoji.dataset.messageId = message.id;
        tools.appendChild(emoji);

        const copy = iconButton("dm-message-tool", "copy", "Copy message");
        copy.dataset.dmAction = "copy-message";
        copy.dataset.messageId = message.id;
        tools.appendChild(copy);

        const pin = button(
            "dm-message-tool" + (message.isPinned ? " is-active" : ""),
            message.isPinned ? "📍" : "⌖",
            message.isPinned ? "Unpin message" : "Pin message"
        );
        pin.dataset.dmAction = "toggle-pin";
        pin.dataset.messageId = message.id;
        tools.appendChild(pin);

        const forward = iconButton("dm-message-tool", "forward", "Forward message");
        forward.dataset.dmAction = "forward-message";
        forward.dataset.messageId = message.id;
        tools.appendChild(forward);

        if (message.sender === loggedInUser()) {
            const edit = iconButton("dm-message-tool", "edit", "Edit message");
            edit.dataset.dmAction = "edit-message";
            edit.dataset.messageId = message.id;
            tools.appendChild(edit);

            const remove = iconButton(
                "dm-message-tool dm-danger-tool",
                "delete",
                "Delete message"
            );
            remove.dataset.dmAction = "delete-message";
            remove.dataset.messageId = message.id;
            tools.appendChild(remove);
        }

        return tools;
    }

    function renderMessage(message) {
        const sent = message.sender === loggedInUser();
        const row = make(
            "article",
            "dm-message-row " + (sent ? "is-sent" : "is-received")
        );
        row.dataset.messageId = message.id;

        const query = state.messageSearch.trim().toLowerCase();
        if (query && String(message.text || "").toLowerCase().includes(query)) {
            row.classList.add("is-search-match");
        }

        const bubble = make("div", "dm-message-bubble");
        bubble.appendChild(make("p", "dm-message-text", message.text));
        bubble.appendChild(renderMessageActions(message));

        const reactionStrip = renderReactionStrip(message);
        if (reactionStrip) row.appendChild(reactionStrip);

        const meta = make("div", "dm-message-meta");
        meta.appendChild(make("time", "", time(message.createdAt)));

        if (message.editedAt) {
            meta.appendChild(make("span", "dm-edited-label", "Edited"));
        }

        if (message.isPinned) {
            meta.appendChild(make("span", "dm-pinned-label", "Pinned"));
        }

        row.append(bubble, meta);
        return row;
    }

    function renderMessages() {
        const list = get("dm-message-list");
        if (!list) return;

        list.replaceChildren();
        renderSearchCount();

        if (!state.activeConversation) {
            list.appendChild(
                make("div", "dm-chat-state", "Select a friend to open a conversation.")
            );
            return;
        }

        if (state.loadingMessages) {
            const loading = make("div", "dm-message-skeletons");
            loading.setAttribute("role", "status");
            for (let i = 0; i < 5; i += 1) {
                const row = make("div", "dm-message-skeleton " + (i % 2 ? "is-left" : "is-right"));
                row.appendChild(make("span", "dm-skeleton-bubble"));
                loading.appendChild(row);
            }
            list.appendChild(loading);
            return;
        }

        if (state.messageError) {
            const box = make("div", "dm-chat-state dm-chat-state-error");
            box.appendChild(make("strong", "", "Conversation unavailable"));
            box.appendChild(make("p", "", state.messageError));

            const retry = iconButton("dm-inline-button dm-icon-button-with-label", "retry", "Retry loading messages"); retry.appendChild(make("span", "", "Retry"));
            retry.dataset.dmAction = "retry-conversation";
            box.appendChild(retry);

            list.appendChild(box);
            return;
        }

        if (!state.messages.length) {
            const box = make("div", "dm-chat-state");
            const mark = make("span", "dm-chat-state-mark");
            mark.appendChild(makeIcon("messages"));
            box.appendChild(make("strong", "", "No messages yet"));
            box.appendChild(
                make("p", "", "Send a text message to start the conversation.")
            );
            list.appendChild(box);
            return;
        }

        const visible = visibleMessages();

        if (!visible.length) {
            const box = make("div", "dm-chat-state");
            const mark = make("span", "dm-chat-state-mark");
            mark.appendChild(makeIcon("search"));
            box.append(mark, make("strong", "", "No matching messages"));
            box.appendChild(make("p", "", "Try a different search term."));
            list.appendChild(box);
            return;
        }

        let lastDay = "";

        visible.forEach((message) => {
            const currentDay = day(message.createdAt);

            if (currentDay && currentDay !== lastDay) {
                list.appendChild(
                    make("div", "dm-date-separator", currentDay)
                );
                lastDay = currentDay;
            }

            list.appendChild(renderMessage(message));
        });
    }

    function renderPinnedPanel() {
        const panel = get("dm-pins-panel");
        const list = get("dm-pins-list");
        if (!panel || !list) return;

        list.replaceChildren();

        if (state.loadingPins) {
            list.appendChild(make("div", "dm-panel-state", "Loading pinned messages…"));
        } else if (!state.pinnedMessages.length) {
            list.appendChild(
                make(
                    "div",
                    "dm-panel-state",
                    "No pinned messages in this conversation."
                )
            );
        } else {
            state.pinnedMessages.forEach((message) => {
                const item = button(
                    "dm-pinned-item",
                    "",
                    "Jump to pinned message"
                );
                item.dataset.dmAction = "jump-to-message";
                item.dataset.messageId = message.id;
                const pinIcon = make("span", "dm-pinned-icon");
                pinIcon.appendChild(makeIcon("pin"));
                item.append(
                    pinIcon,
                    make("span", "dm-pinned-text", message.text),
                    make("small", "dm-pinned-time", time(message.pinnedAt || message.createdAt))
                );
                list.appendChild(item);
            });
        }

        panel.hidden = !panel.classList.contains("is-open");
    }

    const EMOJI = [
        "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚",
        "😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣",
        "😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗",
        "🤔","🫡","🤭","🫢","🫣","🤫","🤥","😶","🫠","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴",
        "🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻",
        "💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🙈","🙉","🙊","💋","💯",
        "💥","💫","💦","💨","🔥","⭐","🌟","✨","⚡","💡","🎉","🎊","❤️","🧡","💛","💚","💙","💜","🖤","🤍",
        "🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","👍","👎","👏","🙌","🫶","🤝","🙏","💪","👀",
        "👋","✌️","🤞","🤟","🤘","👌","🤌","🤏","🫰","☝️","👇","👉","👈","✍️","💅","🤳","🧠","💭","💬","✅",
        "❌","⚠️","❓","❗","‼️","⁉️","➕","➖","🎯","🚀","🌙","☀️","🌈","🌊","🍕","🍔","🍟","🍎","🍉","🍓",
        "☕","🍩","🎂","🍪","⚽","🏀","🏆","🎮","🎧","🎵","🎸","📚","💻","📱","⌚","🔒","🔑","🔔","📌","✏️"
    ];

    function renderEmojiPicker() {
        const picker = get("dm-emoji-picker");
        if (!picker) return;

        picker.replaceChildren();

        const header = make("div", "dm-emoji-picker-header");
        header.appendChild(make("strong", "", "Emoji"));

        const close = iconButton("dm-panel-close", "close", "Close emoji picker");
        close.dataset.dmAction = "close-emoji-picker";
        header.appendChild(close);

        const search = document.createElement("input");
        search.type = "search";
        search.id = "dm-emoji-search";
        search.placeholder = "Search emoji";
        search.autocomplete = "off";
        header.appendChild(search);

        const grid = make("div", "dm-emoji-grid");

        EMOJI.forEach((item) => {
            const option = button("dm-emoji-option", item, "Use " + item);
            option.dataset.emoji = item;
            grid.appendChild(option);
        });

        picker.append(header, grid);
        picker.hidden = true;
    }

    function filterEmojiPicker(value) {
        const query = String(value || "").trim();
        document.querySelectorAll(".dm-emoji-option").forEach((item) => {
            item.hidden =
                Boolean(query) &&
                !item.dataset.emoji.includes(query);
        });
    }

    function renderForwardModal() {
        const modal = get("dm-forward-modal");
        const list = get("dm-forward-list");
        if (!modal || !list) return;

        list.replaceChildren();

        if (!state.forwardModalOpen) {
            modal.hidden = true;
            return;
        }

        state.conversations.forEach((conversation) => {
            const target = button(
                "dm-forward-target",
                "",
                "Forward message to " +
                (conversation.displayName || conversation.username)
            );
            target.dataset.username = conversation.username;

            const avatar = make("span", "dm-forward-avatar");
            setAvatar(avatar, conversation);

            const copy = make("span", "dm-forward-copy");
            copy.append(
                make(
                    "strong",
                    "",
                    conversation.nickname ||
                    conversation.displayName ||
                    conversation.username
                ),
                make("small", "", "-" + conversation.username)
            );

            target.append(avatar, copy);
            list.appendChild(target);
        });

        if (!state.conversations.length) {
            list.appendChild(
                make(
                    "div",
                    "dm-panel-state",
                    "Add another friend before forwarding messages."
                )
            );
        }

        modal.hidden = false;
    }

    function scrollToBottom(smooth) {
        const list = get("dm-message-list");
        if (!list) return;

        list.scrollTo({
            top: list.scrollHeight,
            behavior: smooth ? "smooth" : "auto"
        });
    }

    function scrollToMessage(messageId) {
        const row = get("dm-message-list")?.querySelector(
            '[data-message-id="' + CSS.escape(messageId) + '"]'
        );

        if (!row) return;

        row.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        row.classList.add("is-jumped");
        window.setTimeout(() => row.classList.remove("is-jumped"), 850);
    }

    function renderAll() {
        renderConversationList();
        renderHeader();
        renderMessages();
        renderStatus();
        renderPinnedPanel();
    }

    window.HelixDMRender = {
        renderAll,
        renderConversationList,
        renderHeader,
        renderMessages,
        renderStatus,
        renderPinnedPanel,
        renderEmojiPicker,
        filterEmojiPicker,
        renderForwardModal,
        scrollToBottom,
        scrollToMessage,
        visibleMessages
    };
})();
