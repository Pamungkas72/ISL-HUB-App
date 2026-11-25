// Jalankan: node tests/unit/daily-job-tracking.test.mjs
import * as T from "../../public/js/daily-job-tracking-hitung.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const now = "2026-11-19", r = ["2026-11-01", "2026-11-30"];
const J = [
  { id: 1, status: "proses", kategori: "CDD", pic: "Nadiya", tglMasuk: "2026-11-18", tglTarget: "2026-11-21", rinci: { tglKirim: "2026-11-19", pod: "belum", bayar: "cash" } },
  { id: 2, status: "proses", kategori: "Fuso", pic: "Dede", tglMasuk: "2026-11-10", tglTarget: "2026-11-12", rinci: { tglKirim: "2026-11-10", pod: "kembali", tglPod: "2026-11-12", tagihan: "dikirim", bayar: "top" } },
  { id: 3, status: "proses", kategori: "CDD", pic: "Nadiya", tglMasuk: "2026-11-05", tglTarget: "2026-11-07", rinci: { tglKirim: "2026-11-05", pod: "kembali", tglPod: "2026-11-09", tagihan: "belum", bayar: "cash" } },
  { id: 4, status: "selesai", kategori: "Trailer Ekspor", pic: "Dede", tglMasuk: "2026-11-02", tglTarget: "2026-11-06", rinci: { tglKirim: "2026-11-02", pod: "kembali", tglPod: "2026-11-05", tagihan: "konfirmasi" } },
  { id: 5, status: "batal", kategori: "CDD", pic: "Dede", tglMasuk: "2026-11-03", rinci: { tglKirim: "2026-11-03" } }];
const k = T.hitungTracking(J, r, now);
eq("KPI: kirim hari ini, kirim periode (batal tidak dihitung)", [k.hariIni, k.kirim], [1, 4]);
eq("KPI: POD kembali dan persen", [k.pod, k.persenPod], [3, 75]);
eq("KPI: tepat waktu = POD pada/sebelum target (id 2 dan 4 tepat, id 3 telat)", [k.tepat, k.persenTepat], [2, 67]);
eq("KPI: tagihan belum dikonfirmasi, cash lawan TOP", [k.tagihanBelum, k.cash, k.top], [2, 1, 1]);
eq("volume per kategori armada", k.volume, [{ nama: "CDD", n: 2 }, { nama: "Fuso", n: 1 }, { nama: "Trailer Ekspor", n: 1 }]);
eq("beban per PIC: aktif, belum POD, telat", k.perPic.find((p) => p.nama === "Nadiya"), { nama: "Nadiya", aktif: 2, belumPod: 1, telat: 1 });
eq("subdivisi dari kategori", [T.subdivisiDari("CDD"), T.subdivisiDari("Trailer Impor"), T.subdivisiDari("X")], ["kecil", "besar", ""]);
eq("judul otomatis dan selesai otomatis", [T.judulTracking(" DO-1 ", "PT A"), T.selesaiOtomatis({ pod: "kembali", tagihan: "konfirmasi" }), T.selesaiOtomatis({ pod: "kembali", tagihan: "dikirim" })], ["DO-1 · PT A", true, false]);
// Rute: ketik bebas, saran dari riwayat, pengiriman berulang
eq("bagi rute: panah, ke, strip spasi; nama dengan titik atau tanpa spasi tidak terpecah", [T.bagiRute("Jakarta → Surabaya"), T.bagiRute("Tj. Priok -> Cikarang -> Bekasi"), T.bagiRute("jakarta ke surabaya"), T.bagiRute("Jakarta - Surabaya"), T.bagiRute("Jakarta-Selatan"), T.bagiRute("")], [["Jakarta", "Surabaya"], ["Tj. Priok", "Cikarang", "Bekasi"], ["jakarta", "surabaya"], ["Jakarta", "Surabaya"], ["Jakarta-Selatan"], []]);
const RJ = (id, customer, kat, vendor, titik, o = {}) => ({ id, status: "proses", customer, kategori: kat, tglMasuk: "2026-11-" + String(10 + o.h || 10), rinci: { jenis: "distribusi", vendor, titik: titik.map((k, i) => ({ t: i ? "D" : "P", nama: "Gdg " + k, kota: k })) } });
const rj = [RJ("1", "PT A", "CDD", "CV X", ["Jakarta", "Surabaya"]), RJ("2", "PT A", "CDD", "CV X", ["Jakarta", "Surabaya"], { h: 1 }), RJ("3", "PT A", "CDE", "", ["Jakarta", "Semarang"]), RJ("4", "PT B", "CDD", "CV X", ["Jakarta", "Surabaya"]), RJ("5", "PT A", "CDD", "", ["Cikarang", "Bekasi"]), { id: "6", status: "batal", customer: "PT A", kategori: "CDD", rinci: { jenis: "distribusi", vendor: "CV X", titik: [{ t: "P", kota: "Bogor" }, { t: "D", kota: "Depok" }] } }];
eq("rute teks: Distribusi dari titik, Trailer dari asal, tujuan, tujuan lain", [T.ruteTeks(rj[0]), T.ruteTeks({ rinci: { jenis: "domestik", asal: "Jakarta", tujuan: "Surabaya", tujuanLain: ["Malang"] } })], ["Jakarta → Surabaya", "Jakarta → Surabaya → Malang"]);
const sr = T.saranRute(rj, { cust: "pt a", kat: "CDD", unit: "vendor" });
eq("saran rute: cocok (customer+armada+unit) dulu, lalu customer sama, lalu rute lain; batal diabaikan", sr.map((o) => [o.teks, o.n, o.nCust, o.nCocok]), [["Jakarta → Surabaya", 3, 2, 2], ["Cikarang → Bekasi", 1, 1, 0], ["Jakarta → Semarang", 1, 1, 0]]);
eq("saran rute: filter ketikan", T.saranRute(rj, { cust: "PT A", kat: "CDD", unit: "vendor", cari: "sema" }).map((o) => o.teks), ["Jakarta → Semarang"]);
eq("pengiriman berulang: customer, armada, unit, dan rute sama", [T.berulang(rj, { id: "9", customer: "PT A", kategori: "CDD", rinci: { vendor: "CV Y", asal: "jakarta", tujuan: "surabaya" } }), T.berulang(rj, { id: "9", customer: "PT A", kategori: "CDE", rinci: { vendor: "CV Y", asal: "Jakarta", tujuan: "Surabaya" } }), T.berulang(rj, { id: "9", customer: "PT A", kategori: "CDD", rinci: { vendor: "Internal", asal: "Jakarta", tujuan: "Surabaya" } }), T.berulang(rj, rj[3])], [true, false, false, false]);
process.exit(gagal ? 1 : 0);
