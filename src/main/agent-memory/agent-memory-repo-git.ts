import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { runProcess } from '@orca/process-host'
import { resolveDefaultBaseRefViaExec } from '../../shared/git-default-base-ref'
import { resolveGitCommonDirectory } from '../../shared/git-common-directory'

const GIT_TIMEOUT_MS = 15_000

/** Plain `git` through process-host; works in the app and the offline CLI alike. */
export async function runRepoGit(repoPath: string, args: string[]): Promise<string | null> {
  const result = await runProcess({
    program: 'git',
    args: ['-C', repoPath, ...args],
    timeoutMs: GIT_TIMEOUT_MS
  })
  return result.code === 0 ? result.stdout : null
}

/** Explicit repo base ref first, then the repo default (origin/HEAD, origin/main, …), as worktree creation does. */
export async function resolveAgentMemoryBaseRef(
  repoPath: string,
  repoBaseRef: string | null | undefined
): Promise<string | null> {
  if (repoBaseRef) {
    return repoBaseRef
  }
  return resolveDefaultBaseRefViaExec(async (argv) => {
    const stdout = await runRepoGit(repoPath, argv)
    if (stdout === null) {
      throw new Error('git failed')
    }
    return { stdout }
  })
}

export async function readRepoFileAtRef(
  repoPath: string,
  ref: string,
  relativePath: string
): Promise<string | null> {
  return runRepoGit(repoPath, ['show', `${ref}:${relativePath}`])
}

export async function listRepoFilesAtRef(
  repoPath: string,
  ref: string
): Promise<Set<string> | null> {
  const stdout = await runRepoGit(repoPath, ['ls-tree', '-r', '--name-only', '--full-tree', ref])
  return stdout === null ? null : new Set(stdout.split('\n').filter(Boolean))
}

/**
 * Worktrees of a repo from git's own admin dirs (`<common>/worktrees/<name>/gitdir`), the same
 * registry Orca's worktree list is built from; read without spawning git.
 */
export async function listLinkedWorktreePaths(repoPath: string): Promise<string[]> {
  const commonDirectory = await resolveGitCommonDirectory(repoPath)
  if (!commonDirectory) {
    return []
  }
  const adminRoot = join(commonDirectory, 'worktrees')
  let names: string[]
  try {
    names = await readdir(adminRoot)
  } catch {
    return []
  }
  const paths: string[] = []
  for (const name of names) {
    try {
      const gitFile = (await readFile(join(adminRoot, name, 'gitdir'), 'utf8')).trim()
      paths.push(dirname(resolve(adminRoot, name, gitFile)))
    } catch {
      // A pruned or half-written admin dir has no gitdir; git ignores it too.
    }
  }
  return paths.sort()
}
