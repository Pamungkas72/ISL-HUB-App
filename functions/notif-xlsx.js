// Penulis berkas .xlsx dan .csv tanpa dependensi (zip dibuat sendiri; zlib.crc32 butuh Node >= 20.15). Satu lembar, header tebal, lebar kolom otomatis.
const zlib = require("zlib");
const xml = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kol = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

function zip(berkas) {
  const lokal = [], pusat = []; let off = 0;
  for (const { nama, data } of berkas) {
    const n = Buffer.from(nama), d = zlib.deflateRawSync(data), crc = zlib.crc32(data) >>> 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(d.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    lokal.push(h, n, d);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(d.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    pusat.push(c, n); off += 30 + n.length + d.length;
  }
  const pj = pusat.reduce((a, b) => a + b.length, 0), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(berkas.length, 8); e.writeUInt16LE(berkas.length, 10); e.writeUInt32LE(pj, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...lokal, ...pusat, e]);
}
const sel = (v, r, gaya) => (typeof v === "number" && Number.isFinite(v) ? `<c r="${r}"${gaya}><v>${v}</v></c>` : `<c r="${r}" t="inlineStr"${gaya}><is><t xml:space="preserve">${xml(v)}</t></is></c>`);
function xlsx(header, rows, namaLembar = "Laporan") {
  const semua = [header, ...rows], lebar = header.map((_, i) => Math.min(60, Math.max(10, ...semua.map((r) => String((r || [])[i] ?? "").length + 2))));
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${semua.map((r, y) => `<row r="${y + 1}">${header.map((_, i) => sel((r || [])[i] ?? "", kol(i) + (y + 1), y === 0 ? ' s="1"' : "")).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const nama = xml(String(namaLembar).replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31) || "Laporan");
  const T = (s) => Buffer.from(s, "utf8"), H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zip([
    { nama: "[Content_Types].xml", data: T(`${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { nama: "_rels/.rels", data: T(`${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { nama: "xl/workbook.xml", data: T(`${H}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nama}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { nama: "xl/_rels/workbook.xml.rels", data: T(`${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { nama: "xl/styles.xml", data: T(`${H}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF6"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`) },
    { nama: "xl/worksheets/sheet1.xml", data: T(sheet) },
  ]);
}
const csv = (header, rows) => "﻿" + [header, ...rows].map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\r\n") + "\r\n";
module.exports = { xlsx, csv };
