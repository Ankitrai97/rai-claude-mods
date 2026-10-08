import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'

const PANE_PROPS = {
  title: 'Simple Mode',
  isFocused: false,
  bodyColumns: 80,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 28 },
  view: {},
} as const

const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

const SETTINGS = 'C:/Users/tester/.claude/simple-mode.json'

/** The store, env and files beneath the plugin, kept in maps the test can read. */
const memStore = (on: On, seed: Record<string, string> = {}) => {
  const mem: Record<string, unknown> = {}
  const files = new Map<string, string>(Object.entries(seed))
  const key = (path: string) => path.replace(/\\/g, '/')
  on('store.get', (_$, e) => ({ value: mem[e.key] }))
  on('store.set', (_$, e) => {
    mem[e.key] = e.value
    return { value: undefined }
  })
  on('env.get', (_$, e) => ({ value: ({ OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\tester' } as Record<string, string>)[e.name] }))
  on('fs.exists', (_$, e) => ({ value: files.has(key(e.path)) }))
  on('fs.read', (_$, e) => {
    const text = files.get(key(e.path))
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.write', (_$, e) => {
    files.set(key(e.path), e.text)
    return { value: undefined }
  })
  return Object.assign(mem, { files })
}

/** The engine's own tool row, as the test stands for it. */
const engineRow = (on: On) =>
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{`${e.props.tool}(full detail)`}</Text>
  })

const ROW = {
  tool_use_id: 'toolu_1',
  tool: 'Read',
  input: { file_path: 'notes/kickoff-call.md' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  output: { type: 'text', file: { filePath: 'notes/kickoff-call.md', content: 'hi', numLines: 1, startLine: 1, totalLines: 1 } },
} as const

test('/simple turns it on, remembers it, and the checklist ticks a step off', async ($, on) => {
  const mem = memStore(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('tool.call', () => ({ result: { stdout: 'ok', stderr: '' } }))

  await $.command.run({ command: 'simple', args: 'on', ...CMD })
  expect(mem.isOn).toBe(true)
  expect(JSON.parse(mem.files.get(SETTINGS) ?? '{}')).toEqual({ isOn: true })

  await $.tool.call({ tool: 'Read', file_path: 'notes/kickoff-call.md' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'simple-mode',
      surface,
      component: 'Pane',
      requestId: 'simple-mode',
      props: PANE_PROPS,
      viewport: { columns: 80, rows: 30 },
    })
    expect(await ui.find({ type: 'Text', text: /Reading the kickoff call notes/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /done/ })).toBeDefined()
    await ui.unmount()
  }

  await $.command.run({ command: 'simple', args: 'off', ...CMD })
  expect(mem.isOn).toBe(false)
  expect(JSON.parse(mem.files.get(SETTINGS) ?? '{}')).toEqual({ isOn: false })
})

test('a new chat starts in the state the settings file holds, whatever its store says', async ($, on) => {
  const mem = memStore(on, { [SETTINGS]: '{"isOn":true}\n' })
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: 'C:/work', source: 'startup' } as never)
  expect(opened).toEqual(['simple-mode'])
  // On already, so a bare /simple turns it off.
  const ran = await $.command.run({ command: 'simple', args: '', ...CMD })
  expect(ran.text).toMatch(/off/)
  expect(JSON.parse(mem.files.get(SETTINGS) ?? '{}')).toEqual({ isOn: false })
})

test('a tool row is one line while on, expands on press, and is normal when off', async ($, on) => {
  memStore(on)
  engineRow(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  await $.command.run({ command: 'simple', args: 'on', ...CMD })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'simple-mode',
      surface,
      component: 'ToolUse',
      requestId: ROW.tool_use_id,
      props: ROW as never,
      viewport: { columns: 100, rows: 30 },
    })
    const line = await ui.find({ key: 'simple-expand' })
    expect(line?.text).toMatch(/✓ Reading the kickoff call notes/)
    expect(await ui.find({ type: 'Text', text: /full detail/ })).toBeUndefined()
    const pressed = await ui.press({ key: 'simple-expand' })
    expect(pressed).toBeDefined()
    expect(await ui.find({ key: 'simple-collapse' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /full detail/ })).toBeDefined()
    await ui.press({ key: 'simple-collapse' })
    expect(await ui.find({ key: 'simple-expand' })).toBeDefined()
    await ui.unmount()
  }

  await $.command.run({ command: 'simple', args: 'off', ...CMD })
  const ui = await $.ui.mount({
    plugin: 'simple-mode',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: ROW.tool_use_id,
    props: ROW as never,
    viewport: { columns: 100, rows: 30 },
  })
  expect(await ui.find({ key: 'simple-expand' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /full detail/ })).toBeDefined()
  await ui.unmount()
})
