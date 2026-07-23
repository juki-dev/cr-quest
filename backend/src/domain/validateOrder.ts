export interface ValidateOrderResult {
  accuracy: number;
  misplacedSteps: string[];
}

/**
 * BE-DOM.1 — función pura, sin I/O. Compara posición por posición: un paso
 * omitido corre a todos los siguientes, que cuentan como mal colocados sin
 * castigo adicional. `accuracy` es el único valor que fluye al resto del
 * sistema (BE-DOM.4) — nada recalcula la exactitud por su cuenta.
 */
export function validateOrder(submitted: string[], correct: string[]): ValidateOrderResult {
  const total = correct.length;
  if (total === 0) {
    return { accuracy: 0, misplacedSteps: [] };
  }

  const misplacedSteps: string[] = [];
  let matches = 0;

  for (let i = 0; i < total; i++) {
    const submittedStep = submitted[i];
    if (submittedStep === undefined) continue;
    if (submittedStep === correct[i]) {
      matches++;
    } else {
      misplacedSteps.push(submittedStep);
    }
  }

  return { accuracy: matches / total, misplacedSteps };
}
