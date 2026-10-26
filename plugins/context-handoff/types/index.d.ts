// The handoff note this session loaded from the last chat, if any.
export type HandoffLoaded = { text: string; writtenAt: number } | null

declare module 'claude-code' {
  interface PluginState {
    'context-handoff': {
      // the note loaded at session start, handed to Claude with the first prompt
      loaded: HandoffLoaded
      delivered: boolean
      // when this session last asked Claude for a note, and when one was saved
      askedAt: number | null
      savedAt: number | null
    }
  }
}
