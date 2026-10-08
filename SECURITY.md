# Security

## Before you install any mod

A mod runs inside Claude Code with your permissions and is not sandboxed. Before you load one, from this repository or anywhere else, list what it hooks and what it calls:

```bash
claude plugin validate ./plugins/simple-mode
```

Read the `hooks:` and `calls:` lines. Each mod's README also has a "What it reaches" table, and the [main README](README.md#what-each-mod-reaches) has all of them in one place.

## What these mods never do

- Send your data to any server of ours. There is no Rapple AI server; nothing phones home.
- Call a model behind your back. None of them makes model calls of its own. Three send Claude a prompt in your chat, each only after you act: the Handoff button (context-handoff), `/alerts triage` (inbox-alerts-priority), and a "carry on" after you approve an app (codex-computer-use).
- Send an email or a Slack message. inbox-alerts-priority reads; its triage drafts replies for you to send.

## The one mod that controls apps

`codex-computer-use` lets Claude operate desktop apps through Codex's engine. It starts with **no app approved** and auto-approve off: every app needs your yes in its approval pane. Its bridge listens on `127.0.0.1` only and rejects any request without the random token it writes to `~/.claude/codex-cu/daemon.json`. On Windows it takes over the mouse and keyboard while it acts, so leave the machine alone during a run.

## Reporting a problem

Please don't open a public issue for a security problem. Use GitHub's [private vulnerability reporting](https://github.com/Ankitrai97/rai-claude-mods/security/advisories/new) for this repository, with the mod, your Claude Code version (`claude --version`) and the steps that reproduce it.

In scope: anything in these mods that leaks data, runs a command or makes a request its README does not describe, or lets text from an email, Slack message, web page or file steer Claude into something you did not ask for. Out of scope: Claude Code itself (report those to Anthropic) and the Codex app (report those to OpenAI).
