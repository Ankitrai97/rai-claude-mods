/** Pure helpers: limit names, countdowns, bars, colours and the warning thresholds. */

import type { Limit } from '../types'

export const THRESHOLDS = [75, 90] as const

/** "five_hour" -> "Session (5h)", "seven_day" -> "Week", "seven_day_opus" -> "Week (Opus)". */
export const labelOf = (kind: string) => {
  if (kind === 'five_hour') return 'Session (5h)'
  if (kind === 'seven_day') return 'Week'
  if (kind === 'spend_limit') return 'Spend limit'
  const week = /^seven_day_(.+)$/.exec(kind)
  if (week) return `Week (${week[1]!.charAt(0).toUpperCase()}${week[1]!.slice(1).replace(/_/g, ' ')})`
  return kind.replace(/_/g, ' ')
}

/** Short label for the status line. */
export const shortOf = (kind: string) => (kind === 'five_hour' ? 'Session' : kind === 'seven_day' ? 'Week' : labelOf(kind))

/** Milliseconds until a reset -> "2h 10m", "3d 4h", "45m", "now". */
export const countdown = (ms: number) => {
  if (ms <= 0) return 'now'
  const m = Math.ceil(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const min = m % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(min).padStart(2, '0')}m`
  return `${min}m`
}

export const resetIn = (limit: Limit, now: number) => {
  if (!limit.resetsAt) return null
  const at = Date.parse(limit.resetsAt)
  return Number.isNaN(at) ? null : countdown(at - now)
}

/** "████████░░░░" at a width. */
export const bar = (percent: number, width: number) => {
  const full = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return '█'.repeat(full) + '░'.repeat(width - full)
}

export type Level = 'ok' | 'warn' | 'high'
export const levelOf = (percent: number): Level => (percent >= 90 ? 'high' : percent >= 75 ? 'warn' : 'ok')

export const pct = (n: number) => `${Math.round(n)}%`

/** The status line: "Session 42% · resets 2h 10m · Week 18%". */
export const statusLine = (limits: readonly Limit[], now: number) => {
  if (limits.length === 0) return undefined
  const order = (k: string) => (k === 'five_hour' ? 0 : k === 'seven_day' ? 1 : 2)
  const sorted = [...limits].sort((a, b) => order(a.kind) - order(b.kind)).slice(0, 2)
  return sorted
    .map((l, i) => {
      const reset = i === 0 ? resetIn(l, now) : null
      return `${shortOf(l.kind)} ${pct(l.percentUsed)}${reset ? ` · resets ${reset}` : ''}`
    })
    .join(' · ')
}

/**
 * The warnings a reading crosses that were not shown yet: one per limit,
 * the highest threshold crossed, keyed by limit, reset time and threshold.
 */
export const dueWarnings = (limits: readonly Limit[], shown: readonly string[]) => {
  const due: { key: string; text: string }[] = []
  for (const l of limits) {
    const crossed = [...THRESHOLDS].reverse().find(t => l.percentUsed >= t)
    if (!crossed) continue
    const key = `${l.kind}@${l.resetsAt ?? ''}@${crossed}`
    if (shown.includes(key)) continue
    due.push({ key, text: `${labelOf(l.kind)} limit is at ${pct(l.percentUsed)}${crossed >= 90 ? ': nearly out' : ''}` })
  }
  return due
}
