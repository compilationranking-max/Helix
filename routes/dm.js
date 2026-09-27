const express = require("express");
const crypto = require("crypto");

function createDMRouter(options) {
    const router = express.Router();
    const {
        dbPool,
        requireDatabase,
        requireCurrentUser,
        normalizeUsername,
        validUsername,
        isBlockedEitherWay,
        getPrivacySetting,
        publicProfilePhotoUrl
    } = options;

    const MAX_MESSAGE_LENGTH = 4000;
    const MAX_MESSAGES_PER_LOAD = 300;

    function errorResponse(res, error) {
        const status = Number(error && error.status) || 500;
        return res.status(status).json({
            error: error && error.message ? error.message : "Direct message operation failed."
        });
    }

    async function requireDMDatabase(res) {
        if (!dbPool) {
            res.status(503).json({ error: "Direct messages require the Helix cloud database." });
            return false;
        }
        await requireDatabase();
        return true;
    }

    async function areFriends(usernameA, usernameB) {
        const result = await dbPool.query(
            "SELECT 1 FROM helix_friendships WHERE user_a = LEAST($1, $2) AND user_b = GREATEST($1, $2) LIMIT 1",
            [usernameA, usernameB]
        );
        return result.rowCount > 0;
    }

    async function ensureConversationAccess(username, partner, options = {}) {
        const normalizedPartner = normalizeUsername(partner);

        if (!validUsername(normalizedPartner) || normalizedPartner === username) {
            throw Object.assign(new Error("Invalid conversation."), { status: 400 });
        }

        const target = await dbPool.query(
            "SELECT username FROM helix_users WHERE username = $1",
            [normalizedPartner]
        );

        if (!target.rowCount) {
            throw Object.assign(new Error("That Helix account does not exist."), { status: 404 });
        }

        if (await isBlockedEitherWay(username, normalizedPartner)) {
            throw Object.assign(new Error("You cannot interact with this account."), { status: 403 });
        }

        const friends = await areFriends(username, normalizedPartner);

        if (!friends) {
            throw Object.assign(
                new Error("You can only message people who are currently your friends."),
                { status: 403 }
            );
        }

        if (options.allowSend) {
            const privacy = await getPrivacySetting(normalizedPartner, "direct-messages");

            if (privacy === "NOBODY") {
                throw Object.assign(
                    new Error("This user is not accepting direct messages right now."),
                    { status: 403 }
                );
            }

            if (privacy === "FRIENDS" && !friends) {
                throw Object.assign(
                    new Error("This user only accepts messages from friends."),
                    { status: 403 }
                );
            }
        }

        return normalizedPartner;
    }

    async function getMessageRow(messageId, username) {
        const result = await dbPool.query(
            "SELECT m.id, m.sender_username AS sender, m.recipient_username AS recipient, m.body AS text, " +
            "m.created_at AS \"createdAt\", m.edited_at AS \"editedAt\", " +
            "EXISTS (SELECT 1 FROM helix_dm_pins p WHERE p.message_id = m.id AND p.owner_username = $2) AS \"isPinned\" " +
            "FROM helix_dm_messages m " +
            "WHERE m.id = $1 AND (m.sender_username = $2 OR m.recipient_username = $2)",
            [messageId, username]
        );
        return result.rows[0] || null;
    }

    async function loadReactionMap(messageIds, username) {
        if (!messageIds.length) return new Map();

        const result = await dbPool.query(
            "SELECT r.message_id AS \"messageId\", r.emoji, COUNT(*)::int AS count, " +
            "BOOL_OR(r.username = $2) AS reacted " +
            "FROM helix_dm_reactions r " +
            "WHERE r.message_id = ANY($1::uuid[]) " +
            "GROUP BY r.message_id, r.emoji ORDER BY r.emoji",
            [messageIds, username]
        );

        const map = new Map();

        result.rows.forEach((row) => {
            const current = map.get(row.messageId) || [];
            current.push({
                emoji: row.emoji,
                count: Number(row.count),
                reacted: Boolean(row.reacted)
            });
            map.set(row.messageId, current);
        });

        return map;
    }

    function formatMessages(rows, reactionMap) {
        return rows.map((row) => ({
            id: row.id,
            sender: row.sender,
            recipient: row.recipient,
            text: row.text,
            createdAt: row.createdAt,
            editedAt: row.editedAt,
            reactions: reactionMap.get(row.id) || [],
            isPinned: Boolean(row.isPinned)
        }));
    }

    async function loadMessages(username, partner, limit) {
        const result = await dbPool.query(
            "SELECT m.id, m.sender_username AS sender, m.recipient_username AS recipient, m.body AS text, " +
            "m.created_at AS \"createdAt\", m.edited_at AS \"editedAt\", " +
            "EXISTS (SELECT 1 FROM helix_dm_pins p WHERE p.message_id = m.id AND p.owner_username = $1) AS \"isPinned\" " +
            "FROM helix_dm_messages m " +
            "WHERE (m.sender_username = $1 AND m.recipient_username = $2) " +
            "OR (m.sender_username = $2 AND m.recipient_username = $1) " +
            "ORDER BY m.created_at DESC LIMIT $3",
            [username, partner, limit]
        );

        const rows = result.rows.reverse();
        const reactions = await loadReactionMap(rows.map((row) => row.id), username);
        return formatMessages(rows, reactions);
    }

    async function loadMessageWithReactions(messageId, username) {
        const row = await getMessageRow(messageId, username);
        if (!row) return null;

        const reactions = await loadReactionMap([row.id], username);
        return formatMessages([row], reactions)[0];
    }

    function validateText(value) {
        const text = typeof value === "string" ? value.trim() : "";

        if (!text) {
            throw Object.assign(new Error("Message cannot be empty."), { status: 400 });
        }

        if (text.length > MAX_MESSAGE_LENGTH) {
            throw Object.assign(
                new Error("Message is too long. Keep it under 4000 characters."),
                { status: 400 }
            );
        }

        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
            throw Object.assign(
                new Error("Message contains unsupported control characters."),
                { status: 400 }
            );
        }

        return text;
    }

    function validateEmoji(value) {
        const emoji = typeof value === "string" ? value.trim() : "";

        if (!emoji || emoji.length > 24 || /[\u0000-\u001F\u007F]/.test(emoji)) {
            throw Object.assign(new Error("Invalid reaction."), { status: 400 });
        }

        return emoji;
    }

    router.get("/conversations", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const result = await dbPool.query(
                "SELECT " +
                "u.username, " +
                "u.display_name AS \"displayName\", " +
                "(u.profile_photo IS NOT NULL) AS \"hasProfilePhoto\", " +
                "latest.body AS \"latestText\", " +
                "latest.created_at AS \"latestCreatedAt\", " +
                "COALESCE(unread.unread_count, 0)::int AS \"unreadCount\" " +
                "FROM helix_friendships f " +
                "JOIN helix_users u ON u.username = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END " +
                "LEFT JOIN LATERAL (" +
                "SELECT m.body, m.created_at FROM helix_dm_messages m " +
                "WHERE (m.sender_username = $1 AND m.recipient_username = u.username) " +
                "OR (m.sender_username = u.username AND m.recipient_username = $1) " +
                "ORDER BY m.created_at DESC LIMIT 1" +
                ") latest ON TRUE " +
                "LEFT JOIN LATERAL (" +
                "SELECT COUNT(*) AS unread_count FROM helix_dm_messages m " +
                "WHERE m.sender_username = u.username AND m.recipient_username = $1 AND m.read_at IS NULL" +
                ") unread ON TRUE " +
                "WHERE (f.user_a = $1 OR f.user_b = $1) " +
                "AND NOT EXISTS (" +
                "SELECT 1 FROM helix_blocked_accounts b " +
                "WHERE (b.blocker_username = $1 AND b.blocked_username = u.username) " +
                "OR (b.blocker_username = u.username AND b.blocked_username = $1)" +
                ") " +
                "ORDER BY CASE WHEN latest.created_at IS NULL THEN 1 ELSE 0 END, " +
                "latest.created_at DESC NULLS LAST, LOWER(u.display_name), LOWER(u.username)",
                [user.username]
            );

            return res.json({
                ok: true,
                conversations: result.rows.map((row) => ({
                    username: row.username,
                    displayName: row.displayName,
                    profilePhoto: row.hasProfilePhoto
                        ? publicProfilePhotoUrl(row.username)
                        : null,
                    nickname: null,
                    latestMessage: row.latestText
                        ? {
                            text: row.latestText,
                            createdAt: row.latestCreatedAt
                        }
                        : null,
                    unreadCount: Number(row.unreadCount || 0)
                }))
            });
        } catch (error) {
            console.error("DM conversation list failed:", error);
            return errorResponse(res, error);
        }
    });

    router.get("/messages", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        const partner = normalizeUsername(req.query.with);

        try {
            await ensureConversationAccess(user.username, partner);

            await dbPool.query(
                "UPDATE helix_dm_messages SET read_at = COALESCE(read_at, NOW()) " +
                "WHERE sender_username = $1 AND recipient_username = $2 AND read_at IS NULL",
                [partner, user.username]
            );

            const requestedLimit = Number(req.query.limit);
            const limit = Number.isFinite(requestedLimit)
                ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_MESSAGES_PER_LOAD)
                : MAX_MESSAGES_PER_LOAD;

            const messages = await loadMessages(user.username, partner, limit);

            return res.json({
                ok: true,
                conversation: { username: partner },
                messages
            });
        } catch (error) {
            console.error("DM message load failed:", error);
            return errorResponse(res, error);
        }
    });

    router.get("/pins", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        const partner = normalizeUsername(req.query.with);

        try {
            await ensureConversationAccess(user.username, partner);

            const result = await dbPool.query(
                "SELECT p.message_id AS \"messageId\", p.pinned_at AS \"pinnedAt\", " +
                "m.sender_username AS sender, m.recipient_username AS recipient, m.body AS text, " +
                "m.created_at AS \"createdAt\", m.edited_at AS \"editedAt\" " +
                "FROM helix_dm_pins p " +
                "JOIN helix_dm_messages m ON m.id = p.message_id " +
                "WHERE p.owner_username = $1 " +
                "AND ((m.sender_username = $1 AND m.recipient_username = $2) " +
                "OR (m.sender_username = $2 AND m.recipient_username = $1)) " +
                "ORDER BY p.pinned_at DESC",
                [user.username, partner]
            );

            const reactions = await loadReactionMap(
                result.rows.map((row) => row.messageId),
                user.username
            );

            const pins = result.rows.map((row) => ({
                id: row.messageId,
                sender: row.sender,
                recipient: row.recipient,
                text: row.text,
                createdAt: row.createdAt,
                editedAt: row.editedAt,
                reactions: reactions.get(row.messageId) || [],
                isPinned: true,
                pinnedAt: row.pinnedAt
            }));

            return res.json({ ok: true, pins });
        } catch (error) {
            console.error("DM pin list failed:", error);
            return errorResponse(res, error);
        }
    });

    router.post("/messages", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const keys = Object.keys(body);

            if (keys.some((key) => key !== "to" && key !== "text")) {
                return res.status(400).json({
                    error: "This text-only message endpoint accepts only a recipient and text."
                });
            }

            const partner = await ensureConversationAccess(
                user.username,
                body.to,
                { allowSend: true }
            );
            const text = validateText(body.text);
            const id = crypto.randomUUID();

            await dbPool.query(
                "INSERT INTO helix_dm_messages (id, sender_username, recipient_username, body) " +
                "VALUES ($1, $2, $3, $4)",
                [id, user.username, partner, text]
            );

            const message = await loadMessageWithReactions(id, user.username);

            return res.status(201).json({
                ok: true,
                message
            });
        } catch (error) {
            console.error("DM message send failed:", error);
            return errorResponse(res, error);
        }
    });

    router.put("/messages/:id", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const messageId = normalizeUsername(req.params.id);
            const text = validateText(req.body && req.body.text);

            const row = await getMessageRow(messageId, user.username);
            if (!row) return res.status(404).json({ error: "Message not found." });
            if (row.sender !== user.username) {
                return res.status(403).json({ error: "You can only edit your own messages." });
            }

            await ensureConversationAccess(user.username, row.recipient);

            const result = await dbPool.query(
                "UPDATE helix_dm_messages SET body = $1, edited_at = NOW() " +
                "WHERE id = $2 AND sender_username = $3 RETURNING id",
                [text, messageId, user.username]
            );

            if (!result.rowCount) {
                return res.status(404).json({ error: "Message no longer exists." });
            }

            const message = await loadMessageWithReactions(messageId, user.username);
            return res.json({ ok: true, message });
        } catch (error) {
            console.error("DM message edit failed:", error);
            return errorResponse(res, error);
        }
    });

    router.delete("/messages/:id", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const messageId = normalizeUsername(req.params.id);
            const row = await getMessageRow(messageId, user.username);

            if (!row) return res.status(404).json({ error: "Message not found." });
            if (row.sender !== user.username) {
                return res.status(403).json({ error: "You can only delete your own messages." });
            }

            await ensureConversationAccess(user.username, row.recipient);

            const result = await dbPool.query(
                "DELETE FROM helix_dm_messages WHERE id = $1 AND sender_username = $2 RETURNING id",
                [messageId, user.username]
            );

            if (!result.rowCount) {
                return res.status(404).json({ error: "Message no longer exists." });
            }

            return res.json({ ok: true, deletedId: messageId });
        } catch (error) {
            console.error("DM message delete failed:", error);
            return errorResponse(res, error);
        }
    });

    router.post("/messages/:id/reaction", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const messageId = normalizeUsername(req.params.id);
            const row = await getMessageRow(messageId, user.username);
            if (!row) return res.status(404).json({ error: "Message not found." });

            const partner = row.sender === user.username ? row.recipient : row.sender;
            await ensureConversationAccess(user.username, partner);

            const emoji = validateEmoji(req.body && req.body.emoji);
            const reacted = req.body && req.body.reacted !== false;

            if (reacted) {
                await dbPool.query(
                    "INSERT INTO helix_dm_reactions (message_id, username, emoji) " +
                    "VALUES ($1, $2, $3) ON CONFLICT (message_id, username, emoji) DO NOTHING",
                    [messageId, user.username, emoji]
                );
            } else {
                await dbPool.query(
                    "DELETE FROM helix_dm_reactions WHERE message_id = $1 AND username = $2 AND emoji = $3",
                    [messageId, user.username, emoji]
                );
            }

            const message = await loadMessageWithReactions(messageId, user.username);
            return res.json({ ok: true, message });
        } catch (error) {
            console.error("DM reaction failed:", error);
            return errorResponse(res, error);
        }
    });

    router.post("/messages/:id/pin", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const messageId = normalizeUsername(req.params.id);
            const row = await getMessageRow(messageId, user.username);
            if (!row) return res.status(404).json({ error: "Message not found." });

            const partner = row.sender === user.username ? row.recipient : row.sender;
            await ensureConversationAccess(user.username, partner);

            const pinned = req.body && req.body.pinned !== false;

            if (pinned) {
                await dbPool.query(
                    "INSERT INTO helix_dm_pins (message_id, owner_username) " +
                    "VALUES ($1, $2) ON CONFLICT (message_id, owner_username) DO NOTHING",
                    [messageId, user.username]
                );
            } else {
                await dbPool.query(
                    "DELETE FROM helix_dm_pins WHERE message_id = $1 AND owner_username = $2",
                    [messageId, user.username]
                );
            }

            const message = await loadMessageWithReactions(messageId, user.username);
            return res.json({ ok: true, message });
        } catch (error) {
            console.error("DM pin update failed:", error);
            return errorResponse(res, error);
        }
    });

    router.post("/messages/:id/forward", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const keys = Object.keys(body);

            if (keys.some((key) => key !== "to")) {
                return res.status(400).json({
                    error: "Forwarding accepts only a destination."
                });
            }

            const messageId = normalizeUsername(req.params.id);
            const source = await getMessageRow(messageId, user.username);
            if (!source) return res.status(404).json({ error: "Message not found." });

            const sourcePartner =
                source.sender === user.username ? source.recipient : source.sender;

            await ensureConversationAccess(user.username, sourcePartner);

            const destination = await ensureConversationAccess(
                user.username,
                body.to,
                { allowSend: true }
            );

            const id = crypto.randomUUID();

            await dbPool.query(
                "INSERT INTO helix_dm_messages (id, sender_username, recipient_username, body) " +
                "VALUES ($1, $2, $3, $4)",
                [id, user.username, destination, source.text]
            );

            const message = await loadMessageWithReactions(id, user.username);

            return res.status(201).json({
                ok: true,
                message
            });
        } catch (error) {
            console.error("DM forward failed:", error);
            return errorResponse(res, error);
        }
    });

    return router;
}

module.exports = createDMRouter;
