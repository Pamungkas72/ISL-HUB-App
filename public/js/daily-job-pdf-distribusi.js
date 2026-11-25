// Laporan PDF Truk Distribusi (A4, disetujui 23 Nov 2026): halaman 1 pengiriman, halaman 2 armada dan sewa unit, kolom tanda tangan. Digambar dengan jsPDF.
import * as DZ from "./daily-job-distribusi-hitung.js";
import { selisihHari } from "./daily-job-hitung.js";

const C = { ink: [19, 40, 61], mu: [93, 112, 133], bd: [220, 229, 239], nv: [10, 61, 102], ac: [247, 148, 29], dg: [214, 69, 69], bg: [243, 247, 251], wh: [255, 255, 255] };
const ML = 12, W = 186, ATAS = 31, BAWAH = 280;
const tgl = (s) => (s ? new Date(String(s).slice(0, 10) + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const jt = (n) => (n ? (Math.round(n / 1e4) / 100).toLocaleString("id-ID") + " jt" : "–");
const rpJt = (n) => "Rp " + (Math.round(n / 1e5) / 10).toLocaleString("id-ID") + " jt";
const bulan = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
const NAMA = { kir: "KIR", stnk: "STNK", pajak: "Pajak", servis: "Servis" };

/** opsi: { jsPDF, r, periode, now, pembuat, filter, k (hitungDistribusi), arm (kendaraan), rr (ringkasRiwayat) }. Mengembalikan dokumen jsPDF. */
export function buatLaporanDistribusiPdf({ jsPDF, r, periode, now, pembuat = "", filter = "", k, arm, rr }) {
  const d = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }); let y = ATAS;
  const judulPer = periode === "bulan" ? bulan(r[0]) : periode === "tahun" ? "Tahun " + r[0].slice(0, 4) : `${tgl(r[0])} – ${tgl(r[1])}`;
  const teks = (t, x, yy, { size = 8.5, bold = false, warna = C.ink, align = "left", maks } = {}) => { d.setFont("helvetica", bold ? "bold" : "normal"); d.setFontSize(size); d.setTextColor(...warna); d.text(String(t), x, yy, { align, maxWidth: maks }); };
  const kotak = (x, yy, w, h) => { d.setDrawColor(...C.bd); d.setLineWidth(0.3); d.roundedRect(x, yy, w, h, 1.8, 1.8, "S"); };
  const kepala = () => {
    d.setFillColor(...C.nv); d.roundedRect(ML, 10, 10, 10, 2, 2, "F"); teks("ISL", ML + 5, 14.6, { size: 6.5, bold: true, warna: C.wh, align: "center" }); teks("HUB", ML + 5, 17.6, { size: 6.5, bold: true, warna: C.wh, align: "center" });
    teks("Laporan Truk Distribusi", ML + 13, 14.2, { size: 15, bold: true, warna: C.nv }); teks("PT Indo Sukses Logistik · Kelompok Tracking · Mobil kecil", ML + 13, 18.6, { size: 7.5, warna: C.mu });
    teks(judulPer, ML + W, 12.6, { size: 9.5, bold: true, align: "right" }); teks(`Periode ${tgl(r[0])} – ${tgl(r[1])}${filter ? " · " + filter : ""}`, ML + W, 16.4, { size: 6.8, warna: C.mu, align: "right" });
    teks(`Dibuat ${tgl(now)}${pembuat ? " oleh " + pembuat : ""}`, ML + W, 19.8, { size: 6.8, warna: C.mu, align: "right" }); d.setDrawColor(...C.nv); d.setLineWidth(0.6); d.line(ML, 24, ML + W, 24);
  };
  const perlu = (h) => { if (y + h > BAWAH) { d.addPage(); kepala(); y = ATAS; } };
  const bagian = (judul) => { perlu(14); y += 2; d.setFillColor(...C.ac); d.roundedRect(ML, y - 3.4, 1.2, 4.2, 0.5, 0.5, "F"); teks(judul.toUpperCase(), ML + 3, y, { size: 8.5, bold: true, warna: C.nv }); y += 4; };
  const tabel = (kolom, baris, warna) => {
    const awal = d.internal.getCurrentPageInfo().pageNumber;
    d.autoTable({ startY: y, margin: { left: ML, right: ML, top: ATAS, bottom: 16 }, head: [kolom.map((c) => c.j)], body: baris, theme: "grid", tableWidth: W, styles: { font: "helvetica", fontSize: 7.5, cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 }, lineColor: C.bd, lineWidth: 0.15, textColor: C.ink, overflow: "linebreak" },
      headStyles: { fillColor: C.bg, textColor: C.nv, fontStyle: "bold" }, columnStyles: Object.fromEntries(kolom.map((c, i) => [i, { halign: c.l ? "left" : "right", cellWidth: c.w }])),
      didDrawPage: () => { if (d.internal.getCurrentPageInfo().pageNumber !== awal) kepala(); }, didParseCell: (h) => { if (h.section === "head") h.cell.styles.halign = kolom[h.column.index].l ? "left" : "right"; if (h.section === "body" && warna) warna(h); } });
    y = d.lastAutoTable.finalY + 4;
  };
  const kosong = (t) => { teks(t, ML, y + 3, { size: 8.5, warna: C.mu }); y += 8; };
  const merah = (kol, cond) => (h) => { if (h.column.index === kol && cond(h.cell.raw)) { h.cell.styles.textColor = C.dg; h.cell.styles.fontStyle = "bold"; } };

  kepala(); bagian("Ringkasan pengiriman");
  const kw = (W - 12) / 4;
  [["Order masuk", k.order, `${k.ritase} terlaksana`], ["Ritase", k.ritase, `${k.drop} titik drop`], ["Cost total", rpJt(k.cost), `uang jalan ${jt(k.costInternal)} · vendor ${jt(k.costVendor)}`], ["Cost / ritase", rpJt(k.costPerRitase), `${k.ritaseInternal} internal · ${k.ritaseVendor} vendor`]].forEach((c, i) => {
    const x = ML + i * (kw + 4); kotak(x, y, kw, 20); teks(c[0], x + 3, y + 5, { size: 7, warna: C.mu }); teks(c[1], x + 3, y + 12, { size: 14, bold: true, warna: C.nv }); teks(c[2], x + 3, y + 16.5, { size: 6.3, warna: C.mu, maks: kw - 5 });
  }); y += 24;
  bagian("Jenis armada");
  tabel([{ j: "Jenis armada", l: true, w: 50 }, { j: "Ritase" }, { j: "Cost" }, { j: "Cost / ritase" }], k.perJenis.map((o) => [o.n, o.ritase, jt(o.cost), jt(o.perRitase)]));
  bagian("Tipe bak");
  if (k.perBak.length) tabel([{ j: "Tipe bak", l: true, w: 70 }, { j: "Ritase" }, { j: "Cost" }, { j: "Cost / ritase" }], k.perBak.map((o) => [o.nama, o.ritase, jt(o.cost), jt(o.perRitase)])); else kosong("Belum ada ritase pada periode ini.");
  bagian("Vendor yang dipakai");
  if (k.perVendor.length) tabel([{ j: "Vendor", l: true, w: 70 }, { j: "Ritase" }, { j: "Cost" }, { j: "Tarif rata-rata" }], k.perVendor.map((o) => [o.nama, o.ritase, jt(o.cost), jt(o.perRitase)])); else kosong("Belum ada ritase pada periode ini.");
  bagian("Rute teratas");
  if (k.perRute.length) tabel([{ j: "Rute", l: true, w: 90 }, { j: "Ritase" }, { j: "Cost" }, { j: "Cost / ritase" }], k.perRute.map((o) => [o.nama.replace(/→/g, "-"), o.ritase, jt(o.cost), jt(o.perRitase)])); else kosong("Belum ada rute pada periode ini.");
  if (k.perluBayar || k.tungguPod) { perlu(16); d.setFillColor(255, 241, 224); d.roundedRect(ML, y, W, 11, 1.8, 1.8, "F"); teks("Perhatian", ML + 3, y + 4.6, { size: 7.5, bold: true, warna: [138, 82, 8] }); teks(`${k.perluBayar ? `${k.perluBayar} pengiriman vendor Cash perlu ditransfer. ` : ""}${k.tungguPod} pengiriman menunggu POD. POD wajib kembali sebelum penagihan.`, ML + 22, y + 4.6, { size: 7.5, warna: [138, 82, 8], maks: W - 25 }); y += 15; }

  d.addPage(); kepala(); y = ATAS; const kp = DZ.kepatuhan(arm, now), tugas = DZ.tugasArmada(arm, now), sw = DZ.ringkasSewa(arm);
  bagian(`Kepatuhan armada · ${arm.filter((x) => x.aktif !== false).length} kendaraan`);
  tabel([{ j: "Dokumen", l: true, w: 70 }, { j: "Aman" }, { j: "≤ 30 hari".replace("≤", "<=") }, { j: "Lewat tempo" }], kp.map((x) => [NAMA[x.tipe], x.aman, x.bulan, x.lewat]), merah(3, (v) => +v > 0));
  bagian("Jatuh tempo 30 hari ke depan");
  if (tugas.length) tabel([{ j: "Tanggal", l: true, w: 24 }, { j: "Kendaraan", l: true, w: 52 }, { j: "Jenis", l: true, w: 28 }, { j: "Keterangan", l: true }], tugas.map((t) => [tgl(t.tgl), `${t.k.plat} · ${[t.k.jenisArmada, t.k.bak].filter(Boolean).join(" ")}`, t.nama, t.sisa < 0 ? `Lewat ${-t.sisa} hari` : `${t.sisa} hari lagi`]), merah(3, (v) => String(v).startsWith("Lewat"))); else kosong("Tidak ada dokumen, servis, atau visit yang jatuh tempo.");
  bagian(`Sewa unit dan project · ${sw.total} aktif`);
  const sewa = arm.filter((x) => x.sewa);
  if (sewa.length) tabel([{ j: "Project", l: true }, { j: "Kota", l: true, w: 26 }, { j: "Unit", l: true, w: 30 }, { j: "Bentuk", l: true, w: 26 }, { j: "Berakhir", w: 22 }, { j: "Visit berikut", w: 28 }], sewa.map((x) => { const vb = DZ.visitBerikut(x); return [x.sewa.customer || "–", x.sewa.kota || "–", `${x.plat}`, x.sewa.bentuk === "lepas" ? "Lepas kunci" : "Dengan driver", tgl(x.sewa.akhir), vb ? `${tgl(vb)} (${selisihHari(vb, now)} hr)` : "–"]; })); else kosong("Belum ada unit disewa.");
  bagian("Perawatan dan dokumen pada periode ini");
  tabel([{ j: "Kegiatan", l: true, w: 90 }, { j: "Jumlah" }, { j: "Biaya" }], [["Servis berkala", rr.servis.n, jt(rr.servis.biaya)], ["Perpanjangan KIR, STNK, pajak", rr.dokumen.n, jt(rr.dokumen.biaya)], ["Visit inspeksi sewa unit", rr.visit.n, "–"]]);
  perlu(30); y += 12; ["Disiapkan: Tim Tracking", "Diperiksa: Kepala Tracking", "Diketahui: Manajemen"].forEach((t, i) => { const x = ML + i * 64; d.setDrawColor(...C.ink); d.setLineWidth(0.3); d.line(x, y + 14, x + 52, y + 14); teks(t, x + 26, y + 18, { size: 7.5, warna: C.mu, align: "center" }); });
  const n = d.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) { d.setPage(i); d.setDrawColor(...C.bd); d.setLineWidth(0.2); d.line(ML, 287, ML + W, 287); teks(`Laporan Truk Distribusi · ${judulPer} · Rahasia, hanya untuk internal`, ML, 291, { size: 6.5, warna: C.mu }); teks(`Halaman ${i} dari ${n}`, ML + W, 291, { size: 6.5, warna: C.mu, align: "right" }); }
  return d;
}
