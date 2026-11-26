// Jalankan: node tests/unit/rute-customer.test.mjs
import * as R from "../../public/js/rute-customer.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
eq("id tetap: abaikan PT, huruf, pemisah", [R.idRute("PT Indomarco", "Cikarang - Bogor", "CDD"), R.idRute("indomarco", "Cikarang → Bogor", "cdd")], ["r_indomarco_cikarang-bogor_cdd", "r_indomarco_cikarang-bogor_cdd"]);
const aoa = [["Daftar rute"], ["Rute", "Jenis Armada", "Tagihan (Rp)"], ["Cikarang - Bogor", "CDD", "1.250.000"], ["Cikarang → Bogor", "CDD", ""], ["Bekasi - Depok - Bogor", "Fuso", 2000000], ["Jakarta", "CDD", 5], ["", "", ""]];
const b = R.bacaBaris(aoa);
eq("excel: gabung duplikat, ambil tagihan, lewati 1 lokasi", [b.baris, b.lewat], [[{ rute: "Cikarang → Bogor", jenisArmada: "CDD", tagihan: 1250000 }, { rute: "Bekasi → Depok → Bogor", jenisArmada: "Fuso", tagihan: 2000000 }], 1]);
eq("excel tanpa kolom Rute: galat", R.bacaBaris([["a", "b"]]).galat, "Kolom \"Rute\" tidak ditemukan.");
const dft = [{ id: "1", kunciCust: "indomarco", rute: "Cikarang → Bogor", jenisArmada: "CDD" }, { id: "2", kunciCust: "indomarco", rute: "Cikarang → Bogor", jenisArmada: "Fuso" }, { id: "3", kunciCust: "indomarco", rute: "Bekasi → Depok", jenisArmada: "" }, { id: "4", kunciCust: "lain", rute: "X → Y", jenisArmada: "CDD" }];
eq("saran: customer sama, jenis cocok dulu, tanpa duplikat", R.saran(dft, { cust: "PT Indomarco", jenis: "Fuso" }).map((o) => [o.teks, o.nCocok]), [["Bekasi → Depok", 1], ["Cikarang → Bogor", 1]]);
eq("saran: jenis lain tetap muncul, cari menyaring", [R.saran(dft, { cust: "indomarco", jenis: "Tronton" }).map((o) => o.nCocok), R.saran(dft, { cust: "indomarco", cari: "bek" }).length, R.saran(dft, { cust: "" }).length], [[1, 0], 1, 0]);
eq("tanpa tagihan", R.tanpaTagihan(dft, { 1: { tagihan: 100 } }).map((d) => d.id), ["2", "3", "4"]);
eq("rute baru terdeteksi", [R.baruDiDaftar(dft, "Indomarco", "Cikarang - Bogor", "CDD"), R.baruDiDaftar(dft, "Indomarco", "Cikarang - Bogor", "Tronton"), R.baruDiDaftar(dft, "Indomarco", "Bogor - Sukabumi", "CDD"), R.baruDiDaftar(dft, "Indomarco", "Bekasi - Depok", "Fuso")], [false, true, true, false]);
process.exit(gagal ? 1 : 0);
