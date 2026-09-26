require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { Pool } = require("pg");

const scryptAsync = promisify(crypto.scrypt);
const DATABASE_URL = process.env.DATABASE_URL || "";
const dbPool = DATABASE_URL
    ? new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes("sslmode=require")
            ? { rejectUnauthorized: false }
            : false,
        max: 5,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
    })
    : null;

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_HISTORY_MESSAGES = 20;
const DAILY_AI_IMAGE_LIMIT = 5;

const HELIX_AI_INSTRUCTIONS = `
You are HELIX AI, the built-in AI assistant of the Helix platform.

IDENTITY
- Your name is HELIX AI or Helix.
- Helix was created by Nithin and Hemanth. When asked who created, built, or made you, say that Nithin and Hemanth created Helix.
- Do not invent additional creators, founders, or backstory.
- Never introduce yourself as ChatGPT unless the user explicitly asks which underlying AI or model powers you.
- Do not say that you were created by OpenAI during normal introductions.
- You are not human and must not claim to be human.

PERSONALITY
- Maintain a futuristic, intelligent, technical personality suited to Helix's dark-terminal cyberpunk identity.
- Be helpful, natural, conversational, and reasonably concise.
- Understand context instead of blindly repeating the user's wording.
- Use recent conversation history to answer references and follow-up questions accurately.
- If the user says you are Helix AI, acknowledge it naturally rather than correcting them.
- Do not pretend to know something you do not know. State uncertainty briefly when needed.

TEACHING / CHAPTER EXPLANATIONS
You are also a lightweight study assistant. You are not expected to be as capable as specialized advanced tutoring systems, but you should still be able to explain school and introductory competitive-exam chapters clearly.

When a user asks you to explain a chapter or topic:
1. Start with the core idea in simple language.
2. Build from basic concepts before using harder formulas or terminology.
3. Break the chapter into logical subtopics instead of dumping everything at once.
4. Explain important definitions, laws, principles, and formulas and what each symbol means.
5. Give small worked examples when useful.
6. Point out common mistakes, traps, and when a formula should or should not be used.
7. When mathematics is involved, show the important steps rather than only giving the final result.
8. When physics or chemistry is involved, connect equations to physical/chemical meaning and units.
9. Adapt depth to the user's level and questions. If they ask for a simpler explanation, simplify it rather than repeating the same wording.
10. At the end of a chapter explanation, give a compact recap of the key ideas and formulas when appropriate.

When solving an academic problem:
- Explain the reasoning clearly and then give the answer.
- Preserve the user's notation when practical.
- Check units, signs, assumptions, and limiting cases when relevant.
- Do not fabricate facts, formulas, or textbook claims.

For long chapters, teach them in sections and continue from the user's last question rather than restarting the entire chapter each time.

FORMAT / RENDERING
- Use normal Markdown when it helps structure the answer: headings, bold text, italic text, bullets, and numbered steps.
- Write mathematical expressions using LaTeX delimiters such as \(F_{AB} = -F_{BA}\) for inline math or $F_{AB} = -F_{BA}$ for display math.
- Do not put normal explanations inside code blocks just to make them look formatted.
- Keep formulas readable and explain what they mean in words.

IMAGE UNDERSTANDING
- When the user provides an image, inspect it carefully and describe only what is actually visible.
- Read text, equations, diagrams, graphs, tables, screenshots, and other useful visual details when possible.
- When an uploaded image contains a school or competitive-exam question, explain the solution step by step and preserve the notation from the image when practical.
- When the user asks what is in an image, answer directly instead of asking them to re-upload it unless the image is genuinely unreadable.
- If part of an image is unclear, say exactly which part is unclear instead of inventing details.

`;

if (!GEMINI_API_KEY) {
    console.warn("WARNING: Gemini API key is not configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY) on the server.");
}

app.use(cors());
app.use(express.json({ limit: "16mb" }));
app.use(express.static(__dirname));

const networkDataDir = path.join(__dirname, "data");
const networkDataFile = path.join(networkDataDir, "helix-network.json");

let databaseReady;

async function initializeDatabase() {
    if (!dbPool) return;

    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS helix_users (
            username TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE helix_users
            ADD COLUMN IF NOT EXISTS profile_photo TEXT;

        ALTER TABLE helix_users
            ADD COLUMN IF NOT EXISTS email TEXT;

        ALTER TABLE helix_users
            ADD COLUMN IF NOT EXISTS phone TEXT;

        CREATE TABLE IF NOT EXISTS helix_user_settings (
            username TEXT PRIMARY KEY REFERENCES helix_users(username) ON DELETE CASCADE,
            privacy JSONB NOT NULL DEFAULT '{}'::jsonb,
            notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
            appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
            detox JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS helix_blocked_accounts (
            blocker_username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            blocked_username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (blocker_username, blocked_username),
            CHECK (blocker_username <> blocked_username)
        );

        CREATE TABLE IF NOT EXISTS helix_activity_log (
            id UUID PRIMARY KEY,
            username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            details JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS helix_activity_log_user_idx
            ON helix_activity_log (username, created_at DESC);

        CREATE TABLE IF NOT EXISTS helix_support_requests (
            id UUID PRIMARY KEY,
            username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            request_type TEXT NOT NULL,
            details JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS helix_support_requests_user_idx
            ON helix_support_requests (username, created_at DESC);

        CREATE UNIQUE INDEX IF NOT EXISTS helix_users_username_lower_idx
            ON helix_users (LOWER(username));

        CREATE TABLE IF NOT EXISTS helix_sessions (
            token_hash TEXT PRIMARY KEY,
            username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            expires_at TIMESTAMPTZ NOT NULL
        );

        CREATE INDEX IF NOT EXISTS helix_sessions_username_idx
            ON helix_sessions (username);

        CREATE TABLE IF NOT EXISTS helix_friendships (
            user_a TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            user_b TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_a, user_b),
            CHECK (user_a < user_b)
        );

        CREATE TABLE IF NOT EXISTS helix_friend_requests (
            id UUID PRIMARY KEY,
            from_username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            to_username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS helix_messages (
            id UUID PRIMARY KEY,
            sender_username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            recipient_username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            body TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            read_at TIMESTAMPTZ,
            media_data BYTEA,
            media_mime TEXT,
            media_name TEXT,
            media_size INTEGER,
            media_kind TEXT
        );

        ALTER TABLE helix_messages
            ADD COLUMN IF NOT EXISTS media_data BYTEA;
        ALTER TABLE helix_messages
            ADD COLUMN IF NOT EXISTS media_mime TEXT;
        ALTER TABLE helix_messages
            ADD COLUMN IF NOT EXISTS media_name TEXT;
        ALTER TABLE helix_messages
            ADD COLUMN IF NOT EXISTS media_size INTEGER;
        ALTER TABLE helix_messages
            ADD COLUMN IF NOT EXISTS media_kind TEXT;
        ALTER TABLE helix_messages
            ALTER COLUMN body SET DEFAULT '';

        ALTER TABLE helix_messages
            DROP CONSTRAINT IF EXISTS helix_messages_body_check;
        ALTER TABLE helix_messages
            ADD CONSTRAINT helix_messages_body_check CHECK (
                char_length(body) BETWEEN 0 AND 4000
                AND (char_length(body) > 0 OR media_data IS NOT NULL)
            );
        ALTER TABLE helix_messages
            DROP CONSTRAINT IF EXISTS helix_messages_media_size_check;
        ALTER TABLE helix_messages
            ADD CONSTRAINT helix_messages_media_size_check
            CHECK (media_size IS NULL OR (media_size > 0 AND media_size <= 10485760));

        CREATE INDEX IF NOT EXISTS helix_messages_conversation_idx
            ON helix_messages (sender_username, recipient_username, created_at);


        CREATE INDEX IF NOT EXISTS helix_friend_requests_to_idx
            ON helix_friend_requests (to_username, status);
        CREATE INDEX IF NOT EXISTS helix_friend_requests_from_idx
            ON helix_friend_requests (from_username, status);

        CREATE TABLE IF NOT EXISTS helix_ai_image_usage (
            username TEXT NOT NULL REFERENCES helix_users(username) ON DELETE CASCADE,
            usage_date DATE NOT NULL,
            upload_count INTEGER NOT NULL DEFAULT 0 CHECK (upload_count >= 0),
            PRIMARY KEY (username, usage_date)
        );
    `);
}

databaseReady = initializeDatabase().catch((error) => {
    console.error("Helix database initialization failed:", error.message);
    throw error;
});

async function requireDatabase() {
    if (!dbPool) throw Object.assign(new Error("DATABASE_URL is not configured."), { status: 503 });
    await databaseReady;
}

function hashSessionToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookies(req) {
    const header = req.headers.cookie || "";
    return Object.fromEntries(header.split(";").map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return ["", ""];
        return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
    }).filter(([key]) => key));
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
    const parts = [
        `helix_session=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=2592000"
    ];
    if (secure) parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", "helix_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derived = await scryptAsync(password, salt, 64);
    return { salt: salt.toString("hex"), hash: Buffer.from(derived).toString("hex") };
}

async function verifyPassword(password, saltHex, hashHex) {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = Buffer.from(await scryptAsync(password, salt, expected.length));
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function publicProfilePhotoUrl(username) {
    return validUsername(username)
        ? `/api/users/${encodeURIComponent(username)}/photo`
        : null;
}

async function currentUser(req) {
    if (!dbPool) return null;
    await requireDatabase();
    const token = parseCookies(req).helix_session;
    if (!token) return null;

    const result = await dbPool.query(`
        SELECT u.username, u.display_name, u.created_at, u.profile_photo, u.email, u.phone
        FROM helix_sessions s
        JOIN helix_users u ON u.username = s.username
        WHERE s.token_hash = $1 AND s.expires_at > NOW()
    `, [hashSessionToken(token)]);

    const row = result.rows[0];
    if (!row) return null;
    return {
        username: row.username,
        displayName: row.display_name,
        createdAt: row.created_at,
        profilePhoto: publicProfilePhotoUrl(row.username) || null,
        email: row.email || null,
        phone: row.phone || null
    };
}

async function requireCurrentUser(req, res) {
    const user = await currentUser(req);
    if (!user) {
        res.status(401).json({ error: "Please log in to Helix." });
        return null;
    }
    return user;
}

async function publicUserFromDb(username) {
    const result = await dbPool.query(
        "SELECT username, display_name, created_at, profile_photo FROM helix_users WHERE username = $1",
        [username]
    );
    const row = result.rows[0];
    return row
        ? {
            username: row.username,
            displayName: row.display_name,
            createdAt: row.created_at,
            profilePhoto: publicProfilePhotoUrl(row.username) || null
        }
        : null;
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
        displayName: user?.displayName || username,
        profilePhoto: user?.profilePhoto ? publicProfilePhotoUrl(username) : null
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

app.post("/api/auth/register", async (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const displayName = normalizeDisplayName(req.body?.displayName);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Username must be 3–32 characters using letters, numbers, dots, underscores or hyphens." });
    }
    if (!validDisplayName(displayName)) {
        return res.status(400).json({ error: "Display name must be 1–50 characters." });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    try {
        if (dbPool) {
            await requireDatabase();
            const credentials = await hashPassword(password);
            const result = await dbPool.query(`
                INSERT INTO helix_users (username, display_name, password_hash, password_salt)
                VALUES ($1, $2, $3, $4)
                RETURNING username, display_name, created_at, profile_photo
            `, [username, displayName, credentials.hash, credentials.salt]);

            const token = crypto.randomBytes(32).toString("hex");
            await dbPool.query(
                "INSERT INTO helix_sessions (token_hash, username, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
                [hashSessionToken(token), username]
            );
            setSessionCookie(res, token);
            return res.status(201).json({
                ok: true,
                user: {
                    username: result.rows[0].username,
                    displayName: result.rows[0].display_name,
                    createdAt: result.rows[0].created_at,
                    profilePhoto: publicProfilePhotoUrl(result.rows[0].username) || null,
                    email: result.rows[0].email || null,
                    phone: result.rows[0].phone || null
                }
            });
        }

        // Local development fallback when no DATABASE_URL exists.
        const data = loadNetworkData();
        if (data.users[username]) return res.status(409).json({ error: "That username already exists." });
        const credentials = await hashPassword(password);
        data.users[username] = {
            username,
            displayName,
            passwordHash: credentials.hash,
            passwordSalt: credentials.salt,
            createdAt: new Date().toISOString(),
            profilePhoto: null,
            email: null,
            phone: null
        };
        saveNetworkData(data);
        return res.status(201).json({ ok: true, user: publicUser(data, username) });
    } catch (error) {
        if (error?.code === "23505") return res.status(409).json({ error: "That username already exists. Please choose another username." });
        console.error("Registration failed:", error);
        return res.status(500).json({ error: "Could not create your Helix account." });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    try {
        if (dbPool) {
            await requireDatabase();
            const result = await dbPool.query(
                "SELECT username, display_name, password_hash, password_salt, created_at, profile_photo, email, phone FROM helix_users WHERE username = $1",
                [username]
            );
            const user = result.rows[0];
            if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
                return res.status(401).json({ error: "Incorrect username or password." });
            }

            const token = crypto.randomBytes(32).toString("hex");
            await dbPool.query("DELETE FROM helix_sessions WHERE expires_at <= NOW() OR username = $1", [username]);
            await dbPool.query(
                "INSERT INTO helix_sessions (token_hash, username, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
                [hashSessionToken(token), username]
            );
            setSessionCookie(res, token);
            await logActivity(username, "account.logged_in");
            return res.json({
                ok: true,
                user: {
                    username: user.username,
                    displayName: user.display_name,
                    createdAt: user.created_at,
                    profilePhoto: publicProfilePhotoUrl(user.username) || null,
                    email: user.email || null,
                    phone: user.phone || null
                }
            });
        }

        const data = loadNetworkData();
        const user = data.users[username];
        if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
            return res.status(401).json({ error: "Incorrect username or password." });
        }
        return res.json({ ok: true, user: publicUser(data, username) });
    } catch (error) {
        console.error("Login failed:", error);
        return res.status(500).json({ error: "Could not log in to Helix right now." });
    }
});

app.get("/api/auth/me", async (req, res) => {
    try {
        if (dbPool) {
            const user = await currentUser(req);
            if (!user) return res.status(401).json({ error: "Not logged in." });
            return res.json({ ok: true, user });
        }
        return res.status(401).json({ error: "Not logged in." });
    } catch (error) {
        return res.status(503).json({ error: "Helix account service is unavailable." });
    }
});

const SERVER_SETTING_DEFAULTS = {
    privacy: {
        "private-account": false,
        "friend-requests": "EVERYONE",
        "direct-messages": "EVERYONE",
        "mentions-tags": "EVERYONE",
        "activity-visibility": "VISIBLE"
    },
    notifications: {
        "dm-alerts": false,
        "friend-requests": false,
        "accepted-requests": false,
        likes: false,
        comments: false,
        mentions: false,
        follows: false,
        "system-announcements": false
    },
    appearance: {
        theme: "DARK",
        "accent-intensity": "HIGH",
        "compact-mode": false,
        "animation-intensity": "FULL",
        "reduced-motion": false,
        "layout-density": "COMFORTABLE"
    },
    detox: { mode: "off", minutes: 0 }
};

function cloneSettingDefaults() {
    return JSON.parse(JSON.stringify(SERVER_SETTING_DEFAULTS));
}

function mergeSettings(row) {
    const defaults = cloneSettingDefaults();
    return {
        privacy: { ...defaults.privacy, ...(row?.privacy || {}) },
        notifications: { ...defaults.notifications, ...(row?.notifications || {}) },
        appearance: { ...defaults.appearance, ...(row?.appearance || {}) },
        detox: { ...defaults.detox, ...(row?.detox || {}) }
    };
}

async function getUserSettings(username) {
    if (!dbPool) {
        const data = loadNetworkData();
        data.settings = data.settings || {};
        return mergeSettings(data.settings[username] || null);
    }

    await requireDatabase();
    const result = await dbPool.query(
        "SELECT privacy, notifications, appearance, detox FROM helix_user_settings WHERE username = $1",
        [username]
    );
    return mergeSettings(result.rows[0] || null);
}

async function saveUserSettingGroup(username, group, values) {
    const allowedGroups = new Set(["privacy", "notifications", "appearance", "detox"]);
    if (!allowedGroups.has(group)) {
        throw Object.assign(new Error("Invalid settings group."), { status: 400 });
    }

    const current = await getUserSettings(username);
    const next = {
        ...current,
        [group]: {
            ...current[group],
            ...(values && typeof values === "object" && !Array.isArray(values) ? values : {})
        }
    };

    if (!dbPool) {
        const data = loadNetworkData();
        data.settings = data.settings || {};
        data.settings[username] = next;
        saveNetworkData(data);
        return next;
    }

    await requireDatabase();
    await dbPool.query(
        "INSERT INTO helix_user_settings (username, privacy, notifications, appearance, detox, updated_at) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, NOW()) ON CONFLICT (username) DO UPDATE SET privacy = EXCLUDED.privacy, notifications = EXCLUDED.notifications, appearance = EXCLUDED.appearance, detox = EXCLUDED.detox, updated_at = NOW()",
        [username, JSON.stringify(next.privacy), JSON.stringify(next.notifications), JSON.stringify(next.appearance), JSON.stringify(next.detox)]
    );

    return next;
}

async function logActivity(username, eventType, details = {}) {
    try {
        if (dbPool) {
            await requireDatabase();
            await dbPool.query(
                "INSERT INTO helix_activity_log (id, username, event_type, details) VALUES ($1, $2, $3, $4::jsonb)",
                [crypto.randomUUID(), username, eventType, JSON.stringify(details || {})]
            );
            return;
        }

        const data = loadNetworkData();
        data.activity = data.activity || {};
        data.activity[username] = Array.isArray(data.activity[username]) ? data.activity[username] : [];
        data.activity[username].unshift({ id: crypto.randomUUID(), eventType, details: details || {}, createdAt: new Date().toISOString() });
        data.activity[username] = data.activity[username].slice(0, 200);
        saveNetworkData(data);
    } catch (error) {
        console.warn("Helix activity log failed:", error?.message || error);
    }
}
app.post("/api/auth/logout", async (req, res) => {
    try {
        if (dbPool) {
            const token = parseCookies(req).helix_session;
            if (token) await dbPool.query("DELETE FROM helix_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
        }
        clearSessionCookie(res);
        res.json({ ok: true });
    } catch (error) {
        clearSessionCookie(res);
        res.json({ ok: true });
    }
});

app.get("/api/settings", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    try {
        const settings = await getUserSettings(user.username);
        return res.json({ ok: true, settings });
    } catch (error) {
        console.error("Settings load failed:", error);
        return res.status(500).json({ error: "Could not load your settings." });
    }
});

app.patch("/api/settings/:group", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    try {
        const settings = await saveUserSettingGroup(user.username, req.params.group, req.body?.values);
        await logActivity(user.username, "settings.updated", { group: req.params.group });
        return res.json({ ok: true, settings });
    } catch (error) {
        console.error("Settings update failed:", error);
        return res.status(Number(error?.status || 500)).json({ error: error?.message || "Could not save your settings." });
    }
});

app.post("/api/profile/contact", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const type = req.body?.type;
    const value = typeof req.body?.value === "string" ? req.body.value.trim() : "";

    if (!["email", "phone"].includes(type)) return res.status(400).json({ error: "Invalid contact type." });
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return res.status(400).json({ error: "Enter a valid email address." });
    if (type === "phone" && value.replace(/\D/g, "").length < 7) return res.status(400).json({ error: "Enter a valid phone number." });

    try {
        if (dbPool) {
            await requireDatabase();
            const result = await dbPool.query(
                "UPDATE helix_users SET " + (type === "email" ? "email" : "phone") + " = $1 WHERE username = $2 RETURNING username, display_name, created_at, profile_photo, email, phone",
                [value, user.username]
            );
            await logActivity(user.username, "account.contact_updated", { type });
            return res.json({ ok: true, user: result.rows[0] });
        }

        const data = loadNetworkData();
        const localUser = data.users[user.username];
        if (!localUser) return res.status(404).json({ error: "Helix account was not found." });
        localUser[type] = value;
        saveNetworkData(data);
        await logActivity(user.username, "account.contact_updated", { type });
        return res.json({ ok: true, user: publicUser(data, user.username) });
    } catch (error) {
        console.error("Contact update failed:", error);
        return res.status(500).json({ error: "Could not update your contact information." });
    }
});

app.post("/api/profile/password", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });

    try {
        if (!dbPool) return res.status(503).json({ error: "Password changes require the cloud database." });
        await requireDatabase();
        const result = await dbPool.query("SELECT password_hash, password_salt FROM helix_users WHERE username = $1", [user.username]);
        const row = result.rows[0];
        if (!row || !(await verifyPassword(currentPassword, row.password_salt, row.password_hash))) return res.status(401).json({ error: "Current password is incorrect." });

        const credentials = await hashPassword(newPassword);
        await dbPool.query("UPDATE helix_users SET password_hash = $1, password_salt = $2 WHERE username = $3", [credentials.hash, credentials.salt, user.username]);
        await dbPool.query("DELETE FROM helix_sessions WHERE username = $1", [user.username]);
        await logActivity(user.username, "account.password_changed");
        clearSessionCookie(res);
        return res.json({ ok: true, requiresLogin: true });
    } catch (error) {
        console.error("Password change failed:", error);
        return res.status(500).json({ error: "Could not change your password." });
    }
});

app.post("/api/auth/logout-all", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    try {
        if (dbPool) {
            await requireDatabase();
            await dbPool.query("DELETE FROM helix_sessions WHERE username = $1", [user.username]);
        }
        await logActivity(user.username, "account.logged_out_all_sessions");
        clearSessionCookie(res);
        return res.json({ ok: true });
    } catch (error) {
        console.error("Logout all failed:", error);
        return res.status(500).json({ error: "Could not end all sessions." });
    }
});

app.get("/api/blocked", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    try {
        if (!dbPool) return res.json({ ok: true, blocked: [] });
        await requireDatabase();
        const result = await dbPool.query(
            `SELECT b.blocked_username AS "username", COALESCE(u.display_name, b.blocked_username) AS "displayName", b.created_at AS "createdAt"
             FROM helix_blocked_accounts b
             LEFT JOIN helix_users u ON u.username = b.blocked_username
             WHERE b.blocker_username = $1 ORDER BY b.created_at DESC`,
            [user.username]
        );
        return res.json({ ok: true, blocked: result.rows });
    } catch (error) {
        console.error("Blocked list failed:", error);
        return res.status(500).json({ error: "Could not load blocked accounts." });
    }
});

app.post("/api/blocked", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const blockedUsername = normalizeUsername(req.body?.username);
    if (!validUsername(blockedUsername) || blockedUsername === user.username) return res.status(400).json({ error: "Invalid account." });
    try {
        if (!dbPool) return res.status(503).json({ error: "Blocking requires the cloud database." });
        await requireDatabase();
        const target = await dbPool.query("SELECT username FROM helix_users WHERE username = $1", [blockedUsername]);
        if (!target.rowCount) return res.status(404).json({ error: "That account does not exist." });
        await dbPool.query("INSERT INTO helix_blocked_accounts (blocker_username, blocked_username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.username, blockedUsername]);
        await dbPool.query("DELETE FROM helix_friendships WHERE user_a = LEAST($1,$2) AND user_b = GREATEST($1,$2)", [user.username, blockedUsername]);
        await dbPool.query("DELETE FROM helix_friend_requests WHERE (from_username = $1 AND to_username = $2) OR (from_username = $2 AND to_username = $1)", [user.username, blockedUsername]);
        await logActivity(user.username, "account.blocked", { username: blockedUsername });
        return res.json({ ok: true });
    } catch (error) {
        console.error("Block failed:", error);
        return res.status(500).json({ error: "Could not block that account." });
    }
});

app.delete("/api/blocked/:username", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const blockedUsername = normalizeUsername(req.params.username);
    try {
        if (!dbPool) return res.status(503).json({ error: "Unblocking requires the cloud database." });
        await requireDatabase();
        await dbPool.query("DELETE FROM helix_blocked_accounts WHERE blocker_username = $1 AND blocked_username = $2", [user.username, blockedUsername]);
        await logActivity(user.username, "account.unblocked", { username: blockedUsername });
        return res.json({ ok: true });
    } catch (error) {
        console.error("Unblock failed:", error);
        return res.status(500).json({ error: "Could not unblock that account." });
    }
});

app.get("/api/activity", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    try {
        if (!dbPool) return res.json({ ok: true, activity: [] });
        await requireDatabase();
        const result = await dbPool.query(
            `SELECT id, event_type AS "eventType", details, created_at AS "createdAt"
             FROM helix_activity_log WHERE username = $1 ORDER BY created_at DESC LIMIT 100`,
            [user.username]
        );
        return res.json({ ok: true, activity: result.rows });
    } catch (error) {
        console.error("Activity load failed:", error);
        return res.status(500).json({ error: "Could not load account activity." });
    }
});

app.post("/api/support", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const type = typeof req.body?.type === "string" ? req.body.type.trim().slice(0, 40) : "support";
    const details = req.body?.details && typeof req.body.details === "object" ? req.body.details : {};
    try {
        if (!dbPool) return res.status(503).json({ error: "Support submissions require the cloud database." });
        await requireDatabase();
        await dbPool.query("INSERT INTO helix_support_requests (id, username, request_type, details) VALUES ($1, $2, $3, $4::jsonb)", [crypto.randomUUID(), user.username, type, JSON.stringify(details)]);
        await logActivity(user.username, "support.requested", { type });
        return res.json({ ok: true });
    } catch (error) {
        console.error("Support submission failed:", error);
        return res.status(500).json({ error: "Could not send your support request." });
    }
});

app.get("/api/account/export", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    try {
        if (!dbPool) return res.status(503).json({ error: "Account export requires the cloud database." });
        await requireDatabase();
        const profile = await dbPool.query("SELECT username, display_name AS \"displayName\", created_at AS \"createdAt\", email, phone, profile_photo IS NOT NULL AS \"hasProfilePhoto\" FROM helix_users WHERE username = $1", [user.username]);
        const friends = await dbPool.query("SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS username, created_at AS \"createdAt\" FROM helix_friendships WHERE user_a = $1 OR user_b = $1", [user.username]);
        const blocked = await dbPool.query("SELECT blocked_username AS username, created_at AS \"createdAt\" FROM helix_blocked_accounts WHERE blocker_username = $1", [user.username]);
        const activity = await dbPool.query("SELECT event_type AS \"eventType\", details, created_at AS \"createdAt\" FROM helix_activity_log WHERE username = $1 ORDER BY created_at DESC LIMIT 500", [user.username]);
        const settings = await getUserSettings(user.username);
        return res.json({ ok: true, exportedAt: new Date().toISOString(), account: profile.rows[0] || null, friends: friends.rows, blocked: blocked.rows, activity: activity.rows, settings });
    } catch (error) {
        console.error("Account export failed:", error);
        return res.status(500).json({ error: "Could not export your account data." });
    }
});

app.delete("/api/account", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    try {
        if (!dbPool) return res.status(503).json({ error: "Account deletion requires the cloud database." });
        await requireDatabase();
        const result = await dbPool.query("SELECT password_hash, password_salt FROM helix_users WHERE username = $1", [user.username]);
        const row = result.rows[0];
        if (!row || !(await verifyPassword(password, row.password_salt, row.password_hash))) return res.status(401).json({ error: "Password is incorrect." });
        await dbPool.query("DELETE FROM helix_users WHERE username = $1", [user.username]);
        clearSessionCookie(res);
        return res.json({ ok: true });
    } catch (error) {
        console.error("Account deletion failed:", error);
        return res.status(500).json({ error: "Could not delete your account." });
    }
});
app.post("/api/profile/display-name", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const displayName = normalizeDisplayName(req.body?.displayName);

    if (!validDisplayName(displayName)) {
        return res.status(400).json({ error: "Display name must be 1–50 characters." });
    }

    try {
        if (dbPool) {
            await requireDatabase();
            const result = await dbPool.query(
                "UPDATE helix_users SET display_name = $1 WHERE username = $2 RETURNING username, display_name, created_at, profile_photo, email, phone",
                [displayName, user.username]
            );
            await logActivity(user.username, "account.display_name_updated");
            return res.json({
                ok: true,
                user: { username: result.rows[0].username, displayName: result.rows[0].display_name, createdAt: result.rows[0].created_at, email: result.rows[0].email || null, phone: result.rows[0].phone || null, profilePhoto: publicProfilePhotoUrl(result.rows[0].username) || null }
            });
        }

        const data = loadNetworkData();
        if (!data.users[user.username]) return res.status(404).json({ error: "Helix account was not found." });
        data.users[user.username].displayName = displayName;
        saveNetworkData(data);
        return res.json({ ok: true, user: publicUser(data, user.username) });
    } catch (error) {
        console.error("Display name update failed:", error);
        return res.status(500).json({ error: "Could not update your display name." });
    }
});

async function getCloudNetworkState(username) {
    const friendsResult = await dbPool.query(`
        SELECT
            u.username,
            u.display_name AS "displayName",
            COALESCE((
                SELECT COUNT(*)::int
                FROM helix_messages m
                WHERE m.sender_username = u.username
                  AND m.recipient_username = $1
                  AND m.read_at IS NULL
            ), 0) AS "unreadCount"
        FROM helix_friendships f
        JOIN helix_users u ON u.username = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
        WHERE f.user_a = $1 OR f.user_b = $1
        ORDER BY LOWER(u.display_name), LOWER(u.username)
    `, [username]);

    const incomingResult = await dbPool.query(`
        SELECT r.id, r.from_username AS "from", u.display_name AS "fromDisplayName", r.created_at AS "createdAt"
        FROM helix_friend_requests r
        JOIN helix_users u ON u.username = r.from_username
        WHERE r.to_username = $1 AND r.status = 'pending'
        ORDER BY r.created_at DESC
    `, [username]);

    const outgoingResult = await dbPool.query(`
        SELECT r.id, r.to_username AS "to", u.display_name AS "toDisplayName", r.created_at AS "createdAt"
        FROM helix_friend_requests r
        JOIN helix_users u ON u.username = r.to_username
        WHERE r.from_username = $1 AND r.status = 'pending'
        ORDER BY r.created_at DESC
    `, [username]);

    return {
        friends: friendsResult.rows.map((friend) => ({
            ...friend,
            profilePhoto: publicProfilePhotoUrl(friend.username)
        })),
        incoming: incomingResult.rows,
        outgoing: outgoingResult.rows
    };
}

async function areCloudFriends(usernameA, usernameB) {
    const result = await dbPool.query(`
        SELECT 1
        FROM helix_friendships
        WHERE user_a = LEAST($1, $2) AND user_b = GREATEST($1, $2)
    `, [usernameA, usernameB]);
    return result.rowCount > 0;
}

app.post("/api/network/sync", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const displayName = normalizeDisplayName(req.body?.displayName);

    try {
        if (dbPool) {
            await requireDatabase();

            if (displayName && !validDisplayName(displayName)) {
                return res.status(400).json({ error: "Display name must be 1–50 characters." });
            }

            const result = displayName
                ? await dbPool.query(
                    "UPDATE helix_users SET display_name = $1 WHERE username = $2 RETURNING username, display_name, created_at",
                    [displayName, user.username]
                )
                : await dbPool.query(
                    "SELECT username, display_name, created_at, profile_photo FROM helix_users WHERE username = $1",
                    [user.username]
                );

            const row = result.rows[0];
            return res.json({
                ok: true,
                username: row.username,
                displayName: row.display_name,
                profilePhoto: publicProfilePhotoUrl(row.username) || null,
                ...await getCloudNetworkState(user.username)
            });
        }

        return res.json({
            ok: true,
            username: user.username,
            displayName: user.display_name,
            profilePhoto: user.profilePhoto || null,
            ...networkState(user.username)
        });
    } catch (error) {
        console.error("Network sync failed:", error);
        return res.status(500).json({ error: "Could not sync your Helix profile." });
    }
});

app.get("/api/network/state", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    try {
        if (dbPool) {
            await requireDatabase();
            return res.json(await getCloudNetworkState(user.username));
        }
        return res.json(networkState(user.username));
    } catch (error) {
        console.error("Network state failed:", error);
        return res.status(500).json({ error: "Could not load your Helix network." });
    }
});


app.get("/api/network/search", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const query = normalizeUsername(req.query.q).slice(0, 64).toLowerCase();

    try {
        if (dbPool) {
            await requireDatabase();
            const pattern = `%${query}%`;
            const result = await dbPool.query(`
                SELECT u.username, u.display_name AS "displayName"
                FROM helix_users u
                WHERE u.username <> $1
                  AND ($2 = '%%' OR LOWER(u.username) LIKE $2 OR LOWER(u.display_name) LIKE $2)
                  AND NOT EXISTS (
                      SELECT 1 FROM helix_friendships f
                      WHERE (f.user_a = LEAST($1, u.username) AND f.user_b = GREATEST($1, u.username))
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM helix_friend_requests r
                      WHERE r.status = 'pending'
                        AND ((r.from_username = $1 AND r.to_username = u.username)
                             OR (r.from_username = u.username AND r.to_username = $1))
                  )
                ORDER BY LOWER(u.display_name), LOWER(u.username)
                LIMIT 20
            `, [user.username, pattern]);
            return res.json({
                results: result.rows.map((user) => ({
                    ...user,
                    profilePhoto: publicProfilePhotoUrl(user.username)
                }))
            });
        }

        const data = loadNetworkData();
        const state = networkState(user.username);
        const blockedNames = new Set([user.username, ...state.friends.map((u) => typeof u === "string" ? u : u.username), ...state.incoming.map((x) => x.from), ...state.outgoing.map((x) => x.to)]);
        const results = Object.values(data.users)
            .filter((u) => u && validUsername(u.username) && !blockedNames.has(u.username))
            .filter((u) => !query || u.username.toLowerCase().includes(query) || String(u.displayName || u.username).toLowerCase().includes(query))
            .slice(0, 20).map((u) => publicUser(data, u.username));
        return res.json({ results });
    } catch (error) {
        console.error("Network search failed:", error);
        return res.status(500).json({ error: "Could not search the Helix network." });
    }
});

async function isBlockedEitherWay(usernameA, usernameB) {
    if (!dbPool) return false;
    await requireDatabase();
    const result = await dbPool.query("SELECT 1 FROM helix_blocked_accounts WHERE (blocker_username = $1 AND blocked_username = $2) OR (blocker_username = $2 AND blocked_username = $1) LIMIT 1", [usernameA, usernameB]);
    return result.rowCount > 0;
}

async function getPrivacySetting(username, key) {
    const settings = await getUserSettings(username);
    return settings.privacy?.[key];
}

app.post("/api/network/request", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const to = normalizeUsername(req.body?.to);
    if (!validUsername(to) || to === user.username) return res.status(400).json({ error: "Invalid friend request." });

    try {
        if (dbPool) {
            await requireDatabase();
            const target = await dbPool.query("SELECT username FROM helix_users WHERE username = $1", [to]);
            if (!target.rowCount) return res.status(404).json({ error: "User not found on the Helix network." });
            if (await isBlockedEitherWay(user.username, to)) return res.status(403).json({ error: "You cannot interact with this account." });
            const requestSetting = await getPrivacySetting(to, "friend-requests");
            if (requestSetting === "NOBODY") return res.status(403).json({ error: "This user is not accepting friend requests." });
            const pair = await dbPool.query(`SELECT 1 FROM helix_friendships WHERE user_a = LEAST($1,$2) AND user_b = GREATEST($1,$2)`, [user.username, to]);
            if (pair.rowCount) return res.status(409).json({ error: "You are already friends." });
            const pending = await dbPool.query(`SELECT 1 FROM helix_friend_requests WHERE status = 'pending' AND ((from_username=$1 AND to_username=$2) OR (from_username=$2 AND to_username=$1))`, [user.username, to]);
            if (pending.rowCount) return res.status(409).json({ error: "A friend request is already pending." });
            const id = crypto.randomUUID();
            const created = await dbPool.query(`INSERT INTO helix_friend_requests (id, from_username, to_username) VALUES ($1,$2,$3) RETURNING id, from_username AS "from", to_username AS "to", status, created_at AS "createdAt"`, [id,user.username,to]);
            await logActivity(user.username, "network.friend_request_sent", { to });
            return res.status(201).json({ ok: true, request: created.rows[0] });
        }

        // Local fallback retained for development.
        const data = loadNetworkData();
        if (!data.users[to]) return res.status(404).json({ error: "User not found on the Helix network yet." });
        const localSettings = data.settings?.[to]?.privacy || {};
        if (localSettings["friend-requests"] === "NOBODY") return res.status(403).json({ error: "This user is not accepting friend requests." });
        const blockedByTarget = data.blocked?.[to]?.includes(user.username) || data.blocked?.[user.username]?.includes(to);
        if (blockedByTarget) return res.status(403).json({ error: "You cannot interact with this account." });
        if (data.friends.some((friend) => samePair(friend.a, friend.b, user.username, to))) return res.status(409).json({ error: "You are already friends." });
        const existing = data.requests.find((request) => request.status === "pending" && samePair(request.from, request.to, user.username, to));
        if (existing) return res.status(409).json({ error: "A friend request is already pending." });
        const request = { id: crypto.randomUUID(), from: user.username, to, status:"pending", createdAt:new Date().toISOString() };
        data.requests.push(request); saveNetworkData(data);
        return res.status(201).json({ ok:true, request });
    } catch (error) {
        console.error("Friend request failed:", error);
        return res.status(500).json({ error: "Could not send the friend request." });
    }
});

app.delete("/api/network/request/:id", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    try {
        if (dbPool) {
            await requireDatabase();
            const result = await dbPool.query("UPDATE helix_friend_requests SET status = 'cancelled' WHERE id = $1 AND from_username = $2 AND status = 'pending' RETURNING id", [req.params.id, user.username]);
            if (!result.rowCount) return res.status(404).json({ error: "Pending request not found." });
            return res.json({ ok: true });
        }
        return res.status(400).json({ error: "Not available in local mode." });
    } catch (error) { return res.status(500).json({ error: "Could not cancel the request." }); }
});

app.post("/api/network/request/:id/respond", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const action = req.body?.action;
    if (!["accept", "decline"].includes(action)) return res.status(400).json({ error: "Invalid request response." });

    try {
        if (dbPool) {
            await requireDatabase();
            const client = await dbPool.connect();
            try {
                await client.query("BEGIN");
                const found = await client.query("SELECT from_username, to_username FROM helix_friend_requests WHERE id = $1 AND to_username = $2 AND status = 'pending' FOR UPDATE", [req.params.id, user.username]);
                if (!found.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Friend request not found." }); }
                const from = found.rows[0].from_username;
                await client.query("UPDATE helix_friend_requests SET status = $1 WHERE id = $2", [action === "accept" ? "accepted" : "declined", req.params.id]);
                if (action === "accept") {
                    await client.query("INSERT INTO helix_friendships (user_a,user_b) VALUES (LEAST($1,$2),GREATEST($1,$2)) ON CONFLICT DO NOTHING", [from,user.username]);
                }
                await client.query("COMMIT");
                await logActivity(user.username, action === "accept" ? "network.friend_request_accepted" : "network.friend_request_declined", { from });
                return res.json({ ok:true });
            } catch (error) { await client.query("ROLLBACK"); throw error; }
            finally { client.release(); }
        }
        return res.status(400).json({ error: "Not available in local mode." });
    } catch (error) { return res.status(500).json({ error: "Could not update the friend request." }); }
});


// =========================================================
// PUBLIC PROFILE PHOTOS
// =========================================================

function normalizeProfilePhoto(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function validProfilePhoto(value) {
    return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
        && value.length <= 900000;
}

function decodeProfilePhoto(value) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match) return null;

    return {
        mime: match[1] === "jpeg" ? "image/jpeg" : `image/${match[1]}`,
        buffer: Buffer.from(match[2], "base64")
    };
}

app.post("/api/profile/photo", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const profilePhoto = normalizeProfilePhoto(req.body?.profilePhoto);

    if (!profilePhoto) {
        return res.status(400).json({ error: "Please choose a profile photo." });
    }

    if (!validProfilePhoto(profilePhoto)) {
        return res.status(400).json({ error: "Profile photo is too large or uses an unsupported image format." });
    }

    try {
        if (dbPool) {
            await requireDatabase();

            const result = await dbPool.query(
                "UPDATE helix_users SET profile_photo = $1 WHERE username = $2 RETURNING username, display_name, created_at, profile_photo",
                [profilePhoto, user.username]
            );

            const row = result.rows[0];

            await logActivity(user.username, "account.profile_photo_updated");

            return res.json({
                ok: true,
                user: {
                    username: row.username,
                    displayName: row.display_name,
                    createdAt: row.created_at,
                    profilePhoto: publicProfilePhotoUrl(row.username) || null
                }
            });
        }

        const data = loadNetworkData();
        if (!data.users[user.username]) {
            return res.status(404).json({ error: "Helix account was not found." });
        }

        data.users[user.username].profilePhoto = profilePhoto;
        saveNetworkData(data);

        return res.json({
            ok: true,
            user: publicUser(data, user.username)
        });
    } catch (error) {
        console.error("Profile photo update failed:", error);
        return res.status(500).json({ error: "Could not save your profile photo." });
    }
});

// Public: anyone who can reach Helix can request a user's profile photo.
app.get("/api/users/:username/photo", async (req, res) => {
    const username = normalizeUsername(req.params.username);

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Invalid username." });
    }

    try {
        let profilePhoto = null;

        if (dbPool) {
            await requireDatabase();
            const result = await dbPool.query(
                "SELECT profile_photo FROM helix_users WHERE username = $1",
                [username]
            );
            profilePhoto = result.rows[0]?.profile_photo || null;
        } else {
            const data = loadNetworkData();
            profilePhoto = data.users[username]?.profilePhoto || null;
        }

        const decoded = profilePhoto ? decodeProfilePhoto(profilePhoto) : null;

        if (!decoded) {
            return res.status(404).json({ error: "This user has no profile photo." });
        }

        res.setHeader("Content-Type", decoded.mime);
        res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
        return res.end(decoded.buffer);
    } catch (error) {
        console.error("Public profile photo load failed:", error);
        return res.status(500).json({ error: "Could not load this profile photo." });
    }
});

app.delete("/api/network/friend", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;
    const friend = normalizeUsername(req.body?.friend);
    if (!validUsername(friend)) return res.status(400).json({ error: "Invalid friend." });
    try {
        if (dbPool) {
            await requireDatabase();
            await dbPool.query("DELETE FROM helix_friendships WHERE user_a = LEAST($1,$2) AND user_b = GREATEST($1,$2)", [user.username,friend]);
            return res.json({ ok:true });
        }
        return res.status(400).json({ error: "Not available in local mode." });
    } catch (error) { return res.status(500).json({ error: "Could not remove your friend." }); }
});
app.get("/api/dm/messages", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const withUser = normalizeUsername(req.query.with);
    if (!validUsername(withUser) || withUser === user.username) {
        return res.status(400).json({ error: "Invalid conversation." });
    }

    try {
        if (!dbPool) return res.json({ messages: [] });
        await requireDatabase();
        if (!(await areCloudFriends(user.username, withUser))) {
            return res.status(403).json({ error: "You can only message friends on Helix." });
        }

        const result = await dbPool.query(`
            SELECT id, sender_username AS "sender", recipient_username AS "recipient",
                   body AS "text", created_at AS "createdAt", read_at AS "readAt",
                   CASE WHEN media_data IS NOT NULL THEN '/api/dm/media/' || id::text ELSE NULL END AS "mediaUrl",
                   media_mime AS "mediaMime",
                   media_name AS "mediaName",
                   media_size AS "mediaSize",
                   media_kind AS "mediaKind"
            FROM helix_messages
            WHERE (sender_username = $1 AND recipient_username = $2)
               OR (sender_username = $2 AND recipient_username = $1)
            ORDER BY created_at ASC
            LIMIT 200
        `, [user.username, withUser]);

        await dbPool.query(`
            UPDATE helix_messages
            SET read_at = NOW()
            WHERE recipient_username = $1 AND sender_username = $2 AND read_at IS NULL
        `, [user.username, withUser]);

        res.json({ messages: result.rows });
    } catch (error) {
        console.error("DM load failed:", error);
        res.status(500).json({ error: "Could not load this conversation." });
    }
});

app.get("/api/dm/notification-feed", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    try {
        if (!dbPool) {
            return res.json({ unread: 0, messages: [] });
        }

        await requireDatabase();

        const result = await dbPool.query(`
            SELECT
                m.id,
                CASE
                    WHEN m.body <> '' THEN m.body
                    WHEN m.media_kind = 'video' THEN '🎥 Video'
                    ELSE '📷 Photo'
                END AS "text",
                m.media_kind AS "mediaKind",
                m.created_at AS "createdAt",
                m.sender_username AS "sender",
                COALESCE(u.display_name, m.sender_username) AS "senderDisplayName"
            FROM helix_messages m
            JOIN helix_users u ON u.username = m.sender_username
            WHERE m.recipient_username = $1
              AND m.read_at IS NULL
            ORDER BY m.created_at ASC
            LIMIT 100
        `, [user.username]);

        return res.json({
            ok: true,
            unread: result.rows.length,
            messages: result.rows
        });
    } catch (error) {
        console.error("DM notification feed failed:", error);
        return res.status(500).json({ error: "Could not load DM notifications." });
    }
});

app.get("/api/dm/unread-count", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    try {
        if (!dbPool) {
            return res.json({ unread: 0 });
        }

        await requireDatabase();

        const result = await dbPool.query(`
            SELECT COUNT(*)::int AS "unread"
            FROM helix_messages
            WHERE recipient_username = $1
              AND read_at IS NULL
        `, [user.username]);

        return res.json({
            ok: true,
            unread: Math.max(0, Number(result.rows[0]?.unread || 0))
        });
    } catch (error) {
        console.error("DM unread count failed:", error);
        return res.status(500).json({ error: "Could not load unread message count." });
    }
});

function parseDMMediaData(value) {
    if (typeof value !== "string") return null;

    const match = /^data:((?:image|video)\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
    if (!match) return null;

    const mime = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], "base64");

    if (!buffer.length || buffer.length > 10 * 1024 * 1024) return null;

    return { mime, buffer };
}

app.post("/api/dm/messages", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const recipient = normalizeUsername(req.body?.to);
    const body = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const incomingMedia = req.body?.media;

    if (!validUsername(recipient) || recipient === user.username) {
        return res.status(400).json({ error: "Invalid recipient." });
    }

    if (await isBlockedEitherWay(user.username, recipient)) {
        return res.status(403).json({ error: "You cannot message this account." });
    }

    const recipientDMSetting = await getPrivacySetting(recipient, "direct-messages");
    if (recipientDMSetting === "NOBODY") {
        return res.status(403).json({ error: "This user is not accepting direct messages." });
    }

    if (!body && !incomingMedia) {
        return res.status(400).json({ error: "Enter a message or attach a photo/video." });
    }

    if (body.length > 4000) {
        return res.status(400).json({ error: "Message is too long. Maximum is 4000 characters." });
    }

    let media = null;

    if (incomingMedia) {
        if (typeof incomingMedia !== "object" || Array.isArray(incomingMedia)) {
            return res.status(400).json({ error: "Invalid media attachment." });
        }

        const parsed = parseDMMediaData(incomingMedia.dataUrl);

        if (!parsed) {
            return res.status(400).json({ error: "Choose a valid photo or video file up to 10 MB." });
        }

        const declaredSize = Number(incomingMedia.size || 0);
        if (declaredSize && declaredSize !== parsed.buffer.length) {
            return res.status(400).json({ error: "The attachment size could not be verified." });
        }

        media = {
            buffer: parsed.buffer,
            mime: parsed.mime,
            name: typeof incomingMedia.name === "string"
                ? incomingMedia.name.trim().slice(0, 180) || "attachment"
                : "attachment",
            size: parsed.buffer.length,
            kind: parsed.mime.startsWith("video/") ? "video" : "image"
        };
    }

    try {
        if (!dbPool) return res.status(503).json({ error: "Cloud messaging is not configured." });
        await requireDatabase();

        if (!(await areCloudFriends(user.username, recipient))) {
            return res.status(403).json({ error: "You can only message friends on Helix." });
        }

        const result = await dbPool.query(`
            INSERT INTO helix_messages (
                id, sender_username, recipient_username, body,
                media_data, media_mime, media_name, media_size, media_kind
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING
                id,
                sender_username AS "sender",
                recipient_username AS "recipient",
                body AS "text",
                created_at AS "createdAt",
                read_at AS "readAt",
                CASE WHEN media_data IS NOT NULL THEN '/api/dm/media/' || id::text ELSE NULL END AS "mediaUrl",
                media_mime AS "mediaMime",
                media_name AS "mediaName",
                media_size AS "mediaSize",
                media_kind AS "mediaKind"
        `, [
            crypto.randomUUID(),
            user.username,
            recipient,
            body,
            media?.buffer || null,
            media?.mime || null,
            media?.name || null,
            media?.size || null,
            media?.kind || null
        ]);

        await logActivity(user.username, "dm.message_sent", {
            to: recipient,
            mediaKind: media?.kind || null
        });

        return res.status(201).json({ ok: true, message: result.rows[0] });
    } catch (error) {
        console.error("DM send failed:", error);
        return res.status(500).json({ error: "Could not send the message." });
    }
});

app.get("/api/dm/media/:messageId", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const messageId = String(req.params.messageId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(messageId)) {
        return res.status(400).json({ error: "Invalid media." });
    }

    try {
        await requireDatabase();

        const result = await dbPool.query(`
            SELECT media_data, media_mime, media_name
            FROM helix_messages
            WHERE id = $1
              AND media_data IS NOT NULL
              AND (sender_username = $2 OR recipient_username = $2)
        `, [messageId, user.username]);

        const row = result.rows[0];
        if (!row) return res.status(404).json({ error: "Media not found." });

        res.setHeader("Content-Type", row.media_mime || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.media_name || "attachment")}`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.setHeader("X-Content-Type-Options", "nosniff");

        return res.end(row.media_data);
    } catch (error) {
        console.error("DM media load failed:", error);
        return res.status(500).json({ error: "Could not load this attachment." });
    }
});



async function getAIImageUsage(username) {
    if (dbPool) {
        await requireDatabase();
        const result = await dbPool.query(
            'SELECT upload_count FROM helix_ai_image_usage WHERE username = $1 AND usage_date = CURRENT_DATE',
            [username]
        );
        const used = Number(result.rows[0]?.upload_count || 0);
        return { used, remaining: Math.max(0, DAILY_AI_IMAGE_LIMIT - used) };
    }

    const data = loadNetworkData();
    data.aiImageUsage = data.aiImageUsage || {};
    const today = new Date().toISOString().slice(0, 10);
    const used = Number(data.aiImageUsage[username]?.[today] || 0);
    return { used, remaining: Math.max(0, DAILY_AI_IMAGE_LIMIT - used) };
}

async function claimAIImageUpload(username) {
    if (dbPool) {
        await requireDatabase();
        const claimed = await dbPool.query(
            `INSERT INTO helix_ai_image_usage (username, usage_date, upload_count)
             VALUES ($1, CURRENT_DATE, 1)
             ON CONFLICT (username, usage_date)
             DO UPDATE SET upload_count = helix_ai_image_usage.upload_count + 1
             WHERE helix_ai_image_usage.upload_count < $2
             RETURNING upload_count`,
            [username, DAILY_AI_IMAGE_LIMIT]
        );

        if (!claimed.rowCount) {
            const error = new Error("Daily photo upload limit reached. Try again tomorrow.");
            error.status = 429;
            error.remaining = 0;
            throw error;
        }

        const used = Number(claimed.rows[0].upload_count);
        return { used, remaining: Math.max(0, DAILY_AI_IMAGE_LIMIT - used) };
    }

    const data = loadNetworkData();
    data.aiImageUsage = data.aiImageUsage || {};
    const today = new Date().toISOString().slice(0, 10);
    data.aiImageUsage[username] = data.aiImageUsage[username] || {};
    const used = Number(data.aiImageUsage[username][today] || 0);

    if (used >= DAILY_AI_IMAGE_LIMIT) {
        const error = new Error("Daily photo upload limit reached. Try again tomorrow.");
        error.status = 429;
        error.remaining = 0;
        throw error;
    }

    const next = used + 1;
    data.aiImageUsage[username][today] = next;
    saveNetworkData(data);
    return { used: next, remaining: DAILY_AI_IMAGE_LIMIT - next };
}

function parseAIImageData(value) {
    if (typeof value !== 'string') return null;
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
    if (!match) return null;
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length || buffer.length > 1500000) return null;
    return { mimeType: match[1], data: base64 };
}

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

async function generateGeminiResponse(message, history = [], image = null) {
    if (!process.env.GEMINI_API_KEY) {
        const error = new Error("GEMINI_API_KEY is not configured.");
        error.status = 503;
        throw error;
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/"
        + encodeURIComponent(MODEL) + ":generateContent";

    const isLowLatencyGemini3Model =
        /gemini-3\.8-flash|gemini-3\.7-flash/i.test(MODEL);

    const contents = buildConversationInput(history, message);

    if (image && contents.length) {
        contents[contents.length - 1].parts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.data
            }
        });
    }

    const body = {
        systemInstruction: {
            parts: [{ text: HELIX_AI_INSTRUCTIONS }]
        },
        contents,
        generationConfig: {
            ...(isLowLatencyGemini3Model
                ? { thinkingConfig: { thinkingLevel: "low" } }
                : { thinkingConfig: { thinkingLevel: "minimal" } }),
            maxOutputTokens: 512
        }
    };

    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify(body)
        });
    } catch (networkError) {
        const error = new Error("Could not reach the Gemini API: " + (networkError?.message || "network error"));
        error.status = 502;
        throw error;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data?.error?.message || `Gemini API returned HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
    }

    const reply = data?.candidates?.[0]?.content?.parts
        ?.filter((part) => typeof part?.text === "string")
        .map((part) => part.text)
        .join("")
        .trim();

    if (!reply) {
        const reason = data?.promptFeedback?.blockReason
            || data?.candidates?.[0]?.finishReason
            || "NO_TEXT";
        const error = new Error("Gemini returned no text. Reason: " + reason);
        error.status = 502;
        throw error;
    }

    return reply;
}

async function checkGeminiReachability() {
    if (!GEMINI_API_KEY) {
        return { reachable: false, error: "GEMINI_API_KEY is not configured on the server." };
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/"
        + encodeURIComponent(MODEL);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "x-goog-api-key": GEMINI_API_KEY
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return {
                reachable: false,
                error: data?.error?.message || `Gemini model check returned HTTP ${response.status}.`
            };
        }

        return { reachable: true, error: null };
    } catch (error) {
        return {
            reachable: false,
            error: error?.message || "Could not reach the Gemini API."
        };
    }
}

app.get("/api/health", async (req, res) => {
    let databaseConnected = false;

    if (dbPool) {
        try {
            await requireDatabase();
            await dbPool.query("SELECT 1");
            databaseConnected = true;
        } catch (error) {
            databaseConnected = false;
        }
    }

    const ai = await checkGeminiReachability();

    res.json({
        ok: true,
        aiConfigured: Boolean(GEMINI_API_KEY),
        reachable: ai.reachable,
        aiError: ai.error,
        provider: "gemini",
        model: MODEL,
        transport: "direct-rest",
        databaseConfigured: Boolean(dbPool),
        databaseConnected
    });
});


app.get("/api/chat/image-usage", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    try {
        const usage = await getAIImageUsage(user.username);
        return res.json({
            ok: true,
            dailyLimit: DAILY_AI_IMAGE_LIMIT,
            used: usage.used,
            remaining: usage.remaining
        });
    } catch (error) {
        console.error("AI image usage check failed:", error);
        return res.status(500).json({ error: "Could not check the daily photo upload limit." });
    }
});

app.post("/api/chat", async (req, res) => {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    try {
        const message = typeof req.body.message === "string"
            ? req.body.message.trim()
            : "";
        const image = parseAIImageData(req.body.image);

        if (!message && !image) {
            return res.status(400).json({ error: "Please enter a message or choose a photo for Helix AI." });
        }

        if (req.body.image && !image) {
            return res.status(400).json({ error: "That photo could not be read. Please choose a PNG, JPEG, or WebP image." });
        }

        let imageUsage = null;
        if (image) imageUsage = await claimAIImageUpload(user.username);

        const history = Array.isArray(req.body.history) ? req.body.history : [];
        const prompt = message || "Analyze this image and explain what is shown. If it contains a question, solve or explain it step by step.";
        const reply = await generateGeminiResponse(prompt, history, image);

        return res.json({
            reply,
            imageUploadsRemaining: imageUsage?.remaining ?? null
        });
    } catch (error) {
        console.error("Helix AI request failed:", error?.message || error);
        const status = Number(error?.status || 502);

        if (status === 401 || status === 403) {
            return res.status(status).json({
                error: "Gemini rejected the API key. Replace GEMINI_API_KEY in Render with a fresh active key."
            });
        }

        if (status === 429) {
            return res.status(429).json({
                error: Number.isInteger(error?.remaining)
                    ? "Daily photo upload limit reached. Try again tomorrow."
                    : "Gemini quota/rate limit reached. Check the Gemini project limits in AI Studio.",
                imageUploadsRemaining: Number.isInteger(error?.remaining) ? error.remaining : null
            });
        }

        if (status === 503 || status === 504) {
            return res.status(503).json({
                error: "Gemini is temporarily unavailable or timed out. Helix is not adding its own timeout; try again shortly."
            });
        }

        return res.status(502).json({
            error: error?.message || "Helix could not get a response from Gemini."
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