// Pengirim antrean `dj_email` lewat Resend (kunci: secret RESEND_API_KEY, bukan di repo). Antrean diisi dailyjob-email.js.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const DARI = "ISL Tracking <notifikasi@notif.islogistik.id>", BALAS = "market@indosukseslogistik.com";

/** Kirim satu dokumen antrean; kembalikan perubahan status untuk ditulis ke dokumen. Murni selain fetch (diuji dengan fetch tiruan). */
async function kirim(d, kunciApi, ambil = fetch) {
  if (d.status !== "antre" || !d.ke) return null; // tanpa-email atau sudah diproses
  const res = await ambil("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${kunciApi}`, "Content-Type": "application/json", "Idempotency-Key": `dj_email-${d.jobId}-${d.tahap}` },
    body: JSON.stringify({ from: DARI, to: [d.ke], reply_to: BALAS, subject: d.subjek, text: d.isi }),
  });
  return res.ok ? { status: "terkirim", dikirim: Date.now() } : { status: "gagal", kode: res.status, galat: String(await res.text()).slice(0, 300) };
}

exports.kirimEmailCustomer = onDocumentCreated({ document: "dj_email/{id}", region: "asia-southeast2", secrets: [RESEND_API_KEY] }, async (ev) => {
  const hasil = await kirim(ev.data.data(), RESEND_API_KEY.value());
  if (hasil) await ev.data.ref.update(hasil);
});
exports.kirimEmailBantu = { kirim };
