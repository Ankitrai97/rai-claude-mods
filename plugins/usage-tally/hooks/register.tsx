import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Limit, Reading } from '../types'
import { bar, dueWarnings, labelOf, levelOf, pct, resetIn, statusLine } from './meter'

const PANE = 'usage-tally'
const TITLE = 'Usage Tally'
/** $.store key: warnings already shown, so a new chat does not repeat them. */
const SHOWN_KEY = 'shownWarnings'
const TICK_MS = 60_000

const EMPTY: Reading = { limits: [], costUsd: null, contextPercent: null, at: null }
const reading = atom({ plugin: 'usage-tally', key: 'reading' } as const, EMPTY)
const nowAtom = atom({ plugin: 'usage-tally', key: 'now' } as const, 0)

const GREEN = '#4ade80'
const AMBER = '#fbbf24'
const RED = '#f87171'
const COLOR = { ok: GREEN, warn: AMBER, high: RED } as const

const toLimits = (list: readonly SessionRateLimit[]): Limit[] =>
  list.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, ...(l.resetsAt ? { resetsAt: l.resetsAt } : {}) }))

const refreshStatus = async ($: EngineInterface) => {
  const r = await read($, reading)
  $.ui.status(statusLine(r.limits, await $.clock.now()))
}

const warn = async ($: EngineInterface, limits: readonly Limit[]) => {
  const shown = ((await $.store.get(SHOWN_KEY)) as string[] | undefined) ?? []
  const due = dueWarnings(limits, shown)
  if (due.length === 0) return
  const now = await $.clock.now()
  for (const d of due) {
    const limit = limits.find(l => d.key.startsWith(`${l.kind}@`))
    const reset = limit ? resetIn(limit, now) : null
    $.ui.toast(`${d.text}${reset ? `, resets in ${reset}` : ''}.`, { timeoutMs: 10_000 })
  }
  // Keep the last 40 keys: enough for every window's thresholds, small in the store.
  await $.store.set(SHOWN_KEY, [...shown, ...due.map(d => d.key)].slice(-40))
}

const take = async (
  $: EngineInterface,
  figures: { rateLimits: readonly SessionRateLimit[]; cost?: { usd: number }; context: { percent?: number } },
) => {
  const limits = toLimits(figures.rateLimits)
  const now = await $.clock.now()
  await update($, reading, prev => ({
    // A measure with no rate-limit reading keeps the last one rather than blanking the meter.
    limits: limits.length ? limits : prev.limits,
    costUsd: figures.cost?.usd ?? prev.costUsd,
    contextPercent: figures.context.percent ?? prev.contextPercent,
    at: limits.length ? now : prev.at,
  }))
  await update($, nowAtom, () => now)
  await refreshStatus($)
  if (limits.length) await warn($, limits)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tally', description: 'Usage Tally: your session and weekly limits, with reset times' })
    const ran = await next(e)
    try {
      await take($, await $.session.usage())
    } catch {
      // No figures yet; the first reply's measure fills them in.
    }
    $.clock.every(TICK_MS, () => {
      void (async () => {
        const now = await $.clock.now()
        await update($, nowAtom, () => now)
        await refreshStatus($)
      })().catch(() => undefined)
    })
    return ran
  })

  on('session.measure', async ($, e, next) => {
    await take($, e)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'tally' }, async $ => {
    try {
      await take($, await $.session.usage())
    } catch {
      // Keep the last reading.
    }
    await $.ui.open({ id: PANE, title: TITLE })
    const r = await read($, reading)
    const line = statusLine(r.limits, await $.clock.now())
    return { text: line ? `Usage Tally: ${line}` : 'Usage Tally is open. Limits show after Claude\'s next reply (Claude subscription only).' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, reading)
    const now = (await read($, nowAtom)) || (await $.clock.now())
    const width = Math.max(10, Math.min(30, (e.props.bodyColumns ?? 40) - 14))

    const row = (l: Limit) => {
      const level = levelOf(l.percentUsed)
      const reset = resetIn(l, now)
      return (
        <Box key={l.kind} flexDirection="column" marginBottom={1}>
          <Box justifyContent="space-between">
            <Text bold>{labelOf(l.kind)}</Text>
            <Text color={COLOR[level]} bold>{pct(l.percentUsed)}</Text>
          </Box>
          <Text color={COLOR[level]}>{bar(l.percentUsed, width)}</Text>
          <Text dimColor>{reset ? `resets in ${reset}` : 'reset time not reported'}</Text>
        </Box>
      )
    }

    const age = r.at ? Math.max(0, Math.round((now - r.at) / 60000)) : null

    return (
      <Box flexDirection="column" paddingX={1}>
        {r.limits.length === 0 ? (
          <Text dimColor wrap="wrap">
            No limit reading yet. It appears after Claude's next reply, on a Claude subscription.
          </Text>
        ) : (
          <Box flexDirection="column">{r.limits.map(row)}</Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <Text bold>This chat</Text>
          <Text dimColor>
            {`cost ${r.costUsd === null ? '—' : `$${r.costUsd.toFixed(2)}`} · context ${r.contextPercent === null ? '—' : pct(r.contextPercent)}`}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor wrap="wrap">
            {age === null
              ? 'Limits count claude.ai and Claude Code together.'
              : `Read ${age === 0 ? 'just now' : `${age}m ago`} from Claude's last reply. Limits count claude.ai and Claude Code together.`}
          </Text>
        </Box>
      </Box>
    )
  })
}
