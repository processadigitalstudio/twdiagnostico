// ============================================================
// Sube los códigos de acceso generados a Firestore.
//
// REQUISITOS (una sola vez):
//   npm install firebase-admin
//   Descarga tu "service account key":
//     Firebase Console → ⚙ Configuración del proyecto → Cuentas de servicio
//     → Generar nueva clave privada → guárdala aquí como serviceAccountKey.json
//   (NO subas ese archivo a GitHub — agrégalo a .gitignore)
//
// USO:
//   node import_to_firestore.js
// ============================================================

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(keyPath)) {
  console.error("Falta serviceAccountKey.json en esta carpeta. Revisa el README.");
  process.exit(1);
}

const serviceAccount = require(keyPath);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const dataPath = path.join(__dirname, "firestore_import.json");
if (!fs.existsSync(dataPath)) {
  console.error("Falta firestore_import.json. Corre primero generate_codes.js.");
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(dataPath, "utf8"));

async function run() {
  const batch = db.batch();
  for (const row of rows) {
    const ref = db.collection("access_codes").doc(row.code);
    batch.set(ref, {
      name: row.name,
      status: row.status,
      usedAt: null
    });
  }
  await batch.commit();
  console.log(`${rows.length} códigos subidos a Firestore (colección access_codes).`);
}

run().catch(console.error);
