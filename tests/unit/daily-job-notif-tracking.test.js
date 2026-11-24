// Jalankan: node tests/unit/daily-job-notif-tracking.test.js
const N = require("../../functions/dailyjob-tracking-pesan.js");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const wib = (tgl, jam) => new Date(`${tgl}T${String(jam).padStart(2, "0")}:00:00+07:00`), sen = wib("2026-11-23", 9); // Senin
const job = (r, o = {}) => ({ status: "proses", judul: "J", customer: "PT A", ...o, rinci: r });
const J = [
  job({ jenis: "impor", noDo: "DO-1", vendor: "CV A", tglBayar: "2026-11-20", tahap: { mtreturn: "2026-11-17T10:00" } }),
  job({ jenis: "repo", noDo: "DO-2", tahap: { grounded: "2026-11-19T10:00" } }),
  job({ jenis: "domestik", noDo: "DO-3", tahap: { bongkar: "2026-11-22T10:00" } }),
  job({ jenis: "distribusi", noDo: "DJ-4", titik: [{ t: "P", selesai: "2026-11-18T08:00" }, { t: "D", selesai: "2026-11-19T09:00" }] }),
  job({ jenis: "impor", noDo: "DO-5", pod: "kembali", tahap: { mtreturn: "2026-11-01T10:00" } }),
  job({ jenis: "ekspor", noDo: "DO-6" }, { status: "selesai" }),
];
const pod = N.pesanPod(J, "2026-11-23");
eq("POD: dibayar, telat >= 3 hari; yang baru 1 hari, kembali, selesai tidak masuk", pod.title, "3 POD belum kembali · 1 sudah dibayar");
eq("POD: urut dibayar dulu lalu paling lama", pod.body, "DO-1 (PT A, 6 hari); DO-2 (PT A, 4 hari); DJ-4 (PT A, 4 hari). POD wajib kembali sebelum penagihan.");
eq("POD: tanpa kasus, tanpa pesan", N.pesanPod([J[2], J[4]], "2026-11-23"), null);
const K = [{ plat: "B 1", kir: "2026-11-20", stnk: "2027-05-01", pajak: "2026-12-23" }, { plat: "B 2", kir: "2026-11-30", servis: { tglBerikut: "2026-12-15" } }, { plat: "B 3", kir: "2027-01-01", servis: { odo: 44500, kmBerikut: 45000 }, aktif: false }, { plat: "B 4", sewa: { mulai: "2026-10-30", akhir: "2027-03-01" } }];
const a = N.pesanArmada(K, "2026-11-23");
eq("Armada: lewat tempo dulu; 7 hari (KIR B 2), 30 hari (pajak B 1); non-aktif diabaikan; visit 7 hari", [a.title, a.body], ["4 urusan Armada · 1 lewat tempo", "KIR B 1 lewat 3 hari; KIR B 2 7 hari lagi; Visit B 4 7 hari lagi +1 lainnya"]);
eq("pesanTracking: hanya 09.00 hari kerja", [N.pesanTracking(J, K, sen).map((p) => p.tag), N.pesanTracking(J, K, wib("2026-11-23", 14)).length, N.pesanTracking(J, K, wib("2026-11-22", 9)).length], [["dj-pod", "dj-armada"], 0, 0]);
process.exit(gagal ? 1 : 0);
