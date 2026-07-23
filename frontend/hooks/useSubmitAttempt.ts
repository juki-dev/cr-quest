import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

// FE-DATA.3 — invalida el leaderboard/perfil cuando el intento cambia totalPoints.
export function useSubmitAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.submitAttempt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
