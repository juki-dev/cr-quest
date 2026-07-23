import type { ScenarioTemplate } from '@cr-quest/domain';
import { describe, expect, it, vi } from 'vitest';
import { MIN_BATCH_RECORDS } from '../ia/batchJob.js';
import { createSubmitScenarioBatchHandler } from './submitScenarioBatch.js';

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

function makeDeps() {
  return {
    templates,
    modelId: 'modelo-sonnet',
    batchJobsRepo: { putPendingJob: vi.fn().mockResolvedValue(undefined) },
    uploadBatchInput: vi.fn().mockResolvedValue({
      inputS3Uri: 's3://bucket/input/job.jsonl',
      outputS3Uri: 's3://bucket/output/job/',
    }),
    createBatchJob: vi.fn().mockResolvedValue({ jobId: 'job-123' }),
  };
}

describe('submitScenarioBatch handler', () => {
  it('sube el JSONL de todas las plantillas y encola el job con el modelo configurado', async () => {
    const deps = makeDeps();
    const handler = createSubmitScenarioBatchHandler(deps);

    const result = await handler();

    expect(result).toEqual({ jobId: 'job-123', templateCount: 2 });
    expect(deps.uploadBatchInput).toHaveBeenCalledTimes(1);
    const [jsonl] = deps.uploadBatchInput.mock.calls[0]!;
    expect(jsonl.split('\n')).toHaveLength(MIN_BATCH_RECORDS);

    expect(deps.createBatchJob).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'modelo-sonnet' }),
    );
  });

  it('registra el job como pendiente con los templateId de todas las plantillas incluidas', async () => {
    const deps = makeDeps();
    const handler = createSubmitScenarioBatchHandler(deps);

    await handler();

    expect(deps.batchJobsRepo.putPendingJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-123', templateIds: ['tmpl-001', 'tmpl-002'] }),
    );
  });

  it('el JSONL enviado nunca incluye correctSequence (BE-IA.2)', async () => {
    const deps = makeDeps();
    const handler = createSubmitScenarioBatchHandler(deps);

    await handler();

    const [jsonl] = deps.uploadBatchInput.mock.calls[0]!;
    expect(jsonl).not.toContain('correctSequence');
  });
});
