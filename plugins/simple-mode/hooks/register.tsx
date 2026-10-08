import { atom, memberOf, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Step } from '../types'
import { narrate, SUMMARY_RULE, testNote } from './steps'

const PANE = 'simple-mode'
const TITLE = 'Simple Mode'
const KEEP = 60
/** The $.store key that carries on/off across chats. */
const STORE_KEY = 'isOn'

const isOn = atom({ plugin: 'simple-mode', key: 'isOn' } as const, false)
const isRunning = atom({ plugin: 'simple-mode', key: 'isRunning' } as const, false)
const steps = atom({ plugin: 'simple-mode', key: 'steps' } as const, [] as Step[])
const isExpanded = atom({ plugin: 'simple-mode', key: 'isExpanded' } as const, false)

const BLUE = '#61A5FA'
const GOLD = '#c2a87e'

const MARK: Record<Step['status'], string> = { working: '◌', done: '✓', failed: '×' }

const open = ($: EngineInterface) => $.ui.open({ id: PANE, title: TITLE })

/**
 * The on/off setting lives in one file, <home>/.claude/simple-mode.json. The plugin
 * store is kept per way the plugin was loaded (installed, --plugin-dir, the desktop
 * app's own copy), so a chat that loads it another way would read another store.
 */
const settingsPath = async ($: EngineInterface) => {
  const isWindows = (await $.env.get('OS')) === 'Windows_NT'
  const home = ((isWindows ? await $.env.get('USERPROFILE') : await $.env.get('HOME')) ?? '').replace(/\\/g, '/')
  return home ? `${home}/.claude/simple-mode.json` : null
}

const loadOn = async ($: EngineInterface) => {
  try {
    const path = await settingsPath($)
    if (path && (await $.fs.exists(path))) {
      const saved = JSON.parse(String(await $.fs.read(path))) as { isOn?: unknown }
      if (typeof saved.isOn === 'boolean') return saved.isOn
    }
  } catch {
    // An unreadable file falls back to the store.
  }
  return (await $.store.get(STORE_KEY)) === true
}

const saveOn = async ($: EngineInterface, value: boolean) => {
  await $.store.set(STORE_KEY, value)
  try {
    const path = await settingsPath($)
    if (path) await $.fs.write(path, `${JSON.stringify({ isOn: value })}\n`)
  } catch {
    // The store still holds it for this way of loading.
  }
}

const setOn = async ($: EngineInterface, value: boolean) => {
  await update($, isOn, () => value)
  await saveOn($, value)
  if (value) await open($)
  else await $.ui.close({ id: PANE })
}

const begin = async ($: EngineInterface, id: string, tool: string, input: Record<string, unknown>) => {
  const step: Step = { id, text: narrate(tool, input), note: null, status: 'working' }
  await update($, steps, list => [...list, step].slice(-KEEP))
  return step
}

const settle = async ($: EngineInterface, id: string, isFailed: boolean, stdout: string) => {
  const note = testNote(stdout) ?? (isFailed ? "didn't work, trying another way" : null)
  const status: Step['status'] = isFailed ? 'failed' : 'done'
  await update($, steps, list => list.map(s => (s.id === id ? { ...s, status, note } : s)))
}

/** One-line label for a tool row: its mark and the plain-English step. */
const rowLabel = (tool: string, input: unknown, isRunningNow: boolean, isErrored: boolean) => {
  const mark = isRunningNow ? MARK.working : isErrored ? MARK.failed : MARK.done
  return `${mark} ${narrate(tool, (input ?? {}) as Record<string, unknown>)}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'simple',
      description: 'Simple Mode: a plain-English checklist, one-line tool rows, a two-line summary. /simple [on|off]',
    })
    const saved = await loadOn($)
    await update($, isOn, () => saved)
    if (saved) void open($).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'simple' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const current = await read($, isOn)
    const value = arg === 'on' ? true : arg === 'off' ? false : !current
    await setOn($, value)
    return {
      text: value
        ? 'Simple Mode is on. The checklist is in the side pane, tool rows are one line (click one to see its detail), and every reply ends with a two-line summary.'
        : 'Simple Mode is off. The normal view is back.',
    }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!(await read($, isOn))) return composed
    return { sections: [...composed.sections, { id: 'simple-mode:summary', text: SUMMARY_RULE, scope: 'session' as const }] }
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    if ((await read($, isOn)) && !e.text.trimStart().startsWith('/')) {
      await update($, steps, () => [])
      await update($, isRunning, () => true)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const step = await begin($, e.tool_use_id, String(e.tool), e as unknown as Record<string, unknown>)
    await update($, isRunning, () => true)
    const ran = await next(e)
    const out = ran.result as { stdout?: unknown; stderr?: unknown } | undefined
    const stdout = typeof out?.stdout === 'string' ? `${out.stdout}\n${String(out.stderr ?? '')}` : ''
    await settle($, step.id, ran.deny !== undefined || ran.isError === true, stdout)
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    await update($, isRunning, () => false)
    // A step still marked working when the turn ends was cut short.
    await update($, steps, list => list.map(s => (s.status === 'working' ? { ...s, status: 'done' as const } : s)))
    return next(e)
  })

  // A tool call's row: one line while collapsed, the engine's full row once expanded.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    const expanded = memberOf(isExpanded, e)
    const toggle = () => void update($, expanded, v => !v).catch(() => undefined)
    if (await read($, expanded)) {
      const full = await next(e)
      return (
        <Box flexDirection="column">
          <Button key="simple-collapse" plain dimColor onPress={toggle}>
            ▾ hide detail
          </Button>
          {full}
        </Box>
      )
    }
    const label = `${rowLabel(e.props.tool, e.props.input, e.props.isRunning, e.props.isErrored)}   ▸ detail`
    return (
      <Button key="simple-expand" plain dimColor={!e.props.isRunning} onPress={toggle}>
        {label}
      </Button>
    )
  })

  // The result block under a standalone tool row: hidden until that row is expanded.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    if (await read($, memberOf(isExpanded, e))) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // A folded run of reads and searches: one line, expandable into its calls.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    const expanded = memberOf(isExpanded, e)
    const toggle = () => void update($, expanded, v => !v).catch(() => undefined)
    if (await read($, expanded)) {
      const full = await next({ ...e, props: { ...e.props, isExpanded: true } })
      return (
        <Box flexDirection="column">
          <Button key="simple-collapse" plain dimColor onPress={toggle}>
            ▾ hide detail
          </Button>
          {full}
        </Box>
      )
    }
    const calls = e.props.calls
    const first = calls[0]
    if (!first) return next(e)
    const isLive = calls.some(c => c.isRunning)
    const isErrored = calls.some(c => c.isErrored)
    const more = calls.length > 1 ? ` (+${calls.length - 1} more)` : ''
    const label = `${rowLabel(first.tool, first.input, isLive, isErrored)}${more}   ▸ detail`
    return (
      <Button key="simple-expand" plain dimColor={!isLive} onPress={toggle}>
        {label}
      </Button>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const on_ = await read($, isOn)
    const running = await read($, isRunning)
    const list = await read($, steps)
    const room = Math.max(3, (e.viewport?.rows ?? 30) - 8)
    const doneCount = list.filter(s => s.status !== 'working').length

    const row = (s: Step) => {
      const isLive = s.status === 'working'
      const color = isLive ? BLUE : s.status === 'failed' ? GOLD : undefined
      const word = isLive ? 'working' : s.status === 'failed' ? 'retrying' : 'done'
      return (
        <Box key={s.id}>
          <Box width={3} flexShrink={0}>
            <Text color={color} bold={isLive}>{MARK[s.status]}</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1} flexShrink={1}>
            <Text bold={isLive} dimColor={s.status === 'done'} wrap="wrap">
              {s.text}
              <Text color={isLive ? BLUE : undefined} dimColor={!isLive}>{`  · ${word}`}</Text>
              {s.note && <Text color={s.status === 'failed' ? GOLD : BLUE}>{`  · ${s.note}`}</Text>}
            </Text>
          </Box>
        </Box>
      )
    }

    if (!on_) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text dimColor>Simple Mode is off. Type /simple to turn it on.</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text>
          {running ? (
            <Text color={BLUE} bold>WORKING</Text>
          ) : (
            <Text color={GOLD} bold>{list.length ? 'DONE' : 'READY'}</Text>
          )}
          <Text dimColor>{`   ${doneCount} of ${list.length} steps done`}</Text>
        </Text>
        <Box marginTop={1} flexDirection="column">
          {list.length === 0 && <Text dimColor>Waiting for a task. Ask Claude to do something.</Text>}
          {list.slice(-room).map(row)}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Click a ▸ row in the chat to see its full detail. /simple turns this off.</Text>
        </Box>
      </Box>
    )
  })
}
