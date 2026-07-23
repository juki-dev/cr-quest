/**
 * BE-IA.1 — bloque estable de instrucciones, candidato a prompt caching (RQ-4.5):
 * es idéntico en cada llamada del batch nocturno. Prohíbe explícitamente que el
 * modelo toque el orden de evaluación — esa es la regla de oro del proyecto.
 */
export const GENERATION_INSTRUCTIONS = [
  'Eres un redactor de escenarios de entrenamiento en primeros auxilios para Cruz Roja,',
  'basado en los lineamientos oficiales de la institución.',
  'Tu única tarea es escribir la narrativa concreta de un paciente ficticio, en español,',
  'a partir del tipo de caso y la dificultad indicados.',
  'Usa terminología y contexto coherentes con los manuales de Cruz Roja',
  '(evaluación de la escena, bioseguridad, signos y síntomas).',
  'Nunca inventes, sugieras, listes ni cambies el orden de evaluación o atención: la secuencia',
  'correcta ya está decidida y validada por un instructor certificado y no es parte de tu tarea.',
  'No incluyas datos de pacientes reales, nombres propios reales ni información identificable.',
  'Responde solo con la narrativa en prosa, sin encabezados ni listas.',
].join(' ');

export interface GenerationPromptInput {
  templateId: string;
  caseType: string;
  difficulty: string;
}

export function buildGenerationPrompt(input: GenerationPromptInput): string {
  return [
    `Tipo de caso: ${input.caseType}`,
    `Dificultad: ${input.difficulty}`,
    'Redacta la narrativa del paciente para este caso.',
  ].join('\n');
}
