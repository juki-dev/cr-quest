import { describe, expect, it } from 'vitest';
import { leaderboardQuerySchema } from './leaderboardQuery.js';

describe('leaderboardQuerySchema', () => {
  it('por defecto usa límite 50', () => {
    expect(leaderboardQuerySchema.parse({}).limit).toBe(50);
  });

  it('acepta un límite explícito como string (query param de API Gateway)', () => {
    expect(leaderboardQuerySchema.parse({ limit: '10' }).limit).toBe(10);
  });

  it('rechaza límites no positivos', () => {
    expect(leaderboardQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('rechaza límites por encima del máximo permitido', () => {
    expect(leaderboardQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
