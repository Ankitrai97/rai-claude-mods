# Changes from agent-narrator

`simple-mode` is a modified version of OneWave AI's [agent-narrator](https://github.com/OneWave-AI/claude-code-mods/tree/main/agent-narrator) (MIT license, kept in `LICENSE`). The plain-English step lines (`hooks/steps.ts`) come from its `narrate.ts`.

## What changed and why

| Change | Why |
|---|---|
| Renamed to `simple-mode`; `/narrate` became **`/simple`**, which turns the mode on and off (`/simple on`, `/simple off` set it outright) | One switch for one idea: the short view or the normal view. |
| **On/off is remembered across chats**, in `~/.claude/simple-mode.json` (with the plugin store as a fallback) | The original kept everything for one chat only. A file, not the store alone: Claude Code keeps a separate store for each way a plugin is loaded (installed, `--plugin-dir`, the desktop app's own copy), so a chat loaded another way read another store and forgot the setting. Found in live testing. |
| The pane is a **checklist of the current task**: each step in plain English, marked `working`, `done` or `retrying`, with an "N of M steps done" header. It clears when you send a new message | The brief: what Claude is doing and what is done, at a glance. |
| **Tool call rows in the chat collapse to one line** (`✓ Reading the budget notes   ▸ detail`). Click a row to see Claude Code's full row and its result; `▾ hide detail` folds it again. Folded runs of reads and searches (tool groups) work the same way | The long step-by-step detail is hidden but never lost. New: the original did not touch the transcript. |
| **Every reply ends with a two-line summary** (`Done:` and `Result:`), added as one instruction in the system prompt while the mode is on | The short version of every answer. It costs no extra model call. |
| **Removed the "estimated human time saved" counter** and the per-step minute estimates | The estimates were guesses; Simple Mode shows only what happened. |
| **Removed `/narrate smart`** (a Haiku call per step) and **`/narrate demo`** | Simple Mode never spends your usage. The rule-based lines are free and read well. |
| Added lines for `PowerShell` commands, `Skill` and `ToolSearch`, and more file kinds (spreadsheet, document) | So a Windows session reads as plainly as a Mac one. |
| Removed the 120 ms animation timer | The checklist redraws when a step changes; nothing needs to tick. |
| Added `.catch` fallbacks on the prompt, tool-call and system-prompt hooks | If the mod's own code ever fails, Claude's tools and prompts behave exactly as without it. |
| Tests: `tests/steps.test.ts` (the step lines) and `tests/simple.test.tsx` (the switch, the saved setting, a new chat reading it back, the checklist, a row expanding and collapsing, on terminal and desktop) | `claude plugin test plugins/simple-mode` runs all 7. |

## Calls the mod makes

`$.command.register`, `$.state.get` / `$.state.set`, `$.store.get` / `$.store.set`, `$.env.get` (`OS`, `USERPROFILE` or `HOME`, to find your home folder), `$.fs.exists` / `$.fs.read` / `$.fs.write` (only `~/.claude/simple-mode.json`), `$.ui.open` / `$.ui.close` / `$.ui.resolve`. No network, no processes, no model calls.
