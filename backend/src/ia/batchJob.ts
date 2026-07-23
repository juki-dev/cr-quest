import type { ScenarioTemplate } from '@cr-quest/domain';
import { buildGenerationPrompt, GENERATION_INSTRUCTIONS } from './prompts/generacion.js';

/**
 * 🔎 Hallazgo: Bedrock rechaza un batch job con menos de 100 registros
 * ("contains less records (N) than the required minimum of: 100"),
 * confirmado contra la API real. Con una librería de /domain más chica que
 * eso (como al inicio de un piloto), la única forma de cumplir el mínimo es
 * repetir las plantillas — el modelo igual genera una narrativa distinta en
 * cada repetición, así que el resultado es variedad real, no copias.
 */
export const MIN_BATCH_RECORDS = 100;

export interface BatchRecord {
  recordId: string; // `${templateId}#${instancia}` — puede repetirse la plantilla
  modelInput: {
    anthropic_version: string;
    max_tokens: number;
    system: string;
    messages: { role: 'user'; content: string }[];
  };
}

/** BE-IA.1 — un registro por instancia; la narrativa es lo único variable, nunca el orden. */
export function buildBatchRecords(templates: ScenarioTemplate[]): BatchRecord[] {
  if (templates.length === 0) return [];

  const records: BatchRecord[] = [];
  let instance = 0;
  while (records.length < MIN_BATCH_RECORDS) {
    const template = templates[instance % templates.length]!;
    records.push({
      recordId: `${template.templateId}#${instance}`,
      modelInput: {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 600,
        system: GENERATION_INSTRUCTIONS,
        messages: [{ role: 'user', content: buildGenerationPrompt(template) }],
      },
    });
    instance++;
  }
  return records;
}

/** Deshace el sufijo `#instancia` de un recordId para recuperar el templateId de origen. */
export function templateIdFromRecordId(recordId: string): string {
  return recordId.split('#')[0]!;
}

export function toJsonl(records: BatchRecord[]): string {
  return records.map((record) => JSON.stringify(record)).join('\n');
}

export interface BatchOutputLine {
  recordId: string;
  modelOutput?: { content?: { text?: string }[] };
}

/**
 * BE-IA.4 — cada línea se parsea de forma independiente; una línea corrupta
 * no debe abortar el resto del archivo. Los llamadores iteran el resultado de
 * `toJsonl`/`extractNarrative` envolviendo cada línea en su propio try/catch.
 */
export function parseJsonlLine(line: string): BatchOutputLine {
  return JSON.parse(line) as BatchOutputLine;
}

export function extractNarrative(line: BatchOutputLine): string | null {
  const text = line.modelOutput?.content?.[0]?.text;
  return text && text.trim().length > 0 ? text : null;
}
