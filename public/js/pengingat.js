// ===========================================================
// PENGINGAT — aturan murni (tanpa tampilan Firebase), mudah diubah di satu tempat.
// 1. Quotation menggantung: draf/terkirim tanpa pembaruan >= 7 hari.
//    Status akhir (disetujui, ditolak, tidak dipakai) dan yang sudah digantikan revisi tidak dihitung.
// 2. Tarif perlu verifikasi ulang ke vendor: terakhir diverifikasi (atau, untuk tarif lama, terakhir
//    diperbarui) sudah >= 365 hari. Lewat 30 hari dari batas itu = tingkat "lewat".
// ===========================================================
export const ATURAN_PENGINGAT = {
  gantungHari: 7,
  riwayatHari: 3,                          // riwayat PDF terkirim: diingatkan tiap 3 hari
  riwayatStatus: ["terkirim", "belum_respons"],
  verifikasiHari: 365,                     // tarif diverifikasi ulang ke vendor tiap 1 tahun
  verifikasiLewatHari: 30,                 // sesudah batas + 30 hari: tingkat "lewat"
  statusDihitung: ["draf", "terkirim"],
};

const tglKe = (s) => new Date(String(s).slice(0, 10) + "T00:00:00");
export const hariIni = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const selisih = (a, b) => Math.round((tglKe(a) - tglKe(b)) / 864e5);

/** Tanggal pembaruan terakhir sebuah quotation (ubah, tindak lanjut, kirim, atau buat). */
export function pembaruanTerakhir(q) {
  const tl = (q.tindakLanjut || []).slice(-1)[0];
  return [q.diubahPada, tl && tl.tanggal, q.dikirim, q.dibuatPada, q.tanggalBuat].filter(Boolean).map((x) => String(x).slice(0, 10)).sort().pop() || null;
}

export function quotationGantung(daftar, { hari = ATURAN_PENGINGAT.gantungHari, sekarang = hariIni() } = {}) {
  return (daftar || [])
    .filter((q) => ATURAN_PENGINGAT.statusDihitung.includes(q.status) && !q.digantikanOleh && !q.arsip)
    .map((q) => { const p = pembaruanTerakhir(q); return p ? { q, hari: selisih(sekarang, p) } : null; })
    .filter((x) => x && x.hari >= hari)
    .sort((a, b) => b.hari - a.hari);
}

/** Tanggal acuan verifikasi: diverifikasiPada; tarif lama yang belum pernah diverifikasi memakai tanggal pembaruan terakhir. */
export const acuanVerifikasi = (t) => String(t.diverifikasiPada || t.diperbaruiPada || t.dibuatPada || "").slice(0, 10) || null;

/** Tarif aktif yang sudah >= 1 tahun sejak terakhir diverifikasi ke vendor. */
export function tarifPerluVerifikasi(tarif, vendor, { hari = ATURAN_PENGINGAT.verifikasiHari, sekarang = hariIni() } = {}) {
  const nv = new Map((vendor || []).map((v) => [v.id, v.nama || v.namaLengkap || v.id]));
  return (tarif || [])
    .filter((t) => t.aktif !== false && t.vendorId !== "internal" && acuanVerifikasi(t))
    .map((t) => ({ t, umur: selisih(sekarang, acuanVerifikasi(t)), vendor: nv.get(t.vendorId) || t.vendorId }))
    .filter((x) => x.umur >= hari)
    .map((x) => ({ ...x, tingkat: x.umur >= hari + ATURAN_PENGINGAT.verifikasiLewatHari ? "lewat" : "dekat" }))
    .sort((a, b) => b.umur - a.umur);
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const labelUmur = (hari) => (hari >= 365 ? `${Math.floor(hari / 365)} thn ${Math.floor((hari % 365) / 30)} bln` : hari >= 30 ? `${Math.floor(hari / 30)} bln` : `${hari} hari`);

/** Kartu pengingat untuk Beranda. Kosong bila tidak ada yang perlu perhatian. */
export function htmlPengingat({ gantung, tarif }) {
  if (!gantung.length && !tarif.length) return `<div class="pg-kartu pg-ok"><b>Semua beres.</b> Tidak ada quotation menggantung atau tarif yang perlu diverifikasi ulang.</div>`;
  const g = gantung.length ? `<div class="pg-kartu pg-warn"><div class="pg-h"><b>${gantung.length} quotation menggantung</b><small>tanpa pembaruan ≥ ${ATURAN_PENGINGAT.gantungHari} hari · diingatkan tiap hari sampai status diperbarui</small></div>
    ${gantung.slice(0, 8).map((x) => `<a class="pg-b" href="quotation.html"><span><b>${esc(x.q.nomor || x.q.labelDraf || "Draf")}</b> · ${esc(x.q.customerNama || "—")}</span><em>${x.hari} hari</em></a>`).join("")}</div>` : "";
  const t = tarif.length ? `<div class="pg-kartu ${tarif.some((x) => x.tingkat === "lewat") ? "pg-bahaya" : "pg-warn"}"><div class="pg-h"><b>${tarif.length} tarif perlu verifikasi ulang ke vendor</b><small>terakhir dicek ${ATURAN_PENGINGAT.verifikasiHari} hari lalu atau lebih</small></div>
    ${tarif.slice(0, 8).map((x) => `<a class="pg-b" href="app.html#master-rate"><span><b>${esc(x.t.layananNama || x.t.layanan)}</b> · ${esc(x.vendor)}</span><em class="pg-${x.tingkat}">${labelUmur(x.umur)}</em></a>`).join("")}</div>` : "";
  return g + t;
}

/** Riwayat quotation PDF (dibuat di luar sistem) yang belum ada respons >= 3 hari sejak status terakhir. */
export function riwayatPerluTindak(daftar, { hari = ATURAN_PENGINGAT.riwayatHari, sekarang = hariIni() } = {}) {
  return (daftar || [])
    .filter((x) => ATURAN_PENGINGAT.riwayatStatus.includes(x.status))
    .map((x) => { const t = String(x.statusPada || x.tanggalKirim || "").slice(0, 10); return t ? { x, hari: selisih(sekarang, t) } : null; })
    .filter((r) => r && r.hari >= hari)
    .sort((a, b) => b.hari - a.hari);
}
