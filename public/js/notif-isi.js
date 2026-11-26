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

/* Laporan berkala: daftar kolom per profil dan tingkat izinnya (sama dengan functions/notif-laporan.js; dijaga tests/unit/notif-pengaturan.test.mjs). Penegakan izin ada di server. */
export const KOLOM_UI = {
  tracking: [["tglKirim", "Tanggal kirim", "umum"], ["noDo", "No. DO", "umum"], ["rute", "Rute", "umum"], ["kategori", "Jenis armada", "umum"], ["plat", "Plat nomor", "umum"], ["driver", "Driver", "umum"], ["kontainer", "No. kontainer", "umum"], ["status", "Status", "umum"], ["tglSelesai", "Tanggal selesai", "umum"], ["pod", "POD", "umum"], ["tglPod", "Tanggal POD", "umum"], ["vendor", "Vendor", "keuangan"], ["cost", "Biaya", "keuangan"], ["tagihan", "Status tagihan vendor", "keuangan"]],
};
export const IZIN_PROFIL = { tracking: ["umum"] };
export const KOLOM_BAWAAN = { tracking: ["tglKirim", "noDo", "rute", "kategori", "plat", "status", "pod"] };
export const NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export const LAPORAN_BARU = (profil) => ({ nama: "", aktif: true, periode: "mingguan", hari: 1, tanggal: 1, jam: "08:00", format: "xlsx", kolom: [...(KOLOM_BAWAAN[profil] || [])], filter: { status: "semua", kategori: [] }, kirimBilaKosong: false });
export const EMAIL_SAH = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Teks ringkas jadwal laporan. */
export const ringkasLaporan = (l) => `${l.periode === "harian" ? "Harian" : l.periode === "bulanan" ? `Bulanan, tanggal ${l.tanggal}` : `Mingguan, ${NAMA_HARI[(+l.hari || 1) - 1]}`} ${l.jam} · ${(l.format || "xlsx").toUpperCase()}`;

/* Kuota email (sama dengan functions/notif-kuota.js; dijaga tests/unit/notif-pengaturan.test.mjs). Resend gratis: 100/hari, 3.000/bulan, reset 00.00 UTC. */
export const BATAS_BAWAAN = { hari: 100, bulan: 3000 };
export const hariKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const bulanKey = (ms) => hariKey(ms).slice(0, 7);
const bulat = (x, bawaan) => (Number.isFinite(+x) && +x >= 1 ? Math.min(Math.round(+x), 100000) : bawaan);
export const batasKuota = (dok) => ({ hari: bulat(dok && dok.batasHari, BATAS_BAWAAN.hari), bulan: bulat(dok && dok.batasBulan, BATAS_BAWAAN.bulan) });
