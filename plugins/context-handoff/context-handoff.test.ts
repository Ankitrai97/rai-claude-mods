import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

const DIR = 'C:/work/project'
const NOTE = `${DIR}/.claude/handoff.md`
const USED = `${DIR}/.claude/handoff-used.md`
const HOUR = 60 * 60 * 1000
const STARTED = 1_800_000_000_000

const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} },
}

// Stands in for the engine: usage figures, a clock, files, processes, prompts.
const engine = (on: On, opts: { files?: Record<string, { text: string; mtimeMs: number }>; now?: number } = {}) => {
  const usage = { tokens: 0, window: 200_000 }
  const where = { cwd: DIR }
  const files = new Map(Object.entries(opts.files ?? {}))
  const submitted: string[] = []
  const runs: string[][] = []
  const toasts: string[] = []
  const key = (path: string) => path.replace(/\\/g, '/')
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: where.cwd }))
  on('session.usage', () => ({
    value: { startedAt: STARTED, context: { tokens: usage.tokens, window: usage.window, percent: (usage.tokens / usage.window) * 100 }, rateLimits: [] } as any,
  }))
  on('turn.complete', () => ({ text: '' }) as any)
  on('clock.now', () => ({ value: opts.now ?? STARTED + 60_000 }))
  on('clock.sleep', () => ({ value: undefined }))
  on('command.register', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('env.get', ($, e) => ({ value: e.name === 'OS' ? 'Windows_NT' : undefined }))
  on('fs.exists', ($, e) => ({ value: files.has(key(e.path)) }))
  on('fs.stat', ($, e) => {
    const f = files.get(key(e.path))
    if (!f) throw new Error('ENOENT')
    return { value: { kind: 'file', size: f.text.length, mtimeMs: f.mtimeMs, isLink: false } }
  })
  on('fs.read', ($, e) => {
    const f = files.get(key(e.path))
    if (!f) throw new Error('ENOENT')
    return { value: f.text }
  })
  on('fs.write', ($, e) => {
    files.set(key(e.path), { text: e.text, mtimeMs: STARTED })
    return { value: undefined }
  })
  // the rename: Move-Item from -> to
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    const m = /-LiteralPath '(.+?)' -Destination '(.+?)'/.exec(String(e.argv.at(-1)))
    if (m && files.has(m[1])) {
      files.set(m[2], files.get(m[1])!)
      files.delete(m[1])
    }
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('prompt.compose', () => ({ sections: [] }) as any)
  on('command.run', ($, e) => ({ text: `engine ran /${e.command}` }))
  on('tool.call', ($, e) => ({ result: 'ok', text: 'ok', isError: false }))
  return { usage, files, submitted, runs, toasts, where }
}

const COMPOSE = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: { name: 'default', isKeepingCodingInstructions: true }, traits: [] } as any
const start = { cwd: DIR, surface: 'terminal' as const, isInteractive: true }
const NOTE_TEXT = '## Goal\nShip the lead list demo.\n## What\'s done\nMod built.\n## Decisions made\nWord over TextEdit.\n## Key files\nleads.xlsx\n## Next steps\n1. Record.'

test('the bar shows the fill and turns green, amber and red at 60% and 80%', async ($, on) => {
  const { usage } = engine(on)
  usage.tokens = 40_000 // 20%
  await $.session.start(start)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-handoff', surface, ...BAND })
    const steps: [number, string][] = [[40_000, 'green'], [118_000, 'green'], [120_000, '#FFB000'], [160_000, '#FFB000'], [162_000, 'red']]
    let last = -1
    for (const [tokens, color] of steps) {
      usage.tokens = tokens
      await $.turn.complete({ turnId: `t${tokens}`, reason: 'answer', answer: '', text: '' } as any)
      const fill = await ui.find({ type: 'Text', text: /% context/ })
      const percent = Number(/(\d+)%/.exec(fill?.text ?? '')?.[1])
      expect(fill?.props.color).toBe(color)
      expect(percent).toBeGreaterThanOrEqual(last)
      last = percent
    }
    expect(await ui.find({ key: 'handoff' })).toBeDefined()
    await ui.unmount()
  }
})

test('H asks Claude for the note with all five sections, saved to .claude/handoff.md', async ($, on) => {
  const { submitted } = engine(on)
  await $.session.start(start)
  const ui = await $.ui.mount({ plugin: 'context-handoff', surface: 'terminal', ...BAND })
  await ui.press({ key: 'handoff' })
  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toContain(`${DIR}/.claude/handoff.md`)
  for (const heading of ['## Goal', "## What's done", '## Decisions made', '## Key files', '## Next steps']) expect(submitted[0]).toContain(heading)
  expect(submitted[0]).toContain('under 300 words')
  expect(await ui.find({ type: 'Text', text: /writing handoff/ })).toBeDefined()
  await ui.unmount()
})

test('/handoff asks for the same note once the command returns', async ($, on) => {
  const { submitted } = engine(on)
  await $.session.start(start)
  const ran = await $.command.run({ command: 'handoff', args: '', origin: { kind: 'composer' } } as any)
  expect(String(ran.text)).toContain('.claude/handoff.md')
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Read', tool_use_id: `s${i}`, file_path: 'x' } as any)
  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toContain('## Next steps')
})

test('saving the note shows in the bar', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const ui = await $.ui.mount({ plugin: 'context-handoff', surface: 'desktop', ...BAND })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w', file_path: 'C:\\work\\project\\.claude\\handoff.md', content: NOTE_TEXT } as any)
  expect(await ui.find({ type: 'Text', text: /handoff saved/ })).toBeDefined()
  await ui.unmount()
})

test('a new chat loads a recent note, renames it, and carries it to Claude', async ($, on) => {
  const { files, runs, toasts } = engine(on, { files: { [NOTE]: { text: NOTE_TEXT, mtimeMs: STARTED - 2 * HOUR } } })
  await $.session.start(start)
  expect(files.has(NOTE)).toBe(false)
  expect(files.get(USED)?.text).toBe(NOTE_TEXT)
  expect(runs[0].join(' ')).toContain('Move-Item')
  expect(toasts[0]).toContain('2 hours ago')
  const composed: any = await $.prompt.compose(COMPOSE)
  const section = composed.sections.find((s: any) => s.id === 'context-handoff:note')
  expect(section.text).toContain('Ship the lead list demo.')
})

test('the next chat does not load the same note again', async ($, on) => {
  // what the first chat left: only handoff-used.md
  engine(on, { files: { [USED]: { text: NOTE_TEXT, mtimeMs: STARTED - 2 * HOUR } } })
  await $.session.start(start)
  const composed: any = await $.prompt.compose(COMPOSE)
  expect(composed.sections.find((s: any) => s.id === 'context-handoff:note')).toBeUndefined()
})

test('a note over 24 hours old, or one saved in this same chat, is left alone', async ($, on) => {
  const { files, runs } = engine(on, { files: { [NOTE]: { text: NOTE_TEXT, mtimeMs: STARTED - 25 * HOUR } } })
  await $.session.start(start)
  expect(files.has(NOTE)).toBe(true)
  expect(runs).toEqual([])
  files.set(NOTE, { text: NOTE_TEXT, mtimeMs: STARTED + 1000 })
  await $.session.start(start)
  expect(files.has(NOTE)).toBe(true)
  expect(runs).toEqual([])
})

test('a chat that moved to another folder writes the note there', async ($, on) => {
  const { submitted, where } = engine(on)
  await $.session.start(start)
  where.cwd = 'C:\\Users\\me\\other-project'
  const ui = await $.ui.mount({ plugin: 'context-handoff', surface: 'desktop', ...BAND })
  await ui.press({ key: 'handoff' })
  expect(submitted[0]).toContain('C:/Users/me/other-project/.claude/handoff.md')
  expect(submitted[0]).not.toContain(DIR)
  await ui.unmount()
})
