// ===========================================================
// LAPORAN PDF & EXCEL — mengubah model laporan (laporan-model.js)
// menjadi file. PDF: A4 landscape, kop + ringkasan + tabel berwarna per
// vendor, footer berisi tanggal cetak dan nomor halaman.
// Pustaka (jsPDF, jspdf-autotable, SheetJS) dimuat lewat <script> di HTML.
// ===========================================================
import { hueVendor } from "./warna.js";

const NAVY = [16, 35, 63];
const ABU = [91, 101, 115];
const MERAH = [163, 45, 45];
const HIJAU = [39, 80, 10];
// palet dokumen Quotation
const ORANYE = [248, 144, 0];
const BIRU_MUDA = [220, 234, 247];
const BIRU_TUA = [14, 90, 130];
const PUDAR = [245, 250, 253];
const GARIS = [223, 228, 234];
const TINTA_ORANYE = [254, 241, 221];
const TEKS_ORANYE = [184, 106, 0];
const TEKS_LABEL = [122, 135, 148];

export const rp = (n, mu = "IDR") => (typeof n === "number" ? `${mu === "IDR" ? "Rp " : `${mu} `}${n.toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : "-");
export const angkaId = (n) => (typeof n === "number" ? n.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "-");
export const tglPendek = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
};
export const tglPanjang = (v) => {
  const d = v ? new Date(v) : new Date();
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

// hsl(0-359, 0-100, 0-100) -> [r,g,b]
export function hslKeRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function pustaka() {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) throw new Error("Pustaka PDF belum termuat. Periksa koneksi internet lalu muat ulang halaman.");
  return J;
}

function kop(doc, { judul, subjudul, aksen, meta }) {
  const L = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEKS_LABEL);
  doc.text(`${meta.perusahaan} · ${meta.unit}`, 12, 13);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...aksen);
  doc.text(judul, 12, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...ABU);
  doc.text(subjudul, 12, 27);
  // label rahasia
  const teks = "RAHASIA · HANYA INTERNAL";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const w = doc.getTextWidth(teks) + 6;
  doc.setFillColor(252, 235, 235);
  doc.roundedRect(L - 12 - w, 10, w, 6.5, 1.2, 1.2, "F");
  doc.setTextColor(...MERAH);
  doc.text(teks, L - 12 - w + 3, 14.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...ABU);
  doc.text("Angka dalam rupiah (harga modal / harga beli)", L - 12, 20, { align: "right" });
  doc.setDrawColor(...ORANYE);
  doc.setLineWidth(0.8);
  doc.line(12, 30, L - 12, 30);
}

function kotakRingkas(doc, y, kotak) {
  const L = doc.internal.pageSize.getWidth();
  const jml = kotak.length;
  const gap = 4;
  const lebar = (L - 24 - gap * (jml - 1)) / jml;
  kotak.forEach((k, i) => {
    const x = 12 + i * (lebar + gap);
    doc.setFillColor(...(k.warna || PUDAR));
    doc.roundedRect(x, y, lebar, 14, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...(k.tekswarna || TEKS_LABEL));
    doc.text(k.label, x + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...(k.angkawarna || [26, 26, 26]));
    doc.text(String(k.nilai), x + 3, y + 11.5);
  });
  return y + 14;
}

function judulBagian(doc, y, teks) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(teks, 12, y);
  return y + 2.5;
}

function footer(doc, meta) {
  const L = doc.internal.pageSize.getWidth();
  const T = doc.internal.pageSize.getHeight();
  doc.setDrawColor(214, 214, 214);
  doc.setLineWidth(0.2);
  doc.line(12, T - 11, L - 12, T - 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...ABU);
  doc.text(`Dicetak ${tglPanjang()} oleh ${meta.oleh || "-"} · ISL HUB Marketing dan BD`, 12, T - 7);
  doc.text(`Halaman ${doc.internal.getNumberOfPages()} dari {total}`, L - 12, T - 7, { align: "right" });
}

const gayaTabel = { font: "helvetica", fontSize: 8.5, cellPadding: { top: 1.8, bottom: 1.8, left: 2.2, right: 2.2 }, lineColor: GARIS, lineWidth: 0.15, textColor: [26, 26, 26] };
const kepalaTabel = { fillColor: BIRU_MUDA, textColor: NAVY, fontStyle: "bold", halign: "left" };

function selesai(doc) {
  doc.putTotalPages("{total}");
  return doc;
}

export function buatPdfKomparasi(model, meta) {
  const J = pustaka();
  const doc = new J({ orientation: "landscape", unit: "mm", format: "a4" });
  const sub = [`Data per ${tglPanjang()}`, `Vendor: ${model.kolom.map((k) => k.nama).join(", ") || "-"}`, model.sejak ? `Perubahan sejak ${tglPanjang(model.sejak)}` : null].filter(Boolean).join(" · ");
  kop(doc, { judul: model.judul, subjudul: sub, aksen: NAVY, meta });
  let y = kotakRingkas(doc, 34, [
    { label: "Item tarif", nilai: model.ringkasan.item },
    { label: "Vendor", nilai: model.ringkasan.vendor },
    { label: "Berubah", nilai: model.ringkasan.berubah, warna: TINTA_ORANYE, tekswarna: TEKS_ORANYE, angkawarna: [150, 80, 0] },
  ]);
  const hooks = { didDrawPage: () => footer(doc, meta) };

  if (model.perubahan.length) {
    y = judulBagian(doc, y + 8, "1. Perubahan terbaru");
    doc.autoTable({
      startY: y,
      margin: { left: 12, right: 12, bottom: 16 },
      styles: gayaTabel,
      headStyles: kepalaTabel,
      alternateRowStyles: { fillColor: PUDAR },
      head: [["Layanan", "Vendor", "Lama", "Baru", "Selisih", "Tanggal"]],
      body: model.perubahan.map((p) => [p.layanan, p.vendorNama, angkaId(p.lama), angkaId(p.baru), p.pct === null ? "baru" : `${p.pct > 0 ? "naik" : "turun"} ${Math.abs(p.pct)}%`, tglPendek(p.tanggal)]),
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" }, 4: { halign: "right" }, 5: { halign: "right" } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index >= 2) d.cell.styles.halign = "right";
        if (d.section === "body" && d.column.index === 4) {
          const p = model.perubahan[d.row.index];
          if (p && p.pct !== null) d.cell.styles.textColor = p.pct > 0 ? MERAH : HIJAU;
        }
      },
      ...hooks,
    });
    y = doc.lastAutoTable.finalY;
  }

  y = judulBagian(doc, y + 9, `${model.perubahan.length ? "2" : "1"}. Perbandingan harga modal per vendor`);
  const kolom = model.kolom;
  doc.autoTable({
    startY: y,
    margin: { left: 12, right: 12, bottom: 16 },
    styles: gayaTabel,
    headStyles: kepalaTabel,
    head: [["Layanan", "Satuan", ...kolom.map((k) => k.nama)]],
    body: model.baris.map((b) => [b.label, b.satuan ? String(b.satuan).replace(/_/g, " ") : "", ...kolom.map((k) => (typeof b.sel[k.id] === "number" ? angkaId(b.sel[k.id]) : "-"))]),
    columnStyles: Object.fromEntries(kolom.map((_, i) => [i + 2, { halign: "right" }])),
    didParseCell: (d) => {
      const idx = d.column.index - 2;
      if (d.section === "head" && idx >= 0) {
        d.cell.styles.halign = "right";
        const h = hueVendor(kolom[idx].vendor || { id: kolom[idx].id });
        d.cell.styles.fillColor = hslKeRgb(h, 55, 82);
        d.cell.styles.textColor = hslKeRgb(h, 60, 18);
      }
      if (d.section === "body" && idx >= 0) {
        const b = model.baris[d.row.index];
        if (b && b.terendah.includes(kolom[idx].id)) {
          d.cell.styles.fillColor = [234, 243, 222];
          d.cell.styles.textColor = HIJAU;
          d.cell.styles.fontStyle = "bold";
        } else if (b && typeof b.sel[kolom[idx].id] !== "number") d.cell.styles.textColor = [160, 168, 178];
      }
    },
    ...hooks,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...ABU);
  const yAkhir = doc.lastAutoTable.finalY + 5;
  if (yAkhir < doc.internal.pageSize.getHeight() - 14) doc.text("Sel hijau = modal terendah di antara vendor. Tanda - = vendor tidak memiliki tarif tersebut. Tarif yang belum diisi tidak dicantumkan.", 12, yAkhir);
  return selesai(doc);
}

export function buatPdfSatuVendor(model, meta) {
  const J = pustaka();
  const doc = new J({ orientation: "landscape", unit: "mm", format: "a4" });
  const h = hueVendor(model.vendor && model.vendor.id ? model.vendor : { id: model.vendorId });
  const aksen = NAVY;
  const v = model.vendor || {};
  const sub = [v.namaLengkap || null, `Data per ${tglPanjang()}`, model.sejak ? `Perubahan sejak ${tglPanjang(model.sejak)}` : "Semua lini bisnis"].filter(Boolean).join(" · ");
  kop(doc, { judul: model.judul, subjudul: sub, aksen, meta });
  let y = kotakRingkas(doc, 34, [
    { label: "Termin bayar", nilai: v.terminBayar || "-", warna: hslKeRgb(h, 60, 92), tekswarna: hslKeRgb(h, 60, 25), angkawarna: hslKeRgb(h, 60, 18) },
    { label: "Lini bisnis", nilai: model.ringkasan.lini },
    { label: "Layanan terisi", nilai: model.ringkasan.layanan },
    { label: "Berubah 30 hari", nilai: model.ringkasan.berubah30, warna: TINTA_ORANYE, tekswarna: TEKS_ORANYE, angkawarna: [150, 80, 0] },
  ]);
  const hooks = { didDrawPage: () => footer(doc, meta) };
  for (const kel of model.kelompok) {
    y = judulBagian(doc, y + 8, `${kel.nama}  (${kel.item.length} layanan)`);
    doc.autoTable({
      startY: y,
      margin: { left: 12, right: 12, bottom: 16 },
      styles: gayaTabel,
      headStyles: kepalaTabel,
      alternateRowStyles: { fillColor: PUDAR },
      head: [["Layanan", "Satuan", "Modal", "Diperbarui"]],
      body: kel.item.map((i) => [i.layanan, String(i.satuan || "").replace(/_/g, " "), `${angkaId(i.modal)}${i.arah ? ` (${i.arah})` : ""}`, tglPendek(i.diperbarui)]),
      columnStyles: { 2: { halign: "right", fontStyle: "bold" }, 3: { halign: "right" } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index >= 3) d.cell.styles.halign = "right";
        if (d.section === "body" && d.column.index === 3) {
          const i = kel.item[d.row.index];
          if (i && i.arah) d.cell.styles.textColor = i.arah === "naik" ? MERAH : HIJAU;
        }
      },
      ...hooks,
    });
    y = doc.lastAutoTable.finalY;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...ABU);
  const yAkhir = y + 5;
  if (yAkhir < doc.internal.pageSize.getHeight() - 14) doc.text("Tarif yang belum diisi tidak dicantumkan. (naik) / (turun) = perubahan dari harga sebelumnya.", 12, yAkhir);
  return selesai(doc);
}

// ---------------- Excel ----------------
function X() {
  if (!window.XLSX) throw new Error("Pustaka Excel belum termuat. Periksa koneksi internet lalu muat ulang halaman.");
  return window.XLSX;
}

export function buatExcelKomparasi(model) {
  const x = X();
  const wb = x.utils.book_new();
  const kolom = model.kolom;
  const aoa = [["Layanan", "Satuan", ...kolom.map((k) => k.nama)], ...model.baris.map((b) => [b.label, String(b.satuan || "").replace(/_/g, " "), ...kolom.map((k) => (typeof b.sel[k.id] === "number" ? b.sel[k.id] : ""))])];
  const ws = x.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 44 }, { wch: 22 }, ...kolom.map(() => ({ wch: 16 }))];
  x.utils.book_append_sheet(wb, ws, "Perbandingan");
  if (model.perubahan.length) {
    const p = x.utils.aoa_to_sheet([["Layanan", "Vendor", "Lama", "Baru", "Selisih (%)", "Tanggal"], ...model.perubahan.map((r) => [r.layanan, r.vendorNama, r.lama ?? "", r.baru ?? "", r.pct ?? "", String(r.tanggal).slice(0, 10)])]);
    p["!cols"] = [{ wch: 44 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
    x.utils.book_append_sheet(wb, p, "Perubahan terbaru");
  }
  return wb;
}

export function buatExcelSatuVendor(model) {
  const x = X();
  const wb = x.utils.book_new();
  const baris = [["Lini Bisnis", "Layanan", "Satuan", "Modal", "Mata Uang", "Diperbarui"]];
  for (const k of model.kelompok) for (const i of k.item) baris.push([k.nama, i.layanan, String(i.satuan || "").replace(/_/g, " "), i.modal, i.mataUang, i.diperbarui ? String(i.diperbarui).slice(0, 10) : ""]);
  const ws = x.utils.aoa_to_sheet(baris);
  ws["!cols"] = [{ wch: 24 }, { wch: 44 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
  x.utils.book_append_sheet(wb, ws, "Tarif");
  return wb;
}

export function buatExcelMentah(baris) {
  const x = X();
  const wb = x.utils.book_new();
  const ws = x.utils.json_to_sheet(baris);
  ws["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 44 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
  x.utils.book_append_sheet(wb, ws, "Data");
  return wb;
}

export function simpanExcel(wb, namaFile) {
  X().writeFile(wb, namaFile);
}

// Laporan master (PDF): ringkasan dan identitas vendor di halaman pertama, lalu tarif per lini dan per vendor.
export function buatPdfMaster(model, meta) {
  const J = pustaka();
  const doc = new J({ orientation: "landscape", unit: "mm", format: "a4" });
  const r = model.ringkasan;
  kop(doc, { judul: model.judul, subjudul: `Data per ${tglPanjang()} · semua lini bisnis dan vendor`, aksen: NAVY, meta });
  let y = kotakRingkas(doc, 34, [
    { label: "Total tarif", nilai: r.tarif },
    { label: "Vendor", nilai: r.vendor },
    { label: "Lini bisnis", nilai: r.lini },
    { label: "Belum ada modal", nilai: r.belumModal, warna: TINTA_ORANYE, tekswarna: TEKS_ORANYE, angkawarna: [150, 80, 0] },
    { label: "Belum ada lini", nilai: r.belumLini, warna: TINTA_ORANYE, tekswarna: TEKS_ORANYE, angkawarna: [150, 80, 0] },
  ]);
  const hooks = { didDrawPage: () => footer(doc, meta) };

  y = judulBagian(doc, y + 8, "Identitas vendor");
  doc.autoTable({
    startY: y,
    margin: { left: 12, right: 12, bottom: 16 },
    styles: gayaTabel,
    headStyles: kepalaTabel,
    alternateRowStyles: { fillColor: PUDAR },
    head: [["Vendor", "Nama lengkap", "Lini bisnis", "Termin bayar", "Kontak"]],
    body: model.identitas.map((v) => [v.nama, v.namaLengkap || "-", v.lini || "-", v.terminBayar || "-", v.kontak || "-"]),
    ...hooks,
  });
  y = doc.lastAutoTable.finalY;

  const batasHalaman = () => doc.internal.pageSize.getHeight() - 28;
  for (const kel of model.kelompok) {
    y = judulBagian(doc, y + 10, `${kel.nama}  (${angkaId(kel.jumlah)} tarif)`);
    for (const v of kel.vendor) {
      if (y > batasHalaman()) { doc.addPage(); y = 14; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...BIRU_TUA);
      doc.text(`${v.nama}  (${angkaId(v.item.length)})`, 12, y + 5);
      doc.autoTable({
        startY: y + 7,
        margin: { left: 12, right: 12, bottom: 16 },
        styles: gayaTabel,
        headStyles: kepalaTabel,
        alternateRowStyles: { fillColor: PUDAR },
        head: [["Layanan", "Lokasi", "Satuan", "Modal", "Metode", "Status", "Diperbarui"]],
        body: v.item.map((i) => [i.layanan, i.lokasi || "-", String(i.satuan || "").replace(/_/g, " "), typeof i.modal === "number" ? `${i.mataUang === "IDR" ? "" : `${i.mataUang} `}${angkaId(i.modal)}` : "belum diisi", i.metode.replace(/_/g, " "), i.status, tglPendek(i.diperbarui)]),
        columnStyles: { 3: { halign: "right", fontStyle: "bold" }, 6: { halign: "right" } },
        ...hooks,
      });
      y = doc.lastAutoTable.finalY + 3;
    }
  }
  return selesai(doc);
}
