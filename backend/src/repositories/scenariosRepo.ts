import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const STATUS_INDEX = 'GSI1';

export type ScenarioStatus = 'borrador' | 'revisado' | 'publicado' | 'rechazado';

export interface ScenarioItem {
  scenarioId: string;
  templateId: string;
  narrative: string;
  correctSequence: string[];
  status: ScenarioStatus;
  generatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  batchJobId?: string;
}

function toScenario(item: Record<string, unknown>): ScenarioItem {
  return {
    scenarioId: String(item.PK).replace('SCENARIO#', ''),
    templateId: item.templateId as string,
    narrative: item.narrative as string,
    correctSequence: item.correctSequence as string[],
    status: item.status as ScenarioStatus,
    generatedAt: item.generatedAt as string,
    reviewedBy: item.reviewedBy as string | undefined,
    reviewedAt: item.reviewedAt as string | undefined,
    batchJobId: item.batchJobId as string | undefined,
  };
}

/** BE-DATA.1/2 — acceso a la tabla `Scenarios` (la librería de casos). */
export function createScenariosRepo(client: DynamoDBDocumentClient, tableName: string) {
  /** BE-IA.2 — siempre agrega, nunca sobreescribe un `scenarioId` existente. */
  async function putScenario(scenario: ScenarioItem): Promise<void> {
    const { scenarioId, ...rest } = scenario;
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: { PK: `SCENARIO#${scenarioId}`, ...rest },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async function getScenario(scenarioId: string): Promise<ScenarioItem | undefined> {
    const result = await client.send(
      new GetCommand({ TableName: tableName, Key: { PK: `SCENARIO#${scenarioId}` } }),
    );
    return result.Item ? toScenario(result.Item) : undefined;
  }

  /** BE-API.1/BE-DATA.2 — Query por GSI1, nunca Scan. */
  async function queryByStatus(status: ScenarioStatus, limit = 50): Promise<ScenarioItem[]> {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: STATUS_INDEX,
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (result.Items ?? []).map(toScenario);
  }

  /**
   * BE-API.7 — máquina de estados explícita: la condición exige que el estado
   * actual sea `from`, así que `publicado -> publicado` u otra transición no
   * contemplada falla con ConditionalCheckFailedException en vez de aceptarse.
   */
  async function transitionStatus(params: {
    scenarioId: string;
    from: ScenarioStatus;
    to: 'publicado' | 'rechazado';
    reviewedBy: string;
    narrative?: string;
  }): Promise<void> {
    const { scenarioId, from, to, reviewedBy, narrative } = params;
    const now = new Date().toISOString();

    const setParts = ['#status = :to', 'reviewedBy = :reviewedBy', 'reviewedAt = :reviewedAt'];
    const values: Record<string, unknown> = { ':from': from, ':to': to, ':reviewedBy': reviewedBy, ':reviewedAt': now };
    if (narrative !== undefined) {
      setParts.push('narrative = :narrative');
      values[':narrative'] = narrative;
    }

    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: `SCENARIO#${scenarioId}` },
        UpdateExpression: `SET ${setParts.join(', ')}`,
        ConditionExpression: '#status = :from',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: values,
      }),
    );
  }

  return { putScenario, getScenario, queryByStatus, transitionStatus };
}

export type ScenariosRepo = ReturnType<typeof createScenariosRepo>;
