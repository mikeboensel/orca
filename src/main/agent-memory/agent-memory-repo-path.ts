import { basename, dirname, resolve } from 'node:path'
import { resolveGitCommonDirectory } from '../../shared/git-common-directory'

/** Main checkout containing `startDirectory`, so every Orca worktree of a repo maps to one scope. */
export async function resolveMainCheckoutPath(startDirectory: string): Promise<string | null> {
  let directory = resolve(startDirectory)
  for (;;) {
    const commonDirectory = await resolveGitCommonDirectory(directory)
    if (commonDirectory) {
      return basename(commonDirectory) === '.git' ? dirname(commonDirectory) : commonDirectory
    }
    const parent = dirname(directory)
    if (parent === directory) {
      return null
    }
    directory = parent
  }
}
