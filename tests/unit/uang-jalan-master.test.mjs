// Jalankan: node tests/unit/uang-jalan-master.test.mjs
import { hitung, kunciUJ, namaRute, rasioAwal, rincianSingkat } from "../../public/js/uang-jalan-hitung.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const dasar = { jarak: "210", rasio: "5", solar: "6.800", tol: "135.000", mel: "50.000", digaji: true, bulat: 1000 };
const a = hitung({ ...dasar, opsi: { helper: "150.000", asuransi: "25.000", insentif: "100.000" } });
eq("BBM = 210/5 x 6.800", [a.liter, a.bbm], [42, 285600]);
eq("driver digaji: insentif diabaikan, subtotal, pembulatan, total", [a.subtotal, a.pembulatan, a.total, a.manual], [645600, 400, 646000, false]);
const b = hitung({ ...dasar, rasio: "4", tol: "135.000", mel: "75.000", digaji: false, opsi: { tkbm: "120.000", insentif: "100.000" } });
eq("driver tidak digaji: insentif dihitung (Fuso)", [b.bbm, b.subtotal, b.total, b.baris.map((x) => x.k)], [357000, 787000, 787000, ["bbm", "tol", "mel", "tkbm", "insentif"]]);
eq("angka manual menimpa total, hitungTotal tetap terlihat", [hitung({ ...dasar, manual: "700.000" }).total, hitung({ ...dasar, manual: "700.000" }).manual, hitung({ ...dasar, manual: "700.000" }).hitungTotal], [700000, true, 471000]);
eq("tanpa pembulatan", hitung({ ...dasar, bulat: 0 }).total, 470600);
eq("rasio desimal koma", hitung({ ...dasar, rasio: "2,5" }).bbm, Math.round(84 * 6800));
eq("jarak atau rasio kosong: BBM 0, tidak error", [hitung({ ...dasar, jarak: "" }).bbm, hitung({ ...dasar, rasio: "0" }).bbm], [0, 0]);
eq("komponen lain ikut total, nominal 0 diabaikan", hitung({ ...dasar, bulat: 0, lain: [{ nama: "Uang parkir", v: "10.000" }, { nama: "Kosong", v: "0" }] }).baris.map((x) => x.n), ["BBM", "Tol", "Biaya mel", "Uang parkir"]);
eq("kunci dan nama rute", [kunciUJ("Cikarang", "Subang ", "cdd"), namaRute(" Cikarang", "Subang ")], ["cikarang__subang__cdd", "Cikarang → Subang"]);
eq("rasio bawaan dan override pengaturan", [rasioAwal("cdd"), rasioAwal("cdd", { rasio: { cdd: 5.5 } }), rasioAwal("zzz")], [5, 5.5, 0]);
eq("rincian singkat", rincianSingkat(a), "BBM 285.600 · Tol 135.000 · Mel 50.000 · Helper, Asuransi");
process.exit(gagal ? 1 : 0);
