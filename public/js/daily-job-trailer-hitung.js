// Tracking Trailer: aturan murni (tahap per jenis, risiko POD, KPI Performa). Diuji di tests/unit/daily-job-trailer.test.mjs.
import { aktif, dalam, hariIni, selisihHari, awalMinggu } from "./daily-job-hitung.js";
import { rinci } from "./daily-job-tracking-hitung.js";
import * as P from "./daily-job-pod.js";

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
/** Tujuan Trailer: tujuan pertama + tujuan lain (multi drop, hanya Domestik, maks. 4 tujuan). */
export const MAKS_TUJUAN = 4;
export const semuaTujuan = (j) => { const r = rinci(j); return [r.tujuan, ...(r.tujuanLain || [])].filter(Boolean); };
export const ruteTrailer = (j) => [rinci(j).asal, ...semuaTujuan(j)].filter(Boolean).join(" → ");
export const internal = P.internal;
const tahapSelesai = (j) => { const r = rinci(j), t = tahapJenis(r.jenis); return t.filter(([k]) => r.tahap && r.tahap[k]).length; };
/** Tahap yang sudah selesai berurutan: tahap tidak boleh dilompati. */
export const kemajuan = (j) => { const r = rinci(j), t = tahapJenis(r.jenis); let n = 0; while (n < t.length && r.tahap && r.tahap[t[n][0]]) n++; return n; };
export const tahapBerikut = (j) => tahapJenis(rinci(j).jenis)[kemajuan(j)] || null;
/** Tandai tahap berikut selesai; mengembalikan rinci baru. POD ikut mengisi pod/tglPod. */
export function tandaiTahap(j, waktu) {
  const r = rinci(j), b = tahapBerikut(j); if (!b) return r;
  const n = { ...r, tahap: { ...(r.tahap || {}), [b[0]]: waktu } };
  const lanjut = tahapJenis(r.jenis)[kemajuan({ rinci: n })];
  if (b[0] === "pod" || (lanjut && lanjut[0] === "pod" && P.internal({ rinci: n }))) { // internal: POD ikut kembali saat tahap operasional terakhir selesai
    n.tahap.pod = waktu; n.pod = "kembali"; n.tglPod = String(waktu).slice(0, 10);
  }
  return n;
}
/** Batalkan tahap terakhir yang selesai (salah tekan); pembatalan POD mengosongkan pod/tglPod. */
export function batalkanTahap(j) {
  const r = rinci(j), n = kemajuan(j); if (!n) return r; const T = tahapJenis(r.jenis), k = T[n - 1][0], t = { ...r.tahap }; delete t[k];
  if (k === "pod" && P.internal(j) && n > 1) delete t[T[n - 2][0]]; // internal: POD otomatis ikut dibatalkan bersama tahap sebelumnya
  return { ...r, tahap: t, ...(k === "pod" ? { pod: "belum", tglPod: null } : {}) };
}
export const podKembali = P.podKembali;
const tglOperasional = (j) => { const r = rinci(j), t = tahapJenis(r.jenis), a = r.tahap && r.tahap[t[t.length - 2][0]]; return a ? String(a).slice(0, 10) : ""; };
/** Operasional selesai = semua tahap sebelum POD selesai. */
export const operasionalSelesai = (j) => kemajuan(j) >= tahapJenis(rinci(j).jenis).length - 1;
/** Fase untuk antrean: belum, jalan, pod (menunggu POD sampai), bayar (vendor Cash perlu ditransfer), selesai, batal. */
export function fase(j) {
  if (j.status === "batal") return "batal";
  const r = rinci(j);
  if (podKembali(j) || operasionalSelesai(j)) return P.fasePasca(j);
  return kemajuan(j) <= 1 && !(r.tahap && r.tahap[tahapJenis(r.jenis)[1][0]]) ? "belum" : "jalan";
}
export const selesaiOtomatis = P.selesaiOtomatis;
export const perluBayar = P.perluBayar;
export const umurPod = (j, now = hariIni()) => { const t = tglOperasional(j); return !podKembali(j) && t ? Math.max(0, selisihHari(now, t)) : 0; };
const cost = (j) => Number(rinci(j).cost) || 0;
const dlm = (t, r) => dalam(String(t || "").slice(0, 10), r);
const tglOrder = (j) => j.tglMasuk || j.dibuatPada;

/** KPI Performa Tracking Trailer untuk periode r = [dari, sampai]. Terlaksana (ritase) = pick up/ambil MT sudah dikerjakan. */
export function hitungTrailer(jobs, r, now = hariIni()) {
  const js = jobs.filter((j) => j.status !== "batal" && jenisTrailer(j)), order = js.filter((j) => dlm(tglOrder(j), r)), rit = js.filter((j) => dlm(rinci(j).tglKirim || tglOrder(j), r) && kemajuan(j) >= 2);
  const biaya = (l) => l.reduce((a, j) => a + cost(j), 0), vend = rit.filter((j) => !internal(j)), int = rit.filter(internal);
  const kelompok = (l, kunci) => { const m = new Map(); l.forEach((j) => { const k = kunci(j) || "-", o = m.get(k) || { nama: k, ritase: 0, cost: 0, vendor: 0, internal: 0, pod: 0 }; o.ritase++; o.cost += cost(j); internal(j) ? o.internal++ : o.vendor++; if (umurPod(j, now) > 7) o.pod++; m.set(k, o); }); return [...m.values()].map((o) => ({ ...o, perRitase: o.ritase ? Math.round(o.cost / o.ritase) : 0 })).sort((a, b) => b.ritase - a.ritase); };
  const perJenis = Object.keys(JENIS).map((k) => { const o = kelompok(rit.filter((j) => jenisTrailer(j) === k), () => k)[0] || { nama: k, ritase: 0, cost: 0, vendor: 0, internal: 0, perRitase: 0 }; return { ...o, nama: JENIS[k].nama, order: order.filter((j) => jenisTrailer(j) === k).length }; });
  const minggu = new Map(); order.forEach((j) => { const k = awalMinggu(tglOrder(j).slice(0, 10)), o = minggu.get(k) || { k, order: 0, ritase: 0 }; o.order++; minggu.set(k, o); }); rit.forEach((j) => { const k = awalMinggu(String(rinci(j).tglKirim || tglOrder(j)).slice(0, 10)), o = minggu.get(k) || { k, order: 0, ritase: 0 }; o.ritase++; minggu.set(k, o); });
  const tunggu = js.filter((j) => fase(j) === "pod"), bayar = js.filter(perluBayar);
  return {
    order: order.length, ritase: rit.length, persenTerlaksana: order.length ? Math.round((rit.length / order.length) * 100) : null,
    cost: biaya(rit), costVendor: biaya(vend), costInternal: biaya(int), costPerRitase: rit.length ? Math.round(biaya(rit) / rit.length) : 0,
    perJenis, perVendor: kelompok(rit, (j) => (internal(j) ? "Internal (uang jalan)" : rinci(j).vendor)), perRute: kelompok(rit, ruteTrailer).slice(0, 8),
    perMinggu: [...minggu.values()].sort((a, b) => a.k.localeCompare(b.k)),
    tungguPod: tunggu.length, perluBayar: bayar.length, nilaiPerluBayar: bayar.reduce((a, j) => a + cost(j), 0),
    umurPod: [["0-3", 0, 3], ["4-7", 4, 7], ["8-14", 8, 14], [">14", 15, 1e9]].map(([l, a, b]) => ({ l, n: tunggu.filter((j) => umurPod(j, now) >= a && umurPod(j, now) <= b).length })),
  };
}


/** Strip tindakan di Daftar: job Trailer aktif yang perlu perhatian; satu job masuk paling banyak satu kelompok. */
export const TINDAKAN = [["bayar", "Perlu dibayar", "bahaya"], ["resi", "Resi POD belum diisi", "warn"], ["pod", "POD belum sampai", "warn"], ["berangkat", "Berangkat hari ini", "info"], ["armada", "Order tanpa armada", "warn"]];
export function cocokTindakan(j, id, now = hariIni()) {
  if (!jenisTrailer(j) || !aktif(j)) return false; const r = rinci(j), n = kemajuan(j);
  if (id === "bayar") return perluBayar(j);
  if (id === "resi" || id === "pod") return P.peringatanPod(j, tglOperasional(j), now) === id;
  if (id === "berangkat") return n <= 1 && (r.tglKirim || j.tglMasuk) === now;
  if (id === "armada") return n === 0 && !r.vendor && !r.plat && !r.driver;
  return false;
}

/** Pembanding tarif per rute: rata-rata cost per ritase tiap vendor/internal pada rute yang sama; hanya rute dengan 2 pelaku atau lebih. murah = pelaku dengan rata-rata terendah. */
export function bandingTarif(jobs, r) {
  const rit = jobs.filter((j) => j.status !== "batal" && jenisTrailer(j) && dlm(rinci(j).tglKirim || tglOrder(j), r) && kemajuan(j) >= 2 && cost(j) > 0), m = new Map();
  rit.forEach((j) => { const q = rinci(j), rute = ruteTrailer(j), nama = internal(j) ? "Internal" : q.vendor; if (!rute) return; const v = m.get(rute) || new Map(), o = v.get(nama) || { nama, n: 0, total: 0 }; o.n++; o.total += cost(j); v.set(nama, o); m.set(rute, v); });
  return [...m].map(([rute, v]) => { const l = [...v.values()].map((o) => ({ nama: o.nama, n: o.n, rata: Math.round(o.total / o.n) })).sort((a, b) => a.rata - b.rata); return { rute, pelaku: l, murah: l[0].nama, n: l.reduce((a, o) => a + o.n, 0) }; }).filter((x) => x.pelaku.length >= 2).sort((a, b) => b.n - a.n).slice(0, 6);
}
