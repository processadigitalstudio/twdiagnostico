// ============================================================
// RUTA después del resultado: qué opciones tiene el estudiante según su nivel.
// Aquí están TODAS las fechas, precios y textos. Para cambiarlos edita solo este archivo.
// ============================================================

export const ROUTE_STEPS = [
  { id: "formacion", name: "Formación previa", sub: "Curso intensivo" },
  { id: "preparacion", name: "Preparación", sub: "Curso preparatorio" },
  { id: "certificacion", name: "Certificación", sub: "Examen" }
];

// Qué se recomienda según el nivel obtenido (en orden de importancia)
//   recommended: tarjetas que se muestran abiertas · others: tarjetas que quedan en "Ver otras opciones"
export const ROUTE_BY_LEVEL = {
  B2: {
    headline: "Tu nivel ya está listo para certificarse",
    text: "Lo recomendado es ir directo al examen de certificación, que certifica el nivel que obtuviste.",
    recommended: ["certificacion"], others: ["preparacion", "formacion"], entry: "certificacion"
  },
  B1: {
    headline: "Estás muy cerca de certificarte",
    text: "Puedes presentar el examen de certificación, o prepararte antes con el curso preparatorio para llegar más seguro.",
    recommended: ["certificacion", "preparacion"], others: ["formacion"], entry: ["preparacion", "certificacion"]
  },
  A2: {
    headline: "Te recomendamos fortalecer tu inglés primero",
    text: "Lo recomendado es el curso intensivo, empezando en tu nivel. Después podrás prepararte y certificarte.",
    recommended: ["formacion"], others: ["preparacion", "certificacion"], entry: "formacion"
  },
  A1: {
    headline: "Te recomendamos fortalecer tu inglés primero",
    text: "Lo recomendado es el curso intensivo, empezando en tu nivel. Después podrás prepararte y certificarte.",
    recommended: ["formacion"], others: ["preparacion", "certificacion"], entry: "formacion"
  }
};

// Fechas del examen de certificación: la facturación EAM 2026-2 tiene fechas propias; el resto usa las generales.
const CERT_DATES = {
  eam: [
    ["Inscripciones y pagos", "6 al 21 de octubre"],
    ["Aplicación del examen", "26, 27 y 28 de octubre"],
    ["Resultados y certificaciones", "30 de octubre de 2026, por correo electrónico"]
  ],
  general: [
    ["Inscripciones y pagos", "1 al 19 de noviembre"],
    ["Aplicación del examen", "4 de diciembre"]
  ]
};

// Correo para dudas y facilidades de pago
export const CONTACT_EMAIL = "info.eam@tweetalig.edu.co";

export const INTENSIVE_PRICES = [
  ["A1", "$958.725"], ["A2", "$958.725"], ["B1.1", "$861.600"], ["B1.2", "$1.045.125"], ["B2", "$1.045.125"]
];

export function routeCards(level, institutionSlug) {
  const certDates = CERT_DATES[institutionSlug] || CERT_DATES.general;
  return {
    certificacion: {
      step: "Directo a certificarte",
      title: "Examen de certificación",
      what: "Prueba estandarizada con sello de acreditación internacional. Certifica el nivel que obtuviste.",
      facts: ["3 habilidades: Listening, Reading y Language Use", "Duración: 2 horas", "En línea, con supervisión remota (proctoring)"],
      price: [["Valor del examen", "$228.560"]],
      dates: certDates
    },
    preparacion: {
      step: "Preparación",
      title: "Curso preparatorio",
      what: "Te ayuda a conocer las características del examen y a responder mejor las preguntas, para aprovechar el tiempo del examen y mejorar tu desempeño. Incluye simulacro del examen.",
      facts: ["Duración: 4 semanas", "16 horas con acompañamiento docente (4 semanales)", "60 horas de trabajo autónomo"],
      price: [["Curso preparatorio", "$582.900"], ["Simulacro + valor de la prueba", "$228.560"], ["Total inversión", "$811.460"]],
      dates: [
        ["Inscripción y pago (Preparatorio #6)", "13 al 30 de octubre"],
        ["Curso", "17 al 27 de noviembre"],
        ["Aplicación del examen", "4 de diciembre"]
      ]
    },
    formacion: {
      step: "Formación previa",
      title: "Curso intensivo a distancia",
      what: "Cursos por niveles (A1, A2, B1.1, B1.2 y B2) para fortalecer tu inglés antes de prepararte y certificarte.",
      facts: ["12 semanas por nivel", "80 horas de trabajo autónomo", "32 horas de clases sincrónicas", "8 horas de actividades grupales"],
      priceTitle: "Valores con 20% de descuento para estudiantes",
      price: INTENSIVE_PRICES,
      highlightPrice: level,                      // se resalta el nivel donde empieza el estudiante
      dateGroups: [
        { title: "Ciclo 3 (el que empieza ahora)", rows: [
          ["Inscripciones y pagos", "14 de septiembre al 31 de octubre"],
          ["Inducción", "17 de noviembre"],
          ["Inicio de clases", "17 de noviembre"],
          ["Fin de clases", "12 de febrero"]
        ] },
        { title: "Ciclo 4 súper intensivo", rows: [
          ["Inscripciones y pagos", "18 de noviembre al 9 de diciembre de 2026"],
          ["Inducción", "11 de diciembre de 2026"],
          ["Inicio de clases", "14 de diciembre de 2026"],
          ["Fin de clases y exámenes finales", "hasta el 5 de febrero de 2027"]
        ] }
      ],
      payNote: `Pregunta por las facilidades de pago y créditos: ${CONTACT_EMAIL}`
    }
  };
}
