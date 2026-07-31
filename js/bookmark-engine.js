import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, getDocs, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- login del juez ----------
export async function validateJudgeLogin(username, password) {
  const uname = username.trim();
  const ref = doc(db, "judge_codes", uname);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, reason: "Usuario no encontrado." };
  const data = snap.data();
  if (data.password !== password.trim()) return { ok: false, reason: "Contraseña incorrecta." };
  return { ok: true, name: data.name || "", status: data.status || "not_started" };
}

// ---------- cargar el orden de ítems (ya generado por la administradora) ----------
export async function loadBookmarkOrder() {
  const snap = await getDoc(doc(db, "bookmark_order", "current"));
  return snap.exists() ? snap.data().items : null;
}

// ---------- enviar la calificación de una ronda ----------
export async function submitBookmarkJudgment(username, name, round, boundaries) {
  const id = `${username}_round${round}`;
  await setDoc(doc(db, "bookmark_judgments", id), {
    username, name, round, boundaries,
    submittedAt: serverTimestamp()
  });
  const newStatus = round === 1 ? "round1_done" : "round2_done";
  await updateDoc(doc(db, "judge_codes", username), { status: newStatus });
}

// ============================================================
// SOLO admin.html (autenticada)
// ============================================================

// Genera el orden de los 560 ítems por dificultad real (p-value del piloto)
// y lo guarda en Firestore para que los jueces lo usen.
export function buildBookmarkOrder(allSessions, answerKey, banks) {
  const allItemsById = {};
  for (const skill of Object.keys(banks)) for (const it of banks[skill]) allItemsById[it.id] = it;

  const stats = {}; // itemId -> {correct, total}
  for (const s of allSessions) {
    for (const [itemId, r] of Object.entries(s.responses || {})) {
      const key = answerKey[itemId];
      if (!key) continue;
      const correct = r.selected === key.correct;
      if (!stats[itemId]) stats[itemId] = { correct: 0, total: 0 };
      stats[itemId].total += 1;
      if (correct) stats[itemId].correct += 1;
    }
  }

  const items = [];
  for (const [itemId, full] of Object.entries(allItemsById)) {
    const st = stats[itemId];
    const p = st && st.total > 0 ? st.correct / st.total : null; // null = sin datos del piloto todavía
    items.push({
      id: itemId,
      skill: full.skill,
      level: full.level, // se guarda para el análisis, no se muestra prominente al juez
      category: full.category,
      context: full.context || null,
      stem: full.stem,
      options: full.options,
      audio_id: full.audio_id || null,
      audio_title: full.audio_title || null,
      p,
      n: st ? st.total : 0
    });
  }

  // más fácil (p alto) primero, sin datos al final
  items.sort((a, b) => {
    if (a.p === null && b.p === null) return 0;
    if (a.p === null) return 1;
    if (b.p === null) return -1;
    return b.p - a.p;
  });

  return items;
}

export async function saveBookmarkOrder(items) {
  await setDoc(doc(db, "bookmark_order", "current"), {
    items,
    generatedAt: serverTimestamp(),
    totalItems: items.length
  });
}

export async function loadAllJudgments() {
  const snap = await getDocs(collection(db, "bookmark_judgments"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function loadAllJudgeCodes() {
  const snap = await getDocs(collection(db, "judge_codes"));
  return snap.docs.map(d => ({ username: d.id, ...d.data() }));
}
