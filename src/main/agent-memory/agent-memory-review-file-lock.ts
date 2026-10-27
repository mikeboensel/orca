import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { lock } from 'proper-lockfile'

/** A holder that died leaves `<file>.lock` behind; after this long it is taken over. */
export const REVIEW_FILE_LOCK_STALE_MS = 10_000
const REVIEW_FILE_LOCK_RETRIES = { retries: 40, factor: 1.2, minTimeout: 10, maxTimeout: 250 }

const pendingInProcess = new Map<string, Promise<unknown>>()

/**
 * Serializes read-merge-write of one review file across Orca processes (app and CLI) with a
 * `<file>.lock` directory, and within this process with a promise chain. Directory modes are left alone.
 */
export async function withReviewFileLock<T>(path: string, apply: () => Promise<T>): Promise<T> {
  const previous = pendingInProcess.get(path) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await mkdir(dirname(path), { recursive: true })
      let compromised: Error | undefined
      const release = await lock(path, {
        realpath: false,
        stale: REVIEW_FILE_LOCK_STALE_MS,
        retries: REVIEW_FILE_LOCK_RETRIES,
        onCompromised: (error) => {
          compromised = error
        }
      })
      try {
        const result = await apply()
        if (compromised) {
          throw new Error(`Lost the lock on ${path} while writing review state`, {
            cause: compromised
          })
        }
        return result
      } finally {
        if (!compromised) {
          await release()
        }
      }
    })
  pendingInProcess.set(path, next)
  try {
    return await next
  } finally {
    if (pendingInProcess.get(path) === next) {
      pendingInProcess.delete(path)
    }
  }
}
