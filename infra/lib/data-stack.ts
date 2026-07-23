import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

/**
 * BE-DATA.1-6 — la librería de casos (`Scenarios`), el histórico/agregado por
 * usuario (`Attempts`, single-table) y el bucket de entrada/salida del batch
 * inference de Bedrock. `RETAIN` en ambas tablas: ni la librería de casos ni
 * el progreso de un voluntario deben poder perderse por un `cdk destroy`.
 */
export class DataStack extends Stack {
  public readonly scenariosTable: dynamodb.Table;
  public readonly attemptsTable: dynamodb.Table;
  public readonly batchBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.scenariosTable = new dynamodb.Table(this, 'ScenariosTable', {
      tableName: 'Scenarios',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // BE-DATA.2 — Query por status, nunca Scan; también sirve para listar
    // BatchJob# con status='pendiente'/'procesado' (BE-IA.3).
    this.scenariosTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'generatedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.attemptsTable = new dynamodb.Table(this, 'AttemptsTable', {
      tableName: 'Attempts',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // BE-DATA.4 — GSI disperso: solo los ítems STATS tienen `recordType`,
    // ordenado numéricamente por totalPoints para el ranking general.
    this.attemptsTable.addGlobalSecondaryIndex({
      indexName: 'LeaderboardIndex',
      partitionKey: { name: 'recordType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'totalPoints', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['displayName', 'casesCompleted'],
    });

    this.batchBucket = new s3.Bucket(this, 'BedrockBatchIoBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(30) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
