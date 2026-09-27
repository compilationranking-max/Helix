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
            list.appendChild(make("div", "dm-list-state", "Loading conversations…"));
            return;
        }

        if (state.conversationError) {
            const box = make("div", "dm-list-state dm-list-state-error");
            box.appendChild(make("strong", "", "Could not load messages"));
            box.appendChild(make("small", "", state.conversationError));
            const retry = button("dm-inline-button", "Retry", "Retry conversation loading");
            retry.dataset.dmAction = "refresh-conversations";
            box.appendChild(retry);
            list.appendChild(box);
            return;
        }

        if (!state.conversations.length) {
            const box = make("div", "dm-list-state");
            box.appendChild(make("span", "dm-list-state-mark", "◇"));
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

        const emoji = button("dm-message-tool", "＋", "Open full emoji picker");
        emoji.dataset.dmEmojiPicker = "open";
        emoji.dataset.messageId = message.id;
        tools.appendChild(emoji);

        const copy = button("dm-message-tool", "⧉", "Copy message");
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

        const forward = button("dm-message-tool", "↗", "Forward message");
        forward.dataset.dmAction = "forward-message";
        forward.dataset.messageId = message.id;
        tools.appendChild(forward);

        if (message.sender === loggedInUser()) {
            const edit = button("dm-message-tool", "✎", "Edit message");
            edit.dataset.dmAction = "edit-message";
            edit.dataset.messageId = message.id;
            tools.appendChild(edit);

            const remove = button(
                "dm-message-tool dm-danger-tool",
                "⌫",
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
            const box = make("div", "dm-chat-state", "Loading messages…");
            box.setAttribute("role", "status");
            list.appendChild(box);
            return;
        }

        if (state.messageError) {
            const box = make("div", "dm-chat-state dm-chat-state-error");
            box.appendChild(make("strong", "", "Conversation unavailable"));
            box.appendChild(make("p", "", state.messageError));

            const retry = button("dm-inline-button", "Retry", "Retry loading messages");
            retry.dataset.dmAction = "retry-conversation";
            box.appendChild(retry);

            list.appendChild(box);
            return;
        }

        if (!state.messages.length) {
            const box = make("div", "dm-chat-state");
            box.appendChild(make("span", "dm-chat-state-mark", "◇"));
            box.appendChild(make("strong", "", "No messages yet"));
            box.appendChild(
                make("p", "", "Send a text message to start the conversation.")
            );
            list.appendChild(box);
            return;
        }

        const visible = visibleMessages();

        if (!visible.length) {
            list.appendChild(
                make("div", "dm-chat-state", "No messages match your search.")
            );
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
                item.append(
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

        const close = button("dm-panel-close", "×", "Close emoji picker");
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
