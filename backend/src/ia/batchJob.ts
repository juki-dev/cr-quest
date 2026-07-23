import type { ScenarioTemplate } from '@cr-quest/domain';
import { buildGenerationPrompt, GENERATION_INSTRUCTIONS } from './prompts/generacion.js';

export interface BatchRecord {
  recordId: string; // = templateId, para reasociar la salida a su plantilla de origen
  modelInput: {
    anthropic_version: string;
    max_tokens: number;
    system: string;
    messages: { role: 'user'; content: string }[];
  };
}

/** BE-IA.1 — un registro de batch inference por plantilla; la narrativa es lo único variable. */
export function buildBatchRecords(templates: ScenarioTemplate[]): BatchRecord[] {
  return templates.map((template) => ({
    recordId: template.templateId,
    modelInput: {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 600,
      system: GENERATION_INSTRUCTIONS,
      messages: [{ role: 'user', content: buildGenerationPrompt(template) }],
    },
  }));
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
