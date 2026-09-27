# Helix DM rebuild boundary

The previous Direct Message implementation is archived on the Git branch `dm-archive-before-rebuild`.

## Archived capability inventory

- Text message sending
- Conversation list and friend-based conversations
- Unread counts and badges
- Message history and search
- Edit and delete
- Reactions and full emoji picker
- Forward and copy
- Pin/unpin and pinned-message panel
- Timestamps, edited indicator, send status, scrolling, and conversation switching
- Friend nicknames and friend avatar/profile information used by the DM UI
- DM notification behavior
- DM privacy/security, blocking restrictions, friend validation, and existing authentication/session behavior

## Excluded from the clean rebuild for now

- Replies and reply previews
- `reply_to_id` and reply-target validation
- Reply composer/bar and reply reference UI
- Reply preview/session storage
- DM photo/video/media/attachment sending

The legacy DM database tables and data are intentionally preserved. The cleanup does not drop them.

## Future rebuild phases

1. Text-only conversations: friends list, text send/receive, history, unread counts.
2. Stable message tools: edit, delete, reactions, search, pin, forward, copy.
3. Photo/video sending.
4. Replies.

Phase 4 should not be implemented early.

## Active boundary

Main now shows a temporary Messages placeholder. The future implementation should be split across `dm/`, `routes/dm.js`, and `migrations/dm/` rather than being folded back into the old monolithic DM code.
