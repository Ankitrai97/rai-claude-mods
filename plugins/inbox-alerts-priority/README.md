# Inbox Alerts (Priority)

Gmail, Slack and Google Calendar inside Claude Code. Pop-up alerts only for messages that matter; everything else waits quietly in the pane.

- `/alerts` opens the pane: Email, Slack and Calendar (next 3 events)
- `/alerts check` checks everything now
- `/alerts status` says whether Gmail, Slack and Calendar each work, through which connector, and why not
- `/alerts triage` asks Claude to rank your unread messages and draft replies (it never sends anything)
- `/alerts clear` clears the list

Checks Gmail every 30 minutes, Slack every 5 minutes, Calendar every hour. Gmail means unread inbox mail from the last 2 days, minus the Promotions, Social, Updates and Forums tabs; Slack means DMs and @-mentions of you.

## Choosing what pops up
Edit the two plain text files in `~/.claude/inbox-alerts-priority/` (on Windows `C:\Users\<you>\.claude\inbox-alerts-priority\`), one entry per line. The first check copies them there from this folder:
- `priority-words.txt`: words that make a message priority (subject or text)
- `clients.txt`: client email addresses, domains (acme.com) or Slack names

Changes apply on the next check. Lines starting with # are ignored.

## In Auto permission mode
Auto mode's safety check refuses a mod calling a connector by itself, so `/alerts status` says "refused: … auto mode classifier gave no verdict". Allow the three read-only tools the mod uses (none of them can send or change anything): in `~/.claude/settings.json`, under `permissions.allow`, add the names `/alerts status` shows, in this form:

```json
"mcp__<gmail server>__search_threads",
"mcp__<slack server>__slack_search_public_and_private",
"mcp__<calendar server>__list_events"
```

## Needs
Claude Code 2.1.287 or newer, signed in with a claude.ai account that has the Gmail, Slack and Google Calendar connectors connected. Your email and Slack member ID are in `/config`.

Based on inbox-alerts by OneWave AI, MIT licensed. See CHANGES.md for what changed.
