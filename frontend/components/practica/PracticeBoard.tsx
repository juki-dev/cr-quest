'use client';

import { useScenario } from '@/hooks/useScenario';
import { PracticeSession } from './PracticeSession';

export function PracticeBoard() {
  const { data: scenario, isLoading, isError, refetch } = useScenario();

  if (isLoading) {
    return <div className="card">Cargando caso…</div>;
  }
  if (isError || !scenario) {
    return <div className="card">No se pudo cargar un caso publicado. Intenta de nuevo.</div>;
  }

  return (
    <PracticeSession
      key={scenario.scenarioId}
      scenario={scenario}
      onRequestNext={() => void refetch()}
    />
  );
}
