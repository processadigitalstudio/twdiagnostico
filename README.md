# Piloto — Examen de Ubicación Tweetalig

Piloto interno (30 funcionarios) para validar el examen antes de subirlo a Moodle.
Bancos: UoL (200), Reading (200), Listening (160/59 audios) = 560 ítems totales.
Cada persona ve 54 preguntas (18 por destreza), en 60 minutos.

---

## 1. Crear el proyecto de Firebase (una sola vez, ~10 min)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) → **Crear un proyecto**.
   Nómbralo, por ejemplo, `tweetalig-piloto`.
2. En el menú lateral, entra a **Firestore Database** → **Crear base de datos** → modo **producción** → elige una región (ej. `us-east1`, es la más cercana a Colombia).
3. Entra a **Storage** → **Comenzar** → mismo modo producción.
4. Entra a **⚙ Configuración del proyecto** → pestaña **Tus apps** → ícono `</>` (Web) → regístrala con cualquier nombre (ej. "piloto-web"). Firebase te muestra un bloque `firebaseConfig = {...}`.
5. Copia esos valores dentro de `js/firebase-config.js`, reemplazando los `REEMPLAZA_...`.
6. En ese mismo archivo, cambia `ADMIN_PASSWORD` por una clave tuya (es lo único que protege el dashboard).

### Reglas de seguridad (pega esto en Firestore → Reglas)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /access_codes/{code} {
      allow read: if true;
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['status', 'usedAt']);
      allow write: if false; // solo se crean vía el script de importación (admin)
    }
    match /sessions/{sessionId} {
      allow create, update: if true;
      allow read: if true; // el dashboard admin.html lee de aquí
    }
  }
}
```

> ⚠️ **Nota honesta de seguridad:** estas reglas son deliberadamente permisivas porque es un piloto interno con 30 personas de confianza, no un examen público. Con reglas así, cualquiera que abra las herramientas de desarrollador del navegador podría, en teoría, ver las respuestas correctas de los ítems (porque el banco completo se descarga al navegador). **Esto es aceptable para el piloto, pero Moodle NO tiene este problema** — ahí las respuestas correctas nunca llegan al navegador del estudiante hasta que el servidor califica. Es una de las razones por las que el examen real vive en Moodle y no en esta app.

### Reglas de Storage (para los audios)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

---

## 2. Subir los audios

En Storage, crea una carpeta `audio/` y sube cada archivo `.mp3` **con el mismo nombre que el `audio_id`** del banco (ej. `A1L01.mp3`, `B2L07.mp3`). La lista completa de IDs esperados está en `data/audio_manifest.json` (59 en total).

Alternativa más simple para el piloto: en vez de Storage, puedes poner los archivos `.mp3` directamente en la carpeta `audio/` de este mismo repositorio y GitHub Pages los sirve igual — el código ya apunta a `audio/{audio_id}.mp3` de forma relativa, así que **no necesitas tocar código para esto**, solo copiar los archivos ahí.

Si un audio no está listo, la pregunta muestra automáticamente "🎧 Audio pendiente de cargar" en vez de trabarse.

---

## 3. Generar y subir los códigos de acceso

```bash
cd scripts
# 1. Crea names.txt con un nombre por línea (los 30 funcionarios)
node generate_codes.js names.txt
# → produce codes_para_enviar.csv y firestore_import.json

# 2. Descarga tu clave de servicio (una sola vez):
#    Firebase Console → Configuración del proyecto → Cuentas de servicio
#    → Generar nueva clave privada → guárdala como scripts/serviceAccountKey.json
#    (agrégala a .gitignore, NUNCA la subas a GitHub)
npm install firebase-admin
node import_to_firestore.js
```

Envía a cada persona su código desde `codes_para_enviar.csv`.

---

## 4. Publicar en GitHub Pages

```bash
git init
git add .
echo "scripts/serviceAccountKey.json" >> .gitignore
echo "scripts/names.txt" >> .gitignore
git add .gitignore
git commit -m "Piloto examen de ubicación"
git remote add origin <tu-repo-url>
git push -u origin main
```

Luego: repo → **Settings → Pages → Branch: main → carpeta `/root`** → Guardar. En 1-2 minutos queda publicado en `https://tuusuario.github.io/tu-repo/`.

---

## 5. Durante el piloto

Los funcionarios entran a la URL, ingresan su código, y hacen el examen. Tú monitoreas en vivo desde `.../admin.html` (pide tu `ADMIN_PASSWORD`).

Ahí ves, en tiempo real:
- Sesiones completadas y su score
- **p-value y discriminación por ítem**, ya calculados, con ítems marcados en rojo si tienen dificultad extrema o discriminación baja

---

## 6. Después del piloto — análisis completo

Desde `admin.html`, botón **"Exportar respuestas (CSV)"**. Luego:

```bash
cd scripts
pip install pandas numpy --break-system-packages
python3 analyze_pilot.py ~/Downloads/piloto_respuestas_2026-XX-XX.csv
```

Esto produce `item_stats.csv` (para limpiar el banco antes de Bookmark) y `reliability.csv` (alfa de Cronbach aproximado por destreza — lee la nota dentro del script sobre por qué es aproximado con formularios aleatorios).

**Siguiente paso después de esto:** con el banco ya limpio (ítems marcados corregidos o retirados) y el % de aciertos real por ítem, quedas lista para la sesión Bookmark con los 4 profesores.

---

## Estructura del repo

```
/
├── index.html          → login (código de acceso)
├── exam.html            → el examen
├── results.html         → resultado que ve el participante
├── admin.html           → dashboard (solo tú)
├── css/style.css
├── js/
│   ├── firebase-config.js   → TUS credenciales van aquí
│   ├── exam-config.js       → N por destreza, pesos, tabla de cortes (editable)
│   └── exam-engine.js       → lógica de aleatoriedad, timer, scoring
├── data/
│   ├── uol_bank.json        → 200 ítems
│   ├── reading_bank.json    → 200 ítems
│   ├── listening_bank.json  → 160 ítems (con referencia a audio_id)
│   └── audio_manifest.json  → lista de los 59 audio_id esperados
├── audio/                → aquí van los .mp3 (nombrados igual que audio_id)
└── scripts/
    ├── generate_codes.js
    ├── import_to_firestore.js
    └── analyze_pilot.py
```
