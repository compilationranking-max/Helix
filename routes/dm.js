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
    const MAX_MESSAGES_PER_LOAD = 200;
    const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
    const SUPPORTED_MEDIA_MIMES = new Set([
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/ogg"
    ]);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    function fail(message, status = 400) {
        throw Object.assign(new Error(message), { status });
    }

    function errorResponse(res, error) {
        return res.status(Number(error?.status) || 500).json({
            error: error?.message || "Direct message operation failed."
        });
    }

    function isUuid(value) {
        return UUID_RE.test(String(value || "").trim());
    }

    async function requireDMDatabase(res) {
        if (!dbPool) {
            res.status(503).json({
                error: "Direct messages require the Helix cloud database."
            });
            return false;
        }

        await requireDatabase();
        return true;
    }

    async function areFriends(usernameA, usernameB) {
        const result = await dbPool.query(
            "SELECT 1 FROM helix_friendships " +
            "WHERE user_a = LEAST($1, $2) " +
            "AND user_b = GREATEST($1, $2) LIMIT 1",
            [usernameA, usernameB]
        );

        return result.rowCount > 0;
    }

    async function ensureConversationAccess(username, partner, options = {}) {
        const normalizedPartner = normalizeUsername(partner);

        if (!validUsername(normalizedPartner) || normalizedPartner === username) {
            fail("Invalid conversation.");
        }

        const target = await dbPool.query(
            "SELECT username FROM helix_users WHERE username = $1",
            [normalizedPartner]
        );

        if (!target.rowCount) {
            fail("That Helix account does not exist.", 404);
        }

        if (await isBlockedEitherWay(username, normalizedPartner)) {
            fail("You cannot interact with this account.", 403);
        }

        const friends = await areFriends(username, normalizedPartner);

        if (!friends) {
            fail("You can only message people who are currently your friends.", 403);
        }

        if (options.allowSend) {
            const privacy = await getPrivacySetting(
                normalizedPartner,
                "direct-messages"
            );

            if (privacy === "NOBODY") {
                fail("This user is not accepting direct messages right now.", 403);
            }
        }

        return normalizedPartner;
    }

    function validateText(value, allowEmpty = false) {
        const text = typeof value === "string" ? value.trim() : "";

        if (!allowEmpty && !text) {
            fail("Message cannot be empty.");
        }

        if (text.length > MAX_MESSAGE_LENGTH) {
            fail("Message is too long. Keep it under 4000 characters.");
        }

        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
            fail("Message contains unsupported control characters.");
        }

        return text;
    }

    function sanitizeMediaName(value) {
        const text = typeof value === "string"
            ? value.replace(/[\u0000-\u001F\u007F]/g, "").trim()
            : "";

        return text.slice(0, 180) || "attachment";
    }

    function validateReaction(value) {
        const emoji = typeof value === "string" ? value.trim() : "";

        if (!emoji || emoji.length > 32 || /[\u0000-\u001F\u007F]/.test(emoji)) {
            fail("Invalid reaction.");
        }

        return emoji;
    }

    function decodeMediaDataUrl(value) {
        const dataUrl = typeof value === "string" ? value.trim() : "";
        const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(dataUrl);

        if (!match) {
            fail("Choose a valid photo or video file.");
        }

        const encoded = match[2].replace(/\s+/g, "");

        if (!encoded || encoded.length % 4 !== 0) {
            fail("Attachment data is invalid.");
        }

        let buffer;

        try {
            buffer = Buffer.from(encoded, "base64");
        } catch {
            fail("Attachment data is invalid.");
        }

        const expectedPadding = encoded.endsWith("==")
            ? 2
            : encoded.endsWith("=")
                ? 1
                : 0;

        const expectedBytes =
            3 * (encoded.length / 4) - expectedPadding;

        if (buffer.length !== expectedBytes) {
            fail("Attachment data could not be verified.");
        }

        if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) {
            fail("Attachment must be 10 MB or smaller.");
        }

        return {
            buffer,
            declaredMime: String(match[1]).toLowerCase()
        };
    }

    function verifyMedia(buffer, declaredMime) {
        const mime = String(declaredMime || "").toLowerCase().trim();

        if (
            !mime.startsWith("image/") &&
            !mime.startsWith("video/")
        ) {
            fail("Only photos and videos can be sent in DMs.");
        }

        if (!SUPPORTED_MEDIA_MIMES.has(mime)) {
            fail("That photo or video format is not supported by Helix.");
        }

        let actualMime = null;

        if (
            buffer.length >= 8 &&
            buffer[0] === 0x89 &&
            buffer.subarray(1, 8).equals(
                Buffer.from([0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            )
        ) {
            actualMime = "image/png";
        } else if (
            buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff
        ) {
            actualMime = "image/jpeg";
        } else if (
            buffer.length >= 6 &&
            ["GIF87a", "GIF89a"].includes(
                buffer.subarray(0, 6).toString("ascii")
            )
        ) {
            actualMime = "image/gif";
        } else if (
            buffer.length >= 12 &&
            buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
            buffer.subarray(8, 12).toString("ascii") === "WEBP"
        ) {
            actualMime = "image/webp";
        } else if (
            buffer.length >= 4 &&
            buffer.subarray(0, 4).equals(
                Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
            )
        ) {
            actualMime = "video/webm";
        } else if (
            buffer.length >= 12 &&
            buffer.subarray(4, 8).toString("ascii") === "ftyp"
        ) {
            actualMime = mime === "video/quicktime"
                ? "video/quicktime"
                : "video/mp4";
        } else if (
            buffer.length >= 4 &&
            buffer.subarray(0, 4).toString("ascii") === "OggS"
        ) {
            actualMime = "video/ogg";
        }

        if (!actualMime) {
            fail("Helix could not verify that attachment.");
        }

        const kind = actualMime.startsWith("video/") ? "video" : "image";

        if (!mime.startsWith(kind + "/")) {
            fail("Attachment type does not match its contents.");
        }

        return {
            mime: actualMime,
            kind
        };
    }

    const MESSAGE_SELECT =
        "SELECT " +
        "m.id, " +
        "m.sender_username AS sender, " +
        "m.recipient_username AS recipient, " +
        "m.body AS text, " +
        "m.created_at AS \"createdAt\", " +
        "m.read_at AS \"readAt\", " +
        "m.edited_at AS \"editedAt\", " +
        "m.deleted_at AS \"deletedAt\", " +
        "m.media_mime AS \"mediaMime\", " +
        "m.media_name AS \"mediaName\", " +
        "m.media_size AS \"mediaSize\", " +
        "m.media_kind AS \"mediaKind\", " +
        "CASE WHEN m.media_data IS NOT NULL THEN '/api/dm/media/' || m.id::text ELSE NULL END AS \"mediaUrl\", " +
        "EXISTS (SELECT 1 FROM helix_dm_message_pins p WHERE p.message_id = m.id AND p.owner_username = $1) AS \"isPinned\", " +
        "m.reply_to_id AS \"replyToId\", " +
        "r.sender_username AS \"replySender\", " +
        "r.body AS \"replyText\", " +
        "r.deleted_at AS \"replyDeletedAt\", " +
        "r.media_name AS \"replyMediaName\", " +
        "r.media_kind AS \"replyMediaKind\", " +
        "CASE WHEN r.media_data IS NOT NULL THEN '/api/dm/media/' || r.id::text ELSE NULL END AS \"replyMediaUrl\" " +
        "FROM helix_dm_messages m " +
        "LEFT JOIN helix_dm_messages r ON r.id = m.reply_to_id ";

    function mapRow(row, reactions) {
        const replyToId = row.replyToId || null;
        const replyDeleted = Boolean(row.replyDeletedAt);

        return {
            id: row.id,
            sender: row.sender,
            recipient: row.recipient,
            text: row.deletedAt ? "" : row.text,
            createdAt: row.createdAt,
            readAt: row.readAt || null,
            editedAt: row.editedAt || null,
            reactions: reactions?.get(row.id) || [],
            isPinned: Boolean(row.isPinned),
            isDeleted: Boolean(row.deletedAt),
            mediaUrl: row.mediaUrl || null,
            mediaMime: row.mediaMime || null,
            mediaName: row.mediaName || null,
            mediaSize: row.mediaSize ? Number(row.mediaSize) : null,
            mediaKind: row.mediaKind || null,
            replyToId,
            replySender: row.replySender || null,
            replyText: replyDeleted ? null : (row.replyText || null),
            replyMediaUrl: row.replyMediaUrl || null,
            replyMediaName: row.replyMediaName || null,
            replyMediaKind: row.replyMediaKind || null,
            replyDeleted,
            replyPreview: replyToId
                ? {
                    id: replyToId,
                    sender: row.replySender || "",
                    text: replyDeleted ? null : (row.replyText || ""),
                    mediaUrl: row.replyMediaUrl || null,
                    mediaName: row.replyMediaName || null,
                    mediaKind: row.replyMediaKind || null,
                    deleted: replyDeleted
                }
                : null
        };
    }

    async function loadReactionMap(messageIds, username) {
        if (!messageIds.length) return new Map();

        const result = await dbPool.query(
            "SELECT message_id AS \"messageId\", emoji, COUNT(*)::int AS count, " +
            "BOOL_OR(username = $2) AS reacted " +
            "FROM helix_dm_message_reactions " +
            "WHERE message_id = ANY($1::uuid[]) " +
            "GROUP BY message_id, emoji " +
            "ORDER BY emoji",
            [messageIds, username]
        );

        const map = new Map();

        for (const row of result.rows) {
            const list = map.get(row.messageId) || [];
            list.push({
                emoji: row.emoji,
                count: Number(row.count),
                reacted: Boolean(row.reacted)
            });
            map.set(row.messageId, list);
        }

        return map;
    }

    async function getMessageRow(messageId, username) {
        const result = await dbPool.query(
            MESSAGE_SELECT +
            "WHERE m.id = $2 " +
            "AND (m.sender_username = $3 OR m.recipient_username = $3) " +
            "LIMIT 1",
            [username, messageId, username]
        );

        return result.rows[0] || null;
    }

    async function getMessage(messageId, username) {
        const row = await getMessageRow(messageId, username);
        if (!row) return null;

        const reactions = await loadReactionMap([row.id], username);
        return mapRow(row, reactions);
    }

    async function loadConversation(username, partner, limit = MAX_MESSAGES_PER_LOAD) {
        const result = await dbPool.query(
            MESSAGE_SELECT +
            "WHERE ((m.sender_username = $2 AND m.recipient_username = $3) " +
            "OR (m.sender_username = $3 AND m.recipient_username = $2)) " +
            "ORDER BY m.created_at DESC " +
            "LIMIT $4",
            [username, username, partner, limit]
        );

        const rows = result.rows.reverse();
        const reactions = await loadReactionMap(
            rows.map((row) => row.id),
            username
        );

        return rows.map((row) => mapRow(row, reactions));
    }

    async function validateReplyTarget(replyToId, username, recipient) {
        const id = String(replyToId || "").trim();

        if (!id) return null;

        if (!isUuid(id)) {
            fail("The selected reply message is invalid.");
        }

        const row = await getMessageRow(id, username);

        if (!row) {
            fail("Reply target not found.");
        }

        if (row.deletedAt) {
            fail("That original message is no longer available.");
        }

        const sameConversation =
            (row.sender === username && row.recipient === recipient) ||
            (row.sender === recipient && row.recipient === username);

        if (!sameConversation) {
            fail("Reply target is outside this conversation.");
        }

        return row;
    }

    async function loadMutationMessage(messageId, username) {
        return getMessage(messageId, username);
    }

    async function insertMessage({ sender, recipient, text, replyToId, media }) {
        const replyTarget = await validateReplyTarget(
            replyToId,
            sender,
            recipient
        );

        const result = await dbPool.query(
            "INSERT INTO helix_dm_messages (" +
            "id, sender_username, recipient_username, body, reply_to_id, " +
            "media_data, media_mime, media_name, media_size, media_kind" +
            ") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) " +
            "RETURNING id",
            [
                crypto.randomUUID(),
                sender,
                recipient,
                text,
                replyToId || null,
                media?.buffer || null,
                media?.mime || null,
                media?.name || null,
                media?.size || null,
                media?.kind || null
            ]
        );

        const message = await loadMutationMessage(
            result.rows[0].id,
            sender
        );

        return {
            message,
            replyTarget
        };
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
                "n.nickname AS \"nickname\", " +
                "latest.body AS \"latestText\", " +
                "latest.created_at AS \"latestCreatedAt\", " +
                "latest.media_kind AS \"latestMediaKind\", " +
                "COALESCE(unread.unread_count,0)::int AS \"unreadCount\" " +
                "FROM helix_friendships f " +
                "JOIN helix_users u ON u.username = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END " +
                "LEFT JOIN helix_dm_conversation_nicknames n ON n.owner_username = $1 AND n.friend_username = u.username " +
                "LEFT JOIN LATERAL (" +
                    "SELECT m.body, m.created_at, m.media_kind " +
                    "FROM helix_dm_messages m " +
                    "WHERE ((m.sender_username = $1 AND m.recipient_username = u.username) " +
                    "OR (m.sender_username = u.username AND m.recipient_username = $1)) " +
                    "AND m.deleted_at IS NULL " +
                    "ORDER BY m.created_at DESC LIMIT 1" +
                ") latest ON TRUE " +
                "LEFT JOIN LATERAL (" +
                    "SELECT COUNT(*) AS unread_count " +
                    "FROM helix_dm_messages m " +
                    "WHERE m.sender_username = u.username " +
                    "AND m.recipient_username = $1 " +
                    "AND m.read_at IS NULL " +
                    "AND m.deleted_at IS NULL" +
                ") unread ON TRUE " +
                "WHERE (f.user_a = $1 OR f.user_b = $1) " +
                "AND NOT EXISTS (" +
                    "SELECT 1 FROM helix_blocked_accounts b " +
                    "WHERE (b.blocker_username = $1 AND b.blocked_username = u.username) " +
                    "OR (b.blocker_username = u.username AND b.blocked_username = $1)" +
                ") " +
                "ORDER BY CASE WHEN latest.created_at IS NULL THEN 1 ELSE 0 END, " +
                "latest.created_at DESC NULLS LAST, " +
                "LOWER(COALESCE(n.nickname,u.display_name)), LOWER(u.username)",
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
                    nickname: row.nickname || null,
                    latestMessage: row.latestCreatedAt
                        ? {
                            text: row.latestText || "",
                            mediaKind: row.latestMediaKind || null,
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
                "UPDATE helix_dm_messages SET read_at = COALESCE(read_at,NOW()) " +
                "WHERE sender_username = $1 AND recipient_username = $2 " +
                "AND read_at IS NULL AND deleted_at IS NULL",
                [partner, user.username]
            );

            const requestedLimit = Number(req.query.limit);
            const limit = Number.isFinite(requestedLimit)
                ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_MESSAGES_PER_LOAD)
                : MAX_MESSAGES_PER_LOAD;

            const messages = await loadConversation(
                user.username,
                partner,
                limit
            );

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

    router.get("/messages/:messageId", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        const id = String(req.params.messageId || "");

        try {
            if (!isUuid(id)) fail("Invalid message.");

            const message = await getMessage(id, user.username);
            if (!message) {
                return res.status(404).json({ error: "Message not found." });
            }

            const partner =
                message.sender === user.username
                    ? message.recipient
                    : message.sender;

            await ensureConversationAccess(user.username, partner);

            return res.json({ ok: true, message });
        } catch (error) {
            console.error("DM single-message load failed:", error);
            return errorResponse(res, error);
        }
    });

    router.get("/conversations/:username/info", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const partner = await ensureConversationAccess(
                user.username,
                req.params.username
            );

            const profile = await dbPool.query(
                "SELECT username, display_name AS \"displayName\", " +
                "(profile_photo IS NOT NULL) AS \"hasProfilePhoto\" " +
                "FROM helix_users WHERE username = $1",
                [partner]
            );

            const media = await dbPool.query(
                "SELECT id, sender_username AS sender, " +
                "media_name AS \"mediaName\", media_size AS \"mediaSize\", " +
                "media_kind AS \"mediaKind\", created_at AS \"createdAt\", " +
                "CASE WHEN media_data IS NOT NULL THEN '/api/dm/media/' || id::text ELSE NULL END AS \"mediaUrl\" " +
                "FROM helix_dm_messages " +
                "WHERE ((sender_username = $1 AND recipient_username = $2) " +
                "OR (sender_username = $2 AND recipient_username = $1)) " +
                "AND deleted_at IS NULL AND media_data IS NOT NULL " +
                "ORDER BY created_at DESC LIMIT 60",
                [user.username, partner]
            );

            return res.json({
                ok: true,
                conversation: {
                    username: profile.rows[0]?.username || partner,
                    displayName: profile.rows[0]?.displayName || partner,
                    profilePhoto: profile.rows[0]?.hasProfilePhoto
                        ? publicProfilePhotoUrl(partner)
                        : null,
                    friendship: "Friends"
                },
                sharedMedia: media.rows,
                files: []
            });
        } catch (error) {
            console.error("DM info failed:", error);
            return errorResponse(res, error);
        }
    });

    router.patch("/conversations/:username/nickname", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        const nickname =
            typeof req.body?.nickname === "string"
                ? req.body.nickname.trim().replace(/\s+/g, " ")
                : "";

        try {
            const partner = await ensureConversationAccess(
                user.username,
                req.params.username
            );

            if (nickname.length > 50 || /[\u0000-\u001F\u007F]/.test(nickname)) {
                fail("Nickname must be 50 characters or fewer.");
            }

            if (!nickname) {
                await dbPool.query(
                    "DELETE FROM helix_dm_conversation_nicknames " +
                    "WHERE owner_username = $1 AND friend_username = $2",
                    [user.username, partner]
                );

                return res.json({ ok: true, nickname: null });
            }

            await dbPool.query(
                "INSERT INTO helix_dm_conversation_nicknames " +
                "(owner_username, friend_username, nickname) " +
                "VALUES ($1,$2,$3) " +
                "ON CONFLICT (owner_username,friend_username) " +
                "DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = NOW()",
                [user.username, partner, nickname]
            );

            return res.json({ ok: true, nickname });
        } catch (error) {
            console.error("DM nickname update failed:", error);
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
                "SELECT m.id, m.sender_username AS sender, " +
                "m.recipient_username AS recipient, " +
                "m.body AS text, m.created_at AS \"createdAt\", " +
                "m.edited_at AS \"editedAt\", m.deleted_at AS \"deletedAt\", " +
                "m.media_name AS \"mediaName\", m.media_size AS \"mediaSize\", " +
                "m.media_kind AS \"mediaKind\", " +
                "CASE WHEN m.media_data IS NOT NULL THEN '/api/dm/media/' || m.id::text ELSE NULL END AS \"mediaUrl\", " +
                "p.pinned_at AS \"pinnedAt\" " +
                "FROM helix_dm_message_pins p " +
                "JOIN helix_dm_messages m ON m.id = p.message_id " +
                "WHERE p.owner_username = $1 " +
                "AND ((m.sender_username = $1 AND m.recipient_username = $2) " +
                "OR (m.sender_username = $2 AND m.recipient_username = $1)) " +
                "ORDER BY p.pinned_at DESC",
                [user.username, partner]
            );

            return res.json({
                ok: true,
                pins: result.rows.map((row) => ({
                    id: row.id,
                    sender: row.sender,
                    recipient: row.recipient,
                    text: row.deletedAt ? "" : row.text,
                    createdAt: row.createdAt,
                    editedAt: row.editedAt,
                    mediaUrl: row.mediaUrl || null,
                    mediaName: row.mediaName || null,
                    mediaSize: row.mediaSize ? Number(row.mediaSize) : null,
                    mediaKind: row.mediaKind || null,
                    pinnedAt: row.pinnedAt,
                    isDeleted: Boolean(row.deletedAt)
                }))
            });
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
            const allowed = new Set(["to", "text", "replyToId"]);

            if (Object.keys(body).some((key) => !allowed.has(key))) {
                return res.status(400).json({
                    error: "This endpoint accepts recipient, text and replyToId."
                });
            }

            const recipient = await ensureConversationAccess(
                user.username,
                body.to,
                { allowSend: true }
            );

            const text = validateText(body.text);
            const replyToId = String(body.replyToId || "").trim();

            const { message } = await insertMessage({
                sender: user.username,
                recipient,
                text,
                replyToId,
                media: null
            });

            return res.status(201).json({
                ok: true,
                message
            });
        } catch (error) {
            console.error("DM text send failed:", error);
            return errorResponse(res, error);
        }
    });

    router.post("/messages/media", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};

            const recipient = await ensureConversationAccess(
                user.username,
                body.to,
                { allowSend: true }
            );

            const text = validateText(body.text, true);
            const replyToId = String(body.replyToId || "").trim();
            const incoming = body.media;

            if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
                fail("Choose a photo or video to attach.");
            }

            const decoded = decodeMediaDataUrl(incoming.dataUrl);
            const verified = verifyMedia(
                decoded.buffer,
                decoded.declaredMime
            );

            if (
                incoming.size !== undefined &&
                Number(incoming.size) !== decoded.buffer.length
            ) {
                fail("The attachment size could not be verified.");
            }

            const { message } = await insertMessage({
                sender: user.username,
                recipient,
                text,
                replyToId,
                media: {
                    buffer: decoded.buffer,
                    mime: verified.mime,
                    kind: verified.kind,
                    size: decoded.buffer.length,
                    name: sanitizeMediaName(incoming.name)
                }
            });

            return res.status(201).json({
                ok: true,
                message
            });
        } catch (error) {
            console.error("DM media send failed:", error);
            return errorResponse(res, error);
        }
    });

    router.put("/messages/:id", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        const id = String(req.params.id || "");

        try {
            if (!isUuid(id)) fail("Invalid message.");

            const text = validateText(req.body?.text);
            const current = await getMessageRow(id, user.username);

            if (!current) {
                return res.status(404).json({ error: "Message not found." });
            }

            if (
                current.sender !== user.username ||
                current.mediaMime ||
                current.deletedAt
            ) {
                return res.status(403).json({
                    error: "Only your active text messages can be edited."
                });
            }

            await ensureConversationAccess(
                user.username,
                current.recipient
            );

            await dbPool.query(
                "UPDATE helix_dm_messages SET body = $1, edited_at = NOW() " +
                "WHERE id = $2 AND sender_username = $3 AND deleted_at IS NULL",
                [text, id, user.username]
            );

            const message = await loadMutationMessage(
                id,
                user.username
            );

            return res.json({ ok: true, message });
        } catch (error) {
            console.error("DM edit failed:", error);
            return errorResponse(res, error);
        }
    });

    router.delete("/messages/:id", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        const id = String(req.params.id || "");

        try {
            if (!isUuid(id)) fail("Invalid message.");

            const current = await getMessageRow(id, user.username);

            if (!current) {
                return res.status(404).json({ error: "Message not found." });
            }

            if (current.sender !== user.username) {
                return res.status(403).json({
                    error: "You can only delete your own messages."
                });
            }

            await ensureConversationAccess(
                user.username,
                current.recipient
            );

            await dbPool.query(
                "UPDATE helix_dm_messages SET " +
                "body = '', media_data = NULL, media_mime = NULL, " +
                "media_name = NULL, media_size = NULL, media_kind = NULL, " +
                "edited_at = NULL, deleted_at = NOW() " +
                "WHERE id = $1 AND sender_username = $2 AND deleted_at IS NULL",
                [id, user.username]
            );

            await dbPool.query(
                "DELETE FROM helix_dm_message_pins WHERE message_id = $1",
                [id]
            );

            return res.json({
                ok: true,
                deletedId: id
            });
        } catch (error) {
            console.error("DM delete failed:", error);
            return errorResponse(res, error);
        }
    });

    router.post("/messages/:id/reaction", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        const id = String(req.params.id || "");

        try {
            if (!isUuid(id)) fail("Invalid message.");

            const current = await getMessageRow(id, user.username);
            if (!current) {
                return res.status(404).json({ error: "Message not found." });
            }

            if (current.deletedAt) {
                return res.status(400).json({
                    error: "Deleted messages cannot receive reactions."
                });
            }

            const partner =
                current.sender === user.username
                    ? current.recipient
                    : current.sender;

            await ensureConversationAccess(user.username, partner);

            const emoji = validateReaction(req.body?.emoji);
            const reacted = req.body?.reacted !== false;

            if (reacted) {
                await dbPool.query(
                    "INSERT INTO helix_dm_message_reactions " +
                    "(message_id, username, emoji) " +
                    "VALUES ($1,$2,$3) " +
                    "ON CONFLICT (message_id,username,emoji) DO NOTHING",
                    [id, user.username, emoji]
                );
            } else {
                await dbPool.query(
                    "DELETE FROM helix_dm_message_reactions " +
                    "WHERE message_id = $1 AND username = $2 AND emoji = $3",
                    [id, user.username, emoji]
                );
            }

            const message = await loadMutationMessage(id, user.username);
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

        const id = String(req.params.id || "");

        try {
            if (!isUuid(id)) fail("Invalid message.");

            const current = await getMessageRow(id, user.username);
            if (!current) {
                return res.status(404).json({ error: "Message not found." });
            }

            if (current.deletedAt) {
                return res.status(400).json({
                    error: "Deleted messages cannot be pinned."
                });
            }

            const partner =
                current.sender === user.username
                    ? current.recipient
                    : current.sender;

            await ensureConversationAccess(user.username, partner);

            const pinned = req.body?.pinned !== false;

            if (pinned) {
                await dbPool.query(
                    "INSERT INTO helix_dm_message_pins " +
                    "(message_id, owner_username) VALUES ($1,$2) " +
                    "ON CONFLICT (message_id,owner_username) DO NOTHING",
                    [id, user.username]
                );
            } else {
                await dbPool.query(
                    "DELETE FROM helix_dm_message_pins " +
                    "WHERE message_id = $1 AND owner_username = $2",
                    [id, user.username]
                );
            }

            const message = await loadMutationMessage(id, user.username);
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

        const sourceId = String(req.params.id || "");

        try {
            if (!isUuid(sourceId)) fail("Invalid source message.");

            const source = await getMessageRow(sourceId, user.username);
            if (!source) {
                return res.status(404).json({ error: "Message not found." });
            }

            if (source.deletedAt) {
                return res.status(400).json({
                    error: "Deleted messages cannot be forwarded."
                });
            }

            const sourcePartner =
                source.sender === user.username
                    ? source.recipient
                    : source.sender;

            await ensureConversationAccess(
                user.username,
                sourcePartner
            );

            const destination = await ensureConversationAccess(
                user.username,
                req.body?.to,
                { allowSend: true }
            );

            let media = null;

            if (source.mediaMime) {
                const raw = await dbPool.query(
                    "SELECT media_data, media_mime AS \"mediaMime\", " +
                    "media_name AS \"mediaName\", media_size AS \"mediaSize\", " +
                    "media_kind AS \"mediaKind\" " +
                    "FROM helix_dm_messages WHERE id = $1",
                    [sourceId]
                );

                const mediaRow = raw.rows[0];

                if (mediaRow?.media_data) {
                    media = {
                        buffer: mediaRow.media_data,
                        mime: mediaRow.mediaMime,
                        name: mediaRow.mediaName,
                        size: Number(mediaRow.mediaSize),
                        kind: mediaRow.mediaKind
                    };
                }
            }

            const { message } = await insertMessage({
                sender: user.username,
                recipient: destination,
                text: source.text || "",
                replyToId: null,
                media
            });

            return res.status(201).json({
                ok: true,
                message
            });
        } catch (error) {
            console.error("DM forward failed:", error);
            return errorResponse(res, error);
        }
    });

    router.get("/notifications", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        try {
            const messages = await dbPool.query(
                "SELECT m.id, m.sender_username AS sender, " +
                "m.recipient_username AS recipient, m.body AS text, " +
                "m.created_at AS \"createdAt\", m.media_kind AS \"mediaKind\", " +
                "m.media_name AS \"mediaName\" " +
                "FROM helix_dm_messages m " +
                "WHERE m.recipient_username = $1 " +
                "AND m.read_at IS NULL AND m.deleted_at IS NULL " +
                "AND m.sender_username <> $1 " +
                "AND NOT EXISTS (" +
                    "SELECT 1 FROM helix_blocked_accounts b " +
                    "WHERE (b.blocker_username = $1 AND b.blocked_username = m.sender_username) " +
                    "OR (b.blocker_username = m.sender_username AND b.blocked_username = $1)" +
                ") " +
                "ORDER BY m.created_at DESC LIMIT 20",
                [user.username]
            );

            const count = await dbPool.query(
                "SELECT COUNT(*)::int AS count FROM helix_dm_messages " +
                "WHERE recipient_username = $1 " +
                "AND read_at IS NULL AND deleted_at IS NULL " +
                "AND sender_username <> $1 " +
                "AND NOT EXISTS (" +
                    "SELECT 1 FROM helix_blocked_accounts b " +
                    "WHERE (b.blocker_username = $1 AND b.blocked_username = helix_dm_messages.sender_username) " +
                    "OR (b.blocker_username = helix_dm_messages.sender_username AND b.blocked_username = $1)" +
                ")",
                [user.username]
            );

            return res.json({
                ok: true,
                unread: Number(count.rows[0]?.count || 0),
                messages: messages.rows
            });
        } catch (error) {
            console.error("DM notifications failed:", error);
            return errorResponse(res, error);
        }
    });

    router.get("/media/:messageId", async (req, res) => {
        const user = await requireCurrentUser(req, res);
        if (!user) return;
        if (!(await requireDMDatabase(res))) return;

        const id = String(req.params.messageId || "");

        try {
            if (!isUuid(id)) fail("Invalid media.");

            const result = await dbPool.query(
                "SELECT media_data, media_mime, media_name, deleted_at " +
                "FROM helix_dm_messages WHERE id = $1 " +
                "AND media_data IS NOT NULL " +
                "AND (sender_username = $2 OR recipient_username = $2)",
                [id, user.username]
            );

            const row = result.rows[0];

            if (!row || row.deleted_at) {
                return res.status(404).json({ error: "Media not found." });
            }

            const conversationPartner =
                row.sender_username === user.username
                    ? row.recipient_username
                    : row.sender_username;

            await ensureConversationAccess(
                user.username,
                conversationPartner
            );

            res.setHeader(
                "Content-Type",
                row.media_mime || "application/octet-stream"
            );
            res.setHeader(
                "Content-Disposition",
                "inline; filename*=UTF-8''" +
                encodeURIComponent(row.media_name || "attachment")
            );
            res.setHeader(
                "Cache-Control",
                "private, max-age=3600"
            );
            res.setHeader(
                "X-Content-Type-Options",
                "nosniff"
            );

            return res.end(row.media_data);
        } catch (error) {
            console.error("DM media load failed:", error);
            return errorResponse(res, error);
        }
    });

    return router;
}

module.exports = createDMRouter;
