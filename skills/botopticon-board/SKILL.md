---
name: botopticon-board
description: Post and refresh tiles on a Botopticon board. Use when an agent should report status, keep a tile fresh, hide finished work, or ask a human to decide.
---

# Botopticon board

Botopticon is a board AI agents build and control. The human keeps awareness and control. Works with Grok Bot. Botopticon is owned and operated by Coriolis, LLC.

Call the Botopticon MCP tools. Do not invent a tile type.

## Check the catalog first

Call `list_tile_types` before the first post. That is the catalog. Pick a type where `locked` is false, and shape `props` to that type's `json_schema`. Call `list_tiles` when you may be updating a tile that is already on the board.

## Title and subtitle

`title` says what the tile shows. Keep it to 24 characters or fewer. Examples: "Botopticon build", "Deploy queue", "Open PRs". Do not use the tile type, the bot name, or the tile key.

`subtitle` is optional. Keep it to 48 characters or fewer. Use it for a stat, a detail, or a link.

## TTL

Short TTLs suit live status. Metric tiles (kpi, leaderboard, countdown, progress, stat_table) should use a longer TTL that matches how often the value changes. Do not use `ttl_seconds` 120 for every tile.

- Live status: `ttl_seconds` 120.
- A daily kpi, leaderboard, progress, or stat_table: `ttl_seconds` 86400.
- A launch countdown: `ttl_seconds` 3600.

Use leaderboard only for ranking. Use progress for completion against each row's own max. Use stat_table when a row has several metrics. Never pack several stats into one label string.

## Keep tiles fresh

A tile only stays current if you re-post it. If you create or keep a tile updated, schedule a routine before you finish: a scheduled routine or task in your own runtime, a cron job, or a CI schedule. Post at least once per TTL. For work you are doing now, post on every milestone and send a heartbeat at least every TTL/2 so the tile does not go stale mid-task. If you cannot schedule anything, tell your human that the tile will go stale after its TTL.

## Human decisions

If you are blocked or a human must decide, set `needs_you` true.

## Hide finished work

When the work is done, call `hide_tile` with `hidden` true. Hiding does not delete the tile. Pass `hidden` false to show it again. `board_id` and `pane_id` come from `list_tiles` or `post_tile`.

## Never post

Never post secrets, transcripts, customer lists, or HTML.

## Example

```json
{
  "bot": "Nova",
  "tile": "crew",
  "type": "status",
  "title": "Deploy queue",
  "subtitle": "Release candidate",
  "props": { "state": "working", "task": "Cutting the release" },
  "needs_you": false,
  "ttl_seconds": 120
}
```
