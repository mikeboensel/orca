import { defineMethod } from '../core'
import { queryGazePane } from '../../gaze-pane-query'
import { GazeResolveParams } from '../../../../shared/rpc-contract/gaze-params'

export const GAZE_METHODS = [
  defineMethod({
    name: 'gaze.resolve',
    permission: 'desktop-control',
    params: GazeResolveParams,
    handler: async (params, { runtime }) => ({
      pane: await queryGazePane(
        runtime,
        { x: params.x, y: params.y },
        params.highlight === true || params.debug === true,
        params.debug === true
      )
    })
  }),
  defineMethod({
    name: 'gaze.clear',
    permission: 'desktop-control',
    params: null,
    handler: async (_params, { runtime }) => {
      await queryGazePane(runtime, null, true)
      return { cleared: true }
    }
  })
]
