import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateFeedback } from './bedrockClient.js';

const bedrockMock = mockClient(BedrockRuntimeClient);
const client = new BedrockRuntimeClient({ region: 'us-east-1' });

const baseInput = {
  narrative: 'narrativa',
  correctSequenceLabels: ['A', 'B'],
  submittedOrderLabels: ['B', 'A'],
  misplacedStepLabels: ['B', 'A'],
};

// El SDK tipa `body` como IUint8ArrayBlobAdapter, pero en runtime nuestro
// código solo lo decodifica como bytes crudos (TextDecoder), así que un
// Uint8Array plano basta — se castea para satisfacer el tipo del mock.
function bodyOf(text: string) {
  return new TextEncoder().encode(JSON.stringify({ content: [{ text }] })) as never;
}

beforeEach(() => {
  bedrockMock.reset();
});

describe('generateFeedback', () => {
  it('devuelve el texto explicativo cuando Bedrock responde correctamente', async () => {
    bedrockMock.on(InvokeModelCommand).resolves({ body: bodyOf('Explicación generada.') });

    const result = await generateFeedback(client, 'modelo-haiku', baseInput);

    expect(result).toBe('Explicación generada.');
    const input = bedrockMock.commandCalls(InvokeModelCommand)[0]!.args[0]!.input;
    expect(input.modelId).toBe('modelo-haiku');
  });

  it('BE-IA.7 — degrada a null si la llamada a Bedrock falla, no lanza', async () => {
    bedrockMock.on(InvokeModelCommand).rejects(new Error('timeout simulado'));

    const result = await generateFeedback(client, 'modelo-haiku', baseInput);

    expect(result).toBeNull();
  });

  it('devuelve null si la respuesta no trae texto', async () => {
    bedrockMock.on(InvokeModelCommand).resolves({
      body: new TextEncoder().encode(JSON.stringify({ content: [] })) as never,
    });

    const result = await generateFeedback(client, 'modelo-haiku', baseInput);

    expect(result).toBeNull();
  });

  it('el prompt enviado incluye la secuencia correcta y los pasos mal ubicados', async () => {
    bedrockMock.on(InvokeModelCommand).resolves({ body: bodyOf('ok') });

    await generateFeedback(client, 'modelo-haiku', baseInput);

    const input = bedrockMock.commandCalls(InvokeModelCommand)[0]!.args[0]!.input;
    const body = JSON.parse(input.body as string);
    expect(body.messages[0].content).toContain('Secuencia correcta validada: A -> B');
  });
});
