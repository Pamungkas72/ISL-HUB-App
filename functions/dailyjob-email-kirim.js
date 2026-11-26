// Pengirim antrean `dj_email` lewat Resend (kunci: secret RESEND_API_KEY, bukan di repo). Antrean diisi dailyjob-email.js.
// Langsung bila kirimPada sudah lewat; yang ditunda (tunda menit / jam tertentu) diambil penjadwal tiap 5 menit.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { kirim, kirimUji } = require("./dailyjob-email-kirim-isi");
const N = require("./notif-pengaturan");
const { buatLampiran } = require("./notif-laporan-jalan");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const EMAIL_MASTER = "codcodan1@gmail.com", REGION = "asia-southeast2", MACET_MS = 10 * 60e3;

/** Klaim lalu kirim satu dokumen antrean. Transaksi mencegah dua pengirim memproses dokumen yang sama. */
async function proses(ref) {
  const d = await admin.firestore().runTransaction(async (t) => {
    const x = (await t.get(ref)).data();
    if (!x || x.status !== "antre" || (x.kirimPada || 0) > Date.now()) return null;
    t.update(ref, { status: "mengirim", diklaim: Date.now() }); return x;
  });
  if (d) await ref.update((await kirim(d, RESEND_API_KEY.value(), fetch, buatLampiran)) || { status: "antre" });
}

exports.kirimEmailCustomer = onDocumentCreated({ document: "dj_email/{id}", region: REGION, secrets: [RESEND_API_KEY] }, (ev) => proses(ev.data.ref));

exports.kirimEmailTerjadwal = onSchedule({ schedule: "every 5 minutes", timeZone: "Asia/Jakarta", region: REGION, secrets: [RESEND_API_KEY] }, async () => {
  const db = admin.firestore(), now = Date.now();
  const macet = await db.collection("dj_email").where("status", "==", "mengirim").get(); // pengirim sebelumnya berhenti di tengah jalan
  for (const m of macet.docs) if ((m.get("diklaim") || 0) < now - MACET_MS) await m.ref.update({ status: "antre" });
  const antre = (await db.collection("dj_email").where("status", "==", "antre").get()).docs.filter((x) => (x.get("kirimPada") || 0) <= now).slice(0, 50);
  for (const a of antre) await proses(a.ref);
});

/** Kirim uji: hanya master atau admin, hanya ke alamat akun pemanggil, dengan data contoh. */
exports.kirimUjiNotif = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async (req) => {
  const a = req.auth; if (!a || !a.token.email) throw new HttpsError("unauthenticated", "Masuk dulu.");
  const email = String(a.token.email).toLowerCase();
  if (email !== EMAIL_MASTER) { const p = await admin.firestore().doc(`pengguna/${a.uid}`).get(); if (!p.exists || p.get("status") !== "aktif" || p.get("peran") !== "admin") throw new HttpsError("permission-denied", "Hanya master atau admin."); }
  const d = req.data || {}, subjek = String(d.subjek || "").slice(0, 200), isi = String(d.isi || "").slice(0, 5000);
  if (!subjek.trim() || !isi.trim()) throw new HttpsError("invalid-argument", "Subjek dan isi wajib diisi.");
  const r = await kirimUji(email, "[UJI] " + N.rapikanSubjek(N.render(subjek, N.CONTOH, false)), N.render(isi, N.CONTOH), RESEND_API_KEY.value());
  if (!r.ok) throw new HttpsError("failed-precondition", `Resend menolak (${r.kode}): ${r.galat}`);
  return { ke: email };
});
