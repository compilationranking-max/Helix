(() => {
    const api = window.HelixDMApi;
    const state = window.HelixDMState?.state || { activeConversation: null, conversations: [], messages: [], conversationFilter: "all" };
    const get = (id) => document.getElementById(id);
    let pollTimer = null;
    let sendInFlight = false;
    let voiceRecognition = null;
    const EMOJIS = ["😀","😄","😁","😂","🤣","😊","😍","🥰","😎","🤔","😮","😅","😴","😭","😡","🤍","❤️","🧡","💛","💚","💙","💜","🖤","✨","🔥","⚡","🚀","🎉","👍","👏","🙌","🙏","💯","✅","👀","🤝","💡","🎯","📌","💬"];

    function currentUser() { return localStorage.getItem("helixLoggedIn") || ""; }
    function initials(value) { const text = String(value || "?").trim(); if (!text) return "?"; const parts = text.split(/\s+/).filter(Boolean); return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : text.slice(0, 2)).toUpperCase(); }
    function escapeHTML(value) { const div = document.createElement("div"); div.textContent = value == null ? "" : String(value); return div.innerHTML; }
    function formatTime(value) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
    function formatPreview(conversation) { const latest = conversation?.latestMessage; if (!latest) return "No messages yet"; if (latest.mediaKind === "image") return "Photo"; if (latest.mediaKind === "video") return "Video"; if (latest.mediaKind === "audio") return "Voice message"; return latest.text || "Message"; }
    function avatarMarkup(photo, name, className) { if (photo) return '<span class="' + className + '"><img src="' + escapeHTML(photo) + '" alt="" loading="lazy"></span>'; return '<span class="' + className + '">' + escapeHTML(initials(name)) + "</span>"; }

    function showNotice(message, kind) {
        let notice = get("dm-inline-notice");
        if (!notice) { notice = document.createElement("div"); notice.id = "dm-inline-notice"; notice.className = "dm-inline-notice"; get("dm-view")?.appendChild(notice); }
        notice.className = "dm-inline-notice" + (kind === "error" ? " is-error" : "");
        notice.textContent = message;
        notice.hidden = false;
        clearTimeout(showNotice.timer);
        showNotice.timer = setTimeout(() => { notice.hidden = true; }, 2600);
    }

    function setComposerState() {
        const disabled = !state.activeConversation || sendInFlight;
        ["dm-message-input","dm-send-button","dm-mic-button","dm-emoji-button","dm-composer-attach"].forEach((id) => { const el = get(id); if (el) el.disabled = disabled; });
    }

    function renderAvatar(element, person, fallbackName) {
        if (!element) return;
        element.innerHTML = person?.profilePhoto ? '<img src="' + escapeHTML(person.profilePhoto) + '" alt="" loading="lazy">' : escapeHTML(initials(person?.displayName || person?.nickname || fallbackName));
    }

    function renderConversationList() {
        const list = get("dm-conversation-list"); if (!list) return;
        const query = String(get("dm-conversation-search")?.value || "").trim().toLowerCase();
        const filter = state.conversationFilter || "all";
        const seen = new Set();
        const rows = [];
        for (const conversation of Array.isArray(state.conversations) ? state.conversations : []) {
            const username = String(conversation?.username || "").trim();
            if (!username || seen.has(username.toLowerCase())) continue;
            seen.add(username.toLowerCase());
            const name = conversation.nickname || conversation.displayName || username;
            const matchesSearch = !query || name.toLowerCase().includes(query) || username.toLowerCase().includes(query);
            const matchesFilter = filter === "all" || (filter === "unread" && Number(conversation.unreadCount || 0) > 0);
            if (!matchesSearch || !matchesFilter) continue;
            rows.push(conversation);
        }
        document.querySelectorAll("[data-dm-conversation-filter]").forEach((button) => { const active = button.dataset.dmConversationFilter === filter; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", active ? "true" : "false"); });
        if (filter === "requests") { list.innerHTML = '<div class="dm-list-empty">Message requests are not enabled for accepted-friend DMs.</div>'; return; }
        if (!rows.length) { list.innerHTML = '<div class="dm-list-empty">' + (query ? "No people match that search." : "No conversations yet.") + "</div>"; return; }
        list.innerHTML = rows.map((conversation) => {
            const active = String(conversation.username) === String(state.activeConversation);
            const name = conversation.nickname || conversation.displayName || conversation.username;
            const unread = Number(conversation.unreadCount || 0);
            return '<button class="dm-conversation-row' + (active ? " is-active" : "") + '" type="button" data-dm-open="' + escapeHTML(conversation.username) + '">' +
                avatarMarkup(conversation.profilePhoto, name, "dm-conv-avatar") +
                '<span class="dm-conv-copy"><span class="dm-conv-top"><span class="dm-conv-name">' + escapeHTML(name) + '</span><span class="dm-conv-time">' + escapeHTML(formatTime(conversation.latestMessage?.createdAt)) + '</span></span><span class="dm-conv-preview">' + escapeHTML(formatPreview(conversation)) + "</span></span>" +
                (unread ? '<span class="dm-conv-unread">' + (unread > 9 ? "9+" : unread) + "</span>" : "") + "</button>";
        }).join("");
    }

    function renderHeader() {
        const conversation = (state.conversations || []).find((item) => item.username === state.activeConversation);
        const title = conversation?.nickname || conversation?.displayName || conversation?.username || "Select a friend";
        renderAvatar(get("dm-chat-avatar"), conversation, title);
        if (get("dm-chat-title")) get("dm-chat-title").textContent = title;
        if (get("dm-chat-username")) get("dm-chat-username").textContent = conversation ? "@" + conversation.username : "No conversation selected";
        const disabled = !state.activeConversation;
        get("dm-chat-settings")?.toggleAttribute("disabled", disabled);
        get("dm-video-call")?.toggleAttribute("disabled", disabled);
    }

    function messageMediaMarkup(message) {
        if (!message?.mediaUrl) return "";
        if (message.mediaKind === "image") return '<div class="dm-image-card"><img src="' + escapeHTML(message.mediaUrl) + '" alt="' + escapeHTML(message.mediaName || "Photo") + '" loading="lazy"></div>';
        if (message.mediaKind === "video") return '<div class="dm-image-card"><video src="' + escapeHTML(message.mediaUrl) + '" controls preload="metadata"></video></div>';
        if (message.mediaKind === "audio") return '<div class="dm-audio-card"><button class="dm-audio-play" type="button" disabled>▶</button><span class="dm-audio-bars">' + Array.from({length: 30}, (_, i) => '<i style="height:' + (5 + ((i * 7) % 13)) + 'px"></i>').join("") + '</span><span class="dm-audio-time">0:18</span></div>';
        return "";
    }

    function textMarkup(text) {
        const raw = String(text || ""); const trimmed = raw.trim(); if (!trimmed) return "";
        const fence = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)\n?```$/);
        if (fence || trimmed.includes("<script") || trimmed.includes("return {") || trimmed.includes("data.load")) { const code = fence ? fence[1] : trimmed; return '<div class="dm-code-bubble"><div class="dm-code-head">CODE</div><pre>' + escapeHTML(code) + "</pre></div>"; }
        const urlMatch = trimmed.match(/^https?:\/\/\S+$/i);
        if (urlMatch) return '<a class="dm-link-card" href="' + escapeHTML(urlMatch[0]) + '" target="_blank" rel="noopener noreferrer"><span class="dm-link-icon">↗</span><span class="dm-link-text">' + escapeHTML(urlMatch[0]) + "</span></a>";
        return "<p>" + escapeHTML(trimmed).replace(/\n/g, "<br>") + "</p>";
    }

    function renderMessages() {
        const list = get("dm-message-list"); if (!list) return;
        const messages = Array.isArray(state.messages) ? state.messages : [];
        if (!state.activeConversation) { list.innerHTML = '<div class="dm-empty-chat">Select a conversation to start messaging.</div>'; return; }
        if (!messages.length) { list.innerHTML = '<div class="dm-empty-chat">No messages yet. Start the conversation.</div>'; return; }
        const conversation = (state.conversations || []).find((item) => item.username === state.activeConversation);
        list.innerHTML = messages.map((message) => {
            const incoming = String(message.sender) !== String(currentUser());
            const body = message.isDeleted ? '<p class="dm-deleted-text">Message deleted</p>' : textMarkup(message.text);
            const media = message.isDeleted ? "" : messageMediaMarkup(message);
            const avatar = incoming ? avatarMarkup(conversation?.profilePhoto, conversation?.displayName || message.sender, "dm-message-avatar") : "";
            return '<article class="dm-message ' + (incoming ? "is-incoming" : "is-outgoing") + '" data-message-id="' + escapeHTML(message.id) + '">' + avatar + '<div class="dm-bubble-wrap"><div class="dm-bubble' + (message.mediaUrl && !message.text ? " dm-bubble-media-only" : "") + '">' + body + media + '</div><div class="dm-message-meta">' + escapeHTML(formatTime(message.createdAt)) + (message.editedAt && !message.isDeleted ? " · edited" : "") + "</div></div></article>";
        }).join("");
        requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    }

    async function loadMessages(username) {
        const list = get("dm-message-list");
        if (list) list.innerHTML = '<div class="dm-empty-chat">Loading conversation…</div>';
        try {
            const messages = await api.getMessages(username);
            if (state.activeConversation !== username) return;
            state.messages = messages;
            renderHeader(); renderMessages(); renderConversationList(); refreshUnreadBadge();
        } catch (error) { if (state.activeConversation !== username) return; if (list) list.innerHTML = '<div class="dm-empty-chat">' + escapeHTML(error.message || "Could not load this conversation.") + "</div>"; showNotice(error.message || "Could not load this conversation.", "error"); }
    }

    async function openConversation(username) { state.activeConversation = String(username || "").trim(); state.messages = []; state.conversationFilter = "all"; renderConversationList(); renderHeader(); renderMessages(); setComposerState(); await loadMessages(state.activeConversation); get("dm-message-input")?.focus(); }

    async function refreshConversations() {
        try {
            const conversations = await api.getConversations();
            const previous = state.activeConversation;
            state.conversations = conversations;
            if (state.activeConversation && !conversations.some((item) => item.username === state.activeConversation)) { state.activeConversation = null; state.messages = []; }
            if (!state.activeConversation && conversations.length) state.activeConversation = conversations[0].username;
            renderConversationList(); renderHeader(); setComposerState();
            if (state.activeConversation && state.activeConversation !== previous) await loadMessages(state.activeConversation);
        } catch (error) { renderConversationList(); if (!state.conversations.length) showNotice(error.message || "Could not load conversations.", "error"); }
    }

    async function silentRefresh() {
        if (!state.activeConversation) { await refreshConversations(); return; }
        try { const messages = await api.getMessages(state.activeConversation); state.messages = messages; renderMessages(); const conversations = await api.getConversations(); state.conversations = conversations; renderConversationList(); renderHeader(); refreshUnreadBadge(); } catch {}
    }

    function refreshUnreadBadge() { const badge = get("dm-nav-unread"); if (!badge) return; const total = (state.conversations || []).reduce((sum, item) => sum + Number(item.unreadCount || 0), 0); badge.hidden = total <= 0; badge.textContent = total > 99 ? "99+" : String(total); }
    function initEmojiPanel() { const panel = get("dm-emoji-panel"); if (!panel || panel.dataset.ready) return; panel.dataset.ready = "true"; panel.innerHTML = EMOJIS.map((emoji) => '<button type="button" data-dm-emoji="' + emoji + '" aria-label="Insert emoji">' + emoji + "</button>").join(""); }
    function toggleEmojiPanel() { const panel = get("dm-emoji-panel"); if (panel) panel.hidden = !panel.hidden; }

    async function sendCurrentMessage() {
        const input = get("dm-message-input"); const text = String(input?.value || "").trim();
        if (!state.activeConversation || !text || sendInFlight) return;
        sendInFlight = true; setComposerState();
        try { const message = await api.sendMessage(state.activeConversation, text); if (message) state.messages.push(message); if (input) input.value = ""; renderMessages(); await refreshConversations(); }
        catch (error) { showNotice(error.message || "Could not send message.", "error"); }
        finally { sendInFlight = false; setComposerState(); input?.focus(); }
    }

    function handleFileSelection(event) {
        const file = event.target.files?.[0]; if (!file || !state.activeConversation) return;
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) { showNotice("Only photos and videos can be sent.", "error"); event.target.value = ""; return; }
        if (file.size > 10 * 1024 * 1024) { showNotice("That file is larger than 10 MB.", "error"); event.target.value = ""; return; }
        const reader = new FileReader();
        reader.onload = async () => {
            try { sendInFlight = true; setComposerState(); const message = await api.sendMediaMessage({ username: state.activeConversation, text: "", replyToId: null, media: { dataUrl: String(reader.result || ""), name: file.name, size: file.size, mime: file.type } }); if (message) state.messages.push(message); renderMessages(); await refreshConversations(); }
            catch (error) { showNotice(error.message || "Could not send attachment.", "error"); }
            finally { sendInFlight = false; event.target.value = ""; setComposerState(); }
        };
        reader.onerror = () => { event.target.value = ""; showNotice("Could not read that attachment.", "error"); };
        reader.readAsDataURL(file);
    }

    function beginVoiceInput() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { showNotice("Voice input is not available in this browser."); return; }
        if (voiceRecognition) { voiceRecognition.stop(); voiceRecognition = null; return; }
        voiceRecognition = new SpeechRecognition(); voiceRecognition.lang = document.documentElement.lang || "en-US"; voiceRecognition.interimResults = false; voiceRecognition.maxAlternatives = 1;
        get("dm-mic-button")?.classList.add("is-listening"); showNotice("Listening… speak your message.");
        voiceRecognition.onresult = (event) => { const transcript = event.results?.[0]?.[0]?.transcript || ""; const input = get("dm-message-input"); if (input) { input.value = (input.value + (input.value ? " " : "") + transcript).trim(); input.focus(); } };
        voiceRecognition.onerror = () => showNotice("Voice input could not start.", "error");
        voiceRecognition.onend = () => { voiceRecognition = null; get("dm-mic-button")?.classList.remove("is-listening"); };
        voiceRecognition.start();
    }

    async function handleSetting(action) {
        const popover = get("dm-chat-settings-popover"); if (popover) popover.hidden = true; if (!state.activeConversation) return;
        if (action === "nickname") {
            const conversation = state.conversations.find((item) => item.username === state.activeConversation); const next = window.prompt("Private nickname", conversation?.nickname || ""); if (next === null) return;
            try { const nickname = await api.setNickname(state.activeConversation, next.trim()); if (conversation) conversation.nickname = nickname || null; renderConversationList(); renderHeader(); showNotice("Private nickname updated."); } catch (error) { showNotice(error.message || "Could not update nickname.", "error"); }
            return;
        }
        if (action === "info") { try { const info = await api.getConversationInfo(state.activeConversation); const count = Number(info?.messageCount ?? info?.messages ?? 0); showNotice(count ? count + " messages in this conversation." : "Conversation info loaded."); } catch (error) { showNotice(error.message || "Could not load conversation info.", "error"); } }
    }

    function bindEvents() {
        get("dm-conversation-list")?.addEventListener("click", (event) => { const button = event.target.closest("[data-dm-open]"); if (button) openConversation(button.dataset.dmOpen); });
        get("dm-conversation-search")?.addEventListener("input", renderConversationList);
        document.querySelectorAll("[data-dm-conversation-filter]").forEach((button) => button.addEventListener("click", () => { state.conversationFilter = button.dataset.dmConversationFilter || "all"; renderConversationList(); }));
        get("dm-message-form")?.addEventListener("submit", (event) => { event.preventDefault(); sendCurrentMessage(); });
        get("dm-message-input")?.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendCurrentMessage(); } });
        get("dm-composer-attach")?.addEventListener("click", () => get("dm-file-input")?.click());
        get("dm-file-input")?.addEventListener("change", handleFileSelection);
        get("dm-mic-button")?.addEventListener("click", beginVoiceInput);
        get("dm-emoji-button")?.addEventListener("click", toggleEmojiPanel);
        get("dm-emoji-panel")?.addEventListener("click", (event) => { const button = event.target.closest("[data-dm-emoji]"); if (!button) return; const input = get("dm-message-input"); if (input) { input.value += button.dataset.dmEmoji; input.focus(); } get("dm-emoji-panel").hidden = true; });
        get("dm-new-message-button")?.addEventListener("click", () => { state.activeConversation = null; state.messages = []; state.conversationFilter = "all"; const input = get("dm-message-input"); if (input) input.value = ""; renderConversationList(); renderHeader(); renderMessages(); setComposerState(); get("dm-conversation-search")?.focus(); });
        get("dm-chat-settings")?.addEventListener("click", () => { const popover = get("dm-chat-settings-popover"); if (popover) popover.hidden = !popover.hidden; });
        get("dm-chat-settings-popover")?.addEventListener("click", (event) => { const button = event.target.closest("[data-dm-setting]"); if (button) handleSetting(button.dataset.dmSetting); });
        get("dm-video-call")?.addEventListener("click", () => { if (state.activeConversation) showNotice("Video calling is not connected yet."); });
        document.addEventListener("click", (event) => { const popover = get("dm-chat-settings-popover"); const settings = get("dm-chat-settings"); if (popover && !popover.hidden && !popover.contains(event.target) && event.target !== settings) popover.hidden = true; const panel = get("dm-emoji-panel"); const emojiButton = get("dm-emoji-button"); if (panel && !panel.hidden && !panel.contains(event.target) && event.target !== emojiButton) panel.hidden = true; });
    }

    async function init() {
        const view = get("dm-view"); if (!view || !api || view.dataset.dmReady === "true") return;
        view.dataset.dmReady = "true"; initEmojiPanel(); bindEvents(); renderConversationList(); renderHeader(); renderMessages(); setComposerState();
        await refreshConversations();
        clearInterval(pollTimer); pollTimer = setInterval(() => { if (!document.hidden) silentRefresh(); }, 6000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();