// Isi dan jadwal notifikasi email di sisi klien (pratinjau). Logika render sama dengan functions/notif-pengaturan.js (dijaga tests/unit/notif-pengaturan.test.mjs).
import BAWAAN from "./notif-bawaan.js";

export { BAWAAN };
/* Kejadian per profil kelompok. Kejadian baru cukup ditambahkan di sini dan di functions/notif-bawaan.js. */
export const KEJADIAN = {
  tracking: [
    { id: "diterima", nama: "Order diterima", ket: "Saat job Tracking dicatat" },
    { id: "terkirim", nama: "Pengiriman selesai", ket: "Saat pengiriman selesai (POD, titik tujuan)" },
  ],
};
export const VARIABEL = [["nama", "Nama customer"], ["referensi", "No. DO"], ["rute", "Rute"], ["tglKirim", "Tanggal kirim"]];
export const CONTOH = { nama: "PT Contoh Jaya", referensi: "DO-2026-0001", rute: "Jakarta → Surabaya", tglKirim: "26 November 2026" };
export const KIRIM_BAWAAN = { mode: "langsung", menit: 10, jam: ["09:00"], hariKerja: true };

export function render(tpl, vars, buang = true) {
  return String(tpl || "").split("\n").filter((l) => { if (!buang) return true; const m = l.match(/\{\w+\}/g); return !m || m.some((x) => String(vars[x.slice(1, -1)] ?? "").trim() !== ""); })
    .map((l) => l.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""))).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export const rapikanSubjek = (s) => s.replace(/[\s·–-]+$/, "").trim();
/** Pengaturan efektif satu kejadian dari dokumen kelompok (bawaan bila kosong). */
export function efektif(dok, tahap) {
  const k = ((dok && dok.kejadian) || {})[tahap] || {}, tp = k.tpl || {};
  const pilih = (b) => ({ subjek: (tp[b] && String(tp[b].subjek || "").trim()) || BAWAAN[tahap][b].subjek, isi: (tp[b] && String(tp[b].isi || "").trim()) || BAWAAN[tahap][b].isi });
  return { aktif: k.aktif !== false, kirim: { ...KIRIM_BAWAAN, ...(k.kirim || {}) }, tpl: { id: pilih("id"), en: pilih("en") } };
}
/** Teks ringkas waktu kirim untuk daftar kejadian. */
export function ringkasKirim(k) {
  if (k.mode === "tunda") return `Tunda ${k.menit} menit`;
  if (k.mode === "jam") return `Jam ${(k.jam || []).join(", ") || "-"}${k.hariKerja === false ? "" : " (hari kerja)"}`;
  return "Langsung";
}
