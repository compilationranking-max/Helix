# Helix DM migrations

The active text-only DM schema is initialized by the existing database bootstrap in \`server.js\`.

Current active tables:

- \`helix_dm_messages\`
- \`helix_dm_reactions\`
- \`helix_dm_pins\`

The old DM tables/data from the pre-rebuild system are intentionally not dropped or rewritten by this implementation.

Future schema changes should be added here as explicit migrations rather than extending the old DM schema in place.

Do not add relationship fields for future message types until those features are actually being implemented.
