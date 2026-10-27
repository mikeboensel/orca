import { join } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import { agentMemoryFileStemFromName } from '../../shared/agent-memory/agent-memory-document-format'
import type { AgentMemoryNewMemoryDraft } from '../../shared/agent-memory/agent-memory-draft-validation'
import type { AgentMemoryAdapterEnvironment } from './agent-memory-agent-adapter'
import {
  CLAUDE_MEMORY_INDEX_FILE_NAME,
  claudeMemoryItemId,
  claudeProjectMemoryDirectory
} from './agent-memory-claude-project-memory-reader'
import { AgentMemoryFileChangeBatch, applyFileChanges } from './agent-memory-file-change-batch'

/**
 * Writes a memory the way Claude's auto-memory does (`<type>_<stem>.md` plus a MEMORY.md line) in the
 * main checkout's project dir, so Claude itself loads it and the Memory panel lists it as unreviewed.
 */
export async function createClaudeProjectMemory(
  environment: AgentMemoryAdapterEnvironment,
  repoPath: string,
  draft: AgentMemoryNewMemoryDraft
): Promise<string> {
  const directory = claudeProjectMemoryDirectory(environment, repoPath)
  const stem = agentMemoryFileStemFromName(draft.name)
  const fileName = `${draft.type}_${stem}.md`
  const batch = new AgentMemoryFileChangeBatch()
  const path = join(directory, fileName)
  if ((await batch.read(path)) !== null) {
    throw new Error(`${path} already exists; edit it instead`)
  }
  const frontmatter = stringifyYaml({
    name: stem.replace(/_/g, '-'),
    description: draft.description,
    metadata: { type: draft.type }
  })
  await batch.write(path, `---\n${frontmatter}---\n\n${draft.body}\n`, 'memory-source')
  const indexPath = join(directory, CLAUDE_MEMORY_INDEX_FILE_NAME)
  const index = (await batch.read(indexPath)) ?? ''
  const line = `- [${draft.name}](${fileName})${draft.description ? ` — ${draft.description}` : ''}`
  await batch.write(
    indexPath,
    `${index.replace(/\s*$/, '')}${index.trim() ? '\n' : ''}${line}\n`,
    'memory-source'
  )
  await applyFileChanges(batch.changes)
  return claudeMemoryItemId(fileName)
}
