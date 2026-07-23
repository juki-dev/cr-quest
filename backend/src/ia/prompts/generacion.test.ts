import { describe, expect, it } from 'vitest';
import { buildGenerationPrompt, GENERATION_INSTRUCTIONS } from './generacion.js';

describe('GENERATION_INSTRUCTIONS', () => {
  it('prohíbe explícitamente tocar el orden de evaluación', () => {
    expect(GENERATION_INSTRUCTIONS).toMatch(/no.*(cambie|toque|invente|sugiera|liste).*orden|nunca.*orden/i);
  });

  it('prohíbe datos de pacientes reales (RQ-T.4)', () => {
    expect(GENERATION_INSTRUCTIONS).toMatch(/no incluyas datos de pacientes reales/i);
  });
});

describe('buildGenerationPrompt', () => {
  it('incluye el tipo de caso y la dificultad de la plantilla', () => {
    const prompt = buildGenerationPrompt({
      templateId: 'tmpl-001',
      caseType: 'trauma_vial',
      difficulty: 'media',
    });
    expect(prompt).toContain('trauma_vial');
    expect(prompt).toContain('media');
  });
});
