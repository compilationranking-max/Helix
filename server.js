require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
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

if (!GEMINI_API_KEY) {
    console.warn("WARNING: Gemini API key is not configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY) on the server.");
}

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
        const users = parsed.users && typeof parsed.users === "object" ? parsed.users : {};

        Object.values(users).forEach((user) => {
            if (user && typeof user === "object") {
                delete user.accountId;
                if (!user.displayName) user.displayName = user.username;
            }
        });

        return {
            users,
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

function normalizeDisplayName(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function validDisplayName(value) {
    return value.length >= 1 && value.length <= 50 && !/[\u0000-\u001F\u007F]/.test(value);
}

function publicUser(data, username) {
    const user = data.users[username];
    return {
        username,
        displayName: user?.displayName || username
    };
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
        .map((friend) => publicUser(data, friend.a === username ? friend.b : friend.a));

    const incoming = data.requests
        .filter((request) => request.to === username && request.status === "pending")
        .map((request) => ({
            id: request.id,
            from: request.from,
            fromDisplayName: data.users[request.from]?.displayName || request.from,
            createdAt: request.createdAt
        }));

    const outgoing = data.requests
        .filter((request) => request.from === username && request.status === "pending")
        .map((request) => ({
            id: request.id,
            to: request.to,
            toDisplayName: data.users[request.to]?.displayName || request.to,
            createdAt: request.createdAt
        }));

    return { friends, incoming, outgoing };
}

app.post("/api/network/sync", (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const displayName = normalizeDisplayName(req.body?.displayName);

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }

    const data = loadNetworkData();

    if (!data.users[username]) {
        data.users[username] = {
            username,
            displayName: validDisplayName(displayName) ? displayName : username,
            createdAt: new Date().toISOString()
        };
    } else {
        data.users[username].username = username;

        if (displayName) {
            if (!validDisplayName(displayName)) {
                return res.status(400).json({ error: "Display name must be 1–50 characters." });
            }
            data.users[username].displayName = displayName;
        } else if (!data.users[username].displayName) {
            data.users[username].displayName = username;
        }
    }

    delete data.users[username].accountId;
    saveNetworkData(data);

    res.json({
        ok: true,
        username,
        displayName: data.users[username].displayName,
        ...networkState(username)
    });
});

app.post("/api/profile/display-name", (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const displayName = normalizeDisplayName(req.body?.displayName);

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }

    if (!validDisplayName(displayName)) {
        return res.status(400).json({ error: "Display name must be 1–50 characters." });
    }

    const data = loadNetworkData();
    const user = data.users[username];

    if (!user) {
        return res.status(404).json({ error: "Helix account was not found." });
    }

    user.displayName = displayName;
    saveNetworkData(data);

    res.json({ ok: true, user: publicUser(data, username) });
});


app.get("/api/network/search", (req, res) => {
    const username = normalizeUsername(req.query.username);
    const query = normalizeUsername(req.query.q).slice(0, 64).toLowerCase();

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }

    const data = loadNetworkData();
    const state = networkState(username);

    const blockedNames = new Set([
        username,
        ...state.friends.map((user) => typeof user === "string" ? user : user.username),
        ...state.incoming.map((item) => item.from),
        ...state.outgoing.map((item) => item.to)
    ]);

    const results = Object.values(data.users)
        .filter((user) => user && validUsername(user.username))
        .filter((user) => !blockedNames.has(user.username))
        .filter((user) =>
            !query ||
            user.username.toLowerCase().includes(query) ||
            String(user.displayName || user.username).toLowerCase().includes(query)
        )
        .slice(0, 20)
        .map((user) => publicUser(data, user.username));

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
        role: role === "assistant" ? "model" : "user",
        parts: [{ text: content }]
    }));
}

async function generateGeminiResponse(contents) {
    if (!GEMINI_API_KEY) {
        const error = new Error("Gemini API key is not configured.");
        error.status = 503;
        throw error;
    }

    const ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: {
            timeout: 30000
        }
    });

    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents,
            config: {
                systemInstruction: HELIX_AI_INSTRUCTIONS,
                maxOutputTokens: 512
            }
        });

        const reply = typeof response?.text === "string"
            ? response.text.trim()
            : "";

        if (!reply) {
            const error = new Error("Gemini returned no usable text.");
            error.status = 502;
            throw error;
        }

        return reply;
    } catch (error) {
        const wrapped = new Error(error?.message || "Gemini request failed.");
        wrapped.status = Number(error?.status || error?.code || 500);
        wrapped.cause = error;
        throw wrapped;
    }
}

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        aiConfigured: Boolean(GEMINI_API_KEY),
        provider: "gemini",
        model: MODEL
    });
});

app.post("/api/chat", async (req, res) => {
    try {
        const message = typeof req.body.message === "string"
            ? req.body.message.trim()
            : "";

        if (!message) {
            return res.status(400).json({
                error: "Please enter a message for Helix AI."
            });
        }

        const input = buildConversationInput(req.body.history, message);

        if (!input.length) {
            return res.status(400).json({
                error: "Please enter a message for Helix AI."
            });
        }

        const reply = await generateGeminiResponse(input);
        res.json({ reply });
    } catch (error) {
        console.error("Helix AI request failed:", error);
        const status = Number(error?.status || 502);

        if (status === 401 || status === 403) {
            return res.status(status).json({
                error: "Gemini rejected the API key. Check GEMINI_API_KEY in Render."
            });
        }

        if (status === 429) {
            return res.status(429).json({
                error: "Gemini quota or rate limit reached. Check Gemini API usage/limits."
            });
        }

        if (status === 400) {
            return res.status(400).json({
                error: "Gemini rejected the request. The server is reaching Gemini, but the request/model configuration was not accepted."
            });
        }

        if (status === 404) {
            return res.status(404).json({
                error: "Gemini could not find the configured model. Check GEMINI_MODEL in Render."
            });
        }

        if (status === 503 || status === 504) {
            return res.status(503).json({
                error: "Gemini is temporarily unavailable. Please try again shortly."
            });
        }

        console.error("Gemini detail:", error?.message || "Unknown error");
        return res.status(502).json({
            error: "Helix could not get a response from Gemini. Check the Render logs for details."
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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Helix server running at http://localhost:${PORT}`);
});