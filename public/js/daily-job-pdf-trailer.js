// Laporan PDF Tracking Trailer (A4, disetujui 23 Nov 2026): halaman 1 ringkasan, lampiran POD dan penagihan, kolom tanda tangan. Digambar dengan jsPDF.
import * as TL from "./daily-job-trailer-hitung.js";
import { rinci } from "./daily-job-tracking-hitung.js";

const C = { ink: [19, 40, 61], mu: [93, 112, 133], bd: [220, 229, 239], nv: [10, 61, 102], ac: [247, 148, 29], ok: [46, 158, 109], dg: [214, 69, 69], bg: [243, 247, 251], wh: [255, 255, 255] };
const ML = 12, W = 186, ATAS = 31, BAWAH = 280;
const tgl = (s) => (s ? new Date(String(s).slice(0, 10) + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const tglK = (s) => (s ? new Date(String(s).slice(0, 10) + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" }) : "–");
const jt = (n) => (n ? (Math.round(n / 1e4) / 100).toLocaleString("id-ID") + " jt" : "–");
const rpJt = (n) => "Rp " + (Math.round(n / 1e5) / 10).toLocaleString("id-ID") + " jt";
const bulan = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });

/** opsi: { jsPDF, jobs, r, periode, now, pembuat, filter, k (hitungTrailer), banding (bandingTarif) }. Mengembalikan dokumen jsPDF. */
export function buatLaporanTrailerPdf({ jsPDF, jobs, r, periode, now, pembuat = "", filter = "", k, banding }) {
  const d = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }); let y = ATAS;
  const judulPer = periode === "bulan" ? bulan(r[0]) : periode === "tahun" ? "Tahun " + r[0].slice(0, 4) : `${tgl(r[0])} – ${tgl(r[1])}`;
  const teks = (t, x, yy, { size = 8.5, bold = false, warna = C.ink, align = "left", maks } = {}) => { d.setFont("helvetica", bold ? "bold" : "normal"); d.setFontSize(size); d.setTextColor(...warna); d.text(String(t), x, yy, { align, maxWidth: maks }); };
  const kotak = (x, yy, w, h) => { d.setDrawColor(...C.bd); d.setLineWidth(0.3); d.roundedRect(x, yy, w, h, 1.8, 1.8, "S"); };
  const kepala = () => {
    d.setFillColor(...C.nv); d.roundedRect(ML, 10, 10, 10, 2, 2, "F"); teks("ISL", ML + 5, 14.6, { size: 6.5, bold: true, warna: C.wh, align: "center" }); teks("HUB", ML + 5, 17.6, { size: 6.5, bold: true, warna: C.wh, align: "center" });
    teks("Laporan Tracking Trailer", ML + 13, 14.2, { size: 15, bold: true, warna: C.nv }); teks("PT Indo Sukses Logistik · Kelompok Tracking · Mobil besar", ML + 13, 18.6, { size: 7.5, warna: C.mu });
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

  kepala(); bagian("Ringkasan");
  const kw = (W - 12) / 4;
  [["Order masuk", k.order, `${k.ritase} terlaksana`], ["Ritase", k.ritase, k.persenTerlaksana != null ? `${k.persenTerlaksana}% order terlaksana` : "–"], ["Cost total", rpJt(k.cost), `vendor ${jt(k.costVendor)} · uang jalan ${jt(k.costInternal)}`], ["Cost / ritase", rpJt(k.costPerRitase), "rata-rata"]].forEach((c, i) => {
    const x = ML + i * (kw + 4); kotak(x, y, kw, 20); teks(c[0], x + 3, y + 5, { size: 7, warna: C.mu }); teks(c[1], x + 3, y + 12, { size: 14, bold: true, warna: C.nv }); teks(c[2], x + 3, y + 16.5, { size: 6.3, warna: C.mu, maks: kw - 5 });
  }); y += 24;
  bagian("Jenis pengiriman");
  tabel([{ j: "Jenis", l: true, w: 40 }, { j: "Order" }, { j: "Ritase" }, { j: "Vendor / Internal" }, { j: "Cost" }, { j: "Cost / ritase" }], k.perJenis.map((o) => [o.nama, o.order, o.ritase, `${o.vendor} / ${o.internal}`, jt(o.cost), jt(o.perRitase)]));
  bagian("Volume order per minggu");
  if (k.perMinggu.length) tabel([{ j: "Minggu mulai", l: true, w: 60 }, { j: "Order masuk" }, { j: "Ritase" }], k.perMinggu.map((m) => [tgl(m.k), m.order, m.ritase])); else kosong("Belum ada order pada periode ini.");
  bagian("Vendor yang dipakai");
  if (k.perVendor.length) tabel([{ j: "Vendor", l: true, w: 62 }, { j: "Ritase" }, { j: "Cost" }, { j: "Tarif rata-rata" }, { j: "POD > 7 hari" }], k.perVendor.map((o) => [o.nama, o.ritase, jt(o.cost), jt(o.perRitase), o.pod]), (h) => { if (h.column.index === 4 && +h.cell.raw > 0) { h.cell.styles.textColor = C.dg; h.cell.styles.fontStyle = "bold"; } }); else kosong("Belum ada ritase pada periode ini.");
  bagian("Rute teratas");
  if (k.perRute.length) tabel([{ j: "Rute", l: true, w: 90 }, { j: "Ritase" }, { j: "Cost" }, { j: "Cost / ritase" }], k.perRute.map((o) => [o.nama.replace(/→/g, "-"), o.ritase, jt(o.cost), jt(o.perRitase)])); else kosong("Belum ada rute pada periode ini.");
  if (banding.length) { bagian("Tarif per rute: pelaku termurah"); tabel([{ j: "Rute", l: true, w: 60 }, { j: "Perbandingan (rata-rata per ritase)", l: true }, { j: "Termurah", l: true, w: 34 }], banding.map((b) => [b.rute.replace(/→/g, "-"), b.pelaku.map((o) => `${o.nama} ${jt(o.rata)}`).join(" · "), b.murah])); }
  if (k.perluBayar || k.tungguPod) { perlu(16); d.setFillColor(255, 241, 224); d.roundedRect(ML, y, W, 11, 1.8, 1.8, "F"); teks("Perhatian", ML + 3, y + 4.6, { size: 7.5, bold: true, warna: [138, 82, 8] }); teks(`${k.perluBayar ? `${k.perluBayar} shipment vendor Cash perlu ditransfer (${rpJt(k.nilaiPerluBayar)}). ` : ""}${k.tungguPod} shipment menunggu POD. POD wajib kembali sebelum penagihan ke customer.`, ML + 22, y + 4.6, { size: 7.5, warna: [138, 82, 8], maks: W - 25 }); y += 15; }

  d.addPage(); kepala(); y = ATAS;
  const js = jobs.filter((j) => j.status !== "batal" && TL.jenisTrailer(j)), tunggu = js.filter((j) => TL.fase(j) === "pod").sort((a, b) => TL.umurPod(b, now) - TL.umurPod(a, now)), siap = js.filter((j) => TL.fase(j) === "bayar");
  bagian(`Lampiran 1 · Shipment menunggu POD (${tunggu.length})`);
  if (tunggu.length) tabel([{ j: "No. DO", l: true, w: 22 }, { j: "Customer", l: true }, { j: "Jenis", l: true, w: 18 }, { j: "Vendor", l: true, w: 34 }, { j: "Selesai opr.", w: 22 }, { j: "Umur", w: 14 }, { j: "Pembayaran", l: true, w: 24 }],
    tunggu.map((j) => { const q = rinci(j); return [q.noDo || j.judul, j.customer || "–", TL.JENIS[q.jenis].nama, TL.internal(j) ? "Internal" : q.vendor, tglK(String(Object.values(q.tahap || {}).sort().slice(-1)[0] || "").slice(0, 10)), TL.umurPod(j, now) + " hr", TL.internal(j) ? "Uang jalan" : q.bayar === "top" ? "TOP" : q.tglBayar ? "Dibayar" : "Belum"]; }),
    (h) => { if (h.column.index === 5 && parseInt(h.cell.raw) > 7) h.cell.styles.textColor = C.dg; }); else kosong("Tidak ada shipment yang menunggu POD.");
  bagian(`Lampiran 2 · Perlu dibayar, vendor Cash (${siap.length})`);
  if (siap.length) tabel([{ j: "No. DO", l: true, w: 24 }, { j: "Customer", l: true }, { j: "Vendor", l: true, w: 34 }, { j: "Resi POD", l: true, w: 34 }, { j: "POD kembali", w: 24 }], siap.map((j) => { const q = rinci(j), p = q.podKirim || {}; return [q.noDo || j.judul, j.customer || "–", q.vendor || "–", [p.ekspedisi, p.resi].filter(Boolean).join(" ") || (TL.podKembali(j) ? "Tanpa resi" : "–"), q.tglPod ? tgl(q.tglPod) : "Belum"]; })); else kosong("Tidak ada shipment yang perlu dibayar.");
  perlu(30); y += 12; ["Disiapkan: Tim Tracking", "Diperiksa: Kepala Tracking", "Diketahui: Manajemen"].forEach((t, i) => { const x = ML + i * 64; d.setDrawColor(...C.ink); d.setLineWidth(0.3); d.line(x, y + 14, x + 52, y + 14); teks(t, x + 26, y + 18, { size: 7.5, warna: C.mu, align: "center" }); });
  const n = d.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) { d.setPage(i); d.setDrawColor(...C.bd); d.setLineWidth(0.2); d.line(ML, 287, ML + W, 287); teks(`Laporan Tracking Trailer · ${judulPer} · Rahasia, hanya untuk internal`, ML, 291, { size: 6.5, warna: C.mu }); teks(`Halaman ${i} dari ${n}`, ML + W, 291, { size: 6.5, warna: C.mu, align: "right" }); }
  return d;
}
