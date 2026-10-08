# Changes from token-weather

`context-handoff` is a modified version of Anthropic's [token-weather](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/token-weather) sample mod (Apache License 2.0, Copyright 2026 Anthropic PBC). The license is in `LICENSE`, and the copyright header is kept in the hooks module.

## What changed and why

| Change | Why |
|---|---|
| Renamed the plugin to `context-handoff` and the module to `hooks/context-handoff.mjs` | It does more than forecast now, and it ships in the `rai-claude-mods` marketplace beside the other mods. |
| Replaced the five weather bands (Clear, Cloudy, Showers, Storm, Compact soon) with three colours: **green under 60%, amber 60–80%, red above 80%** | One glance answers "do I need to hand off yet?". Amber says "getting full" and red says "hand off soon". |
| The bar always shows, even before the first response (at 0%) | So the H button is always there. The original hid the band until the first reading. |
| Dropped the "▲ +98k last turn" trend text and kept the block chart of recent turns | Room for the button and status text on one line. |
| Added an **H Handoff** button (hotkey `h` when the bar has focus) and a **/handoff** command | One click asks Claude to write a handoff note. Claude writes it, because Claude is the one who knows what the chat was about. |
| The note goes to `.claude/handoff.md` in the current project, in plain English, under 300 words, with five headings: Goal, What's done, Decisions made, Key files, Next steps | The brief for this mod. Fixed headings make the note easy to scan and to check. |
| The bar shows "writing handoff…" and then "handoff saved to .claude/handoff.md" | You can see the note landed without opening the file. The mod watches Claude's Write/Edit calls to that path. |
| When a new chat starts in a project with a note from the **last 24 hours**, the note is loaded into Claude's system prompt, a toast says so, and the file is renamed to `handoff-used.md` | The new chat picks up where the last one stopped, and the note never loads twice. |
| A note saved during the current chat is not loaded by that same chat (on a mod reload, for example) | The note is meant for the *next* chat. The check compares the note's time with the session's start time. |
| The rename runs a small system command (`Move-Item` on Windows, `mv` elsewhere). If that fails, the mod keeps a copy as `handoff-used.md` and empties `handoff.md`, which is then skipped | Mods can read and write files but cannot rename or delete them. |
| `/handoff` sends its request just after the command returns, not during it | Claude Code refuses a prompt sent from inside a command hook, because the hook still holds the turn. |
| The H button and `/handoff` look up the chat's current folder (`$.session.cwd()`) when pressed, not the folder the chat started in | Found in live testing: a chat that moved to another project wrote the note into its old folder, where no new chat would find it. |
| Added `.catch` fallbacks on the command and Write/Edit hooks | If the mod's own code ever fails, Claude's Write/Edit and the command still behave normally. |
| Added a state contract (`types/index.d.ts`) and tests (`context-handoff.test.ts`, 8 tests on terminal and desktop) | `claude plugin validate` checks state keys against the contract, and the tests cover the colours, the button, the command, loading, renaming and the 24-hour cutoff. |
| Removed the token-weather screenshots and rewrote the README | They showed the old weather band. |
| Unchanged | How usage is read (`$.session.usage()`, the same figures as the status line, free to call), the 12-turn history, the chart, and number formatting. |

## Calls the mod now makes beyond the original

`$.fs.exists`, `$.fs.stat`, `$.fs.read`, `$.fs.write` (only `.claude/handoff.md` and `.claude/handoff-used.md` in the session's project), `$.process.run` (the one rename), `$.env.get("OS")`, `$.prompt.submit` (the handoff request), `$.command.register`, `$.clock.now` / `$.clock.sleep`, `$.ui.toast`. Run `claude plugin validate` to see the full list. There are no network calls and no model calls of its own.
