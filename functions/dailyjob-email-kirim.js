// Pengirim antrean `dj_email` lewat Resend (kunci: secret RESEND_API_KEY, bukan di repo). Antrean diisi dailyjob-email.js dan notif-laporan-jalan.js.
// Langsung bila kirimPada sudah lewat; yang ditunda atau menunggu kuota diambil penjadwal tiap 5 menit (urutan masuk). Kuota: notif-kuota-jalan.js.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { kirim, kirimUji, daftarKe } = require("./dailyjob-email-kirim-isi");
const N = require("./notif-pengaturan");
const Q = require("./notif-kuota-jalan");
const { buatLampiran } = require("./notif-laporan-jalan");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const EMAIL_MASTER = "codcodan1@gmail.com", REGION = "asia-southeast2", MACET_MS = 10 * 60e3;
const hapus = () => admin.firestore.FieldValue.delete();

/** Klaim, reservasi kuota, lalu kirim satu dokumen antrean. Kuota penuh: kembali ke antre dengan penanda menunggu kuota. */
async function proses(ref) {
  const d = await admin.firestore().runTransaction(async (t) => {
    const x = (await t.get(ref)).data();
    if (!x || x.status !== "antre" || (x.kirimPada || 0) > Date.now()) return null;
    t.update(ref, { status: "mengirim", diklaim: Date.now() }); return x;
  });
  if (!d) return false;
  const n = daftarKe(d).length;
  if (n && !(await Q.reservasi(n))) { await ref.update({ status: "antre", menunggu: "kuota", diklaim: hapus() }); return false; }
  let hasil;
  try { hasil = await kirim(d, RESEND_API_KEY.value(), fetch, buatLampiran); } catch (er) { await Q.kembalikan(n); await ref.update({ status: "antre", diklaim: hapus() }); throw er; }
  if (!hasil || hasil.status !== "terkirim") await Q.kembalikan(n); // tidak terkirim: kuota dikembalikan
  if (hasil && hasil.kode === 429) { await Q.tandaiPenuh(); await ref.update({ status: "antre", menunggu: "kuota", diklaim: hapus() }); return false; }
  await ref.update({ ...(hasil || { status: "antre" }), menunggu: hapus(), diklaim: hapus() }); return !!hasil && hasil.status === "terkirim";
}

/** Dokumen baru: kirim langsung, kecuali masih ada email lain yang menunggu kuota (urutan masuk dijaga penjadwal). */
exports.kirimEmailCustomer = onDocumentCreated({ document: "dj_email/{id}", region: REGION, secrets: [RESEND_API_KEY] }, async (ev) => {
  const antri = await admin.firestore().collection("dj_email").where("status", "==", "antre").where("menunggu", "==", "kuota").limit(1).get();
  if (!antri.empty) return;
  await proses(ev.data.ref);
});

exports.kirimEmailTerjadwal = onSchedule({ schedule: "every 5 minutes", timeZone: "Asia/Jakarta", region: REGION, secrets: [RESEND_API_KEY] }, async () => {
  const db = admin.firestore(), now = Date.now();
  const macet = await db.collection("dj_email").where("status", "==", "mengirim").get(); // pengirim sebelumnya berhenti di tengah jalan
  for (const m of macet.docs) if ((m.get("diklaim") || 0) < now - MACET_MS) await m.ref.update({ status: "antre" });
  if (await Q.hariPenuh(now)) return; // kuota hari ini habis: tunggu reset 00.00 UTC
  const antre = (await db.collection("dj_email").where("status", "==", "antre").get()).docs.filter((x) => (x.get("kirimPada") || 0) <= now).sort((a, b) => (a.get("dibuat") || 0) - (b.get("dibuat") || 0)).slice(0, 50);
  for (const a of antre) { if (!(await proses(a.ref)) && (await Q.hariPenuh(Date.now()))) break; }
});

/** Kirim uji: hanya master atau admin, hanya ke alamat akun pemanggil, dengan data contoh. Ikut menghitung kuota. */
exports.kirimUjiNotif = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async (req) => {
  const a = req.auth; if (!a || !a.token.email) throw new HttpsError("unauthenticated", "Masuk dulu.");
  const email = String(a.token.email).toLowerCase();
  if (email !== EMAIL_MASTER) { const p = await admin.firestore().doc(`pengguna/${a.uid}`).get(); if (!p.exists || p.get("status") !== "aktif" || p.get("peran") !== "admin") throw new HttpsError("permission-denied", "Hanya master atau admin."); }
  const d = req.data || {}, subjek = String(d.subjek || "").slice(0, 200), isi = String(d.isi || "").slice(0, 5000);
  if (!subjek.trim() || !isi.trim()) throw new HttpsError("invalid-argument", "Subjek dan isi wajib diisi.");
  if (!(await Q.reservasi(1))) throw new HttpsError("resource-exhausted", "Kuota email hari ini atau bulan ini sudah habis. Email uji ditunda agar tidak mengambil jatah customer.");
  const r = await kirimUji(email, "[UJI] " + N.rapikanSubjek(N.render(subjek, N.CONTOH, false)), N.render(isi, N.CONTOH), RESEND_API_KEY.value());
  if (!r.ok) { await Q.kembalikan(1); throw new HttpsError("failed-precondition", `Resend menolak (${r.kode}): ${r.galat}`); }
  return { ke: email };
});
