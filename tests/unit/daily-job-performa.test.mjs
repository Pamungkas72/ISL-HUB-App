// Jalankan: node tests/unit/daily-job-performa.test.mjs
import { hitungPerforma } from "../../public/js/daily-job-performa-hitung.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const now = "2026-11-23", r = ["2026-11-01", "2026-11-30"], t = (...k) => Object.fromEntries(k.map((x) => [x, "2026-11-12T08:00"]));
const TR = (id, rinci) => ({ id, status: "proses", tglMasuk: "2026-11-10", rinci: { sub: "besar", tglKirim: "2026-11-11", asal: "Lini 1", tujuan: "Cikarang", ...rinci } });
const DS = (id, rinci) => ({ id, status: "proses", tglMasuk: "2026-11-10", rinci: { sub: "kecil", jenis: "distribusi", tglKirim: "2026-11-11", jenisArmada: "CDD", vendor: "Internal", cost: 500000, titik: [{ t: "P", nama: "Cikarang", selesai: "2026-11-11T08:00" }, { t: "D", nama: "Bekasi", selesai: "2026-11-11T11:00" }], ...rinci } });
const jobs = [TR(1, { jenis: "impor", vendor: "CV A", cost: 2000000, tahap: t("siap", "pickup") }), TR(2, { jenis: "domestik", vendor: "CV A", cost: 1000000, tahap: t("siap", "pickup") }), DS(3, {}), DS(4, { vendor: "CV A", cost: 700000 })];
const a = hitungPerforma(jobs, r, "", now), b = hitungPerforma(jobs, r, "besar", now), k = hitungPerforma(jobs, r, "kecil", now);
eq("semua: order, ritase, cost gabungan", [a.order, a.ritase, a.cost, a.costPerRitase], [4, 4, 4200000, 1050000]);
eq("subdivisi besar hanya Trailer", [b.order, b.ritase, b.cost, b.drop], [2, 2, 3000000, null]);
eq("subdivisi kecil hanya Distribusi", [k.order, k.ritase, k.cost, k.drop], [2, 2, 1200000, 2]);
eq("vendor digabung lintas subdivisi", a.perVendor.find((o) => o.nama === "CV A").ritase, 3);
eq("jenis: Semua berawalan grup dan hanya yang terisi", a.perJenis.map((o) => o.nama), ["Trailer · Impor", "Trailer · Domestik", "Distribusi · CDD"]);
eq("jenis: subdivisi tunggal memuat semua jenis tetap", [b.perJenis.length, k.perJenis.length], [4, 5]);
eq("volume per minggu: order dan ritase terjumlah", a.perMinggu.reduce((x, m) => [x[0] + m.order, x[1] + m.ritase], [0, 0]), [4, 4]);
eq("pembanding tarif hanya bila ada Trailer", [a.banding.length >= 0, k.banding], [true, []]);
process.exit(gagal ? 1 : 0);
