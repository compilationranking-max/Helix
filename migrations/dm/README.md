# Helix DM migrations

The active DM system uses additive migrations. Existing active DM rows and the archived/original DM tables are not deleted by the full-feature restore.

## 001-full-features.sql

Adds:
- media_data, media_mime, media_name, media_size, media_kind
- reply_to_id with a self foreign key and index
- deleted_at for safe soft deletion
- validation constraints for media kind/size and message body

Active relationship tables remain separate:
- helix_dm_message_reactions
- helix_dm_message_pins
- helix_dm_conversation_nicknames

Runtime database initialization in server.js applies the same additive shape so new deployments self-heal missing columns without destroying existing DM data.

Replies use soft deletion for originals. A deleted original remains as a database row, allowing existing replies to render a graceful Original message deleted state.

Media is stored only for supported image/video messages and is limited to 10 MB.