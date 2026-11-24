// Jalankan: node tests/unit/daily-job-pdf-trailer.test.mjs. Laporan PDF Trailer tidak boleh galat, termasuk saat data kosong atau banyak.
import { createRequire } from "module"; const require = createRequire(import.meta.url); const V = "../../public/vendor/";
const { jsPDF } = require(V + "jspdf.umd.min.js"); globalThis.window = { jspdf: { jsPDF } }; globalThis.jspdf = { jsPDF }; require(V + "jspdf.plugin.autotable.min.js");
const H = await import("../../public/js/daily-job-hitung.js"), T = await import("../../public/js/daily-job-trailer-hitung.js"), P = await import("../../public/js/daily-job-pdf-trailer.js");
const now = H.hariIni(), r = H.rentang("tahun"), hari = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); let gagal = 0;
const W = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 16), jenis = ["impor", "ekspor", "repo", "domestik"];
const buat = (n) => Array.from({ length: n }, (_, i) => { const j = jenis[i % 4], t = { siap: W(-9), [j === "ekspor" ? "ambilmt" : "pickup"]: W(-8) }; if (i % 3) { t[j === "ekspor" ? "stuffing" : j === "repo" ? "grounded" : "bongkar"] = W(-6); }
  return { id: "j" + i, status: "proses", judul: "DO-" + i, customer: "PT Contoh " + (i % 7), tglMasuk: hari(-10), kelompokId: "k1", rinci: { jenis: j, asal: "Lini 1", tujuan: ["Cikarang", "Bekasi", "Cibitung"][i % 3], noDo: "DO-" + i, tglKirim: hari(-8), vendor: i % 2 ? "CV Vendor " + (i % 5) : "Internal", cost: 1500000 + (i % 9) * 150000, tglBayar: i % 5 === 0 ? hari(-3) : null, tahap: t } }; });
for (const [nama, jobs] of [["kosong", []], ["30 shipment", buat(30)], ["300 shipment (tabel lampiran terpecah)", buat(300)]]) {
  let ok = false; try { const js = jobs, d = P.buatLaporanTrailerPdf({ jsPDF, jobs: js, r, periode: "tahun", now, k: T.hitungTrailer(js, r, now), banding: T.bandingTarif(js, r) }); ok = d.internal.getNumberOfPages() >= 2; require("fs").writeFileSync(process.env.PDF_OUT || "/dev/null", Buffer.from(d.output("arraybuffer"))); } catch (e) { console.log(e.stack.split("\n").slice(0, 3).join(" | ")); }
  if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", "PDF Trailer " + nama);
}
process.exit(gagal ? 1 : 0);
