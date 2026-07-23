import type { ScenarioTemplate } from '@cr-quest/domain';
import { describe, expect, it } from 'vitest';
import { buildBatchRecords, extractNarrative, parseJsonlLine, toJsonl } from './batchJob.js';

const templates: ScenarioTemplate[] = [
  {
    templateId: 'tmpl-001',
    caseType: 'trauma_vial',
    difficulty: 'media',
    correctSequence: ['s1', 's2'],
    validatedBy: 'instructor@example.com',
    validatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    templateId: 'tmpl-002',
    caseType: 'caida_domestica',
    difficulty: 'baja',
    correctSequence: ['s1', 's2'],
    validatedBy: 'instructor@example.com',
    validatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('buildBatchRecords', () => {
  it('genera un registro por plantilla, identificado por templateId', () => {
    const records = buildBatchRecords(templates);
    expect(records.map((r) => r.recordId)).toEqual(['tmpl-001', 'tmpl-002']);
  });

  it('nunca incluye correctSequence en el prompt enviado al modelo', () => {
    const records = buildBatchRecords(templates);
    for (const record of records) {
      const prompt = JSON.stringify(record.modelInput);
      expect(prompt).not.toContain('correctSequence');
      expect(prompt).not.toContain('s1');
    }
  });
});

describe('toJsonl / parseJsonlLine', () => {
  it('produce una línea JSON por registro, reconstruible línea por línea', () => {
    const records = buildBatchRecords(templates);
    const jsonl = toJsonl(records);
    const lines = jsonl.split('\n');
    expect(lines).toHaveLength(2);
    expect(parseJsonlLine(lines[0]!).recordId).toBe('tmpl-001');
  });
});

describe('extractNarrative', () => {
  it('extrae el texto cuando la línea de salida es válida', () => {
    const narrative = extractNarrative({
      recordId: 'tmpl-001',
      modelOutput: { content: [{ text: 'Un paciente...' }] },
    });
    expect(narrative).toBe('Un paciente...');
  });

  it('BE-IA.4 — devuelve null (no lanza) si la línea no trae contenido', () => {
    expect(extractNarrative({ recordId: 'tmpl-001', modelOutput: {} })).toBeNull();
    expect(extractNarrative({ recordId: 'tmpl-001', modelOutput: { content: [] } })).toBeNull();
    expect(extractNarrative({ recordId: 'tmpl-001' })).toBeNull();
  });

  it('BE-IA.4 — una línea con JSON corrupto lanza en el parseo, no en la extracción', () => {
    expect(() => parseJsonlLine('{ esto no es json')).toThrow();
  });
});
