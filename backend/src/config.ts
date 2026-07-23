import { getParameter } from '@aws-lambda-powertools/parameters/ssm';

export interface BedrockModelConfig {
  generationModelId: string;
  feedbackModelId: string;
}

const CACHE_TTL_SECONDS = 300;

function parameterPath(stage: string, name: string): string {
  return `/cr-quest/${stage}/bedrock/model-id/${name}`;
}

/**
 * ADR-8 (be_specs.md § 1) — el ID de modelo se resuelve por configuración, nunca
 * hardcodeado (RQ-4.3): cambiar de modelo es cambiar el parámetro de SSM, no
 * redesplegar código. `getParameter` de Lambda Powertools cachea en memoria del
 * proceso durante `CACHE_TTL_SECONDS`, así que no hay una llamada a SSM por
 * invocación bajo carga normal.
 */
export async function getBedrockModelConfig(stage: string): Promise<BedrockModelConfig> {
  const [generationModelId, feedbackModelId] = await Promise.all([
    getParameter(parameterPath(stage, 'generacion'), { maxAge: CACHE_TTL_SECONDS }),
    getParameter(parameterPath(stage, 'feedback'), { maxAge: CACHE_TTL_SECONDS }),
  ]);

  if (!generationModelId || !feedbackModelId) {
    throw new Error('Faltan parámetros de configuración de modelos Bedrock en SSM.');
  }

  return { generationModelId, feedbackModelId };
}
