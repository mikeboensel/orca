import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isDefinitiveAbsence } from '../../shared/definitive-filesystem-absence'
import { renameFileWithWindowsRetryAsync } from '../../shared/windows-retry-file-operations'

/** Null only for a definitive absence; permission and I/O errors propagate. */
export async function readTextFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isDefinitiveAbsence(error)) {
      return null
    }
    throw error
  }
}

/** Follows symlinks so a dotfile-repo link survives the atomic rename. */
async function resolveWritePath(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch (error) {
    if (isDefinitiveAbsence(error)) {
      return path
    }
    throw error
  }
}

export async function writeTextFileAtomically(requestedPath: string, text: string): Promise<void> {
  const path = await resolveWritePath(requestedPath)
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, text, 'utf8')
    await renameFileWithWindowsRetryAsync(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

/** Writes (or removes, with null) only if the file still holds `expectedText`; false otherwise. */
export async function replaceTextFileIfUnchanged(
  path: string,
  expectedText: string | null,
  nextText: string | null
): Promise<boolean> {
  // Re-read just before the write: an agent may have edited the file since the preview.
  if ((await readTextFileOrNull(path)) !== expectedText) {
    return false
  }
  await (nextText === null ? rm(path, { force: true }) : writeTextFileAtomically(path, nextText))
  return true
}
