import type { ScenarioTemplate } from '@cr-quest/domain';
import { describe, expect, it } from 'vitest';
import {
  buildBatchRecords,
  extractNarrative,
  MIN_BATCH_RECORDS,
  parseJsonlLine,
  templateIdFromRecordId,
  toJsonl,
} from './batchJob.js';

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
  it('BE-IA.1 — completa el mínimo de registros que exige Bedrock repitiendo plantillas', () => {
    const records = buildBatchRecords(templates);
    expect(records.length).toBe(MIN_BATCH_RECORDS);
  });

  it('cada recordId es único aunque la plantilla se repita', () => {
    const records = buildBatchRecords(templates);
    expect(new Set(records.map((r) => r.recordId)).size).toBe(records.length);
  });

  it('templateIdFromRecordId recupera la plantilla de origen de cada instancia repetida', () => {
    const records = buildBatchRecords(templates);
    const templateIds = new Set(records.map((r) => templateIdFromRecordId(r.recordId)));
    expect(templateIds).toEqual(new Set(['tmpl-001', 'tmpl-002']));
  });

  it('devuelve una lista vacía si no hay plantillas (no entra en loop infinito)', () => {
    expect(buildBatchRecords([])).toEqual([]);
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
    expect(lines).toHaveLength(MIN_BATCH_RECORDS);
    expect(parseJsonlLine(lines[0]!).recordId).toBe(records[0]!.recordId);
  });
});

describe('templateIdFromRecordId', () => {
  it('deshace el sufijo #instancia', () => {
    expect(templateIdFromRecordId('tmpl-001#42')).toBe('tmpl-001');
  });

  it('devuelve el valor tal cual si no tiene sufijo', () => {
    expect(templateIdFromRecordId('tmpl-001')).toBe('tmpl-001');
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
