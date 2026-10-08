export type Step = {
  id: string
  text: string
  note: string | null
  status: 'working' | 'done' | 'failed'
}

declare module 'claude-code' {
  interface PluginState {
    'simple-mode': {
      isOn: boolean
      isRunning: boolean
      steps: Step[]
      isExpanded: StateFamily<boolean>
    }
  }
}
