(() => {
    const state = window.HelixDMState.state;
    const api = window.HelixDMApi;
    const render = window.HelixDMRender;

    let sendInFlight = false;
    let forwardInFlight = false;
    let notificationTimer = null;
    let swipeState = null;

    const get = (id) => document.getElementById(id);

    function dmVisible() {
        const view = get("dm-view");
        return Boolean(view && !view.hidden);
    }

    function showToast(message, type = "info") {
        const existing = get("dm-toast");
        existing?.remove();

        const toast = document.createElement("div");
        toast.id = "dm-toast";
        toast.className =
            "dm-toast" + (type === "error" ? " is-error" : "");
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add("is-visible"));

        window.setTimeout(() => {
            toast.classList.remove("is-visible");
            window.setTimeout(() => toast.remove(), 180);
        }, 2300);
    }

    function currentConversation() {
        return state.conversations.find(
            (item) => item.username === state.activeConversation
        ) || null;
    }

    function currentMessage(messageId) {
        return state.messages.find(
            (item) => String(item.id) === String(messageId)
        ) || null;
    }

    function setComposerEnabled(enabled) {
        const input = get("dm-message-input");
        const send = get("dm-send-button");
        const attach = get("dm-attach-button");
        const emoji = get("dm-composer-emoji-button");

        const available =
            enabled &&
            Boolean(state.activeConversation) &&
            !state.loadingMessages;

        if (input) {
            input.disabled = !available;
        }

        if (send) {
            send.disabled = !available || sendInFlight;
        }

        if (attach) {
            attach.disabled = !available || sendInFlight;
        }

        if (emoji) {
            emoji.disabled = !available || sendInFlight;
        }
    }

    function updateNavUnread(unread) {
        const badge = get("dm-nav-unread");
        if (!badge) return;

        const value = Math.max(0, Number(unread || 0));

        if (!value) {
            badge.hidden = true;
            badge.textContent = "";
            badge.removeAttribute("aria-label");
            return;
        }

        badge.hidden = false;
        badge.textContent = value > 99 ? "99+" : String(value);
        badge.setAttribute(
            "aria-label",
            value + " unread direct " +
            (value === 1 ? "message" : "messages")
        );
    }

    function notificationSettings() {
        try {
            const raw = localStorage.getItem(
                "helixNotificationSettings:v2"
            );
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object"
                ? parsed
                : {};
        } catch {
            return {};
        }
    }

    async function refreshNotifications() {
        try {
            const data = await api.getNotifications();
            updateNavUnread(data.unread);

            if (typeof window.helixHandleNotificationFeed === "function") {
                window.helixHandleNotificationFeed(
                    data.messages,
                    data.unread
                );
            }

            const settings = notificationSettings();
            if (
                !settings["dm-alerts"] ||
                typeof Notification === "undefined" ||
                Notification.permission !== "granted"
            ) {
                return;
            }

            const currentUser =
                localStorage.getItem("helixLoggedIn") || "";

            for (const message of data.messages) {
                if (
                    !message?.id ||
                    state.notifiedMessageIds.has(String(message.id)) ||
                    message.sender === currentUser
                ) {
                    continue;
                }

                state.notifiedMessageIds.add(String(message.id));

                if (
                    dmVisible() &&
                    state.activeConversation === message.sender
                ) {
                    continue;
                }

                const body =
                    message.text ||
                    (message.mediaKind === "video"
                        ? "Video"
                        : message.mediaKind === "image"
                            ? "Photo"
                            : "New direct message");

                const notification = new Notification(
                    "Helix / " + message.sender,
                    {
                        body,
                        tag: "helix-dm-" + message.id
                    }
                );

                notification.onclick = () => {
                    window.focus();
                    openConversation(message.sender);
                    notification.close();
                };
            }
        } catch {
            // Notification refresh is intentionally best-effort.
        }
    }

    async function refreshConversations(options = {}) {
        if (state.conversationListRequestInFlight) return;

        state.conversationListRequestInFlight = true;
        const hadData = state.conversations.length > 0;
        const previousJson = JSON.stringify(state.conversations);

        if (!options.silent) {
            state.loadingConversations = true;
            state.conversationError = "";
            render.renderConversationList();
        }

        try {
            const conversations = await api.getConversations();

            state.conversations = conversations;
            state.conversationError = "";

            if (
                state.activeConversation &&
                !state.conversations.some(
                    (item) => item.username === state.activeConversation
                )
            ) {
                stopPolling();
                window.HelixDMState.clearActiveConversation();
                get("dm-view")?.classList.remove(
                    "dm-mobile-chat-open"
                );
            }
        } catch (error) {
            if (!options.silent || !hadData) {
                state.conversationError =
                    error.message ||
                    "Could not load your conversations.";
            }
        } finally {
            state.loadingConversations = false;
            state.conversationListRequestInFlight = false;

            const changed =
                previousJson !== JSON.stringify(state.conversations);

            if (!options.silent || changed) {
                render.renderConversationList();
                render.renderHeader();
                render.renderMessages();
                render.renderMessageStatus();
                render.renderInfoPanel();
                setComposerEnabled(Boolean(state.activeConversation));
            }
        }
    }

    function stopPolling() {
        if (state.pollTimer) {
            window.clearInterval(state.pollTimer);
            state.pollTimer = null;
        }

        if (notificationTimer) {
            window.clearInterval(notificationTimer);
            notificationTimer = null;
        }

        state.pollInFlight = false;
    }

    function startPolling() {
        stopPolling();

        state.pollTimer = window.setInterval(async () => {
            if (
                !dmVisible() ||
                !state.activeConversation ||
                state.pollInFlight ||
                state.loadingMessages
            ) {
                return;
            }

            await refreshActiveConversation({
                silent: true,
                preserveScroll: true
            });

            if (dmVisible() && state.activeConversation) {
                await refreshConversations({ silent: true });
            }
        }, 5000);

        notificationTimer = window.setInterval(
            refreshNotifications,
            5000
        );
    }

    async function refreshPins() {
        if (!state.activeConversation) return;

        const username = state.activeConversation;

        state.loadingPins = true;
        render.renderPinnedPanel();

        try {
            const pins = await api.getPins(username);

            if (username === state.activeConversation) {
                state.pinnedMessages = pins;
            }
        } catch (error) {
            if (username === state.activeConversation) {
                showToast(
                    error.message ||
                    "Could not load pinned messages.",
                    "error"
                );
            }
        } finally {
            if (username === state.activeConversation) {
                state.loadingPins = false;
                render.renderPinnedPanel();
            }
        }
    }

    async function loadReferencedMessage(messageId) {
        if (!messageId) return null;

        const local = currentMessage(messageId);
        if (local) return local;

        try {
            return await api.getMessage(messageId);
        } catch {
            return null;
        }
    }

    async function scrollToReferencedMessage(messageId) {
        if (!messageId) return;

        const visibleInDom = render.scrollToMessage(messageId);

        if (visibleInDom) {
            return;
        }

        const target = await loadReferencedMessage(messageId);

        if (!target) {
            showToast(
                "The original message is no longer available.",
                "error"
            );
            return;
        }

        // A loaded original can still be hidden by active message search.
        // Clear the filter so the referenced row is actually renderable.
        if (state.messageSearch) {
            state.messageSearch = "";
            const search = get("dm-message-search-input");
            if (search) search.value = "";
        }

        window.HelixDMState.replaceMessage(target);
        render.renderMessages();
        render.renderMessageStatus();

        requestAnimationFrame(() => {
            render.scrollToMessage(messageId);
        });
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
            render.renderMessageStatus();
            setComposerEnabled(true);
        }

        const list = get("dm-message-list");
        const preservedScrollTop = list?.scrollTop || 0;
        const nearBottom =
            Boolean(list) &&
            list.scrollHeight -
                list.scrollTop -
                list.clientHeight <
            90;

        try {
            const messages = await api.getMessages(
                username,
                controller.signal
            );

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
            render.renderMessageStatus();
            render.renderInfoPanel();

            if (options.preserveScroll && list && !nearBottom) {
                requestAnimationFrame(() => {
                    if (
                        serial === state.conversationRequestSerial &&
                        username === state.activeConversation
                    ) {
                        list.scrollTop = preservedScrollTop;
                    }
                });
            } else if (!options.silent || nearBottom) {
                render.scrollToBottom(Boolean(!options.silent));
            }
        } catch (error) {
            if (error?.name === "AbortError") {
                return;
            }

            if (
                serial !== state.conversationRequestSerial ||
                username !== state.activeConversation
            ) {
                return;
            }

            if (options.silent) {
                console.warn(
                    "Helix DM background refresh failed:",
                    error?.message || error
                );
                return;
            }

            state.loadingMessages = false;
            state.messageError =
                error.message ||
                "Could not load this conversation.";

            render.renderMessages();
            render.renderMessageStatus();
        } finally {
            if (serial === state.conversationRequestSerial) {
                state.conversationAbortController = null;
                state.pollInFlight = false;
                setComposerEnabled(
                    Boolean(state.activeConversation)
                );
            }
        }

        if (
            serial === state.conversationRequestSerial &&
            username === state.activeConversation &&
            !options.silent
        ) {
            await refreshPins();
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
        state.infoError = "";
        state.info = null;
        state.loadingMessages = true;
        state.messageSearch = "";
        state.selectedMessageId = null;
        state.infoPanelOpen = false;

        state.contextMenu.open = false;
        state.contextMenu.messageId = null;
        state.forwardPanelOpen = false;
        state.forwardMessageId = null;
        state.mediaViewerOpen = false;
        state.mediaViewerMessageId = null;

        window.HelixDMState.clearReply();
        window.HelixDMState.clearAttachment();

        const mediaInput = get("dm-media-input");
        if (mediaInput) mediaInput.value = "";

        const search = get("dm-message-search-input");
        if (search) search.value = "";

        get("dm-view")?.classList.add(
            "dm-mobile-chat-open"
        );

        state.conversationRequestSerial += 1;
        state.conversationAbortController?.abort();

        render.renderAll();
        render.renderComposerState?.();
        setComposerEnabled(true);

        await refreshActiveConversation();
        await refreshNotifications();
        startPolling();

        get("dm-message-input")?.focus();
    }

    function syncReplyReferences(updated) {
        if (!updated?.id) return;

        state.messages.forEach((message) => {
            if (
                String(message.replyToId || "") !==
                String(updated.id)
            ) {
                return;
            }

            message.replySender = updated.sender || null;
            message.replyText = updated.isDeleted
                ? null
                : updated.text || null;
            message.replyMediaUrl = updated.mediaUrl || null;
            message.replyMediaName = updated.mediaName || null;
            message.replyMediaKind = updated.mediaKind || null;
            message.replyDeleted = Boolean(updated.isDeleted);

            message.replyPreview = {
                id: updated.id,
                sender: updated.sender || "",
                text: updated.isDeleted
                    ? null
                    : updated.text || "",
                mediaUrl: updated.mediaUrl || null,
                mediaName: updated.mediaName || null,
                mediaKind: updated.mediaKind || null,
                deleted: Boolean(updated.isDeleted)
            };
        });
    }

    function updateMessage(message) {
        if (!message?.id) return;

        window.HelixDMState.replaceMessage(message);
        syncReplyReferences(message);
        render.renderMessages();
        render.renderMessageStatus();
    }

    function selectReply(message) {
        if (!message?.id) return;

        state.reply = {
            id: String(message.id),
            sender: message.sender || "",
            recipient: message.recipient || "",
            text: message.text || "",
            mediaUrl: message.mediaUrl || null,
            mediaName: message.mediaName || null,
            mediaKind: message.mediaKind || null
        };

        state.contextMenu.open = false;
        render.renderContextMenu();

        render.renderComposerState?.();

        get("dm-message-input")?.focus();
    }

    function cancelReply() {
        window.HelixDMState.clearReply();
        render.renderComposerState?.();

        const input = get("dm-message-input");
        input?.focus();
    }

    async function sendMessage(event) {
        event?.preventDefault();

        if (
            sendInFlight ||
            !state.activeConversation
        ) {
            return;
        }

        const input = get("dm-message-input");
        const typedText = String(input?.value || "").trim();
        const attachment = state.pendingAttachment;

        if (!typedText && !attachment) {
            input?.focus();
            return;
        }

        const recipient = state.activeConversation;

        // Capture reply state before any await/network operation.
        const selectedReply = state.reply
            ? { ...state.reply }
            : null;

        const replyToId = selectedReply?.id || null;
        const replySource = selectedReply;

        // Capture the attachment reference before the request.
        const attachmentSnapshot = attachment
            ? { ...attachment }
            : null;

        sendInFlight = true;
        setComposerEnabled(true);

        try {
            let sentMessage;

            if (attachmentSnapshot?.file) {
                const dataUrl =
                    await fileToDataUrl(
                        attachmentSnapshot.file
                    );

                const media = {
                    dataUrl,
                    name: attachmentSnapshot.name,
                    size: attachmentSnapshot.size,
                    mime: attachmentSnapshot.mime
                };

                sentMessage =
                    await api.sendMediaMessage({
                        username: recipient,
                        text: typedText,
                        replyToId,
                        media
                    });
            } else {
                sentMessage = await api.sendMessage(
                    recipient,
                    typedText,
                    replyToId
                );
            }

            if (!sentMessage?.id) {
                throw new Error(
                    "Helix did not return the created message."
                );
            }

            // The API is authoritative, but the exact captured reply
            // snapshot gives immediate rendering if any preview fields
            // are omitted by a stale server during deployment.
            if (replyToId && replySource) {
                sentMessage.replyToId =
                    sentMessage.replyToId ||
                    replyToId;
                sentMessage.replySender =
                    sentMessage.replySender ||
                    replySource.sender ||
                    null;
                sentMessage.replyText =
                    sentMessage.replyText ??
                    replySource.text ??
                    null;
                sentMessage.replyMediaUrl =
                    sentMessage.replyMediaUrl ||
                    replySource.mediaUrl ||
                    null;
                sentMessage.replyMediaName =
                    sentMessage.replyMediaName ||
                    replySource.mediaName ||
                    null;
                sentMessage.replyMediaKind =
                    sentMessage.replyMediaKind ||
                    replySource.mediaKind ||
                    null;
                sentMessage.replyDeleted = Boolean(
                    sentMessage.replyDeleted
                );
                sentMessage.replyPreview =
                    sentMessage.replyPreview || {
                        id: replyToId,
                        sender: replySource.sender || "",
                        text: replySource.text || "",
                        mediaUrl:
                            replySource.mediaUrl || null,
                        mediaName:
                            replySource.mediaName || null,
                        mediaKind:
                            replySource.mediaKind || null,
                        deleted: false
                    };
            }

            updateMessage(sentMessage);
            render.scrollToBottom(true);

            // Only clear transient reply/attachment state AFTER
            // the final message object has rendered.
            window.HelixDMState.clearReply();
            window.HelixDMState.clearAttachment();

            const mediaInput = get("dm-media-input");
            if (mediaInput) mediaInput.value = "";

            render.renderComposerState?.();

            if (input) {
                input.value = "";
            }

            await refreshConversations({ silent: true });

            if (
                state.activeConversation === recipient &&
                state.conversationRequestSerial > 0
            ) {
                await refreshActiveConversation({
                    silent: true,
                    preserveScroll: true
                });
            }

            await refreshNotifications();
        } catch (error) {
            showToast(
                error.message || "Could not send your message.",
                "error"
            );
            input?.focus();
            render.renderComposerState?.();
        } finally {
            sendInFlight = false;
            setComposerEnabled(Boolean(state.activeConversation));
        }
    }

    async function handleEditSave(messageId, text) {
        const trimmed = String(text || "").trim();

        if (!trimmed) {
            showToast("Message cannot be empty.", "error");
            return;
        }

        try {
            const updated = await api.editMessage(
                messageId,
                trimmed
            );

            state.editingMessageId = null;
            updateMessage(updated);
        } catch (error) {
            showToast(
                error.message ||
                "Could not edit that message.",
                "error"
            );
            render.renderMessages();
        }
    }

    function beginEdit(messageId) {
        const message = currentMessage(messageId);

        if (!message) return;

        if (
            message.sender !==
            (localStorage.getItem("helixLoggedIn") || "")
        ) {
            return;
        }

        if (message.mediaUrl || message.isDeleted) {
            showToast(
                "Only active text messages can be edited.",
                "error"
            );
            return;
        }

        state.editingMessageId = String(message.id);
        state.contextMenu.open = false;
        render.renderContextMenu();
        render.renderMessages();

        requestAnimationFrame(() => {
            const editor =
                get("dm-message-list")
                    ?.querySelector(
                        '[data-edit-message-id="' +
                        CSS.escape(String(message.id)) +
                        '"]'
                    );

            editor?.focus();
            editor?.setSelectionRange(
                editor.value.length,
                editor.value.length
            );
        });
    }

    async function deleteMessage(messageId) {
        const message = currentMessage(messageId);

        if (!message) return;

        if (
            message.sender !==
            (localStorage.getItem("helixLoggedIn") || "")
        ) {
            showToast(
                "You can only delete your own messages.",
                "error"
            );
            return;
        }

        if (
            !window.confirm(
                "Delete this message?"
            )
        ) {
            return;
        }

        try {
            await api.deleteMessage(messageId);

            if (
                state.reply &&
                String(state.reply.id) ===
                String(messageId)
            ) {
                cancelReply();
            }

            await refreshActiveConversation({
                preserveScroll: true
            });
            await refreshPins();
            await refreshConversations({
                silent: true
            });
        } catch (error) {
            showToast(
                error.message ||
                "Could not delete that message.",
                "error"
            );
        }
    }

    async function toggleReaction(messageId, emoji) {
        const message = currentMessage(messageId);
        if (!message) return;

        const current =
            (message.reactions || []).find(
                (reaction) =>
                    reaction.emoji === emoji
            );

        try {
            const updated = await api.setReaction(
                messageId,
                emoji,
                !current?.reacted
            );

            updateMessage(updated);
        } catch (error) {
            showToast(
                error.message ||
                "Could not update that reaction.",
                "error"
            );
        }
    }

    async function togglePin(messageId) {
        const message = currentMessage(messageId);
        if (!message || message.isDeleted) return;

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
                error.message ||
                "Could not update that pin.",
                "error"
            );
        }
    }

    async function copyMessage(messageId) {
        const message = currentMessage(messageId);

        if (!message || message.isDeleted) return;

        try {
            if (message.text) {
                await navigator.clipboard.writeText(
                    message.text
                );
                showToast("Message copied.");
                return;
            }

            if (message.mediaUrl) {
                const absolute =
                    new URL(
                        message.mediaUrl,
                        window.location.href
                    ).href;

                await navigator.clipboard.writeText(
                    absolute
                );
                showToast(
                    message.mediaKind === "video"
                        ? "Video link copied."
                        : "Photo link copied."
                );
            }
        } catch {
            showToast(
                "Clipboard access is unavailable in this browser.",
                "error"
            );
        }
    }

    function insertEmoji(emoji) {
        const input = get("dm-message-input");
        if (!input) return;

        const value = input.value || "";
        const start =
            typeof input.selectionStart === "number"
                ? input.selectionStart
                : value.length;
        const end =
            typeof input.selectionEnd === "number"
                ? input.selectionEnd
                : value.length;

        input.value =
            value.slice(0, start) +
            emoji +
            value.slice(end);

        const next =
            start + emoji.length;

        input.focus();
        input.setSelectionRange(next, next);

        render.renderComposerState?.();
    }

    function openEmojiPicker(messageId = null) {
        state.emojiPickerOpen = true;
        state.emojiTargetMessageId =
            messageId
                ? String(messageId)
                : null;
        state.emojiSearch = "";
        state.emojiCategory =
            "Smileys & People";

        render.renderEmojiPicker();
        render.renderComposerState?.();

        requestAnimationFrame(() => {
            get("dm-emoji-search")?.focus();
        });
    }

    function closeEmojiPicker() {
        state.emojiPickerOpen = false;
        state.emojiTargetMessageId = null;
        state.emojiSearch = "";

        const picker = get("dm-emoji-picker");
        if (picker) picker.hidden = true;
    }

    async function openPinnedPanel() {
        if (!state.activeConversation) return;

        closeContextMenu();
        closeForwardPanel();
        closeEmojiPicker();

        const panel = get("dm-pins-panel");
        if (!panel) return;

        panel.classList.add("is-open");
        panel.hidden = false;

        await refreshPins();
    }

    function closePinnedPanel() {
        const panel = get("dm-pins-panel");
        if (!panel) return;

        panel.classList.remove("is-open");
        panel.hidden = true;
    }

    async function openForwardPanel(messageId) {
        if (!currentMessage(messageId)) return;

        closeContextMenu();
        closeEmojiPicker();
        closePinnedPanel();

        state.forwardMessageId = String(messageId);
        state.forwardPanelOpen = true;
        render.renderForwardPanel();
    }

    function closeForwardPanel() {
        state.forwardMessageId = null;
        state.forwardPanelOpen = false;
        render.renderForwardPanel();
    }

    async function forwardTo(username) {
        if (
            forwardInFlight ||
            !state.forwardMessageId
        ) {
            return;
        }

        forwardInFlight = true;
        render.renderForwardPanel();

        try {
            await api.forwardMessage(
                state.forwardMessageId,
                username
            );

            closeForwardPanel();
            showToast("Message forwarded.");
            await refreshConversations({
                silent: true
            });
        } catch (error) {
            showToast(
                error.message ||
                "Could not forward that message.",
                "error"
            );
            render.renderForwardPanel();
        } finally {
            forwardInFlight = false;
            render.renderForwardPanel();
        }
    }

    async function openInfoPanel() {
        if (!state.activeConversation) return;

        closeContextMenu();
        closeForwardPanel();
        closeEmojiPicker();
        closePinnedPanel();

        state.infoPanelOpen = true;
        state.loadingInfo = true;
        state.infoError = "";

        render.renderInfoPanel();

        try {
            state.info =
                await api.getConversationInfo(
                    state.activeConversation
                );
            state.infoError = "";
        } catch (error) {
            state.infoError =
                error.message ||
                "Could not load conversation info.";
        } finally {
            state.loadingInfo = false;
            render.renderInfoPanel();
        }
    }

    function closeInfoPanel() {
        state.infoPanelOpen = false;
        state.info = null;
        state.infoError = "";
        state.loadingInfo = false;
        render.renderInfoPanel();
    }

    async function openMedia(messageId) {
        let message = currentMessage(messageId);

        if (!message) {
            try {
                message = await api.getMessage(messageId);
                if (message) {
                    window.HelixDMState.replaceMessage(message);
                }
            } catch {
                message = null;
            }
        }

        if (!message?.mediaUrl) {
            showToast(
                "That media is no longer available.",
                "error"
            );
            return;
        }

        state.mediaViewerMessageId = String(messageId);
        state.mediaViewerOpen = true;

        closeContextMenu();
        render.renderMediaViewer();
    }

    function closeMedia() {
        state.mediaViewerOpen = false;
        state.mediaViewerMessageId = null;
        render.renderMediaViewer();
    }

    function openContextMenu(messageId, x, y) {
        const message = currentMessage(messageId);

        if (!message || message.isDeleted) {
            return;
        }

        closeEmojiPicker();
        closePinnedPanel();
        closeForwardPanel();
        closeInfoPanel();

        state.contextMenu = {
            open: true,
            messageId: String(messageId),
            x: Number(x || 0),
            y: Number(y || 0)
        };

        render.renderContextMenu();
    }

    function closeContextMenu() {
        state.contextMenu.open = false;
        state.contextMenu.messageId = null;
        render.renderContextMenu();
    }

    async function contextAction(action, messageId) {
        const message = currentMessage(messageId);
        if (!message) return;

        closeContextMenu();

        if (action === "reply") {
            selectReply(message);
        } else if (action === "edit-message") {
            beginEdit(message.id);
        } else if (action === "delete-message") {
            await deleteMessage(message.id);
        } else if (action === "react") {
            openEmojiPicker(message.id);
        } else if (action === "copy-message") {
            await copyMessage(message.id);
        } else if (action === "forward-message") {
            await openForwardPanel(message.id);
        } else if (action === "toggle-pin") {
            await togglePin(message.id);
        } else if (action === "open-media") {
            openMedia(message.id);
        }
    }

    async function handleFileSelection(event) {
        const file = event.target.files?.[0];
        const input = event.target;

        state.attachmentError = "";
        render.renderComposerState?.();

        if (!file) return;

        if (
            !file.type.startsWith("image/") &&
            !file.type.startsWith("video/")
        ) {
            state.attachmentError =
                "Only photos and videos can be attached.";
            window.HelixDMState.clearAttachment();
            input.value = "";
            render.renderComposerState?.();
            showToast(state.attachmentError, "error");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            state.attachmentError =
                "That attachment is larger than 10 MB.";
            window.HelixDMState.clearAttachment();
            input.value = "";
            render.renderComposerState?.();
            showToast(state.attachmentError, "error");
            return;
        }

        window.HelixDMState.clearAttachment();

        state.pendingAttachment = {
            file,
            name: file.name,
            size: file.size,
            mime: file.type,
            kind: file.type.startsWith("video/")
                ? "video"
                : "image",
            previewUrl: URL.createObjectURL(file)
        };

        render.renderComposerState?.();
        get("dm-message-input")?.focus();
    }

    async function handleReplyReferenceClick(messageId) {
        await scrollToReferencedMessage(messageId);
    }

    function handleMessageSearch(value) {
        state.messageSearch = String(value || "");
        render.renderMessages();
        render.renderMessageStatus();
    }

    function clearMessageSearch() {
        state.messageSearch = "";
        const input = get("dm-message-search-input");
        if (input) input.value = "";
        render.renderMessages();
        render.renderMessageStatus();
    }

    function startNewMessage() {
        state.conversationFilter = "all";
        state.conversationSearch = "";

        const search = get("dm-conversation-search");
        if (search) {
            search.value = "";
        }

        get("dm-view")?.classList.remove("dm-mobile-chat-open");
        render.renderConversationList();

        requestAnimationFrame(() => search?.focus());
    }

    function handleConversationFilter(filter) {
        const allowed = new Set(["all", "unread", "requests"]);
        state.conversationFilter = allowed.has(filter)
            ? filter
            : "all";
        render.renderConversationList();
    }

    function bindEvents() {
        get("dm-new-message-button")?.addEventListener(
            "click",
            openNicknameModal
        );

        document.querySelectorAll(
            "[data-dm-conversation-filter]"
        ).forEach((button) => {
            button.addEventListener("click", () => {
                handleConversationFilter(
                    button.dataset.dmConversationFilter
                );
            });
        });

        get("dm-conversation-search")?.addEventListener(
            "input",
            (event) => {
                state.conversationSearch =
                    event.target.value;
                render.renderConversationList();
            }
        );

        get("dm-conversation-search-clear")?.addEventListener(
            "click",
            () => {
                state.conversationSearch = "";
                const input =
                    get("dm-conversation-search");
                if (input) input.value = "";
                render.renderConversationList();
                input?.focus();
            }
        );

        get("dm-message-search-input")?.addEventListener(
            "input",
            (event) =>
                handleMessageSearch(event.target.value)
        );

        get("dm-message-search-clear")?.addEventListener(
            "click",
            clearMessageSearch
        );

        get("dm-message-form")?.addEventListener(
            "submit",
            sendMessage
        );

        get("dm-message-input")?.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key !== "Enter" ||
                    event.shiftKey ||
                    event.isComposing
                ) {
                    return;
                }

                event.preventDefault();

                const form = get("dm-message-form");

                if (form?.requestSubmit) {
                    form.requestSubmit();
                } else {
                    sendMessage(event);
                }
            }
        );

        get("dm-conversation-list")?.addEventListener(
            "click",
            (event) => {
                const row =
                    event.target.closest(
                        ".dm-conversation"
                    );

                if (!row) return;

                openConversation(
                    row.dataset.username
                );
            }
        );

        get("dm-message-list")?.addEventListener(
            "click",
            async (event) => {
                const replyReference =
                    event.target.closest(
                        ".dm-reply-reference"
                    );

                if (replyReference) {
                    await handleReplyReferenceClick(
                        replyReference.dataset
                            .replyMessageId
                    );
                    return;
                }

                const editAction =
                    event.target.closest(
                        "[data-dm-edit-action]"
                    );

                if (editAction) {
                    const messageId =
                        editAction.dataset.messageId;

                    if (
                        editAction.dataset.dmEditAction ===
                        "save"
                    ) {
                        const editor =
                            get("dm-message-list")
                                ?.querySelector(
                                    '[data-edit-message-id="' +
                                    CSS.escape(messageId) +
                                    '"]'
                                );

                        await handleEditSave(
                            messageId,
                            editor?.value || ""
                        );
                    } else {
                        state.editingMessageId = null;
                        render.renderMessages();
                    }

                    return;
                }

                const reaction =
                    event.target.closest(
                        "[data-dm-reaction]"
                    );

                if (reaction) {
                    await toggleReaction(
                        reaction.dataset.messageId,
                        reaction.dataset.dmReaction
                    );
                    return;
                }

                const quickReaction =
                    event.target.closest(
                        "[data-dm-quick-reaction]"
                    );

                if (quickReaction) {
                    await toggleReaction(
                        quickReaction.dataset.messageId,
                        quickReaction.dataset.dmQuickReaction
                    );
                    return;
                }

                const pickerButton =
                    event.target.closest(
                        "[data-dm-emoji-picker]"
                    );

                if (pickerButton) {
                    openEmojiPicker(
                        pickerButton.dataset.messageId
                    );
                    return;
                }

                const action =
                    event.target.closest(
                        "[data-dm-action]"
                    );

                if (action) {
                    const name =
                        action.dataset.dmAction;

                    if (name === "reply") {
                        selectReply(
                            currentMessage(
                                action.dataset.messageId
                            )
                        );
                    } else if (name === "edit-message") {
                        beginEdit(
                            action.dataset.messageId
                        );
                    } else if (name === "delete-message") {
                        await deleteMessage(
                            action.dataset.messageId
                        );
                    } else if (name === "copy-message") {
                        await copyMessage(
                            action.dataset.messageId
                        );
                    } else if (name === "toggle-pin") {
                        await togglePin(
                            action.dataset.messageId
                        );
                    } else if (
                        name === "unpin-message"
                    ) {
                        await togglePin(
                            action.dataset.messageId
                        );
                    } else if (
                        name === "forward-message"
                    ) {
                        await openForwardPanel(
                            action.dataset.messageId
                        );
                    } else if (
                        name === "context-menu"
                    ) {
                        const rect =
                            action.getBoundingClientRect();

                        openContextMenu(
                            action.dataset.messageId,
                            rect.right + 6,
                            rect.top
                        );
                    } else if (
                        name === "open-media"
                    ) {
                        openMedia(
                            action.dataset.messageId
                        );
                    } else if (
                        name === "jump-to-message"
                    ) {
                        await scrollToReferencedMessage(
                            action.dataset.messageId
                        );
                    } else if (
                        name === "close-emoji-picker"
                    ) {
                        closeEmojiPicker();
                    }
                }
            }
        );

        get("dm-message-list")?.addEventListener(
            "contextmenu",
            (event) => {
                const row =
                    event.target.closest(
                        ".dm-message-row"
                    );

                if (!row) return;

                event.preventDefault();

                openContextMenu(
                    row.dataset.messageId,
                    event.clientX,
                    event.clientY
                );
            }
        );

        get("dm-message-list")?.addEventListener(
            "keydown",
            (event) => {
                const reference =
                    event.target.closest(
                        ".dm-reply-reference"
                    );

                if (
                    reference &&
                    (event.key === "Enter" ||
                        event.key === " ")
                ) {
                    event.preventDefault();
                    handleReplyReferenceClick(
                        reference.dataset
                            .replyMessageId
                    );
                    return;
                }

                const contextActionButton =
                    event.target.closest(
                        "[data-dm-context-action]"
                    );

                if (
                    contextActionButton &&
                    event.key === "Enter"
                ) {
                    event.preventDefault();
                    contextAction(
                        contextActionButton.dataset
                            .dmContextAction,
                        contextActionButton.dataset
                            .messageId
                    );
                }
            }
        );

        get("dm-emoji-picker")?.addEventListener(
            "input",
            (event) => {
                if (
                    event.target.id ===
                    "dm-emoji-search"
                ) {
                    render.filterEmojiPicker(
                        event.target.value
                    );
                }
            }
        );

        get("dm-emoji-picker")?.addEventListener(
            "click",
            async (event) => {
                const categoryButton =
                    event.target.closest(
                        "[data-dm-emoji-category]"
                    );

                if (categoryButton) {
                    const category =
                        categoryButton.dataset.dmEmojiCategory ||
                        "All";

                    if (typeof render.setEmojiPickerCategory === "function") {
                        render.setEmojiPickerCategory(category);
                    } else {
                        state.emojiCategory = category;
                        state.emojiSearch = "";
                        render.renderEmojiPicker();
                    }

                    return;
                }
                const close =
                    event.target.closest(
                        "[data-dm-action=\"close-emoji-picker\"]"
                    );

                if (close) {
                    closeEmojiPicker();
                    return;
                }

                const option =
                    event.target.closest(
                        "[data-emoji]"
                    );

                if (!option) return;

                const emoji =
                    option.dataset.emoji;

                if (state.emojiTargetMessageId) {
                    await toggleReaction(
                        state.emojiTargetMessageId,
                        emoji
                    );
                    closeEmojiPicker();
                } else {
                    insertEmoji(emoji);
                    closeEmojiPicker();
                }
            }
        );

        get("dm-pins-button")?.addEventListener(
            "click",
            openPinnedPanel
        );

        get("dm-pins-close")?.addEventListener(
            "click",
            closePinnedPanel
        );

        get("dm-pins-panel")?.addEventListener(
            "keydown",
            async (event) => {
                const row = event.target.closest('[data-dm-action="jump-to-message"]');

                if (
                    row &&
                    (event.key === "Enter" || event.key === " ")
                ) {
                    event.preventDefault();
                    await scrollToReferencedMessage(row.dataset.messageId);
                }
            }
        );

        get("dm-pins-panel")?.addEventListener(
            "click",
            async (event) => {
                const action =
                    event.target.closest("[data-dm-action]");

                if (!action) return;

                const name = action.dataset.dmAction;

                if (name === "jump-to-message") {
                    await scrollToReferencedMessage(
                        action.dataset.messageId
                    );
                } else if (name === "unpin-message") {
                    await togglePin(action.dataset.messageId);
                }
            }
        );

        get("dm-info-button")?.addEventListener(
            "click",
            openInfoPanel
        );

        get("dm-info-panel")?.addEventListener(
            "click",
            async (event) => {
                const action =
                    event.target.closest("[data-dm-action]");

                if (!action) return;

                if (action.dataset.dmAction === "open-media") {
                    openMedia(action.dataset.messageId);
                } else if (
                    action.dataset.dmAction === "private-nickname"
                ) {
                    openNicknameModal();
                } else if (action.dataset.dmAction === "close-info") {
                    closeInfoPanel();
                } else if (action.dataset.dmAction === "retry-info") {
                    await openInfoPanel();
                }
            }
        );

        get("dm-nickname-button")?.addEventListener(
            "click",
            openNicknameModal
        );

        get("dm-info-nickname-button")?.addEventListener(
            "click",
            openNicknameModal
        );

        get("dm-attach-button")?.addEventListener(
            "click",
            () => get("dm-media-input")?.click()
        );

        get("dm-media-input")?.addEventListener(
            "change",
            handleFileSelection
        );

        get("dm-media-preview-remove")?.addEventListener(
            "click",
            () => {
                window.HelixDMState.clearAttachment();
                const input =
                    get("dm-media-input");
                if (input) input.value = "";
                render.renderComposerState?.();
                get("dm-message-input")?.focus();
            }
        );

        get("dm-composer-emoji-button")?.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (state.emojiPickerOpen) {
                    closeEmojiPicker();
                } else {
                    openEmojiPicker();
                }
            }
        );

        get("dm-reply-cancel")?.addEventListener(
            "click",
            cancelReply
        );

        get("dm-reply-bar")?.addEventListener(
            "click",
            async (event) => {
                if (
                    event.target.closest(
                        "#dm-reply-cancel"
                    )
                ) {
                    return;
                }

                const messageId =
                    state.reply?.id;

                if (messageId) {
                    await scrollToReferencedMessage(
                        messageId
                    );
                }
            }
        );

        get("dm-forward-modal")?.addEventListener(
            "click",
            async (event) => {
                if (
                    event.target.closest(
                        "[data-dm-forward-close]"
                    )
                ) {
                    closeForwardPanel();
                    return;
                }

                const target =
                    event.target.closest(
                        ".dm-forward-target"
                    );

                if (target) {
                    await forwardTo(
                        target.dataset.username
                    );
                }
            }
        );

        get("dm-media-viewer")?.addEventListener(
            "click",
            (event) => {
                if (
                    event.target.closest(
                        "[data-dm-action=\"close-media\"]"
                    )
                ) {
                    closeMedia();
                }
            }
        );

        get("dm-context-menu")?.addEventListener(
            "click",
            async (event) => {
                const action =
                    event.target.closest(
                        "[data-dm-context-action]"
                    );

                if (!action) return;

                await contextAction(
                    action.dataset.dmContextAction,
                    action.dataset.messageId
                );
            }
        );

        get("dm-nickname-modal")?.addEventListener(
            "click",
            (event) => {
                if (
                    event.target.closest(
                        "[data-dm-nickname-close]"
                    )
                ) {
                    closeNicknameModal();
                }
            }
        );

        get("dm-nickname-friend")?.addEventListener(
            "change",
            renderNicknameForm
        );

        get("dm-nickname-form")?.addEventListener(
            "submit",
            saveNickname
        );

        get("dm-nickname-remove")?.addEventListener(
            "click",
            removeNickname
        );

        get("dm-mobile-back")?.addEventListener(
            "click",
            () => {
                stopPolling();
                get("dm-view")?.classList.remove(
                    "dm-mobile-chat-open"
                );
            }
        );

        get("dm-refresh-button")?.addEventListener(
            "click",
            () => refreshConversations()
        );

        document.addEventListener(
            "click",
            (event) => {
                const picker =
                    get("dm-emoji-picker");

                if (
                    state.emojiPickerOpen &&
                    picker &&
                    !picker.contains(event.target) &&
                    !event.target.closest(
                        "[data-dm-emoji-picker]"
                    ) &&
                    !event.target.closest(
                        "#dm-composer-emoji-button"
                    )
                ) {
                    closeEmojiPicker();
                }

                const context =
                    get("dm-context-menu");

                if (
                    state.contextMenu.open &&
                    context &&
                    !context.contains(event.target) &&
                    !event.target.closest(
                        "[data-dm-action=\"context-menu\"]"
                    )
                ) {
                    closeContextMenu();
                }

                const pins =
                    get("dm-pins-panel");

                if (
                    pins?.classList.contains("is-open") &&
                    !pins.contains(event.target) &&
                    !event.target.closest(
                        "#dm-pins-button"
                    )
                ) {
                    closePinnedPanel();
                }
            }
        );

        document.addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Escape") {
                    if (state.contextMenu.open) {
                        closeContextMenu();
                    } else if (state.emojiPickerOpen) {
                        closeEmojiPicker();
                    } else if (state.forwardPanelOpen) {
                        closeForwardPanel();
                    } else if (state.infoPanelOpen) {
                        closeInfoPanel();
                    } else if (state.mediaViewerOpen) {
                        closeMedia();
                    } else if (state.reply) {
                        cancelReply();
                    }
                }
            }
        );

        const messageList =
            get("dm-message-list");

        messageList?.addEventListener(
            "pointerdown",
            (event) => {
                if (event.pointerType !== "touch") {
                    return;
                }

                if (
                    event.target.closest(
                        "button,input,textarea,video,a"
                    )
                ) {
                    return;
                }

                const row =
                    event.target.closest(
                        ".dm-message-row"
                    );

                if (!row) return;

                const message =
                    currentMessage(
                        row.dataset.messageId
                    );

                if (!message) return;

                swipeState = {
                    row,
                    id: String(message.id),
                    startX: event.clientX,
                    startY: event.clientY
                };
            },
            { passive: true }
        );

        messageList?.addEventListener(
            "pointermove",
            (event) => {
                if (
                    !swipeState ||
                    event.pointerType !== "touch"
                ) {
                    return;
                }

                const dx =
                    event.clientX -
                    swipeState.startX;
                const dy =
                    event.clientY -
                    swipeState.startY;

                if (
                    Math.abs(dy) >
                    Math.abs(dx) * 1.25
                ) {
                    swipeState.row.classList.remove(
                        "is-swipe-ready"
                    );
                    return;
                }

                if (dx > 36) {
                    swipeState.row.classList.add(
                        "is-swipe-ready"
                    );
                } else {
                    swipeState.row.classList.remove(
                        "is-swipe-ready"
                    );
                }
            },
            { passive: true }
        );

        messageList?.addEventListener(
            "pointerup",
            (event) => {
                if (
                    !swipeState ||
                    event.pointerType !== "touch"
                ) {
                    return;
                }

                const currentSwipe =
                    swipeState;

                swipeState = null;

                currentSwipe.row.classList.remove(
                    "is-swipe-ready"
                );

                const dx =
                    event.clientX -
                    currentSwipe.startX;
                const dy =
                    event.clientY -
                    currentSwipe.startY;

                if (
                    dx < 70 ||
                    Math.abs(dy) >
                    Math.abs(dx) * 1.25
                ) {
                    return;
                }

                const message =
                    currentMessage(
                        currentSwipe.id
                    );

                if (message) {
                    selectReply(message);
                }
            },
            { passive: true }
        );

        messageList?.addEventListener(
            "pointercancel",
            () => {
                swipeState?.row?.classList.remove(
                    "is-swipe-ready"
                );
                swipeState = null;
            },
            { passive: true }
        );

        window.addEventListener(
            "helix-profile-photo-updated",
            async () => {
                await refreshConversations({
                    silent: true
                });

                render.renderHeader();
                render.renderConversationList();
                render.renderInfoPanel();
            }
        );
    }

    async function openNicknameModal() {
        const modal = get("dm-nickname-modal");
        const select = get("dm-nickname-friend");

        if (!modal || !select) return;

        select.replaceChildren();

        state.conversations.forEach((conversation) => {
            const option =
                document.createElement("option");

            option.value =
                conversation.username;

            option.textContent =
                (conversation.nickname ||
                    conversation.displayName ||
                    conversation.username) +
                " — " +
                conversation.username;

            select.appendChild(option);
        });

        if (state.activeConversation) {
            select.value =
                state.activeConversation;
        }

        renderNicknameForm();
        modal.hidden = false;

        requestAnimationFrame(() => {
            get("dm-nickname-value")?.focus();
        });
    }

    function closeNicknameModal() {
        const modal =
            get("dm-nickname-modal");

        if (modal) modal.hidden = true;

        const error =
            get("dm-nickname-error");

        if (error) error.textContent = "";
    }

    function renderNicknameForm() {
        const select =
            get("dm-nickname-friend");
        const input =
            get("dm-nickname-value");

        const conversation =
            state.conversations.find(
                (item) =>
                    item.username ===
                    select?.value
            );

        if (input) {
            input.value =
                conversation?.nickname || "";
        }

        const error =
            get("dm-nickname-error");

        if (error) error.textContent = "";

        const hasFriend =
            Boolean(conversation);

        const save =
            get("dm-nickname-save");
        const remove =
            get("dm-nickname-remove");

        if (save) save.disabled = !hasFriend;
        if (remove) remove.disabled = !hasFriend;
    }

    async function saveNickname(event) {
        event.preventDefault();

        const select =
            get("dm-nickname-friend");
        const input =
            get("dm-nickname-value");
        const error =
            get("dm-nickname-error");
        const save =
            get("dm-nickname-save");

        const username =
            String(select?.value || "")
                .trim();

        const nickname =
            String(input?.value || "")
                .trim()
                .replace(/\s+/g, " ");

        if (!username) return;

        if (
            nickname.length > 50 ||
            /[\u0000-\u001F\u007F]/.test(nickname)
        ) {
            if (error) {
                error.textContent =
                    "Nickname must be 50 characters or fewer.";
            }
            return;
        }

        if (save) save.disabled = true;

        try {
            const value =
                await api.setNickname(
                    username,
                    nickname
                );

            const conversation =
                state.conversations.find(
                    (item) =>
                        item.username === username
                );

            if (conversation) {
                conversation.nickname =
                    value;
            }

            render.renderConversationList();
            render.renderHeader();
            render.renderInfoPanel();

            closeNicknameModal();
            showToast(
                value
                    ? "Nickname saved."
                    : "Nickname removed."
            );
        } catch (errorValue) {
            if (error) {
                error.textContent =
                    errorValue.message ||
                    "Could not save that nickname.";
            }
        } finally {
            if (save) save.disabled = false;
        }
    }

    async function removeNickname() {
        const select =
            get("dm-nickname-friend");

        const username =
            String(select?.value || "")
                .trim();

        if (!username) return;

        try {
            await api.setNickname(
                username,
                ""
            );

            const conversation =
                state.conversations.find(
                    (item) =>
                        item.username === username
                );

            if (conversation) {
                conversation.nickname = null;
            }

            renderNicknameForm();
            render.renderConversationList();
            render.renderHeader();
            render.renderInfoPanel();
            showToast("Nickname removed.");
        } catch (error) {
            const box =
                get("dm-nickname-error");

            if (box) {
                box.textContent =
                    error.message ||
                    "Could not remove that nickname.";
            }
        }
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () =>
                reject(
                    new Error(
                        "Could not read that attachment."
                    )
                );

            reader.onload = () =>
                resolve(
                    String(reader.result || "")
                );

            reader.readAsDataURL(file);
        });
    }

    async function enableBrowserDMNotifications() {
        const settings = notificationSettings();

        if (!settings["dm-alerts"]) {
            return;
        }

        if (
            typeof Notification === "undefined" ||
            Notification.permission === "granted"
        ) {
            return;
        }

        if (Notification.permission === "default") {
            try {
                await Notification.requestPermission();
            } catch {
                // Permission is optional.
            }
        }
    }

    async function init() {
        if (state.initialized) return;

        state.initialized = true;

        render.renderEmojiPicker();
        render.renderForwardPanel();
        render.renderInfoPanel();
        render.renderMediaViewer();
        render.renderContextMenu();
        render.renderComposerState?.();

        bindEvents();

        render.renderAll();
        render.renderComposerState?.();
        setComposerEnabled(false);

        await refreshConversations();

        // Open the first available friend on DM entry, matching the classic Helix state.
        if (!state.activeConversation && state.conversations.length > 0) {
            await openConversation(state.conversations[0].username);
        }

        await refreshNotifications();
        startPolling();

        get("dm-view")?.addEventListener(
            "click",
            enableBrowserDMNotifications,
            { once: true }
        );
    }

    window.HelixDMActions = {
        init,
        refreshConversations,
        refreshActiveConversation,
        refreshPins,
        refreshNotifications,
        openConversation,
        stopPolling,
        startPolling,
        selectReply,
        cancelReply,
        openEmojiPicker,
        closeEmojiPicker,
        openPinnedPanel,
        closePinnedPanel,
        openForwardPanel,
        closeForwardPanel,
        openInfoPanel,
        closeInfoPanel,
        openMedia,
        closeMedia,
        openContextMenu,
        closeContextMenu,
        showToast,
        scrollToReferencedMessage
    };
})();
