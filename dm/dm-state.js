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
        conversationError: "",
        messageError: "",
        conversationSearch: "",
        messageSearch: "",
        selectedMessageId: null,
        emojiPickerOpen: false,
        forwardModalOpen: false,
        forwardMessageId: null,
        conversationRequestSerial: 0,
        conversationAbortController: null,
        conversationListRequestInFlight: false,
        pollTimer: null,
        pollInFlight: false
    };

    function replaceMessage(message) {
        if (!message || !message.id) return;

        const index = state.messages.findIndex((item) => item.id === message.id);

        if (index >= 0) {
            state.messages[index] = message;
        } else {
            state.messages.push(message);
            state.messages.sort(
                (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
            );
        }
    }

    function removeMessage(messageId) {
        state.messages = state.messages.filter((item) => item.id !== messageId);
        state.pinnedMessages = state.pinnedMessages.filter((item) => item.id !== messageId);

        if (state.selectedMessageId === messageId) {
            state.selectedMessageId = null;
        }
    }

    function clearActiveConversation() {
        state.activeConversation = null;
        state.messages = [];
        state.pinnedMessages = [];
        state.messageError = "";
        state.loadingMessages = false;
        state.selectedMessageId = null;
        state.conversationRequestSerial += 1;
        state.conversationAbortController?.abort();
        state.conversationAbortController = null;
    }

    window.HelixDMState = {
        state,
        replaceMessage,
        removeMessage,
        clearActiveConversation
    };
})();
