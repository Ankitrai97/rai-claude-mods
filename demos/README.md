# Five-minute tour

Everything here is made up: no real names, 555 phone numbers, example.com emails. Do the steps in a Claude Code chat opened in this repository's folder.

## 1. Simple Mode (1 minute)

1. Type `/simple`. A **Simple Mode** pane opens beside the chat.
2. Ask:
   ```text
   Read the notes in demos/simple-mode-notes and write a short weekly update.
   ```
3. Watch the checklist tick off each step: three `Reading … notes` lines, then `Writing the weekly update notes`.
4. In the chat, every tool call is one line. Click a `▸ detail` row to see it in full, `▾ hide detail` to fold it.
5. The reply ends with **Done:** and **Result:**.
6. Type `/simple` again: the normal view is back. Open a new chat and it stays the way you left it.

## 2. Usage Tally (30 seconds)

1. Send any message, so Claude's reply carries a usage reading.
2. Look at the status line: `Session 28% · resets 4h 30m · Week 31%`.
3. Type `/tally` for the bars, reset countdowns and this chat's cost.

## 3. Context Handoff (1 minute)

1. The bar above the prompt shows how full this chat is, green, amber or red.
2. Click **H Handoff** (or type `/handoff`). Claude writes `.claude/handoff.md`.
3. Open a new chat in the same folder: a toast says the note loaded, and Claude already knows what you were doing. Ask it *"What were we working on?"*

## 4. Codex Computer Use (2 minutes, Windows or macOS with the Codex app)

1. Copy `demos/messy-leads.xlsx` to your Desktop. It has 20 leads: 4 duplicates, names in mixed capitals, phones in three formats, mixed date formats, 3 missing phones and stray spaces.
2. Ask:
   ```text
   Open messy-leads.xlsx on my Desktop in Excel. Remove the duplicate leads (same email),
   make the names proper case, put every phone number in 555-201-3344 format, sort by date,
   and highlight the leads with no phone number in yellow. Save it.
   ```
3. Approve Excel in the pane when asked. On Windows, keep your hands off the mouse and keyboard while it works.
4. Result: 16 clean rows, sorted, with 3 highlighted.

Want a fresh messy copy? `pip install openpyxl`, then `python demos/make-messy-leads.py messy-leads.xlsx`.

## 5. Inbox Alerts (needs your Gmail, Slack and Calendar connectors)

1. Type `/alerts status`. Each of Gmail, Slack and Calendar should say "working". Your Slack ID and Google address are read from the connectors themselves. A line saying "refused: … auto mode classifier" means you're in Auto mode: allow the three read-only tools it names (see the mod's README).
2. Put a client's address or domain in `~/.claude/inbox-alerts-priority/clients.txt` (on Windows `C:\Users\<you>\.claude\inbox-alerts-priority\clients.txt`). The file appears after the first check, next to `priority-words.txt`. Edits apply on the next check.
3. From another account, email the address your Gmail connector is signed in to, with "quote" in the subject. Then type `/alerts check`: it pops up as Priority. Mail from your own addresses is ignored.
4. Type `/alerts` for the pane, and `/alerts triage` to have Claude rank what's unread and draft replies (it never sends anything).
