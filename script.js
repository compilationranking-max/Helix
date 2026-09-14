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
    return JSON.parse(localStorage.getItem("helixUsers")) || {};
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

signupBtn.addEventListener("click", () => {

    const username = document
        .getElementById("signup-username")
        .value
        .trim();

    const password = document
        .getElementById("signup-password")
        .value;

    const confirmPassword = document
        .getElementById("signup-confirm-password")
        .value;


    // Empty fields
    if (!username || !password || !confirmPassword) {
        showMessage("Please fill in all fields.");
        return;
    }


    // Username length
    if (username.length < 3) {
        showMessage("Username must be at least 3 characters.");
        return;
    }


    // Password length
    if (password.length < 6) {
        showMessage("Password must be at least 6 characters.");
        return;
    }


    // Password match
    if (password !== confirmPassword) {
        showMessage("Passwords do not match.");
        return;
    }


    const users = getUsers();


    // Username already exists
    if (users[username]) {
        showMessage("That username already exists.");
        return;
    }


    // Create account
    users[username] = {
        password: password
    };

    saveUsers(users);


    showMessage("Account created successfully!", "success");


    // Clear signup fields
    document.getElementById("signup-username").value = "";
    document.getElementById("signup-password").value = "";
    document.getElementById("signup-confirm-password").value = "";


    // Automatically switch to login
    setTimeout(() => {

        signupForm.classList.add("hidden");
        loginForm.classList.remove("hidden");

        clearMessage();

    }, 1000);
});


// ================================
// LOGIN
// ================================

loginBtn.addEventListener("click", () => {

    const username = document
        .getElementById("login-username")
        .value
        .trim();

    const password = document
        .getElementById("login-password")
        .value;


    // Empty fields
    if (!username || !password) {
        showMessage("Please enter your username and password.");
        return;
    }


    const users = getUsers();


    // User doesn't exist
    if (!users[username]) {
        showMessage("Username not found.");
        return;
    }


    // Wrong password
    if (users[username].password !== password) {
        showMessage("Incorrect password.");
        return;
    }


// Successful login
showMessage("Login successful!", "success");

localStorage.setItem("helixLoggedIn", username);

// Open the Helix app
setTimeout(() => {
    window.location.href = "app.html";
}, 500);

});