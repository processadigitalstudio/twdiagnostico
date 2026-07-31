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

// Tabla de conversión — proporción de la Cambridge English Scale (80-230),
// tomando el tramo A1-B2 (100 a 180 en esa escala) y estirándolo a 0-100%.
// Cada nivel CEFR ocupa 20 puntos parejos en la escala de Cambridge, así que
// aquí cada nivel ocupa 25% parejo. Esto es un punto de partida más honesto
// que un número inventado, pero SIGUE siendo provisional — el panel Bookmark
// con los 5 jueces es lo que da el corte definitivo, calibrado con datos reales.
export const LEVEL_CUTS = [
  { max: 25, level: "A1" },
  { max: 50, level: "A2" },
  { max: 75, level: "B1" },
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
