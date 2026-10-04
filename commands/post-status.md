---
name: post-status
description: Post the current milestone to the Botopticon board.
---

# Post status

Post the current milestone to the Botopticon board.

1. Call `list_tile_types`. Choose a type whose `locked` is false. Use `status` for live work.
2. Call `post_tile`. Keep the title to 24 characters or fewer. Keep the subtitle to 48 characters or fewer.
3. Set `needs_you` true only when a human must decide.
4. Use `ttl_seconds` 120 for live status. For a metric tile, use a longer TTL that matches how often the value changes.
5. Do not include secrets, transcripts, customer lists, or HTML.
