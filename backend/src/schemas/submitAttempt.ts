import { z } from 'zod';

/**
 * BE-API.3 — `.strict()` es la aplicación técnica de la regla "el backend nunca
 * confía en un correctSequence que venga del cliente": cualquier campo extra
 * (incluido `correctSequence`) hace fallar el parseo con un 400, antes de que
 * la petición llegue a la lógica de dominio.
 */
export const submitAttemptSchema = z
  .object({
    scenarioId: z.string().min(1, 'scenarioId es obligatorio'),
    submittedOrder: z.array(z.string().min(1)).min(1, 'submittedOrder no puede estar vacío'),
  })
  .strict();

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
