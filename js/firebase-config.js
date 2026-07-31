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
  apiKey: "AIzaSyCbXuBu-sna6sTJMQ2mDrWkymwFhRniy78",
  authDomain: "tweetalig-piloto.firebaseapp.com",
  projectId: "tweetalig-piloto",
  storageBucket: "tweetalig-piloto.firebasestorage.app",
  messagingSenderId: "285287227736",
  appId: "1:285287227736:web:7304cf76d0fd73467fc52d"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// La protección del dashboard ahora usa Firebase Authentication real
// (correo + contraseña tuya), no una clave fija en el código.
// Crea tu usuario en: Firebase Console → Authentication → Users → Add user
