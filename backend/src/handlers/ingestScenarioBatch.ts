import type { ScenarioTemplate } from '@cr-quest/domain';
import { extractNarrative, parseJsonlLine, templateIdFromRecordId } from '../ia/batchJob.js';
import type { BatchJobsRepo } from '../repositories/batchJobsRepo.js';
import type { ScenariosRepo } from '../repositories/scenariosRepo.js';

export type BedrockBatchJobStatus = 'InProgress' | 'Completed' | 'Failed' | 'Stopped' | 'Other';

export interface IngestScenarioBatchDeps {
  batchJobsRepo: Pick<BatchJobsRepo, 'listPendingJobs' | 'markProcessed'>;
  scenariosRepo: Pick<ScenariosRepo, 'putScenario'>;
  templates: ScenarioTemplate[];
  getJobStatus: (
    jobId: string,
  ) => Promise<{ status: BedrockBatchJobStatus; outputS3Uri?: string }>;
  downloadBatchOutput: (outputS3Uri: string) => Promise<string>;
  generateScenarioId?: () => string;
}

export interface IngestScenarioBatchResult {
  processedJobs: number;
  scenariosCreated: number;
}

/**
 * BE-IA.4/BE-IA.5 — la mitad "ingerir" del hallazgo de ADR-3. Un job todavía
 * `InProgress` se deja pendiente para la próxima invocación (poll de
 * respaldo). Cada línea de salida se procesa de forma aislada: una línea
 * corrupta o sin plantilla correspondiente se descarta sin abortar el resto
 * ni el job completo. La regla de oro se cumple por construcción: el
 * `correctSequence` que se guarda es siempre el de la plantilla, nunca algo
 * derivado de `narrative` (que es lo único que devuelve el modelo).
 */
export function createIngestScenarioBatchHandler(deps: IngestScenarioBatchDeps) {
  const generateScenarioId = deps.generateScenarioId ?? (() => crypto.randomUUID());

  return async (): Promise<IngestScenarioBatchResult> => {
    const pendingJobs = await deps.batchJobsRepo.listPendingJobs();
    let processedJobs = 0;
    let scenariosCreated = 0;

    for (const job of pendingJobs) {
      const { status, outputS3Uri } = await deps.getJobStatus(job.jobId);

      if (status === 'InProgress') {
        continue;
      }

      if (status === 'Completed' && outputS3Uri) {
        const jsonl = await deps.downloadBatchOutput(outputS3Uri);
        const lines = jsonl.split('\n').filter((line) => line.trim().length > 0);

        for (const line of lines) {
          try {
            const parsed = parseJsonlLine(line);
            const narrative = extractNarrative(parsed);
            const templateId = templateIdFromRecordId(parsed.recordId);
            const template = deps.templates.find((t) => t.templateId === templateId);
            if (!narrative || !template) continue;

            await deps.scenariosRepo.putScenario({
              scenarioId: generateScenarioId(),
              templateId: template.templateId,
              narrative,
              correctSequence: template.correctSequence,
              status: 'borrador',
              generatedAt: new Date().toISOString(),
              batchJobId: job.jobId,
            });
            scenariosCreated++;
          } catch {
            continue;
          }
        }
      }

      await deps.batchJobsRepo.markProcessed(job.jobId);
      processedJobs++;
    }

    return { processedJobs, scenariosCreated };
  };
}
