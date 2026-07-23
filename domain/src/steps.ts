import type { AssessmentStep } from './types.js';

/**
 * RQ-1.1 — datos semilla de desarrollo. Antes de un piloto real, un instructor
 * certificado debe revisar y firmar esta taxonomía alineada al protocolo de la
 * regional (ver `validatedBy`/`validatedAt` en templates.ts). El equipo técnico
 * no agrega, quita ni reordena pasos por su cuenta.
 */
export const ASSESSMENT_STEPS: AssessmentStep[] = [
  {
    stepId: 's1',
    label: 'Verificar la seguridad de la escena',
    description: 'Confirmar que no existen riesgos para el rescatista antes de aproximarse.',
    category: 'evaluacion_primaria',
  },
  {
    stepId: 's2',
    label: 'Evaluar el estado de conciencia',
    description: 'Determinar el nivel de respuesta del paciente ante estímulos verbales y físicos.',
    category: 'evaluacion_primaria',
  },
  {
    stepId: 's3',
    label: 'Activar el sistema de emergencias (SEM)',
    description: 'Solicitar apoyo profesional tan pronto se confirme la necesidad de atención.',
    category: 'evaluacion_primaria',
  },
  {
    stepId: 's4',
    label: 'Abrir y liberar la vía aérea',
    description: 'Asegurar que la vía aérea esté permeable antes de evaluar la respiración.',
    category: 'evaluacion_primaria',
  },
  {
    stepId: 's5',
    label: 'Verificar la respiración',
    description: 'Confirmar presencia, frecuencia y calidad de la respiración.',
    category: 'evaluacion_primaria',
  },
  {
    stepId: 's6',
    label: 'Verificar el pulso y la circulación',
    description: 'Confirmar presencia de pulso y signos de circulación adecuada.',
    category: 'evaluacion_primaria',
  },
];
