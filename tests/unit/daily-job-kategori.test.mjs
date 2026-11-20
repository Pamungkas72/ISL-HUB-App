// Jalankan: node tests/unit/daily-job-kategori.test.mjs
import * as H from "../../public/js/daily-job-hitung.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
eq("tanpa daftar: bawaan + kategori job", H.kategoriKel({}, [{ kategori: "Rapat" }]).slice(-2), ["Lainnya", "Rapat"]);
eq("daftar master dipakai, bawaan diabaikan", H.kategoriKel({ kategori: ["A", "B"] }, [{ kategori: "B" }, { kategori: "C" }]), ["A", "B", "C"]);
eq("job dengan ajuan belum ikut", H.kategoriKel({ kategori: ["A"] }, [{ kategori: "Baru", kategoriAjuan: "x" }]), ["A"]);
eq("ganti nama target", H.targetGantiNama({ A: 3, B: 5 }, "A", "C"), { B: 5, C: 3 });
eq("ganti nama gabung: target tujuan dipertahankan", H.targetGantiNama({ A: 3, B: 5 }, "A", "B"), { B: 5 });
eq("ganti nama daftar tanpa ganda", H.daftarGantiNama(["A", "B", "C"], "A", "C"), ["C", "B"]);
process.exit(gagal ? 1 : 0);
