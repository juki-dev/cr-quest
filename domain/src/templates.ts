import type { ScenarioTemplate } from './types.js';

/**
 * RQ-1.3 — datos semilla de desarrollo, pendientes de firma real de un instructor
 * certificado antes de usarse en un piloto. `correctSequence` es la secuencia que
 * `generateScenarioBatch` (be_specs.md § 6) copia sin modificar en cada escenario.
 */
export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    templateId: 'tmpl-001',
    caseType: 'trauma_vial',
    difficulty: 'media',
    correctSequence: ['s1', 's2', 's3', 's4', 's5', 's6'],
    validatedBy: 'instructor.pendiente@cruzroja.example',
    validatedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    templateId: 'tmpl-002',
    caseType: 'caida_domestica',
    difficulty: 'baja',
    correctSequence: ['s1', 's2', 's3', 's4', 's5', 's6'],
    validatedBy: 'instructor.pendiente@cruzroja.example',
    validatedAt: '2026-01-15T00:00:00.000Z',
  },
];
