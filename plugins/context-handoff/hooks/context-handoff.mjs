// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Modified 2026 by Rapple AI: green/amber/red context bar and a handoff note
// carried from one chat to the next. See CHANGES.md.
//
// Context Handoff: how full the chat's context is, above the prompt, and a
// one-click handoff to a fresh chat.
//
// turn.complete: after each main-loop turn, read the context window's fill
// from $.session.usage() (the same figures the status line shows) and keep
// the last HISTORY readings.
// session.start: take a first reading. If the project has a handoff note from
// the last 24 hours, written before this chat began, load it and rename it to
// handoff-used.md so it loads only once.
// prompt.compose: while a note is loaded, carry it in the system prompt.
// ui.render (AbovePrompt): one line: the fill in green, amber or red, the
// tokens used of the window, a chart of recent turns, and an H button.
// command.run (/handoff) and the H button: ask Claude to write the note.
// tool.call (Write, Edit): notice when the note is saved.
//
// The host reads on(...) and $.noun.method(...) from source, so they are
// spelled literally, and helpers that take $ are top-level functions.

import { atom, read, update } from "claude-code";

const HISTORY = 12;
const BARS = "▁▂▃▄▅▆▇█";
const DAY_MS = 24 * 60 * 60 * 1000;
const NOTE = ".claude/handoff.md";
const USED = ".claude/handoff-used.md";
const AMBER = "#FFB000";

const loaded = atom({ plugin: "context-handoff", key: "loaded" }, null);
const askedAt = atom({ plugin: "context-handoff", key: "askedAt" }, null);
const savedAt = atom({ plugin: "context-handoff", key: "savedAt" }, null);

// Readings: { tokens, window, percent }, oldest first.
let readings = [];
// The project the session runs in, with forward slashes.
let cwd = "";

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    cwd = e.cwd.replace(/\\/g, "/").replace(/\/$/, "");
    readings = [];
    try {
      await $.command.register({
        name: "handoff",
        description: "Write a handoff note to .claude/handoff.md so the next chat in this project picks up where this one left off",
      });
    } catch {
      // offered as /context-handoff:handoff instead
    }
    await takeReading($);
    await loadHandoff($, cwd);
    return result;
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (e.agentId) {
      return result;
    }
    await takeReading($);
    return result;
  });

  on("prompt.compose", async ($, e, next) => {
    const composed = await next(e);
    const note = await read($, loaded);
    if (!note) {
      return composed;
    }
    return {
      ...composed,
      sections: [...composed.sections, { id: "context-handoff:note", text: noteSection(note), scope: "session" }],
    };
  });

  // A command hook holds the turn, so the request goes out once it returns.
  on("command.run", { command: ["handoff", "context-handoff:handoff"] }, ($, e) => {
    requestHandoffLater($, cwd).catch(() => {});
    return { text: `Asking Claude to write the handoff note to ${NOTE}…` };
  }).catch(() => ({ text: "context-handoff: could not ask for the note. Ask Claude to write .claude/handoff.md." }));

  on("tool.call", { tool: ["Write", "Edit"] }, async ($, e, next) => {
    const result = await next(e);
    const path = String(e.file_path ?? "").replace(/\\/g, "/");
    if (!result.deny && !result.isError && path.endsWith(`/${NOTE}`)) {
      // only a status line: never let it touch the tool's own result
      await markSaved($).catch(() => {});
    }
    return result;
  }).catch(($, e, next) => next(e));

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.hasSurvey) {
      return next(e);
    }
    const elements = $.ui.resolve(e);
    const status = {
      note: await read($, loaded),
      asked: await read($, askedAt),
      saved: await read($, savedAt),
    };
    return band($, elements, e.bodyColumns ?? 80, status);
  });
}

async function takeReading($) {
  try {
    const { context } = await $.session.usage();
    if (!context || !context.window) {
      return;
    }
    const tokens = context.tokens ?? 0;
    const percent = Math.round(context.percent ?? (tokens / context.window) * 100);
    // The session.start reading is 0 before any response; drop it once real readings arrive.
    readings = readings.filter((r) => r.tokens > 0);
    readings.push({ tokens, window: context.window, percent });
    if (readings.length > HISTORY) {
      readings = readings.slice(-HISTORY);
    }
    $.ui.invalidate("ui.render");
  } catch {
    // No reading this turn; the band keeps the last one.
  }
}

// Loads a note the last chat in this project left, once.
async function loadHandoff($, dir) {
  // a reload of the mod in the same chat: the note is already in
  if (!dir || (await read($, loaded))) {
    return;
  }
  const path = `${dir}/${NOTE}`;
  try {
    if (!(await $.fs.exists(path))) {
      return;
    }
    const stat = await $.fs.stat(path);
    const now = await $.clock.now();
    const { startedAt } = await $.session.usage();
    // A note saved during this chat is for the next one; one over a day old is stale.
    if (stat.mtimeMs >= startedAt || now - stat.mtimeMs > DAY_MS) {
      return;
    }
    const text = String(await $.fs.read(path)).trim();
    if (!text) {
      return;
    }
    await update($, loaded, () => ({ text, writtenAt: stat.mtimeMs }));
    await markUsed($, dir, text);
    $.ui.toast(`Loaded the handoff note from ${ago(now - stat.mtimeMs)} ago`);
    $.ui.invalidate("ui.render");
  } catch {
    // No note this time.
  }
}

// Renames handoff.md to handoff-used.md. Mods cannot rename files, so a small
// system command does it; if that fails, keep a used copy and empty the note,
// which never loads (an empty note is skipped).
async function markUsed($, dir, text) {
  const from = `${dir}/${NOTE}`;
  const to = `${dir}/${USED}`;
  const isWindows = (await $.env.get("OS")) === "Windows_NT";
  const argv = isWindows
    ? ["powershell", "-NoProfile", "-NonInteractive", "-Command", `Move-Item -LiteralPath '${psQuote(from)}' -Destination '${psQuote(to)}' -Force`]
    : ["mv", "-f", from, to];
  try {
    const ran = await $.process.run(argv, { cwd: dir });
    if (ran.exitCode === 0 && !(await $.fs.exists(from))) {
      return;
    }
  } catch {
    // fall back below
  }
  await $.fs.write(to, `${text}\n`);
  await $.fs.write(from, "");
}

async function markSaved($) {
  const now = await $.clock.now();
  await update($, savedAt, () => now);
  $.ui.invalidate("ui.render");
}

// The session's folder is read now, not at start: a chat can move to another
// project after it starts, and the note belongs where the chat is.
async function requestHandoff($, startDir) {
  const dir = await currentDir($, startDir);
  const now = await $.clock.now();
  await update($, askedAt, () => now);
  $.ui.invalidate("ui.render");
  await $.prompt.submit({ text: handoffPrompt(dir), asUser: true });
}

async function requestHandoffLater($, dir) {
  try {
    await $.clock.sleep(150);
    await requestHandoff($, dir);
  } catch (error) {
    $.ui.toast(`context-handoff: could not ask for the note (${String(error).slice(0, 80)})`);
  }
}

async function currentDir($, fallback) {
  try {
    return (await $.session.cwd()).replace(/\\/g, "/").replace(/\/$/, "") || fallback;
  } catch {
    return fallback;
  }
}

function handoffPrompt(dir) {
  return [
    "Write a handoff note so a fresh chat can pick up this work without me explaining it again.",
    `Save it to ${dir}/${NOTE} (create the .claude folder if needed, and replace any older note).`,
    "",
    "Rules:",
    "- Plain English, under 300 words, specific: names, numbers, file paths, commands. No secrets.",
    "- Use exactly these five headings, in this order: ## Goal, ## What's done, ## Decisions made, ## Key files, ## Next steps",
    "- Key files: real paths, each with a few words on why it matters.",
    "- Next steps: numbered, the very next action first.",
    "",
    "After saving it, reply with one line: where it is and how many words it has.",
  ].join("\n");
}

function noteSection(note) {
  return [
    "# Handoff from the previous chat in this project",
    `The person ended their last chat here with the handoff note below (saved ${stamp(note.writtenAt)}). It is the context for this chat: when they ask what you were working on, or to carry on, answer from it without asking them to explain again. The note has been renamed to ${USED}, so it loads only once.`,
    "",
    note.text,
  ].join("\n");
}

// Green under 60%, amber from 60 to 80%, red above 80%.
function levelFor(percent) {
  if (percent < 60) return { color: "green", word: "" };
  if (percent <= 80) return { color: AMBER, word: " · getting full" };
  return { color: "red", word: " · hand off soon" };
}

function band($, elements, columns, status) {
  const { Box, Text, Button } = elements;
  const now = readings[readings.length - 1] ?? { tokens: 0, window: 0, percent: 0 };
  const level = levelFor(now.percent);
  const parts = [Text({ color: level.color, bold: true, children: `● ${now.percent}% context${level.word}` })];
  if (now.window) {
    parts.push(Text({ dimColor: true, children: `  ${short(now.tokens)} / ${short(now.window)}` }));
  }
  if (columns >= 70 && readings.length > 1) {
    parts.push(Text({ color: level.color, children: `  ${chart()}` }));
  }
  const line = statusLine(status);
  if (line) {
    parts.push(Text({ dimColor: true, children: `  ${line}` }));
  }
  parts.push(Text({ children: "  " }));
  parts.push(Button({ key: "handoff", label: "H  Handoff", hotkey: "h", onPress: () => requestHandoff($, cwd) }));
  return Box({ flexDirection: "row", paddingX: 1, children: parts });
}

function statusLine({ note, asked, saved }) {
  if (saved !== null && (asked === null || saved >= asked)) return `handoff saved to ${NOTE}`;
  if (asked !== null) return "writing handoff…";
  if (note) return "loaded last chat's handoff";
  return "";
}

// Bars scale to the busiest reading shown, so growth shows at any fill level.
function chart() {
  const top = Math.max(...readings.map((r) => r.tokens), 1);
  const bars = readings.map((r) => BARS[Math.min(BARS.length - 1, Math.floor((r.tokens / top) * (BARS.length - 1)))]);
  return bars.join("");
}

function short(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

function ago(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function stamp(ms) {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function psQuote(path) {
  return path.replace(/'/g, "''");
}
