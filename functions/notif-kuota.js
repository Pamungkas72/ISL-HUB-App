// Kuota email (murni, diuji tests/unit/notif-kuota.test.js). Resend gratis: 100 email/hari (reset 00.00 UTC) dan 3.000/bulan. Dihitung per alamat penerima.
const BATAS_BAWAAN = { hari: 100, bulan: 3000 };
const hariKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const bulanKey = (ms) => hariKey(ms).slice(0, 7);
const bulat = (x, bawaan) => (Number.isFinite(+x) && +x >= 1 ? Math.min(Math.round(+x), 100000) : bawaan);
/** Batas efektif dari dokumen pengaturan _kuota (bawaan bila kosong atau salah). */
const batas = (dok) => ({ hari: bulat(dok && dok.batasHari, BATAS_BAWAAN.hari), bulan: bulat(dok && dok.batasBulan, BATAS_BAWAAN.bulan) });
/** Boleh kirim n email lagi? */
const izinkan = (pakaiHari, pakaiBulan, n, b) => pakaiHari + n <= b.hari && pakaiBulan + n <= b.bulan;
module.exports = { BATAS_BAWAAN, hariKey, bulanKey, batas, izinkan };
