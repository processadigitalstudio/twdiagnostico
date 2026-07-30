// ============================================================
// CONFIGURACIÓN DEL EXAMEN — edita aquí, no en el motor
// ============================================================

// Cuántas preguntas se toman de cada destreza (debe ser igual para las 3,
// según lo acordado: N=18 por destreza → 54 preguntas totales, ~57.5 min).
export const N_PER_SKILL = 18;

// Cómo se reparte ese N entre los 4 niveles dentro de cada destreza.
// 18 no es divisible entre 4 exacto, así que queda 5-5-4-4.
// Para no sesgar siempre a los mismos niveles, ROTATING_EXTRA hace que
// el "nivel con 5" cambie según el número de sesión (ver exam-engine.js).
export const LEVEL_DISTRIBUTION = { A1: 5, A2: 5, B1: 4, B2: 4 };
export const LEVELS_ORDER = ["A1", "A2", "B1", "B2"];

// Pesos para la nota final
export const WEIGHTS = { UoL: 0.30, Reading: 0.35, Listening: 0.35 };

// Tabla de conversión PROVISIONAL (a validar/ajustar con Angoff + datos del piloto)
export const LEVEL_CUTS = [
  { max: 25, level: "A1" },
  { max: 45, level: "A2" },
  { max: 70, level: "B1" },
  { max: 100, level: "B2" }
];

// Umbral de alerta: si una destreza individual cae bajo esto, se marca para revisión
export const ALERT_THRESHOLD = 30;

// Duración total del examen en minutos
export const EXAM_DURATION_MIN = 60;

// Pequeña pausa de "carga" entre preguntas (en segundos), solo visual/UX,
// no resta del tiempo total del examen.
export const TRANSITION_SECONDS = 3;

export function scoreToLevel(pct) {
  for (const cut of LEVEL_CUTS) {
    if (pct <= cut.max) return cut.level;
  }
  return "B2";
}
