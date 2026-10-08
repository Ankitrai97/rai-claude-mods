import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

const HOME = 'C:/Users/tester'
const DATA = `${HOME}/.claude/codex-cu`
// Codex's config names the node of its current runtime; an update changes the hash.
const configWith = (hash: string) =>
  `[mcp_servers.node_repl]\ncommand = 'C:\\Users\\tester\\AppData\\Local\\OpenAI\\Codex\\runtimes\\cua_node\\${hash}\\bin\\node_repl.exe'\n\n[mcp_servers.node_repl.env]\nNODE_REPL_NODE_PATH = 'C:\\Users\\tester\\AppData\\Local\\OpenAI\\Codex\\runtimes\\cua_node\\${hash}\\bin\\node.exe'\n`

// Stands in for the engine beneath the mod on a Windows host: env, files, a store, the status
// line, process runs, and a bridge daemon reached over HTTP.
const engine = (on: On, opts: { saved?: boolean; running?: boolean; declined?: string; hash?: string } = {}) => {
  const store = new Map<string, unknown>(opts.saved === undefined ? [] : [['enabled', opts.saved]])
  const files = new Map<string, string>([[`${HOME}/.codex/config.toml`, configWith(opts.hash ?? 'aaa111')]])
  if (opts.running !== false) files.set(`${DATA}/daemon.json`, JSON.stringify({ port: 4321, token: 'tok' }))
  const runs: string[][] = []
  const calls: { url: string; body: any; token?: string }[] = []
  const opened: string[] = []
  const submitted: string[] = []
  let declined = opts.declined ?? '[]'
  on('env.get', ($, e) => ({ value: ({ OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\tester' } as Record<string, string>)[e.name] }))
  const key = (path: string) => path.replace(/\\/g, '/')
  on('fs.read', ($, e) => {
    const text = files.get(key(e.path))
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(key(e.path), e.text)
    return { value: undefined }
  })
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('clock.sleep', () => ({ value: undefined }))
  on('command.register', () => ({ value: undefined }))
  on('tool.register', () => ({ value: undefined }))
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    // start.mjs brings the daemon up and it writes its state file
    if (key(String(e.argv[1] ?? '')).endsWith('/bridge/start.mjs')) files.set(`${DATA}/daemon.json`, JSON.stringify({ port: 5555, token: 'new' }))
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('http.fetch', ($, e) => {
    const token = (e.init?.headers as Record<string, string> | undefined)?.['x-codex-cu-token']
    if (e.url.endsWith('/health')) return { value: { status: 200, ok: true, headers: {}, text: 'ok v3' } }
    calls.push({ url: e.url, body: e.init?.body ? JSON.parse(String(e.init.body)) : null, token })
    const isDeclined = declined !== '[]'
    return { value: { status: isDeclined ? 422 : 200, ok: !isDeclined, headers: { 'x-codex-declined': declined, 'x-codex-busy': '[]' }, text: isDeclined ? 'not approved' : 'done' } }
  })
  on('command.run', ($, e) => ({ text: `engine ran /${e.command} ${e.args}` }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('tool.call', ($, e) => ({ result: `ran ${e.tool}`, text: `ran ${e.tool}`, isError: false }))
  return { files, runs, calls, opened, submitted, setDeclined: (d: string) => (declined = d) }
}

const start = { cwd: 'C:/work', surface: null, isInteractive: false }

// The approval message enters after the command returns: let it land.
const settle = async ($: any) => {
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'mcp__claude-in-chrome__tabs_context_mcp', tool_use_id: `settle-${i}` })
}

test('on by default: blocks Claude computer use, passes other tools', async ($, on) => {
  engine(on)
  await $.session.start(start)

  const own = await $.tool.call({ tool: 'mcp__computer-use__left_click', tool_use_id: 'a' })
  expect(String(own.deny)).toContain('mcp__codex-computer-use__cua')

  const other = await $.tool.call({ tool: 'mcp__claude-in-chrome__navigate', tool_use_id: 'c', url: 'https://example.com' })
  expect(other.text).toBe('ran mcp__claude-in-chrome__navigate')
})

test('off: Claude computer use runs and the Codex bridge refuses', async ($, on) => {
  const { calls } = engine(on, { saved: false })
  await $.session.start(start)

  const own = await $.tool.call({ tool: 'mcp__computer-use__screenshot', tool_use_id: 'a' })
  expect(own.text).toBe('ran mcp__computer-use__screenshot')
  const codex = await $.tool.call({ tool: 'mcp__codex-computer-use__cua', tool_use_id: 'b', code: '1' } as any)
  expect(codex.isError).toBe(true)
  expect(String(codex.text)).toContain('codex-cu is off')
  expect(calls).toEqual([])
})

test('toggling off and on again with /codex-cu', async ($, on) => {
  engine(on)
  await $.session.start(start)
  await $.command.run({ command: 'codex-cu', args: 'off', origin: { kind: 'composer' } } as any)
  expect((await $.tool.call({ tool: 'mcp__computer-use__screenshot', tool_use_id: 'a' })).text).toBe('ran mcp__computer-use__screenshot')
  await $.command.run({ command: 'codex-cu', args: 'on', origin: { kind: 'composer' } } as any)
  expect(String((await $.tool.call({ tool: 'mcp__computer-use__screenshot', tool_use_id: 'b' })).deny)).toContain('Codex')
})

test('no daemon yet: starts the bridge with the node of Codex\'s current runtime', async ($, on) => {
  const { runs, calls } = engine(on, { running: false, hash: 'bbb222' })
  await $.session.start(start)
  const r = await $.tool.call({ tool: 'mcp__codex-computer-use__cua', tool_use_id: 'a', code: '1' } as any)
  expect(r.text).toBe('done')
  expect(runs[0][0]).toBe('C:\\Users\\tester\\AppData\\Local\\OpenAI\\Codex\\runtimes\\cua_node\\bbb222\\bin\\node.exe')
  expect(String(runs[0][1]).replace(/\\/g, '/').endsWith('/bridge/start.mjs')).toBe(true)
  expect(String(runs[0][2]).replace(/\\/g, '/')).toBe(DATA)
  expect(calls[0]).toEqual({ url: 'http://127.0.0.1:5555/js', body: { code: '1', approve: [], session: 'sess-1' }, token: 'new' })
})

test('an unapproved app opens the approval pane; allowing it passes it on and resumes the task', async ($, on) => {
  const { calls, opened, submitted, setDeclined } = engine(on, { declined: '["Calculator"]' })
  await $.session.start(start)

  const first = await $.tool.call({ tool: 'mcp__codex-computer-use__cua', tool_use_id: 'a', code: 'await sky.launch_app({ app: "calc" })' } as any)
  expect(first.isError).toBe(true)
  expect(String(first.text)).toContain('approval to use Calculator')
  expect(opened).toEqual(['codex-approval'])
  expect(calls[0].token).toBe('tok')

  await $.command.run({ command: 'codex-cu', args: 'allow', origin: { kind: 'composer' } } as any)
  await settle($)
  expect(submitted[0]).toContain('allowed Codex computer use to use Calculator for this chat')

  setDeclined('[]')
  const second = await $.tool.call({ tool: 'mcp__codex-computer-use__cua', tool_use_id: 'b', code: '2' } as any)
  expect(second.text).toBe('done')
  expect(calls[1].body.approve).toEqual(['Calculator'])
})

test('always allow is saved for later chats; deny is not', async ($, on) => {
  const { files, submitted } = engine(on)
  await $.session.start(start)
  await $.command.run({ command: 'codex-cu', args: 'always TextEdit', origin: { kind: 'composer' } } as any)
  await $.command.run({ command: 'codex-cu', args: 'deny Paint', origin: { kind: 'composer' } } as any)
  await settle($)
  expect(JSON.parse(files.get(`${DATA}/always-allowed.json`) ?? '{}').apps).toEqual(['TextEdit'])
  expect(submitted[1]).toContain('did not allow')
})

test('each subagent gets its own Codex session key', async ($, on) => {
  const { calls } = engine(on)
  await $.session.start(start)
  await $.tool.call({ tool: 'mcp__codex-computer-use__cua', tool_use_id: 'a', code: '1', agentId: 'agent-7' } as any)
  await $.tool.call({ tool: 'mcp__codex-computer-use__cua_reset', tool_use_id: 'b', agentId: 'agent-7' } as any)
  expect(calls.map(c => [c.url.replace('http://127.0.0.1:4321', ''), c.body.session])).toEqual([['/js', 'sess-1/agent-7'], ['/reset', 'sess-1/agent-7']])
  expect(calls[0].body.agentId).toBeUndefined()
})
