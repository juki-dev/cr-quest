import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

// FE-DATA.1 — staleTime infinito: el caso no cambia hasta que se pide uno nuevo (RQ-5.8).
export function useScenario() {
  return useQuery({
    queryKey: ['scenario', 'next'],
    queryFn: apiClient.fetchNextScenario,
    staleTime: Infinity,
  });
}
