// Roadmap perjalanan shipment (Tracking): langkah berikon di daftar. Desktop = rel berlabel, HP = ikon mini + satu kalimat. Murni (tanpa DOM), diuji tests/unit/daily-job-jalan.test.mjs.
// Langkah: Siap, Jalan, Tiba, POD, Bayar. Status node: ok (selesai), jalan (sedang bergerak), now (langkah berikut), tunggu (berhenti terlalu lama, merah), "" (belum).
import { e } from "./ui.js";
import * as P from "./daily-job-pod.js";
import * as DZ from "./daily-job-distribusi-hitung.js";
import * as TL from "./daily-job-trailer-hitung.js";
import { hariIni } from "./daily-job-hitung.js";

export const BATAS_BERHENTI = 3; // hari menunggu POD sebelum node merah
const rinci = (j) => (j && j.rinci) || {};
const selisih = (a, b) => Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 864e5);

/** Posisi pengiriman: { siap, mulai (ada yang sudah dikerjakan), tiba, sub (kalimat posisi), tglOps } dari Distribusi atau Trailer. */
function posisi(j) {
  const r = rinci(j), siap = !!(r.tahap && r.tahap.siap);
  if (r.jenis === "distribusi") {
    const t = DZ.titikDari(j), kem = DZ.kemajuan(j), pd = t.filter((x) => x.t === "P"), dr = t.filter((x) => x.t === "D"), pOk = pd.filter((x) => x.selesai).length, dOk = dr.filter((x) => x.selesai).length;
    const sub = kem >= 3 ? "Terkirim" : pOk < pd.length && pOk > 0 ? `Pick up ${pOk} dari ${pd.length}` : dOk > 0 ? `Drop ${dOk} dari ${dr.length}` : pOk === pd.length && pd.length ? "Menuju tujuan" : siap ? "Siap berangkat" : "Order baru";
    return { siap: siap || pOk > 0, mulai: pOk + dOk > 0, tiba: kem >= 3 || P.podKembali(j), sub, tglOps: DZ.tglOperasional(j) };
  }
  const jn = TL.jenisTrailer(j);
  if (jn) { const n = TL.kemajuan(j), b = TL.tahapBerikut(j), ops = TL.operasionalSelesai(j); return { siap: n >= 1, mulai: n >= 2, tiba: ops || P.podKembali(j), sub: ops ? "Terkirim" : b ? `Berikut: ${b[1]}` : "Terkirim", tglOps: TL.tglOperasional(j) }; }
  return { siap, mulai: false, tiba: P.podKembali(j), sub: "", tglOps: "" };
}
/** Perjalanan satu pengiriman: { langkah: [{ k, l, st }], kalimat, jenis ("selesai"|"berhenti"|"jalan"|"batal"|""), berhenti }. Internal: tiga langkah (POD otomatis); vendor TOP: tanpa Bayar. */
export function perjalanan(j, now = hariIni()) {
  const r = rinci(j), ps = posisi(j), pod = P.podKembali(j), internal = P.internal(j), cara = P.cara(j), resi = P.resiAda(j);
  const umur = ps.tiba && !pod && ps.tglOps ? Math.max(0, selisih(now, ps.tglOps)) : 0, peringatan = ps.tiba && !pod ? P.peringatanPod(j, ps.tglOps, now) : "";
  const berhenti = !internal && ps.tiba && !pod && (peringatan !== "" || umur >= BATAS_BERHENTI) && j.status !== "batal";
  const L = [["siap", "Siap"], ["jalan", "Jalan"], ["tiba", "Tiba"]].map(([k, l]) => ({ k, l, st: "" }));
  L[0].st = ps.siap ? "ok" : "now";
  L[1].st = ps.tiba ? "ok" : ps.mulai ? "jalan" : ps.siap ? "now" : "";
  L[2].st = ps.tiba ? "ok" : "";
  if (!internal) {
    L.push({ k: "pod", l: "POD", st: pod ? "ok" : !ps.tiba ? "" : berhenti ? "tunggu" : resi ? "jalan" : "now" });
    if (cara === "cash") L.push({ k: "bayar", l: "Bayar", st: r.tglBayar ? "ok" : resi || pod ? "now" : "" });
  }
  const selesai = j.status === "selesai" || (pod && P.lunas(j));
  let kalimat = ps.sub;
  if (j.status === "batal") kalimat = "Dibatalkan";
  else if (selesai) kalimat = "Selesai";
  else if (pod) kalimat = "POD kembali · perlu dibayar";
  else if (ps.tiba && !internal) kalimat = resi ? `POD dikirim${r.podKirim.ekspedisi ? " " + r.podKirim.ekspedisi : ""}${r.podKirim.resi ? " · " + r.podKirim.resi : ""}` : umur > 0 ? `Menunggu POD ${umur} hari` : "Terkirim, menunggu POD";
  return { langkah: L, kalimat, jenis: j.status === "batal" ? "batal" : selesai ? "selesai" : berhenti ? "berhenti" : "jalan", berhenti: berhenti && !selesai };
}

const IK = {
  siap: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>', jalan: '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>', tiba: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>', pod: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>', bayar: '<circle cx="12" cy="12" r="9"/><path d="M9 9.5h4.5a1.8 1.8 0 0 1 0 3.5H10.5a1.8 1.8 0 0 0 0 3.5H15M12 7v10"/>', cek: '<path d="M5 12l5 5L20 7"/>',
};
const NAMA_ST = { ok: "selesai", jalan: "sedang bergerak", now: "langkah berikut", tunggu: "berhenti terlalu lama", "": "belum" };
const svg = (k, s, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IK[k]}</svg>`;
const node = (m, kecil) => `<span class="dj-nd dj-nd--${m.st || "belum"}${kecil ? " dj-nd--k" : ""}" title="${e(m.l)}: ${NAMA_ST[m.st]}">${m.st === "ok" ? svg("cek", kecil ? 13 : 16, 3) : svg(m.k, kecil ? 13 : 16, 2)}</span>`;
/** HP: ikon mini berderet. */
export const htmlMini = (j, now) => { const p = perjalanan(j, now); return `<span class="dj-mini" role="img" aria-label="${e(p.langkah.map((m) => `${m.l} ${NAMA_ST[m.st]}`).join(", "))}">${p.langkah.map((m) => node(m, true)).join("")}</span>`; };
/** Desktop: rel berlabel dengan garis penghubung. */
export const htmlRel = (j, now) => { const p = perjalanan(j, now), L = p.langkah; return `<span class="dj-rel" role="img" aria-label="${e(L.map((m) => `${m.l} ${NAMA_ST[m.st]}`).join(", "))}">${L.map((m, i) => `${i ? `<i class="dj-gr${m.st === "ok" ? " is-ok" : L[i - 1].st === "ok" && m.st ? " is-now" : ""}"></i>` : ""}<span class="dj-lb">${node(m)}<small class="dj-lb--${m.st || "belum"}">${e(m.l)}</small></span>`).join("")}</span>`; };
