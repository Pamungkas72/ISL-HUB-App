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
  return { uid: a.uid, nama: p.get("nama") || a.token.email || "", kelola: p.get("peran") === "admin", kelompok: p.get("kelompokDJ") || null };
}
async function pastikanKepala(c, kelompokId) {
  if (c.kelola) return;
  const k = await db().doc(`dj_kelompok/${kelompokId}`).get();
  if (!k.exists || !(k.get("kepala") || []).includes(c.uid)) throw new HttpsError("permission-denied", "Hanya kepala divisi kelompok ini yang boleh mengurus anggotanya.");
}
/** Kode unit berikutnya di satu kelompok (STR-01, AGR-02, ...); nomor tidak dipakai ulang. */
async function kodeUnitKelompok(kelompokId) {
  const [k, m] = await Promise.all([db().doc(`dj_kelompok/${kelompokId}`).get(), db().collection("pengguna").where("kelompokDJ", "==", kelompokId).get()]);
  return U.kodeUnitBerikut(k.get("awalan") || U.awalanKelompok(k.get("nama")), m.docs.map((x) => x.get("kodeUnit"))); // awalan boleh diatur di kelompok
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

/** Kode sales berikutnya (SLS-01, SLS-02, ...; tidak memakai ulang nomor). */
async function kodeSalesBerikut() {
  const s = await db().collection("pengguna").get(), maks = s.docs.reduce((m, x) => { const k = String(x.get("kodeSales") || "").match(/^SLS-(\d+)$/); return k ? Math.max(m, +k[1]) : m; }, 0);
  return `SLS-${String(maks + 1).padStart(2, "0")}`;
}
/** Satu akun bisa jadi anggota divisi (kepala atau staf) sekaligus Sales: bisa membuat quotation tanpa akun kedua. aktif=true: peran menjadi Sales dan hak dasar disimpan untuk dikembalikan; aktif=false: dikembalikan. Hanya master atau admin. */
exports.akunJugaSales = onCall(OPSI, async (req) => {
  const c = await pemanggil(req); if (!c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin.");
  const d = req.data || {}, uid = String(d.uid || ""), aktif = !!d.aktif, F = admin.firestore.FieldValue;
  const ref = db().doc(`pengguna/${uid}`), s = await ref.get(), peran = s.exists ? s.get("peran") : null;
  if (!s.exists || s.get("status") !== "aktif" || !["lihat", "dj", "sales"].includes(peran)) throw new HttpsError("failed-precondition", "Akun tidak aktif atau perannya tidak bisa diberi akses Sales.");
  const email = s.get("email");
  if (aktif) {
    if (peran === "sales") return { ok: true }; // sudah Sales
    const kode = s.get("kodeSales") || await kodeSalesBerikut();
    await ref.update({ peran: "sales", jugaSales: true, peranSebelumSales: peran, aksesSebelumSales: s.get("akses") ?? null, akses: { ...(s.get("akses") || {}), qt: 2, cu: 2 }, kodeSales: kode });
    await db().doc(`sales_publik/${uid}`).set({ uid, nama: s.get("nama") || email, kode, targetBulanan: null });
    await catat(c, uid, email, "juga-sales-aktif");
  } else {
    if (peran !== "sales" || !s.get("jugaSales")) throw new HttpsError("failed-precondition", "Akun ini Sales sejak awal atau belum diberi akses Sales.");
    await ref.update({ peran: s.get("peranSebelumSales") || "lihat", akses: s.get("aksesSebelumSales") ?? F.delete(), jugaSales: F.delete(), peranSebelumSales: F.delete(), aksesSebelumSales: F.delete() });
    await db().doc(`sales_publik/${uid}`).delete().catch(() => {});
    await catat(c, uid, email, "juga-sales-nonaktif");
  }
  await admin.auth().revokeRefreshTokens(uid); // menu dan hak baru berlaku di sesi berikutnya
  return { ok: true };
});
/** Lepas jabatan kepala di divisi non-Daily Job (dipakai saat akun pindah ke Daily Job). */
async function lepasDivisi(uid, divisiId) {
  if (!divisiId) return;
  const d = await db().doc(`divisi/${divisiId}`).get();
  if (d.exists && (d.get("kepala") || []).includes(uid)) await d.ref.update({ kepala: (d.get("kepala") || []).filter((x) => x !== uid) });
}
/** Divisi non-Daily Job yang dikepalai pemanggil, beserta anggotanya (hanya nama, email, status). Kepala tidak bisa membaca koleksi pengguna langsung. */
exports.divisiSaya = onCall(OPSI, async (req) => {
  const c = await pemanggil(req);
  const s = await db().collection("divisi").where("kepala", "array-contains", c.uid).get(), hasil = [];
  for (const d of s.docs) {
    if (d.get("arsip")) continue;
    const m = await db().collection("pengguna").where("divisiId", "==", d.id).get();
    hasil.push({ id: d.id, nama: d.get("nama") || "", anggota: m.docs.map((x) => ({ uid: x.id, nama: x.get("nama") || "", email: x.get("email") || "", status: x.get("status") || "aktif", kepala: x.id === c.uid })).sort((a, b) => a.nama.localeCompare(b.nama, "id")) });
  }
  return { divisi: hasil };
});
/** Kepala divisi menonaktifkan atau mengaktifkan anggota divisinya (izin modul tetap diatur admin/master). Master/admin juga boleh. */
exports.divisiAturAnggota = onCall(OPSI, async (req) => {
  const c = await pemanggil(req), d = req.data || {}, uid = String(d.uid || ""), aksi = String(d.aksi || "");
  if (!["nonaktif", "aktif"].includes(aksi)) throw new HttpsError("invalid-argument", "Aksi tidak dikenal.");
  const ref = db().doc(`pengguna/${uid}`), s = await ref.get(); if (!s.exists || !s.get("divisiId")) throw new HttpsError("not-found", "Anggota divisi tidak ada.");
  if (!c.kelola) {
    const dv = await db().doc(`divisi/${s.get("divisiId")}`).get();
    if (!dv.exists || !(dv.get("kepala") || []).includes(c.uid)) throw new HttpsError("permission-denied", "Hanya kepala divisi ini yang boleh mengurus anggotanya.");
    if (uid === c.uid) throw new HttpsError("failed-precondition", "Kepala tidak menonaktifkan dirinya sendiri.");
  }
  if (["master", "admin"].includes(s.get("peran"))) throw new HttpsError("permission-denied", "Akun admin tidak diatur dari sini.");
  const mati = aksi === "nonaktif"; await admin.auth().updateUser(uid, { disabled: mati }); if (mati) await admin.auth().revokeRefreshTokens(uid);
  await ref.update({ status: mati ? "nonaktif" : "aktif" }); await catat(c, uid, s.get("email"), "divisi-" + aksi);
  return { ok: true };
});

/** Kelompokkan akun yang sudah disetujui tetapi belum punya kelompok (peran Lihat saja tanpa peran siap pakai) menjadi anggota atau kepala divisi, dengan akses Daily Job kelola. Hanya master atau admin. */
exports.djKelompokkan = onCall(OPSI, async (req) => {
  const c = await pemanggil(req); if (!c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin.");
  const d = req.data || {}, uid = String(d.uid || ""), kelompokId = String(d.kelompokId || ""), kepala = d.jabatan === "kepala";
  const ref = db().doc(`pengguna/${uid}`), s = await ref.get();
  if (!s.exists || s.get("status") !== "aktif" || !["lihat", "sales"].includes(s.get("peran")) || s.get("kelompokDJ")) throw new HttpsError("failed-precondition", "Akun ini tidak bisa dikelompokkan ke Daily Job (sudah anggota kelompok, admin, atau tidak aktif).");
  await lepasDivisi(uid, s.get("divisiId")); // satu akun satu divisi
  const kel = kelompokId ? await db().doc(`dj_kelompok/${kelompokId}`).get() : null;
  if (!kel || !kel.exists || kel.get("arsip")) throw new HttpsError("not-found", "Pilih kelompok yang masih aktif.");
  const F = admin.firestore.FieldValue, sales = s.get("peran") === "sales"; // akun Sales tetap Sales (bisa membuat quotation) dan hanya bertambah kelompok
  await ref.update({ ...(sales ? { akses: { ...(s.get("akses") || {}), dj: 2 }, jugaSales: F.delete(), peranSebelumSales: F.delete(), aksesSebelumSales: F.delete() } : { peran: "dj", akses: { mr: 0, qt: 0, cu: 0, dj: 2, lg: 0 } }), kelompokDJ: kelompokId, kodeUnit: await kodeUnitKelompok(kelompokId), divisiId: F.delete() });
  if (kepala) await kel.ref.update({ kepala: [uid] }); // satu kepala per kelompok
  await admin.auth().revokeRefreshTokens(uid); // menu dan hak baru berlaku di sesi berikutnya
  await catat(c, uid, s.get("email"), kepala ? "dj-kelompok-kepala" : "dj-kelompok-anggota");
  return { ok: true };
});

/** Daftarkan nomor telepon akun sebagai kunci masuk (dj_login/p_<nomor> -> email). Pemilik akun, admin, atau master; tanpa uid = semua akun aktif (admin/master). Nomor yang sudah dipakai akun lain dilewati. */
async function sinkronTelepon(uid) {
  const ref = db().doc(`pengguna/${uid}`), s = await ref.get(); if (!s.exists || s.get("status") !== "aktif") return "lewat";
  const email = String(s.get("email") || "").toLowerCase(), tel = U.normalTelepon(s.get("telepon")), lama = s.get("aliasTelepon") || "";
  if (!email || email.endsWith("@" + U.DOMAIN)) return "lewat"; // akun tim dengan username punya aliasnya sendiri
  const kunci = tel ? `p_${tel}` : "";
  if (lama && lama !== kunci) { const d = await db().doc(`dj_login/${lama}`).get(); if (d.exists && d.get("email") === email) await d.ref.delete(); } // nomor lama dilepas
  if (!kunci) { if (lama) await ref.update({ aliasTelepon: admin.firestore.FieldValue.delete() }); return "lewat"; }
  const d = await db().doc(`dj_login/${kunci}`).get();
  if (d.exists && d.get("email") !== email && lama !== kunci) return "bentrok"; // milik akun lain (bukan alias lama kita)
  if (!d.exists || d.get("email") !== email) await d.ref.set({ email }); // email akun berubah: alias ikut diperbarui
  if (lama !== kunci) await ref.update({ aliasTelepon: kunci });
  return d.exists && d.get("email") === email ? "sama" : "baru";
}
exports.loginTeleponSinkron = onCall(OPSI, async (req) => {
  const c = await pemanggil(req), uid = String((req.data && req.data.uid) || "");
  if (uid) { if (uid !== c.uid && !c.kelola) throw new HttpsError("permission-denied", "Hanya pemilik akun, admin, atau master."); return { hasil: await sinkronTelepon(uid) }; }
  if (!c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin.");
  const s = await db().collection("pengguna").where("status", "==", "aktif").get(), n = { baru: 0, sama: 0, bentrok: 0, lewat: 0 };
  for (const x of s.docs) { try { n[await sinkronTelepon(x.id)]++; } catch (_) { n.lewat++; } }
  return { jumlah: n };
});

/** Nonaktifkan semua akun anggota lama yang dibuat dengan username (email @dj.isl-hub.app); anggota mendaftar ulang dengan email. Hanya master. { hitung: true } hanya menghitung. */
exports.djNonaktifkanAkunUsername = onCall(OPSI, async (req) => {
  const c = await pemanggil(req); if (String((req.auth.token.email) || "").toLowerCase() !== EMAIL_MASTER) throw new HttpsError("permission-denied", "Hanya master.");
  const s = await db().collection("pengguna").where("peran", "==", "dj").get(), target = s.docs.filter((x) => String(x.get("email") || "").toLowerCase().endsWith("@" + U.DOMAIN) && x.get("status") === "aktif");
  if (req.data && req.data.hitung) return { jumlah: target.length, nama: target.map((x) => x.get("nama") || x.get("username") || "").slice(0, 30) };
  for (const x of target) { await admin.auth().updateUser(x.id, { disabled: true }).catch(() => {}); await admin.auth().revokeRefreshTokens(x.id).catch(() => {}); await x.ref.update({ status: "nonaktif" }); await catat(c, x.id, x.get("email"), "dj-nonaktif-username"); }
  return { jumlah: target.length };
});

/** Nama anggota aktif satu kelompok untuk memilih dan memvalidasi PIC. Boleh dipanggil anggota kelompok itu, admin, atau master; hanya nama yang dikembalikan (tanpa telepon, email, atau akses). */
exports.djNamaTim = onCall(OPSI, async (req) => {
  const c = await pemanggil(req), kelompokId = String((req.data && req.data.kelompokId) || "");
  if (!kelompokId || !(c.kelola || c.kelompok === kelompokId)) throw new HttpsError("permission-denied", "Hanya anggota kelompok ini yang boleh melihat daftar PIC.");
  const s = await db().collection("pengguna").where("kelompokDJ", "==", kelompokId).get();
  return { nama: s.docs.filter((x) => x.get("status") === "aktif").map((x) => String(x.get("nama") || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "id")) };
});

exports.djDaftarTim = onCall(OPSI, async (req) => {
  const c = await pemanggil(req), kelompokId = String((req.data && req.data.kelompokId) || ""); await pastikanKepala(c, kelompokId);
  const s = await db().collection("pengguna").where("kelompokDJ", "==", kelompokId).get();
  return { anggota: s.docs.map((x) => ({ uid: x.id, nama: x.get("nama") || "", email: x.get("email") || "", username: x.get("username") || "", telepon: x.get("telepon") || "", emailKontak: x.get("emailKontak") || "", status: x.get("status") || "aktif" })).sort((a, b) => a.nama.localeCompare(b.nama, "id")) };
});

exports.djAturAnggota = onCall(OPSI, async (req) => {
  const c = await pemanggil(req), d = req.data || {}, uid = String(d.uid || ""), aksi = String(d.aksi || "");
  const ref = db().doc(`pengguna/${uid}`), s = await ref.get();
  if (!s.exists || !s.get("kelompokDJ") || ["master", "admin"].includes(s.get("peran"))) throw new HttpsError("not-found", "Anggota kelompok tidak ada.");
  await pastikanKepala(c, s.get("kelompokDJ")); const email = s.get("email");
  if (aksi === "nonaktif" || aksi === "aktif") {
    const mati = aksi === "nonaktif"; await admin.auth().updateUser(uid, { disabled: mati }); if (mati) await admin.auth().revokeRefreshTokens(uid);
    await ref.update({ status: mati ? "nonaktif" : "aktif" }); await catat(c, uid, email, "dj-" + aksi);
  } else if (aksi === "hapus") {
    if (s.get("peran") !== "dj") throw new HttpsError("failed-precondition", "Hanya akun anggota divisi (bukan Sales) yang bisa dihapus dari sini. Nonaktifkan akun Sales.");
    await admin.auth().deleteUser(uid).catch((err) => { if (err.code !== "auth/user-not-found") throw err; });
    await lepasAlias(s.get("alias") || []); await ref.delete();
    const tk = await db().collection("dj_token").where("uid", "==", uid).get(); await Promise.all(tk.docs.map((x) => x.ref.delete())); await catat(c, uid, email, "dj-hapus");
  } else if (aksi === "kepala" || aksi === "anggota" || aksi === "kelompok") {
    if (!c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin yang mengatur jabatan dan kelompok.");
    const lamaId = s.get("kelompokDJ"), baruId = aksi === "kelompok" ? String(d.kelompokId || "") : lamaId;
    if (aksi === "kelompok") {
      if (baruId === lamaId) return { ok: true };
      const kb = baruId ? await db().doc(`dj_kelompok/${baruId}`).get() : null;
      if (!kb || !kb.exists) throw new HttpsError("not-found", "Kelompok tujuan tidak ada.");
      if (kb.get("arsip")) throw new HttpsError("failed-precondition", "Kelompok tujuan diarsipkan.");
      const kl = await db().doc(`dj_kelompok/${lamaId}`).get(); // pindah kelompok: jabatan kepala di kelompok lama dilepas
      if (kl.exists && (kl.get("kepala") || []).includes(uid)) await kl.ref.update({ kepala: (kl.get("kepala") || []).filter((x) => x !== uid) });
      await ref.update({ kelompokDJ: baruId, kodeUnit: await kodeUnitKelompok(baruId) }); // kode unit mengikuti kelompok baru
    } else {
      const kl = db().doc(`dj_kelompok/${lamaId}`), ks = await kl.get(); if (!ks.exists) throw new HttpsError("not-found", "Kelompok tidak ada.");
      await kl.update({ kepala: aksi === "kepala" ? [uid] : (ks.get("kepala") || []).filter((x) => x !== uid) });
    }
    await admin.auth().revokeRefreshTokens(uid); await catat(c, uid, email, "dj-" + aksi);
  } else if (aksi === "ubah") {
    const nama = String(d.nama || s.get("nama") || "").trim().slice(0, 80), telepon = d.telepon ? U.normalTelepon(d.telepon) : "", emailKontak = String(d.emailKontak || "").trim().toLowerCase();
    if (d.telepon && !telepon) throw new HttpsError("invalid-argument", "Nomor telepon tidak valid."); if (emailKontak && !U.emailValid(emailKontak)) throw new HttpsError("invalid-argument", "Format email tidak valid.");
    const dari = {}, ke = {}, ubah = (k, a, b2) => { if (String(a || "") !== String(b2 || "")) { dari[k] = a || null; ke[k] = b2 || null; } };
    ubah("nama", s.get("nama"), nama); ubah("telepon", s.get("telepon"), telepon); ubah("emailKontak", s.get("emailKontak"), emailKontak);
    await ref.update({ nama, telepon: telepon || null, emailKontak: emailKontak || null }); await admin.auth().updateUser(uid, { displayName: nama });
    await sinkronTelepon(uid).catch(() => {}); // nomor teleponnya ikut menjadi kunci masuk
    await catat(c, uid, email, "dj-ubah", dari, ke);
  } else if (aksi === "akses") {
    if (!c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin yang mengatur akses.");
    const dj = Number(d.dj); if (![1, 2].includes(dj)) throw new HttpsError("invalid-argument", "Akses Daily Job: 1 (lihat saja) atau 2 (kelola).");
    await ref.update({ akses: { ...(s.get("akses") || {}), dj } }); await catat(c, uid, email, "dj-akses", { dj: s.get("akses") ? s.get("akses").dj ?? 2 : 2 }, { dj });
  } else if (aksi === "keluarkan") {
    if (!c.kelola) throw new HttpsError("permission-denied", "Hanya master atau admin.");
    const lamaId = s.get("kelompokDJ"), kl = lamaId ? await db().doc(`dj_kelompok/${lamaId}`).get() : null;
    if (kl && kl.exists && (kl.get("kepala") || []).includes(uid)) await kl.ref.update({ kepala: (kl.get("kepala") || []).filter((x) => x !== uid) });
    const F = admin.firestore.FieldValue, sales = s.get("peran") === "sales"; // akun Sales tetap Sales; hanya keluar dari kelompok
    await ref.update({ kelompokDJ: F.delete(), kodeUnit: F.delete(), ...(sales ? { akses: { ...(s.get("akses") || {}), dj: 0 }, jugaSales: F.delete(), peranSebelumSales: F.delete(), aksesSebelumSales: F.delete() } : { peran: "lihat", akses: { mr: 0, qt: 0, cu: 0, dj: 0, lg: 0 } }) });
    await admin.auth().revokeRefreshTokens(uid); await catat(c, uid, email, "dj-keluarkan");
  } else if (aksi === "keluar") {
    await admin.auth().revokeRefreshTokens(uid); await catat(c, uid, email, "dj-keluar");
  } else if (aksi === "info") {
    const u = await admin.auth().getUser(uid); return { terakhirMasuk: u.metadata.lastSignInTime || null, dibuat: u.metadata.creationTime || null };
  } else throw new HttpsError("invalid-argument", "Aksi tidak dikenal.");
  return { ok: true };
});
