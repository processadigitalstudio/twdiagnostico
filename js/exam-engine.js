import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  UOL_DISTRIBUTION, READING_TEXTS_PER_LEVEL, LISTENING_AUDIOS_PER_LEVEL,
  LEVELS_ORDER, ORDER_BY_LEVEL, WEIGHTS, ALERT_THRESHOLD, EXAM_DURATION_MIN, scoreToLevel,
  BANK_VERSION, UOL_POINTS, READING_POINTS_PER_TEXT, LISTENING_POINTS_PER_AUDIO
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

// ---------- validar usuario / contraseña ----------
export async function validateLogin(username, password) {
  const uname = username.trim();
  const ref = doc(db, "access_codes", uname);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, reason: "Usuario no encontrado. Revisa mayúsculas/minúsculas." };
  const data = snap.data();
  if (data.password !== password.trim()) return { ok: false, reason: "Contraseña incorrecta." };
  if (data.status === "completed") return { ok: false, reason: "Este usuario ya completó el examen." };
  return { ok: true, name: data.name || "", email: data.email || "" };
}

// ---------- crear sesión ----------
export async function createSession(username, name, email, plan) {
  const sessionId = `${username}_${Date.now()}`;
  const ref = doc(db, "sessions", sessionId);
  await setDoc(ref, {
    username, name, email,
    itemIds: allItemIdsFromPlan(plan),
    startedAt: serverTimestamp(),
    status: "in_progress",
    durationMin: EXAM_DURATION_MIN,
    bankVersion: BANK_VERSION,
    suspiciousEvents: [],
    resultDelivery: { status: "pending" }
  });
  await updateDoc(doc(db, "access_codes", username), { status: "in_progress", usedAt: serverTimestamp() });
  return sessionId;
}

// ---------- guardar una respuesta (solo la opción elegida, nunca si es correcta) ----------
export async function recordAnswer(sessionId, item, selectedIndex, timeMs) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    [`responses.${item.id}`]: {
      skill: item.skill, level: item.level, category: item.category,
      selected: selectedIndex, timeMs
    }
  });
}

// ---------- registrar evento sospechoso ----------
export async function logSuspiciousEvent(sessionId, type, meta = {}) {
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
export async function finishSession(sessionId) {
  await updateDoc(doc(db, "sessions", sessionId), { status: "completed", completedAt: serverTimestamp() });
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

// Puntaje igual que Moodle: UoL 2 pts por ítem (B2: 3); cada texto de Reading vale 2.5 y cada
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
  for (const id of ids) {
    const k = answerKey[id];
    if (k && k.skill !== "UoL") groupSize[pageIdOf(id)] = (groupSize[pageIdOf(id)] || 0) + 1;
  }
  const pointsOf = (id, k) => {
    if (k.skill === "UoL") return UOL_POINTS[k.level];
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
