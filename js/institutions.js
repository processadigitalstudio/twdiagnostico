// ============================================================
// INSTITUCIONES — marca y datos de cada lugar donde se aplica el examen.
//
// Cómo se elige la institución de un estudiante (en este orden):
//   1. el campo "institución" que tiene su acceso (access_codes.institution),
//   2. el parámetro ?u=slug del link   (ej.  .../index.html?u=eam),
//   3. "tweetalig" (marca propia, sin logo de universidad).
//
// Para agregar una universidad: copia un bloque, cambia el slug y sube su logo a img/brand/.
// Los logos son opcionales: si el archivo no existe se muestra el nombre en texto.
// ============================================================

// Link de preinscripción (el mismo para todas las instituciones; cámbialo por institución si hace falta)
export const ENROLL_URL = "https://matriculas.tweetalig.edu.co/en/preinscripcion-tweetalig";

export const TWEETALIG = {
  name: "Tweetalig Centro de Idiomas",
  logo: "img/brand/tweetalig-logo.png",     // sube aquí el logo de Tweetalig (PNG con fondo transparente)
  website: ""                                // ej. "https://tweetalig.edu.co"
};

export const INSTITUTIONS = {
  tweetalig: {
    name: "Tweetalig",
    logo: "",
    enrollUrl: ENROLL_URL,                   // link de inscripción que se muestra en el resultado
    enrollLabel: "Inscribirme en Tweetalig",
    contact: ""                              // ej. "coordinador.cartagena@tweetalig.edu.co"
  },
  eam: {
    name: "EAM",
    logo: "img/brand/eam.svg",
    enrollUrl: ENROLL_URL,
    enrollLabel: "Inscribirme en el curso de inglés",
    contact: ""
  },
  unitecnar: {
    name: "UNITECNAR",
    logo: "img/brand/unitecnar.png",
    enrollUrl: ENROLL_URL,
    enrollLabel: "Inscribirme en el curso de inglés",
    contact: ""
  },
  uniajs: {
    name: "UNIAJS",
    logo: "img/brand/uniajs.png",
    enrollUrl: ENROLL_URL,
    enrollLabel: "Inscribirme en el curso de inglés",
    contact: ""
  }
};

export function resolveInstitution(slug) {
  const key = (slug || "").toLowerCase().trim();
  return { slug: INSTITUTIONS[key] ? key : "tweetalig", ...(INSTITUTIONS[key] || INSTITUTIONS.tweetalig) };
}

// Institución actual del navegador: la guarda index.html al entrar.
export function currentInstitutionSlug() {
  const fromUrl = new URLSearchParams(location.search).get("u");
  try { return sessionStorage.getItem("institution") || fromUrl || "tweetalig"; }
  catch (e) { return fromUrl || "tweetalig"; }
}

// Pinta los logos (Tweetalig + institución) dentro de `container`.
// Si una imagen no carga, se reemplaza por el nombre en texto.
export function renderBrand(container, inst) {
  container.innerHTML = "";
  const add = (src, name, cls) => {
    const wrap = document.createElement("span");
    wrap.className = "brand-logo " + cls;
    const text = () => { wrap.innerHTML = ""; const t = document.createElement("span"); t.className = "brand-wordmark"; t.textContent = name; wrap.appendChild(t); };
    if (!src) { text(); }
    else {
      const img = document.createElement("img");
      img.src = src; img.alt = name; img.draggable = false;
      img.addEventListener("error", text);
      wrap.appendChild(img);
    }
    container.appendChild(wrap);
  };
  add(TWEETALIG.logo, "Tweetalig", "brand-main");
  if (inst && inst.slug !== "tweetalig") {
    const sep = document.createElement("span");
    sep.className = "brand-sep"; sep.textContent = "×";
    container.appendChild(sep);
    add(inst.logo, inst.name, "brand-partner");
  }
}
