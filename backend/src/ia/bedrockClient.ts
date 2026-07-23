import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { buildFeedbackPrompt, FEEDBACK_INSTRUCTIONS, type FeedbackPromptInput } from './prompts/feedback.js';

const DEFAULT_TIMEOUT_MS = 5000;

interface ClaudeInvokeBody {
  content?: { text?: string }[];
}

/**
 * BE-IA.6/7 — llamada síncrona a Haiku con timeout corto. Cualquier falla
 * (error de red, timeout, respuesta sin texto) degrada a `null`: nunca bloquea
 * ni retrasa el cálculo de `accuracy`, que ya está resuelto antes de llamar aquí.
 */
export async function generateFeedback(
  client: BedrockRuntimeClient,
  modelId: string,
  input: FeedbackPromptInput,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 300,
          system: FEEDBACK_INSTRUCTIONS,
          messages: [{ role: 'user', content: buildFeedbackPrompt(input) }],
        }),
      }),
      { abortSignal: controller.signal },
    );

    const payload = JSON.parse(new TextDecoder().decode(response.body)) as ClaudeInvokeBody;
    return payload.content?.[0]?.text ?? null;
  } catch (error) {
    // BE-OBS.1 — degradar a null nunca debe significar quedar ciegos: sin este
    // log, un fallo sistemático (permiso mal apuntado, formato de body roto)
    // es indistinguible de un timeout ocasional en CloudWatch.
    console.error('generateFeedback: la llamada a Bedrock falló, se degrada a explanation=null', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
