import { ipcRenderer } from 'electron'
import type { GazePaneQuery, GazePaneReply } from '../../shared/gaze-pane-contract'

export const gazePaneApi = {
  onGazePaneQuery: (callback: (query: GazePaneQuery) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, query: GazePaneQuery): void =>
      callback(query)
    ipcRenderer.on('gaze:resolvePane', listener)
    return () => ipcRenderer.removeListener('gaze:resolvePane', listener)
  },
  replyGazePaneQuery: (reply: GazePaneReply): void => {
    ipcRenderer.send('gaze:paneReply', reply)
  }
}
