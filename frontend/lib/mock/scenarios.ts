import type { ScenarioStep } from '@/lib/types';

export interface ScenarioFixture {
  scenarioId: string;
  narrative: string;
  steps: ScenarioStep[]; // en orden correcto — el mock los mezcla al servirlos
}

// Datos de ejemplo, equivalentes a los de mockup.html:486-494. Sustituyen
// temporalmente a /domain + Scenarios (RQ-1, RQ-4) hasta que el backend exista.
export const SCENARIO_FIXTURES: ScenarioFixture[] = [
  {
    scenarioId: 'scn-001',
    narrative:
      'Accidente de tránsito en una vía urbana. El paciente es un hombre adulto, encontrado ' +
      'junto a su motocicleta con el casco puesto. Un transeúnte activó la llamada de emergencia ' +
      'y permanece junto al paciente. La escena está señalizada y aparenta ser segura. Al ' +
      'acercarte, el paciente no responde a estímulos verbales.',
    steps: [
      { stepId: 's1', label: 'Verificar la seguridad de la escena' },
      { stepId: 's2', label: 'Evaluar el estado de conciencia' },
      { stepId: 's3', label: 'Activar el sistema de emergencias (SEM)' },
      { stepId: 's4', label: 'Abrir y liberar la vía aérea' },
      { stepId: 's5', label: 'Verificar la respiración' },
      { stepId: 's6', label: 'Verificar el pulso y la circulación' },
    ],
  },
  {
    scenarioId: 'scn-002',
    narrative:
      'Caída desde una escalera doméstica. La paciente es una mujer adulta mayor, consciente ' +
      'pero confundida, que refiere dolor intenso en la cadera. Un familiar te recibe en la ' +
      'puerta y confirma que el área está despejada. La paciente responde cuando le hablas, ' +
      'aunque con respuestas incoherentes.',
    steps: [
      { stepId: 's1', label: 'Verificar la seguridad de la escena' },
      { stepId: 's2', label: 'Evaluar el estado de conciencia' },
      { stepId: 's3', label: 'Activar el sistema de emergencias (SEM)' },
      { stepId: 's4', label: 'Abrir y liberar la vía aérea' },
      { stepId: 's5', label: 'Verificar la respiración' },
      { stepId: 's6', label: 'Verificar el pulso y la circulación' },
    ],
  },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickRandomScenario(excludeIds: string[] = []): ScenarioFixture {
  const pool = SCENARIO_FIXTURES.filter((s) => !excludeIds.includes(s.scenarioId));
  const candidates = pool.length > 0 ? pool : SCENARIO_FIXTURES;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return { ...chosen, steps: shuffle(chosen.steps) };
}

export function findCorrectSequence(scenarioId: string): string[] | null {
  const fixture = SCENARIO_FIXTURES.find((s) => s.scenarioId === scenarioId);
  return fixture ? fixture.steps.map((s) => s.stepId) : null;
}

export function findStepLabel(scenarioId: string, stepId: string): string | null {
  const fixture = SCENARIO_FIXTURES.find((s) => s.scenarioId === scenarioId);
  return fixture?.steps.find((s) => s.stepId === stepId)?.label ?? null;
}
