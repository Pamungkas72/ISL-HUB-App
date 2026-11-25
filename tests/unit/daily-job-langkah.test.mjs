// Jalankan: node tests/unit/daily-job-langkah.test.mjs
import * as L from "../../public/js/daily-job-langkah.js";
import * as DZ from "../../public/js/daily-job-distribusi-hitung.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const W = "2026-11-25T17:20", titik = (sel) => [{ t: "P", nama: "A", kota: "Jakarta", selesai: sel }, { t: "D", nama: "B", kota: "Bekasi", selesai: sel }, { t: "D", nama: "C", kota: "Depok", selesai: sel }];
const J = (rinci, o = {}) => ({ id: "x", status: "proses", rinci: { jenis: "distribusi", noDo: "DO-1", tahap: { siap: "2026-11-25T08:00" }, titik: titik(null), ...rinci }, ...o });
eq("belum terkirim: hanya Terkirim", [L.langkahTersedia(J({ vendor: "CV X" })), L.langkahTersedia(J({}))], [["terkirim"], ["terkirim"]]);
eq("terkirim, vendor Cash tanpa resi: POD kembali (Dibayar belum)", L.langkahTersedia(J({ vendor: "CV X", titik: titik(W) })), ["pod"]);
eq("terkirim, vendor Cash dengan resi: POD kembali dan Dibayar", L.langkahTersedia(J({ vendor: "CV X", titik: titik(W), podKirim: { resi: "R1" } })), ["pod", "bayar"]);
eq("POD kembali, Cash belum dibayar: Dibayar; sudah dibayar: selesai tanpa langkah", [L.langkahTersedia(J({ vendor: "CV X", titik: titik(W), pod: "kembali" })), L.langkahTersedia(J({ vendor: "CV X", titik: titik(W), pod: "kembali", tglBayar: "2026-11-25" }, { status: "selesai" }))], [["bayar"], []]);
eq("vendor TOP terkirim: POD kembali saja; tanpa Dibayar", L.langkahTersedia(J({ vendor: "CV X", bayar: "top", titik: titik(W) })), ["pod"]);
eq("internal terkirim otomatis POD: tanpa langkah; batal dan Trailer: tanpa langkah", [L.langkahTersedia(J({ titik: titik(W), pod: "kembali" }, { status: "selesai" })), L.langkahTersedia(J({}, { status: "batal" })), L.langkahTersedia({ status: "proses", rinci: { jenis: "impor" } })], [[], [], []]);
const t = L.terapkan(J({ vendor: "CV X", titik: [{ t: "P", nama: "A", selesai: "2026-11-25T09:00" }, { t: "D", nama: "B", selesai: null }] }), "terkirim", W);
eq("Terkirim: semua titik selesai sekaligus, yang sudah selesai tetap; vendor tidak otomatis POD", [t.titik.map((x) => x.selesai), t.pod || "belum", DZ.kemajuan({ rinci: t })], [["2026-11-25T09:00", W], "belum", 3]);
const ti = L.terapkan(J({}), "terkirim", W);
eq("Terkirim unit internal: POD otomatis kembali", [ti.pod, ti.tglPod, DZ.kemajuan({ rinci: ti })], ["kembali", "2026-11-25", 4]);
eq("POD kembali dan Dibayar mengisi tanggal hari itu", [L.terapkan(J({ vendor: "X", titik: titik(W) }), "pod", W).tglPod, L.terapkan(J({ vendor: "X", titik: titik(W), pod: "kembali" }), "bayar", W).tglBayar], ["2026-11-25", "2026-11-25"]);
eq("blokir: POD dan Terkirim internal butuh No. DO; vendor Terkirim tidak; tanpa titik tidak bisa Terkirim", [L.blokir(J({ noDo: "" }), "terkirim") !== "", L.blokir(J({ noDo: "", vendor: "X", titik: titik(W) }), "pod") !== "", L.blokir(J({ noDo: "", vendor: "X" }), "terkirim"), L.blokir(J({ vendor: "X", titik: [] }), "terkirim") !== "", L.blokir(J({ vendor: "X", titik: titik(W) }), "bayar")], [true, true, "", true, ""]);
process.exit(gagal ? 1 : 0);
