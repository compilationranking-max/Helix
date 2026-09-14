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

    usernameElements.forEach((element) => {
        element.textContent = loggedInUser || "User";
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
    const showReels = section === "reels";

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

    if (profileUsername) {
        profileUsername.textContent = loggedInUser || "Not available";
    }

    if (profileEmail) {
        profileEmail.textContent = localStorage.getItem("helixEmail") || "Not linked";
    }

    if (profilePhone) {
        profilePhone.textContent = localStorage.getItem("helixPhone") || "Not linked";
    }
}

const logoutAllSessionsButton = document.getElementById("logout-all-sessions-btn");
const profileActionMessage = document.getElementById("profile-action-message");

if (logoutAllSessionsButton && profileActionMessage) {
    logoutAllSessionsButton.addEventListener("click", () => {
        const confirmed = window.confirm("This frontend prototype can only end the current session. Continue?");

        if (!confirmed) return;

        profileActionMessage.textContent = "Prototype action complete for this session. Other devices are not affected.";
    });
}

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

        const post = prompt(
            "Broadcast a message to your Helix network:"
        );

        if (!post || !post.trim()) return;

        console.log("Broadcast:", post.trim());

        alert("Broadcast created!");
    });
}


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