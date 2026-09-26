// =========================================================
// HELIX — APP JAVASCRIPT
// =========================================================


// =========================================================
// AUTHENTICATION CHECK
// =========================================================

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}

let loggedInUser = localStorage.getItem("helixLoggedIn") || "";
let currentDisplayName = localStorage.getItem("helixDisplayName") || "";

async function bootstrapHelixSession() {
    try {
        const response = await fetch("/api/auth/me", {
            credentials: "include"
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.user?.username) {
            localStorage.removeItem("helixLoggedIn");
            localStorage.removeItem("helixDisplayName");
            window.location.href = "index.html";
            return false;
        }

        loggedInUser = data.user.username;
        currentDisplayName = data.user.displayName || loggedInUser;
        localStorage.setItem("helixLoggedIn", loggedInUser);
        localStorage.setItem("helixDisplayName", currentDisplayName);

        if (Object.prototype.hasOwnProperty.call(data.user, "profilePhoto")) {
            const photoKey = `helixProfilePhoto:${loggedInUser}`;
            const photo = data.user.profilePhoto || "";

            // Old versions stored the complete base64 image in helixUsers,
            // which could consume most of the browser's localStorage quota.
            const localUsers = readLocalJSON("helixUsers", {});
            if (localUsers?.[loggedInUser]?.profilePhoto?.startsWith("data:image/")) {
                delete localUsers[loggedInUser].profilePhoto;
                try {
                    localStorage.setItem("helixUsers", JSON.stringify(localUsers));
                } catch {
                    // AI chat should still work even if storage is already full.
                }
            }

            try {
                if (photo) {
                    localStorage.setItem(photoKey, photo);
                } else {
                    localStorage.removeItem(photoKey);
                }
            } catch {
                // The public URL is fetched again on the next authenticated load.
            }
        }

        updateLoggedInUser();
        updateProfileView();
        await loadCloudProfileSettings();

        // Populate the Direct Messages inbox from the cloud as soon as
        // the server session is confirmed.
        if (typeof fetchFriendsForDM === "function") {
            await fetchFriendsForDM();
        }

        return true;
    } catch (error) {
        console.error("Helix session bootstrap failed:", error);
        window.location.href = "index.html";
        return false;
    }
}

// =========================================================
// HELIX INTRO ANIMATION
// =========================================================

function playHelixIntro() {
    const intro = document.getElementById("helix-intro");
    if (!intro) return;

    // The login page sets this flag immediately before opening app.html.
    // This prevents the animation from appearing on ordinary app refreshes.
    const shouldShow = sessionStorage.getItem("helixShowIntro") === "1";

    if (!shouldShow) {
        intro.remove();
        return;
    }

    sessionStorage.removeItem("helixShowIntro");

    // Let the browser paint the initial frame before starting the sequence.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            intro.classList.add("is-playing");
        });
    });

    // Dragon appears first, then HELIX, then the app is revealed.
    window.setTimeout(() => {
        intro.classList.add("is-hidden");
    }, 2850);

    window.setTimeout(() => {
        intro.remove();
    }, 3650);
}

playHelixIntro();

// =========================================================
// USER DISPLAY
// =========================================================

function getLocalAccount() {
    const users = readLocalJSON("helixUsers", {});
    return users && typeof users === "object" && !Array.isArray(users)
        ? (users[loggedInUser] || null)
        : null;
}

function getCurrentDisplayName() {
    const account = getLocalAccount();
    return (
        currentDisplayName ||
        account?.displayName ||
        localStorage.getItem("helixDisplayName") ||
        loggedInUser ||
        "User"
    );
}

function getCurrentTime() {
    return new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function setCurrentProfileUser(user) {
    if (!user) return;

    if (user.username) {
        loggedInUser = user.username;
        localStorage.setItem("helixLoggedIn", loggedInUser);
    }

    currentDisplayName = user.displayName || user.username || "User";
    localStorage.setItem("helixDisplayName", currentDisplayName);

    const users = readLocalJSON("helixUsers", {});
    if (users && typeof users === "object" && !Array.isArray(users) && loggedInUser) {
        users[loggedInUser] = {
            ...(users[loggedInUser] || {}),
            displayName: currentDisplayName,
            createdAt: user.createdAt || users[loggedInUser]?.createdAt || new Date().toISOString(),
            ...(Object.prototype.hasOwnProperty.call(user, "profilePhoto")
                ? { profilePhoto: user.profilePhoto || null }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(user, "email")
                ? { email: user.email || null }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(user, "phone")
                ? { phone: user.phone || null }
                : {})
        };
        try {
            localStorage.setItem("helixUsers", JSON.stringify(users));
        } catch {
            // Storage quota must never block messaging.
        }
    }
}

function formatPublicUserName(userOrUsername, maybeUsername = "") {
    if (typeof userOrUsername === "string") {
        return {
            displayName: userOrUsername,
            username: userOrUsername
        };
    }

    return {
        displayName: userOrUsername?.displayName || maybeUsername || "User",
        username: userOrUsername?.username || maybeUsername || "user"
    };
}

function updateLoggedInUser() {
    const usernameElements = document.querySelectorAll("[data-user]:not(.conversation)");
    const avatarElements = document.querySelectorAll("[data-avatar]");
    const displayName = getCurrentDisplayName();
    const welcomeMessage = document.getElementById("ai-welcome-message");

    usernameElements.forEach((element) => {
        element.textContent = displayName;
    });

    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome back ${displayName}!`;
    }

    avatarElements.forEach((element) => {
        element.textContent = displayName.slice(0, 2).toUpperCase();
        const photo = localStorage.getItem(`helixProfilePhoto:${loggedInUser}`);
        if (photo) {
            element.style.backgroundImage = `url("${photo}")`;
            element.style.backgroundSize = "cover";
            element.style.color = "transparent";
        } else {
            element.style.backgroundImage = "";
            element.style.color = "";
        }
    });
}

// =========================================================
// LOGOUT
// =========================================================

async function logoutCurrentSession() {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
    } catch (error) {
        console.warn("Unable to notify Helix server about logout.", error);
    }

    localStorage.removeItem("helixLoggedIn");
    localStorage.removeItem("helixDisplayName");
    window.location.href = "index.html";
}


const logoutButton = document.getElementById("logout-btn");

if (logoutButton) {
    logoutButton.addEventListener("click", logoutCurrentSession);
}

const profileLogoutButton = document.getElementById("profile-logout-btn");

if (profileLogoutButton) {
    profileLogoutButton.addEventListener("click", logoutCurrentSession);
}


// =========================================================
// HELIX — CLOUD DIRECT MESSAGES
// =========================================================

// =========================================================
// HELIX AI HOME
// =========================================================

const aiForm = document.getElementById("ai-form");
const aiInput = document.getElementById("ai-input");
const aiMessages = document.getElementById("ai-messages");
const aiTyping = document.getElementById("ai-typing");
const aiSendButton = document.getElementById("ai-send-button");
const aiAttachButton = document.getElementById("ai-attach-button");
const aiAttachmentMenu = document.getElementById("ai-attachment-menu");
const aiUploadPhotoButton = document.getElementById("ai-upload-photo-button");
const aiPhotoInput = document.getElementById("ai-photo-input");
const aiPhotoLimit = document.getElementById("ai-photo-limit");
const aiPhotoChip = document.getElementById("ai-photo-chip");
const aiPhotoPreview = document.getElementById("ai-photo-preview");
const aiPhotoName = document.getElementById("ai-photo-name");
const aiPhotoChipStatus = document.getElementById("ai-photo-chip-status");
const aiRemovePhotoButton = document.getElementById("ai-remove-photo-button");
let pendingAIImage = null;
let aiRequestInFlight = false;
let aiStorageKey = `helixAIConversation:${loggedInUser || "User"}`;
let aiChatsKey = `helixAIChats:${loggedInUser || "User"}`;
const AI_HISTORY_LIMIT = 20;
const AI_CHAT_LIST_LIMIT = 50;
let aiConversation = loadAIConversation();
let currentAIChatId = sessionStorage.getItem(`helixCurrentAIChat:${loggedInUser || "User"}`) || createAIChatId();
let aiChatSessions = loadAIChatSessions();

function createAIChatId() {
    return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadAIConversation() {
    try {
        const savedConversation = JSON.parse(localStorage.getItem(aiStorageKey) || "[]");

        if (!Array.isArray(savedConversation)) return [];

        return savedConversation
            .filter((message) => (
                message &&
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string" &&
                message.content.trim()
            ))
            .slice(-AI_HISTORY_LIMIT);
    } catch (error) {
        localStorage.removeItem(aiStorageKey);
        return [];
    }
}

function loadAIChatSessions() {
    try {
        const saved = JSON.parse(localStorage.getItem(aiChatsKey) || "[]");
        if (!Array.isArray(saved)) return [];

        return saved
            .filter((chat) => (
                chat &&
                typeof chat.id === "string" &&
                typeof chat.title === "string" &&
                Array.isArray(chat.messages)
            ))
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
            .slice(0, AI_CHAT_LIST_LIMIT);
    } catch (error) {
        localStorage.removeItem(aiChatsKey);
        return [];
    }
}

function saveAIChatSessions() {
    aiChatSessions = aiChatSessions
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, AI_CHAT_LIST_LIMIT);

    try {
        localStorage.setItem(aiChatsKey, JSON.stringify(aiChatSessions));
    } catch (error) {
        // A full browser quota should not prevent sending messages to Helix AI.
        // Keep a smaller recent history as a fallback.
        try {
            const reduced = aiChatSessions.slice(0, 12).map((chat) => ({
                ...chat,
                messages: chat.messages.slice(-AI_HISTORY_LIMIT)
            }));
            aiChatSessions = reduced;
            localStorage.setItem(aiChatsKey, JSON.stringify(reduced));
        } catch {
            // Persistence becomes best-effort; the live conversation remains usable.
        }
    }
}

function getAIChatTitle(messages) {
    const firstUserMessage = messages.find((message) => message.role === "user");
    if (!firstUserMessage) return "New Helix Chat";

    const clean = firstUserMessage.content.replace(/\s+/g, " ").trim();
    return clean.length > 34 ? `${clean.slice(0, 34)}…` : clean;
}

function saveCurrentAIChatSession() {
    if (!aiConversation.length) return;

    const now = new Date().toISOString();
    const existingIndex = aiChatSessions.findIndex((chat) => chat.id === currentAIChatId);
    const session = {
        id: currentAIChatId,
        title: existingIndex >= 0 && aiChatSessions[existingIndex].title
            ? aiChatSessions[existingIndex].title
            : getAIChatTitle(aiConversation),
        messages: aiConversation,
        archived: existingIndex >= 0 ? Boolean(aiChatSessions[existingIndex].archived) : false,
        updatedAt: now,
        createdAt: existingIndex >= 0 ? aiChatSessions[existingIndex].createdAt : now
    };

    if (existingIndex >= 0) {
        aiChatSessions[existingIndex] = session;
    } else {
        aiChatSessions.unshift(session);
    }

    saveAIChatSessions();
    renderAIChatHistory();
}

function saveAIConversation() {
    aiConversation = aiConversation.slice(-AI_HISTORY_LIMIT);

    try {
        localStorage.setItem(aiStorageKey, JSON.stringify(aiConversation));
    } catch {
        // Do not fail an AI request because browser storage is full.
    }

    saveCurrentAIChatSession();
}

function renderAIChatHistory(query = "") {
    const history = document.getElementById("ai-chat-history");
    if (!history) return;

    const normalizedQuery = query.trim().toLowerCase();
    const sessions = aiChatSessions.filter((chat) => {
        const matchesQuery = !normalizedQuery || chat.title.toLowerCase().includes(normalizedQuery);

        // Archived chats stay hidden from normal history, but searching
        // for an archived chat by name makes it discoverable and openable.
        if (chat.archived) return Boolean(normalizedQuery && matchesQuery);

        return matchesQuery;
    });

    if (!sessions.length) {
        history.innerHTML = '<div class="ai-chat-history-empty">No previous chats yet.</div>';
        return;
    }

    history.innerHTML = sessions.map((chat) => `
        <div class="ai-chat-history-item${chat.id === currentAIChatId ? " active" : ""}" data-ai-chat-id="${escapeHTML(chat.id)}">
            <button class="ai-chat-history-open" type="button" data-ai-chat-open="${escapeHTML(chat.id)}">
                <span class="ai-chat-history-icon" aria-hidden="true">◌</span>
                <span class="ai-chat-history-copy">
                    <strong>${escapeHTML(chat.title)}</strong>
                    <small>${chat.archived ? "Archived · " : ""}${new Date(chat.updatedAt || Date.now()).toLocaleDateString([], { month: "short", day: "numeric" })}</small>
                </span>
            </button>
            <button class="ai-chat-history-menu-button" type="button" data-ai-chat-menu="${escapeHTML(chat.id)}" aria-label="More options for ${escapeHTML(chat.title)}" aria-expanded="false" title="More options">
                <span aria-hidden="true">⋮</span>
            </button>
            <div class="ai-chat-history-menu" data-ai-chat-menu-panel="${escapeHTML(chat.id)}" hidden>
                <button type="button" data-ai-chat-action="rename" data-ai-chat-id="${escapeHTML(chat.id)}"><span>✎</span>Rename</button>
                <button type="button" data-ai-chat-action="share" data-ai-chat-id="${escapeHTML(chat.id)}"><span>↗</span>Share</button>
                <button type="button" data-ai-chat-action="archive" data-ai-chat-id="${escapeHTML(chat.id)}"><span>▣</span>Archive</button>
                <button type="button" class="danger" data-ai-chat-action="delete" data-ai-chat-id="${escapeHTML(chat.id)}"><span>⌫</span>Delete</button>
            </div>
        </div>
    `).join("");
}

function showAIChatToast(message) {
    const existing = document.getElementById("ai-chat-action-toast");
    existing?.remove();

    const toast = document.createElement("div");
    toast.className = "ai-chat-action-toast";
    toast.id = "ai-chat-action-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => {
        toast.classList.remove("is-visible");
        window.setTimeout(() => toast.remove(), 220);
    }, 2600);
}

function closeAIChatActionModal() {
    const modal = document.getElementById("ai-chat-action-modal");
    if (modal) modal.hidden = true;
}

function openAIChatActionModal(mode, chatId) {
    const modal = document.getElementById("ai-chat-action-modal");
    const title = document.getElementById("ai-chat-action-modal-title");
    const description = document.getElementById("ai-chat-action-modal-description");
    const body = document.getElementById("ai-chat-action-modal-body");
    const chat = aiChatSessions.find((session) => session.id === chatId);

    if (!modal || !title || !description || !body || !chat) return;

    if (mode === "rename") {
        title.textContent = "Rename chat";
        description.textContent = "Give this Helix AI conversation a name you can recognize later.";
        body.innerHTML = `
            <form class="ai-chat-action-form" id="ai-chat-rename-form">
                <label for="ai-chat-rename-input">Chat name</label>
                <input id="ai-chat-rename-input" type="text" maxlength="60" value="${escapeHTML(chat.title)}" autocomplete="off">
                <div class="ai-chat-action-form-actions">
                    <button type="button" class="profile-secondary-button" data-ai-chat-modal-close>Cancel</button>
                    <button type="submit" class="profile-primary-button">Save name</button>
                </div>
            </form>
        `;
        document.getElementById("ai-chat-rename-form")?.addEventListener("submit", (event) => {
            event.preventDefault();
            const input = document.getElementById("ai-chat-rename-input");
            const nextTitle = input?.value.trim();
            if (!nextTitle) {
                input?.focus();
                return;
            }

            chat.title = nextTitle.slice(0, 60);
            chat.updatedAt = new Date().toISOString();
            saveAIChatSessions();
            renderAIChatHistory(document.getElementById("ai-chat-search-input")?.value || "");
            closeAIChatActionModal();
            showAIChatToast("Chat renamed.");
        });
    }

    if (mode === "share") {
        const transcript = chat.messages
            .map((message) => `${message.role === "user" ? "You" : "Helix AI"}: ${message.content}`)
            .join("\n\n");

        title.textContent = "Share chat";
        description.textContent = "Share this conversation from Helix AI.";
        body.innerHTML = `
            <div class="ai-chat-share-card">
                <span class="ai-chat-share-mark">↗</span>
                <div>
                    <strong>${escapeHTML(chat.title)}</strong>
                    <small>${chat.messages.length} message${chat.messages.length === 1 ? "" : "s"} ready to share.</small>
                </div>
            </div>
            <div class="ai-chat-action-form-actions">
                <button type="button" class="profile-secondary-button" data-ai-chat-modal-close>Cancel</button>
                <button type="button" class="profile-primary-button" id="ai-chat-share-confirm">Share chat</button>
            </div>
        `;

        document.getElementById("ai-chat-share-confirm")?.addEventListener("click", async () => {
            const shareText = `Helix AI — ${chat.title}\n\n${transcript}`;

            try {
                if (navigator.share) {
                    await navigator.share({
                        title: `Helix AI — ${chat.title}`,
                        text: shareText
                    });
                    closeAIChatActionModal();
                    showAIChatToast("Chat shared.");
                    return;
                }

                await navigator.clipboard.writeText(shareText);
                closeAIChatActionModal();
                showAIChatToast("Chat copied to your clipboard.");
            } catch (error) {
                if (error?.name === "AbortError") return;

                try {
                    const helper = document.createElement("textarea");
                    helper.value = shareText;
                    helper.style.position = "fixed";
                    helper.style.opacity = "0";
                    document.body.appendChild(helper);
                    helper.select();
                    document.execCommand("copy");
                    helper.remove();
                    closeAIChatActionModal();
                    showAIChatToast("Chat copied to your clipboard.");
                } catch {
                    showAIChatToast("Sharing is unavailable in this browser.");
                }
            }
        });
    }

    if (mode === "delete") {
        title.textContent = "Delete chat";
        description.textContent = "This action permanently removes this saved Helix AI chat from this browser.";
        body.innerHTML = `
            <div class="ai-chat-delete-warning">
                <span>!</span>
                <div>
                    <strong>Are you sure you want to delete “${escapeHTML(chat.title)}”?</strong>
                    <small>This cannot be undone.</small>
                </div>
            </div>
            <div class="ai-chat-action-form-actions">
                <button type="button" class="profile-secondary-button" data-ai-chat-modal-close>No</button>
                <button type="button" class="profile-danger-button" id="ai-chat-delete-confirm">Yes, delete</button>
            </div>
        `;

        document.getElementById("ai-chat-delete-confirm")?.addEventListener("click", () => {
            aiChatSessions = aiChatSessions.filter((session) => session.id !== chat.id);
            saveAIChatSessions();

            if (currentAIChatId === chat.id) {
                currentAIChatId = createAIChatId();
                sessionStorage.setItem(`helixCurrentAIChat:${loggedInUser || "User"}`, currentAIChatId);
                aiConversation = [];
                localStorage.removeItem(aiStorageKey);
                aiMessages?.replaceChildren();
                document.getElementById("ai-welcome")?.removeAttribute("hidden");
                updateAIChatState();
            }

            closeAIChatActionModal();
            renderAIChatHistory(document.getElementById("ai-chat-search-input")?.value || "");
            showAIChatToast("Chat deleted.");
        });
    }

    modal.hidden = false;

    if (mode === "rename") {
        window.setTimeout(() => document.getElementById("ai-chat-rename-input")?.focus(), 0);
    }
}

function handleAIChatAction(action, chatId) {
    const chat = aiChatSessions.find((session) => session.id === chatId);
    if (!chat) return;

    if (action === "rename" || action === "share" || action === "delete") {
        openAIChatActionModal(action, chatId);
        return;
    }

    if (action === "archive") {
        chat.archived = true;
        chat.updatedAt = new Date().toISOString();
        saveAIChatSessions();

        if (currentAIChatId === chatId) {
            currentAIChatId = createAIChatId();
            sessionStorage.setItem(`helixCurrentAIChat:${loggedInUser || "User"}`, currentAIChatId);
            aiConversation = [];
            localStorage.removeItem(aiStorageKey);
            aiMessages?.replaceChildren();
            document.getElementById("ai-welcome")?.removeAttribute("hidden");
            updateAIChatState();
        }

        renderAIChatHistory(document.getElementById("ai-chat-search-input")?.value || "");
        showAIChatToast("Chat archived.");
    }
}

function loadAIChatSession(chatId) {
    const session = aiChatSessions.find((chat) => chat.id === chatId);
    if (!session) return;

    currentAIChatId = session.id;
    sessionStorage.setItem(`helixCurrentAIChat:${loggedInUser || "User"}`, currentAIChatId);

    aiConversation = Array.isArray(session.messages) ? session.messages.slice(-AI_HISTORY_LIMIT) : [];
    localStorage.setItem(aiStorageKey, JSON.stringify(aiConversation));

    renderAIConversation();
    renderAIChatHistory(document.getElementById("ai-chat-search-input")?.value || "");
    aiInput?.focus();
}

function startNewAIChat() {
    saveCurrentAIChatSession();

    currentAIChatId = createAIChatId();
    sessionStorage.setItem(`helixCurrentAIChat:${loggedInUser || "User"}`, currentAIChatId);

    aiConversation = [];
    localStorage.removeItem(aiStorageKey);
    aiMessages?.replaceChildren();
    document.getElementById("ai-welcome")?.removeAttribute("hidden");
    updateAIChatState();
    renderAIChatHistory();
}

function clearAIConversation() {
    aiConversation = [];
    localStorage.removeItem(aiStorageKey);
    aiMessages?.replaceChildren();
    document.getElementById("ai-welcome")?.removeAttribute("hidden");
    updateAIChatState();
    renderAIChatHistory();
}

function updateAIChatState() {
    const aiChatContent = document.querySelector(".ai-chat-content");

    aiChatContent?.classList.toggle("empty-chat", aiConversation.length === 0);
    aiChatContent?.classList.toggle("active-chat", aiConversation.length > 0);
}

function playAIWelcomeDragon() {
    const existing = document.getElementById("helix-ai-new-chat-intro");
    if (existing) existing.remove();

    const intro = document.createElement("div");
    intro.className = "helix-intro helix-ai-new-chat-intro";
    intro.id = "helix-ai-new-chat-intro";
    intro.setAttribute("aria-hidden", "true");
    intro.innerHTML = `
        <div class="helix-intro-glow"></div>
        <div class="helix-intro-content">
            <img class="helix-intro-dragon" src="dragon-intro.png" alt="" draggable="false">
            <div class="helix-ai-new-chat-title">HELIX DRAGON IS HERE TO HELP YOU</div>
        </div>
        <div class="helix-intro-scanline"></div>
    `;

    document.body.appendChild(intro);

    window.setTimeout(() => {
        intro.classList.add("is-hidden");
    }, 2850);

    window.setTimeout(() => {
        intro.remove();
    }, 3650);
}

function restoreMathPlaceholders(value, mathParts) {
    return value.replace(/@@AI_MATH_(\d+)@@/g, function (_, index) {
        const part = mathParts[Number(index)];
        if (!part) return "";
        const safeMath = escapeHTML(part.value);
        return part.display
            ? "<div class=\"ai-math-display\">\\[\n" + safeMath + "\n\\]</div>"
            : "<span class=\"ai-math-inline\">\\(" + safeMath + "\\)</span>";
    });
}

function formatAIInline(value, mathParts) {
    let html = value;
    html = html.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/`([^`\n]+?)`/g, "<code>$1</code>");
    return restoreMathPlaceholders(html, mathParts);
}

function formatAIContent(text) {
    const mathParts = [];
    let working = String(text ?? "");

    working = working.replace(/\$\$([\s\S]*?)\$\$/g, function (_, value) {
        const index = mathParts.push({ value, display: true }) - 1;
        return "@@AI_MATH_" + index + "@@";
    });

    working = working.replace(/\\\[([\s\S]*?)\\\]/g, function (_, value) {
        const index = mathParts.push({ value, display: true }) - 1;
        return "@@AI_MATH_" + index + "@@";
    });

    working = working.replace(/\\\(([\s\S]*?)\\\)/g, function (_, value) {
        const index = mathParts.push({ value, display: false }) - 1;
        return "@@AI_MATH_" + index + "@@";
    });

    working = working.replace(/(?<!\\)\$([^$\n]+?)\$/g, function (_, value) {
        const index = mathParts.push({ value, display: false }) - 1;
        return "@@AI_MATH_" + index + "@@";
    });

    working = escapeHTML(working);

    return working.split("\n").map(function (line) {
        if (!line.trim()) return "<div class=\"ai-content-spacer\"></div>";

        const heading = line.match(/^#{1,4}\s+(.+)$/);
        if (heading) {
            return "<h3 class=\"ai-content-heading\">" + formatAIInline(heading[1], mathParts) + "</h3>";
        }

        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
            return "<div class=\"ai-content-bullet\"><span>•</span><div>" + formatAIInline(bullet[1], mathParts) + "</div></div>";
        }

        const numbered = line.match(/^(\d+)\.\s+(.+)$/);
        if (numbered) {
            return "<div class=\"ai-content-numbered\"><span>" + numbered[1] + ".</span><div>" + formatAIInline(numbered[2], mathParts) + "</div></div>";
        }

        return "<div class=\"ai-content-line\">" + formatAIInline(line, mathParts) + "</div>";
    }).join("");
}

function typesetAIMath() {
    if (!aiMessages || !window.MathJax?.typesetPromise) return;
    window.MathJax.typesetPromise([aiMessages]).catch(function (error) {
        console.warn("Helix AI math rendering failed:", error);
    });
}
function renderAIMessage(text, type, time, imageDataUrl = "") {
    if (!aiMessages) return;

    const message = document.createElement("article");
    message.className = `ai-message ${type}`;

    const avatar = document.createElement("span");
    avatar.className = "ai-message-avatar";
    avatar.textContent = type === "user" ? "YOU" : "HX";

    const bubble = document.createElement("div");
    bubble.className = "ai-message-bubble";

    if (imageDataUrl && type === "user") {
        const image = document.createElement("img");
        image.className = "ai-message-image";
        image.src = imageDataUrl;
        image.alt = "Uploaded image";
        bubble.appendChild(image);
    }

    if (type === "assistant") {
        const content = document.createElement("div");
        content.className = "ai-message-content";
        content.innerHTML = formatAIContent(text);
        bubble.appendChild(content);
    } else {
        const content = document.createElement("div");
        content.className = "ai-message-content";
        content.textContent = text;
        bubble.appendChild(content);
    }

    const timeElement = document.createElement("time");
    timeElement.className = "ai-message-time";
    timeElement.textContent = time || getCurrentTime();
    bubble.appendChild(timeElement);

    message.append(avatar, bubble);
    aiMessages.appendChild(message);
    aiMessages.scrollTop = aiMessages.scrollHeight;

    if (type === "assistant") typesetAIMath();
}

function renderAIConversation() {
    if (!aiMessages) return;

    aiMessages.replaceChildren();
    aiConversation.forEach((message) => {
        renderAIMessage(
            message.content,
            message.role === "user" ? "user" : "assistant",
            message.time
        );
    });

    document.getElementById("ai-welcome")?.toggleAttribute("hidden", aiConversation.length > 0);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    updateAIChatState();
    typesetAIMath();
}

function addAIMessage(text, type, persist = true, imageDataUrl = "") {
    const time = getCurrentTime();

    renderAIMessage(text, type, time, imageDataUrl);

    if (persist) {
        aiConversation.push({
            role: type === "user" ? "user" : "assistant",
            content: text,
            time
        });
        saveAIConversation();
    }

    updateAIChatState();
}

function setAIProcessing(isProcessing) {
    if (aiTyping) aiTyping.hidden = !isProcessing;
    if (aiSendButton) aiSendButton.disabled = isProcessing;
    if (aiInput) aiInput.disabled = isProcessing;
}

function getHelixApiUrl(pathname) {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const configuredBase = typeof window.HELIX_API_URL === "string"
        ? window.HELIX_API_URL.trim().replace(/\/$/, "")
        : "";

    if (configuredBase) {
        return `${configuredBase}${normalizedPath}`;
    }

    if (
        window.location.protocol === "file:" ||
        (
            ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
            window.location.port !== "3000"
        )
    ) {
        return `http://localhost:3000${normalizedPath}`;
    }

    return normalizedPath;
}

async function fetchHelixAI(pathname, options = {}) {
    const primaryUrl = getHelixApiUrl(pathname);

    try {
        return await fetch(primaryUrl, {
            ...options,
            cache: "no-store"
        });
    } catch (primaryError) {
        const fallbackUrl = `http://localhost:3000${pathname}`;

        if (fallbackUrl !== primaryUrl && window.location.protocol !== "file:") {
            try {
                return await fetch(fallbackUrl, {
                    ...options,
                    cache: "no-store"
                });
            } catch {
                throw primaryError;
            }
        }

        throw primaryError;
    }
}

async function checkHelixAIStatus() {
    const statusElement = document.querySelector(".ai-sidebar-status");
    if (!statusElement) return;

    try {
        const response = await fetchHelixAI("/api/health", { method: "GET" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.ok !== true || data.reachable !== true) {
            statusElement.innerHTML = '<span class="status-dot"></span>AI OFFLINE';
            statusElement.classList.remove("online");
            statusElement.classList.add("offline");
            statusElement.title = data.aiError || "Helix AI is not reachable from the server.";
            return;
        }

        statusElement.innerHTML = '<span class="status-dot"></span>AI ONLINE';
        statusElement.classList.remove("offline");
        statusElement.classList.add("online");
    } catch {
        statusElement.innerHTML = '<span class="status-dot"></span>AI OFFLINE';
        statusElement.classList.remove("online");
        statusElement.classList.add("offline");
    }
}

async function fetchAIImageUsage() {
    if (!aiPhotoLimit) return;

    try {
        const response = await fetchHelixAI("/api/chat/image-usage", {
            method: "GET",
            credentials: "include"
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            aiPhotoLimit.textContent = "Photo uploads unavailable right now";
            return;
        }

        aiPhotoLimit.textContent =
            `${data.remaining} photo upload${data.remaining === 1 ? "" : "s"} left today`;
    } catch {
        aiPhotoLimit.textContent = "5 photo uploads per day";
    }
}

function setAIAttachmentMenu(open) {
    if (!aiAttachmentMenu || !aiAttachButton) return;
    aiAttachmentMenu.hidden = !open;
    aiAttachButton.setAttribute("aria-expanded", String(open));

    if (open) fetchAIImageUsage();
}

function clearPendingAIImage() {
    pendingAIImage = null;
    if (aiPhotoInput) aiPhotoInput.value = "";
    if (aiPhotoChip) aiPhotoChip.hidden = true;
    if (aiPhotoPreview) aiPhotoPreview.removeAttribute("src");
    if (aiPhotoName) aiPhotoName.textContent = "Photo ready";
    if (aiPhotoChipStatus) aiPhotoChipStatus.textContent = "Ready for Helix to analyze";
}

async function prepareAIPhoto(file) {
    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Could not read that image."));
            img.src = objectUrl;
        });

        const maxDimension = 1280;
        const scale = Math.min(
            1,
            maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
        );

        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not prepare the photo.");

        context.drawImage(image, 0, 0, width, height);

        let dataUrl = canvas.toDataURL("image/jpeg", 0.78);

        if (dataUrl.length > 1150000) {
            dataUrl = canvas.toDataURL("image/jpeg", 0.62);
        }

        if (dataUrl.length > 1400000) {
            throw new Error("That photo is too large to analyze. Please choose a smaller image.");
        }

        return dataUrl;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

async function sendAIMessage() {
    if (aiRequestInFlight || !aiInput || !aiForm) return;

    const message = aiInput.value.trim();
    const image = pendingAIImage;

    if (!message && !image) return;

    aiRequestInFlight = true;
    const originalImage = image;

    addAIMessage(
        message || "Analyze this image and explain what is shown.",
        "user",
        true,
        image?.dataUrl || ""
    );

    aiInput.value = "";
    document.getElementById("ai-welcome")?.setAttribute("hidden", "true");
    setAIProcessing(true);

    try {
        setAIAttachmentMenu(false);
        clearPendingAIImage();

        let response;
        let data = {};
        let lastError = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                response = await fetchHelixAI("/api/chat", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message,
                        image: image?.dataUrl || null,
                        history: aiConversation
                            .slice(0, -1)
                            .map(({ role, content }) => ({ role, content }))
                    })
                });

                data = await response.json().catch(() => ({}));

                if (response.ok) break;

                const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
                lastError = new Error(data.error || "Helix AI is temporarily unavailable.");

                if (!retryable || attempt === 2) throw lastError;
                await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
            } catch (error) {
                lastError = error;
                if (attempt === 2) throw error;
                await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
            }
        }

        if (!response?.ok) {
            throw lastError || new Error("Helix AI is temporarily unavailable.");
        }

        if (typeof data.reply !== "string" || !data.reply.trim()) {
            throw new Error("Helix AI returned an empty response.");
        }

        addAIMessage(data.reply, "assistant");

        if (Number.isInteger(data.imageUploadsRemaining) && aiPhotoLimit) {
            aiPhotoLimit.textContent =
                `${data.imageUploadsRemaining} photo upload${data.imageUploadsRemaining === 1 ? "" : "s"} left today`;
        }

        checkHelixAIStatus();
    } catch (error) {
        console.error("Helix AI send failed:", error);
        checkHelixAIStatus();

        if (aiInput) {
            aiInput.value = message;
            aiInput.focus();
        }

        if (originalImage && !pendingAIImage) {
            pendingAIImage = originalImage;
            if (aiPhotoPreview) aiPhotoPreview.src = originalImage.dataUrl;
            if (aiPhotoName) aiPhotoName.textContent = originalImage.name || "Photo ready";
            if (aiPhotoChipStatus) aiPhotoChipStatus.textContent = "Send again to analyze this photo";
            if (aiPhotoChip) aiPhotoChip.hidden = false;
        }

        showAIChatToast(error?.message || "Helix AI could not analyze the request.");
    } finally {
        aiRequestInFlight = false;
        setAIProcessing(false);
        aiInput?.focus();
    }
}

checkHelixAIStatus();

aiAttachButton?.addEventListener("click", (event) => {
    event.preventDefault();
    setAIAttachmentMenu(Boolean(aiAttachmentMenu?.hidden));
});

aiUploadPhotoButton?.addEventListener("click", (event) => {
    event.preventDefault();
    setAIAttachmentMenu(false);
    aiPhotoInput?.click();
});

aiPhotoInput?.addEventListener("change", async () => {
    const file = aiPhotoInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showAIChatToast("Choose a PNG, JPEG, or WebP image.");
        aiPhotoInput.value = "";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showAIChatToast("That photo is larger than 10 MB.");
        aiPhotoInput.value = "";
        return;
    }

    try {
        if (aiPhotoChipStatus) aiPhotoChipStatus.textContent = "Preparing photo...";
        const dataUrl = await prepareAIPhoto(file);

        pendingAIImage = {
            dataUrl,
            name: file.name,
            mimeType: "image/jpeg"
        };

        if (aiPhotoPreview) aiPhotoPreview.src = dataUrl;
        if (aiPhotoName) aiPhotoName.textContent = file.name;
        if (aiPhotoChipStatus) aiPhotoChipStatus.textContent = "Ready for Helix to analyze";
        if (aiPhotoChip) aiPhotoChip.hidden = false;

        fetchAIImageUsage();
    } catch (error) {
        clearPendingAIImage();
        showAIChatToast(error?.message || "Could not prepare that photo.");
    }
});

aiRemovePhotoButton?.addEventListener("click", (event) => {
    event.preventDefault();
    clearPendingAIImage();
});

document.addEventListener("click", (event) => {
    if (
        aiAttachmentMenu &&
        !aiAttachmentMenu.hidden &&
        !event.target.closest("#ai-attachment-menu") &&
        !event.target.closest("#ai-attach-button")
    ) {
        setAIAttachmentMenu(false);
    }
});

aiSendButton?.addEventListener("click", (event) => {
    event.preventDefault();
    sendAIMessage();
});

aiForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendAIMessage();
});

aiInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        aiForm?.requestSubmit();
    }
});

document.getElementById("clear-ai-button")?.addEventListener("click", () => {
    clearAIConversation();
});

document.getElementById("new-chat-button")?.addEventListener("click", () => {
    clearAIConversation();
});

document.getElementById("sidebar-new-chat-button")?.addEventListener("click", () => {
    startNewAIChat();
    aiInput?.focus();
});

document.getElementById("sidebar-search-chats-button")?.addEventListener("click", () => {
    const panel = document.getElementById("ai-chat-search-panel");
    const input = document.getElementById("ai-chat-search-input");
    if (!panel) return;

    panel.hidden = !panel.hidden;

    if (!panel.hidden) {
        input?.focus();
    } else if (input) {
        input.value = "";
        renderAIChatHistory();
    }
});

document.getElementById("ai-chat-search-input")?.addEventListener("input", (event) => {
    renderAIChatHistory(event.target.value);
});

document.getElementById("ai-chat-history")?.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-ai-chat-menu]");
    if (menuButton) {
        event.stopPropagation();

        const chatId = menuButton.dataset.aiChatMenu;
        const panel = document.querySelector(`[data-ai-chat-menu-panel="${CSS.escape(chatId)}"]`);
        if (!panel) return;

        document.querySelectorAll(".ai-chat-history-menu").forEach((menu) => {
            if (menu !== panel) menu.hidden = true;
        });
        document.querySelectorAll(".ai-chat-history-menu-button").forEach((button) => {
            if (button !== menuButton) button.setAttribute("aria-expanded", "false");
        });

        panel.hidden = !panel.hidden;
        menuButton.setAttribute("aria-expanded", String(!panel.hidden));
        return;
    }

    const actionButton = event.target.closest("[data-ai-chat-action]");
    if (actionButton) {
        event.stopPropagation();
        document.querySelectorAll(".ai-chat-history-menu").forEach((menu) => menu.hidden = true);
        document.querySelectorAll(".ai-chat-history-menu-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
        handleAIChatAction(actionButton.dataset.aiChatAction, actionButton.dataset.aiChatId);
        return;
    }

    const openButton = event.target.closest("[data-ai-chat-open]");
    if (!openButton) return;
    loadAIChatSession(openButton.dataset.aiChatOpen);
});

document.addEventListener("click", (event) => {
    if (event.target.closest(".ai-chat-history-item")) return;
    document.querySelectorAll(".ai-chat-history-menu").forEach((menu) => menu.hidden = true);
    document.querySelectorAll(".ai-chat-history-menu-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
});

document.getElementById("ai-chat-action-modal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-ai-chat-modal-close]")) {
        closeAIChatActionModal();
    }
});

document.getElementById("nav-ai")?.addEventListener("click", () => {
    renderAIChatHistory();
});


renderAIConversation();
renderAIChatHistory();

const aiView = document.getElementById("ai-view");
const closeAISidebarButton = document.getElementById("close-ai-sidebar-button");
const openAISidebarButton = document.getElementById("open-ai-sidebar-button");

function setAISidebarOpen(isOpen) {
    aiView?.classList.toggle("sidebar-closed", !isOpen);
    if (openAISidebarButton) openAISidebarButton.hidden = isOpen;
    if (closeAISidebarButton) closeAISidebarButton.setAttribute("aria-expanded", String(isOpen));
}

closeAISidebarButton?.addEventListener("click", () => setAISidebarOpen(false));
openAISidebarButton?.addEventListener("click", () => setAISidebarOpen(true));

// =========================================================
// NAVIGATION
// =========================================================
let previousNavigationSection = null;
function renderHelixReels() {
    const reelsFeed = document.getElementById("reels-feed");
    if (!reelsFeed) return;

    // Reels will be rebuilt later.
}

function setupReelObserver() {
    // Reels observer will be rebuilt later.
}

function pauseAllVideos(exceptVideo = null) {
    document.querySelectorAll("video").forEach((video) => {
        if (video !== exceptVideo) {
            video.pause();
        }
    });
}

function setNavigationSection(id) {
    const section =
        id === "nav-home"
            ? "home"
            : id === "nav-console"
                ? "direct-messages"
                : id === "nav-friends"
                ? "friends"
                : id === "nav-ai"
                    ? "helix-ai"
                    : id === "nav-reels"
                        ? "reels"
                        : "profile";

    const mainSections =
        document.querySelectorAll("[data-main-section]");

    const appShell =
        document.querySelector(".helix-app");

    const showReels =
        section === "reels";

    appShell?.classList.toggle(
        "home-active",
        section === "home"
    );

    mainSections.forEach((mainSection) => {
        mainSection.hidden =
            mainSection.dataset.mainSection !== section;
    });

    if (section === "helix-ai") {
        setAISidebarOpen(true);
    }

    if (showReels) {

        const reelsSection =
            document.getElementById("reels-view");

        if (reelsSection) {
            reelsSection.hidden = false;
        }

        const reelsFeed =
            document.getElementById("reels-feed");

        if (
            reelsFeed &&
            !reelsFeed.querySelector(".helix-reel-card")
        ) {
            if (
                typeof renderHelixReels === "function"
            ) {
                renderHelixReels();
            }
        }

        if (
            typeof setupReelObserver === "function"
        ) {
            setupReelObserver();
        }

    } else {

        if (
            typeof pauseAllVideos === "function"
        ) {
            pauseAllVideos();
        }

    }

    if (section === "profile") {

        if (
            typeof updateProfileView === "function"
        ) {
            updateProfileView();
        }

    }

    previousNavigationSection =
        section;
}

function updateProfileView() {
    const profileDisplayName = document.getElementById("profile-display-name");
    const profileUsername = document.getElementById("profile-account-username");
    const profileCreated = document.getElementById("profile-account-created");
    const profileEmail = document.getElementById("profile-account-email");
    const profilePhone = document.getElementById("profile-account-phone");
    const profilePhotoPreview = document.getElementById("profile-photo-preview");
    const profilePhotoInitials = document.getElementById("profile-photo-initials");

    const users = readLocalJSON("helixUsers", {});
    const account = users[loggedInUser] || {};
    const displayName = account.displayName || currentDisplayName || loggedInUser || "User";

    currentDisplayName = displayName;
    localStorage.setItem("helixDisplayName", displayName);

    if (users[loggedInUser]) {
        users[loggedInUser].displayName = displayName;
        localStorage.setItem("helixUsers", JSON.stringify(users));
    }

    if (profileDisplayName) {
        profileDisplayName.textContent = displayName;
    }

    if (profileUsername) {
        profileUsername.textContent = loggedInUser || "Not available";
    }

    if (profileCreated) {
        profileCreated.textContent = account?.createdAt
            ? new Date(account.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric"
            })
            : "Not recorded";
    }

    if (profileEmail) {
        profileEmail.textContent = account?.email || account?.linkedEmail || localStorage.getItem("helixEmail") || "Not linked";
    }

    if (profilePhone) {
        profilePhone.textContent = formatPhone(account?.phone || account?.linkedPhone || localStorage.getItem("helixPhone"));
    }

    if (profilePhotoPreview) {
        const photo = localStorage.getItem(`helixProfilePhoto:${loggedInUser}`);
        profilePhotoPreview.style.backgroundImage = photo ? `url("${photo}")` : "";
        profilePhotoPreview.classList.toggle("has-photo", Boolean(photo));
    }

    if (profilePhotoInitials) {
        profilePhotoInitials.textContent = displayName.slice(0, 2).toUpperCase();
    }

    updateLoggedInUser();
}

function formatPhone(phone) {
    if (!phone) return "Not linked";

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return "••••";

    return `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

const logoutAllSessionsButton = document.getElementById("logout-all-sessions-btn");
const profileActionMessage = document.getElementById("profile-action-message");

const accountModal = document.getElementById("account-modal");
const accountModalForm = document.getElementById("account-modal-form");
const accountModalTitle = document.getElementById("account-modal-title");
const accountModalDescription = document.getElementById("account-modal-description");
const accountModalFields = document.getElementById("account-modal-fields");
const accountModalError = document.getElementById("account-modal-error");
const accountModalSubmit = document.getElementById("account-modal-submit");
let activeAccountAction = "";

function openAccountModal(action) {
    if (!accountModal) return;

    activeAccountAction = action;
    accountModalError.textContent = "";

    accountModalFields.innerHTML = action === "display-name"
        ? `<label class="helix-modal-label" for="account-modal-display-name">Display name</label>
           <input class="helix-modal-input" id="account-modal-display-name" type="text" autocomplete="name" value="${escapeHTML(getCurrentDisplayName())}" maxlength="50" required>
           <p class="helix-confirmation-copy">This is the name people will see. Your username stays permanent.</p>`
        : action === "email"
            ? `<label class="helix-modal-label" for="account-modal-email">Gmail address</label><input class="helix-modal-input" id="account-modal-email" type="email" autocomplete="email" placeholder="you@gmail.com" required>`
            : action === "phone"
                ? `<label class="helix-modal-label" for="account-modal-phone">Phone number</label><input class="helix-modal-input" id="account-modal-phone" type="tel" autocomplete="tel" placeholder="+1 555 010 2048" required>`
                : action === "password"
                    ? `<label class="helix-modal-label" for="account-modal-current-password">Current password</label><input class="helix-modal-input" id="account-modal-current-password" type="password" autocomplete="current-password" required><label class="helix-modal-label" for="account-modal-new-password">New password</label><input class="helix-modal-input" id="account-modal-new-password" type="password" autocomplete="new-password" minlength="8" required>`
                    : action === "delete-account"
                        ? `<label class="helix-modal-label" for="account-modal-delete-password">Current password</label><input class="helix-modal-input" id="account-modal-delete-password" type="password" autocomplete="current-password" required><p class="helix-confirmation-copy">This permanently removes your Helix account, friends, DMs, settings and profile data.</p>`
                        : `<p class="helix-confirmation-copy">This will end every active Helix session for this account.</p>`;

    accountModalTitle.textContent = action === "display-name" ? "Change display name"
        : action === "email" ? "Link Gmail"
        : action === "phone" ? "Add phone"
        : action === "password" ? "Change password"
        : action === "delete-account" ? "Delete account"
        : "End all sessions";

    accountModalDescription.textContent = action === "sessions"
        ? "Confirm network-wide session termination."
        : "Update your Helix identity settings.";

    accountModalSubmit.textContent = action === "sessions"
        ? "Log out everywhere"
        : action === "delete-account"
            ? "Delete permanently"
            : "Save changes";
    accountModalSubmit.classList.toggle("profile-danger-button", action === "sessions" || action === "delete-account");
    accountModal.hidden = false;

    const firstInput = accountModalFields.querySelector("input");
    if (firstInput) firstInput.focus();
}

function closeAccountModal() {
    if (accountModal) accountModal.hidden = true;
    activeAccountAction = "";
}

document.querySelectorAll("[data-modal-close]").forEach((element) => {
    element.addEventListener("click", closeAccountModal);
});

document.getElementById("change-display-name-btn")?.addEventListener("click", () => openAccountModal("display-name"));
document.getElementById("link-email-btn")?.addEventListener("click", () => openAccountModal("email"));
document.getElementById("add-phone-btn")?.addEventListener("click", () => openAccountModal("phone"));
document.getElementById("change-password-btn")?.addEventListener("click", () => openAccountModal("password"));
logoutAllSessionsButton?.addEventListener("click", () => openAccountModal("sessions"));

accountModalForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    accountModalError.textContent = "";

    if (activeAccountAction === "display-name") {
        const field = document.getElementById("account-modal-display-name");
        const displayName = (field?.value || "").trim().replace(/\s+/g, " ");

        if (!displayName || displayName.length > 50 || /[\u0000-\u001F\u007F]/.test(displayName)) {
            accountModalError.textContent = "Choose a display name from 1–50 characters without control characters.";
            return;
        }

        accountModalSubmit.disabled = true;
        accountModalSubmit.textContent = "Saving...";

        try {
            const response = await fetch("/api/profile/display-name", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName })
            });

            const data = await response.json().catch(() => ({}));

            if (response.status === 400) {
                accountModalError.textContent = data.error || "Choose a display name from 1–50 characters.";
                return;
            }

            if (!response.ok) {
                accountModalError.textContent = data.error || "Helix could not save your display name.";
                return;
            }

            setCurrentProfileUser(data.user || {
                username: loggedInUser,
                displayName
            });

            updateProfileView();
            closeAccountModal();

            if (profileActionMessage) {
                profileActionMessage.textContent = "Display name updated.";
            }
        } catch (error) {
            accountModalError.textContent = "Helix could not reach the server. Make sure the backend is running.";
        } finally {
            accountModalSubmit.disabled = false;
            accountModalSubmit.textContent = "Save changes";
        }

        return;
    }

    if (activeAccountAction === "email" || activeAccountAction === "phone") {
        const type = activeAccountAction;
        const field = document.getElementById("account-modal-" + type);
        const value = (field?.value || "").trim();

        if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            accountModalError.textContent = "Enter a valid email address.";
            return;
        }
        if (type === "phone" && value.replace(/\D/g, "").length < 7) {
            accountModalError.textContent = "Enter a valid phone number.";
            return;
        }

        accountModalSubmit.disabled = true;
        accountModalSubmit.textContent = "Saving...";
        try {
            const response = await fetch("/api/profile/contact", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, value })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                accountModalError.textContent = data.error || "Could not update your contact information.";
                return;
            }
            setCurrentProfileUser(data.user || { username: loggedInUser, displayName: getCurrentDisplayName(), [type]: value });
            updateProfileView();
            closeAccountModal();
            if (profileActionMessage) profileActionMessage.textContent = type === "email" ? "Email linked." : "Phone number added.";
        } catch {
            accountModalError.textContent = "Helix could not reach the server.";
        } finally {
            accountModalSubmit.disabled = false;
            accountModalSubmit.textContent = "Save changes";
        }
        return;

    } else if (activeAccountAction === "password") {
        const currentPassword = document.getElementById("account-modal-current-password")?.value || "";
        const newPassword = document.getElementById("account-modal-new-password")?.value || "";
        if (newPassword.length < 8) {
            accountModalError.textContent = "New password must be at least 8 characters.";
            return;
        }
        accountModalSubmit.disabled = true;
        accountModalSubmit.textContent = "Changing...";
        try {
            const response = await fetch("/api/profile/password", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                accountModalError.textContent = data.error || "Could not change your password.";
                return;
            }
            closeAccountModal();
            localStorage.removeItem("helixLoggedIn");
            localStorage.removeItem("helixDisplayName");
            window.location.href = "index.html";
        } catch {
            accountModalError.textContent = "Helix could not reach the server.";
        } finally {
            accountModalSubmit.disabled = false;
        }
        return;

    } else if (activeAccountAction === "delete-account") {
        const password = document.getElementById("account-modal-delete-password")?.value || "";
        if (!password) {
            accountModalError.textContent = "Enter your current password.";
            return;
        }
        if (!window.confirm("Permanently delete your Helix account and all cloud data?")) return;
        accountModalSubmit.disabled = true;
        accountModalSubmit.textContent = "Deleting...";
        try {
            const response = await fetch("/api/account", {
                method: "DELETE",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                accountModalError.textContent = data.error || "Could not delete your account.";
                return;
            }
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "index.html";
        } catch {
            accountModalError.textContent = "Helix could not reach the server.";
        } finally {
            accountModalSubmit.disabled = false;
            accountModalSubmit.textContent = "Delete permanently";
        }
        return;

    } else if (activeAccountAction === "sessions") {
        accountModalSubmit.disabled = true;
        accountModalSubmit.textContent = "Ending...";
        try {
            const response = await fetch("/api/auth/logout-all", {
                method: "POST",
                credentials: "include"
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                accountModalError.textContent = data.error || "Could not end all sessions.";
                return;
            }
            localStorage.removeItem("helixLoggedIn");
            localStorage.removeItem("helixDisplayName");
            window.location.href = "index.html";
        } catch {
            accountModalError.textContent = "Helix could not reach the server.";
        } finally {
            accountModalSubmit.disabled = false;
        }
        return;
    }

    updateProfileView();
    if (profileActionMessage) profileActionMessage.textContent = "Account record updated.";
    closeAccountModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAccountModal();
});

const profilePhotoInput = document.getElementById("profile-photo-input");
const profilePhotoMessage = document.getElementById("profile-photo-message");

async function prepareProfilePhoto(file) {
    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Could not read that image."));
            img.src = objectUrl;
        });

        const maxDimension = 512;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not prepare the profile photo.");

        context.drawImage(image, 0, 0, width, height);

        // WebP keeps the database/network payload compact while preserving
        // enough quality for circular DM avatars.
        let dataUrl = canvas.toDataURL("image/webp", 0.82);

        // A fallback for browsers that do not support WebP encoding.
        if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        }

        // Keep the JSON request comfortably under the server limit.
        if (dataUrl.length > 850000) {
            dataUrl = canvas.toDataURL("image/jpeg", 0.68);
        }

        if (dataUrl.length > 900000) {
            throw new Error("That image is still too large after compression. Please choose a simpler photo.");
        }

        return dataUrl;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

profilePhotoInput?.addEventListener("change", async () => {
    const file = profilePhotoInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        profilePhotoMessage.textContent = "Select a supported image file.";
        profilePhotoInput.value = "";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        profilePhotoMessage.textContent = "Photo must be smaller than 10 MB.";
        profilePhotoInput.value = "";
        return;
    }

    profilePhotoInput.disabled = true;
    profilePhotoMessage.textContent = "Uploading profile photo...";

    try {
        const profilePhoto = await prepareProfilePhoto(file);

        const response = await fetch("/api/profile/photo", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profilePhoto })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Could not save your profile photo.");
        }

        setCurrentProfileUser(data.user || {
            username: loggedInUser,
            displayName: getCurrentDisplayName(),
            profilePhoto
        });

        localStorage.setItem(`helixProfilePhoto:${loggedInUser}`, profilePhoto);
        updateProfileView();
        profilePhotoMessage.textContent = "Profile photo is now public across Helix.";
        profilePhotoInput.value = "";

        // Tell every live Helix surface to refresh the public avatar immediately.
        window.dispatchEvent(new CustomEvent("helix-profile-photo-updated", {
            detail: { username: loggedInUser, profilePhoto }
        }));

        // Refresh the network/DM data so friends immediately receive the
        // public avatar without needing to log out.
        if (typeof refreshFriendsNetwork === "function") {
            await refreshFriendsNetwork();
        }
    } catch (error) {
        profilePhotoMessage.textContent = error.message || "Could not save your profile photo.";
    } finally {
        profilePhotoInput.disabled = false;
    }
});

const navItems =
    document.querySelectorAll(".nav-item");

navItems.forEach((item) => {

    item.addEventListener("click", () => {

        navItems.forEach((nav) => {
            nav.classList.remove("active");
        });

        item.classList.add("active");

        handleNavigation(item.id);
    });
});


function handleNavigation(id) {

    setNavigationSection(id);

    switch (id) {

        case "nav-home":
            console.log("Helix Home selected");
            break;

        case "nav-console":
            console.log("Direct Console selected");
            break;

        case "nav-friends":
            refreshFriendsNetwork();
            break;

        case "nav-ai":
            console.log("Helix AI selected");
            break;

        case "nav-reels":
            console.log("Reels selected");
            break;

        case "nav-profile":
            console.log("Profile selected");
            break;

        default:
            console.log("Unknown navigation");
    }
}


// =========================================================
// BROADCAST BUTTON
// =========================================================

const broadcastButton =
    document.getElementById("broadcast-btn");

if (broadcastButton) {

    broadcastButton.addEventListener("click", () => {
        setNavigationSection("nav-home");
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.id === "nav-home"));
        document.getElementById("broadcast-input")?.focus();
    });
}

const broadcastForm = document.getElementById("broadcast-form");
const broadcastInput = document.getElementById("broadcast-input");
const characterCount = document.getElementById("character-count");
const communityFeed = document.getElementById("community-feed");
const commentsModal = document.getElementById("comments-modal");
const commentsList = document.getElementById("comments-list");
const commentForm = document.getElementById("comment-form");
const commentInput = document.getElementById("comment-input");
let activeCommentPost = null;
const postComments = {};

broadcastInput?.addEventListener("input", () => {
    if (characterCount) characterCount.textContent = `${broadcastInput.value.length} / 280`;
});

broadcastForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = broadcastInput.value.trim();
    if (!text || !communityFeed) return;

    const username = loggedInUser || "User";
    const displayName = getCurrentDisplayName();
    const post = document.createElement("article");
    post.className = "community-post";
    post.dataset.searchable = text.toLowerCase();
    post.dataset.postId = `post-${Date.now()}`;
    postComments[post.dataset.postId] = [];
    post.innerHTML = `<div class="post-avatar avatar-lavender">${escapeHTML(displayName.slice(0, 2).toUpperCase())}</div><div class="post-content"><div class="post-meta"><div><strong>${escapeHTML(displayName)}</strong><span>-${escapeHTML(username)} · now</span></div><button class="post-menu" type="button" aria-label="Post options">•••</button></div><p>${escapeHTML(text)}</p><div class="post-actions"><button type="button" data-post-action="like">♡ <span>0</span></button><button type="button" data-post-action="comment">◌ <span>0</span></button><button type="button" data-post-action="share">↗ <span>Share</span></button><button type="button" data-post-action="save">☆ <span>Save</span></button></div></div>`;
    communityFeed.prepend(post);
    broadcastInput.value = "";
    if (characterCount) characterCount.textContent = "0 / 280";
});

document.getElementById("home-search")?.addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase().trim();
    communityFeed?.querySelectorAll(".community-post").forEach((post) => {
        post.hidden = query && !post.dataset.searchable.includes(query);
    });
    const visiblePosts = communityFeed?.querySelectorAll(".community-post:not([hidden])").length || 0;
    const emptyState = document.getElementById("feed-empty-state");
    if (emptyState) emptyState.hidden = visiblePosts > 0;
});

function renderComments(post) {
    if (!commentsList) return;
    const comments = postComments[post.dataset.postId] || [];
    commentsList.innerHTML = comments.length
        ? comments.map((comment) => `<div class="comment-item"><span class="comment-avatar">${escapeHTML((comment.author || "User").slice(0, 2).toUpperCase())}</span><div><strong>${escapeHTML(comment.author || "User")}</strong><small>-${escapeHTML(comment.username || comment.author || "User")}</small><p>${escapeHTML(comment.text)}</p></div></div>`).join("")
        : `<p class="comments-empty">No comments yet. Start the conversation.</p>`;
}

function openComments(post) {
    if (!commentsModal) {
        const status = document.getElementById("profile-action-message");
        if (status) status.textContent = "Comments are temporarily unavailable.";
        return;
    }

    activeCommentPost = post;
    renderComments(post);
    commentsModal.hidden = false;
    commentInput?.focus();
}

function closeComments() {
    if (commentsModal) commentsModal.hidden = true;
    activeCommentPost = null;
}

communityFeed?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-post-action]");
    if (!actionButton) return;
    const post = actionButton.closest(".community-post");
    const action = actionButton.dataset.postAction;
    const count = actionButton.querySelector("span");

    if (action === "like") {
        const liked = actionButton.classList.toggle("active");
        const currentCount = Number(count.textContent) || 0;
        count.textContent = String(currentCount + (liked ? 1 : -1));
        actionButton.firstChild.textContent = liked ? "♥ " : "♡ ";
    }
    if (action === "save") {
        const saved = actionButton.classList.toggle("active");
        actionButton.firstChild.textContent = saved ? "★ " : "☆ ";
        count.textContent = saved ? "Saved" : "Save";
    }
    if (action === "comment") openComments(post);
    if (action === "share") {
        const shareText = post.querySelector(".post-content > p")?.textContent || "Helix post";
        try {
            await navigator.clipboard.writeText(shareText);
            count.textContent = "Copied";
        } catch (error) {
            count.textContent = "Ready";
        }
    }
});

document.querySelectorAll("[data-comments-close]").forEach((element) => element.addEventListener("click", closeComments));
commentForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = commentInput?.value.trim();
    if (!text || !activeCommentPost) return;
    const key = activeCommentPost.dataset.postId;
    postComments[key] = postComments[key] || [];
    postComments[key].push({ author: loggedInUser || "User", text });
    const commentButton = activeCommentPost.querySelector('[data-post-action="comment"] span');
    if (commentButton) commentButton.textContent = String(postComments[key].length);
    commentInput.value = "";
    renderComments(activeCommentPost);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeComments();
});

document.querySelectorAll(".quick-conversation").forEach((button) => {
    button.addEventListener("click", () => document.getElementById("nav-console")?.click());
});

document.querySelectorAll("[data-target-nav]").forEach((button) => {
    button.addEventListener("click", () => {
        if (button.id === "home-broadcast-shortcut") {
            document.getElementById("broadcast-input")?.focus();
            return;
        }

        document.getElementById(button.dataset.targetNav)?.click();
    });
});

document.getElementById("hero-broadcast-button")?.addEventListener("click", () => {
    document.getElementById("broadcast-input")?.focus();
});

document.getElementById("hero-ai-button")?.addEventListener("click", () => document.getElementById("nav-ai")?.click());
document.getElementById("feature-ai-button")?.addEventListener("click", () => document.getElementById("nav-ai")?.click());

document.getElementById("home-profile-shortcut")?.addEventListener("click", () => {
    document.getElementById("nav-profile")?.click();
});


// =========================================================
// UNPIN
// =========================================================

const unpinButton =
    document.getElementById("unpin-btn");

if (unpinButton) {

    unpinButton.addEventListener("click", () => {

        unpinButton.textContent =
            unpinButton.textContent === "Unpin"
                ? "Pinned"
                : "Unpin";

    });
}


// =========================================================
// MUTE
// =========================================================

const homeMuteButton =
    document.getElementById("mute-btn");

if (homeMuteButton) {

    homeMuteButton.addEventListener("click", () => {

        const isMuted =
            homeMuteButton.textContent === "Unmute";

        homeMuteButton.textContent =
            isMuted ? "Mute" : "Unmute";

        homeMuteButton.classList.toggle("muted");
    });
}



// =========================================================
// HELIX SETTINGS CONTROLS
// =========================================================
const settingsItems = document.querySelectorAll(".profile-settings-item");
const settingsSections = document.querySelectorAll("[data-settings-section]");

function focusSettingsSection(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    settingsItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.settingsTarget === targetId);
    });

    target.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

settingsItems.forEach((item) => {
    item.addEventListener("click", () => {
        focusSettingsSection(item.dataset.settingsTarget || "settings-account");
    });
});

async function loadCloudProfileSettings() {
    if (!loggedInUser) return;
    try {
        const response = await fetch("/api/settings", { credentials: "include", cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.settings) return;
        const settings = data.settings;
        try {
            localStorage.setItem("helixPrivacySettings", JSON.stringify(settings.privacy || {}));
            localStorage.setItem("helixNotificationSettings:v2", JSON.stringify(settings.notifications || {}));
            localStorage.setItem("helixAppearanceSettings", JSON.stringify(settings.appearance || {}));
            localStorage.setItem("helixDigitalDetox:" + loggedInUser, JSON.stringify(settings.detox || {}));
        } catch {}
        window.dispatchEvent(new CustomEvent("helix-cloud-settings-loaded", { detail: settings }));
    } catch (error) {
        console.warn("Could not load cloud profile settings:", error);
    }
}

async function saveCloudSettingGroup(group, values) {
    if (!loggedInUser) return false;
    try {
        const response = await fetch("/api/settings/" + encodeURIComponent(group), {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ values })
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            console.warn("Cloud settings save failed:", data.error || response.status);
            return false;
        }
        return true;
    } catch (error) {
        console.warn("Cloud settings request failed:", error);
        return false;
    }
}
function setDataDownloadStatus(title, detail) {
    const status = document.getElementById("data-download-status");
    if (!status) return;

    const strong = status.querySelector("strong");
    const small = status.querySelector("small");

    if (strong) strong.textContent = title;
    if (small) small.textContent = detail;
}

function readLocalJSON(key, fallback = []) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function collectHelixLocalData() {
    const data = {};

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);

        if (!key || !key.toLowerCase().startsWith("helix")) continue;

        const rawValue = localStorage.getItem(key);

        try {
            data[key] = JSON.parse(rawValue);
        } catch {
            data[key] = rawValue;
        }
    }

    return data;
}

function getCurrentAccountRecord() {
    const users = readLocalJSON("helixUsers", {});
    if (!users || typeof users !== "object" || Array.isArray(users)) return null;

    return users[loggedInUser] || null;
}

function downloadHelixJSON(filename, payload) {
    const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportHelixData(type) {
    const accountRecord = getCurrentAccountRecord();
    const profilePhoto = loggedInUser
        ? localStorage.getItem(`helixProfilePhoto:${loggedInUser}`)
        : null;

    const payload = {
        exportedAt: new Date().toISOString(),
        exportType: type,
        account: {
            username: loggedInUser || null,
            displayName: accountRecord?.displayName || getCurrentDisplayName(),
            createdAt: accountRecord?.createdAt || null,
            email: accountRecord?.email || accountRecord?.linkedEmail || null,
            phone: accountRecord?.phone || accountRecord?.linkedPhone || null
        },
        profile: {
            profilePhoto: profilePhoto || null
        },
        localData: collectHelixLocalData()
    };

    if (type === "content") {
        payload.content = {
            posts: readLocalJSON("helixPosts", readLocalJSON("helixActivityPosts", [])),
            comments: readLocalJSON("helixComments", readLocalJSON("helixActivityComments", [])),
            likes: readLocalJSON("helixLikes", readLocalJSON("helixActivityLikes", [])),
            savedPosts: readLocalJSON("helixSavedPosts", []),
            savedReels: readLocalJSON("helixSavedReels", []),
            recentlyViewed: readLocalJSON("helixRecentlyViewed", [])
        };
    }

    const suffix = type === "content" ? "content-export" : "account-data";
    const safeUsername = (loggedInUser || "user").replace(/[^a-z0-9_-]/gi, "_");

    downloadHelixJSON(
        `helix-${safeUsername}-${suffix}.json`,
        payload
    );

    setDataDownloadStatus(
        "Export downloaded",
        type === "content"
            ? "Your profile, locally stored content and media references were packaged into a JSON file."
            : "Your Helix account information and locally stored Helix data were packaged into a JSON file."
    );
}

function clearHelixLocalData() {
    const confirmed = window.confirm(
        "Clear all Helix data stored in this browser? You will be signed out and this cannot be undone."
    );

    if (!confirmed) return;

    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "index.html";
}

function openHelpSupportModal(action) {
    const modal = document.getElementById("help-support-modal");
    const title = document.getElementById("help-support-modal-title");
    const description = document.getElementById("help-support-modal-description");
    const body = document.getElementById("help-support-modal-body");
    if (!modal || !title || !description || !body) return;

    const closeModal = () => {
        modal.hidden = true;
        body.innerHTML = "";
    };

    const renderForm = (heading, copy, fields, submitLabel = "Save request") => {
        body.innerHTML = `
            <div class="help-support-copy">
                <strong>${heading}</strong>
                <p>${copy}</p>
            </div>
            <form class="help-support-form" id="help-support-form">
                ${fields}
                <div class="helix-modal-actions">
                    <button class="profile-secondary-button" type="button" data-help-modal-close>Cancel</button>
                    <button class="profile-primary-button" type="submit">${submitLabel}</button>
                </div>
            </form>
        `;

        body.querySelectorAll("[data-help-modal-close]").forEach((button) => {
            button.addEventListener("click", closeModal);
        });

        body.querySelector("form")?.addEventListener("submit", (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const requests = readLocalJSON("helixSupportRequests", []);
            requests.push({
                type: action,
                username: loggedInUser || null,
                createdAt: new Date().toISOString(),
                details: Object.fromEntries(formData.entries())
            });
            localStorage.setItem("helixSupportRequests", JSON.stringify(requests));
            body.innerHTML = `
                <div class="help-support-success">
                    <strong>Request saved</strong>
                    <p>This prototype stored your request locally in this browser. A server-side Helix support system can be connected later.</p>
                    <button class="profile-primary-button" type="button" data-help-modal-close>Close</button>
                </div>
            `;
            body.querySelector("[data-help-modal-close]")?.addEventListener("click", closeModal);
        });
    };

    if (action === "help") {
        title.textContent = "Help Center";
        description.textContent = "Quick guidance for the main Helix features.";
        body.innerHTML = `
            <div class="help-support-card-list">
                <article><strong>Account & settings</strong><p>Use Profile → Settings to manage your account, privacy, notifications, appearance, activity and local data.</p></article>
                <article><strong>Friends & messages</strong><p>Use Friends to find connections and Direct Messages to view conversations.</p></article>
                <article><strong>Helix AI & Reels</strong><p>Open Helix AI for conversations with the assistant and Reels to browse the video area.</p></article>
            </div>
        `;
    } else if (action === "faq") {
        title.textContent = "FAQ";
        description.textContent = "Common questions about the current Helix prototype.";
        body.innerHTML = `
            <div class="help-support-faq">
                <details open><summary>Where are my settings saved?</summary><p>Most current settings in this prototype are stored in your browser's local storage.</p></details>
                <details><summary>Can I export my Helix data?</summary><p>Yes. Data & Downloads provides account-data and content-export JSON downloads.</p></details>
                <details><summary>What happens if I clear local data?</summary><p>Helix clears browser-stored local and session data and signs you out.</p></details>
                <details><summary>Can I permanently delete my account?</summary><p>Not yet. Account deletion is marked as coming soon until secure server-side account management is available.</p></details>
            </div>
        `;
    } else if (action === "bug-report") {
        title.textContent = "Bug report";
        description.textContent = "Describe a technical problem so it can be reviewed later.";
        renderForm(
            "Report a bug",
            "Include enough detail to reproduce the issue.",
            `
                <label>What happened<input name="title" required maxlength="120" placeholder="Short description"></label>
                <label>Details<textarea name="details" required maxlength="2000" rows="5" placeholder="Steps, expected result and what you saw..."></textarea></label>
            `,
            "Save bug report"
        );
    } else if (action === "report") {
        title.textContent = "User / content report";
        description.textContent = "Record a report about an account or piece of content.";
        renderForm(
            "Submit a report",
            "Choose what you are reporting and provide the relevant details.",
            `
                <label>Report type<select name="reportType" required><option value="user">User</option><option value="post">Post</option><option value="reel">Reel</option><option value="other">Other content</option></select></label>
                <label>Username or content reference<input name="reference" maxlength="160" placeholder="@username or content reference"></label>
                <label>Reason<textarea name="reason" required maxlength="1200" rows="4" placeholder="Explain the issue..."></textarea></label>
            `,
            "Save report"
        );
    } else if (action === "contact-support") {
        title.textContent = "Contact support";
        description.textContent = "Send a support request from the Helix settings area.";
        renderForm(
            "Contact Helix support",
            "Add a subject and message. The current prototype stores the request locally.",
            `
                <label>Subject<input name="subject" required maxlength="120" placeholder="How can we help?"></label>
                <label>Message<textarea name="message" required maxlength="2000" rows="6" placeholder="Describe your request..."></textarea></label>
            `,
            "Save support request"
        );
    } else {
        title.textContent = "About Helix";
        description.textContent = "Project information for the current Helix build.";
        body.innerHTML = `
            <div class="help-support-about">
                <div><span>Platform</span><strong>HELIX</strong></div>
                <div><span>Build</span><strong>Futuristic social + communication prototype</strong></div>
                <div><span>Support</span><strong>Help &amp; Support workspace</strong></div>
                <p>Helix combines social communication, profiles, friends, Direct Messages, Reels and Helix AI in one interface.</p>
            </div>
        `;
    }

    modal.hidden = false;
    modal.querySelector("[data-help-modal-close]")?.addEventListener("click", closeModal);
}

document.querySelectorAll("[data-help-modal-close]").forEach((button) => {
    button.addEventListener("click", () => {
        const modal = document.getElementById("help-support-modal");
        if (modal) modal.hidden = true;
    });
});

document.querySelectorAll("[data-settings-action]").forEach((button) => {
    button.addEventListener("click", () => {
        const action = button.dataset.settingsAction;
        const state = button.querySelector(".settings-option-state");

        if (action === "download-data") {
            exportHelixData("account");
            return;
        }

        if (action === "export-content") {
            exportHelixData("content");
            return;
        }

        if (action === "clear-local-data") {
            clearHelixLocalData();
            return;
        }

        if (action === "delete-account") {
            setDataDownloadStatus(
                "Account deletion is not available yet",
                "Permanent deletion will be connected after Helix moves to a secure server-side account system."
            );
            return;
        }

        if (state && ["private", "activity-status", "message-notifications", "friend-notifications", "post-notifications", "compact"].includes(action)) {
            const on = state.textContent.trim() === "ON";
            state.textContent = on ? "OFF" : "ON";
        }

        if (action === "theme") {
            document.body.classList.toggle("helix-soft-mode");
            if (state) state.textContent = document.body.classList.contains("helix-soft-mode") ? "SOFT" : "DARK";
        }

        const messages = {
            "activity-log": "Activity log is ready for the database-backed activity system.",
            "saved": "Saved content will appear here as your saved posts are added.",
            "deactivate": "Account deactivation will be connected to the secure account system."
        };

        if (["help", "faq", "bug-report", "report", "contact-support", "about"].includes(action)) {
            openHelpSupportModal(action);
            return;
        }

        if (messages[action]) {
            const status = document.getElementById("profile-action-message");
            if (status) status.textContent = messages[action];
        }
    });
});



// =========================================================
// YOUR ACTIVITY
// =========================================================

(() => {
    const keys = {
        posts: "helixActivityPosts",
        comments: "helixActivityComments",
        likes: "helixActivityLikes",
        savedPosts: "helixSavedPosts",
        savedReels: "helixSavedReels",
        viewed: "helixRecentlyViewed"
    };

    function read(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    function renderActivity() {
        const counts = {
            posts: read(keys.posts).length,
            comments: read(keys.comments).length,
            likes: read(keys.likes).length,
            savedPosts: read(keys.savedPosts).length,
            savedReels: read(keys.savedReels).length,
            viewed: read(keys.viewed).length
        };

        Object.entries(counts).forEach(([key, count]) => {
            const element = document.getElementById(`activity-${key.replace("savedPosts", "saved-posts").replace("savedReels", "saved-reels")}-count`);
            if (element) element.textContent = count;
        });

        const breakdown = document.getElementById("activity-breakdown");
        if (!breakdown) return;

        const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

        breakdown.innerHTML = total
            ? `
                <span>◎</span>
                <div>
                    <strong>${total} activity items recorded</strong>
                    <small>Posts, comments, likes, saved content and recently viewed content are tracked locally in this Helix prototype.</small>
                </div>
            `
            : `
                <span>◎</span>
                <div>
                    <strong>No activity recorded yet</strong>
                    <small>Your posts, comments, likes, saved content and recently viewed items will appear here as you use Helix.</small>
                </div>
            `;
    }

    renderActivity();
    window.helixRenderActivity = renderActivity;
})();


// =========================================================
// APPEARANCE CONTROLS
// =========================================================

(() => {
    const defaults = {
        theme: "DARK",
        "accent-intensity": "HIGH",
        "compact-mode": false,
        "animation-intensity": "FULL",
        "reduced-motion": false,
        "layout-density": "COMFORTABLE"
    };

    const storageKey = "helixAppearanceSettings";
    let settings = {
        ...defaults,
        ...readLocalJSON(storageKey, {})
    };

    const cycleValues = {
        theme: ["DARK", "SOFT"],
        "accent-intensity": ["HIGH", "MEDIUM", "LOW"],
        "animation-intensity": ["FULL", "SUBTLE", "MINIMAL"],
        "layout-density": ["COMFORTABLE", "COMPACT", "SPACIOUS"]
    };

    function save() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(settings));
        } catch {}
        saveCloudSettingGroup("appearance", settings);
    }

    function apply() {
        const body = document.body;

        body.classList.toggle("helix-soft-mode", settings.theme === "SOFT");
        body.classList.toggle("helix-compact-mode", settings["compact-mode"]);
        body.classList.toggle("helix-reduced-motion", settings["reduced-motion"]);
        body.classList.remove("helix-accent-high", "helix-accent-medium", "helix-accent-low");
        body.classList.add(`helix-accent-${settings["accent-intensity"].toLowerCase()}`);
        body.classList.remove("helix-animation-full", "helix-animation-subtle", "helix-animation-minimal");
        body.classList.add(`helix-animation-${settings["animation-intensity"].toLowerCase()}`);
        body.classList.remove("helix-density-comfortable", "helix-density-compact", "helix-density-spacious");
        body.classList.add(`helix-density-${settings["layout-density"].toLowerCase()}`);

        document.querySelectorAll("[data-appearance-setting]").forEach((button) => {
            const key = button.dataset.appearanceSetting;
            const state = button.querySelector(".settings-option-state");
            if (!state) return;
            state.textContent = key === "compact-mode"
                ? (settings[key] ? "ON" : "OFF")
                : settings[key];
        });
    }

    document.querySelectorAll("[data-appearance-setting]").forEach((button) => {
        button.addEventListener("click", () => {
            const key = button.dataset.appearanceSetting;

            if (key === "compact-mode" || key === "reduced-motion") {
                settings[key] = !settings[key];
            } else if (cycleValues[key]) {
                const values = cycleValues[key];
                const current = values.indexOf(settings[key]);
                settings[key] = values[(current + 1) % values.length];
            }

            save();
            apply();

            const status = document.getElementById("profile-action-message");
            if (status) status.textContent = "Appearance settings saved.";
        });
    });

    apply();

    window.addEventListener("helix-cloud-settings-loaded", (event) => {
        const cloud = event.detail?.appearance;
        if (!cloud) return;
        settings = { ...defaults, ...cloud };
        try {
            localStorage.setItem(storageKey, JSON.stringify(settings));
        } catch {}
        apply();
    });
})();


// =========================================================
// DIGITAL DETOX
// =========================================================

(() => {
    const detoxStorageKey = `helixDigitalDetox:${loggedInUser || "User"}`;
    const detoxLockStorageKey = `helixDigitalDetoxLock:${loggedInUser || "User"}`;
    const detoxSessionKey = `helixDigitalDetoxSession:${loggedInUser || "User"}`;
    const LOCK_DURATION_MS = 90 * 1000;
    const IDLE_RESET_MS = 2 * 60 * 1000;

    const defaultSettings = {
        mode: "off",
        minutes: 0
    };

    let detoxSettings = {
        ...defaultSettings,
        ...readLocalJSON(detoxStorageKey, {})
    };

    let continuousStartAt = null;
    let lastVisibleAt = null;

    const lockOverlay = document.getElementById("digital-detox-lock");
    const countdown = document.getElementById("digital-detox-countdown");
    const statusPill = document.getElementById("detox-status-pill");
    const statusDetail = document.getElementById("detox-status-detail");
    const nextBreak = document.getElementById("detox-next-break");
    const progressBar = document.getElementById("detox-progress-bar");
    const feedback = document.getElementById("detox-feedback");
    const customRow = document.getElementById("detox-custom-row");
    const customInput = document.getElementById("detox-custom-minutes");

    function saveDetoxSettings() {
        try {
            localStorage.setItem(detoxStorageKey, JSON.stringify(detoxSettings));
        } catch {}
        saveCloudSettingGroup("detox", detoxSettings);
    }

    function loadLockUntil() {
        const state = readLocalJSON(detoxLockStorageKey, {});
        const until = Number(state?.lockedUntil || 0);
        return Number.isFinite(until) ? until : 0;
    }

    function saveLockUntil(until) {
        localStorage.setItem(
            detoxLockStorageKey,
            JSON.stringify({ lockedUntil: until })
        );
    }

    function getDetoxLimitMs() {
        const minutes = Number(detoxSettings.minutes);
        return detoxSettings.mode !== "off" && Number.isFinite(minutes) && minutes > 0
            ? minutes * 60 * 1000
            : 0;
    }

    function formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${String(minutes).padStart(2, "0")}m`;
        }

        return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    }

    function formatCountdown(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function resetContinuousUsage() {
        continuousStartAt = null;
        lastVisibleAt = null;
        sessionStorage.removeItem(detoxSessionKey);
    }

    function startContinuousUsage() {
        if (getDetoxLimitMs() <= 0 || document.hidden || loadLockUntil() > Date.now()) return;

        const savedStart = Number(sessionStorage.getItem(detoxSessionKey) || 0);

        if (savedStart > 0 && savedStart <= Date.now()) {
            continuousStartAt = savedStart;
        } else {
            continuousStartAt = Date.now();
            sessionStorage.setItem(detoxSessionKey, String(continuousStartAt));
        }

        lastVisibleAt = Date.now();
    }

    function setFeedback(message, isError = false) {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.toggle("is-error", isError);
    }

    function renderDetoxSettings() {
        const limitMs = getDetoxLimitMs();
        const lockedUntil = loadLockUntil();
        const locked = lockedUntil > Date.now();

        document.querySelectorAll("[data-detox-duration]").forEach((button) => {
            const value = button.dataset.detoxDuration;
            const active = value === "custom"
                ? detoxSettings.mode === "custom"
                : value === detoxSettings.mode;
            button.classList.toggle("active", active);
        });

        if (customRow) {
            customRow.hidden = detoxSettings.mode !== "custom";
        }

        if (customInput && detoxSettings.mode === "custom" && detoxSettings.minutes > 0) {
            customInput.value = String(detoxSettings.minutes);
        }

        if (statusPill) {
            statusPill.textContent = locked
                ? "LOCKED"
                : limitMs > 0
                    ? `${detoxSettings.minutes}M`
                    : "OFF";
            statusPill.classList.toggle("is-active", limitMs > 0 && !locked);
            statusPill.classList.toggle("is-locked", locked);
        }

        updateDetoxProgress();
    }

    function updateDetoxProgress() {
        const limitMs = getDetoxLimitMs();
        const lockedUntil = loadLockUntil();
        const now = Date.now();

        if (lockedUntil > now) {
            if (statusDetail) statusDetail.textContent = "Break in progress";
            if (nextBreak) nextBreak.textContent = formatCountdown(lockedUntil - now);
            if (progressBar) progressBar.style.width = "100%";
            return;
        }

        if (lockedUntil && lockedUntil <= now) {
            saveLockUntil(0);
        }

        if (!limitMs || !detoxSettings.mode || detoxSettings.mode === "off") {
            if (statusDetail) statusDetail.textContent = "Disabled";
            if (nextBreak) nextBreak.textContent = "Not scheduled";
            if (progressBar) progressBar.style.width = "0%";
            return;
        }

        if (!continuousStartAt) {
            if (statusDetail) statusDetail.textContent = "Ready";
            if (nextBreak) nextBreak.textContent = formatDuration(limitMs);
            if (progressBar) progressBar.style.width = "0%";
            return;
        }

        const elapsed = Math.min(limitMs, now - continuousStartAt);
        const remaining = Math.max(0, limitMs - elapsed);
        const percent = Math.max(0, Math.min(100, (elapsed / limitMs) * 100));

        if (statusDetail) statusDetail.textContent = `${formatDuration(elapsed)} active`;
        if (nextBreak) nextBreak.textContent = formatDuration(remaining);
        if (progressBar) progressBar.style.width = `${percent}%`;
    }

    function showLockScreen() {
        if (!lockOverlay) return;
        lockOverlay.hidden = false;
        lockOverlay.classList.add("is-active");
        document.body.classList.add("digital-detox-locked");
        updateLockScreen();
    }

    function hideLockScreen() {
        if (!lockOverlay) return;
        lockOverlay.classList.remove("is-active");
        lockOverlay.hidden = true;
        document.body.classList.remove("digital-detox-locked");
    }

    function activateDetoxLock() {
        const lockedUntil = Date.now() + LOCK_DURATION_MS;
        saveLockUntil(lockedUntil);
        resetContinuousUsage();
        setFeedback("Detox break started. Helix will unlock automatically after 1 minute 30 seconds.");
        showLockScreen();
    }

    function updateLockScreen() {
        const lockedUntil = loadLockUntil();
        const remaining = lockedUntil - Date.now();

        if (remaining <= 0) {
            saveLockUntil(0);
            hideLockScreen();
            startContinuousUsage();
            setFeedback("Break complete. Your Helix session is ready again.");
            renderDetoxSettings();
            return;
        }

        if (countdown) countdown.textContent = formatCountdown(remaining);
        if (statusPill) {
            statusPill.textContent = "LOCKED";
            statusPill.classList.add("is-locked");
        }

        window.setTimeout(updateLockScreen, Math.min(1000, remaining));
    }

    function chooseDetoxDuration(mode) {
        if (mode === "off") {
            detoxSettings = { mode: "off", minutes: 0 };
            saveDetoxSettings();
            resetContinuousUsage();
            setFeedback("Digital Detox is off.");
            renderDetoxSettings();
            return;
        }

        if (mode === "custom") {
            if (customRow) customRow.hidden = false;
            customInput?.focus();
            setFeedback("Enter your custom time in minutes, then choose Set custom time.");
            return;
        }

        const minutes = Number(mode);
        if (!Number.isFinite(minutes) || minutes <= 0) return;

        detoxSettings = { mode, minutes };
        saveDetoxSettings();
        resetContinuousUsage();
        startContinuousUsage();
        setFeedback(`Digital Detox set to ${minutes === 60 ? "1 hour" : minutes + " minutes"}.`);
        renderDetoxSettings();
    }

    document.querySelectorAll("[data-detox-duration]").forEach((button) => {
        button.addEventListener("click", () => {
            chooseDetoxDuration(button.dataset.detoxDuration);
        });
    });

    document.getElementById("detox-custom-save")?.addEventListener("click", () => {
        const minutes = Number(customInput?.value);

        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
            setFeedback("Custom time must be a whole number from 1 to 1440 minutes.", true);
            return;
        }

        detoxSettings = {
            mode: "custom",
            minutes
        };

        saveDetoxSettings();
        resetContinuousUsage();
        startContinuousUsage();
        setFeedback(`Custom Digital Detox set to ${minutes} minutes.`);
        renderDetoxSettings();
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            resetContinuousUsage();
            return;
        }

        lastVisibleAt = Date.now();
        startContinuousUsage();
    });

    window.addEventListener("storage", (event) => {
        if (event.key === detoxStorageKey) {
            detoxSettings = {
                ...defaultSettings,
                ...readLocalJSON(detoxStorageKey, {})
            };
            if (getDetoxLimitMs() <= 0) resetContinuousUsage();
            renderDetoxSettings();
        }

        if (event.key === detoxLockStorageKey) {
            const lockedUntil = loadLockUntil();
            if (lockedUntil > Date.now()) {
                resetContinuousUsage();
                showLockScreen();
            } else {
                hideLockScreen();
                renderDetoxSettings();
            }
        }
    });

    function detoxTick() {
        const lockedUntil = loadLockUntil();

        if (lockedUntil > Date.now()) {
            showLockScreen();
            return;
        }

        if (lockedUntil) saveLockUntil(0);

        const limitMs = getDetoxLimitMs();

        if (!limitMs || document.hidden) {
            updateDetoxProgress();
            return;
        }

        if (!continuousStartAt) {
            startContinuousUsage();
            updateDetoxProgress();
            return;
        }

        const elapsed = Date.now() - continuousStartAt;

        if (elapsed >= limitMs) {
            activateDetoxLock();
            return;
        }

        updateDetoxProgress();
    }

    renderDetoxSettings();

    window.addEventListener("helix-cloud-settings-loaded", (event) => {
        const cloud = event.detail?.detox;
        if (!cloud) return;
        detoxSettings = { ...defaultSettings, ...cloud };
        try {
            localStorage.setItem(detoxStorageKey, JSON.stringify(detoxSettings));
        } catch {}
        if (getDetoxLimitMs() <= 0) resetContinuousUsage();
        renderDetoxSettings();
    });

    if (loadLockUntil() > Date.now()) {
        showLockScreen();
    } else if (getDetoxLimitMs() > 0) {
        startContinuousUsage();
    }

    window.setInterval(detoxTick, 1000);
})();


// =========================================================
// NOTIFICATION CONTROLS
// =========================================================

(() => {
    const notificationStorageKey = "helixNotificationSettings:v2";
    const notificationDefaults = {
        "dm-alerts": false,
        "friend-requests": false,
        "accepted-requests": false,
        "likes": false,
        "comments": false,
        "mentions": false,
        "follows": false,
        "system-announcements": false
    };

    let notificationSettings = {
        ...notificationDefaults,
        ...readLocalJSON(notificationStorageKey, {})
    };

    // Browser notifications are a user-controlled permission. Nothing asks
    // for permission until the user explicitly enables DM browser alerts.
    let notificationAudioContext = null;
    let lastKnownUnreadDMCount = null;
    let notificationFeedInitialized = false;
    const notifiedDMMessageIds = new Set();

    function saveNotificationSettings() {
        try {
            localStorage.setItem(notificationStorageKey, JSON.stringify(notificationSettings));
        } catch {
            // Settings remain active for this page even if storage is unavailable.
        }
        saveCloudSettingGroup("notifications", notificationSettings);
    }

    function updateBrowserNotificationNote(message = "") {
        const note = document.getElementById("settings-notification-note");
        if (!note) return;

        if (message) {
            note.textContent = message;
            return;
        }

        if (!("Notification" in window)) {
            note.textContent = "This browser does not support browser notifications.";
            return;
        }

        if (Notification.permission === "granted") {
            note.textContent = "Browser permission granted. Helix can alert you about new DMs while this tab is open.";
        } else if (Notification.permission === "denied") {
            note.textContent = "Browser notifications are blocked. Allow them in your browser site settings to use DM alerts.";
        } else {
            note.textContent = "Off by default. Turning this on will ask your browser for notification permission.";
        }
    }

    function renderNotificationSettings() {
        document.querySelectorAll("[data-notification-setting]").forEach((button) => {
            const key = button.dataset.notificationSetting;
            const state = button.querySelector(".settings-option-state");
            if (!state) return;
            state.textContent = notificationSettings[key] ? "ON" : "OFF";
            button.classList.toggle("is-disabled", !notificationSettings[key]);
        });

        updateBrowserNotificationNote();
    }

    function primeNotificationAudio() {
        if (!("AudioContext" in window || "webkitAudioContext" in window)) return;

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            notificationAudioContext ||= new AudioContextClass();

            if (notificationAudioContext.state === "suspended") {
                notificationAudioContext.resume().catch(() => {});
            }
        } catch {
            notificationAudioContext = null;
        }
    }

    function playDMAlertSound() {
        if (!notificationSettings["dm-alerts"]) return;
        if (!notificationAudioContext) return;

        try {
            if (notificationAudioContext.state === "suspended") {
                notificationAudioContext.resume().catch(() => {});
            }

            const now = notificationAudioContext.currentTime;

            // Two short tones give a subtle bell-like alert without requiring
            // an external audio file or autoplay permission outside the toggle click.
            [0, 0.12].forEach((offset, index) => {
                const oscillator = notificationAudioContext.createOscillator();
                const gain = notificationAudioContext.createGain();

                oscillator.type = "sine";
                oscillator.frequency.setValueAtTime(index === 0 ? 880 : 1174, now + offset);

                gain.gain.setValueAtTime(0.0001, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.055, now + offset + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);

                oscillator.connect(gain);
                gain.connect(notificationAudioContext.destination);

                oscillator.start(now + offset);
                oscillator.stop(now + offset + 0.24);
            });
        } catch {
            // Notification audio is best-effort.
        }
    }

    async function enableDMBrowserAlerts() {
        primeNotificationAudio();

        if (!("Notification" in window)) {
            notificationSettings["dm-alerts"] = false;
            saveNotificationSettings();
            renderNotificationSettings();
            updateBrowserNotificationNote("This browser does not support browser notifications.");
            return false;
        }

        let permission = Notification.permission;

        if (permission === "default") {
            permission = await Notification.requestPermission();
        }

        if (permission !== "granted") {
            notificationSettings["dm-alerts"] = false;
            saveNotificationSettings();
            renderNotificationSettings();

            updateBrowserNotificationNote(
                permission === "denied"
                    ? "Permission was denied. Enable Helix notifications in your browser site settings, then turn this back on."
                    : "Notification permission was not granted."
            );

            return false;
        }

        notificationSettings["dm-alerts"] = true;
        saveNotificationSettings();
        renderNotificationSettings();
        updateBrowserNotificationNote();

        // Start with the current unread count so enabling notifications does
        // not immediately fire an old-message alert.
        lastKnownUnreadDMCount = null;
        notificationFeedInitialized = false;
        notifiedDMMessageIds.clear();
        window.helixNotificationEnabled = true;

        return true;
    }

    async function disableDMBrowserAlerts() {
        notificationSettings["dm-alerts"] = false;
        saveNotificationSettings();
        window.helixNotificationEnabled = false;
        renderNotificationSettings();
    }

    function showNewDMNotification(message) {
        if (!notificationSettings["dm-alerts"] || !("Notification" in window) || Notification.permission !== "granted") {
            return;
        }

        try {
            const sender = message?.senderDisplayName || message?.sender || "Helix";
            const text = String(message?.text || "New direct message.").replace(/\\s+/g, " ").trim();
            const body = text.length > 180 ? text.slice(0, 177) + "..." : text;

            const notification = new Notification(sender, {
                body,
                icon: "images/helix-logo.png",
                tag: `helix-dm-${message?.id || Date.now()}`,
                renotify: true
            });

            notification.onclick = () => {
                window.focus();
                document.getElementById("nav-console")?.click();
            };

            window.setTimeout(() => notification.close(), 8000);
        } catch {
            // Browser notifications are best-effort.
        }
    }

    function notifyNewDMMessage(message) {
        if (!message?.id || notifiedDMMessageIds.has(message.id)) return;

        notifiedDMMessageIds.add(message.id);

        if (notificationSettings["dm-alerts"]) {
            playDMAlertSound();
            showNewDMNotification(message);
        }
    }

    window.helixHandleNotificationFeed = function (messages, unread) {
        const feed = Array.isArray(messages) ? messages : [];
        const nextUnread = Math.max(0, Number(unread || 0));

        if (!notificationFeedInitialized) {
            feed.forEach((message) => {
                if (message?.id) notifiedDMMessageIds.add(message.id);
            });
            notificationFeedInitialized = true;
            lastKnownUnreadDMCount = nextUnread;

            if (notificationSettings["dm-alerts"] && nextUnread > 0) {
                document.title = `(${nextUnread}) Helix`;
            }
            return;
        }

        feed.forEach((message) => notifyNewDMMessage(message));

        if (notificationSettings["dm-alerts"] && nextUnread > 0) {
            document.title = `(${nextUnread}) Helix`;
        } else {
            document.title = "Helix";
        }

        lastKnownUnreadDMCount = nextUnread;
    };

    window.helixHandleNotificationUnreadCount = function (unread) {
        const nextUnread = Math.max(0, Number(unread || 0));

        // Tab count only appears while DM browser alerts are enabled.
        if (notificationSettings["dm-alerts"] && nextUnread > 0) {
            document.title = `(${nextUnread}) Helix`;
        } else {
            document.title = "Helix";
        }

        if (lastKnownUnreadDMCount === null) {
            lastKnownUnreadDMCount = nextUnread;
            return;
        }

        lastKnownUnreadDMCount = nextUnread;
    };

    document.querySelectorAll("[data-notification-setting]").forEach((button) => {
        button.addEventListener("click", async () => {
            const key = button.dataset.notificationSetting;

            if (key === "dm-alerts") {
                if (notificationSettings["dm-alerts"]) {
                    await disableDMBrowserAlerts();
                    const status = document.getElementById("profile-action-message");
                    if (status) status.textContent = "DM browser alerts turned off.";
                    return;
                }

                const enabled = await enableDMBrowserAlerts();
                const status = document.getElementById("profile-action-message");
                if (status) {
                    status.textContent = enabled
                        ? "DM browser alerts enabled."
                        : "DM browser alerts were not enabled.";
                }
                return;
            }

            notificationSettings[key] = !notificationSettings[key];
            saveNotificationSettings();
            renderNotificationSettings();

            const status = document.getElementById("profile-action-message");
            if (status) status.textContent = "Notification settings saved.";
        });
    });

    renderNotificationSettings();

    window.addEventListener("helix-cloud-settings-loaded", (event) => {
        const cloud = event.detail?.notifications;
        if (!cloud) return;
        notificationSettings = { ...notificationDefaults, ...cloud };
        try {
            localStorage.setItem(notificationStorageKey, JSON.stringify(notificationSettings));
        } catch {}
        renderNotificationSettings();
        if (!notificationSettings["dm-alerts"]) {
            document.title = "Helix";
            lastKnownUnreadDMCount = null;
        }
    });
})();


// =========================================================
// PRIVACY & SAFETY CONTROLS
// =========================================================

(() => {
    const privacyDefaults = {
        "private-account": false,
        "friend-requests": "EVERYONE",
        "direct-messages": "EVERYONE",
        "mentions-tags": "EVERYONE",
        "activity-visibility": "VISIBLE"
    };

    const privacyStorageKey = "helixPrivacySettings";
    let privacySettings = {
        ...privacyDefaults,
        ...readLocalJSON(privacyStorageKey, {})
    };

    const cycleValues = {
        "friend-requests": ["EVERYONE", "FRIENDS", "NOBODY"],
        "direct-messages": ["EVERYONE", "FRIENDS", "NOBODY"],
        "mentions-tags": ["EVERYONE", "FRIENDS", "NOBODY"]
    };

    function savePrivacySettings() {
        try {
            localStorage.setItem(privacyStorageKey, JSON.stringify(privacySettings));
        } catch {}
        saveCloudSettingGroup("privacy", privacySettings);
    }

    function renderPrivacySettings() {
        document.querySelectorAll("[data-privacy-setting]").forEach((button) => {
            const key = button.dataset.privacySetting;
            const state = button.querySelector(".settings-option-state");
            if (!state) return;

            const value = privacySettings[key];
            state.textContent = key === "private-account"
                ? (value ? "ON" : "OFF")
                : value;
        });

        const blocked = readLocalJSON("helixBlockedUsers", []);
        const count = document.getElementById("privacy-blocked-count");
        const list = document.getElementById("privacy-blocked-users");

        if (count) count.textContent = String(blocked.length);

        if (list) {
            if (!blocked.length) {
                list.innerHTML = `
                    <span>⊘</span>
                    <div>
                        <strong>No blocked users</strong>
                        <small>Blocked accounts will be listed here. You can manage them from Blocked Accounts.</small>
                    </div>
                `;
            } else {
                list.innerHTML = `
                    <span>⊘</span>
                    <div>
                        <strong>${blocked.length} blocked user${blocked.length === 1 ? "" : "s"}</strong>
                        <small>Manage blocked accounts from the Blocked Accounts section.</small>
                    </div>
                `;
            }
        }
    }

    document.querySelectorAll("[data-privacy-setting]").forEach((button) => {
        button.addEventListener("click", () => {
            const key = button.dataset.privacySetting;

            if (key === "private-account") {
                privacySettings[key] = !privacySettings[key];
            } else if (key === "activity-visibility") {
                privacySettings[key] =
                    privacySettings[key] === "VISIBLE" ? "HIDDEN" : "VISIBLE";
            } else if (cycleValues[key]) {
                const values = cycleValues[key];
                const currentIndex = values.indexOf(privacySettings[key]);
                privacySettings[key] = values[(currentIndex + 1) % values.length];
            }

            savePrivacySettings();
            renderPrivacySettings();

            const status = document.getElementById("profile-action-message");
            if (status) {
                status.textContent = "Privacy & Safety settings saved.";
            }
        });
    });

    renderPrivacySettings();

    window.addEventListener("helix-cloud-settings-loaded", (event) => {
        const cloud = event.detail?.privacy;
        if (!cloud) return;
        privacySettings = { ...privacyDefaults, ...cloud };
        try {
            localStorage.setItem(privacyStorageKey, JSON.stringify(privacySettings));
        } catch {}
        renderPrivacySettings();
    });

    window.helixRenderPrivacy = renderPrivacySettings;
})();

// =========================================================
// BLOCKED ACCOUNTS
// =========================================================

(() => {
    const storageKey = "helixBlockedUsers";

    function readBlockedUsers() {
        try {
            const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    function saveBlockedUsers(users) {
        localStorage.setItem(storageKey, JSON.stringify(users));
    }

    function getBlockedIdentity(entry) {
        if (typeof entry === "string") {
            return { id: entry, username: entry };
        }

        const username = String(
            entry?.username || entry?.name || entry?.user || entry?.id || "Unknown user"
        );

        return {
            id: String(entry?.id || username),
            username
        };
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function renderBlockedAccounts() {
        const list = document.getElementById("blocked-accounts-list");
        if (!list) return;

        const blocked = readBlockedUsers();

        if (!blocked.length) {
            list.innerHTML = `
                <div class="settings-empty-card">
                    <span>⊘</span>
                    <div>
                        <strong>No blocked accounts</strong>
                        <small>Accounts you block will appear here, and you can unblock them at any time.</small>
                    </div>
                </div>
            `;
            return;
        }

        list.innerHTML = blocked.map((entry, index) => {
            const user = getBlockedIdentity(entry);
            return `
                <div class="blocked-account-row">
                    <div class="blocked-account-avatar" aria-hidden="true">${escapeHtml(user.username.slice(0, 2).toUpperCase())}</div>
                    <div class="blocked-account-copy">
                        <strong>${escapeHtml(user.username)}</strong>
                        <small>Blocked account</small>
                    </div>
                    <button class="profile-secondary-button blocked-unblock-button" type="button" data-unblock-index="${index}">Unblock</button>
                </div>
            `;
        }).join("");
    }

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-unblock-index]");
        if (!button) return;

        const blocked = readBlockedUsers();
        const index = Number(button.dataset.unblockIndex);
        if (!Number.isInteger(index) || index < 0 || index >= blocked.length) return;

        blocked.splice(index, 1);
        saveBlockedUsers(blocked);
        renderBlockedAccounts();

        const status = document.getElementById("profile-action-message");
        if (status) status.textContent = "Account unblocked.";

        if (typeof window.helixRenderPrivacy === "function") {
            window.helixRenderPrivacy();
        }
    });

    renderBlockedAccounts();
    window.helixRenderBlockedAccounts = renderBlockedAccounts;
})();

// =========================================================
// INITIALIZATION
// =========================================================

updateLoggedInUser();

handleNavigation("nav-home");





// Console message

console.log(
    `%cHELIX SYSTEM ONLINE`,
    "color:#7c5cff;font-size:20px;font-weight:bold;"
);

console.log(
    `Logged in as: ${loggedInUser}`
);
 // =========================================================
// HELIX — FINAL DM + REELS INTERACTION POLISH
// =========================================================

(() => {

    // =====================================================
    // DM — LIVE SEARCH IS OWNED BY THE ISOLATED CLOUD DMS MODULE BELOW
    // =====================================================
    // =====================================================
    // DM — INFO PANEL
    // =====================================================

    const chatInfoButton =
        document.getElementById("chat-info-button");

    const dmInfoPanel =
        document.getElementById("dm-info-panel");

    const dmInfoClose =
        document.getElementById("dm-info-close");


    if (chatInfoButton && dmInfoPanel) {

        chatInfoButton.addEventListener("click", () => {

            dmInfoPanel.hidden = false;

        });
    }


    if (dmInfoClose && dmInfoPanel) {

        dmInfoClose.addEventListener("click", () => {

            dmInfoPanel.hidden = true;

        });
    }


    // =====================================================
    // REELS — FIVE CREATOR REELS
    // =====================================================

    const reelsFeed =
        document.getElementById("reels-feed");

    if (reelsFeed) {

        const reelCreators = [];


        const escapeReelHTML = (value) => {

            const element =
                document.createElement("div");

            element.textContent = value;

            return element.innerHTML;
        };


        reelsFeed.innerHTML =
            reelCreators.map((creator, index) => {

                return `
                    <article
                        class="helix-reel-card"
                        data-reel-id="helix-reel-${index + 1}"
                    >

                        <div class="helix-reel-media">

                            <div
                                class="helix-fake-video ${creator.scene}"
                                role="img"
                                aria-label="Demo Reel from ${escapeReelHTML(creator.name)}"
                            >
                                <div class="helix-fake-orb"></div>
                                <div class="helix-fake-grid"></div>

                                <button
                                    class="helix-reel-play"
                                    type="button"
                                    aria-label="Play or pause Reel"
                                >
                                    ▶
                                </button>
                            </div>


                            <button
                                class="helix-reel-mute"
                                type="button"
                                aria-label="Mute or unmute Reel"
                            >
                                🔇
                            </button>


                            <div class="helix-reel-bottom">

                                <div class="helix-reel-author">

                                    <div class="helix-reel-avatar">
                                        ${creator.name.charAt(0)}
                                    </div>

                                    <div class="helix-reel-author-info">

                                        <strong>
                                            ${escapeReelHTML(creator.handle)}
                                        </strong>

                                        <span>
                                            ${escapeReelHTML(creator.name)}
                                        </span>

                                    </div>

                                    <button
                                        class="helix-reel-follow"
                                        type="button"
                                    >
                                        Follow
                                    </button>

                                </div>


                                <p class="helix-reel-caption">
                                    ${escapeReelHTML(creator.caption)}
                                </p>


                                <div class="helix-reel-audio">
                                    ♪ ${escapeReelHTML(creator.audio)}
                                </div>

                            </div>

                        </div>


                        <div class="helix-reel-actions">

                            <button
                                class="helix-reel-action helix-like"
                                type="button"
                                aria-label="Like Reel"
                            >
                                <span class="helix-action-icon">♡</span>
                                <span class="helix-action-count">0</span>
                            </button>


                            <button
                                class="helix-reel-action helix-comment"
                                type="button"
                                aria-label="Comment on Reel"
                            >
                                <span class="helix-action-icon">💬</span>
                                <span class="helix-action-count">0</span>
                            </button>


                            <button
                                class="helix-reel-action helix-share"
                                type="button"
                                aria-label="Share Reel"
                            >
                                <span class="helix-action-icon">↗</span>
                                <span class="helix-action-count">Share</span>
                            </button>


                            <button
                                class="helix-reel-action helix-save"
                                type="button"
                                aria-label="Save Reel"
                            >
                                <span class="helix-action-icon">🔖</span>
                                <span class="helix-action-count">Save</span>
                            </button>

                        </div>

                    </article>
                `;

            }).join("");


        // =================================================
        // REELS — INTERACTIONS
        // =================================================

        reelsFeed
            .querySelectorAll(".helix-reel-card")
            .forEach((reel) => {

                const playButton =
                    reel.querySelector(".helix-reel-play");

                const fakeVideo =
                    reel.querySelector(".helix-fake-video");

                const muteButton =
                    reel.querySelector(".helix-reel-mute");

                const followButton =
                    reel.querySelector(".helix-reel-follow");

                const likeButton =
                    reel.querySelector(".helix-like");

                const commentButton =
                    reel.querySelector(".helix-comment");

                const shareButton =
                    reel.querySelector(".helix-share");

                const saveButton =
                    reel.querySelector(".helix-save");


                // PLAY / PAUSE

                const toggleFakeVideo = () => {

                    if (!fakeVideo) return;

                    fakeVideo.classList.toggle("is-paused");

                    if (playButton) {

                        playButton.textContent =
                            fakeVideo.classList.contains("is-paused")
                                ? "▶"
                                : "Ⅱ";
                    }
                };


                if (playButton) {

                    playButton.addEventListener(
                        "click",
                        (event) => {

                            event.stopPropagation();

                            toggleFakeVideo();

                        }
                    );
                }


                if (fakeVideo) {

                    fakeVideo.addEventListener(
                        "click",
                        (event) => {

                            if (
                                event.target.closest(
                                    ".helix-reel-play"
                                )
                            ) {
                                return;
                            }

                            toggleFakeVideo();

                        }
                    );
                }


                // MUTE

                if (muteButton) {

                    muteButton.addEventListener(
                        "click",
                        () => {

                            const muted =
                                muteButton.dataset.muted === "true";

                            muteButton.dataset.muted =
                                String(!muted);

                            muteButton.textContent =
                                muted ? "🔊" : "🔇";

                        }
                    );
                }


                // FOLLOW

                if (followButton) {

                    followButton.addEventListener(
                        "click",
                        () => {

                            const following =
                                followButton.classList.toggle(
                                    "following"
                                );

                            followButton.textContent =
                                following
                                    ? "Following"
                                    : "Follow";

                        }
                    );
                }


                // LIKE

                if (likeButton) {

                    likeButton.addEventListener(
                        "click",
                        () => {

                            const count =
                                likeButton.querySelector(
                                    ".helix-action-count"
                                );

                            const liked =
                                likeButton.classList.toggle(
                                    "liked"
                                );

                            if (count) {

                                const current =
                                    Number(count.textContent) || 0;

                                count.textContent =
                                    liked
                                        ? current + 1
                                        : Math.max(0, current - 1);
                            }

                        }
                    );
                }


                // COMMENT

                if (commentButton) {

                    commentButton.addEventListener(
                        "click",
                        () => {

                            const comment =
                                window.prompt(
                                    "Write a comment:"
                                );

                            if (
                                !comment ||
                                !comment.trim()
                            ) {
                                return;
                            }

                            const count =
                                commentButton.querySelector(
                                    ".helix-action-count"
                                );

                            if (count) {

                                const current =
                                    Number(count.textContent) || 0;

                                count.textContent =
                                    current + 1;
                            }

                        }
                    );
                }


                // SHARE

                if (shareButton) {

                    shareButton.addEventListener(
                        "click",
                        async () => {

                            const creator =
                                reel.querySelector(
                                    ".helix-reel-author-info strong"
                                )?.textContent ||
                                "@helix_user";

                            const caption =
                                reel.querySelector(
                                    ".helix-reel-caption"
                                )?.textContent.trim() ||
                                "Helix Reel";


                            const shareData = {
                                title: "Helix Reel",
                                text: `${creator} — ${caption}`,
                                url: window.location.href
                            };


                            try {

                                if (
                                    navigator.share
                                ) {

                                    await navigator.share(
                                        shareData
                                    );

                                } else if (
                                    navigator.clipboard
                                ) {

                                    await navigator.clipboard.writeText(
                                        window.location.href
                                    );

                                    window.alert(
                                        "Reel link copied."
                                    );

                                } else {

                                    window.prompt(
                                        "Copy this Reel link:",
                                        window.location.href
                                    );
                                }

                            } catch (error) {

                                if (
                                    error?.name !==
                                    "AbortError"
                                ) {
                                    console.log(
                                        "Share cancelled or unavailable."
                                    );
                                }
                            }

                        }
                    );
                }


                // SAVE

                if (saveButton) {

                    saveButton.addEventListener(
                        "click",
                        () => {

                            const saved =
                                saveButton.classList.toggle(
                                    "saved"
                                );

                            const count =
                                saveButton.querySelector(
                                    ".helix-action-count"
                                );

                            if (count) {

                                count.textContent =
                                    saved ? "Saved" : "Save";
                            }

                        }
                    );
                }

            });
    }


    // =====================================================
    // FINAL SAFETY LOG
    // =====================================================

    console.log(
        "HELIX FINAL DM + REELS POLISH LOADED"
    );

})();
// =========================================================
// HELIX — DM INTERACTION CLEANUP
// =========================================================

(() => {
    const dmRoot = document.getElementById("dm-view");
    if (!dmRoot) return;

    // Remove any leftover demo quick-reply controls from older versions.
    ["On my way", "Check build", "Coffee?"].forEach((word) => {
        dmRoot.querySelectorAll("button").forEach((button) => {
            if (button.textContent.trim() === word) button.closest("div")?.remove();
        });
    });
})();
// =========================================================
// HELIX — MESSAGE DOM REPAIR
// =========================================================
(() => {
    const dmView = document.getElementById("dm-view");
    const messagesBox = document.getElementById("messages");

    if (!dmView || !messagesBox) return;

    function cleanMessage(message) {
        if (!message || !message.classList.contains("message")) {
            return;
        }

        const bubble = message.querySelector(":scope > .message-bubble");

        if (!bubble) return;

        let meta = message.querySelector(":scope > .message-meta");

        /*
         * If the old markup put message-meta INSIDE the bubble,
         * move it outside.
         */
        const nestedMeta = bubble.querySelector(".message-meta");

        if (nestedMeta) {
            meta = nestedMeta;

            message.appendChild(meta);
        }

        /*
         * Find the actual paragraph.
         */
        let paragraph = bubble.querySelector("p");

        if (!paragraph) {
            paragraph = document.createElement("p");

            /*
             * Preserve the visible text currently inside
             * the bubble, excluding metadata.
             */
            const clone = bubble.cloneNode(true);

            clone.querySelectorAll(
                ".message-meta, .message-time, .message-status"
            ).forEach((element) => {
                element.remove();
            });

            paragraph.textContent = clone.textContent.trim();
        }

        /*
         * Save the actual message text before rebuilding
         * the bubble.
         */
        const messageText = paragraph.textContent;

        /*
         * Rebuild the bubble completely.
         * This removes old width/positioning junk from
         * previous message markup.
         */
        bubble.innerHTML = "";

        const cleanParagraph = document.createElement("p");
        cleanParagraph.textContent = messageText;

        bubble.appendChild(cleanParagraph);

        /*
         * If there was no metadata, don't create fake metadata.
         */
        if (meta) {
            message.appendChild(meta);
        }

        /*
         * Make sure metadata contains only its own elements.
         */
        if (meta) {
            const time = meta.querySelector(".message-time");
            const status = meta.querySelector(".message-status");

            if (time) {
                time.style.position = "static";
            }

            if (status) {
                status.style.position = "static";
            }
        }

        /*
         * Mark it as repaired.
         */
        message.dataset.helixMessageFixed = "true";
    }

    function repairAllMessages() {
        messagesBox
            .querySelectorAll(":scope > .message")
            .forEach(cleanMessage);
    }

    repairAllMessages();

    /*
     * Repair newly-created bot/user messages too,
     * without touching the replier logic.
     */
    let repairing = false;

    const observer = new MutationObserver(() => {
        if (repairing) return;

        repairing = true;

        requestAnimationFrame(() => {
            repairAllMessages();
            repairing = false;
        });
    });

    observer.observe(messagesBox, {
        childList: true
    });

    console.log("Helix message DOM repaired.");
})();
// =========================================================
// HELIX — FINAL SENT MESSAGE REPAIR
// =========================================================

(() => {
    function repairSentMessage(message) {
        if (!message || !message.classList.contains("sent")) {
            return;
        }

        const bubble = message.querySelector(":scope > .message-bubble");
        if (!bubble) {
            return;
        }

        /*
         * Make sure metadata is outside the bubble.
         */
        let meta = message.querySelector(":scope > .message-meta");

        if (!meta) {
            meta = bubble.querySelector(":scope > .message-meta");

            if (meta) {
                message.appendChild(meta);
            }
        }

        /*
         * If metadata is still somewhere inside the bubble,
         * move it outside.
         */
        if (meta && bubble.contains(meta)) {
            message.appendChild(meta);
        }

        /*
         * Make sure the bubble contains ONLY the message text.
         */
        let paragraph = bubble.querySelector(":scope > p");

        if (!paragraph) {
            paragraph = document.createElement("p");

            const text = Array.from(bubble.childNodes)
                .filter((node) => {
                    return node !== meta;
                })
                .map((node) => node.textContent || "")
                .join("")
                .trim();

            paragraph.textContent = text;
            bubble.innerHTML = "";
            bubble.appendChild(paragraph);
        }

        /*
         * Force the message row to behave normally.
         */
        const important = (property, value) => {
            message.style.setProperty(property, value, "important");
        };

        important("position", "relative");
        important("top", "auto");
        important("right", "auto");
        important("bottom", "auto");
        important("left", "auto");
        important("transform", "none");
        important("float", "none");
        important("clear", "both");

        important("display", "flex");
        important("flex-direction", "column");
        important("align-items", "flex-end");

        important("width", "100%");
        important("max-width", "100%");
        important("height", "auto");
        important("min-height", "0");

        important("margin", "0 0 12px 0");
        important("padding", "0");
        important("box-sizing", "border-box");

        /*
         * Force the bubble to hug the text.
         */
        bubble.style.setProperty("position", "relative", "important");
        bubble.style.setProperty("top", "auto", "important");
        bubble.style.setProperty("right", "auto", "important");
        bubble.style.setProperty("bottom", "auto", "important");
        bubble.style.setProperty("left", "auto", "important");
        bubble.style.setProperty("transform", "none", "important");

        bubble.style.setProperty("display", "inline-block", "important");
        bubble.style.setProperty("width", "fit-content", "important");
        bubble.style.setProperty("max-width", "78%", "important");
        bubble.style.setProperty("min-width", "0", "important");

        bubble.style.setProperty("height", "auto", "important");
        bubble.style.setProperty("min-height", "0", "important");

        bubble.style.setProperty("flex", "0 0 auto", "important");

        bubble.style.setProperty("margin", "0", "important");
        bubble.style.setProperty("padding", "10px 14px", "important");

        bubble.style.setProperty("box-sizing", "border-box", "important");
        bubble.style.setProperty("overflow", "visible", "important");

        /*
         * Force the paragraph to size naturally.
         */
        paragraph.style.setProperty("display", "block", "important");
        paragraph.style.setProperty("position", "static", "important");

        paragraph.style.setProperty("width", "auto", "important");
        paragraph.style.setProperty("max-width", "none", "important");

        paragraph.style.setProperty("height", "auto", "important");
        paragraph.style.setProperty("min-height", "0", "important");

        paragraph.style.setProperty("margin", "0", "important");
        paragraph.style.setProperty("padding", "0", "important");

        paragraph.style.setProperty("box-sizing", "border-box", "important");

        paragraph.style.setProperty("white-space", "pre-wrap", "important");
        paragraph.style.setProperty("word-break", "normal", "important");
        paragraph.style.setProperty("overflow-wrap", "anywhere", "important");

        paragraph.style.setProperty("line-height", "1.45", "important");

        /*
         * Force metadata underneath the bubble.
         */
        if (meta) {
            meta.style.setProperty("position", "static", "important");
            meta.style.setProperty("display", "flex", "important");

            meta.style.setProperty("align-items", "center", "important");
            meta.style.setProperty("justify-content", "flex-end", "important");

            meta.style.setProperty("width", "auto", "important");
            meta.style.setProperty("height", "auto", "important");
            meta.style.setProperty("min-height", "0", "important");

            meta.style.setProperty("margin", "4px 4px 0 0", "important");
            meta.style.setProperty("padding", "0", "important");

            meta.style.setProperty("transform", "none", "important");
            meta.style.setProperty("line-height", "1", "important");
        }
    }

    function repairAllSentMessages() {
        const messages = document.querySelectorAll(
            "#dm-view #messages > .message.sent"
        );

        messages.forEach(repairSentMessage);
    }

    /*
     * Initial repair.
     */
    function startRepair() {
        repairAllSentMessages();

        const messagesBox = document.getElementById("messages");

        if (!messagesBox) {
            return;
        }

        /*
         * Watch only for newly created messages.
         * Received messages are completely ignored.
         */
        const observer = new MutationObserver(() => {
            requestAnimationFrame(() => {
                repairAllSentMessages();
            });
        });

        observer.observe(messagesBox, {
            childList: true,
            subtree: true
        });

        /*
         * One final pass after the page has completely settled.
         */
        setTimeout(repairAllSentMessages, 100);
        setTimeout(repairAllSentMessages, 300);
        setTimeout(repairAllSentMessages, 700);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startRepair);
    } else {
        startRepair();
    }
})();

// =========================================================
// HELIX — FRIENDS NETWORK
// =========================================================
const friendsSearchInput = document.getElementById("friends-search-input");
const friendsSearchResults = document.getElementById("friends-search-results");
const friendsRequestList = document.getElementById("friends-request-list");
const friendsSentList = document.getElementById("friends-sent-list");
const friendsList = document.getElementById("friends-list");
const friendsRequestCount = document.getElementById("friends-request-count");
const friendsSentCount = document.getElementById("friends-sent-count");
const friendsCount = document.getElementById("friends-count");
const friendsFeedback = document.getElementById("friends-feedback");
const friendsFilterInput = document.getElementById("friends-filter-input");
const friendsSortSelect = document.getElementById("friends-sort-select");
const friendsRefreshButton = document.getElementById("friends-refresh-button");
const friendsSearchClear = document.getElementById("friends-search-clear");
const friendsNetworkState = { friends: [], incoming: [], outgoing: [] };
let friendsSearchTimer = null;

function friendInitials(username) {
    return (username || "??").slice(0, 2).toUpperCase();
}

function setFriendsFeedback(message, isError = false) {
    if (!friendsFeedback) return;
    friendsFeedback.textContent = message || "";
    friendsFeedback.style.color = isError ? "#d98c9c" : "#70e7f1";
}

function friendEmpty(title, detail, mark = "◎") {
    return `<div class="friends-empty"><span class="friends-empty-mark">${mark}</span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(detail)}</small></div>`;
}

function getPublicUserPresentation(userOrUsername, maybeUsername = "") {
    if (typeof userOrUsername === "string") {
        return {
            displayName: userOrUsername,
            username: userOrUsername
        };
    }

    return {
        displayName: userOrUsername?.displayName || maybeUsername || "User",
        username: userOrUsername?.username || maybeUsername || "user"
    };
}

function renderPublicUserCopy(userOrUsername, maybeUsername = "", detail = "Helix network user") {
    const user = getPublicUserPresentation(userOrUsername, maybeUsername);

    return `
        <strong>${escapeHTML(user.displayName)}</strong>
        <small><span class="friend-row-signal"></span>-${escapeHTML(user.username)} · ${escapeHTML(detail)}</small>
    `;
}

function renderFriendRows(container, users, buttonLabel, action, secondaryLabel = "") {
    if (!container) return;

    if (!users.length) {
        container.innerHTML = friendEmpty("Nothing here yet", "Your network will appear here as it grows.");
        return;
    }

    container.innerHTML = users.map((userOrUsername) => {
        const user = getPublicUserPresentation(userOrUsername);

        return `
            <div class="friend-row">
                <span class="friend-row-avatar"><span class="friend-row-presence"></span>${escapeHTML(friendInitials(user.username))}</span>
                <div class="friend-row-copy">
                    ${renderPublicUserCopy(user, "", "Helix network user")}
                </div>
                ${buttonLabel ? `<button type="button" data-friend-action="${action}" data-friend-name="${escapeHTML(user.username)}">${buttonLabel}</button>` : ""}
                ${secondaryLabel ? `<button type="button" class="friend-decline" data-friend-action="decline" data-request-id="${escapeHTML(secondaryLabel)}">Decline</button>` : ""}
            </div>
        `;
    }).join("");
}

function renderFriendsConnectedList() {
    if (!friendsList) return;

    const query = (friendsFilterInput?.value || "").trim().toLowerCase();
    const sort = friendsSortSelect?.value || "az";
    const users = [...friendsNetworkState.friends]
        .filter((user) => {
            const profile = getPublicUserPresentation(user);
            return !query ||
                profile.displayName.toLowerCase().includes(query) ||
                profile.username.toLowerCase().includes(query);
        })
        .sort((a, b) => {
            const userA = getPublicUserPresentation(a);
            const userB = getPublicUserPresentation(b);
            const valueA = (sort === "display" ? userA.displayName : userA.username).toLowerCase();
            const valueB = (sort === "display" ? userB.displayName : userB.username).toLowerCase();
            return sort === "za" ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
        });

    if (!users.length) {
        friendsList.innerHTML = query
            ? friendEmpty("No matching friends", "Try another name or clear the filter.", "⌕")
            : friendEmpty("Your network is empty", "Discover someone above and send your first friend request.");
        return;
    }

    friendsList.innerHTML = users.map((userOrUsername) => {
        const user = getPublicUserPresentation(userOrUsername);
        return `
            <div class="friend-row">
                <span class="friend-row-avatar"><span class="friend-row-presence"></span>${escapeHTML(friendInitials(user.username))}</span>
                <div class="friend-row-copy">
                    ${renderPublicUserCopy(user, "", "Connected on Helix")}
                </div>
                <button type="button" data-friend-action="remove" data-friend-name="${escapeHTML(user.username)}">Remove</button>
            </div>
        `;
    }).join("");
}

async function requireHelixSessionForNetwork() {
    if (!loggedInUser) {
        const authenticated = await bootstrapHelixSession();
        if (!authenticated) return false;
    }
    return true;
}

async function syncHelixNetworkUser() {
    if (!loggedInUser) return;

    try {
        const users = readLocalJSON("helixUsers", {});
        const account = users[loggedInUser] || {};

        const syncEndpoint = (
            ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
            window.location.port !== "3000"
        )
            ? "http://localhost:3000/api/network/sync"
            : "/api/network/sync";

        const response = await fetch(syncEndpoint, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                displayName: account.displayName || localStorage.getItem("helixDisplayName") || loggedInUser
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Network sync failed.");

        setCurrentProfileUser({
            username: loggedInUser,
            displayName: data.displayName || account.displayName || loggedInUser
        });

        await refreshFriendsNetwork();
    } catch (error) {
        setFriendsFeedback("Friends network is unavailable until the Helix server is running.", true);
    }
}

async function refreshFriendsNetwork() {
    if (!(await requireHelixSessionForNetwork())) return;

    if (!loggedInUser) return;

    friendsRefreshButton?.classList.add("is-refreshing");

    try {
        const response = await fetch("/api/network/state");
        if (!response.ok) throw new Error("Could not load network state.");
        const state = await response.json();

        friendsNetworkState.friends = Array.isArray(state.friends) ? state.friends : [];
        friendsNetworkState.incoming = Array.isArray(state.incoming) ? state.incoming : [];
        friendsNetworkState.outgoing = Array.isArray(state.outgoing) ? state.outgoing : [];

        renderFriendsConnectedList();

        if (friendsCount) friendsCount.textContent = String(friendsNetworkState.friends.length);
        if (friendsRequestCount) friendsRequestCount.textContent = String(friendsNetworkState.incoming.length);
        if (friendsSentCount) friendsSentCount.textContent = String(friendsNetworkState.outgoing.length);

        const total = friendsNetworkState.friends.length;
        const incoming = friendsNetworkState.incoming.length;
        const outgoing = friendsNetworkState.outgoing.length;
        const statTotal = document.getElementById("friends-stat-total");
        const statIncoming = document.getElementById("friends-stat-incoming");
        const statOutgoing = document.getElementById("friends-stat-outgoing");
        const statNetwork = document.getElementById("friends-stat-network");
        if (statTotal) statTotal.textContent = String(total);
        if (statIncoming) statIncoming.textContent = String(incoming);
        if (statOutgoing) statOutgoing.textContent = String(outgoing);
        if (statNetwork) statNetwork.textContent = String(total + incoming + outgoing);

        const requestBadge = document.getElementById("friends-filter-request-badge");
        const sentBadge = document.getElementById("friends-filter-sent-badge");
        if (requestBadge) requestBadge.textContent = String(incoming);
        if (sentBadge) sentBadge.textContent = String(outgoing);

        if (friendsRequestList) {
            if (!friendsNetworkState.incoming.length) {
                friendsRequestList.innerHTML = friendEmpty("No incoming requests", "New connection requests will appear here.", "↓");
            } else {
                friendsRequestList.innerHTML = friendsNetworkState.incoming.map((request) => `
                    <div class="friend-row">
                        <span class="friend-row-avatar"><span class="friend-row-presence friend-row-presence-pulse"></span>${escapeHTML(friendInitials(request.from))}</span>
                        <div class="friend-row-copy">
                            <strong>${escapeHTML(request.fromDisplayName || request.from)}</strong>
                            <small><span class="friend-row-signal"></span>-${escapeHTML(request.from)} · Wants to connect with you</small>
                        </div>
                        <button type="button" data-friend-action="accept" data-request-id="${escapeHTML(request.id)}">Accept</button>
                        <button type="button" class="friend-decline" data-friend-action="decline" data-request-id="${escapeHTML(request.id)}">Decline</button>
                    </div>
                `).join("");
            }
        }

        if (friendsSentList) {
            if (!friendsNetworkState.outgoing.length) {
                friendsSentList.innerHTML = friendEmpty("No sent requests", "Requests you send will be tracked here.", "↑");
            } else {
                friendsSentList.innerHTML = friendsNetworkState.outgoing.map((request) => `
                    <div class="friend-row">
                        <span class="friend-row-avatar friend-row-avatar-violet"><span class="friend-row-presence"></span>${escapeHTML(friendInitials(request.to))}</span>
                        <div class="friend-row-copy">
                            <strong>${escapeHTML(request.toDisplayName || request.to)}</strong>
                            <small><span class="friend-row-signal friend-row-signal-violet"></span>-${escapeHTML(request.to)} · Request pending</small>
                        </div>
                        <button type="button" class="friend-decline" data-friend-action="cancel" data-request-id="${escapeHTML(request.id)}">Cancel</button>
                    </div>
                `).join("");
            }
        }
    } catch (error) {
        setFriendsFeedback("Could not load your Helix network.", true);
    } finally {
        setTimeout(() => friendsRefreshButton?.classList.remove("is-refreshing"), 180);
    }
}

async function searchHelixUsers(query) {
    if (!(await requireHelixSessionForNetwork())) return;

    if (!friendsSearchResults || !loggedInUser) return;

    const trimmed = query.trim();
    if (!trimmed) {
        friendsSearchResults.innerHTML = friendEmpty("Search the network", "Type a username to discover people on Helix.", "⌕");
        return;
    }

    friendsSearchResults.innerHTML = friendEmpty("Scanning the network", "Looking for matching Helix users…", "◌");

    try {
        const response = await fetch(`/api/network/search?q=${encodeURIComponent(trimmed)}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Search failed.");

        if (!data.results?.length) {
            friendsSearchResults.innerHTML = friendEmpty("No matches found", "Try a different username.", "⌕");
            return;
        }

        friendsSearchResults.innerHTML = data.results.map((user) => `
            <div class="friend-row friend-search-result">
                <span class="friend-row-avatar"><span class="friend-row-presence"></span>${escapeHTML(friendInitials(user.username))}</span>
                <div class="friend-row-copy">
                    <strong>${escapeHTML(user.displayName || user.username)}</strong>
                    <small><span class="friend-row-signal"></span>-${escapeHTML(user.username)} · Available to connect</small>
                </div>
                <button type="button" data-friend-action="request" data-friend-name="${escapeHTML(user.username)}">Add Friend</button>
            </div>
        `).join("");
    } catch (error) {
        friendsSearchResults.innerHTML = friendEmpty("Search unavailable", "Check that the Helix server is running.", "!");
    }
}

async function sendFriendRequest(username) {
    if (!(await requireHelixSessionForNetwork())) return;

    try {
        const response = await fetch("/api/network/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: username })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not send request.");

        setFriendsFeedback(`Friend request sent to ${username}.`);
        await searchHelixUsers(friendsSearchInput?.value || "");
        await refreshFriendsNetwork();
    } catch (error) {
        setFriendsFeedback(error.message || "Could not send friend request.", true);
    }
}

async function respondToFriendRequest(requestId, action) {
    if (!(await requireHelixSessionForNetwork())) return;

    try {
        const response = await fetch(`/api/network/request/${encodeURIComponent(requestId)}/respond`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not update request.");

        setFriendsFeedback(action === "accept" ? "Friend request accepted." : "Friend request declined.");
        await refreshFriendsNetwork();
    } catch (error) {
        setFriendsFeedback(error.message || "Could not update friend request.", true);
    }
}

async function cancelFriendRequest(requestId) {
    if (!(await requireHelixSessionForNetwork())) return;

    try {
        const response = await fetch(`/api/network/request/${encodeURIComponent(requestId)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not cancel request.");

        setFriendsFeedback("Friend request cancelled.");
        await refreshFriendsNetwork();
        if (friendsSearchInput?.value) await searchHelixUsers(friendsSearchInput.value);
    } catch (error) {
        setFriendsFeedback(error.message || "Could not cancel friend request.", true);
    }
}

async function removeHelixFriend(username) {
    if (!(await requireHelixSessionForNetwork())) return;

    try {
        const response = await fetch("/api/network/friend", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: loggedInUser, friend: username })
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Could not remove friend.");
        }
        setFriendsFeedback(`${username} was removed from your friends.`);
        await refreshFriendsNetwork();
    } catch (error) {
        setFriendsFeedback(error.message || "Could not remove friend.", true);
    }
}

document.addEventListener("click", (event) => {
    const friendFilter = event.target.closest("[data-friends-filter]");
    if (friendFilter) {
        const filter = friendFilter.dataset.friendsFilter;
        document.querySelectorAll("[data-friends-filter]").forEach((button) => {
            const active = button === friendFilter;
            button.classList.toggle("active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
        });
        document.querySelectorAll("[data-friends-panel]").forEach((panel) => {
            const panelType = panel.dataset.friendsPanel;
            const show = filter === "all" ||
                (filter === "friends" && panelType === "friends") ||
                (filter === "requests" && panelType === "requests") ||
                (filter === "sent" && panelType === "sent") ||
                panelType === "discover";
            panel.hidden = !show;
        });
        return;
    }

    const button = event.target.closest("[data-friend-action]");
    if (!button) return;

    const action = button.dataset.friendAction;
    if (action === "request") sendFriendRequest(button.dataset.friendName);
    if (action === "accept") respondToFriendRequest(button.dataset.requestId, "accept");
    if (action === "decline") respondToFriendRequest(button.dataset.requestId, "decline");
    if (action === "cancel") cancelFriendRequest(button.dataset.requestId);
    if (action === "remove") removeHelixFriend(button.dataset.friendName);
});

friendsSearchInput?.addEventListener("input", () => {
    clearTimeout(friendsSearchTimer);
    friendsSearchTimer = setTimeout(() => searchHelixUsers(friendsSearchInput.value), 180);
});

friendsSearchClear?.addEventListener("click", () => {
    if (!friendsSearchInput) return;
    friendsSearchInput.value = "";
    searchHelixUsers("");
    friendsSearchInput.focus();
});

friendsFilterInput?.addEventListener("input", renderFriendsConnectedList);
friendsSortSelect?.addEventListener("change", renderFriendsConnectedList);
friendsRefreshButton?.addEventListener("click", refreshFriendsNetwork);

bootstrapHelixSession().then((authenticated) => {
    if (authenticated) {
        syncHelixNetworkUser();
    }
});

// =========================================================

// =========================================================
// HELIX — ISOLATED CLOUD DMS
// =========================================================
(function () {
    const root = document.getElementById("dm-view");
    const list = document.getElementById("conversation-list");
    const count = document.getElementById("dm-friends-count");
    const mainSearch = document.getElementById("chat-search");
    const searchButton = document.getElementById("chat-search-button");
    const messageSearch = document.getElementById("chat-message-search");
    const messageSearchInput = document.getElementById("message-search-input");
    const messageSearchClose = document.getElementById("chat-search-close");
    const searchResultCount = document.getElementById("chat-search-result-count");
    const form = document.getElementById("message-form");
    const input = document.getElementById("message-input");
    const sendButton = form?.querySelector("button[type=\"submit\"]");
    const messages = document.getElementById("messages");
    const headerAvatar = document.getElementById("chat-avatar");
    const headerName = document.getElementById("chat-user-name");
    const headerStatus = document.getElementById("chat-status");

    const dmNavUnread = document.getElementById("dm-nav-unread");

    async function refreshDMUnreadBadge() {
        if (!dmNavUnread) return;

        try {
            const response = await fetch("/api/dm/notification-feed", { credentials: "include" });
            if (!response.ok) return;

            const data = await response.json().catch(() => ({}));
            const unread = Math.max(0, Number(data.unread || 0));
            const feed = Array.isArray(data.messages) ? data.messages : [];

            if (window.helixHandleNotificationFeed) {
                window.helixHandleNotificationFeed(feed, unread);
            } else if (window.helixHandleNotificationUnreadCount) {
                window.helixHandleNotificationUnreadCount(unread);
            }

            if (unread > 0) {
                const displayCount = unread >= 9 ? "+9" : "+" + unread;
                dmNavUnread.textContent = displayCount;
                dmNavUnread.hidden = false;
                dmNavUnread.setAttribute("aria-label", unread + " unread Direct Message" + (unread === 1 ? "" : "s"));
            } else {
                dmNavUnread.hidden = true;
                dmNavUnread.removeAttribute("aria-label");
            }
        } catch {
            // Unread indicators are best-effort and must never interrupt DMs.
        }
    }

    if (!root || !list || !form || !input || !messages) return;

    let friends = [];
    let activeUsername = null;
    let currentMessages = [];
    let refreshTimer = null;
    let messageLoadSerial = 0;
    let isSending = false;

    const safe = (value) => escapeHTML(value);

    function sameFriends(a, b) {
        return a.length === b.length && a.every((x, i) =>
            x.username === b[i]?.username &&
            x.displayName === b[i]?.displayName &&
            (x.profilePhoto || null) === (b[i]?.profilePhoto || null)
        );
    }

    function sameMessages(a, b) {
        if (a.length !== b.length) return false;
        return a.every((x, i) => {
            const y = b[i];
            return y &&
                String(x.id || "") === String(y.id || "") &&
                x.sender === y.sender &&
                x.recipient === y.recipient &&
                x.text === y.text &&
                x.createdAt === y.createdAt;
        });
    }

    function filterFriends() {
        const query = (mainSearch?.value || "").trim().toLowerCase();
        list.querySelectorAll(".conversation").forEach((item) => {
            item.hidden = Boolean(query && !item.textContent.toLowerCase().includes(query));
        });
    }

    function renderFriends(next) {
        const normalized = next.map((friend) => ({
            username: String(friend.username),
            displayName: String(friend.displayName || friend.username),
            profilePhoto: friend.profilePhoto || null
        }));

        if (count) count.textContent = String(normalized.length);
        if (sameFriends(friends, normalized) && list.querySelector(".conversation")) {
            filterFriends();
            return;
        }

        friends = normalized;
        list.replaceChildren();

        if (!normalized.length) {
            const empty = document.createElement("div");
            empty.className = "dm-empty-state";
            empty.innerHTML = `
                <span class="dm-empty-icon">◈</span>
                <strong>No friends yet</strong>
                <p>Add a friend to start a Direct Message.</p>
            `;
            list.appendChild(empty);
            filterFriends();
            return;
        }

        normalized.forEach((friend) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "conversation" + (friend.username === activeUsername ? " active" : "");
            button.dataset.user = friend.username;

            const avatar = document.createElement("span");
            avatar.className = "conversation-avatar";
            avatar.textContent = friend.displayName.slice(0, 2).toUpperCase();
            if (friend.profilePhoto) {
                avatar.style.backgroundImage = `url("${friend.profilePhoto}")`;
                avatar.style.backgroundSize = "cover";
                avatar.style.backgroundPosition = "center";
                avatar.style.color = "transparent";
                avatar.classList.add("has-profile-photo");
            }

            const copy = document.createElement("span");
            copy.className = "conversation-copy";
            copy.innerHTML = `<strong>${safe(friend.displayName)}</strong><small>-${safe(friend.username)}</small><span class="conversation-preview">${friend.username === activeUsername ? "Open conversation" : "Start a conversation"}</span>`;

            const arrow = document.createElement("span");
            arrow.className = "conversation-arrow";
            arrow.textContent = "↗";

            button.append(avatar, copy, arrow);
            button.addEventListener("click", () => openFriend(friend));
            list.appendChild(button);
        });

        filterFriends();
    }

    async function loadFriends() {
        try {
            const response = await fetch("/api/network/state", { credentials: "include" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return;
            renderFriends(Array.isArray(data.friends) ? data.friends : []);
        } catch (error) {
            console.warn("Helix DM friend refresh failed:", error);
        }
    }

    function showConversationHint(text) {
        messages.replaceChildren();
        if (text) {
            const hint = document.createElement("div");
            hint.className = "dm-conversation-hint";
            hint.textContent = text;
            messages.appendChild(hint);
        }
    }

    function updateSearchResultCount(matchCount, totalCount, query) {
        if (!searchResultCount) return;
        if (!query) {
            searchResultCount.textContent = "";
            return;
        }
        searchResultCount.textContent =
            `${matchCount} result${matchCount === 1 ? "" : "s"}`;
        searchResultCount.title = `${matchCount} of ${totalCount} messages match`;
    }

    function renderMessages({ scrollToBottom = false } = {}) {
        const query = (messageSearchInput?.value || "").trim().toLowerCase();
        const visible = query
            ? currentMessages.filter((item) => String(item.text || "").toLowerCase().includes(query))
            : currentMessages;

        updateSearchResultCount(visible.length, currentMessages.length, query);

        const wasNearBottom =
            messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
        const previousScrollTop = messages.scrollTop;

        messages.replaceChildren();

        if (!visible.length) {
            if (query) showConversationHint("No matching messages.");
            return;
        }

        const fragment = document.createDocumentFragment();
        const rows = [];

        visible.forEach((item) => {
            const row = document.createElement("div");
            row.className = "message " + (item.sender === loggedInUser ? "sent" : "received");

            const bubble = document.createElement("div");
            bubble.className = "message-bubble";

            const p = document.createElement("p");
            p.textContent = item.text;
            bubble.appendChild(p);

            const meta = document.createElement("div");
            meta.className = "message-meta";

            const time = document.createElement("span");
            time.className = "message-time";
            time.textContent = new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });
            meta.appendChild(time);

            if (item.sender === loggedInUser) {
                const status = document.createElement("span");
                status.className = "message-status";
                status.textContent = "✓✓";
                meta.appendChild(status);
            }

            row.append(bubble, meta);

            if (query) row.classList.add("search-match");

            fragment.appendChild(row);
            rows.push(row);
        });

        messages.appendChild(fragment);

        if (query) {
            rows[0]?.scrollIntoView({ block: "center", behavior: "auto" });
        } else if (scrollToBottom || wasNearBottom) {
            messages.scrollTop = messages.scrollHeight;
        } else {
            messages.scrollTop = previousScrollTop;
        }
    }

    async function loadMessages(username, { force = false, scrollToBottom = false } = {}) {
        const requestSerial = ++messageLoadSerial;

        try {
            const response = await fetch(
                `/api/dm/messages?with=${encodeURIComponent(username)}`,
                { credentials: "include" }
            );
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || "Could not load conversation.");
            }

            if (activeUsername !== username || requestSerial !== messageLoadSerial) return;

            const nextMessages = Array.isArray(data.messages) ? data.messages : [];
            const changed = force || !sameMessages(currentMessages, nextMessages);

            currentMessages = nextMessages;

            // Do not rebuild the message DOM during normal polling when nothing changed.
            // This removes the visible blink/jump every few seconds.
            if (changed) {
                renderMessages({ scrollToBottom });
            }
        } catch (error) {
            if (activeUsername !== username || requestSerial !== messageLoadSerial) return;
            currentMessages = [];
            if (headerStatus) {
                headerStatus.textContent = error.message || "Could not load conversation.";
            }
        }
    }

    async function openFriend(friend) {
        activeUsername = friend.username;
        list.querySelectorAll(".conversation").forEach((item) =>
            item.classList.toggle("active", item.dataset.user === activeUsername)
        );

        if (headerAvatar) {
            headerAvatar.textContent = friend.displayName.slice(0, 2).toUpperCase();
            headerAvatar.classList.toggle("has-profile-photo", Boolean(friend.profilePhoto));
            if (friend.profilePhoto) {
                headerAvatar.style.backgroundImage = `url("${friend.profilePhoto}")`;
                headerAvatar.style.backgroundSize = "cover";
                headerAvatar.style.backgroundPosition = "center";
                headerAvatar.style.color = "transparent";
            } else {
                headerAvatar.style.backgroundImage = "";
                headerAvatar.style.backgroundSize = "";
                headerAvatar.style.backgroundPosition = "";
                headerAvatar.style.color = "";
            }
        }

        const infoAvatar = document.getElementById("info-avatar");
        if (infoAvatar) {
            infoAvatar.textContent = friend.displayName.slice(0, 2).toUpperCase();
            infoAvatar.classList.toggle("has-profile-photo", Boolean(friend.profilePhoto));
            if (friend.profilePhoto) {
                infoAvatar.style.backgroundImage = `url("${friend.profilePhoto}")`;
                infoAvatar.style.backgroundSize = "cover";
                infoAvatar.style.backgroundPosition = "center";
                infoAvatar.style.color = "transparent";
            } else {
                infoAvatar.style.backgroundImage = "";
                infoAvatar.style.backgroundSize = "";
                infoAvatar.style.backgroundPosition = "";
                infoAvatar.style.color = "";
            }
        }

        const infoName = document.getElementById("info-name");
        if (infoName) infoName.innerHTML = `${safe(friend.displayName)} <small>-${safe(friend.username)}</small>`;

        if (headerName) {
            headerName.innerHTML = `${safe(friend.displayName)} <small>-${safe(friend.username)}</small>`;
        }

        if (headerStatus) headerStatus.textContent = "Friend on Helix";

        if (messageSearchInput) messageSearchInput.value = "";
        if (messageSearch) messageSearch.hidden = true;
        searchButton?.setAttribute("aria-expanded", "false");

        input.disabled = false;
        currentMessages = [];
        showConversationHint("");
        await loadMessages(activeUsername, { force: true, scrollToBottom: true });
        await refreshDMUnreadBadge();
        input.focus();
    }

    async function sendMessage(text) {
        const recipient = activeUsername;
        const trimmed = String(text || "").trim();

        if (!recipient || !trimmed || isSending) return false;

        isSending = true;
        if (sendButton) sendButton.disabled = true;

        try {
            const response = await fetch("/api/dm/messages", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: recipient, text: trimmed })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || "Could not send message.");
            }

            if (activeUsername === recipient) {
                await loadMessages(recipient, { force: true, scrollToBottom: true });
            }

            return true;
        } finally {
            isSending = false;
            if (sendButton) sendButton.disabled = false;
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (isSending) return;

        const value = input.value.trim();
        if (!value || !activeUsername) return;

        // Clear only the submitted message. This prevents duplicate submits and
        // also lets the user type the next message while the request completes.
        input.value = "";

        try {
            await sendMessage(value);
            input.focus();
        } catch (error) {
            // Restore the message so a failed send can be retried.
            if (!input.value.trim()) input.value = value;
            if (headerStatus) headerStatus.textContent = error.message || "Message failed.";
            input.focus();
        }
    });

    window.addEventListener("helix-profile-photo-updated", async (event) => {
        const updatedUsername = event.detail?.username;
        const updatedPhoto = event.detail?.profilePhoto || null;

        if (updatedUsername === loggedInUser) {
            // Update the current user's cached public identity without waiting
            // for another network poll.
            const localUsers = readLocalJSON("helixUsers", {});
            if (localUsers?.[loggedInUser]) {
                localUsers[loggedInUser].profilePhoto = updatedPhoto;
                localStorage.setItem("helixUsers", JSON.stringify(localUsers));
            }
        }

        await loadFriends();

        if (activeUsername) {
            const activeFriend = friends.find((friend) => friend.username === activeUsername);
            if (activeFriend) {
                if (updatedUsername === activeUsername) {
                    activeFriend.profilePhoto = updatedPhoto;
                    if (headerAvatar) {
                        headerAvatar.style.backgroundImage = updatedPhoto
                            ? `url("${updatedPhoto}")`
                            : "";
                        headerAvatar.style.backgroundSize = updatedPhoto ? "cover" : "";
                        headerAvatar.style.backgroundPosition = updatedPhoto ? "center" : "";
                        headerAvatar.style.color = updatedPhoto ? "transparent" : "";
                    }
                }
            }
        }
    });

    mainSearch?.addEventListener("input", filterFriends);

    searchButton?.addEventListener("click", () => {
        if (!messageSearch) return;
        messageSearch.hidden = false;
        searchButton.setAttribute("aria-expanded", "true");

        requestAnimationFrame(() => {
            messageSearchInput?.focus();
        });
    });

    messageSearchInput?.addEventListener("input", () => {
        renderMessages();
    });

    messageSearchInput?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            messageSearchInput.value = "";
            if (messageSearch) messageSearch.hidden = true;
            searchButton?.setAttribute("aria-expanded", "false");
            renderMessages();
            searchButton?.focus();
        }
    });

    messageSearchClose?.addEventListener("click", () => {
        if (messageSearchInput) messageSearchInput.value = "";
        if (messageSearch) messageSearch.hidden = true;
        searchButton?.setAttribute("aria-expanded", "false");
        renderMessages();
        searchButton?.focus();
    });

    input.disabled = true;
    showConversationHint("");

    let dmRefreshRunning = false;

    async function refreshDMLoop() {
        if (!dmRefreshRunning) {
            dmRefreshRunning = true;

            try {
                await loadFriends();
                if (activeUsername && !isSending) {
                    await loadMessages(activeUsername);
                }
                await refreshDMUnreadBadge();
            } finally {
                dmRefreshRunning = false;
            }
        }

        refreshTimer = window.setTimeout(refreshDMLoop, 1000);
    }

    refreshDMLoop();

    if (window.helixHandleNotificationUnreadCount && !document.getElementById("dm-nav-unread")) {
        window.helixHandleNotificationUnreadCount(0);
    }
})();
