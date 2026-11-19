// Profil Tracking Daily Job: aturan murni (tanpa tampilan/Firebase). Diuji di tests/unit/daily-job-tracking.test.mjs.
import { aktif, terlambat, dalam, hariIni } from "./daily-job-hitung.js";

export const SUBDIVISI = {
  kecil: { nama: "Mobil kecil", kategori: ["CDE", "CDD", "Fuso", "Tronton", "Grand Max Blind Van"] },
  besar: { nama: "Mobil besar", kategori: ["Trailer Ekspor", "Trailer Impor", "Trailer Domestik"] },
};
export const PROFIL = { marketing: "Marketing dan BD", tracking: "Tracking" };
export const TAGIHAN = { belum: "Belum dikirim", dikirim: "Dikirim", konfirmasi: "Dikonfirmasi" };
export const BAYAR = { cash: "Cash", top: "TOP" };
export const subdivisiDari = (kat) => Object.keys(SUBDIVISI).find((k) => SUBDIVISI[k].kategori.includes(kat)) || "";
export const rinci = (j) => (j && j.rinci) || {};
export const podKembali = (j) => rinci(j).pod === "kembali";
const tglKirim = (j) => rinci(j).tglKirim || j.tglMasuk || "";

/** Judul otomatis satu pengiriman: no. DO + customer. */
export const judulTracking = (doNo, customer) => [String(doNo || "").trim(), String(customer || "").trim()].filter(Boolean).join(" · ");
/** Pengiriman selesai bila POD sudah kembali dan tagihan vendor dikonfirmasi (kecuali batal). */
export const selesaiOtomatis = (r) => r && r.pod === "kembali" && r.tagihan === "konfirmasi";

/** KPI Performa Tracking untuk satu periode r = [dari, sampai]. Tepat waktu = POD kembali pada atau sebelum target tiba. */
export function hitungTracking(jobs, r, now = hariIni()) {
  const kirim = jobs.filter((j) => j.status !== "batal" && dalam(tglKirim(j), r)), pod = kirim.filter(podKembali);
  const tepat = pod.filter((j) => !j.tglTarget || !rinci(j).tglPod || rinci(j).tglPod <= j.tglTarget).length;
  const tagihan = jobs.filter((j) => j.status !== "batal" && podKembali(j) && rinci(j).tagihan !== "konfirmasi");
  const persen = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const volume = new Map(), pic = new Map();
  kirim.forEach((j) => volume.set(j.kategori || "-", (volume.get(j.kategori || "-") || 0) + 1));
  jobs.filter(aktif).forEach((j) => { const o = pic.get(j.pic || "-") || { nama: j.pic || "-", aktif: 0, belumPod: 0, telat: 0 }; o.aktif++; if (!podKembali(j)) o.belumPod++; if (terlambat(j, now)) o.telat++; pic.set(o.nama, o); });
  return {
    hariIni: jobs.filter((j) => j.status !== "batal" && tglKirim(j) === now).length, order: jobs.filter((j) => dalam(j.tglMasuk, r)).length, kirim: kirim.length,
    pod: pod.length, persenPod: persen(pod.length, kirim.length), tepat, persenTepat: persen(tepat, pod.length),
    tagihanBelum: tagihan.length, cash: tagihan.filter((j) => rinci(j).bayar === "cash").length, top: tagihan.filter((j) => rinci(j).bayar === "top").length,
    volume: [...volume].map(([nama, n]) => ({ nama, n })).sort((a, b) => b.n - a.n),
    perPic: [...pic.values()].sort((a, b) => b.aktif - a.aktif),
  };
}
