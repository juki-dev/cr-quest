import { describe, expect, it } from 'vitest';
import { buildFeedbackPrompt, FEEDBACK_INSTRUCTIONS } from './feedback.js';

describe('FEEDBACK_INSTRUCTIONS', () => {
  it('prohíbe contradecir los pasos mal ubicados ya calculados', () => {
    expect(FEEDBACK_INSTRUCTIONS).toMatch(/nunca los cuestiones/i);
  });
});

describe('buildFeedbackPrompt', () => {
  it('incluye secuencia correcta, orden enviado y pasos mal ubicados (BE-IA.6)', () => {
    const prompt = buildFeedbackPrompt({
      narrative: 'Un paciente...',
      correctSequenceLabels: ['Verificar la escena', 'Evaluar conciencia'],
      submittedOrderLabels: ['Evaluar conciencia', 'Verificar la escena'],
      misplacedStepLabels: ['Evaluar conciencia', 'Verificar la escena'],
    });

    expect(prompt).toContain('Secuencia correcta validada: Verificar la escena -> Evaluar conciencia');
    expect(prompt).toContain('Orden enviado por el voluntario: Evaluar conciencia -> Verificar la escena');
    expect(prompt).toContain('Pasos mal ubicados (ya calculados, no los cuestiones): Evaluar conciencia, Verificar la escena');
  });

  it('indica "ninguno" cuando no hay pasos mal ubicados', () => {
    const prompt = buildFeedbackPrompt({
      narrative: 'Un paciente...',
      correctSequenceLabels: ['A', 'B'],
      submittedOrderLabels: ['A', 'B'],
      misplacedStepLabels: [],
    });
    expect(prompt).toContain('ninguno');
  });
});
