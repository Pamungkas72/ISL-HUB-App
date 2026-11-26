// Pengiriman dokumen antrean `dj_email` lewat Resend (murni selain fetch, diuji tests/unit/daily-job-email-kirim.test.js).
const DARI = "ISL Tracking <notifikasi@notif.islogistik.id>", BALAS = "market@indosukseslogistik.com";
const daftarKe = (d) => (Array.isArray(d.kepada) && d.kepada.length ? d.kepada : d.ke ? [d.ke] : []);

/** Kembalikan perubahan status untuk dokumen antrean, atau null bila tidak perlu dikirim (tanpa-email / sudah diproses).
 *  buatLampiran(d.lampiran) -> { nama, base64 } atau null (tidak ada isi: dilewati). */
async function kirim(d, kunciApi, ambil = fetch, buatLampiran = null) {
  const ke = daftarKe(d); if (d.status !== "antre" || !ke.length) return null;
  const badan = { from: DARI, to: ke, reply_to: BALAS, subject: d.subjek, text: d.isi };
  if (d.lampiran) {
    if (!buatLampiran) return { status: "gagal", galat: "Pembuat lampiran tidak tersedia." };
    const l = await buatLampiran(d.lampiran); if (!l) return { status: "dilewati", galat: "Tidak ada isi laporan." };
    badan.attachments = [{ filename: l.nama, content: l.base64 }];
  }
  const res = await ambil("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${kunciApi}`, "Content-Type": "application/json", "Idempotency-Key": `dj_email-${d.jobId || d.kunci || ke.join()}-${d.tahap}` }, body: JSON.stringify(badan) });
  return res.ok ? { status: "terkirim", dikirim: Date.now() } : { status: "gagal", kode: res.status, galat: String(await res.text()).slice(0, 300) };
}
/** Kirim uji ke satu alamat (pemanggil sendiri); tanpa kunci idempotensi. lampiran: { nama, base64 } opsional. */
async function kirimUji(ke, subjek, isi, kunciApi, ambil = fetch, lampiran = null) {
  const badan = { from: DARI, to: [ke], reply_to: BALAS, subject: subjek, text: isi }; if (lampiran) badan.attachments = [{ filename: lampiran.nama, content: lampiran.base64 }];
  const res = await ambil("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${kunciApi}`, "Content-Type": "application/json" }, body: JSON.stringify(badan) });
  return res.ok ? { ok: true } : { ok: false, kode: res.status, galat: String(await res.text()).slice(0, 300) };
}
module.exports = { kirim, kirimUji, daftarKe };
