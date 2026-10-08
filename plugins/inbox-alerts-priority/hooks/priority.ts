import type { Alert } from '../types'

export type Lists = { clients: string[]; words: string[] }

/** One entry per line, lower-cased. Blank lines and lines starting with # are skipped. */
export const parseList = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map(line => line.trim().toLowerCase())
    .filter(line => line.length > 0 && !line.startsWith('#'))

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A message is priority when its sender matches a line in clients.txt
 * (a full address, a domain like acme.com, or a Slack display name),
 * or its subject or text contains a word from priority-words.txt.
 * Words match at the start of a word, so "quote" also catches "quotes" and "quoted".
 */
export const isPriority = (alert: Alert, lists: Lists): boolean => {
  const who = `${alert.from} ${alert.fromAddress ?? ''}`.toLowerCase()
  if (lists.clients.some(client => who.includes(client))) return true
  const content = `${alert.where} ${alert.text}`.toLowerCase()
  return lists.words.some(word => new RegExp(`(^|[^a-z0-9])${escape(word)}`).test(content))
}
