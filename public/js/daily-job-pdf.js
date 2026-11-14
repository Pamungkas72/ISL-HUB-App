// Laporan PDF Daily Job (desain A: laporan formal A4). Digambar langsung dengan jsPDF: teks bisa dipilih, tautan file aktif,
// halaman bertambah otomatis. Bukan tangkapan layar. Hitungan memakai daily-job-hitung.js.
import * as H from "./daily-job-hitung.js";

const C = { ink: [19, 40, 61], mu: [93, 112, 133], bd: [220, 229, 239], nv: [10, 61, 102], sky: [47, 143, 219], ac: [247, 148, 29], ok: [46, 158, 109], dg: [214, 69, 69], bg: [243, 247, 251], wh: [255, 255, 255] };
const ML = 12, W = 186, BAWAH = 280, ATAS = 31;
const kom = (n) => String(n).replace(".", ",");
const tglPendek = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" }) : "–");
const tglPenuh = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const bulan = (s, o) => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { ...o, timeZone: "UTC" });
const pot = (t, n) => { t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const urlAman = (u) => (/^https?:\/\//i.test(String(u || "")) ? u : "");
const kodeWarna = { ok: C.ok, wn: C.ac, er: C.dg };

/** opsi: { jsPDF, jobs, r, periode, kelompok, filter, now, pembuat }. Mengembalikan dokumen jsPDF. */
export function buatLaporanPdf({ jsPDF, jobs, r, periode, kelompok, filter = "", now, pembuat = "" }) {
  const d = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = ATAS;
  const judulPer = periode === "bulan" ? bulan(r[0], { month: "long", year: "numeric" }) : periode === "tahun" ? "Tahun " + r[0].slice(0, 4) : `${tglPenuh(r[0])} – ${tglPenuh(r[1])}`;
  const pr = H.rentangSebelum(periode, r);
  const lab = periode === "bulan" ? bulan(pr[0], { month: "long" }) : periode === "tahun" ? String(+r[0].slice(0, 4) - 1) : periode === "minggu" ? "minggu lalu" : "periode sebelumnya";
  const lab2 = periode === "bulan" ? bulan(pr[0], { month: "short" }) : periode === "tahun" ? String(+r[0].slice(0, 4) - 1) : periode === "minggu" ? "mgg lalu" : "periode lalu";

  const k = H.hitungKpi(jobs, r, now), pk = H.hitungKpi(jobs, pr, now), orang = H.perDetail(jobs, "pic", r, now), kat = H.perDetail(jobs, "kategori", r, now);
  const usia = H.usiaBacklog(jobs, now), st = H.hitungStatus(jobs, r, now);
  const selesai = jobs.filter((j) => j.status === "selesai" && H.dalam(j.tglSelesai, r)).sort((a, b) => a.tglSelesai.localeCompare(b.tglSelesai) || String(a.judul).localeCompare(String(b.judul)));
  const terbuka = jobs.filter((j) => H.aktif(j) && (!j.tglMasuk || j.tglMasuk <= r[1])).sort((a, b) => (a.tglTarget || "9").localeCompare(b.tglTarget || "9"));

  /* ---------- alat gambar ---------- */
  const teks = (t, x, yy, { size = 8.5, bold = false, warna = C.ink, align = "left", maks } = {}) => { d.setFont("helvetica", bold ? "bold" : "normal"); d.setFontSize(size); d.setTextColor(...warna); d.text(String(t), x, yy, { align, maxWidth: maks }); };
  const kotak = (x, yy, w, h, isi) => { d.setDrawColor(...C.bd); d.setLineWidth(0.3); if (isi) { d.setFillColor(...isi); d.roundedRect(x, yy, w, h, 1.8, 1.8, "FD"); } else d.roundedRect(x, yy, w, h, 1.8, 1.8, "S"); };
  const garis = (pts, warna, lw) => { d.setDrawColor(...warna); d.setLineWidth(lw); for (let i = 1; i < pts.length; i++) d.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); };
  const segitiga = (x, yy, naik, warna) => { d.setFillColor(...warna); naik ? d.triangle(x, yy + 1.6, x + 1.8, yy + 1.6, x + 0.9, yy, "F") : d.triangle(x, yy, x + 1.8, yy, x + 0.9, yy + 1.6, "F"); };
  const sektor = (cx, cy, r0, r1, a0, a1, warna) => {
    const n = Math.max(2, Math.ceil((a1 - a0) / 0.08)), p = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; p.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]); }
    d.setFillColor(...warna); d.lines(p.slice(1).map((q, i) => [q[0] - p[i][0], q[1] - p[i][1]]), p[0][0], p[0][1], [1, 1], "F", true);
  };
  const kepala = () => {
    d.setFillColor(...C.nv); d.roundedRect(ML, 10, 10, 10, 2, 2, "F"); teks("ISL", ML + 5, 14.6, { size: 6.5, bold: true, warna: C.wh, align: "center" }); teks("HUB", ML + 5, 17.6, { size: 6.5, bold: true, warna: C.wh, align: "center" });
    teks("Laporan Kinerja Daily Job", ML + 13, 14.2, { size: 15, bold: true, warna: C.nv }); teks(`PT Indo Sukses Logistik · ${kelompok}`, ML + 13, 18.6, { size: 7.5, warna: C.mu });
    teks(judulPer, ML + W, 12.6, { size: 9.5, bold: true, align: "right" });
    teks(`Periode ${tglPenuh(r[0])} – ${tglPenuh(r[1])}${filter ? " · " + filter : ""}`, ML + W, 16.4, { size: 6.8, warna: C.mu, align: "right" });
    teks(`Dibuat ${tglPenuh(now)}${pembuat ? " oleh " + pembuat : ""}`, ML + W, 19.8, { size: 6.8, warna: C.mu, align: "right" });
    d.setDrawColor(...C.nv); d.setLineWidth(0.6); d.line(ML, 24, ML + W, 24);
  };
  const halamanBaru = () => { d.addPage(); kepala(); y = ATAS; };
  const perlu = (h) => { if (y + h > BAWAH) halamanBaru(); };
  const bagian = (judul) => { perlu(14); y += 2; d.setFillColor(...C.ac); d.roundedRect(ML, y - 3.4, 1.2, 4.2, 0.5, 0.5, "F"); teks(judul.toUpperCase(), ML + 3, y, { size: 8.5, bold: true, warna: C.nv }); y += 4; };
  const noBaris = (h) => ((h.row.raw && h.row.raw[0]) || h.row.index + 1) - 1; // baris tinggi terpecah antarhalaman: row.index bisa di luar larik, kolom No tetap benar
  const tabel = (kolom, baris, opsi = {}) => {
    const awal = d.internal.getCurrentPageInfo().pageNumber;
    d.autoTable({ startY: y, margin: { left: ML, right: ML, top: ATAS, bottom: 16 }, head: [kolom.map((c) => c.j)], body: baris, theme: "grid", tableWidth: W,
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 }, lineColor: C.bd, lineWidth: 0.15, textColor: C.ink, overflow: "linebreak" },
      headStyles: { fillColor: C.bg, textColor: C.nv, fontStyle: "bold", halign: "right" }, columnStyles: Object.fromEntries(kolom.map((c, i) => [i, { halign: c.l ? "left" : "right", cellWidth: c.w }])),
      didDrawPage: () => { if (d.internal.getCurrentPageInfo().pageNumber !== awal) kepala(); },
      didParseCell: (h) => { if (h.section === "head") h.cell.styles.halign = kolom[h.column.index].l ? "left" : "right"; if (h.section === "body" && opsi.warna) opsi.warna(h); },
      didDrawCell: (h) => { if (h.section === "body" && opsi.tautan) opsi.tautan(h); }, ...opsi.ekstra });
    y = d.lastAutoTable.finalY + 4;
  };

  /* ---------- halaman 1: ringkasan eksekutif ---------- */
  kepala();
  bagian("Ringkasan eksekutif");
  const dl = (a, b, sat, naikBagus) => { if (a == null || b == null || (a === 0 && b === 0)) return null; const x = Math.round((a - b) * 10) / 10; return x ? { teks: `${kom(Math.abs(x))}${sat} vs ${lab2}`, naik: x > 0, bagus: (x > 0) === naikBagus } : { teks: `sama vs ${lab2}`, naik: null }; };
  const kartu = [["Job masuk", k.masuk, "pada periode ini", dl(k.masuk, pk.masuk, "", true)], ["Job selesai", k.selesai, k.persenSelesai != null ? `tingkat selesai ${k.persenSelesai}%` : "–", dl(k.selesai, pk.selesai, "", true)],
    ["Tepat waktu", k.persenTepat == null ? "–" : k.persenTepat + "%", `${k.tepat} dari ${k.selesai} selesai`, dl(k.persenTepat, pk.persenTepat, " poin", true)], ["Rata-rata selesai", k.rataHari == null ? "–" : kom(k.rataHari) + " hr", "masuk sampai selesai", dl(k.rataHari, pk.rataHari, " hr", false)],
    ["Terlambat", k.terlambat, "job aktif lewat target", dl(k.terlambat, pk.terlambat, "", false)], ["Backlog", k.backlog, "job belum selesai", dl(k.backlog, pk.backlog, "", false)]];
  const kw = (W - 8) / 3;
  kartu.forEach((c, i) => {
    const x = ML + (i % 3) * (kw + 4), yy = y + Math.floor(i / 3) * 26;
    kotak(x, yy, kw, 23); teks(c[0], x + 3, yy + 5, { size: 7.5, warna: C.mu }); teks(c[1], x + 3, yy + 12.5, { size: 17, bold: true, warna: C.nv }); teks(c[2], x + 3, yy + 17, { size: 7, warna: C.mu });
    if (c[3]) { if (c[3].naik != null) segitiga(x + 3, yy + 18.7, c[3].naik, c[3].bagus ? C.ok : C.dg); teks(c[3].teks, x + (c[3].naik != null ? 6 : 3), yy + 20.4, { size: 7, bold: true, warna: c[3].naik == null ? C.mu : c[3].bagus ? C.ok : C.dg }); }
  });
  y += 52;

  bagian("Poin penting");
  H.buatPoin({ k, pk, kat, usia, lab }).forEach((p) => {
    const baris = d.splitTextToSize(p.teks, W - 9); perlu(baris.length * 4 + 3);
    d.setFillColor(...kodeWarna[p.t]); d.circle(ML + 2.2, y - 1, 2, "F");
    if (p.t === "ok") garis([[ML + 1.2, y - 1], [ML + 2, y - 0.1], [ML + 3.4, y - 2]], C.wh, 0.4); else teks("!", ML + 2.2, y + 0.1, { size: 7, bold: true, warna: C.wh, align: "center" });
    baris.forEach((b, i) => teks(b, ML + 7, y + i * 4, { size: 8.5 })); y += baris.length * 4 + 1.8;
    d.setDrawColor(...C.bd); d.setLineWidth(0.1); d.setLineDashPattern([0.6, 0.6], 0); d.line(ML, y - 2.2, ML + W, y - 2.2); d.setLineDashPattern([], 0);
  });

  /* grafik batang: masuk vs selesai per satuan sumbu */
  bagian(`Tren job masuk dan selesai per ${H.modeBin(r) === "hari" ? "hari" : H.modeBin(r) === "minggu" ? "minggu" : "bulan"}`);
  const seri = H.deret(jobs, r, H.modeBin(r)), mode = H.modeBin(r);
  const hB = 44, x0 = ML + 7, wB = W - 7, mx = Math.max(4, ...seri.flatMap((s) => [s.masuk, s.selesai])), sk = (hB - 12) / mx;
  d.setFillColor(...C.sky); d.rect(ML, y - 0.4, 2.4, 2.4, "F"); teks("Masuk", ML + 3.4, y + 1.4, { size: 7, warna: C.mu }); d.setFillColor(...C.ok); d.rect(ML + 16, y - 0.4, 2.4, 2.4, "F"); teks("Selesai", ML + 19.4, y + 1.4, { size: 7, warna: C.mu }); y += 4;
  [0, 0.5, 1].forEach((f) => { const gy = y + hB - 7 - f * (hB - 12); d.setDrawColor(...C.bd); d.setLineWidth(0.15); d.line(x0, gy, ML + W, gy); teks(Math.round(f * mx), ML + 5, gy + 0.8, { size: 6.5, warna: C.mu, align: "right" }); });
  seri.forEach((s, i) => {
    const cx = x0 + ((i + 0.5) * wB) / seri.length, bw = Math.min(7, wB / seri.length / 3), base = y + hB - 7;
    d.setFillColor(...C.sky); d.rect(cx - bw - 0.3, base - s.masuk * sk, bw, s.masuk * sk, "F"); d.setFillColor(...C.ok); d.rect(cx + 0.3, base - s.selesai * sk, bw, s.selesai * sk, "F");
    if (s.masuk) teks(s.masuk, cx - bw / 2 - 0.3, base - s.masuk * sk - 0.8, { size: 6.5, align: "center" }); if (s.selesai) teks(s.selesai, cx + bw / 2 + 0.3, base - s.selesai * sk - 0.8, { size: 6.5, align: "center" });
    teks(mode === "hari" ? tglPendek(s.k).slice(0, 2) : mode === "tahun" ? bulan(s.k + "-01", { month: "short" }) : `Mgg ${i + 1} · ${tglPendek(s.k)}`, cx, base + 3.6, { size: 6.5, warna: C.mu, align: "center" });
  });
  y += hB + 2;

  /* grafik garis: akumulasi */
  bagian("Akumulasi sepanjang periode");
  const harian = H.deretHarian(jobs, r, now), hL = 34, mxL = Math.max(4, ...harian.map((p) => p.masuk));
  if (harian.length > 1) {
    [0, 1, 2, 3].forEach((f) => { const gy = y + hL - 6 - (f * (hL - 10)) / 3; d.setDrawColor(...C.bd); d.setLineWidth(0.15); d.line(x0, gy, ML + W, gy); teks(Math.round((f * mxL) / 3), ML + 5, gy + 0.8, { size: 6.5, warna: C.mu, align: "right" }); });
    const xy = (v, i) => [x0 + (i / (harian.length - 1)) * (wB - 6), y + hL - 6 - (v / mxL) * (hL - 10)];
    garis(harian.map((p, i) => xy(p.masuk, i)), C.sky, 0.6); garis(harian.map((p, i) => xy(p.selesai, i)), C.ok, 0.6);
    const u = harian[harian.length - 1]; teks(u.masuk, ML + W, xy(u.masuk, harian.length - 1)[1] - 1.2, { size: 7, bold: true, warna: C.sky, align: "right" }); teks(u.selesai, ML + W, xy(u.selesai, harian.length - 1)[1] + 3, { size: 7, bold: true, warna: C.ok, align: "right" });
    teks(tglPendek(r[0]), x0, y + hL, { size: 6.5, warna: C.mu }); teks(tglPendek(harian[harian.length - 1].k), ML + W, y + hL, { size: 6.5, warna: C.mu, align: "right" });
  } else teks("Belum cukup data untuk grafik.", ML, y + 6, { size: 8, warna: C.mu });
  y += hL + 2;

  /* ---------- halaman 2: analisis ---------- */
  halamanBaru();
  bagian("Komposisi dan usia job");
  kotak(ML, y, W / 2 - 2, 40); kotak(ML + W / 2 + 2, y, W / 2 - 2, 40);
  teks("Status job", ML + 3, y + 5, { size: 8, bold: true });
  const seg = [[st.selesai, C.ok, "Selesai"], [st.proses, C.sky, "Dikerjakan"], [st.tunggu, C.ac, "Tertunda"], [st.terlambat, C.dg, "Terlambat"]], tot = Math.max(1, seg.reduce((a, s) => a + s[0], 0)), cx = ML + 22, cy = y + 23;
  let a0 = -Math.PI / 2; d.setFillColor(...C.bd); sektor(cx, cy, 8, 14, -Math.PI / 2, Math.PI * 1.5 - 0.001, C.bd);
  seg.forEach((s) => { if (s[0]) { const a1 = a0 + (s[0] / tot) * Math.PI * 2; sektor(cx, cy, 8, 14, a0, Math.min(a1, Math.PI * 1.5 - 0.001), s[1]); a0 = a1; } });
  teks(tot, cx, cy + 1.6, { size: 9, bold: true, align: "center" });
  seg.forEach((s, i) => { d.setFillColor(...s[1]); d.rect(ML + 42, y + 12 + i * 6, 2.4, 2.4, "F"); teks(`${s[2]} ${s[0]}`, ML + 46, y + 14 + i * 6, { size: 7.5 }); });
  const ux = ML + W / 2 + 6; teks("Usia job aktif sejak masuk", ux, y + 5, { size: 8, bold: true });
  const mxU = Math.max(1, ...usia.map((u) => u.n)), cu = [C.sky, C.sky, C.ac, C.dg], bwU = (W / 2 - 14) / 4;
  usia.forEach((u, i) => { const x = ux + i * (bwU + 1), h = Math.max(0.8, (u.n / mxU) * 22); d.setFillColor(...cu[i]); d.rect(x + 1, y + 32 - h, bwU - 2, h, "F"); teks(u.n, x + bwU / 2, y + 31 - h, { size: 7.5, bold: true, align: "center" }); teks(u.l, x + bwU / 2, y + 36.5, { size: 6.5, warna: C.mu, align: "center" }); });
  y += 44;

  const pers = (v) => (v == null ? "–" : v + "%");
  bagian("Performa per orang");
  tabel([{ j: "PIC", l: true }, { j: "Masuk" }, { j: "Selesai" }, { j: "Tepat waktu" }, { j: "Rata-rata hari" }, { j: "Aktif" }, { j: "Terlambat" }],
    [...orang.map((o) => [o.nama, o.masuk, o.selesai, pers(o.persenTepat), o.rataHari == null ? "–" : kom(o.rataHari), o.backlog, o.terlambat]), ["Tim", k.masuk, k.selesai, pers(k.persenTepat), k.rataHari == null ? "–" : kom(k.rataHari), k.backlog, k.terlambat]],
    { warna: (h) => { const ci = h.column.index, ada = h.row.index < orang.length; if (!ada) { h.cell.styles.fontStyle = "bold"; h.cell.styles.fillColor = C.bg; } else if (ci === 3) { const v = orang[h.row.index].persenTepat; if (v != null) { h.cell.styles.textColor = v < 75 ? C.dg : C.ok; h.cell.styles.fontStyle = "bold"; } } else if (ci === 6 && orang[h.row.index].terlambat) { h.cell.styles.textColor = C.dg; h.cell.styles.fontStyle = "bold"; } } });
  if (orang.length) {
    const tinggi = 8 + orang.slice(0, 8).length * 8; perlu(tinggi); kotak(ML, y, W, tinggi); teks("Ketepatan waktu per orang", ML + 3, y + 5, { size: 8, bold: true });
    orang.slice(0, 8).forEach((o, i) => { const yy = y + 11 + i * 8; teks(o.nama, ML + 3, yy, { size: 8, bold: true }); teks(`${o.selesai} selesai · tepat waktu ${pers(o.persenTepat)}`, ML + W - 3, yy, { size: 7.5, align: "right", warna: C.mu }); d.setFillColor(...C.bd); d.roundedRect(ML + 3, yy + 1.4, W - 6, 2.6, 1.2, 1.2, "F"); if (o.persenTepat) { d.setFillColor(...(o.persenTepat >= 75 ? C.ok : C.ac)); d.roundedRect(ML + 3, yy + 1.4, ((W - 6) * o.persenTepat) / 100, 2.6, 1.2, 1.2, "F"); } });
    y += tinggi + 3;
  }

  bagian("Performa per kategori");
  tabel([{ j: "Kategori", l: true }, { j: "Masuk" }, { j: "Selesai" }, { j: "Tepat waktu" }, { j: "Rata-rata hari" }, { j: "Terlambat" }],
    kat.map((o) => [o.nama, o.masuk, o.selesai, pers(o.persenTepat), o.rataHari == null ? "–" : kom(o.rataHari), o.terlambat]),
    { warna: (h) => { const o = kat[h.row.index], ci = h.column.index; if (o && ci === 3 && o.persenTepat != null && o.persenTepat < 60) { h.cell.styles.textColor = C.dg; h.cell.styles.fontStyle = "bold"; } if (o && ci === 5 && o.terlambat) { h.cell.styles.textColor = C.dg; h.cell.styles.fontStyle = "bold"; } } });
  if (kat.length) {
    const tinggi = 9 + kat.length * 5.4; perlu(tinggi); kotak(ML, y, W, tinggi); teks("Job selesai per kategori (selesai/masuk · tepat waktu)", ML + 3, y + 5, { size: 8, bold: true });
    const mxK = Math.max(1, ...kat.map((o) => o.masuk));
    kat.forEach((o, i) => { const yy = y + 11 + i * 5.4; teks(pot(o.nama, 26), ML + 3, yy, { size: 7.5 }); d.setFillColor(...C.bd); d.roundedRect(ML + 42, yy - 2.6, W - 76, 2.8, 1.2, 1.2, "F"); if (o.selesai) { d.setFillColor(...C.ok); d.roundedRect(ML + 42, yy - 2.6, Math.max(1.5, ((W - 76) * o.selesai) / mxK), 2.8, 1.2, 1.2, "F"); } teks(`${o.selesai}/${o.masuk} · ${pers(o.persenTepat)}`, ML + W - 3, yy, { size: 7.5, bold: true, align: "right" }); });
    y += tinggi + 3;
  }

  /* ---------- lampiran ---------- */
  halamanBaru();
  bagian(`Lampiran 1 · Job selesai dan file project (${selesai.length})`);
  const tautanJob = (j) => [...(j.file || []).map((x) => x.url), ...(j.tautan || []).map((x) => x.url)].map(urlAman).filter(Boolean);
  const tepat = (j) => H.tepatWaktu(j);
  if (selesai.length) {
    tabel([{ j: "No", l: true, w: 8 }, { j: "Job", l: true, w: 58 }, { j: "Kategori", l: true, w: 28 }, { j: "Customer", l: true, w: 28 }, { j: "PIC", l: true, w: 14 }, { j: "Target", w: 14 }, { j: "Selesai", w: 14 }, { j: "Ket.", w: 11 }, { j: "File", w: 11 }],
      selesai.map((j, i) => [i + 1, j.judul, j.kategori || "–", pot(j.customer, 24) || "–", j.pic || "–", tglPendek(j.tglTarget), tglPendek(j.tglSelesai), tepat(j) ? "Tepat" : "Telat", tautanJob(j).length ? (tautanJob(j).length > 1 ? `Buka (${tautanJob(j).length})` : "Buka") : "–"]),
      { warna: (h) => { const j = selesai[noBaris(h)]; if (!j) return; if (h.column.index === 7) { h.cell.styles.textColor = tepat(j) ? C.ok : C.dg; h.cell.styles.fontStyle = "bold"; } if (h.column.index === 8 && tautanJob(j).length) { h.cell.styles.textColor = C.sky; h.cell.styles.fontStyle = "bold"; } },
        tautan: (h) => { const j = selesai[noBaris(h)]; if (j && h.column.index === 8) { const u = tautanJob(j)[0]; if (u) d.link(h.cell.x, h.cell.y, h.cell.width, h.cell.height, { url: u }); } } });
  } else { teks("Tidak ada job selesai pada periode ini.", ML, y + 3, { size: 8.5, warna: C.mu }); y += 8; }

  bagian(`Lampiran 2 · Job belum selesai, perlu tindak lanjut (${terbuka.length})`);
  if (terbuka.length) {
    tabel([{ j: "No", l: true, w: 8 }, { j: "Job", l: true, w: 74 }, { j: "Kategori", l: true, w: 34 }, { j: "PIC", l: true, w: 18 }, { j: "Target", w: 18 }, { j: "Posisi", w: 34 }],
      terbuka.map((j, i) => [i + 1, j.judul, j.kategori || "–", j.pic || "–", tglPendek(j.tglTarget), H.labelTarget(j, now).t]),
      { warna: (h) => { if (h.column.index === 5 && terbuka[noBaris(h)]) { const l = H.labelTarget(terbuka[noBaris(h)], now); h.cell.styles.fontStyle = "bold"; h.cell.styles.textColor = l.k === "bahaya" ? C.dg : l.k === "warn" ? C.ac : C.mu; } } });
  } else { teks("Tidak ada job yang belum selesai.", ML, y + 3, { size: 8.5, warna: C.mu }); y += 8; }

  perlu(26); bagian("Catatan dan definisi");
  const def = "Job masuk: tanggal diberikan berada dalam periode. Job selesai: tanggal selesai berada dalam periode. Tepat waktu: tanggal selesai sama dengan atau sebelum deadline; persen tepat waktu = job tepat waktu dibagi job selesai. Rata-rata hari: lama dari tanggal masuk sampai selesai. Terlambat: belum selesai dan sudah lewat deadline. Backlog: semua job belum selesai pada akhir periode. Usia job aktif dihitung sejak tanggal masuk. Pembanding: " + lab + ".";
  d.splitTextToSize(def, W).forEach((b, i) => teks(b, ML, y + i * 3.6, { size: 7, warna: C.mu }));

  /* ---------- footer semua halaman ---------- */
  const n = d.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) { d.setPage(i); d.setDrawColor(...C.bd); d.setLineWidth(0.2); d.line(ML, 287, ML + W, 287); teks(`Laporan Kinerja Daily Job · ${judulPer} · Rahasia, hanya untuk internal`, ML, 291, { size: 6.8, warna: C.mu }); teks(`Hal ${i} / ${n}`, ML + W, 291, { size: 6.8, warna: C.mu, align: "right" }); }
  return d;
}
