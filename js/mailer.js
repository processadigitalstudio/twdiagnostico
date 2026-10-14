// Envío de resultados por correo desde el panel de administración.
// El correo lo envía un Apps Script (apps-script/Correo_Resultados.gs) desplegado con la cuenta
// Examenes.cartagena@tweetalig.edu.co. La URL y la clave del script NO están en el repositorio:
// la administradora las pega una vez en el panel y quedan guardadas solo en ese navegador.
const LS_KEY = "twMailer";

export function getMailer() {
  try {
    const m = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    return m && m.url && m.token ? m : null;
  } catch (e) { return null; }
}
export function setMailer(url, token) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ url: String(url).trim(), token: String(token).trim() })); } catch (e) {}
}
export function clearMailer() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// messages: [{ id, to, name, level, score, pct:{UoL,Reading,Listening}, link, institution, force }]
// Devuelve [{ id, ok, error? }] en el mismo orden.
export async function sendResultEmails(messages) {
  const m = getMailer();
  if (!m) throw new Error("Falta configurar el envío de correos (URL y clave).");
  let res;
  try {
    res = await fetch(m.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },     // petición "simple": sin preflight CORS
      body: JSON.stringify({ token: m.token, messages })
    });
  } catch (e) {
    throw new Error("No se pudo contactar el servicio de correo. Revisa la URL y tu conexión.");
  }
  let data;
  try { data = await res.json(); } catch (e) { throw new Error("Respuesta inesperada del servicio de correo (¿URL de la implementación correcta?)."); }
  if (!data || data.ok !== true) throw new Error((data && data.error) || "El servicio de correo rechazó la solicitud.");
  return data.results || [];
}
