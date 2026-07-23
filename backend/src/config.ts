import { getParameter } from '@aws-lambda-powertools/parameters/ssm';

const CACHE_TTL_SECONDS = 300;

function parameterPath(stage: string, name: string): string {
  return `/cr-quest/${stage}/bedrock/model-id/${name}`;
}

async function getModelId(stage: string, name: string): Promise<string> {
  const value = await getParameter(parameterPath(stage, name), { maxAge: CACHE_TTL_SECONDS });
  if (!value) {
    throw new Error(`Falta el parámetro de configuración /cr-quest/${stage}/bedrock/model-id/${name} en SSM.`);
  }
  return value;
}

/**
 * ADR-8 (be_specs.md § 1) — el ID de modelo se resuelve por configuración, nunca
 * hardcodeado (RQ-4.3). Cada handler solo pide el parámetro que le corresponde:
 * su rol de IAM está acotado a ese único path (BE-SEC.4), así que combinar
 * ambas lecturas en una sola función (como se hacía antes) rompía en cualquier
 * Lambda que no tuviera permiso sobre el otro parámetro.
 */
export function getGenerationModelId(stage: string): Promise<string> {
  return getModelId(stage, 'generacion');
}

export function getFeedbackModelId(stage: string): Promise<string> {
  return getModelId(stage, 'feedback');
}
