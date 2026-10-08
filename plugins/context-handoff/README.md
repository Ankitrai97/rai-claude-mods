# Context Handoff

A Claude Code mod that shows how full the current chat's context is and gives you a one-click handoff to a fresh chat, without losing what you were doing.

Based on Anthropic's [token-weather](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/token-weather) sample (Apache-2.0). See [CHANGES.md](CHANGES.md) for what changed.

## What you see

A bar above the message box:

```text
 ● 72% context · getting full  144k / 200k  ▁▂▃▅▆▇   [ H  Handoff ]
```

| Context used | Colour | Means |
|---|---|---|
| under 60% | green | plenty of room |
| 60–80% | amber | getting full |
| above 80% | red | hand off soon |

The numbers are the same as the status line's (`$.session.usage()`), updated after each turn.

## Hand off

1. Click **H Handoff** (or focus the bar with ctrl+x tab and press `h`, or type `/handoff`).
2. Claude writes `.claude/handoff.md` in the current project: plain English, under 300 words, with **Goal, What's done, Decisions made, Key files, Next steps**. The bar shows "handoff saved".
3. Start a new chat in the same project. If the note is less than 24 hours old, it loads automatically (a toast says so), and Claude knows what you were working on. The file is renamed to `.claude/handoff-used.md`, so the chat after that starts clean.

## Install

From the `rai-claude-mods` marketplace (see the [main README](../../README.md#install)):

```bash
claude plugin install context-handoff@rai-claude-mods --scope user
```

Then run `/reload-plugins` in an open session.

## Notes / limitations

- **The percentage is of the full window.** Claude Code's own "context low" notice counts towards the auto-compact point, which comes earlier, so the two can differ.
- **The bar updates once per turn**, not during one.
- **Only notes from the last 24 hours load**, and only when written before the new chat started.
- **Renaming uses a system command** (`Move-Item` / `mv`), because mods cannot rename files.
- **One band per session.** Another mod that draws above the prompt competes for the same spot.
- Drawn in the terminal and the desktop app's Code tab.

## License

Apache License 2.0. Modified from Anthropic's token-weather sample; the original copyright notice is kept in `hooks/context-handoff.mjs` and the license text is in `LICENSE`.
