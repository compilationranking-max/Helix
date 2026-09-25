// ================================
// HELIX - AUTHENTICATION SYSTEM
// ================================

// Get HTML elements
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

const showSignupBtn = document.getElementById("show-signup");
const showLoginBtn = document.getElementById("show-login");

const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const signupDisplayName = document.getElementById("signup-display-name");

const authMessage = document.getElementById("auth-message");


// ================================
// SWITCH LOGIN / SIGN UP
// ================================

showSignupBtn.addEventListener("click", () => {
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");

    clearMessage();
});

showLoginBtn.addEventListener("click", () => {
    signupForm.classList.add("hidden");
    loginForm.classList.remove("hidden");

    clearMessage();
});


// ================================
// SHOW MESSAGE
// ================================

function showMessage(message, type = "error") {
    authMessage.textContent = message;

    if (type === "success") {
        authMessage.style.color = "#4ade80";
    } else {
        authMessage.style.color = "#ff6b6b";
    }
}


// ================================
// CLEAR MESSAGE
// ================================

function clearMessage() {
    authMessage.textContent = "";
}


// ================================
// GET SAVED USERS
// ================================

function getUsers() {
    try {
        const users = JSON.parse(localStorage.getItem("helixUsers") || "{}");
        return users && typeof users === "object" && !Array.isArray(users) ? users : {};
    } catch {
        return {};
    }
}


// ================================
// SAVE USERS
// ================================

function saveUsers(users) {
    localStorage.setItem("helixUsers", JSON.stringify(users));
}


// ================================
// SIGN UP
// ================================

signupBtn.addEventListener("click", async () => {
    const username = document.getElementById("signup-username").value.trim();
    const displayName = document.getElementById("signup-display-name").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-confirm-password").value;

    if (!username || !displayName || !password || !confirmPassword) {
        showMessage("Please fill in all fields.");
        return;
    }

    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
        showMessage("Username must be 3–32 characters using letters, numbers, dots, underscores or hyphens.");
        return;
    }

    if (displayName.length > 50 || /[\u0000-\u001F\u007F]/.test(displayName)) {
        showMessage("Display name must be 1–50 characters and cannot contain control characters.");
        return;
    }

    if (password.length < 6) {
        showMessage("Password must be at least 6 characters.");
        return;
    }

    if (password !== confirmPassword) {
        showMessage("Passwords do not match.");
        return;
    }

    signupBtn.disabled = true;

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, displayName, password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Could not create the account.");
        }

        const users = getUsers();
        users[username] = {
            displayName: data.user?.displayName || displayName,
            createdAt: data.user?.createdAt || new Date().toISOString()
        };
        saveUsers(users);

        localStorage.setItem("helixLoggedIn", username);
        localStorage.setItem("helixDisplayName", data.user?.displayName || displayName);
        sessionStorage.setItem("helixShowIntro", "1");

        showMessage("Account created successfully!", "success");

        setTimeout(() => {
            window.location.href = "app.html";
        }, 500);
    } catch (error) {
        showMessage(error.message || "Could not create the account.");
    } finally {
        signupBtn.disabled = false;
    }
});

// ================================
// LOGIN
// ================================

loginBtn.addEventListener("click", async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    if (!username || !password) {
        showMessage("Please enter your username and password.");
        return;
    }

    loginBtn.disabled = true;

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Incorrect username or password.");
        }

        const users = getUsers();
        users[username] = {
            ...(users[username] || {}),
            displayName: data.user?.displayName || username,
            createdAt: data.user?.createdAt || users[username]?.createdAt || new Date().toISOString()
        };
        saveUsers(users);

        localStorage.setItem("helixLoggedIn", username);
        localStorage.setItem("helixDisplayName", data.user?.displayName || username);
        sessionStorage.setItem("helixShowIntro", "1");

        showMessage("Login successful!", "success");

        setTimeout(() => {
            window.location.href = "app.html";
        }, 400);
    } catch (error) {
        showMessage(error.message || "Could not log in to Helix.");
    } finally {
        loginBtn.disabled = false;
    }
});

