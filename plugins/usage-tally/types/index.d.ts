export type Limit = {
  kind: string
  percentUsed: number
  resetsAt?: string
}

export type Reading = {
  limits: Limit[]
  costUsd: number | null
  contextPercent: number | null
  at: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'usage-tally': { reading: Reading; now: number }
  }
}
