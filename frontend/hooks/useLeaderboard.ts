import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

// FE-DATA.2 — consumido tanto por ProfileCard como por LeaderboardWidget: una sola llamada.
export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: apiClient.fetchLeaderboard,
  });
}
