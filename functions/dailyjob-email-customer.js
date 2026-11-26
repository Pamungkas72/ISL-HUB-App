// Email ke customer untuk pengiriman Tracking (murni, diuji tests/unit/daily-job-email-customer.test.js): "Order diterima" saat dicatat, "Terkirim" saat selesai.
const { selesaiOperasional } = require("./dailyjob-tracking-pesan");
const N = require("./notif-pengaturan");

const norm = (s) => String(s || "").toLowerCase().replace(/\b(pt|cv|ud)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Customer dengan nama (atau nama lengkap) sama; null bila tidak ada. */
const cariCustomer = (nama, daftar) => { const n = norm(nama); return n ? (daftar || []).find((c) => norm(c.nama) === n || norm(c.namaLengkap) === n) || null : null; };
/** Email tujuan: kontak utama, lalu kontak mana pun yang beremail, lalu email umum. */
function penerima(c) {
  if (!c) return "";
  const k = (c.kontak || []).filter((x) => x && EMAIL.test(String(x.email || "").trim())), p = k.find((x) => x.utama) || k[0];
  return p ? p.email.trim() : EMAIL.test(String(c.emailUmum || "").trim()) ? c.emailUmum.trim() : "";
}
const terkirim = (r) => !!r && !!r.jenis && selesaiOperasional(r) !== "";
/** Tahap email yang baru terjadi pada perubahan sebelum → sesudah (dokumen job; sebelum null bila baru dibuat). Kosong bila dimatikan atau job batal. */
function tahapBaru(sebelum, sesudah) {
  if (!sesudah || !sesudah.rinci || !sesudah.rinci.jenis || sesudah.rinci.emailCust === false || sesudah.status === "batal") return [];
  const t = []; if (!sebelum) t.push("diterima");
  if (terkirim(sesudah.rinci) && !(sebelum && terkirim(sebelum.rinci))) t.push("terkirim");
  return t;
}
const tgl = (s, en) => (s ? new Date(String(s).slice(0, 10) + "T00:00:00Z").toLocaleDateString(en ? "en-GB" : "id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
const ruteJob = (r) => (r.titik && r.titik.length ? r.titik.map((x) => x.nama).filter(Boolean).join(" → ") : [r.asal, r.tujuan].filter(Boolean).join(" → "));
/** Variabel template dari job dan customer. */
function variabel(job, c) { const r = job.rinci || {}, en = c && c.bahasa === "en"; return { nama: (c && (c.namaLengkap || c.nama)) || job.customer || "", referensi: r.noDo || job.judul || "", rute: ruteJob(r), tglKirim: tgl(r.tglKirim, en) }; }
/** Subjek dan isi teks dari pengaturan efektif p (bawaan bila kosong). Bahasa mengikuti customer ("en" atau lain = Indonesia). */
function susunEmail(tahap, job, c, p) {
  const b = c && c.bahasa === "en" ? "en" : "id", t = (p || N.efektif(null, tahap)).tpl[b], v = variabel(job, c);
  return { subjek: N.rapikanSubjek(N.render(t.subjek, v, false)), isi: N.render(t.isi, v) };
}
/** Dokumen antrean email. Kunci tetap (job + tahap) agar tidak terkirim dua kali. status "antre" = menunggu pengirim, "tanpa-email" = customer belum punya email, "dimatikan" = email customer dimatikan. null bila kejadian dimatikan di pengaturan. */
function antrean(tahap, id, job, c, dok, sekarang = Date.now()) {
  const p = N.efektif(dok, tahap); if (!p.aktif) return null;
  const off = !!c && c.emailNotif === false, ke = off ? "" : penerima(c), { subjek, isi } = susunEmail(tahap, job, c, p);
  return { kunci: `${id}_${tahap}`, doc: { jobId: id, kelompokId: job.kelompokId || null, tahap, customer: job.customer || "", ke, subjek, isi, status: ke ? "antre" : off ? "dimatikan" : "tanpa-email", kirimPada: N.hitungKirimPada(p.kirim, sekarang), dibuat: sekarang } };
}
module.exports = { norm, cariCustomer, penerima, tahapBaru, variabel, susunEmail, antrean };
