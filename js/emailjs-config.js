// ============================================================
// CONFIGURACIÓN DE EMAILJS
// Sirve para enviar el correo de resultado automáticamente cuando
// alguien termina el piloto sin ninguna alerta.
//
// CÓMO OBTENER ESTOS 3 VALORES (una sola vez, ~10 min):
//   1. Ve a https://www.emailjs.com y crea una cuenta gratis
//   2. "Email Services" → "Add New Service" → Gmail →
//      conecta examenes.cartagena@tweetalig.edu.co
//      → copia el "Service ID" que te da
//   3. "Email Templates" → "Create New Template" → escribe el
//      cuerpo del correo usando estas variables entre llaves dobles:
//        {{to_email}}  {{to_name}}  {{level}}
//        {{pct_uol}}  {{pct_reading}}  {{pct_listening}}
//      → copia el "Template ID"
//   4. "Account" → "General" → copia tu "Public Key"
// ============================================================

export const EMAILJS_SERVICE_ID = "REEMPLAZA_SERVICE_ID";
export const EMAILJS_TEMPLATE_ID = "REEMPLAZA_TEMPLATE_ID";
export const EMAILJS_PUBLIC_KEY = "REEMPLAZA_PUBLIC_KEY";

// Cámbialo a true una vez hayas completado los 3 valores de arriba.
// Mientras esté en false, el dashboard NO intenta enviar correos
// (evita errores mientras terminas de configurar EmailJS).
export const EMAILJS_ENABLED = false;
