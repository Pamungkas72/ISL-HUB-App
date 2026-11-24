// Tracking Trailer: aturan murni (tahap per jenis, risiko POD, KPI Performa). Diuji di tests/unit/daily-job-trailer.test.mjs.
import { aktif, dalam, hariIni, selisihHari, awalMinggu } from "./daily-job-hitung.js";
import { rinci } from "./daily-job-tracking-hitung.js";

/** Tahap tiap jenis; POD selalu terakhir. rinci.tahap = { kunci: "YYYY-MM-DDTHH:mm" } untuk tahap yang sudah selesai. */
export const JENIS = {
  impor: { nama: "Impor", tahap: [["siap", "Siap"], ["pickup", "Pick up"], ["bongkar", "Bongkar"], ["mtreturn", "MT return"], ["pod", "POD"]], dok: ["Surat jalan (POD)", "DO pelayaran", "SPPB / PIB / TILA"] },
  ekspor: { nama: "Ekspor", tahap: [["siap", "Siap"], ["ambilmt", "Ambil MT"], ["stuffing", "Stuffing"], ["gatein", "Gate in"], ["pod", "POD"]], dok: ["Surat jalan (POD)", "Kartu ekspor / gate pass", "NPE / PEB"] },
  repo: { nama: "Repo", tahap: [["siap", "Siap"], ["pickup", "Pick up"], ["grounded", "Grounded"], ["pod", "POD"]], dok: ["Surat jalan (POD)", "Dokumen impor"] },
  domestik: { nama: "Domestik", tahap: [["siap", "Siap"], ["pickup", "Pick up"], ["bongkar", "Bongkar"], ["pod", "POD"]], dok: ["Surat jalan (POD)"] },
};
export const UKURAN = ["20", "40", "40HC"];
export const jenisTrailer = (j) => (JENIS[rinci(j).jenis] ? rinci(j).jenis : "");
export const tahapJenis = (jenis) => (JENIS[jenis] || JENIS.impor).tahap;
const vendorAda = (r) => !!r.vendor && !/^internal$/i.test(r.vendor);
export const internal = (j) => !vendorAda(rinci(j));
const tahapSelesai = (j) => { const r = rinci(j), t = tahapJenis(r.jenis); return t.filter(([k]) => r.tahap && r.tahap[k]).length; };
/** Tahap yang sudah selesai berurutan: tahap tidak boleh dilompati. */
export const kemajuan = (j) => { const r = rinci(j), t = tahapJenis(r.jenis); let n = 0; while (n < t.length && r.tahap && r.tahap[t[n][0]]) n++; return n; };
export const tahapBerikut = (j) => tahapJenis(rinci(j).jenis)[kemajuan(j)] || null;
/** Tandai tahap berikut selesai; mengembalikan rinci baru. POD ikut mengisi pod/tglPod. */
export function tandaiTahap(j, waktu) {
  const r = rinci(j), b = tahapBerikut(j); if (!b) return r;
  const n = { ...r, tahap: { ...(r.tahap || {}), [b[0]]: waktu } };
  if (b[0] === "pod") { n.pod = "kembali"; n.tglPod = String(waktu).slice(0, 10); }
  return n;
}
/** Batalkan tahap terakhir yang selesai (salah tekan); pembatalan POD mengosongkan pod/tglPod. */
export function batalkanTahap(j) {
  const r = rinci(j), n = kemajuan(j); if (!n) return r; const k = tahapJenis(r.jenis)[n - 1][0], t = { ...r.tahap }; delete t[k];
  return { ...r, tahap: t, ...(k === "pod" ? { pod: "belum", tglPod: null } : {}) };
}
export const podKembali = (j) => rinci(j).pod === "kembali";
const tglOperasional = (j) => { const r = rinci(j), t = tahapJenis(r.jenis), a = r.tahap && r.tahap[t[t.length - 2][0]]; return a ? String(a).slice(0, 10) : ""; };
/** Operasional selesai = semua tahap sebelum POD selesai. */
export const operasionalSelesai = (j) => kemajuan(j) >= tahapJenis(rinci(j).jenis).length - 1;
/** Fase untuk papan/filter: belum (belum jalan), lapangan, tungguPod, siapTagih (POD kembali, vendor belum lunas), selesai. */
export function fase(j) {
  if (j.status === "batal") return "batal";
  const r = rinci(j);
  if (podKembali(j)) return internal(j) || r.tglBayar ? "selesai" : "siapTagih";
  if (!operasionalSelesai(j)) return kemajuan(j) <= 1 && !(r.tahap && r.tahap[tahapJenis(r.jenis)[1][0]]) ? "belum" : "lapangan";
  return "tungguPod";
}
/** Selesai bila POD kembali dan (armada internal atau vendor sudah dibayar). */
export const selesaiOtomatis = (j) => podKembali(j) && (internal(j) || !!rinci(j).tglBayar);
/** Risiko: vendor sudah dibayar tetapi POD belum kembali. */
export const dibayarTanpaPod = (j) => j.status !== "batal" && !podKembali(j) && !internal(j) && !!rinci(j).tglBayar;
export const umurPod = (j, now = hariIni()) => { const t = tglOperasional(j); return !podKembali(j) && t ? Math.max(0, selisihHari(now, t)) : 0; };
/** Pengingat: bayar sebelum POD wajib punya janji POD kembali. */
export const butuhJanjiPod = (j) => dibayarTanpaPod(j) && !rinci(j).janjiPod;
const cost = (j) => Number(rinci(j).cost) || 0;
const dlm = (t, r) => dalam(String(t || "").slice(0, 10), r);
const tglOrder = (j) => j.tglMasuk || j.dibuatPada;
const jt = (n) => Math.round(n / 1e5) / 10;

/** KPI Performa Tracking Trailer untuk periode r = [dari, sampai]. Terlaksana (ritase) = pick up/ambil MT sudah dikerjakan. */
export function hitungTrailer(jobs, r, now = hariIni()) {
  const js = jobs.filter((j) => j.status !== "batal" && jenisTrailer(j)), order = js.filter((j) => dlm(tglOrder(j), r)), rit = js.filter((j) => dlm(rinci(j).tglKirim || tglOrder(j), r) && kemajuan(j) >= 2);
  const biaya = (l) => l.reduce((a, j) => a + cost(j), 0), vend = rit.filter((j) => !internal(j)), int = rit.filter(internal);
  const kelompok = (l, kunci) => { const m = new Map(); l.forEach((j) => { const k = kunci(j) || "-", o = m.get(k) || { nama: k, ritase: 0, cost: 0, vendor: 0, internal: 0, pod: 0 }; o.ritase++; o.cost += cost(j); internal(j) ? o.internal++ : o.vendor++; if (umurPod(j, now) > 7) o.pod++; m.set(k, o); }); return [...m.values()].map((o) => ({ ...o, perRitase: o.ritase ? Math.round(o.cost / o.ritase) : 0 })).sort((a, b) => b.ritase - a.ritase); };
  const perJenis = Object.keys(JENIS).map((k) => { const o = kelompok(rit.filter((j) => jenisTrailer(j) === k), () => k)[0] || { nama: k, ritase: 0, cost: 0, vendor: 0, internal: 0, perRitase: 0 }; return { ...o, nama: JENIS[k].nama, order: order.filter((j) => jenisTrailer(j) === k).length }; });
  const minggu = new Map(); order.forEach((j) => { const k = awalMinggu(tglOrder(j).slice(0, 10)), o = minggu.get(k) || { k, order: 0, ritase: 0 }; o.order++; minggu.set(k, o); }); rit.forEach((j) => { const k = awalMinggu(String(rinci(j).tglKirim || tglOrder(j)).slice(0, 10)), o = minggu.get(k) || { k, order: 0, ritase: 0 }; o.ritase++; minggu.set(k, o); });
  const tunggu = js.filter((j) => fase(j) === "tungguPod"), tanpa = js.filter(dibayarTanpaPod);
  return {
    order: order.length, ritase: rit.length, persenTerlaksana: order.length ? Math.round((rit.length / order.length) * 100) : null,
    cost: biaya(rit), costVendor: biaya(vend), costInternal: biaya(int), costPerRitase: rit.length ? Math.round(biaya(rit) / rit.length) : 0,
    perJenis, perVendor: kelompok(rit, (j) => (internal(j) ? "Internal (uang jalan)" : rinci(j).vendor)), perRute: kelompok(rit, (j) => [rinci(j).asal, rinci(j).tujuan].filter(Boolean).join(" → ")).slice(0, 8),
    perMinggu: [...minggu.values()].sort((a, b) => a.k.localeCompare(b.k)),
    tungguPod: tunggu.length, tanpaPod: tanpa.length, nilaiTanpaPod: tanpa.reduce((a, j) => a + cost(j), 0), siapTagih: js.filter((j) => fase(j) === "siapTagih").length,
    umurPod: [["0-3", 0, 3], ["4-7", 4, 7], ["8-14", 8, 14], [">14", 15, 1e9]].map(([l, a, b]) => ({ l, n: tunggu.filter((j) => umurPod(j, now) >= a && umurPod(j, now) <= b).length })),
  };
}
export { jt };
