// Jalankan: node tests/unit/daily-job-notif-tracking.test.js
const N = require("../../functions/dailyjob-tracking-pesan.js");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const wib = (tgl, jam) => new Date(`${tgl}T${String(jam).padStart(2, "0")}:00:00+07:00`), sen = wib("2026-11-23", 9); // Senin
const job = (r, o = {}) => ({ status: "proses", judul: "J", customer: "PT A", ...o, rinci: r });
const J = [
  job({ jenis: "impor", noDo: "DO-1", vendor: "CV A", bayar: "cash", podKirim: { resi: "JNE123", tgl: "2026-11-20" }, tahap: { mtreturn: "2026-11-17T10:00" } }), // Cash, resi ada, belum ditransfer
  job({ jenis: "repo", noDo: "DO-2", vendor: "CV B", tahap: { grounded: "2026-11-19T10:00" } }), // vendor, belum ada resi, 4 hari
  job({ jenis: "domestik", noDo: "DO-3", tahap: { bongkar: "2026-11-10T10:00" } }), // internal: POD otomatis, tidak diingatkan
  job({ jenis: "distribusi", noDo: "DJ-4", vendor: "CV C", bayar: "top", podKirim: { resi: "X1", tgl: "2026-11-17" }, titik: [{ t: "P", selesai: "2026-11-15T08:00" }, { t: "D", selesai: "2026-11-16T09:00" }] }), // TOP, resi 6 hari, POD belum sampai
  job({ jenis: "impor", noDo: "DO-5", vendor: "CV A", bayar: "top", pod: "kembali", tahap: { mtreturn: "2026-11-01T10:00" } }),
  job({ jenis: "ekspor", noDo: "DO-6", vendor: "CV A" }, { status: "selesai" }),
  job({ jenis: "impor", noDo: "DO-7", vendor: "CV D", bayar: "cash", tglBayar: "2026-11-21", podKirim: { resi: "Z", tgl: "2026-11-22" }, tahap: { mtreturn: "2026-11-21T10:00" } }), // sudah dibayar, resi baru: tidak ada pesan
];
const pod = N.pesanPod(J, "2026-11-23");
eq("POD vendor: perlu dibayar, resi belum diisi, POD belum sampai; internal, kembali, selesai, baru tidak masuk", pod.title, "POD vendor: 1 perlu dibayar · 1 resi POD belum diisi · 1 POD belum sampai");
eq("POD vendor: urut bayar, POD belum sampai, resi belum diisi", pod.body, "DO-1 (PT A); DJ-4 (PT A); DO-2 (PT A).");
eq("POD: tanpa kasus, tanpa pesan", N.pesanPod([J[2], J[4], J[6]], "2026-11-23"), null);
const K = [{ plat: "B 1", kir: "2026-11-20", stnk: "2027-05-01", pajak: "2026-12-23" }, { plat: "B 2", kir: "2026-11-30", servis: { tglBerikut: "2026-12-15" } }, { plat: "B 3", kir: "2027-01-01", servis: { odo: 44500, kmBerikut: 45000 }, aktif: false }, { plat: "B 4", sewa: { mulai: "2026-10-30", akhir: "2027-03-01" } }];
const a = N.pesanArmada(K, "2026-11-23");
eq("Armada: lewat tempo dulu; 7 hari (KIR B 2), 30 hari (pajak B 1); non-aktif diabaikan; visit 7 hari", [a.title, a.body], ["4 urusan Armada · 1 lewat tempo", "KIR B 1 lewat 3 hari; KIR B 2 7 hari lagi; Visit B 4 7 hari lagi +1 lainnya"]);
eq("pesanTracking: hanya 09.00 hari kerja", [N.pesanTracking(J, K, sen).map((p) => p.tag), N.pesanTracking(J, K, wib("2026-11-23", 14)).length, N.pesanTracking(J, K, wib("2026-11-22", 9)).length], [["dj-pod", "dj-armada"], 0, 0]);
process.exit(gagal ? 1 : 0);
