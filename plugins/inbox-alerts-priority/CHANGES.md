# Changes from the original inbox-alerts

Based on inbox-alerts by OneWave AI (MIT license, kept in LICENSE):
https://github.com/OneWave-AI/claude-code-mods/tree/main/inbox-alerts

## Pop-ups for priority messages only
- Added `priority-words.txt` (starts with: quote, invoice, booking, proposal, urgent) and `clients.txt` (empty).
- A message pops up only when the sender matches a line in clients.txt (full address, a domain, or a Slack name) or the subject or text contains a priority word. Words match at the start of a word, so "quote" also catches "quotes".
- Everything else still lands in the pane, silently.
- Both files are read again on every check, so edits apply without reinstalling.
- Why: the original popped up for every unread email and Slack message, which is too noisy for daily use.

## A separate schedule per source
- Gmail every 30 minutes, Slack every 5 minutes, Calendar every hour. Meeting reminders still run every 30 seconds from the saved calendar, with no extra network calls.
- `/alerts check` and the refresh button still check all three at once.
- Why: email and calendar change slowly, Slack fast. Fewer checks means less connector usage.

## One stacked pane instead of tabs
- Email, Slack and Calendar show as three sections on one screen. Priority messages sort to the top with a PRIORITY badge.
- Each section shows up to 5 items (Calendar up to 3), with "+N more" below.
- Calendar now looks 7 days ahead, so the next 3 events show even when today is empty.
- Removed the animated wave header to keep the pane simple.
- Why: one glance shows everything, which also reads better on screen.

## Smaller fixes
- Your email setting accepts several addresses separated by commas, and the email address of each sender is kept so clients.txt can match it.
- Gmail and Slack checks running at the same moment no longer overwrite each other's results.
- `/alerts triage` sends its prompt a moment after the command finishes. This build of Claude Code refuses a prompt sent from inside a command while it is still running.
- Your email and Slack member ID are settings you fill in (`/config`); they ship empty.
## 0.1.1: works in the desktop app, and with today's Slack and Calendar connectors
- Connectors are found by the tool they offer, not only by name. The terminal calls them "claude.ai Gmail"; the desktop app registers them under an id, so the old names found nothing there and every check failed silently.
- Slack's search now takes keywords and filters, not a free query: mentions search for `<@your ID>`, DMs use `is:dm`. Your own messages, bot posts and empty rows are dropped after the search, since `-from:` is no longer supported.
- Your Slack member ID is read from the connected Slack account, so a wrong or old setting can't break mentions.
- Calendar is asked for its default window (now to 7 days ahead) instead of UTC times, which the connector refuses. Your Google account's address is read from the calendar, so your own sent mail never alerts you.
- New `/alerts status`: checks everything and says, per source, whether it works, through which connector, and why not.
- 0.1.3: in the desktop app, connector tools wait behind ToolSearch and are missing from the mod's tool list, so the mod also learns each connector's server from `tool.describe` (which carries `mcp:<server>`) and re-checks as soon as it finds one. Each full check is written to `~/.claude/inbox-alerts-priority/last-check.json`: what was tried and why it failed.
- 0.1.4: a connector is matched by its tool *and* its description, so another server with a `list_events` tool (the desktop app's own session tools) is no longer taken for Google Calendar; a server that answers with an error no longer stops the next one being tried.
