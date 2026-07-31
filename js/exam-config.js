// ============================================================
// CONFIGURACIÓN DEL EXAMEN — edita aquí, no en el motor
// ============================================================

// UoL: sigue siendo por ítem individual (no hay texto que los agrupe)
export const UOL_DISTRIBUTION = { A1: 5, A2: 5, B1: 4, B2: 4 };

// Reading y Listening: ahora se seleccionan TEXTOS/AUDIOS completos,
// no preguntas sueltas — se lee/escucha una vez y se responden todas
// sus preguntas juntas.
export const READING_TEXTS_PER_LEVEL = { A1: 2, A2: 2, B1: 2, B2: 2 };
export const LISTENING_AUDIOS_PER_LEVEL = { A1: 2, A2: 2, B1: 2, B2: 2 };

export const LEVELS_ORDER = ["A1", "A2", "B1", "B2"];

// Cuántas veces se puede reproducir cada audio de Listening
export const MAX_AUDIO_PLAYS = 3;

// Pesos para la nota final
export const WEIGHTS = { UoL: 0.30, Reading: 0.35, Listening: 0.35 };

// Tabla de conversión PROVISIONAL (a validar/ajustar con Angoff + datos del piloto)
export const LEVEL_CUTS = [
  { max: 25, level: "A1" },
  { max: 45, level: "A2" },
  { max: 70, level: "B1" },
  { max: 100, level: "B2" }
];

export const ALERT_THRESHOLD = 30;
// Tiempo asignado a CADA sección por separado (no un solo reloj global).
// Cuando se acaba el tiempo de una sección, avanza sola a la siguiente
// (guardando lo que ya se respondió) — esto también sirve como señal:
// tardarse más de lo esperado en una destreza es en sí un indicador de nivel.
export const SECTION_DURATIONS_MIN = { UoL: 15, Reading: 30, Listening: 20 };
export const EXAM_DURATION_MIN = Object.values(SECTION_DURATIONS_MIN).reduce((a, b) => a + b, 0); // 65, solo referencia
export const TRANSITION_SECONDS = 3;

export function scoreToLevel(pct) {
  for (const cut of LEVEL_CUTS) {
    if (pct <= cut.max) return cut.level;
  }
  return "B2";
}
