// Contrato de API — espejo exacto de be_specs.md § 4. No agregar campos aquí
// sin agregarlos primero al contrato documentado.

export interface ScenarioStep {
  stepId: string;
  label: string;
}

export interface ScenarioResponse {
  scenarioId: string;
  narrative: string;
  steps: ScenarioStep[]; // orden mezclado, sin correctSequence (RQ-4.12)
}

export interface SubmitAttemptRequest {
  scenarioId: string;
  submittedOrder: string[];
}

export interface SubmitAttemptResponse {
  accuracy: number; // 0–1
  misplacedSteps: string[];
  isNewBest: boolean;
  totalPoints: number;
  casesCompleted: number;
  explanation: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalPoints: number;
  casesCompleted: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  me: { position: number; totalPoints: number; casesCompleted: number };
}
