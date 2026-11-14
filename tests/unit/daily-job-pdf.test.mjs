// Jalankan: node tests/unit/daily-job-pdf.test.mjs. Laporan PDF tidak boleh galat pada baris tinggi yang terpecah antarhalaman.
import { createRequire } from "module"; const require = createRequire(import.meta.url); const V = "../../public/vendor/";
const { jsPDF } = require(V + "jspdf.umd.min.js"); globalThis.window = { jspdf: { jsPDF } }; globalThis.jspdf = { jsPDF }; require(V + "jspdf.plugin.autotable.min.js");
const H = await import("../../public/js/daily-job-hitung.js"), P = await import("../../public/js/daily-job-pdf.js");
const hari = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); let gagal = 0;
const buat = (n, judul) => Array.from({ length: n }, (_, i) => { const sel = i % 3 !== 0; return { id: "j" + i, kelompokId: "k1", judul: judul(i), kategori: ["Quotation", "RFQ"][i % 2], pic: ["Ega", "Dede"][i % 2], customer: "PT X", status: sel ? "selesai" : "proses", tglMasuk: hari(-300 + i), tglTarget: hari(-298 + i), tglSelesai: sel ? hari(-297 + i) : null, bobot: 2, file: i % 4 ? [{ url: "https://x.test/f" + i }] : [], tautan: [], catatan: [] }; });
for (const [nama, jobs] of [["judul biasa", buat(90, (i) => "Job " + i)], ["judul bertingkat (banyak baris)", buat(90, (i) => `Job ${i}\n`.repeat(3))], ["judul sangat panjang", buat(90, (i) => ("Job " + i + " ").repeat(60))]]) {
  let ok = false, h = 0; try { h = P.buatLaporanPdf({ jsPDF, jobs, r: H.rentang("tahun"), periode: "tahun", kelompok: "Semua", now: H.hariIni() }).internal.getNumberOfPages(); ok = h > 1; } catch (e) { console.log(e.message); }
  if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", "PDF " + nama);
}
process.exit(gagal ? 1 : 0);
