// Jalankan: node tests/unit/daily-job-ekspor.test.mjs
import * as E from "../../public/js/daily-job-ekspor.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const now = "2026-11-23", W = "2026-11-20T08:10";
const tr = { id: "a", status: "proses", judul: "DO-1", customer: "PT A", pic: "Rina", tglMasuk: "2026-11-18", tglTarget: "2026-11-25", deskripsi: "catatan", rinci: { jenis: "impor", noDo: "SPPB 2231", dokNomor: [{ jenis: "SPPB", no: "2231" }, { jenis: "BL", no: "MAEU9" }], kontainer: "ABCU 1234567", ukuran: "40", pelayaran: "Samudera", depo: "Depo MT Cakung", asal: "Lini 1", tujuan: "Cikarang", vendor: "CV Trans", plat: "B 1 X", cost: 2350000, bayar: "top", tglBayar: "2026-11-21", tglKirim: "2026-11-19", dok: { 1: true }, tahap: { siap: W, pickup: W, bongkar: W, mtreturn: "2026-11-20T15:00" } } };
const dz = { id: "b", status: "selesai", judul: "DJ-2", customer: "PT B", tglMasuk: "2026-11-17", rinci: { jenis: "distribusi", noDo: "DJ-2", jenisArmada: "CDD", bak: "Box", cost: 650000, pod: "kembali", tglPod: "2026-11-21", tglKirim: "2026-11-18", tahap: { siap: W }, titik: [{ t: "P", nama: "Gudang", kota: "Bekasi", selesai: W }, { t: "D", nama: "Toko A", kota: "Bandung", selesai: W }, { t: "D", nama: "Toko B", kota: "Cimahi", selesai: W }] } };
const lt = E.lembarTrailer([tr, dz], now), ld = E.lembarDistribusi([tr, dz], now);
eq("Trailer: header + 1 baris (Distribusi tidak ikut)", [lt.length, lt[0].length, lt[1].length], [2, 36, 36]);
const h = lt[0], r = lt[1], v = (k) => r[h.indexOf(k)];
eq("Trailer: kolom utama", [v("No. DO"), v("Dokumen dan Nomor"), v("Jenis"), v("No. Kontainer"), v("Armada"), v("Vendor"), v("Pembayaran"), v("Cost (Rp)"), v("Tahap Saat Ini")], ["SPPB 2231", "SPPB 2231; BL MAEU9", "Impor", "ABCU 1234567", "Vendor", "CV Trans", "TOP", 2350000, "POD"]);
eq("Trailer: tahap, POD, umur, dokumen", [v("Siap"), v("MT return / Gate in / Grounded"), v("POD"), v("Umur POD (hari)"), v("Kelengkapan Dokumen"), v("Tgl Transfer Vendor")], ["2026-11-20 08:10", "2026-11-20 15:00", "Belum", 3, "DO pelayaran", "2026-11-21"]);
const hd = ld[0], rd = ld[1], vd = (k) => rd[hd.indexOf(k)];
eq("Distribusi: pola, jumlah titik, titik berurutan, rute", [vd("Pola"), vd("Pick up"), vd("Drop"), vd("Titik (urutan)"), vd("Rute")], ["1→2", 1, 2, "P1: Gudang (Bekasi) ✓ | D1: Toko A (Bandung) ✓ | D2: Toko B (Cimahi) ✓", "Bekasi - Cimahi"]);
eq("Distribusi: armada, bak, status, POD", [vd("Jenis Armada"), vd("Tipe Bak"), vd("Armada"), vd("Status"), vd("POD"), vd("Tgl POD Kembali"), vd("Tahap Saat Ini")], ["CDD", "Box", "Internal", "Selesai", "Kembali", "2026-11-21", "POD kembali"]);
eq("lembarEkspor menurut subdivisi", [E.lembarEkspor([tr, dz], "", now).map((x) => x[0]), E.lembarEkspor([tr, dz], "kecil", now).map((x) => x[0]), E.lembarEkspor([], "besar", now).map((x) => x[0])], [["Tracking Trailer", "Truk Distribusi"], ["Truk Distribusi"], ["Tracking Trailer"]]);
eq("nama berkas", [E.namaBerkas("besar", now), E.namaBerkas("", now)], ["shipment-tracking-trailer-2026-11-23.xlsx", "shipment-tracking-2026-11-23.xlsx"]);
process.exit(gagal ? 1 : 0);
