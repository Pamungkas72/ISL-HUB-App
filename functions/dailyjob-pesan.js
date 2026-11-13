// Isi notifikasi Daily Job (murni, diuji tests/unit/daily-job-notif.test.js).
const aktif = (j) => j.status !== "selesai" && j.status !== "batal";
const tambahHari = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hariJakarta = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
const jamJakarta = (d) => +new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(d) % 24;

function ringkas(jobs, hari) {
  const a = jobs.filter(aktif), besok = tambahHari(hari, 1);
  return { terlambat: a.filter((j) => j.tglTarget && j.tglTarget < hari), hariIni: a.filter((j) => j.tglTarget === hari), besok: a.filter((j) => j.tglTarget === besok), aktif: a.length };
}
/** Notifikasi 1 (tiap jam pengingat): ajakan catat job + ringkasan. Notifikasi 2 (hanya 09.00): deadline besok (H-1). */
function bangunPesan(jobs, sekarang, jamSlot) {
  const hari = hariJakarta(sekarang), r = ringkas(jobs, hari), jam = jamSlot == null ? jamJakarta(sekarang) : jamSlot, ps = [];
  const bagian = [r.terlambat.length && `${r.terlambat.length} terlambat`, r.hariIni.length && `${r.hariIni.length} jatuh tempo hari ini`, r.besok.length && `${r.besok.length} jatuh tempo besok`].filter(Boolean);
  ps.push({ tag: "dj-catat-" + jam, title: `Catat daily job · ${String(jam).padStart(2, "0")}.00`, body: "Catat job baru dan yang masih pending." + (bagian.length ? " " + bagian.join(" · ") + "." : "") });
  if (jam === 9 && r.besok.length) {
    const t = r.besok.slice(0, 3).map((j) => j.judul), lebih = r.besok.length - t.length;
    ps.push({ tag: "dj-h1", title: `${r.besok.length} deadline besok (H-1)`, body: t.join("; ") + (lebih > 0 ? ` +${lebih} lainnya` : "") });
  }
  return ps;
}
module.exports = { bangunPesan, ringkas, hariJakarta, jamJakarta, tambahHari, aktif };
