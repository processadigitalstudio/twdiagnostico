import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  N_PER_SKILL, LEVEL_DISTRIBUTION, LEVELS_ORDER, WEIGHTS,
  ALERT_THRESHOLD, EXAM_DURATION_MIN, scoreToLevel
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

// 4 patrones de rotación para no sesgar siempre el mismo nivel con el "extra"
function getLevelDistributionFor(accessCode) {
  const patterns = [
    { A1: 5, A2: 5, B1: 4, B2: 4 },
    { A2: 5, B1: 5, A1: 4, B2: 4 },
    { B1: 5, B2: 5, A1: 4, A2: 4 },
    { B2: 5, A1: 5, A2: 4, B1: 4 }
  ];
  const idx = simpleHash(accessCode) % patterns.length;
  return patterns[idx];
}

// Selección estratificada: dentro de cada nivel, reparte lo más parejo
// posible entre las categorías presentes (round-robin), para que Moodle-like
// aleatoriedad no favorezca siempre la misma subcategoría.
function pickForLevel(bankLevelItems, count) {
  const byCategory = {};
  for (const it of bankLevelItems) {
    (byCategory[it.category] = byCategory[it.category] || []).push(it);
  }
  const cats = Object.keys(byCategory);
  for (const c of cats) byCategory[c] = shuffle(byCategory[c]);

  const picked = [];
  let ci = 0;
  while (picked.length < count) {
    const cat = cats[ci % cats.length];
    const pool = byCategory[cat];
    if (pool.length > 0) picked.push(pool.pop());
    ci++;
    // salvaguarda: si ya no hay items en ninguna categoría, corta el loop
    if (cats.every(c => byCategory[c].length === 0) && picked.length < count) break;
  }
  return picked;
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

// ---------- construir la sesión de examen ----------
export function buildExamItems(banks, accessCode) {
  const distribution = getLevelDistributionFor(accessCode);
  const skills = ["UoL", "Reading", "Listening"];
  const finalItems = [];

  for (const skill of skills) {
    const bank = banks[skill];
    for (const level of LEVELS_ORDER) {
      const levelItems = bank.filter(it => it.level === level);
      const count = distribution[level];
      const chosen = pickForLevel(levelItems, count);
      for (const it of chosen) finalItems.push({ ...it, skill });
    }
  }

  // Se agrupan por destreza (UoL → Reading → Listening) pero el orden
  // interno de cada bloque se mezcla, para que no siempre A1 salga primero.
  const bySkill = { UoL: [], Reading: [], Listening: [] };
  for (const it of finalItems) bySkill[it.skill].push(it);
  const ordered = [
    ...shuffle(bySkill.UoL),
    ...shuffle(bySkill.Reading),
    ...shuffle(bySkill.Listening)
  ];
  return ordered;
}

// ---------- validar código de acceso ----------
export async function validateAccessCode(code) {
  const ref = doc(db, "access_codes", code.trim().toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { ok: false, reason: "Código no encontrado. Revisa mayúsculas/minúsculas." };
  }
  const data = snap.data();
  if (data.usedAt && data.status === "completed") {
    return { ok: false, reason: "Este código ya completó el examen." };
  }
  return { ok: true, name: data.name || "" };
}

// ---------- crear sesión ----------
export async function createSession(accessCode, name, items) {
  const sessionId = `${accessCode}_${Date.now()}`;
  const ref = doc(db, "sessions", sessionId);
  await setDoc(ref, {
    accessCode,
    name,
    itemIds: items.map(i => i.id),
    startedAt: serverTimestamp(),
    status: "in_progress",
    durationMin: EXAM_DURATION_MIN
  });
  await updateDoc(doc(db, "access_codes", accessCode), {
    status: "in_progress",
    usedAt: serverTimestamp()
  });
  return sessionId;
}

// ---------- guardar una respuesta (incremental, resiliente a cierres de pestaña) ----------
export async function recordAnswer(sessionId, item, selectedIndex, timeMs) {
  const correct = selectedIndex === item.correct;
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    [`responses.${item.id}`]: {
      skill: item.skill,
      level: item.level,
      category: item.category,
      selected: selectedIndex,
      correct,
      timeMs
    }
  });
  return correct;
}

// ---------- calcular resultado final ----------
export function computeResults(items, responsesMap) {
  const bySkill = { UoL: { correct: 0, total: 0 }, Reading: { correct: 0, total: 0 }, Listening: { correct: 0, total: 0 } };

  for (const it of items) {
    const r = responsesMap[it.id];
    bySkill[it.skill].total += 1;
    if (r && r.correct) bySkill[it.skill].correct += 1;
  }

  const pct = {};
  for (const skill of Object.keys(bySkill)) {
    const { correct, total } = bySkill[skill];
    pct[skill] = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  }

  const finalScore =
    pct.UoL * WEIGHTS.UoL + pct.Reading * WEIGHTS.Reading + pct.Listening * WEIGHTS.Listening;
  const finalScoreRounded = Math.round(finalScore * 10) / 10;
  const level = scoreToLevel(finalScoreRounded);

  const alerts = Object.keys(pct).filter(skill => pct[skill] < ALERT_THRESHOLD);

  return { bySkill, pct, finalScore: finalScoreRounded, level, alerts };
}

// ---------- cerrar la sesión con el resultado final ----------
export async function finishSession(sessionId, results) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    status: "completed",
    completedAt: serverTimestamp(),
    pct: results.pct,
    finalScore: results.finalScore,
    level: results.level,
    alerts: results.alerts
  });
}
