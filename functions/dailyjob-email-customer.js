// Email ke customer untuk pengiriman Tracking (murni, diuji tests/unit/daily-job-email-customer.test.js): "Order diterima" saat dicatat, "Terkirim" saat selesai.
const { selesaiOperasional } = require("./dailyjob-tracking-pesan");

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
/** Subjek dan isi teks. Bahasa mengikuti customer ("en" atau lain = Indonesia). */
function susunEmail(tahap, job, c) {
  const en = c && c.bahasa === "en", r = job.rinci || {}, ref = r.noDo || job.judul || "", rute = ruteJob(r), nama = (c && (c.namaLengkap || c.nama)) || job.customer || "";
  const baris = (a, b) => (b ? `${a}: ${b}\n` : "");
  if (tahap === "diterima") return en
    ? { subjek: `Order received${ref ? " · " + ref : ""}`, isi: `Dear ${nama},\n\nWe have received your shipment order.\n\n${baris("Reference", ref)}${baris("Route", rute)}${baris("Shipping date", tgl(r.tglKirim, true))}\nWe will keep you updated once the shipment is completed.\n\nBest regards,\nISL Tracking` }
    : { subjek: `Order diterima${ref ? " · " + ref : ""}`, isi: `Yth. ${nama},\n\nOrder pengiriman Anda telah kami terima.\n\n${baris("Referensi", ref)}${baris("Rute", rute)}${baris("Tanggal kirim", tgl(r.tglKirim))}\nKami akan mengabari kembali setelah pengiriman selesai.\n\nSalam,\nISL Tracking` };
  return en
    ? { subjek: `Shipment completed${ref ? " · " + ref : ""}`, isi: `Dear ${nama},\n\nYour shipment has been completed.\n\n${baris("Reference", ref)}${baris("Route", rute)}\nThe proof of delivery (POD) and invoice will be sent to you shortly.\n\nBest regards,\nISL Tracking` }
    : { subjek: `Pengiriman selesai${ref ? " · " + ref : ""}`, isi: `Yth. ${nama},\n\nPengiriman Anda telah selesai.\n\n${baris("Referensi", ref)}${baris("Rute", rute)}\nPOD dan tagihan akan segera kami kirimkan.\n\nSalam,\nISL Tracking` };
}
/** Dokumen antrean email. Kunci tetap (job + tahap) agar tidak terkirim dua kali. status "antre" = menunggu pengirim, "tanpa-email" = customer belum punya email. */
function antrean(tahap, id, job, c) {
  const ke = penerima(c), { subjek, isi } = susunEmail(tahap, job, c);
  return { kunci: `${id}_${tahap}`, doc: { jobId: id, kelompokId: job.kelompokId || null, tahap, customer: job.customer || "", ke, subjek, isi, status: ke ? "antre" : "tanpa-email", dibuat: Date.now() } };
}
module.exports = { norm, cariCustomer, penerima, tahapBaru, susunEmail, antrean };
