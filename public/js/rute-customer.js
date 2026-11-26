// Daftar rute per customer (logika murni, diuji tests/unit/rute-customer.test.mjs): kunci, baca Excel, saran untuk form Tracking. Harga tagihan disimpan terpisah (cu_rute_tagihan).
import { bagiRute } from "./daily-job-tracking-hitung.js";

export const norm = (s) => String(s || "").toLowerCase().replace(/\b(pt|cv|ud)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Teks rute seragam: lokasi dipisah " → ". */
export const teksRute = (t) => bagiRute(t).join(" → ");
export const kunciRute = (t) => bagiRute(t).join(">").toLowerCase();
const samaJenis = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
/** ID dokumen tetap: customer + rute + jenis armada, sama untuk cu_rute dan cu_rute_tagihan. */
export const idRute = (cust, rute, jenis) => `r_${norm(cust)}_${slug(kunciRute(rute))}_${slug(jenis)}`.slice(0, 300);
export const angkaRp = (x) => Number(String(x ?? "").replace(/\D/g, "")) || 0;

/** Baris Excel (array of array) → { baris:[{rute, jenisArmada, tagihan|null}], lewat }. Judul kolom: Rute, Jenis armada, Tagihan (urutan bebas). */
export function bacaBaris(aoa) {
  const h = aoa.findIndex((r) => (r || []).some((c) => /^rute|^route/i.test(String(c).trim()))); if (h < 0) return { baris: [], lewat: aoa.length, galat: "Kolom \"Rute\" tidak ditemukan." };
  const kol = (re) => aoa[h].findIndex((c) => re.test(String(c).trim())), iR = kol(/^rute|^route/i), iJ = kol(/jenis|armada|unit|vehicle/i), iT = kol(/tagih|harga|tarif|invoice|price/i);
  const peta = new Map(); let lewat = 0;
  aoa.slice(h + 1).forEach((r) => {
    const rute = teksRute(r[iR]), jenis = iJ >= 0 ? String(r[iJ] || "").trim() : "";
    if (bagiRute(r[iR]).length < 2) { if (String(r[iR] || "").trim()) lewat++; return; }
    const k = kunciRute(rute) + "|" + jenis.toLowerCase(), t = iT >= 0 ? angkaRp(r[iT]) : 0;
    peta.set(k, { rute, jenisArmada: jenis, tagihan: t > 0 ? t : (peta.get(k) || {}).tagihan || null });
  });
  return { baris: [...peta.values()], lewat };
}
/** Saran dari daftar customer untuk form Tracking, bentuk sama dengan saranRute (daftar:true, tanpa contoh). Jenis armada sama atau daftar tanpa jenis = cocok. */
export function saran(daftar, { cust, jenis = "", cari = "" }, maks = 8) {
  const c = norm(cust), q = String(cari || "").trim().toLowerCase(); if (!c) return [];
  const m = new Map();
  (daftar || []).filter((d) => d.kunciCust === c && (!q || d.rute.toLowerCase().includes(q))).forEach((d) => {
    const cocok = !d.jenisArmada || samaJenis(d.jenisArmada, jenis) ? 1 : 0, k = kunciRute(d.rute), o = m.get(k);
    if (!o || (cocok && !o.nCocok)) m.set(k, { teks: d.rute, n: 0, nCust: 1, nCocok: cocok, daftar: true, contoh: null, jenisArmada: d.jenisArmada || "" });
  });
  return [...m.values()].sort((a, b) => b.nCocok - a.nCocok || a.teks.localeCompare(b.teks)).slice(0, maks);
}
/** Rute dari daftar yang tagihannya belum terisi. tag = peta id → { tagihan }. */
export const tanpaTagihan = (daftar, tag) => (daftar || []).filter((d) => !((tag || {})[d.id] || {}).tagihan);
/** Rute yang diketik tim tracking dan belum ada di daftar customer (jenis armada sama atau kosong). */
export const baruDiDaftar = (daftar, cust, rute, jenis) => bagiRute(rute).length >= 2 && !(daftar || []).some((d) => d.kunciCust === norm(cust) && kunciRute(d.rute) === kunciRute(rute) && (!d.jenisArmada || samaJenis(d.jenisArmada, jenis)));
