import { describe, expect, it } from 'vitest'
import type {
  AgentMemoryDecisionPreview,
  AgentMemoryFileChange
} from '../../../../../shared/agent-memory/agent-memory-review-types'
import { canApplyWithoutConfirm } from './use-agent-memory-panel-state'

function preview(
  fileChanges: AgentMemoryFileChange[],
  warnings: string[] = []
): AgentMemoryDecisionPreview {
  return { requests: [], fileChanges, rejected: [], warnings, previewFingerprint: 'f' }
}

const renderedWrite: AgentMemoryFileChange = {
  kind: 'write',
  path: '/orca/rendered/global.md',
  owner: 'orca',
  beforeText: 'a',
  afterText: 'b'
}

describe('memory panel confirm rule', () => {
  it('applies a share that only rewrites Orca-owned files at once', () => {
    expect(canApplyWithoutConfirm({ preview: preview([renderedWrite]), fromQueue: false })).toBe(
      true
    )
  })

  it('asks first when a hand-edited link block was left alone, or an agent file changes', () => {
    const drifted = preview(
      [renderedWrite],
      ['/home/.codex/AGENTS.md: Orca block edited outside Orca']
    )
    expect(canApplyWithoutConfirm({ preview: drifted, fromQueue: false })).toBe(false)
    const linkBlock = preview([{ ...renderedWrite, owner: 'agent-link-block' }])
    expect(canApplyWithoutConfirm({ preview: linkBlock, fromQueue: false })).toBe(false)
    expect(canApplyWithoutConfirm({ preview: preview([]), fromQueue: true })).toBe(false)
  })
})
