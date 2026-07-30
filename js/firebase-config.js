// ============================================================
// CONFIGURACIÓN DE FIREBASE
// Reemplaza estos valores con los de TU proyecto de Firebase.
// Los encuentras en: Firebase Console → Configuración del proyecto
// → Tus apps → SDK setup and configuration → Config
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "REEMPLAZA_CON_TU_API_KEY",
  authDomain: "REEMPLAZA.firebaseapp.com",
  projectId: "REEMPLAZA",
  storageBucket: "REEMPLAZA.appspot.com",
  messagingSenderId: "REEMPLAZA",
  appId: "REEMPLAZA"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// La protección del dashboard ahora usa Firebase Authentication real
// (correo + contraseña tuya), no una clave fija en el código.
// Crea tu usuario en: Firebase Console → Authentication → Users → Add user
