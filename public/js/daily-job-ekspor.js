// Ekspor Excel data shipment Tracking (murni, diuji tests/unit/daily-job-ekspor.test.mjs): satu lembar Tracking Trailer dan satu lembar Truk Distribusi.
// Satu baris = satu shipment/pengiriman. Pembuatan berkas .xlsx ada di daily-job.js (pustaka SheetJS).
import { hariIni, selisihHari } from "./daily-job-hitung.js";
import { rinci } from "./daily-job-tracking-hitung.js";
import * as TL from "./daily-job-trailer-hitung.js";
import * as DZ from "./daily-job-distribusi-hitung.js";

const STATUS = { baru: "Aktif", proses: "Aktif", tunggu: "Tertunda", selesai: "Selesai", batal: "Batal" };
const tgl = (s) => (s ? String(s).slice(0, 10) : "");
const waktu = (s) => (s ? String(s).slice(0, 16).replace("T", " ") : "");
const posisi = { siap: ["siap"], t2: ["pickup", "ambilmt"], t3: ["bongkar", "stuffing"], t4: ["mtreturn", "gatein", "grounded"] };
const tahap = (r, ks) => { const k = ks.find((x) => r.tahap && r.tahap[x]); return k ? waktu(r.tahap[k]) : ""; };
const dok = (j) => { const r = rinci(j), jn = TL.jenisTrailer(j); return jn ? TL.JENIS[jn].dok.filter((_, i) => r.dok && r.dok[i]).join("; ") : ""; };

export const KOLOM_TRAILER = ["No. DO", "Customer", "Jenis", "No. Kontainer", "Ukuran", "Pelayaran", "Depo MT", "Asal", "Tujuan", "Armada", "Vendor", "Plat", "Driver", "Telepon", "Tgl Order", "Tgl Kirim", "Target Tiba", "Siap", "Pick up / Ambil MT", "Bongkar / Stuffing", "MT return / Gate in / Grounded", "Tahap Saat Ini", "Pembayaran", "Cost (Rp)", "Tgl Bayar Vendor", "Janji POD", "POD", "Tgl POD Kembali", "Umur POD (hari)", "Kelengkapan Dokumen", "Dokumen dan Nomor", "Status", "PIC", "Catatan"];
export const KOLOM_DISTRIBUSI = ["No. DO", "Customer", "Pola", "Pick up", "Drop", "Titik (urutan)", "Rute", "Jenis Armada", "Tipe Bak", "Armada", "Vendor", "Plat", "Driver", "Telepon", "Tgl Order", "Tgl Kirim", "Target Tiba", "Tahap Saat Ini", "Pembayaran", "Cost (Rp)", "Tgl Bayar Vendor", "Janji POD", "POD", "Tgl POD Kembali", "Umur POD (hari)", "Status", "PIC", "Catatan"];
const bayar = (r) => (r.bayar === "top" ? "TOP" : "Cash");

/** Lembar Trailer: header + satu baris per shipment berjenis Trailer. */
export function lembarTrailer(jobs, now = hariIni()) {
  const l = jobs.filter((j) => TL.jenisTrailer(j)).sort((a, b) => String(rinci(a).tglKirim || a.tglMasuk).localeCompare(String(rinci(b).tglKirim || b.tglMasuk)));
  return [KOLOM_TRAILER, ...l.map((j) => { const r = rinci(j), ber = TL.tahapBerikut(j);
    return [r.noDo || j.judul, j.customer || "", TL.JENIS[r.jenis].nama, r.kontainer || "", r.ukuran || "", r.pelayaran || "", r.depo || "", r.asal || "", r.tujuan || "", TL.internal(j) ? "Internal" : "Vendor", TL.internal(j) ? "" : r.vendor, r.plat || "", r.driver || "", r.telp || "", tgl(j.tglMasuk), tgl(r.tglKirim), tgl(j.tglTarget), tahap(r, posisi.siap), tahap(r, posisi.t2), tahap(r, posisi.t3), tahap(r, posisi.t4),
      TL.podKembali(j) ? "POD kembali" : ber ? ber[1] : "Selesai operasional", bayar(r), Number(r.cost) || 0, tgl(r.tglBayar), tgl(r.janjiPod), TL.podKembali(j) ? "Kembali" : "Belum", tgl(r.tglPod), TL.umurPod(j, now), dok(j), (r.dokNomor || []).map((x) => `${x.jenis} ${x.no}`).join("; "), STATUS[j.status] || j.status || "", j.pic || "", j.deskripsi || ""]; })];
}
const namaTitik = (x) => [x.nama, x.kota && x.kota !== x.nama ? `(${x.kota})` : ""].filter(Boolean).join(" ");
/** Lembar Distribusi: header + satu baris per pengiriman Truk Distribusi; titik diurai dalam satu sel berurutan. */
export function lembarDistribusi(jobs, now = hariIni()) {
  const l = jobs.filter((j) => rinci(j).jenis === "distribusi").sort((a, b) => String(rinci(a).tglKirim || a.tglMasuk).localeCompare(String(rinci(b).tglKirim || b.tglMasuk)));
  return [KOLOM_DISTRIBUSI, ...l.map((j) => { const r = rinci(j), t = DZ.titikDari(j), n = DZ.jmlTitik(j); let p = 0, d = 0;
    const urut = t.map((x) => (x.t === "P" ? `P${++p}: ` : `D${++d}: `) + namaTitik(x) + (x.selesai ? " ✓" : "")).join(" | "), pk = t.find((x) => x.t === "P"), dk = [...t].reverse().find((x) => x.t === "D");
    return [r.noDo || j.judul, j.customer || "", DZ.pola(j), n.p, n.d, urut, pk && dk ? `${pk.kota || pk.nama} - ${dk.kota || dk.nama}` : "", r.jenisArmada || j.kategori || "", r.bak || "", DZ.internal(j) ? "Internal" : "Vendor", DZ.internal(j) ? "" : r.vendor, r.plat || "", r.driver || "", r.telp || "", tgl(j.tglMasuk), tgl(r.tglKirim), tgl(j.tglTarget), DZ.labelTahap(j), bayar(r), Number(r.cost) || 0, tgl(r.tglBayar), tgl(r.janjiPod), DZ.podKembali(j) ? "Kembali" : "Belum", tgl(r.tglPod), DZ.umurPod(j, now), STATUS[j.status] || j.status || "", j.pic || "", j.deskripsi || ""]; })];
}
/** Lembar yang dibuat menurut subdivisi: "" semua, "besar" Trailer, "kecil" Distribusi. Lembar kosong (hanya header) dilewati. */
export function lembarEkspor(jobs, sub, now = hariIni()) {
  const o = []; if (sub !== "kecil") o.push(["Tracking Trailer", lembarTrailer(jobs, now)]); if (sub !== "besar") o.push(["Truk Distribusi", lembarDistribusi(jobs, now)]);
  const ada = o.filter(([, a]) => a.length > 1); return ada.length ? ada : o.slice(0, 1);
}
export const namaBerkas = (sub, now = hariIni()) => `shipment-${sub === "besar" ? "tracking-trailer" : sub === "kecil" ? "truk-distribusi" : "tracking"}-${now}.xlsx`;
export { selisihHari };
