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
import { db } from "./firebase-config.js";
import { unggahBlob } from "./app-store.js";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as H from "./daily-job-hitung.js";
import { statusPush, aktifkanPush, matikanPush, jagaPush } from "./daily-job-push.js";

const S = { u: null, kelola: false, kelompokSaya: null, kelompok: [], jobs: [], akun: [], tab: "performa", periode: "bulan", dari: "", sampai: "", fKel: "", fPic: "", fKat: "", fStatus: "aktif", kel: "kategori", buka: {}, cari: "", muat: false, galat: "" };
const uid = () => "dj" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtTgl = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const namaKel = (id) => (S.kelompok.find((k) => k.id === id) || {}).nama || "–";
const aman = (u) => (/^https?:\/\//i.test(String(u || "")) ? e(u) : "#"); // hanya tautan http(s) yang dibuka
const rentangAktif = () => (S.periode === "rentang" && S.dari && S.sampai ? [S.dari, S.sampai] : H.rentang(S.periode === "rentang" ? "bulan" : S.periode));

/* ---------- data ---------- */
async function muat() {
  S.muat = true; S.galat = ""; render();
  try {
    const ks = await getDocs(collection(db, "dj_kelompok"));
    S.kelompok = ks.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    const q = S.kelola ? collection(db, "dj_job") : S.kelompokSaya ? query(collection(db, "dj_job"), where("kelompokId", "==", S.kelompokSaya)) : null;
    S.jobs = q ? (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() })) : [];
    if (S.kelola) S.akun = (await getDocs(collection(db, "pengguna"))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.status === "aktif").sort((a, b) => String(a.nama || a.email).localeCompare(String(b.nama || b.email), "id"));
  } catch (err) { console.error(err); S.galat = "Data Daily Job belum bisa dibaca. Pemilik perlu memasang aturan Firestore terbaru (firebase deploy --only firestore:rules,storage)."; }
  S.muat = false; render();
}
const tampak = () => S.jobs.filter((j) => (!S.fKel || j.kelompokId === S.fKel) && (!S.fPic || j.pic === S.fPic) && (!S.fKat || j.kategori === S.fKat));
const daftarPic = () => [...new Set(S.jobs.filter((j) => !S.fKel || j.kelompokId === S.fKel).map((j) => j.pic).filter(Boolean))].sort();

/* ---------- tampilan ---------- */
const opsi = (arr, sel, semua) => `${semua ? `<option value="">${e(semua)}</option>` : ""}${arr.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${e(v)}"${String(v) === String(sel) ? " selected" : ""}>${e(t)}</option>`; }).join("")}`;
const chipT = (j, now) => { const l = H.labelTarget(j, now); return `<span class="dj-chip dj-chip--${l.k || "info"}">${e(l.t)}</span>`; };

function barisJob(j, now) {
  return `<div class="dj-job dj-job--${H.terlambat(j, now) ? "telat" : j.status === "selesai" ? "ok" : "aktif"}" data-dj="buka" data-id="${e(j.id)}" tabindex="0" role="button">
    <div class="dj-job__isi"><b>${e(j.judul)}</b><small>${[j.customer, j.kategori, j.pic, S.kelola && !S.fKel ? namaKel(j.kelompokId) : ""].filter(Boolean).map(e).join(" · ")}</small>
    <small>Target ${fmtTgl(j.tglTarget)}${(j.file || []).length || (j.tautan || []).length ? ` · ${ikon("file", 12)} ${(j.file || []).length + (j.tautan || []).length}` : ""}</small></div>
    <div class="dj-job__aksi">${chipT(j, now)}${H.aktif(j) ? `<button type="button" class="mr-ikonbtn" data-dj="selesai" data-id="${e(j.id)}" title="Tandai selesai" aria-label="Tandai selesai">${ikon("cek", 16)}</button>` : ""}</div></div>`;
}

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
    <div class="dj-lg dj-lg--w"><span><i style="background:var(--success)"></i>Selesai ${st.selesai}</span><span><i style="background:var(--sky)"></i>Dikerjakan ${st.proses}</span><span><i style="background:var(--accent)"></i>Menunggu ${st.tunggu}</span><span><i style="background:var(--danger)"></i>Terlambat ${st.terlambat}</span></div>`;
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

/** Kelompok Daftar job menurut mode (kategori, PIC, status); terbuka bila dipilih pengguna, bawaan: kelompok pertama. */
function dataDaftar(now) {
  const cari = S.cari.trim().toLowerCase(), r = rentangAktif();
  const f = { aktif: (j) => H.aktif(j), telat: (j) => H.terlambat(j, now), minggu: (j) => H.aktif(j) && H.dalam(j.tglTarget, H.rentang("minggu", now)), selesai: (j) => j.status === "selesai" && H.dalam(j.tglSelesai, r), semua: () => true };
  const dasar = tampak(), n = (k) => dasar.filter(f[k]).length;
  const l = dasar.filter(f[S.fStatus] || f.aktif).filter((j) => !cari || [j.judul, j.customer, j.pic, j.kategori, j.deskripsi].join(" ").toLowerCase().includes(cari)).sort((a, b) => (a.tglTarget || "9").localeCompare(b.tglTarget || "9"));
  const gr = H.kelompokkan(l, S.kel, now).map((g, i) => { const key = S.kel + ":" + g.nama; return { ...g, key, buka: key in S.buka ? S.buka[key] : i === 0 }; });
  return { gr, n, jumlah: l.length };
}
function htmlDaftar(now) {
  const { gr, n } = dataDaftar(now);
  const chev = (b) => ikon(b ? "turun" : "maju", 16);
  return `<div class="dj-chips">${[["aktif", "Aktif"], ["telat", "Terlambat"], ["minggu", "Target minggu ini"], ["selesai", "Selesai (periode)"], ["semua", "Semua"]].map(([k, t]) => `<button type="button" class="mr-chip${S.fStatus === k ? " is-aktif" : ""}" data-dj="status" data-v="${k}">${t} <span>${n(k)}</span></button>`).join("")}</div>
  <div class="dj-kel"><span class="mu">Kelompokkan</span><div class="mr-seg dj-seg2" role="group" aria-label="Kelompokkan menurut">${[["kategori", "Kategori"], ["pic", "PIC"], ["status", "Status"]].map(([k, t]) => `<button type="button" class="mr-chip${S.kel === k ? " is-aktif" : ""}" data-dj="kel-mode" data-v="${k}">${t}</button>`).join("")}</div></div>
  ${gr.length ? gr.map((g) => `<section class="mr-kartu dj-grup"><button type="button" class="dj-gh" data-dj="grup" data-v="${e(g.key)}" aria-expanded="${g.buka}"><span class="dj-gh__c">${chev(g.buka)}</span><span class="dj-gh__n"><b>${e(g.nama)}</b> <small>${g.jobs.length} job</small></span>${g.telat ? `<span class="dj-chip dj-chip--bahaya">${g.telat} terlambat</span>` : ""}${g.selesai ? `<span class="dj-chip dj-chip--ok">${g.selesai} selesai</span>` : ""}</button>${g.buka ? `<div class="dj-gb">${g.jobs.map((j) => barisJob(j, now)).join("")}</div>` : ""}</section>`).join("") : `<div class="mr-kartu dj-kartu"><p class="mr-sub">Tidak ada job pada filter ini. Ketuk + untuk mencatat job baru.</p></div>`}`;
}

function htmlKelompok() {
  const hit = (id) => S.akun.filter((a) => a.kelompokDJ === id).length;
  return `<section class="mr-kartu dj-kartu"><h3>Kelompok</h3><p class="mr-sub">Anggota hanya melihat dan mengubah job kelompoknya. Master dan admin melihat semua.</p>
    ${S.kelompok.map((k) => `<div class="dj-org"><span><b>${e(k.nama)}</b> · ${hit(k.id)} anggota · ${S.jobs.filter((j) => j.kelompokId === k.id).length} job</span><span class="mr-ruang"></span><button class="mr-btn mr-btn--kecil" data-dj="kel-ubah" data-id="${e(k.id)}">Ubah</button><button class="mr-ikonbtn" data-dj="kel-hapus" data-id="${e(k.id)}" aria-label="Hapus kelompok">${ikon("tong", 15)}</button></div>`).join("") || `<p class="mr-sub">Belum ada kelompok.</p>`}
    <button class="mr-btn mr-btn--utama" data-dj="kel-baru">${ikon("plus", 14)} Kelompok baru</button></section>
    <section class="mr-kartu dj-kartu"><h3>Kelompok tiap akun</h3>${S.akun.map((a) => `<label class="dj-org"><span>${e(a.nama || a.email)}<small> ${e(a.email)}</small></span><select data-dj="kel-akun" data-id="${e(a.id)}" aria-label="Kelompok ${e(a.nama || a.email)}">${opsi(S.kelompok.map((k) => [k.id, k.nama]), a.kelompokDJ || "", "Tanpa kelompok")}</select></label>`).join("")}</section>`;
}

function htmlPengingat(now) {
  const p = H.pengingat(tampak(), now);
  if (!p.terlambat.length && !p.hariIni.length && !p.segera.length) return "";
  return `<button type="button" class="dj-alert" data-dj="k-telat"><span><b>${p.terlambat.length} terlambat</b> · ${p.hariIni.length} <i class="dj-p">jatuh tempo </i>hari ini<i class="dj-p"> · ${p.segera.length} mulai minggu ini</i></span><b>Lihat</b></button>`;
}

function render() {
  const el = $("#dj-root"); if (!el) return;
  const now = H.hariIni(), perlu = S.kelola || S.kelompokSaya;
  const tabs = [["performa", "Performa"], ["job", "Daftar job"], ...(S.kelola ? [["kelompok", "Kelompok"]] : [])];
  const hp = matchMedia("(max-width: 760px)").matches, pushOn = statusPush(S.u.uid) === "aktif";
  const bukanBawaan = periodeAktif() !== "bulan" || S.fPic || S.fKat || (S.kelola && S.fKel);
  const ikb = (aksi, ikn, judul, kelas = "") => `<button type="button" class="mr-btn dj-ib ${kelas}" data-dj="${aksi}" title="${judul}" aria-label="${judul}">${ikn}</button>`;
  const btnFilter = `<button type="button" class="mr-btn dj-ib" data-dj="filter" title="Filter: periode, kelompok, PIC, kategori" aria-label="Filter">${ikon("filter", 16)}${bukanBawaan ? `<i class="dj-dot"></i>` : ""}</button>`;
  const BEL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const aksiBtn = `${ikb("push", BEL, pushOn ? "Notifikasi aktif di perangkat ini (ketuk untuk mematikan)" : "Aktifkan notifikasi: pengingat catat job 09.00, 14.00, 17.00 dan deadline H-1", pushOn ? "dj-push-aktif" : "")}${S.kelola ? ikb("impor", ikon("upload", 16), "Import dari Excel") : ""}${hp ? ikb("pdf", ikon("download", 16), "Unduh laporan PDF", "dj-pdf") : `<button type="button" class="mr-btn dj-pdf" data-dj="pdf" title="Unduh laporan PDF">${ikon("download", 15)} PDF</button>`}`;
  const r = rentangAktif(), kelNama = S.fKel ? namaKel(S.fKel) : S.kelola ? "Semua kelompok" : namaKel(S.kelompokSaya);
  const kepalaP = `<div class="dj-kepala"><div class="dj-kepala__t"><div class="dj-ttl">${judulPeriode(r)}</div><div class="mr-sub">${pBln(r[0])} – ${pBln(r[1])} · ${e(kelNama)}${S.fPic ? " · " + e(S.fPic) : ""}${S.fKat ? " · " + e(S.fKat) : ""}</div></div><span class="dj-kepala__a">${btnFilter}${aksiBtn}</span></div>`;
  const kepalaD = `<div class="dj-kepala dj-kepala--d"><input type="search" id="dj-cari" class="dj-cari" placeholder="Cari judul, customer, PIC…" value="${e(S.cari)}" aria-label="Cari job"><button type="button" class="mr-btn dj-ib" data-dj="lipat" title="Ciutkan atau buka semua kelompok" aria-label="Ciutkan atau buka semua kelompok">${ikon("lipat", 16)}</button>${btnFilter}</div>`;
  let isi;
  if (S.muat) isi = `<p class="mr-sub">Memuat…</p>`;
  else if (S.galat) isi = `<div class="dj-alert dj-alert--bahaya">${e(S.galat)}</div>`;
  else if (!perlu) isi = `<section class="mr-kartu dj-kartu"><h3>Akun ini belum masuk kelompok</h3><p class="mr-sub">Minta master atau admin menetapkan kelompok Daily Job untuk akun Anda.</p></section>`;
  else isi = S.tab === "performa" ? kepalaP + htmlPengingat(now) + htmlPerforma(now) : S.tab === "job" ? kepalaD + htmlDaftar(now) : htmlKelompok();
  el.innerHTML = `<div class="dj-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" class="${S.tab === k ? "is-aktif" : ""}" data-dj="tab" data-v="${k}">${t}</button>`).join("")}</div>${isi}
    ${perlu && !S.muat ? `<button type="button" class="mr-fab" data-dj="baru" aria-label="Catat job baru">${ikon("plus", 22)}<span class="fab-teks">Catat job</span></button>` : ""}`;
}

/* ---------- panel filter (HP dan desktop): periode cepat, kelompok, PIC, kategori ---------- */
function panelFilter() {
  const sel = (aksi, lab, isi) => `<label class="mr-f"><span>${lab}</span><select data-dj="${aksi}">${isi}</select></label>`;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Filter</h2><p class="mr-sub">Berlaku untuk dashboard dan daftar job.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form" style="grid-template-columns:1fr"><div class="mr-f"><span>Periode</span><div class="mr-seg dj-seg" role="group" aria-label="Periode">${[["bulan", "Bulan ini"], ["minggu", "Minggu ini"], ["tahun", "Tahun ini"], ["rentang", "Rentang"]].map(([k, t]) => `<button type="button" class="mr-chip${S.periode === k ? " is-aktif" : ""}" data-dj="periode" data-v="${k}">${t}</button>`).join("")}</div>
  ${S.periode === "rentang" ? `<div class="dj-tgl"><input type="date" id="dj-dari" value="${e(S.dari)}" aria-label="Dari"><input type="date" id="dj-sampai" value="${e(S.sampai)}" aria-label="Sampai"></div>` : ""}</div>
  ${S.kelola ? sel("f-kel", "Kelompok", opsi(S.kelompok.map((k) => [k.id, k.nama]), S.fKel, "Semua kelompok")) : ""}${sel("f-pic", "PIC", opsi(daftarPic(), S.fPic, "Semua PIC"))}${sel("f-kat", "Kategori", opsi(H.daftarKategori(S.jobs), S.fKat, "Semua kategori"))}</div></div>
  <footer class="mr-panel__kaki"><button class="mr-btn" data-dj="filter-reset">Atur ulang</button><span class="mr-ruang"></span><button class="mr-btn mr-btn--utama" data-aksi="tutup-layer">Selesai</button></footer>`);
}
matchMedia("(max-width: 760px)").addEventListener("change", () => { if (window.__rute === "dailyjob") render(); });

/* ---------- form catat / ubah job ---------- */
const kelompokPilihan = () => (S.kelola ? S.kelompok : S.kelompok.filter((k) => k.id === S.kelompokSaya));
let berkasBaru = [];
function formJob(j) {
  const baru = !j, d = j || { kelompokId: S.fKel || S.kelompokSaya || (S.kelompok[0] || {}).id || "", status: "baru", prioritas: "sedang", bobot: 2, tglMasuk: H.hariIni(), pic: S.u.nama || "", file: [], tautan: [], catatan: [] };
  berkasBaru = []; d.file = d.file || []; d.tautan = d.tautan || []; d.catatan = d.catatan || [];
  const f = (lab, isi, kelas = "") => `<label class="mr-f ${kelas}"><span>${lab}</span>${isi}</label>`;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>${baru ? "Catat job baru" : "Ubah job"}</h2><p class="mr-sub">${baru ? "Job yang masuk hari ini, baru dikerjakan, atau masih pending." : e(namaKel(d.kelompokId))}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form" id="dj-form" data-id="${e(d.id || "")}">
    ${f("Judul job *", `<input id="djf-judul" maxlength="200" value="${e(d.judul || "")}" placeholder="mis. Penawaran trucking Jakarta–Surabaya">`, "dj-lebar")}
    ${f("Kategori *", `<select id="djf-kat">${opsi(H.daftarKategori([...S.jobs, d]), d.kategori || "")}<option value="__baru">＋ Kategori baru…</option></select><input id="djf-kat-baru" maxlength="40" placeholder="Nama kategori baru" hidden>`)}
    ${f("Customer", `<input id="djf-cust" value="${e(d.customer || "")}" placeholder="Nama customer">`)}
    ${f("PIC", `<input id="djf-pic" list="djf-piclist" value="${e(d.pic || "")}"><datalist id="djf-piclist">${daftarPic().map((p) => `<option value="${e(p)}">`).join("")}</datalist>`)}
    ${S.kelola ? f("Kelompok", `<select id="djf-kel">${opsi(kelompokPilihan().map((k) => [k.id, k.nama]), d.kelompokId)}</select>`) : ""}
    ${f("Tanggal masuk", `<input type="date" id="djf-masuk" value="${e(d.tglMasuk || "")}">`)}
    ${f("Mulai dikerjakan", `<input type="date" id="djf-mulai" value="${e(d.tglMulai || "")}">`)}
    ${f("Target selesai *", `<input type="date" id="djf-target" value="${e(d.tglTarget || "")}">`)}
    ${f("Status", `<select id="djf-status">${opsi(Object.entries(H.STATUS), d.status)}</select>`)}
    ${f("Tanggal selesai", `<input type="date" id="djf-selesai" value="${e(d.tglSelesai || "")}">`)}
    ${f("Prioritas", `<select id="djf-prio">${opsi(Object.entries(H.PRIORITAS), d.prioritas)}</select>`)}
    ${f("Bobot kerja", `<select id="djf-bobot">${opsi(Object.entries(H.BOBOT).map(([k, t]) => [k, `${t} (${k})`]), d.bobot)}</select>`)}
    ${f("Deskripsi", `<textarea id="djf-desk" rows="3" placeholder="Rincian job, permintaan customer, hasil yang diharapkan">${e(d.deskripsi || "")}</textarea>`, "dj-lebar")}
    <div class="mr-f dj-lebar"><span>File project <small>maks. 4 MB per file (gambar, PDF, Word, Excel, PowerPoint, CSV, ZIP)</small></span>
      <div id="djf-file">${d.file.map((x, i) => `<div class="dj-fl"><a href="${aman(x.url)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(x.nama)}</a><button type="button" class="mr-ikonbtn" data-dj="file-lepas" data-i="${i}" aria-label="Lepas file">${ikon("tutup", 14)}</button></div>`).join("")}</div>
      <input type="file" id="djf-berkas" multiple><div class="dj-tautan"><input id="djf-tl" placeholder="Atau tempel tautan (Drive, OneDrive)"><button type="button" class="mr-btn mr-btn--kecil" data-dj="tautan-tambah">Tambah tautan</button></div>
      <div id="djf-tautan">${d.tautan.map((x, i) => `<div class="dj-fl"><a href="${aman(x.url)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(x.nama || x.url)}</a><button type="button" class="mr-ikonbtn" data-dj="tautan-lepas" data-i="${i}" aria-label="Lepas tautan">${ikon("tutup", 14)}</button></div>`).join("")}</div></div>
    ${f("Catatan progres", `<textarea id="djf-cat" rows="2" placeholder="Tambah catatan baru (tercatat dengan tanggal dan nama)"></textarea>`, "dj-lebar")}
    ${d.catatan.length ? `<div class="mr-f dj-lebar"><span>Riwayat catatan</span>${d.catatan.slice().reverse().map((c) => `<div class="dj-cat"><small>${fmtTgl(c.tgl)} · ${e(c.oleh)}</small>${e(c.teks)}</div>`).join("")}</div>` : ""}
  </div></div>
  <footer class="mr-panel__kaki">${baru ? "" : `<button class="mr-btn mr-btn--bahaya" data-dj="hapus" data-id="${e(d.id)}">Hapus</button>`}<span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="simpan" id="dj-simpan">Simpan</button></footer>`);
  $("#dj-form")._d = d;
  $("#djf-kat").onchange = (ev) => { const n = $("#djf-kat-baru"); n.hidden = ev.target.value !== "__baru"; if (!n.hidden) n.focus(); };
  $("#djf-status").onchange = (ev) => { const s = $("#djf-selesai"); if (ev.target.value === "selesai" && !s.value) s.value = H.hariIni(); if (ev.target.value !== "selesai") s.value = ""; };
  $("#djf-berkas").onchange = (ev) => { berkasBaru.push(...ev.target.files); ev.target.value = ""; tampilBaru(); };
}
const tampilBaru = () => { const w = $("#djf-file"); w.querySelectorAll(".dj-fl--baru").forEach((x) => x.remove()); berkasBaru.forEach((b, i) => w.insertAdjacentHTML("beforeend", `<div class="dj-fl dj-fl--baru"><span>${ikon("upload", 13)} ${e(b.name)} <small>(baru)</small></span><button type="button" class="mr-ikonbtn" data-dj="baru-lepas" data-i="${i}" aria-label="Batalkan">${ikon("tutup", 14)}</button></div>`)); };

async function simpanJob() {
  const form = $("#dj-form"), d = form._d, v = (id) => ($("#" + id) || {}).value || "";
  const judul = v("djf-judul").trim(), target = v("djf-target"), kel = S.kelola ? v("djf-kel") : S.kelompokSaya;
  const kat = v("djf-kat") === "__baru" ? H.rapikanKategori(v("djf-kat-baru"), H.daftarKategori(S.jobs)) : v("djf-kat");
  if (!judul) return toast("Isi judul job.", "bahaya");
  if (!kat) return toast("Isi nama kategori baru.", "bahaya");
  if (!target) return toast("Isi target selesai.", "bahaya");
  if (!kel) return toast("Pilih kelompok. Buat kelompok dulu di tab Kelompok.", "bahaya");
  if (v("djf-masuk") && target < v("djf-masuk")) return toast("Target selesai tidak boleh sebelum tanggal masuk.", "bahaya");
  const tombol = $("#dj-simpan"); tombol.disabled = true; tombol.textContent = "Menyimpan…";
  try {
    const id = form.dataset.id || uid(), file = [...d.file];
    for (const b of berkasBaru) { const path = `dailyjob/${kel}/${id}/${Date.now()}-${b.name.replace(/[^\w.\-]+/g, "_")}`; file.push({ nama: b.name, path, url: await unggahBlob(path, b, b.type || "application/octet-stream") }); }
    const catatan = [...d.catatan]; if (v("djf-cat").trim()) catatan.push({ tgl: H.hariIni(), oleh: S.u.nama || S.u.email, teks: v("djf-cat").trim() });
    const status = v("djf-status"), data = {
      judul, kategori: kat, customer: v("djf-cust").trim(), pic: v("djf-pic").trim(), kelompokId: kel, deskripsi: v("djf-desk").trim(), tglMasuk: v("djf-masuk") || H.hariIni(), tglMulai: v("djf-mulai") || null, tglTarget: target,
      status, tglSelesai: status === "selesai" ? v("djf-selesai") || H.hariIni() : null, prioritas: v("djf-prio"), bobot: +v("djf-bobot") || 2, file, tautan: d.tautan, catatan,
      dibuatOleh: d.dibuatOleh || S.u.uid, dibuatNama: d.dibuatNama || S.u.nama || S.u.email, dibuatPada: d.dibuatPada || H.hariIni(), diubah: serverTimestamp(),
    };
    await setDoc(doc(db, "dj_job", id), data);
    const ada = S.jobs.findIndex((x) => x.id === id), baru = { id, ...data, diubah: null };
    if (ada >= 0) S.jobs[ada] = baru; else S.jobs.push(baru);
    tutupLayer(); render(); toast("Job tersimpan.");
  } catch (err) { console.error(err); toast("Job belum tersimpan: " + e(err.message || err), "bahaya"); tombol.disabled = false; tombol.textContent = "Simpan"; }
}

async function tandaiSelesai(id) {
  const j = S.jobs.find((x) => x.id === id); if (!j) return;
  try { const p = { status: "selesai", tglSelesai: H.hariIni(), diubah: serverTimestamp() }; await updateDoc(doc(db, "dj_job", id), p); Object.assign(j, p, { diubah: null }); render(); toast("Job ditandai selesai."); }
  catch (err) { toast("Belum bisa menyimpan: " + e(err.message || err), "bahaya"); }
}

/* ---------- PDF ---------- */
const tungguLib = async () => { for (let i = 0; i < 40 && !(window.jspdf && window.html2canvas); i++) await new Promise((r) => setTimeout(r, 250)); if (!(window.jspdf && window.html2canvas)) throw new Error("Pustaka PDF belum siap. Coba lagi sebentar lagi."); };
async function unduhPdf() {
  const tombol = $(".dj-pdf"); if (tombol) tombol.disabled = true;
  try {
    await tungguLib();
    const adaDash = S.tab === "performa"; if (!adaDash) { S.tab = "performa"; render(); }
    const root = $("#dj-root"), now = H.hariIni(), r = rentangAktif(), js = tampak(), k = H.hitungKpi(js, r, now);
    root.classList.add("dj-cetak"); // kertas laporan putih
    const cv = await window.html2canvas($("#dj-dash"), { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    root.classList.remove("dj-cetak");
    const { jsPDF } = window.jspdf, pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }), W = pdf.internal.pageSize.getWidth(), Hh = pdf.internal.pageSize.getHeight();
    const kel = S.fKel ? namaKel(S.fKel) : S.kelola ? "Semua kelompok" : namaKel(S.kelompokSaya);
    pdf.setFontSize(16); pdf.setTextColor(10, 61, 102); pdf.text("Laporan Kinerja Daily Job", 12, 14);
    pdf.setFontSize(10); pdf.setTextColor(90, 100, 115); pdf.text(`${kel}  |  Periode ${fmtTgl(r[0])} – ${fmtTgl(r[1])}${S.fPic ? "  |  PIC " + S.fPic : ""}${S.fKat ? "  |  " + S.fKat : ""}  |  Dibuat ${fmtTgl(now)}`, 12, 20);
    const sk = Math.min((W - 24) / cv.width, (Hh - 30) / cv.height); pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 12, 25, cv.width * sk, cv.height * sk);
    const tabel = (judul, baris, kolom) => {
      pdf.addPage("a4", "landscape"); pdf.setFontSize(13); pdf.setTextColor(10, 61, 102); pdf.text(judul, 12, 14);
      pdf.autoTable({ startY: 18, margin: { left: 12, right: 12 }, head: [kolom.map((c) => c[0])], body: baris.map((j, i) => kolom.map((c) => c[1](j, i))), styles: { fontSize: 8, cellPadding: 1.6 }, headStyles: { fillColor: [10, 61, 102] },
        didDrawCell: (h) => { const c = kolom[h.column.index]; if (h.section === "body" && c[2]) { const u = c[2](baris[h.row.index]); if (u) pdf.link(h.cell.x, h.cell.y, h.cell.width, h.cell.height, { url: u }); } } });
    };
    const urut = (a, b) => (a.tglSelesai || a.tglTarget || "").localeCompare(b.tglSelesai || b.tglTarget || "");
    const selesai = js.filter((j) => j.status === "selesai" && H.dalam(j.tglSelesai, r)).sort(urut), aktif = js.filter(H.aktif).sort(urut);
    const fl = (j) => [...(j.file || []).map((x) => x.url), ...(j.tautan || []).map((x) => x.url)];
    const kolomF = [["No", (j, i) => i + 1], ["Job", (j) => j.judul], ["Kategori", (j) => j.kategori || "-"], ["Customer", (j) => j.customer || "-"], ["PIC", (j) => j.pic || "-"], ["Masuk", (j) => fmtTgl(j.tglMasuk)], ["Target", (j) => fmtTgl(j.tglTarget)]];
    if (selesai.length) tabel(`Job selesai (${selesai.length}) — ${k.persenTepat ?? 0}% tepat waktu`, selesai, [...kolomF, ["Selesai", (j) => fmtTgl(j.tglSelesai)], ["File project", (j) => (fl(j).length ? `Buka (${fl(j).length})` : "-"), (j) => fl(j)[0]]]);
    if (aktif.length) tabel(`Job belum selesai (${aktif.length})`, aktif, [...kolomF, ["Status", (j) => H.STATUS[j.status]], ["Posisi", (j) => H.labelTarget(j, now).t]]);
    pdf.save(`daily-job-${r[0]}_${r[1]}.pdf`);
  } catch (err) { console.error(err); toast("PDF belum jadi: " + e(err.message || err), "bahaya"); }
  finally { $("#dj-root")?.classList.remove("dj-cetak"); if (tombol) tombol.disabled = false; }
}


/* ---------- import Excel (master/admin) ---------- */
const NAMA_TIM = "Marketing dan BD";
let rencana = null;
function panelImpor() {
  rencana = null;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Import dari Excel</h2><p class="mr-sub">Lembar "Input Tugas Harian": Tanggal Diberikan, PIC, Kategori, Customer, Deskripsi, Deadline, Tanggal Selesai, Keterangan. Impor ulang file yang sama menimpa job impor sebelumnya, bukan menggandakan.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form"><label class="mr-f dj-lebar"><span>File Excel (.xlsx)</span><input type="file" id="dji-file" accept=".xlsx,.xls"></label>
  <label class="mr-f dj-lebar"><span>Masuk ke kelompok</span><select id="dji-kel">${opsi([...S.kelompok.map((k) => [k.id, k.nama]), ...(S.kelompok.some((k) => k.nama === NAMA_TIM) ? [] : [["__baru", `＋ Buat kelompok "${NAMA_TIM}"`]])], (S.kelompok.find((k) => k.nama === NAMA_TIM) || {}).id || S.fKel || "__baru")}</select></label>
  <div id="dji-hasil" class="dj-lebar mr-sub">${S.kelompok.length ? "Pilih file untuk melihat pratinjau." : "Pilih file untuk melihat pratinjau."}</div></div></div>
  <footer class="mr-panel__kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="impor-jalan" id="dji-ok" disabled>Impor</button></footer>`);
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
      const id = `imp-${kel}-${j.id}`, data = { ...j, kelompokId: kel, tglMasuk: j.tglMasuk || sekarang, dibuatOleh: S.u.uid, dibuatNama: "Import Excel", dibuatPada: sekarang, diimpor: true, diubah: serverTimestamp() };
      await setDoc(doc(db, "dj_job", id), data); n++;
      const ada = S.jobs.findIndex((x) => x.id === id), baru = { ...data, id, diubah: null }; if (ada >= 0) S.jobs[ada] = baru; else S.jobs.push(baru);
    }));
    tutupLayer(); S.fKel = kel; S.periode = "rentang"; const t = S.jobs.filter((x) => x.diimpor).map((x) => x.tglMasuk).sort(); S.dari = t[0]; S.sampai = H.hariIni(); render(); toast(`${n} job diimpor.`);
  } catch (err) { console.error(err); toast(`Impor berhenti setelah ${n} job: ` + e(err.message || err), "bahaya"); tombol.disabled = false; tombol.textContent = "Impor"; }
}

/* ---------- aksi ---------- */
const periksa = (ev) => window.__rute === "dailyjob" || ev.target.closest("#mr-layer");
document.addEventListener("click", async (ev) => {
  if (!periksa(ev)) return;
  const t = ev.target.closest("[data-dj]"); if (!t) return;
  const a = t.dataset.dj, id = t.dataset.id, v = t.dataset.v;
  if (t.tagName === "SELECT" || t.tagName === "INPUT") return;
  if (t.dataset.dj === "selesai") { ev.stopPropagation(); return tandaiSelesai(id); }
  if (a === "tab") { S.tab = v; return render(); }
  if (a === "periode") { S.periode = v; if (v === "rentang" && !S.dari) [S.dari, S.sampai] = H.rentang("bulan"); render(); return t.closest("#mr-layer") ? panelFilter() : undefined; }
  if (a === "kel-mode") { S.kel = v; return render(); }
  if (a === "grup") { S.buka[v] = !(v in S.buka ? S.buka[v] : dataDaftar(H.hariIni()).gr.find((g) => g.key === v)?.buka); return render(); }
  if (a === "lipat") { const gr = dataDaftar(H.hariIni()).gr, adaBuka = gr.some((g) => g.buka); gr.forEach((g) => { S.buka[g.key] = !adaBuka; }); return render(); }
  if (a === "baru") return formJob(null);
  if (a === "buka") { const j = S.jobs.find((x) => x.id === id); return j && formJob(j); }
  if (a === "k-selesai") { S.fStatus = "selesai"; S.tab = "job"; return render(); }
  if (a === "k-telat") { S.fStatus = "telat"; S.tab = "job"; return render(); }
  if (a === "status") { S.fStatus = v; return render(); }
  if (a === "kat") { S.fKat = S.fKat === v ? "" : v; return render(); }
  if (a === "pic") { S.fPic = S.fPic === v ? "" : v; return render(); }
  if (a === "pdf") return unduhPdf();
  if (a === "push") {
    const st = statusPush(S.u.uid);
    if (st === "aktif") { if (await konfirmasi("Matikan notifikasi?", "Perangkat ini tidak lagi menerima pengingat Daily Job.", "Matikan")) { await matikanPush(S.u.uid); render(); toast("Notifikasi dimatikan di perangkat ini."); } return; }
    if (st === "iphone-pasang") return toast("Di iPhone, tambahkan ISL HUB ke Layar Utama dulu (Bagikan, lalu Tambah ke Layar Utama), buka dari ikon itu, lalu aktifkan notifikasi.", "info");
    if (st === "tidak-didukung") return toast("Browser ini belum mendukung notifikasi. Pakai Chrome, Edge, atau Safari terbaru.", "bahaya");
    if (st === "diblokir") return toast("Notifikasi diblokir untuk situs ini. Izinkan di pengaturan browser (ikon gembok di alamat), lalu coba lagi.", "bahaya");
    try { await aktifkanPush(S.u.uid); render(); toast("Notifikasi aktif di perangkat ini: pengingat 09.00, 14.00, 17.00 dan deadline H-1."); } catch (err) { console.error(err); toast("Notifikasi belum aktif: " + e(err.message || err), "bahaya"); } return;
  }
  if (a === "filter") return panelFilter();
  if (a === "filter-reset") { S.fPic = ""; S.fKat = ""; S.periode = "bulan"; if (S.kelola) S.fKel = ""; render(); return panelFilter(); }
  if (a === "impor") return panelImpor();
  if (a === "impor-jalan") return jalankanImpor();
  if (a === "simpan") return simpanJob();
  const d = $("#dj-form") && $("#dj-form")._d;
  if (a === "file-lepas") { d.file.splice(+t.dataset.i, 1); return t.closest(".dj-fl").remove(); }
  if (a === "tautan-lepas") { d.tautan.splice(+t.dataset.i, 1); return t.closest(".dj-fl").remove(); }
  if (a === "baru-lepas") { berkasBaru.splice(+t.dataset.i, 1); return tampilBaru(); }
  if (a === "tautan-tambah") { const u = $("#djf-tl").value.trim(); if (!/^https?:\/\//i.test(u)) return toast("Tautan harus diawali http:// atau https://", "bahaya"); d.tautan.push({ url: u, nama: u.replace(/^https?:\/\//, "").slice(0, 60) }); $("#djf-tl").value = ""; return $("#djf-tautan").insertAdjacentHTML("beforeend", `<div class="dj-fl"><a href="${aman(u)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(u.slice(0, 60))}</a><span class="mr-sub">disimpan saat Simpan</span></div>`); }
  if (a === "hapus") { if (!(await konfirmasi("Hapus job ini?", "Job dan catatannya dihapus permanen. File di Storage tidak ikut dihapus.", "Hapus"))) return; try { await deleteDoc(doc(db, "dj_job", id)); S.jobs = S.jobs.filter((x) => x.id !== id); tutupLayer(); render(); toast("Job dihapus."); } catch (err) { toast("Belum bisa dihapus: " + e(err.message || err), "bahaya"); } return; }
  if (a === "kel-baru" || a === "kel-ubah") {
    const k = S.kelompok.find((x) => x.id === id), nama = (prompt("Nama kelompok / divisi:", k ? k.nama : "") || "").trim(); if (!nama) return;
    const kid = k ? k.id : uid(); try { await setDoc(doc(db, "dj_kelompok", kid), { nama, dibuat: k ? k.dibuat || H.hariIni() : H.hariIni() }); await muat(); toast("Kelompok tersimpan."); } catch (err) { toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } return;
  }
  if (a === "kel-hapus") {
    const k = S.kelompok.find((x) => x.id === id); if (S.jobs.some((j) => j.kelompokId === id)) return toast("Kelompok masih punya job. Pindahkan atau hapus jobnya dulu.", "bahaya");
    if (!(await konfirmasi("Hapus kelompok?", `Kelompok <b>${e(k.nama)}</b> dihapus. Akun anggotanya menjadi tanpa kelompok.`, "Hapus"))) return;
    try { await deleteDoc(doc(db, "dj_kelompok", id)); await Promise.all(S.akun.filter((x) => x.kelompokDJ === id).map((x) => updateDoc(doc(db, "pengguna", x.id), { kelompokDJ: null }))); await muat(); toast("Kelompok dihapus."); } catch (err) { toast("Belum terhapus: " + e(err.message || err), "bahaya"); }
  }
});
document.addEventListener("keydown", (ev) => { if (window.__rute === "dailyjob" && (ev.key === "Enter" || ev.key === " ") && ev.target.matches?.('.dj-job[data-dj="buka"], .dj-tbl tr[data-dj]')) { ev.preventDefault(); ev.target.click(); } });
document.addEventListener("change", async (ev) => {
  if (window.__rute !== "dailyjob") return;
  const t = ev.target, a = t.dataset && t.dataset.dj;
  const dalamPanel = !!t.closest("#mr-layer"), seg = () => { render(); if (dalamPanel) panelFilter(); };
  if (a === "f-kel") { S.fKel = t.value; S.fPic = ""; return seg(); }
  if (a === "f-pic") { S.fPic = t.value; return seg(); }
  if (a === "f-kat") { S.fKat = t.value; return seg(); }
  if (t.id === "dj-dari" || t.id === "dj-sampai") { S[t.id === "dj-dari" ? "dari" : "sampai"] = t.value; return seg(); }
  if (a === "kel-akun") { try { await updateDoc(doc(db, "pengguna", t.dataset.id), { kelompokDJ: t.value || null }); const ak = S.akun.find((x) => x.id === t.dataset.id); if (ak) ak.kelompokDJ = t.value || null; toast("Kelompok akun diperbarui."); } catch (err) { toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } }
});
document.addEventListener("input", (ev) => { if (window.__rute === "dailyjob" && ev.target.id === "dj-cari") { S.cari = ev.target.value; const p = ev.target.selectionStart; render(); const n = $("#dj-cari"); if (n) { n.focus(); n.setSelectionRange(p, p); } } });

/* ---------- pintu masuk ---------- */
export async function mulaiDailyJob(user, profil) {
  S.u = { uid: user.uid, email: user.email, nama: (profil && profil.nama) || user.displayName || "" };
  S.kelola = !!window.__ISL_KELOLA; S.kelompokSaya = (profil && profil.kelompokDJ) || null;
  $("#user-email").textContent = labelAkun(user.email, user.displayName); renderNav("dailyjob");
  const el = $("#dj-root"); if (el && !el.dataset.siap) el.dataset.siap = "1";
  if (window.__djBukaForm) { window.__djBukaForm = false; await muat(); if (S.kelola || S.kelompokSaya) formJob(null); return; }
  await muat();
}

/* ---------- pengingat catat job: 09.00, 14.00, 17.00 WIB ---------- */
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
    kotak.innerHTML = `<b>Pengingat ${jam} · catat daily job</b><p>Catat job baru, yang sedang dikerjakan, dan yang masih pending.${p.terlambat.length || p.hariIni.length ? `<br><b>${p.terlambat.length} terlambat</b> · ${p.hariIni.length} jatuh tempo hari ini.` : ""}</p>
      <div><button class="mr-btn mr-btn--utama" data-x="catat">Catat sekarang</button><button class="mr-btn" data-x="nanti">Tutup</button></div>`;
    document.body.appendChild(kotak);
    kotak.querySelector('[data-x="catat"]').onclick = () => { tandai(k); kotak.remove(); if (window.__rute === "dailyjob") { window.__djBukaForm = false; formJob(null); } else { window.__djBukaForm = true; location.hash = "#dailyjob"; } };
    kotak.querySelector('[data-x="nanti"]').onclick = () => { tandai(k); kotak.remove(); };
  };
  jagaPush(user.uid, (h) => toast(h)); // perbarui token notifikasi; pesan saat aplikasi terbuka jadi toast
  cek(); setInterval(cek, 60000);
}
