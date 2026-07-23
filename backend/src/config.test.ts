import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-lambda-powertools/parameters/ssm', () => ({
  getParameter: vi.fn(),
}));

const { getParameter } = await import('@aws-lambda-powertools/parameters/ssm');
const { getBedrockModelConfig } = await import('./config.js');

describe('getBedrockModelConfig', () => {
  beforeEach(() => {
    vi.mocked(getParameter).mockReset();
  });

  it('resuelve ambos IDs de modelo desde SSM por parámetro, nunca hardcodeados', async () => {
    vi.mocked(getParameter).mockImplementation(async (name: string) => {
      if (name === '/cr-quest/piloto/bedrock/model-id/generacion') return 'modelo-sonnet-vigente';
      if (name === '/cr-quest/piloto/bedrock/model-id/feedback') return 'modelo-haiku-vigente';
      throw new Error(`parámetro inesperado: ${name}`);
    });

    const config = await getBedrockModelConfig('piloto');

    expect(config).toEqual({
      generationModelId: 'modelo-sonnet-vigente',
      feedbackModelId: 'modelo-haiku-vigente',
    });
  });

  it('usa el stage recibido para construir la ruta del parámetro', async () => {
    vi.mocked(getParameter).mockResolvedValue('algun-id');

    await getBedrockModelConfig('dev');

    expect(getParameter).toHaveBeenCalledWith(
      '/cr-quest/dev/bedrock/model-id/generacion',
      expect.objectContaining({ maxAge: expect.any(Number) }),
    );
  });

  it('lanza un error explícito si falta algún parámetro', async () => {
    vi.mocked(getParameter).mockResolvedValue(undefined);

    await expect(getBedrockModelConfig('piloto')).rejects.toThrow(/Faltan parámetros/);
  });
});
