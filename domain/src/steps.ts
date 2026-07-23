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

  // ---- Pasos de atención específica — BORRADOR generado con IA (NotebookLM/Gemini,
  // grounded en fuentes de Cruz Roja), PENDIENTES DE REVISIÓN por un instructor
  // certificado. No usar como fuente de verdad hasta que esa revisión ocurra.
  // Tres de estos (quemadura-quimica-cepillar, herida-lavar, epistaxis-manejo)
  // todavía no tienen una plantilla con secuencia completa en templates.ts —
  // sus tipos de caso quedaron pendientes de una segunda pasada.
  {
    stepId: 'quemadura-enfriar',
    label: 'Enfriar la quemadura con agua corriente',
    description: 'Aplicar agua limpia a chorro suave sobre la lesión térmica para reducir temperatura.',
    category: 'atencion_especifica',
  },
  {
    stepId: 'quemadura-cubrir-aposito',
    label: 'Cubrir con apósito estéril',
    description: 'Proteger la zona afectada con material limpio o estéril sin ejercer presión excesiva.',
    category: 'atencion_especifica',
  },
  {
    stepId: 'quemadura-quimica-cepillar',
    label: 'Cepillar agente químico seco',
    description: 'Retirar el residuo químico seco de la piel antes de lavar, si el agente lo requiere.',
    category: 'atencion_especifica',
  },
  {
    stepId: 'hemorragia-presion-directa',
    label: 'Aplicar presión directa sobre la herida',
    description: 'Ejercer presión firme sobre el punto de sangrado con un apósito limpio para cohibir el flujo.',
    category: 'atencion_especifica',
  },
  {
    stepId: 'herida-lavar',
    label: 'Lavar y desinfectar la herida',
    description: 'Asear el tejido afectado para prevenir infecciones secundarias.',
    category: 'atencion_especifica',
  },
  {
    stepId: 'shock-posicionar',
    label: 'Recostar y elevar extremidades o posición de recuperación',
    description:
      'Acostar a la persona y elevar piernas hasta 30 cm si procede, o colocar en posición de recuperación si está inconsciente con respiración normal.',
    category: 'atencion_especifica',
  },
  {
    stepId: 'lesion-inmovilizar',
    label: 'Inmovilizar la extremidad lesionada',
    description: 'Fijar los extremos óseos o articulaciones afectadas evitando movimientos, evaluando circulación distal.',
    category: 'atencion_especifica',
  },
  {
    stepId: 'epistaxis-manejo',
    label: 'Inclinar la cabeza hacia adelante y comprimir fosas nasales',
    description: 'Mantener al paciente sentado, inclinado ligeramente al frente, mientras se presionan las alas nasales.',
    category: 'atencion_especifica',
  },
];
