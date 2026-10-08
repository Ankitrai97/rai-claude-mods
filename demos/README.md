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

1. Fill in your email and Slack member ID: type `/config` and find the **inbox-alerts-priority** rows.
2. Put a client's domain in `clients.txt` in the mod's folder. Its two word lists are plain files, so this mod is easiest from a clone of this repo added as a local marketplace (see the main README).
3. Type `/alerts`. Priority messages sit at the top with a PRIORITY badge; only they pop up.
