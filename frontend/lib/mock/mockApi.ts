import { validateOrder } from '@/lib/domain/validateOrder';
import type {
  LeaderboardResponse,
  ScenarioResponse,
  SubmitAttemptRequest,
  SubmitAttemptResponse,
} from '@/lib/types';
import { findCorrectSequence, findStepLabel, pickRandomScenario } from './scenarios';

/**
 * Sustituto temporal de la API real (be_specs.md § 4) mientras el backend no existe.
 * Simula latencia de red y mantiene el mismo shape de request/response que tendrán
 * los endpoints reales, para que las llamadas de `lib/apiClient.ts` sean un swap directo.
 */

const NETWORK_DELAY_MS = 350;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
}

interface OtherVolunteer {
  userId: string;
  displayName: string;
  totalPoints: number;
  casesCompleted: number;
}

// Réplica de mockup.html:410-478, sin la fila "Tú" (esa sale del estado propio).
const OTHER_VOLUNTEERS: OtherVolunteer[] = [
  { userId: 'u-cr', displayName: 'Camila Ríos', totalPoints: 14860, casesCompleted: 154 },
  { userId: 'u-ap', displayName: 'Andrés Peña', totalPoints: 14155, casesCompleted: 149 },
  { userId: 'u-lg', displayName: 'Laura Gómez', totalPoints: 12972, casesCompleted: 138 },
  { userId: 'u-jr', displayName: 'Julián Rey', totalPoints: 11132, casesCompleted: 121 },
  { userId: 'u-sc', displayName: 'Sofía Cano', totalPoints: 10710, casesCompleted: 119 },
  { userId: 'u-md', displayName: 'Mateo Duarte', totalPoints: 9790, casesCompleted: 110 },
];

const ME_USER_ID = 'me';

// totalPoints se expresa en accuracy * 100 (0–100 por caso) para leer como enteros, igual que el mockup.
let myStats = { totalPoints: 11904, casesCompleted: 128, displayName: 'Tú' };
const myBestByScenario = new Map<string, number>();
const attemptedScenarioIds: string[] = [];

export async function fetchNextScenario(): Promise<ScenarioResponse> {
  const fixture = pickRandomScenario(attemptedScenarioIds);
  const { scenarioId, narrative, steps } = fixture;
  return delay({ scenarioId, narrative, steps });
}

function buildExplanation(misplacedSteps: string[], scenarioId: string): string {
  if (misplacedSteps.length === 0) {
    return 'Coincidencia perfecta con la secuencia validada: respetaste el orden completo de evaluación.';
  }
  const labels = misplacedSteps
    .map((id) => findStepLabel(scenarioId, id))
    .filter((label): label is string => Boolean(label));
  return (
    `Revisa el orden de: ${labels.join('; ')}. En la evaluación primaria, cada paso depende ` +
    'de que el anterior esté resuelto — un paso corrido desplaza a todos los que siguen.'
  );
}

export async function submitAttempt(
  req: SubmitAttemptRequest,
): Promise<SubmitAttemptResponse> {
  const correctSequence = findCorrectSequence(req.scenarioId);
  if (!correctSequence) {
    throw new Error(`Escenario no encontrado: ${req.scenarioId}`);
  }

  const { accuracy, misplacedSteps } = validateOrder(req.submittedOrder, correctSequence);

  const previousBest = myBestByScenario.get(req.scenarioId);
  const isNewCase = previousBest === undefined;
  const isNewBest = isNewCase || accuracy > previousBest;

  if (isNewBest) {
    const delta = accuracy - (previousBest ?? 0);
    myBestByScenario.set(req.scenarioId, accuracy);
    myStats = {
      ...myStats,
      totalPoints: Math.round(myStats.totalPoints + delta * 100),
      casesCompleted: isNewCase ? myStats.casesCompleted + 1 : myStats.casesCompleted,
    };
  }
  if (isNewCase) {
    attemptedScenarioIds.push(req.scenarioId);
  }

  return delay({
    accuracy,
    misplacedSteps,
    isNewBest,
    totalPoints: myStats.totalPoints,
    casesCompleted: myStats.casesCompleted,
    explanation: buildExplanation(misplacedSteps, req.scenarioId),
  });
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const all = [...OTHER_VOLUNTEERS, { userId: ME_USER_ID, ...myStats }].sort(
    (a, b) => b.totalPoints - a.totalPoints,
  );

  const position = all.findIndex((e) => e.userId === ME_USER_ID) + 1;

  return delay({
    entries: all,
    me: { position, totalPoints: myStats.totalPoints, casesCompleted: myStats.casesCompleted },
  });
}
