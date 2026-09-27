(() => {
    const state = window.HelixDMState.state;
    const api = window.HelixDMApi;
    const render = window.HelixDMRender;

    let sendInFlight = false;
    let editingMessageId = null;

    const get = (id) => document.getElementById(id);

    function dmVisible() {
        const view = get("dm-view");
        return Boolean(view && !view.hidden);
    }

    function showToast(message, type) {
        const existing = get("dm-toast");
        existing?.remove();

        const toast = document.createElement("div");
        toast.id = "dm-toast";
        toast.className = "dm-toast" + (type === "error" ? " is-error" : "");
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add("is-visible"));

        window.setTimeout(() => {
            toast.classList.remove("is-visible");
            window.setTimeout(() => toast.remove(), 180);
        }, 2300);
    }

    function setComposerEnabled(enabled) {
        const input = get("dm-message-input");
        const send = get("dm-send-button");

        const canSend =
            enabled &&
            Boolean(state.activeConversation) &&
            !state.loadingMessages &&
            !state.messageError &&
            !sendInFlight;

        if (input) input.disabled = !enabled || state.loadingMessages;
        if (send) send.disabled = !canSend;
    }

    async function refreshConversations(options = {}) {
        if (state.conversationListRequestInFlight) return;

        state.conversationListRequestInFlight = true;
        const hadConversations = state.conversations.length > 0;
        let changed = false;

        if (!options.silent) {
            state.loadingConversations = true;
            state.conversationError = "";
            render.renderConversationList();
        }

        try {
            const nextConversations = await api.getConversations();
            changed = JSON.stringify(nextConversations) !== JSON.stringify(state.conversations);
            state.conversations = nextConversations;
            state.conversationError = "";

            if (
                state.activeConversation &&
                !state.conversations.some(
                    (item) => item.username === state.activeConversation
                )
            ) {
                stopPolling();
                state.activeConversation = null;
                state.messages = [];
                state.pinnedMessages = [];
                state.messageError = "";
                state.loadingMessages = false;
                get("dm-view")?.classList.remove("dm-mobile-chat-open");
                changed = true;
            }
        } catch (error) {
            if (!options.silent || !hadConversations) {
                state.conversationError =
                    error.message || "Could not load your message conversations.";
                changed = true;
            }
        } finally {
            state.loadingConversations = false;
            state.conversationListRequestInFlight = false;

            if (!options.silent || changed) {
                render.renderConversationList();
                render.renderHeader();
                render.renderMessages();
                render.renderStatus();
                setComposerEnabled(Boolean(state.activeConversation));
            }
        }
    }

    function stopPolling() {
        if (state.pollTimer) {
            window.clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
        state.pollInFlight = false;
    }

    function startPolling() {
        stopPolling();

        state.pollTimer = window.setInterval(() => {
            if (
                !dmVisible() ||
                !state.activeConversation ||
                state.pollInFlight ||
                state.loadingMessages
            ) {
                return;
            }

            refreshActiveConversation({
                silent: true,
                preserveScroll: true
            });
        }, 5000);
    }

    async function refreshPins() {
        if (!state.activeConversation) return;

        const username = state.activeConversation;
        state.loadingPins = true;
        render.renderPinnedPanel();

        try {
            const pins = await api.getPins(username);

            if (state.activeConversation === username) {
                state.pinnedMessages = pins;
            }
        } catch (error) {
            if (state.activeConversation === username) {
                showToast(
                    error.message || "Could not load pinned messages.",
                    "error"
                );
            }
        } finally {
            if (state.activeConversation === username) {
                state.loadingPins = false;
                render.renderPinnedPanel();
            }
        }
    }

    async function refreshActiveConversation(options = {}) {
        const username = state.activeConversation;
        if (!username) return;

        const serial = ++state.conversationRequestSerial;

        state.conversationAbortController?.abort();

        const controller = new AbortController();
        state.conversationAbortController = controller;
        state.pollInFlight = Boolean(options.silent);

        if (!options.silent) {
            state.loadingMessages = true;
            state.messageError = "";
            render.renderMessages();
            render.renderStatus();
            setComposerEnabled(true);
        }

        const list = get("dm-message-list");
        const wasNearBottom =
            Boolean(list) &&
            list.scrollHeight - list.scrollTop - list.clientHeight < 90;

        try {
            const messages = await api.getMessages(username, controller.signal);

            if (
                serial !== state.conversationRequestSerial ||
                username !== state.activeConversation
            ) {
                return;
            }

            state.messages = messages;
            state.messageError = "";
            state.loadingMessages = false;

            render.renderMessages();
            render.renderStatus();

            if (!options.silent || wasNearBottom) {
                render.scrollToBottom(Boolean(!options.silent));
            }
        } catch (error) {
            if (error?.name === "AbortError") return;

            if (
                serial !== state.conversationRequestSerial ||
                username !== state.activeConversation
            ) {
                return;
            }

            state.loadingMessages = false;
            state.messageError =
                error.message || "Could not load this conversation.";

            if (!options.silent) {
                render.renderMessages();
                render.renderStatus();
            }
        } finally {
            if (serial === state.conversationRequestSerial) {
                state.conversationAbortController = null;
                state.pollInFlight = false;
                setComposerEnabled(Boolean(state.activeConversation));
            }
        }

        if (
            serial === state.conversationRequestSerial &&
            username === state.activeConversation
        ) {
            if (!options.silent) {
                await refreshPins();
            }
            await refreshConversations({ silent: true });
        }
    }

    async function openConversation(username) {
        const conversation = state.conversations.find(
            (item) => item.username === username
        );

        if (!conversation) return;

        stopPolling();

        state.activeConversation = conversation.username;
        state.messages = [];
        state.pinnedMessages = [];
        state.messageError = "";
        state.loadingMessages = true;
        state.messageSearch = "";
        state.selectedMessageId = null;
        editingMessageId = null;

        const searchInput = get("dm-message-search-input");
        if (searchInput) searchInput.value = "";

        get("dm-view")?.classList.add("dm-mobile-chat-open");

        state.conversationRequestSerial += 1;
        state.conversationAbortController?.abort();

        render.renderAll();
        setComposerEnabled(true);

        await refreshActiveConversation();
        startPolling();

        get("dm-message-input")?.focus();
    }

    function updateMessage(message) {
        if (!message?.id) return;

        window.HelixDMState.replaceMessage(message);
        render.renderMessageList();
        render.renderStatus();
    }

    async function sendMessage(event) {
        event.preventDefault();

        if (sendInFlight || !state.activeConversation || state.messageError) {
            return;
        }

        const input = get("dm-message-input");
        const text = String(input?.value || "").trim();

        if (!text) {
            input?.focus();
            return;
        }

        sendInFlight = true;
        setComposerEnabled(true);

        try {
            const message = await api.sendMessage(
                state.activeConversation,
                text
            );

            if (!message) {
                throw new Error("Helix did not return the created message.");
            }

            updateMessage(message);
            render.scrollToBottom(true);

            if (input) input.value = "";

            await refreshConversations({ silent: true });
        } catch (error) {
            showToast(
                error.message || "Could not send your message.",
                "error"
            );
            input?.focus();
        } finally {
            sendInFlight = false;
            setComposerEnabled(true);
        }
    }

    function startEdit(messageId) {
        if (editingMessageId) return;

        const message = state.messages.find(
            (item) => item.id === messageId
        );

        if (
            !message ||
            message.sender !== (localStorage.getItem("helixLoggedIn") || "")
        ) {
            return;
        }

        const row = get("dm-message-list")?.querySelector(
            '[data-message-id="' + CSS.escape(messageId) + '"]'
        );
        const bubble = row?.querySelector(".dm-message-bubble");
        if (!bubble) return;

        editingMessageId = messageId;
        bubble.replaceChildren();

        const editor = document.createElement("textarea");
        editor.className = "dm-inline-editor";
        editor.value = message.text;
        editor.maxLength = 4000;
        editor.rows = Math.max(
            2,
            Math.min(6, message.text.split("\n").length + 1)
        );

        const actions = document.createElement("div");
        actions.className = "dm-inline-editor-actions";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "dm-inline-editor-button";
        cancel.textContent = "Cancel";
        cancel.dataset.dmEditAction = "cancel";

        const save = document.createElement("button");
        save.type = "button";
        save.className = "dm-inline-editor-button is-primary";
        save.textContent = "Save";
        save.dataset.dmEditAction = "save";

        actions.append(cancel, save);
        bubble.append(editor, actions);

        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
    }

    async function finishEdit(action) {
        if (!editingMessageId) return;

        const id = editingMessageId;
        const row = get("dm-message-list")?.querySelector(
            '[data-message-id="' + CSS.escape(id) + '"]'
        );
        const editor = row?.querySelector(".dm-inline-editor");
        const current = state.messages.find((item) => item.id === id);

        if (action === "cancel") {
            editingMessageId = null;
            render.renderMessageList();
            return;
        }

        const text = String(editor?.value || "").trim();

        if (!text) {
            showToast("Message cannot be empty.", "error");
            editor?.focus();
            return;
        }

        try {
            const updated = await api.editMessage(id, text);
            editingMessageId = null;
            updateMessage(updated);
        } catch (error) {
            showToast(
                error.message || "Could not edit that message.",
                "error"
            );
            editor?.focus();
            editingMessageId = current?.id || id;
        }
    }

    async function deleteMessage(messageId) {
        const message = state.messages.find(
            (item) => item.id === messageId
        );

        if (
            !message ||
            message.sender !== (localStorage.getItem("helixLoggedIn") || "")
        ) {
            return;
        }

        if (!window.confirm("Delete this message?")) return;

        try {
            await api.deleteMessage(messageId);
            window.HelixDMState.removeMessage(messageId);
            render.renderMessageList();
            render.renderStatus();
            await refreshConversations({ silent: true });
            await refreshPins();
            showToast("Message deleted.");
        } catch (error) {
            showToast(
                error.message || "Could not delete that message.",
                "error"
            );
        }
    }

    async function toggleReaction(messageId, emoji) {
        const message = state.messages.find(
            (item) => item.id === messageId
        );
        if (!message) return;

        const existing = (message.reactions || []).find(
            (item) => item.emoji === emoji
        );

        try {
            const updated = await api.setReaction(
                messageId,
                emoji,
                !existing?.reacted
            );
            updateMessage(updated);
        } catch (error) {
            showToast(
                error.message || "Could not update that reaction.",
                "error"
            );
        }
    }

    async function togglePin(messageId) {
        const message = state.messages.find(
            (item) => item.id === messageId
        );
        if (!message) return;

        try {
            const updated = await api.setPin(
                messageId,
                !message.isPinned
            );

            updateMessage(updated);
            await refreshPins();

            showToast(
                updated.isPinned
                    ? "Message pinned."
                    : "Message unpinned."
            );
        } catch (error) {
            showToast(
                error.message || "Could not update that pin.",
                "error"
            );
        }
    }

    async function copyMessage(messageId) {
        const message = state.messages.find(
            (item) => item.id === messageId
        );
        if (!message) return;

        try {
            await navigator.clipboard.writeText(message.text);
            showToast("Message copied.");
        } catch {
            showToast(
                "Clipboard access is unavailable in this browser.",
                "error"
            );
        }
    }

    function openEmojiPicker(messageId) {
        state.selectedMessageId = messageId;
        state.emojiPickerOpen = true;

        const picker = get("dm-emoji-picker");
        if (!picker) return;

        render.renderEmojiPicker();
        picker.hidden = false;

        get("dm-emoji-search")?.focus();
    }

    function closeEmojiPicker() {
        state.selectedMessageId = null;
        state.emojiPickerOpen = false;

        const picker = get("dm-emoji-picker");
        if (picker) picker.hidden = true;
    }

    async function refreshAndOpenPins() {
        if (!state.activeConversation) return;

        const panel = get("dm-pins-panel");
        if (!panel) return;

        panel.classList.add("is-open");
        panel.hidden = false;
        await refreshPins();
    }

    function closePins() {
        const panel = get("dm-pins-panel");
        if (!panel) return;

        panel.classList.remove("is-open");
        panel.hidden = true;
    }

    function openForwardModal(messageId) {
        state.forwardMessageId = messageId;
        state.forwardModalOpen = true;
        render.renderForwardModal();
    }

    function closeForwardModal() {
        state.forwardMessageId = null;
        state.forwardModalOpen = false;
        render.renderForwardModal();
    }

    async function forwardTo(username) {
        const messageId = state.forwardMessageId;
        if (!messageId) return;

        try {
            await api.forwardMessage(messageId, username);
            closeForwardModal();
            showToast("Message forwarded.");
            await refreshConversations({ silent: true });
        } catch (error) {
            showToast(
                error.message || "Could not forward that message.",
                "error"
            );
        }
    }

    async function renameConversation() {
        const username = state.activeConversation;
        if (!username) return;

        const conversation = state.conversations.find(
            (item) => item.username === username
        );
        if (!conversation) return;

        const current = conversation.nickname || "";
        const value = window.prompt(
            "Nickname for " + (conversation.displayName || username),
            current
        );

        if (value === null) return;

        const nickname = value.trim().replace(/s+/g, " ");

        if (nickname.length > 50) {
            showToast("Nickname must be 50 characters or fewer.", "error");
            return;
        }

        try {
            const saved = await api.setNickname(username, nickname);

            conversation.nickname = saved;
            render.renderConversationList();
            render.renderHeader();
            showToast(saved ? "Nickname saved." : "Nickname removed.");
        } catch (error) {
            showToast(
                error.message || "Could not update the nickname.",
                "error"
            );
        }
    }

    function handleMessageSearch(value) {
        state.messageSearch = String(value || "");
        render.renderMessages();
        render.renderStatus();

        if (state.messageSearch.trim()) {
            window.setTimeout(() => {
                const match = get("dm-message-list")?.querySelector(
                    ".dm-message-row"
                );
                match?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            }, 0);
        }
    }

    function clearMessageSearch() {
        state.messageSearch = "";
        const input = get("dm-message-search-input");
        if (input) input.value = "";
        render.renderMessages();
        render.renderStatus();
    }

    function bindEvents() {
        get("dm-conversation-search")?.addEventListener(
            "input",
            (event) => {
                state.conversationSearch = event.target.value;
                render.renderConversationList();
            }
        );

        get("dm-conversation-search-clear")?.addEventListener(
            "click",
            () => {
                state.conversationSearch = "";
                const input = get("dm-conversation-search");
                if (input) input.value = "";
                render.renderConversationList();
                input?.focus();
            }
        );

        get("dm-message-search-input")?.addEventListener(
            "input",
            (event) => handleMessageSearch(event.target.value)
        );

        get("dm-message-search-clear")?.addEventListener(
            "click",
            clearMessageSearch
        );

        get("dm-message-form")?.addEventListener(
            "submit",
            sendMessage
        );

        get("dm-conversation-list")?.addEventListener(
            "click",
            (event) => {
                const row = event.target.closest(".dm-conversation");
                if (!row) return;
                openConversation(row.dataset.username);
            }
        );

        get("dm-message-list")?.addEventListener(
            "click",
            async (event) => {
                const editButton = event.target.closest("[data-dm-edit-action]");
                if (editButton) {
                    await finishEdit(editButton.dataset.dmEditAction);
                    return;
                }

                const reaction = event.target.closest("[data-dm-reaction]");
                if (reaction) {
                    await toggleReaction(
                        reaction.dataset.messageId,
                        reaction.dataset.dmReaction
                    );
                    return;
                }

                const quickReaction =
                    event.target.closest("[data-dm-quick-reaction]");

                if (quickReaction) {
                    await toggleReaction(
                        quickReaction.dataset.messageId,
                        quickReaction.dataset.dmQuickReaction
                    );
                    return;
                }

                const pickerButton =
                    event.target.closest("[data-dm-emoji-picker]");

                if (pickerButton) {
                    openEmojiPicker(pickerButton.dataset.messageId);
                    return;
                }

                const action =
                    event.target.closest("[data-dm-action]");

                if (!action) return;

                const name = action.dataset.dmAction;

                if (name === "edit-message") {
                    startEdit(action.dataset.messageId);
                } else if (name === "delete-message") {
                    await deleteMessage(action.dataset.messageId);
                } else if (name === "copy-message") {
                    await copyMessage(action.dataset.messageId);
                } else if (name === "toggle-pin") {
                    await togglePin(action.dataset.messageId);
                } else if (name === "forward-message") {
                    openForwardModal(action.dataset.messageId);
                } else if (name === "retry-conversation") {
                    await refreshActiveConversation();
                } else if (name === "refresh-conversations") {
                    await refreshConversations();
                } else if (name === "jump-to-message") {
                    render.scrollToMessage(action.dataset.messageId);
                }
            }
        );

        get("dm-emoji-picker")?.addEventListener(
            "input",
            (event) => {
                if (event.target.id === "dm-emoji-search") {
                    render.filterEmojiPicker(event.target.value);
                }
            }
        );

        get("dm-emoji-picker")?.addEventListener(
            "click",
            async (event) => {
                const closeButton = event.target.closest("[data-dm-action=\"close-emoji-picker\"]");
                if (closeButton) {
                    closeEmojiPicker();
                    return;
                }

                const option = event.target.closest("[data-emoji]");
                if (!option) return;

                const messageId = state.selectedMessageId;
                if (!messageId) return;

                await toggleReaction(messageId, option.dataset.emoji);
                closeEmojiPicker();
            }
        );

        get("dm-pins-panel")?.addEventListener(
            "click",
            (event) => {
                const action = event.target.closest("[data-dm-action]");
                if (!action) return;

                if (action.dataset.dmAction === "close-pins") {
                    closePins();
                }

                if (action.dataset.dmAction === "jump-to-message") {
                    closePins();
                    render.scrollToMessage(action.dataset.messageId);
                }
            }
        );

        get("dm-pins-button")?.addEventListener(
            "click",
            refreshAndOpenPins
        );

        get("dm-nickname-button")?.addEventListener(
            "click",
            renameConversation
        );

        get("dm-pins-close")?.addEventListener(
            "click",
            closePins
        );

        get("dm-forward-modal")?.addEventListener(
            "click",
            (event) => {
                if (
                    event.target.closest("[data-dm-forward-close]")
                ) {
                    closeForwardModal();
                    return;
                }

                const target = event.target.closest(".dm-forward-target");
                if (target) {
                    forwardTo(target.dataset.username);
                }
            }
        );

        get("dm-mobile-back")?.addEventListener("click", () => {
            stopPolling();
            get("dm-view")?.classList.remove("dm-mobile-chat-open");
        });

        get("dm-refresh-button")?.addEventListener(
            "click",
            () => refreshConversations()
        );

        document.addEventListener("click", (event) => {
            const picker = get("dm-emoji-picker");

            if (
                state.emojiPickerOpen &&
                picker &&
                !picker.contains(event.target) &&
                !event.target.closest("[data-dm-emoji-picker]")
            ) {
                closeEmojiPicker();
            }

            const pins = get("dm-pins-panel");

            if (
                pins?.classList.contains("is-open") &&
                !pins.contains(event.target) &&
                !event.target.closest("#dm-pins-button")
            ) {
                closePins();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeEmojiPicker();
                closeForwardModal();
                closePins();
            }

            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                document.activeElement === get("dm-message-input")
            ) {
                event.preventDefault();
                get("dm-message-form")?.requestSubmit();
            }
        });
    }

    async function init() {
        if (state.initialized) return;

        state.initialized = true;
        render.renderEmojiPicker();
        render.renderForwardModal();
        bindEvents();
        render.renderAll();
        setComposerEnabled(false);
    }

    window.HelixDMActions = {
        init,
        refreshConversations,
        openConversation,
        stopPolling,
        refreshActiveConversation,
        closeEmojiPicker,
        closePins,
        closeForwardModal
    };
})();
