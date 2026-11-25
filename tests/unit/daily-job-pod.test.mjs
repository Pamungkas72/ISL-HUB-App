// Jalankan: node tests/unit/daily-job-pod.test.mjs
import * as P from "../../public/js/daily-job-pod.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const J = (rinci, o = {}) => ({ status: "proses", ...o, rinci }), now = "2026-11-23";
eq("cara bayar: internal, TOP, Cash (bawaan)", [P.cara(J({})), P.cara(J({ vendor: "Internal" })), P.cara(J({ vendor: "X", bayar: "top" })), P.cara(J({ vendor: "X" }))], ["internal", "internal", "top", "cash"]);
eq("resi ada: nomor atau berkas", [P.resiAda(J({ podKirim: { resi: "A" } })), P.resiAda(J({ podKirim: { berkas: [{ url: "u" }] } })), P.resiAda(J({ podKirim: { ekspedisi: "JNE" } })), P.resiAda(J({}))], [true, true, false, false]);
eq("lunas: internal dan TOP otomatis, Cash setelah transfer", [P.lunas(J({})), P.lunas(J({ vendor: "X", bayar: "top" })), P.lunas(J({ vendor: "X" })), P.lunas(J({ vendor: "X", tglBayar: "2026-11-20" }))], [true, true, false, true]);
eq("fase pasca: Cash tanpa resi tunggu POD; resi ada bayar; sudah bayar tunggu POD; POD kembali + bayar selesai", [P.fasePasca(J({ vendor: "X" })), P.fasePasca(J({ vendor: "X", podKirim: { resi: "R" } })), P.fasePasca(J({ vendor: "X", podKirim: { resi: "R" }, tglBayar: "2026-11-21" })), P.fasePasca(J({ vendor: "X", pod: "kembali", tglBayar: "2026-11-21" })), P.fasePasca(J({ vendor: "X", pod: "kembali" })), P.fasePasca(J({ pod: "kembali" }))], ["pod", "bayar", "pod", "selesai", "bayar", "selesai"]);
eq("peringatan: resi belum diisi 3 hari; POD belum sampai 5 hari sejak resi; internal dan kembali tidak", [
  P.peringatanPod(J({ vendor: "X" }), "2026-11-21", now), P.peringatanPod(J({ vendor: "X" }), "2026-11-20", now),
  P.peringatanPod(J({ vendor: "X", podKirim: { resi: "R", tgl: "2026-11-19" } }), "2026-11-10", now), P.peringatanPod(J({ vendor: "X", podKirim: { resi: "R", tgl: "2026-11-18" } }), "2026-11-10", now),
  P.peringatanPod(J({}), "2026-11-01", now), P.peringatanPod(J({ vendor: "X", pod: "kembali" }), "2026-11-01", now), P.peringatanPod(J({ vendor: "X" }), "", now)], ["", "resi", "", "pod", "", "", ""]);
process.exit(gagal ? 1 : 0);
