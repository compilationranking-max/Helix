const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalModuleLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === "express") {
        return {
            Router() {
                const router = { stack: [] };
                for (const method of ["get", "post", "put", "patch", "delete"]) {
                    router[method] = (path, ...handlers) => {
                        router.stack.push({
                            route: {
                                path,
                                methods: { [method]: true },
                                stack: handlers.map((handle) => ({ handle }))
                            }
                        });
                    };
                }
                return router;
            }
        };
    }

    return originalModuleLoad.call(this, request, parent, isMain);
};

const createDMRouter = require("../routes/dm");
Module._load = originalModuleLoad;

const USERS = new Set(["alice", "bob", "carol", "dave"]);
const friendships = new Set([
    "alice|bob",
    "alice|carol",
    "alice|dave",
    "bob|carol",
    "bob|dave",
    "carol|dave"
]);

function friendshipKey(a, b) {
    return [a, b].sort().join("|");
}

function clone(value) {
    if (Buffer.isBuffer(value)) return Buffer.from(value);
    return value && typeof value === "object"
        ? JSON.parse(JSON.stringify(value))
        : value;
}

function makeHarness(currentUser = "alice") {
    const messages = new Map();
    const reactions = new Map();
    const pins = new Map();
    const nicknameMap = new Map();
    const inserted = [];

    function rowFor(message, viewer) {
        const reply = message.replyToId
            ? messages.get(message.replyToId)
            : null;
        const replyDeleted = Boolean(reply?.deletedAt);

        return {
            id: message.id,
            sender: message.sender,
            recipient: message.recipient,
            text: message.deletedAt ? "" : message.body,
            createdAt: message.createdAt,
            readAt: message.readAt || null,
            editedAt: message.editedAt || null,
            deletedAt: message.deletedAt || null,
            mediaMime: message.mediaMime || null,
            mediaName: message.mediaName || null,
            mediaSize: message.mediaSize || null,
            mediaKind: message.mediaKind || null,
            mediaUrl: message.mediaData
                ? "/api/dm/media/" + message.id
                : null,
            isPinned: [...pins.values()].some(
                (pin) =>
                    pin.messageId === message.id &&
                    pin.owner === viewer
            ),
            replyToId: message.replyToId || null,
            replySender: reply?.sender || null,
            replyText: replyDeleted ? null : reply?.body || null,
            replyDeletedAt: reply?.deletedAt || null,
            replyMediaUrl: reply?.mediaData
                ? "/api/dm/media/" + reply.id
                : null,
            replyMediaName: reply?.mediaName || null,
            replyMediaKind: reply?.mediaKind || null
        };
    }

    function seedMessage(message) {
        messages.set(message.id, {
            ...message,
            createdAt: message.createdAt || new Date().toISOString()
        });
    }

    const dbPool = {
        async query(sql, params = []) {
            const query = String(sql);

            if (query.includes('SELECT username FROM helix_users')) {
                const username = params[0];
                return USERS.has(username)
                    ? { rowCount: 1, rows: [{ username }] }
                    : { rowCount: 0, rows: [] };
            }

            if (query.includes('FROM helix_friendships')) {
                return friendships.has(friendshipKey(params[0], params[1]))
                    ? { rowCount: 1, rows: [{}] }
                    : { rowCount: 0, rows: [] };
            }

            if (query.includes('FROM helix_blocked_accounts')) {
                return { rowCount: 0, rows: [] };
            }

            if (query.includes("INSERT INTO helix_dm_conversation_nicknames")) {
                nicknameMap.set(params[0] + "|" + params[1], params[2]);
                return { rowCount: 1, rows: [] };
            }

            if (query.includes("DELETE FROM helix_dm_conversation_nicknames")) {
                nicknameMap.delete(params[0] + "|" + params[1]);
                return { rowCount: 1, rows: [] };
            }

            if (query.includes("FROM helix_dm_conversation_nicknames")) {
                const key = params[0] + "|" + params[1];
                const nickname = nicknameMap.get(key);
                return nickname
                    ? { rowCount: 1, rows: [{ nickname }] }
                    : { rowCount: 0, rows: [] };
            }

            if (query.includes('INSERT INTO helix_dm_messages')) {
                const [
                    id,
                    sender,
                    recipient,
                    body,
                    replyToId,
                    mediaData,
                    mediaMime,
                    mediaName,
                    mediaSize,
                    mediaKind
                ] = params;

                const createdAt = new Date().toISOString();

                messages.set(id, {
                    id,
                    sender,
                    recipient,
                    body,
                    replyToId: replyToId || null,
                    mediaData: mediaData ? Buffer.from(mediaData) : null,
                    mediaMime: mediaMime || null,
                    mediaName: mediaName || null,
                    mediaSize: mediaSize || null,
                    mediaKind: mediaKind || null,
                    createdAt
                });

                inserted.push({
                    id,
                    sender,
                    recipient,
                    body,
                    replyToId: replyToId || null,
                    mediaMime: mediaMime || null,
                    mediaKind: mediaKind || null
                });

                return { rowCount: 1, rows: [{ id }] };
            }

            if (query.includes('FROM helix_dm_message_reactions')) {
                const ids = params[0] || [];
                const viewer = params[1];
                const rows = [];

                for (const [key, value] of reactions.entries()) {
                    const [messageId, username, emoji] = key.split("|");

                    if (ids.includes(messageId) && value) {
                        rows.push({
                            messageId,
                            emoji,
                            count: 1,
                            reacted: username === viewer
                        });
                    }
                }

                return { rowCount: rows.length, rows };
            }

            if (query.includes('SELECT m.id, m.sender_username AS sender') &&
                query.includes('FROM helix_dm_messages m') &&
                query.includes('WHERE m.id = $2')) {
                const message = messages.get(params[1]);
                if (!message) return { rowCount: 0, rows: [] };

                const viewer = params[2];
                if (message.sender !== viewer && message.recipient !== viewer) {
                    return { rowCount: 0, rows: [] };
                }

                return { rowCount: 1, rows: [rowFor(message, viewer)] };
            }

            if (query.includes('SELECT m.id, m.sender_username AS sender') &&
                query.includes('FROM helix_dm_messages m') &&
                query.includes('ORDER BY m.created_at DESC')) {
                const viewer = params[0];
                const partner = params[1];
                const limit = params[2];

                const rows = [...messages.values()]
                    .filter(
                        (message) =>
                            (message.sender === viewer && message.recipient === partner) ||
                            (message.sender === partner && message.recipient === viewer)
                    )
                    .sort(
                        (a, b) =>
                            new Date(b.createdAt) - new Date(a.createdAt)
                    )
                    .slice(0, limit)
                    .reverse()
                    .map((message) => rowFor(message, viewer));

                return { rowCount: rows.length, rows };
            }

            if (query.includes('UPDATE helix_dm_messages SET read_at')) {
                return { rowCount: 0, rows: [] };
            }

            if (query.includes('UPDATE helix_dm_messages SET body = $1')) {
                const [body, id] = params;
                const message = messages.get(id);
                if (!message) return { rowCount: 0, rows: [] };

                message.body = body;
                message.editedAt = new Date().toISOString();
                return { rowCount: 1, rows: [{ id }] };
            }

            if (query.includes("UPDATE helix_dm_messages SET body = ''")) {
                const id = params[0];
                const message = messages.get(id);
                if (!message) return { rowCount: 0, rows: [] };

                message.body = "";
                message.mediaData = null;
                message.mediaMime = null;
                message.mediaName = null;
                message.mediaSize = null;
                message.mediaKind = null;
                message.editedAt = null;
                message.deletedAt = new Date().toISOString();
                return { rowCount: 1, rows: [{ id }] };
            }

            if (query.includes('DELETE FROM helix_dm_message_pins WHERE message_id = $1')) {
                const messageId = params[0];

                for (const [key, value] of pins.entries()) {
                    if (value.messageId === messageId) {
                        pins.delete(key);
                    }
                }

                return { rowCount: 1, rows: [] };
            }

            if (query.includes('INSERT INTO helix_dm_message_reactions')) {
                const key = params[0] + "|" + params[1] + "|" + params[2];
                reactions.set(key, true);
                return { rowCount: 1, rows: [] };
            }

            if (query.includes('DELETE FROM helix_dm_message_reactions')) {
                reactions.delete(params[0] + "|" + params[1] + "|" + params[2]);
                return { rowCount: 1, rows: [] };
            }

            if (query.includes('INSERT INTO helix_dm_message_pins')) {
                const key = params[0] + "|" + params[1];
                pins.set(key, { messageId: params[0], owner: params[1] });
                return { rowCount: 1, rows: [] };
            }

            if (query.includes('DELETE FROM helix_dm_message_pins')) {
                pins.delete(params[0] + "|" + params[1]);
                return { rowCount: 1, rows: [] };
            }

            if (query.includes('SELECT sender_username, recipient_username')) {
                const message = messages.get(params[0]);

                return message?.mediaData
                    ? {
                        rowCount: 1,
                        rows: [{
                            sender_username: message.sender,
                            recipient_username: message.recipient,
                            media_data: Buffer.from(message.mediaData),
                            media_mime: message.mediaMime,
                            media_name: message.mediaName,
                            media_size: message.mediaSize,
                            media_kind: message.mediaKind,
                            deleted_at: message.deletedAt || null
                        }]
                    }
                    : { rowCount: 0, rows: [] };
            }

            throw new Error("Unhandled SQL in DM test harness:\n" + query);
        }
    };

    function routeHandler(method, path) {
        const layer = router.stack.find(
            (item) =>
                item.route &&
                item.route.path === path &&
                item.route.methods?.[method]
        );

        if (!layer) {
            throw new Error("Missing route " + method + " " + path);
        }

        return layer.route.stack[0].handle;
    }

    const router = createDMRouter({
        dbPool,
        requireDatabase: async () => {},
        requireCurrentUser: async () => ({ username: currentUser }),
        normalizeUsername: (value) => String(value || "").trim(),
        validUsername: (value) => /^[a-z0-9_]{1,32}$/i.test(value),
        isBlockedEitherWay: async () => false,
        getPrivacySetting: async () => "EVERYONE",
        publicProfilePhotoUrl: (username) =>
            "/api/profile/photo/" + encodeURIComponent(username)
    });

    function invoke(method, path, { body = {}, query = {}, params = {} } = {}) {
        return new Promise((resolve, reject) => {
            const req = {
                body,
                query,
                params,
                method: method.toUpperCase()
            };

            const res = {
                statusCode: 200,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(value) {
                    this.body = value;
                    resolve(this);
                    return this;
                },
                end(value) {
                    this.body = value;
                    resolve(this);
                    return this;
                },
                setHeader() {},
                send(value) {
                    this.body = value;
                    resolve(this);
                    return this;
                }
            };

            Promise.resolve(routeHandler(method, path)(req, res)).catch(reject);
        });
    }

    return {
        dbPool,
        messages,
        inserted,
        nicknameMap,
        seedMessage,
        invoke
    };
}

test("DM reply target is validated before insert and response is fully expanded", async () => {
    const harness = makeHarness("alice");

    harness.seedMessage({
        id: "11111111-1111-4111-8111-111111111111",
        sender: "bob",
        recipient: "alice",
        body: "hello bro"
    });

    const response = await harness.invoke("post", "/messages", {
        body: {
            to: "bob",
            text: "yes",
            replyToId: "11111111-1111-4111-8111-111111111111"
        }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(harness.inserted.length, 1);
    assert.equal(
        harness.inserted[0].replyToId,
        "11111111-1111-4111-8111-111111111111"
    );
    assert.equal(response.body.message.replyToId, harness.inserted[0].replyToId);
    assert.equal(response.body.message.replySender, "bob");
    assert.equal(response.body.message.replyText, "hello bro");
    assert.equal(response.body.message.replyPreview.id, harness.inserted[0].replyToId);
});

test("cross-conversation reply target is rejected before any insert", async () => {
    const harness = makeHarness("alice");

    harness.seedMessage({
        id: "22222222-2222-4222-8222-222222222222",
        sender: "carol",
        recipient: "alice",
        body: "private to alice"
    });

    const response = await harness.invoke("post", "/messages", {
        body: {
            to: "bob",
            text: "should fail",
            replyToId: "22222222-2222-4222-8222-222222222222"
        }
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body.error, /outside this conversation/i);
    assert.equal(harness.inserted.length, 0);
});

test("media messages are validated, stored and returned with metadata", async () => {
    const harness = makeHarness("alice");
    const png = Buffer.from(
        "89504e470d0a1a0a0000000d49484452",
        "hex"
    );
    const dataUrl = "data:image/png;base64," + png.toString("base64");

    const response = await harness.invoke("post", "/messages/media", {
        body: {
            to: "bob",
            text: "",
            replyToId: null,
            media: {
                dataUrl,
                name: "photo.png",
                size: png.length,
                mime: "image/png"
            }
        }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.message.mediaKind, "image");
    assert.equal(response.body.message.mediaMime, "image/png");
    assert.equal(response.body.message.mediaName, "photo.png");
    assert.equal(response.body.message.mediaSize, png.length);
    assert.match(response.body.message.mediaUrl, /\/api\/dm\/media\//);
});

test("edit, reaction, pin and delete keep server state authoritative", async () => {
    const harness = makeHarness("alice");

    harness.seedMessage({
        id: "33333333-3333-4333-8333-333333333333",
        sender: "alice",
        recipient: "bob",
        body: "before"
    });

    let response = await harness.invoke("put", "/messages/:id", {
        params: { id: "33333333-3333-4333-8333-333333333333" },
        body: { text: "after" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.message.text, "after");
    assert.ok(response.body.message.editedAt);

    response = await harness.invoke("post", "/messages/:id/reaction", {
        params: { id: "33333333-3333-4333-8333-333333333333" },
        body: { emoji: "❤️", reacted: true }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.message.reactions[0].emoji, "❤️");

    response = await harness.invoke("post", "/messages/:id/pin", {
        params: { id: "33333333-3333-4333-8333-333333333333" },
        body: { pinned: true }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.message.isPinned, true);

    response = await harness.invoke("delete", "/messages/:id", {
        params: { id: "33333333-3333-4333-8333-333333333333" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.deletedId, "33333333-3333-4333-8333-333333333333");
    assert.equal(harness.messages.get("33333333-3333-4333-8333-333333333333").deletedAt !== undefined, true);
});

test("forward creates a new normal message without inheriting replyToId", async () => {
    const harness = makeHarness("alice");

    harness.seedMessage({
        id: "44444444-4444-4444-8444-444444444444",
        sender: "bob",
        recipient: "alice",
        body: "forward this"
    });

    const response = await harness.invoke("post", "/messages/:id/forward", {
        params: { id: "44444444-4444-4444-8444-444444444444" },
        body: { to: "carol" }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.message.text, "forward this");
    assert.equal(response.body.message.replyToId, null);
    assert.equal(harness.inserted.at(-1).recipient, "carol");
});

test("private nickname is stored server-side per owner", async () => {
    const harness = makeHarness("alice");

    const response = await harness.invoke(
        "patch",
        "/conversations/:username/nickname",
        {
            params: { username: "bob" },
            body: { nickname: "Bro" }
        }
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.nickname, "Bro");
    assert.equal(harness.nicknameMap.get("alice|bob"), "Bro");
});
