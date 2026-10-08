# Inbox Alerts (Priority)

Gmail, Slack and Google Calendar inside Claude Code. Pop-up alerts only for messages that matter; everything else waits quietly in the pane.

- `/alerts` opens the pane: Email, Slack and Calendar (next 3 events)
- `/alerts check` checks everything now
- `/alerts triage` asks Claude to rank your unread messages and draft replies (it never sends anything)
- `/alerts clear` clears the list

Checks Gmail every 30 minutes, Slack every 5 minutes, Calendar every hour.

## Choosing what pops up
Edit the two plain text files in this folder, one entry per line:
- `priority-words.txt`: words that make a message priority (subject or text)
- `clients.txt`: client email addresses, domains (acme.com) or Slack names

Changes apply on the next check. Lines starting with # are ignored.

## Needs
Claude Code 2.1.287 or newer, signed in with a claude.ai account that has the Gmail, Slack and Google Calendar connectors connected. Your email and Slack member ID are in `/config`.

Based on inbox-alerts by OneWave AI, MIT licensed. See CHANGES.md for what changed.
