# Changes from the original Computer Use mod

`codex-computer-use` started from the Computer Use mod in Prompt Advisers' *Two mods for Claude Code* (MIT license, kept in `LICENSE`), which routed Claude's computer use through Codex on macOS only.

## What changed and why

| Change | Why |
|---|---|
| **Windows support.** On Windows the bridge launches the `node_repl` computer-use server that the Codex app registers in `~/.codex/config.toml`, and runs it with Codex's own Node | The original only knew the ChatGPT Mac app's paths. Codex for Windows ships its engine (`@oai/sky`) through that config. |
| Codex's paths are **read fresh from its config each time** the bridge starts | Codex updates move its runtime to a new folder; a saved path would break after the first update. |
| The bridge (`bridge/daemon.mjs`, `launch.mjs`, `start.mjs`) **ships inside the plugin** and starts on demand, under `~/.claude/codex-cu/` | Installing the plugin is the whole setup; no separate setup script. |
| A **Windows routing guide** is added to Claude's system prompt while the mod is on: how to list apps, read a window's accessibility tree, prefer keyboard actions, handle Excel's pop-up dialogs, and that typing takes the foreground | Codex on Windows is not background automation, and Excel dialogs often hide from the accessibility tree. These are the lessons from live runs. |
| Per-app approval pane with **Allow for this chat / Always allow / Deny**, `/codex-cu allow|always|deny|forget <app>` and `auto on|off` | Codex asks before using each app; the mod answers yes only for apps you allowed. Nothing is approved at the start. |
| The bridge is a versioned daemon (`v3`) on `127.0.0.1` with a random token; an older daemon is asked to quit | Safe upgrades, and no other local program can drive it. |
| Tests (`codex-cu.test.ts`, 7 tests) on a simulated Windows host | Covers finding Codex's runtime after an update, starting the bridge, approvals and routing. |

Tested live on Windows 11: Claude cleaned an Excel lead list (duplicates removed, sorted, $5k+ deals highlighted) through Codex.
