// Akun anggota tim Daily Job yang dibuat dan diurus kepala divisi lewat UI (Cloud Functions, Admin SDK).
// Anggota (peran 'dj') masuk dengan username, email, atau nomor telepon dan hanya bisa membuka Daily Job kelompoknya.
// Pemanggil yang sah: master, admin, atau akun yang ada di dj_kelompok.kepala kelompok itu.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const U = require("./dailyjob-akun-util");

const EMAIL_MASTER = "codcodan1@gmail.com"; // sama dengan isMaster() di firestore.rules
const BATAS_SESI_DETIK = 87000;
const OPSI = { region: "asia-southeast2" };
const db = () => admin.firestore();

async function pemanggil(req) {
  const a = req.auth;
  if (!a || Date.now() / 1000 - a.token.auth_time > BATAS_SESI_DETIK) throw new HttpsError("unauthenticated", "Masuk dulu.");
  if (String(a.token.email || "").toLowerCase() === EMAIL_MASTER) return { uid: a.uid, nama: "Master", kelola: true };
  const p = await db().doc(`pengguna/${a.uid}`).get();
  if (!p.exists || p.get("status") !== "aktif") throw new HttpsError("permission-denied", "Akun tidak aktif.");
  return { uid: a.uid, nama: p.get("nama") || a.token.email || "", kelola: p.get("peran") === "admin" };
}
async function pastikanKepala(c, kelompokId) {
  if (c.kelola) return;
  const k = await db().doc(`dj_kelompok/${kelompokId}`).get();
  if (!k.exists || !(k.get("kepala") || []).includes(c.uid)) throw new HttpsError("permission-denied", "Hanya kepala divisi kelompok ini yang boleh mengurus anggotanya.");
}
const catat = (c, uid, email, aksi) => db().collection("pengguna_log").add({ uid, email, aksi, dari: null, ke: null, oleh: c.nama, waktu: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});

/** Kunci login (alias) yang dipesan satu akun: username wajib, telepon dan email opsional. */
const daftarAlias = (username, telepon, emailKontak) => [`u_${username}`, ...(telepon ? [`p_${telepon}`] : []), ...(emailKontak ? [`e_${emailKontak.toLowerCase()}`] : [])];
async function pesanAlias(kunci, email, milik = []) {
  const ref = (k) => db().doc(`dj_login/${k}`);
  await db().runTransaction(async (t) => {
    const s = await Promise.all(kunci.map((k) => t.get(ref(k)))), bentrok = U.kunciBentrok(kunci, s.map((d) => d.exists), milik);
    if (bentrok) throw new HttpsError("already-exists", { u: "Username sudah dipakai.", p: "Nomor telepon sudah dipakai akun lain.", e: "Email sudah dipakai akun lain." }[bentrok[0]]);
    kunci.forEach((k) => t.set(ref(k), { email })); // publik: hanya email (tanpa uid)
  });
}
const lepasAlias = (kunci) => Promise.all(kunci.map((k) => db().doc(`dj_login/${k}`).delete().catch(() => {})));

exports.djBuatAnggota = onCall(OPSI, async (req) => {
  const c = await pemanggil(req), d = req.data || {}, kelompokId = String(d.kelompokId || ""), nama = String(d.nama || "").trim().slice(0, 80);
  const username = U.normalUsername(d.username), telepon = d.telepon ? U.normalTelepon(d.telepon) : "", emailKontak = String(d.emailKontak || "").trim().toLowerCase(), sandi = d.sandi;
  if (!kelompokId || !(await db().doc(`dj_kelompok/${kelompokId}`).get()).exists) throw new HttpsError("not-found", "Kelompok tidak ada.");
  await pastikanKepala(c, kelompokId);
  if (!nama) throw new HttpsError("invalid-argument", "Isi nama lengkap.");
  if (!U.usernameValid(username)) throw new HttpsError("invalid-argument", "Username 3 sampai 30 karakter: huruf kecil, angka, titik, garis bawah, atau strip.");
  if (d.telepon && !telepon) throw new HttpsError("invalid-argument", "Nomor telepon tidak valid.");
  if (emailKontak && !U.emailValid(emailKontak)) throw new HttpsError("invalid-argument", "Format email tidak valid.");
  if (!U.sandiValid(sandi)) throw new HttpsError("invalid-argument", "Kata sandi 8 sampai 64 karakter.");
  const email = U.emailSintetis(username), alias = daftarAlias(username, telepon, emailKontak);
  await pesanAlias(alias, email);
  let uid;
  try { uid = (await admin.auth().createUser({ email, password: sandi, displayName: nama })).uid; }
  catch (err) { await lepasAlias(alias); throw new HttpsError("internal", "Akun belum bisa dibuat: " + (err.message || err)); }
    await db().doc(`pengguna/${uid}`).set({ email, nama, peran: "dj", status: "aktif", kelompokDJ: kelompokId, username, telepon: telepon || null, emailKontak: emailKontak || null, alias, dibuat: admin.firestore.FieldValue.serverTimestamp(), disetujuiPada: admin.firestore.FieldValue.serverTimestamp(), dibuatOleh: c.uid, dibuatOlehNama: c.nama });
  await catat(c, uid, email, "dj-tambah");
  return { uid, username, email };
});

exports.djDaftarTim = onCall(OPSI, async (req) => {
  const c = await pemanggil(req), kelompokId = String((req.data && req.data.kelompokId) || ""); await pastikanKepala(c, kelompokId);
  const s = await db().collection("pengguna").where("kelompokDJ", "==", kelompokId).where("peran", "==", "dj").get();
  return { anggota: s.docs.map((x) => ({ uid: x.id, nama: x.get("nama") || "", username: x.get("username") || "", telepon: x.get("telepon") || "", emailKontak: x.get("emailKontak") || "", status: x.get("status") || "aktif" })).sort((a, b) => a.nama.localeCompare(b.nama, "id")) };
});

exports.djAturAnggota = onCall(OPSI, async (req) => {
  const c = await pemanggil(req), d = req.data || {}, uid = String(d.uid || ""), aksi = String(d.aksi || "");
  const ref = db().doc(`pengguna/${uid}`), s = await ref.get();
  if (!s.exists || s.get("peran") !== "dj") throw new HttpsError("not-found", "Anggota tidak ada.");
  await pastikanKepala(c, s.get("kelompokDJ")); const email = s.get("email");
  if (aksi === "sandi") {
    if (!U.sandiValid(d.sandi)) throw new HttpsError("invalid-argument", "Kata sandi 8 sampai 64 karakter.");
    await admin.auth().updateUser(uid, { password: d.sandi }); await admin.auth().revokeRefreshTokens(uid); await catat(c, uid, email, "dj-sandi");
  } else if (aksi === "nonaktif" || aksi === "aktif") {
    const mati = aksi === "nonaktif"; await admin.auth().updateUser(uid, { disabled: mati }); if (mati) await admin.auth().revokeRefreshTokens(uid);
    await ref.update({ status: mati ? "nonaktif" : "aktif" }); await catat(c, uid, email, "dj-" + aksi);
  } else if (aksi === "hapus") {
    await admin.auth().deleteUser(uid).catch((err) => { if (err.code !== "auth/user-not-found") throw err; });
    await lepasAlias(s.get("alias") || []); await ref.delete();
    const tk = await db().collection("dj_token").where("uid", "==", uid).get(); await Promise.all(tk.docs.map((x) => x.ref.delete())); await catat(c, uid, email, "dj-hapus");
  } else if (aksi === "ubah") {
    const nama = String(d.nama || s.get("nama") || "").trim().slice(0, 80), telepon = d.telepon ? U.normalTelepon(d.telepon) : "", emailKontak = String(d.emailKontak || "").trim().toLowerCase();
    if (d.telepon && !telepon) throw new HttpsError("invalid-argument", "Nomor telepon tidak valid."); if (emailKontak && !U.emailValid(emailKontak)) throw new HttpsError("invalid-argument", "Format email tidak valid.");
    const lama = s.get("alias") || [], baru = daftarAlias(s.get("username"), telepon, emailKontak);
    await pesanAlias(baru, email, lama); await lepasAlias(lama.filter((k) => !baru.includes(k)));
    await ref.update({ nama, telepon: telepon || null, emailKontak: emailKontak || null, alias: baru }); await admin.auth().updateUser(uid, { displayName: nama }); await catat(c, uid, email, "dj-ubah");
  } else throw new HttpsError("invalid-argument", "Aksi tidak dikenal.");
  return { ok: true };
});
