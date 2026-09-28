(() => {
    const state = {
        initialized: false,

        activeConversation: null,
        conversations: [],
        messages: [],
        pinnedMessages: [],

        loadingConversations: false,
        loadingMessages: false,
        loadingPins: false,
        loadingInfo: false,

        conversationError: "",
        messageError: "",
        infoError: "",

        conversationSearch: "",
        conversationFilter: "all",
        messageSearch: "",

        reply: null,

        pendingAttachment: null,
        attachmentError: "",

        contextMenu: {
            open: false,
            messageId: null,
            x: 0,
            y: 0
        },

        infoPanelOpen: false,
        info: null,

        emojiPickerOpen: false,
        emojiTargetMessageId: null,

        forwardPanelOpen: false,
        forwardMessageId: null,

        mediaViewerOpen: false,
        mediaViewerMessageId: null,

        editingMessageId: null,

        selectedMessageId: null,

        conversationRequestSerial: 0,
        conversationAbortController: null,
        conversationListRequestInFlight: false,
        pollTimer: null,
        pollInFlight: false,

        notifiedMessageIds: new Set()
    };

    function replaceMessage(message) {
        if (!message?.id) return;

        const index = state.messages.findIndex(
            (item) => String(item.id) === String(message.id)
        );

        if (index >= 0) {
            state.messages[index] = message;
        } else {
            state.messages.push(message);
            state.messages.sort(
                (a, b) =>
                    new Date(a.createdAt || 0) -
                    new Date(b.createdAt || 0)
            );
        }
    }

    function replaceConversation(conversation) {
        if (!conversation?.username) return;

        const index = state.conversations.findIndex(
            (item) => item.username === conversation.username
        );

        if (index >= 0) {
            state.conversations[index] = conversation;
        } else {
            state.conversations.push(conversation);
        }
    }

    function removeMessage(messageId) {
        state.messages = state.messages.filter(
            (item) => String(item.id) !== String(messageId)
        );

        state.pinnedMessages = state.pinnedMessages.filter(
            (item) => String(item.id) !== String(messageId)
        );

        if (String(state.selectedMessageId || "") === String(messageId)) {
            state.selectedMessageId = null;
        }

        if (String(state.editingMessageId || "") === String(messageId)) {
            state.editingMessageId = null;
        }
    }

    function clearReply() {
        state.reply = null;
    }

    function clearAttachment() {
        const attachment = state.pendingAttachment;

        if (
            attachment?.previewUrl &&
            attachment.previewUrl.startsWith("blob:")
        ) {
            URL.revokeObjectURL(attachment.previewUrl);
        }

        state.pendingAttachment = null;
        state.attachmentError = "";
    }

    function clearActiveConversation() {
        clearAttachment();
        clearReply();

        state.activeConversation = null;
        state.messages = [];
        state.pinnedMessages = [];
        state.info = null;

        state.loadingMessages = false;
        state.loadingPins = false;
        state.loadingInfo = false;

        state.messageError = "";
        state.infoError = "";

        state.selectedMessageId = null;
        state.editingMessageId = null;

        state.conversationRequestSerial += 1;
        state.conversationAbortController?.abort();
        state.conversationAbortController = null;

        state.contextMenu.open = false;
        state.contextMenu.messageId = null;
        state.emojiPickerOpen = false;
        state.emojiTargetMessageId = null;
        state.forwardPanelOpen = false;
        state.forwardMessageId = null;
        state.mediaViewerOpen = false;
        state.mediaViewerMessageId = null;
        state.infoPanelOpen = false;
    }

    window.HelixDMState = {
        state,
        replaceMessage,
        replaceConversation,
        removeMessage,
        clearReply,
        clearAttachment,
        clearActiveConversation
    };
})();
