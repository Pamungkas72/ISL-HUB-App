// Jalankan: node tests/unit/notif-kuota.test.js (Firestore tiruan; tanpa firebase-admin)
const Module = require("module"); let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const toko = new Map(), snap = (p) => ({ exists: toko.has(p), data: () => toko.get(p), get: (f) => (toko.get(p) || {})[f] });
const ref = (p) => ({ p, get: async () => snap(p), set: async (d, o) => { toko.set(p, o && o.merge ? { ...(toko.get(p) || {}), ...d } : d); } });
const fs = { doc: ref, runTransaction: async (fn) => { const tulis = []; const r = await fn({ get: async (x) => snap(x.p), set: (x, d, o) => tulis.push([x, d, o]) }); tulis.forEach(([x, d, o]) => x.set(d, o)); return r; } };
const asli = Module._load; Module._load = function (req, ...r) { return req === "firebase-admin" ? { firestore: () => fs } : asli.call(this, req, ...r); };
const Q = require("../../functions/notif-kuota-jalan.js");
const t0 = Date.parse("2026-11-26T03:00:00Z"), t1 = Date.parse("2026-11-27T00:30:00Z");
(async () => {
  eq("reservasi awal diterima", await Q.reservasi(2, t0), true);
  eq("pencacah hari dan bulan bertambah", [toko.get("notif_kuota/h_2026-11-26").n, toko.get("notif_kuota/b_2026-11").n], [2, 2]);
  toko.set("notif_pengaturan/_kuota", { batasHari: 5, batasBulan: 8 });
  eq("sampai tepat batas harian diterima", await Q.reservasi(3, t0), true);
  eq("melebihi batas harian ditolak dan pencacah tidak berubah", [await Q.reservasi(1, t0), toko.get("notif_kuota/h_2026-11-26").n], [false, 5]);
  eq("hariPenuh benar saat sama dengan batas", await Q.hariPenuh(t0), true);
  eq("hari baru (00.00 UTC): kuota harian segar, bulan berlanjut", [await Q.hariPenuh(t1), await Q.reservasi(3, t1), toko.get("notif_kuota/b_2026-11").n], [false, true, 8]);
  eq("batas bulanan menolak walau hari masih longgar", await Q.reservasi(1, t1), false);
  await Q.kembalikan(3, t1); eq("kembalikan menurunkan pencacah", [toko.get("notif_kuota/h_2026-11-27").n, toko.get("notif_kuota/b_2026-11").n], [0, 5]);
  await Q.kembalikan(99, t1); eq("kembalikan tidak pernah di bawah nol", toko.get("notif_kuota/h_2026-11-27").n, 0);
  toko.delete("notif_pengaturan/_kuota"); await Q.tandaiPenuh(t1);
  eq("Resend menolak (429): hari ditandai penuh sebesar batas bawaan", [toko.get("notif_kuota/h_2026-11-27").n, await Q.hariPenuh(t1)], [100, true]);
  process.exit(gagal ? 1 : 0);
})();
