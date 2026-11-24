// Jalankan: node tests/unit/daily-job-trailer.test.mjs
import * as T from "../../public/js/daily-job-trailer-hitung.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const now = "2026-11-23", r = ["2026-11-01", "2026-11-30"];
const J = (id, rinci, o = {}) => ({ id, status: "proses", tglMasuk: "2026-11-10", ...o, rinci: { tglKirim: "2026-11-11", asal: "Lini 1", tujuan: "Cikarang", ...rinci } });
const t = (...k) => Object.fromEntries(k.map((x) => [x, "2026-11-12T08:00"]));
const jobs = [
  J(1, { jenis: "impor", vendor: "CV A", cost: 2000000, tahap: t("siap", "pickup") }),
  J(2, { jenis: "impor", vendor: "CV A", cost: 2000000, tglBayar: "2026-11-15", tahap: { ...t("siap", "pickup", "bongkar"), mtreturn: "2026-11-14T10:00" } }),
  J(3, { jenis: "repo", cost: 1000000, tahap: t("siap", "pickup", "grounded"), tglKirim: "2026-11-20" }),
  J(4, { jenis: "ekspor", vendor: "Internal", cost: 1500000, pod: "kembali", tglPod: "2026-11-16", tahap: t("siap", "ambilmt", "stuffing", "gatein", "pod") }),
  J(5, { jenis: "domestik" }, { tglMasuk: "2026-11-22" }),
  J(6, { jenis: "impor", vendor: "CV B", cost: 3000000, pod: "kembali", tglPod: "2026-11-18", tahap: t("siap", "pickup", "bongkar", "mtreturn", "pod") }),
];
eq("kemajuan dan tahap berikut", [T.kemajuan(jobs[0]), T.tahapBerikut(jobs[0])[0], T.tahapBerikut(jobs[3])], [2, "bongkar", null]);
eq("tahap tidak boleh dilompati", T.kemajuan(J(9, { jenis: "impor", tahap: t("siap", "bongkar") })), 1);
eq("fase", jobs.map((j) => T.fase(j)), ["jalan", "pod", "pod", "selesai", "belum", "bayar"]);
const m = T.tandaiTahap(J(9, { jenis: "repo", tahap: t("siap", "pickup", "grounded") }), "2026-11-23T09:00");
eq("tandai POD mengisi pod dan tglPod", [m.pod, m.tglPod], ["kembali", "2026-11-23"]);
eq("perlu bayar: vendor Cash, resi ada atau POD kembali, belum ditransfer", [T.perluBayar(jobs[1]), T.perluBayar(jobs[5]), T.perluBayar(jobs[2]), T.perluBayar(J(9, { jenis: "impor", vendor: "X", podKirim: { resi: "R1" } })), T.perluBayar(J(9, { jenis: "impor", vendor: "X", bayar: "top", podKirim: { resi: "R1" } })), T.perluBayar(J(9, { jenis: "impor", vendor: "X", podKirim: { berkas: [{ url: "u" }] } })), T.perluBayar(J(9, { jenis: "impor", vendor: "X" }))], [false, true, false, true, false, true, false]);
eq("fase vendor Cash: resi ada belum bayar = bayar; bayar sebelum POD sampai = pod", [T.fase(J(9, { jenis: "impor", vendor: "X", tahap: t("siap", "pickup", "bongkar", "mtreturn"), podKirim: { resi: "R" } })), T.fase(J(9, { jenis: "impor", vendor: "X", tahap: t("siap", "pickup", "bongkar", "mtreturn"), podKirim: { resi: "R" }, tglBayar: "2026-11-20" }))], ["bayar", "pod"]);
eq("umur POD sejak tahap operasional terakhir", [T.umurPod(jobs[1], now), T.umurPod(jobs[2], now)], [9, 11]);
eq("selesai otomatis: internal, TOP saat POD kembali, Cash setelah transfer", [T.selesaiOtomatis(jobs[3]), T.selesaiOtomatis(jobs[5]), T.selesaiOtomatis(J(9, { jenis: "impor", vendor: "X", pod: "kembali", tglBayar: "2026-11-20" })), T.selesaiOtomatis(J(9, { jenis: "impor", vendor: "X", bayar: "top", pod: "kembali" })), T.selesaiOtomatis(J(9, { jenis: "impor", vendor: "X", bayar: "top" }))], [true, false, true, true, false]);
const k = T.hitungTrailer(jobs, r, now);
eq("order dan ritase", [k.order, k.ritase, k.persenTerlaksana], [6, 5, 83]);
eq("cost total, vendor, internal", [k.cost, k.costVendor, k.costInternal], [9500000, 7000000, 2500000]);
eq("per jenis", k.perJenis.map((o) => [o.nama, o.order, o.ritase, o.cost]), [["Impor", 3, 3, 7000000], ["Ekspor", 1, 1, 1500000], ["Repo", 1, 1, 1000000], ["Domestik", 1, 0, 0]]);
eq("vendor dan internal", k.perVendor.map((o) => [o.nama, o.ritase]), [["CV A", 2], ["Internal (uang jalan)", 2], ["CV B", 1]]);
eq("risiko: tunggu POD, perlu dibayar (Cash)", [k.tungguPod, k.perluBayar, k.nilaiPerluBayar], [2, 1, 3000000]);
const im = T.tandaiTahap(J(9, { jenis: "repo", tahap: t("siap", "pickup") }), "2026-11-23T09:00"), vm = T.tandaiTahap(J(9, { jenis: "repo", vendor: "CV A", tahap: t("siap", "pickup") }), "2026-11-23T09:00");
eq("internal: tahap terakhir sebelum POD otomatis mengisi POD; vendor tidak", [im.pod, im.tglPod, !!im.tahap.pod, vm.pod || "belum", !!vm.tahap.pod], ["kembali", "2026-11-23", true, "belum", false]);
const iu = T.batalkanTahap(J(9, { jenis: "repo", tahap: im.tahap, pod: "kembali", tglPod: "2026-11-23" }));
eq("internal: batalkan POD otomatis ikut membatalkan tahap sebelumnya", [iu.pod, !!iu.tahap.pod, !!iu.tahap.grounded, !!iu.tahap.pickup], ["belum", false, false, true]);
eq("umur POD per kelompok", k.umurPod.map((o) => o.n), [0, 0, 2, 0]);
const u = T.batalkanTahap(jobs[5]);
eq("batalkan tahap terakhir (POD) mengosongkan pod", [u.pod, u.tglPod, !!u.tahap.pod, !!u.tahap.mtreturn], ["belum", null, false, true]);
const tj = (id, rinci, o = {}) => J(id, { tahap: {}, ...rinci }, o), hr = "2026-11-23";
const ops = { tahap: t("siap", "pickup", "bongkar", "mtreturn") };
eq("tindakan: bayar (Cash, resi ada), resi belum diisi, POD belum sampai, berangkat hari ini, tanpa armada", [
  T.cocokTindakan(tj(7, { jenis: "impor", vendor: "X", ...ops, podKirim: { resi: "R" } }), "bayar", now), T.cocokTindakan(jobs[1], "resi", now), T.cocokTindakan(jobs[1], "pod", now), T.cocokTindakan(jobs[2], "resi", now),
  T.cocokTindakan(tj(7, { jenis: "impor", vendor: "X", ...ops, podKirim: { resi: "R", tgl: "2026-11-15" }, tglBayar: "2026-11-16" }), "pod", now), T.cocokTindakan(tj(7, { jenis: "impor", vendor: "X", ...ops, podKirim: { resi: "R", tgl: "2026-11-21" } }), "pod", now),
  T.cocokTindakan(tj(7, { jenis: "impor", vendor: "X", tglKirim: hr, tahap: t("siap") }), "berangkat", now), T.cocokTindakan(tj(8, { jenis: "impor", tglKirim: hr }), "armada", now), T.cocokTindakan(jobs[3], "pod", now)], [true, true, false, false, true, false, true, true, false]);
const bt = T.bandingTarif([J(11, { jenis: "impor", vendor: "A", cost: 2400000, tahap: t("siap", "pickup") }), J(12, { jenis: "impor", vendor: "B", cost: 2100000, tahap: t("siap", "pickup") }), J(13, { jenis: "impor", vendor: "A", cost: 2600000, tahap: t("siap", "pickup") }), J(14, { jenis: "impor", vendor: "A", cost: 2600000, tahap: t("siap", "pickup"), tujuan: "Bekasi" })], r);
eq("pembanding tarif: hanya rute dengan 2 pelaku, termurah di depan", bt.map((x) => [x.rute, x.murah, x.pelaku.map((o) => [o.nama, o.rata])]), [["Lini 1 → Cikarang", "B", [["B", 2100000], ["A", 2500000]]]]);
const md = J(9, { jenis: "domestik", tujuan: "Bekasi", tujuanLain: ["Karawang", "Cikampek"] });
eq("multi drop: semua tujuan dan rute", [T.semuaTujuan(md), T.ruteTrailer(md)], [["Bekasi", "Karawang", "Cikampek"], "Lini 1 → Bekasi → Karawang → Cikampek"]);
eq("tanpa tujuan lain: rute lama tetap", T.ruteTrailer(J(8, { jenis: "impor" })), "Lini 1 → Cikarang");
process.exit(gagal ? 1 : 0);
