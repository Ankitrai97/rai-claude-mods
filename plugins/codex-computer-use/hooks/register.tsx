import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CodexCuPending } from '../types'

// Codex's computer-use engine (node_repl + @oai/sky on Windows, cua_repl on macOS) drives apps in
// the background on macOS; on Windows it reads apps through UI Automation but takes the foreground to act. The
// mod reaches it through a small daemon (bridge/daemon.mjs, shipped in this plugin) that keeps one
// engine per Claude session. Codex asks before using each app; the daemon answers yes only for
// apps the person allowed in the pane below. The daemon listens on 127.0.0.1 and requires the
// token it writes to <home>/.claude/codex-cu/daemon.json.
const BRIDGE = 'mcp__codex-computer-use__cua'
const BRIDGE_RESET = 'mcp__codex-computer-use__cua_reset'
const OWN_COMPUTER_USE = /^mcp__(computer-use__|remote-devices__computer)/
const MAC_NODE = '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node'
const PANE = 'codex-approval'
const DAEMON_VERSION = 'v3'

type Host = { home: string; data: string; isWindows: boolean }
type Daemon = { url: string; token: string }
type Standing = { apps: string[]; autoApproveAll: boolean }

const alwaysFile = (host: Host) => `${host.data}/always-allowed.json`

async function readStanding($: EngineInterface, host: Host): Promise<Standing> {
  try {
    const parsed = JSON.parse(String(await $.fs.read(alwaysFile(host))))
    return { apps: Array.isArray(parsed.apps) ? parsed.apps : [], autoApproveAll: parsed.autoApproveAll === true }
  } catch {
    return { apps: [], autoApproveAll: false }
  }
}

async function writeStanding($: EngineInterface, host: Host, change: Partial<Standing>) {
  const standing = await readStanding($, host)
  await $.fs.write(alwaysFile(host), `${JSON.stringify({ ...standing, ...change }, null, 2)}\n`)
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

async function daemonInfo($: EngineInterface, host: Host): Promise<Daemon | null> {
  try {
    const state = JSON.parse(String(await $.fs.read(`${host.data}/daemon.json`)))
    return { url: `http://127.0.0.1:${state.port}`, token: String(state.token) }
  } catch {
    return null
  }
}

async function daemonFetch($: EngineInterface, daemon: Daemon, path: string, body?: unknown) {
  return $.http.fetch(`${daemon.url}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-codex-cu-token': daemon.token },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function healthOf($: EngineInterface, daemon: Daemon | null): Promise<string | null> {
  if (daemon === null) return null
  try {
    const res = await daemonFetch($, daemon, '/health')
    return res.ok ? res.text.trim() : null
  } catch {
    return null
  }
}

// Node to run the bridge with: the one Codex's current runtime ships (read fresh from Codex's own
// config, so a Codex update never leaves it pointing at an old folder), else node on PATH.
async function nodeCandidates($: EngineInterface, host: Host): Promise<string[]> {
  const found: string[] = []
  if (host.isWindows) {
    try {
      const toml = String(await $.fs.read(`${host.home}/.codex/config.toml`))
      const path = /NODE_REPL_NODE_PATH\s*=\s*(?:'([^']+)'|"([^"]+)")/.exec(toml)
      const node = path?.[1] ?? path?.[2]?.replace(/\\\\/g, '\\')
      if (node) found.push(node)
    } catch {
      // no Codex config: node on PATH below
    }
  } else {
    found.push(MAC_NODE)
  }
  return [...found, 'node']
}

async function ensureDaemon($: EngineInterface, host: Host): Promise<Daemon | string> {
  let daemon = await daemonInfo($, host)
  const health = await healthOf($, daemon)
  if (daemon !== null && health === `ok ${DAEMON_VERSION}`) return daemon
  // an older daemon speaks another protocol: ask it to leave
  if (daemon !== null && health !== null) {
    try {
      await daemonFetch($, daemon, '/quit', {})
    } catch {
      // already gone
    }
    await $.clock.sleep(300)
  }

  let started = ''
  for (const node of await nodeCandidates($, host)) {
    try {
      const ran = await $.process.run([node, `${$.plugin.root}/bridge/start.mjs`, host.data], { cwd: host.home })
      if (ran.exitCode === 0) {
        started = node
        break
      }
    } catch {
      // this node could not start: try the next
    }
  }
  if (started === '') return `Could not start the Codex computer-use bridge: no working Node found (Codex runtime or node on PATH). Is the Codex app installed?`

  for (let i = 0; i < 40; i++) {
    await $.clock.sleep(250)
    daemon = await daemonInfo($, host)
    if ((await healthOf($, daemon)) === `ok ${DAEMON_VERSION}` && daemon !== null) return daemon
  }
  return `The Codex computer-use bridge did not start. See ${host.data}/daemon.log.`
}

const pending = atom({ plugin: 'codex-computer-use', key: 'pending' } as const, null as CodexCuPending)
const allowed = atom({ plugin: 'codex-computer-use', key: 'allowed' } as const, [] as string[])

const WINDOWS_ROUTING = `# Desktop apps go through Codex computer use (codex-cu mod is on)

For any task that needs to see or operate a desktop app on this Windows PC, use Codex's Windows computer-use engine through \`${BRIDGE}\` (reset with \`${BRIDGE_RESET}\`; load them with ToolSearch if they are deferred). Your own mcp__computer-use__* tools are blocked while this mode is on. The point of this mode: Codex reads apps through Windows UI Automation (exact values, not screenshots) and asks the person before using each app. On Windows it is not background automation: typing and clicks bring the app to the front and take over input while they run, so tell the person to leave the machine alone during a run.

How to drive it:
- The tool runs JavaScript in a persistent node_repl. Print with \`nodeRepl.write(string)\` (JSON.stringify objects). Keep values across calls on \`globalThis\`; top-level const/let cannot be redeclared by a later call.
- First call (or after a reset): \`if (!globalThis.sky) { const { sky } = await import("@oai/sky"); globalThis.sky = sky; }\` then \`globalThis.apps = await sky.list_apps();\` and print the id, displayName and window count of the apps you need.
- Use the app \`id\` list_apps returned (Calculator is \`Microsoft.WindowsCalculator_8wekyb3d8bbwe!App\`). If it has no window: \`await sky.launch_app({ app: id })\`, wait about 1.5 s, call list_apps again and take the returned window object. Never build a window object yourself.
- Observe: \`globalThis.state = await sky.get_window_state({ window, include_screenshot: false, include_text: true })\`, then print \`state.accessibility.tree\` (filter its lines when it is long). \`document_text\`, \`focused_element\` and \`selected_text\` are on \`state.accessibility\` too. Element indexes are valid only for the latest state: observe again after every action that changes the UI.
- Act mostly by keyboard: \`sky.press_key({ window, key: "Control_L+b" })\` (X keysym names: Return, Tab, Escape, Up, Down, Alt_L, Control_L+a, Control_L+Home, KP_0..KP_9; press ribbon KeyTips one key per call, e.g. Alt_L then a then m) and \`sky.type_text({ window, text })\` once the focus is confirmed. \`sky.set_value({ window, element_index, value })\` sets an edit field directly (in Excel, set the Name Box to a range like "A1:F1" and press Return instead of using Go To). \`sky.click({ window, element_index })\` can fail with "geometry unavailable" or "not in cached state"; fall back to the keyboard. Coordinate clicks (\`sky.click({ window, screenshotId, x, y })\`) move the person's real cursor: use them only when nothing else works.
- Pop-up dialogs (Excel's Remove Duplicates, Greater Than, Save As) often do not appear in the accessibility tree or in list_windows. Take a screenshot to see where the keyboard focus is before pressing Return (Return presses the focused button, not always OK), and if keys stop having any effect, the dialog has lost the foreground: \`sky.activate_window({ window })\` first.
- Screenshots: pass \`include_screenshot: true\` only when the accessibility tree is not enough; the result names a saved image you can open with Read.
- After an error or a surprise, observe before retrying: an action can fail yet still apply, and a dialog may have opened (find it with \`sky.list_windows()\`).
- Each app needs the person's approval. If the result says they are being asked, stop and wait for their answer; a message will say what they chose. Never try to get around a denial.
- Codex's own limits apply: never automate terminals, the Run dialog, password managers, security apps, sign-in dialogs or the Codex/ChatGPT app, and never press the Windows key.
- Other Claude sessions may use computer use at the same time; an app one of them is driving is leased to it. If told an app is in use, use another app or wait about a minute.
- Prefer purpose-built tools first (a CLI, an API, a connector, the browser tools for web pages). Use this for native apps and anything only the GUI can do. Say where the result is when you finish.`

const MAC_ROUTING = `# Desktop apps go through Codex computer use (codex-cu mod is on)

For any task that needs to see or operate a desktop app on this Mac, use Codex's computer-use engine through \`${BRIDGE}\` (reset with \`${BRIDGE_RESET}\`). The mcp__computer-use__* tools are blocked while this mode is on.

- It runs JavaScript in a persistent REPL with a \`cua\` object. First call (or after a reset): exactly one entry call, such as \`let app = await cua.getApp("Calculator");\`, and nothing else. Its result carries the API documentation and the app's accessibility tree; use only documented APIs.
- Prefer element indices from the accessibility tree over coordinates, and keyboard shortcuts where the app has them. Re-read indices after every action.
- It works in the background without moving the person's cursor.
- Each app needs approval. If the result says the person is being asked, stop and wait for their answer. Never get around a denial.`

// Records the person's answer to an app approval and closes the pane; resolves the message that
// tells Claude what they chose.
async function grant($: EngineInterface, host: Host, app: string, choice: 'session' | 'always' | 'deny'): Promise<string> {
  if (choice !== 'deny') {
    if (choice === 'always') {
      const standing = await readStanding($, host)
      if (!standing.apps.some(one => same(one, app))) await writeStanding($, host, { apps: [...standing.apps, app] })
    }
    await update($, allowed, list => (list.some(one => same(one, app)) ? list : [...list, app]))
  }
  await update($, pending, () => null)
  try {
    await $.ui.close({ id: PANE })
  } catch {
    // the pane was not open
  }
  return choice === 'session'
    ? `I allowed Codex computer use to use ${app} for this chat. Retry the last call and continue the task.`
    : choice === 'always'
      ? `I always allowed Codex computer use to use ${app}. Retry the last call and continue the task.`
      : `I did not allow Codex computer use to use ${app}. Do not use ${app}; tell me another way or stop.`
}

// Hands the person's answer to Claude as their message. A command hook cannot submit while it
// holds the turn, so it calls this without awaiting and the message enters once the command is done.
async function resume($: EngineInterface, text: string) {
  try {
    await $.clock.sleep(150)
    await $.prompt.submit({ text, asUser: true })
  } catch (error) {
    $.ui.toast(`codex-cu: could not tell Claude (${String(error).slice(0, 100)}). Say "continue".`)
  }
}

export const register: Register = on => {
  let isOn = true
  let host: Host = { home: '', data: '', isWindows: false }

  on('session.start', async ($, e, next) => {
    isOn = (await $.store.get('enabled')) !== false
    const isWindows = (await $.env.get('OS')) === 'Windows_NT'
    const home = ((isWindows ? await $.env.get('USERPROFILE') : await $.env.get('HOME')) ?? '').replace(/\\/g, '/')
    host = { home, data: `${home}/.claude/codex-cu`, isWindows }
    try {
      await $.command.register({
        name: 'codex-cu',
        description: 'Codex computer use: on, off, status, allow/always/deny <app>, auto on/off, forget <app>',
        argumentHint: '[on|off|status|allow <app>|always <app>|deny <app>|auto on|auto off|forget <app>]',
        immediate: true,
      })
    } catch {
      // offered as /codex-computer-use:codex-cu instead
    }
    $.ui.status(isOn ? 'Codex CU on' : undefined)
    try {
      await $.tool.register({
        name: 'cua',
        description: isWindows
          ? "Codex computer use for Windows desktop apps (reads exact values through UI Automation; acting brings the app to the front). Runs JavaScript in Codex's persistent node_repl; import `sky` from \"@oai/sky\" and call sky.list_apps(), sky.launch_app(), sky.get_window_state(), sky.click({ window, element_index }), sky.set_value(), sky.press_key(), sky.type_text(). Print with nodeRepl.write(). Apps need the person's approval."
          : "Codex computer use: control native Mac apps in the background. Runs JavaScript in Codex's persistent cua_repl with a `cua` object. First call: exactly one entry call, e.g. `let app = await cua.getApp(\"Calculator\");`. Apps need the person's approval.",
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'JavaScript to run in the Codex computer-use REPL.' },
            timeout_ms: { type: 'integer', minimum: 1, description: 'Execution timeout in milliseconds (default 30000).' },
            title: { type: 'string', maxLength: 80, description: 'Short user-facing description of what the code does.' },
          },
          required: ['code'],
        },
      })
      await $.tool.register({
        name: 'cua_reset',
        description: 'Reset the Codex computer-use JavaScript session. Does not close apps or windows.',
      })
    } catch (error) {
      $.ui.toast(`codex-cu: tool not registered (${String(error).slice(0, 120)})`)
    }

    return next(e)
  })

  on('tool.call', { tool: [BRIDGE, BRIDGE_RESET] }, async ($, e) => {
    const { tool, tool_use_id, agentId, ...args } = e as typeof e & { agentId?: string }
    const fail = (text: string) => ({ result: text, text, isError: true as const })
    if (!isOn) {
      return fail('codex-cu is off, so desktop computer use goes through your own computer-use tools (mcp__computer-use__*). The person can switch Codex back on with /codex-cu on.')
    }
    // its own Codex engine per Claude session, and per subagent inside it
    const session = `${await $.session.id()}${agentId ? `/${agentId}` : ''}`
    const isReset = tool === BRIDGE_RESET

    const daemon = await ensureDaemon($, host)
    if (typeof daemon === 'string') return fail(daemon)

    const approve = await read($, allowed)
    const res = await daemonFetch($, daemon, isReset ? '/reset' : '/js', isReset ? { session } : { ...args, approve, session })
    const busy: { app: string; idleSeconds: number }[] = JSON.parse(res.headers['x-codex-busy'] ?? '[]')
    if (busy.length > 0) {
      const { app, idleSeconds } = busy[0]
      return fail(
        `${app} is being driven by another Claude session right now (its last call was ${idleSeconds}s ago), so it is leased to that session. Work in a different app, or wait about a minute and retry. Do not try to get around it.`,
      )
    }
    const declined: string[] = JSON.parse(res.headers['x-codex-declined'] ?? '[]')
    if (declined.length > 0) {
      const app = declined[0]
      await update($, pending, () => ({ app }))
      let isShown = false
      try {
        isShown = (await $.ui.open({ id: PANE, title: 'Codex computer use', focus: true, closeOnEscape: true, rows: 6 })).isPlaced
      } catch {
        isShown = false
      }
      $.ui.toast(`Codex wants to use ${app}: allow for this chat, always allow, or don't allow`)
      return fail(
        `Codex needs the person's approval to use ${app}. They are being asked now${isShown ? ' in the Codex computer use panel' : ''} (they can also answer with /codex-cu allow ${app}, /codex-cu always ${app} or /codex-cu deny ${app}). Stop and wait: a message will say what they chose, and then you can retry the same call.`,
      )
    }

    return res.ok ? { result: res.text, text: res.text } : fail(res.text || `The bridge answered ${res.status}.`)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const ask = await read($, pending)
    if (ask === null) return <Text dimColor>No approval waiting.</Text>
    const app = ask.app

    return (
      <Box flexDirection="column">
        <Text>Allow Codex computer use to use {app}?</Text>
        <Text dimColor>It sends real clicks and keystrokes to {app}; on Windows the app comes to the front while it works.</Text>
        <Box>
          <Button key="allow" label="Allow for this chat" hotkey="a" variant="primary" autoFocus onPress={async () => resume($, await grant($, host, app, 'session'))} />
          <Text> </Text>
          <Button key="always" label="Always allow" hotkey="l" onPress={async () => resume($, await grant($, host, app, 'always'))} />
          <Text> </Text>
          <Button key="deny" label="Don't allow" hotkey="d" role="dismiss" onPress={async () => resume($, await grant($, host, app, 'deny'))} />
        </Box>
      </Box>
    )
  })

  on('command.run', { command: ['codex-cu', 'codex-computer-use:codex-cu'] }, async ($, e) => {
    const raw = e.args.trim()
    const arg = raw.toLowerCase()
    const verb = arg.split(/\s+/)[0] ?? ''
    const target = raw.slice(verb.length).trim()

    if (verb === 'allow' || verb === 'always' || verb === 'deny') {
      const ask = await read($, pending)
      const app = target || ask?.app
      if (!app) return { text: `Usage: /codex-cu ${verb} <app name>` }
      void resume($, await grant($, host, app, verb === 'allow' ? 'session' : verb))
      return { text: verb === 'deny' ? `Not allowed: ${app}.` : `Allowed${verb === 'always' ? ' always' : ' for this chat'}: ${app}.` }
    }
    if (arg === 'auto on' || arg === 'auto off') {
      const isAuto = arg === 'auto on'
      await writeStanding($, host, { autoApproveAll: isAuto })
      return {
        text: isAuto
          ? "Auto-approve is on: Codex computer use may use any app without asking (Codex's own safety blocks still apply)."
          : 'Auto-approve is off: apps not on the always-allowed list ask first.',
      }
    }
    if (verb === 'forget') {
      if (target === '') return { text: 'Usage: /codex-cu forget <app name> (or: all)' }
      const always = (await readStanding($, host)).apps
      const isAll = same(target, 'all')
      const kept = isAll ? [] : always.filter(one => !same(one, target))
      await writeStanding($, host, { apps: kept })
      await update($, allowed, list => (isAll ? [] : list.filter(one => !same(one, target))))
      return { text: kept.length === always.length && !isAll ? `${target} was not on the always-allowed list.` : `Removed. Always allowed now: ${kept.length > 0 ? kept.join(', ') : 'none'}.` }
    }
    if (arg === 'on' || arg === 'off') {
      isOn = arg === 'on'
      await $.store.set('enabled', isOn)
      $.ui.status(isOn ? 'Codex CU on' : undefined)
    } else if (arg !== '' && arg !== 'status') {
      return { text: 'Usage: /codex-cu [on|off|status|allow <app>|always <app>|deny <app>|auto on|auto off|forget <app>]' }
    }

    const apps = await read($, allowed)
    const standing = await readStanding($, host)
    const mode = isOn
      ? 'On. Desktop apps go through Codex (exact values from UI Automation, per-app approval); my own computer-use tools are blocked. On Windows the app comes to the front while Codex works.'
      : 'Off. I use my own computer-use tools.'
    const lines = [
      `Codex computer use: ${mode}`,
      standing.autoApproveAll ? 'Auto-approve: ON, every app is allowed without asking (/codex-cu auto off to ask again).' : 'Auto-approve: off.',
      apps.length > 0 ? `Allowed this chat: ${apps.join(', ')}.` : 'No apps allowed yet in this chat.',
      `Always allowed: ${standing.apps.length > 0 ? standing.apps.join(', ') : 'none'} (revoke with /codex-cu forget <app>).`,
    ]
    const daemon = await daemonInfo($, host)
    if ((await healthOf($, daemon)) === null || daemon === null) {
      lines.push('Bridge: not running (it starts on first use).')
    } else {
      try {
        const me = await $.session.id()
        const users: { session: string; busy: boolean; leases: string[]; idleSeconds: number }[] = JSON.parse((await daemonFetch($, daemon, '/sessions')).text)
        lines.push(
          users.length === 0
            ? 'Bridge: running, no sessions using it.'
            : `Bridge: ${users.map(u => `${u.session.startsWith(me) ? 'this chat' : u.session.slice(0, 8)}${u.busy ? ' working' : ` idle ${u.idleSeconds}s`}${u.leases.length > 0 ? `, holds ${u.leases.join(', ')}` : ''}`).join('; ')}.`,
        )
      } catch {
        lines.push('Bridge: running.')
      }
    }
    return { text: lines.join('\n') }
  })

  // a session that ends frees its Codex engines and app leases at once
  on('session.end', async ($, e, next) => {
    const done = await next(e)
    try {
      const daemon = await daemonInfo($, host)
      if (daemon !== null) await daemonFetch($, daemon, '/end', { session: e.sessionId })
    } catch {
      // no bridge running: nothing to free
    }
    return done
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!isOn) return composed
    return {
      ...composed,
      sections: [...composed.sections, { id: 'codex-cu:routing', text: host.isWindows ? WINDOWS_ROUTING : MAC_ROUTING, scope: 'session' as const }],
    }
  })

  on('tool.call', { tool: OWN_COMPUTER_USE }, ($, e, next) =>
    isOn
      ? {
          deny: `codex-cu mode is on, so desktop computer use goes through Codex. Use ${BRIDGE} instead (load it with ToolSearch if needed). The person can switch back with /codex-cu off.`,
        }
      : next(e),
  )
}
