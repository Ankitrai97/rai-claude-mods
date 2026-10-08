import { describe, expect, test } from 'claude-code/testing'

import { fileLabel, narrate, narrateCommand, SUMMARY_RULE, testNote } from '../hooks/steps'

describe('checklist lines', () => {
  test('files read as plain English', async () => {
    expect(fileLabel('app/pricing/page.tsx')).toBe('the pricing page')
    expect(fileLabel('notes/kickoff-call.md')).toBe('the kickoff call notes')
    expect(fileLabel('C:\\work\\weekly-update.md')).toBe('the weekly update notes')
    expect(fileLabel('.env.local')).toBe('the private settings')
  })

  test('each tool gets a plain-English line', async () => {
    expect(narrate('Read', { file_path: 'notes/budget.md' })).toBe('Reading the budget notes')
    expect(narrate('Write', { file_path: 'weekly-update.md' })).toBe('Writing the weekly update notes')
    expect(narrate('Edit', { file_path: 'lib/pricing-rules.ts' })).toBe('Saving changes to the pricing rules code')
    expect(narrate('Grep', { pattern: 'deadline' })).toBe('Searching for "deadline"')
    expect(narrate('Glob', { pattern: '*.md' })).toBe('Finding the files involved')
    expect(narrate('Skill', { skill: 'anthropic-skills:xlsx' })).toBe('Loading the xlsx instructions')
    expect(narrate('mcp__claude_ai_Gmail__search_threads', {})).toBe('Using Gmail to search threads')
  })

  test('Bash and PowerShell commands explained', async () => {
    expect(narrateCommand('npm test')).toBe('Running the tests')
    expect(narrate('PowerShell', { command: 'Get-ChildItem C:\\notes' })).toBe('Looking around the folder')
    expect(narrate('PowerShell', { command: 'Copy-Item a b' })).toBe('Organizing files')
    expect(narrateCommand('claude plugin validate ./x')).toBe('Checking the mod for problems')
    expect(narrateCommand('weird-tool --x')).toBe('Running a quick command')
  })

  test('test notes and the summary rule', async () => {
    expect(testNote('Tests: 2 failed, 40 passed, 42 total')).toBe('40 passed, 2 failed')
    expect(testNote('built fine')).toBe(null)
    expect(SUMMARY_RULE).toMatch(/\*\*Done:\*\*/)
    expect(SUMMARY_RULE).toMatch(/\*\*Result:\*\*/)
  })
})
