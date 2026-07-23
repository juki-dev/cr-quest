import { z } from 'zod';

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;
