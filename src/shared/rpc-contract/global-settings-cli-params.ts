import { z } from 'zod'

export const GlobalSettingsCliListParams = z
  .object({ filter: z.string().trim().max(200).optional() })
  .strict()

export const GlobalSettingsCliGetParams = z
  .object({ key: z.string().trim().min(1, 'Missing setting key').max(200) })
  .strict()

// Values travel as CLI text; the host parses them against its own schema so old CLIs stay correct.
export const GlobalSettingsCliSetParams = z
  .object({
    key: z.string().trim().min(1, 'Missing setting key').max(200),
    value: z.string().max(1_000_000)
  })
  .strict()
