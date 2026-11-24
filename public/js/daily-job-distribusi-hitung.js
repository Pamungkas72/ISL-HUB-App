// Truk Distribusi: aturan murni (titik pick up/drop, Armada dan pengingat, uang jalan, KPI). Diuji di tests/unit/daily-job-distribusi.test.mjs.
import { dalam, hariIni, selisihHari, tambahHari } from "./daily-job-hitung.js";
import { rinci } from "./daily-job-tracking-hitung.js";

export const JENIS_ARMADA = ["Blind Van", "CDE", "CDD", "Fuso", "Tronton"];
export const TIPE_BAK = ["Box", "Box Reefer", "Wing Box", "Bak", "Losbak", "Three Way"];
export const RASIO_BBM = { "Blind Van": 10, CDE: 7, CDD: 5, Fuso: 4, Tronton: 3 }; // km per liter, bawaan; bisa diubah di Pengaturan
export const POLA = { "1-1": "1 pick up, 1 drop", "1-n": "1 pick up, banyak drop", "n-1": "Banyak pick up, 1 drop", "n-n": "Banyak pick up, banyak drop" };
export const TAHAP = [["siap", "Siap"], ["pickup", "Pick up"], ["drop", "Drop"], ["pod", "POD"]];

/** Titik: [{ t: "P"|"D", nama, kota, selesai: "ISO"|null }]. */
export const titikDari = (j) => (rinci(j).titik || []).filter((x) => x && (x.t === "P" || x.t === "D"));
export const jmlTitik = (j) => { const t = titikDari(j); return { p: t.filter((x) => x.t === "P").length, d: t.filter((x) => x.t === "D").length }; };
export const pola = (j) => { const { p, d } = jmlTitik(j); return p && d ? `${p}→${d}` : ""; };
export const kodePola = (j) => { const { p, d } = jmlTitik(j); return `${p > 1 ? "n" : 1}-${d > 1 ? "n" : 1}`; };
export const selesaiTitik = (j, t) => titikDari(j).filter((x) => x.t === t && x.selesai).length;
/** Kemajuan 0..4: siap, semua pick up, semua drop, POD. Label drop memuat posisi (mis. "Drop 1/3"). */
export function kemajuan(j) {
  const r = rinci(j), { p, d } = jmlTitik(j); let n = 0;
  if (r.tahap && r.tahap.siap) n = 1; else return 0;
  if (p && selesaiTitik(j, "P") === p) n = 2; else return n;
  if (d && selesaiTitik(j, "D") === d) n = 3; else return n;
  return r.pod === "kembali" ? 4 : 3;
}
export function labelTahap(j) {
  const n = kemajuan(j), { p, d } = jmlTitik(j);
  if (n === 4) return "POD kembali"; if (n === 3) return "POD";
  if (n === 2) return d > 1 ? `Drop ${selesaiTitik(j, "D")}/${d}` : "Drop";
  if (n === 1) return p > 1 ? `Pick up ${selesaiTitik(j, "P")}/${p}` : "Pick up";
  return rinci(j).armada || rinci(j).vendor || rinci(j).kendaraanId ? "Siap" : "Order baru";
}
/** Menandai titik berikut (urut: semua pick up dulu, lalu drop). Mengembalikan rinci baru. */
export function tandaiTitik(j, waktu) {
  const r = rinci(j), t = titikDari(j).map((x) => ({ ...x })), i = t.findIndex((x) => x.t === "P" && !x.selesai), k = i >= 0 ? i : t.findIndex((x) => x.t === "D" && !x.selesai);
  if (k < 0) return r; t[k].selesai = waktu; return { ...r, titik: t };
}
export const internal = (j) => { const v = rinci(j).vendor; return !v || /^internal$/i.test(v); };
export const podKembali = (j) => rinci(j).pod === "kembali";
export const dibayarTanpaPod = (j) => j.status !== "batal" && !podKembali(j) && !internal(j) && !!rinci(j).tglBayar;
export const selesaiOtomatis = (j) => podKembali(j) && (internal(j) || !!rinci(j).tglBayar);

/** Uang jalan: BBM = jarak PP / rasio x harga solar; ditambah tol, TKBM (opsional), retribusi, insentif borongan, dan komponen lain. */
export function hitungUangJalan(i) {
  const rasio = Number(i.rasio) || RASIO_BBM[i.jenisArmada] || 0, jarak = Number(i.jarak) || 0, solar = Number(i.solar) || 0, liter = rasio ? jarak / rasio : 0, bbm = Math.round(liter * solar);
  const baris = [["BBM", bbm], ["Tol", Number(i.tol) || 0], ["TKBM", i.tkbm ? Number(i.tkbm) || 0 : 0], ["Retribusi / mel", Number(i.retribusi) || 0], ["Insentif driver borongan", Number(i.insentif) || 0], ...Object.entries(i.lain || {}).map(([n, v]) => [n, Number(v) || 0])];
  return { liter: Math.round(liter * 10) / 10, rasio, baris, total: baris.reduce((a, b) => a + b[1], 0) };
}
/** Tarif tetap: peta { "rute|jenisArmada": nominal }; hanya tarif berstatus "setuju" yang dipakai. */
export const kunciTarif = (rute, jenis) => `${String(rute).trim().toLowerCase()}|${jenis}`;
export const cariTarif = (daftar, rute, jenis) => (daftar || []).find((t) => t.status === "setuju" && kunciTarif(t.rute, t.jenisArmada) === kunciTarif(rute, jenis)) || null;

/* ---------- Armada: kendaraan, dokumen, servis, sewa ---------- */
export const DOK = [["kir", "KIR"], ["stnk", "STNK"], ["pajak", "Pajak"]];
/** Tingkat urgensi dari sisa hari: lewat (<0), mendesak (<=7), segera (<=14), bulan (<=30), aman. */
export const tingkat = (sisa) => (sisa == null ? "aman" : sisa < 0 ? "lewat" : sisa <= 7 ? "mendesak" : sisa <= 14 ? "segera" : sisa <= 30 ? "bulan" : "aman");
const URUT = { lewat: 0, mendesak: 1, segera: 2, bulan: 3, aman: 4 };
const tambahBulan = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
/** Tanggal visit berikut tiap bulan dari visit terakhir (atau tanggal mulai sewa). */
export const visitBerikut = (k) => { const s = k.sewa; return s && s.mulai && (!s.akhir || s.akhir >= hariIni()) ? tambahBulan(s.visitTerakhir || s.mulai, 1) : ""; };
/** Servis jatuh tempo bila tanggal berikut mendekat atau odometer mendekati km berikut (sisa <= 1.000 km). */
export function servisDue(k, now = hariIni()) {
  const s = k.servis; if (!s) return null;
  const sisaHari = s.tglBerikut ? selisihHari(s.tglBerikut, now) : null, sisaKm = s.kmBerikut && s.odo != null ? s.kmBerikut - s.odo : null;
  const hariDariKm = sisaKm == null ? null : sisaKm <= 0 ? -1 : sisaKm <= 1000 ? 7 : null;
  const sisa = [sisaHari, hariDariKm].filter((x) => x != null).sort((a, b) => a - b)[0];
  return sisa == null ? null : { sisa, sisaHari, sisaKm };
}
/** Semua tugas Armada, urut paling mendesak. Hanya yang <= 30 hari atau lewat yang disertakan. */
export function tugasArmada(kendaraan, now = hariIni()) {
  const o = [];
  (kendaraan || []).filter((k) => k.aktif !== false).forEach((k) => {
    DOK.forEach(([id, nama]) => { if (k[id]) { const sisa = selisihHari(k[id], now); o.push({ tipe: id, nama, k, tgl: k[id], sisa }); } });
    const sv = servisDue(k, now); if (sv) o.push({ tipe: "servis", nama: "Servis", k, tgl: (k.servis || {}).tglBerikut || "", sisa: sv.sisa, sisaKm: sv.sisaKm });
    const vb = visitBerikut(k); if (vb) o.push({ tipe: "visit", nama: "Visit inspeksi", k, tgl: vb, sisa: selisihHari(vb, now) });
  });
  return o.map((x) => ({ ...x, tingkat: tingkat(x.sisa) })).filter((x) => x.tingkat !== "aman").sort((a, b) => URUT[a.tingkat] - URUT[b.tingkat] || a.sisa - b.sisa);
}
export const kepatuhan = (kendaraan, now = hariIni()) => ["kir", "stnk", "pajak", "servis"].map((t) => {
  const akt = (kendaraan || []).filter((k) => k.aktif !== false), nilai = (k) => (t === "servis" ? (servisDue(k, now) || {}).sisa : k[t] ? selisihHari(k[t], now) : null), s = akt.filter((k) => nilai(k) != null).map((k) => tingkat(nilai(k)));
  return { tipe: t, aman: s.filter((x) => x === "aman").length, bulan: s.filter((x) => x === "bulan" || x === "segera" || x === "mendesak").length, lewat: s.filter((x) => x === "lewat").length };
});
export const ringkasSewa = (kendaraan) => { const l = (kendaraan || []).filter((k) => k.sewa && (!k.sewa.akhir || k.sewa.akhir >= hariIni())); const kota = {}; l.forEach((k) => { kota[k.sewa.kota || "-"] = (kota[k.sewa.kota || "-"] || 0) + 1; }); return { total: l.length, driver: l.filter((k) => k.sewa.bentuk === "driver").length, lepas: l.filter((k) => k.sewa.bentuk === "lepas").length, kota: Object.entries(kota).map(([nama, n]) => ({ nama, n })).sort((a, b) => b.n - a.n) }; };

/** KPI Performa Truk Distribusi untuk periode r. Ritase = satu pengiriman yang pick up-nya sudah mulai. */
export function hitungDistribusi(jobs, r, now = hariIni()) {
  const js = jobs.filter((j) => j.status !== "batal" && rinci(j).jenis === "distribusi"), order = js.filter((j) => dalam(j.tglMasuk, r)), rit = js.filter((j) => dalam(rinci(j).tglKirim || j.tglMasuk, r) && kemajuan(j) >= 2 || (dalam(rinci(j).tglKirim || j.tglMasuk, r) && selesaiTitik(j, "P") > 0));
  const biaya = (l) => l.reduce((a, j) => a + (Number(rinci(j).cost) || 0), 0);
  const kel = (kunci) => { const m = new Map(); rit.forEach((j) => { const k = kunci(j) || "-", o = m.get(k) || { nama: k, ritase: 0, cost: 0 }; o.ritase++; o.cost += Number(rinci(j).cost) || 0; m.set(k, o); }); return [...m.values()].map((o) => ({ ...o, perRitase: Math.round(o.cost / o.ritase) })).sort((a, b) => b.ritase - a.ritase); };
  return { order: order.length, ritase: rit.length, drop: rit.reduce((a, j) => a + jmlTitik(j).d, 0), cost: biaya(rit), costInternal: biaya(rit.filter(internal)), costVendor: biaya(rit.filter((j) => !internal(j))), ritaseInternal: rit.filter(internal).length, ritaseVendor: rit.filter((j) => !internal(j)).length, costPerRitase: rit.length ? Math.round(biaya(rit) / rit.length) : 0,
    perJenis: JENIS_ARMADA.map((n) => ({ n, ...(kel((j) => rinci(j).jenisArmada).find((o) => o.nama === n) || { ritase: 0, cost: 0, perRitase: 0 }) })), perBak: kel((j) => rinci(j).bak), perVendor: kel((j) => (internal(j) ? "Internal (uang jalan)" : rinci(j).vendor)),
    perRute: kel((j) => { const t = titikDari(j); const p = t.find((x) => x.t === "P"), d = [...t].reverse().find((x) => x.t === "D"); return p && d ? `${p.kota || p.nama} → ${d.kota || d.nama}` : ""; }).slice(0, 8),
    tanpaPod: js.filter(dibayarTanpaPod).length, tungguPod: js.filter((j) => kemajuan(j) === 3).length };
}
export { tambahHari };

/** Langkah berikut yang bisa ditandai: titik pick up dulu, lalu drop, lalu POD. null bila sudah selesai semua. */
export function berikut(j) {
  const t = titikDari(j), p = t.find((x) => x.t === "P" && !x.selesai), dr = t.find((x) => x.t === "D" && !x.selesai);
  if (!t.length) return null;
  if (p) return { jenis: "P", label: `Pick up ${t.filter((x) => x.t === "P" && x.selesai).length + 1}: ${p.nama || p.kota || ""}`.trim() };
  if (dr) return { jenis: "D", label: `Drop ${t.filter((x) => x.t === "D" && x.selesai).length + 1}: ${dr.nama || dr.kota || ""}`.trim() };
  return podKembali(j) ? null : { jenis: "POD", label: "POD kembali" };
}
/** Tandai langkah berikut selesai; mengembalikan rinci baru. */
export function tandaiBerikut(j, waktu) {
  const b = berikut(j); if (!b) return rinci(j);
  return b.jenis === "POD" ? { ...rinci(j), pod: "kembali", tglPod: String(waktu).slice(0, 10) } : tandaiTitik(j, waktu);
}
/** Batalkan langkah terakhir (salah tekan): POD dulu, lalu drop terakhir, lalu pick up terakhir. */
export function batalkanBerikut(j) {
  const r = rinci(j); if (r.pod === "kembali") return { ...r, pod: "belum", tglPod: null };
  const t = titikDari(j).map((x) => ({ ...x })); let k = -1;
  for (const jenis of ["D", "P"]) { for (let i = t.length - 1; i >= 0; i--) if (t[i].t === jenis && t[i].selesai) { k = i; break; } if (k >= 0) break; }
  if (k >= 0) t[k].selesai = null; return { ...r, titik: t };
}
