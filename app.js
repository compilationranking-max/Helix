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

const logoutButton = document.getElementById("logout-btn");

if (logoutButton) {
    logoutButton.addEventListener("click", () => {

        localStorage.removeItem("helixLoggedIn");

        window.location.href = "index.html";
    });
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