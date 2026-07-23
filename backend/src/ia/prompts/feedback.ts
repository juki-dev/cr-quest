/** BE-IA.9 — bloque estable, candidato a prompt caching junto al de generación. */
export const FEEDBACK_INSTRUCTIONS = [
  'Eres un asistente que explica, en español, por qué ciertos pasos de una evaluación',
  'de paciente quedaron mal ubicados en el intento de un voluntario en entrenamiento.',
  'Los pasos mal ubicados ya fueron calculados por un motor de reglas determinista:',
  'nunca los cuestiones, los cambies ni afirmes que un paso mal ubicado está correcto.',
  'Tu única tarea es explicar el porqué, en 2 o 3 frases, con tono claro y breve.',
].join(' ');

export interface FeedbackPromptInput {
  narrative: string;
  correctSequenceLabels: string[];
  submittedOrderLabels: string[];
  misplacedStepLabels: string[];
}

/** BE-IA.6 — el prompt siempre incluye secuencia correcta, orden enviado y los pasos ya calculados. */
export function buildFeedbackPrompt(input: FeedbackPromptInput): string {
  return [
    `Narrativa del caso: ${input.narrative}`,
    `Secuencia correcta validada: ${input.correctSequenceLabels.join(' -> ')}`,
    `Orden enviado por el voluntario: ${input.submittedOrderLabels.join(' -> ')}`,
    `Pasos mal ubicados (ya calculados, no los cuestiones): ${
      input.misplacedStepLabels.join(', ') || 'ninguno'
    }`,
    'Explica por qué esos pasos deben ir en ese orden.',
  ].join('\n');
}
