// Pencatat kuota email di Firestore (transaksi): reservasi sebelum kirim, kembalikan bila tidak jadi terkirim. Dokumen notif_kuota/h_YYYY-MM-DD dan b_YYYY-MM (UTC).
const admin = require("firebase-admin");
const K = require("./notif-kuota");
const db = () => admin.firestore();
const ref = (id) => db().doc(`notif_kuota/${id}`);

/** Reservasi n email; false bila hari ini atau bulan ini sudah penuh. */
async function reservasi(n, now = Date.now()) {
  const rh = ref("h_" + K.hariKey(now)), rb = ref("b_" + K.bulanKey(now)), rp = db().doc("notif_pengaturan/_kuota");
  return db().runTransaction(async (t) => {
    const [h, b, p] = await Promise.all([t.get(rh), t.get(rb), t.get(rp)]), ph = h.get("n") || 0, pb = b.get("n") || 0;
    if (!K.izinkan(ph, pb, n, K.batas(p.data()))) return false;
    t.set(rh, { n: ph + n, tanggal: K.hariKey(now) }); t.set(rb, { n: pb + n, bulan: K.bulanKey(now) }); return true;
  });
}
/** Batalkan reservasi (email tidak jadi terkirim). */
async function kembalikan(n, now = Date.now()) {
  const rh = ref("h_" + K.hariKey(now)), rb = ref("b_" + K.bulanKey(now));
  await db().runTransaction(async (t) => { const [h, b] = await Promise.all([t.get(rh), t.get(rb)]); t.set(rh, { n: Math.max(0, (h.get("n") || 0) - n) }, { merge: true }); t.set(rb, { n: Math.max(0, (b.get("n") || 0) - n) }, { merge: true }); });
}
/** Resend menolak karena kuota (429): anggap hari ini penuh supaya tidak dicoba terus. */
async function tandaiPenuh(now = Date.now()) {
  const p = await db().doc("notif_pengaturan/_kuota").get(); await ref("h_" + K.hariKey(now)).set({ n: K.batas(p.data()).hari, tanggal: K.hariKey(now), dariResend: true }, { merge: true });
}
/** Hari ini sudah penuh? (pemeriksaan murah untuk penjadwal) */
async function hariPenuh(now = Date.now()) {
  const [h, p] = await Promise.all([ref("h_" + K.hariKey(now)).get(), db().doc("notif_pengaturan/_kuota").get()]); return (h.get("n") || 0) >= K.batas(p.data()).hari;
}
module.exports = { reservasi, kembalikan, tandaiPenuh, hariPenuh };
