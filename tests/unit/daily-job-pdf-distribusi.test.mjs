// Jalankan: node tests/unit/daily-job-pdf-distribusi.test.mjs. Laporan PDF Distribusi tidak boleh galat, termasuk saat data kosong atau banyak.
import { createRequire } from "module"; const require = createRequire(import.meta.url); const V = "../../public/vendor/";
const { jsPDF } = require(V + "jspdf.umd.min.js"); globalThis.window = { jspdf: { jsPDF } }; globalThis.jspdf = { jsPDF }; require(V + "jspdf.plugin.autotable.min.js");
const H = await import("../../public/js/daily-job-hitung.js"), D = await import("../../public/js/daily-job-distribusi-hitung.js"), P = await import("../../public/js/daily-job-pdf-distribusi.js");
const now = H.hariIni(), r = H.rentang("tahun"), hari = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); let gagal = 0;
const W = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 16), kt = ["Bekasi", "Bandung", "Cimahi", "Tangerang"];
const jobs = (n) => Array.from({ length: n }, (_, i) => ({ id: "j" + i, status: "proses", judul: "DJ-" + i, tglMasuk: hari(-5), kelompokId: "k1", rinci: { jenis: "distribusi", tglKirim: hari(-3), jenisArmada: D.JENIS_ARMADA[i % 5], bak: D.TIPE_BAK[i % 6], vendor: i % 3 ? "CV V" + (i % 4) : "Internal", cost: 500000 + (i % 7) * 100000, tglBayar: i % 5 === 0 ? hari(-1) : null, tahap: { siap: W(-4) }, titik: [{ t: "P", nama: "A", kota: "Cikarang", selesai: W(-3) }, ...Array.from({ length: 1 + (i % 3) }, (_, d) => ({ t: "D", nama: "T" + d, kota: kt[(i + d) % 4], selesai: i % 2 ? W(-2) : null }))] } }));
const armada = (n) => Array.from({ length: n }, (_, i) => ({ id: "a" + i, plat: "B " + (1000 + i), jenisArmada: "CDD", bak: "Box", kir: hari(i * 5 - 10), stnk: hari(300), pajak: hari(i * 7), servis: { tglBerikut: hari(i * 3), odo: 1000, kmBerikut: 5000 }, sewa: i % 4 === 0 ? { customer: "PT X" + i, kota: "Surabaya", bentuk: i % 8 ? "driver" : "lepas", mulai: hari(-40), akhir: hari(200) } : null, riwayat: [{ tipe: "servis", tgl: hari(-5), biaya: 1000000 }] }));
for (const [nama, js, ar] of [["kosong", [], []], ["30 pengiriman, 12 kendaraan", jobs(30), armada(12)], ["300 pengiriman, 80 kendaraan (tabel terpecah)", jobs(300), armada(80)]]) {
  let ok = false; try { const d = P.buatLaporanDistribusiPdf({ jsPDF, r, periode: "tahun", now, k: D.hitungDistribusi(js, r, now), arm: ar, rr: D.ringkasRiwayat(ar, r) }); ok = d.internal.getNumberOfPages() >= 2; } catch (e) { console.log(e.stack.split("\n").slice(0, 3).join(" | ")); }
  if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", "PDF Distribusi " + nama);
}
process.exit(gagal ? 1 : 0);
