// Tab Aktivitas Tracking (pekerjaan non-pengiriman): kunjungan, survei, perbaikan, dokumen, GPS, monitor, storing. Kalender 6 hari + pengingat jauh ke depan.
import { e } from "./ui.js";
import { tambahHari, selisihHari } from "./daily-job-hitung.js";

const P = { kunjungan: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11l2 2 3-4"/>', vendor: '<path d="M3 21V9l9-5 9 5v12M9 21v-6h6v6"/>', survei: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', servis: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.6-.6-2.6z"/>', dokumen: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>', gps: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 11l3-3 3 3 4-4"/>', storing: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h0"/>', lain: '<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>' };
/** jenis: [nama, nama pendek, hue]. */
export const JENIS = { kunjungan: ["Kunjungan customer", "Customer", 215], vendor: ["Kunjungan vendor", "Vendor", 185], survei: ["Survei lapangan", "Survei", 150], servis: ["Perbaikan dan maintenance", "Perbaikan", 30], dokumen: ["Urus dokumen kendaraan", "Dokumen", 265], gps: ["Pasang GPS", "GPS", 100], monitor: ["Monitor shipment", "Monitor", 330], storing: ["Storing", "Storing", 0], lain: ["Lainnya", "Lainnya", 215] };
export const STATUS = { rencana: "Direncanakan", jalan: "Dikerjakan", selesai: "Selesai" };
export const DOK = { kir: "KIR", stnk: "STNK", pajak: "Pajak" };
export const INGATKAN = [[0, "Pada harinya"], [1, "1 hari sebelum"], [3, "3 hari sebelum"], [7, "7 hari sebelum"], [30, "30 hari sebelum"]];
const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const hr = (s) => new Date(s + "T00:00:00Z").getUTCDay();
const tglP = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }) : "");

/** Enam hari mulai dari awal. */
export const jendela = (awal) => Array.from({ length: 6 }, (_, i) => { const t = tambahHari(awal, i); return { t, h: NAMA_HARI[hr(t)], n: +t.slice(8) }; });
export const aktifG = (g) => g.status !== "selesai";
/** Belum selesai dan sudah lewat tanggalnya. */
export const lewat = (g, now) => aktifG(g) && g.tgl < now;
const urut = (a, b) => String(a.tgl + (a.jam || "")).localeCompare(String(b.tgl + (b.jam || "")));
export const hariDari = (l, t) => l.filter((g) => g.tgl === t).sort(urut);
export const jumlahHari = (l, t) => l.filter((g) => g.tgl === t).length;
/** Pengingat: belum selesai, lewat atau masuk jendela "ingatkan" (hari sebelum). */
export const pengingat = (l, now) => l.filter((g) => aktifG(g) && g.tgl !== now && selisihHari(g.tgl, now) <= (g.ingatkan || 0)).sort(urut);
/** Terjadwal setelah jendela, belum selesai. */
export const mendatang = (l, akhir) => l.filter((g) => aktifG(g) && g.tgl > akhir).sort(urut);
export const isu = (l) => l.filter((g) => g.isu);
/** Ubah data kendaraan saat pekerjaan selesai: perpanjang dokumen atau catat servis, dengan baris riwayat. Null bila tak terkait. */
export function dataArmada(k, g) {
  if (!k || g.status !== "selesai" || !["servis", "dokumen"].includes(g.jenis)) return null;
  const log = { tipe: g.jenis === "servis" ? "servis" : g.dok, judul: g.jenis === "servis" ? "Servis" : "Perpanjangan " + DOK[g.dok], tgl: g.tgl, biaya: g.biaya || null, catatan: g.judul || "", oleh: g.oleh || "", waktu: Date.now() };
  const d = { riwayat: [...(k.riwayat || []), log].slice(-100) };
  if (g.jenis === "dokumen") { if (!DOK[g.dok] || !g.berlakuBaru) return null; d[g.dok] = g.berlakuBaru; log.baru = g.berlakuBaru; } else d.servis = { ...(k.servis || {}), terakhir: g.tgl };
  return d;
}
/** Ringkasan satu bulan (YYYY-MM): jumlah per jenis, selesai, biaya, isu. */
export function ringkasBulan(l, bln) {
  const x = l.filter((g) => String(g.tgl).slice(0, 7) === bln), per = {}; x.forEach((g) => { per[g.jenis] = (per[g.jenis] || 0) + 1; });
  return { total: x.length, selesai: x.filter((g) => g.status === "selesai").length, biaya: x.reduce((a, g) => a + (+g.biaya || 0), 0), isu: x.filter((g) => g.isu).length, per };
}

const sv = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || P.lain}</svg>`;
const ik = (k, s = 36) => `<span class="dj-gk" style="--h:${(JENIS[k] || JENIS.lain)[2]};width:${s}px;height:${s}px">${sv(k, Math.round(s * 0.5))}</span>`;
const chip = (k, t) => `<span class="dj-chip dj-chip--${k}">${t}</span>`;
const CS = { rencana: "warn", jalan: "info", selesai: "ok" };
function kartu(g, now, ubah) {
  const lw = lewat(g, now), ak = lw ? "dj-gc--m" : g.status === "rencana" ? "dj-gc--u" : "";
  return `<div class="mr-kartu dj-gc ${ak}" ${ubah ? `data-dj="g-ubah" data-id="${e(g.id)}" tabindex="0"` : ""}>${ik(g.jenis)}<div class="dj-gc__i"><b>${e(g.judul)}</b><small>${e([g.plat, g.tempat, g.biaya ? "Rp" + Number(g.biaya).toLocaleString("id-ID") : ""].filter(Boolean).join(" · "))}</small><div class="dj-gc__m">${chip(CS[g.status] || "mu", STATUS[g.status] || "–")}${lw ? chip("bahaya", `lewat ${-selisihHari(g.tgl, now)} hr`) : ""}${g.isu ? chip("bahaya", "⚠ Isu") : ""}<span>${tglP(g.tgl)}${g.jam ? " · " + e(g.jam) : ""}</span>${g.pic ? `<i class="dj-gc__pic">${e(String(g.pic)[0].toUpperCase())}</i>` : ""}</div></div></div>`;
}
const grup = (j, l, now, ubah) => `<div class="dj-gg">${j}</div>${l.map((g) => kartu(g, now, ubah)).join("")}`;
/** Isi tab Aktivitas. awal = tanggal pertama di strip, pilih = hari terpilih, f = filter jenis. */
export function htmlAktivitas(l, { awal, pilih, f }, now, ubah) {
  const w = jendela(awal), semua = f ? l.filter((g) => g.jenis === f) : l, hariP = hariDari(semua, pilih), ing = pengingat(semua, now), md = mendatang(semua, w[5].t);
  const strip = `<div class="dj-hari"><button type="button" class="mr-ikonbtn" data-dj="g-geser" data-v="-6" aria-label="Enam hari sebelumnya">‹</button>${w.map((d) => { const n = jumlahHari(semua, d.t); return `<button type="button" class="dj-hari__d${d.t === pilih ? " is-aktif" : ""}${d.t === now ? " is-ini" : ""}" data-dj="g-hari" data-v="${d.t}"><small>${d.h}</small><b>${d.n}</b><i>${"<u></u>".repeat(Math.min(n, 4))}</i></button>`; }).join("")}<button type="button" class="mr-ikonbtn" data-dj="g-geser" data-v="6" aria-label="Enam hari berikutnya">›</button></div>`;
  const chips = `<div class="dj-gf" role="group" aria-label="Jenis aktivitas"><button type="button" class="mr-chip${f ? "" : " is-aktif"}" data-dj="g-f" data-v="">Semua <b>${l.length}</b></button>${Object.keys(JENIS).filter((k) => l.some((g) => g.jenis === k)).map((k) => `<button type="button" class="mr-chip${f === k ? " is-aktif" : ""}" data-dj="g-f" data-v="${k}">${JENIS[k][1]} <b>${l.filter((g) => g.jenis === k).length}</b></button>`).join("")}</div>`;
  const judulH = pilih === now ? "Hari ini" : `${NAMA_HARI[hr(pilih)]}, ${tglP(pilih)}`;
  const kos = !l.length ? `<section class="mr-kartu dj-kartu"><p class="mr-sub">Belum ada aktivitas. Catat kunjungan, survei, perbaikan, atau urus dokumen dengan tombol Catat aktivitas.</p></section>` : "";
  return `<div class="dj-giat">${chips}${strip}${awal === now ? "" : `<button type="button" class="mr-link" data-dj="g-geser" data-v="0">Kembali ke hari ini</button>`}${grup(`${judulH} · ${hariP.length} aktivitas`, hariP, now, ubah)}${hariP.length ? "" : `<p class="mr-sub">Tidak ada aktivitas di hari ini.</p>`}${ing.length ? grup("Pengingat", ing, now, ubah) : ""}${md.length ? grup("Jadwal berikutnya", md.slice(0, 20), now, ubah) : ""}${kos}</div>`;
}
const f = (l, i, k = "") => `<label class="mr-f ${k}"><span>${l}</span>${i}</label>`;
const inp = (id, v, o = "") => `<input id="${id}" value="${e(v ?? "")}" ${o}>`;
const opsi = (o, p) => Object.entries(o).map(([k, v]) => `<option value="${k}"${k === p ? " selected" : ""}>${v}</option>`).join("");
/** Isi panel catat/ubah aktivitas. arm = daftar kendaraan kelompok. */
export function htmlFormGiat(g, arm, hari) {
  const j = g.jenis || "kunjungan", dok = j === "dokumen", sr = j === "servis", kend = dok || sr || ["gps", "storing"].includes(j);
  return `<div class="mr-form dj-form" style="grid-template-columns:1fr 1fr"><div class="mr-f dj-lebar"><span>Jenis aktivitas *</span><div class="dj-gt" id="g-jenis">${Object.entries(JENIS).map(([k, v]) => `<button type="button" class="dj-gt__b${k === j ? " is-aktif" : ""}" data-dj="g-jenis" data-v="${k}">${ik(k, 30)}<small>${v[1]}</small></button>`).join("")}</div></div>
  ${f("Apa yang dikerjakan *", inp("g-judul", g.judul, 'placeholder="mis. Kunjungan PT Indomarco, ganti ban"'), "dj-lebar")}
  <label class="mr-f dj-g-kend ${kend ? "dj-lebar" : "dj-sembunyi"}"><span>Kendaraan <small>dari Armada</small></span><select id="g-plat"><option value="">–</option>${arm.map((k) => `<option value="${e(k.plat)}"${k.plat === g.plat ? " selected" : ""}>${e(k.plat)} · ${e([k.jenisArmada, k.bak].filter(Boolean).join(" "))}</option>`).join("")}</select></label>
  <label class="mr-f dj-g-dok ${dok ? "" : "dj-sembunyi"}"><span>Dokumen</span><select id="g-dok">${opsi(DOK, g.dok || "kir")}</select></label><label class="mr-f dj-g-dok ${dok ? "" : "dj-sembunyi"}"><span>Berlaku sampai (baru)</span><input type="date" id="g-baru" value="${e(g.berlakuBaru || "")}"></label>
  ${f("Tanggal", `<input type="date" id="g-tgl" value="${e(g.tgl || hari)}">`)}${f("Jam", `<input type="time" id="g-jam" value="${e(g.jam || "")}">`)}
  ${f("Lokasi / vendor / customer", inp("g-tempat", g.tempat), "dj-lebar")}${f("Biaya (Rp)", inp("g-biaya", g.biaya || "", 'inputmode="numeric" data-ribuan-live'))}${f("Status", `<select id="g-status">${opsi(STATUS, g.status || "rencana")}</select>`)}
  ${f("Ingatkan", `<select id="g-ingat">${INGATKAN.map(([n, t]) => `<option value="${n}"${(g.ingatkan || 0) === n ? " selected" : ""}>${t}</option>`).join("")}</select>`)}${f("PIC", inp("g-pic", g.pic))}
  <label class="mr-f dj-lebar dj-cek"><input type="checkbox" id="g-isu" ${g.isu ? "checked" : ""}> <span><b>Ada isu atau masalah</b> · masuk laporan bulanan</span></label>
  ${f("Catatan / hasil", `<textarea id="g-cat" rows="2">${e(g.catatan || "")}</textarea>`, "dj-lebar")}</div>`;
}
