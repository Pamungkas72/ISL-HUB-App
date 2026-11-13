// Jalankan: node tests/unit/daily-job.test.mjs
import * as H from "../../public/js/daily-job-hitung.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const now = "2026-11-13"; // Jumat
const J = [
  { id: 1, status: "selesai", tglMasuk: "2026-11-02", tglTarget: "2026-11-05", tglSelesai: "2026-11-05", kategori: "Penawaran", pic: "Rina", bobot: 2 },
  { id: 2, status: "selesai", tglMasuk: "2026-11-03", tglTarget: "2026-11-04", tglSelesai: "2026-11-09", kategori: "Penawaran", pic: "Dimas", bobot: 3 },
  { id: 3, status: "proses", tglMasuk: "2026-11-10", tglTarget: "2026-11-11", kategori: "Monitoring kasus", pic: "Rina" },
  { id: 4, status: "baru", tglMasuk: "2026-11-12", tglTarget: "2026-11-13", tglMulai: "2026-11-13", pic: "Sari" },
  { id: 5, status: "baru", tglMasuk: "2026-10-30", tglTarget: "2026-11-20", tglMulai: "2026-11-16", pic: "Sari" },
];
const r = H.rentang("bulan", now);
eq("rentang bulan", r, ["2026-11-01", "2026-11-30"]);
eq("rentang minggu", H.rentang("minggu", now), ["2026-11-09", "2026-11-15"]);
const k = H.hitungKpi(J, r, now);
eq("masuk", k.masuk, 4); eq("selesai", k.selesai, 2); eq("tepat waktu %", k.persenTepat, 50);
eq("rata hari", k.rataHari, 4.5); eq("backlog", k.backlog, 3); eq("terlambat", k.terlambat, 1); eq("bobot selesai", k.bobotSelesai, 5);
const p = H.pengingat(J, now);
eq("pengingat", [p.terlambat.map((j) => j.id), p.hariIni.map((j) => j.id), p.segera.map((j) => j.id)], [[3], [4], [5]]);
eq("per kategori Penawaran selesai", H.per(J, "kategori", r).find((o) => o.nama === "Penawaran").selesai, 2);
eq("deret bulan: minggu", H.deret(J, r, "bulan").map((x) => x.k), ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
const slotDi = (jam) => new Date(`2026-11-13T${String(jam).padStart(2, "0")}:05:00+07:00`);
eq("slot 08:05 belum ada", H.slotJatuhTempo([], slotDi(8)), null);
eq("slot 09:05", H.slotJatuhTempo([], slotDi(9)), "2026-11-13#9");
eq("slot 09:05 sudah ditandai", H.slotJatuhTempo(["2026-11-13#9"], slotDi(10)), null);
eq("slot 15:05", H.slotJatuhTempo(["2026-11-13#9"], slotDi(15)), "2026-11-13#14");
eq("slot 18:05", H.slotJatuhTempo([], slotDi(18)), "2026-11-13#17");
eq("label terlambat", H.labelTarget(J[2], now).t, "Terlambat 2 hr");
const kepala = ["No", "Tanggal Diberikan", "PIC", "Kategori Tugas", "Customer / Project", "Deskripsi Tugas", "Deadline", "Tanggal Selesai", "Status Waktu", "Bulan", "Keterangan"];
const ex = H.petaExcel([["Judul"], kepala, [1, 46266, "Rina", "Setup Project PLB", " PT Uji ", "Bisnis model", "2026-09-10", "2026-09-07", "Tepat Waktu", "", "Done"], [2, "2026-09-01", "Dede", "Lainnya 5", "", "Rapat", "", "", "Belum Selesai", "", "Menunggu acc"], [3, "", "", "", "", "", "", "", "", "", ""]]);
eq("impor: 2 job, 1 baris kosong dilewati", [ex.jobs.length, ex.dilewati], [2, 1]);
eq("impor: serial Excel jadi tanggal", ex.jobs[0].tglMasuk, "2026-09-01");
eq("impor: kategori dinormalkan", [ex.jobs[0].kategori, ex.jobs[1].kategori], ["Setup Project", "Lainnya"]);
eq("impor: status dari tanggal selesai dan keterangan", [ex.jobs[0].status, ex.jobs[1].status], ["selesai", "tunggu"]);
eq("impor: Done tidak jadi catatan, keterangan lain jadi catatan", [ex.jobs[0].catatan.length, ex.jobs[1].catatan.length], [0, 1]);
eq("impor: id memakai nomor baris", ex.jobs.map((j) => j.id), ["x3", "x4"]);
eq("impor: tanpa kolom wajib ditolak", !!H.petaExcel([["a"]]).galat, true);
eq("kategori baru: sama tanpa beda huruf besar pakai yang ada", H.rapikanKategori("  quotation ", H.KATEGORI), "Quotation");
eq("kategori baru: nama baru dirapikan", H.rapikanKategori("Visit   Customer ", H.KATEGORI), "Visit Customer");
eq("kategori baru ikut daftar", H.daftarKategori([{ kategori: "Visit Customer" }, { kategori: "Quotation" }]).slice(-1), ["Visit Customer"]);
process.exit(gagal ? 1 : 0);
