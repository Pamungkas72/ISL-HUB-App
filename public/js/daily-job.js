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
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as H from "./daily-job-hitung.js";
import { tampilkanPratinjau, tipeBerkas, labelTipe, ukuranTeks, temaGelap } from "./daily-job-viewer.js";
import { statusPush, aktifkanPush, matikanPush, jagaPush } from "./daily-job-push.js";

const S = { u: null, kelola: false, kelompokSaya: null, kelompok: [], jobs: [], akun: [], tab: "performa", periode: "bulan", dari: "", sampai: "", fKel: "", fPic: "", fKat: "", tampil: "perlu", masalah: "", kel: matchMedia("(min-width: 761px)").matches ? "tabel" : "pic", buka: {}, pilih: new Set(), modePilih: false, terbuka: "", detail: null, cari: "", muat: false, galat: "" };
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

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const warnaPic = (n) => { let h = 0; for (const c of String(n || "-")) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},62%,68%)`; };
const avatar = (n) => `<span class="dj-av" style="background:${warnaPic(n)}" title="${e(n || "Tanpa PIC")}">${e((n || "?")[0].toUpperCase())}</span>`;
const MASALAH = [["telat", "Terlambat"], ["hari", "Hari ini"], ["tunggu", "Menunggu"], ["tanpa", "Tanpa target"]];

/** Daftar job: saring (tampil, masalah, cari), lalu kelompokkan menurut S.kel ('tabel' = tanpa kelompok). */
function dataDaftar(now) {
  const cari = S.cari.trim().toLowerCase(), r = rentangAktif(), dasar = tampak();
  const ft = { perlu: (j) => H.perluTindakan(j, now), aktif: (j) => H.aktif(j), selesai: (j) => j.status === "selesai" && H.dalam(j.tglSelesai, r) };
  const n = { perlu: dasar.filter(ft.perlu).length, aktif: dasar.filter(ft.aktif).length, selesai: dasar.filter(ft.selesai).length };
  const mas = Object.fromEntries(MASALAH.map(([k]) => [k, dasar.filter((j) => H.masalahJob(j, now).includes(k)).length]));
  const l = dasar.filter(ft[S.tampil] || ft.perlu).filter((j) => S.tampil === "selesai" || !S.masalah || H.masalahJob(j, now).includes(S.masalah))
    .filter((j) => !cari || [j.judul, j.customer, j.pic, j.kategori, j.deskripsi].join(" ").toLowerCase().includes(cari))
    .sort((a, b) => (a.tglTarget || "9").localeCompare(b.tglTarget || "9"));
  const mode = S.kel === "tabel" && matchMedia("(max-width: 760px)").matches ? "pic" : S.kel;
  const gr = mode === "tabel" ? [] : H.kelompokkan(l, mode, now).map((g, i) => { const key = mode + ":" + g.nama; return { ...g, key, buka: key in S.buka ? S.buka[key] : mode === "pic" || i === 0 }; });
  return { l, gr, n, mas, mode };
}

/** Blok target di depan baris: tanggal besar, bulan, dan sisa/lewat hari. */
function blokTgl(j, now) {
  const selesai = j.status === "selesai", t = selesai ? j.tglSelesai : j.tglTarget, telat = H.terlambat(j, now), hari = H.aktif(j) && j.tglTarget === now;
  const kls = selesai ? "ok" : telat ? "telat" : hari ? "hari" : "", ket = selesai ? "selesai" : telat ? `${H.selisihHari(now, j.tglTarget)} hr` : hari ? "hari ini" : !j.tglTarget ? "tanpa" : H.aktif(j) ? `${H.selisihHari(j.tglTarget, now)} hr` : "";
  return `<div class="dj-tg ${kls}"><b>${t ? +t.slice(8, 10) : "–"}</b><small>${t ? BLN[+t.slice(5, 7) - 1] : "target"}</small>${ket ? `<em>${ket}</em>` : ""}</div>`;
}
const cbx = (on, dj, id, v) => `<button type="button" class="dj-cb${on ? " is-on" : ""}" data-dj="${dj}" ${id ? `data-id="${e(id)}"` : ""} ${v ? `data-v="${e(v)}"` : ""} aria-pressed="${on}" aria-label="Pilih">${on ? ikon("cek", 14) : ""}</button>`;
const aksiIkon = (id) => `<span class="dj-hv">${[["a-selesai", "cek", "Selesai"], ["a-ubah", "edit", "Ubah"], ["a-bagikan", "salin", "Bagikan"], ["a-hapus", "tong", "Hapus"]].map(([a, i, t]) => `<button type="button" class="mr-ikonbtn" data-dj="${a}" data-id="${e(id)}" title="${t}" aria-label="${t}">${ikon(i, 15)}</button>`).join("")}</span>`;

/** Baris job (HP dan desktop): target di depan, judul dan kategori, PIC di ujung. Geser kiri membuka aksi; geser kanan memilih. */
function barisJob(j, now, o = {}) {
  const telat = H.terlambat(j, now), adaPilih = S.modePilih || S.pilih.size > 0, geser = S.terbuka === j.id ? " is-geser" : "";
  const aksi = `<div class="dj-sw">${[["a-selesai", "cek", "Selesai", "ok"], ["a-ubah", "edit", "Ubah", "sky"], ["a-bagikan", "salin", "Bagikan", "info"], ["a-hapus", "tong", "Hapus", "bahaya"]].map(([a, i, t, w]) => `<button type="button" class="dj-sw__${w}" data-dj="${a}" data-id="${e(j.id)}">${ikon(i, 18)}<span>${t}</span></button>`).join("")}</div>`;
  return `<div class="dj-rw${S.pilih.has(j.id) ? " is-pilih" : ""}">${adaPilih ? "" : aksi}<div class="dj-job2 dj-job2--${telat ? "telat" : j.status === "selesai" ? "ok" : "aktif"}${geser}" data-dj="buka" data-id="${e(j.id)}" tabindex="0" role="button">${adaPilih ? cbx(S.pilih.has(j.id), "cb", j.id) : ""}${blokTgl(j, now)}
    <div class="dj-job__isi"><b>${e(j.judul)}</b><small>${[j.kategori, j.customer, o.kel ? namaKel(j.kelompokId) : ""].filter(Boolean).map(e).join(" · ")}${j.review && j.review.nilai === "revisi" && H.aktif(j) ? ' · <span class="dj-rev">Perlu revisi</span>' : ""}</small></div>${avatar(j.pic)}${aksiIkon(j.id)}</div></div>`;
}

function htmlTabelJob(l, now) {
  const semua = l.length > 0 && l.every((j) => S.pilih.has(j.id));
  return `<div class="mr-kartu dj-kartu dj-tbw"><table class="dj-tb"><thead><tr><th class="dj-tb__c">${cbx(semua, "cb-semua")}</th><th>Target</th><th>Job</th><th>Kategori</th><th>PIC</th><th>Posisi</th><th></th></tr></thead><tbody>
  ${l.map((j) => { const lab = H.labelTarget(j, now), telat = H.terlambat(j, now); return `<tr class="${S.pilih.has(j.id) ? "is-pilih" : ""}" data-dj="buka" data-id="${e(j.id)}" tabindex="0"><td class="dj-tb__c">${cbx(S.pilih.has(j.id), "cb", j.id)}</td>
    <td class="dj-tb__t${telat ? " is-telat" : j.tglTarget === now && H.aktif(j) ? " is-hari" : ""}">${j.tglTarget ? fmtTgl(j.tglTarget).replace(/ \d{4}$/, "") : "–"}</td><td><b>${e(j.judul)}</b><small>${e(j.customer || "")}</small></td><td>${e(j.kategori || "–")}</td>
    <td><span class="dj-pic">${avatar(j.pic)} ${e(j.pic || "–")}</span></td><td><span class="dj-chip dj-chip--${lab.k || "info"}">${e(lab.t)}</span></td><td>${aksiIkon(j.id)}</td></tr>`; }).join("")}</tbody></table></div>`;
}

function htmlDaftar(now) {
  const { l, gr, n, mode } = dataDaftar(now), chev = (b) => ikon(b ? "turun" : "maju", 16), adaPilih = S.modePilih || S.pilih.size > 0;
  const strip = `<div class="dj-chips">${[["perlu", "Perlu tindakan"], ["aktif", "Semua aktif"], ["selesai", "Selesai"]].map(([k, t]) => `<button type="button" class="mr-chip${S.tampil === k ? " is-aktif" : ""}" data-dj="tampil" data-v="${k}">${t} <span>${n[k]}</span></button>`).join("")}</div>`;
  const seg = `<div class="dj-kel"><span class="mu">Kelompokkan</span><div class="mr-seg dj-seg2" role="group" aria-label="Kelompokkan menurut">${[["pic", "PIC"], ["kategori", "Kategori"], ["status", "Status"], ["tabel", "Tabel"]].map(([k, t]) => `<button type="button" class="mr-chip${mode === k ? " is-aktif" : ""}${k === "tabel" ? " dj-hanya-desktop" : ""}" data-dj="kel-mode" data-v="${k}">${t}</button>`).join("")}</div></div>`;
  const infoPilih = adaPilih ? `<div class="dj-infopilih">${cbx(l.length > 0 && l.every((j) => S.pilih.has(j.id)), "cb-semua")}<b>${S.pilih.size} dipilih</b><span class="mu">· ketuk Pilih semua untuk ${l.length} job</span><span class="mr-ruang"></span><button type="button" class="mr-link" data-dj="cb-semua">Pilih semua</button></div>` : "";
  const grupHtml = (g) => `<section class="mr-kartu dj-grup"><div class="dj-gh">${adaPilih ? cbx(g.jobs.every((j) => S.pilih.has(j.id)), "cb-grup", "", g.key) : ""}<button type="button" class="dj-gh__b" data-dj="grup" data-v="${e(g.key)}" aria-expanded="${g.buka}"><span class="dj-gh__c">${chev(g.buka)}</span>${mode === "pic" ? avatar(g.nama) : ""}<span class="dj-gh__n"><b>${e(g.nama)}</b> <small>${g.jobs.length} job</small></span>${g.telat ? `<span class="dj-chip dj-chip--bahaya">${g.telat} terlambat</span>` : ""}${g.selesai ? `<span class="dj-chip dj-chip--ok">${g.selesai} selesai</span>` : ""}</button></div>
    ${mode === "pic" && g.jobs.length ? `<div class="dj-beban" title="${g.telat} dari ${g.jobs.length} job terlambat"><i style="width:${(g.telat / g.jobs.length) * 100}%"></i></div>` : ""}${g.buka ? `<div class="dj-gb">${g.jobs.map((j) => barisJob(j, now, { kel: S.kelola && !S.fKel })).join("")}</div>` : ""}</section>`;
  const isi = !l.length ? `<div class="mr-kartu dj-kartu"><p class="mr-sub">${S.tampil === "perlu" ? "Tidak ada job yang perlu tindakan. " : ""}Tidak ada job pada filter ini. Ketuk + untuk mencatat job baru.</p></div>` : mode === "tabel" ? htmlTabelJob(l, now) : gr.map(grupHtml).join("");
  return strip + seg + infoPilih + isi;
}

/** Bilah aksi massal di bawah layar saat ada job dipilih. */
function htmlBarPilih() {
  if (!S.pilih.size) return "";
  return `<div class="dj-barpilih" role="toolbar" aria-label="Aksi untuk job terpilih"><div class="dj-barpilih__a"><b>${S.pilih.size} dipilih</b><button type="button" class="mr-ikonbtn" data-dj="pilih-batal" aria-label="Batal pilih">${ikon("tutup", 14)}</button></div>
    <div class="dj-barpilih__b"><button type="button" class="mr-btn dj-ok" data-dj="m-selesai">${ikon("cek", 16)} Selesai</button><button type="button" class="mr-btn" data-dj="m-pic">${ikon("orang", 16)} Ubah PIC</button><button type="button" class="mr-btn" data-dj="m-bagikan">${ikon("salin", 16)} Bagikan</button><button type="button" class="mr-btn dj-bhy" data-dj="m-hapus" aria-label="Hapus">${ikon("tong", 16)}</button></div></div>`;
}

/* ---------- detail job (desain B): berkas dan pratinjau jadi fokus, review kepala divisi, ubah target, tautan bagikan ---------- */
const adalahKepala = (j) => S.kelola || ((S.kelompok.find((k) => k.id === j.kelompokId) || {}).kepala || []).includes(S.u.uid);
const berkasJob = (j) => (j.file || []).map((f, i) => ({ ...f, i, tp: tipeBerkas(f.nama, f.tipe) }));
const waktuTeks = (w) => { const d = new Date(typeof w === "number" ? w : Date.parse(w)); return isNaN(d) ? "" : d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", ":"); };
const jobDetail = () => (S.detail ? jobId(S.detail.id) : null);

function htmlKopDetail(j, now) {
  const kep = adalahKepala(j), lab = H.labelTarget(j, now), rv = j.review && j.review.nilai;
  return `<div class="dj-dk"><button type="button" class="mr-btn dj-ib" data-dj="d-tutup" title="Kembali ke daftar" aria-label="Kembali">${ikon("kembali", 16)}</button><h2 class="dj-dk__t" title="${e(j.judul)}">${e(j.judul)}</h2>
    <button type="button" class="mr-btn dj-ib" data-dj="a-ubah" data-id="${e(j.id)}" title="Ubah" aria-label="Ubah">${ikon("edit", 16)}</button><button type="button" class="mr-btn dj-ib" data-dj="a-bagikan" data-id="${e(j.id)}" title="Bagikan" aria-label="Bagikan">${ikon("salin", 16)}</button>
    ${H.aktif(j) ? `<button type="button" class="mr-btn dj-ib dj-ok" data-dj="a-selesai" data-id="${e(j.id)}" title="Tandai selesai" aria-label="Tandai selesai">${ikon("cek", 16)}</button>` : ""}<button type="button" class="mr-btn dj-ib dj-bhy" data-dj="a-hapus" data-id="${e(j.id)}" title="Hapus" aria-label="Hapus">${ikon("tong", 16)}</button></div>
  <div class="dj-dk__s"><span class="dj-chip dj-chip--${j.status === "selesai" ? "ok" : "info"}">${e(H.STATUS[j.status] || j.status)}</span><button type="button" class="dj-chip dj-chip--${lab.k || "info"} dj-chip--btn" data-dj="d-target" title="Ubah target selesai">${j.tglTarget ? "Target " + e(fmtTgl(j.tglTarget)) + " · " : ""}${e(lab.t)} ${ikon("edit", 11)}</button>
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
  return `<div class="mr-kartu dj-kartu dj-info"><div class="dj-kv">${kv("Customer", e(j.customer))}${kv("Kategori", e(j.kategori))}${kv("Masuk", e(fmtTgl(j.tglMasuk)))}${kv(j.status === "selesai" ? "Selesai" : "Mulai", e(fmtTgl(j.status === "selesai" ? j.tglSelesai : j.tglMulai)))}${kv("Prioritas · Bobot", e((H.PRIORITAS[j.prioritas] || "–") + " · " + (H.BOBOT[j.bobot] || "–")))}${kv("Kelompok", e(namaKel(j.kelompokId)))}</div>${j.deskripsi ? `<p class="dj-desk">${e(j.deskripsi)}</p>` : ""}</div>`;
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
  S.detail = { id, aktivitas: [], berkas: 0, kertas: "ikut", nilai: "", muat: true }; S.tab = "job"; S.terbuka = ""; render(); scrollTo(0, 0);
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
async function unggahBerkas(files) {
  const j = jobDetail(); if (!j || !files.length) return; toast(`Mengunggah ${files.length} berkas…`, "info");
  try {
    const baru = [];
    for (const f of files) { const path = `dailyjob/${j.kelompokId}/${j.id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`; baru.push({ nama: f.name, path, url: await unggahBlob(path, f, f.type || "application/octet-stream"), ukuran: f.size, tipe: f.type || "", oleh: S.u.nama || S.u.email, tgl: H.hariIni() }); }
    const file = [...(j.file || []), ...baru]; await updateDoc(doc(db, "dj_job", j.id), { file, diubah: serverTimestamp() }); j.file = file; S.detail.berkas = file.length - 1; segarkanTautan(j); render(); toast("Berkas tersimpan.");
  } catch (err) { console.error(err); toast("Belum terunggah: " + e(err.message || err), "bahaya"); }
}
function panelTarget(id) {
  const j = jobId(id); if (!j) return; const kep = adalahKepala(j);
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Ubah target selesai</h2><p class="mr-sub">${e(j.judul)}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form" style="grid-template-columns:1fr"><label class="mr-f"><span>Target baru</span><input type="date" id="djt-tgl" value="${e(j.tglTarget || "")}"></label>
  <label class="mr-f"><span>Alasan ${kep ? "<small>(opsional)</small>" : "*"}</span><textarea id="djt-alasan" rows="2" maxlength="300" placeholder="mis. menunggu revisi dari customer"></textarea></label></div></div>
  <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="target-simpan" data-id="${e(id)}">Simpan</button></footer>`);
}
async function simpanTarget(id) {
  const j = jobId(id), baru = ($("#djt-tgl") || {}).value, alasan = (($("#djt-alasan") || {}).value || "").trim(); if (!j || !baru) return toast("Isi tanggal target.", "bahaya");
  if (baru === j.tglTarget) return tutupLayer(); if (!adalahKepala(j) && !alasan) return toast("Isi alasan perubahan target.", "bahaya");
  const x = { uid: S.u.uid, oleh: S.u.nama || S.u.email, peran: adalahKepala(j) ? "kepala" : "anggota", jenis: "target", dari: j.tglTarget || "", ke: baru, alasan, waktu: Date.now() };
  try { await setDoc(doc(db, "dj_job", id, "aktivitas", uid()), x); await updateDoc(doc(db, "dj_job", id), { tglTarget: baru, diubah: serverTimestamp() }); j.tglTarget = baru; if (S.detail && S.detail.id === id) S.detail.aktivitas.push(x); segarkanTautan(j); tutupLayer(); segarkanKop(); segarkanKanan(); render_tanpaDetail(); toast("Target diperbarui dan tercatat di riwayat."); }
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

function htmlKelompok() {
  const hit = (id) => S.akun.filter((a) => a.kelompokDJ === id).length;
  return `<section class="mr-kartu dj-kartu"><h3>Kelompok</h3><p class="mr-sub">Anggota hanya melihat dan mengubah job kelompoknya. Master dan admin melihat semua.</p>
    ${S.kelompok.map((k) => `<div class="dj-org"><span><b>${e(k.nama)}</b> · ${hit(k.id)} anggota · ${S.jobs.filter((j) => j.kelompokId === k.id).length} job</span><span class="mr-ruang"></span><button class="mr-btn mr-btn--kecil" data-dj="kel-ubah" data-id="${e(k.id)}">Ubah</button><button class="mr-ikonbtn" data-dj="kel-hapus" data-id="${e(k.id)}" aria-label="Hapus kelompok">${ikon("tong", 15)}</button></div>`).join("") || `<p class="mr-sub">Belum ada kelompok.</p>`}
    <button class="mr-btn mr-btn--utama" data-dj="kel-baru">${ikon("plus", 14)} Kelompok baru</button></section>
    <section class="mr-kartu dj-kartu"><h3>Kelompok tiap akun</h3>${S.akun.map((a) => `<div class="dj-org"><span>${e(a.nama || a.email)}<small> ${e(a.email)}</small></span>${a.kelompokDJ ? `<span class="dj-kep"><input type="checkbox" data-dj="kep-akun" data-id="${e(a.id)}" id="kep-${e(a.id)}" ${((S.kelompok.find((k) => k.id === a.kelompokDJ) || {}).kepala || []).includes(a.id) ? "checked" : ""}><label for="kep-${e(a.id)}">Kepala</label></span>` : ""}<select data-dj="kel-akun" data-id="${e(a.id)}" aria-label="Kelompok ${e(a.nama || a.email)}">${opsi(S.kelompok.map((k) => [k.id, k.nama]), a.kelompokDJ || "", "Tanpa kelompok")}</select></div>`).join("")}<p class="mr-sub">Kepala divisi dapat menilai hasil kerja (Setujui atau Perlu revisi) dan mengomentari job. Master dan admin selalu berperan sebagai kepala di semua kelompok.</p></section>`;
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
  const bukanBawaan = periodeAktif() !== "bulan" || S.fPic || S.fKat || (S.kelola && S.fKel) || (S.tab === "job" && (S.tampil !== "perlu" || S.masalah));
  const ikb = (aksi, ikn, judul, kelas = "") => `<button type="button" class="mr-btn dj-ib ${kelas}" data-dj="${aksi}" title="${judul}" aria-label="${judul}">${ikn}</button>`;
  const btnFilter = `<button type="button" class="mr-btn dj-ib" data-dj="filter" title="Filter: periode, kelompok, PIC, kategori" aria-label="Filter">${ikon("filter", 16)}${bukanBawaan ? `<i class="dj-dot"></i>` : ""}</button>`;
  const BEL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const aksiBtn = `${ikb("push", BEL, pushOn ? "Notifikasi aktif di perangkat ini (ketuk untuk mematikan)" : "Aktifkan notifikasi: pengingat catat job 09.00, 14.00, 17.00 dan deadline H-1", pushOn ? "dj-push-aktif" : "")}${S.kelola ? ikb("impor", ikon("upload", 16), "Import dari Excel") : ""}${hp ? ikb("pdf", ikon("download", 16), "Unduh laporan PDF", "dj-pdf") : `<button type="button" class="mr-btn dj-pdf" data-dj="pdf" title="Unduh laporan PDF">${ikon("download", 15)} PDF</button>`}`;
  const r = rentangAktif(), kelNama = S.fKel ? namaKel(S.fKel) : S.kelola ? "Semua kelompok" : namaKel(S.kelompokSaya);
  const kepalaP = `<div class="dj-kepala"><div class="dj-kepala__t"><div class="dj-ttl">${judulPeriode(r)}</div><div class="mr-sub">${pBln(r[0])} – ${pBln(r[1])} · ${e(kelNama)}${S.fPic ? " · " + e(S.fPic) : ""}${S.fKat ? " · " + e(S.fKat) : ""}</div></div><span class="dj-kepala__a">${btnFilter}${aksiBtn}</span></div>`;
  const kepalaD = `<div class="dj-kepala dj-kepala--d"><input type="search" id="dj-cari" class="dj-cari" placeholder="Cari judul, customer, PIC…" value="${e(S.cari)}" aria-label="Cari job"><button type="button" class="mr-btn dj-ib dj-lipat" data-dj="lipat" title="Ciutkan atau buka semua kelompok" aria-label="Ciutkan atau buka semua kelompok">${ikon("lipat", 16)}</button>${btnFilter}</div>`;
  let isi;
  if (S.muat) isi = `<p class="mr-sub">Memuat…</p>`;
  else if (S.galat) isi = `<div class="dj-alert dj-alert--bahaya">${e(S.galat)}</div>`;
  else if (!perlu) isi = `<section class="mr-kartu dj-kartu"><h3>Akun ini belum masuk kelompok</h3><p class="mr-sub">Minta master atau admin menetapkan kelompok Daily Job untuk akun Anda.</p></section>`;
  else if (S.detail && S.tab === "job") isi = htmlDetail(now);
  else isi = S.tab === "performa" ? kepalaP + htmlPengingat(now) + htmlPerforma(now) : S.tab === "job" ? kepalaD + htmlDaftar(now) : htmlKelompok();
  el.innerHTML = `<div class="dj-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" class="${S.tab === k ? "is-aktif" : ""}" data-dj="tab" data-v="${k}">${t}</button>`).join("")}</div>${isi}
    ${S.tab === "job" && !S.muat && !S.detail ? htmlBarPilih() : ""}${perlu && !S.muat && !S.detail && !(S.tab === "job" && S.pilih.size) ? `<button type="button" class="mr-fab" data-dj="baru" aria-label="Catat job baru">${ikon("plus", 22)}<span class="fab-teks">Catat job</span></button>` : ""}`;
  if (S.detail && S.tab === "job" && !S.muat) muatPratinjau();
}

/* ---------- panel filter (HP dan desktop): periode cepat, kelompok, PIC, kategori ---------- */
function panelFilter() {
  const sel = (aksi, lab, isi) => `<label class="mr-f"><span>${lab}</span><select data-dj="${aksi}">${isi}</select></label>`, job = S.tab === "job", d = job ? dataDaftar(H.hariIni()) : null;
  const chip = (aksi, v, t, n, on, kls = "") => `<button type="button" class="mr-chip ${kls}${on ? " is-aktif" : ""}" data-dj="${aksi}" data-v="${v}">${t}${n != null ? ` <span>${n}</span>` : ""}</button>`;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Filter</h2><p class="mr-sub">Berlaku untuk dashboard dan daftar job.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form" style="grid-template-columns:1fr">
  ${job ? `<div class="mr-f"><span>Tampilkan</span><div class="mr-seg dj-seg">${[["perlu", "Perlu tindakan"], ["aktif", "Semua aktif"], ["selesai", "Selesai"]].map(([k, t]) => chip("tampil", k, t, d.n[k], S.tampil === k)).join("")}</div></div>
  <div class="mr-f"><span>Masalah</span><div class="mr-seg dj-seg">${MASALAH.map(([k, t]) => chip("masalah", k, t, d.mas[k], S.masalah === k)).join("")}</div></div>
  <div class="mr-f"><span>PIC</span><div class="mr-seg dj-seg">${chip("f-picchip", "", "Semua", null, !S.fPic)}${daftarPic().map((p) => `<button type="button" class="mr-chip${S.fPic === p ? " is-aktif" : ""}" data-dj="f-picchip" data-v="${e(p)}">${avatar(p)} ${e(p)}</button>`).join("")}</div></div>` : ""}
  <div class="mr-f"><span>${job ? "Periode (untuk Selesai)" : "Periode"}</span><div class="mr-seg dj-seg" role="group" aria-label="Periode">${[["bulan", "Bulan ini"], ["minggu", "Minggu ini"], ["tahun", "Tahun ini"], ["rentang", "Rentang"]].map(([k, t]) => `<button type="button" class="mr-chip${S.periode === k ? " is-aktif" : ""}" data-dj="periode" data-v="${k}">${t}</button>`).join("")}</div>
  ${S.periode === "rentang" ? `<div class="dj-tgl"><input type="date" id="dj-dari" value="${e(S.dari)}" aria-label="Dari"><input type="date" id="dj-sampai" value="${e(S.sampai)}" aria-label="Sampai"></div>` : ""}</div>
  ${S.kelola ? sel("f-kel", "Kelompok", opsi(S.kelompok.map((k) => [k.id, k.nama]), S.fKel, "Semua kelompok")) : ""}${job ? "" : sel("f-pic", "PIC", opsi(daftarPic(), S.fPic, "Semua PIC"))}${sel("f-kat", "Kategori", opsi(H.daftarKategori(S.jobs), S.fKat, "Semua kategori"))}</div></div>
  <footer class="mr-panel__kaki dj-kaki"><button class="mr-btn" data-dj="filter-reset">Atur ulang</button><span class="mr-ruang"></span><button class="mr-btn mr-btn--utama" data-aksi="tutup-layer">Selesai</button></footer>`);
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
    ${f("PIC", `<input id="djf-pic" list="djf-piclist" value="${e(d.pic || "")}"><datalist id="djf-piclist">${daftarPic().map((p) => `<option value="${e(p)}">`).join("")}</datalist>`)}
    ${f("Customer / project", `<input id="djf-cust" value="${e(d.customer || "")}" placeholder="Nama customer">`)}
    ${f("Status", `<select id="djf-status">${opsi(Object.entries(H.STATUS), d.status)}</select>`)}
    ${f("Target selesai *", `<input type="date" id="djf-target" value="${e(d.tglTarget || "")}">`)}
    ${baru ? "" : f("Alasan ubah target <small>(wajib bila target diubah, kecuali kepala divisi)</small>", `<input id="djf-alasan" maxlength="300" placeholder="mis. menunggu revisi dari customer">`, "dj-lebar dj-alasan").replace('class="mr-f', 'hidden class="mr-f')}
    ${f("Deskripsi pekerjaan", `<textarea id="djf-desk" rows="3" placeholder="Apa yang dikerjakan, permintaan customer, hasil yang diharapkan">${e(d.deskripsi || "")}</textarea>`, "dj-lebar")}
    <div class="mr-f dj-lebar"><span>Berkas hasil kerja <small>Word, Excel, PDF, gambar (maks. 4 MB per file). Bisa dipratinjau di halaman detail tanpa mengunduh.</small></span>
      <div id="djf-file">${d.file.map((x, i) => `<div class="dj-fl"><a href="${aman(x.url)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(x.nama)}</a><button type="button" class="mr-ikonbtn" data-dj="file-lepas" data-i="${i}" aria-label="Lepas file">${ikon("tutup", 14)}</button></div>`).join("")}</div>
      <input type="file" id="djf-berkas" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,image/*"><div class="dj-tautan"><input id="djf-tl" placeholder="Atau tempel tautan (Drive, OneDrive)"><button type="button" class="mr-btn mr-btn--kecil" data-dj="tautan-tambah">Tambah tautan</button></div>
      <div id="djf-tautan">${d.tautan.map((x, i) => `<div class="dj-fl"><a href="${aman(x.url)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(x.nama || x.url)}</a><button type="button" class="mr-ikonbtn" data-dj="tautan-lepas" data-i="${i}" aria-label="Lepas tautan">${ikon("tutup", 14)}</button></div>`).join("")}</div></div>
    <details class="dj-lain dj-lebar"><summary>Lainnya: tanggal, prioritas, bobot${S.kelola ? ", kelompok" : ""}</summary><div class="mr-form dj-form" style="margin-top:10px">
      ${S.kelola ? f("Kelompok", `<select id="djf-kel">${opsi(kelompokPilihan().map((k) => [k.id, k.nama]), d.kelompokId)}</select>`) : ""}
      ${f("Tanggal masuk", `<input type="date" id="djf-masuk" value="${e(d.tglMasuk || "")}">`)}${f("Mulai dikerjakan", `<input type="date" id="djf-mulai" value="${e(d.tglMulai || "")}">`)}${f("Tanggal selesai", `<input type="date" id="djf-selesai" value="${e(d.tglSelesai || "")}">`)}
      ${f("Prioritas", `<select id="djf-prio">${opsi(Object.entries(H.PRIORITAS), d.prioritas)}</select>`)}${f("Bobot kerja", `<select id="djf-bobot">${opsi(Object.entries(H.BOBOT).map(([k, t]) => [k, `${t} (${k})`]), d.bobot)}</select>`)}</div></details>
  </div></div>
  <footer class="mr-panel__kaki dj-kaki">${baru ? "" : `<button class="mr-btn dj-ib dj-bhy" data-dj="hapus" data-id="${e(d.id)}" title="Hapus job" aria-label="Hapus job">${ikon("tong", 16)}</button>`}<span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="simpan" id="dj-simpan">Simpan</button></footer>`);
  $("#dj-form")._d = d;
  $("#djf-kat").onchange = (ev) => { const n = $("#djf-kat-baru"); n.hidden = ev.target.value !== "__baru"; if (!n.hidden) n.focus(); };
  $("#djf-status").onchange = (ev) => { const s = $("#djf-selesai"); if (ev.target.value === "selesai" && !s.value) s.value = H.hariIni(); if (ev.target.value !== "selesai") s.value = ""; };
  $("#djf-target").oninput = (ev) => { const a = $(".dj-alasan"); if (a) a.hidden = !d.tglTarget || ev.target.value === d.tglTarget; };
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
    for (const b of berkasBaru) { const path = `dailyjob/${kel}/${id}/${Date.now()}-${b.name.replace(/[^\w.\-]+/g, "_")}`; file.push({ nama: b.name, path, url: await unggahBlob(path, b, b.type || "application/octet-stream"), ukuran: b.size, tipe: b.type || "", oleh: S.u.nama || S.u.email, tgl: H.hariIni() }); }
    const berubahTarget = !!d.id && !!d.tglTarget && d.tglTarget !== target, alasan = v("djf-alasan").trim();
    if (berubahTarget && !alasan && !adalahKepala(d)) { tombol.disabled = false; tombol.textContent = "Simpan"; return toast("Isi alasan perubahan target.", "bahaya"); }
    const status = v("djf-status"), data = {
      judul, kategori: kat, customer: v("djf-cust").trim(), pic: v("djf-pic").trim(), kelompokId: kel, deskripsi: v("djf-desk").trim(), tglMasuk: v("djf-masuk") || H.hariIni(), tglMulai: v("djf-mulai") || null, tglTarget: target,
      status, tglSelesai: status === "selesai" ? v("djf-selesai") || H.hariIni() : null, prioritas: v("djf-prio"), bobot: +v("djf-bobot") || 2, file, tautan: d.tautan, catatan: d.catatan || [],
      dibuatOleh: d.dibuatOleh || S.u.uid, dibuatNama: d.dibuatNama || S.u.nama || S.u.email, dibuatPada: d.dibuatPada || H.hariIni(), diubah: serverTimestamp(),
    };
    await setDoc(doc(db, "dj_job", id), data, { merge: true });
    if (berubahTarget) { const x = { uid: S.u.uid, oleh: S.u.nama || S.u.email, peran: adalahKepala(d) ? "kepala" : "anggota", jenis: "target", dari: d.tglTarget, ke: target, alasan, waktu: Date.now() }; await setDoc(doc(db, "dj_job", id, "aktivitas", uid()), x).catch((err) => console.warn(err)); if (S.detail && S.detail.id === id) S.detail.aktivitas.push(x); }
    const ada = S.jobs.findIndex((x) => x.id === id), baru = { ...(ada >= 0 ? S.jobs[ada] : {}), id, ...data, diubah: null };
    if (ada >= 0) S.jobs[ada] = baru; else S.jobs.push(baru); segarkanTautan(baru);
    tutupLayer(); render(); toast("Job tersimpan.");
  } catch (err) { console.error(err); toast("Job belum tersimpan: " + e(err.message || err), "bahaya"); tombol.disabled = false; tombol.textContent = "Simpan"; }
}


/* ---------- PDF ---------- */
const tungguLib = async () => { for (let i = 0; i < 40 && !(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable); i++) await new Promise((r) => setTimeout(r, 250)); if (!(window.jspdf && window.jspdf.jsPDF.API.autoTable)) throw new Error("Pustaka PDF belum siap. Coba lagi sebentar lagi."); };
async function unduhPdf() {
  const tombol = $(".dj-pdf"); if (tombol) tombol.disabled = true;
  try {
    await tungguLib();
    const { buatLaporanPdf } = await import("./daily-job-pdf.js"), r = rentangAktif(), p = periodeAktif();
    const kel = S.fKel ? namaKel(S.fKel) : S.kelola ? "Semua kelompok" : namaKel(S.kelompokSaya);
    const filter = [S.fPic && "PIC: " + S.fPic, S.fKat && "Kategori: " + S.fKat].filter(Boolean).join(", ");
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
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Import dari Excel</h2><p class="mr-sub">Lembar "Input Tugas Harian": Tanggal Diberikan, PIC, Kategori, Customer, Deskripsi, Deadline, Tanggal Selesai, Keterangan. Impor ulang file yang sama menimpa job impor sebelumnya, bukan menggandakan.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form"><label class="mr-f dj-lebar"><span>File Excel (.xlsx)</span><input type="file" id="dji-file" accept=".xlsx,.xls"></label>
  <label class="mr-f dj-lebar"><span>Masuk ke kelompok</span><select id="dji-kel">${opsi([...S.kelompok.map((k) => [k.id, k.nama]), ...(S.kelompok.some((k) => k.nama === NAMA_TIM) ? [] : [["__baru", `＋ Buat kelompok "${NAMA_TIM}"`]])], (S.kelompok.find((k) => k.nama === NAMA_TIM) || {}).id || S.fKel || "__baru")}</select></label>
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
      const id = `imp-${kel}-${j.id}`, data = { ...j, kelompokId: kel, tglMasuk: j.tglMasuk || sekarang, dibuatOleh: S.u.uid, dibuatNama: "Import Excel", dibuatPada: sekarang, diimpor: true, diubah: serverTimestamp() };
      await setDoc(doc(db, "dj_job", id), data); n++;
      const ada = S.jobs.findIndex((x) => x.id === id), baru = { ...data, id, diubah: null }; if (ada >= 0) S.jobs[ada] = baru; else S.jobs.push(baru);
    }));
    tutupLayer(); S.fKel = kel; S.periode = "rentang"; const t = S.jobs.filter((x) => x.diimpor).map((x) => x.tglMasuk).sort(); S.dari = t[0]; S.sampai = H.hariIni(); render(); toast(`${n} job diimpor.`);
  } catch (err) { console.error(err); toast(`Impor berhenti setelah ${n} job: ` + e(err.message || err), "bahaya"); tombol.disabled = false; tombol.textContent = "Impor"; }
}

/* ---------- aksi ---------- */
/* ---------- aksi daftar: pilih banyak, selesai, ubah PIC, bagikan, hapus ---------- */
const jobId = (id) => S.jobs.find((x) => x.id === id);
const idsAksi = (id) => (id ? [id] : [...S.pilih]);
function selesaiPilih() { S.pilih.clear(); S.modePilih = false; S.terbuka = ""; render(); }
function mulaiPilih(id) { S.modePilih = true; S.terbuka = ""; if (id) S.pilih.add(id); render(); }
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

/* geser: kiri = aksi (Selesai, Ubah, Bagikan, Hapus), kanan = mulai pilih; tekan lama = mulai pilih */
let sw = null, blokKlik = 0;
const LEBAR_AKSI = 248, tutupGeser = () => { S.terbuka = ""; document.querySelectorAll(".dj-job2.is-geser").forEach((el) => { el.classList.remove("is-geser"); el.style.transform = ""; }); };
document.addEventListener("touchstart", (ev) => {
  if (window.__rute !== "dailyjob") return;
  const el = ev.target.closest(".dj-job2"); if (S.terbuka && (!el || el.dataset.id !== S.terbuka) && !ev.target.closest(".dj-sw")) tutupGeser();
  if (!el || S.modePilih || S.pilih.size) { sw = null; return; }
  const t = ev.touches[0]; sw = { el, id: el.dataset.id, x: t.clientX, y: t.clientY, dx: 0, mode: "", dasar: S.terbuka === el.dataset.id ? -LEBAR_AKSI : 0 };
  sw.lama = setTimeout(() => { if (sw && !sw.mode) { sw.mode = "tekan"; blokKlik = Date.now(); if (navigator.vibrate) navigator.vibrate(15); mulaiPilih(sw.id); } }, 520);
}, { passive: true });
document.addEventListener("touchmove", (ev) => {
  if (!sw) return; const t = ev.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (!sw.mode) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(sw.lama); sw = null; return; } if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { clearTimeout(sw.lama); sw.mode = "geser"; sw.el.style.transition = "none"; } else return; }
  if (sw.mode !== "geser") return; ev.preventDefault(); sw.dx = dx;
  sw.el.style.transform = `translateX(${Math.max(-LEBAR_AKSI, Math.min(90, sw.dasar + dx))}px)`;
}, { passive: false });
document.addEventListener("touchend", () => {
  if (!sw) return; clearTimeout(sw.lama); const { el, id, dasar, dx, mode } = sw; sw = null; if (mode !== "geser") return;
  blokKlik = Date.now(); el.style.transition = ""; const akhir = dasar + dx;
  if (akhir < -90) { tutupGeser(); S.terbuka = id; el.classList.add("is-geser"); el.style.transform = ""; }
  else if (akhir > 60) { el.style.transform = ""; mulaiPilih(id); }
  else { el.style.transform = ""; if (S.terbuka === id) { S.terbuka = ""; el.classList.remove("is-geser"); } }
});

const periksa = (ev) => window.__rute === "dailyjob" || ev.target.closest("#mr-layer");
document.addEventListener("click", async (ev) => {
  if (!periksa(ev)) return;
  const t = ev.target.closest("[data-dj]"); if (!t) return;
  const a = t.dataset.dj, id = t.dataset.id, v = t.dataset.v;
  if (t.tagName === "SELECT" || t.tagName === "INPUT") return;
  if (a === "tab") { S.tab = v; S.detail = null; return render(); }
  if (a === "periode") { S.periode = v; if (v === "rentang" && !S.dari) [S.dari, S.sampai] = H.rentang("bulan"); render(); return t.closest("#mr-layer") ? panelFilter() : undefined; }
  if (a === "kel-mode") { S.kel = v; return render(); }
  if (a === "grup") { S.buka[v] = !(v in S.buka ? S.buka[v] : dataDaftar(H.hariIni()).gr.find((g) => g.key === v)?.buka); return render(); }
  if (a === "lipat") { const gr = dataDaftar(H.hariIni()).gr, adaBuka = gr.some((g) => g.buka); gr.forEach((g) => { S.buka[g.key] = !adaBuka; }); return render(); }
  if (a === "baru") return formJob(null);
  if (a === "buka") { if (Date.now() - blokKlik < 400) return; if (S.terbuka) return tutupGeser(); if (S.modePilih || S.pilih.size) return togglePilih(id); return bukaDetail(id); }
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
  if (a === "cb") return togglePilih(id);
  if (a === "cb-semua") { const l = dataDaftar(H.hariIni()).l, semua = l.length && l.every((j) => S.pilih.has(j.id)); l.forEach((j) => (semua ? S.pilih.delete(j.id) : S.pilih.add(j.id))); S.modePilih = S.pilih.size > 0 || S.modePilih; return render(); }
  if (a === "cb-grup") { const g = dataDaftar(H.hariIni()).gr.find((x) => x.key === v); if (g) { const semua = g.jobs.every((j) => S.pilih.has(j.id)); g.jobs.forEach((j) => (semua ? S.pilih.delete(j.id) : S.pilih.add(j.id))); } return render(); }
  if (a === "pilih-batal") return selesaiPilih();
  if (a === "a-selesai") { ev.stopPropagation(); return selesaikan([id]); }
  if (a === "a-ubah") { ev.stopPropagation(); const j = jobId(id); tutupGeser(); return j && formJob(j); }
  if (a === "a-bagikan") { ev.stopPropagation(); tutupGeser(); return panelBagikan(id); }
  if (a === "a-hapus") { ev.stopPropagation(); tutupGeser(); return hapusJob([id]); }
  if (a === "m-selesai") return selesaikan(idsAksi());
  if (a === "m-pic") return panelPic(idsAksi());
  if (a === "m-bagikan") return bagikanJob(idsAksi());
  if (a === "m-hapus") return hapusJob(idsAksi());
  if (a === "pic-simpan") { const pic = ($("#djp-pic") || {}).value.trim(); if (!pic) return toast("Isi nama PIC.", "bahaya"); tutupLayer(); return ubahBanyak(t.dataset.ids.split(","), { pic }, "PIC diperbarui."); }
  if (a === "k-selesai") { S.tampil = "selesai"; S.masalah = ""; S.tab = "job"; return render(); }
  if (a === "k-telat") { S.tampil = "perlu"; S.masalah = "telat"; S.tab = "job"; return render(); }
  if (a === "tampil") { S.tampil = v; if (v === "selesai") S.masalah = ""; render(); return t.closest("#mr-layer") ? panelFilter() : undefined; }
  if (a === "masalah") { S.masalah = S.masalah === v ? "" : v; if (S.masalah && S.tampil === "selesai") S.tampil = "perlu"; render(); return t.closest("#mr-layer") ? panelFilter() : undefined; }
  if (a === "f-picchip") { S.fPic = v; render(); return panelFilter(); }
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
  if (a === "filter-reset") { S.fPic = ""; S.fKat = ""; S.periode = "bulan"; S.tampil = "perlu"; S.masalah = ""; if (S.kelola) S.fKel = ""; render(); return panelFilter(); }
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
    const kid = k ? k.id : uid(); try { await setDoc(doc(db, "dj_kelompok", kid), { nama, dibuat: k ? k.dibuat || H.hariIni() : H.hariIni(), kepala: k ? k.kepala || [] : [] }); await muat(); toast("Kelompok tersimpan."); } catch (err) { toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } return;
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
  if (a === "b-hari") { if (t.value) ubahTautan(t.dataset.id, "hari", +t.value); return; }
  if (t.id === "dj-up") { const f = [...t.files]; t.value = ""; return unggahBerkas(f); }
  const dalamPanel = !!t.closest("#mr-layer"), seg = () => { render(); if (dalamPanel) panelFilter(); };
  if (a === "f-kel") { S.fKel = t.value; S.fPic = ""; return seg(); }
  if (a === "f-pic") { S.fPic = t.value; return seg(); }
  if (a === "f-kat") { S.fKat = t.value; return seg(); }
  if (t.id === "dj-dari" || t.id === "dj-sampai") { S[t.id === "dj-dari" ? "dari" : "sampai"] = t.value; return seg(); }
  if (a === "kep-akun") {
    const ak = S.akun.find((x) => x.id === t.dataset.id), kel = ak && S.kelompok.find((k) => k.id === ak.kelompokDJ); if (!kel) return;
    const kepala = t.checked ? [...new Set([...(kel.kepala || []), ak.id])] : (kel.kepala || []).filter((x) => x !== ak.id);
    try { await setDoc(doc(db, "dj_kelompok", kel.id), { nama: kel.nama, dibuat: kel.dibuat || H.hariIni(), kepala }); kel.kepala = kepala; toast(t.checked ? "Ditetapkan sebagai kepala divisi." : "Bukan lagi kepala divisi."); } catch (err) { t.checked = !t.checked; toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } return;
  }
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
