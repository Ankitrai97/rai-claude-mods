# Simple Mode

**The short version of what Claude is doing.** Made for people who want the result, not the play-by-play, and great for showing Claude to someone who has never seen an agent work.

With Simple Mode on:

- **A checklist pane** shows the current task, each step in plain English and marked working or done:
  ```text
  WORKING   3 of 4 steps done

  ✓  Reading the monday kickoff notes  · done
  ✓  Reading the wednesday check in notes  · done
  ✓  Reading the friday wrap notes  · done
  ◌  Writing the weekly update notes  · working
  ```
- **Every tool call in the chat is one line**: `✓ Reading the budget notes   ▸ detail`. Click it to see the full row and its output; `▾ hide detail` folds it back.
- **Every reply ends with a two-line summary:**
  > **Done:** I read the three project notes and wrote a short weekly update.
  > **Result:** It's saved as weekly-update.md, ready to send.

## Use it

| Type | What happens |
| --- | --- |
| `/simple` | Turns it on, or off if it is on |
| `/simple on` · `/simple off` | Sets it outright |

The setting is remembered across chats (in `~/.claude/simple-mode.json`) until you change it. Turn it off and the normal view comes straight back.

**Try it:** turn it on, then ask *"Read the notes in demos/simple-mode-notes and write a short weekly update."*

## What it reaches

| Network | Runs processes | Files | Calls a model | Sends data anywhere |
| --- | --- | --- | --- | --- |
| No | No | Only `~/.claude/simple-mode.json` (its on/off setting) | No. The summary is one extra instruction in the system prompt while it is on | No |

`claude plugin validate plugins/simple-mode` lists every event it hooks and every call it makes.

## Notes

- The checklist clears each time you send a new message, so it always shows the current task.
- Folded runs of reads and searches show their first step plus `(+N more)`; expanding the run shows each call, each one line again.
- The pane opens by itself only where there is room for a side pane (a wide terminal or the desktop app); otherwise `/simple` opens it.

Based on [agent-narrator](https://github.com/OneWave-AI/claude-code-mods/tree/main/agent-narrator) by OneWave AI, MIT licensed (see `LICENSE`). What changed is in [CHANGES.md](CHANGES.md).
