import * as mockApi from '@/lib/mock/mockApi';
import type { SubmitAttemptRequest } from '@/lib/types';

/**
 * Punto único de acceso a datos del cliente. Hoy delega al mock (lib/mock/mockApi.ts)
 * porque el backend (be_specs.md) todavía no existe. Cuando exista, estas funciones
 * pasan a llamar a los Route Handlers BFF (fe_specs.md ADR-3) sin que los hooks que
 * las consumen cambien de forma.
 */
export const apiClient = {
  fetchNextScenario: () => mockApi.fetchNextScenario(),
  submitAttempt: (req: SubmitAttemptRequest) => mockApi.submitAttempt(req),
  fetchLeaderboard: () => mockApi.fetchLeaderboard(),
};
