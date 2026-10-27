import { z } from 'zod'

export const GazeResolveParams = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  highlight: z.boolean().optional(),
  debug: z.boolean().optional()
})
