// Pengingat Tracking di notifikasi push 09.00 WIB (murni, diuji tests/unit/daily-job-notif-tracking.test.js):
// 1) POD vendor: perlu dibayar (Cash), resi POD belum diisi, POD belum sampai; 2) Armada: KIR, STNK, pajak, servis, visit sewa pada 30, 14, 7 hari, lalu setiap hari bila lewat tempo.
const { hariJakarta, jamJakarta, akhirPekan, tambahHari } = require("./dailyjob-pesan");

const selisih = (a, b) => Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 864e5);
const AKTIF = (j) => j.status !== "selesai" && j.status !== "batal";
const SEBELUM_POD = { impor: "mtreturn", ekspor: "gatein", repo: "grounded", domestik: "bongkar" }; // tahap terakhir sebelum POD (Trailer)
const internal = (r) => !r.vendor || /^internal$/i.test(r.vendor);
/** Tanggal operasional selesai (Trailer: tahap sebelum POD; Distribusi: titik terakhir); "" bila belum selesai. */
function selesaiOperasional(r) {
  if (r.jenis === "distribusi") { const t = (r.titik || []).filter((x) => x && x.selesai); const semua = (r.titik || []).length > 0 && t.length === (r.titik || []).length; return semua ? String(t.map((x) => x.selesai).sort().pop()).slice(0, 10) : ""; }
  const k = SEBELUM_POD[r.jenis]; return k && r.tahap && r.tahap[k] ? String(r.tahap[k]).slice(0, 10) : "";
}
/** Urusan POD vendor (internal tidak ikut: POD otomatis kembali): perlu dibayar (Cash, resi ada), resi belum diisi (3 hari setelah selesai), POD belum sampai (5 hari sejak resi). */
function pesanPod(jobs, hari) {
  const l = [];
  jobs.filter((j) => j.rinci && j.rinci.jenis && AKTIF(j) && !internal(j.rinci)).forEach((j) => {
    const r = j.rinci, p = r.podKirim || {}, resi = !!(p.resi || (p.berkas || []).length), kembali = r.pod === "kembali", t = selesaiOperasional(r), umur = (a) => Math.max(0, selisih(hari, a));
    let jenis = "";
    if (r.bayar !== "top" && !r.tglBayar && (resi || kembali)) jenis = "bayar";
    else if (!kembali && t && !resi && umur(t) >= 3) jenis = "resi";
    else if (!kembali && resi && umur(String(p.tgl || t || hari).slice(0, 10)) >= 5) jenis = "pod";
    if (jenis) l.push({ j, jenis, umur: t ? umur(t) : 0 });
  });
  if (!l.length) return null;
  const n = (x) => l.filter((y) => y.jenis === x).length, nama = (x) => `${x.j.rinci.noDo || x.j.judul} (${x.j.customer || "–"})`, urut = [...l].sort((a, b) => ["bayar", "pod", "resi"].indexOf(a.jenis) - ["bayar", "pod", "resi"].indexOf(b.jenis) || b.umur - a.umur), t = urut.slice(0, 3).map(nama), lebih = urut.length - t.length;
  const rinciJudul = [n("bayar") && `${n("bayar")} perlu dibayar`, n("resi") && `${n("resi")} resi POD belum diisi`, n("pod") && `${n("pod")} POD belum sampai`].filter(Boolean).join(" · ");
  return { tag: "dj-pod", title: `POD vendor: ${rinciJudul}`, body: t.join("; ") + (lebih > 0 ? ` +${lebih} lainnya` : "") + "." };
}
const NAMA = { kir: "KIR", stnk: "STNK", pajak: "Pajak", servis: "Servis", visit: "Visit" };
const tambahBulan = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
function tugasArmada(kendaraan, hari) {
  const o = [];
  kendaraan.filter((k) => k.aktif !== false).forEach((k) => {
    ["kir", "stnk", "pajak"].forEach((t) => { if (k[t]) o.push({ t, plat: k.plat, sisa: selisih(k[t], hari) }); });
    const s = k.servis || {}, hr = s.tglBerikut ? selisih(s.tglBerikut, hari) : null, km = s.kmBerikut && s.odo != null ? s.kmBerikut - s.odo : null, kmHari = km == null ? null : km <= 0 ? -1 : km <= 1000 ? 7 : null, sv = [hr, kmHari].filter((x) => x != null).sort((a, b) => a - b)[0];
    if (sv != null) o.push({ t: "servis", plat: k.plat, sisa: sv });
    const w = k.sewa; if (w && w.mulai && (!w.akhir || w.akhir >= hari)) o.push({ t: "visit", plat: k.plat, sisa: selisih(tambahBulan(w.visitTerakhir || w.mulai, 1), hari) });
  });
  return o;
}
function pesanArmada(kendaraan, hari) {
  const l = tugasArmada(kendaraan, hari).filter((x) => x.sisa < 0 || [0, 7, 14, 30].includes(x.sisa)).sort((a, b) => a.sisa - b.sisa);
  if (!l.length) return null; const lewat = l.filter((x) => x.sisa < 0).length, ket = (x) => `${NAMA[x.t]} ${x.plat} ${x.sisa < 0 ? `lewat ${-x.sisa} hari` : x.sisa === 0 ? "hari ini" : `${x.sisa} hari lagi`}`, t = l.slice(0, 3).map(ket), lebih = l.length - t.length;
  return { tag: "dj-armada", title: `${l.length} urusan Armada${lewat ? ` · ${lewat} lewat tempo` : ""}`, body: t.join("; ") + (lebih > 0 ? ` +${lebih} lainnya` : "") };
}
/** Pesan Tracking untuk satu penerima; hanya pada slot 09.00 hari kerja. */
function pesanTracking(jobs, kendaraan, sekarang) {
  if (akhirPekan(sekarang) || jamJakarta(sekarang) !== 9) return []; const hari = hariJakarta(sekarang);
  return [pesanPod(jobs, hari), pesanArmada(kendaraan, hari)].filter(Boolean);
}
module.exports = { pesanTracking, pesanPod, pesanArmada, tugasArmada, selesaiOperasional };
