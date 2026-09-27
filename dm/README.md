# Helix DM module

This directory contains the clean Direct Message rebuild. The previous implementation remains available only on the archived branch \`dm-archive-before-rebuild\`.

## Frontend structure

- \`dm.js\` — module bootstrap.
- \`dm-state.js\` — single DM state object, active conversation, loaded messages, searches, loading state and race-control state.
- \`dm-api.js\` — API requests only.
- \`dm-render.js\` — conversation rows, message bubbles, search results, empty/loading/error states, pinned panel, emoji picker and forwarding UI.
- \`dm-actions.js\` — event handling and message actions.

The files are loaded in that order by \`app.html\` because Helix currently uses CommonJS and classic browser scripts rather than frontend ES modules.

## Active message model

The browser receives only:

\`\`\`
{
  id,
  sender,
  recipient,
  text,
  createdAt,
  editedAt,
  reactions,
  isPinned
}
\`\`\`

There are no active message media fields or relationship fields for future features.

## Database

The active schema is created by the existing database initialization in \`server.js\`:

- \`helix_dm_messages\`
- \`helix_dm_message_reactions\`
- \`helix_dm_message_pins\`

The message table stores sender, recipient, body, timestamps and read state. Reactions and pins are separate relationships.

## API

Mounted at \`/api/dm\`:

- \`GET /conversations\`
- \`GET /messages?with=username\`
- \`GET /pins?with=username\`
- \`POST /messages\`
- \`PUT /messages/:id\`
- \`DELETE /messages/:id\`
- \`POST /messages/:id/reaction\`
- \`POST /messages/:id/pin\`
- \`POST /messages/:id/forward\`

Copying text is a client-side clipboard action, so it does not need a server endpoint.

## Security model

The router uses the existing Helix session, friendship, blocking and privacy helpers. The sender is always taken from the authenticated session. Message ownership, conversation membership and allowed destinations are checked on the server.

## Current phase

Built now:

- friend/conversation list
- text send/receive
- persistent history
- server-backed unread counts
- conversation switching
- conversation search
- message search
- timestamps
- edit/delete
- reactions
- full emoji picker
- copy
- forward
- pin/unpin
- pinned messages
- loading/error/empty states
- controlled polling with abort/request-serial protection

Not built yet:

- message replies or quoted references
- reply relationships
- photos, videos or attachments

These features are deliberately deferred until the text foundation is stable.
