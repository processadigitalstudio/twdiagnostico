# Piloto — Examen de Ubicación Tweetalig

Piloto interno (30 funcionarios) para validar el examen antes de subirlo a Moodle.
Bancos: UoL (200), Reading (200), Listening (160/59 audios) = 560 ítems totales.
Cada persona ve ~80 preguntas (18 UoL + ~38 Reading + ~24 Listening), en 65 minutos (un solo reloj global, no hay tiempo separado por sección).

**Novedades de esta versión:** login con usuario/contraseña que tú generas desde el
dashboard, aviso de integridad académica antes de empezar, detección de cambio de
pestaña (con blur), detección de traductor del navegador, bloqueo de copiar/pegar/
click derecho, dashboard en vivo, análisis por ítem con el contenido completo de
cada pregunta, **y las respuestas correctas ya no viajan al navegador** (se
calculan solo en el dashboard, con la clave protegida).

**Estructura del examen (actualizada):** 3 secciones, cada una con su propia
pantalla de instrucciones en inglés antes de empezar, **y su propio timer
independiente**:
- **Use of Language** — 15 min, 18 ítems individuales (5-5-4-4 por nivel)
- **Reading** — 30 min, 2 textos por nivel (8 en total, ~38 preguntas). Se lee
  el texto una vez y se responden todas sus preguntas juntas, en la misma página.
- **Listening** — 20 min, 2 audios por nivel (8 en total, ~24 preguntas). Cada
  audio se puede reproducir hasta 3 veces; el reproductor muestra cuántas
  repeticiones quedan.

**Cuando se acaba el tiempo de una sección, avanza sola a la siguiente**
(guardando lo que ya se alcanzó a responder) — esto además queda registrado
como dato: si alguien "se pasó del tiempo" en una destreza específica, eso en
sí mismo es una señal de nivel (ej. alguien que no termina Reading a tiempo
probablemente no lee con la fluidez que ese nivel requiere). Esto se ve en la
pestaña "Resultados" del dashboard (columna "Tiempos por sección", con ⏱ si
se agotó el tiempo) y en el CSV exportable.

**No hay botón "Anterior"** — una vez que se avanza a un texto/audio/ítem nuevo,
no se puede regresar. Total: ~80 ítems, 65 minutos repartidos en 3 tiempos
independientes (15+30+20).

---

## ⚠️ Léelo primero: qué SÍ y qué NO hace esto

- **SÍ** protege las respuestas correctas: el navegador de quien hace el examen
  nunca las recibe — viven solo en Firestore, protegidas por tu login.
- **SÍ** bloquea copiar/cortar/pegar/click derecho dentro de la página.
- **SÍ** detecta cuando alguien cambia de pestaña o minimiza la ventana, y difumina
  la pantalla del examen hasta que regrese — y lo registra.
- **SÍ** detecta si activaron "Traducir esta página" de Chrome (deja una marca
  técnica en el código que se puede detectar) — pero solo si usan Chrome/navegadores
  basados en el mismo motor, y solo detecta, no bloquea.
- **NO** puede impedir capturas de pantalla (Print Screen, herramienta de recorte,
  o una foto con el celular a la pantalla). Ningún sitio web puede hacer esto —
  es una limitación de cómo funciona un navegador, no de este código.
- **NO** puede impedir que alguien use un traductor en su teléfono, o le pida ayuda
  a otra persona en la misma sala.
- **Consecuencia de proteger las respuestas:** la persona que hace el examen ya
  NO ve su puntaje al terminar — solo un mensaje de agradecimiento. El resultado
  real solo lo ves tú, en el dashboard, una vez cargues la clave de respuestas
  (ver sección 1.3 más abajo).

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

    match /answer_key/{doc} {
      // la clave de respuestas SOLO la puede leer o escribir tu sesión autenticada.
      // el examen (index.html/exam.html) nunca toca esta colección.
      allow read, write: if request.auth != null;
    }
  }
}
```

> Esto es más seguro que la versión anterior: ahora que se guardan contraseñas
> reales de personas, nadie puede "listar" (dump) la colección completa de
> `access_codes` ni leer las `sessions` de otros sin haber iniciado sesión como
> administradora. **Y las respuestas correctas del examen (colección `answer_key`)
> tampoco se pueden leer sin tu login** — ver la siguiente sección.

---

## 1.3 Cargar la clave de respuestas (SOLO TÚ tienes este archivo)

Junto con este zip recibiste un archivo llamado `answer_key_PRIVADO_NO_SUBIR.json`
con las 560 respuestas correctas. **Este archivo NUNCA debe subirse a GitHub**
(por eso ya está en `.gitignore`) — el examen que ven los funcionarios descarga
los bancos de preguntas SIN esa información, así que aunque alguien abra las
herramientas de desarrollador mientras hace el examen, no va a encontrar ahí
la respuesta correcta.

Para que el dashboard pueda calificar, súbelo una sola vez:

1. Entra a `admin.html`, inicia sesión con tu correo/contraseña
2. Vas a ver un aviso amarillo arriba: **"Aún no has cargado la clave de respuestas"**
3. Click en **"📤 Cargar answer_key_PRIVADO_NO_SUBIR.json"**
4. Selecciona ese archivo desde tu computadora
5. El aviso se pone verde: **"✅ Clave de respuestas cargada (560 ítems)"**

A partir de ahí, el dashboard calcula automáticamente los resultados de todas
las sesiones — nunca hace falta volver a subirlo, salvo que cambies el banco
de preguntas más adelante.

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
