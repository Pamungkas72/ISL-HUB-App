// Daily Job: aturan murni (tanpa tampilan/Firebase). Diuji di tests/unit/daily-job.test.js.
export const KATEGORI = ["Penawaran", "Skema alur bisnis", "Perhitungan dan kajian tarif", "Monitoring kasus", "Follow-up customer", "Survei dan visit", "Dokumen dan administrasi", "Lain-lain"];
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
  const bin = periode === "tahun" ? (s) => s.slice(0, 7) : (s) => awalMinggu(s);
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
