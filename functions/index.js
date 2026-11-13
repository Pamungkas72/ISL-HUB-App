// Cloud Function: master mengatur kata sandi akun lain (Firebase hanya mengizinkannya dari server).
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

const EMAIL_MASTER = "codcodan1@gmail.com"; // sama dengan isMaster() di firestore.rules
const BATAS_SESI_DETIK = 87000; // 24 jam 10 menit, sama dengan sesiBerlaku()

exports.aturKataSandi = onCall({ region: "asia-southeast2" }, async (req) => {
  const a = req.auth;
  if (!a || String(a.token.email || "").toLowerCase() !== EMAIL_MASTER || Date.now() / 1000 - a.token.auth_time > BATAS_SESI_DETIK)
    throw new HttpsError("permission-denied", "Hanya master.");
  const uid = String((req.data && req.data.uid) || ""), sandi = String((req.data && req.data.sandi) || "");
  if (!uid || sandi.length < 8 || sandi.length > 128) throw new HttpsError("invalid-argument", "Kata sandi 8 sampai 128 karakter.");
  const profil = await admin.firestore().doc(`pengguna/${uid}`).get();
  if (!profil.exists) throw new HttpsError("not-found", "Akun tidak ada di daftar aplikasi.");
  const email = String(profil.get("email") || "").toLowerCase();
  if (email === EMAIL_MASTER) throw new HttpsError("permission-denied", "Akun master tidak diatur dari sini.");
  await admin.auth().updateUser(uid, { password: sandi });
  await admin.auth().revokeRefreshTokens(uid); // sesi lama akun itu berakhir
  await admin.firestore().collection("pengguna_log").add({ uid, email, aksi: "atur-sandi", dari: null, ke: null, oleh: a.token.email, waktu: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true };
});
exports.notifDailyJob = require("./dailyjob").notifDailyJob;
