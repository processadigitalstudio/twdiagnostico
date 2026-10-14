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
// UoL: 40 puntos repartidos en partes iguales entre sus 18 ítems (así lo califica Moodle).
export const UOL_TOTAL_POINTS = 40;
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

// Igual que Moodle: A1 = 0–24.9, A2 = 25–49.9, B1 = 50–74.9, B2 = 75–100.
export function scoreToLevel(pct) {
  for (const cut of LEVEL_CUTS) {
    if (pct < cut.max) return cut.level;
  }
  return "B2";
}

// ---------- Seguridad del examen (disuasivos del lado del navegador) ----------
export const REQUIRE_FULLSCREEN = true;     // pide pantalla completa y bloquea si la abandonan
export const ENABLE_WATERMARK = true;       // marca de agua con nombre y documento en cada pantalla
export const MAX_EVENTS_PER_SESSION = 150;  // tope de eventos sospechosos guardados por estudiante

// ---------- Dónde están los audios e imágenes ----------
// En Firebase Hosting gratis (twtest.web.app) el tráfico diario es limitado, así que allí los audios e
// imágenes (los archivos pesados) se sirven desde GitHub Pages. En cualquier otro dominio salen del mismo sitio.
const ON_FIREBASE_HOSTING = /\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
export const ASSET_BASE = ON_FIREBASE_HOSTING ? "https://processadigitalstudio.github.io/twtest/" : "";
export const assetUrl = (path) => ASSET_BASE + path;
