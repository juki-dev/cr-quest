import type { ScenarioTemplate } from '@cr-quest/domain';
import { buildBatchRecords, toJsonl } from '../ia/batchJob.js';
import type { BatchJobsRepo } from '../repositories/batchJobsRepo.js';

export interface SubmitScenarioBatchDeps {
  templates: ScenarioTemplate[];
  batchJobsRepo: Pick<BatchJobsRepo, 'putPendingJob'>;
  modelId: string;
  uploadBatchInput: (
    jsonl: string,
    jobName: string,
  ) => Promise<{ inputS3Uri: string; outputS3Uri: string }>;
  createBatchJob: (params: {
    modelId: string;
    jobName: string;
    inputS3Uri: string;
    outputS3Uri: string;
  }) => Promise<{ jobId: string }>;
}

export interface SubmitScenarioBatchResult {
  jobId: string;
  templateCount: number;
}

/**
 * BE-IA.1/2 — la mitad "enviar" del hallazgo de ADR-3: arma el JSONL de
 * prompts (solo narrativa, `correctSequence` nunca viaja al modelo), lo sube
 * a S3 y encola el job de batch inference. No espera a que termine — eso lo
 * resuelve `ingestScenarioBatch` en una invocación posterior.
 */
export function createSubmitScenarioBatchHandler(deps: SubmitScenarioBatchDeps) {
  return async (): Promise<SubmitScenarioBatchResult> => {
    const records = buildBatchRecords(deps.templates);
    const jsonl = toJsonl(records);
    const jobName = `cr-quest-batch-${Date.now()}`;

    const { inputS3Uri, outputS3Uri } = await deps.uploadBatchInput(jsonl, jobName);
    const { jobId } = await deps.createBatchJob({
      modelId: deps.modelId,
      jobName,
      inputS3Uri,
      outputS3Uri,
    });

    await deps.batchJobsRepo.putPendingJob({
      jobId,
      templateIds: deps.templates.map((t) => t.templateId),
      submittedAt: new Date().toISOString(),
    });

    return { jobId, templateCount: deps.templates.length };
  };
}
