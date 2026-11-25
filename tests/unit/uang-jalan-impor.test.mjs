// Jalankan: node tests/unit/uang-jalan-impor.test.mjs
import { buatRencana, cariArmada, petakanKolom } from "../../public/js/uang-jalan-impor.js";
import { hitung, kunciUJ } from "../../public/js/uang-jalan-hitung.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const peng = { solar: 6800, rasio: {} }, ref = (m = []) => ({ master: new Map(m.map((r) => [kunciUJ(r.pickup, r.tujuan, r.armada), r])), peng });
const B = (o) => ({ pickup: "Cikarang", tujuan: "Subang", armada: "CDD Standar", ...o });
const rc = (b, m) => buatRencana(petakanKolom(b), ref(m));

eq("petakan judul kolom (alias, huruf besar, spasi)", petakanKolom([{ "Pick Up": "A", TUJUAN: "B", Armada: "Fuso", "Uang  jalan": 1, "BBM / Solar": 2, Abaikan: 9 }]), [{ pickup: "A", tujuan: "B", armada: "Fuso", total: 1, bbm: 2 }]);
eq("cari armada: nama, singkat, kode, alias", ["CDD Standar", "CDD Std", "cdd", "Trailer 40ft", "trailer 40", "grand max", "Blind Van", "Mobil X"].map((t) => (cariArmada(t) || {}).k || null), ["cdd", "cdd", "cdd", "t40", "t40", "bv", "bv", null]);

const a = rc([B({ "Uang jalan": "Rp 200.000" })])[0];
eq("total saja: baru, nominal langsung tanpa rincian", [a.status, a.data.total, a.data.manual, a.data.rincian, a.data.sumber, a.data.bbm], ["baru", 200000, 200000, false, "impor", 0]);

const b = rc([B({ "BBM / Solar": 285600, Tol: 135000, Mel: 50000, Helper: 150000 })])[0];
eq("rincian saja: total = jumlah rincian tanpa pembulatan", [b.status, b.data.total, b.data.rincian, b.data.bbmNominal, b.data.opsi.helper, b.peringatan], ["baru", 620600, true, 285600, 150000, ""]);

const c = rc([B({ "Jarak PP (km)": 210, Tol: 135000, Mel: 50000 })])[0];
eq("BBM kosong + jarak: dihitung dari rasio CDD x solar", [c.data.bbm, c.data.total], [285600, 470600]);

const d = rc([B({ "Uang jalan": 700000, Tol: 135000, Mel: 50000 })])[0];
eq("total dan rincian beda: total dipakai + peringatan selisih", [d.data.total, d.data.rincian, /Rp185\.000.*Rp515\.000|berbeda Rp515\.000/.test(d.peringatan)], [700000, true, true]);

eq("insentif tanpa kolom driver = tidak digaji", rc([B({ "Uang jalan": 500000, "Insentif driver": 100000 })])[0].data.digaji, false);
eq("insentif + driver digaji = error", rc([B({ "Uang jalan": 500000, Driver: "Digaji", "Insentif driver": 100000 })])[0].status, "error");
eq("driver tidak dikenal = error", rc([B({ "Uang jalan": 500000, Driver: "mungkin" })])[0].status, "error");
eq("armada tak dikenal, pick up kosong, angka huruf, kosong semua = error", [rc([B({ Armada: "Becak", "Uang jalan": 1 })])[0].status, rc([B({ "Pick up": "", "Uang jalan": 1 })])[0].status, rc([B({ "Uang jalan": "dua ratus" })])[0].status, rc([B({})])[0].status], ["error", "error", "error", "error"]);
eq("angka negatif = error; baris benar-benar kosong dilewati", [rc([B({ "Uang jalan": -5 })])[0].status, rc([{ "Pick up": "", Tujuan: "", Armada: "", "Uang jalan": "" }]).length], ["error", 0]);

const dua = rc([B({ "Uang jalan": 100000 }), B({ "Uang jalan": 120000 })]);
eq("rute + armada dobel di file: kedua dipakai pertama, kembar kedua", dua.map((r) => r.status), ["baru", "kembar"]);

const lama = { pickup: "Cikarang", tujuan: "Subang", armada: "cdd", armadaNama: "CDD Standar", jarak: 210, rasio: 5, solar: 6800, tol: 135000, mel: 50000, opsi: { tkbm: 0, checker: 0, helper: 150000, asuransi: 25000, insentif: 0 }, lain: [], bulat: 1000, manual: 0, total: 646000, digaji: true };
const ubah = rc([B({ "Uang jalan": 700000 })], [lama])[0];
eq("rute ada, angka beda: ubah + perubahan lama -> baru", [ubah.status, ubah.perubahan.find((p) => p.label === "Uang jalan")], ["ubah", { label: "Uang jalan", lama: "Rp646.000", baru: "Rp700.000", beda: true }]);
eq("update total-only membuang rincian lama (nominal langsung)", [ubah.data.rincian, ubah.data.opsi.helper], [false, 0]);
const sama = rc([B({ "Uang jalan": 646000, Driver: "Digaji", "Jarak PP (km)": 210, "BBM / Solar": 285600, Tol: 135000, Mel: 50000, Helper: 150000, Asuransi: 25000 })], [lama])[0];
eq("baris persis sama dengan master = sama (aman diekspor lalu diimpor lagi)", sama.status, "sama");
eq("sheet impor total saja tidak mengubah jarak lama bila kolom jarak kosong", ubah.data.jarak, 210);

const h = hitung({ ...d.data, opsi: d.data.opsi, manual: d.data.manual });
eq("baris impor dipakai hitung(): total = angka manual", [h.total, h.manual], [700000, true]);
process.exit(gagal ? 1 : 0);
