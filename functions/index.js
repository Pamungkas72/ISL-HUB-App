// Cloud Function: master mengatur kata sandi akun lain (Firebase hanya mengizinkannya dari server).
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

// Galat tak terduga dikirim ke klien beserta penyebabnya (bukan "internal" saja), dan dicatat di log fungsi.
const onCallJelas = (opsi, fn) => onCall(opsi, async (req) => { try { return await fn(req); } catch (er) { if (er instanceof HttpsError) throw er; console.error(er); throw new HttpsError("internal", `${er.code || "galat"}: ${er.message || er}`); } });

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
// Master menghapus akun permanen: profil, sales_publik, dan login Firebase Authentication sekaligus.
exports.hapusAkun = onCallJelas({ region: "asia-southeast2" }, async (req) => {
  const a = req.auth;
  if (!a || String(a.token.email || "").toLowerCase() !== EMAIL_MASTER || Date.now() / 1000 - a.token.auth_time > BATAS_SESI_DETIK)
    throw new HttpsError("permission-denied", "Hanya master.");
  const uid = String((req.data && req.data.uid) || "");
  if (!uid) throw new HttpsError("invalid-argument", "uid kosong.");
  const ref = admin.firestore().doc(`pengguna/${uid}`), profil = await ref.get();
  const email = String(profil.get("email") || "").toLowerCase();
  if (email === EMAIL_MASTER || uid === a.uid) throw new HttpsError("permission-denied", "Akun master tidak bisa dihapus.");
  await admin.auth().deleteUser(uid).catch((err) => { if (err.code !== "auth/user-not-found") throw err; });
  await admin.firestore().doc(`sales_publik/${uid}`).delete();
  await ref.delete();
  await admin.firestore().collection("pengguna_log").add({ uid, email, aksi: "hapus", dari: { peran: profil.get("peran") ?? null, status: profil.get("status") ?? null }, ke: null, oleh: a.token.email, waktu: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true };
});
// Master mengubah nama, email login, dan WhatsApp akun lain (email login hanya bisa diganti dari server).
exports.ubahAkun = onCallJelas({ region: "asia-southeast2" }, async (req) => {
  const a = req.auth;
  if (!a || String(a.token.email || "").toLowerCase() !== EMAIL_MASTER || Date.now() / 1000 - a.token.auth_time > BATAS_SESI_DETIK)
    throw new HttpsError("permission-denied", "Hanya master.");
  const d = req.data || {}, uid = String(d.uid || ""), nama = String(d.nama || "").trim().slice(0, 80), email = String(d.email || "").trim().toLowerCase(), telepon = String(d.telepon || "").trim().slice(0, 20);
  if (!uid || !nama || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError("invalid-argument", "Nama dan email wajib valid.");
  const ref = admin.firestore().doc(`pengguna/${uid}`), profil = await ref.get();
  if (!profil.exists) throw new HttpsError("not-found", "Akun tidak ada di daftar aplikasi.");
  const lama = String(profil.get("email") || "").toLowerCase();
  if (lama === EMAIL_MASTER) throw new HttpsError("permission-denied", "Akun master tidak diubah dari sini.");
  if (email !== lama) { await admin.auth().updateUser(uid, { email }); await admin.auth().revokeRefreshTokens(uid); }
  await ref.update({ nama, email, telepon: telepon || admin.firestore.FieldValue.delete() });
  if (profil.get("peran") === "sales") await admin.firestore().doc(`sales_publik/${uid}`).set({ nama }, { merge: true });
  await admin.firestore().collection("pengguna_log").add({ uid, email, aksi: "ubah", dari: { nama: profil.get("nama") ?? null, email: lama }, ke: { nama, email }, oleh: a.token.email, waktu: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true };
});
// Waktu login terakhir tiap akun (hanya master dan admin aktif); data ada di Firebase Authentication, bukan di Firestore.
exports.loginTerakhir = onCallJelas({ region: "asia-southeast2" }, async (req) => {
  const a = req.auth; if (!a) throw new HttpsError("unauthenticated", "Masuk dulu.");
  let ok = String(a.token.email || "").toLowerCase() === EMAIL_MASTER;
  if (!ok) { const p = await admin.firestore().doc(`pengguna/${a.uid}`).get(); ok = p.get("peran") === "admin" && p.get("status") === "aktif"; }
  if (!ok) throw new HttpsError("permission-denied", "Hanya master dan admin.");
  const masuk = {};
  for (let r = await admin.auth().listUsers(1000); ; r = await admin.auth().listUsers(1000, r.pageToken)) { r.users.forEach((u) => { if (u.metadata.lastSignInTime) masuk[u.uid] = new Date(u.metadata.lastSignInTime).toISOString(); }); if (!r.pageToken) break; }
  return { masuk };
});
exports.notifDailyJob = require("./dailyjob").notifDailyJob;
Object.assign(exports, require("./dailyjob-akun"));
Object.assign(exports, require("./email-selesai"));
