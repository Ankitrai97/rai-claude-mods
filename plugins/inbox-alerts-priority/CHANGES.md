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
