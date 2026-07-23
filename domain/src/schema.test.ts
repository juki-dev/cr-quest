import { describe, expect, it } from 'vitest';
import { ASSESSMENT_STEPS } from './steps.js';
import { SCENARIO_TEMPLATES } from './templates.js';

// RQ-1.4 — falla si una plantilla referencia un stepId inexistente, tiene
// duplicados, o le faltan los campos de validación de un instructor.
describe('integridad de los datos semilla', () => {
  const knownStepIds = new Set(ASSESSMENT_STEPS.map((s) => s.stepId));

  it('no tiene stepId duplicados en la taxonomía', () => {
    expect(knownStepIds.size).toBe(ASSESSMENT_STEPS.length);
  });

  it('no tiene templateId duplicados', () => {
    const ids = new Set(SCENARIO_TEMPLATES.map((t) => t.templateId));
    expect(ids.size).toBe(SCENARIO_TEMPLATES.length);
  });

  it.each(SCENARIO_TEMPLATES)(
    'la plantilla $templateId solo referencia stepId existentes',
    (template) => {
      for (const stepId of template.correctSequence) {
        expect(knownStepIds.has(stepId)).toBe(true);
      }
    },
  );

  it.each(SCENARIO_TEMPLATES)(
    'la plantilla $templateId no repite un stepId en su correctSequence',
    (template) => {
      expect(new Set(template.correctSequence).size).toBe(template.correctSequence.length);
    },
  );

  it.each(SCENARIO_TEMPLATES)(
    'la plantilla $templateId tiene validatedBy y validatedAt reales',
    (template) => {
      expect(template.validatedBy.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(template.validatedAt))).toBe(false);
    },
  );

  it.each(SCENARIO_TEMPLATES)('la plantilla $templateId tiene al menos un paso', (template) => {
    expect(template.correctSequence.length).toBeGreaterThan(0);
  });
});
