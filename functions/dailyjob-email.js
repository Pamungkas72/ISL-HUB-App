// Pemicu: tiap job Tracking dibuat atau selesai, masukkan email customer ke antrean `dj_email` (sekali per job dan tahap). Pengirim email dipasang terpisah.
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const E = require("./dailyjob-email-customer");

exports.emailCustomerDailyJob = onDocumentWritten({ document: "dj_job/{id}", region: "asia-southeast2" }, async (ev) => {
  const sebelum = ev.data.before.exists ? ev.data.before.data() : null, sesudah = ev.data.after.exists ? ev.data.after.data() : null, tahap = E.tahapBaru(sebelum, sesudah);
  if (!tahap.length) return;
  const db = admin.firestore(), daftar = (await db.collection("cu_customers").get()).docs.map((d) => ({ id: d.id, ...d.data() })), c = E.cariCustomer(sesudah.customer, daftar);
  const dok = (await db.doc(`notif_pengaturan/${sesudah.kelompokId || "-"}`).get()).data() || null;
  for (const t of tahap) { const a = E.antrean(t, ev.params.id, sesudah, c, dok); if (!a) continue; const { kunci, doc } = a; await db.collection("dj_email").doc(kunci).create(doc).catch((err) => { if (err.code !== 6) throw err; }); } // 6 = sudah ada
});
