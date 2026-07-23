import type { ScenarioTemplate } from '@cr-quest/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIngestScenarioBatchHandler } from './ingestScenarioBatch.js';

const templates: ScenarioTemplate[] = [
  {
    templateId: 'tmpl-001',
    caseType: 'trauma_vial',
    difficulty: 'media',
    correctSequence: ['s1', 's2', 's3'],
    validatedBy: 'instructor@example.com',
    validatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    templateId: 'tmpl-002',
    caseType: 'caida_domestica',
    difficulty: 'baja',
    correctSequence: ['s4', 's5'],
    validatedBy: 'instructor@example.com',
    validatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function line(recordId: string, text: string): string {
  return JSON.stringify({ recordId, modelOutput: { content: [{ text }] } });
}

function makeDeps(overrides: Partial<Parameters<typeof createIngestScenarioBatchHandler>[0]> = {}) {
  return {
    templates,
    batchJobsRepo: {
      listPendingJobs: vi
        .fn()
        .mockResolvedValue([{ jobId: 'job-1', templateIds: ['tmpl-001', 'tmpl-002'], submittedAt: 't' }]),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    },
    scenariosRepo: { putScenario: vi.fn().mockResolvedValue(undefined) },
    getJobStatus: vi.fn().mockResolvedValue({ status: 'Completed', outputS3Uri: 's3://out/job-1/' }),
    downloadBatchOutput: vi
      .fn()
      .mockResolvedValue([line('tmpl-001', 'Narrativa 1'), line('tmpl-002', 'Narrativa 2')].join('\n')),
    generateScenarioId: vi.fn().mockReturnValueOnce('scn-a').mockReturnValueOnce('scn-b'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(globalThis.crypto, 'randomUUID');
});

describe('ingestScenarioBatch handler', () => {
  it('un job todavía en progreso no se procesa ni se marca', async () => {
    const deps = makeDeps({ getJobStatus: vi.fn().mockResolvedValue({ status: 'InProgress' }) });
    const handler = createIngestScenarioBatchHandler(deps);

    const result = await handler();

    expect(result).toEqual({ processedJobs: 0, scenariosCreated: 0 });
    expect(deps.scenariosRepo.putScenario).not.toHaveBeenCalled();
    expect(deps.batchJobsRepo.markProcessed).not.toHaveBeenCalled();
  });

  it('BE-IA.5 — la regla de oro: correctSequence guardado es siempre el de la plantilla, nunca derivado de la narrativa', async () => {
    const deps = makeDeps();
    const handler = createIngestScenarioBatchHandler(deps);

    const result = await handler();

    expect(result).toEqual({ processedJobs: 1, scenariosCreated: 2 });

    const calls = vi.mocked(deps.scenariosRepo.putScenario).mock.calls.map((c) => c[0]);
    const tmpl001Call = calls.find((c) => c.templateId === 'tmpl-001')!;
    const tmpl002Call = calls.find((c) => c.templateId === 'tmpl-002')!;

    expect(tmpl001Call.correctSequence).toEqual(['s1', 's2', 's3']);
    expect(tmpl002Call.correctSequence).toEqual(['s4', 's5']);
    expect(tmpl001Call.narrative).toBe('Narrativa 1');
    expect(tmpl001Call.status).toBe('borrador');
  });

  it('BE-IA.4 — una línea con JSON corrupto no aborta el resto del lote', async () => {
    const deps = makeDeps({
      downloadBatchOutput: vi
        .fn()
        .mockResolvedValue(['{ esto no es json', line('tmpl-002', 'Narrativa 2')].join('\n')),
    });
    const handler = createIngestScenarioBatchHandler(deps);

    const result = await handler();

    expect(result.scenariosCreated).toBe(1);
    expect(deps.scenariosRepo.putScenario).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'tmpl-002' }),
    );
  });

  it('BE-IA.4 — una línea sin plantilla correspondiente se descarta sin lanzar', async () => {
    const deps = makeDeps({
      downloadBatchOutput: vi.fn().mockResolvedValue(line('tmpl-inexistente', 'texto')),
    });
    const handler = createIngestScenarioBatchHandler(deps);

    const result = await handler();

    expect(result.scenariosCreated).toBe(0);
    expect(deps.scenariosRepo.putScenario).not.toHaveBeenCalled();
  });

  it('una línea sin narrativa (contenido vacío) se descarta', async () => {
    const deps = makeDeps({
      downloadBatchOutput: vi.fn().mockResolvedValue(
        JSON.stringify({ recordId: 'tmpl-001', modelOutput: { content: [] } }),
      ),
    });
    const handler = createIngestScenarioBatchHandler(deps);

    const result = await handler();
    expect(result.scenariosCreated).toBe(0);
  });

  it('un job fallido se marca procesado sin crear escenarios ni descargar salida', async () => {
    const deps = makeDeps({ getJobStatus: vi.fn().mockResolvedValue({ status: 'Failed' }) });
    const handler = createIngestScenarioBatchHandler(deps);

    const result = await handler();

    expect(result).toEqual({ processedJobs: 1, scenariosCreated: 0 });
    expect(deps.downloadBatchOutput).not.toHaveBeenCalled();
    expect(deps.batchJobsRepo.markProcessed).toHaveBeenCalledWith('job-1');
  });

  it('procesa varios jobs pendientes en una sola invocación', async () => {
    const deps = makeDeps({
      batchJobsRepo: {
        listPendingJobs: vi.fn().mockResolvedValue([
          { jobId: 'job-1', templateIds: ['tmpl-001'], submittedAt: 't' },
          { jobId: 'job-2', templateIds: ['tmpl-002'], submittedAt: 't' },
        ]),
        markProcessed: vi.fn().mockResolvedValue(undefined),
      },
      getJobStatus: vi.fn().mockResolvedValue({ status: 'Failed' }),
    });
    const handler = createIngestScenarioBatchHandler(deps);

    const result = await handler();

    expect(result.processedJobs).toBe(2);
    expect(deps.batchJobsRepo.markProcessed).toHaveBeenCalledTimes(2);
  });

  it('genera un scenarioId con crypto.randomUUID si no se inyecta uno', async () => {
    const deps = makeDeps();
    delete (deps as { generateScenarioId?: unknown }).generateScenarioId;
    const handler = createIngestScenarioBatchHandler(deps);

    await handler();

    expect(globalThis.crypto.randomUUID).toHaveBeenCalled();
  });
});
