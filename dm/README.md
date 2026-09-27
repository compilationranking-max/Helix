# Helix DM module

This directory is the active Direct Message implementation. It is modular and intentionally separate from the main app.js application logic.

## Frontend modules

- dm.js — bootstrap and navigation hookup.
- dm-state.js — single DM state object for conversations, messages, pins, replies, pending media, context menu, info panel, viewer and request-control state.
- dm-api.js — fetch/API requests only.
- dm-render.js — DOM rendering for conversations, messages, replies, media, actions, reactions, emoji picker, pins, forwarding, info, empty/loading/error states and composer previews.
- dm-actions.js — interaction and mutation orchestration.

No old monolithic DM implementation from the archive is active.

## Message model

Active message objects contain server-backed text, read, edit, delete, reaction, pin, media and reply fields.

## Message actions

Supported:
- text send/receive
- edit own active text messages
- soft-delete own messages
- copy text/link
- quick reactions
- full emoji picker
- pin/unpin
- pinned messages
- forwarding
- desktop context menu
- private nicknames
- conversation info
- message search and media filename search
- unread/read state
- DM notification feed integration

## Media

Photos and videos are supported up to 10 MB.

The flow is: file selection -> client validation -> local ObjectURL preview -> attachment state -> send -> server-side validation -> database storage -> media URL in the returned message.

The active implementation supports image and video media and does not upload merely because a file was selected.

## Replies

Replies are first-class relationships through reply_to_id -> helix_dm_messages.id.

Reply selection lives in state.reply until send. The send path snapshots the selected reply before network work. The backend validates the target before insert and returns expanded reply fields. The renderer puts the quoted preview inside .dm-message-bubble.

Reply references can fetch the original single message when it is outside the current 200-message window.

Deleted originals use soft deletion so the relationship remains renderable; the reply preview shows Original message deleted.

One reply-selection path is shared by the dedicated Reply button, context menu and touch swipe gesture.

## Database

Active tables:
- helix_dm_messages
- helix_dm_message_reactions
- helix_dm_message_pins
- helix_dm_conversation_nicknames

migrations/dm/001-full-features.sql is additive and non-destructive. It adds media columns, reply_to_id, deleted_at, validation constraints and the reply index without deleting existing DM data.

## API

Mounted at /api/dm:
- GET /conversations
- GET /messages?with=username
- GET /messages/:messageId
- GET /conversations/:username/info
- PATCH /conversations/:username/nickname
- GET /pins?with=username
- POST /messages
- POST /messages/media
- PUT /messages/:id
- DELETE /messages/:id
- POST /messages/:id/reaction
- POST /messages/:id/pin
- POST /messages/:id/forward
- GET /notifications
- GET /media/:messageId

All mutations are authenticated and server-authorized using the active session, friendship, blocking and DM-privacy checks.

## Race safety

Conversation loads use AbortController, request serial/version checks and active-conversation checks.

Polling does not intentionally overlap active message loads.

Pinned messages are loaded when the panel opens or after pin/unpin mutations, not on every poll.

## Archived implementation

The original DM implementation remains only as a feature reference on dm-archive-before-rebuild. The active DM modules do not import it.