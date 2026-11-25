// Profil Tracking Daily Job: aturan murni (tanpa tampilan/Firebase). Diuji di tests/unit/daily-job-tracking.test.mjs.
import { aktif, terlambat, dalam, hariIni } from "./daily-job-hitung.js";
import * as P from "./daily-job-pod.js";

export const SUBDIVISI = {
  kecil: { nama: "Truk Distribusi", kategori: ["CDE", "CDD", "Fuso", "Tronton", "Grand Max Blind Van"] },
  besar: { nama: "Tracking Trailer", kategori: ["Trailer Impor", "Trailer Ekspor", "Trailer Repo", "Trailer Domestik"] },
};
export const PROFIL = { marketing: "Marketing dan BD", tracking: "Tracking" };
export const TAGIHAN = { belum: "Belum dikirim", dikirim: "Dikirim", konfirmasi: "Dikonfirmasi" };
export const BAYAR = { cash: "Cash", top: "TOP" };
export const subdivisiDari = (kat) => Object.keys(SUBDIVISI).find((k) => SUBDIVISI[k].kategori.includes(kat)) || "";
/** Jenis shipment Trailer dari nama kategori (data lama memakai kategori saja). */
export const jenisDariKategori = (kat) => ({ "Trailer Impor": "impor", "Trailer Ekspor": "ekspor", "Trailer Repo": "repo", "Trailer Domestik": "domestik" })[kat] || "";
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

/* ---------- Rute: ketik bebas, saran dari riwayat, pengiriman berulang (24 Nov 2026) ---------- */
/** Pisah teks rute menjadi lokasi berurutan: "Jakarta → Surabaya", "A -> B -> C", "Jakarta ke Surabaya", "Jakarta - Surabaya". */
export const bagiRute = (t) => String(t || "").split(/\s*(?:→|->|=>|›|>|\s-\s|\s–\s|\ske\s)\s*/i).map((s) => s.trim()).filter(Boolean);
/** Teks rute satu pengiriman: Distribusi dari titik pick up pertama sampai drop terakhir; Trailer dari asal, tujuan, dan tujuan lain. */
export function ruteTeks(j) {
  const r = rinci(j), t = (r.titik || []).filter((x) => x && (x.t === "P" || x.t === "D"));
  if (t.length) { const p = t.find((x) => x.t === "P"), d = [...t].reverse().find((x) => x.t === "D"); return [p && (p.kota || p.nama), d && (d.kota || d.nama)].filter(Boolean).join(" → "); }
  return [r.asal, r.tujuan, ...(r.tujuanLain || [])].filter(Boolean).join(" → ");
}
const kunciRute = (t) => bagiRute(t).join(">").toLowerCase();
const sama = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const unitJob = (j) => (P.internal(j) ? "internal" : "vendor");
/** Pengiriman berulang = customer, jenis armada (kategori), jenis unit (internal/vendor), dan rute sama dengan pengiriman lain. */
export const cocokBerulang = (a, b) => sama(a.customer, b.customer) && sama(a.kategori, b.kategori) && unitJob(a) === unitJob(b) && kunciRute(ruteTeks(a)) === kunciRute(ruteTeks(b)) && !!kunciRute(ruteTeks(a));
export const berulang = (jobs, j) => jobs.some((x) => x.id !== j.id && x.status !== "batal" && cocokBerulang(x, j));
/** Saran rute dari riwayat: tiap rute { teks, n (semua), nCust (customer sama), nCocok (customer, armada, unit sama), contoh (pengiriman terbaru) }; yang cocok dulu. cari = ketikan user. */
export function saranRute(jobs, { cust, kat, unit, sub = "", cari = "" }, maks = 5) {
  const m = new Map(), q = String(cari || "").trim().toLowerCase();
  jobs.filter((j) => j.status !== "batal" && (rinci(j).jenis || rinci(j).asal) && (!sub || subdivisiDari(j.kategori) === sub)).forEach((j) => {
    const teks = ruteTeks(j); if (!teks) return; const k = kunciRute(teks), o = m.get(k) || { teks, n: 0, nCust: 0, nCocok: 0, contoh: j };
    o.n++; if (sama(j.customer, cust)) { o.nCust++; if (sama(j.kategori, kat) && unitJob(j) === unit) o.nCocok++; }
    if (String(j.dibuatPada || j.tglMasuk || "") >= String(o.contoh.dibuatPada || o.contoh.tglMasuk || "")) o.contoh = j; m.set(k, o);
  });
  return [...m.values()].filter((o) => !q || o.teks.toLowerCase().includes(q)).sort((a, b) => b.nCocok - a.nCocok || b.nCust - a.nCust || b.n - a.n || a.teks.localeCompare(b.teks)).slice(0, maks);
}
