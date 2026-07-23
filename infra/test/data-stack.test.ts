import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { DataStack } from '../lib/data-stack.js';

// Sintetizado una sola vez por archivo: el stack no cambia entre tests,
// y volver a sintetizar en cada `it` solo repite trabajo sin motivo.
let template: Template;

beforeAll(() => {
  const app = new App();
  const stack = new DataStack(app, 'TestDataStack');
  template = Template.fromStack(stack);
});

describe('DataStack', () => {
  it('BE-DATA.1/2 — tabla Scenarios con GSI1 por status/generatedAt', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'Scenarios',
      KeySchema: [{ AttributeName: 'PK', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' },
            { AttributeName: 'generatedAt', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  it('BE-DATA.3/4 — tabla Attempts single-table con LeaderboardIndex numérico', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'Attempts',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'LeaderboardIndex',
          KeySchema: [
            { AttributeName: 'recordType', KeyType: 'HASH' },
            { AttributeName: 'totalPoints', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });

    // totalPoints debe ser numérico — si no, el orden del ranking se rompe (be_specs BE-DATA.4).
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'Attempts',
      AttributeDefinitions: Match.arrayWith([
        Match.objectLike({ AttributeName: 'totalPoints', AttributeType: 'N' }),
      ]),
    });
  });

  it('ambas tablas usan pago por demanda (sin capacidad fija que gestionar en un piloto)', () => {
    const tables = template.findResources('AWS::DynamoDB::Table');
    for (const resource of Object.values(tables)) {
      expect((resource as { Properties: { BillingMode: string } }).Properties.BillingMode).toBe(
        'PAY_PER_REQUEST',
      );
    }
  });

  it('BE-DATA.6 — el bucket de batch I/O bloquea todo acceso público y expira a los 30 días', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      LifecycleConfiguration: {
        Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 30 })]),
      },
    });
  });
});
