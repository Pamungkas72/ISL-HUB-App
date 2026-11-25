// Jalankan: node tests/unit/email-selesai.test.js
const { cariPenerima, susunEmail } = require("../../functions/email-selesai-isi.js");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const C = [{ nama: "PT Maju Jaya", kontak: [{ nama: "Budi", email: "" }, { nama: "Sari", email: "sari@maju.co.id", utama: true }], bahasa: "en" }, { nama: "PT Tanpa Email", kontak: [{ nama: "X" }] }, { nama: "PT Tolak", emailSelesai: false, kontak: [{ email: "a@b.co" }] }];
eq("cocok nama tanpa peduli huruf/spasi", cariPenerima(C, "  pt MAJU  jaya "), { email: "sari@maju.co.id", nama: "Sari", bahasa: "en" });
eq("tanpa email kontak", cariPenerima(C, "PT Tanpa Email"), null);
eq("customer menolak email", cariPenerima(C, "PT Tolak"), null);
eq("customer tak dikenal", cariPenerima(C, "PT Lain"), null);
const m = susunEmail({ customer: "PT <Maju>", tglSelesai: "2026-11-25", rinci: { asal: "Jakarta", tujuan: "Surabaya", noDo: "DO-1" } }, cariPenerima(C, "PT Maju Jaya"));
eq("subjek English", m.subject, "Shipment completed – DO-1");
eq("html di-escape", m.html.includes("PT &lt;Maju&gt;") && !m.html.includes("<Maju>"), true);
eq("teks memuat rute", m.text.includes("Route: Jakarta → Surabaya"), true);
process.exit(gagal ? 1 : 0);
