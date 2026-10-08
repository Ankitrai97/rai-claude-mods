# Codex Computer Use

**Claude thinks, Codex clicks.** Claude Code's desktop computer use, routed through the computer-use engine inside OpenAI's Codex app. Codex reads apps through the operating system's accessibility layer (on Windows, UI Automation), so Claude works with the **exact values** in a spreadsheet cell or a form field, not a guess from a screenshot.

Ask Claude to do something in a desktop app, for example:

> *"Open messy-leads.xlsx on my Desktop in Excel. Remove the duplicate leads, make the names proper case, put the phone numbers in one format, sort by date and highlight the leads with no phone."*

Claude plans each step; Codex reads the window and acts. You approve each app once.

## What you see

- **An approval pane** the first time Claude wants an app: *Allow for this chat*, *Always allow*, or *Deny*. Nothing is approved to start with, and auto-approve is off.
- **A status line** while the bridge is running.
- Claude's own computer-use tools are switched off while this is on, so every action goes through Codex and your approvals.

## Commands

| Type | What happens |
| --- | --- |
| `/codex-cu status` | Is it on, is the bridge running, which apps are approved |
| `/codex-cu on` · `/codex-cu off` | Route computer use through Codex, or give Claude its own tools back |
| `/codex-cu allow <app>` · `always <app>` · `deny <app>` | Approve an app for this chat, for good, or refuse it |
| `/codex-cu forget <app>` (or `all`) | Remove an app from the always-allowed list |
| `/codex-cu auto on` · `auto off` | Approve every app without asking (off by default; leave it off unless you know why) |

## Needs

- **Claude Code 2.1.287 or newer** (2.1.286+ in the desktop app), with mods on.
- **Node** to run the small bridge script. Nothing to install: it uses the Node that ships inside the Codex app (Windows) or the ChatGPT app (macOS), and falls back to `node` on your PATH.
- **Windows:** the [Codex app](https://openai.com/codex) installed, signed in, with computer use set up. The mod finds Codex's engine through `~/.codex/config.toml`, so it keeps working after Codex updates.
- **macOS:** the ChatGPT Mac app at `/Applications/ChatGPT.app` with Codex computer use set up.

The computer-use engine itself is OpenAI's and is not included. Your Codex/ChatGPT plan and terms apply.

## Good to know

- **On Windows it takes over the screen.** Codex brings the app to the front and uses the real mouse and keyboard while it acts. Leave the machine alone during a run. (On macOS it can work in the background.)
- **Codex's own limits apply.** It will not drive terminals, the Run dialog, password managers, security apps, sign-in screens or the Codex/ChatGPT app itself.
- **Pop-up dialogs** (Excel's Remove Duplicates, Save As) sometimes don't show in the accessibility tree; Claude takes a screenshot to see where the focus is before pressing Enter.
- One Codex session per Claude chat; two chats can't drive the same app at once.

## What it reaches

| Network | Runs processes | Files | Calls a model | Sends data anywhere |
| --- | --- | --- | --- | --- |
| Only `127.0.0.1` (its own bridge) | Starts the bridge (`bridge/start.mjs`) with Node | `~/.codex/config.toml` (read), `~/.claude/codex-cu/` (bridge state, always-allowed apps) | No | Window contents go to Codex's local engine; what Claude reads goes to Claude, as with any tool |

The bridge listens on `127.0.0.1` only and rejects any request without the random token it writes to `~/.claude/codex-cu/daemon.json`.

## Credits

Based on the Computer Use mod from Prompt Advisers' *Two mods for Claude Code* (MIT, see `LICENSE`), which targeted macOS. This version adds Windows support. What changed is in [CHANGES.md](CHANGES.md).
