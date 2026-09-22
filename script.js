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
const signupAccountId = document.getElementById("signup-account-id");

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
    const accountId = document.getElementById("signup-account-id").value.trim().toLowerCase();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-confirm-password").value;

    if (!username || !password || !confirmPassword || !accountId) {
        showMessage("Please fill in all fields.");
        return;
    }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
        showMessage("Username must be 3–32 characters using letters, numbers, dots, underscores or hyphens.");
        return;
    }
    if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(accountId)) {
        showMessage("Account ID must be 3–32 characters using letters, numbers, dots, underscores or hyphens.");
        return;
    }
    if (password.length < 8) {
        showMessage("Password must be at least 8 characters.");
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
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ username, accountId, password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not create the account.");

        const users = getUsers();
        users[username] = {
            createdAt: data.user.createdAt,
            accountId: data.user.accountId
        };
        saveUsers(users);

        showMessage("Account created successfully!", "success");
        document.getElementById("signup-username").value = "";
        document.getElementById("signup-account-id").value = "";
        document.getElementById("signup-password").value = "";
        document.getElementById("signup-confirm-password").value = "";

        localStorage.setItem("helixLoggedIn", username);
        sessionStorage.setItem("helixShowIntro", "1");
        setTimeout(() => { window.location.href = "app.html"; }, 500);
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
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ username, password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Invalid username or password.");

        const users = getUsers();
        users[username] = {
            createdAt: data.user.createdAt,
            accountId: data.user.accountId
        };
        saveUsers(users);

        showMessage("Login successful!", "success");
        localStorage.setItem("helixLoggedIn", username);
        sessionStorage.setItem("helixShowIntro", "1");
        setTimeout(() => { window.location.href = "app.html"; }, 500);
    } catch (error) {
        showMessage(error.message || "Unable to log in.");
    } finally {
        loginBtn.disabled = false;
    }
});
