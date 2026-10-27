import type {
  AgentMemoryApplyOptions,
  AgentMemoryApplyOutcome,
  AgentMemoryApplyResult,
  AgentMemorySyncTargetPlan
} from '../../shared/agent-memory/agent-memory-sync-types'
import { replaceTextFileIfUnchanged } from './agent-memory-file-io'

async function applyTarget(
  target: AgentMemorySyncTargetPlan,
  previewedFingerprints: ReadonlyMap<string, string> | null,
  overwriteDriftedPaths: ReadonlySet<string>
): Promise<AgentMemoryApplyOutcome> {
  if (target.status === 'in-sync') {
    return 'unchanged'
  }
  if (
    previewedFingerprints &&
    previewedFingerprints.get(target.path) !== target.currentFileFingerprint
  ) {
    return 'skipped-changed-since-plan'
  }
  if (target.status === 'drifted') {
    // A malformed block has no rewrite (next equals current), so it stays skipped.
    if (!overwriteDriftedPaths.has(target.path) || target.nextFileText === target.currentFileText) {
      return 'skipped-drifted'
    }
  }
  const replaced = await replaceTextFileIfUnchanged(
    target.path,
    target.currentFileText,
    target.nextFileText
  )
  return replaced ? 'written' : 'skipped-changed-since-plan'
}

/** Writes only planned targets; drifted ones need an explicit overwrite, changed ones are skipped. */
export async function applyAgentMemorySyncTargets(
  targets: AgentMemorySyncTargetPlan[],
  options: AgentMemoryApplyOptions = {}
): Promise<AgentMemoryApplyResult> {
  const previewedFingerprints = options.previewedFiles
    ? new Map(options.previewedFiles.map((file) => [file.path, file.currentFileFingerprint]))
    : null
  const overwriteDriftedPaths = new Set(options.overwriteDriftedPaths ?? [])
  const results: AgentMemoryApplyResult['targets'] = []
  for (const target of targets) {
    results.push({
      path: target.path,
      agent: target.agent,
      outcome: await applyTarget(target, previewedFingerprints, overwriteDriftedPaths)
    })
  }
  return { targets: results }
}
