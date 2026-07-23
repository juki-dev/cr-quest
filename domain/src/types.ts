/** RQ-1.1 — taxonomía de pasos de evaluación de pacientes. */
export interface AssessmentStep {
  stepId: string;
  label: string;
  description: string;
  category: string;
}

/**
 * RQ-1.2 — plantilla de escenario. `correctSequence` es la única fuente de verdad
 * del orden correcto; la IA (Fase 4) solo redacta la narrativa concreta a partir
 * de `caseType`/`difficulty`, nunca toca este arreglo.
 */
export interface ScenarioTemplate {
  templateId: string;
  caseType: string;
  difficulty: 'baja' | 'media' | 'alta';
  correctSequence: string[]; // stepId[], en el orden correcto
  validatedBy: string;
  validatedAt: string; // ISO 8601
}
