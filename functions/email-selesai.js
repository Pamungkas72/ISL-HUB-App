// Email otomatis ke customer saat job Tracking berubah jadi "selesai". Kunci Resend: secret RESEND_API_KEY (bukan di repo).
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { cariPenerima, susunEmail } = require("./email-selesai-isi");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const DARI = "ISL Notifikasi <notifikasi@notif.islogistik.id>", BALAS = "market@indosukseslogistik.com";

exports.emailPengirimanSelesai = onDocumentUpdated({ document: "dj_job/{id}", region: "asia-southeast2", secrets: [RESEND_API_KEY] }, async (ev) => {
  const a = ev.data.before.data(), b = ev.data.after.data();
  if (!a || !b || a.status === "selesai" || b.status !== "selesai" || b.emailSelesai) return;
  const db = admin.firestore(), cat = (hasil) => ev.data.after.ref.update({ emailSelesai: { waktu: admin.firestore.FieldValue.serverTimestamp(), ...hasil } });
  const kel = await db.doc(`dj_kelompok/${b.kelompokId}`).get();
  if (!kel.exists || kel.get("profil") !== "tracking") return; // hanya kelompok Tracking
  const custs = (await db.collection("cu_customers").get()).docs.map((d) => d.data());
  const p = cariPenerima(custs, b.customer);
  if (!p) return cat({ status: "dilewati", alasan: "Customer tidak punya email kontak" });
  const { subject, html, text } = susunEmail(b, p);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY.value()}`, "Content-Type": "application/json", "Idempotency-Key": `selesai-${ev.params.id}` },
    body: JSON.stringify({ from: DARI, to: [p.email], reply_to: BALAS, subject, html, text }),
  });
  if (!res.ok) { console.error("Resend", res.status, await res.text()); return cat({ status: "gagal", kode: res.status }); }
  return cat({ status: "terkirim", ke: p.email });
});
