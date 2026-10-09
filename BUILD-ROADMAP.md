# Build Roadmap: Claude Code Mods

Everything you need to **use** these five mods today, or **build them yourself** from scratch with Claude Code, using the exact prompts we used.

**The repo:** https://github.com/Ankitrai97/rai-claude-mods

---

## Part 1 · What you're getting

| Mod | What it does | Command |
| --- | --- | --- |
| **Simple Mode** | A plain-English checklist of what Claude is doing, one-line tool rows you can expand, a two-line summary at the end of every reply | `/simple` |
| **Usage Tally** | Your 5-hour and weekly plan limits with reset countdowns in the status line, warnings at 75% and 90% | `/tally` |
| **Context Handoff** | A green / amber / red context bar with a Handoff button; the next chat picks up where this one stopped | `/handoff` |
| **Inbox Alerts (Priority)** | Gmail, Slack and Calendar in a pane; pop-ups only for clients and words you choose | `/alerts` |
| **Codex Computer Use** | Claude works your desktop apps (Excel, Word…) through the Codex app's engine, with your approval per app | `/codex-cu` |

A **mod** is a Claude Code plugin made of small JavaScript/TypeScript functions that run *inside* Claude Code. That's why a mod can draw a pane beside the chat, a bar above the prompt or a status line, fold the chat's rows and add commands, which a normal plugin, skill or MCP server can't.

---

## Part 2 · Install the mods (5 minutes)

### What you need

- **Claude Code 2.1.287 or newer** in a terminal, or **2.1.286+** in the Claude desktop app's Code tab.
  Check it: run `claude --version` in a terminal, or type `/status` in the desktop app.
  Older? Update Claude Code (terminal) or the desktop app.
- A Claude subscription for Usage Tally's plan limits.
- For Inbox Alerts: your claude.ai **Gmail, Slack and Google Calendar connectors** connected.
- For Codex Computer Use: the **Codex app** (Windows) or **ChatGPT app** (macOS) installed, signed in, with computer use set up.

### Step 1 · Add the marketplace

In any Claude Code chat, type:

```text
/plugin marketplace add Ankitrai97/rai-claude-mods
```

### Step 2 · Install the mods you want

```text
/plugin install simple-mode@rai-claude-mods
/plugin install usage-tally@rai-claude-mods
/plugin install context-handoff@rai-claude-mods
/plugin install inbox-alerts-priority@rai-claude-mods
/plugin install codex-computer-use@rai-claude-mods
```

Prefer your terminal? This installs all five at once:

```bash
claude plugin marketplace add Ankitrai97/rai-claude-mods
for m in simple-mode usage-tally context-handoff inbox-alerts-priority codex-computer-use; do claude plugin install "$m@rai-claude-mods"; done
```

(Windows PowerShell: `'simple-mode','usage-tally','context-handoff','inbox-alerts-priority','codex-computer-use' | % { claude plugin install "$_@rai-claude-mods" }`)

### Step 3 · Load them

Type `/reload-plugins` in your chat, then `/plugin`. The dim line under the tabs should read something like `5 mods active · simple-mode, usage-tally, …`.

### Step 4 · Set up the two that need it

- **Inbox Alerts:** type `/alerts status`. Gmail, Slack and Calendar should each say "working" (your Slack ID and Google address are read from the connectors). In Auto permission mode, allow the three read-only tools it names, as its README shows. Your client list and priority words are in `~/.claude/inbox-alerts-priority/`.
- **Codex Computer Use:** type `/codex-cu status`. The first time Claude wants an app, a pane asks you to allow it.

### Step 5 · Try each one

| Try | Type or ask |
| --- | --- |
| Simple Mode | `/simple`, then *"Read the notes in demos/simple-mode-notes and write a short weekly update."* |
| Usage Tally | Send any message, then look at the status line, or type `/tally` |
| Context Handoff | Click **H Handoff** above the prompt, open a new chat in the same folder, ask *"What were we working on?"* |
| Inbox Alerts | `/alerts` |
| Codex Computer Use | Put `demos/messy-leads.xlsx` on your Desktop and ask Claude to clean it up in Excel |

The full walkthrough is in [demos/README.md](demos/README.md).

### Want to tinker? Run them from your own copy

```bash
git clone https://github.com/Ankitrai97/rai-claude-mods.git
claude plugin marketplace add ./rai-claude-mods
claude plugin install simple-mode@rai-claude-mods
```

Installs from a folder read straight from it: edit a file, type `/reload-plugins`, and the change is live.

---

## Part 3 · Build them yourself

You don't need to code. Claude writes the mod; your job is to say clearly what you want and check that it works. Every mod in this repo was built with the same five-step prompt.

### The method

1. **Prepare.** Claude loads its built-in *plugin-authoring* skill, reads the official mods docs, and checks your version.
2. **Review before installing.** If you start from someone else's mod, Claude reads every file and runs `claude plugin validate`, then tells you in plain English what it hooks, what it calls, and whether it spends your usage. It stops and waits for your OK. Never skip this: a mod runs with your permissions.
3. **Build.** Claude copies the mod into your own local marketplace (`~/my-mods`), keeps the original license, makes your numbered changes, and writes tests.
4. **Test live, with pass criteria.** You give a real task and a short list of "it passes only if…" checks. Claude keeps fixing until every one passes.
5. **Wrap up.** A `CHANGES.md` (what changed and why) and a 3-line summary of how to use it.

### The prompts

Copy a prompt, paste it into a Claude Code chat, and follow along. Swap `~/my-mods` for any folder you like.

| Prompt | Builds |
| --- | --- |
| [00-any-mod-template.txt](prompts/00-any-mod-template.txt) | **Your own idea.** Fill in the blanks |
| [01-simple-mode.txt](prompts/01-simple-mode.txt) | Simple Mode, from OneWave AI's agent-narrator |
| [02-usage-tally.txt](prompts/02-usage-tally.txt) | Usage Tally, from scratch |
| [03-context-handoff.txt](prompts/03-context-handoff.txt) | Context Handoff, from Anthropic's token-weather |
| [04-inbox-alerts-priority.txt](prompts/04-inbox-alerts-priority.txt) | Inbox Alerts (Priority), from OneWave AI's inbox-alerts |
| [05-codex-computer-use.txt](prompts/05-codex-computer-use.txt) | Codex Computer Use, from Prompt Advisers' Computer Use |
| [06-publish-your-own-repo.txt](prompts/06-publish-your-own-repo.txt) | Turn your mods into a public GitHub repo like this one |

### Where the starting points come from

| Repo | What's in it |
| --- | --- |
| [Ankitrai97/rai-claude-mods](https://github.com/Ankitrai97/rai-claude-mods) | These five mods, their tests, prompts and demos |
| [OneWave-AI/claude-code-mods](https://github.com/OneWave-AI/claude-code-mods) | Eleven mods, including agent-narrator and inbox-alerts (MIT) |
| [anthropics/claude-code-playground · mods](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods) | Anthropic's sample mods: token-weather, blast-radius, replay-theater |
| [anthropics/claude-code · mods](https://github.com/anthropics/claude-code/tree/main/mods) | The source of the mods built into Claude Code, such as `/diff` |
| Prompt Advisers, *Two mods for Claude Code* | The original macOS Computer Use mod (MIT) |

### The docs

- Mods overview: https://code.claude.com/docs/en/plugins/mods
- Create a mod: https://code.claude.com/docs/en/plugins/mods/create
- Draw in the interface (panes, bands, buttons): https://code.claude.com/docs/en/plugins/mods/interface
- React to events (tool calls, prompts, turns): https://code.claude.com/docs/en/plugins/mods/events
- Test a mod: https://code.claude.com/docs/en/plugins/mods/test
- Troubleshoot a mod: https://code.claude.com/docs/en/plugins/mods/troubleshoot

### The commands you'll use

| Command | What it does |
| --- | --- |
| `claude plugin validate <folder>` | Lists what a mod hooks and calls, and anything Claude Code would refuse. Run it before installing any mod |
| `claude plugin test <folder>` | Runs the mod's tests against Claude Code's own engine |
| `claude plugin marketplace add <folder or user/repo>` | Adds a marketplace (a folder of mods, or a GitHub repo) |
| `claude plugin install <mod>@<marketplace>` | Installs a mod (`--scope user` for every chat) |
| `/reload-plugins` | Loads new or edited mods into the open chat |
| `/plugin` | Shows which mods are active |
| `claude --plugin-dir <folder>` | Tries a mod for one session without installing it |

### Lessons we learned the hard way

- **Save settings that must survive in a file**, not only the plugin store. The store is kept per way a plugin is loaded, so a chat that loads it another way forgets.
- **Mods can read and write files but can't rename or delete them.** Run `Move-Item` (Windows) or `mv` through the mod's process call.
- **A prompt sent from inside a slash command is refused.** Send it just after the command returns.
- **Opening a pane with `focus: false` is refused.** Leave `focus` out unless you want the pane to take the keyboard.
- **Only one band fits above the prompt.** Two mods drawing there compete; use the status line or a pane instead.
- **On Windows, Codex computer use takes over the screen** while it acts. Tell people to keep their hands off.
- **Always add `.catch` fallbacks** to hooks on tool calls and prompts, so a bug in your mod never breaks Claude itself.
- **Test with made-up data** (no real names, 555 phone numbers, example.com emails) so you can share screenshots safely.

---

## Part 4 · Stay safe

A mod runs inside Claude Code with your permissions: it can read your files, run programs and see your chats. So:

1. Install mods only from people you trust.
2. Before installing, run `claude plugin validate <folder>` and read the `hooks:` and `calls:` lines, or ask Claude to explain them in plain English.
3. Check each mod's "What it reaches" table. Ours: none of them sends your data to any server of ours (there isn't one), and none makes model calls on its own.

---

Made by [Rapple AI](https://rappleai.com) · Free to use, copy and change (MIT; context-handoff is Apache-2.0) · Credits in [NOTICE.md](NOTICE.md)
