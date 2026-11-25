// Performa Tracking (tampilan murni, desain gabungan Opsi 2, 24 Nov 2026): satu tampilan untuk Trailer dan Distribusi; subdivisi dan filter lain menentukan isinya.
// Tab: Pengiriman (mengikuti filter) dan Armada dan sewa (hanya bila subdivisi bukan Trailer).
import { e } from "./ui.js";
import { tab, jt, rpJt } from "./daily-job-tracking.js";
import { kpi, bar, tabArmada, tabSewa } from "./daily-job-performa-dz.js";

export const SUB_PERF = [["pengiriman", "Pengiriman"], ["armada", "Armada dan sewa"]];
const chip = (k, t, n, x = "") => `<span class="dj-chip dj-chip--${k}">${t} <b>${n}</b>${x}</span>`;

function tabPengiriman(k, labelMinggu) {
  const risiko = k.perluBayar || k.tungguPod ? `<div class="dj-tind">${k.perluBayar ? chip("bahaya", "Perlu dibayar", k.perluBayar, ` · ${rpJt(k.nilaiPerluBayar)}`) : ""}${k.tungguPod ? chip("warn", "Tunggu POD", k.tungguPod) : ""}</div>` : "";
  const bd = k.banding.map((b) => `<div class="dj-bt"><b>${e(b.rute)}</b><span>${b.pelaku.map((o) => `<i class="${o.nama === b.murah ? "is-murah" : ""}">${e(o.nama)} ${jt(o.rata)}${o.nama === b.murah ? " ✓" : ""}</i>`).join("")}</span></div>`).join("");
  const mxB = Math.max(1, ...k.perBak.map((x) => x.ritase));
  return `${risiko}<div class="dj-kpis">${kpi("Order masuk", k.order, `${k.ritase} terlaksana${k.persenTerlaksana != null ? ` (${k.persenTerlaksana}%)` : ""}`)}${kpi("Ritase", k.ritase, k.drop != null ? `${k.drop} titik drop` : "shipment berjalan")}${kpi("Cost total", rpJt(k.cost), `Vendor ${jt(k.costVendor)} · uang jalan ${jt(k.costInternal)}`)}${kpi("Cost / ritase", rpJt(k.costPerRitase), "rata-rata")}</div>
  <div class="dj-grid2e">${tab("Volume order per minggu", ["Minggu", "Order", "Ritase"], k.perMinggu.map((m) => [e(labelMinggu(m.k)), m.order, m.ritase]))}${tab("Jenis pengiriman dan armada", ["Jenis", "Ritase", "Cost", "Per ritase"], k.perJenis.map((o) => [e(o.nama), o.ritase, jt(o.cost), jt(o.perRitase)]))}</div>
  <div class="dj-grid2e">${tab("Vendor yang dipakai", ["Vendor", "Ritase", "Cost", "Tarif rata²", "POD telat"], k.perVendor.map((o) => [e(o.nama), o.ritase, jt(o.cost), jt(o.perRitase), o.pod ? `<b class="dj-merah">${o.pod}</b>` : 0]))}${tab("Rute teratas", ["Rute", "Ritase", "Cost", "Per ritase"], k.perRute.map((o) => [e(o.nama), o.ritase, jt(o.cost), jt(o.perRitase)]))}</div>
  ${k.sub !== "kecil" ? `<section class="mr-kartu dj-kartu"><h3>Tarif per rute: siapa termurah</h3>${bd || `<p class="mr-sub">Muncul bila satu rute dikerjakan oleh dua vendor atau lebih (atau internal).</p>`}</section>` : ""}
  ${k.perBak.length ? `<section class="mr-kartu dj-kartu"><h3>Tipe bak</h3>${k.perBak.map((x) => bar(x.nama, x.ritase, mxB)).join("")}</section>` : ""}`;
}
/** k = hitungPerforma, arm = kendaraan kelompok, rr = ringkasRiwayat, tabAktif = salah satu SUB_PERF. Tab Armada dan sewa tidak ada bila subdivisi = Trailer ("besar"). */
export function htmlPerformaTracking(k, arm, rr, tabAktif, now, labelMinggu) {
  const ada = k.sub !== "besar", aktif = ada && tabAktif === "armada" ? "armada" : "pengiriman";
  const nav = ada ? `<div class="mr-seg dj-seg dj-arm__nav" role="group" aria-label="Bagian Performa">${SUB_PERF.map(([x, t]) => `<button type="button" class="mr-chip${aktif === x ? " is-aktif" : ""}" data-dj="pdz-sub" data-v="${x}">${t}</button>`).join("")}</div>` : "";
  return `<div id="dj-dash">${nav}${aktif === "armada" ? tabArmada(arm, rr, now) + tabSewa(arm, now) : tabPengiriman(k, labelMinggu)}</div>`;
}
