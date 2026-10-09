// ============================================================
// CONFIGURACIÓN DEL EXAMEN — edita aquí, no en el motor
// Espejo del examen de Moodle/Splavia (mismos bancos, misma estructura, mismos puntos).
// ============================================================

// Versión del banco. Se guarda en cada sesión: el panel solo califica sesiones
// de la misma versión que la clave de respuestas cargada (evita mezclar con el piloto viejo).
export const BANK_VERSION = "2026-10-moodle-v1";

// UoL: un ítem por página, tomado del banco de su nivel (50 por nivel).
export const UOL_DISTRIBUTION = { A1: 5, A2: 5, B1: 4, B2: 4 };

// Reading y Listening: se seleccionan TEXTOS / AUDIOS completos de cada nivel.
// Todos los textos de un nivel tienen el mismo número de preguntas
// (Reading 3 en A1/A2 y 4 en B1/B2; Listening 2 en A1 y 3 en A2/B1/B2),
// así todos los estudiantes contestan exactamente 68 preguntas.
export const READING_TEXTS_PER_LEVEL = { A1: 2, A2: 2, B1: 2, B2: 2 };
export const LISTENING_AUDIOS_PER_LEVEL = { A1: 2, A2: 2, B1: 2, B2: 2 };

export const LEVELS_ORDER = ["A1", "A2", "B1", "B2"];

// true  = las páginas de cada sección van de A1 a B2 (como los espacios del quiz en Moodle)
// false = se mezclan los niveles al azar dentro de cada sección
export const ORDER_BY_LEVEL = true;

// Cuántas veces se puede reproducir cada audio de Listening
export const MAX_AUDIO_PLAYS = 3;

// ---------- Puntaje (igual que Moodle: total = 100) ----------
// UoL: 14 ítems x 2 (A1, A2, B1) + 4 ítems x 3 (B2) = 40
export const UOL_POINTS = { A1: 2, A2: 2, B1: 2, B2: 3 };
// Reading: cada texto vale 2.5 y se reparte entre sus preguntas (8 textos = 20)
export const READING_POINTS_PER_TEXT = 2.5;
// Listening: cada audio vale 5 y se reparte entre sus preguntas (8 audios = 40)
export const LISTENING_POINTS_PER_AUDIO = 5;

// Pesos de la nota final (alineados con los certificados GEP): UoL 40 / Reading 20 / Listening 40
export const WEIGHTS = { UoL: 0.40, Reading: 0.20, Listening: 0.40 };

// Cortes PROVISIONALES sobre 100 puntos. El panel Bookmark con datos reales
// es lo que debe fijar los cortes definitivos.
export const LEVEL_CUTS = [
  { max: 25, level: "A1" },
  { max: 50, level: "A2" },
  { max: 75, level: "B1" },
  { max: 100, level: "B2" }
];

export const ALERT_THRESHOLD = 30;

// Tiempo de CADA sección (reloj independiente). Al agotarse pasa sola a la siguiente
// guardando lo respondido. Total 55 min para 68 preguntas.
export const SECTION_DURATIONS_MIN = { UoL: 15, Reading: 20, Listening: 20 };
export const EXAM_DURATION_MIN = Object.values(SECTION_DURATIONS_MIN).reduce((a, b) => a + b, 0);
export const TRANSITION_SECONDS = 3;

export function scoreToLevel(pct) {
  for (const cut of LEVEL_CUTS) {
    if (pct <= cut.max) return cut.level;
  }
  return "B2";
}
