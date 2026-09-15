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
    const usernameElements = document.querySelectorAll("[data-user]");
    const avatarElements = document.querySelectorAll("[data-avatar]");
    const username = loggedInUser || "User";
    const photo = localStorage.getItem(`helixProfilePhoto:${loggedInUser}`);

    usernameElements.forEach((element) => {
        element.textContent = username;
    });

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

const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");


function getCurrentTime() {
    const now = new Date();

    return now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}


function addMessage(text, type = "sent") {

    if (!messagesContainer) return;

    const message = document.createElement("div");

    message.className = `message ${type}`;

    message.innerHTML = `
        <div class="message-bubble">

            <p>${escapeHTML(text)}</p>

            <span class="message-time">
                ${getCurrentTime()}
            </span>

        </div>
    `;

    messagesContainer.appendChild(message);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


// Prevent HTML injection when displaying user-entered text
function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// =========================================================
// SEND MESSAGE
// =========================================================

if (messageForm && messageInput) {

    messageForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const message = messageInput.value.trim();

        if (!message) return;

        addMessage(message, "sent");

        messageInput.value = "";

        simulateReply();
    });
}


// =========================================================
// HELIX AI HOME
// =========================================================

const aiForm = document.getElementById("ai-form");
const aiInput = document.getElementById("ai-input");
const aiStorageKey = `helixAIConversation:${loggedInUser || "User"}`;
localStorage.removeItem(aiStorageKey);

document.getElementById("clear-ai-button")?.addEventListener("click", () => {
    localStorage.removeItem(aiStorageKey);
});

document.getElementById("new-chat-button")?.addEventListener("click", () => {
    localStorage.removeItem(aiStorageKey);
});

document.getElementById("sidebar-new-chat-button")?.addEventListener("click", () => {
    localStorage.removeItem(aiStorageKey);
});

const homeView = document.getElementById("home-view");
const closeAISidebarButton = document.getElementById("close-ai-sidebar-button");
const openAISidebarButton = document.getElementById("open-ai-sidebar-button");

function setAISidebarOpen(isOpen) {
    homeView?.classList.toggle("sidebar-closed", !isOpen);
    if (openAISidebarButton) openAISidebarButton.hidden = isOpen;
    if (closeAISidebarButton) closeAISidebarButton.setAttribute("aria-expanded", String(isOpen));
}

closeAISidebarButton?.addEventListener("click", () => setAISidebarOpen(false));
openAISidebarButton?.addEventListener("click", () => setAISidebarOpen(true));


// =========================================================
// QUICK MACROS
// =========================================================

const macroButtons = document.querySelectorAll(".macro-btn");

macroButtons.forEach((button) => {

    button.addEventListener("click", () => {

        const message = button.dataset.message;

        if (!message) return;

        addMessage(message, "sent");

        simulateReply();
    });

});


// =========================================================
// SIMULATED REPLY
// =========================================================

function simulateReply() {

    const typingIndicator =
        document.getElementById("typing-indicator");

    if (!typingIndicator) return;

    typingIndicator.style.opacity = "1";

    setTimeout(() => {

        typingIndicator.style.opacity = "0";

    }, 1500);
}


// =========================================================
// CONVERSATION SELECTION
// =========================================================

const conversations =
    document.querySelectorAll(".conversation");

conversations.forEach((conversation) => {

    conversation.addEventListener("click", () => {

        conversations.forEach((item) => {
            item.classList.remove("active");
        });

        conversation.classList.add("active");

        updateActiveConversation(conversation);
    });

});


function updateActiveConversation(conversation) {

    const nameElement =
        conversation.querySelector("strong");

    const pingElement =
        conversation.querySelector(".ping");

    const chatTitle =
        document.querySelector(".chat-user h2");

    const chatStatus =
        document.querySelector(".chat-user p");

    const profileName =
        document.querySelector(".profile-card h2");

    const profileUsername =
        document.querySelector(".profile-card .username");

    if (nameElement) {

        const name = nameElement.textContent;

        if (chatTitle) {
            chatTitle.textContent = name;
        }

        if (profileName) {
            profileName.textContent = name;
        }

        if (profileUsername) {
            profileUsername.textContent =
                "@" + name.toLowerCase();
        }
    }

    if (pingElement && chatStatus) {

        const ping = pingElement.textContent.trim();

        chatStatus.innerHTML = `
            <span class="online-dot"></span>
            Online · ${ping}
        `;
    }

    // Clear demo messages when switching chats
    if (messagesContainer) {

        messagesContainer.innerHTML = "";

        addMessage(
            "Connection established.",
            "received"
        );

        addMessage(
            "You are now connected to this console.",
            "received"
        );
    }
}


// =========================================================
// SEARCH CONVERSATIONS
// =========================================================

const searchInput =
    document.getElementById("chat-search");


if (searchInput) {

    searchInput.addEventListener("input", () => {

        const query =
            searchInput.value.toLowerCase().trim();

        conversations.forEach((conversation) => {

            const name =
                conversation
                    .querySelector("strong")
                    ?.textContent
                    .toLowerCase() || "";

            const preview =
                conversation
                    .querySelector("p")
                    ?.textContent
                    .toLowerCase() || "";

            const matches =
                name.includes(query) ||
                preview.includes(query);

            conversation.style.display =
                matches ? "flex" : "none";
        });
    });
}


// =========================================================
// NAVIGATION
// =========================================================

const reelData = [
    {
        id: "signal-in-bloom",
        video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        creator: "Mira Chen",
        username: "@mirachen",
        avatar: "MC",
        caption: "A quiet signal in the middle of the noise. Find your frequency.",
        hashtags: ["#helix", "#slowmotion"],
        audio: "Original audio · Mira Chen",
        likes: 1842,
        comments: [
            { username: "noah.k", avatar: "NK", text: "The color shift is unreal.", time: "8m" },
            { username: "rhea", avatar: "RH", text: "This feels like a transmission from tomorrow.", time: "21m" }
        ]
    },
    {
        id: "after-hours-build",
        video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
        creator: "Jules Park",
        username: "@julespark",
        avatar: "JP",
        caption: "After-hours build log. Small details, big atmosphere.",
        hashtags: ["#buildinpublic", "#nightshift"],
        audio: "Night Drive · Helix Radio",
        likes: 927,
        comments: [
            { username: "sana", avatar: "SA", text: "The whole interface is so clean.", time: "4m" }
        ]
    },
    {
        id: "orbit-notes",
        video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        creator: "Theo Vale",
        username: "@theovale",
        avatar: "TV",
        caption: "Orbit notes from a Sunday walk. Keep looking up.",
        hashtags: ["#fieldnotes", "#outside"],
        audio: "Soft Focus · Theo Vale",
        likes: 2411,
        comments: []
    }
];

const reelState = reelData.map((reel) => ({
    ...reel,
    liked: false,
    saved: false,
    following: false,
    muted: true,
    comments: [...reel.comments]
}));

let reelsInitialized = false;
let activeReelIndex = 0;
let commentReelIndex = 0;
let shareReelIndex = 0;

function formatCount(count) {
    return count >= 1000
        ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(".0", "")}K`
        : String(count);
}

function renderReels() {
    const feed = document.getElementById("reels-feed");

    if (!feed) return;

    feed.innerHTML = reelState.map((reel, index) => `
        <article class="reel-card" data-reel-index="${index}">
            <video class="reel-video" src="${escapeHTML(reel.video)}" muted playsinline loop preload="metadata"></video>
            <span class="reel-loading">Loading media...</span>
            <div class="reel-play-indicator">▶</div>
            <div class="reel-progress" aria-hidden="true"><span></span></div>

            <div class="reel-info">
                <div class="reel-creator">
                    <span class="reel-avatar">${escapeHTML(reel.avatar)}</span>
                    <strong>${escapeHTML(reel.username)}</strong>
                </div>
                <p class="reel-caption">${escapeHTML(reel.caption)} ${reel.hashtags.map((tag) => `<span class="hashtag">${escapeHTML(tag)}</span>`).join(" ")}</p>
                <p class="reel-audio"><span>♫</span>${escapeHTML(reel.audio)}</p>
            </div>

            <div class="reel-actions">
                <button class="reel-action${reel.liked ? " liked" : ""}" type="button" data-action="like" aria-label="Like Reel"><span class="reel-action-icon">♥</span><small>${formatCount(reel.likes)}</small></button>
                <button class="reel-action" type="button" data-action="comment" aria-label="Open comments"><span class="reel-action-icon">◌</span><small>${formatCount(reel.comments.length)}</small></button>
                <button class="reel-action" type="button" data-action="share" aria-label="Share Reel"><span class="reel-action-icon">↗</span><small>Share</small></button>
                <button class="reel-action" type="button" data-action="repost" aria-label="Repost Reel"><span class="reel-action-icon">⟳</span><small>Repost</small></button>
            </div>
        </article>
    `).join("");

    feed.querySelectorAll(".reel-card").forEach((card) => bindReelCard(card));
    setupReelObserver(feed);
}

function bindReelCard(card) {
    const index = Number(card.dataset.reelIndex);
    const video = card.querySelector(".reel-video");
    const progress = card.querySelector(".reel-progress span");
    const loading = card.querySelector(".reel-loading");
    const playIndicator = card.querySelector(".reel-play-indicator");

    video.addEventListener("loadeddata", () => {
        loading.hidden = true;
    });

    video.addEventListener("error", () => {
        loading.hidden = false;
        loading.textContent = "Media unavailable · replace sample URL";
        loading.classList.add("error");
    });

    video.addEventListener("timeupdate", () => {
        progress.style.width = video.duration ? `${(video.currentTime / video.duration) * 100}%` : "0%";
    });

    video.addEventListener("play", () => {
        playIndicator.textContent = "❚❚";
        playIndicator.classList.remove("visible");
    });

    video.addEventListener("pause", () => {
        playIndicator.textContent = "▶";
        playIndicator.classList.add("visible");
    });

    video.addEventListener("click", () => toggleVideo(video));
    video.addEventListener("dblclick", () => {
        if (!reelState[index].liked) toggleLike(index, card);
    });

    card.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;

            if (action === "like") toggleLike(index, card);
            if (action === "comment") openComments(index);
            if (action === "share") openShare(index);
            if (action === "repost") showReelFeedback(card, "Reposted to your Helix feed");
        });
    });
}

function toggleVideo(video) {
    if (video.paused) {
        pauseAllVideos(video);
        video.play().catch(() => {});
    } else {
        video.pause();
    }
}

function pauseAllVideos(exceptVideo) {
    document.querySelectorAll(".reel-video").forEach((video) => {
        if (video !== exceptVideo) video.pause();
    });
}

function activateReel(card) {
    const index = Number(card.dataset.reelIndex);
    const video = card.querySelector(".reel-video");

    activeReelIndex = index;
    pauseAllVideos(video);
    video.currentTime = 0;
    video.play().catch(() => {
        card.querySelector(".reel-play-indicator").classList.add("visible");
    });
}

function setupReelObserver(feed) {
    if (!window.IntersectionObserver) {
        activateReel(feed.querySelector(".reel-card"));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
                activateReel(entry.target);
            }
        });
    }, { root: feed, threshold: [0.7] });

    feed.querySelectorAll(".reel-card").forEach((card) => observer.observe(card));
}

function toggleLike(index, card) {
    const reel = reelState[index];
    reel.liked = !reel.liked;
    reel.likes += reel.liked ? 1 : -1;

    const button = card.querySelector('[data-action="like"]');
    button.classList.toggle("liked", reel.liked);
    button.querySelector("small").textContent = formatCount(reel.likes);
}

function showReelFeedback(card, message) {
    const feedback = document.createElement("span");
    feedback.className = "reel-loading";
    feedback.textContent = message;
    card.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1800);
}

function renderComments(index) {
    const list = document.getElementById("comments-list");
    const comments = reelState[index].comments;

    list.innerHTML = "";

    if (!comments.length) {
        const empty = document.createElement("p");
        empty.className = "comment-empty";
        empty.textContent = "No comments yet. Start the thread.";
        list.appendChild(empty);
        return;
    }

    comments.forEach((comment) => {
        const item = document.createElement("article");
        item.className = "comment-item";
        item.innerHTML = `
            <span class="reel-avatar"></span>
            <div class="comment-body">
                <div class="comment-meta"><strong></strong><time></time></div>
                <p></p>
            </div>
        `;
        item.querySelector(".reel-avatar").textContent = comment.avatar;
        item.querySelector("strong").textContent = comment.username;
        item.querySelector("time").textContent = comment.time;
        item.querySelector("p").textContent = comment.text;
        list.appendChild(item);
    });
}

function openComments(index) {
    commentReelIndex = index;
    renderComments(index);
    document.getElementById("comments-overlay").hidden = false;
    document.getElementById("comment-input").focus();
}

function openShare(index) {
    shareReelIndex = index;
    document.getElementById("share-feedback").textContent = "";
    document.getElementById("share-overlay").hidden = false;
}

function closeOverlay(id) {
    document.getElementById(id).hidden = true;
}

function showShareFeedback(message) {
    document.getElementById("share-feedback").textContent = message;
}

async function copyReelLink() {
    const link = `${window.location.href.split("#")[0]}#reel=${reelState[shareReelIndex].id}`;

    try {
        if (!navigator.clipboard) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(link);
        showShareFeedback("Link copied");
    } catch (error) {
        showShareFeedback("Clipboard unavailable in this browser");
    }
}

function initializeReels() {
    if (reelsInitialized) return;

    renderReels();
    reelsInitialized = true;

    document.getElementById("comment-form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("comment-input");
        const text = input.value.trim();

        if (!text) return;

        reelState[commentReelIndex].comments.push({
            username: `@${loggedInUser || "you"}`,
            avatar: (loggedInUser || "You").slice(0, 2).toUpperCase(),
            text,
            time: "now"
        });
        input.value = "";
        renderComments(commentReelIndex);

        const card = document.querySelector(`[data-reel-index="${commentReelIndex}"]`);
        card.querySelector('[data-action="comment"] small').textContent = formatCount(reelState[commentReelIndex].comments.length);
    });

    document.querySelectorAll("[data-close-overlay]").forEach((button) => {
        button.addEventListener("click", () => closeOverlay(button.dataset.closeOverlay));
    });

    document.querySelectorAll(".reel-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) closeOverlay(overlay.id);
        });
    });

    document.getElementById("copy-link-button")?.addEventListener("click", copyReelLink);
    document.getElementById("share-helix-button")?.addEventListener("click", () => showShareFeedback("Ready to share with your Helix connections"));
    document.getElementById("share-external-button")?.addEventListener("click", async () => {
        const link = `${window.location.href.split("#")[0]}#reel=${reelState[shareReelIndex].id}`;

        if (!navigator.share) {
            showShareFeedback("External sharing is not supported here");
            return;
        }

        try {
            await navigator.share({ title: "Helix Reel", url: link });
        } catch (error) {
            if (error.name !== "AbortError") showShareFeedback("External share was unavailable");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeOverlay("comments-overlay");
            closeOverlay("share-overlay");
        }
    });
}

function setNavigationSection(id) {
    const section = id === "nav-home"
        ? "home"
        : id === "nav-console"
            ? "direct-messages"
            : id === "nav-reels"
                ? "reels"
                : "profile";
    const mainSections = document.querySelectorAll("[data-main-section]");
    const detailsPanel = document.querySelector(".details-panel");
    const appShell = document.querySelector(".helix-app");
    const showReels = section === "reels";

    appShell?.classList.toggle("home-active", section === "home");

    mainSections.forEach((mainSection) => {
        mainSection.hidden = mainSection.dataset.mainSection !== section;
    });

    detailsPanel.hidden = section !== "direct-messages";

    if (showReels) {
        initializeReels();
        const activeCard = document.querySelector(`[data-reel-index="${activeReelIndex}"]`);
        if (activeCard) activateReel(activeCard);
    } else {
        pauseAllVideos();
    }

    if (section === "profile") {
        updateProfileView();
    }
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
const postComments = {
    "design-studio": [{ author: "Jordan Rivera", text: "I can take a look after 7!" }],
    "water-bottle": [{ author: "Maya Chen", text: "Hope it finds its owner soon." }],
    robotics: []
};

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

const muteButton =
    document.getElementById("mute-btn");

if (muteButton) {

    muteButton.addEventListener("click", () => {

        const isMuted =
            muteButton.textContent === "Unmute";

        muteButton.textContent =
            isMuted ? "Mute" : "Unmute";

        muteButton.classList.toggle("muted");
    });
}


// =========================================================
// INITIALIZATION
// =========================================================

updateLoggedInUser();

handleNavigation("nav-home");


// Scroll messages to bottom on startup

if (messagesContainer) {
    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


// Console message

console.log(
    `%cHELIX SYSTEM ONLINE`,
    "color:#7c5cff;font-size:20px;font-weight:bold;"
);

console.log(
    `Logged in as: ${loggedInUser}`
);