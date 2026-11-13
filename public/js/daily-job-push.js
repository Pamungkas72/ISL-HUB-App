// Notifikasi push Daily Job (Firebase Cloud Messaging). Token perangkat disimpan di dj_token; Cloud Function terjadwal (functions/dailyjob.js) yang mengirim.
import { app, db } from "./firebase-config.js";
import { doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
const MSG = "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js";
const KUNCI = (uid) => "dj-push:" + uid;
const iOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const mandiri = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

/** 'tidak-didukung' | 'iphone-pasang' (iPhone: harus di-install ke Layar Utama dulu) | 'diblokir' | 'belum' | 'aktif' */
export function statusPush(uid) {
  if (iOS() && !mandiri()) return "iphone-pasang";
  if (!("serviceWorker" in navigator && "Notification" in window && "PushManager" in window)) return "tidak-didukung";
  if (Notification.permission === "denied") return "diblokir";
  let aktif = false; try { aktif = localStorage.getItem(KUNCI(uid)) === "1"; } catch (_) { /* tanpa penyimpanan: dianggap belum */ }
  return Notification.permission === "granted" && aktif ? "aktif" : "belum";
}
async function ambilToken() {
  const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;
  const { getMessaging, getToken } = await import(MSG);
  return getToken(getMessaging(app), { serviceWorkerRegistration: reg });
}
const idDok = async (uid, token) => {
  if (!(window.crypto && crypto.subtle)) { let h = 5381; for (const c of token) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return uid + "_" + h.toString(16) + token.length.toString(16); } // tanpa HTTPS (hanya pengembangan)
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)); return uid + "_" + [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const simpan = async (uid, token) => setDoc(doc(db, "dj_token", await idDok(uid, token)), { uid, token, agen: navigator.userAgent.slice(0, 120), diubah: serverTimestamp() });

export async function aktifkanPush(uid) {
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") throw new Error("Izin notifikasi tidak diberikan. Izinkan notifikasi untuk situs ini di pengaturan browser.");
  const token = await ambilToken(); if (!token) throw new Error("Perangkat ini belum bisa menerima notifikasi.");
  await simpan(uid, token); try { localStorage.setItem(KUNCI(uid), "1"); localStorage.setItem(KUNCI(uid) + ":t", token); } catch (_) { /* abaikan */ }
}
export async function matikanPush(uid) {
  let token = null; try { token = localStorage.getItem(KUNCI(uid) + ":t"); localStorage.removeItem(KUNCI(uid)); localStorage.removeItem(KUNCI(uid) + ":t"); } catch (_) { /* abaikan */ }
  if (!token) return;
  try { await deleteDoc(doc(db, "dj_token", await idDok(uid, token))); const { getMessaging, deleteToken } = await import(MSG); await deleteToken(getMessaging(app)); } catch (_) { /* token sudah hilang: tidak masalah */ }
}
/** Dipanggil saat aplikasi dibuka: token bisa berganti, jadi diperbarui paling sering sehari sekali. Pesan saat aplikasi terbuka tampil sebagai toast. */
export async function jagaPush(uid, tampil) {
  if (statusPush(uid) !== "aktif") return;
  try {
    const { getMessaging, onMessage } = await import(MSG);
    onMessage(getMessaging(app), (p) => { const d = p.data || {}; tampil(`<b>${(d.title || "").replace(/</g, "&lt;")}</b><br>${(d.body || "").replace(/</g, "&lt;")}`); });
    const h = new Date().toISOString().slice(0, 10), k = KUNCI(uid) + ":h";
    if (localStorage.getItem(k) !== h) { const token = await ambilToken(); if (token) { await simpan(uid, token); localStorage.setItem(KUNCI(uid) + ":t", token); localStorage.setItem(k, h); } }
  } catch (err) { console.warn("Notifikasi push belum bisa diperbarui:", err); }
}
