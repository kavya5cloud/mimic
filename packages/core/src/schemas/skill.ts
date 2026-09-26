import { z } from 'zod';
export const skillStepSchema = z.object({ instruction: z.string().min(1), visibleTarget: z.string().min(1), tip: z.string().optional(), shortcut: z.string().optional() });
export const skillSchema = z.object({
  id: z.string().uuid(), authorId: z.string().uuid(), app: z.string().min(1), title: z.string().min(1).max(160), goal: z.string().min(1).max(500),
  prerequisites: z.array(z.string().min(1)).default([]), steps: z.array(skillStepSchema), tags: z.array(z.string().min(1)).default([]),
  estimatedTimeSeconds: z.number().int().positive().optional(), price: z.number().nonnegative().default(0), status: z.enum(['draft','published','archived']).default('draft'),
  embeddingModel: z.string().min(1).optional(), embeddingVersion: z.string().min(1).optional(), embeddingDimensions: z.number().int().positive().optional(), embedding: z.array(z.number()).optional()
});
export type Skill = z.infer<typeof skillSchema>;
