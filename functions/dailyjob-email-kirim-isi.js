// Pengiriman satu dokumen antrean `dj_email` lewat Resend (murni selain fetch, diuji tests/unit/daily-job-email-kirim.test.js).
const DARI = "ISL Tracking <notifikasi@notif.islogistik.id>", BALAS = "market@indosukseslogistik.com";

/** Kembalikan perubahan status untuk dokumen antrean, atau null bila tidak perlu dikirim (tanpa-email / sudah diproses). */
async function kirim(d, kunciApi, ambil = fetch) {
  if (d.status !== "antre" || !d.ke) return null;
  const res = await ambil("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${kunciApi}`, "Content-Type": "application/json", "Idempotency-Key": `dj_email-${d.jobId}-${d.tahap}` },
    body: JSON.stringify({ from: DARI, to: [d.ke], reply_to: BALAS, subject: d.subjek, text: d.isi }),
  });
  return res.ok ? { status: "terkirim", dikirim: Date.now() } : { status: "gagal", kode: res.status, galat: String(await res.text()).slice(0, 300) };
}
module.exports = { kirim };
