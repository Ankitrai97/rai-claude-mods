/** Pure narration: a tool call in, one plain-English checklist line out. */

const KIND: Record<string, string> = {
  tsx: 'screen',
  jsx: 'screen',
  vue: 'screen',
  svelte: 'screen',
  html: 'page',
  css: 'styles',
  scss: 'styles',
  ts: 'code',
  js: 'code',
  mjs: 'code',
  py: 'code',
  go: 'code',
  rb: 'code',
  rs: 'code',
  swift: 'code',
  sql: 'database script',
  json: 'settings',
  yaml: 'settings',
  yml: 'settings',
  toml: 'settings',
  env: 'settings',
  md: 'notes',
  txt: 'notes',
  csv: 'data',
  xlsx: 'spreadsheet',
  docx: 'document',
  pdf: 'document',
  png: 'image',
  jpg: 'image',
  svg: 'graphic',
}

const GENERIC = new Set(['index', 'main', 'page', 'route', 'layout', 'mod', 'app', 'default'])

/** "src/components/PricingCard.tsx" -> "pricing card" */
export const wordsOf = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .trim()
    .toLowerCase()

/** "app/pricing/page.tsx" -> "the pricing page"; "auth.test.ts" -> "the auth tests". */
export const fileLabel = (path: string) => {
  const parts = path.split(/[\\/]/).filter(Boolean)
  const file = parts[parts.length - 1] ?? path
  const dot = file.lastIndexOf('.')
  const ext = dot > 0 ? file.slice(dot + 1).toLowerCase() : ''
  let stem = dot > 0 ? file.slice(0, dot) : file
  const isTest = /\.(test|spec)$/i.test(stem) || /(^|[\\/])(__tests__|tests?)[\\/]/i.test(path)
  stem = stem.replace(/\.(test|spec)$/i, '')
  const isGeneric = GENERIC.has(stem.toLowerCase())
  const parent = parts[parts.length - 2]
  const base = isGeneric && parent && !parent.startsWith('(') && !parent.startsWith('[') ? parent : stem
  const name = wordsOf(base) || 'project'
  if (isTest) return `the ${name} tests`
  if (file.startsWith('.env')) return 'the private settings'
  const kind = KIND[ext] ?? 'file'
  if (isGeneric && ext === 'tsx' && parent) return `the ${name} page`
  return `the ${name} ${kind}`
}

const quote = (text: string, max = 40) => {
  const clean = text.replace(/\s+/g, ' ').trim()
  return `"${clean.length > max ? `${clean.slice(0, max - 1)}…` : clean}"`
}

const hostOf = (url: string) => {
  const m = /^[a-z]+:\/\/([^/?#]+)/i.exec(url)
  return m ? m[1]!.replace(/^www\./, '') : 'a web page'
}

/** A shell command (Bash or PowerShell), explained. */
export const narrateCommand = (command: string): string => {
  const c = command.trim()
  const rules: [RegExp, string][] = [
    [/\b(test|jest|vitest|pytest|mocha|go test|cargo test|bun test)\b/i, 'Running the tests'],
    [/\bgit\s+commit\b/, 'Saving a checkpoint of the work'],
    [/\bgit\s+push\b/, 'Publishing the changes'],
    [/\bgit\s+(status|diff|log|show)\b/, 'Reviewing what has changed so far'],
    [/\bgit\s+(checkout|switch|branch)\b/, 'Setting up a separate workspace for this change'],
    [/\b(npm|pnpm|yarn|bun)\s+(i|install|add)\b|\bpip\s+install\b|\bbrew\s+install\b/, 'Installing the building blocks it needs'],
    [/\bplugin\s+validate\b/i, 'Checking the mod for problems'],
    [/\b(run\s+)?build\b|\btsc\b/, 'Building the app to make sure it all fits together'],
    [/\b(run\s+)?(dev|start|serve)\b/, 'Starting the app to try it out'],
    [/\b(lint|eslint|prettier|ruff|black)\b/, 'Tidying up and checking code style'],
    [/\b(vercel|deploy|fly deploy|netlify)\b/, 'Deploying the update live'],
    [/\b(curl|wget|http|Invoke-WebRequest|Invoke-RestMethod)\b/i, 'Checking a live web address'],
    [/\b(psql|supabase|prisma|migrate)\b/, 'Working with the database'],
    [/^(ls|cat|head|tail|find|tree|wc|pwd|grep|rg|sed -n)\b|\b(Get-ChildItem|Get-Content|Select-String|Test-Path)\b/i, 'Looking around the folder'],
    [/^(mkdir|cp|mv|touch)\b|\b(New-Item|Copy-Item|Move-Item|Rename-Item)\b/i, 'Organizing files'],
  ]
  for (const [re, text] of rules) if (re.test(c)) return text
  return 'Running a quick command'
}

const field = (input: Record<string, unknown>, key: string) => {
  const v = input[key]
  return typeof v === 'string' ? v : ''
}

/** One tool call, explained as a checklist line. */
export const narrate = (tool: string, input: Record<string, unknown>): string => {
  const path = field(input, 'file_path') || field(input, 'notebook_path') || field(input, 'path')
  switch (tool) {
    case 'Read':
      return `Reading ${fileLabel(path)}`
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return `Saving changes to ${fileLabel(path)}`
    case 'Write':
      return `Writing ${fileLabel(path)}`
    case 'Bash':
    case 'PowerShell':
      return narrateCommand(field(input, 'command'))
    case 'Grep':
      return `Searching for ${quote(field(input, 'pattern'))}`
    case 'Glob':
      return 'Finding the files involved'
    case 'WebFetch':
      return `Reading ${hostOf(field(input, 'url'))}`
    case 'WebSearch':
      return `Researching ${quote(field(input, 'query'))} on the web`
    case 'Agent':
    case 'Task': {
      const what = field(input, 'description')
      return what ? `Bringing in a helper to ${what.charAt(0).toLowerCase()}${what.slice(1)}` : 'Bringing in a helper'
    }
    case 'TodoWrite':
      return 'Updating the plan'
    case 'AskUserQuestion':
      return 'Checking a decision with you'
    case 'Skill': {
      const name = field(input, 'skill').replace(/^.*:/, '')
      return name ? `Loading the ${wordsOf(name)} instructions` : 'Loading a set of instructions'
    }
    case 'ToolSearch':
      return 'Getting the right tool ready'
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (mcp) {
    const server = wordsOf(mcp[1]!.replace(/^claude_ai_/, '').replace(/^plugin_[^_]+_/, ''))
      .split(' ')
      .map(w => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(' ')
    const action = wordsOf(mcp[2]!.replace(/^[a-z]+_(?=[a-z]+_)/, ''))
    return `Using ${server} to ${action}`
  }
  return `Using ${wordsOf(tool)}`
}

/** Counts from a test run's output, as a short note: "42 passed" / "40 passed, 2 failed". */
export const testNote = (output: string) => {
  const top = (re: RegExp) => {
    let n: number | null = null
    for (const m of output.matchAll(re)) n = Math.max(n ?? 0, Number(m[1]))
    return n
  }
  const passed = top(/(\d+)\s+(?:tests?\s+)?pass(?:ed|ing)?\b/gi)
  const failed = top(/(\d+)\s+(?:tests?\s+)?fail(?:ed|ing|ures?)?\b/gi)
  if (passed === null && failed === null) return null
  return failed ? `${passed ?? 0} passed, ${failed} failed` : `${passed} passed`
}

/** The instruction Simple Mode adds to the system prompt while it is on. */
export const SUMMARY_RULE = [
  'Simple Mode is on. The person wants the short version.',
  'Keep the text you write between tool calls to a minimum: a checklist pane already shows each step.',
  'End every reply with a two-line summary in plain English, no jargon, no code, no file paths, after a blank line, exactly in this form:',
  '**Done:** <one sentence: what you did>',
  '**Result:** <one sentence: what came of it, where it is, or what you need from them>',
  'Nothing comes after those two lines.',
].join('\n')
