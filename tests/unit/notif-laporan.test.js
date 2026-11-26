// Jalankan: node tests/unit/notif-laporan.test.js
const L = require("../../functions/notif-laporan.js"), X = require("../../functions/notif-xlsx.js"), E = require("../../functions/dailyjob-email-customer.js"), zlib = require("zlib");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const wib = (s) => Date.parse(s + "+07:00");
const A = { id: "cA", nama: "PT Maju Jaya", bahasa: "id" }, B = { id: "cB", nama: "PT Sinar" };
const job = (customer, tgl, o = {}, r = {}) => ({ customer, judul: "DO-" + tgl, kelompokId: "k1", status: "proses", kategori: "CDD", rinci: { jenis: "distribusi", tglKirim: tgl, noDo: "DO-" + tgl, asal: "Jakarta", tujuan: "Bandung", plat: "B 1 X", vendor: "CV Rahasia", cost: 900000, tagihan: "belum", ...r }, ...o });
const jobs = [job("PT Maju Jaya", "2026-11-24"), job("PT Sinar", "2026-11-24"), job("pt maju jaya", "2026-11-25", { kategori: "Fuso" }, { pod: "kembali" }), job("PT Maju Jaya", "2026-10-01"), job("PT Maju Jaya", "2026-11-24", { status: "batal" }), job("PT Maju Jaya", "2026-11-24", { kelompokId: "k2" })];
const sel = L.pilihJob(jobs, A, "k1", {}, { dari: "2026-11-23", sampai: "2026-11-29" });
eq("isolasi: hanya job customer itu, kelompok itu, bukan batal, dalam rentang", sel.map((j) => j.rinci.noDo), ["DO-2026-11-24", "DO-2026-11-25"]);
eq("isolasi: customer lain tidak ikut", L.pilihJob(jobs, B, "k1", {}, { dari: "2026-11-23", sampai: "2026-11-29" }).length, 1);
eq("filter kategori", L.pilihJob(jobs, A, "k1", { kategori: ["Fuso"] }, { dari: "2026-11-23", sampai: "2026-11-29" }).length, 1);
eq("filter status berjalan", L.pilihJob(jobs, A, "k1", { status: "berjalan" }, { dari: "2026-11-23", sampai: "2026-11-29" }).length, 2);
const t = L.tabel("tracking", { kolom: ["noDo", "rute", "vendor", "cost", "tagihan", "pod"] }, sel);
eq("Tracking: kolom biaya, vendor, tagihan dibuang walau diminta", t.header, ["No. DO", "Rute", "POD"]);
eq("tidak ada angka biaya di isi", JSON.stringify(t.rows).includes("900000") || JSON.stringify(t.rows).includes("Rahasia"), false);
eq("kolom kosong = bawaan umum", L.tabel("tracking", {}, sel).header.length, L.KOLOM_BAWAAN.tracking.length);
eq("profil tanpa registry: tabel kosong", L.tabel("marketing", { kolom: ["noDo"] }, sel).header, []);
eq("isi baris: rute dan POD", t.rows[1], ["DO-2026-11-25", "Jakarta → Bandung", "Sudah kembali"]);
// periode
const sen = wib("2026-11-23T09:00:00"); // Senin
eq("harian: kirim 08:00 membawa data kemarin", L.periode({ periode: "harian", jam: "08:00" }, sen), { key: "2026-11-23", dari: "2026-11-22", sampai: "2026-11-22", kirimPada: wib("2026-11-23T08:00:00") });
eq("harian: sebelum jam kirim memakai kemarin yang masih <48 jam", L.periode({ periode: "harian", jam: "08:00" }, wib("2026-11-23T07:00:00")).key, "2026-11-22");
eq("mingguan: Senin 08:00, data 7 hari sebelumnya", L.periode({ periode: "mingguan", hari: 1, jam: "08:00" }, sen), { key: "2026-11-23", dari: "2026-11-16", sampai: "2026-11-22", kirimPada: wib("2026-11-23T08:00:00") });
eq("mingguan: lewat >48 jam tidak dikirim terlambat", L.periode({ periode: "mingguan", hari: 1, jam: "08:00" }, wib("2026-11-26T09:00:00")), null);
eq("mingguan bebas (uji) tetap memberi periode", L.periode({ periode: "mingguan", hari: 1, jam: "08:00" }, wib("2026-11-26T09:00:00"), true).dari, "2026-11-16");
eq("bulanan: tanggal 1, data bulan lalu penuh", L.periode({ periode: "bulanan", tanggal: 1, jam: "08:00" }, wib("2026-12-01T09:00:00")), { key: "2026-12-01", dari: "2026-11-01", sampai: "2026-11-30", kirimPada: wib("2026-12-01T08:00:00") });
eq("bulanan Maret: akhir Februari", L.periode({ periode: "bulanan", tanggal: 1, jam: "08:00" }, wib("2027-03-01T09:00:00")).sampai, "2027-02-28");
eq("jam salah: bawaan 08:00", L.periode({ periode: "harian", jam: "x" }, sen).kirimPada, wib("2026-11-23T08:00:00"));
// email, penerima
const e = L.emailLaporan({ nama: "Rekap mingguan" }, A, { dari: "2026-11-16", sampai: "2026-11-22" }, 12);
eq("email laporan Indonesia", [e.subjek, /12 pengiriman/.test(e.isi), /PT Maju Jaya/.test(e.isi)], ["Rekap mingguan · 2026-11-16 s.d. 2026-11-22", true, true]);
eq("email laporan English", /shipments/.test(L.emailLaporan({ nama: "R" }, { ...A, bahasa: "en" }, { dari: "a", sampai: "b" }, 1).isi), true);
const dok = { penerima: { cA: { emails: ["Staf1@maju.id", "staf1@maju.id", "salah", "staf2@maju.id"] } } }, cu = { ...A, kontak: [{ email: "bos@maju.id", utama: true }] };
eq("penerima: daftar notifikasi menggantikan kontak, tanpa duplikat dan alamat salah", E.penerimaDaftar(cu, dok), ["staf1@maju.id", "staf2@maju.id"]);
eq("penerima: tanpa daftar memakai kontak utama", E.penerimaDaftar(cu, { penerima: { cA: { emails: [] } } }), ["bos@maju.id"]);
eq("penerima: customer lain tidak terpengaruh", E.penerimaDaftar({ ...B, kontak: [{ email: "x@sinar.id" }] }, dok), ["x@sinar.id"]);
const job1 = job("PT Maju Jaya", "2026-11-24", { kelompokId: "k1" }), a = E.antrean("diterima", "j", job1, cu, dok, 1000);
eq("antrean memuat kepada (array) dan ke (teks)", [a.doc.kepada, a.doc.ke, a.doc.status], [["staf1@maju.id", "staf2@maju.id"], "staf1@maju.id, staf2@maju.id", "antre"]);
// xlsx
const buf = X.xlsx(["A", "B"], [["x & <y>", 5]], "Uji"), asZip = buf.readUInt32LE(0) === 0x04034b50, akhir = buf.readUInt32LE(buf.length - 22) === 0x06054b50;
eq("xlsx: tanda zip awal dan akhir benar", [asZip, akhir, buf.readUInt16LE(buf.length - 12)], [true, true, 6]);
let off = 0, isiSheet = ""; while (off < buf.length && buf.readUInt32LE(off) === 0x04034b50) { const cs = buf.readUInt32LE(off + 18), nl = buf.readUInt16LE(off + 26), nm = buf.slice(off + 30, off + 30 + nl).toString(), d = zlib.inflateRawSync(buf.slice(off + 30 + nl, off + 30 + nl + cs)); if (nm === "xl/worksheets/sheet1.xml") isiSheet = d.toString(); off += 30 + nl + cs; }
eq("xlsx: sel di-escape dan angka numerik", [isiSheet.includes("x &amp; &lt;y&gt;"), isiSheet.includes("<v>5</v>")], [true, true]);
eq("csv: tanda kutip dan BOM", X.csv(["a"], [['x,"y"']]), '﻿a\r\n"x,""y"""\r\n');
process.exit(gagal ? 1 : 0);
