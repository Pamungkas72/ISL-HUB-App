// Laporan berkala per customer yang dilampirkan di email notifikasi (murni, diuji tests/unit/notif-laporan.test.js).
// Aturan keras: isi laporan HANYA job milik customer itu, dan kolom dibatasi oleh tingkat izin kelompok (Tracking: tanpa angka biaya).
const E = require("./dailyjob-email-customer");
const { selesaiOperasional } = require("./dailyjob-tracking-pesan");

const WIB = 7 * 3600e3, HARI = 864e5;
const rn = (j) => (j && j.rinci) || {};
const statusLabel = (j) => (j.status === "batal" ? "Batal" : j.status === "selesai" || selesaiOperasional(rn(j)) ? "Selesai" : "Berjalan");
/* Kolom per profil kelompok. izin "umum" boleh dilihat customer; "keuangan" hanya untuk kelompok yang diberi izin itu (IZIN_PROFIL). Kolom baru cukup ditambah di sini dan di public/js/notif-isi.js. */
const KOLOM = {
  tracking: [
    { id: "tglKirim", label: "Tanggal kirim", izin: "umum", ambil: (j) => rn(j).tglKirim || j.tglMasuk || "" },
    { id: "noDo", label: "No. DO", izin: "umum", ambil: (j) => rn(j).noDo || j.judul || "" },
    { id: "rute", label: "Rute", izin: "umum", ambil: (j) => E.ruteJob(rn(j)) },
    { id: "kategori", label: "Jenis armada", izin: "umum", ambil: (j) => j.kategori || "" },
    { id: "plat", label: "Plat nomor", izin: "umum", ambil: (j) => rn(j).plat || "" },
    { id: "driver", label: "Driver", izin: "umum", ambil: (j) => rn(j).driver || "" },
    { id: "kontainer", label: "No. kontainer", izin: "umum", ambil: (j) => rn(j).kontainer || "" },
    { id: "status", label: "Status", izin: "umum", ambil: statusLabel },
    { id: "tglSelesai", label: "Tanggal selesai", izin: "umum", ambil: (j) => selesaiOperasional(rn(j)) || (j.status === "selesai" ? j.tglSelesai || "" : "") },
    { id: "pod", label: "POD", izin: "umum", ambil: (j) => (rn(j).pod === "kembali" ? "Sudah kembali" : "Belum kembali") },
    { id: "tglPod", label: "Tanggal POD", izin: "umum", ambil: (j) => rn(j).tglPod || "" },
    { id: "vendor", label: "Vendor", izin: "keuangan", ambil: (j) => rn(j).vendor || "" },
    { id: "cost", label: "Biaya", izin: "keuangan", ambil: (j) => Number(rn(j).cost) || 0 },
    { id: "tagihan", label: "Status tagihan vendor", izin: "keuangan", ambil: (j) => rn(j).tagihan || "" },
  ],
};
const IZIN_PROFIL = { tracking: ["umum"] };
const KOLOM_BAWAAN = { tracking: ["tglKirim", "noDo", "rute", "kategori", "plat", "status", "pod"] };
const FORMAT = ["xlsx", "csv"]; // PDF menyusul (format belum ditentukan)

const kolomProfil = (profil) => KOLOM[profil] || [];
/** Kolom yang benar-benar dipakai: urutan registry, hanya id terpilih yang izinnya diperbolehkan untuk profil ini. */
const kolomPakai = (profil, ids) => kolomProfil(profil).filter((k) => (ids || []).includes(k.id) && (IZIN_PROFIL[profil] || []).includes(k.izin));

const tglWib = (ms) => new Date(ms + WIB).toISOString().slice(0, 10);
const tambahTgl = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * HARI).toISOString().slice(0, 10);
const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Periode terbaru yang sudah jatuh tempo kirim: { key, dari, sampai, kirimPada } atau null (belum ada, atau sudah lewat >48 jam: tidak dikirim terlambat; bebas=true untuk pratinjau dan uji). */
function periode(lap, now, bebas = false) {
  const jam = JAM.test(lap.jam) ? lap.jam : "08:00", [h, m] = jam.split(":").map(Number), hariIni = tglWib(now);
  for (let i = 0; i < 40; i++) {
    const d = tambahTgl(hariIni, -i), t = new Date(d + "T00:00:00Z"), dow = t.getUTCDay() || 7, tgl = t.getUTCDate();
    const cocok = lap.periode === "mingguan" ? dow === (+lap.hari || 1) : lap.periode === "bulanan" ? tgl === Math.min(Math.max(+lap.tanggal || 1, 1), 28) : true;
    if (!cocok) continue;
    const kirimPada = Date.parse(d + "T00:00:00Z") + (h * 60 + m) * 60e3 - WIB; if (kirimPada > now) continue;
    if (!bebas && now - kirimPada > 48 * 3600e3) return null;
    if (lap.periode === "mingguan") return { key: d, dari: tambahTgl(d, -7), sampai: tambahTgl(d, -1), kirimPada };
    if (lap.periode === "bulanan") { const p = new Date(t); p.setUTCDate(1); p.setUTCMonth(p.getUTCMonth() - 1); const dari = p.toISOString().slice(0, 10); p.setUTCMonth(p.getUTCMonth() + 1); return { key: d, dari, sampai: tambahTgl(p.toISOString().slice(0, 10), -1), kirimPada }; }
    return { key: d, dari: tambahTgl(d, -1), sampai: tambahTgl(d, -1), kirimPada };
  }
  return null;
}

/** Job milik customer c (bukan customer lain) di kelompok itu, dalam rentang tanggal kirim, sesuai filter. */
function pilihJob(jobs, c, kelompokId, filter, rentang) {
  const f = filter || {}, kat = f.kategori || [];
  return (jobs || []).filter((j) => {
    if (j.kelompokId !== kelompokId || j.status === "batal" || E.cariCustomer(j.customer, [c]) !== c) return false;
    const t = String(rn(j).tglKirim || j.tglMasuk || "").slice(0, 10); if (!t || t < rentang.dari || t > rentang.sampai) return false;
    const sel = statusLabel(j) === "Selesai";
    if (f.status === "selesai" && !sel) return false; if (f.status === "berjalan" && sel) return false;
    return !kat.length || kat.includes(j.kategori || "");
  }).sort((a, b) => String(rn(a).tglKirim || a.tglMasuk).localeCompare(String(rn(b).tglKirim || b.tglMasuk)));
}
/** Tabel laporan: { header, rows } dengan kolom yang diizinkan saja. */
function tabel(profil, lap, jobs) {
  const k = kolomPakai(profil, lap.kolom && lap.kolom.length ? lap.kolom : KOLOM_BAWAAN[profil]);
  return { header: k.map((x) => x.label), rows: jobs.map((j) => k.map((x) => x.ambil(j))) };
}
const slug = (s) => String(s || "laporan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "laporan";
const namaBerkas = (lap, per, ext) => `${slug(lap.nama)}_${per.dari}_${per.sampai}.${ext}`;

const TEKS = {
  id: { sub: (n, p) => `${n} · ${p.dari === p.sampai ? p.dari : p.dari + " s.d. " + p.sampai}`, isi: (nm, n, p, t) => `Yth. ${nm},\n\nTerlampir laporan ${n} untuk periode ${p.dari === p.sampai ? p.dari : p.dari + " s.d. " + p.sampai} (${t} pengiriman).\n\nSalam,\nISL` },
  en: { sub: (n, p) => `${n} · ${p.dari === p.sampai ? p.dari : p.dari + " to " + p.sampai}`, isi: (nm, n, p, t) => `Dear ${nm},\n\nAttached is the ${n} report for ${p.dari === p.sampai ? p.dari : p.dari + " to " + p.sampai} (${t} shipments).\n\nBest regards,\nISL` },
};
function emailLaporan(lap, c, per, total) {
  const b = c && c.bahasa === "en" ? "en" : "id", t = TEKS[b], nm = (c && (c.namaLengkap || c.nama)) || "";
  return { subjek: t.sub(lap.nama || "Laporan", per), isi: t.isi(nm, lap.nama || "Laporan", per, total) };
}
module.exports = { KOLOM, IZIN_PROFIL, KOLOM_BAWAAN, FORMAT, kolomProfil, kolomPakai, periode, pilihJob, tabel, namaBerkas, emailLaporan, statusLabel };
