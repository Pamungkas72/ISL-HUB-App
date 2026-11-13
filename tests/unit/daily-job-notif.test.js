// Jalankan: node tests/unit/daily-job-notif.test.js
const N = require("../../functions/dailyjob-pesan.js");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const wib = (jam) => new Date(`2026-11-13T${String(jam).padStart(2, "0")}:00:00+07:00`);
const J = [{ judul: "Telat", status: "proses", tglTarget: "2026-11-10" }, { judul: "Hari ini", status: "baru", tglTarget: "2026-11-13" }, { judul: "Besok A", status: "baru", tglTarget: "2026-11-14" }, { judul: "Besok B", status: "tunggu", tglTarget: "2026-11-14" }, { judul: "Selesai", status: "selesai", tglTarget: "2026-11-14" }, { judul: "Nanti", status: "baru", tglTarget: "2026-11-20" }];
const p9 = N.bangunPesan(J, wib(9));
eq("09.00: dua notifikasi (catat + H-1)", p9.map((p) => p.tag), ["dj-catat-9", "dj-h1"]);
eq("catat memuat ringkasan", p9[0].body, "Catat job baru dan yang masih pending. 1 terlambat · 1 jatuh tempo hari ini · 2 jatuh tempo besok.");
eq("H-1 hanya job aktif, judul dan jumlah", [p9[1].title, p9[1].body], ["2 deadline besok (H-1)", "Besok A; Besok B"]);
eq("14.00 dan 17.00: tanpa H-1", [N.bangunPesan(J, wib(14)).length, N.bangunPesan(J, wib(17)).length], [1, 1]);
eq("tanpa job: hanya ajakan catat", N.bangunPesan([], wib(9)), [{ tag: "dj-catat-9", title: "Catat daily job · 09.00", body: "Catat job baru dan yang masih pending." }]);
eq("lebih dari 3 deadline besok diringkas", N.bangunPesan([1, 2, 3, 4, 5].map((i) => ({ judul: "J" + i, status: "baru", tglTarget: "2026-11-14" })), wib(9))[1].body, "J1; J2; J3 +2 lainnya");
eq("hari Jakarta (bukan UTC)", N.hariJakarta(new Date("2026-11-13T18:00:00Z")), "2026-11-14");
process.exit(gagal ? 1 : 0);
