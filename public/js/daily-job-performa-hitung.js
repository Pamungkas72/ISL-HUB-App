// Performa Tracking gabungan (Trailer + Distribusi): satu tampilan, filter subdivisi menentukan isi. Diuji di tests/unit/daily-job-performa.test.mjs.
import { dalam, awalMinggu, hariIni } from "./daily-job-hitung.js";
import * as TL from "./daily-job-trailer-hitung.js";
import * as DZ from "./daily-job-distribusi-hitung.js";
import * as P from "./daily-job-pod.js";

const cost = (j) => Number(P.rinci(j).cost) || 0;
/** Gabung baris { nama, ritase, cost, pod } dari dua subdivisi dengan nama sama; urut ritase terbanyak. */
const gabung = (...l) => { const m = new Map(); l.flat().forEach((o) => { const x = m.get(o.nama) || { nama: o.nama, ritase: 0, cost: 0, pod: 0 }; x.ritase += o.ritase; x.cost += o.cost; x.pod += o.pod || 0; m.set(o.nama, x); }); return [...m.values()].map((o) => ({ ...o, perRitase: o.ritase ? Math.round(o.cost / o.ritase) : 0 })).sort((a, b) => b.ritase - a.ritase); };

/** sub: "" (semua), "besar" (Trailer), "kecil" (Distribusi). Mengembalikan satu bentuk data untuk semua kombinasi. */
export function hitungPerforma(jobs, r, sub = "", now = hariIni()) {
  const kt = sub === "kecil" ? null : TL.hitungTrailer(jobs, r, now), kd = sub === "besar" ? null : DZ.hitungDistribusi(jobs, r, now), l = [kt, kd].filter(Boolean), jum = (f) => l.reduce((a, k) => a + (k[f] || 0), 0);
  const order = jum("order"), ritase = jum("ritase"), total = jum("cost");
  const minggu = new Map(), pun = (k) => minggu.get(k) || (minggu.set(k, { k, order: 0, ritase: 0 }), minggu.get(k));
  if (kt) kt.perMinggu.forEach((m) => { const o = pun(m.k); o.order += m.order; o.ritase += m.ritase; });
  if (kd) {
    jobs.filter((j) => j.status !== "batal" && P.rinci(j).jenis === "distribusi" && dalam(j.tglMasuk, r)).forEach((j) => { pun(awalMinggu(String(j.tglMasuk).slice(0, 10))).order++; });
    kd.perHari.forEach((h) => { pun(awalMinggu(h.k)).ritase += h.n; });
  }
  const jT = kt ? kt.perJenis.map((o) => ({ grup: "Trailer", nama: o.nama, ritase: o.ritase, cost: o.cost, perRitase: o.perRitase })) : [], jD = kd ? kd.perJenis.map((o) => ({ grup: "Distribusi", nama: o.n, ritase: o.ritase, cost: o.cost, perRitase: o.perRitase })) : [];
  return {
    sub, order, ritase, persenTerlaksana: order ? Math.round((ritase / order) * 100) : null, drop: kd ? kd.drop : null,
    cost: total, costVendor: jum("costVendor"), costInternal: jum("costInternal"), costPerRitase: ritase ? Math.round(total / ritase) : 0,
    tungguPod: jum("tungguPod"), perluBayar: jum("perluBayar"), nilaiPerluBayar: jobs.filter((j) => P.perluBayar(j) && (TL.jenisTrailer(j) ? kt : kd)).reduce((a, j) => a + cost(j), 0),
    perMinggu: [...minggu.values()].sort((a, b) => a.k.localeCompare(b.k)),
    perJenis: kt && kd ? [...jT, ...jD].filter((o) => o.ritase).map((o) => ({ ...o, nama: `${o.grup} · ${o.nama}` })) : [...jT, ...jD],
    perVendor: gabung(kt ? kt.perVendor : [], kd ? kd.perVendor : []), perRute: gabung(kt ? kt.perRute : [], kd ? kd.perRute : []).slice(0, 8),
    perBak: kd ? kd.perBak : [], banding: kt ? TL.bandingTarif(jobs, r) : [],
  };
}
