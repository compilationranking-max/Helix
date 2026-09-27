-- Helix DM full-feature additive migration.
-- Non-destructive: existing active DM rows and archived/original DM data remain intact.

ALTER TABLE helix_dm_messages
    ADD COLUMN IF NOT EXISTS media_data BYTEA;

ALTER TABLE helix_dm_messages
    ADD COLUMN IF NOT EXISTS media_mime TEXT;

ALTER TABLE helix_dm_messages
    ADD COLUMN IF NOT EXISTS media_name TEXT;

ALTER TABLE helix_dm_messages
    ADD COLUMN IF NOT EXISTS media_size INTEGER;

ALTER TABLE helix_dm_messages
    ADD COLUMN IF NOT EXISTS media_kind TEXT;

ALTER TABLE helix_dm_messages
    ADD COLUMN IF NOT EXISTS reply_to_id UUID;

ALTER TABLE helix_dm_messages
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE helix_dm_messages
    DROP CONSTRAINT IF EXISTS helix_dm_messages_body_check;

ALTER TABLE helix_dm_messages
    ADD CONSTRAINT helix_dm_messages_body_check
    CHECK (
        char_length(body) BETWEEN 0 AND 4000
        AND (
            char_length(body) > 0
            OR media_data IS NOT NULL
            OR deleted_at IS NOT NULL
        )
    );

ALTER TABLE helix_dm_messages
    DROP CONSTRAINT IF EXISTS helix_dm_messages_media_kind_check;

ALTER TABLE helix_dm_messages
    ADD CONSTRAINT helix_dm_messages_media_kind_check
    CHECK (
        media_kind IS NULL
        OR media_kind IN ('image', 'video')
    );

ALTER TABLE helix_dm_messages
    DROP CONSTRAINT IF EXISTS helix_dm_messages_media_size_check;

ALTER TABLE helix_dm_messages
    ADD CONSTRAINT helix_dm_messages_media_size_check
    CHECK (
        media_size IS NULL
        OR (media_size > 0 AND media_size <= 10485760)
    );

ALTER TABLE helix_dm_messages
    DROP CONSTRAINT IF EXISTS helix_dm_messages_reply_self_check;

ALTER TABLE helix_dm_messages
    ADD CONSTRAINT helix_dm_messages_reply_self_check
    CHECK (
        reply_to_id IS NULL
        OR reply_to_id <> id
    );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'helix_dm_messages_reply_to_id_fkey'
    ) THEN
        ALTER TABLE helix_dm_messages
            ADD CONSTRAINT helix_dm_messages_reply_to_id_fkey
            FOREIGN KEY (reply_to_id)
            REFERENCES helix_dm_messages(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS helix_dm_messages_reply_to_idx
    ON helix_dm_messages (reply_to_id);
