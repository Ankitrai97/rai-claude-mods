# Credits and licenses

Four of these five mods started from someone else's open-source work. Each one keeps its original license in its own folder, and each has a `CHANGES.md` saying what we changed and why.

| Mod | Based on | Original author | License |
| --- | --- | --- | --- |
| [simple-mode](plugins/simple-mode) | [agent-narrator](https://github.com/OneWave-AI/claude-code-mods/tree/main/agent-narrator) | OneWave AI | MIT ([LICENSE](plugins/simple-mode/LICENSE)) |
| [inbox-alerts-priority](plugins/inbox-alerts-priority) | [inbox-alerts](https://github.com/OneWave-AI/claude-code-mods/tree/main/inbox-alerts) | OneWave AI | MIT ([LICENSE](plugins/inbox-alerts-priority/LICENSE)) |
| [context-handoff](plugins/context-handoff) | [token-weather](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/token-weather) | Anthropic PBC | Apache-2.0 ([LICENSE](plugins/context-handoff/LICENSE)); the original copyright header is kept in `hooks/context-handoff.mjs` |
| [codex-computer-use](plugins/codex-computer-use) | Computer Use, from "Two mods for Claude Code" | Prompt Advisers | MIT ([LICENSE](plugins/codex-computer-use/LICENSE)) |
| [usage-tally](plugins/usage-tally) | Written from scratch | Rapple AI | MIT ([LICENSE](plugins/usage-tally/LICENSE)) |

## Not included

- **Codex's computer-use runtime.** `codex-computer-use` talks to the computer-use engine that ships inside OpenAI's Codex app (Windows) or ChatGPT app (macOS). That engine is OpenAI's and is not part of this repository; you need the app installed and its computer use set up.
- **Connectors.** `inbox-alerts-priority` uses the Gmail, Slack and Google Calendar connectors of your own claude.ai account.

## Trademarks

Claude and Claude Code are trademarks of Anthropic. Codex and ChatGPT are trademarks of OpenAI. Gmail and Google Calendar are trademarks of Google, and Slack of Salesforce. This is an independent community project, not made or endorsed by any of them.
