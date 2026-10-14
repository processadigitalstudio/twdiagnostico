import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  UOL_DISTRIBUTION, READING_TEXTS_PER_LEVEL, LISTENING_AUDIOS_PER_LEVEL,
  LEVELS_ORDER, ORDER_BY_LEVEL, WEIGHTS, ALERT_THRESHOLD, EXAM_DURATION_MIN, scoreToLevel,
  BANK_VERSION, UOL_TOTAL_POINTS, READING_POINTS_PER_TEXT, LISTENING_POINTS_PER_AUDIO, MAX_EVENTS_PER_SESSION
} from "./exam-config.js";

// ---------- utilidades ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

async function loadBank(path) {
  const res = await fetch(path);
  return res.json();
}

// Bancos tal como los usa el examen: UoL = lista de ítems; Reading y Listening = lista de
// textos/audios, cada uno con sus preguntas. Ninguno contiene la respuesta correcta.
export async function loadAllBanks() {
  const [uol, reading, listening] = await Promise.all([
    loadBank("data/uol_bank.json"),
    loadBank("data/reading_bank.json"),
    loadBank("data/listening_bank.json")
  ]);
  return { UoL: uol, Reading: reading, Listening: listening };
}

// Para admin.html / bookmark: una lista plana de preguntas por destreza, con el
// contexto (texto o audio) de cada una para poder mostrarla en el análisis.
export function flattenBanks(banks) {
  const flat = { UoL: banks.UoL.map(it => ({ ...it })), Reading: [], Listening: [] };
  for (const g of banks.Reading) {
    const ctx = g.image ? `[Imagen: ${g.title}]` : g.paragraphs.join(" ");
    for (const q of g.questions) {
      flat.Reading.push({ ...q, skill: "Reading", level: g.level, category: "Reading", text_title: g.title, context: ctx, image: g.image });
    }
  }
  for (const g of banks.Listening) {
    for (const q of g.questions) {
      flat.Listening.push({ ...q, skill: "Listening", level: g.level, category: "Listening", audio_id: g.audio_id, audio_title: g.title, context: null });
    }
  }
  return flat;
}

// "A1_R_T02_Q1" -> "A1_R_T02" ; "A1L01_Q2" -> "A1L01" ; "UoL-A1-G01" -> "UoL-A1-G01"
export function pageIdOf(itemId) {
  return itemId.replace(/_Q\d+$/, "");
}

// ---------- UoL: selección por ítem, balanceada por categoría (sin cambios de fondo) ----------
function pickUolForLevel(levelItems, count) {
  const byCategory = {};
  for (const it of levelItems) (byCategory[it.category] = byCategory[it.category] || []).push(it);
  const cats = Object.keys(byCategory);
  for (const c of cats) byCategory[c] = shuffle(byCategory[c]);
  const picked = [];
  let ci = 0;
  while (picked.length < count) {
    const cat = cats[ci % cats.length];
    const pool = byCategory[cat];
    if (pool.length > 0) picked.push(pool.pop());
    ci++;
    if (cats.every(c => byCategory[c].length === 0) && picked.length < count) break;
  }
  return picked;
}

function buildUolItems(bank, username) {
  const items = [];
  for (const level of LEVELS_ORDER) {
    const levelItems = bank.filter(it => it.level === level);
    const chosen = pickUolForLevel(levelItems, UOL_DISTRIBUTION[level]);
    for (const it of chosen) items.push({ ...it, skill: "UoL" });
  }
  return ORDER_BY_LEVEL ? items : shuffle(items);
}

// ---------- Reading / Listening: selección por TEXTO/AUDIO completo ----------
function groupByKey(items, keyFn) {
  const groups = {};
  for (const it of items) {
    const k = keyFn(it);
    (groups[k] = groups[k] || []).push(it);
  }
  return groups;
}

function pickGroups(bank, perLevel) {
  const groups = [];
  for (const level of LEVELS_ORDER) {
    const levelGroups = bank.filter(g => g.level === level);
    const sizes = new Set(levelGroups.map(g => g.questions.length));
    if (sizes.size > 1) console.warn(`Nivel ${level}: los textos/audios no tienen el mismo número de preguntas`, [...sizes]);
    for (const g of shuffle(levelGroups).slice(0, perLevel[level])) groups.push(g);
  }
  return ORDER_BY_LEVEL ? groups : shuffle(groups);
}

function buildReadingGroups(bank) {
  return pickGroups(bank, READING_TEXTS_PER_LEVEL).map(g => ({
    type: "reading", level: g.level, groupId: g.id, title: g.title,
    paragraphs: g.paragraphs, image: g.image,
    questions: g.questions.map(q => ({ ...q, skill: "Reading", level: g.level, category: "Reading" }))
  }));
}

function buildListeningGroups(bank) {
  return pickGroups(bank, LISTENING_AUDIOS_PER_LEVEL).map(g => ({
    type: "listening", level: g.level, groupId: g.id, audioId: g.audio_id, audioTitle: g.title,
    questions: g.questions.map(q => ({ ...q, skill: "Listening", level: g.level, category: "Listening" }))
  }));
}

// ---------- construir el plan completo del examen (3 secciones) ----------
export function buildExamPlan(banks, username) {
  const uolItems = buildUolItems(banks.UoL, username);
  const readingGroups = buildReadingGroups(banks.Reading);
  const listeningGroups = buildListeningGroups(banks.Listening);

  return {
    sections: [
      { name: "UoL", kind: "items", items: uolItems },
      { name: "Reading", kind: "groups", groups: readingGroups },
      { name: "Listening", kind: "groups", groups: listeningGroups }
    ]
  };
}

// Devuelve la lista plana de todos los itemIds del plan (para guardarla en la sesión)
export function allItemIdsFromPlan(plan) {
  const ids = [];
  for (const section of plan.sections) {
    if (section.kind === "items") {
      for (const it of section.items) ids.push(it.id);
    } else {
      for (const g of section.groups) for (const q of g.questions) ids.push(q.id);
    }
  }
  return ids;
}

// ---------- sesiones de examen (grupos) ----------
// La administradora crea una sesión (con horario de apertura y cierre, una contraseña compartida y la lista de
// estudiantes: cédula + nombre). El estudiante entra con su cédula y la contraseña; fuera del horario no hay acceso.
// El id del grupo es el hash de la contraseña (distingue mayúsculas/minúsculas y símbolos): así se encuentra
// la sesión sin listar ni exponer las demás.
async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export const normalizeCedula = (c) => String(c || "").replace(/\D/g, "");
export function groupIdFromPassword(password) {
  return sha256hex("twtest:" + String(password || "").trim());     // sin pasar a minúsculas: distingue mayúsculas
}
export const participantIdOf = (groupId, cedula) => `${groupId}_${cedula}`;
export const tsMs = (v) => (v && typeof v.toMillis === "function") ? v.toMillis() : (v && v.seconds !== undefined ? v.seconds * 1000 : Number(v) || 0);

const fmtDate = (ms) => new Date(ms).toLocaleString("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

export async function loginToGroup({ cedula, password }) {
  const ced = normalizeCedula(cedula);
  if (ced.length < 5) return { ok: false, reason: "Escribe tu número de cédula (solo números)." };
  if (!String(password || "").trim()) return { ok: false, reason: "Escribe la contraseña de la sesión." };

  const groupId = await groupIdFromPassword(password);
  const gSnap = await getDoc(doc(db, "exam_groups", groupId));
  if (!gSnap.exists()) return { ok: false, reason: "Contraseña incorrecta. Revisa mayúsculas, minúsculas y símbolos." };
  const group = gSnap.data();
  const pid = participantIdOf(groupId, ced);
  const pSnap = await getDoc(doc(db, "participants", pid));
  if (!pSnap.exists()) return { ok: false, reason: "Tu cédula no está registrada en esta sesión. Avisa al supervisor." };
  const part = pSnap.data();

  let hasLocal = false;
  try { hasLocal = !!localStorage.getItem(`examState_${pid}`); } catch (e) {}

  // Una reapertura de la administradora (con otra reanudación pendiente de usar) permite continuar desde cualquier equipo.
  const rs = part.resume && part.resume.token && part.resumeConsumed !== part.resume.token ? part.resume : null;

  if (part.status === "completed") return { ok: false, reason: "Esta cédula ya presentó el examen." };
  if (part.status === "closed") return { ok: false, reason: "Tu examen se cerró por una interrupción (se acabó el tiempo, se fue la luz o se cerró la ventana). Avisa al supervisor: él puede reabrirlo." };
  if (part.status === "in_progress") {
    if (!hasLocal && !rs) return { ok: false, reason: "Este examen ya está en curso en otro equipo o navegador. Avisa al supervisor." };
  } else {
    if (hasLocal) { try { localStorage.removeItem(`examState_${pid}`); } catch (e) {} }   // intento anterior descartado por la administradora
    const now = Date.now(), opens = tsMs(group.opensAt), closes = tsMs(group.closesAt);
    if (group.enabled === false) return { ok: false, reason: "Esta sesión está pausada. Espera la indicación del supervisor." };
    if (now < opens - 60000) return { ok: false, reason: `La sesión abre el ${fmtDate(opens)}.` };
    if (closes && now >= closes) return { ok: false, reason: "La sesión de examen ya cerró. Avisa al supervisor." };
  }
  return {
    ok: true, participantId: pid, cedula: ced, name: part.name || "",
    profile: { nombres: part.nombres || "", apellidos: part.apellidos || "", email: part.email || "", nivel: part.nivel || "" },
    resume: rs,
    groupId, groupName: group.name || "", institution: group.institution || ""
  };
}

function randomId(len = 14) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return [...arr].map(n => chars[n % chars.length]).join("");
}

// ---------- crear intento ----------
export async function createSession(ctx, plan) {
  const sessionId = `${ctx.cedula}_${randomId()}`;        // id no adivinable (el resultado se consulta con él)
  const profile = ctx.profile || {};
  await setDoc(doc(db, "sessions", sessionId), {
    username: ctx.cedula, name: ctx.name, email: profile.email || "",
    profile: { ...profile, cedula: ctx.cedula, confirmedAtMs: Date.now() },
    institution: ctx.institution, groupId: ctx.groupId, groupName: ctx.groupName, participantId: ctx.participantId,
    itemIds: allItemIdsFromPlan(plan),
    planJson: JSON.stringify(plan),                      // permite que la administradora reabra el examen en otro equipo
    progress: { sectionIndex: 0, pageIndex: 0, sectionStartTimes: {}, sectionInstructionShown: [false, false, false], audioPlayCounts: {} },
    startedAt: serverTimestamp(),
    lastSavedAt: serverTimestamp(),
    status: "in_progress",
    durationMin: EXAM_DURATION_MIN,
    bankVersion: BANK_VERSION,
    suspiciousEvents: [],
    eventCount: 0,
    resultDelivery: { status: "pending" }
  });
  await updateDoc(doc(db, "participants", ctx.participantId), { status: "in_progress", usedAt: serverTimestamp() });
  return sessionId;
}

// Foto del avance (para poder continuar en otro equipo si se cae el actual). Va dentro de las escrituras que ya se hacen.
const progressPatch = (progress) => progress ? { progress, lastSavedAt: serverTimestamp() } : { lastSavedAt: serverTimestamp() };

export async function saveProgress(sessionId, progress) {
  await updateDoc(doc(db, "sessions", sessionId), progressPatch(progress));
}

// El examen se CIERRA (interrupción): se reenvían todas las respuestas y queda pendiente de que la administradora lo reabra.
export async function closeSession(sessionId, participantId, entries, closure, progress) {
  const patch = { status: "closed", closedAt: serverTimestamp(), closure, ...progressPatch(progress) };
  for (const { item, selected, timeMs } of entries) {
    patch[`responses.${item.id}`] = { skill: item.skill, level: item.level, category: item.category, selected, timeMs };
  }
  await updateDoc(doc(db, "participants", participantId), { status: "closed" });   // primero el participante: así un reintento nunca se atasca
  await updateDoc(doc(db, "sessions", sessionId), patch);
}

// La reanudación ya se aplicó en este equipo: no se puede usar otra vez desde otro equipo.
export async function markResumeConsumed(participantId, token) {
  await updateDoc(doc(db, "participants", participantId), { resumeConsumed: token });
}

// ---------- guardar respuestas (solo la opción elegida, nunca si es correcta) ----------
// Una sola escritura por página (varias preguntas a la vez).
export async function recordAnswers(sessionId, entries, progress) {
  const patch = progressPatch(progress);
  for (const { item, selected, timeMs } of entries) {
    patch[`responses.${item.id}`] = {
      skill: item.skill, level: item.level, category: item.category, selected, timeMs
    };
  }
  await updateDoc(doc(db, "sessions", sessionId), patch);
}

// ---------- registrar evento sospechoso ----------
let eventsSent = 0;
export async function logSuspiciousEvent(sessionId, type, meta = {}) {
  if (eventsSent >= MAX_EVENTS_PER_SESSION) return;
  eventsSent++;
  try {
    await updateDoc(doc(db, "sessions", sessionId), {
      suspiciousEvents: arrayUnion({ type, meta, atClientMs: Date.now() })
    });
  } catch (e) {
    console.warn("No se pudo registrar evento sospechoso:", e);
  }
}

// ---------- registrar cuánto tardó cada persona en cada sección ----------
// timedOut = true si se acabó el tiempo asignado antes de que terminara la sección sola
export async function logSectionTiming(sessionId, sectionName, elapsedSeconds, timedOut) {
  try {
    await updateDoc(doc(db, "sessions", sessionId), {
      [`sectionTimings.${sectionName}`]: { elapsedSeconds, timedOut }
    });
  } catch (e) {
    console.warn("No se pudo registrar el tiempo de sección:", e);
  }
}

// ---------- cerrar la sesión (sin calcular resultado) ----------
// Cierra el intento y reenvía TODAS las respuestas en una sola escritura (así, aunque alguna escritura de página
// se hubiera perdido por falta de internet, el intento queda completo).
export async function finishSession(sessionId, participantId, entries = []) {
  const patch = { status: "completed", completedAt: serverTimestamp() };
  for (const { item, selected, timeMs } of entries) {
    patch[`responses.${item.id}`] = { skill: item.skill, level: item.level, category: item.category, selected, timeMs };
  }
  await updateDoc(doc(db, "sessions", sessionId), patch);
  try { await updateDoc(doc(db, "participants", participantId), { status: "completed" }); } catch (e) { console.warn(e); }
}

// Reintenta una operación de Firestore hasta que se confirme (las escrituras sin internet quedan pendientes y no fallan).
export async function retryUntilDone(fn, { attemptMs = 15000, onWait = () => {} } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), attemptMs))]);
    } catch (e) {
      onWait(i, e);
      await new Promise(r => setTimeout(r, Math.min(2000 * (i + 1), 10000)));
    }
  }
}

// ---------- resultado publicado por el panel de administración ----------
// results/{sessionId}: lo escribe el admin al calificar; el estudiante lo lee con su id (no adivinable).
export function watchResult(sessionId, callback) {
  return onSnapshot(doc(db, "results", sessionId), snap => callback(snap.exists() ? snap.data() : null),
    err => { console.warn(err); callback(null, err); });
}

export async function publishResult(session, r) {
  await setDoc(doc(db, "results", session.id), {
    name: session.name || "", institution: session.institution || "",
    level: r.level, finalScore: r.finalScore, pct: r.pct, points: r.points,
    publishedAt: serverTimestamp()
  });
}

// ============================================================
// SOLO admin.html (sesión autenticada)
// ============================================================
export async function loadAnswerKey() {
  const snap = await getDoc(doc(db, "answer_key", "all"));
  return snap.exists() ? snap.data() : null;
}

export async function uploadAnswerKey(keyObject) {
  await setDoc(doc(db, "answer_key", "all"), keyObject);
}

// Puntaje igual que Moodle: UoL 40 puntos repartidos en partes iguales; cada texto de Reading vale 2.5 y cada
// audio de Listening 5, repartidos en partes iguales entre sus preguntas. Con la estructura
// fija del examen los máximos son UoL 40 / Reading 20 / Listening 40 = 100.
// El denominador sale de las preguntas que le TOCARON (session.itemIds), no solo de las
// contestadas: lo que se quedó sin responder por tiempo cuenta como incorrecto.
export function computeSessionResults(session, answerKey) {
  const LEVELS = ["A1", "A2", "B1", "B2"];
  const SKILLS = ["UoL", "Reading", "Listening"];
  const responses = session.responses || {};
  const ids = (session.itemIds && session.itemIds.length) ? session.itemIds : Object.keys(responses);

  const groupSize = {};
  let uolCount = 0;
  for (const id of ids) {
    const k = answerKey[id];
    if (!k) continue;
    if (k.skill === "UoL") uolCount++;
    else groupSize[pageIdOf(id)] = (groupSize[pageIdOf(id)] || 0) + 1;
  }
  const pointsOf = (id, k) => {
    if (k.skill === "UoL") return UOL_TOTAL_POINTS / uolCount;
    const perPage = k.skill === "Reading" ? READING_POINTS_PER_TEXT : LISTENING_POINTS_PER_AUDIO;
    return perPage / groupSize[pageIdOf(id)];
  };

  const earned = { UoL: 0, Reading: 0, Listening: 0 };
  const max = { UoL: 0, Reading: 0, Listening: 0 };
  const byLevelWithinSkill = {};
  for (const sk of SKILLS) {
    byLevelWithinSkill[sk] = {};
    for (const lv of LEVELS) byLevelWithinSkill[sk][lv] = { c: 0, t: 0 };
  }
  const perItem = {};

  for (const id of ids) {
    const k = answerKey[id];
    if (!k) continue;
    const r = responses[id];
    const answered = !!r;
    const correct = answered && r.selected === k.correct;
    const pts = pointsOf(id, k);
    max[k.skill] += pts;
    if (correct) earned[k.skill] += pts;
    if (answered) {
      byLevelWithinSkill[k.skill][k.level].t += 1;
      if (correct) byLevelWithinSkill[k.skill][k.level].c += 1;
      perItem[id] = { correct, skill: k.skill, level: k.level, category: k.category, timeMs: r.timeMs };
    }
  }

  const pct = {};
  for (const sk of SKILLS) pct[sk] = max[sk] > 0 ? Math.round((earned[sk] / max[sk]) * 1000) / 10 : 0;

  const levelBreakdown = {};
  for (const sk of SKILLS) {
    levelBreakdown[sk] = {};
    for (const lv of LEVELS) {
      const { c, t } = byLevelWithinSkill[sk][lv];
      levelBreakdown[sk][lv] = t > 0 ? Math.round((c / t) * 1000) / 10 : null;
    }
  }

  // bandera de patrón inconsistente: un nivel "más difícil" con acierto muy por ENCIMA de uno
  // "más fácil" en la misma destreza (posible ítem mal calibrado o respuestas al azar).
  const MIN_ITEMS_FOR_FLAG = 2;
  const INVERSION_THRESHOLD_PP = 40;
  const patternAlerts = [];
  for (const sk of SKILLS) {
    for (let i = 0; i < LEVELS.length; i++) {
      for (let j = i + 1; j < LEVELS.length; j++) {
        const lower = byLevelWithinSkill[sk][LEVELS[i]];
        const higher = byLevelWithinSkill[sk][LEVELS[j]];
        if (lower.t >= MIN_ITEMS_FOR_FLAG && higher.t >= MIN_ITEMS_FOR_FLAG) {
          const lowerPct = (lower.c / lower.t) * 100;
          const higherPct = (higher.c / higher.t) * 100;
          if (higherPct - lowerPct >= INVERSION_THRESHOLD_PP) {
            patternAlerts.push({
              skill: sk, lowerLevel: LEVELS[i], higherLevel: LEVELS[j],
              lowerPct: Math.round(lowerPct), higherPct: Math.round(higherPct)
            });
          }
        }
      }
    }
  }

  const finalScore = pct.UoL * WEIGHTS.UoL + pct.Reading * WEIGHTS.Reading + pct.Listening * WEIGHTS.Listening;
  const finalScoreRounded = Math.round(finalScore * 10) / 10;
  const level = scoreToLevel(finalScoreRounded);
  const alerts = SKILLS.filter(sk => pct[sk] < ALERT_THRESHOLD);
  const points = {};
  for (const sk of SKILLS) points[sk] = { earned: Math.round(earned[sk] * 100) / 100, max: Math.round(max[sk] * 100) / 100 };

  return { pct, points, finalScore: finalScoreRounded, level, alerts, perItem, levelBreakdown, patternAlerts };
}

export function generateRandomPassword(length = 8) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < length; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

// ---------- marcar cómo quedó la entrega del resultado ----------
export async function setResultDelivery(sessionId, status, extra = {}) {
  await updateDoc(doc(db, "sessions", sessionId), {
    resultDelivery: { status, ...extra, updatedAt: serverTimestamp() }
  });
}
