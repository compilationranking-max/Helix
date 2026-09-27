(() => {
    async function request(url, options = {}) {
        let response;

        try {
            response = await fetch(url, {
                credentials: "include",
                ...options,
                headers: {
                    Accept: "application/json",
                    ...(options.body ? { "Content-Type": "application/json" } : {}),
                    ...(options.headers || {})
                }
            });
        } catch (error) {
            if (error?.name === "AbortError") {
                throw error;
            }
            throw new Error("Helix could not reach the server. Check your connection and try again.");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = "index.html";
            }

            throw new Error(
                data && data.error
                    ? data.error
                    : "Helix returned HTTP " + response.status + "."
            );
        }

        return data;
    }

    async function getConversations() {
        const data = await request("/api/dm/conversations");
        return Array.isArray(data.conversations) ? data.conversations : [];
    }

    async function getMessages(username, signal) {
        const data = await request(
            "/api/dm/messages?with=" + encodeURIComponent(username),
            { signal }
        );
        return Array.isArray(data.messages) ? data.messages : [];
    }

    async function getPins(username) {
        const data = await request(
            "/api/dm/pins?with=" + encodeURIComponent(username)
        );
        return Array.isArray(data.pins) ? data.pins : [];
    }

    async function setNickname(username, nickname) {
        const data = await request(
            "/api/dm/conversations/" + encodeURIComponent(username) + "/nickname",
            {
                method: "PATCH",
                body: JSON.stringify({ nickname })
            }
        );
        return data.nickname || null;
    }

    async function sendMessage(username, text) {
        const data = await request("/api/dm/messages", {
            method: "POST",
            body: JSON.stringify({
                to: username,
                text
            })
        });
        return data.message;
    }

    async function editMessage(messageId, text) {
        const data = await request(
            "/api/dm/messages/" + encodeURIComponent(messageId),
            {
                method: "PUT",
                body: JSON.stringify({ text })
            }
        );
        return data.message;
    }

    async function deleteMessage(messageId) {
        return request(
            "/api/dm/messages/" + encodeURIComponent(messageId),
            { method: "DELETE" }
        );
    }

    async function setReaction(messageId, emoji, reacted) {
        const data = await request(
            "/api/dm/messages/" + encodeURIComponent(messageId) + "/reaction",
            {
                method: "POST",
                body: JSON.stringify({
                    emoji,
                    reacted
                })
            }
        );
        return data.message;
    }

    async function setPin(messageId, pinned) {
        const data = await request(
            "/api/dm/messages/" + encodeURIComponent(messageId) + "/pin",
            {
                method: "POST",
                body: JSON.stringify({ pinned })
            }
        );
        return data.message;
    }

    async function forwardMessage(messageId, username) {
        const data = await request(
            "/api/dm/messages/" + encodeURIComponent(messageId) + "/forward",
            {
                method: "POST",
                body: JSON.stringify({ to: username })
            }
        );
        return data.message;
    }

    window.HelixDMApi = {
        getConversations,
        getMessages,
        setNickname,
        getPins,
        sendMessage,
        editMessage,
        deleteMessage,
        setReaction,
        setPin,
        forwardMessage
    };
})();
