import { translate } from '@/i18n/i18n'
import type {
  AgentMemoryAgent,
  AgentMemoryDecision,
  AgentMemoryShareState,
  AgentMemorySuggestionVerdict,
  AgentMemoryType,
  AgentMemoryUnreviewedReason
} from '../../../../../shared/agent-memory/agent-memory-types'

export function agentMemoryAgentLabel(agent: AgentMemoryAgent): string {
  switch (agent) {
    case 'claude':
      return translate('agentMemory.agent.claude', 'Claude')
    case 'codex':
      return translate('agentMemory.agent.codex', 'Codex')
    case 'gemini':
      return translate('agentMemory.agent.gemini', 'Gemini')
    case 'opencode':
      return translate('agentMemory.agent.opencode', 'OpenCode')
    case 'pi':
      return translate('agentMemory.agent.pi', 'Pi')
  }
}

export function agentMemoryTypeLabel(type: AgentMemoryType): string {
  switch (type) {
    case 'user':
      return translate('agentMemory.type.user', 'User')
    case 'feedback':
      return translate('agentMemory.type.feedback', 'Feedback')
    case 'project':
      return translate('agentMemory.type.project', 'Project')
    case 'reference':
      return translate('agentMemory.type.reference', 'Reference')
    case 'instruction':
      return translate('agentMemory.type.instruction', 'Instruction')
  }
}

export function agentMemoryDecisionLabel(
  decision: AgentMemoryDecision | AgentMemorySuggestionVerdict
): string {
  switch (decision) {
    case 'KEEP':
      return translate('agentMemory.decision.keep', 'Keep')
    case 'SHARE':
      return translate('agentMemory.decision.share', 'Share')
    case 'ARCHIVE':
      return translate('agentMemory.decision.archive', 'Archive')
    case 'MERGE':
      return translate('agentMemory.decision.merge', 'Merge')
    case 'EDIT':
      return translate('agentMemory.decision.edit', 'Edit')
    case 'DELETE':
      return translate('agentMemory.decision.delete', 'Delete')
    case 'NEEDS_REVIEW':
      return translate('agentMemory.decision.needsReview', 'Needs review')
  }
}

export function agentMemoryReasonLabel(reason: AgentMemoryUnreviewedReason): string {
  switch (reason) {
    case 'NO_RECORD':
      return translate('agentMemory.reason.noRecord', 'Never reviewed')
    case 'CONTENT_CHANGED':
      return translate('agentMemory.reason.contentChanged', 'Changed since review')
    case 'PR_MERGED':
      return translate('agentMemory.reason.prMerged', 'Names a merged PR')
    case 'PR_CLOSED':
      return translate('agentMemory.reason.prClosed', 'Names a closed PR')
    case 'PATH_MISSING_ON_MAIN':
      return translate('agentMemory.reason.pathMissing', 'Names a file gone from main')
    case 'REVIEW_EXPIRED':
      return translate('agentMemory.reason.reviewExpired', 'Review is old')
  }
}

export function agentMemoryShareStateLabel(state: AgentMemoryShareState): string {
  switch (state) {
    case 'native':
      return translate('agentMemory.share.native', 'Written by this agent')
    case 'shared':
      return translate('agentMemory.share.shared', 'Shared')
    case 'paused':
      return translate(
        'agentMemory.share.paused',
        'Sharing paused: changed since it was shared; review it to share again'
      )
    case 'not-shared':
      return translate('agentMemory.share.notShared', 'Not shared')
    case 'unavailable':
      return translate('agentMemory.share.unavailable', 'Sharing not supported yet')
  }
}

export function formatAgentMemoryAge(isoTime: string, now: number): string {
  const time = Date.parse(isoTime)
  if (Number.isNaN(time)) {
    return translate('agentMemory.age.onMain', 'on main')
  }
  const days = Math.floor((now - time) / 86_400_000)
  if (days < 1) {
    return translate('agentMemory.age.today', 'today')
  }
  return translate('agentMemory.age.days', '{{value0}}d ago', { value0: days })
}
