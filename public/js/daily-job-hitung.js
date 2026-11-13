// Daily Job: aturan murni (tanpa tampilan/Firebase). Diuji di tests/unit/daily-job.test.js.
export const KATEGORI = ["Quotation", "RFQ", "Dokumen Kontrak", "DSR Projek", "Setup Project", "Monitoring Kasus", "Produk Administrasi", "Laporan", "Lainnya"]; // dari Excel Daily Report tim
export const STATUS = { baru: "Baru", proses: "Dikerjakan", tunggu: "Menunggu pihak lain", selesai: "Selesai", batal: "Batal" };
export const PRIORITAS = { tinggi: "Tinggi", sedang: "Sedang", rendah: "Rendah" };
export const BOBOT = { 1: "Ringan", 2: "Sedang", 3: "Berat" };
export const SLOT_PENGINGAT = [9, 14, 17]; // jam WIB

export const hariIni = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
const tgl = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
export const selisihHari = (a, b) => Math.round((tgl(a) - tgl(b)) / 864e5);
export const tambahHari = (s, n) => { const d = tgl(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const aktif = (j) => j.status !== "selesai" && j.status !== "batal";
export const terlambat = (j, now = hariIni()) => aktif(j) && !!j.tglTarget && j.tglTarget < now;
export const tepatWaktu = (j) => j.status === "selesai" && (!j.tglTarget || !j.tglSelesai || j.tglSelesai <= j.tglTarget);

/** Awal minggu (Senin) dari tanggal ISO. */
export const awalMinggu = (s) => { const w = (tgl(s).getUTCDay() + 6) % 7; return tambahHari(s, -w); };

/** Rentang [dari, sampai] untuk periode minggu/bulan/tahun pada tanggal acuan. */
export function rentang(periode, now = hariIni()) {
  if (periode === "minggu") { const a = awalMinggu(now); return [a, tambahHari(a, 6)]; }
  if (periode === "tahun") return [now.slice(0, 4) + "-01-01", now.slice(0, 4) + "-12-31"];
  const y = +now.slice(0, 4), m = +now.slice(5, 7), akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${now.slice(0, 7)}-01`, `${now.slice(0, 7)}-${String(akhir).padStart(2, "0")}`];
}
export const dalam = (t, [dari, sampai]) => !!t && String(t).slice(0, 10) >= dari && String(t).slice(0, 10) <= sampai;

/** KPI satu periode: masuk = tglMasuk di rentang; selesai = tglSelesai di rentang; backlog = aktif per akhir periode. */
export function hitungKpi(jobs, r, now = hariIni()) {
  const masuk = jobs.filter((j) => dalam(j.tglMasuk, r));
  const selesai = jobs.filter((j) => j.status === "selesai" && dalam(j.tglSelesai, r));
  const tepat = selesai.filter(tepatWaktu).length;
  const lama = selesai.filter((j) => j.tglMasuk && j.tglSelesai).map((j) => Math.max(0, selisihHari(j.tglSelesai, j.tglMasuk)));
  const backlog = jobs.filter((j) => aktif(j) && (!j.tglMasuk || j.tglMasuk <= r[1]));
  const bobot = (l) => l.reduce((n, j) => n + (+j.bobot || 1), 0);
  return {
    masuk: masuk.length, selesai: selesai.length, tepat,
    persenTepat: selesai.length ? Math.round((tepat / selesai.length) * 100) : null,
    persenSelesai: masuk.length ? Math.round((selesai.filter((j) => dalam(j.tglMasuk, r)).length / masuk.length) * 100) : null,
    rataHari: lama.length ? Math.round((lama.reduce((a, b) => a + b, 0) / lama.length) * 10) / 10 : null,
    backlog: backlog.length, terlambat: backlog.filter((j) => terlambat(j, now)).length,
    bobotSelesai: bobot(selesai), bobotMasuk: bobot(masuk),
  };
}

/** Hitung per kunci (kategori, PIC): masuk, selesai, aktif, bobot selesai. */
export function per(jobs, kunci, r) {
  const m = new Map();
  const ambil = (k) => { k = k || "-"; if (!m.has(k)) m.set(k, { nama: k, masuk: 0, selesai: 0, aktif: 0, bobot: 0 }); return m.get(k); };
  jobs.forEach((j) => {
    const o = ambil(j[kunci]);
    if (dalam(j.tglMasuk, r)) o.masuk++;
    if (j.status === "selesai" && dalam(j.tglSelesai, r)) { o.selesai++; o.bobot += +j.bobot || 1; }
    if (aktif(j)) o.aktif++;
  });
  return [...m.values()].filter((o) => o.masuk || o.selesai || o.aktif).sort((a, b) => b.selesai + b.aktif - (a.selesai + a.aktif));
}

/** Deret per minggu (periode bulan/minggu) atau per bulan (tahun): masuk vs selesai. */
export function deret(jobs, r, periode) {
  const bin = periode === "tahun" ? (s) => s.slice(0, 7) : periode === "hari" ? (s) => s : (s) => awalMinggu(s);
  const kunci = new Set();
  for (let t = r[0]; t <= r[1]; t = tambahHari(t, periode === "tahun" ? 28 : 1)) kunci.add(bin(t));
  const d = new Map([...kunci].sort().map((k) => [k, { k, masuk: 0, selesai: 0 }]));
  jobs.forEach((j) => {
    if (dalam(j.tglMasuk, r)) { const o = d.get(bin(j.tglMasuk)); if (o) o.masuk++; }
    if (j.status === "selesai" && dalam(j.tglSelesai, r)) { const o = d.get(bin(j.tglSelesai)); if (o) o.selesai++; }
  });
  return [...d.values()];
}

/** Pengingat: terlambat, jatuh tempo hari ini, dan mulai dalam 7 hari. */
export function pengingat(jobs, now = hariIni()) {
  const a = jobs.filter(aktif);
  return {
    terlambat: a.filter((j) => terlambat(j, now)).sort((x, y) => x.tglTarget.localeCompare(y.tglTarget)),
    hariIni: a.filter((j) => j.tglTarget === now),
    segera: a.filter((j) => j.tglMulai && j.tglMulai > now && j.tglMulai <= tambahHari(now, 7)),
  };
}

/** Slot pengingat (jam 9/14/17 WIB) yang sudah lewat hari ini dan belum ditandai. Kembali kunci slot terbaru, atau null. */
export function slotJatuhTempo(sudah, d = new Date()) {
  const jam = +new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(d) % 24;
  const lewat = SLOT_PENGINGAT.filter((s) => s <= jam);
  const s = lewat[lewat.length - 1];
  const k = s == null ? null : `${hariIni(d)}#${s}`;
  return k && !(sudah || []).includes(k) ? k : null;
}

/** Label sisa/lewat target untuk satu job. */
export function labelTarget(j, now = hariIni()) {
  if (j.status === "selesai") return { t: "Selesai " + (j.tglSelesai || "").slice(5).split("-").reverse().join("/"), k: "ok" };
  if (j.status === "batal") return { t: "Batal", k: "mu" };
  if (!j.tglTarget) return { t: "Tanpa target", k: "mu" };
  const s = selisihHari(j.tglTarget, now);
  return s < 0 ? { t: `Terlambat ${-s} hr`, k: "bahaya" } : s === 0 ? { t: "Hari ini", k: "warn" } : { t: `Sisa ${s} hr`, k: "" };
}

/* ---------- Import Excel (format "Input Tugas Harian": No, Tanggal Diberikan, PIC, Kategori Tugas, Customer / Project, Deskripsi Tugas, Deadline, Tanggal Selesai, Status Waktu, Bulan, Keterangan) ---------- */
export const isoTanggal = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v > 20000 ? new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) : null;
  const t = String(v).trim(), a = /^(\d{4})-(\d{2})-(\d{2})/.exec(t), b = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(t);
  return a ? a[0] : b ? `${b[3]}-${b[2].padStart(2, "0")}-${b[1].padStart(2, "0")}` : null;
};
export const normKategori = (k) => { const t = String(k || "").trim(); if (!t) return "Lainnya"; if (/^setup project/i.test(t)) return "Setup Project"; if (/^lainnya/i.test(t)) return "Lainnya"; if (/^daily job/i.test(t)) return "Produk Administrasi"; return KATEGORI.find((x) => x.toLowerCase() === t.toLowerCase()) || t; };
const BUTUH_TUNGGU = /menunggu|menungu|approval|pending|pendding|\bacc\b|jadwal|respon/i;

/** baris: larik-larik sel lembar Excel (header:1). Mengembalikan {jobs, peringatan, dilewati}. id = x + nomor baris, jadi impor ulang menimpa, bukan menggandakan. */
export function petaExcel(baris) {
  const h = baris.findIndex((r) => (r || []).some((c) => /^tanggal diberikan$/i.test(String(c || "").trim())));
  if (h < 0) return { galat: 'Lembar tidak punya kolom "Tanggal Diberikan". Pakai lembar "Input Tugas Harian".' };
  const kol = {}; baris[h].forEach((c, i) => { const t = String(c || "").trim().toLowerCase(); [["masuk", "tanggal diberikan"], ["pic", "pic"], ["kategori", "kategori"], ["customer", "customer"], ["desk", "deskripsi"], ["target", "deadline"], ["selesai", "tanggal selesai"], ["ket", "keterangan"]].forEach(([k, n]) => { if (t.startsWith(n) && kol[k] == null) kol[k] = i; }); });
  const jobs = [], peringatan = []; let dilewati = 0;
  baris.slice(h + 1).forEach((r, i) => {
    const n = h + i + 2, v = (k) => (r[kol[k]] == null ? "" : String(r[kol[k]]).trim());
    if (!v("desk") && !v("customer") && !v("kategori")) { dilewati++; return; }
    const kategori = normKategori(v("kategori")), customer = v("customer"), judul = v("desk") || [kategori, customer].filter(Boolean).join(" – ");
    let masuk = isoTanggal(r[kol.masuk]); const target = isoTanggal(r[kol.target]), selesai = isoTanggal(r[kol.selesai]), ket = v("ket");
    if (!v("desk")) peringatan.push(`Baris ${n}: deskripsi kosong, judul memakai "${judul}".`);
    if (!masuk) { masuk = selesai || target; peringatan.push(`Baris ${n} (${judul.slice(0, 40)}): tanggal diberikan kosong, memakai ${masuk || "hari impor"}.`); }
    const status = selesai ? "selesai" : BUTUH_TUNGGU.test(ket) ? "tunggu" : "proses";
    const catatan = ket && !/^done$/i.test(ket) ? [{ tgl: masuk || "", oleh: "Import Excel", teks: ket }] : [];
    jobs.push({ id: "x" + n, judul, kategori, customer, pic: v("pic"), deskripsi: "", tglMasuk: masuk, tglMulai: null, tglTarget: target, tglSelesai: selesai, status, prioritas: "sedang", bobot: 2, file: [], tautan: [], catatan });
  });
  return { jobs, peringatan, dilewati };
}

/** Kategori yang tersedia: bawaan + semua kategori yang pernah dipakai job (termasuk kategori baru). */
export const daftarKategori = (jobs) => [...new Set([...KATEGORI, ...(jobs || []).map((j) => j.kategori).filter(Boolean)])];
/** Kategori ketikan pengguna: spasi dirapikan; bila sama (tanpa beda huruf besar) dengan yang ada, pakai yang ada supaya tidak ganda. */
export const rapikanKategori = (t, ada) => { const k = String(t || "").replace(/\s+/g, " ").trim().slice(0, 40); return (ada || []).find((x) => x.toLowerCase() === k.toLowerCase()) || k; };

/* ---------- Dashboard performa (desain C) ---------- */
/** Periode pembanding: bulan/tahun kalender sebelumnya; selain itu rentang sama panjang tepat sebelumnya. */
export function rentangSebelum(periode, r) {
  if (periode === "bulan" || periode === "tahun") return rentang(periode, tambahHari(r[0], -1));
  const n = selisihHari(r[1], r[0]) + 1; return [tambahHari(r[0], -n), tambahHari(r[0], -1)];
}
/** Satuan sumbu grafik: harian untuk rentang pendek, mingguan untuk sampai ~4 bulan, bulanan di atasnya. */
export const modeBin = (r) => { const n = selisihHari(r[1], r[0]) + 1; return n <= 14 ? "hari" : n <= 125 ? "minggu" : "tahun"; };

/** Deret nilai per satuan sumbu untuk sparkline KPI: selesai, % tepat waktu, rata-rata hari, terlambat (menurut tanggal target). */
export function seriKpi(jobs, r, now = hariIni()) {
  const mode = modeBin(r), bin = mode === "tahun" ? (s) => s.slice(0, 7) : mode === "hari" ? (s) => s : awalMinggu;
  const kunci = deret([], r, mode).map((x) => x.k), per = new Map(kunci.map((k) => [k, { sel: 0, tepat: 0, hari: [], telat: 0 }]));
  jobs.forEach((j) => {
    if (j.status === "selesai" && dalam(j.tglSelesai, r)) { const o = per.get(bin(j.tglSelesai)); if (o) { o.sel++; if (tepatWaktu(j)) o.tepat++; if (j.tglMasuk) o.hari.push(Math.max(0, selisihHari(j.tglSelesai, j.tglMasuk))); } }
    if (j.tglTarget && dalam(j.tglTarget, r) && ((j.status === "selesai" && !tepatWaktu(j)) || terlambat(j, now))) { const o = per.get(bin(j.tglTarget)); if (o) o.telat++; }
  });
  let pt = 0, rt = 0; const out = { k: kunci, selesai: [], tepat: [], rata: [], telat: [] };
  kunci.forEach((k) => { const o = per.get(k); if (o.sel) pt = Math.round((o.tepat / o.sel) * 100); if (o.hari.length) rt = o.hari.reduce((a, b) => a + b, 0) / o.hari.length;
    out.selesai.push(o.sel); out.tepat.push(pt); out.rata.push(Math.round(rt * 10) / 10); out.telat.push(o.telat); });
  return out;
}

/** Jumlah kumulatif per hari dalam periode (sampai hari ini): masuk dan selesai. */
export function deretHarian(jobs, r, now = hariIni()) {
  const akhir = r[1] < now ? r[1] : now, hasil = []; let m = 0, s = 0;
  for (let t = r[0]; t <= akhir; t = tambahHari(t, 1)) {
    m += jobs.filter((j) => String(j.tglMasuk || "").slice(0, 10) === t).length;
    s += jobs.filter((j) => j.status === "selesai" && String(j.tglSelesai || "").slice(0, 10) === t).length;
    hasil.push({ k: t, masuk: m, selesai: s });
  }
  return hasil;
}

/** Usia job aktif sejak tanggal masuk: 0-3, 4-7, 8-14, lebih dari 14 hari. */
export function usiaBacklog(jobs, now = hariIni()) {
  const b = [["0–3 hr", 0], ["4–7 hr", 0], ["8–14 hr", 0], ["> 14 hr", 0]];
  jobs.filter(aktif).forEach((j) => { const u = j.tglMasuk ? Math.max(0, selisihHari(now, j.tglMasuk)) : 0; b[u <= 3 ? 0 : u <= 7 ? 1 : u <= 14 ? 2 : 3][1]++; });
  return b.map(([l, n]) => ({ l, n }));
}

/** Komposisi status: selesai di periode; job aktif dibagi terlambat, menunggu, dikerjakan. */
export function hitungStatus(jobs, r, now = hariIni()) {
  const a = jobs.filter(aktif);
  return { selesai: jobs.filter((j) => j.status === "selesai" && dalam(j.tglSelesai, r)).length, terlambat: a.filter((j) => terlambat(j, now)).length,
    tunggu: a.filter((j) => !terlambat(j, now) && j.status === "tunggu").length, proses: a.filter((j) => !terlambat(j, now) && j.status !== "tunggu").length };
}

/** Tabel performa per kunci (pic, kategori): KPI lengkap tiap baris. */
export function perDetail(jobs, kunci, r, now = hariIni()) {
  const m = new Map(); jobs.forEach((j) => { const k = j[kunci] || "-"; (m.get(k) || m.set(k, []).get(k)).push(j); });
  return [...m].map(([nama, l]) => ({ nama, ...hitungKpi(l, r, now) })).filter((o) => o.masuk || o.selesai || o.backlog).sort((a, b) => b.selesai + b.backlog - (a.selesai + a.backlog));
}

/** Pengelompokan Daftar job: kunci 'kategori' | 'pic' | 'status'. */
export function kelompokkan(jobs, mode, now = hariIni()) {
  const kunci = (j) => (mode === "status" ? STATUS[j.status] || "-" : j[mode === "pic" ? "pic" : "kategori"] || "-");
  const m = new Map(); jobs.forEach((j) => { const k = kunci(j); (m.get(k) || m.set(k, []).get(k)).push(j); });
  return [...m].map(([nama, l]) => ({ nama, jobs: l, telat: l.filter((j) => terlambat(j, now)).length, selesai: l.filter((j) => j.status === "selesai").length }))
    .sort((a, b) => b.telat - a.telat || b.jobs.length - a.jobs.length || a.nama.localeCompare(b.nama, "id"));
}
