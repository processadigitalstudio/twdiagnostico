// Escala la pantalla del examen según el tamaño de la ventana (pantallas de 30" → todo más grande,
// pantallas pequeñas → sin cambios) y ofrece botones A− / A / A+ para quien necesita letra más grande.
// Se guarda solo el nivel elegido, en este computador. No toca el estado del examen.
(function () {
  var LEVELS = [0.9, 1, 1.15, 1.3, 1.5, 1.75];
  var DEFAULT_IDX = 1;
  var KEY = "twTextScale";
  var idx = DEFAULT_IDX;
  try {
    var s = parseInt(localStorage.getItem(KEY), 10);
    if (s >= 0 && s < LEVELS.length) idx = s;
  } catch (e) {}

  var root = document.documentElement;

  function apply() {
    var w = window.innerWidth, h = window.innerHeight;
    // Diseño pensado para ~1366×720 de área útil: por debajo no se reduce, por encima crece (máx. 1.75×)
    var auto = Math.min(1.75, Math.max(1, Math.min(w / 1366, h / 720)));
    var z = Math.max(0.8, Math.min(auto * LEVELS[idx], 3));
    root.style.setProperty("--z", z.toFixed(3));
    // Si al ampliar queda muy poco ancho útil, el examen pasa a una sola columna
    root.classList.toggle("zn", w / z < 900);
    var minus = document.getElementById("sizeMinus"), plus = document.getElementById("sizePlus");
    if (minus) minus.disabled = idx <= 0;
    if (plus) plus.disabled = idx >= LEVELS.length - 1;
  }

  function setIdx(n) {
    idx = Math.max(0, Math.min(LEVELS.length - 1, n));
    try { localStorage.setItem(KEY, String(idx)); } catch (e) {}
    apply();
  }

  function mount() {
    if (document.getElementById("sizeCtl")) return;
    var box = document.createElement("div");
    box.id = "sizeCtl";
    box.className = "size-ctl";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Text size / Tamaño de letra");
    box.innerHTML =
      '<button type="button" id="sizeMinus" title="Smaller text / Letra más pequeña" aria-label="Smaller text / Letra más pequeña">A−</button>' +
      '<button type="button" id="sizeReset" title="Normal size / Tamaño normal" aria-label="Normal size / Tamaño normal">A</button>' +
      '<button type="button" id="sizePlus" title="Larger text / Letra más grande" aria-label="Larger text / Letra más grande">A+</button>';
    document.body.appendChild(box);
    document.getElementById("sizeMinus").addEventListener("click", function () { setIdx(idx - 1); });
    document.getElementById("sizeReset").addEventListener("click", function () { setIdx(DEFAULT_IDX); });
    document.getElementById("sizePlus").addEventListener("click", function () { setIdx(idx + 1); });
    apply();
  }

  apply();
  window.addEventListener("resize", apply);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
