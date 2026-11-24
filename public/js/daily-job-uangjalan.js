// Uang jalan di Daily Job Truk Distribusi: blok di formulir pengiriman (tarif tetap + kalkulator rute baru), daftar tarif di Armada, dan slip PDF untuk driver.
// Hitungan: daily-job-distribusi-hitung.js (hitungUangJalan). Menyambung ke modul Uang Jalan yang ada dengan rumus yang sama.
import { e } from "./ui.js";
import * as DZ from "./daily-job-distribusi-hitung.js";

const rp = (n) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
const f = (l, i, k = "") => `<label class="mr-f ${k}"><span>${l}</span>${i}</label>`;
const num = (id, v, ph = "") => `<input id="${id}" inputmode="numeric" value="${e(v ?? "")}" placeholder="${e(ph)}">`;
const chip = (k, t) => `<span class="dj-chip dj-chip--${k}">${t}</span>`;
const tglP = (s) => (s ? new Date(String(s).slice(0, 10) + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–");

/** Blok uang jalan di formulir. info: { tarif (disetujui|null), menunggu (tarif menunggu|null), rute, jenis, buka, nilai (isian kalkulator) }. */
export function htmlUangJalan({ tarif, menunggu, rute, jenis, buka, nilai = {} }) {
  const bar = tarif ? `<div class="dj-uj__tarif"><div><small>Uang jalan · tarif tetap</small><b>${rp(tarif.nominal)}</b><small>${e(tarif.rute)} · ${e(tarif.jenisArmada)} · disepakati ${tglP(tarif.tgl)}</small></div><button type="button" class="mr-btn mr-btn--utama" data-dj="uj-pakai" data-v="${tarif.nominal}">Pakai</button></div>`
    : `<div class="dj-risiko">${rute && jenis ? `Belum ada tarif tetap untuk <b>${e(rute)}</b> (${e(jenis)}).${menunggu ? ` Pengajuan ${rp(menunggu.nominal)} menunggu persetujuan admin.` : ""}` : "Isi titik pick up, drop, dan jenis armada untuk melihat tarif uang jalan."}</div>`;
  return `${bar}<div class="dj-uj__tb"><button type="button" class="mr-btn" data-dj="uj-buka">${buka ? "Tutup kalkulator" : "Hitung uang jalan rute baru"}</button></div>${buka ? htmlKalkulator(rute, jenis, nilai) : ""}`;
}
export function htmlKalkulator(rute, jenis, n = {}) {
  const rasio = n.rasio ?? DZ.RASIO_BBM[jenis === "Grand Max Blind Van" ? "Blind Van" : jenis] ?? "";
  return `<div class="dj-uj__k"><div class="dj-g2">${f("Rute", `<input id="uj-rute" value="${e(n.rute ?? rute ?? "")}" placeholder="mis. Cikarang → Garut">`, "dj-lebar")}${f("Jarak pulang-pergi (km)", num("uj-jarak", n.jarak))}${f(`Rasio BBM (1 liter = … km)${jenis ? ` <small>${e(jenis)}</small>` : ""}`, num("uj-rasio", rasio))}${f("Harga solar / liter (Rp)", num("uj-solar", n.solar ?? 6800))}${f("Tol (Rp)", num("uj-tol", n.tol))}${f("TKBM (Rp) <small>opsional</small>", num("uj-tkbm", n.tkbm))}${f("Retribusi / mel (Rp)", num("uj-retr", n.retribusi))}${f("Insentif driver borongan (Rp)", num("uj-ins", n.insentif))}</div>
  <div id="uj-hasil" class="dj-uj__hasil"></div>
  <div class="dj-uj__tb"><button type="button" class="mr-btn" data-dj="uj-slip">Cetak slip untuk driver</button><button type="button" class="mr-btn" data-dj="uj-ajukan">Ajukan sebagai tarif tetap</button><button type="button" class="mr-btn mr-btn--utama" data-dj="uj-pakai-hitung">Pakai untuk pengiriman ini</button></div><p class="mr-sub">Tarif tetap baru berlaku setelah disetujui admin.</p></div>`;
}
/** Hasil perhitungan (baris + total) dari hitungUangJalan. */
export function htmlHasilUj(h) {
  return h.baris.filter(([n, v]) => v || n === "BBM").map(([n, v]) => `<div class="dj-uj__r"><span>${e(n)}${n === "BBM" && h.liter ? ` <small>${h.liter} liter</small>` : ""}</span><b>${rp(v)}</b></div>`).join("") + `<div class="dj-uj__r dj-uj__tot"><span>Total uang jalan</span><b>${rp(h.total)}</b></div>`;
}
/** Sub-tab Uang jalan di Armada: tarif tetap, pengajuan menunggu (setujui/tolak oleh admin), dan yang ditolak. */
export function htmlTabTarif(tarif, kelola, ubah) {
  const tunggu = tarif.filter((t) => t.status === "menunggu"), tetap = tarif.filter((t) => t.status === "setuju").sort((a, b) => String(a.rute).localeCompare(String(b.rute), "id") || String(a.jenisArmada).localeCompare(String(b.jenisArmada)));
  const btn = (a, id, t, k = "") => `<button type="button" class="mr-btn ${k}" data-dj="${a}" data-id="${e(id)}">${t}</button>`;
  return `<section class="mr-kartu dj-kartu"><div class="dj-kh"><h3>Menunggu persetujuan</h3>${chip(tunggu.length ? "warn" : "ok", tunggu.length)}</div>${tunggu.length ? tunggu.map((t) => `<div class="dj-arm__t"><div class="dj-arm__i"><b>${e(t.rute)} · ${e(t.jenisArmada)} · ${rp(t.nominal)}</b><small>diajukan ${e(t.diajukanNama || "")} ${tglP(t.tgl)}${t.jarak ? " · " + t.jarak + " km" : ""}</small></div>${kelola ? btn("uj-setuju", t.id, "Setujui", "mr-btn--utama") + btn("uj-tolak", t.id, "Tolak") : chip("warn", "menunggu")}</div>`).join("") : `<p class="mr-sub">Tidak ada pengajuan.</p>`}</section>
  <section class="mr-kartu dj-kartu"><div class="dj-kh"><h3>Tarif uang jalan tetap</h3><small class="mr-sub">${tetap.length} tarif</small></div>${tetap.length ? `<div class="dj-tw"><table class="dj-tbl"><thead><tr><th>Rute</th><th>Jenis armada</th><th>Uang jalan</th><th>Berlaku</th>${kelola ? "<th></th>" : ""}</tr></thead><tbody>${tetap.map((t) => `<tr><td>${e(t.rute)}</td><td>${e(t.jenisArmada)}</td><td><b>${rp(t.nominal)}</b></td><td>${tglP(t.disetujuiTgl || t.tgl)}</td>${kelola ? `<td>${btn("uj-hapus", t.id, "Hapus")}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<p class="mr-sub">Belum ada tarif tetap. Hitung rute baru di formulir pengiriman lalu ajukan.</p>`}</section>`;
}
/** Slip uang jalan A5 untuk driver (jsPDF). */
export function buatSlipPdf({ jsPDF, rute, jenis, driver, plat, tgl, h, nomor, pembuat = "" }) {
  const d = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" }), W = 148, M = 12; let y = 16;
  const t = (s, x, yy, o = {}) => { d.setFont("helvetica", o.b ? "bold" : "normal"); d.setFontSize(o.s || 9); d.setTextColor(...(o.c || [19, 40, 61])); d.text(String(s), x, yy, { align: o.a || "left" }); };
  d.setFillColor(10, 61, 102); d.roundedRect(M, 10, 10, 10, 2, 2, "F"); t("ISL", M + 5, 14.6, { s: 6.5, b: 1, c: [255, 255, 255], a: "center" }); t("HUB", M + 5, 17.6, { s: 6.5, b: 1, c: [255, 255, 255], a: "center" });
  t("Slip Uang Jalan", M + 13, 15, { s: 14, b: 1, c: [10, 61, 102] }); t("PT Indo Sukses Logistik · Truk Distribusi", M + 13, 19.2, { s: 7, c: [93, 112, 133] }); t(nomor || "", W - M, 14, { s: 8.5, b: 1, a: "right" }); t(tgl, W - M, 18.6, { s: 7, c: [93, 112, 133], a: "right" });
  d.setDrawColor(10, 61, 102); d.setLineWidth(0.5); d.line(M, 24, W - M, 24); y = 32;
  [["Rute", rute], ["Jenis armada", jenis], ["Driver", driver || "–"], ["Plat nomor", plat || "–"], ["Jarak pulang-pergi", h.jarak ? h.jarak + " km" : "–"], ["Rasio BBM", h.rasio ? `1 : ${h.rasio} (${h.liter} liter)` : "–"]].forEach(([k, v]) => { t(k, M, y, { c: [93, 112, 133] }); t(v, W - M, y, { a: "right", b: 1 }); y += 6; });
  y += 2; d.setDrawColor(220, 229, 239); d.line(M, y - 3, W - M, y - 3); t("RINCIAN", M, y + 1, { s: 7.5, b: 1, c: [10, 61, 102] }); y += 7;
  h.baris.filter(([n, v]) => v || n === "BBM").forEach(([n, v]) => { t(n, M, y); t("Rp" + Math.round(v).toLocaleString("id-ID"), W - M, y, { a: "right" }); y += 6; });
  d.setDrawColor(19, 40, 61); d.line(M, y - 2, W - M, y - 2); t("TOTAL UANG JALAN", M, y + 4, { s: 10, b: 1 }); t("Rp" + Math.round(h.total).toLocaleString("id-ID"), W - M, y + 4, { s: 12, b: 1, a: "right", c: [10, 61, 102] });
  y += 30; [["Dibuat", pembuat || "Tim Tracking"], ["Diterima driver", driver || ""]].forEach(([k, v], i) => { const x = M + i * 66; d.setDrawColor(19, 40, 61); d.line(x, y, x + 54, y); t(k, x + 27, y + 4, { s: 7.5, c: [93, 112, 133], a: "center" }); if (v) t(v, x + 27, y - 2, { s: 7.5, a: "center" }); });
  return d;
}
