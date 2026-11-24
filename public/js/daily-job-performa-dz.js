// Performa Truk Distribusi (tampilan murni, desain "tab fokus" disetujui 23 Nov 2026): Pengiriman, Armada dan dokumen, Sewa dan project.
import { e } from "./ui.js";
import * as DZ from "./daily-job-distribusi-hitung.js";
import { selisihHari } from "./daily-job-hitung.js";
import { tab, jt, rpJt } from "./daily-job-tracking.js";

export const SUB_PDZ = [["pengiriman", "Pengiriman"], ["armada", "Armada dan dokumen"], ["sewa", "Sewa dan project"]];
const kpi = (j, n, ket = "", kelas = "") => `<div class="dj-kpi dj-kpi--statis ${kelas}"><span>${j}</span><b>${n}</b><small>${ket}</small></div>`;
const bar = (l, n, mx, t) => `<div class="dj-vol"><span>${e(l)} · ${t ?? n}</span><div class="dj-vol__b"><i style="width:${Math.round((n / Math.max(1, mx)) * 100)}%"></i></div></div>`;
const tglP = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const NAMA = { kir: "KIR", stnk: "STNK", pajak: "Pajak", servis: "Servis" };

function tabPengiriman(k) {
  const risiko = k.tanpaPod || k.tungguPod ? `<div class="dj-tind">${k.tanpaPod ? `<span class="dj-chip dj-chip--bahaya">Dibayar, POD belum <b>${k.tanpaPod}</b></span>` : ""}${k.tungguPod ? `<span class="dj-chip dj-chip--warn">Tunggu POD <b>${k.tungguPod}</b></span>` : ""}</div>` : "";
  const mxH = Math.max(1, ...k.perHari.map((x) => x.n)), mxB = Math.max(1, ...k.perBak.map((x) => x.ritase));
  return `${risiko}<div class="dj-kpis">${kpi("Order masuk", k.order, `${k.ritase} terlaksana`)}${kpi("Ritase", k.ritase, `${k.drop} titik drop${k.ritase ? ` · ${(Math.round((k.drop / k.ritase) * 10) / 10).toLocaleString("id-ID")} per ritase` : ""}`)}${kpi("Cost total", rpJt(k.cost), `Uang jalan ${jt(k.costInternal)} · vendor ${jt(k.costVendor)}`)}${kpi("Cost / ritase", rpJt(k.costPerRitase), `${k.ritaseInternal} internal · ${k.ritaseVendor} vendor`)}</div>
  <div class="dj-grid2e"><section class="mr-kartu dj-kartu"><h3>Ritase per hari</h3>${k.perHari.length ? k.perHari.slice(-14).map((x) => bar(tglP(x.k), x.n, mxH)).join("") : `<p class="mr-sub">Belum ada ritase pada periode ini.</p>`}<p class="mr-sub">Satu titik: ${k.pola.satu} · multi-titik: ${k.pola.banyak}</p></section>
  ${tab("Jenis armada", ["Jenis", "Ritase", "Cost", "Per ritase"], k.perJenis.map((o) => [e(o.n), o.ritase, jt(o.cost), jt(o.perRitase)]))}</div>
  <div class="dj-grid2e">${tab("Vendor yang dipakai", ["Vendor", "Ritase", "Cost", "Tarif rata²"], k.perVendor.map((o) => [e(o.nama), o.ritase, jt(o.cost), jt(o.perRitase)]))}${tab("Rute teratas", ["Rute", "Ritase", "Cost", "Per ritase"], k.perRute.map((o) => [e(o.nama), o.ritase, jt(o.cost), jt(o.perRitase)]))}</div>
  <section class="mr-kartu dj-kartu"><h3>Tipe bak</h3>${k.perBak.length ? k.perBak.map((x) => bar(x.nama, x.ritase, mxB)).join("") : `<p class="mr-sub">Belum ada data.</p>`}</section>`;
}
function tabArmada(arm, rr, now) {
  const kp = DZ.kepatuhan(arm, now), tugas = DZ.tugasArmada(arm, now);
  return `<div class="dj-kpis">${kp.map((x) => kpi(NAMA[x.tipe], `${x.aman} aman`, `${x.bulan} ≤ 30 hari · ${x.lewat ? `<b class="dj-merah">${x.lewat} lewat</b>` : "0 lewat"}`, x.lewat ? "dj-kpi--bahaya" : "")).join("")}</div>
  <div class="dj-grid2e">${tab("Jatuh tempo 30 hari ke depan", ["Tanggal", "Kendaraan", "Jenis", "Keterangan"], tugas.map((t) => [t.tgl ? tglP(t.tgl) : "–", e(t.k.plat), t.nama, t.sisa < 0 ? `<b class="dj-merah">lewat ${-t.sisa} hari</b>` : `${t.sisa} hari lagi`]))}
  ${tab("Kegiatan pada periode ini", ["Kegiatan", "Jumlah", "Biaya"], [["Servis berkala", rr.servis.n, jt(rr.servis.biaya)], ["Perpanjangan KIR, STNK, pajak", rr.dokumen.n, jt(rr.dokumen.biaya)], ["Visit inspeksi sewa unit", rr.visit.n, "–"]])}</div>`;
}
function tabSewa(arm, now) {
  const s = DZ.ringkasSewa(arm), l = arm.filter((k) => k.sewa), mx = Math.max(1, ...s.kota.map((x) => x.n));
  return `<div class="dj-kpis">${kpi("Project aktif", s.total)}${kpi("Dengan driver", s.driver)}${kpi("Lepas kunci", s.lepas)}${kpi("Kota", s.kota.length)}</div>
  <div class="dj-grid2e">${tab("Sewa unit dan project", ["Project", "Kota", "Unit", "Bentuk", "Visit berikut"], l.map((k) => { const vb = DZ.visitBerikut(k); return [e(k.sewa.customer || "–"), e(k.sewa.kota || "–"), e([k.plat, k.jenisArmada].filter(Boolean).join(" · ")), k.sewa.bentuk === "lepas" ? "Lepas kunci" : "Dengan driver", vb ? `${tglP(vb)} (${selisihHari(vb, now)} hr)` : "–"]; }))}
  <section class="mr-kartu dj-kartu"><h3>Posisi per kota</h3>${s.kota.length ? s.kota.map((x) => bar(x.nama, x.n, mx, x.n + " unit")).join("") : `<p class="mr-sub">Belum ada unit disewa.</p>`}</section></div>`;
}
/** k = hitungDistribusi, arm = kendaraan kelompok, rr = ringkasRiwayat, sub = salah satu SUB_PDZ. */
export function htmlPerformaDistribusi(k, arm, rr, sub, now) {
  const nav = `<div class="mr-seg dj-seg dj-arm__nav" role="group" aria-label="Bagian Performa">${SUB_PDZ.map(([x, t]) => `<button type="button" class="mr-chip${sub === x ? " is-aktif" : ""}" data-dj="pdz-sub" data-v="${x}">${t}</button>`).join("")}</div>`;
  return `<div id="dj-dash">${nav}${sub === "armada" ? tabArmada(arm, rr, now) : sub === "sewa" ? tabSewa(arm, now) : tabPengiriman(k)}</div>`;
}
