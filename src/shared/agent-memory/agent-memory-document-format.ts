import { parse as parseYaml } from 'yaml'

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function splitMarkdownFrontmatter(
  text: string
): { frontmatter: unknown; frontmatterText: string; body: string } | null {
  const match = FRONTMATTER_PATTERN.exec(text)
  if (!match) {
    return null
  }
  try {
    return { frontmatter: parseYaml(match[1]), frontmatterText: match[1], body: match[2] }
  } catch {
    return null
  }
}

/** Lowercase snake id from a display name, the way Claude names memory files. */
export function agentMemoryFileStemFromName(name: string): string {
  const stem = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
  return stem.length > 0 ? stem : 'memory'
}
