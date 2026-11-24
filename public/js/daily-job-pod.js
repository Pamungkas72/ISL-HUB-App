// Aturan POD dan pembayaran vendor Tracking (Trailer dan Distribusi), 24 Nov 2026. Murni, diuji di tests/unit/daily-job-pod.test.mjs.
// Internal: uang jalan dibayar sebelum berangkat, POD otomatis kembali. Vendor TOP: POD kembali = beres (Finance bayar di luar sistem).
// Vendor Cash: vendor kirim POD lewat ekspedisi (resi dicatat), kantor transfer setelah resi ada, lalu POD diterima.
import { selisihHari } from "./daily-job-hitung.js";

export const rinci = (j) => (j && j.rinci) || {};
export const internal = (j) => { const v = rinci(j).vendor; return !v || /^internal$/i.test(v); };
export const cara = (j) => (internal(j) ? "internal" : rinci(j).bayar === "top" ? "top" : "cash");
export const podKembali = (j) => rinci(j).pod === "kembali";
/** Resi POD ada bila nomor resi terisi atau ada foto/berkas resi yang diunggah. */
export const resiAda = (j) => { const p = rinci(j).podKirim; return !!(p && (p.resi || (p.berkas || []).length)); };
/** Internal dan TOP dianggap beres; Cash beres bila tanggal transfer terisi. */
export const lunas = (j) => cara(j) !== "cash" || !!rinci(j).tglBayar;
/** Vendor Cash yang resinya sudah ada (atau POD sudah diterima) tetapi belum ditransfer. */
export const perluBayar = (j) => j.status !== "batal" && cara(j) === "cash" && !rinci(j).tglBayar && (resiAda(j) || podKembali(j));
export const selesaiOtomatis = (j) => podKembali(j) && lunas(j);
/** Fase setelah operasional selesai: pod (menunggu POD sampai), bayar (perlu ditransfer), selesai. */
export const fasePasca = (j) => (podKembali(j) ? (lunas(j) ? "selesai" : "bayar") : perluBayar(j) ? "bayar" : "pod");
const hari = (tgl, now) => (tgl ? Math.max(0, selisihHari(now, String(tgl).slice(0, 10))) : 0);
/** Peringatan vendor: "resi" (resi POD belum diisi 3 hari setelah operasional selesai) atau "pod" (POD belum sampai 5 hari sejak resi). tglOps = tanggal operasional selesai. */
export function peringatanPod(j, tglOps, now) {
  if (j.status === "batal" || internal(j) || podKembali(j) || !tglOps) return "";
  if (!resiAda(j)) return hari(tglOps, now) >= 3 ? "resi" : "";
  return hari(rinci(j).podKirim.tgl || tglOps, now) >= 5 ? "pod" : "";
}
