# usage-tally

Your Claude plan usage inside Claude Code, like the Tally browser extension shows on claude.ai.

- **Status line:** `Session 42% · resets 2h 10m · Week 19%`, refreshed after every reply and its countdown every minute
- **`/tally`:** opens a pane with a coloured bar for each limit (green under 75%, amber 75–90%, red 90%+), its reset countdown, and this chat's cost and context fill
- **Warnings:** a toast when a limit crosses 75% and again at 90%, once per limit window, remembered across chats

The figures are the ones Claude's own replies report, so they update when Claude answers, not while you are idle. The limits count claude.ai and Claude Code together. Off a Claude subscription (API key) there are no limit figures, only cost and context.

## What it reaches

| Network | Runs processes | Files | Calls a model | Sends data anywhere |
| --- | --- | --- | --- | --- |
| No | No | No | No | No |

It keeps one list in the plugin store: which warnings it has already shown. Run `claude plugin validate ./usage-tally` to list every event it hooks and every call it makes.
