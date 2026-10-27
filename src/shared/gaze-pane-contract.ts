import type { TabContentType } from './tab-types'

export type GazeScreenPoint = { x: number; y: number }
export type GazePaneRect = { x: number; y: number; width: number; height: number }

/** Coordinates use desktop logical points with a top-left origin. */
export type GazePaneHit = {
  worktreeId: string
  groupId: string
  tabId: string | null
  contentType: TabContentType | null
  leafId: string | null
  bounds: GazePaneRect
}

export type GazePaneQuery = {
  requestId: string
  x: number
  y: number
  highlight: boolean
  debug: boolean
}

export type GazePaneReply = {
  requestId: string
  hit: GazePaneHit | null
}
