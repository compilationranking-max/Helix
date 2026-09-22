require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.HELIX_AI_MODEL || "gpt-5.6-sol";
const MAX_HISTORY_MESSAGES = 20;

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

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

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

app.post("/api/network/sync", (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const previousUsername = normalizeUsername(req.body?.previousUsername);
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

app.post("/api/network/account-id", (req, res) => {
    const username = normalizeUsername(req.body?.username);
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

app.get("/api/network/search", (req, res) => {
    const username = normalizeUsername(req.query.username);
    const query = normalizeUsername(req.query.q).toLowerCase();

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

app.get("/api/network/state", (req, res) => {
    const username = normalizeUsername(req.query.username);
    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }
    res.json(networkState(username));
});

app.post("/api/network/request", (req, res) => {
    const from = normalizeUsername(req.body?.from);
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

app.delete("/api/network/request/:id", (req, res) => {
    const username = normalizeUsername(req.body?.username);
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

app.post("/api/network/request/:id/respond", (req, res) => {
    const username = normalizeUsername(req.body?.username);
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

app.delete("/api/network/friend", (req, res) => {
    const username = normalizeUsername(req.body?.username);
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
        ))
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

app.post("/api/chat", async (req, res) => {
    try {
        const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
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
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Helix server running at http://localhost:${PORT}`);
});