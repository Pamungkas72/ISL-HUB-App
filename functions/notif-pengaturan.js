// Pengaturan notifikasi email (murni, diuji tests/unit/notif-pengaturan.test.js): template, waktu kirim, dan nilai efektif per kejadian.
const BAWAAN = require("./notif-bawaan");

const WIB = 7 * 3600e3, HARI = 86400e3;
const KIRIM_BAWAAN = { mode: "langsung", menit: 10, jam: ["09:00"], hariKerja: true };
const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Ganti {variabel}; baris yang semua variabelnya kosong dibuang (buang=false untuk subjek: tidak ada baris dibuang). */
function render(tpl, vars, buang = true) {
  const isi = String(tpl || "").split("\n").filter((l) => { if (!buang) return true; const m = l.match(/\{\w+\}/g); return !m || m.some((x) => String(vars[x.slice(1, -1)] ?? "").trim() !== ""); })
    .map((l) => l.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""))).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return isi;
}
const rapikanSubjek = (s) => s.replace(/[\s·–-]+$/, "").trim();

/** Pengaturan efektif satu kejadian: dokumen pengaturan kelompok digabung dengan bawaan. */
function efektif(dok, tahap) {
  const k = ((dok && dok.kejadian) || {})[tahap] || {}, tp = k.tpl || {};
  const pilih = (b) => ({ subjek: (tp[b] && String(tp[b].subjek || "").trim()) || BAWAAN[tahap][b].subjek, isi: (tp[b] && String(tp[b].isi || "").trim()) || BAWAAN[tahap][b].isi });
  return { aktif: k.aktif !== false, kirim: { ...KIRIM_BAWAAN, ...(k.kirim || {}) }, tpl: { id: pilih("id"), en: pilih("en") } };
}

/** Waktu kirim (ms epoch): langsung, tunda N menit, atau slot jam WIB berikutnya (bisa hanya hari kerja). */
function hitungKirimPada(kirim, now) {
  const k = { ...KIRIM_BAWAAN, ...(kirim || {}) };
  if (k.mode === "tunda") return now + Math.min(Math.max(+k.menit || 0, 0), 1440) * 60e3;
  if (k.mode !== "jam") return now;
  const jam = (k.jam || []).filter((j) => JAM.test(j)).sort(); if (!jam.length) return now;
  const hari0 = Math.floor((now + WIB) / HARI) * HARI; // tengah malam WIB (dalam skala WIB)
  for (let d = 0; d < 9; d++) {
    const hari = hari0 + d * HARI, dow = new Date(hari).getUTCDay(); // 0 Minggu, 6 Sabtu
    if (k.hariKerja !== false && (dow === 0 || dow === 6)) continue;
    for (const j of jam) { const t = hari + (+j.slice(0, 2) * 60 + +j.slice(3)) * 60e3 - WIB; if (t >= now) return t; }
  }
  return now;
}
/** Data contoh untuk pratinjau dan kirim uji. */
const CONTOH = { nama: "PT Contoh Jaya", referensi: "DO-2026-0001", rute: "Jakarta → Surabaya", tglKirim: "26 November 2026" };
module.exports = { CONTOH, BAWAAN, KIRIM_BAWAAN, render, rapikanSubjek, efektif, hitungKirimPada, JAM };
