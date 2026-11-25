// Jalankan: node tests/unit/daily-job-email-customer.test.js
const E = require("../../functions/dailyjob-email-customer");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const job = (r, o = {}) => ({ customer: "PT Indomarco", judul: "DO-1", status: "proses", rinci: { jenis: "distribusi", noDo: "DO-1", titik: [{ t: "P", nama: "Cikarang" }, { t: "D", nama: "Bogor" }], ...r }, ...o });
const sel = [{ t: "P", nama: "Cikarang", selesai: "2026-11-25" }, { t: "D", nama: "Bogor", selesai: "2026-11-25" }];
eq("baru dibuat: diterima", E.tahapBaru(null, job({})), ["diterima"]);
eq("dibuat sudah terkirim: dua tahap", E.tahapBaru(null, job({ titik: sel })), ["diterima", "terkirim"]);
eq("menjadi terkirim sekali saja", [E.tahapBaru(job({}), job({ titik: sel })), E.tahapBaru(job({ titik: sel }), job({ titik: sel, cost: 5 })), E.tahapBaru(job({}), job({ cost: 5 }))], [["terkirim"], [], []]);
eq("dimatikan, batal, bukan Tracking: tidak ada", [E.tahapBaru(null, job({ emailCust: false })), E.tahapBaru(null, job({}, { status: "batal" })), E.tahapBaru(null, { customer: "X", rinci: {} })], [[], [], []]);
const c = { nama: "Indomarco", namaLengkap: "PT Indomarco Prismatama", emailUmum: "umum@x.id", kontak: [{ nama: "A", email: "a@x.id" }, { nama: "B", email: "b@x.id", utama: true }], bahasa: "id" };
eq("cari customer: abaikan PT dan tanda baca", [E.cariCustomer("PT Indomarco", [c]) === c, E.cariCustomer("indomarco prismatama, PT.", [c]) === c, E.cariCustomer("Lain", [c])], [true, true, null]);
eq("penerima: utama, lalu kontak, lalu umum, lalu kosong", [E.penerima(c), E.penerima({ ...c, kontak: [{ email: "k@x.id" }] }), E.penerima({ ...c, kontak: [{ email: "salah" }] }), E.penerima({ kontak: [] }), E.penerima(null)], ["b@x.id", "k@x.id", "umum@x.id", "", ""]);
const t = E.susunEmail("terkirim", job({}), c);
eq("isi Indonesia", [t.subjek, /POD dan tagihan akan segera kami kirimkan/.test(t.isi), /Bogor/.test(t.isi)], ["Pengiriman selesai · DO-1", true, true]);
eq("isi English", [E.susunEmail("terkirim", job({}), { ...c, bahasa: "en" }).subjek, /proof of delivery/.test(E.susunEmail("terkirim", job({}), { ...c, bahasa: "en" }).isi)], ["Shipment completed · DO-1", true]);
const a = E.antrean("diterima", "j1", job({}, { kelompokId: "kt" }), c), b = E.antrean("diterima", "j1", job({}), null);
eq("antrean: kunci tetap, status", [a.kunci, a.doc.status, a.doc.ke, b.doc.status], ["j1_diterima", "antre", "b@x.id", "tanpa-email"]);
process.exit(gagal ? 1 : 0);
