export type AlertSource = 'gmail' | 'slack'
export type Source = AlertSource | 'calendar'

export type Alert = {
  id: string
  source: AlertSource
  from: string
  /** The sender's email address, when the source has one. */
  fromAddress?: string
  where: string
  text: string
  url?: string
  at: string
  /** Matched clients.txt or priority-words.txt on the last check. */
  priority?: boolean
}

export type CalEvent = {
  id: string
  title: string
  start: string
  end: string
  /** HH:MM as the calendar wrote it (its own time zone). */
  clock: string
  endClock: string
  join?: string
  url?: string
  needsRsvp: boolean
  people: number
}

export type PollStatus = {
  /** When each source last answered, ISO. */
  last: { gmail: string | null; slack: string | null; calendar: string | null }
  /** Sources whose last check failed. */
  failed: Source[]
}

declare module 'claude-code' {
  interface PluginState {
    'inbox-alerts-priority': { alerts: Alert[]; events: CalEvent[]; poll: PollStatus }
  }
}
