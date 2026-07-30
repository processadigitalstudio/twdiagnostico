# Piloto — Examen de Ubicación Tweetalig

Piloto interno (30 funcionarios) para validar el examen antes de subirlo a Moodle.
Bancos: UoL (200), Reading (200), Listening (160/59 audios) = 560 ítems totales.
Cada persona ve 54 preguntas (18 por destreza), en 60 minutos.

**Novedades de esta versión:** login con usuario/contraseña que tú generas desde el
dashboard, aviso de integridad académica antes de empezar, detección de cambio de
pestaña (con blur), detección de traductor del navegador, bloqueo de copiar/pegar/
click derecho, dashboard en vivo, y análisis por ítem con el contenido completo de
cada pregunta.

---

## ⚠️ Léelo primero: qué SÍ y qué NO hace esto

- **SÍ** bloquea copiar/cortar/pegar/click derecho dentro de la página.
- **SÍ** detecta cuando alguien cambia de pestaña o minimiza la ventana, y difumina
  la pantalla del examen hasta que regrese — y lo registra.
- **SÍ** detecta si activaron "Traducir esta página" de Chrome (deja una marca
  técnica en el código que se puede detectar) — pero solo si usan Chrome/navegadores
  basados en el mismo motor, y solo detecta, no bloquea.
- **NO** puede impedir capturas de pantalla (Print Screen, herramienta de recorte,
  o una foto con el celular a la pantalla). Ningún sitio web puede hacer esto —
  es una limitación de cómo funciona un navegador, no de este código. Lo único que
  se puede hacer es detectar la tecla Print Screen (parcialmente) y confiar en el
  aviso de integridad + la naturaleza de bajo riesgo de un piloto interno.
- **NO** puede impedir que alguien use un traductor en su teléfono, o le pida ayuda
  a otra persona en la misma sala.

Esto es exactamente lo mismo que enfrentan Moodle, IELTS online, y cualquier examen
web — la seguridad real de un examen serio viene de la supervisión humana (proctor),
no solo de la tecnología. Para el piloto, el aviso de integridad + estas señales de
detección son suficientes; para el examen real a 6000 estudiantes, hablen con
Splavia sobre supervisión presencial o proctoring, si el resultado tiene consecuencias
académicas serias.

---

## 1. Crear el proyecto de Firebase

(Si ya creaste el proyecto en una versión anterior, salta directo a la sección 1.2)

### 1.1 Proyecto, Firestore y Storage
1. [console.firebase.google.com](https://console.firebase.google.com) → **Crear un proyecto** → `tweetalig-piloto`
2. **Firestore Database** → Crear base de datos → modo producción → región `us-east1`
3. **Storage** → Comenzar → modo producción
4. **⚙ Configuración del proyecto** → Tus apps → `</>` (Web) → registra la app
5. Copia el bloque `firebaseConfig` dentro de `js/firebase-config.js`

### 1.2 Tu login de administradora (NUEVO — reemplaza la clave fija de antes)
1. En el menú lateral: **Authentication** → **Comenzar**
2. Pestaña **Sign-in method** → habilita **Correo electrónico/contraseña**
3. Pestaña **Users** → **Add user** → pon tu correo y una contraseña tuya
4. Esa es la que usarás para entrar a `admin.html` — ya no hay clave fija en el código

### Reglas de Firestore (Firestore Database → Reglas)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /access_codes/{username} {
      // cualquiera puede LEER un solo usuario específico (para hacer login)
      allow get: if true;
      // pero solo tú (autenticada) puedes LISTAR todos los usuarios/contraseñas
      allow list: if request.auth != null;
      // solo tú puedes crear/borrar accesos nuevos
      allow create, delete: if request.auth != null;
      // el estudiante puede actualizar SOLO status/usedAt de su propio acceso;
      // tú (autenticada) puedes actualizar cualquier campo
      allow update: if request.auth != null
                    || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'usedAt']);
    }

    match /sessions/{sessionId} {
      // cualquiera puede crear/actualizar su propia sesión mientras hace el examen
      allow create, update: if true;
      // pero solo tú (autenticada) puedes LEER las sesiones (para el dashboard)
      allow read: if request.auth != null;
    }
  }
}
```

> Esto es más seguro que la versión anterior: ahora que se guardan contraseñas
> reales de personas, nadie puede "listar" (dump) la colección completa de
> `access_codes` ni leer las `sessions` de otros sin haber iniciado sesión como
> administradora. Sigue habiendo un límite conocido: como el examen corre 100%
> en el navegador, alguien con conocimientos técnicos podría, en teoría, inspeccionar
> el banco de preguntas descargado (`data/*.json`) y ver las respuestas correctas.
> Es aceptable para un piloto interno de 30 personas de confianza; Moodle no tiene
> este problema porque califica del lado del servidor.

### Reglas de Storage (si subes audios por ahí en vez del repo)

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

## 2. Audios

Ya resuelto en esta versión: los 59 `.mp3` van dentro de la carpeta `audio/` de este
mismo repositorio (GitHub Pages los sirve directo, no hace falta Storage).

---

## 3. Generar accesos (usuario + contraseña) — YA NO NECESITAS NODE NI TERMINAL

Todo esto ahora se hace desde `admin.html`, en la pestaña **"Gestionar accesos"**:

1. Entra a `admin.html`, inicia sesión con tu correo/contraseña de Firebase Auth
2. Ve a la pestaña **"Gestionar accesos"**
3. Escribe una persona por línea, formato `Nombre,usuario` — tú decides el usuario
   de cada quien (ej. `Rossana Restrepo,rossana`)
4. Click **"Generar accesos"** — la contraseña se genera sola, aleatoria
5. Descarga el CSV con nombre/usuario/contraseña y repártelo

(Los scripts viejos `generate_codes.js` / `import_to_firestore.js` quedan en
`scripts/` por si alguna vez prefieres hacerlo por línea de comandos, pero ya
no son necesarios.)

---

## 4. Publicar en GitHub Pages

Ya lo hiciste. Si necesitas repetirlo desde cero:
Settings → Pages → Branch: `main` / `(root)` → Save. El repo necesita ser
**público** para que GitHub Pages funcione en el plan gratuito.

---

## 5. Durante el piloto

- **Pestaña "En vivo"** de `admin.html`: quién está respondiendo ahora mismo,
  cuánto lleva, y si ya se registró algún evento sospechoso — se actualiza solo,
  sin recargar la página.
- **Pestaña "Resultados"**: sesiones ya completadas, con export a CSV.
- **Pestaña "Análisis por ítem"**: p-value y discriminación por ítem, y con
  click en "ver" se despliega el enunciado completo, las opciones, y cuál es
  la correcta — para que no tengas que ir a buscarlo en otro archivo.

---

## 6. Después del piloto

Igual que antes: exportar CSV desde "Resultados" → `python3 scripts/analyze_pilot.py archivo.csv`
para el análisis completo (incluye el alfa de Cronbach aproximado, con su nota
de por qué es aproximado dado que cada persona ve ítems distintos).

---

## Estructura del repo

```
/
├── index.html          → login (usuario + contraseña)
├── exam.html            → el examen (con aviso de integridad y detección)
├── results.html         → resultado que ve el participante
├── admin.html           → dashboard (login real con Firebase Auth)
├── css/style.css
├── js/
│   ├── firebase-config.js   → TUS credenciales + Firebase Auth
│   ├── exam-config.js       → N por destreza, pesos, tabla de cortes
│   └── exam-engine.js       → aleatoriedad, timer, scoring, login, eventos
├── data/                  → los 3 bancos + manifest de audios
├── audio/                 → los 59 .mp3
└── scripts/
    ├── generate_codes.js       (opcional, ya no necesario)
    ├── import_to_firestore.js  (opcional, ya no necesario)
    └── analyze_pilot.py
```
