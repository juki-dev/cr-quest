/**
 * Réplica frontend, para el mock local, de la función pura especificada en
 * be_specs.md § 5 (BE-DOM.1). En producción este cálculo lo hace el backend
 * dentro de submitAttempt; el cliente nunca ve `correct` fuera de este módulo mock.
 */
export interface ValidateOrderResult {
  accuracy: number;
  misplacedSteps: string[];
}

export function validateOrder(submitted: string[], correct: string[]): ValidateOrderResult {
  const total = correct.length;
  if (total === 0) {
    return { accuracy: 0, misplacedSteps: [] };
  }

  const misplacedSteps: string[] = [];
  let matches = 0;

  for (let i = 0; i < total; i++) {
    const submittedStep = submitted[i];
    if (submittedStep !== undefined && submittedStep === correct[i]) {
      matches++;
    } else if (submittedStep !== undefined) {
      misplacedSteps.push(submittedStep);
    }
  }

  return { accuracy: matches / total, misplacedSteps };
}
