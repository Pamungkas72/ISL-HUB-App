// Langkah cepat Truk Distribusi dari daftar (geser di HP, tombol di desktop, centang massal): Terkirim, POD kembali, Dibayar.
// Murni, diuji tests/unit/daily-job-langkah.test.mjs. Aturan POD dan bayar: daily-job-pod.js.
import * as P from "./daily-job-pod.js";
import * as DZ from "./daily-job-distribusi-hitung.js";

export const LANGKAH = { terkirim: "Terkirim", pod: "POD kembali", bayar: "Dibayar" };
const rinci = (j) => (j && j.rinci) || {};
const aktifDz = (j) => rinci(j).jenis === "distribusi" && j.status !== "batal" && j.status !== "selesai";

/** Langkah yang bisa dilakukan sekarang, urut pemakaian. Terkirim bila titik belum semua selesai; POD kembali bila sudah terkirim (unit vendor; internal otomatis); Dibayar bila vendor Cash sudah punya resi atau POD kembali. */
export function langkahTersedia(j) {
  if (!aktifDz(j)) return [];
  const o = [];
  if (DZ.kemajuan(j) < 3 && !P.podKembali(j)) o.push("terkirim");
  else if (!P.podKembali(j) && !P.internal(j)) o.push("pod");
  if (P.cara(j) === "cash" && !rinci(j).tglBayar && (P.resiAda(j) || P.podKembali(j))) o.push("bayar");
  return o;
}
/** Alasan langkah tidak boleh dilakukan ("" bila boleh): POD (termasuk POD otomatis unit internal) butuh No. DO / surat jalan. */
export function blokir(j, langkah) {
  const butuhPod = langkah === "pod" || (langkah === "terkirim" && P.internal(j));
  if (butuhPod && !String(rinci(j).noDo || "").trim()) return "Isi No. DO / surat jalan dulu sebelum POD ditandai kembali.";
  if (langkah === "terkirim" && !DZ.titikDari(j).length) return "Tambahkan titik pick up dan drop dulu (Ubah).";
  return "";
}
/** Rinci baru setelah langkah dilakukan pada waktu "YYYY-MM-DDTHH:mm". Terkirim menandai semua titik selesai sekaligus; unit internal otomatis POD kembali. */
export function terapkan(j, langkah, waktu) {
  const r = rinci(j), tgl = String(waktu).slice(0, 10);
  if (langkah === "terkirim") {
    const titik = (r.titik || []).map((x) => (x && (x.t === "P" || x.t === "D") && !x.selesai ? { ...x, selesai: waktu } : x));
    const n = { ...r, titik, tahap: { ...(r.tahap || {}), siap: (r.tahap && r.tahap.siap) || waktu } };
    return P.internal(j) ? { ...n, pod: "kembali", tglPod: tgl } : n;
  }
  if (langkah === "pod") return { ...r, pod: "kembali", tglPod: tgl };
  if (langkah === "bayar") return { ...r, tglBayar: tgl };
  return r;
}
