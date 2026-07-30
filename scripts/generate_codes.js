// ============================================================
// Genera códigos de acceso a partir de una lista de nombres.
//
// USO:
//   1. Crea un archivo names.txt en esta misma carpeta, un nombre por línea:
//        Rossana Restrepo
//        Julio Perez
//        ...
//   2. node generate_codes.js names.txt
//
// PRODUCE:
//   - codes_para_enviar.csv     → para copiar/pegar y mandarle a cada persona su código
//   - firestore_import.json     → para el script import_to_firestore.js
// ============================================================

const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2] || "names.txt";

if (!fs.existsSync(inputFile)) {
  console.error(`No encontré el archivo ${inputFile}. Créalo con un nombre por línea.`);
  process.exit(1);
}

const names = fs
  .readFileSync(inputFile, "utf8")
  .split("\n")
  .map(n => n.trim())
  .filter(n => n.length > 0);

function makeCode(index) {
  return `TWT-${String(index + 1).padStart(3, "0")}`;
}

const rows = names.map((name, i) => ({
  code: makeCode(i),
  name,
  status: "not_started",
  usedAt: null
}));

const csvLines = ["nombre,codigo", ...rows.map(r => `${r.name},${r.code}`)];
fs.writeFileSync(path.join(__dirname, "codes_para_enviar.csv"), csvLines.join("\n"));
fs.writeFileSync(path.join(__dirname, "firestore_import.json"), JSON.stringify(rows, null, 2));

console.log(`Listo. ${rows.length} códigos generados.`);
console.log(`→ codes_para_enviar.csv   (mándale a cada quien su código)`);
console.log(`→ firestore_import.json   (usa import_to_firestore.js para subirlos)`);
