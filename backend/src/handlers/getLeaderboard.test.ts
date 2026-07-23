import { describe, expect, it, vi } from 'vitest';
import { createGetLeaderboardHandler } from './getLeaderboard.js';
import { buildEvent, parseBody } from './testUtils.js';

function makeDeps() {
  return {
    attemptsRepo: {
      getLeaderboard: vi.fn().mockResolvedValue([
        { userId: 'u1', displayName: 'Ana', totalPoints: 14.8, casesCompleted: 12 },
      ]),
      getStats: vi
        .fn()
        .mockResolvedValue({ totalPoints: 11.9, casesCompleted: 8, displayName: 'Tú' }),
      getRankPosition: vi.fn().mockResolvedValue(4),
    },
  };
}

describe('getLeaderboard handler', () => {
  it('rechaza un límite inválido con 400', async () => {
    const handler = createGetLeaderboardHandler(makeDeps());
    const result = await handler(buildEvent({ queryStringParameters: { limit: '0' } }));
    expect(result.statusCode).toBe(400);
  });

  it('devuelve entries y la posición propia calculada por getRankPosition', async () => {
    const deps = makeDeps();
    const handler = createGetLeaderboardHandler(deps);

    const result = await handler(buildEvent({ userId: 'me' }));
    const body = parseBody(result) as {
      entries: unknown[];
      me: { position: number; totalPoints: number; casesCompleted: number };
    };

    expect(result.statusCode).toBe(200);
    expect(body.entries).toHaveLength(1);
    expect(body.me).toEqual({ position: 4, totalPoints: 11.9, casesCompleted: 8 });
    expect(deps.attemptsRepo.getRankPosition).toHaveBeenCalledWith(11.9);
  });

  it('un usuario sin STATS todavía obtiene 0 puntos y 0 casos, no un error', async () => {
    const deps = makeDeps();
    deps.attemptsRepo.getStats = vi.fn().mockResolvedValue(undefined);
    const handler = createGetLeaderboardHandler(deps);

    const result = await handler(buildEvent());
    const body = parseBody(result) as { me: { totalPoints: number; casesCompleted: number } };

    expect(body.me.totalPoints).toBe(0);
    expect(body.me.casesCompleted).toBe(0);
    expect(deps.attemptsRepo.getRankPosition).toHaveBeenCalledWith(0);
  });
});
