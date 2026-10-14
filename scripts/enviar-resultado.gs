/**
 * ENVÍO DEL RESULTADO AL CORREO DEL ESTUDIANTE (Google Apps Script)
 *
 * Cómo publicarlo (5 minutos):
 *  1. script.google.com → Nuevo proyecto → pega todo este archivo → Guardar.
 *  2. Implementar → Nueva implementación → tipo "Aplicación web".
 *       Ejecutar como: Yo      ·      Quién tiene acceso: Cualquier persona
 *     Autoriza los permisos cuando los pida (enviar correo y conectarse a un servicio externo).
 *  3. Copia la URL que termina en /exec y pégala en js/exam-config.js:
 *       export const RESULTS_EMAIL_ENDPOINT = "https://script.google.com/macros/s/.../exec";
 *  4. Sube el cambio (git add, commit, push) y publica con: firebase deploy --only hosting
 *
 * Seguridad: el correo se arma AQUÍ con los datos reales de results/{id} (nadie puede mandar texto propio),
 * solo se puede pedir un resultado que exista, y cada resultado se envía máximo 3 veces.
 * Cuota: cuenta Gmail normal = 100 correos al día; Google Workspace = 1500 al día.
 */

const PROJECT_ID = "tweetalig-piloto";
const FROM_NAME = "Tweetalig Centro de Idiomas";
const MAX_SENDS_PER_RESULT = 3;
const ALLOWED_URL_PREFIXES = ["https://tweetaligtest.web.app/", "https://processadigitalstudio.github.io/twtest/"];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const id = String(body.id || "").trim();
    const email = String(body.email || "").trim();
    if (!/^[A-Za-z0-9_\-]{6,80}$/.test(id)) return out({ ok: false, error: "id" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out({ ok: false, error: "email" });

    const props = PropertiesService.getScriptProperties();
    const key = "sent_" + id;
    const sent = Number(props.getProperty(key) || 0);
    if (sent >= MAX_SENDS_PER_RESULT) return out({ ok: false, error: "limit" });

    const r = readResult(id);
    if (!r) return out({ ok: false, error: "not_found" });

    const url = ALLOWED_URL_PREFIXES.some(p => String(body.url || "").indexOf(p) === 0)
      ? String(body.url) : ALLOWED_URL_PREFIXES[0] + "results.html?s=" + encodeURIComponent(id);

    MailApp.sendEmail({
      to: email,
      subject: "Tu resultado - Examen diagnóstico de inglés (" + r.level + ")",
      htmlBody: buildHtml(r, url),
      name: FROM_NAME
    });
    props.setProperty(key, String(sent + 1));
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() { return out({ ok: true, service: "enviar-resultado" }); }

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Lee results/{id} con la API REST de Firestore (la regla permite leer ese documento por su id)
function readResult(id) {
  const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/results/" + encodeURIComponent(id);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  const f = JSON.parse(res.getContentText()).fields || {};
  const num = (v) => v ? Number(v.doubleValue !== undefined ? v.doubleValue : (v.integerValue || 0)) : 0;
  const pts = (k) => { const m = (((f.points || {}).mapValue || {}).fields || {})[k]; const mf = m && m.mapValue ? m.mapValue.fields : {}; return { earned: num(mf.earned), max: num(mf.max) }; };
  return {
    name: f.name ? f.name.stringValue : "",
    level: f.level ? f.level.stringValue : "",
    finalScore: num(f.finalScore),
    points: { UoL: pts("UoL"), Reading: pts("Reading"), Listening: pts("Listening") }
  };
}

const ROUTE_TEXT = {
  B2: "Tu nivel ya está listo para certificarse: lo recomendado es ir directo al examen de certificación.",
  B1: "Estás muy cerca de certificarte: puedes presentar el examen de certificación o prepararte antes con el curso preparatorio.",
  A2: "Te recomendamos fortalecer tu inglés primero con el curso intensivo, empezando en tu nivel.",
  A1: "Te recomendamos fortalecer tu inglés primero con el curso intensivo, empezando en tu nivel."
};

function buildHtml(r, url) {
  const label = { UoL: "Language Use", Reading: "Reading Comprehension", Listening: "Listening Comprehension" };
  const rows = ["UoL", "Reading", "Listening"].map(k =>
    "<tr><td style='padding:6px 12px 6px 0'>" + label[k] + "</td><td style='padding:6px 0'><b>" + r.points[k].earned.toFixed(1) + " / " + r.points[k].max.toFixed(0) + "</b></td></tr>").join("");
  return "<div style='font-family:Arial,Helvetica,sans-serif;color:#2C3D4D;max-width:560px'>" +
    "<h2 style='color:#2A7F68;margin:0 0 4px'>Tu resultado</h2>" +
    (r.name ? "<p style='margin:0 0 12px'>" + esc(r.name) + "</p>" : "") +
    "<p style='font-size:38px;margin:6px 0'><b>" + esc(r.level) + "</b></p>" +
    "<p style='margin:0 0 12px'>Puntaje total: <b>" + r.finalScore.toFixed(1) + " / 100</b></p>" +
    "<table style='border-collapse:collapse'>" + rows + "</table>" +
    "<p style='margin:16px 0'>" + (ROUTE_TEXT[r.level] || "") + "</p>" +
    "<p><a href='" + esc(url) + "' style='background:#2A7F68;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold'>Ver mi resultado completo y mi ruta</a></p>" +
    "<p style='color:#52616F;font-size:13px'>Este resultado es válido para el periodo académico 2026-2.</p></div>";
}

function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;"); }
