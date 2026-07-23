export interface ScoreUpdate {
  isNewBest: boolean;
  isNewCase: boolean;
  /** Cuánto debe sumarse a STATS.totalPoints; 0 si el intento no mejora el BEST. */
  delta: number;
}

/**
 * BE-DOM.3 (paso 3) — decide, a partir del mejor `accuracy` previo del usuario
 * para este caso, si el intento nuevo se convierte en el nuevo BEST y cuánto
 * cambia el total acumulado. Pura: no sabe nada de DynamoDB ni de concurrencia
 * (eso lo maneja attemptsRepo.recordAttempt, que es quien la invoca).
 */
export function computeScoreUpdate(previousBest: number | undefined, newAccuracy: number): ScoreUpdate {
  const isNewCase = previousBest === undefined;
  const isNewBest = isNewCase || newAccuracy > previousBest;
  const delta = isNewBest ? newAccuracy - (previousBest ?? 0) : 0;
  return { isNewBest, isNewCase, delta };
}
