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
eq("pembanding: bulan lalu", H.rentangSebelum("bulan", ["2026-11-01", "2026-11-30"]), ["2026-10-01", "2026-10-31"]);
eq("pembanding: tahun lalu", H.rentangSebelum("tahun", ["2026-01-01", "2026-12-31"]), ["2025-01-01", "2025-12-31"]);
eq("pembanding: minggu lalu", H.rentangSebelum("minggu", ["2026-11-09", "2026-11-15"]), ["2026-11-02", "2026-11-08"]);
eq("pembanding: rentang 10 hari", H.rentangSebelum("rentang", ["2026-11-11", "2026-11-20"]), ["2026-11-01", "2026-11-10"]);
eq("mode sumbu", [H.modeBin(["2026-11-09", "2026-11-15"]), H.modeBin(["2026-11-01", "2026-11-30"]), H.modeBin(["2026-01-01", "2026-12-31"])], ["hari", "minggu", "tahun"]);
const sr = H.seriKpi(J, r, now);
eq("seri KPI: selesai per minggu", sr.selesai, [0, 1, 1, 0, 0, 0]);
eq("seri KPI: terlambat menurut target", sr.telat.reduce((a, b) => a + b, 0), 2);
const dh = H.deretHarian(J, ["2026-11-01", "2026-11-30"], now);
eq("kumulatif harian berhenti di hari ini", [dh.length, dh[dh.length - 1].masuk, dh[dh.length - 1].selesai], [13, 4, 2]);
eq("usia backlog", H.usiaBacklog(J, now).map((x) => x.n), [2, 0, 1, 0]);
eq("komposisi status", H.hitungStatus(J, r, now), { selesai: 2, terlambat: 1, tunggu: 0, proses: 2 });
eq("tabel per PIC: Rina", (({ nama, selesai, masuk }) => ({ nama, selesai, masuk }))(H.perDetail(J, "pic", r, now).find((o) => o.nama === "Rina")), { nama: "Rina", selesai: 1, masuk: 2 });
const gk = H.kelompokkan(J, "kategori", now);
eq("kelompok: yang terlambat di atas", [gk[0].nama, gk[0].telat], ["Monitoring kasus", 1]);
eq("kelompok per status", H.kelompokkan(J, "status", now).map((g) => g.nama).sort(), ["Baru", "Dikerjakan", "Selesai"]);
const kk = { masuk: 42, selesai: 37, persenSelesai: 76, persenTepat: 70, rataHari: 5.8, terlambat: 6 }, pp = { selesai: 25, persenTepat: 84 };
const kt = [{ nama: "Monitoring Kasus", rataHari: 12, terlambat: 3 }, { nama: "Dokumen Kontrak", rataHari: 10, terlambat: 3 }, { nama: "Quotation", rataHari: 3.6, terlambat: 0 }];
const po = H.buatPoin({ k: kk, pk: pp, kat: kt, usia: [{ n: 9 }, { n: 2 }, { n: 0 }, { n: 8 }], lab: "September" });
eq("poin: selesai naik", po[0], { t: "ok", teks: "37 job selesai dari 42 masuk (76%), naik 12 job dari September." });
eq("poin: ketepatan turun >= 5 poin = merah", po[1], { t: "er", teks: "Ketepatan waktu 70%, turun 14 poin dari September (84%)." });
eq("poin: paling lama", po[2].teks, "Rata-rata penyelesaian 5,8 hari; paling lama Monitoring Kasus (12 hari) dan Dokumen Kontrak (10 hari).");
eq("poin: terlambat dan job tua", po[3].teks, "6 job terlambat dan 8 job aktif berusia lebih dari 14 hari, terbanyak di Monitoring Kasus dan Dokumen Kontrak.");
eq("poin: tanpa masalah", H.buatPoin({ k: { masuk: 3, selesai: 3, persenSelesai: 100, persenTepat: 100, rataHari: 2, terlambat: 0 }, pk: null, kat: [], usia: [{ n: 1 }, { n: 0 }, { n: 0 }, { n: 0 }], lab: "x" }).map((x) => x.t), ["ok", "ok", "ok", "ok"]);
process.exit(gagal ? 1 : 0);
