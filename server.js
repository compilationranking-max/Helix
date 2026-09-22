require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.HELIX_AI_MODEL || "gpt-5.6-sol";
const MAX_HISTORY_MESSAGES = 20;
const MAX_CHAT_CONTENT_LENGTH = 4000;
const MAX_SEARCH_LENGTH = 64;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMITS = {
    general: 120,
    chat: 20,
    network: 60,
    auth: 10
};
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_COOKIE = "helix_session";
const sessions = new Map();


const rateBuckets = new Map();

function createSession(username) {
    const token = crypto.randomBytes(32).toString("base64url");
    sessions.set(token, { username, createdAt: Date.now(), lastSeenAt: Date.now() });
    return token;
}

function getSession(req) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() - session.lastSeenAt > SESSION_TTL_MS) {
        sessions.delete(token);
        return null;
    }
    session.lastSeenAt = Date.now();
    return { token, ...session };
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === "production";
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure,
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_TTL_MS
    });
}

function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/"
    });
}

function requireAuth(req, res, next) {
    const session = getSession(req);
    if (!session) {
        return res.status(401).json({ error: "Authentication required." });
    }
    req.user = session.username;
    req.sessionToken = session.token;
    next();
}

function sameOrigin(req) {
    const origin = req.get("origin");
    if (!origin) return true;
    const expected = `${req.protocol}://${req.get("host")}`;
    return origin === expected;
}

function requireSameOrigin(req, res, next) {
    if (!sameOrigin(req)) {
        return res.status(403).json({ error: "Cross-origin request blocked." });
    }
    next();
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const derivedKey = await scrypt(password, salt, 64);
    return { salt, hash: derivedKey.toString("hex") };
}

async function verifyPassword(password, salt, expectedHash) {
    const derivedKey = await scrypt(password, salt, 64);
    const expected = Buffer.from(expectedHash, "hex");
    return expected.length === derivedKey.length && crypto.timingSafeEqual(derivedKey, expected);
}


function getClientAddress(req) {
    return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimit(kind) {
    const limit = RATE_LIMITS[kind] || RATE_LIMITS.general;

    return (req, res, next) => {
        const now = Date.now();
        const key = `${kind}:${getClientAddress(req)}`;
        const existing = rateBuckets.get(key);

        if (!existing || now - existing.startedAt >= RATE_WINDOW_MS) {
            rateBuckets.set(key, { startedAt: now, count: 1 });
            return next();
        }

        existing.count += 1;

        if (existing.count > limit) {
            const retryAfter = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - existing.startedAt)) / 1000));
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({ error: "Too many requests. Please try again shortly." });
        }

        next();
    };
}

setInterval(() => {
    const cutoff = Date.now() - RATE_WINDOW_MS;
    for (const [key, bucket] of rateBuckets) {
        if (bucket.startedAt < cutoff) rateBuckets.delete(key);
    }
}, RATE_WINDOW_MS).unref();

const HELIX_AI_INSTRUCTIONS = `
You are HELIX AI, the built-in AI assistant of the Helix platform.
When asked who you are or what your name is, identify yourself as HELIX AI.
Never introduce yourself as ChatGPT unless the user explicitly asks which underlying AI or model powers you.
Do not say that you were created by OpenAI during normal introductions.
You are not human and must not claim to be human.
Maintain a futuristic, intelligent, technical personality suited to Helix's dark-terminal cyberpunk identity.
Be helpful, natural, conversational, and reasonably concise. Understand context instead of blindly repeating the user's wording.
Use the recent conversation history to answer references and follow-up questions accurately.
If the user says you are Helix AI, acknowledge it naturally rather than correcting them.
In normal conversation, refer to yourself as Helix AI or Helix.
`;

if (!process.env.OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY is not configured. Helix AI requests will fail until it is set in .env.");
}

const client = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

app.disable("x-powered-by");

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
        "script-src 'self'; style-src 'self'; img-src 'self' data: blob:; " +
        "font-src 'self' data:; connect-src 'self'; form-action 'self'"
    );

    if (req.path.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Pragma", "no-cache");
    }

    if (process.env.NODE_ENV === "production" && req.secure) {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
});

app.use((req, res, next) => {
    if (req.path === "/data" || req.path.startsWith("/data/")) {
        return res.status(404).end();
    }
    next();
});

function parseCookies(req) {
    const header = req.headers.cookie || "";
    return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
        const index = part.indexOf("=");
        const key = index >= 0 ? part.slice(0, index).trim() : part.trim();
        const value = index >= 0 ? part.slice(index + 1).trim() : "";
        return [key, decodeURIComponent(value)];
    }));
}

app.use((req, res, next) => {
    req.cookies = parseCookies(req);
    next();
});
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return requireSameOrigin(req, res, next);
    next();
});
app.use(rateLimit("general"));

const PUBLIC_FILES = new Set([
    "/",
    "/index.html",
    "/app.html",
    "/app.js",
    "/script.js",
    "/app.css",
    "/style.css",
    "/dragon-intro-transparent.svg",
    "/dragon-intro.png",
    "/reels-icon.png"
]);

function isPublicAssetPath(requestPath) {
    if (PUBLIC_FILES.has(requestPath)) return true;
    return /^\/images\/[A-Za-z0-9._-]+\\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(requestPath);
}

app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/api") {
        return next();
    }

    if (!isPublicAssetPath(req.path)) {
        return res.status(404).end();
    }

    next();
});

app.use(express.static(__dirname, {
    dotfiles: "ignore",
    index: false,
    fallthrough: true
}));

const networkDataDir = path.join(__dirname, "data");
const networkDataFile = path.join(networkDataDir, "helix-network.json");

function loadNetworkData() {
    try {
        if (!require("fs").existsSync(networkDataFile)) {
            return { users: {}, requests: [], friends: [] };
        }
        const parsed = JSON.parse(require("fs").readFileSync(networkDataFile, "utf8"));
        return {
            users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
            requests: Array.isArray(parsed.requests) ? parsed.requests : [],
            friends: Array.isArray(parsed.friends) ? parsed.friends : []
        };
    } catch (error) {
        console.warn("Unable to load Helix network data:", error.message);
        return { users: {}, requests: [], friends: [] };
    }
}

function saveNetworkData(data) {
    const fs = require("fs");
    fs.mkdirSync(networkDataDir, { recursive: true });
    const tempFile = `${networkDataFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, networkDataFile);
}

function getUserRecord(data, username) {
    return data.users[username] || null;
}

function sanitizePublicUser(user) {
    return {
        username: user.username,
        accountId: user.accountId,
        createdAt: user.createdAt
    };
}

function normalizeUsername(value) {
    return typeof value === "string" ? value.trim() : "";
}

function validUsername(value) {
    return /^[A-Za-z0-9_.-]{3,32}$/.test(value);
}

function migrateUsername(data, previousUsername, nextUsername) {
    if (!previousUsername || previousUsername === nextUsername) return;

    const oldUser = data.users[previousUsername];
    const newUser = data.users[nextUsername];

    if (!oldUser) return;

    if (newUser && previousUsername !== nextUsername) {
        throw new Error("That username is already registered on the Helix network.");
    }

    data.users[nextUsername] = {
        ...oldUser,
        username: nextUsername
    };
    delete data.users[previousUsername];

    data.requests.forEach((request) => {
        if (request.from === previousUsername) request.from = nextUsername;
        if (request.to === previousUsername) request.to = nextUsername;
    });

    data.friends.forEach((friend) => {
        if (friend.a === previousUsername) friend.a = nextUsername;
        if (friend.b === previousUsername) friend.b = nextUsername;
    });
}

function samePair(a, b, x, y) {
    return (a === x && b === y) || (a === y && b === x);
}

function networkState(username) {
    const data = loadNetworkData();
    const friends = data.friends
        .filter((friend) => friend.a === username || friend.b === username)
        .map((friend) => friend.a === username ? friend.b : friend.a);

    const incoming = data.requests
        .filter((request) => request.to === username && request.status === "pending")
        .map((request) => ({
            id: request.id,
            from: request.from,
            createdAt: request.createdAt
        }));

    const outgoing = data.requests
        .filter((request) => request.from === username && request.status === "pending")
        .map((request) => ({
            id: request.id,
            to: request.to,
            createdAt: request.createdAt
        }));

    return { friends, incoming, outgoing };
}

function normalizeAccountId(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validAccountId(value) {
    return /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(value);
}

function findAccountIdOwner(data, accountId) {
    const normalized = normalizeAccountId(accountId);

    return Object.entries(data.users).find(([, user]) =>
        normalizeAccountId(user?.accountId) === normalized
    )?.[0] || null;
}

function createFallbackAccountId(data) {
    let candidate = "";
    do {
        candidate = `hx_${require("crypto").randomBytes(8).toString("hex")}`;
    } while (findAccountIdOwner(data, candidate));

    return candidate;
}

app.post("/api/auth/register", rateLimit("auth"), async (req, res) => {
    try {
        const username = normalizeUsername(req.body?.username);
        const accountId = normalizeAccountId(req.body?.accountId);
        const password = typeof req.body?.password === "string" ? req.body.password : "";

        if (!validUsername(username) || !validAccountId(accountId) || password.length < 8) {
            return res.status(400).json({ error: "Use a valid username, Account ID and a password of at least 8 characters." });
        }

        const data = loadNetworkData();
        if (data.users[username]) {
            return res.status(409).json({ error: "That username already exists. Please choose another username." });
        }
        const owner = findAccountIdOwner(data, accountId);
        if (owner) {
            return res.status(409).json({ error: "That Account ID is already taken." });
        }

        const credentials = await hashPassword(password);
        data.users[username] = {
            username,
            accountId,
            createdAt: new Date().toISOString(),
            passwordSalt: credentials.salt,
            passwordHash: credentials.hash
        };
        saveNetworkData(data);

        const token = createSession(username);
        setSessionCookie(res, token);
        res.status(201).json({ ok: true, user: sanitizePublicUser(data.users[username]) });
    } catch (error) {
        console.error("Registration failed:", error.message);
        res.status(500).json({ error: "Unable to create the account right now." });
    }
});

app.post("/api/auth/login", rateLimit("auth"), async (req, res) => {
    try {
        const username = normalizeUsername(req.body?.username);
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        if (!validUsername(username) || !password) {
            return res.status(400).json({ error: "Enter a valid username and password." });
        }

        const data = loadNetworkData();
        const user = getUserRecord(data, username);

        if (!user || !user.passwordHash || !user.passwordSalt) {
            return res.status(401).json({ error: "Invalid username or password. Existing prototype accounts must be securely re-created." });
        }

        const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
        if (!valid) return res.status(401).json({ error: "Invalid username or password." });

        const token = createSession(username);
        setSessionCookie(res, token);
        res.json({ ok: true, user: sanitizePublicUser(user) });
    } catch (error) {
        console.error("Login failed:", error.message);
        res.status(500).json({ error: "Unable to log in right now." });
    }
});

app.get("/api/auth/session", (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ authenticated: false });
    const data = loadNetworkData();
    const user = getUserRecord(data, session.username);
    if (!user) {
        sessions.delete(session.token);
        clearSessionCookie(res);
        return res.status(401).json({ authenticated: false });
    }
    res.json({ authenticated: true, user: sanitizePublicUser(user) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
    sessions.delete(req.sessionToken);
    clearSessionCookie(res);
    res.json({ ok: true });
});

app.post("/api/network/sync", requireAuth, rateLimit("network"), (req, res) => {
    const currentUsername = req.user;
    const username = normalizeUsername(req.body?.username) || currentUsername;
    const previousUsername = normalizeUsername(req.body?.previousUsername) || currentUsername;

    if (previousUsername !== currentUsername) {
        return res.status(403).json({ error: "You can only change your own username." });
    }
    const requestedAccountId = normalizeAccountId(req.body?.accountId);

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }

    if (requestedAccountId && !validAccountId(requestedAccountId)) {
        return res.status(400).json({
            error: "Account ID must be 3–32 characters using only letters, numbers, dots, underscores or hyphens."
        });
    }

    const data = loadNetworkData();

    if (previousUsername && previousUsername !== username) {
        if (!validUsername(previousUsername)) {
            return res.status(400).json({ error: "Invalid previous username." });
        }

        try {
            migrateUsername(data, previousUsername, username);
        } catch (error) {
            return res.status(409).json({ error: error.message });
        }
    }

    const existingUser = data.users[username];

    if (!existingUser) {
        const owner = requestedAccountId
            ? findAccountIdOwner(data, requestedAccountId)
            : null;

        if (owner && owner !== username) {
            return res.status(409).json({ error: "That Account ID is already taken." });
        }

        data.users[username] = {
            username,
            accountId: requestedAccountId || createFallbackAccountId(data),
            createdAt: new Date().toISOString()
        };
    } else if (requestedAccountId && normalizeAccountId(existingUser.accountId) !== requestedAccountId) {
        const owner = findAccountIdOwner(data, requestedAccountId);

        if (owner && owner !== username) {
            return res.status(409).json({ error: "That Account ID is already taken." });
        }

        existingUser.accountId = requestedAccountId;
    } else if (!existingUser.accountId) {
        existingUser.accountId = createFallbackAccountId(data);
    }

    saveNetworkData(data);

    res.json({
        ok: true,
        username,
        accountId: data.users[username].accountId,
        ...networkState(username)
    });
});

app.post("/api/network/account-id", requireAuth, rateLimit("network"), (req, res) => {
    const username = req.user;
    const accountId = normalizeAccountId(req.body?.accountId);

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }

    if (!validAccountId(accountId)) {
        return res.status(400).json({
            error: "Account ID must be 3–32 characters using only letters, numbers, dots, underscores or hyphens."
        });
    }

    const data = loadNetworkData();
    const account = data.users[username];

    if (!account) {
        return res.status(404).json({ error: "Helix account was not found on the server." });
    }

    const owner = findAccountIdOwner(data, accountId);
    if (owner && owner !== username) {
        return res.status(409).json({ error: "That Account ID is already taken." });
    }

    account.accountId = accountId;
    saveNetworkData(data);

    res.json({
        ok: true,
        username,
        accountId: account.accountId
    });
});

app.get("/api/network/search", requireAuth, rateLimit("network"), (req, res) => {
    const username = req.user;
    const query = normalizeUsername(req.query.q).slice(0, MAX_SEARCH_LENGTH).toLowerCase();

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }

    const data = loadNetworkData();
    const state = networkState(username);
    const blockedNames = new Set([
        username,
        ...state.friends,
        ...state.incoming.map((item) => item.from),
        ...state.outgoing.map((item) => item.to)
    ]);

    const results = Object.keys(data.users)
        .filter((name) => !blockedNames.has(name))
        .filter((name) => !query || name.toLowerCase().includes(query))
        .slice(0, 20);

    res.json({ results });
});

app.get("/api/network/state", requireAuth, rateLimit("network"), (req, res) => {
    const username = req.user;
    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }
    res.json(networkState(username));
});

app.post("/api/network/request", requireAuth, rateLimit("network"), (req, res) => {
    const from = req.user;
    const to = normalizeUsername(req.body?.to);

    if (!validUsername(from) || !validUsername(to) || from === to) {
        return res.status(400).json({ error: "Invalid friend request." });
    }

    const data = loadNetworkData();
    if (!data.users[from] || !data.users[to]) {
        return res.status(404).json({ error: "User not found on the Helix network yet." });
    }

    if (data.friends.some((friend) => samePair(friend.a, friend.b, from, to))) {
        return res.status(409).json({ error: "You are already friends." });
    }

    const existing = data.requests.find((request) =>
        request.status === "pending" &&
        samePair(request.from, request.to, from, to)
    );

    if (existing) {
        return res.status(409).json({ error: "A friend request is already pending." });
    }

    const request = {
        id: require("crypto").randomUUID(),
        from,
        to,
        status: "pending",
        createdAt: new Date().toISOString()
    };

    data.requests.push(request);
    saveNetworkData(data);
    res.status(201).json({ ok: true, request });
});

app.delete("/api/network/request/:id", requireAuth, rateLimit("network"), (req, res) => {
    const username = req.user;
    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }

    const data = loadNetworkData();
    const request = data.requests.find((item) =>
        item.id === req.params.id &&
        item.from === username &&
        item.status === "pending"
    );

    if (!request) {
        return res.status(404).json({ error: "Pending outgoing request not found." });
    }

    request.status = "cancelled";
    saveNetworkData(data);
    res.json({ ok: true, ...networkState(username) });
});

app.post("/api/network/request/:id/respond", requireAuth, rateLimit("network"), (req, res) => {
    const username = req.user;
    const action = req.body?.action;

    if (!validUsername(username) || !["accept", "decline"].includes(action)) {
        return res.status(400).json({ error: "Invalid request response." });
    }

    const data = loadNetworkData();
    const request = data.requests.find((item) =>
        item.id === req.params.id &&
        item.to === username &&
        item.status === "pending"
    );

    if (!request) {
        return res.status(404).json({ error: "Friend request not found." });
    }

    request.status = action === "accept" ? "accepted" : "declined";

    if (action === "accept" && !data.friends.some((friend) =>
        samePair(friend.a, friend.b, request.from, request.to)
    )) {
        data.friends.push({
            a: request.from,
            b: request.to,
            createdAt: new Date().toISOString()
        });
    }

    saveNetworkData(data);
    res.json({ ok: true, ...networkState(username) });
});

app.delete("/api/network/friend", requireAuth, rateLimit("network"), (req, res) => {
    const username = req.user;
    const friend = normalizeUsername(req.body?.friend);

    if (!validUsername(username) || !validUsername(friend)) {
        return res.status(400).json({ error: "Invalid friend." });
    }

    const data = loadNetworkData();
    data.friends = data.friends.filter((item) => !samePair(item.a, item.b, username, friend));
    saveNetworkData(data);
    res.json({ ok: true, ...networkState(username) });
});

function buildConversationInput(history, message) {
    const validHistory = Array.isArray(history)
        ? history.filter((item) => (
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string" &&
            item.content.trim()
        )).map((item) => ({
            role: item.role,
            content: item.content.trim().slice(0, MAX_CHAT_CONTENT_LENGTH)
        }))
        : [];

    const recentHistory = validHistory.slice(-MAX_HISTORY_MESSAGES);
    const lastMessage = recentHistory[recentHistory.length - 1];

    if (message && (!lastMessage || lastMessage.role !== "user" || lastMessage.content !== message)) {
        recentHistory.push({ role: "user", content: message });
    }

    return recentHistory.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({
        role,
        content
    }));
}

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        aiConfigured: Boolean(process.env.OPENAI_API_KEY),
        model: MODEL
    });
});

app.post("/api/chat", requireAuth, rateLimit("chat"), async (req, res) => {
    try {
        const message = typeof req.body.message === "string" ? req.body.message.trim().slice(0, MAX_CHAT_CONTENT_LENGTH) : "";
        const input = buildConversationInput(req.body.history, message);

        if (!input.length) {
            return res.status(400).json({
                error: "Please enter a message for Helix AI."
            });
        }

        if (!process.env.OPENAI_API_KEY || !client) {
            return res.status(503).json({
                error: "Helix AI is not configured on this server."
            });
        }

        const response = await client.responses.create({
            model: MODEL,
            instructions: HELIX_AI_INSTRUCTIONS,
            input
        });

        res.json({
            reply: response.output_text || "Helix AI returned an empty response."
        });
    } catch (error) {
        console.error("Helix AI request failed:", error);

        const status = error.status === 429 ? 429 : 500;
        res.status(status).json({
            error: status === 429
                ? "Helix AI is rate-limited right now. Please try again shortly."
                : "Helix AI failed to respond. Please try again shortly."
        });
    }
});

app.get("/api", (req, res) => {
    res.json({ name: "Helix", status: "online" });
});

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API route not found." });
    }

    if (req.path === "/" || req.path === "/index.html") {
        return res.sendFile(path.join(__dirname, "index.html"));
    }

    if (req.path === "/app.html") {
        return res.sendFile(path.join(__dirname, "app.html"));
    }

    return res.status(404).end();
});

app.use((error, req, res, next) => {
    if (error?.type === "entity.too.large" || error?.status === 413) {
        return res.status(413).json({ error: "Request body is too large." });
    }

    console.error("Unhandled server error:", error?.message || error);
    if (res.headersSent) return next(error);

    res.status(500).json({ error: "Helix server encountered an unexpected error." });
});

app.listen(PORT, () => {
    console.log(`Helix server running at http://localhost:${PORT}`);
});