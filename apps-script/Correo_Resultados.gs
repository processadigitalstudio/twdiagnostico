/**
 * Envío de resultados del examen de ubicación (Tweetalig) — Google Apps Script
 *
 * INSTALACIÓN (con la cuenta Examenes.cartagena@tweetalig.edu.co):
 *  1. script.google.com → Nuevo proyecto → pega todo este archivo → guarda (nombre: "Correo resultados examen").
 *  2. Ícono ⚙ "Configuración del proyecto" → "Propiedades de la secuencia de comandos" → Agregar propiedad:
 *        MAIL_TOKEN  =  (una clave larga que inventes, ej. 24 letras y números)
 *  3. Implementar → Nueva implementación → tipo "Aplicación web":
 *        Ejecutar como: Yo (Examenes.cartagena@...)
 *        Quién tiene acceso: Cualquier persona
 *     Autoriza los permisos (enviar correo) y copia la URL que termina en /exec.
 *  4. En el panel admin: botón "⚙ Correo" → pega la URL y la MAIL_TOKEN.
 *
 * Si cambias este código, usa Implementar → Administrar implementaciones → editar → "Nueva versión".
 */
var FROM_NAME = 'Centro de Idiomas Tweetalig';
var LOGO_URL = 'https://tweetaligtest.web.app/img/brand/tweetalig-logo.png';
var REPLY_TO = 'info.eam@tweetalig.edu.co';
var ALLOWED_LINK_PREFIX = 'https://tweetaligtest.web.app/';
var MAX_PER_CALL = 40;

var LEVEL_TEXT = {
  A1: 'Nivel inicial: ya puedes comprender y usar expresiones cotidianas muy básicas.',
  A2: 'Nivel elemental: te comunicas en situaciones sencillas y cotidianas.',
  B1: 'Nivel intermedio: te desenvuelves en la mayoría de situaciones y puedes expresar tus ideas con claridad.',
  B2: 'Nivel intermedio alto: te comunicas con fluidez y espontaneidad en temas variados.'
};
var LEVEL_COLOR = { A1: '#7FB241', A2: '#E6A93A', B1: '#3E8FB0', B2: '#2C3D4D' };

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function doGet() { return json_({ ok: true, service: 'resultados-tweetalig' }); }

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('MAIL_TOKEN');
    if (!token || body.token !== token) return json_({ ok: false, error: 'Clave incorrecta.' });
    var msgs = body.messages || [];
    if (!msgs.length) return json_({ ok: false, error: 'No hay mensajes.' });
    if (msgs.length > MAX_PER_CALL) return json_({ ok: false, error: 'Máximo ' + MAX_PER_CALL + ' correos por solicitud.' });
    if (MailApp.getRemainingDailyQuota() < msgs.length) {
      return json_({ ok: false, error: 'Cupo diario de correos insuficiente (quedan ' + MailApp.getRemainingDailyQuota() + ').' });
    }
    var cache = CacheService.getScriptCache();
    var results = msgs.map(function (m) {
      try {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.to || '')) throw new Error('Correo inválido');
        if (!LEVEL_TEXT[m.level]) throw new Error('Nivel inválido');
        if (String(m.link || '').indexOf(ALLOWED_LINK_PREFIX) !== 0) throw new Error('Enlace no permitido');
        var key = 'sent_' + m.id;
        if (!m.force && cache.get(key)) return { id: m.id, ok: true, duplicate: true };
        sendOne_(m);
        cache.put(key, '1', 21600);                       // evita duplicados por reintentos (6 h)
        return { id: m.id, ok: true };
      } catch (err) {
        return { id: m.id, ok: false, error: String(err && err.message || err) };
      }
    });
    return json_({ ok: true, results: results });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function sendOne_(m) {
  var c = LEVEL_COLOR[m.level];
  var p = m.pct || {};
  var skills = [['Language Use', p.UoL], ['Reading Comprehension', p.Reading], ['Listening Comprehension', p.Listening]]
    .map(function (r) {
      var v = Math.max(0, Math.min(100, Math.round(Number(r[1]) || 0)));
      return '<tr><td style="padding:6px 0;font-size:14px;color:#2C3D4D;">' + r[0] + '</td><td style="padding:6px 0;font-size:14px;color:#2C3D4D;text-align:right;"><b>' + v + '%</b></td></tr>';
    }).join('');
  var first = String(m.name || '').split(' ')[0];
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#2C3D4D;">' +
    '<div style="background:#2C3D4D;padding:16px 22px;border-radius:12px 12px 0 0;border-bottom:4px solid #5DB69C;">' +
    '<table role="presentation" style="border-collapse:collapse;"><tr>' +
    '<td style="padding:0 14px 0 0;"><span style="display:inline-block;background:#fff;border-radius:8px;padding:5px 10px;line-height:0;"><img src="' + LOGO_URL + '" alt="Tweetalig" width="110" style="display:block;border:0;height:auto;width:110px;"></span></td>' +
    '<td style="color:#fff;font-size:17px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">Centro de Idiomas Tweetalig</td>' +
    '</tr></table></div>' +
    '<div style="border:1px solid #DAD6CC;border-top:0;border-radius:0 0 12px 12px;padding:24px 22px;background:#fff;">' +
    '<p style="font-size:16px;margin:0 0 14px;">Hola, <b>' + esc_(first) + '</b>:</p>' +
    '<p style="font-size:15px;line-height:1.5;margin:0 0 18px;">Ya está listo el resultado de tu examen de ubicación (diagnóstico) de inglés.</p>' +
    '<div style="background:#F7F4EC;border-left:6px solid ' + c + ';border-radius:8px;padding:16px 18px;margin:0 0 18px;">' +
    '<div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#52616F;">Tu nivel</div>' +
    '<div style="font-size:40px;font-weight:bold;color:' + c + ';line-height:1.1;">' + esc_(m.level) + '</div>' +
    '<div style="font-size:14px;line-height:1.45;margin-top:6px;">' + LEVEL_TEXT[m.level] + '</div>' +
    '<div style="font-size:13px;color:#52616F;margin-top:8px;">Puntaje final: <b>' + esc_(Math.round(Number(m.score) || 0)) + ' / 100</b></div></div>' +
    '<table style="width:100%;border-collapse:collapse;border-top:1px solid #DAD6CC;margin:0 0 20px;">' + skills + '</table>' +
    '<p style="font-size:15px;line-height:1.5;margin:0 0 16px;">En el siguiente enlace puedes ver tu resultado completo y <b>tu ruta recomendada</b> (cursos, fechas e inscripción):</p>' +
    '<p style="margin:0 0 20px;"><a href="' + esc_(m.link) + '" style="background:#2C3D4D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block;">Ver mi resultado y mi ruta</a></p>' +
    '<p style="font-size:12.5px;color:#52616F;line-height:1.5;margin:0;">Resultado válido para el periodo académico 2026-2. ¿Dudas? Escríbenos a ' + REPLY_TO + '.</p>' +
    '</div></div>';
  var text = 'Hola, ' + first + ':\n\nTu nivel de inglés es ' + m.level + ' (puntaje final ' + Math.round(Number(m.score) || 0) + '/100).\n' +
    'Mira tu resultado completo y tu ruta recomendada aquí: ' + m.link + '\n\nResultado válido para el periodo académico 2026-2.\nCentro de Idiomas Tweetalig — ' + REPLY_TO;
  MailApp.sendEmail({
    to: m.to,
    subject: 'Tu resultado del examen de ubicación de inglés — Tweetalig',
    body: text, htmlBody: html, name: FROM_NAME, replyTo: REPLY_TO
  });
}
