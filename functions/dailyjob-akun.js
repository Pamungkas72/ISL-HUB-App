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
const catat = (c, uid, email, aksi, dari = null, ke = null) => db().collection("pengguna_log").add({ uid, email, aksi, dari, ke, oleh: c.nama, waktu: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});

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
  const jadiKepala = d.jabatan === "kepala"; if (jadiKepala && !c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin yang menetapkan kepala divisi.");
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
  if (jadiKepala) await db().doc(`dj_kelompok/${kelompokId}`).update({ kepala: [uid] }); // satu kepala per kelompok: yang lama kembali jadi anggota
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
  } else if (aksi === "kepala" || aksi === "anggota" || aksi === "kelompok") {
    if (!c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin yang mengatur jabatan dan kelompok.");
    const lamaId = s.get("kelompokDJ"), baruId = aksi === "kelompok" ? String(d.kelompokId || "") : lamaId;
    if (aksi === "kelompok") {
      if (baruId === lamaId) return { ok: true };
      if (!baruId || !(await db().doc(`dj_kelompok/${baruId}`).get()).exists) throw new HttpsError("not-found", "Kelompok tujuan tidak ada.");
      const kl = await db().doc(`dj_kelompok/${lamaId}`).get(); // pindah kelompok: jabatan kepala di kelompok lama dilepas
      if (kl.exists && (kl.get("kepala") || []).includes(uid)) await kl.ref.update({ kepala: (kl.get("kepala") || []).filter((x) => x !== uid) });
      await ref.update({ kelompokDJ: baruId });
    } else {
      const kl = db().doc(`dj_kelompok/${lamaId}`), ks = await kl.get(); if (!ks.exists) throw new HttpsError("not-found", "Kelompok tidak ada.");
      await kl.update({ kepala: aksi === "kepala" ? [uid] : (ks.get("kepala") || []).filter((x) => x !== uid) });
    }
    await admin.auth().revokeRefreshTokens(uid); await catat(c, uid, email, "dj-" + aksi);
  } else if (aksi === "ubah") {
    const nama = String(d.nama || s.get("nama") || "").trim().slice(0, 80), telepon = d.telepon ? U.normalTelepon(d.telepon) : "", emailKontak = String(d.emailKontak || "").trim().toLowerCase();
    const usernameLama = s.get("username"), username = d.username ? U.normalUsername(d.username) : usernameLama, gantiUser = username !== usernameLama;
    if (d.telepon && !telepon) throw new HttpsError("invalid-argument", "Nomor telepon tidak valid."); if (emailKontak && !U.emailValid(emailKontak)) throw new HttpsError("invalid-argument", "Format email tidak valid.");
    if (gantiUser && !U.usernameValid(username)) throw new HttpsError("invalid-argument", "Username 3 sampai 30 karakter: huruf kecil, angka, titik, garis bawah, atau strip.");
    const emailBaru = gantiUser ? U.emailSintetis(username) : email, lama = s.get("alias") || [], baru = daftarAlias(username, telepon, emailKontak);
    await pesanAlias(baru, emailBaru, lama);
    if (gantiUser) { // email login internal ikut berubah; gagal = alias dikembalikan
      try { await admin.auth().updateUser(uid, { email: emailBaru }); }
      catch (err) { await pesanAlias(lama, email, baru).catch(() => {}); await lepasAlias(baru.filter((k) => !lama.includes(k))); throw new HttpsError("internal", "Username belum bisa diubah: " + (err.message || err)); }
    }
    await lepasAlias(lama.filter((k) => !baru.includes(k)));
    const dari = {}, ke = {}, ubah = (k, a, b2) => { if (String(a || "") !== String(b2 || "")) { dari[k] = a || null; ke[k] = b2 || null; } };
    ubah("username", usernameLama, username); ubah("nama", s.get("nama"), nama); ubah("telepon", s.get("telepon"), telepon); ubah("emailKontak", s.get("emailKontak"), emailKontak);
    await ref.update({ nama, username, email: emailBaru, telepon: telepon || null, emailKontak: emailKontak || null, alias: baru }); await admin.auth().updateUser(uid, { displayName: nama });
    if (gantiUser) await admin.auth().revokeRefreshTokens(uid); // username berubah: sesi lama berakhir, masuk lagi dengan data baru
    await catat(c, uid, emailBaru, "dj-ubah", dari, ke);
  } else if (aksi === "akses") {
    if (!c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin yang mengatur akses.");
    const dj = Number(d.dj); if (![1, 2].includes(dj)) throw new HttpsError("invalid-argument", "Akses Daily Job: 1 (lihat saja) atau 2 (kelola).");
    await ref.update({ akses: { dj } }); await catat(c, uid, email, "dj-akses", { dj: s.get("akses") ? s.get("akses").dj ?? 2 : 2 }, { dj });
  } else if (aksi === "keluar") {
    await admin.auth().revokeRefreshTokens(uid); await catat(c, uid, email, "dj-keluar");
  } else if (aksi === "info") {
    const u = await admin.auth().getUser(uid); return { terakhirMasuk: u.metadata.lastSignInTime || null, dibuat: u.metadata.creationTime || null };
  } else throw new HttpsError("invalid-argument", "Aksi tidak dikenal.");
  return { ok: true };
});
