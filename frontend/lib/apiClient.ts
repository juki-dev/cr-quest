import type {
  LeaderboardResponse,
  ScenarioResponse,
  SubmitAttemptRequest,
  SubmitAttemptResponse,
} from '@/lib/types';

/**
 * Punto único de acceso a datos del cliente. Llama a los Route Handlers BFF
 * (fe_specs.md ADR-3, app/api/*), que a su vez proxean al backend real
 * desplegado — ver lib/backendProxy.ts. El mock (lib/mock/mockApi.ts) queda
 * disponible pero ya no se usa por defecto.
 */
async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export const apiClient = {
  fetchNextScenario: () => fetch('/api/scenarios/next').then((r) => parseOrThrow<ScenarioResponse>(r)),

  submitAttempt: (req: SubmitAttemptRequest) =>
    fetch('/api/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
    }).then((r) => parseOrThrow<SubmitAttemptResponse>(r)),

  fetchLeaderboard: () => fetch('/api/leaderboard').then((r) => parseOrThrow<LeaderboardResponse>(r)),
};
