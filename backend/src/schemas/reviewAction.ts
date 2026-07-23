import { z } from 'zod';

/** BE-API.7/8 — `.strict()` bloquea que el body incluya `correctSequence`. */
export const reviewActionSchema = z
  .object({
    action: z.enum(['publicar', 'rechazar']),
    narrative: z.string().min(1).optional(),
  })
  .strict();

export type ReviewActionInput = z.infer<typeof reviewActionSchema>;

export const reviewQuerySchema = z.object({
  status: z.enum(['borrador', 'revisado', 'publicado', 'rechazado']).default('borrador'),
});

export type ReviewQueryInput = z.infer<typeof reviewQuerySchema>;
