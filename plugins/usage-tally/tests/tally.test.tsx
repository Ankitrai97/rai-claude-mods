import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'

import { bar, countdown, dueWarnings, labelOf, levelOf, statusLine } from '../hooks/meter'

const NOW = Date.parse('2026-10-07T10:00:00Z')
const LIMITS = [
  { kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-07T12:10:00Z' },
  { kind: 'seven_day', percentUsed: 18.5, resetsAt: '2026-10-10T14:00:00Z' },
]

describe('meter helpers', () => {
  test('labels, countdowns, bars and levels', async () => {
    expect(labelOf('five_hour')).toBe('Session (5h)')
    expect(labelOf('seven_day')).toBe('Week')
    expect(labelOf('seven_day_opus')).toBe('Week (Opus)')
    expect(countdown(2 * 3600_000 + 10 * 60_000)).toBe('2h 10m')
    expect(countdown(3 * 86400_000 + 4 * 3600_000)).toBe('3d 4h')
    expect(countdown(45 * 60_000)).toBe('45m')
    expect(countdown(-1)).toBe('now')
    expect(bar(50, 10)).toBe('█████░░░░░')
    expect(levelOf(74)).toBe('ok')
    expect(levelOf(75)).toBe('warn')
    expect(levelOf(90)).toBe('high')
  })

  test('status line reads session first, with its reset', async () => {
    expect(statusLine(LIMITS, NOW)).toBe('Session 42% · resets 2h 10m · Week 19%')
    expect(statusLine([], NOW)).toBeUndefined()
  })

  test('each threshold warns once per window', async () => {
    const at80 = [{ kind: 'five_hour', percentUsed: 80, resetsAt: 'R' }]
    const first = dueWarnings(at80, [])
    expect(first).toHaveLength(1)
    expect(first[0]!.text).toBe('Session (5h) limit is at 80%')
    expect(dueWarnings(at80, first.map(d => d.key))).toHaveLength(0)
    const at92 = [{ kind: 'five_hour', percentUsed: 92, resetsAt: 'R' }]
    expect(dueWarnings(at92, first.map(d => d.key))[0]!.text).toMatch(/92%: nearly out/)
    expect(dueWarnings([{ kind: 'five_hour', percentUsed: 80, resetsAt: 'NEXT' }], first.map(d => d.key))).toHaveLength(1)
  })
})

const memStore = (on: On) => {
  const mem: Record<string, unknown> = {}
  on('store.get', (_$, e) => ({ value: mem[e.key] }))
  on('store.set', (_$, e) => {
    mem[e.key] = e.value
    return { value: undefined }
  })
  return mem
}

test('a measure fills the status line, warns once, and the pane draws the bars', async ($, on) => {
  mock.clock(on, { now: NOW })
  memStore(on)
  const statuses: (string | undefined)[] = []
  const toasts: string[] = []
  on('ui.status', (_$, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.measure', (_$, e) => ({ changed: e.changed }))

  const hot = [{ kind: 'five_hour', percentUsed: 91, resetsAt: '2026-10-07T12:10:00Z' }, LIMITS[1]!]
  const measure = { context: { window: 200000, percent: 38 }, rateLimits: hot, cost: { usd: 1.234 }, changed: ['rateLimits' as const] }
  await $.session.measure(measure)
  await $.session.measure(measure)

  expect(statuses.at(-1)).toBe('Session 91% · resets 2h 10m · Week 19%')
  expect(toasts).toEqual(['Session (5h) limit is at 91%: nearly out, resets in 2h 10m.'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'usage-tally',
      surface,
      component: 'Pane',
      requestId: 'usage-tally',
      props: { title: 'Usage Tally', isFocused: false, bodyColumns: 44, placement: 'dock', scroll: { offset: 0, bodyRows: 28 }, view: {} },
      viewport: { columns: 44, rows: 30 },
    })
    expect(await ui.find({ type: 'Text', text: 'Session (5h)' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '91%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /resets in 2h 10m/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /cost \$1\.23 · context 38%/ })).toBeDefined()
    await ui.unmount()
  }
})
