import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-lambda-powertools/parameters/ssm', () => ({
  getParameter: vi.fn(),
}));

const { getParameter } = await import('@aws-lambda-powertools/parameters/ssm');
const { getGenerationModelId, getFeedbackModelId } = await import('./config.js');

describe('getGenerationModelId / getFeedbackModelId', () => {
  beforeEach(() => {
    vi.mocked(getParameter).mockReset();
  });

  it('resuelve el ID de generación desde su propio parámetro de SSM, sin tocar el de feedback', async () => {
    vi.mocked(getParameter).mockImplementation(async (name: string) => {
      if (name === '/cr-quest/piloto/bedrock/model-id/generacion') return 'modelo-sonnet-vigente';
      throw new Error(`parámetro inesperado: ${name}`);
    });

    expect(await getGenerationModelId('piloto')).toBe('modelo-sonnet-vigente');
    expect(getParameter).toHaveBeenCalledTimes(1);
  });

  it('resuelve el ID de feedback desde su propio parámetro de SSM, sin tocar el de generación', async () => {
    vi.mocked(getParameter).mockImplementation(async (name: string) => {
      if (name === '/cr-quest/piloto/bedrock/model-id/feedback') return 'modelo-haiku-vigente';
      throw new Error(`parámetro inesperado: ${name}`);
    });

    expect(await getFeedbackModelId('piloto')).toBe('modelo-haiku-vigente');
    expect(getParameter).toHaveBeenCalledTimes(1);
  });

  it('usa el stage recibido para construir la ruta del parámetro', async () => {
    vi.mocked(getParameter).mockResolvedValue('algun-id');

    await getGenerationModelId('dev');

    expect(getParameter).toHaveBeenCalledWith(
      '/cr-quest/dev/bedrock/model-id/generacion',
      expect.objectContaining({ maxAge: expect.any(Number) }),
    );
  });

  it('lanza un error explícito si falta el parámetro', async () => {
    vi.mocked(getParameter).mockResolvedValue(undefined);

    await expect(getGenerationModelId('piloto')).rejects.toThrow(/Falta el parámetro/);
  });
});
