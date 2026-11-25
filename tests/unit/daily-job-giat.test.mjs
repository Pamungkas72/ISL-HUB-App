// Jalankan: node tests/unit/daily-job-giat.test.mjs
import * as G from "../../public/js/daily-job-giat.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const now = "2026-11-25", g = (o) => ({ id: "x", jenis: "kunjungan", judul: "J", tgl: now, status: "rencana", ...o });
eq("jendela 6 hari", G.jendela(now).map((d) => d.h + d.n), ["Rab25", "Kam26", "Jum27", "Sab28", "Min29", "Sen30"]);
eq("lewat: belum selesai dan tanggal lalu", [G.lewat(g({ tgl: "2026-11-24" }), now), G.lewat(g({ tgl: "2026-11-24", status: "selesai" }), now), G.lewat(g({}), now)], [true, false, false]);
const l = [g({ id: "a", tgl: "2026-12-10", ingatkan: 7 }), g({ id: "b", tgl: "2026-12-02", ingatkan: 7 }), g({ id: "c", tgl: "2026-11-23" }), g({ id: "d", tgl: "2026-11-26", ingatkan: 1 }), g({ id: "e", tgl: "2026-11-30", ingatkan: 0 })];
eq("pengingat: dalam jendela ingatkan atau lewat", G.pengingat(l, now).map((x) => x.id), ["c", "d", "b"]);
eq("mendatang setelah jendela", G.mendatang(l, "2026-11-30").map((x) => x.id), ["b", "a"]);
eq("dokumen selesai memperbarui armada", G.dataArmada({ riwayat: [] }, g({ jenis: "dokumen", status: "selesai", dok: "kir", berlakuBaru: "2027-11-25" })).kir, "2027-11-25");
eq("dokumen tanpa tanggal baru / belum selesai: tidak ada", [G.dataArmada({}, g({ jenis: "dokumen", status: "selesai", dok: "kir" })), G.dataArmada({}, g({ jenis: "servis" })), G.dataArmada({}, g({ jenis: "survei", status: "selesai" }))], [null, null, null]);
eq("servis selesai: catat terakhir + riwayat", (({ servis, riwayat }) => [servis.terakhir, riwayat.length])(G.dataArmada({ servis: { odo: 5 }, riwayat: [] }, g({ jenis: "servis", status: "selesai", biaya: 100 }))), [now, 1]);
eq("ringkas bulan", G.ringkasBulan([g({ jenis: "servis", status: "selesai", biaya: 100, isu: true }), g({}), g({ tgl: "2026-10-01" })], "2026-11"), { total: 2, selesai: 1, biaya: 100, isu: 1, per: { servis: 1, kunjungan: 1 } });
process.exit(gagal ? 1 : 0);
