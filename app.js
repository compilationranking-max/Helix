// =========================================================
// HELIX — APP JAVASCRIPT
// =========================================================


// =========================================================
// AUTHENTICATION CHECK
// =========================================================

const loggedInUser = localStorage.getItem("helixLoggedIn");

if (!loggedInUser) {
    window.location.href = "index.html";
}


// =========================================================
// USER DISPLAY
// =========================================================

function updateLoggedInUser() {
    const usernameElements = document.querySelectorAll("[data-user]:not(.conversation)");
    const avatarElements = document.querySelectorAll("[data-avatar]");
    const username = loggedInUser || "User";
    const photo = localStorage.getItem(`helixProfilePhoto:${loggedInUser}`);
    const welcomeMessage = document.getElementById("ai-welcome-message");

    usernameElements.forEach((element) => {
        element.textContent = username;
    });

    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome back ${username}!`;
    }

    avatarElements.forEach((element) => {
        element.textContent = username.slice(0, 2).toUpperCase();
        if (photo) {
            element.style.backgroundImage = `url("${photo}")`;
            element.style.backgroundSize = "cover";
            element.style.color = "transparent";
        }
    });
}


// =========================================================
// LOGOUT
// =========================================================

function logoutCurrentSession() {
    localStorage.removeItem("helixLoggedIn");
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
// MESSAGE SYSTEM
// =========================================================

// The app uses the nav shell and section toggling without DM chat logic.
const dmConversations = {};
let activeDMUser = null;
const dmStorageKey = "helixDMConversations:v2";

function getCurrentTime() {
    const now = new Date();

    return now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function loadDMConversations() {
    try {
        const saved = JSON.parse(localStorage.getItem(dmStorageKey));

        if (!saved || typeof saved !== "object") return;

        Object.keys(dmConversations).forEach((user) => {
            if (Array.isArray(saved[user])) {
                dmConversations[user].messages = saved[user];
            }
        });
    } catch (error) {
        console.warn("Unable to load DM conversations.", error);
    }
}

function saveDMConversations() {
    const messages = {};

    Object.keys(dmConversations).forEach((user) => {
        messages[user] = dmConversations[user].messages;
    });

    localStorage.setItem(dmStorageKey, JSON.stringify(messages));
}
function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
}
function renderDMConversation() {
    const conversation = dmConversations[activeDMUser];
    const messagesContainer = document.getElementById("messages");

    if (!conversation || !messagesContainer) return;

    messagesContainer.replaceChildren();

    conversation.messages.forEach((message) => {
        const messageElement = document.createElement("div");
        messageElement.className = `message ${message.type}`;

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        const text = document.createElement("p");
        text.textContent = message.text;

        bubble.appendChild(text);

        const meta = document.createElement("div");
        meta.className = "message-meta";

        const time = document.createElement("span");
        time.className = "message-time";
        time.textContent = message.time;

        meta.appendChild(time);

        if (message.type === "sent") {
            const status = document.createElement("span");
            status.className = "message-status";
            status.textContent = message.read ? "✓✓" : "✓";
            meta.appendChild(status);
        }

        messageElement.append(bubble, meta);
        messagesContainer.appendChild(messageElement);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
function updateDMHeader() {
    const conversation = dmConversations[activeDMUser];

    if (!conversation) return;

    const avatar = document.getElementById("chat-avatar");
    const name = document.getElementById("chat-user-name");
    const status = document.getElementById("chat-status");

    if (avatar) avatar.textContent = conversation.avatar;
    if (name) name.textContent = conversation.name;

    if (status) {
        status.innerHTML = conversation.online
            ? `<span class="online-dot"></span>Online · ${conversation.ping}`
            : `Last seen recently · ${conversation.ping}`;
    }
}
function switchDMConversation(user) {
    if (!dmConversations[user]) return;

    activeDMUser = user;

    document.querySelectorAll(".conversation").forEach((conversation) => {
        conversation.classList.toggle(
            "active",
            conversation.dataset.user === user
        );
    });

    updateDMHeader();
    renderDMConversation();
}
function sendDMMessage(text) {
    const message = text.trim();

    if (!message || !dmConversations[activeDMUser]) return;

    dmConversations[activeDMUser].messages.push({
        type: "sent",
        text: message,
        time: getCurrentTime(),
        read: true
    });

    saveDMConversations();
    renderDMConversation();
}
function setupDMSystem() {
    loadDMConversations();

    document.querySelectorAll(".conversation").forEach((conversation) => {
        conversation.addEventListener("click", () => {
            switchDMConversation(conversation.dataset.user);
        });
    });

    const messageForm = document.getElementById("message-form");
    const messageInput = document.getElementById("message-input");

    messageForm?.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!messageInput) return;

        sendDMMessage(messageInput.value);
        messageInput.value = "";
        messageInput.focus();
    });

    document.querySelectorAll(".macro-btn").forEach((button) => {
        button.addEventListener("click", () => {
            sendDMMessage(button.textContent.trim());
        });
    });

    updateDMHeader();
    renderDMConversation();
}

setupDMSystem();
// =========================================================
// HELIX AI HOME
// =========================================================

const aiForm = document.getElementById("ai-form");
const aiInput = document.getElementById("ai-input");
const aiMessages = document.getElementById("ai-messages");
const aiTyping = document.getElementById("ai-typing");
const aiSendButton = document.getElementById("ai-send-button");
const aiStorageKey = `helixAIConversation:${loggedInUser || "User"}`;
const AI_HISTORY_LIMIT = 20;
let aiConversation = loadAIConversation();

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

function saveAIConversation() {
    aiConversation = aiConversation.slice(-AI_HISTORY_LIMIT);
    localStorage.setItem(aiStorageKey, JSON.stringify(aiConversation));
}

function clearAIConversation() {
    aiConversation = [];
    localStorage.removeItem(aiStorageKey);
    aiMessages?.replaceChildren();
    document.getElementById("ai-welcome")?.removeAttribute("hidden");
    updateAIChatState();
}

function updateAIChatState() {
    const aiChatContent = document.querySelector(".ai-chat-content");

    aiChatContent?.classList.toggle("empty-chat", aiConversation.length === 0);
    aiChatContent?.classList.toggle("active-chat", aiConversation.length > 0);
}

function renderAIMessage(text, type, time) {
    if (!aiMessages) return;

    const message = document.createElement("article");
    message.className = `ai-message ${type}`;

    const avatar = document.createElement("span");
    avatar.className = "ai-message-avatar";
    avatar.textContent = type === "user" ? "YOU" : "HX";

    const bubble = document.createElement("div");
    bubble.className = "ai-message-bubble";
    bubble.textContent = text;

    const timeElement = document.createElement("time");
    timeElement.className = "ai-message-time";
    timeElement.textContent = time || getCurrentTime();
    bubble.appendChild(timeElement);

    message.append(avatar, bubble);
    aiMessages.appendChild(message);
    aiMessages.scrollTop = aiMessages.scrollHeight;
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
}

function addAIMessage(text, type, persist = true) {
    const time = getCurrentTime();

    renderAIMessage(text, type, time);

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

async function sendAIMessage() {
    const message = aiInput?.value.trim();

    if (!message || !aiInput || !aiForm || aiSendButton?.disabled) return;

    addAIMessage(message, "user");
    aiInput.value = "";
    document.getElementById("ai-welcome")?.setAttribute("hidden", "true");
    setAIProcessing(true);

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                history: aiConversation.map(({ role, content }) => ({ role, content }))
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "The AI service returned an error.");
        }

        if (typeof data.reply !== "string" || !data.reply.trim()) {
            throw new Error("The AI returned an empty response.");
        }

        addAIMessage(data.reply, "assistant");
    } catch (error) {
        addAIMessage(error.message || "Helix AI is unavailable right now. Please try again in a moment.", "assistant", false);
    } finally {
        setAIProcessing(false);
       aiInput?.focus();
    }
}

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
    clearAIConversation();
    aiInput?.focus();
});

renderAIConversation();

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
    const profileUsername = document.getElementById("profile-account-username");
    const profileEmail = document.getElementById("profile-account-email");
    const profilePhone = document.getElementById("profile-account-phone");
    const profilePhotoPreview = document.getElementById("profile-photo-preview");
    const profilePhotoInitials = document.getElementById("profile-photo-initials");

    if (profileUsername) {
        profileUsername.textContent = loggedInUser || "Not available";
    }

    if (profileEmail) {
        profileEmail.textContent = localStorage.getItem("helixEmail") || "Not linked";
    }

    if (profilePhone) {
        profilePhone.textContent = formatPhone(localStorage.getItem("helixPhone"));
    }

    if (profilePhotoPreview) {
        const photo = localStorage.getItem(`helixProfilePhoto:${loggedInUser}`);
        profilePhotoPreview.style.backgroundImage = photo ? `url("${photo}")` : "";
        profilePhotoPreview.classList.toggle("has-photo", Boolean(photo));
    }

    if (profilePhotoInitials) {
        profilePhotoInitials.textContent = (loggedInUser || "User").slice(0, 2).toUpperCase();
    }
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
    accountModalFields.innerHTML = action === "email"
        ? `<label class="helix-modal-label" for="account-modal-email">Gmail address</label><input class="helix-modal-input" id="account-modal-email" type="email" autocomplete="email" placeholder="you@gmail.com" required>`
        : action === "phone"
            ? `<label class="helix-modal-label" for="account-modal-phone">Phone number</label><input class="helix-modal-input" id="account-modal-phone" type="tel" autocomplete="tel" placeholder="+1 555 010 2048" required>`
            : action === "password"
                ? `<label class="helix-modal-label" for="account-modal-current-password">Current password</label><input class="helix-modal-input" id="account-modal-current-password" type="password" autocomplete="current-password" required><label class="helix-modal-label" for="account-modal-new-password">New password</label><input class="helix-modal-input" id="account-modal-new-password" type="password" autocomplete="new-password" minlength="6" required>`
                : `<p class="helix-confirmation-copy">This will end every active Helix session for this account.</p>`;

    accountModalTitle.textContent = action === "email" ? "Link Gmail"
        : action === "phone" ? "Add phone"
            : action === "password" ? "Change password" : "End all sessions";
    accountModalDescription.textContent = action === "sessions"
        ? "Confirm network-wide session termination."
        : "Update your encrypted identity record.";
    accountModalSubmit.textContent = action === "sessions" ? "Log out everywhere" : "Save changes";
    accountModalSubmit.classList.toggle("profile-danger-button", action === "sessions");
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

document.getElementById("link-email-btn")?.addEventListener("click", () => openAccountModal("email"));
document.getElementById("add-phone-btn")?.addEventListener("click", () => openAccountModal("phone"));
document.getElementById("change-password-btn")?.addEventListener("click", () => openAccountModal("password"));
logoutAllSessionsButton?.addEventListener("click", () => openAccountModal("sessions"));

accountModalForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    accountModalError.textContent = "";

    if (activeAccountAction === "email") {
        localStorage.setItem("helixEmail", document.getElementById("account-modal-email").value.trim());
    } else if (activeAccountAction === "phone") {
        const phone = document.getElementById("account-modal-phone").value.trim();
        if (phone.replace(/\D/g, "").length < 7) {
            accountModalError.textContent = "Enter a valid phone number.";
            return;
        }
        localStorage.setItem("helixPhone", phone);
    } else if (activeAccountAction === "password") {
        const currentPassword = document.getElementById("account-modal-current-password").value;
        const newPassword = document.getElementById("account-modal-new-password").value;
        const users = JSON.parse(localStorage.getItem("helixUsers")) || {};
        const user = users[loggedInUser];

        if (!user || user.password !== currentPassword) {
            accountModalError.textContent = "Current password is incorrect.";
            return;
        }
        if (newPassword.length < 6) {
            accountModalError.textContent = "New password must be at least 6 characters.";
            return;
        }
        user.password = newPassword;
        localStorage.setItem("helixUsers", JSON.stringify(users));
    } else if (activeAccountAction === "sessions") {
        localStorage.removeItem("helixLoggedIn");
        window.location.href = "index.html";
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

profilePhotoInput?.addEventListener("change", () => {
    const file = profilePhotoInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        profilePhotoMessage.textContent = "Select a supported image file.";
        profilePhotoInput.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        profilePhotoMessage.textContent = "Photo must be smaller than 5 MB.";
        profilePhotoInput.value = "";
        return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
        localStorage.setItem(`helixProfilePhoto:${loggedInUser}`, reader.result);
        updateProfileView();
        profilePhotoMessage.textContent = "Profile photo updated.";
        profilePhotoInput.value = "";
    });
    reader.readAsDataURL(file);
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
    const post = document.createElement("article");
    post.className = "community-post";
    post.dataset.searchable = text.toLowerCase();
    post.dataset.postId = `post-${Date.now()}`;
    postComments[post.dataset.postId] = [];
    post.innerHTML = `<div class="post-avatar avatar-lavender">${escapeHTML(username.slice(0, 2).toUpperCase())}</div><div class="post-content"><div class="post-meta"><div><strong>${escapeHTML(username)}</strong><span>@${escapeHTML(username.toLowerCase())} · now</span></div><button class="post-menu" type="button" aria-label="Post options">•••</button></div><p>${escapeHTML(text)}</p><div class="post-actions"><button type="button" data-post-action="like">♡ <span>0</span></button><button type="button" data-post-action="comment">◌ <span>0</span></button><button type="button" data-post-action="share">↗ <span>Share</span></button><button type="button" data-post-action="save">☆ <span>Save</span></button></div></div>`;
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
        ? comments.map((comment) => `<div class="comment-item"><span class="comment-avatar">${escapeHTML(comment.author.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHTML(comment.author)}</strong><p>${escapeHTML(comment.text)}</p></div></div>`).join("")
        : `<p class="comments-empty">No comments yet. Start the conversation.</p>`;
}

function openComments(post) {
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
    // DM — CONVERSATION SEARCH
    // =====================================================

    const helixDMSearch = document.getElementById("chat-search");
    const helixConversations =
        document.querySelectorAll("#conversation-list .conversation");

    if (helixDMSearch) {

        helixDMSearch.addEventListener("input", () => {

            const query =
                helixDMSearch.value.trim().toLowerCase();

            helixConversations.forEach((conversation) => {

                const name =
                    conversation
                        .querySelector("strong")
                        ?.textContent
                        .toLowerCase() || "";

                const preview =
                    conversation
                        .querySelector(".conversation-preview")
                        ?.textContent
                        .toLowerCase() || "";

                const matches =
                    !query ||
                    name.includes(query) ||
                    preview.includes(query);

                conversation.style.display =
                    matches ? "" : "none";
            });
        });
    }


    // =====================================================
    // DM — CHAT MESSAGE SEARCH BUTTON
    // =====================================================

    const chatSearchButton =
        document.getElementById("chat-search-button");

    const chatMessageSearch =
        document.getElementById("chat-message-search");

    const messageSearchInput =
        document.getElementById("message-search-input");

    const chatSearchClose =
        document.getElementById("chat-search-close");

    const dmMessages =
        document.getElementById("messages");


    if (
        chatSearchButton &&
        chatMessageSearch &&
        messageSearchInput
    ) {

        chatSearchButton.addEventListener("click", () => {

            chatMessageSearch.hidden = false;

            requestAnimationFrame(() => {
                messageSearchInput.focus();
            });
        });


        messageSearchInput.addEventListener("input", () => {

            const query =
                messageSearchInput.value.trim().toLowerCase();

            if (!dmMessages) return;

            dmMessages
                .querySelectorAll(".message")
                .forEach((message) => {

                    const text =
                        message.textContent.toLowerCase();

                    const matches =
                        !query || text.includes(query);

                    message.hidden = !matches;

                    message.classList.toggle(
                        "search-match",
                        Boolean(query && matches)
                    );
                });
        });


        if (chatSearchClose) {

            chatSearchClose.addEventListener("click", () => {

                messageSearchInput.value = "";

                if (dmMessages) {

                    dmMessages
                        .querySelectorAll(".message")
                        .forEach((message) => {

                            message.hidden = false;
                            message.classList.remove("search-match");

                        });
                }

                chatMessageSearch.hidden = true;
            });
        }
    }


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
// HELIX — FINAL DM POLISH
// =========================================================
(() => {
    const dmRoot = document.getElementById("dm-view");
    if (!dmRoot) return;

    const messagesBox = document.getElementById("messages");
    const messageForm = document.getElementById("message-form");
    const messageInput = document.getElementById("message-input");

    // ---------------------------------------------------------
    // REMOVE THE QUICK-REPLY / MACRO STRIP COMPLETELY
    // ---------------------------------------------------------
    const macroWords = ["On my way", "Check build", "Coffee?"];

    dmRoot.querySelectorAll("button").forEach((button) => {
        const text = button.textContent.trim();

        if (macroWords.includes(text)) {
            const parent = button.parentElement;

            if (parent) {
                parent.remove();
            } else {
                button.remove();
            }
        }
    });

    // Remove any now-empty quick-reply containers.
    dmRoot.querySelectorAll("*").forEach((element) => {
        if (
            element !== dmRoot &&
            element.children.length === 0 &&
            element.textContent.trim() === "" &&
            element.className &&
            /macro|quick|suggest|reply/i.test(String(element.className))
        ) {
            element.remove();
        }
    });

    // ---------------------------------------------------------
    // BOT REPLY SYSTEM
    // ---------------------------------------------------------
    const botReplies = {
        Alex: [
            "Yep bro, checking it now.",
            "Looks good from my side.",
            "Give me a sec, I'm testing it.",
            "Nice, this is coming together.",
            "Yeah bro, that part is clean now."
        ],

        Maya: [
            "Yep, I saw it.",
            "Looks good! Give me a minute.",
            "I'm checking that now.",
            "Nice bro, that works.",
            "Got it, I'll take a look."
        ],

        Ryan: [
            "Yep bro, I'm on it.",
            "Looks good from here.",
            "Give me a second, checking it.",
            "Nice, that works.",
            "Yeah bro, I got you."
        ]
    };

    let replyTimer = null;

    function getActivePerson() {
        const activeConversation = dmRoot.querySelector(
            ".conversation.active"
        );

        if (!activeConversation) {
            return "Alex";
        }

        const nameElement = activeConversation.querySelector(
            ".conversation-name, .conversation-title, strong"
        );

        return nameElement
            ? nameElement.textContent.trim()
            : "Alex";
    }

    function createTypingIndicator(name) {
        let existing = document.getElementById("helix-typing-indicator");

        if (existing) {
            existing.remove();
        }

        existing = document.createElement("div");
        existing.id = "helix-typing-indicator";
        existing.className = "helix-typing-indicator";

        existing.innerHTML = `
            <span>${escapeTypingName(name)} is typing</span>
            <span class="typing-dots">
                <i></i><i></i><i></i>
            </span>
        `;

        if (messagesBox) {
            messagesBox.appendChild(existing);
            messagesBox.scrollTop = messagesBox.scrollHeight;
        }

        return existing;
    }

    function escapeTypingName(name) {
        return String(name).replace(/[&<>"']/g, (character) => {
            const map = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return map[character];
        });
    }

    function createBotMessage(name, text) {
        if (!messagesBox) return;

        const message = document.createElement("div");
        message.className = "message received helix-bot-message";

        const now = new Date();

        const time = now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

        message.innerHTML = `
            <div class="message-bubble">
                <p>${escapeTypingName(text)}</p>
            </div>
            <div class="message-meta">
                <span class="message-time">${time}</span>
            </div>
        `;

        messagesBox.appendChild(message);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function sendBotReply() {
        const name = getActivePerson();
        const replies = botReplies[name] || botReplies.Alex;

        const reply =
            replies[Math.floor(Math.random() * replies.length)];

        const indicator = createTypingIndicator(name);

        clearTimeout(replyTimer);

        replyTimer = setTimeout(() => {
            if (indicator) {
                indicator.remove();
            }

            createBotMessage(name, reply);
        }, 1200);
    }

    // ---------------------------------------------------------
    // INTERCEPT MESSAGE SEND
    // ---------------------------------------------------------
    if (messageForm && messageInput) {
        messageForm.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const text = messageInput.value.trim();

                if (!text) return;

                // Add user's message directly.
                if (messagesBox) {
                    const message = document.createElement("div");

                    message.className =
                        "message sent helix-user-message";

                    const now = new Date();

                    const time = now.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                    });

                    message.innerHTML = `
                        <div class="message-bubble">
                            <p>${escapeTypingName(text)}</p>
                        </div>
                        <div class="message-meta">
                            <span class="message-time">${time}</span>
                            <span class="message-status">✓✓</span>
                        </div>
                    `;

                    messagesBox.appendChild(message);
                    messagesBox.scrollTop =
                        messagesBox.scrollHeight;
                }

                messageInput.value = "";

                // Let the other person respond.
                sendBotReply();
            },
            true
        );
    }

    // ---------------------------------------------------------
    // ALSO HANDLE ENTER KEY CLEANLY
    // ---------------------------------------------------------
    if (messageInput) {
        messageInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();

                if (messageForm) {
                    messageForm.requestSubmit();
                }
            }
        });
    }

    // ---------------------------------------------------------
    // CLEAN UP EMPTY MACRO SPACE
    // ---------------------------------------------------------
    dmRoot.querySelectorAll(".macro-buttons, .quick-replies, .dm-macros").forEach(
        (element) => {
            element.remove();
        }
    );

    console.log("Helix final DM polish loaded.");
})();
// =========================================================
// HELIX — FINAL DISCORD DM LAYOUT POLISH
// =========================================================
(() => {
    const dmView = document.getElementById("dm-view");

    if (!dmView) return;

    const chatSearchButton =
        document.getElementById("chat-search-button");

    const chatMessageSearch =
        document.getElementById("chat-message-search");

    const messageSearchInput =
        document.getElementById("message-search-input");

    const chatSearchClose =
        document.getElementById("chat-search-close");

    const leftSearch =
        document.getElementById("chat-search");

    // ---------------------------------------------------------
    // CLEAN LEFT SEARCH WRAPPER
    // ---------------------------------------------------------
    if (leftSearch) {
        const shell = leftSearch.parentElement;

        if (shell) {
            shell.classList.add("helix-clean-search-shell");
        }
    }

    // ---------------------------------------------------------
    // TOP MESSAGE SEARCH
    //
    // It is COMPLETELY hidden until the search icon is clicked.
    // ---------------------------------------------------------
    function closeMessageSearch() {
        if (!chatMessageSearch) return;

        chatMessageSearch.classList.remove(
            "helix-message-search-open"
        );

        chatMessageSearch.hidden = true;

        if (messageSearchInput) {
            messageSearchInput.value = "";

            dmView
                .querySelectorAll("#messages .message")
                .forEach((message) => {
                    message.style.display = "";
                    message.classList.remove("search-match");
                });
        }
    }

    function openMessageSearch() {
        if (!chatMessageSearch) return;

        chatMessageSearch.hidden = false;

        chatMessageSearch.classList.add(
            "helix-message-search-open"
        );

        requestAnimationFrame(() => {
            if (messageSearchInput) {
                messageSearchInput.focus();
            }
        });
    }

    if (chatMessageSearch) {
        chatMessageSearch.hidden = true;
    }

    // ---------------------------------------------------------
    // SEARCH BUTTON
    // ---------------------------------------------------------
    if (chatSearchButton) {
        chatSearchButton.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                const isOpen =
                    chatMessageSearch &&
                    !chatMessageSearch.hidden;

                if (isOpen) {
                    closeMessageSearch();
                } else {
                    openMessageSearch();
                }
            },
            true
        );
    }

    // ---------------------------------------------------------
    // CLOSE X
    // ---------------------------------------------------------
    if (chatSearchClose) {
        chatSearchClose.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                closeMessageSearch();
            },
            true
        );
    }

    // ---------------------------------------------------------
    // SEARCH MESSAGES
    // ---------------------------------------------------------
    if (messageSearchInput) {
        messageSearchInput.addEventListener(
            "input",
            () => {
                const query =
                    messageSearchInput.value
                        .trim()
                        .toLowerCase();

                const messages =
                    dmView.querySelectorAll(
                        "#messages .message"
                    );

                messages.forEach((message) => {
                    const text =
                        message.textContent
                            .toLowerCase();

                    const matches =
                        query === "" ||
                        text.includes(query);

                    message.style.display =
                        matches ? "" : "none";

                    message.classList.toggle(
                        "search-match",
                        query !== "" && matches
                    );
                });
            }
        );
    }

    // ---------------------------------------------------------
    // ESC CLOSES MESSAGE SEARCH
    // ---------------------------------------------------------
    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            chatMessageSearch &&
            !chatMessageSearch.hidden
        ) {
            closeMessageSearch();
        }
    });

    // ---------------------------------------------------------
    // LEFT SEARCH — CLEAN FILTER
    // ---------------------------------------------------------
    if (leftSearch) {
        leftSearch.addEventListener("input", () => {
            const query =
                leftSearch.value
                    .trim()
                    .toLowerCase();

            dmView
                .querySelectorAll(".conversation")
                .forEach((conversation) => {
                    const text =
                        conversation.textContent
                            .toLowerCase();

                    conversation.style.display =
                        query === "" ||
                        text.includes(query)
                            ? ""
                            : "none";
                });
        });
    }

    // ---------------------------------------------------------
    // DISCORD-STYLE MESSAGE WIDTH
    // ---------------------------------------------------------
    function polishMessages() {
        dmView
            .querySelectorAll("#messages .message")
            .forEach((message) => {
                const bubble =
                    message.querySelector(
                        ".message-bubble"
                    );

                if (!bubble) return;

                bubble.classList.add(
                    "helix-flex-message"
                );
            });
    }

    polishMessages();

    // Watch for new messages from the bot.
    if (window.MutationObserver && document.getElementById("messages")) {
        const observer =
            new MutationObserver(() => {
                polishMessages();
            });

        observer.observe(
            document.getElementById("messages"),
            {
                childList: true,
                subtree: true
            }
        );
    }

    console.log(
        "Helix Discord-style DM polish loaded."
    );
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