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

  // ---- BORRADOR generado con IA (NotebookLM/Gemini, grounded en fuentes de
  // Cruz Roja: Tema 4 - Evaluación, Tema 5 - Shock, Tema 6 - Hemorragias y
  // Heridas, Tema 7 - Lesiones por regiones, Tema 8 - Quemaduras),
  // PENDIENTES DE REVISIÓN por un instructor certificado — ver steps.ts.
  // ⚠️ Las cuatro siguen el mismo patrón "s1-s6 completos, luego el paso
  // específico al final" en las cuatro plantillas. Para hemorragia_externa en
  // particular, revisar si el control de sangrado grave debería ir antes de
  // completar la evaluación primaria — no se corrigió acá a propósito, es
  // exactamente el tipo de decisión que le corresponde al instructor.
  {
    templateId: 'tmpl-003',
    caseType: 'quemadura_termica',
    difficulty: 'media',
    // s1-s6: Tema 4 - Evaluación.pptx. quemadura-enfriar / quemadura-cubrir-aposito: Tema 8 - Quemaduras.pptx
    correctSequence: ['s1', 's2', 's3', 's4', 's5', 's6', 'quemadura-enfriar', 'quemadura-cubrir-aposito'],
    validatedBy: 'instructor.pendiente@cruzroja.example',
    validatedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    templateId: 'tmpl-004',
    caseType: 'hemorragia_externa',
    difficulty: 'media',
    // s1-s6: Tema 4 - Evaluación.pptx / Tema 3 - Bioseguridad.pptx (EPP). hemorragia-presion-directa: Tema 6 - Hemorragias y Heridas.pptx
    correctSequence: ['s1', 's2', 's3', 's4', 's5', 's6', 'hemorragia-presion-directa'],
    validatedBy: 'instructor.pendiente@cruzroja.example',
    validatedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    templateId: 'tmpl-005',
    caseType: 'estado_de_shock',
    difficulty: 'alta',
    // s1-s6: Tema 4 - Evaluación.pptx. shock-posicionar: Tema 5 - Shock.pptx
    correctSequence: ['s1', 's2', 's3', 's4', 's5', 's6', 'shock-posicionar'],
    validatedBy: 'instructor.pendiente@cruzroja.example',
    validatedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    templateId: 'tmpl-006',
    caseType: 'lesion_musculo_esqueletica',
    difficulty: 'media',
    // s1-s6: Tema 4 - Evaluación.pptx. lesion-inmovilizar: Tema 7 - Lesiones por regiones.pptx
    correctSequence: ['s1', 's2', 's3', 's4', 's5', 's6', 'lesion-inmovilizar'],
    validatedBy: 'instructor.pendiente@cruzroja.example',
    validatedAt: '2026-01-15T00:00:00.000Z',
  },
];
