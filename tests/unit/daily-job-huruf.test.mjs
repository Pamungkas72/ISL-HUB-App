// Jalankan: node tests/unit/daily-job-huruf.test.mjs
import { awalKalimat, kapital, modeHuruf } from "../../public/js/daily-job-huruf.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
eq("awal teks kapital", awalKalimat("pt uji coba satu"), "Pt uji coba satu");
eq("setelah titik, tanda seru, tanya", awalKalimat("kirim pagi. bongkar di toko! sudah? belum"), "Kirim pagi. Bongkar di toko! Sudah? Belum");
eq("setelah baris baru", awalKalimat("catatan satu\ncatatan dua"), "Catatan satu\nCatatan dua");
eq("angka di awal dan huruf kapital tidak diubah", [awalKalimat("2 drop di toko"), awalKalimat("NPCT 1"), awalKalimat("Depo ISL")], ["2 drop di toko", "NPCT 1", "Depo ISL"]);
eq("huruf tengah kata tidak diubah (singkatan, domain)", [awalKalimat("mis. cikarang"), awalKalimat("a.b.c")], ["Mis. Cikarang", "A.b.c"]);
eq("kode semua kapital", [kapital("abcu 1234567"), kapital("b 9012 kda"), kapital(null)], ["ABCU 1234567", "B 9012 KDA", ""]);
eq("kosong dan spasi", [awalKalimat(""), awalKalimat("  halo"), awalKalimat(undefined)], ["", "  Halo", ""]);
const el = (type, o = {}) => ({ type, dataset: o.dataset || {}, getAttribute: (k) => (o.attr || {})[k] || null });
eq("mode kolom", [modeHuruf(el("text")), modeHuruf(el("date")), modeHuruf(el("text", { attr: { inputmode: "numeric" } })), modeHuruf(el("text", { attr: { inputmode: "tel" } })), modeHuruf(el("text", { dataset: { huruf: "besar" } }))], ["kalimat", "biasa", "biasa", "biasa", "besar"]);
process.exit(gagal ? 1 : 0);
