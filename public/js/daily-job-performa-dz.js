// Potongan Performa untuk Armada dan sewa (kepatuhan, kegiatan, sewa unit); dipakai tab "Armada dan sewa" di daily-job-performa.js.
import { e } from "./ui.js";
import * as DZ from "./daily-job-distribusi-hitung.js";
import { selisihHari } from "./daily-job-hitung.js";
import { tab, jt, rpJt } from "./daily-job-tracking.js";

export const kpi = (j, n, ket = "", kelas = "") => `<div class="dj-kpi dj-kpi--statis ${kelas}"><span>${j}</span><b>${n}</b><small>${ket}</small></div>`;
export const bar = (l, n, mx, t) => `<div class="dj-vol"><span>${e(l)} · ${t ?? n}</span><div class="dj-vol__b"><i style="width:${Math.round((n / Math.max(1, mx)) * 100)}%"></i></div></div>`;
const tglP = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const NAMA = { kir: "KIR", stnk: "STNK", pajak: "Pajak", servis: "Servis" };

export function tabArmada(arm, rr, now) {
  const kp = DZ.kepatuhan(arm, now), tugas = DZ.tugasArmada(arm, now);
  return `<div class="dj-kpis">${kp.map((x) => kpi(NAMA[x.tipe], `${x.aman} aman`, `${x.bulan} ≤ 30 hari · ${x.lewat ? `<b class="dj-merah">${x.lewat} lewat</b>` : "0 lewat"}`, x.lewat ? "dj-kpi--bahaya" : "")).join("")}</div>
  <div class="dj-grid2e">${tab("Jatuh tempo 30 hari ke depan", ["Tanggal", "Kendaraan", "Jenis", "Keterangan"], tugas.map((t) => [t.tgl ? tglP(t.tgl) : "–", e(t.k.plat), t.nama, t.sisa < 0 ? `<b class="dj-merah">lewat ${-t.sisa} hari</b>` : `${t.sisa} hari lagi`]))}
  ${tab("Kegiatan pada periode ini", ["Kegiatan", "Jumlah", "Biaya"], [["Servis berkala", rr.servis.n, jt(rr.servis.biaya)], ["Perpanjangan KIR, STNK, pajak", rr.dokumen.n, jt(rr.dokumen.biaya)], ["Visit inspeksi sewa unit", rr.visit.n, "–"]])}</div>`;
}
export function tabSewa(arm, now) {
  const s = DZ.ringkasSewa(arm), l = arm.filter((k) => k.sewa), mx = Math.max(1, ...s.kota.map((x) => x.n));
  return `<div class="dj-kpis">${kpi("Project aktif", s.total)}${kpi("Dengan driver", s.driver)}${kpi("Lepas kunci", s.lepas)}${kpi("Kota", s.kota.length)}</div>
  <div class="dj-grid2e">${tab("Sewa unit dan project", ["Project", "Kota", "Unit", "Bentuk", "Visit berikut"], l.map((k) => { const vb = DZ.visitBerikut(k); return [e(k.sewa.customer || "–"), e(k.sewa.kota || "–"), e([k.plat, k.jenisArmada].filter(Boolean).join(" · ")), k.sewa.bentuk === "lepas" ? "Lepas kunci" : "Dengan driver", vb ? `${tglP(vb)} (${selisihHari(vb, now)} hr)` : "–"]; }))}
  <section class="mr-kartu dj-kartu"><h3>Posisi per kota</h3>${s.kota.length ? s.kota.map((x) => bar(x.nama, x.n, mx, x.n + " unit")).join("") : `<p class="mr-sub">Belum ada unit disewa.</p>`}</section></div>`;
}
