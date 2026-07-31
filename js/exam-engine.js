import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  UOL_DISTRIBUTION, READING_TEXTS_PER_LEVEL, LISTENING_AUDIOS_PER_LEVEL,
  LEVELS_ORDER, WEIGHTS, ALERT_THRESHOLD, EXAM_DURATION_MIN, scoreToLevel
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

export async function loadAllBanks() {
  const [uol, reading, listening] = await Promise.all([
    loadBank("data/uol_bank.json"),
    loadBank("data/reading_bank.json"),
    loadBank("data/listening_bank.json")
  ]);
  return { UoL: uol, Reading: reading, Listening: listening };
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
  return shuffle(items);
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

function buildReadingGroups(bank) {
  const groups = [];
  for (const level of LEVELS_ORDER) {
    const levelItems = bank.filter(it => it.level === level);
    const byTitle = groupByKey(levelItems, it => it.text_title);
    const titles = shuffle(Object.keys(byTitle));
    const chosenTitles = titles.slice(0, READING_TEXTS_PER_LEVEL[level]);
    for (const title of chosenTitles) {
      const qs = byTitle[title];
      groups.push({
        type: "reading",
        level,
        title,
        context: qs[0].context,
        questions: qs.map(q => ({ ...q, skill: "Reading" }))
      });
    }
  }
  return shuffle(groups);
}

function buildListeningGroups(bank) {
  const groups = [];
  for (const level of LEVELS_ORDER) {
    const levelItems = bank.filter(it => it.level === level);
    const byAudio = groupByKey(levelItems, it => it.audio_id);
    const audioIds = shuffle(Object.keys(byAudio));
    const chosenIds = audioIds.slice(0, LISTENING_AUDIOS_PER_LEVEL[level]);
    for (const audioId of chosenIds) {
      const qs = byAudio[audioId];
      groups.push({
        type: "listening",
        level,
        audioId,
        audioTitle: qs[0].audio_title,
        questions: qs.map(q => ({ ...q, skill: "Listening" }))
      });
    }
  }
  return shuffle(groups);
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
  return { ok: true, name: data.name || "" };
}

// ---------- crear sesión ----------
export async function createSession(username, name, plan) {
  const sessionId = `${username}_${Date.now()}`;
  const ref = doc(db, "sessions", sessionId);
  await setDoc(ref, {
    username, name,
    itemIds: allItemIdsFromPlan(plan),
    startedAt: serverTimestamp(),
    status: "in_progress",
    durationMin: EXAM_DURATION_MIN,
    suspiciousEvents: []
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

export function computeSessionResults(session, answerKey) {
  const bySkill = { UoL: { correct: 0, total: 0 }, Reading: { correct: 0, total: 0 }, Listening: { correct: 0, total: 0 } };
  const perItem = {};

  for (const [itemId, r] of Object.entries(session.responses || {})) {
    const key = answerKey[itemId];
    if (!key) continue;
    const correct = r.selected === key.correct;
    bySkill[r.skill].total += 1;
    if (correct) bySkill[r.skill].correct += 1;
    perItem[itemId] = { correct, skill: r.skill, level: r.level, category: r.category, timeMs: r.timeMs };
  }

  const pct = {};
  for (const skill of Object.keys(bySkill)) {
    const { correct, total } = bySkill[skill];
    pct[skill] = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  }

  const finalScore = pct.UoL * WEIGHTS.UoL + pct.Reading * WEIGHTS.Reading + pct.Listening * WEIGHTS.Listening;
  const finalScoreRounded = Math.round(finalScore * 10) / 10;
  const level = scoreToLevel(finalScoreRounded);
  const alerts = Object.keys(pct).filter(skill => pct[skill] < ALERT_THRESHOLD);

  return { pct, finalScore: finalScoreRounded, level, alerts, perItem };
}

export function generateRandomPassword(length = 8) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < length; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}
