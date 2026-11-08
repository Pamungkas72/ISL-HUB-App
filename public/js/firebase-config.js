// ===========================================================
// FIREBASE CONFIG — ISI DENGAN DATA PROJECT FIREBASE EGA
// Ambil dari: Firebase Console > Project Settings > General
// > Your apps > SDK setup and configuration > Config
// ===========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyACncDGAWhLlGL67kz43hIh9xbLPYN9cns",
  authDomain: "system-marketing-bd-isl-2026.firebaseapp.com",
  projectId: "system-marketing-bd-isl-2026",
  storageBucket: "system-marketing-bd-isl-2026.firebasestorage.app",
  messagingSenderId: "776976432858",
  appId: "1:776976432858:web:efc2abc96f73bc63a5efe3"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
/* Sesi masuk hanya bertahan selama jendela browser atau aplikasi masih terbuka. Setelah ditutup dan dibuka lagi, akun harus masuk ulang. */
export const siapAuth = setPersistence(auth, browserSessionPersistence).catch((e) => console.warn("Penyimpanan sesi tidak bisa diatur:", e));
export const db = getFirestore(app);
