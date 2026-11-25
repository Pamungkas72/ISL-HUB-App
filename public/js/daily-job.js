// ===========================================================
// DAILY JOB — catatan job harian tim marketing dan BD, pengingat, dashboard performa, dan laporan PDF.
// Data: dj_job dan dj_kelompok (Firestore), lampiran di Storage dailyjob/{kelompok}/. Aturan: firestore.rules dan storage.rules.
// Akses: tiap akun punya kelompok (pengguna.kelompokDJ); anggota hanya melihat dan mengubah job kelompoknya; master dan admin semua.
// Hitungan murni ada di daily-job-hitung.js.
// ===========================================================
import { renderNav } from "./nav.js";
import { labelAkun } from "./config-akses.js";
import { e, $, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { app, db } from "./firebase-config.js";
import { unggahBlob } from "./app-store.js";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as H from "./daily-job-hitung.js";
import * as TR from "./daily-job-tracking-hitung.js";
import { htmlFormTracking, chipPil, dataFormTracking, htmlTrailerDetail, htmlDistribusiDetail, htmlTitik, titikAwal, htmlDokRows, htmlSaranDok, ringkasDok } from "./daily-job-tracking.js";
import * as TL from "./daily-job-trailer-hitung.js";
import * as DZ from "./daily-job-distribusi-hitung.js";
import * as LK from "./daily-job-langkah.js";
import * as JL from "./daily-job-jalan.js";
import * as GT from "./daily-job-giat.js";
import { htmlArmada, htmlFormKendaraan, htmlFormTugas, judulTugas } from "./daily-job-armada.js";
import { namaAkun, tentukanPic } from "./daily-job-pic.js";
import { aturHuruf, awalKalimat, kapital } from "./daily-job-huruf.js";
import { lembarEkspor, namaBerkas } from "./daily-job-ekspor.js";
import { htmlPerformaTracking as htmlPerfTracking } from "./daily-job-performa.js";
import { hitungPerforma } from "./daily-job-performa-hitung.js";
import { tampilkanPratinjau, tipeBerkas, labelTipe, ukuranTeks, temaGelap } from "./daily-job-viewer.js";
import { statusPush, aktifkanPush, matikanPush, jagaPush } from "./daily-job-push.js";
import { bukaFormKelompok, hapusKelompok } from "./akun-divisi.js";

const S = { lihatSaja: false, ajuanKat: [], u: null, kelola: false, kelompokSaya: null, kelompok: [], jobs: [], akun: [], tab: "job", periode: "bulan", dari: "", sampai: "", fKel: "", fPic: "", fKat: "", status: "aktif", antre: "aktif", masalah: "", armada: [], giat: [], gAwal: "", gPilih: "", gF: "", subArm: "tindakan", subPdz: "pengiriman", pDaftar: "semua", pDari: "", pSampai: "", urut: "baru", hal: 0, menu: "", kelAktif: "", sub: "", terbuka: "", sisi: "aksi", kelAtur: "", pilih: new Set(), modePilih: false, detail: null, tim: {}, cari: "", muat: false, galat: "", subKel: "kelompok", pilihKel: "" };
const uid = () => "dj" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtTgl = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const namaKel = (id) => ((S.kelompokSemua || S.kelompok).find((k) => k.id === id) || {}).nama || "–";
const aman = (u) => (/^https?:\/\//i.test(String(u || "")) ? e(u) : "#"); // hanya tautan http(s) yang dibuka

/* ---------- data ---------- */
async function muat() {
  S.muat = true; S.galat = ""; render();
  try {
    const ks = await getDocs(collection(db, "dj_kelompok"));
    S.kelompokSemua = ks.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    S.kelompok = S.kelompokSemua.filter((k) => !k.arsip); // kelompok diarsipkan tidak muncul di pilihan; job lamanya tetap terbaca lewat kelompokSemua
    const q = S.kelola ? collection(db, "dj_job") : S.kelompokSaya ? query(collection(db, "dj_job"), where("kelompokId", "==", S.kelompokSaya)) : null;
    S.jobs = q ? (await getDocs(q)).docs.map((d) => H.dariDok(d.id, d.data())) : [];
    try { const qr = S.kelola ? collection(db, "dj_armada") : S.kelompokSaya ? query(collection(db, "dj_armada"), where("kelompokId", "==", S.kelompokSaya)) : null; S.armada = qr ? (await getDocs(qr)).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.plat).localeCompare(String(b.plat))) : []; } catch (_) { S.armada = []; } // aturan dj_armada mungkin belum dipasang
    try { const qg = S.kelola ? collection(db, "dj_kegiatan") : S.kelompokSaya ? query(collection(db, "dj_kegiatan"), where("kelompokId", "==", S.kelompokSaya)) : null; S.giat = qg ? (await getDocs(qg)).docs.map((d) => ({ id: d.id, ...d.data() })) : []; } catch (_) { S.giat = []; } // aturan dj_kegiatan mungkin belum dipasang
    if (!S.kelompok.some((k) => k.id === S.kelAktif)) { let simpan = ""; try { simpan = localStorage.getItem("dj-kel") || ""; } catch (_) {} S.kelAktif = S.kelola ? (S.kelompok.some((k) => k.id === simpan) ? simpan : (S.kelompok[0] || {}).id || "") : S.kelompokSaya || ""; }
    try { const qa = S.kelola ? collection(db, "dj_kategori_ajuan") : S.kelompokSaya ? query(collection(db, "dj_kategori_ajuan"), where("kelompokId", "==", S.kelompokSaya)) : null; S.ajuanKat = qa ? (await getDocs(qa)).docs.map((d) => ({ id: d.id, ...d.data() })) : []; } catch (_) { S.ajuanKat = []; } // aturan baru belum dipasang: ajuan kosong
    if (S.kelola) S.akun = (await getDocs(collection(db, "pengguna"))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.status === "aktif").sort((a, b) => String(a.nama || a.email).localeCompare(String(b.nama || b.email), "id"));
  } catch (err) { console.error(err); S.galat = "Data Daily Job belum bisa dibaca. Pemilik perlu memasang aturan Firestore terbaru (firebase deploy --only firestore:rules,storage)."; }
  S.muat = false; render();
}
const rentangAktif = () => (S.periode === "rentang" && S.dari && S.sampai ? [S.dari, S.sampai] : H.rentang(S.periode === "rentang" ? "bulan" : S.periode));
const profilKel = (id) => (S.kelompok.find((k) => k.id === id) || {}).profil || "marketing";
const profilAktif = () => profilKel(S.kelAktif);
/** Job kelompok yang sedang dilihat (master memilih kelompok; anggota hanya kelompoknya) dan subdivisi Tracking. */
const jobsKel = () => S.jobs.filter((j) => (!S.kelAktif || j.kelompokId === S.kelAktif) && (profilAktif() !== "tracking" || !S.sub || TR.subdivisiDari(j.kategori) === S.sub));
const kelById = (id) => (S.kelompokSemua || S.kelompok).find((k) => k.id === id);
const katDari = (kid) => H.kategoriKel(kelById(kid), S.jobs.filter((j) => j.kelompokId === kid));
const kategoriAktif = () => (profilAktif() === "tracking" ? [...TR.SUBDIVISI.kecil.kategori, ...TR.SUBDIVISI.besar.kategori] : S.kelAktif ? katDari(S.kelAktif) : H.kategoriKel(null, jobsKel()));
const katJob = (j) => (j.kategori || "") + (j.kategoriAjuan ? " (menunggu)" : "");
const tampak = () => jobsKel().filter((j) => (!S.fPic || j.pic === S.fPic) && (!S.fKat || j.kategori === S.fKat));
/** Daftar nama anggota aktif satu kelompok (fungsi server djNamaTim, hanya nama), disimpan per kelompok. null = belum bisa dimuat (mis. fungsi belum terdeploy): PIC tidak diblokir. */
const roster = {};
/* daftar kosong dianggap tidak bisa memvalidasi (tidak memblokir) */
async function muatRoster(kid) {
  if (!kid) return null; if (kid in roster) return roster[kid];
  try { const nama = (await panggil("djNamaTim", { kelompokId: kid })).nama; roster[kid] = Array.isArray(nama) && nama.length ? nama : null; } catch (err) { console.warn("Daftar PIC belum bisa dimuat:", err); roster[kid] = null; }
  return roster[kid];
}
const picForm = (kid) => (Array.isArray(roster[kid]) ? [...new Set([...roster[kid], S.u.nama].filter(Boolean))] : daftarPic());
const opsiPic = (l) => l.map((p) => `<option value="${e(p)}">`).join("");
const daftarPic = () => [...new Set(jobsKel().map((j) => j.pic).filter(Boolean))].sort();

/* ---------- tampilan ---------- */
const opsi = (arr, sel, semua) => `${semua ? `<option value="">${e(semua)}</option>` : ""}${arr.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${e(v)}"${String(v) === String(sel) ? " selected" : ""}>${e(t)}</option>`; }).join("")}`;

const pBln = (t) => new Date(t + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const periodeAktif = () => (S.periode === "rentang" && S.dari && S.sampai ? "rentang" : S.periode === "rentang" ? "bulan" : S.periode);
/** Judul periode di kepala dashboard. Bulan berjalan adalah bawaan dan otomatis berganti tiap tanggal 1. */
function judulPeriode(r) {
  const p = periodeAktif(), t = (x, o) => new Date(x + "T00:00:00Z").toLocaleDateString("id-ID", { ...o, timeZone: "UTC" });
  return p === "bulan" ? t(r[0], { month: "long", year: "numeric" }) : p === "tahun" ? "Tahun " + r[0].slice(0, 4) : p === "minggu" ? "Minggu ini" : `${pBln(r[0])} – ${pBln(r[1])}`;
}
const labelPembanding = (r, p) => (p === "bulan" ? "vs " + new Date(H.rentangSebelum("bulan", r)[0] + "T00:00:00Z").toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" }) : p === "tahun" ? "vs " + (+r[0].slice(0, 4) - 1) : p === "minggu" ? "vs minggu lalu" : "vs periode lalu");
const koma = (n) => String(n).replace(".", ",");

function spark(seri, warna) {
  if (!seri || seri.length < 2) return "";
  const mx = Math.max(1, ...seri), mn = Math.min(0, ...seri);
  return `<svg class="dj-spark" viewBox="0 0 80 26" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${warna}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${seri.map((v, i) => `${(i * 80) / (seri.length - 1)},${23 - ((v - mn) / (mx - mn || 1)) * 20}`).join(" ")}"/></svg>`;
}
/** Selisih terhadap periode sebelumnya. naikBagus: true bila angka naik itu baik. */
function delta(skrg, lalu, satuan, naikBagus, lab) {
  if (skrg == null || lalu == null || (lalu === 0 && skrg === 0)) return "";
  const d = Math.round((skrg - lalu) * 10) / 10; if (!d) return `<small class="dj-d">sama ${lab}</small>`;
  return `<small class="dj-d dj-d--${(d > 0) === naikBagus ? "ok" : "bahaya"}">${d > 0 ? "▲" : "▼"} ${koma(Math.abs(d))}${satuan} ${lab}</small>`;
}

/** Grafik garis kumulatif masuk vs selesai per hari. */
function htmlTren(js, r, now) {
  const d = H.deretHarian(js, r, now), cw = ($("#dj-root") || {}).clientWidth || 340, hpx = innerWidth <= 760;
  const W = Math.max(260, Math.round(hpx ? cw - 52 : cw * 0.64 - 54)), T = 140, kiri = 26, mx = Math.max(4, ...d.map((x) => x.masuk)), n = Math.max(1, d.length - 1);
  const xy = (v, i) => `${(kiri + (i / n) * (W - kiri - 6)).toFixed(1)},${(T - 20 - (v / mx) * (T - 34)).toFixed(1)}`, akhir = d[d.length - 1] || { masuk: 0, selesai: 0 };
  return `<svg viewBox="0 0 ${W} ${T}" width="${W}" height="${T}" class="dj-svg" role="img" aria-label="Tren kumulatif job masuk dan selesai">
    ${[0, 1, 2, 3].map((g) => `<line x1="${kiri}" x2="${W}" y1="${T - 20 - (g * (T - 34)) / 3}" y2="${T - 20 - (g * (T - 34)) / 3}" stroke="var(--border)"/><text x="0" y="${T - 17 - (g * (T - 34)) / 3}" font-size="9" fill="var(--muted)">${Math.round((g * mx) / 3)}</text>`).join("")}
    ${d.length > 1 ? `<polyline fill="none" stroke="var(--sky)" stroke-width="2.5" stroke-linejoin="round" points="${d.map((x, i) => xy(x.masuk, i)).join(" ")}"><title>Masuk</title></polyline><polyline fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linejoin="round" points="${d.map((x, i) => xy(x.selesai, i)).join(" ")}"><title>Selesai</title></polyline>` : ""}
    <text x="${kiri}" y="${T - 4}" font-size="9" fill="var(--muted)">${pBln(r[0])}</text><text x="${W - 4}" y="${T - 4}" text-anchor="end" font-size="9" fill="var(--muted)">${d.length ? pBln(d[d.length - 1].k) : ""}</text></svg>
    <div class="dj-lg"><span><i style="background:var(--sky)"></i>Masuk ${akhir.masuk}</span><span><i style="background:var(--success)"></i>Selesai ${akhir.selesai}</span></div>`;
}
function htmlUsiaStatus(js, r, now) {
  const u = H.usiaBacklog(js, now), mx = Math.max(1, ...u.map((x) => x.n)), st = H.hitungStatus(js, r, now), tot = Math.max(1, st.selesai + st.proses + st.tunggu + st.terlambat);
  const wr = ["var(--sky)", "var(--sky)", "var(--accent)", "var(--danger)"];
  return `<div class="dj-usia" role="img" aria-label="Usia job aktif">${u.map((x, i) => `<div title="${x.n} job aktif berusia ${x.l}"><b>${x.n}</b><i style="height:${Math.max(3, (x.n / mx) * 56)}px;background:${wr[i]}"></i><small>${x.l}</small></div>`).join("")}</div>
    <h3 style="margin-top:14px">Status job</h3><div class="dj-bar dj-bar--tebal">${[["selesai", "var(--success)"], ["proses", "var(--sky)"], ["tunggu", "var(--accent)"], ["terlambat", "var(--danger)"]].map(([k, w]) => `<i style="width:${(st[k] / tot) * 100}%;background:${w}"></i>`).join("")}</div>
    <div class="dj-lg dj-lg--w"><span><i style="background:var(--success)"></i>Selesai ${st.selesai}</span><span><i style="background:var(--sky)"></i>Dikerjakan ${st.proses}</span><span><i style="background:var(--accent)"></i>Tertunda ${st.tunggu}</span><span><i style="background:var(--danger)"></i>Terlambat ${st.terlambat}</span></div>`;
}
function htmlTabel(judul, kolom, baris, aksi, dipilih, total) {
  return `<section class="mr-kartu dj-kartu"><h3>${judul}</h3><div class="dj-tw"><table class="dj-tbl"><thead><tr>${kolom.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
    ${baris.length ? baris.map((b) => `<tr class="${dipilih === b.nama ? "is-aktif" : ""}" data-dj="${aksi}" data-v="${e(b.nama)}" tabindex="0"><td>${e(b.nama)}</td>${b.sel.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${kolom.length}" class="mr-sub">Belum ada data di periode ini.</td></tr>`}
    ${total ? `<tr class="dj-tot"><td>${total[0]}</td>${total[1].map((c) => `<td>${c}</td>`).join("")}</tr>` : ""}</tbody></table></div></section>`;
}

function htmlPerforma(now) {
  const r = rentangAktif(), p = periodeAktif(), js = tampak(), k = H.hitungKpi(js, r, now), pr = H.hitungKpi(js, H.rentangSebelum(p, r), now), lab = labelPembanding(r, p);
  const sr = H.seriKpi(js, r, now), orang = H.perDetail(js, "pic", r, now), kat = H.perDetail(js, "kategori", r, now);
  const kpi = (judul, nilai, ket, aksi, seri, warna, dl = "") => `<button type="button" class="dj-kpi" data-dj="${aksi}" title="${e(judul + ": " + ket)}"><span>${judul}</span><b>${nilai}</b>${spark(seri, warna)}<small>${ket}</small>${dl}</button>`;
  const persen = (v) => (v == null ? "–" : v + "%"), hr = (v) => (v == null ? "–" : koma(v));
  return `<div id="dj-dash"><div class="dj-kpis">
    ${kpi("Job selesai", k.selesai, `dari ${k.masuk} masuk${k.persenSelesai != null ? ` (${k.persenSelesai}%)` : ""}`, "k-selesai", sr.selesai, "var(--success)", delta(k.selesai, pr.selesai, "", true, lab))}
    ${kpi("Tepat waktu", persen(k.persenTepat), `${k.tepat} dari ${k.selesai} selesai`, "k-selesai", sr.tepat, "var(--sky)", delta(k.persenTepat, pr.persenTepat, "%", true, lab))}
    ${kpi("Rata-rata selesai", k.rataHari == null ? "–" : koma(k.rataHari) + " hr", "masuk sampai selesai", "k-selesai", sr.rata, "var(--accent)", delta(k.rataHari, pr.rataHari, " hr", false, lab))}
    ${kpi("Terlambat", k.terlambat, `backlog ${k.backlog} job`, "k-telat", sr.telat, "var(--danger)")}</div>
  <div class="dj-grid2e">${htmlTabel("Performa per orang", ["PIC", "Sel", "Tepat", "Rata", "Aktif", "Telat"], orang.map((o) => ({ nama: o.nama, sel: [o.selesai, persen(o.persenTepat), hr(o.rataHari), o.backlog, o.terlambat ? `<b class="dj-merah">${o.terlambat}</b>` : 0] })), "pic", S.fPic, ["Tim", [k.selesai, persen(k.persenTepat), hr(k.rataHari), k.backlog, k.terlambat ? `<b class="dj-merah">${k.terlambat}</b>` : 0]])}
  ${htmlTabel("Per kategori", ["Kategori", "Masuk", "Sel", "Rata hr", "Telat"], kat.map((o) => ({ nama: o.nama, sel: [o.masuk, o.selesai, hr(o.rataHari), o.terlambat ? `<b class="dj-merah">${o.terlambat}</b>` : 0] })), "kat", S.fKat)}</div>
  <div class="dj-grid2"><section class="mr-kartu dj-kartu"><h3>Tren kumulatif · masuk vs selesai</h3>${htmlTren(js, r, now)}</section>
  <section class="mr-kartu dj-kartu"><h3>Usia job aktif</h3>${htmlUsiaStatus(js, r, now)}</section></div></div>`;
}

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const warnaPic = (n) => { let h = 0; for (const c of String(n || "-")) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},62%,68%)`; };
const avatar = (n) => `<span class="dj-av" style="background:${warnaPic(n)}" title="${e(n || "Tanpa PIC")}">${e((n || "?")[0].toUpperCase())}</span>`;
const MASALAH = [["telat", "Terlambat"], ["hari", "Hari ini"], ["tunggu", "Tertunda"], ["tanpa", "Tanpa target"]];
const STATUS_DJ = [["aktif", "Aktif"], ["tunggu", "Tertunda"], ["selesai", "Selesai"], ["batal", "Dibatalkan"]];
const PERIODE_DJ = [["semua", "Semua"], ["bulan", "Bulan ini"], ["tahun", "Tahun ini"], ["rentang", "Rentang"]];
const COCOK = { aktif: H.aktif, tunggu: (j) => j.status === "tunggu", selesai: (j) => j.status === "selesai", batal: (j) => j.status === "batal" };
const PER_HAL = 15, pilihAktif = () => S.modePilih || S.pilih.size > 0, layarHp = () => matchMedia("(max-width: 760px)").matches;
const bukanBawaanDaftar = () => S.pDaftar !== "semua" || !!S.fPic || !!S.fKat || !!S.masalah;

/** Daftar job: saring (status, PIC, kategori, periode job dibuat, cari), urut menurut target (terbaru dulu), lalu potong per halaman. */
function dataDaftar(now) {
  const cari = S.cari.trim().toLowerCase(), pr = H.rentangDaftar(S.pDaftar, now, S.pDari, S.pSampai), arah = S.urut === "baru" ? -1 : 1, kunci = H.kunciTambah;
  const dasar = jobsKel().filter((j) => (!S.fPic || j.pic === S.fPic) && (!S.fKat || j.kategori === S.fKat) && (!pr || H.dalam(j.tglMasuk || j.dibuatPada, pr)));
  const trk = profilAktif() === "tracking", n = Object.fromEntries((trk ? ANTRE : STATUS_DJ).map(([k]) => [k, dasar.filter((j) => (trk ? cocokAntre(j, k, now) : COCOK[k](j))).length]));
  const l = dasar.filter((j) => (trk ? cocokAntre(j, S.antre, now) : (COCOK[S.status] || COCOK.aktif)(j))).filter((j) => !S.masalah || H.masalahJob(j, now).includes(S.masalah))
    .filter((j) => !cari || [j.judul, j.customer, j.pic, j.kategori, j.deskripsi, ...(trk ? ["noDo", "kontainer", "plat", "vendor", "driver"].map((f) => TR.rinci(j)[f]) : [])].join(" ").toLowerCase().includes(cari))
    .sort((a, b) => (trk ? Number(!!alasanTr(b, now)) - Number(!!alasanTr(a, now)) : 0) || arah * kunci(a).localeCompare(kunci(b))); // Tracking: yang perlu tindakan di atas
  const jml = Math.max(1, Math.ceil(l.length / PER_HAL)), hal = Math.min(S.hal, jml - 1);
  return { l, n, hal, jml, halaman: l.slice(hal * PER_HAL, (hal + 1) * PER_HAL) };
}

const cbx = (on, dj, id, v) => `<input type="checkbox" data-dj="${dj}" ${id ? `data-id="${e(id)}"` : ""} ${v ? `data-v="${e(v)}"` : ""} ${on ? "checked" : ""} aria-label="${dj === "cb-semua" ? "Pilih semua di halaman ini" : "Pilih job"}">`;
const tglPendek = (j) => (j.tglTarget ? fmtTgl(j.tglTarget).replace(/ \d{4}$/, "") : "–");
const badgeTarget = (j, now) => { const l = H.labelTarget(j, now); return `<span class="dj-chip dj-chip--${l.k || "info"}">${e(l.t)}</span>`; };
const infoJob = (j) => (j.status === "tunggu" ? ' <span class="dj-chip dj-chip--warn">Tertunda</span>' : "") + (j.review && j.review.nilai === "revisi" && H.aktif(j) ? ' <span class="dj-rev">Perlu revisi</span>' : "");
/** Satu tombol ⋯ per job (posisi tetap, tanpa layout bergeser); aksi muncul di menu kecil. */
function menuJob(j, naik) {
  const bukaM = S.menu === j.id, item = ([a, i, t, k]) => `<button type="button" role="menuitem" class="dj-mn__i${k ? " dj-mn__i--" + k : ""}" data-dj="${a}" data-id="${e(j.id)}">${ikon(i, 15)} ${t}</button>`;
  return `<span class="dj-mw"><button type="button" class="mr-ikonbtn dj-more" data-dj="menu" data-id="${e(j.id)}" aria-haspopup="menu" aria-expanded="${bukaM}" title="Aksi" aria-label="Aksi job">${ikon("titik", 18)}</button>${bukaM ? `<div class="dj-mn${naik ? " naik" : ""}" role="menu">${[...(H.aktif(j) ? [["a-selesai", "cek", "Selesai"]] : []), ["a-ubah", "edit", "Ubah"], ["a-bagikan", "salin", "Bagikan"], ["a-hapus", "tong", "Hapus", "bahaya"]].map(item).join("")}</div>` : ""}</span>`;
}

/** Kartu job (HP): judul, customer dan kategori, PIC, target dan posisi; menu ⋯ di ujung. */
const svg = (d) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IK_ST = { telat: svg('<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>'), hari: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'), n: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'), ok: svg('<path d="M5 12l5 5 9-10"/>'), mu: svg('<path d="M6 6l12 12M18 6L6 18"/>') };
/** Kelas ikon status: telat, hari (jatuh tempo hari ini), ok (selesai), mu (batal), n (normal). */
const kelasSt = (j, now) => (j.status === "selesai" ? "ok" : j.status === "batal" ? "mu" : H.terlambat(j, now) ? "telat" : H.aktif(j) && j.tglTarget === now ? "hari" : "n");
const ikonSt = (j, now, kecil) => { const k = kelasSt(j, now); return `<span class="dj-ik dj-ik--${k}${kecil ? " dj-ik--k" : ""}" aria-hidden="true">${IK_ST[k]}</span>`; };
const chip = (k, t) => `<span class="dj-chip dj-chip--${k}">${t}</span>`;
/* Antrean Tracking (desain A, 24 Nov 2026): menggantikan status Aktif/Tertunda/Selesai. Fase turun dari tahap pengiriman. */
const ANTRE = [["aktif", "Semua aktif"], ["tindakan", "Perlu tindakan"], ["pod", "Tunggu POD"], ["selesai", "Selesai"]]; // ringkas (25 Nov 2026): tanpa Belum jalan, Di lapangan, Perlu dibayar
/** Fase satu pengiriman (belum, jalan, pod, bayar, selesai, batal); aturannya di daily-job-pod.js. Job lama tanpa tahap dianggap jalan. */
const faseTr = (j) => (j.status === "batal" || j.status === "selesai" ? j.status : TL.jenisTrailer(j) ? TL.fase(j) : TR.rinci(j).jenis === "distribusi" ? DZ.fase(j) : "jalan");
/** Alasan perlu tindakan (pertama yang cocok): { id, t, k } atau null. */
const alasanTr = (j, now) => { const x = TL.TINDAKAN.find(([id]) => cocokTind(j, id, now)); return x ? { id: x[0], t: x[1], k: x[2] } : null; };
const cocokAntre = (j, k, now) => { const f = faseTr(j), akt = H.aktif(j) && f !== "selesai"; return k === "aktif" ? akt : k === "tindakan" ? akt && !!alasanTr(j, now) : k === "selesai" ? !akt : akt && (k === "pod" ? f === "pod" || f === "bayar" : f === k); }; // Tunggu POD juga memuat yang menunggu bayar (POD belum kembali)
const chipJenis = (j) => { const k = TL.jenisTrailer(j) || (TR.rinci(j).jenis === "distribusi" ? "distribusi" : ""); return `<span class="dj-jn dj-jn--${k || "lain"}">${e(k === "distribusi" ? "Distribusi" : k ? TL.JENIS[k].nama : j.kategori || "–")}</span>`; };
const armadaTr = (j) => { const r = TR.rinci(j); return e((r.vendor && !/^internal$/i.test(r.vendor) ? r.vendor : "Internal") + (r.plat ? " · " + r.plat : "")); };
const rpTr = (j) => (Number(TR.rinci(j).cost) ? "Rp " + Number(TR.rinci(j).cost).toLocaleString("id-ID") : "–");
const tandaTr = (j, now) => { if (profilAktif() !== "tracking") return ""; const a = alasanTr(j, now); return JL.perjalanan(j, now).berhenti ? " dj-u dj-u--bahaya" : a ? ` dj-u dj-u--${a.k}` : ""; };
const rute = (j) => (TR.rinci(j).berulang ? '<span class="dj-bu" title="Pengiriman berulang: customer, armada, unit, dan rute sama">↻</span> ' : "") + ruteDasar(j);
const ruteDasar = (j) => { const t = DZ.titikDari(j); if (t.length) { const p = t.find((x) => x.t === "P"), d = [...t].reverse().find((x) => x.t === "D"), lain = t.length - 2; return [p && (p.kota || p.nama), d && (d.kota || d.nama)].filter(Boolean).map(e).join(" → ") + (lain > 0 ? ` <small>+${lain} titik</small>` : ""); } const r = TR.rinci(j), lain = (r.tujuanLain || []).length; return [r.asal, r.tujuan].filter(Boolean).map(e).join(" → ") + (lain ? ` <small>+${lain} tujuan</small>` : "") || "–"; };
/** Isi tengah kartu HP menurut profil kelompok. */
function isiKartu(j, now) {
  if (profilAktif() === "tracking") { const a = alasanTr(j, now), r = TR.rinci(j); return `<div class="dj-job__isi"><span class="dj-job__a">${chipJenis(j)}<b>${e(j.customer || j.judul)}</b></span><small>${rute(j)}${r.noDo ? " · " + e(r.noDo) : ""}</small><span class="dj-job__st">${JL.htmlMini(j, now)}<span class="dj-kal dj-kal--${JL.perjalanan(j, now).jenis}">${e(JL.perjalanan(j, now).kalimat)}</span></span><span class="dj-job__pic">${a ? chip(a.k, e(a.t)) : ""}<small>${armadaTr(j)}</small>${infoJob(j)}</span></div>`; }
  return `<div class="dj-job__isi"><b>${e(j.judul)}</b><small>${[j.customer, katJob(j)].filter(Boolean).map(e).join(" · ")}</small><span class="dj-job__pic">${avatar(j.pic)}${e(j.pic || "–")}${infoJob(j)}</span></div>`;
}
/** Ikon tombol langkah cepat Distribusi. */
const IK_LK = { terkirim: "maju", pod: "file", bayar: "koin" };
function barisJob(j, now) {
  const ada = pilihAktif(), dz = profilAktif() === "tracking" && TR.rinci(j).jenis === "distribusi", lk = dz ? LK.langkahTersedia(j).slice(0, 2) : [];
  /* Distribusi: geser kanan = langkah berikut (Terkirim, POD kembali, Dibayar) atau Ubah bila tak ada; geser kiri = Ubah dan Hapus */
  const akt = dz ? (lk.length ? lk.map((l) => ["a-lk-" + l, IK_LK[l], LK.LANGKAH[l], "lk-" + l]) : [["a-ubah", "edit", "Ubah", "sky"]]) : [...(H.aktif(j) ? [["a-selesai", "cek", "Selesai", "ok"]] : []), ["a-ubah", "edit", "Ubah", "sky"], ["a-bagikan", "salin", "Bagikan", "info"]];
  const kiriLb = dz ? 74 : 62, kanan = dz ? [["a-ubah", "edit", "Ubah", "sky"], ["a-hapus", "tong", "Hapus", "bahaya"]] : [["a-hapus", "tong", "Hapus", "bahaya"]];
  const btn = ([a, i, t, w]) => `<button type="button" class="dj-sw__${w}" data-dj="${a}" data-id="${e(j.id)}">${ikon(i, 18)}<span>${t}</span></button>`;
  const panel = ada ? "" : `<div class="dj-sw dj-sw--kiri">${akt.map(btn).join("")}</div><div class="dj-sw dj-sw--kanan">${kanan.map(btn).join("")}</div>`;
  const buka = S.terbuka === j.id ? ` is-geser-${S.sisi}` : "";
  return `<div class="dj-rw${S.terbuka === j.id ? " is-buka" : ""}" data-wa="${ada ? 0 : akt.length * kiriLb}" data-wh="${ada ? 0 : kanan.length * 80}" style="--dj-wa:${akt.length * kiriLb}px;--dj-wh:${kanan.length * 80}px;--dj-bw:${kiriLb}px">${panel}<div class="dj-job2${S.pilih.has(j.id) ? " is-pilih" : ""}${buka}${tandaTr(j, now)}" data-dj="buka" data-id="${e(j.id)}" tabindex="0" role="button">${ada ? cbx(S.pilih.has(j.id), "cb", j.id) : profilAktif() === "tracking" ? "" : ikonSt(j, now)}
    ${isiKartu(j, now)}
    <div class="dj-job__t"><b>${tglPendek(j)}</b>${badgeTarget(j, now)}</div></div></div>`;
}

/** Tabel job (desktop): Job, Kategori, PIC, Target (tanggal + posisi), ⋯. Kotak centang hanya saat mode pilih. */
function htmlTabelJob(l, now) {
  const ada = pilihAktif(), semua = l.length > 0 && l.every((j) => S.pilih.has(j.id));
  return `<div class="mr-kartu dj-kartu dj-tbw"><table class="dj-tb"><thead><tr>${ada ? `<th class="dj-tb__c mr-th-cek">${cbx(semua, "cb-semua")}</th>` : `<th class="dj-tb__c"></th>`}<th>Job</th><th>Kategori</th><th>PIC</th><th>Target</th><th class="dj-tb__m"></th></tr></thead><tbody>
  ${l.map((j, i) => `<tr class="${S.pilih.has(j.id) ? "is-pilih" : ""}" data-dj="buka" data-id="${e(j.id)}" tabindex="0">${ada ? `<td class="dj-tb__c mr-td-cek">${cbx(S.pilih.has(j.id), "cb", j.id)}</td>` : `<td class="dj-tb__c"><button type="button" class="dj-cb0" data-dj="cb0" data-id="${e(j.id)}" title="Pilih job" aria-label="Pilih job"></button></td>`}
    <td><div class="dj-tb__j">${ikonSt(j, now, true)}<div><b>${e(j.judul)}</b><small>${e(j.customer || "")}${infoJob(j)}</small></div></div></td><td><span class="dj-chip dj-chip--info">${e(katJob(j) || "–")}</span></td>
    <td><span class="dj-pic">${avatar(j.pic)} ${e(j.pic || "–")}</span></td><td class="dj-tb__t"><span>${tglPendek(j)}</span>${badgeTarget(j, now)}</td><td class="dj-tb__m">${ada ? "" : menuJob(j, l.length > 3 && i >= l.length - 2)}</td></tr>`).join("")}</tbody></table></div>`;
}

const WARNA_ST = { aktif: "var(--sky)", tunggu: "var(--accent)", selesai: "var(--success)", batal: "var(--muted)" };
/** Tabel desktop Tracking: Jenis, Customer dan rute, DO dan kontainer, Armada, Tahap, Target, Perhatian, Cost. */
function htmlTabelTracking(l, now) {
  const ada = pilihAktif(), semua = l.length > 0 && l.every((j) => S.pilih.has(j.id));
  return `<div class="mr-kartu dj-kartu dj-tbw"><table class="dj-tb"><thead><tr>${ada ? `<th class="dj-tb__c mr-th-cek">${cbx(semua, "cb-semua")}</th>` : `<th class="dj-tb__c"></th>`}<th>Jenis</th><th>Customer · Rute</th><th>DO · Kontainer</th><th>Armada · Vendor</th><th>Tahap</th><th>Target</th><th>Perhatian · Langkah</th><th class="dj-tb__r">Cost</th><th class="dj-tb__m"></th></tr></thead><tbody>
  ${l.map((j, i) => { const r = TR.rinci(j), a = alasanTr(j, now); return `<tr class="${S.pilih.has(j.id) ? "is-pilih" : ""}${tandaTr(j, now)}" data-dj="buka" data-id="${e(j.id)}" tabindex="0">${ada ? `<td class="dj-tb__c mr-td-cek">${cbx(S.pilih.has(j.id), "cb", j.id)}</td>` : `<td class="dj-tb__c"><button type="button" class="dj-cb0" data-dj="cb0" data-id="${e(j.id)}" title="Pilih pengiriman" aria-label="Pilih pengiriman"></button></td>`}
    <td>${chipJenis(j)}</td><td><b>${e(j.customer || j.judul)}</b><small class="dj-tb__sb">${rute(j)}${infoJob(j)}</small></td><td>${e(r.noDo || "–")}<small class="dj-tb__sb">${e([r.kontainer, r.ukuran && r.ukuran + "′"].filter(Boolean).join(" · ") || r.jenisArmada || j.kategori || "")}</small></td><td>${armadaTr(j)}</td>
    <td class="dj-tb__st">${JL.htmlRel(j, now)}<small class="dj-tb__sb dj-kal--${JL.perjalanan(j, now).jenis}">${e(JL.perjalanan(j, now).kalimat)}</small></td><td class="dj-tb__t"><span>${tglPendek(j)}</span>${badgeTarget(j, now)}</td><td class="dj-tb__lk">${a ? chip(a.k, e(a.t)) : ""}${LK.langkahTersedia(j).map((l) => `<button type="button" class="mr-btn dj-lk dj-lk--${l}" data-dj="a-lk-${l}" data-id="${e(j.id)}">${ikon(IK_LK[l], 14)} ${LK.LANGKAH[l]}</button>`).join("")}${!a && !LK.langkahTersedia(j).length ? '<span class="mr-sub">–</span>' : ""}</td><td class="dj-tb__r">${rpTr(j)}</td><td class="dj-tb__m">${ada ? "" : menuJob(j, l.length > 3 && i >= l.length - 2)}</td></tr>`; }).join("")}</tbody></table></div>`;
}

/** Nomor halaman: ‹ 1 … 4 5 6 … 12 ›; halaman aktif terisi, satu baris, tombol bulat besar. */
function htmlPager(hal, jml) {
  const ada = new Set([0, jml - 1, hal - 1, hal, hal + 1].filter((x) => x >= 0 && x < jml)), nomor = [...ada].sort((a, b) => a - b), isi = [];
  nomor.forEach((x, i) => { if (i && x - nomor[i - 1] > 1) isi.push('<span class="dj-pg__t">…</span>'); isi.push(`<button type="button" class="dj-pg${x === hal ? " is-aktif" : ""}" data-dj="hal-ke" data-v="${x}" aria-label="Halaman ${x + 1}"${x === hal ? ' aria-current="page"' : ""}>${x + 1}</button>`); });
  return `<nav class="dj-pgs" aria-label="Halaman"><button type="button" class="dj-pg" data-dj="hal" data-v="-1" aria-label="Halaman sebelumnya"${hal <= 0 ? " disabled" : ""}>‹</button>${isi.join("")}<button type="button" class="dj-pg" data-dj="hal" data-v="1" aria-label="Halaman berikutnya"${hal >= jml - 1 ? " disabled" : ""}>›</button></nav>`;
}
const cocokTind = (j, id, now) => TL.cocokTindakan(j, id, now) || DZ.cocokTindakan(j, id, now);
function htmlDaftar(now) {
  const { l, n, halaman, hal, jml } = dataDaftar(now), ada = pilihAktif(), awal = hal * PER_HAL;
  const trk = profilAktif() === "tracking";
  const antrean = `<div class="dj-chips dj-antre" role="group" aria-label="Antrean pengiriman">${ANTRE.map(([k, t]) => `<button type="button" class="mr-chip${k === "tindakan" ? " dj-antre__w" : ""}${S.antre === k ? " is-aktif" : ""}" data-dj="antre" data-v="${k}" aria-pressed="${S.antre === k}">${t} <span>${n[k]}</span></button>`).join("")}</div>`;
  const subChip = S.sub ? `<div class="dj-chips"><button type="button" class="mr-chip is-aktif" data-dj="sub" data-v="" aria-label="Lepas subdivisi">${e(TR.SUBDIVISI[S.sub].nama)} ${ikon("tutup", 12)}</button></div>` : "";
  const chipStatus = `<div class="dj-chips" role="group" aria-label="Status job">${STATUS_DJ.map(([k, t]) => `<button type="button" class="mr-chip${S.status === k ? " is-aktif" : ""}" data-dj="st" data-v="${k}" aria-pressed="${S.status === k}"><i class="dj-st__t" style="background:${WARNA_ST[k]}"></i>${t} <span>${n[k]}</span></button>`).join("")}${S.masalah ? `<button type="button" class="mr-chip is-aktif" data-dj="masalah-hapus" aria-label="Hapus saringan">${e(Object.fromEntries(MASALAH)[S.masalah])} ${ikon("tutup", 12)}</button>` : ""}</div>`;
  const isi = !l.length ? `<div class="mr-kartu dj-kartu"><p class="mr-sub">${trk ? "Tidak ada pengiriman di antrean ini. Ketuk + untuk mencatat pengiriman baru." : "Tidak ada job pada filter ini. Ketuk + untuk mencatat job baru."}</p></div>` : layarHp() ? `<div class="dj-lst">${halaman.map((j) => barisJob(j, now)).join("")}</div>` : profilAktif() === "tracking" ? htmlTabelTracking(halaman, now) : htmlTabelJob(halaman, now);
  const nav = l.length ? `<div class="dj-hal"><span class="mr-sub dj-hal__i">${awal + 1}–${awal + halaman.length} dari ${l.length} job · ${S.urut === "baru" ? "terbaru dulu" : "terlama dulu"}</span>${jml > 1 ? htmlPager(hal, jml) : ""}</div>` : "";
  return (trk ? antrean + subChip : chipStatus) + isi + nav;
}

/* ---------- detail job (desain B): berkas dan pratinjau jadi fokus, review kepala divisi, ubah target, tautan bagikan ---------- */
/** Tingkat penetap target: master 4 > admin 3 > kepala divisi 2 > anggota 1. Yang lebih rendah tidak bisa mengubah target yang ditetapkan tingkat lebih tinggi. */
const LABEL_TINGKAT = { 1: "anggota", 2: "kepala divisi", 3: "admin", 4: "master" };
const tingkatSaya = (kid) => { const I = window.__ISL || {}; return I.master ? 4 : I.admin ? 3 : ((S.kelompok.find((k) => k.id === kid) || {}).kepala || []).includes(S.u.uid) ? 2 : 1; };
const bolehUbahTarget = (j) => tingkatSaya(j.kelompokId) >= (j.targetTingkat || 1);
const adalahKepala = (j) => S.kelola || ((S.kelompok.find((k) => k.id === j.kelompokId) || {}).kepala || []).includes(S.u.uid);
const berkasJob = (j) => (j.file || []).map((f, i) => ({ ...f, i, tp: tipeBerkas(f.nama, f.tipe) }));
const waktuTeks = (w) => { const d = new Date(typeof w === "number" ? w : Date.parse(w)); return isNaN(d) ? "" : d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", ":"); };
const jobDetail = () => (S.detail ? jobId(S.detail.id) : null);

function htmlKopDetail(j, now) {
  const kep = adalahKepala(j), lab = H.labelTarget(j, now), rv = j.review && j.review.nilai;
  return `<div class="dj-dk"><button type="button" class="mr-btn dj-ib" data-dj="d-tutup" title="Kembali ke daftar" aria-label="Kembali">${ikon("kembali", 16)}</button><h2 class="dj-dk__t" title="${e(j.judul)}">${e(j.judul)}</h2>
    <button type="button" class="mr-btn dj-ib" data-dj="a-ubah" data-id="${e(j.id)}" title="Ubah" aria-label="Ubah">${ikon("edit", 16)}</button><button type="button" class="mr-btn dj-ib" data-dj="a-bagikan" data-id="${e(j.id)}" title="Bagikan" aria-label="Bagikan">${ikon("salin", 16)}</button>
    ${H.aktif(j) ? `<button type="button" class="mr-btn dj-ib dj-ok" data-dj="a-selesai" data-id="${e(j.id)}" title="Tandai selesai" aria-label="Tandai selesai">${ikon("cek", 16)}</button>` : ""}<button type="button" class="mr-btn dj-ib dj-bhy" data-dj="a-hapus" data-id="${e(j.id)}" title="Hapus" aria-label="Hapus">${ikon("tong", 16)}</button></div>
  <div class="dj-dk__s"><span class="dj-chip dj-chip--${j.status === "selesai" ? "ok" : "info"}">${e(H.STATUS[j.status] || j.status)}${j.status === "tunggu" && j.alasanTunda ? ": " + e(j.alasanTunda) : ""}</span><button type="button" class="dj-chip dj-chip--${lab.k || "info"} dj-chip--btn" data-dj="d-target" title="${bolehUbahTarget(j) ? "Ubah target selesai" : "Target ditetapkan " + LABEL_TINGKAT[j.targetTingkat] + ". Hanya setingkat atau di atasnya yang bisa mengubah."}">${j.tglTarget ? "Target " + e(fmtTgl(j.tglTarget)) + " · " : ""}${e(lab.t)} ${ikon(bolehUbahTarget(j) ? "edit" : "tameng", 11)}${(j.targetTingkat || 1) > 1 ? ` <small>oleh ${LABEL_TINGKAT[j.targetTingkat]}</small>` : ""}</button>
    ${rv ? `<span class="dj-chip dj-chip--${rv === "setuju" ? "ok" : "bahaya"}">${rv === "setuju" ? "Disetujui" : "Perlu revisi"}</span>` : ""}<span class="mr-ruang"></span>${avatar(j.pic)}<small class="mu">${e(j.pic || "Tanpa PIC")}</small>${kep ? "" : ""}</div>`;
}
function htmlBerkasDetail(j) {
  const bl = berkasJob(j), d = S.detail, b = bl[d.berkas], boleh = !!(S.kelola || S.kelompokSaya);
  const daftar = bl.map((f) => `<button type="button" class="dj-fcard${f.i === d.berkas ? " is-aktif" : ""}" data-dj="d-berkas" data-i="${f.i}"><span class="dj-ft dj-ft--${f.tp}">${labelTipe(f.tp)}</span><span class="dj-fcard__n"><b>${e(f.nama)}</b><small>${[ukuranTeks(f.ukuran), f.oleh, f.tgl ? fmtTgl(f.tgl).replace(/ \d{4}$/, "") : ""].filter(Boolean).map(e).join(" · ")}</small></span></button>`).join("");
  const tautan = (j.tautan || []).map((x) => `<a class="dj-fcard dj-fcard--tl" href="${aman(x.url)}" target="_blank" rel="noopener"><span class="dj-ft dj-ft--lain">URL</span><span class="dj-fcard__n"><b>${e(x.nama || x.url)}</b><small>Tautan luar, dibuka di tab baru</small></span></a>`).join("");
  return `<div class="dj-dt__f"><div class="dj-cap"><span>Berkas (${bl.length})</span>${boleh ? `<button type="button" class="mr-btn mr-btn--kecil" data-dj="d-unggah">${ikon("plus", 13)} Tambah</button><input type="file" id="dj-up" multiple hidden>` : ""}</div>${daftar || '<p class="mr-sub">Belum ada berkas. PIC dapat mengunggah hasil kerjanya di sini.</p>'}${tautan}</div>
  <div class="dj-vw${d.kertas === "putih" ? " dj-vw--putih" : ""}" data-gelap="${temaGelap() ? 1 : 0}"><div class="dj-vw__bar"><span class="dj-vw__n">${b ? e(b.nama) : "Pratinjau"}</span><span class="mr-ruang"></span>${b ? `<button type="button" class="mr-btn dj-ib dj-vw__tg" data-dj="d-kertas" title="Kertas: ikut tema atau putih" aria-label="Kertas ikut tema atau putih">${ikon("tema", 15)}</button><a class="mr-btn dj-ib" href="${aman(b.url)}" target="_blank" rel="noopener" download title="Unduh berkas" aria-label="Unduh berkas">${ikon("download", 15)}</a>` : ""}</div><div id="dj-vw" class="dj-vw__isi">${b ? "" : `<div class="dj-pv__kosong"><p class="mr-sub">Pilih berkas untuk melihat pratinjaunya tanpa mengunduh.</p></div>`}</div></div>`;
}
function htmlInfoDetail(j) {
  const kv = (k, v) => `<div><span>${k}</span><b>${v || "–"}</b></div>`;
  if (profilKel(j.kelompokId) === "tracking") { const r = TR.rinci(j), cost = r.cost ? "Rp" + Number(r.cost).toLocaleString("id-ID") : "";
    const trl = htmlTrailerDetail(j, !S.lihatSaja, H.hariIni()) + htmlDistribusiDetail(j, !S.lihatSaja, H.hariIni()), tambah = TL.jenisTrailer(j) ? kv("Kontainer", e([r.kontainer, r.ukuran && r.ukuran + "′"].filter(Boolean).join(" · "))) + kv("Tanggal transfer vendor", e(fmtTgl(r.tglBayar))) : "";
    return trl + `<div class="mr-kartu dj-kartu dj-info"><div class="dj-kv">${kv("Customer", e(j.customer))}${kv("Rute", rute(j))}${tambah}${kv(r.dokNomor ? "Dokumen" : "No. DO", e(r.dokNomor ? r.dokNomor.map((x) => `${x.jenis} ${x.no}`).join("; ") : r.noDo))}${kv("Armada", e([j.kategori, r.plat].filter(Boolean).join(" · ")))}${kv("Vendor", e(r.vendor || "Internal"))}${kv("Driver", e([r.driver, r.telp].filter(Boolean).join(" · ")))}${kv("Pembayaran · Cost", e([TR.BAYAR[r.bayar], cost].filter(Boolean).join(" · ")))}${kv("Kirim", e(fmtTgl(r.tglKirim)))}${kv("Target tiba", e(fmtTgl(j.tglTarget)))}${kv("POD", r.pod === "kembali" ? "Kembali " + e(fmtTgl(r.tglPod)) : "Belum kembali")}${TR.rinci(j).jenis ? "" : kv("Tagihan vendor", e(TR.TAGIHAN[r.tagihan || "belum"]))}${kv("PIC", e(j.pic))}</div>${j.deskripsi ? `<p class="dj-desk">${e(j.deskripsi)}</p>` : ""}</div>`; }
  return `<div class="mr-kartu dj-kartu dj-info"><div class="dj-kv">${kv("Customer", e(j.customer))}${kv("Kategori", e(katJob(j)))}${kv("Masuk", e(fmtTgl(j.tglMasuk)))}${kv(j.status === "selesai" ? "Selesai" : "Mulai", e(fmtTgl(j.status === "selesai" ? j.tglSelesai : j.tglMulai)))}${kv("Prioritas · Bobot", e((H.PRIORITAS[j.prioritas] || "–") + " · " + (H.BOBOT[j.bobot] || "–")))}${kv("Kelompok", e(namaKel(j.kelompokId)))}</div>${j.deskripsi ? `<p class="dj-desk">${e(j.deskripsi)}</p>` : ""}</div>`;
}
function entriThread(j) {
  const a = (S.detail.aktivitas || []).map((x) => ({ ...x })), lama = (j.catatan || []).map((c, i) => ({ id: "c" + i, jenis: "komentar", oleh: c.oleh, teks: c.teks, waktu: Date.parse(c.tgl) || 0, peran: "", lama: true }));
  return [...lama, ...a].sort((x, y) => (+x.waktu || 0) - (+y.waktu || 0));
}
function htmlThread(j) {
  const l = entriThread(j); if (S.detail.muat) return `<p class="mr-sub">Memuat komentar…</p>`;
  const peran = { kepala: "Kepala divisi", anggota: "Anggota" };
  return (S.detail.galat ? `<p class="mr-sub">${e(S.detail.galat)}</p>` : "") + (l.length ? l.map((x) => x.jenis === "target"
    ? `<div class="dj-lg-t">Target diubah <b>${e(fmtTgl(x.dari))} → ${e(fmtTgl(x.ke))}</b> oleh ${e(x.oleh)}${x.alasan ? ` · alasan: ${e(x.alasan)}` : ""} <small>${e(waktuTeks(x.waktu))}</small></div>`
    : `<div class="dj-cm${x.peran === "kepala" ? " dj-cm--k" : ""}">${avatar(x.oleh)}<div class="dj-cm__b"><small><b>${e(x.oleh || "")}</b>${x.peran ? ` · ${peran[x.peran] || ""}` : x.lama ? " · catatan progres" : ""} · ${e(waktuTeks(x.waktu))}${x.nilai ? ` <span class="dj-chip dj-chip--${x.nilai === "setuju" ? "ok" : "bahaya"}">${x.nilai === "setuju" ? "Disetujui" : "Perlu revisi"}</span>` : ""}</small><span class="dj-cm__t">${e(x.teks)}</span></div></div>`).join("") : `<p class="mr-sub">Belum ada komentar. Kepala divisi dapat menilai hasil kerja di sini.</p>`);
}
function htmlKomposer(j) {
  const kep = adalahKepala(j), n = S.detail.nilai;
  return `<div class="dj-kmp">${kep ? `<div class="dj-kmp__n" role="group" aria-label="Penilaian">${[["", "Komentar"], ["setuju", "Setujui"], ["revisi", "Perlu revisi"]].map(([k, t]) => `<button type="button" class="dj-chip dj-chip--btn${n === k ? " is-aktif" : ""}${k === "setuju" ? " dj-chip--ok" : k === "revisi" ? " dj-chip--bahaya" : ""}" data-dj="d-nilai" data-v="${k}">${t}</button>`).join("")}</div>` : ""}
    <div class="dj-kmp__i"><textarea id="djc-teks" rows="1" maxlength="2000" placeholder="${kep ? "Tulis penilaian atau komentar…" : "Tulis komentar atau balasan…"}" aria-label="Komentar"></textarea><button type="button" class="mr-btn mr-btn--utama dj-ib" data-dj="d-kirim" title="Kirim" aria-label="Kirim">${ikon("maju", 16)}</button></div></div>`;
}
function htmlKananDetail(j) {
  return `${htmlInfoDetail(j)}<div class="mr-kartu dj-kartu dj-rv"><div class="dj-cap"><span>Review dan komentar</span></div><div id="dj-thread" class="dj-thread">${htmlThread(j)}</div>${htmlKomposer(j)}</div>`;
}
function htmlDetail(now) {
  const j = jobDetail(); if (!j) { S.detail = null; return ""; }
  return `<div class="dj-dt"><div id="dj-dt-kop" class="dj-dt__kop">${htmlKopDetail(j, now)}</div><div class="dj-dt__tengah">${htmlBerkasDetail(j)}</div><div id="dj-dt-kanan" class="dj-dt__kanan">${htmlKananDetail(j)}</div></div>`;
}
function muatPratinjau() {
  const d = S.detail, j = jobDetail(), el = $("#dj-vw"); if (!d || !j || !el) return;
  const b = berkasJob(j)[d.berkas]; if (b) tampilkanPratinjau(el, { url: b.url, nama: b.nama, mime: b.tipe, unduh: true });
}
const segarkanKop = () => { const j = jobDetail(), el = $("#dj-dt-kop"); if (j && el) el.innerHTML = htmlKopDetail(j, H.hariIni()); };
const segarkanKanan = () => { const j = jobDetail(), el = $("#dj-dt-kanan"); if (j && el) { const t = ($("#djc-teks") || {}).value || ""; el.innerHTML = htmlKananDetail(j); const n = $("#djc-teks"); if (n) n.value = t; } };
async function bukaDetail(id) {
  if (!jobId(id)) return;
  S.detail = { id, aktivitas: [], berkas: 0, kertas: "ikut", nilai: "", muat: true }; S.tab = "job"; render(); scrollTo(0, 0);
  try { const r = await getDocs(query(collection(db, "dj_job", id, "aktivitas"), orderBy("waktu"))); if (S.detail && S.detail.id === id) S.detail.aktivitas = r.docs.map((d) => ({ id: d.id, ...d.data() })); }
  catch (err) { console.warn(err); if (S.detail) S.detail.galat = "Komentar belum bisa dimuat (aturan server belum dipasang?)."; }
  if (S.detail && S.detail.id === id) { S.detail.muat = false; segarkanKanan(); }
}
async function kirimKomentar() {
  const j = jobDetail(), d = S.detail; if (!j) return;
  const teks = (($("#djc-teks") || {}).value || "").trim(), nilai = adalahKepala(j) ? d.nilai : ""; if (!teks && !nilai) return toast("Tulis komentar atau pilih penilaian.", "bahaya");
  const x = { uid: S.u.uid, oleh: S.u.nama || S.u.email, peran: adalahKepala(j) ? "kepala" : "anggota", jenis: "komentar", teks, nilai, waktu: Date.now() };
  try {
    await setDoc(doc(db, "dj_job", j.id, "aktivitas", uid()), x);
    if (nilai) { const review = { nilai, oleh: x.oleh, waktu: x.waktu }; await updateDoc(doc(db, "dj_job", j.id), { review, diubah: serverTimestamp() }); j.review = review; }
    d.aktivitas.push(x); d.nilai = ""; segarkanKanan(); segarkanKop(); toast(nilai ? "Penilaian tersimpan." : "Komentar terkirim.");
  } catch (err) { console.error(err); toast("Belum terkirim: " + e(err.message || err), "bahaya"); }
}
/** Pesan galat unggah yang bisa ditindaklanjuti (kode Storage diterjemahkan). */
const pesanUnggah = (err) => (err && err.code === "storage/unauthorized" ? "Tidak diizinkan mengunggah. Pastikan akun masuk kelompok Daily Job ini; file maks. 4 MB (gambar, PDF, Word, Excel, PowerPoint, CSV, ZIP)." : e((err && (err.message || err.code)) || err));
async function unggahBerkas(files) {
  const j = jobDetail(); if (!j || !files.length) return; toast(`Mengunggah ${files.length} berkas…`, "info");
  try {
    const baru = [];
    for (const f of files) { const path = `dailyjob/${j.kelompokId}/${j.id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`; baru.push({ nama: f.name, path, url: await unggahBlob(path, f, f.type || "application/octet-stream"), ukuran: f.size, tipe: f.type || "", oleh: S.u.nama || S.u.email, tgl: H.hariIni() }); }
    const file = [...(j.file || []), ...baru]; await updateDoc(doc(db, "dj_job", j.id), { file, diubah: serverTimestamp() }); j.file = file; S.detail.berkas = file.length - 1; segarkanTautan(j); render(); toast("Berkas tersimpan.");
  } catch (err) { console.error(err); toast("Belum terunggah: " + pesanUnggah(err), "bahaya"); }
}
function panelTarget(id) {
  const j = jobId(id); if (!j) return; const kep = adalahKepala(j);
  if (!bolehUbahTarget(j)) return toast(`Target ini sudah ditetapkan oleh ${LABEL_TINGKAT[j.targetTingkat]}. Hanya ${LABEL_TINGKAT[j.targetTingkat]} atau yang lebih tinggi yang bisa mengubahnya.`, "bahaya");
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Ubah target selesai</h2><p class="mr-sub">${e(j.judul)}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form" style="grid-template-columns:1fr"><label class="mr-f"><span>Target baru</span><input type="date" id="djt-tgl" value="${e(j.tglTarget || "")}"></label>
  <label class="mr-f"><span>Alasan ${kep ? "<small>(opsional)</small>" : "*"}</span><textarea id="djt-alasan" rows="2" maxlength="300" placeholder="mis. menunggu revisi dari customer"></textarea></label></div></div>
  <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="target-simpan" data-id="${e(id)}">Simpan</button></footer>`);
}
async function simpanTarget(id) {
  const j = jobId(id), baru = ($("#djt-tgl") || {}).value, alasan = (($("#djt-alasan") || {}).value || "").trim(); if (!j || !baru) return toast("Isi tanggal target.", "bahaya");
  if (baru === j.tglTarget) return tutupLayer(); if (!adalahKepala(j) && !alasan) return toast("Isi alasan perubahan target.", "bahaya");
  const x = { uid: S.u.uid, oleh: S.u.nama || S.u.email, peran: adalahKepala(j) ? "kepala" : "anggota", jenis: "target", dari: j.tglTarget || "", ke: baru, alasan, waktu: Date.now() };
  try { await setDoc(doc(db, "dj_job", id, "aktivitas", uid()), x); const tk = tingkatSaya(j.kelompokId); await updateDoc(doc(db, "dj_job", id), { tglTarget: baru, targetTingkat: tk, diubah: serverTimestamp() }); j.tglTarget = baru; j.targetTingkat = tk; if (S.detail && S.detail.id === id) S.detail.aktivitas.push(x); segarkanTautan(j); tutupLayer(); segarkanKop(); segarkanKanan(); render_tanpaDetail(); toast("Target diperbarui dan tercatat di riwayat."); }
  catch (err) { console.error(err); toast("Belum tersimpan: " + e(err.message || err), "bahaya"); }
}
const render_tanpaDetail = () => { if (!S.detail) render(); };

/* ---------- tautan bagikan tanpa login (lihat saja) ---------- */
const urlTautan = (t) => `${location.origin}/job.html?t=${t}`;
const tokenAcak = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return [...a].map((b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join(""); };
const snapshotJob = (j) => ({ judul: j.judul, kategori: j.kategori || "", customer: j.customer || "", pic: j.pic || "", status: j.status, tglMasuk: j.tglMasuk || null, tglMulai: j.tglMulai || null, tglTarget: j.tglTarget || null, tglSelesai: j.tglSelesai || null, deskripsi: j.deskripsi || "",
  file: (j.file || []).map((f) => ({ nama: f.nama, url: f.url, ukuran: f.ukuran || 0, tipe: f.tipe || "" })), tautan: (j.tautan || []).map((x) => ({ url: x.url, nama: x.nama || "" })) });
/** Perbarui isi tautan bila job berubah (hanya kalau tautannya aktif). Gagal diam-diam: tautan lama tetap berlaku. */
function segarkanTautan(j) { if (j && j.bagikan && j.bagikan.token) updateDoc(doc(db, "dj_bagikan", j.bagikan.token), { snapshot: snapshotJob(j), diubah: Date.now() }).catch((err) => console.warn("Tautan belum diperbarui:", err)); }
function panelBagikan(id) {
  const j = jobId(id); if (!j) return; const b = j.bagikan && j.bagikan.berlakuSampai > Date.now() ? j.bagikan : null;
  const sampai = b ? new Date(b.berlakuSampai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Bagikan job</h2><p class="mr-sub">${e(j.judul)}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="dj-bg"><div class="dj-bg__r"><span><b>Tautan tanpa login</b><small>Penerima melihat ringkasan dan pratinjau berkas. Hanya lihat, komentar internal tidak ikut.</small></span><button type="button" class="dj-sakelar${b ? " is-on" : ""}" data-dj="b-toggle" data-id="${e(id)}" role="switch" aria-checked="${!!b}" aria-label="Tautan tanpa login"><i></i></button></div>
  ${b ? `<label class="mr-f"><span>Berlaku sampai <small>${e(sampai)}</small></span><select data-dj="b-hari" data-id="${e(id)}"><option value="">Perpanjang…</option><option value="1">1 hari dari sekarang</option><option value="7">7 hari dari sekarang</option><option value="30">30 hari dari sekarang</option></select></label>
  <div class="dj-bg__r"><span><b>Boleh mengunduh berkas</b></span><button type="button" class="dj-sakelar${b.unduh ? " is-on" : ""}" data-dj="b-unduh" data-id="${e(id)}" role="switch" aria-checked="${!!b.unduh}" aria-label="Boleh mengunduh berkas"><i></i></button></div>
  <div class="dj-bg__u"><input readonly id="djb-url" value="${e(urlTautan(b.token))}" aria-label="Tautan"><button type="button" class="mr-btn dj-ib" data-dj="b-salin" title="Salin tautan" aria-label="Salin tautan">${ikon("salin", 16)}</button></div>
  <div class="dj-bg__a"><button type="button" class="mr-btn mr-btn--utama" data-dj="b-kirim" data-id="${e(id)}">${ikon("salin", 15)} Kirim tautan</button><button type="button" class="mr-btn dj-bhy" data-dj="b-cabut" data-id="${e(id)}">Cabut tautan</button></div>` : `<p class="mr-sub">Tautan baru berlaku 7 hari dan bisa dicabut kapan saja oleh master, admin, atau anggota kelompok.</p>`}</div></div>
  <footer class="mr-panel__kaki dj-kaki"><button class="mr-btn" data-dj="b-teks" data-id="${e(id)}">Bagikan sebagai teks</button><span class="mr-ruang"></span><button class="mr-btn mr-btn--utama" data-aksi="tutup-layer">Selesai</button></footer>`);
}
async function ubahTautan(id, aksi, v) {
  const j = jobId(id); if (!j) return;
  try {
    if (aksi === "buat") { const token = tokenAcak(), bagikan = { token, berlakuSampai: Date.now() + 7 * 864e5, unduh: true };
      await setDoc(doc(db, "dj_bagikan", token), { jobId: j.id, kelompokId: j.kelompokId, dibuatOleh: S.u.uid, aktif: true, berlakuSampai: bagikan.berlakuSampai, unduh: true, snapshot: snapshotJob(j), diubah: Date.now() });
      await updateDoc(doc(db, "dj_job", j.id), { bagikan, diubah: serverTimestamp() }); j.bagikan = bagikan; }
    else if (aksi === "cabut") { await updateDoc(doc(db, "dj_bagikan", j.bagikan.token), { aktif: false, diubah: Date.now() }); await updateDoc(doc(db, "dj_job", j.id), { bagikan: null, diubah: serverTimestamp() }); j.bagikan = null; }
    else { const bagikan = { ...j.bagikan }; if (aksi === "hari") bagikan.berlakuSampai = Date.now() + v * 864e5; else bagikan.unduh = !bagikan.unduh;
      await updateDoc(doc(db, "dj_bagikan", bagikan.token), { berlakuSampai: bagikan.berlakuSampai, unduh: bagikan.unduh, diubah: Date.now() }); await updateDoc(doc(db, "dj_job", j.id), { bagikan, diubah: serverTimestamp() }); j.bagikan = bagikan; }
    panelBagikan(id);
  } catch (err) { console.error(err); toast("Belum tersimpan: " + e(err.message || err), "bahaya"); }
}
async function kirimTautan(id) {
  const j = jobId(id); if (!j || !j.bagikan) return; const url = urlTautan(j.bagikan.token), teks = `*${j.judul}*\n${[j.kategori, j.customer].filter(Boolean).join(" · ")}\nPIC: ${j.pic || "-"} · Target: ${j.tglTarget ? fmtTgl(j.tglTarget) : "-"}\n${url}`;
  if (navigator.share) { try { await navigator.share({ title: j.judul, text: teks }); return; } catch (err) { if (err && err.name === "AbortError") return; } }
  window.open("https://wa.me/?text=" + encodeURIComponent(teks), "_blank", "noopener");
}

/** Profil isian tiap kelompok (marketing atau tracking): menentukan formulir, daftar, dan performa. */
function htmlProfilKel() {
  if (!S.kelompok.length) return "";
  return `<section class="mr-kartu dj-kartu"><h3>Profil kelompok</h3><p class="mr-sub">Profil menentukan formulir catat, kolom daftar, dan dashboard Performa kelompok itu.</p>${S.kelompok.map((k) => `<div class="dj-org"><span><b>${e(k.nama)}</b></span><span class="mr-ruang"></span><select data-dj="kel-profil" data-id="${e(k.id)}" aria-label="Profil ${e(k.nama)}">${opsi(Object.entries(TR.PROFIL), k.profil || "marketing")}</select></div>`).join("")}</section>`;
}
function htmlKelompok() {
  return (S.kelola ? htmlProfilKel() + htmlKelompokKelola() : "") + kepalaDi().map(htmlTim).join("") + (!S.kelola && !kepalaDi().length ? `<section class="mr-kartu dj-kartu"><p class="mr-sub">Hanya kepala divisi yang bisa mengurus tim.</p></section>` : "");
}
/** Master/admin: kategori (tambah, ubah nama, hapus), ajuan anggota, dan target hari kalender per kategori untuk satu kelompok. */
function htmlTargetKategori(kid) {
  const k = S.kelompok.find((x) => x.id === (kid || S.kelAtur)) || S.kelompok[0]; if (!k) return "";
  const tr = k.profil === "tracking", daftar = tr ? [...TR.SUBDIVISI.kecil.kategori, ...TR.SUBDIVISI.besar.kategori] : katDari(k.id);
  const baris = (kat) => `<div class="dj-tgtk__r"><span>${e(kat)}</span><input type="number" min="0" max="365" inputmode="numeric" data-dj="tgt-kat" data-k="${e(k.id)}" data-kat="${e(kat)}" value="${e((k.targetKategori || {})[kat] || "")}" placeholder="–" aria-label="Target ${e(kat)} (hari)"><small>hari</small>${tr ? "" : `<button type="button" class="mr-ikonbtn" data-dj="kat-ubah" data-k="${e(k.id)}" data-kat="${e(kat)}" aria-label="Ubah ${e(kat)}">${ikon("edit", 15)}</button><button type="button" class="mr-ikonbtn" data-dj="kat-hapus" data-k="${e(k.id)}" data-kat="${e(kat)}" aria-label="Hapus ${e(kat)}">${ikon("tong", 15)}</button>`}</div>`;
  return `${htmlAjuanKat()}<section class="mr-kartu dj-kartu"><h3>Kategori dan target</h3><p class="mr-sub">Master dan admin mengatur kategori. Anggota yang butuh kategori baru mengajukannya dari form job. Target job baru = tanggal masuk + hari kalender di bawah; kosong atau 0 = tanpa target otomatis.</p>
    ${kid ? "" : selF("kel-atur", "Kelompok", opsi(S.kelompok.map((x) => [x.id, x.nama]), k.id))}
    <div class="dj-tgtk">${daftar.map(baris).join("")}</div>
    ${tr ? `<p class="mr-sub">Kategori Tracking mengikuti subdivisi (tetap).</p>` : `<div class="dj-katbaru"><input id="dj-kat-set" maxlength="40" placeholder="Kategori baru" aria-label="Nama kategori baru"><button type="button" class="mr-btn mr-btn--utama" data-dj="kat-tambah" data-k="${e(k.id)}">${ikon("plus", 14)} Tambah</button></div>`}</section>`;
}
function htmlAjuanKat() {
  if (!S.ajuanKat.length) return "";
  return `<section class="mr-kartu dj-kartu"><h3>Ajuan kategori <span class="dj-bdg">${S.ajuanKat.length}</span></h3><p class="mr-sub">Job yang mengajukan tetap tersimpan; kategorinya resmi setelah disetujui. Bila ditolak, job pindah ke Lainnya.</p>${S.ajuanKat.map((a) => `<div class="dj-org"><span><b>${e(a.nama)}</b><small> ${e((kelById(a.kelompokId) || {}).nama || "")} · ${e(a.olehNama || "")}</small></span><span class="mr-ruang"></span><button type="button" class="mr-btn mr-btn--kecil" data-dj="ajuan-tolak" data-id="${e(a.id)}">Tolak</button><button type="button" class="mr-btn mr-btn--kecil mr-btn--utama" data-dj="ajuan-ok" data-id="${e(a.id)}">Setujui</button></div>`).join("")}</section>`;
}
const simpanKat = async (k, daftar, peta) => { const x = { kategori: daftar, ...(peta ? { targetKategori: peta } : {}) }; await updateDoc(doc(db, "dj_kelompok", k.id), x); Object.assign(k, x); };
const ubahJobKat = (js, x) => Promise.all(js.map((j) => updateDoc(doc(db, "dj_job", j.id), x).then(() => Object.assign(j, x))));
const galatKat = (err) => toast("Belum tersimpan: " + e(err.message || err), "bahaya");
function panelKat(judul, isi, tombol, aksi, data) {
  bukaLayer(`<header class="mr-panel__kepala"><h2>${judul}</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header><div class="mr-panel__isi"><div class="mr-form dj-form" style="grid-template-columns:1fr">${isi}</div></div><footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="${aksi}" ${data}>${tombol}</button></footer>`);
}
const jmlKat = (kid, kat) => S.jobs.filter((j) => j.kelompokId === kid && j.kategori === kat).length;
function panelUbahKat(t) {
  const n = jmlKat(t.dataset.k, t.dataset.kat);
  panelKat("Ubah kategori", `<label class="mr-f"><span>Nama kategori</span><input id="dj-kat-nama" maxlength="40" value="${e(t.dataset.kat)}"></label><p class="mr-sub">${n} job di kelompok ini ikut berganti nama. Target hari ikut pindah.</p>`, "Simpan", "kat-ubah-ok", `data-k="${e(t.dataset.k)}" data-kat="${e(t.dataset.kat)}"`);
}
function panelHapusKat(t) {
  const k = kelById(t.dataset.k), kat = t.dataset.kat, lain = katDari(k.id).filter((x) => x !== kat), n = jmlKat(k.id, kat);
  if (!lain.length) return toast("Minimal satu kategori harus ada.", "bahaya");
  panelKat("Hapus kategori", `<p class="mr-sub">Hapus <b>${e(kat)}</b> dari ${e(k.nama)}?</p>${n ? `<label class="mr-f"><span>Pindahkan ${n} job ke</span><select id="dj-kat-tujuan">${opsi(lain, lain.includes("Lainnya") ? "Lainnya" : lain[0])}</select></label>` : `<p class="mr-sub">Tidak ada job yang memakai kategori ini.</p>`}`, "Hapus", "kat-hapus-ok", `data-k="${e(k.id)}" data-kat="${e(kat)}"`);
}
async function ubahKat(t) {
  const k = kelById(t.dataset.k), lama = t.dataset.kat, baru = H.rapikanKategori(($("#dj-kat-nama") || {}).value, katDari(k.id));
  if (!baru) return toast("Isi nama kategori.", "bahaya"); if (baru === lama) return tutupLayer();
  t.disabled = true;
  try { await ubahJobKat(S.jobs.filter((j) => j.kelompokId === k.id && j.kategori === lama), { kategori: baru }); await simpanKat(k, H.daftarGantiNama(katDari(k.id), lama, baru), H.targetGantiNama(k.targetKategori, lama, baru)); tutupLayer(); render(); toast(`Kategori diubah menjadi ${baru}.`); } catch (err) { t.disabled = false; galatKat(err); }
}
async function hapusKat(t) {
  const k = kelById(t.dataset.k), kat = t.dataset.kat, tujuan = ($("#dj-kat-tujuan") || {}).value, js = S.jobs.filter((j) => j.kelompokId === k.id && j.kategori === kat);
  t.disabled = true;
  try { if (js.length) await ubahJobKat(js, { kategori: tujuan }); const peta = { ...(k.targetKategori || {}) }; delete peta[kat]; await simpanKat(k, katDari(k.id).filter((x) => x !== kat), peta); tutupLayer(); render(); toast(`Kategori ${kat} dihapus.`); } catch (err) { t.disabled = false; galatKat(err); }
}
async function tambahKat(t) {
  const k = kelById(t.dataset.k), inp = $("#dj-kat-set"), nama = H.rapikanKategori(inp.value, katDari(k.id));
  if (!nama) return toast("Isi nama kategori.", "bahaya"); if (katDari(k.id).includes(nama)) return toast("Kategori sudah ada.", "bahaya");
  try { await simpanKat(k, [...katDari(k.id), nama]); render(); toast(`Kategori ${nama} ditambahkan.`); } catch (err) { galatKat(err); }
}
/** Master/admin memutuskan ajuan: setuju = masuk daftar kategori kelompok; tolak = job pindah ke Lainnya. */
async function putusAjuan(id, setuju) {
  const a = S.ajuanKat.find((x) => x.id === id); if (!a) return; const k = kelById(a.kelompokId), js = S.jobs.filter((j) => j.kategoriAjuan === id);
  try {
    if (setuju) { if (k && !katDari(k.id).includes(a.nama)) await simpanKat(k, [...katDari(k.id), a.nama]); await ubahJobKat(js, { kategoriAjuan: null }); }
    else { const dft = k ? katDari(k.id) : [], alih = dft.includes("Lainnya") ? "Lainnya" : dft[0] || "Lainnya"; await ubahJobKat(js, { kategori: alih, kategoriAjuan: null }); }
    await deleteDoc(doc(db, "dj_kategori_ajuan", id)); S.ajuanKat = S.ajuanKat.filter((x) => x.id !== id); render(); toast(setuju ? `Kategori ${a.nama} disetujui.` : `Ajuan ${a.nama} ditolak.`);
  } catch (err) { galatKat(err); }
}
async function simpanTargetKat(inp) {
  const k = S.kelompok.find((x) => x.id === inp.dataset.k); if (!k) return;
  const n = Math.min(365, Math.max(0, Math.round(+inp.value) || 0)), peta = { ...(k.targetKategori || {}) }; if (n) peta[inp.dataset.kat] = n; else delete peta[inp.dataset.kat];
  try { await updateDoc(doc(db, "dj_kelompok", k.id), { targetKategori: peta }); k.targetKategori = peta; inp.value = n || ""; toast(`Target ${inp.dataset.kat}: ${n ? n + " hari" : "tanpa target otomatis"}.`); } catch (err) { toast("Belum tersimpan: " + e(err.message || err), "bahaya"); }
}
function htmlKelompokKelola() {
  const sempit = matchMedia("(max-width: 760px)").matches;
  const hit = (id) => S.akun.filter((a) => a.kelompokDJ === id).length;
  const akunList = S.akun.filter((a) => a.peran !== "dj");
  const kid = S.kelompok.some((k) => k.id === S.pilihKel) ? S.pilihKel : (S.kelompok[0] || {}).id || "";
  const baris = (k) => `<div class="dj-kel${k.id === kid ? " is-aktif" : ""}" data-dj="kel-pilih" data-id="${e(k.id)}"><span class="dj-kel__n"><b>${e(k.nama)}</b><small>${hit(k.id)} anggota · ${S.jobs.filter((j) => j.kelompokId === k.id).length} job</small></span><button class="mr-btn mr-btn--kecil" data-dj="kel-ubah" data-id="${e(k.id)}">Ubah</button><button class="mr-ikonbtn" data-dj="kel-hapus" data-id="${e(k.id)}" aria-label="Hapus kelompok">${ikon("tong", 15)}</button></div>`;
  const akunBaris = (a) => `<div class="dj-akun"><span>${e(a.nama || a.email)}<small> ${e(a.email)}</small></span>${a.kelompokDJ ? `<span class="dj-kep"><input type="checkbox" data-dj="kep-akun" data-id="${e(a.id)}" id="kep-${e(a.id)}" ${((S.kelompok.find((k) => k.id === a.kelompokDJ) || {}).kepala || []).includes(a.id) ? "checked" : ""}><label for="kep-${e(a.id)}">Kepala</label></span>` : ""}<select data-dj="kel-akun" data-id="${e(a.id)}" aria-label="Kelompok ${e(a.nama || a.email)}">${opsi(S.kelompok.map((k) => [k.id, k.nama]), a.kelompokDJ || "", "Tanpa kelompok")}</select></div>`;
  const tambah = `<button class="mr-btn mr-btn--utama" data-dj="kel-baru">${ikon("plus", 14)} Kelompok baru</button>`;
  const catatan = `<p class="mr-sub dj-catatan">Satu kepala divisi per kelompok: menilai hasil kerja dan menentukan target (deadline) yang tidak bisa diubah anggota. Admin berada di atas kepala divisi, master di atas admin: tingkat lebih tinggi bisa mengubah target tingkat di bawahnya, tidak sebaliknya.</p>`;
  const daftar = S.kelompok.map(baris).join("") || `<p class="mr-sub">Belum ada kelompok.</p>`;
  if (sempit) {
    const sub = [["kelompok", "Kelompok"], ["akun", "Akun"], ["kpi", "Kategori" + (S.ajuanKat.length ? ` (${S.ajuanKat.length})` : "")]];
    const isi = S.subKel === "akun" ? `<section class="mr-kartu dj-kartu"><h3>Kelompok tiap akun</h3>${akunList.map(akunBaris).join("")}</section>${catatan}`
      : S.subKel === "kpi" ? htmlTargetKategori()
      : `<section class="mr-kartu dj-kartu"><h3>Kelompok</h3><p class="mr-sub">Anggota hanya melihat dan mengubah job kelompoknya. Master dan admin melihat semua.</p>${daftar}${tambah}</section>`;
    return `<div class="mr-seg dj-subtab" role="tablist">${sub.map(([k, t]) => `<button type="button" class="mr-seg__btn${S.subKel === k ? " is-aktif" : ""}" data-dj="subkel" data-v="${k}">${t}</button>`).join("")}</div>${isi}`;
  }
  const k = S.kelompok.find((x) => x.id === kid), tanpa = akunList.filter((a) => !a.kelompokDJ), anggota = akunList.filter((a) => a.kelompokDJ === kid);
  return `<div class="dj-split"><div>
    <section class="mr-kartu dj-kartu"><h3>Kelompok</h3><p class="mr-sub">Anggota hanya melihat dan mengubah job kelompoknya. Master dan admin melihat semua.</p>${daftar}${tambah}</section>
    ${tanpa.length ? `<section class="mr-kartu dj-kartu"><h3>Tanpa kelompok</h3>${tanpa.map(akunBaris).join("")}</section>` : ""}</div>
    <div>${k ? `<section class="mr-kartu dj-kartu"><h3>${e(k.nama)}</h3><p class="mr-sub">${anggota.length} anggota</p>${anggota.map(akunBaris).join("") || `<p class="mr-sub">Belum ada anggota. Atur lewat daftar Tanpa kelompok.</p>`}${catatan}</section>` : ""}${htmlTargetKategori(kid)}</div></div>`;
}

function htmlPengingat(now) {
  const p = H.pengingat(tampak(), now);
  if (!p.terlambat.length && !p.hariIni.length && !p.segera.length) return "";
  return `<button type="button" class="dj-alert" data-dj="k-telat"><span><b>${p.terlambat.length} terlambat</b> · ${p.hariIni.length} <i class="dj-p">jatuh tempo </i>hari ini<i class="dj-p"> · ${p.segera.length} mulai minggu ini</i></span><b>Lihat</b></button>`;
}

/** Kelompok aktif di bawah judul halaman (bilah atas aplikasi); master/admin mengganti lewat pilihan bawaan perangkat yang ditumpuk transparan. */
function judulKelompok() {
  const h = document.querySelector(".app-topbar h1"); if (!h || window.__rute !== "dailyjob") return;
  const ganti = S.kelola && S.kelompok.length > 1, nama = namaKel(S.kelAktif);
  h.innerHTML = `Daily Job${S.kelAktif ? `<span class="dj-kelt${ganti ? " dj-kelt--g" : ""}">${e(nama)}${ganti ? `${ikon("turun", 13)}<select class="dj-kelt__s" data-dj="kel-aktif" aria-label="Ganti kelompok">${opsi(S.kelompok.map((k) => [k.id, k.nama]), S.kelAktif)}</select>` : ""}</span>` : ""}`;
}
/** Performa Tracking (desain gabungan Opsi 2): satu tampilan Trailer dan Distribusi, isinya mengikuti filter subdivisi. */
function htmlPerformaTracking(now) {
  const r = rentangAktif(), ar = armadaKel();
  return htmlPerfTracking(hitungPerforma(tampak(), r, S.sub, now), ar, DZ.ringkasRiwayat(ar, r), S.subPdz, now, (k) => "Mgg " + pBln(k));
}

function render() {
  const el = $("#dj-root"); if (!el) return;
  const now = H.hariIni(), perlu = S.kelola || S.kelompokSaya;
  if (S.tab === "kelompok" && !S.kelola) S.tab = "job"; // Pengaturan hanya master/admin
  const armLewat = profilAktif() === "tracking" && DZ.tugasArmada(armadaKel(), now).some((x) => x.tingkat === "lewat");
  const tabs = [["job", "Daftar job"], ...(profilAktif() === "tracking" ? [["giat", "Aktivitas"]] : []), ...(profilAktif() === "tracking" ? [["armada", "Armada" + (armLewat ? '<i class="dj-tdot" title="Ada urusan lewat tempo" aria-label="Ada urusan lewat tempo"></i>' : "")]] : []), ["performa", "Performa"], ...(S.kelola ? [["kelompok", "Pengaturan"]] : [])];
  const pushOn = statusPush(S.u.uid) === "aktif";
  const bukanBawaan = S.tab === "job" ? bukanBawaanDaftar() : periodeAktif() !== "bulan" || S.fPic || S.fKat || S.sub || (S.kelola && S.fKel);
  const ikb = (aksi, ikn, judul, kelas = "") => `<button type="button" class="mr-btn dj-ib ${kelas}" data-dj="${aksi}" title="${judul}" aria-label="${judul}">${ikn}</button>`;
  const btnFilter = `<button type="button" class="mr-btn dj-ib" data-dj="filter" title="Filter"  aria-label="Filter">${ikon("filter", 16)}${bukanBawaan ? `<i class="dj-dot"></i>` : ""}</button>`;
  const BEL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const mn = (a, i, t) => `<button type="button" role="menuitem" class="dj-mn__i" data-dj="${a}">${i} ${t}</button>`;
  const subMenu = profilAktif() === "tracking" ? `<div class="dj-mn__h">Subdivisi</div>${[["", "Semua"], ...Object.entries(TR.SUBDIVISI).map(([k, v]) => [k, v.nama])].map(([k, t]) => `<button type="button" role="menuitemradio" aria-checked="${S.sub === k}" class="dj-mn__i${S.sub === k ? " is-aktif" : ""}" data-dj="sub" data-v="${k}"><i class="dj-rad"></i> ${t}</button>`).join("")}<hr class="dj-mn__sp">` : "";
  const menuAlat = `<span class="dj-mw"><button type="button" class="mr-btn dj-ib" data-dj="menu" data-id="__alat" aria-haspopup="menu" aria-expanded="${S.menu === "__alat"}" title="Lainnya" aria-label="Lainnya">${ikon("titik", 18)}</button>${S.menu === "__alat" ? `<div class="dj-mn" role="menu">${subMenu}${mn("push", BEL, pushOn ? "Matikan notifikasi" : "Aktifkan notifikasi")}${profilAktif() === "tracking" ? mn("ekspor", ikon("download", 15), "Ekspor Excel shipment") : ""}${S.kelola && profilAktif() !== "tracking" ? mn("impor", ikon("upload", 15), "Impor dari Excel") : ""}${profilAktif() !== "tracking" || S.sub ? mn("pdf", ikon("download", 15), "Unduh laporan PDF") : ""}</div>` : ""}</span>`;
  const r = rentangAktif(), p = periodeAktif(), kelNama = namaKel(S.kelAktif);
  const ringkas = [kelNama, S.sub && TR.SUBDIVISI[S.sub].nama, S.fPic || "semua PIC", S.fKat || "semua kategori"].filter(Boolean).map(e).join(" · ");
  const kepalaP = `<div class="dj-kepala"><div class="dj-kepala__t"><div class="dj-ttl">Performa</div><p class="mr-sub" style="margin:4px 0 0;font-size:14px;white-space:normal;overflow:visible">Menampilkan <b style="color:var(--text)">${e(judulPeriode(r))}</b> · ${ringkas} &nbsp;<button type="button" class="mr-link" data-dj="filter">Ubah</button></p></div><span class="dj-kepala__a">${menuAlat}</span></div>`;
  const n = S.pilih.size, bs = (a, i, t, k = "") => `<button type="button" class="mr-btn dj-bp${k ? " " + k : ""}" data-dj="${a}" title="${t}" aria-label="${t}">${ikon(i, 16)}<span class="dj-bp__t"> ${t}</span></button>`;
  const kepalaD = pilihAktif() ? `<div class="dj-kepala dj-kepala--d dj-kepala--pilih"><button type="button" class="mr-ikonbtn" data-dj="pilih-batal" title="Batal pilih" aria-label="Batal pilih">${ikon("tutup", 16)}</button><b class="dj-bp__n">${n} dipilih</b><button type="button" class="mr-link" data-dj="cb-semua">Semua</button><span class="mr-ruang"></span>${n ? `${profilAktif() === "tracking" ? ["terkirim", "pod", "bayar"].map((l) => { const c = [...S.pilih].filter((id) => { const x = jobId(id); return x && LK.langkahTersedia(x).includes(l); }).length; return c ? bs("m-lk-" + l, IK_LK[l], `${LK.LANGKAH[l]} (${c})`, "dj-bp--lk") : ""; }).join("") : ""}${bs("m-selesai", "cek", "Selesai")}${bs("m-pic", "orang", "Ubah PIC")}${bs("m-bagikan", "salin", "Bagikan")}${bs("m-hapus", "tong", "Hapus", "dj-bp--hapus")}` : ""}</div>`
    : `<div class="dj-kepala dj-kepala--d"><input type="search" id="dj-cari" class="dj-cari" placeholder="${profilAktif() === "tracking" ? "Cari customer, DO, kontainer, plat…" : "Cari judul, customer, PIC…"}" value="${e(S.cari)}" aria-label="Cari job">${btnFilter}${menuAlat}</div>`;
  let isi;
  if (S.muat) isi = `<p class="mr-sub">Memuat…</p>`;
  else if (S.galat) isi = `<div class="dj-alert dj-alert--bahaya" data-galat>${e(S.galat)}</div>`;
  else if (!perlu) isi = `<section class="mr-kartu dj-kartu"><h3>Akun ini belum masuk kelompok</h3><p class="mr-sub">Minta master atau admin menetapkan kelompok Daily Job untuk akun Anda.</p></section>`;
  else if (S.detail && S.tab === "job") isi = htmlDetail(now);
  else isi = S.tab === "performa" ? kepalaP + (profilAktif() === "tracking" ? htmlPerformaTracking(now) : htmlPengingat(now) + htmlPerforma(now)) : S.tab === "giat" ? htmlAktivitas() : S.tab === "armada" ? htmlArmada(armadaKel(), S.subArm, now, !S.lihatSaja) : S.tab === "job" ? kepalaD + htmlDaftar(now) : htmlKelompok();
  judulKelompok();
  el.innerHTML = `${tabs.length > 1 ? `<div class="dj-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" class="${S.tab === k ? "is-aktif" : ""}" data-dj="tab" data-v="${k}">${t}</button>`).join("")}</div>`: ""}${isi}
    ${perlu && !S.muat && !S.detail && !S.lihatSaja && S.tab !== "armada" ? (() => { const g = S.tab === "giat", t = profilAktif() === "tracking" ? "pengiriman" : "job"; return `<button type="button" class="mr-fab fab-d fab--job" data-dj="${g ? "g-baru" : "baru"}" aria-label="Catat ${g ? "aktivitas" : t} baru">${ikon("papan-plus", 24)}<span class="fab-teks">Catat ${g ? "aktivitas" : t}</span></button>`; })() : ""}`;
  if (S.detail && S.tab === "job" && !S.muat) muatPratinjau();
  if (layarHp() && S.tab === "job" && !S.muat && !S.detail && !pilihAktif()) intipGeser();
}

/* ---------- tim kelompok: daftar anggota; kepala bisa menonaktifkan. Anggota ditambahkan master/admin dari akun yang sudah disetujui (Pengaturan > Akun dan akses) ---------- */
const kepalaDi = () => S.kelompok.filter((k) => S.kelola || (k.kepala || []).includes(S.u.uid));
async function panggil(nama, data) {
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js");
  try { return (await httpsCallable(getFunctions(app, "asia-southeast2"), nama)(data)).data; }
  catch (err) { throw new Error(err && err.code === "functions/not-found" ? "Layanan akun tim belum aktif di server. Pastikan Cloud Functions sudah ter-deploy." : (err && err.message) || "Gagal menghubungi server."); }
}
async function muatTim(kid) {
  const t = S.tim[kid] = { muat: true, anggota: [], galat: "" }; if (S.tab === "kelompok") render();
  try { t.anggota = (await panggil("djDaftarTim", { kelompokId: kid })).anggota || []; } catch (err) { t.galat = err.message; }
  t.muat = false; if (S.tab === "kelompok") render();
}
function htmlTim(k) {
  const t = S.tim[k.id] || { muat: true, anggota: [], galat: "" };
  const baris = (a) => `<div class="dj-agt${a.status === "aktif" ? "" : " is-mati"}">${avatar(a.nama)}<div class="dj-agt__i"><b>${e(a.nama)}</b>${a.status === "aktif" ? "" : ' <span class="dj-chip dj-chip--mu">Nonaktif</span>'}<small>${e(a.email || "")}${a.telepon ? " · " + e(a.telepon) : ""}</small></div>
    <span class="dj-agt__a"><button type="button" class="mr-btn mr-btn--kecil" data-dj="tim-toggle" data-id="${e(a.uid)}" data-k="${e(k.id)}">${a.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}</button></span></div>`;
  return `<section class="mr-kartu dj-kartu"><div class="dj-cap"><h3 style="margin:0">Tim ${e(k.nama)}</h3></div>
    <p class="mr-sub">Anggota masuk dengan email atau nomor telepon. Master atau admin yang menambah anggota: Pengaturan &rsaquo; Akun dan akses, bagian Tanpa kelompok.</p>
    ${t.muat ? '<p class="mr-sub">Memuat tim…</p>' : t.galat ? `<p class="mr-sub">${e(t.galat)}</p>` : t.anggota.length ? t.anggota.map(baris).join("") : '<p class="mr-sub">Belum ada anggota. Master atau admin menambahkannya dari akun yang sudah disetujui.</p>'}</section>`;
}
const anggotaDi = (kid, uid) => ((S.tim[kid] || {}).anggota || []).find((x) => x.uid === uid);

/* ---------- filter: sheet dari bawah (HP dan desktop), seragam dengan Quotation ---------- */
const selF = (aksi, lab, isi) => `<label class="mr-f"><span>${lab}</span><select data-dj="${aksi}">${isi}</select></label>`;
const segF = (aksi, daftar, aktif) => `<div class="dj-sg" role="group">${daftar.map(([k, t]) => `<button type="button" class="${aktif === k ? "is-on" : ""}" data-dj="${aksi}" data-v="${e(k)}" aria-pressed="${aktif === k}">${t}</button>`).join("")}</div>`;
const bagF = (judul, isi) => `<div class="dj-fs"><h4>${judul}</h4>${isi}</div>`;
const tutupSheet = () => { const d = $("#dj-sheet"); if (d) d.remove(); if (!$("#mr-layer.is-open")) document.body.classList.remove("mr-kunci-scroll"); };
/** HP: sheet dari bawah. Desktop: popover kecil di bawah tombol Filter. */
function bukaSheet(isi, tombol) {
  const ada = !!$("#dj-sheet"), hp = layarHp(), jangkar = hp ? null : $('[data-dj="filter"]'); tutupSheet(); // isi diganti saat terbuka: tanpa animasi ulang
  const d = document.createElement("div"); d.id = "dj-sheet"; d.className = "dj-sheet" + (hp ? "" : " dj-sheet--pop") + (ada ? " is-buka" : "");
  d.innerHTML = `<div class="dj-sheet__scrim" data-dj="sheet-tutup"></div><div class="dj-sheet__kotak" role="dialog" aria-modal="true" aria-label="Filter"><div class="dj-sheet__grip" aria-hidden="true"></div>
    <div class="dj-sheet__h"><b>Filter</b><button type="button" class="mr-ikonbtn" data-dj="sheet-tutup" aria-label="Tutup">${ikon("tutup", 18)}</button></div>${isi}
    <div class="dj-fs__aksi"><button type="button" class="mr-btn" data-dj="filter-reset">Atur ulang</button><button type="button" class="mr-btn mr-btn--utama" data-dj="sheet-tutup">${tombol}</button></div></div>`;
  document.body.appendChild(d);
  if (jangkar) { const r = jangkar.getBoundingClientRect(), k = d.querySelector(".dj-sheet__kotak"); k.style.top = r.bottom + 8 + "px"; k.style.right = Math.max(12, innerWidth - r.right) + "px"; }
  document.body.classList.add("mr-kunci-scroll");
  if (!ada) requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("is-buka")));
}
addEventListener("hashchange", tutupSheet); // pindah halaman: sheet ikut tertutup
const panelAktif = () => (S.tab === "job" ? panelFilterJob() : panelFilter());
const bagPic = () => bagF("PIC", `<select class="dj-sel" data-dj="f-pic" aria-label="PIC">${opsi(daftarPic(), S.fPic, "Semua PIC")}</select>`);
const bagKat = () => bagF("Kategori", `<select class="dj-sel" data-dj="f-kat" aria-label="Kategori">${opsi(kategoriAktif(), S.fKat, "Semua kategori")}</select>`);
const bagTgl = (dari, sampai, vd, vs) => `<div class="dj-tgl"><input type="date" id="${dari}" value="${e(vd)}" aria-label="Dari"><input type="date" id="${sampai}" value="${e(vs)}" aria-label="Sampai"></div>`;
/** Filter dashboard performa (desain Q2): periode, PIC, kategori. Status tidak dipakai agar angka tetap utuh. */
function panelFilter() {
  bukaSheet(`${bagF("Periode", segF("periode", [["bulan", "Bulan ini"], ["tahun", "Tahun ini"], ["rentang", "Rentang"]], S.periode) + (S.periode === "rentang" ? bagTgl("dj-dari", "dj-sampai", S.dari, S.sampai) : ""))}${profilAktif() === "tracking" ? bagF("Subdivisi", segF("f-sub", [["", "Semua"], ...Object.entries(TR.SUBDIVISI).map(([k, v]) => [k, v.nama])], S.sub)) : ""}${bagPic()}${bagKat()}`, "Selesai");
}
/** Filter daftar job: periode job dibuat (tglMasuk), PIC, kategori. Status ada di halaman daftar. */
function panelFilterJob() {
  const d = dataDaftar(H.hariIni());
  bukaSheet(`${bagF("Periode", segF("pd", PERIODE_DJ, S.pDaftar) + (S.pDaftar === "rentang" ? bagTgl("dj-pdari", "dj-psampai", S.pDari, S.pSampai) : ""))}${bagPic()}${bagKat()}`, `Tampilkan ${d.l.length} job`);
}
matchMedia("(max-width: 760px)").addEventListener("change", () => { if (window.__rute === "dailyjob") render(); });

/* ---------- form catat / ubah job ---------- */
const petaTarget = (kid) => (S.kelompok.find((k) => k.id === kid) || {}).targetKategori || {};
const kelompokPilihan = () => (S.kelola ? S.kelompok : S.kelompok.filter((k) => k.id === S.kelompokSaya));
let berkasBaru = [];
/** Potongan formulir yang dipakai semua profil. */
const katForm = (kid, d) => { const l = katDari(kid); return d && d.kategori && !l.includes(d.kategori) ? [...l, d.kategori] : l; };
const optKatBaru = () => `<option value="__baru">＋ ${S.kelola ? "Kategori baru…" : "Ajukan kategori baru…"}</option>`;
const isiMarketing = (d, f, baru) => `
    ${f("Judul job *", `<input id="djf-judul" maxlength="200" value="${e(d.judul || "")}" placeholder="mis. Penawaran trucking Jakarta–Surabaya">`, "dj-lebar")}
    ${f("Kategori *", `<select id="djf-kat">${opsi(katForm(d.kelompokId, d), d.kategori || "")}${optKatBaru()}</select><input id="djf-kat-baru" maxlength="40" placeholder="${S.kelola ? "Nama kategori baru" : "Kategori yang diajukan (perlu persetujuan master)"}" hidden>`)}
    ${f("PIC", `<input id="djf-pic" list="djf-piclist" value="${e(d.pic || "")}"><datalist id="djf-piclist">${opsiPic(picForm(d.kelompokId))}</datalist>`)}
    ${f("Customer / project", `<input id="djf-cust" value="${e(d.customer || "")}" placeholder="Nama customer">`)}
    ${f("Status", `<select id="djf-status">${opsi([["proses", "Dikerjakan"], ["tunggu", "Tertunda"], ["selesai", "Selesai"], ["batal", "Batal"]], d.status === "baru" ? "proses" : d.status)}</select>`)}
    ${f("Tertunda karena apa? * <small>mis. menunggu balasan customer</small>", `<input id="djf-tunda" maxlength="200" value="${e(d.alasanTunda || "")}">`, "dj-lebar dj-tunda").replace('class="mr-f', d.status === "tunggu" ? 'class="mr-f' : 'hidden class="mr-f')}
    ${f(`Target selesai *${d.id && !bolehUbahTarget(d) ? ` <small>(ditetapkan ${LABEL_TINGKAT[d.targetTingkat]})</small>` : ""} <small id="djf-tgt-info"></small>`, `<input type="date" id="djf-target" value="${e(d.tglTarget || "")}"${d.id && !bolehUbahTarget(d) ? " disabled" : ""}>`)}
    ${baru ? "" : f("Alasan ubah target <small>(wajib bila target diubah, kecuali kepala divisi)</small>", `<input id="djf-alasan" maxlength="300" placeholder="mis. menunggu revisi dari customer">`, "dj-lebar dj-alasan").replace('class="mr-f', 'hidden class="mr-f')}
    ${f("Deskripsi pekerjaan", `<textarea id="djf-desk" rows="3" placeholder="Apa yang dikerjakan, permintaan customer, hasil yang diharapkan">${e(d.deskripsi || "")}</textarea>`, "dj-lebar")}`;
const htmlBerkasForm = (d) => `
    <div class="mr-f dj-lebar"><span>Berkas hasil kerja <small>Word, Excel, PDF, gambar (maks. 4 MB per file). Bisa dipratinjau di halaman detail tanpa mengunduh.</small></span>
      <div id="djf-file">${d.file.map((x, i) => `<div class="dj-fl"><a href="${aman(x.url)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(x.nama)}</a><button type="button" class="mr-ikonbtn" data-dj="file-lepas" data-i="${i}" aria-label="Lepas file">${ikon("tutup", 14)}</button></div>`).join("")}</div>
      <input type="file" id="djf-berkas" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,image/*"><div class="dj-tautan"><input id="djf-tl" placeholder="Atau tempel tautan (Drive, OneDrive)"><button type="button" class="mr-btn mr-btn--kecil" data-dj="tautan-tambah">Tambah tautan</button></div>
      <div id="djf-tautan">${d.tautan.map((x, i) => `<div class="dj-fl"><a href="${aman(x.url)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(x.nama || x.url)}</a><button type="button" class="mr-ikonbtn" data-dj="tautan-lepas" data-i="${i}" aria-label="Lepas tautan">${ikon("tutup", 14)}</button></div>`).join("")}</div></div>`;
const htmlLainnyaForm = (d, f) => `
    <details class="dj-lain dj-lebar"><summary>Lainnya: tanggal, prioritas, bobot${S.kelola ? ", kelompok" : ""}</summary><div class="mr-form dj-form" style="margin-top:10px">
      ${S.kelola ? f("Kelompok", `<select id="djf-kel">${opsi(kelompokPilihan().map((k) => [k.id, k.nama]), d.kelompokId)}</select>`) : ""}
      ${f("Tanggal masuk", `<input type="date" id="djf-masuk" value="${e(d.tglMasuk || "")}">`)}${f("Mulai dikerjakan", `<input type="date" id="djf-mulai" value="${e(d.tglMulai || "")}">`)}${f("Tanggal selesai", `<input type="date" id="djf-selesai" value="${e(d.tglSelesai || "")}">`)}
      ${f("Prioritas", `<select id="djf-prio">${opsi(Object.entries(H.PRIORITAS), d.prioritas)}</select>`)}${f("Bobot kerja", `<select id="djf-bobot">${opsi(Object.entries(H.BOBOT).map(([k, t]) => [k, `${t} (${k})`]), d.bobot)}</select>`)}</div></details>`;
const bagStatus = (d, f) => f("Status", `<select id="djf-status">${opsi([["proses", "Dikerjakan"], ["tunggu", "Tertunda"], ["selesai", "Selesai"], ["batal", "Batal"]], d.status === "baru" ? "proses" : d.status)}</select>`);
const bagTunda = (d, f) => f("Tertunda karena apa? *", `<input id="djf-tunda" maxlength="200" value="${e(d.alasanTunda || "")}">`, "dj-lebar dj-tunda").replace('class="mr-f', d.status === "tunggu" ? 'class="mr-f' : 'hidden class="mr-f');
const daftarCustomer = () => [...new Set(S.jobs.map((j) => j.customer).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
const daftarVendor = () => [...new Set(S.jobs.map((j) => TR.rinci(j).vendor).filter(Boolean))].sort();

function formJob(j) {
  const baru = !j, d = j || { kelompokId: S.kelAktif || S.kelompokSaya || (S.kelompok[0] || {}).id || "", status: "baru", prioritas: "sedang", bobot: 2, tglMasuk: H.hariIni(), pic: S.u.nama || "", file: [], tautan: [], catatan: [] };
  muatRoster(d.kelompokId).then((r) => { const dl = $("#djf-piclist"); if (dl && Array.isArray(r)) dl.innerHTML = opsiPic(picForm(d.kelompokId)); });
  berkasBaru = []; d.file = d.file || []; d.tautan = d.tautan || []; d.catatan = d.catatan || [];
  const tr = profilKel(d.kelompokId) === "tracking", st = dataFormTracking(d);
  const f = (lab, isi, kelas = "") => `<label class="mr-f ${kelas}"><span>${lab}</span>${isi}</label>`;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>${tr ? (baru ? "Catat pengiriman" : "Ubah pengiriman") : baru ? "Catat job baru" : "Ubah job"}</h2><p class="mr-sub">${baru ? "Job yang masuk hari ini, baru dikerjakan, atau masih pending." : e(namaKel(d.kelompokId))}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form${tr ? " dj-form--tr dj-huruf" : ""}" id="dj-form" data-id="${e(d.id || "")}" data-profil="${tr ? "tracking" : "marketing"}" data-sub="${st.sub}" data-unit="${st.unit}" data-awal="baru" data-bayar="${st.bayar}" data-pod="${st.pod}" data-tagihan="${st.tagihan}">
    ${tr ? htmlFormTracking(d, { picList: picForm(d.kelompokId), vendorList: daftarVendor(), custList: daftarCustomer(), targetLabel: `Target tiba${d.id && !bolehUbahTarget(d) ? ` <small>(ditetapkan ${LABEL_TINGKAT[d.targetTingkat]})</small>` : ""} <small id="djf-tgt-info">kosong = sama dengan tanggal kirim</small>`, targetKunci: !!d.id && !bolehUbahTarget(d), status: bagStatus(d, f), tunda: bagTunda(d, f), berkas: htmlBerkasForm(d), lain: htmlLainnyaForm(d, f) }) : isiMarketing(d, f, baru) + htmlBerkasForm(d) + htmlLainnyaForm(d, f)}
  </div></div>
  <footer class="mr-panel__kaki dj-kaki">${baru ? "" : `<button class="mr-btn dj-ib dj-bhy" data-dj="hapus" data-id="${e(d.id)}" title="Hapus job" aria-label="Hapus job">${ikon("tong", 16)}</button>`}<span class="mr-ruang"></span>${tr ? `<button type="button" class="mr-btn dj-t-prev" data-dj="t-prev" hidden>‹ Kembali</button><button type="button" class="mr-btn mr-btn--utama dj-t-next" data-dj="t-next">Lanjut ›</button>` : ""}<button class="mr-btn dj-t-batal" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="simpan" id="dj-simpan">Simpan</button></footer>`);
  $("#dj-form")._d = d; if (tr) { langkahTracking(1); polaTitik(); pasangRute(); $("#dj-form").addEventListener("change", (ev) => { if (ev.target.id === "djf-kat") { const w = $("#djt-dok-saran"); if (w) w.innerHTML = htmlSaranDok(ev.target.value); } }); }
  let manual = false; // target otomatis dari kategori hanya untuk job baru dan selama target belum diketik sendiri
  const isiTarget = () => { if (!baru || manual) return; const kid = S.kelola ? $("#djf-kel").value : S.kelompokSaya, kat = $("#djf-kat").value, hr = +((petaTarget(kid) || {})[kat]) || 0, t = H.targetKategori(petaTarget(kid), kat, ($("#djt-kirim") && $("#djt-kirim").value) || $("#djf-masuk").value || H.hariIni()), i = $("#djf-tgt-info");
    if (t) $("#djf-target").value = t; i.textContent = t ? `otomatis ${hr} hari dari kategori, bisa diubah` : ""; };
  $("#djf-kat").onchange = (ev) => { const n = $("#djf-kat-baru"); if (n) { n.hidden = ev.target.value !== "__baru"; if (!n.hidden) n.focus(); } isiTarget(); };
  $("#djf-masuk").onchange = isiTarget; if ($("#djt-kirim")) $("#djt-kirim").onchange = isiTarget; if ($("#djf-kel")) $("#djf-kel").onchange = () => { if (tr) return isiTarget(); const sel = $("#djf-kat"), l = katForm($("#djf-kel").value, d); sel.innerHTML = opsi(l, l.includes(sel.value) ? sel.value : "") + optKatBaru(); sel.dispatchEvent(new Event("change")); };
  isiTarget();
  $("#djf-status").onchange = (ev) => { $(".dj-tunda").hidden = ev.target.value !== "tunggu"; const s = $("#djf-selesai"); if (ev.target.value === "selesai" && !s.value) s.value = H.hariIni(); if (ev.target.value !== "selesai") s.value = ""; };
  $("#djf-target").oninput = (ev) => { manual = true; $("#djf-tgt-info").textContent = ""; const a = $(".dj-alasan"); if (a) a.hidden = !d.tglTarget || ev.target.value === d.tglTarget; };
  $("#djf-berkas").onchange = (ev) => { berkasBaru.push(...ev.target.files); ev.target.value = ""; tampilBaru(); };
}
/** Tahap Trailer dari detail: tandai tahap berikut, batalkan tahap terakhir, atau centang dokumen. Menyimpan ke Firestore lalu menyegarkan tampilan. */
async function ubahTahap(a, id, i) {
  const j = jobId(id); if (!j || S.lihatSaja) return; let r = TR.rinci(j);
  const sekarang = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 16); // WIB
  const dz = r.jenis === "distribusi";
  if (a === "t-titik") { if (!DZ.berikut(j)) return; r = DZ.tandaiBerikut(j, sekarang); }
  else if (a === "t-tahap") { if (!TL.tahapBerikut(j)) return; r = TL.tandaiTahap(j, sekarang); }
  else if (a === "t-undo") { if (!(await konfirmasi("Batalkan tahap terakhir?", "Tahap terakhir yang selesai dikembalikan ke belum.", "Batalkan tahap"))) return; r = dz ? DZ.batalkanBerikut(j) : TL.batalkanTahap(j); }
  else r = { ...r, dok: { ...(r.dok || {}), [i]: !(r.dok && r.dok[i]) } };
  if (r.pod === "kembali" && TR.rinci(j).pod !== "kembali" && !String(r.noDo || "").trim()) return toast("Isi No. DO / surat jalan dulu (ikon pensil) sebelum POD ditandai kembali.", "bahaya");
  return simpanRinciTr(j, r);
}
/** Langkah cepat Distribusi (geser, tombol, massal): tandai Terkirim, POD kembali, atau Dibayar dengan waktu sekarang, lalu tawarkan Urungkan. */
async function tandaiLangkah(ids, lk) {
  if (S.lihatSaja || !LK.LANGKAH[lk]) return;
  const waktu = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 16), ok = []; let lewat = 0, blok = "", blokId = "";
  for (const id of ids) { const j = jobId(id); if (!j) continue; if (!LK.langkahTersedia(j).includes(lk)) { lewat++; continue; } const b = LK.blokir(j, lk); if (b) { blok = b; blokId = id; lewat++; continue; } ok.push({ j, lama: { rinci: j.rinci || {}, status: j.status, tglSelesai: j.tglSelesai || null }, r: LK.terapkan(j, lk, waktu) }); }
  if (!ok.length) { toast(blok || "Tidak ada pengiriman yang bisa ditandai.", "bahaya"); if (blok && ids.length === 1) { const j = jobId(blokId); if (j) formJob(j); } return; }
  let berhasil = 0; for (const h of ok) if (await simpanRinciTr(h.j, h.r, null, true)) berhasil++; else h.gagal = true;
  S.pilih.clear(); S.modePilih = false; segarkanKop(); segarkanKanan(); render();
  const nama = ok.length === 1 ? ok[0].j.customer || ok[0].j.judul : `${berhasil} pengiriman`, jam = waktu.slice(11), tambah = lewat ? ` · ${lewat} dilewati${blok ? ": " + blok : ""}` : "";
  toast(`<b>${e(nama)}</b> · ${LK.LANGKAH[lk]} ${jam}${tambah}`, "ok", { durasi: 7000, aksi: { teks: "Urungkan", fn: () => urungkanLangkah(ok.filter((h) => !h.gagal)) } });
}
async function urungkanLangkah(daftar) {
  try { for (const h of daftar) { const data = { rinci: h.lama.rinci, status: h.lama.status, tglSelesai: h.lama.tglSelesai, diubah: serverTimestamp() }; await updateDoc(doc(db, "dj_job", h.j.id), data); Object.assign(h.j, { ...data, diubah: null }); } segarkanKop(); segarkanKanan(); render(); toast("Dikembalikan."); }
  catch (err) { console.error(err); toast("Belum bisa dikembalikan: " + pesanUnggah(err), "bahaya"); }
}
/** Simpan rinci baru; status ikut Selesai bila POD kembali dan pembayaran beres (aturan di daily-job-pod.js), atau kembali Proses bila tidak lagi. */
async function simpanRinciTr(j, r, sesudah, diam) {
  const baru = { ...j, rinci: r }, selesai = TL.selesaiOtomatis(baru) && j.status !== "batal", data = { rinci: r, diubah: serverTimestamp(), ...(selesai ? { status: "selesai", tglSelesai: r.tglPod || H.hariIni() } : j.status === "selesai" && !TL.selesaiOtomatis(baru) ? { status: "proses", tglSelesai: null } : {}) };
  try { await updateDoc(doc(db, "dj_job", j.id), data); Object.assign(j, { ...data, diubah: null }); if (!diam) { segarkanKop(); segarkanKanan(); if (sesudah) sesudah(); render(); } return true; }
  catch (err) { console.error(err); toast("Belum tersimpan: " + pesanUnggah(err), "bahaya"); return false; }
}
/** Unggah lampiran POD/bukti bayar ke dailyjob/{kelompok}/{job}/; mengembalikan daftar { nama, path, url, ... }. */
const unggahLampiran = async (files, j) => { const l = []; for (const f of files) { const path = `dailyjob/${j.kelompokId}/${j.id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`; l.push({ nama: f.name, path, url: await unggahBlob(path, f, f.type || "application/octet-stream"), ukuran: f.size, tipe: f.type || "", oleh: S.u.nama || S.u.email, tgl: H.hariIni() }); } return l; };
const daftarBerkas = (id, lama) => `<div class="mr-f dj-lebar"><span>Foto atau berkas <small>gambar, PDF; maks. 4 MB</small></span><input type="file" id="${id}" accept="image/*,.pdf" multiple>${(lama || []).length ? `<small class="mr-sub">Sudah ada ${lama.length} berkas; berkas baru ditambahkan.</small>` : ""}</div>`;
function panelPod(jenis, id) {
  const j = jobId(id); if (!j) return; const r = TR.rinci(j), resi = jenis === "resi", pk = r.podKirim || {};
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>${resi ? "Resi POD dari vendor" : jenis === "foto" ? "Foto POD (surat jalan kembali)" : "Pembayaran vendor (Cash)"}</h2><p class="mr-sub">${e(j.judul)} · ${e(r.vendor || "")}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form" style="grid-template-columns:1fr">${resi
    ? `<label class="mr-f"><span>Ekspedisi</span><input id="djp-eks" value="${e(pk.ekspedisi || "")}" placeholder="mis. JNE, J&T, Indah Cargo"></label><label class="mr-f"><span>No. resi <small>atau unggah foto resi</small></span><input id="djp-resi" value="${e(pk.resi || "")}"></label><label class="mr-f"><span>Tanggal dikirim</span><input type="date" id="djp-tgl" value="${e(pk.tgl || H.hariIni())}"></label>${daftarBerkas("djp-berkas", pk.berkas)}`
    : jenis === "foto" ? `${daftarBerkas("djp-berkas", r.podBerkas)}<p class="mr-sub">Foto atau PDF surat jalan yang sudah ditandatangani penerima. Dari kamera HP langsung bisa.</p>`
    : `<label class="mr-f"><span>Tanggal transfer</span><input type="date" id="djp-tgl" value="${e(r.tglBayar || H.hariIni())}"></label>${daftarBerkas("djp-berkas", r.buktiBayar)}<p class="mr-sub">Unggah bukti transfer agar Finance mudah memeriksa.</p>`}</div></div>
  <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="pod-simpan" data-v="${jenis}" data-id="${e(id)}">Simpan</button></footer>`);
}
async function simpanPod(jenis, id) {
  const j = jobId(id); if (!j) return; const resi = jenis === "resi", foto = jenis === "foto", v = (x) => (($("#" + x) || {}).value || "").trim(), tgl = foto ? "ok" : v("djp-tgl"), files = [...(($("#djp-berkas") || {}).files || [])], r = TR.rinci(j);
  if (!tgl) return toast("Isi tanggalnya.", "bahaya");
  if (resi && !v("djp-resi") && !files.length && !(r.podKirim && (r.podKirim.berkas || []).length)) return toast("Isi no. resi atau unggah foto resi.", "bahaya");
  if (foto && !files.length) return toast("Pilih foto atau berkas POD dulu.", "bahaya");
  const tombol = document.querySelector('[data-dj="pod-simpan"]'); if (tombol) { tombol.disabled = true; tombol.textContent = "Menyimpan…"; }
  try {
    const baru = await unggahLampiran(files, j);
    const n = foto ? { ...r, podBerkas: [...(r.podBerkas || []), ...baru] } : resi ? { ...r, podKirim: { ekspedisi: v("djp-eks"), resi: v("djp-resi"), tgl, berkas: [...((r.podKirim || {}).berkas || []), ...baru] } } : { ...r, tglBayar: tgl, buktiBayar: [...(r.buktiBayar || []), ...baru] };
    if (await simpanRinciTr(j, n, tutupLayer)) toast(foto ? "Foto POD tersimpan." : resi ? "Resi POD tersimpan." : "Pembayaran tercatat.");
  } catch (err) { console.error(err); toast("Belum terunggah: " + pesanUnggah(err), "bahaya"); }
  finally { if (tombol && tombol.isConnected) { tombol.disabled = false; tombol.textContent = "Simpan"; } }
}
/* ---------- Aktivitas Tracking (koleksi dj_kegiatan): non-pengiriman, kalender 6 hari + pengingat ---------- */
const giatKel = () => S.giat.filter((g) => !S.kelAktif || g.kelompokId === S.kelAktif);
const giatId = (id) => S.giat.find((g) => g.id === id);
function htmlAktivitas() { const now = H.hariIni(); if (!S.gAwal) S.gAwal = now; if (!S.gPilih) S.gPilih = now; return GT.htmlAktivitas(giatKel(), { awal: S.gAwal, pilih: S.gPilih, f: S.gF }, now, !S.lihatSaja); }
function formGiat(g) {
  const baru = !g; g = g || { pic: S.u.nama || "", tgl: S.gPilih || H.hariIni() };
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>${baru ? "Catat aktivitas" : "Ubah aktivitas"}</h2><p class="mr-sub">Kunjungan, perbaikan, dokumen, dan lainnya</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi" id="g-form" data-jenis="${e(g.jenis || "kunjungan")}">${GT.htmlFormGiat(g, armadaKel(), H.hariIni())}</div>
  <footer class="mr-panel__kaki dj-kaki">${baru ? "" : `<button class="mr-btn dj-bhy" data-dj="g-hapus" data-id="${e(g.id)}">Hapus</button>`}<span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="g-simpan" data-id="${e(g.id || "")}">Simpan</button></footer>`);
}
async function simpanGiat(id) {
  const v = (x) => ($("#" + x) || {}).value || "", lama = id ? giatId(id) : null, kel = lama ? lama.kelompokId : S.kelAktif || S.kelompokSaya, jenis = $("#g-form").dataset.jenis, judul = v("g-judul").trim();
  if (!judul) return toast("Isi apa yang dikerjakan.", "bahaya"); if (!kel) return toast("Pilih kelompok dulu.", "bahaya");
  const dok = jenis === "dokumen", data = { kelompokId: kel, jenis, judul, tgl: v("g-tgl") || H.hariIni(), jam: v("g-jam"), plat: ["dokumen", "servis", "gps", "storing"].includes(jenis) ? v("g-plat") : "", tempat: v("g-tempat").trim(), biaya: angka(v("g-biaya")) || null, status: v("g-status") || "rencana", ingatkan: +v("g-ingat") || 0, pic: v("g-pic").trim(), isu: $("#g-isu").checked, catatan: v("g-cat").trim(), oleh: (lama || {}).oleh || S.u.nama || S.u.email, diubah: serverTimestamp() };
  if (dok) { data.dok = v("g-dok"); data.berlakuBaru = v("g-baru") || null; }
  const k = data.plat ? S.armada.find((x) => x.plat === data.plat && x.kelompokId === kel) : null, da = k && !(lama && lama.status === "selesai") ? GT.dataArmada(k, data) : null; // sekali saja, saat baru menjadi selesai
  if (dok && data.status === "selesai" && !data.berlakuBaru) return toast("Isi tanggal berlaku baru dokumen.", "bahaya");
  try { const gid = id || uid(); await setDoc(doc(db, "dj_kegiatan", gid), data); if (da) { await updateDoc(doc(db, "dj_armada", k.id), { ...da, diubah: serverTimestamp() }); Object.assign(k, da); }
    const baru = { id: gid, ...data, diubah: null }, i = S.giat.findIndex((x) => x.id === gid); if (i >= 0) S.giat[i] = baru; else S.giat.push(baru); S.gPilih = data.tgl; S.gAwal = data.tgl < S.gAwal || data.tgl > H.tambahHari(S.gAwal, 5) ? data.tgl : S.gAwal; tutupLayer(); render(); toast(da ? "Tersimpan, Armada ikut diperbarui." : "Aktivitas tersimpan."); }
  catch (err) { console.error(err); toast("Belum tersimpan: " + pesanUnggah(err), "bahaya"); }
}
async function hapusGiat(id) {
  const g = giatId(id); if (!g || !(await konfirmasi("Hapus aktivitas?", `<b>${e(g.judul)}</b> dihapus.`, "Hapus"))) return;
  try { await deleteDoc(doc(db, "dj_kegiatan", id)); S.giat = S.giat.filter((x) => x.id !== id); tutupLayer(); render(); toast("Aktivitas dihapus."); } catch (err) { console.error(err); toast("Belum terhapus: " + pesanUnggah(err), "bahaya"); }
}
/* ---------- Armada Truk Distribusi: kendaraan, dokumen, servis, sewa (koleksi dj_armada) ---------- */
const armadaKel = () => S.armada.filter((k) => !S.kelAktif || k.kelompokId === S.kelAktif);
const armadaId = (id) => S.armada.find((k) => k.id === id);
const angka = (x) => Number(String(x || "").replace(/\D/g, "")) || 0;
function formKendaraan(k) {
  const baru = !k; k = k || { aktif: true };
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>${baru ? "Tambah kendaraan" : "Ubah kendaraan"}</h2>${baru ? "" : `<p class="mr-sub">${e(k.plat)}</p>`}</div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi">${htmlFormKendaraan(k)}</div>
  <footer class="mr-panel__kaki dj-kaki">${baru ? "" : `<button class="mr-btn dj-bhy" data-dj="arm-hapus" data-id="${e(k.id)}">Hapus</button>`}<span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="arm-simpan" data-id="${e(k.id || "")}">Simpan</button></footer>`);
  const cb = $("#arm-sewa-on"); if (cb) cb.onchange = () => { $(".dj-arm__sewa").hidden = !cb.checked; };
}
async function simpanKendaraan(id) {
  const v = (x) => ($("#" + x) || {}).value || "", lama = id ? armadaId(id) : null, plat = v("arm-plat").trim().toUpperCase(), kel = lama ? lama.kelompokId : S.kelAktif || S.kelompokSaya;
  if (!plat) return toast("Isi plat nomor.", "bahaya"); if (!kel) return toast("Pilih kelompok dulu.", "bahaya");
  if (!lama && S.armada.some((k) => k.plat === plat && k.kelompokId === kel)) return toast("Plat ini sudah terdaftar.", "bahaya");
  const sewa = $("#arm-sewa-on").checked ? { customer: v("arm-sw-cust").trim(), kota: v("arm-sw-kota").trim(), bentuk: v("arm-sw-bentuk"), mulai: v("arm-sw-mulai") || null, akhir: v("arm-sw-akhir") || null, visitTerakhir: v("arm-sw-visit") || null } : null;
  const data = { kelompokId: kel, plat, jenisArmada: v("arm-jenis"), bak: v("arm-bak"), kir: v("arm-kir") || null, stnk: v("arm-stnk") || null, pajak: v("arm-pajak") || null, servis: { ...((lama || {}).servis || {}), odo: angka(v("arm-odo")) || null, tglBerikut: v("arm-sv-tgl") || null, kmBerikut: angka(v("arm-sv-km")) || null, intervalBln: angka(v("arm-sv-bln")) || null, intervalKm: angka(v("arm-sv-ikm")) || null }, sewa, catatan: v("arm-cat").trim(), aktif: $("#arm-aktif").checked, riwayat: (lama || {}).riwayat || [], diubah: serverTimestamp() };
  try { const kid = id || uid(); await setDoc(doc(db, "dj_armada", kid), data); const baru = { id: kid, ...data, diubah: null }; const i = S.armada.findIndex((k) => k.id === kid); if (i >= 0) S.armada[i] = baru; else S.armada.push(baru); S.armada.sort((a, b) => String(a.plat).localeCompare(String(b.plat))); tutupLayer(); render(); toast("Kendaraan tersimpan."); }
  catch (err) { console.error(err); toast("Belum tersimpan: " + pesanUnggah(err), "bahaya"); }
}
async function hapusKendaraan(id) {
  const k = armadaId(id); if (!k || !(await konfirmasi("Hapus kendaraan?", `<b>${e(k.plat)}</b> dan riwayatnya dihapus. Job pengiriman tidak terpengaruh.`, "Hapus"))) return;
  try { await deleteDoc(doc(db, "dj_armada", id)); S.armada = S.armada.filter((x) => x.id !== id); tutupLayer(); render(); toast("Kendaraan dihapus."); } catch (err) { console.error(err); toast("Belum terhapus: " + pesanUnggah(err), "bahaya"); }
}
function panelTugas(id, tipe) {
  const k = armadaId(id); if (!k) return;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>${judulTugas(tipe)}</h2><p class="mr-sub">${e(k.plat)} · ${e([k.jenisArmada, k.bak].filter(Boolean).join(" "))}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi">${htmlFormTugas(tipe, k)}</div><footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="arm-tugas-simpan" data-id="${e(id)}" data-v="${tipe}">Simpan</button></footer>`);
}
async function simpanTugas(id, tipe) {
  const k = armadaId(id), v = (x) => ($("#" + x) || {}).value || ""; if (!k) return; const h = H.hariIni(), tgl = v("tg-tgl") || h, sv = k.servis || {};
  const log = { tipe, judul: judulTugas(tipe), tgl, biaya: angka(v("tg-biaya")) || null, catatan: v("tg-cat").trim(), oleh: S.u.nama || S.u.email, waktu: Date.now() }; let data;
  if (tipe === "servis") { const odo = angka(v("tg-odo")) || sv.odo || null; data = { servis: { ...sv, odo, terakhir: tgl, tglBerikut: v("tg-next-tgl") || (sv.intervalBln ? DZ.tambahBulan(tgl, sv.intervalBln) : null), kmBerikut: angka(v("tg-next-km")) || (sv.intervalKm && odo ? odo + sv.intervalKm : null) } }; }
  else if (tipe === "visit") { const odo = angka(v("tg-odo")) || sv.odo || null; data = { sewa: { ...(k.sewa || {}), visitTerakhir: tgl }, servis: { ...sv, odo } }; }
  else { const baru = v("tg-baru"); if (!baru) return toast("Isi tanggal berlaku yang baru.", "bahaya"); data = { [tipe]: baru }; log.baru = baru; }
  data.riwayat = [...(k.riwayat || []), log].slice(-100); data.diubah = serverTimestamp();
  try { await updateDoc(doc(db, "dj_armada", id), data); Object.assign(k, { ...data, diubah: null }); tutupLayer(); render(); toast("Tersimpan."); } catch (err) { console.error(err); toast("Belum tersimpan: " + pesanUnggah(err), "bahaya"); }
}
/** Dokumen dan nomor referensi Trailer: baca baris dari form, tambah atau hapus, gambar ulang tanpa kehilangan isian. */
const bacaDok = () => [...document.querySelectorAll("#djt-dok .dj-dok")].map((x) => ({ jenis: x.querySelector(".djt-dj").value, no: kapital(x.querySelector(".djt-dn").value.trim()) }));
function ubahDok(a, t) {
  let l = bacaDok(); if (a === "t-dok-tambah") l.push({ jenis: t.dataset.v || "Surat jalan", no: "" }); else l.splice(+t.dataset.i, 1); if (!l.length) l = [{ jenis: "Surat jalan", no: "" }];
  $("#djt-dok").innerHTML = htmlDokRows(l); const k = $("#djt-dok").querySelectorAll(".djt-dn"); if (a === "t-dok-tambah") k[k.length - 1].focus();
}
/* ---------- Rute: ketik bebas, saran dari riwayat (customer, armada, unit), jumlah pengiriman ---------- */
/** Titik editor dari lokasi berurutan: lokasi pertama pick up, sisanya drop. */
function isiTitik(lok) { $("#djt-titik").innerHTML = htmlTitik(lok.map((x, i) => ({ t: i ? "D" : "P", nama: x.nama || "", kota: x.kota || "", selesai: null }))); polaTitik(); }
/** Titik editor dari pengiriman contoh (riwayat): nama lokasi dan kota disalin, status selesai dikosongkan. */
function titikDariContoh(c) { const t = (TR.rinci(c).titik || []).filter((x) => x && (x.t === "P" || x.t === "D")); if (!t.length) return false; $("#djt-titik").innerHTML = htmlTitik(t.map((x) => ({ t: x.t, nama: x.nama || "", kota: x.kota || "", selesai: null }))); polaTitik(); return true; }
const riwayatForm = () => { const form = $("#dj-form"); return S.jobs.filter((j) => j.kelompokId === form._d.kelompokId && j.id !== form.dataset.id); };
const konteksRute = () => { const form = $("#dj-form"); return { cust: ($("#djt-cust") || {}).value, kat: ($("#djf-kat") || {}).value, unit: form.dataset.unit === "vendor" ? "vendor" : "internal", sub: form.dataset.sub }; };
/** Teks rute yang diketik menjadi titik: rute yang sama persis dengan riwayat memakai lokasi riwayat, selain itu kota dari teks. Hanya bila editor titik belum diubah manual dan ada minimal dua lokasi. */
function sinkronRute() {
  const form = $("#dj-form"), box = $("#djt-rute"); if (!form || !box || form._titikManual || form.dataset.id || form.dataset.sub === "besar") return;
  const seg = TR.bagiRute(box.value).map(awalKalimat); if (seg.length < 2) return;
  const kunci = seg.join(">").toLowerCase(), cocok = TR.saranRute(riwayatForm(), { ...konteksRute(), cari: "" }, 200).find((o) => TR.bagiRute(o.teks).join(">").toLowerCase() === kunci);
  if (!(cocok && titikDariContoh(cocok.contoh))) isiTitik(seg.map((k) => ({ kota: k })));
}
function pasangRute() {
  const form = $("#dj-form"), box = $("#djt-rute"), sug = $("#djt-sug"); if (!form || !box) return;
  const ket = (o) => (o.nCocok ? `Rute langganan · ${o.nCocok}× untuk customer ini` : o.nCust ? `Customer ini ${o.nCust}×, armada atau unit berbeda` : `${o.n}× di kelompok ini`);
  const tampil = () => {
    const l = TR.saranRute(riwayatForm(), { ...konteksRute(), cari: box.value }), q = box.value.trim(), ada = l.some((o) => o.teks.toLowerCase() === q.toLowerCase()); form._saran = l;
    sug.innerHTML = l.map((o, i) => `<button type="button" role="option" class="dj-sug__i" data-dj="rute-pilih" data-i="${i}"><span><b>${e(o.teks)}</b><small>${e(ket(o))}</small></span>${o.nCocok ? '<span class="dj-chip dj-chip--ok">Berulang</span>' : ""}</button>`).join("") + (q && !ada ? `<button type="button" role="option" class="dj-sug__i dj-sug__i--baru" data-dj="rute-baru"><span><b>Rute baru: "${e(q)}"</b><small>Lengkapi lokasi di Detail titik</small></span></button>` : "");
    sug.hidden = !sug.innerHTML;
  };
  form._segarSaran = () => { if (!sug.hidden) tampil(); };
  const tutup = () => { sug.hidden = true; };
  box.addEventListener("focus", tampil); box.addEventListener("input", () => { form._ruteDipilih = null; tampil(); });
  box.addEventListener("blur", () => setTimeout(() => { tutup(); sinkronRute(); }, 180));
  sug.addEventListener("pointerdown", (ev) => ev.preventDefault()); // klik saran tidak menutup lewat blur
  form.addEventListener("input", (ev) => { if (ev.target.closest && ev.target.closest("#djt-titik")) form._titikManual = true; if (ev.target.id === "djt-jumlah") jmlUi(); });
  form.addEventListener("change", (ev) => { if (ev.target.id === "djt-cust" || ev.target.id === "djf-kat") form._segarSaran(); });
}
function pilihRute(i) {
  const form = $("#dj-form"), o = form && form._saran && form._saran[i], box = $("#djt-rute"); if (!o) return;
  box.value = o.teks; $("#djt-sug").hidden = true; form._ruteDipilih = o; const c = o.contoh, r = TR.rinci(c), info = $("#djt-ruteinfo");
  if (form.dataset.sub !== "besar") { if (!form._titikManual) titikDariContoh(c); const d = $("#djt-titikd"); if (d) d.open = false; }
  const bak = $("#djt-bak"); if (bak && o.nCocok && !bak.value && r.bak) bak.value = r.bak;
  const cost = $("#djt-cost"); if (cost && o.nCocok && !cost.value && Number(r.cost)) { cost.value = Number(r.cost).toLocaleString("id-ID"); }
  if (info) info.textContent = o.nCocok ? `Rute langganan: lokasi${Number(r.cost) ? ", cost" : ""} diisi dari pengiriman terakhir. Ubah bila beda.` : "Lokasi diisi dari pengiriman terakhir rute ini. Ubah bila beda.";
}
function ruteBaru() {
  const form = $("#dj-form"); if (!form) return; $("#djt-sug").hidden = true; sinkronRute(); const d = $("#djt-titikd"); if (d && form.dataset.sub !== "besar") { d.open = true; d.scrollIntoView({ block: "nearest" }); }
}
function jmlUi() {
  const form = $("#dj-form"), n = +($("#djt-jumlah") || {}).value || 1, banyak = n > 1;
  const i = $("#djt-jmlinfo"); if (i) i.hidden = !banyak; ["djt-do", "djt-kont"].forEach((id) => { const x = $("#" + id); if (x) { x.disabled = banyak; if (banyak) x.value = ""; } }); document.querySelectorAll("#djt-dok .djt-dn").forEach((x) => { x.disabled = banyak; if (banyak) x.value = ""; });
}
function ubahJumlah(d) { const i = $("#djt-jumlah"); if (!i) return; i.value = Math.min(20, Math.max(1, (+i.value || 1) + d)); jmlUi(); }
/** Editor titik pick up/drop (Distribusi): baca isian ke form._titik, tambah atau hapus, lalu gambar ulang tanpa kehilangan isian. */
function bacaTitik() { return [...document.querySelectorAll("#djt-titik .dj-ttk")].map((x) => ({ t: x.dataset.t, nama: awalKalimat(x.querySelector(".djt-tn").value.trim()), kota: awalKalimat(x.querySelector(".djt-tk").value.trim()), selesai: x.dataset.selesai || null })); }
function ubahTitik(a, t) {
  let l = bacaTitik();
  if (a === "t-tambah") l.push({ t: t.dataset.v, nama: "", kota: "", selesai: null }); else l.splice(+t.dataset.i, 1);
  l.sort((x, y) => (x.t === y.t ? 0 : x.t === "P" ? -1 : 1)); $("#djt-titik").innerHTML = htmlTitik(l); polaTitik(); $("#dj-form")._titikManual = true;
}
const polaTitik = () => { const l = bacaTitik(), p = l.filter((x) => x.t === "P").length, d = l.length - p, el = $("#djt-pola"); if (el) el.textContent = `· ${p} pick up → ${d} drop`; };
/** HP: formulir Tracking tiga langkah; desktop: semua bagian terlihat. */
function langkahTracking(n) {
  const form = $("#dj-form"); if (!form || form.dataset.profil !== "tracking") return; const hp = false; form._lg = n; // satu layar tanpa langkah (25 Nov 2026): yang jarang dipakai ada di "Lainnya"
  form.querySelectorAll(".dj-lng").forEach((x) => { x.hidden = hp && +x.dataset.lng !== n; }); form.querySelectorAll(".dj-lng__h").forEach((h) => { h.hidden = !hp ? false : false; });
  const prev = $(".dj-t-prev"), next = $(".dj-t-next"), batal = $(".dj-t-batal"), simpan = $("#dj-simpan");
  if (prev) prev.hidden = !hp || n === 1; if (next) next.hidden = !hp || n === 3; if (batal) batal.hidden = hp && n > 1; if (simpan) simpan.hidden = hp && n < 3;
  const sub = $(".mr-panel__kepala .mr-sub"); if (sub && hp) sub.textContent = `Langkah ${n} dari 3`;
}
/** Pilihan chip di formulir Tracking: simpan nilai di data-<k> pada #dj-form. */
function aturChipTracking(t) {
  const form = $("#dj-form"), k = t.dataset.k, v = t.dataset.v; if (!form) return; form.dataset[k] = v;
  t.closest(".mr-seg").querySelectorAll(".mr-chip").forEach((c) => c.classList.toggle("is-aktif", c === t));
  if (k === "sub") { document.querySelectorAll(".dj-besar").forEach((x) => x.classList.toggle("dj-sembunyi", v !== "besar")); document.querySelectorAll(".dj-kecil").forEach((x) => x.classList.toggle("dj-sembunyi", v === "besar")); const lab = $("#djt-katlab"); if (lab) lab.textContent = v === "besar" ? "Jenis shipment *" : "Jenis armada *"; const kat = $("#djf-kat"); kat.innerHTML = TR.SUBDIVISI[v].kategori.map((x) => `<option>${e(x)}</option>`).join(""); kat.dispatchEvent(new Event("change")); const rb = $("#djt-rutebox"); if (rb) rb.classList.toggle("dj-sembunyi", !!form.dataset.id && v !== "besar"); const kb = $("#djt-rute"); if (kb) kb.placeholder = "mis. Jakarta → Surabaya"; form._segarSaran && form._segarSaran(); }
  if (k === "unit") { const vb = $("#djt-vbox"); if (vb) vb.hidden = v !== "vendor"; const ui = $("#djt-unitinfo"); if (ui) ui.textContent = v === "internal" ? "Uang jalan dibayar sebelum berangkat, POD kembali otomatis." : ""; const ci = $("#djt-costinfo"); if (ci) ci.textContent = v === "internal" ? "uang jalan" : "tarif vendor"; form._segarSaran && form._segarSaran(); }
  if (k === "pod") { const w = $(".dj-tglpod"); if (w) w.classList.toggle("dj-sembunyi", v !== "kembali"); if (v === "kembali" && !$("#djt-tglpod").value) $("#djt-tglpod").value = H.hariIni(); }
}
/** Rinci khusus Distribusi: titik, jenis armada, tipe bak; asal dan tujuan diturunkan dari titik pertama dan terakhir agar daftar dan laporan lama tetap jalan. */
const titikRinci = (v) => { const t = bacaTitik(), p = t.find((x) => x.t === "P"), d = [...t].reverse().find((x) => x.t === "D"), arm = v("djf-kat"); return { jenis: "distribusi", titik: t, jenisArmada: arm === "Grand Max Blind Van" ? "Blind Van" : arm, bak: v("djt-bak"), asalTitik: p && (p.nama || p.kota), tujuanTitik: d && (d.nama || d.kota) }; };
/** Trailer: asal, tujuan, dan tujuan lain (hanya Domestik, maks. 4 tujuan) dari teks rute "Asal → Tujuan → ...". */
const ruteTrailer = (v) => { const l = TR.bagiRute(v("djt-rute")).map(awalKalimat); return { asal: l[0] || "", tujuan: l[1] || "", tujuanLain: v("djf-kat") === "Trailer Domestik" ? l.slice(2, TL.MAKS_TUJUAN) : [] }; };
const rinciDariForm = (form, v) => ({ ...(form._d && form._d.rinci), ...(form.dataset.sub === "besar" ? { jenis: TR.jenisDariKategori(v("djf-kat")) || undefined, kontainer: v("djt-kont").trim().toUpperCase(), ukuran: v("djt-ukuran"), ...ruteTrailer(v) } : titikRinci(v)), emailCust: !$("#djt-email") || $("#djt-email").checked, tglBayar: v("djt-tglbayar") || null, sub: form.dataset.sub || "", noDo: v("djt-do").trim(), tglKirim: v("djt-kirim") || null, vendor: form.dataset.unit === "vendor" ? v("djt-vendor").trim() : "", driver: v("djt-driver").trim(), telp: v("djt-telp").trim(), plat: v("djt-plat").trim().toUpperCase(), bayar: form.dataset.bayar || "cash", cost: Number(v("djt-cost").replace(/\D/g, "")) || 0, pod: form.dataset.pod || "belum", tglPod: form.dataset.pod === "kembali" ? v("djt-tglpod") || H.hariIni() : null, tagihan: form.dataset.tagihan || "belum" });
const tampilBaru = () => { const w = $("#djf-file"); w.querySelectorAll(".dj-fl--baru").forEach((x) => x.remove()); berkasBaru.forEach((b, i) => w.insertAdjacentHTML("beforeend", `<div class="dj-fl dj-fl--baru"><span>${ikon("upload", 13)} ${e(b.name)} <small>(baru)</small></span><button type="button" class="mr-ikonbtn" data-dj="baru-lepas" data-i="${i}" aria-label="Batalkan">${ikon("tutup", 14)}</button></div>`)); };

async function simpanJob() {
  const form = $("#dj-form"), d = form._d, v0 = (id) => ($("#" + id) || {}).value || "";
  /* penulisan seragam: awal kalimat kapital pada teks, kode (kontainer, plat, no. DO) semua kapital */
  const v = (id) => { const x = v0(id); return /^(djt-cust|djt-vendor|djt-driver|djt-asal|djt-tujuan|djf-desk|djf-judul)$/.test(id) ? awalKalimat(x) : /^(djt-kont|djt-plat|djt-do)$/.test(id) ? kapital(x) : x; };
  if (form.dataset.profil === "tracking" && form.dataset.sub !== "besar") sinkronRute(); // teks rute yang diketik menjadi titik bila editor titik belum diubah manual
  const tr = form.dataset.profil === "tracking", rinci = tr ? rinciDariForm(form, v) : null, jumlah = tr && !d.id ? Math.min(20, Math.max(1, +v("djt-jumlah") || 1)) : 1;
  if (tr && form.dataset.sub === "besar") { const dn = bacaDok().filter((x) => x.no); rinci.dokNomor = dn; rinci.noDo = ringkasDok(dn); }
  if (tr && rinci.jenis === "distribusi") { rinci.asal = rinci.asalTitik || ""; rinci.tujuan = rinci.tujuanTitik || ""; delete rinci.asalTitik; delete rinci.tujuanTitik; }
  const judul = tr ? TR.judulTracking(rinci.noDo || [rinci.asal, rinci.tujuan].filter(Boolean).join(" → "), v("djt-cust")) : v("djf-judul").trim(), target = v("djf-target") || (form.dataset.profil === "tracking" ? v("djt-kirim") || H.hariIni() : ""), kel = S.kelola ? v("djf-kel") || d.kelompokId : S.kelompokSaya;
  if (tr && rinci.jenis) { const t = rinci.tahap || {}; if ((rinci.vendor || rinci.plat || rinci.driver) && !t.siap) rinci.tahap = { ...t, siap: new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 16) }; } // armada terisi = Siap
  if (tr && jumlah > 1) { rinci.noDo = ""; rinci.dokNomor = []; rinci.kontainer = ""; } // beberapa pengiriman sekaligus: DO, dokumen, kontainer diisi menyusul di tiap pengiriman
  if (tr && !d.id && rinci.jenis === "distribusi" && form.dataset.awal && form.dataset.awal !== "baru") { // catat mundur: sudah terkirim / POD sudah kembali
    const waktu = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 16); let tmp = { ...d, status: "proses", rinci };
    for (const l of form.dataset.awal === "pod" ? ["terkirim", "pod"] : ["terkirim"]) { if (!LK.langkahTersedia(tmp).includes(l)) continue; const b = LK.blokir(tmp, l); if (b) return toast(b + (jumlah > 1 ? " (Jumlah lebih dari 1: pilih Baru dicatat, lalu tandai di daftar.)" : ""), "bahaya"); tmp = { ...tmp, rinci: LK.terapkan(tmp, l, waktu) }; }
    Object.assign(rinci, tmp.rinci);
  }
  if (tr) { const kurang = [[1, !v("djt-cust").trim(), "customer"], [1, !form.dataset.unit, "unit: pilih Internal atau Vendor"], [1, form.dataset.unit === "vendor" && !rinci.vendor, "nama vendor"], [1, !rinci.asal || !rinci.tujuan, "rute (Asal → Tujuan)"]].find((x) => x[1]); if (kurang) { langkahTracking(1); return toast("Isi " + kurang[2] + ".", "bahaya"); } }
  const baruKat = !tr && v("djf-kat") === "__baru", kat = baruKat ? H.rapikanKategori(v("djf-kat-baru"), katDari(kel)) : v("djf-kat");
  if (!judul) return toast("Isi judul job.", "bahaya");
  if (!kat) return toast("Isi nama kategori baru.", "bahaya");
  if (v("djf-status") === "tunggu" && !v("djf-tunda").trim()) return toast("Isi alasan job tertunda (menunggu apa).", "bahaya");
  if (!target) return toast("Isi target selesai.", "bahaya");
  if (!kel) return toast("Pilih kelompok. Buat kelompok dulu di tab Pengaturan.", "bahaya");
  if (v("djf-masuk") && target < v("djf-masuk")) return toast("Target selesai tidak boleh sebelum tanggal masuk.", "bahaya");
  const rp = tentukanPic(v("djf-pic"), d.pic, await muatRoster(kel), S.u.nama);
  if (!rp.ok) return toast(`PIC harus anggota kelompok ${namaKel(kel)}. Pilih dari daftar nama.`, "bahaya");
  const tombol = $("#dj-simpan"); tombol.disabled = true; tombol.textContent = "Menyimpan…";
  const kelObj = kelById(kel), kategoriBaru = baruKat && !katDari(kel).includes(kat), ajuanAda = kategoriBaru && !S.kelola ? S.ajuanKat.find((a) => a.kelompokId === kel && a.nama.toLowerCase() === kat.toLowerCase()) : null;
  const ajuanId = kategoriBaru && !S.kelola ? (ajuanAda ? ajuanAda.id : uid()) : kat === d.kategori ? d.kategoriAjuan || null : null; // anggota: kategori baru = ajuan, job tetap tersimpan
  try {
    if (kategoriBaru && S.kelola && kelObj) await simpanKat(kelObj, [...katDari(kel), kat]);
    if (kategoriBaru && !S.kelola && !ajuanAda) { const a = { kelompokId: kel, nama: kat, oleh: S.u.uid, olehNama: S.u.nama || S.u.email, dibuat: H.hariIni() }; await setDoc(doc(db, "dj_kategori_ajuan", ajuanId), a); S.ajuanKat.push({ id: ajuanId, ...a }); }
    const id = form.dataset.id || uid(), file = [...d.file];
    for (const b of berkasBaru) { const path = `dailyjob/${kel}/${id}/${Date.now()}-${b.name.replace(/[^\w.\-]+/g, "_")}`; file.push({ nama: b.name, path, url: await unggahBlob(path, b, b.type || "application/octet-stream"), ukuran: b.size, tipe: b.type || "", oleh: S.u.nama || S.u.email, tgl: H.hariIni() }); }
    const berubahTarget = !!d.id && !!d.tglTarget && d.tglTarget !== target, alasan = v("djf-alasan").trim();
    if (berubahTarget && !alasan && !adalahKepala(d)) { tombol.disabled = false; tombol.textContent = "Simpan"; return toast("Isi alasan perubahan target.", "bahaya"); }
    if (tr && rinci.jenis) rinci.berulang = TR.berulang(S.jobs, { id, customer: v("djt-cust").trim(), kategori: kat, rinci }); // customer, armada, unit, dan rute sama dengan pengiriman lain
    const status = tr && (rinci.jenis ? TL.selesaiOtomatis({ rinci }) : TR.selesaiOtomatis(rinci)) && v("djf-status") !== "batal" ? "selesai" : v("djf-status"), data = {
      judul, kategori: kat, kategoriAjuan: ajuanId, customer: tr ? v("djt-cust").trim() : v("djf-cust").trim(), ...(tr ? { rinci } : {}), pic: rp.pic, kelompokId: kel, deskripsi: v("djf-desk").trim(), tglMasuk: v("djf-masuk") || H.hariIni(), tglMulai: v("djf-mulai") || null, tglTarget: target,
      status, alasanTunda: status === "tunggu" ? v("djf-tunda").trim() : null, ...(!d.id || target !== d.tglTarget ? { targetTingkat: tingkatSaya(kel) } : {}), tglSelesai: status === "selesai" ? v("djf-selesai") || (tr && rinci.tglPod) || H.hariIni() : null, prioritas: v("djf-prio"), bobot: +v("djf-bobot") || 2, file, tautan: d.tautan, catatan: d.catatan || [],
      dibuatOleh: d.dibuatOleh || S.u.uid, dibuatNama: d.dibuatNama || S.u.nama || S.u.email, dibuatPada: d.dibuatPada || H.hariIni(), diubah: serverTimestamp(),
    };
    if (form.dataset.id) await updateDoc(doc(db, "dj_job", id), data); else await setDoc(doc(db, "dj_job", id), data); // ubah tidak boleh membuat dokumen baru
    for (let n = 1; n < jumlah; n++) { const nid = uid(), x = { ...data, rinci: { ...rinci } }; await setDoc(doc(db, "dj_job", nid), x); S.jobs.push({ id: nid, ...x, diubah: null }); } // pengiriman tambahan dengan rute sama
    if (berubahTarget) { const x = { uid: S.u.uid, oleh: S.u.nama || S.u.email, peran: adalahKepala(d) ? "kepala" : "anggota", jenis: "target", dari: d.tglTarget, ke: target, alasan, waktu: Date.now() }; await setDoc(doc(db, "dj_job", id, "aktivitas", uid()), x).catch((err) => console.warn(err)); if (S.detail && S.detail.id === id) S.detail.aktivitas.push(x); }
    const ada = S.jobs.findIndex((x) => x.id === id), baru = { ...(ada >= 0 ? S.jobs[ada] : {}), id, ...data, diubah: null };
    if (ada >= 0) S.jobs[ada] = baru; else S.jobs.push(baru); segarkanTautan(baru);
    if (!d.id) { S.hal = 0; S.status = "aktif"; S.antre = "aktif"; } // job baru langsung terlihat di paling atas
    tutupLayer(); render(); toast(jumlah > 1 ? `${jumlah} pengiriman tersimpan.` : "Job tersimpan.");
  } catch (err) { console.error(err); toast("Job belum tersimpan: " + pesanUnggah(err), "bahaya"); tombol.disabled = false; tombol.textContent = "Simpan"; }
}


/* ---------- PDF ---------- */
const tungguLib = async () => { for (let i = 0; i < 40 && !(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable); i++) await new Promise((r) => setTimeout(r, 250)); if (!(window.jspdf && window.jspdf.jsPDF.API.autoTable)) throw new Error("Pustaka PDF belum siap. Coba lagi sebentar lagi."); };
/** Ekspor Excel data shipment Tracking (kelompok dan subdivisi yang dilihat; periode: Performa = periode aktif, Daftar = filter periode daftar, "Semua" = tanpa batas). */
async function eksporExcel() {
  try {
    for (let i = 0; i < 40 && !window.XLSX; i++) await new Promise((r) => setTimeout(r, 250)); if (!window.XLSX) throw new Error("Pustaka Excel belum siap. Coba lagi sebentar lagi.");
    const now = H.hariIni(), per = S.tab === "performa" ? rentangAktif() : H.rentangDaftar(S.pDaftar, now, S.pDari, S.pSampai), js = jobsKel().filter((j) => !per || H.dalam(j.tglMasuk || j.dibuatPada, per)), lembar = lembarEkspor(js, S.sub, now), X = window.XLSX, wb = X.utils.book_new();
    if (!lembar.some(([, a]) => a.length > 1)) return toast("Belum ada data shipment pada periode ini.", "bahaya");
    lembar.forEach(([nama, aoa]) => { const ws = X.utils.aoa_to_sheet(aoa); ws["!cols"] = aoa[0].map((h, i) => ({ wch: Math.min(48, Math.max(h.length + 2, ...aoa.slice(1, 40).map((r) => String(r[i] ?? "").length + 2))) })); ws["!freeze"] = { xSplit: 0, ySplit: 1 }; X.utils.book_append_sheet(wb, ws, nama); });
    X.writeFile(wb, namaBerkas(S.sub, now)); toast("Excel shipment diunduh.");
  } catch (err) { console.error(err); toast("Excel belum jadi: " + e(err.message || err), "bahaya"); }
}
async function unduhPdf() {
  const tombol = $(".dj-pdf"); if (tombol) tombol.disabled = true;
  try {
    await tungguLib();
    const { buatLaporanPdf } = await import("./daily-job-pdf.js"), r = rentangAktif(), p = periodeAktif();
    const kel = S.fKel ? namaKel(S.fKel) : S.kelola ? "Semua kelompok" : namaKel(S.kelompokSaya);
    const filter = [S.fPic && "PIC: " + S.fPic, S.fKat && "Kategori: " + S.fKat].filter(Boolean).join(", ");
    if (profilAktif() === "tracking" && S.sub === "kecil") { const { buatLaporanDistribusiPdf } = await import("./daily-job-pdf-distribusi.js"), js = tampak(), ar = armadaKel(), pdf = buatLaporanDistribusiPdf({ jsPDF: window.jspdf.jsPDF, r, periode: p, now: H.hariIni(), pembuat: S.u.nama || S.u.email, filter, k: DZ.hitungDistribusi(js, r, H.hariIni()), arm: ar, rr: DZ.ringkasRiwayat(ar, r) }); return pdf.save(`laporan-truk-distribusi-${p === "bulan" ? r[0].slice(0, 7) : r[0] + "_" + r[1]}.pdf`); }
    if (profilAktif() === "tracking" && S.sub === "besar") { const { buatLaporanTrailerPdf } = await import("./daily-job-pdf-trailer.js"); const js = tampak(), pdf = buatLaporanTrailerPdf({ jsPDF: window.jspdf.jsPDF, jobs: js, r, periode: p, now: H.hariIni(), pembuat: S.u.nama || S.u.email, filter, k: TL.hitungTrailer(js, r, H.hariIni()), banding: TL.bandingTarif(js, r) }); return pdf.save(`laporan-tracking-trailer-${p === "bulan" ? r[0].slice(0, 7) : r[0] + "_" + r[1]}.pdf`); }
    const pdf = buatLaporanPdf({ jsPDF: window.jspdf.jsPDF, jobs: tampak(), r, periode: p, kelompok: kel, filter, now: H.hariIni(), pembuat: S.u.nama || S.u.email });
    pdf.save(`laporan-kinerja-daily-job-${p === "bulan" ? r[0].slice(0, 7) : r[0] + "_" + r[1]}.pdf`);
  } catch (err) { console.error(err); toast("PDF belum jadi: " + e(err.message || err), "bahaya"); }
  finally { if (tombol) tombol.disabled = false; }
}

/* ---------- import Excel (master/admin) ---------- */
const NAMA_TIM = "Marketing dan BD";
let rencana = null;
function panelImpor() {
  rencana = null;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Import dari Excel</h2><p class="mr-sub">Pakai template resmi (lembar "Input Tugas Harian"). Impor ulang file yang sama menimpa job impor sebelumnya, bukan menggandakan.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form"><div class="mr-f dj-lebar"><span>File Excel (.xlsx)</span><input type="file" id="dji-file" accept=".xlsx,.xls"><a class="mr-btn mr-btn--kecil dj-tmpl" href="templates/template-daily-job.xlsx" download>${ikon("download", 13)} Unduh template Excel</a><small class="mr-sub">Pakai template agar kolomnya seragam: ada pilihan Status, Prioritas, Bobot, dan petunjuk pengisian.</small></div>
  <label class="mr-f dj-lebar"><span>Masuk ke kelompok</span><select id="dji-kel">${opsi([...S.kelompok.map((k) => [k.id, k.nama]), ...(S.kelompok.some((k) => k.nama === NAMA_TIM) ? [] : [["__baru", `＋ Buat kelompok "${NAMA_TIM}"`]])], (S.kelompok.find((k) => k.nama === NAMA_TIM) || {}).id || "__baru")}</select></label>
  <div id="dji-hasil" class="dj-lebar mr-sub">${S.kelompok.length ? "Pilih file untuk melihat pratinjau." : "Pilih file untuk melihat pratinjau."}</div></div></div>
  <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="impor-jalan" id="dji-ok" disabled>Impor</button></footer>`);
  $("#dji-file").onchange = async (ev) => {
    const f = ev.target.files[0], out = $("#dji-hasil"); if (!f) return;
    try {
      for (let i = 0; i < 40 && !window.XLSX; i++) await new Promise((r) => setTimeout(r, 250));
      if (!window.XLSX) throw new Error("Pustaka Excel belum siap. Coba lagi sebentar lagi.");
      const wb = window.XLSX.read(await f.arrayBuffer(), { type: "array" });
      const nama = wb.SheetNames.find((n) => /input tugas/i.test(n)) || wb.SheetNames[0];
      const r = H.petaExcel(window.XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, raw: true, defval: "" }));
      if (r.galat) throw new Error(r.galat);
      const ada = r.jobs.filter((j) => S.jobs.some((x) => x.id === j.id)).length, sel = r.jobs.filter((j) => j.status === "selesai").length;
      rencana = r.jobs; out.innerHTML = `<b>${r.jobs.length} job</b> siap diimpor dari lembar "${e(nama)}": ${sel} selesai, ${r.jobs.length - sel} belum selesai.${ada ? `<br><b>${ada}</b> job impor sebelumnya akan ditimpa.` : ""}
        ${r.peringatan.length ? `<details><summary>${r.peringatan.length} catatan perlu dicek</summary>${r.peringatan.map((x) => `<div>${e(x)}</div>`).join("")}</details>` : ""}`;
      $("#dji-ok").disabled = !r.jobs.length;
    } catch (err) { rencana = null; $("#dji-ok").disabled = true; out.textContent = "File belum bisa dibaca: " + (err.message || err); }
  };
}
async function jalankanImpor() {
  let kel = $("#dji-kel").value; const tombol = $("#dji-ok"); if (!rencana || !kel) return;
  tombol.disabled = true; tombol.textContent = "Mengimpor…"; let n = 0;
  try {
    if (kel === "__baru") { kel = uid(); await setDoc(doc(db, "dj_kelompok", kel), { nama: NAMA_TIM, dibuat: H.hariIni() }); S.kelompok.push({ id: kel, nama: NAMA_TIM, dibuat: H.hariIni() }); }
    const sekarang = H.hariIni();
    for (let i = 0; i < rencana.length; i += 15) await Promise.all(rencana.slice(i, i + 15).map(async (j) => {
      const id = `imp-${kel}-${j.id}`, { id: _nomor, ...isi } = j, data = { ...isi, kelompokId: kel, tglMasuk: j.tglMasuk || sekarang, dibuatOleh: S.u.uid, dibuatNama: "Import Excel", dibuatPada: sekarang, diimpor: true, targetTingkat: tingkatSaya(kel), diubah: serverTimestamp() };
      await setDoc(doc(db, "dj_job", id), data); n++;
      const ada = S.jobs.findIndex((x) => x.id === id), baru = { ...data, id, diubah: null }; if (ada >= 0) S.jobs[ada] = baru; else S.jobs.push(baru);
    }));
    tutupLayer(); S.pDaftar = "rentang"; const t = S.jobs.filter((x) => x.diimpor).map((x) => x.tglMasuk).sort(); S.pDari = t[0]; S.pSampai = H.hariIni(); render(); toast(`${n} job diimpor.`);
  } catch (err) { console.error(err); toast(`Impor berhenti setelah ${n} job: ` + e(err.message || err), "bahaya"); tombol.disabled = false; tombol.textContent = "Impor"; }
}

/* ---------- aksi ---------- */
/* ---------- aksi daftar: pilih banyak, selesai, ubah PIC, bagikan, hapus ---------- */
const jobId = (id) => S.jobs.find((x) => x.id === id);
const idsAksi = (id) => (id ? [id] : [...S.pilih]);
function selesaiPilih() { S.pilih.clear(); S.modePilih = false; S.menu = ""; render(); }
function mulaiPilih(id) { S.modePilih = true; S.menu = ""; if (id) S.pilih.add(id); render(); }
function pilihHalaman() { const l = dataDaftar(H.hariIni()).halaman, semua = l.length && l.every((j) => S.pilih.has(j.id)); l.forEach((j) => (semua ? S.pilih.delete(j.id) : S.pilih.add(j.id))); S.modePilih = true; render(); }
function togglePilih(id) { S.pilih.has(id) ? S.pilih.delete(id) : S.pilih.add(id); if (!S.pilih.size && matchMedia("(max-width: 760px)").matches) S.modePilih = false; render(); }
async function ubahBanyak(ids, data, ok) {
  try {
    await Promise.all(ids.map((id) => updateDoc(doc(db, "dj_job", id), { ...data, diubah: serverTimestamp() })));
    ids.forEach((id) => { const j = jobId(id); if (j) { Object.assign(j, data, { diubah: null }); segarkanTautan(j); } });
    selesaiPilih(); toast(ok);
  } catch (err) { console.error(err); toast("Belum tersimpan: " + e(err.message || err), "bahaya"); }
}
const selesaikan = (ids) => { const a = ids.filter((id) => jobId(id) && H.aktif(jobId(id))); if (!a.length) return toast("Job yang dipilih sudah selesai atau dibatalkan."); return ubahBanyak(a, { status: "selesai", tglSelesai: H.hariIni() }, `${a.length} job ditandai selesai.`); };
function panelPic(ids) {
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Ubah PIC</h2><p class="mr-sub">${ids.length} job dipilih. PIC baru menggantikan PIC sebelumnya.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form" style="grid-template-columns:1fr"><label class="mr-f"><span>PIC baru</span><input id="djp-pic" list="djp-list" maxlength="40" placeholder="Nama PIC" autocomplete="off"><datalist id="djp-list">${daftarPic().map((x) => `<option value="${e(x)}">`).join("")}</datalist></label></div></div>
  <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="pic-simpan" data-ids="${e(ids.join(","))}">Simpan</button></footer>`);
}
async function bagikanJob(ids) {
  const jl = ids.map(jobId).filter(Boolean); if (!jl.length) return;
  const teks = H.teksBagikan(jl, (t) => (t ? fmtTgl(t) : "-"));
  if (navigator.share) { try { await navigator.share({ title: "Daily Job", text: teks }); return; } catch (err) { if (err && err.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(teks); toast("Ringkasan job disalin. Tempel ke WhatsApp atau email."); }
  catch (_) { window.open("https://wa.me/?text=" + encodeURIComponent(teks), "_blank", "noopener"); }
}
async function hapusJob(ids) {
  const n = ids.length; if (!(await konfirmasi(`Hapus ${n} job?`, `${n === 1 ? "Job dan catatannya" : n + " job beserta catatannya"} dihapus permanen. File di Storage tidak ikut dihapus.`, "Hapus"))) return;
  try { await Promise.all(ids.map((id) => deleteDoc(doc(db, "dj_job", id)))); S.jobs = S.jobs.filter((x) => !ids.includes(x.id)); selesaiPilih(); toast(`${n} job dihapus.`); }
  catch (err) { toast("Belum bisa dihapus: " + e(err.message || err), "bahaya"); }
}

/* HP: geser kanan = aksi (Selesai, Ubah, Bagikan), geser kiri = Hapus, tekan lama = pilih banyak */
let sw = null, blokKlik = 0;
const tutupRw = (rw) => setTimeout(() => rw && !rw.querySelector(".is-geser-aksi, .is-geser-hapus") && rw.classList.remove("is-buka"), 260);
const tutupGeser = () => { S.terbuka = ""; document.querySelectorAll(".dj-job2.is-geser-aksi, .dj-job2.is-geser-hapus").forEach((el) => { el.classList.remove("is-geser-aksi", "is-geser-hapus"); el.style.transform = ""; tutupRw(el.parentElement); }); };
document.addEventListener("touchstart", (ev) => {
  if (window.__rute !== "dailyjob") return;
  const el = ev.target.closest(".dj-job2");
  if (S.terbuka && (!el || el.dataset.id !== S.terbuka) && !ev.target.closest(".dj-sw")) tutupGeser();
  if (!el || ev.target.closest("input")) { sw = null; return; }
  const t = ev.touches[0], id = el.dataset.id, rw = el.parentElement, wa = +rw.dataset.wa || 0, wh = +rw.dataset.wh || 0;
  sw = { el, id, x: t.clientX, y: t.clientY, dx: 0, mode: "", wa, wh, dasar: S.terbuka === id ? (S.sisi === "aksi" ? wa : -wh) : 0 };
  sw.lama = setTimeout(() => { if (sw && !sw.mode) { sw.mode = "tekan"; blokKlik = Date.now(); if (navigator.vibrate) navigator.vibrate(15); pilihAktif() ? togglePilih(sw.id) : mulaiPilih(sw.id); } }, 480);
}, { passive: true });
document.addEventListener("touchmove", (ev) => {
  if (!sw) return; const t = ev.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (!sw.mode) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(sw.lama); sw = null; return; } if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3 && !pilihAktif()) { clearTimeout(sw.lama); sw.mode = "geser"; sw.el.style.transition = "none"; sw.el.parentElement.classList.add("is-buka"); } else return; }
  if (sw.mode !== "geser") return; ev.preventDefault(); sw.dx = dx;
  sw.el.style.transform = `translateX(${Math.max(-sw.wh, Math.min(sw.wa, sw.dasar + dx))}px)`;
}, { passive: false });
document.addEventListener("touchend", () => {
  if (!sw) return; clearTimeout(sw.lama); const { el, id, dasar, dx, mode, wa, wh } = sw; sw = null; if (mode !== "geser") return;
  blokKlik = Date.now(); el.style.transition = ""; const akhir = dasar + dx; el.style.transform = "";
  if (wa && akhir > wa * 0.4) { tutupGeser(); S.terbuka = id; S.sisi = "aksi"; el.classList.add("is-geser-aksi"); el.parentElement.classList.add("is-buka"); }
  else if (wh && akhir < -wh * 0.4) { tutupGeser(); S.terbuka = id; S.sisi = "hapus"; el.classList.add("is-geser-hapus"); el.parentElement.classList.add("is-buka"); }
  else { if (S.terbuka === id) { S.terbuka = ""; el.classList.remove("is-geser-aksi", "is-geser-hapus"); } tutupRw(el.parentElement); }
});
/* petunjuk sekali saja: kartu pertama bergeser sedikit supaya orang tahu bisa digeser */
let sudahIntip = false;
function intipGeser() {
  if (sudahIntip) return; sudahIntip = true;
  try { if (localStorage.getItem("isldj-geser")) return; localStorage.setItem("isldj-geser", "1"); } catch (_) { return; }
  const el = document.querySelector(".dj-job2"); if (!el) return;
  setTimeout(() => { el.parentElement.classList.add("is-buka"); el.classList.add("is-intip"); setTimeout(() => { el.classList.remove("is-intip"); tutupRw(el.parentElement); }, 900); }, 600);
}
document.addEventListener("contextmenu", (ev) => { if (window.__rute === "dailyjob" && ev.target.closest(".dj-job2")) ev.preventDefault(); });
if (!window.__djHuruf) { window.__djHuruf = true; document.addEventListener("input", aturHuruf); } // satu pendengar untuk seluruh formulir Tracking
const UBAH_DJ = new Set(["g-baru", "g-ubah", "g-simpan", "g-hapus", "t-podfoto", "a-lk-terkirim", "a-lk-pod", "a-lk-bayar", "m-lk-terkirim", "m-lk-pod", "m-lk-bayar", "t-resi", "t-bayar", "pod-simpan", "arm-baru", "arm-ubah", "arm-simpan", "arm-hapus", "arm-tugas", "arm-tugas-simpan", "baru", "simpan", "hapus", "a-selesai", "a-ubah", "a-hapus", "m-selesai", "m-pic", "m-hapus", "pic-simpan", "d-nilai", "d-target", "target-simpan", "d-unggah", "file-lepas", "tautan-lepas", "tautan-tambah", "impor", "impor-jalan", "masalah-hapus", "b-toggle", "b-cabut", "a-bagikan", "m-bagikan"]);
const periksa = (ev) => window.__rute === "dailyjob" || ev.target.closest("#mr-layer");
document.addEventListener("click", async (ev) => {
  if (!periksa(ev)) return;
  if (S.menu && !ev.target.closest(".dj-mw")) { S.menu = ""; render(); if (!ev.target.closest("[data-dj]") || ev.target.closest('[data-dj="buka"]')) return; } // klik di luar menu: tutup saja
  const t = ev.target.closest("[data-dj]"); if (!t) return;
  const a = t.dataset.dj, id = t.dataset.id, v = t.dataset.v;
  if (t.tagName === "SELECT" || t.tagName === "INPUT") return;
  if (S.lihatSaja && UBAH_DJ.has(a)) return toast("Akses Daily Job akun ini lihat saja.", "bahaya"); // server juga menolak (firestore.rules)
  if (a === "tab") { if (v === "kelompok" && !S.kelola) return; S.tab = v; S.detail = null; render(); if (v === "kelompok") kepalaDi().forEach((k) => muatTim(k.id)); return; }
  if (a === "baru") return formJob(null);
  if (a === "g-baru") return formGiat(null);
  if (a === "g-ubah") return formGiat(giatId(id));
  if (a === "g-simpan") return simpanGiat(id);
  if (a === "g-hapus") return hapusGiat(id);
  if (a === "g-hari") { S.gPilih = v; return render(); }
  if (a === "g-geser") { S.gAwal = +v ? H.tambahHari(S.gAwal || H.hariIni(), +v) : H.hariIni(); S.gPilih = S.gAwal; return render(); }
  if (a === "g-f") { S.gF = v; return render(); }
  if (a === "g-jenis") { const f = $("#g-form"), dok = v === "dokumen"; f.dataset.jenis = v; f.querySelectorAll(".dj-gt__b").forEach((b) => b.classList.toggle("is-aktif", b.dataset.v === v)); f.querySelector(".dj-g-kend").classList.toggle("dj-sembunyi", !(dok || ["servis", "gps", "storing"].includes(v))); f.querySelector(".dj-g-kend").classList.add("dj-lebar"); f.querySelectorAll(".dj-g-dok").forEach((x) => x.classList.toggle("dj-sembunyi", !dok)); return; }
  if (a === "menu") { S.menu = S.menu === id ? "" : id; return render(); }
  if (a === "periode") { S.periode = v; if (v === "rentang" && !S.dari) [S.dari, S.sampai] = H.rentang("bulan"); render(); return panelFilter(); }
  if (a === "k-selesai") { S.status = "selesai"; S.masalah = ""; S.hal = 0; S.tab = "job"; return render(); }
  if (a === "k-telat") { S.status = "aktif"; S.masalah = "telat"; S.hal = 0; S.tab = "job"; return render(); }
  if (a === "kat") { S.fKat = S.fKat === v ? "" : v; return render(); }
  if (a === "pic") { S.fPic = S.fPic === v ? "" : v; return render(); }
  if (a === "t-set") return aturChipTracking(t);
  if (a === "t-dok-tambah" || a === "t-dok-hapus") return ubahDok(a, t);
  if (a === "arm-sub") { S.subArm = v; return render(); }
  if (a === "pdz-sub") { S.subPdz = v; return render(); }
  if (a === "arm-baru" || a === "arm-ubah") return formKendaraan(a === "arm-ubah" ? armadaId(id) : null);
  if (a === "arm-simpan") return simpanKendaraan(id);
  if (a === "arm-hapus") return hapusKendaraan(id);
  if (a === "arm-tugas") return panelTugas(id, v);
  if (a === "arm-tugas-simpan") return simpanTugas(id, v);
  if (a === "t-tahap" || a === "t-undo" || a === "t-dok" || a === "t-titik") return ubahTahap(a, id, t.dataset.i);
  if (a === "t-resi" || a === "t-bayar" || a === "t-podfoto") return panelPod(a === "t-resi" ? "resi" : a === "t-bayar" ? "bayar" : "foto", id);
  if (a === "pod-simpan") return simpanPod(v, id);
  if (a === "t-tambah" || a === "t-hapus") return ubahTitik(a, t);
  if (a === "t-jml") return ubahJumlah(+v);
  if (a === "rute-pilih") return pilihRute(+t.dataset.i);
  if (a === "rute-baru") return ruteBaru();
  if (a === "t-next") { const f = $("#dj-form"); return langkahTracking(Math.min(3, (f._lg || 1) + 1)); }
  if (a === "t-prev") { const f = $("#dj-form"); return langkahTracking(Math.max(1, (f._lg || 1) - 1)); }
  if (a === "f-sub") { S.sub = v; S.fKat = ""; S.hal = 0; render(); return panelFilter(); }
  if (a === "sub") { S.sub = v; S.menu = ""; S.hal = 0; S.fKat = ""; return render(); }
  if (a === "antre") { S.antre = v; S.hal = 0; S.pilih.clear(); return render(); }
  if (a === "hal" || a === "hal-ke") { S.hal = Math.max(0, a === "hal" ? S.hal + +v : +v); render(); return window.scrollTo({ top: 0 }); }
  if (a === "cb0") return pilihAktif() ? togglePilih(id) : mulaiPilih(id);
  if (a === "push" || a === "impor" || a === "pdf" || a === "ekspor") { S.menu = ""; render(); }
  if (a === "buka") { if (Date.now() - blokKlik < 500) return; if (S.terbuka) return tutupGeser(); if (pilihAktif()) return togglePilih(id); return bukaDetail(id); }
  if (a === "d-tutup") { S.detail = null; return render(); }
  if (a === "d-berkas") { S.detail.berkas = +t.dataset.i; render(); return; }
  if (a === "d-kertas") { S.detail.kertas = S.detail.kertas === "putih" ? "ikut" : "putih"; const v1 = $(".dj-vw"); if (v1) v1.classList.toggle("dj-vw--putih", S.detail.kertas === "putih"); return; }
  if (a === "d-unggah") return $("#dj-up") && $("#dj-up").click();
  if (a === "d-nilai") { S.detail.nilai = S.detail.nilai === v ? "" : v; return segarkanKanan(); }
  if (a === "d-kirim") return kirimKomentar();
  if (a === "d-target") return panelTarget(S.detail.id);
  if (a === "target-simpan") return simpanTarget(id);
  if (a === "b-toggle") return ubahTautan(id, jobId(id).bagikan && jobId(id).bagikan.berlakuSampai > Date.now() ? "cabut" : "buat");
  if (a === "b-unduh") return ubahTautan(id, "unduh");
  if (a === "b-cabut") return ubahTautan(id, "cabut");
  if (a === "b-kirim") return kirimTautan(id);
  if (a === "b-teks") { tutupLayer(); return bagikanJob([id]); }
  if (a === "b-salin") { const u = $("#djb-url"); try { await navigator.clipboard.writeText(u.value); toast("Tautan disalin."); } catch (_) { u.select(); document.execCommand("copy"); toast("Tautan disalin."); } return; }
  if (a === "cb-semua") return pilihHalaman();
  if (a === "pilih-batal") return selesaiPilih();
  if (a === "a-selesai") { ev.stopPropagation(); S.menu = ""; S.terbuka = ""; return selesaikan([id]); }
  if (a.startsWith("a-lk-") || a.startsWith("m-lk-")) { ev.stopPropagation(); S.menu = ""; S.terbuka = ""; return tandaiLangkah(a.startsWith("a-") ? [id] : idsAksi(), a.slice(5)); }
  if (a === "a-ubah") { ev.stopPropagation(); S.menu = ""; S.terbuka = ""; render(); const j = jobId(id); return j && formJob(j); }
  if (a === "a-bagikan") { ev.stopPropagation(); S.menu = ""; S.terbuka = ""; render(); return panelBagikan(id); }
  if (a === "a-hapus") { ev.stopPropagation(); S.menu = ""; S.terbuka = ""; render(); return hapusJob([id]); }
  if (a === "m-selesai") return selesaikan(idsAksi());
  if (a === "m-pic") return panelPic(idsAksi());
  if (a === "m-bagikan") return bagikanJob(idsAksi());
  if (a === "m-hapus") return hapusJob(idsAksi());
  if (a === "pic-simpan") {
    const ketik = (($("#djp-pic") || {}).value || "").trim(); if (!ketik) return toast("Isi nama PIC.", "bahaya"); const ids = t.dataset.ids.split(","); let pic = ketik;
    for (const kid of new Set(ids.map((x) => (jobId(x) || {}).kelompokId))) { const r = tentukanPic(ketik, "", await muatRoster(kid), S.u.nama); if (!r.ok) return toast(`PIC harus anggota kelompok ${namaKel(kid)}.`, "bahaya"); pic = r.pic; }
    tutupLayer(); return ubahBanyak(ids, { pic }, "PIC diperbarui.");
  }
  if (a === "st") { S.status = v; S.hal = 0; S.pilih.clear(); render(); return t.closest("#dj-sheet") ? panelFilterJob() : undefined; }
  if (a === "pd") { S.pDaftar = v; S.hal = 0; if (v === "rentang" && !S.pDari) [S.pDari, S.pSampai] = H.rentang("bulan"); render(); return panelFilterJob(); }
  if (a === "masalah-hapus") { S.masalah = ""; S.hal = 0; return render(); }
  if (a === "f-picchip") { S.fPic = v; S.hal = 0; render(); return panelAktif(); }
  if (a === "pdf") return unduhPdf();
  if (a === "ekspor") return eksporExcel();
  if (a === "push") {
    const st = statusPush(S.u.uid);
    if (st === "aktif") { if (await konfirmasi("Matikan notifikasi?", "Perangkat ini tidak lagi menerima pengingat Daily Job.", "Matikan")) { await matikanPush(S.u.uid); render(); toast("Notifikasi dimatikan di perangkat ini."); } return; }
    if (st === "iphone-pasang") return toast("Di iPhone, tambahkan ISL HUB ke Layar Utama dulu (Bagikan, lalu Tambah ke Layar Utama), buka dari ikon itu, lalu aktifkan notifikasi.", "info");
    if (st === "tidak-didukung") return toast("Browser ini belum mendukung notifikasi. Pakai Chrome, Edge, atau Safari terbaru.", "bahaya");
    if (st === "diblokir") return toast("Notifikasi diblokir untuk situs ini. Izinkan di pengaturan browser (ikon gembok di alamat), lalu coba lagi.", "bahaya");
    try { await aktifkanPush(S.u.uid); render(); toast("Notifikasi aktif di perangkat ini: pengingat 09.00, 14.00, 17.00 dan deadline H-1."); } catch (err) { console.error(err); toast("Notifikasi belum aktif: " + e(err.message || err), "bahaya"); } return;
  }
  if (a === "filter") return panelAktif();
  if (a === "sheet-tutup") return tutupSheet();
  if (a === "kat-ubah") return panelUbahKat(t);
  if (a === "kat-hapus") return panelHapusKat(t);
  if (a === "kat-ubah-ok") return ubahKat(t);
  if (a === "kat-hapus-ok") return hapusKat(t);
  if (a === "kat-tambah") return tambahKat(t);
  if (a === "ajuan-ok" || a === "ajuan-tolak") return putusAjuan(id, a === "ajuan-ok");
  if (a === "filter-reset") { S.fPic = ""; S.fKat = ""; S.periode = "bulan"; S.pDaftar = "semua"; S.masalah = ""; S.hal = 0; if (S.kelola) S.fKel = ""; render(); return panelAktif(); }
  if (a === "impor") return panelImpor();
  if (a === "impor-jalan") return jalankanImpor();
  if (a === "simpan") return simpanJob();
  const d = $("#dj-form") && $("#dj-form")._d;
  if (a === "file-lepas") { d.file.splice(+t.dataset.i, 1); return t.closest(".dj-fl").remove(); }
  if (a === "tautan-lepas") { d.tautan.splice(+t.dataset.i, 1); return t.closest(".dj-fl").remove(); }
  if (a === "baru-lepas") { berkasBaru.splice(+t.dataset.i, 1); return tampilBaru(); }
  if (a === "tautan-tambah") { const u = $("#djf-tl").value.trim(); if (!/^https?:\/\//i.test(u)) return toast("Tautan harus diawali http:// atau https://", "bahaya"); d.tautan.push({ url: u, nama: u.replace(/^https?:\/\//, "").slice(0, 60) }); $("#djf-tl").value = ""; return $("#djf-tautan").insertAdjacentHTML("beforeend", `<div class="dj-fl"><a href="${aman(u)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(u.slice(0, 60))}</a><span class="mr-sub">disimpan saat Simpan</span></div>`); }
  if (a === "hapus") { if (!(await konfirmasi("Hapus job ini?", "Job dan catatannya dihapus permanen. File di Storage tidak ikut dihapus.", "Hapus"))) return; try { await deleteDoc(doc(db, "dj_job", id)); S.jobs = S.jobs.filter((x) => x.id !== id); tutupLayer(); render(); toast("Job dihapus."); } catch (err) { toast("Belum bisa dihapus: " + e(err.message || err), "bahaya"); } return; }
  if (a === "tim-toggle") { const x = anggotaDi(t.dataset.k, id); if (!x) return; const mati = x.status === "aktif";
    if (!(await konfirmasi(mati ? "Nonaktifkan akun?" : "Aktifkan akun?", `${e(x.nama)} ${mati ? "tidak bisa masuk sampai diaktifkan lagi." : "bisa masuk lagi."}`, mati ? "Nonaktifkan" : "Aktifkan"))) return;
    try { await panggil("djAturAnggota", { uid: id, aksi: mati ? "nonaktif" : "aktif" }); toast(mati ? "Akun dinonaktifkan." : "Akun diaktifkan."); muatTim(t.dataset.k); } catch (err) { toast(e(err.message), "bahaya"); } return; }
  if (a === "subkel") { S.subKel = v; render(); return; }
  if (a === "kel-pilih") { S.pilihKel = id; render(); return; }
  if (a === "kel-baru" || a === "kel-ubah") return bukaFormKelompok(a === "kel-ubah" ? S.kelompok.find((x) => x.id === id) : null, { sesudah: muat }); // form sama dengan Pengaturan > Akun dan akses
  if (a === "kel-hapus") { const k = S.kelompok.find((x) => x.id === id); if (k && await hapusKelompok(k)) await muat(); } // hanya bila kosong (anggota dan job)
});
document.addEventListener("keydown", (ev) => { if (window.__rute === "dailyjob" && (ev.key === "Enter" || ev.key === " ") && ev.target.matches?.('.dj-job2[data-dj="buka"], .dj-tb tr[data-dj]')) { ev.preventDefault(); ev.target.click(); } if (ev.key === "Escape") { if ($("#dj-sheet")) tutupSheet(); else if (S.menu) { S.menu = ""; render(); } } });
document.addEventListener("change", async (ev) => {
  if (window.__rute !== "dailyjob") return;
  const t = ev.target, a = t.dataset && t.dataset.dj;
  if (a === "b-hari") { if (t.value) ubahTautan(t.dataset.id, "hari", +t.value); return; }
  if (t.id === "dj-up") { const f = [...t.files]; t.value = ""; return unggahBerkas(f); }
  const dalamPanel = !!t.closest("#dj-sheet"), seg = () => { S.hal = 0; render(); if (dalamPanel) panelAktif(); };
  if (a === "f-kat") { S.fKat = t.value; return seg(); }
  if (a === "f-kel") { S.fKel = t.value; S.fPic = ""; return seg(); }
  if (a === "f-pic") { S.fPic = t.value; return seg(); }
  if (t.id === "dj-dari" || t.id === "dj-sampai") { S[t.id === "dj-dari" ? "dari" : "sampai"] = t.value; return seg(); }
  if (t.id === "dj-pdari" || t.id === "dj-psampai") { S[t.id === "dj-pdari" ? "pDari" : "pSampai"] = t.value; return seg(); }
  if (a === "kel-aktif") { S.kelAktif = t.value; S.sub = ""; S.fPic = ""; S.fKat = ""; S.hal = 0; S.pilih.clear(); S.modePilih = false; try { localStorage.setItem("dj-kel", t.value); } catch (_) {} return render(); }
  if (a === "kel-profil") { try { await updateDoc(doc(db, "dj_kelompok", t.dataset.id), { profil: t.value }); const k = S.kelompok.find((x) => x.id === t.dataset.id); if (k) k.profil = t.value; toast("Profil kelompok diperbarui."); render(); } catch (err) { toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } return; }
  if (a === "cb") return togglePilih(t.dataset.id);
  if (a === "cb-semua") return pilihHalaman();
  if (a === "kel-atur") { S.kelAtur = t.value; return render(); }
  if (a === "tgt-kat") return simpanTargetKat(t);
  if (a === "kep-akun") {
    const ak = S.akun.find((x) => x.id === t.dataset.id), kel = ak && S.kelompok.find((k) => k.id === ak.kelompokDJ); if (!kel) return;
    const kepala = t.checked ? [ak.id] : []; // satu kepala divisi per kelompok
    try { await setDoc(doc(db, "dj_kelompok", kel.id), { kepala }, { merge: true }); kel.kepala = kepala; toast(t.checked ? "Ditetapkan sebagai kepala divisi (menggantikan yang lama)." : "Kepala divisi dikosongkan."); render(); } catch (err) { t.checked = !t.checked; toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } return;
  }
  if (a === "kel-akun") { try { await updateDoc(doc(db, "pengguna", t.dataset.id), { kelompokDJ: t.value || null }); const ak = S.akun.find((x) => x.id === t.dataset.id); if (ak) ak.kelompokDJ = t.value || null; toast("Kelompok akun diperbarui."); } catch (err) { toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } }
});
document.addEventListener("input", (ev) => { if (window.__rute === "dailyjob" && ev.target.id === "dj-cari") { S.cari = ev.target.value; S.hal = 0; const p = ev.target.selectionStart; render(); const n = $("#dj-cari"); if (n) { n.focus(); n.setSelectionRange(p, p); } } });

/* ---------- pintu masuk ---------- */
export async function mulaiDailyJob(user, profil) {
  S.u = { uid: user.uid, email: user.email, nama: namaAkun(profil, user) };
  S.kelola = !!window.__ISL_KELOLA; S.kelompokSaya = (profil && profil.kelompokDJ) || null; S.lihatSaja = !S.kelola && !!profil && !!profil.akses && profil.akses.dj === 1;
  $("#user-email").textContent = labelAkun(user.email, user.displayName); renderNav("dailyjob");
  const el = $("#dj-root"); if (el && !el.dataset.siap) el.dataset.siap = "1";
  if (window.__djBukaForm) { window.__djBukaForm = false; await muat(); if (S.kelola || S.kelompokSaya) formJob(null); return; }
  await muat();
}

/* ---------- pengingat catat job: 09.00, 14.00, 17.00 WIB ---------- */
const TUTUP_PENGINGAT_MS = 30000; // pengingat 09.00, 14.00, 17.00 menutup sendiri setelah 30 detik
export function pasangPengingat(user, profil) {
  const kelompok = (profil && profil.kelompokDJ) || null, kelola = !!window.__ISL_KELOLA;
  if (!kelompok && !kelola) return;
  const kunci = "dj-pengingat:" + user.uid, baca = () => { try { return JSON.parse(localStorage.getItem(kunci) || "[]"); } catch (_) { return []; } };
  const tandai = (k) => { try { localStorage.setItem(kunci, JSON.stringify([...baca().filter((x) => x.startsWith(H.hariIni())), k])); } catch (_) { /* tanpa penyimpanan: pengingat muncul lagi saat dibuka */ } };
  const cek = async () => {
    const k = H.slotJatuhTempo(baca()); if (!k || document.getElementById("dj-ingat")) return;
    let p = { terlambat: [], hariIni: [] };
    try { const q = kelola ? collection(db, "dj_job") : query(collection(db, "dj_job"), where("kelompokId", "==", kelompok)); p = H.pengingat((await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }))); } catch (_) { /* tetap ingatkan mencatat */ }
    const jam = k.split("#")[1].padStart(2, "0") + ".00";
    const kotak = document.createElement("div"); kotak.id = "dj-ingat"; kotak.className = "dj-ingat"; kotak.setAttribute("role", "alertdialog");
    /* pita tipis di atas konten (desain 1): tidak menutupi isi di HP */
    kotak.innerHTML = `<span class="dj-ingat__teks"><b>Pengingat ${jam}</b> · ${p.terlambat.length} terlambat · ${p.hariIni.length} hari ini</span><button type="button" class="mr-btn mr-btn--utama dj-ingat__aksi" data-x="catat">Catat</button><button type="button" class="dj-ingat__x" data-x="nanti" aria-label="Tutup pengingat">✕</button>`;
    document.body.appendChild(kotak);
    const otomatis = setTimeout(() => { if (kotak.isConnected) { tandai(k); kotak.remove(); } }, TUTUP_PENGINGAT_MS); // tutup sendiri; dianggap "nanti"
    kotak.querySelector('[data-x="catat"]').onclick = () => { clearTimeout(otomatis); tandai(k); kotak.remove(); if (window.__rute === "dailyjob") { window.__djBukaForm = false; formJob(null); } else { window.__djBukaForm = true; location.hash = "#dailyjob"; } };
    kotak.querySelector('[data-x="nanti"]').onclick = () => { clearTimeout(otomatis); tandai(k); kotak.remove(); };
  };
  jagaPush(user.uid, (h) => toast(h)); // perbarui token notifikasi; pesan saat aplikasi terbuka jadi toast
  cek(); setInterval(cek, 60000);
}
