// Hitungan Master Uang Jalan (tab di Master Rate). Murni, tanpa DOM/Firebase; diuji di tests/unit/uang-jalan-master.test.mjs.
// BBM = (jarak PP / rasio) x solar. Total = BBM + tol + mel + opsional aktif + komponen lain, lalu dibulatkan (atau angka manual).
import { slug } from "./kunci.js";

export const SOLAR_AWAL = 6800, BULAT_AWAL = 1000;
// rasio = km per liter (bawaan, bisa diubah di Pengaturan tab). Long dan Trailer: perkiraan awal, koreksi lewat Pengaturan.
export const ARMADA = [
  { k: "bv", nama: "Grand Max Blind Van", pendek: "Blind Van", grup: "Mobil kecil", rasio: 10 },
  { k: "cde", nama: "CDE Standar", pendek: "CDE Std", grup: "Mobil kecil", rasio: 7 },
  { k: "cdel", nama: "CDE Long", pendek: "CDE Long", grup: "Mobil kecil", rasio: 6 },
  { k: "cdd", nama: "CDD Standar", pendek: "CDD Std", grup: "Mobil kecil", rasio: 5 },
  { k: "cddl", nama: "CDD Long", pendek: "CDD Long", grup: "Mobil kecil", rasio: 4.5 },
  { k: "fu", nama: "Fuso", pendek: "Fuso", grup: "Mobil kecil", rasio: 4 },
  { k: "tr", nama: "Tronton", pendek: "Tronton", grup: "Mobil kecil", rasio: 3 },
  { k: "t20", nama: "Trailer 20ft", pendek: "Trailer 20", grup: "Trailer", rasio: 3 },
  { k: "t40", nama: "Trailer 40ft", pendek: "Trailer 40", grup: "Trailer", rasio: 2.5 },
];
// Komponen opsional: nominal 0 = tidak dipakai. Insentif hanya berlaku untuk driver tidak digaji.
export const OPSIONAL = [
  { k: "tkbm", n: "TKBM", ket: "Tenaga kerja bongkar muat" },
  { k: "checker", n: "Checker", ket: "" },
  { k: "helper", n: "Helper", ket: "Kru tambahan di truk" },
  { k: "asuransi", n: "Asuransi", ket: "Nominal per trip" },
  { k: "insentif", n: "Insentif driver", ket: "Hanya driver tidak digaji, per trip" },
];

export const armadaDari = (k) => ARMADA.find((a) => a.k === k) || null;
export const rp = (n) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
export const angkaRp = (v) => { const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10); return isFinite(n) ? n : 0; }; // titik ribuan diabaikan
export const desimal = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".").replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; };
export const rasioAwal = (k, peng) => desimal((peng && peng.rasio && peng.rasio[k]) || (armadaDari(k) || {}).rasio || 0);

// Kunci baris master: satu rute x satu armada (sama di master dan di Tarif).
export const kunciUJ = (pickup, tujuan, armada) => `${slug(pickup)}__${slug(tujuan)}__${slug(armada)}`;
export const namaRute = (pickup, tujuan) => `${String(pickup).trim()} → ${String(tujuan).trim()}`;

/* i: { jarak, rasio, solar, tol, mel, digaji, opsi:{tkbm,checker,helper,asuransi,insentif}, lain:[{nama,v}], bulat, manual }
   Keluaran: baris rincian (untuk slip/pratinjau), subtotal, pembulatan, total, dan penanda manual. */
export function hitung(i) {
  const jarak = desimal(i.jarak), rasio = desimal(i.rasio), solar = angkaRp(i.solar), liter = jarak > 0 && rasio > 0 ? jarak / rasio : 0, bbm = Math.round(liter * solar);
  const o = i.opsi || {}, baris = [{ k: "bbm", n: "BBM", v: bbm, liter }, { k: "tol", n: "Tol", v: angkaRp(i.tol) }, { k: "mel", n: "Biaya mel", v: angkaRp(i.mel) }];
  OPSIONAL.forEach((c) => { if (c.k === "insentif" && i.digaji) return; const v = angkaRp(o[c.k]); if (v > 0) baris.push({ k: c.k, n: c.n, v }); });
  (i.lain || []).forEach((c) => { const v = angkaRp(c.v); if (c && c.nama && v > 0) baris.push({ k: "x:" + c.nama, n: c.nama, v }); });
  const subtotal = baris.reduce((a, b) => a + b.v, 0), step = angkaRp(i.bulat), bulatTotal = step > 0 ? Math.round(subtotal / step) * step : subtotal, manual = angkaRp(i.manual);
  return { liter, bbm, baris, subtotal, pembulatan: bulatTotal - subtotal, hitungTotal: bulatTotal, total: manual > 0 ? manual : bulatTotal, manual: manual > 0 };
}

// Ringkas satu baris master untuk daftar: "BBM 285.600 · Tol 135.000 · Mel 50.000 · Helper, Asuransi".
export function rincianSingkat(h) {
  const f = (n) => Math.round(n).toLocaleString("id-ID"), b = (k) => (h.baris.find((x) => x.k === k) || { v: 0 }).v, lain = h.baris.filter((x) => !["bbm", "tol", "mel"].includes(x.k)).map((x) => x.n);
  return `BBM ${f(b("bbm"))} · Tol ${f(b("tol"))} · Mel ${f(b("mel"))}${lain.length ? " · " + lain.join(", ") : ""}`;
}
