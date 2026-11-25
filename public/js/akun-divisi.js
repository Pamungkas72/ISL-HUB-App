// Akun anggota divisi Daily Job per kelompok (Pengaturan > Akun sales dan akses; master dan admin).
// Membuat akun, menetapkan kepala divisi, pindah kelompok, reset sandi, nonaktifkan, hapus. Semua lewat Cloud Functions (functions/dailyjob-akun.js).
import { e, $, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { app, db } from "./firebase-config.js";
import { collection, getDocs, getDoc, doc, query, where, setDoc, updateDoc, deleteDoc, onSnapshot, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as H from "./daily-job-hitung.js";
import { muatPeran, semuaPreset } from "./peran-akses.js";
import { muatDivisi, isiDivisiAwal, simpanDivisi, arsipkanDivisi, hapusDivisi, masukkanKeDivisi, keluarkanDariDivisi, terapkanPresetKeAnggota, presetById } from "./divisi-umum.js";

const A = { kel: [], div: [], tampil: "daftar", akun: [], jobN: {}, pilihKel: "", unsub: null, siap: false, galat: "", root: null, filter: "", edit: null, userOk: true };
const WARNA = ["#6c5ce7", "#2e9e6e", "#d9822b", "#2c7be5", "#c0392b", "#7f8c8d"];
const avatar = (n, i) => `<span class="ad-av" style="background:${WARNA[i % 6]}">${e((n || "?")[0].toUpperCase())}</span>`;
const kelById = (id) => A.kel.find((k) => k.id === id);
const jabatanKepala = (a) => ((kelById(a.kelompokDJ) || {}).kepala || []).includes(a.id);

async function panggil(nama, data) {
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js");
  try { return (await httpsCallable(getFunctions(app, "asia-southeast2"), nama)(data)).data; }
  catch (err) { throw new Error(err && err.code === "functions/not-found" ? "Layanan akun belum aktif di server. Pastikan Cloud Functions sudah ter-deploy." : (err && err.message) || "Gagal menghubungi server."); }
}
async function muat() {
  try {
    A.kel = (await getDocs(collection(db, "dj_kelompok"))).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    const urutNama = (l) => l.sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    A.akun = urutNama((await getDocs(query(collection(db, "pengguna"), where("peran", "==", "dj")))).docs.map((d) => ({ id: d.id, ...d.data() })));
    /* akun yang sudah disetujui tetapi belum dikelompokkan (peran Lihat saja tanpa peran siap pakai): muncul di Tanpa kelompok, dikelompokkan lewat Pindah */
    const lain = (await getDocs(query(collection(db, "pengguna"), where("peran", "in", ["lihat", "sales"])))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.status === "aktif");
    const berdivisi = (await getDocs(query(collection(db, "pengguna"), where("divisiId", ">=", "")))).docs.map((d) => ({ id: d.id, ...d.data() })), ada = new Set(A.akun.map((a) => a.id));
    /* calon = sudah disetujui tetapi belum punya divisi atau kelompok: peran Lihat saja, atau peran siap pakai (jabatan) tanpa divisi; Sales biasa tidak ikut */
    const calon = lain.filter((a) => !a.kelompokDJ && !a.divisiId && (a.peran === "lihat" || (a.akses && a.akses.jabatan))).map((a) => ({ ...a, calon: true }));
    A.akun = [...A.akun, ...berdivisi.filter((a) => a.divisiId && !ada.has(a.id) && !a.kelompokDJ)];
    A.akun = [...A.akun, ...urutNama(calon)];
    await muatPeran().catch(() => {}); A.div = await muatDivisi();
    if (!A.seed) { A.seed = true; try { if (await isiDivisiAwal()) A.div = await muatDivisi(); } catch (_) {} }
    A.galat = "";
    await Promise.all(A.kel.map(async (k) => { try { A.jobN[k.id] = (await getCountFromServer(query(collection(db, "dj_job"), where("kelompokId", "==", k.id)))).data().count; } catch (_) {} }));
  } catch (err) { console.error(err); A.galat = "Daftar akun divisi belum bisa dibaca."; }
  A.siap = true;
}
const urutKel = (l) => l.sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
/* Kelompok disinkronkan langsung dari Firestore: kelompok yang dibuat atau diubah di Daily Job muncul di sini tanpa muat ulang. */
function langganKelompok() {
  if (A.unsub) return;
  A.unsub = onSnapshot(collection(db, "dj_kelompok"), (snap) => { A.kel = urutKel(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); if (A.siap) gambar(); }, () => {});
}
const baris = (a, i) => `<div class="ad-baris">${avatar(a.nama, i)}<span class="ad-t"><b>${e(a.nama || "-")}</b><small>${a.kodeUnit ? `<b>${e(a.kodeUnit)}</b> · ` : ""}${e(a.username ? "@" + a.username : a.email || "")}${a.telepon ? ` · ${e(a.telepon)}` : ""}</small></span>${a.status === "nonaktif" ? `<span class="ad-bd">Nonaktif</span>` : ""}${a.akses && a.akses.dj === 1 ? `<span class="ad-bd">Lihat saja</span>` : ""}<span class="ad-bd${jabatanKepala(a) ? " ad-bd--k" : ""}">${jabatanKepala(a) ? "Kepala divisi" : "Anggota"}</span><button type="button" class="mr-ikonbtn" data-ad="kelola" data-id="${e(a.id)}" aria-label="Kelola ${e(a.nama)}">${ikon("titik", 18)}</button></div>`;
const urut = (l) => [...l].sort((x, y) => jabatanKepala(y) - jabatanKepala(x) || String(x.nama).localeCompare(String(y.nama), "id"));
const awalanKel = (k) => k.awalan || H.awalanKelompok(k.nama);
const kelAktif = () => A.kel.filter((k) => !k.arsip);
const anggotaKel = (id) => urut(A.akun.filter((a) => a.kelompokDJ === id));
const namaKepala = (k) => { const a = A.akun.find((x) => x.id === (k.kepala || [])[0]); return a ? a.nama : "—"; };
const profilNama = (k) => (k.profil === "tracking" ? "Tracking" : "Marketing");
function detailKel(k, hp) {
  const l = anggotaKel(k.id), kosong = !l.length && !(A.jobN[k.id] > 0);
  const baris2 = (a, i) => `<div class="kd-ang" data-id="${e(a.id)}">${avatar(a.nama, i + 1)}<span class="ad-t"><b>${e(a.nama || "-")}</b><small>${a.kodeUnit ? `<span class="ak-kode">${e(a.kodeUnit)}</span> · ` : ""}${e(a.username ? "@" + a.username : a.email || "")}${a.status === "nonaktif" ? " · Nonaktif" : ""}</small></span>${jabatanKepala(a) ? `<span class="ad-bd ad-bd--k">Kepala</span>` : ""}
    <span class="kd-aksi"><button type="button" class="mr-btn mr-btn--kecil" data-ad="pindah" data-id="${e(a.id)}">Pindah ▾</button>${hp ? "" : `<button type="button" class="mr-btn mr-btn--kecil" data-ad="kepala-cepat" data-id="${e(a.id)}">${jabatanKepala(a) ? "Lepas kepala" : "Jadikan kepala"}</button>`}<button type="button" class="mr-ikonbtn" data-ad="kelola" data-id="${e(a.id)}" aria-label="Atur ${e(a.nama || "akun")}">⋯</button></span></div>`;
  return `<div class="kd-detail" data-k="${e(k.id)}"><div class="kd-judul"><div class="kd-judul__t"><h3>${e(k.nama)}</h3><div class="kd-mini"><span>Profil <b>${profilNama(k)}</b></span><span>Awalan <span class="ak-kode">${e(awalanKel(k))}</span></span>${k.dibuat ? `<span>Dibuat <b>${e(k.dibuat)}</b></span>` : ""}</div></div>
    <div class="kd-judul__a"><button type="button" class="mr-btn mr-btn--kecil" data-ad="kel-ubah" data-k="${e(k.id)}">Ubah</button><button type="button" class="mr-btn mr-btn--kecil" data-ad="kel-arsip" data-k="${e(k.id)}">Arsipkan</button><button type="button" class="mr-btn mr-btn--kecil mr-btn--bahaya${kosong ? "" : " kd-redup"}" data-ad="kel-hapus" data-k="${e(k.id)}" title="${kosong ? "" : "Pindahkan anggota dan job dulu, atau arsipkan"}">Hapus</button></div></div>
    <div class="kd-stat"><div><span class="st-badge st-badge--warn">Kepala divisi</span><b>${e(namaKepala(k))}</b></div><div><span class="st-badge">Anggota</span><b>${l.length}</b></div><div><span class="st-badge st-badge--ok">Job</span><b>${A.jobN[k.id] ?? "–"}</b></div></div>
    <div class="kd-ang-kepala"><h4>Anggota</h4><span class="mr-sub">Tambah lewat Tanpa kelompok &rsaquo; Pindah</span></div>
    <div class="kd-daftar">${l.map(baris2).join("") || `<p class="mr-sub" style="margin:10px 0">Belum ada anggota.</p>`}</div></div>`;
}
const divById = (id) => A.div.find((d) => d.id === id);
const divAktif = () => A.div.filter((d) => !d.arsip);
const jabatanKepalaDiv = (a) => ((divById(a.divisiId) || {}).kepala || []).includes(a.id);
const anggotaDiv = (id) => [...A.akun.filter((a) => a.divisiId === id)].sort((x, y) => jabatanKepalaDiv(y) - jabatanKepalaDiv(x) || String(x.nama).localeCompare(String(y.nama), "id"));
const namaKepalaDiv = (d) => { const a = A.akun.find((x) => x.id === (d.kepala || [])[0]); return a ? a.nama : "—"; };
const namaPreset = (d) => { const p = presetById(d.presetId); return p ? p.nama : "belum dipilih"; };
const identAkun = (a) => e(a.username ? "@" + a.username : a.email || "");
function detailDivisi(d) {
  const l = anggotaDiv(d.id), kosong = !l.length;
  const baris3 = (a, i) => `<div class="kd-ang" data-id="${e(a.id)}">${avatar(a.nama, i + 1)}<span class="ad-t"><b>${e(a.nama || "-")}</b><small>${identAkun(a)}${a.status === "nonaktif" ? " · Nonaktif" : ""}</small></span>${jabatanKepalaDiv(a) ? `<span class="ad-bd ad-bd--k">Kepala</span>` : ""}
    <span class="kd-aksi"><button type="button" class="mr-btn mr-btn--kecil" data-ad="pindah-u" data-id="${e(a.id)}">Pindah ▾</button><button type="button" class="mr-btn mr-btn--kecil" data-ad="kepala-div" data-id="${e(a.id)}">${jabatanKepalaDiv(a) ? "Lepas kepala" : "Jadikan kepala"}</button></span></div>`;
  return `<div class="kd-detail" data-k="d:${e(d.id)}"><div class="kd-judul"><div class="kd-judul__t"><h3>${e(d.nama)}</h3><div class="kd-mini"><span>Peran siap pakai <b>${e(namaPreset(d))}</b></span><span>Tanpa Daily Job</span></div></div>
    <div class="kd-judul__a"><button type="button" class="mr-btn mr-btn--kecil" data-ad="div-ubah" data-k="${e(d.id)}">Ubah</button><button type="button" class="mr-btn mr-btn--kecil" data-ad="div-arsip" data-k="${e(d.id)}">Arsipkan</button><button type="button" class="mr-btn mr-btn--kecil mr-btn--bahaya${kosong ? "" : " kd-redup"}" data-ad="div-hapus" data-k="${e(d.id)}" title="${kosong ? "" : "Pindahkan anggota dulu, atau arsipkan"}">Hapus</button></div></div>
    <div class="kd-stat"><div><span class="st-badge st-badge--warn">Kepala divisi</span><b>${e(namaKepalaDiv(d))}</b></div><div><span class="st-badge">Anggota</span><b>${l.length}</b></div></div>
    <div class="kd-ang-kepala"><h4>Anggota</h4><span class="mr-sub">Izin anggota mengikuti peran siap pakai divisi. Tambah lewat Tanpa divisi &rsaquo; Pindah</span></div>
    <div class="kd-daftar">${l.map(baris3).join("") || `<p class="mr-sub" style="margin:10px 0">Belum ada anggota.</p>`}</div></div>`;
}
/* Bagan: semua divisi dan kelompok Daily Job, kepala lalu staf */
function bagan() {
  const kartu = (nama, ket, kepalaNama, staf) => `<div class="kd-detail kd-bagan"><div class="kd-judul__t"><h3>${e(nama)}</h3><div class="kd-mini"><span>${e(ket)}</span></div></div><div class="kd-stat"><div><span class="st-badge st-badge--warn">Kepala</span><b>${e(kepalaNama)}</b></div><div><span class="st-badge">Staf</span><b>${staf.length}</b></div></div><div class="kd-staf">${staf.map((a) => `<span class="ad-bd">${e(a.nama || a.email || "-")}</span>`).join("") || `<span class="mr-sub">Belum ada staf</span>`}</div></div>`;
  const dj = kelAktif().map((k) => kartu(k.nama, `Daily Job · ${profilNama(k)}`, namaKepala(k), anggotaKel(k.id).filter((a) => !jabatanKepala(a)))), um = divAktif().map((d) => kartu(d.nama, `Peran ${namaPreset(d)}`, namaKepalaDiv(d), anggotaDiv(d.id).filter((a) => !jabatanKepalaDiv(a))));
  const tanpa = A.akun.filter((a) => a.calon);
  return `<div class="kd-bagan-grid">${[...dj, ...um].join("") || `<p class="mr-sub">Belum ada divisi.</p>`}</div>${tanpa.length ? `<p class="mr-sub" style="margin-top:12px">Belum dikelompokkan: ${tanpa.map((a) => e(a.nama || a.email)).join(", ")}</p>` : ""}`;
}
function html() {
  if (!A.siap) return `<p class="mr-sub">Memuat kelompok divisi…</p>`;
  if (A.galat) return `<p class="mr-sub">${e(A.galat)}</p>`;
  const hp = matchMedia("(max-width: 760px)").matches, ak = kelAktif(), ar = A.kel.filter((k) => k.arsip), da = divAktif(), dar = A.div.filter((d) => d.arsip);
  const item = [...ak.map((k) => ({ id: k.id, nama: k.nama, ket: `${profilNama(k)} · ${awalanKel(k)}`, n: anggotaKel(k.id).length })), ...da.map((d) => ({ id: "d:" + d.id, nama: d.nama, ket: `${namaPreset(d)} · tanpa Daily Job`, n: anggotaDiv(d.id).length }))];
  const kid = item.some((x) => x.id === A.pilihKel) ? A.pilihKel : (item[0] || {}).id || "", dipilihDiv = kid.startsWith("d:"), k = ak.find((x) => x.id === kid), d = dipilihDiv ? divById(kid.slice(2)) : null;
  const tanpa = A.akun.filter((a) => !kelById(a.kelompokDJ) && !a.divisiId);
  const kepala = `<div class="ad-kepala"><div><h4>Divisi dan kelompok</h4><p class="mr-sub">Satu akun satu divisi. Kelompok Daily Job dan divisi lain (Finance, Legal, CS, dll.) diatur di sini; tiap divisi punya satu kepala. <span class="kd-sync">● Tersinkron</span></p></div><span class="ad-aksi"><span class="ad-seg" data-ad-jab="${A.tampil}"><button type="button" data-ad="tampil" data-v="daftar" class="${A.tampil === "daftar" ? "is-on" : ""}">Daftar</button><button type="button" data-ad="tampil" data-v="bagan" class="${A.tampil === "bagan" ? "is-on" : ""}">Bagan</button></span><button type="button" class="mr-btn" data-ad="kel-baru">${ikon("plus", 14)} Kelompok Daily Job</button><button type="button" class="mr-btn mr-btn--utama" data-ad="div-baru">${ikon("plus", 14)} Divisi baru</button></span></div>`;
  const arsipHtml = (ar.length || dar.length) ? `<details class="st-laci"><summary><span>Diarsipkan</span><span class="st-laci-jml">${ar.length + dar.length} divisi dan kelompok</span></summary><div class="st-laci-isi">${ar.map((x) => `<div class="kd-ars"><span><b>${e(x.nama)}</b><small>Daily Job · ${anggotaKel(x.id).length} anggota · ${A.jobN[x.id] ?? 0} job</small></span><button type="button" class="mr-btn mr-btn--kecil" data-ad="kel-pulih" data-k="${e(x.id)}">Pulihkan</button><button type="button" class="mr-btn mr-btn--kecil mr-btn--bahaya" data-ad="kel-hapus" data-k="${e(x.id)}">Hapus</button></div>`).join("")}${dar.map((x) => `<div class="kd-ars"><span><b>${e(x.nama)}</b><small>${anggotaDiv(x.id).length} anggota</small></span><button type="button" class="mr-btn mr-btn--kecil" data-ad="div-pulih" data-k="${e(x.id)}">Pulihkan</button><button type="button" class="mr-btn mr-btn--kecil mr-btn--bahaya" data-ad="div-hapus" data-k="${e(x.id)}">Hapus</button></div>`).join("")}</div></details>` : "";
  const tanpaHtml = tanpa.length ? `<div class="kd-detail"><div class="kd-judul"><div class="kd-judul__t"><h3>Tanpa divisi</h3><div class="kd-mini"><span>${tanpa.length} akun sudah disetujui, belum dikelompokkan</span></div></div></div><div class="kd-daftar">${tanpa.map((a, i) => `<div class="kd-ang">${avatar(a.nama, i)}<span class="ad-t"><b>${e(a.nama || "-")}</b><small>${identAkun(a)}${a.akses && a.akses.jabatan ? " · " + e(a.akses.jabatan) : ""}</small></span><span class="kd-aksi"><button type="button" class="mr-btn mr-btn--kecil" data-ad="${a.calon ? "pindah-u" : "pindah"}" data-id="${e(a.id)}">Pindah ▾</button></span></div>`).join("")}</div></div>` : "";
  if (!item.length) return `${kepala}<div class="st-stat">Belum ada divisi atau kelompok. Tekan <b>＋ Divisi baru</b> atau <b>＋ Kelompok Daily Job</b>.</div>${tanpaHtml}${arsipHtml}`;
  if (A.tampil === "bagan") return `${kepala}${bagan()}${arsipHtml}`;
  const detail = dipilihDiv ? (d ? detailDivisi(d) : "") : detailKel(k, hp);
  if (hp) return `${kepala}<div class="ak-chip kd-chip" role="tablist">${item.map((x) => `<button type="button" role="tab" data-ad="kel-pilih" data-k="${e(x.id)}" class="${x.id === kid ? "is-aktif" : ""}">${e(x.nama)} ${x.n}</button>`).join("")}</div>${detail}${tanpaHtml}${arsipHtml}`;
  return `${kepala}<div class="kd-dua"><nav class="kd-list" aria-label="Divisi dan kelompok">${item.map((x) => `<button type="button" data-ad="kel-pilih" data-k="${e(x.id)}" class="${x.id === kid ? "is-aktif" : ""}"><span><b>${e(x.nama)}</b><small>${e(x.ket)}</small></span><i>${x.n}</i></button>`).join("")}</nav><div class="kd-kanan">${detail}${tanpaHtml}</div></div>${arsipHtml}`;
}
const gambar = () => { if (A.root && A.root.isConnected) A.root.innerHTML = html(); };
export async function isiAkunDivisi(root) { A.root = root; gambar(); langganKelompok(); if (!A.siap) { await muat(); gambar(); } }
const segJabatan = (j) => `<div class="ad-seg" data-ad-jab="${j}"><button type="button" data-ad="jab" data-v="anggota" class="${j === "anggota" ? "is-on" : ""}">Anggota</button><button type="button" data-ad="jab" data-v="kepala" class="${j === "kepala" ? "is-on" : ""}">Kepala divisi</button></div>`;
const kepalaPanel = (judul, sub) => `<header class="mr-panel__kepala"><div><h2>${judul}</h2>${sub ? `<p class="mr-sub">${sub}</p>` : ""}</div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>`;
const opsiKel = (pilih) => A.kel.filter((k) => !k.arsip || k.id === pilih).map((k) => `<option value="${e(k.id)}"${k.id === pilih ? " selected" : ""}>${e(k.nama)}</option>`).join("");
const fld = (lab, isi) => `<label class="mr-f"><span>${lab}</span>${isi}</label>`;

const WAKTU = (w) => { const t = w && w.toDate ? w.toDate() : w ? new Date(w) : null; return t && !isNaN(t) ? t.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–"; };
const segAkses = (v) => `<div class="ad-seg" data-ad-jab="${v}"><button type="button" data-ad="jab" data-v="kelola" class="${v === "kelola" ? "is-on" : ""}">Kelola</button><button type="button" data-ad="jab" data-v="lihat" class="${v === "lihat" ? "is-on" : ""}">Lihat saja</button></div>`;
const segStatus = (st) => `<div class="ad-seg" data-ad-jab="${st}"><button type="button" data-ad="jab" data-v="aktif" class="${st === "aktif" ? "is-on" : ""}">Aktif</button><button type="button" data-ad="jab" data-v="nonaktif" class="${st === "nonaktif" ? "is-on" : ""}">Nonaktif</button></div>`;
function panelKelola(id, tab = "profil") {
  const a = A.akun.find((x) => x.id === id); if (!a) return;
  const kep = jabatanKepala(a), st = a.status === "nonaktif" ? "nonaktif" : "aktif";
  A.edit = { id, awal: { nama: a.nama || "", username: a.username || "", telepon: a.telepon || "", mail: a.emailKontak || "", kel: a.kelompokDJ || "", jab: kep ? "kepala" : "anggota", st, akses: a.akses && a.akses.dj === 1 ? "lihat" : "kelola" } }; A.userOk = true;
  const tabs = [["profil", "Profil"], ["peran", "Peran"], ["aman", "Keamanan"], ["riwayat", "Riwayat"]];
  bukaLayer(`${kepalaPanel("Edit akun")}<div class="mr-panel__isi" id="ad-kelola" data-id="${e(id)}">
    <div class="ad-id">${avatar(a.nama, 1)}<span class="ad-t"><b>${e(a.nama)}</b><small>${e(a.username ? "@" + a.username : a.email || "")} · ${e((kelById(a.kelompokDJ) || {}).nama || "tanpa kelompok")}</small></span><span class="ad-bd">${st === "aktif" ? "Aktif" : "Nonaktif"}</span></div>
    <div class="ad-info" id="ad-info"><div><b>–</b><small>Dibuat</small></div><div><b>–</b><small>Terakhir masuk</small></div><div><b>–</b><small>Job dicatat</small></div></div>
    <div class="ad-tab" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" data-ad="tab" data-v="${k}" class="${k === tab ? "is-on" : ""}">${t}</button>`).join("")}</div>
    <section data-tab="profil"${tab === "profil" ? "" : " hidden"} class="ad-bag">${fld("Nama tampil <small>pojok kanan atas, kartu, log</small>", `<input id="ad-e-nama" value="${e(a.nama || "")}" maxlength="80" autocomplete="off">`)}
      ${a.username ? fld("Username login", `<input id="ad-e-user" value="${e(a.username || "")}" maxlength="30" autocomplete="off" autocapitalize="none"><small id="ad-e-user-info" class="ad-cek"></small>`) : ""}<p class="ad-catatan" id="ad-user-cat" hidden></p>
      ${fld("Telepon <small>bisa dipakai masuk</small>", `<input id="ad-e-tel" type="tel" value="${e(a.telepon || "")}">`)}${fld("Email kontak <small>bisa dipakai masuk</small>", `<input id="ad-e-mail" type="email" value="${e(a.emailKontak || "")}">`)}
      <p class="mr-sub">Nama PIC di job lama tidak ikut berubah.</p></section>
    <section data-tab="peran"${tab === "peran" ? "" : " hidden"} class="ad-bag">${fld("Kelompok", `<select id="ad-pindah">${a.kelompokDJ ? "" : `<option value="">— pilih kelompok —</option>`}${opsiKel(a.kelompokDJ)}</select>`)}<p class="mr-sub" style="margin-top:-4px">Job lama tetap di kelompok lamanya.</p>
      ${fld("Jabatan <small>satu kepala per kelompok</small>", segJabatan(kep ? "kepala" : "anggota"))}${fld("Status", segStatus(st))}${fld("Akses Daily Job <small>lihat saja = tidak bisa mencatat atau mengubah job</small>", segAkses(a.akses && a.akses.dj === 1 ? "lihat" : "kelola"))}
      <p class="mr-sub">Akun yang belum dikelompokkan hanya melihat Beranda sampai kelompok dipilih di sini.</p></section>
    <section data-tab="aman"${tab === "aman" ? "" : " hidden"} class="ad-bag"><h4>Kata sandi</h4><p class="mr-sub">Kata sandi diatur pemilik akun lewat email (Lupa kata sandi di halaman masuk, atau Pengaturan &rsaquo; Akun saya).</p>
      ${a.calon ? "" : `<h4>Kelompok</h4><button class="mr-btn" data-ad="keluarkan">Keluarkan dari kelompok</button><p class="mr-sub">Akun kembali ke Tanpa kelompok dan hanya melihat Beranda.</p>`}<h4>Sesi login</h4><button class="mr-btn" data-ad="keluar">Akhiri semua sesi</button><p class="mr-sub">Orangnya harus masuk lagi.</p><h4>Hapus akun</h4><button class="mr-btn mr-btn--bahaya" data-ad="hapus">Hapus akun</button></section>
    <section data-tab="riwayat"${tab === "riwayat" ? "" : " hidden"} class="ad-bag" id="ad-riwayat"><p class="mr-sub">Memuat riwayat…</p></section></div>
    <footer class="mr-panel__kaki dj-kaki" id="ad-kaki"${tab === "profil" || tab === "peran" ? "" : " hidden"}><span class="mr-sub" id="ad-hit">Belum ada perubahan</span><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-ad="simpan-ok" id="ad-simpan" disabled>Simpan</button></footer>`);
  muatInfo(a); if (tab === "riwayat") muatRiwayat(id);
}
const bacaEdit = () => { const sg = document.querySelectorAll("#ad-kelola section[data-tab=peran] .ad-seg"); return { nama: nilai("ad-e-nama"), username: nilai("ad-e-user").toLowerCase(), telepon: nilai("ad-e-tel"), mail: nilai("ad-e-mail"), kel: ($("#ad-pindah") || {}).value, jab: sg[0] && sg[0].dataset.adJab, st: sg[1] && sg[1].dataset.adJab, akses: sg[2] && sg[2].dataset.adJab }; };
const LAB = { nama: "Nama tampil", username: "Username", telepon: "Telepon", mail: "Email kontak", kel: "Kelompok", jab: "Jabatan", st: "Status", akses: "Akses Daily Job" };
const beda = () => { if (!A.edit) return []; const b = bacaEdit(); return Object.keys(LAB).filter((k) => String(b[k] ?? "") !== String(A.edit.awal[k] ?? "")); };
function hitung() {
  const n = beda().length, i = $("#ad-hit"), s = $("#ad-simpan"); if (!i || !s) return;
  i.textContent = n ? `${n} perubahan belum disimpan` : "Belum ada perubahan"; s.disabled = !n || !A.userOk;
  const cat = $("#ad-user-cat"), u = nilai("ad-e-user").toLowerCase(); if (cat) { const g = u && u !== A.edit.awal.username; cat.hidden = !g; if (g) cat.innerHTML = `Username berubah dari <b>${e(A.edit.awal.username)}</b> menjadi <b>${e(u)}</b>. Semua sesi login akun ini akan berakhir; beri tahu orangnya.`; }
}
let tundaUser = 0;
function cekUsername() {
  const u = nilai("ad-e-user").toLowerCase(), i = $("#ad-e-user-info"); clearTimeout(tundaUser); if (!i) return;
  if (u === A.edit.awal.username) { i.textContent = ""; A.userOk = true; return hitung(); }
  if (!H.usernameValid(u)) { i.textContent = "3–30 karakter: huruf kecil, angka, titik, garis bawah, strip"; i.className = "ad-cek ad-cek--x"; A.userOk = false; return hitung(); }
  A.userOk = false; i.textContent = "Memeriksa…"; i.className = "ad-cek"; hitung();
  tundaUser = setTimeout(async () => { try { const s = await getDoc(doc(db, "dj_login", "u_" + u)); A.userOk = !s.exists(); i.textContent = s.exists() ? "Sudah dipakai" : "Tersedia ✓"; i.className = "ad-cek " + (s.exists() ? "ad-cek--x" : "ad-cek--ok"); } catch (_) { A.userOk = true; i.textContent = ""; } hitung(); }, 350);
}
async function muatInfo(a) {
  let jml = "–", masuk = "–", dibuat = WAKTU(a.dibuat);
  try { jml = (await getDocs(query(collection(db, "dj_job"), where("dibuatOleh", "==", a.id)))).size; } catch (_) {}
  try { const r = await panggil("djAturAnggota", { uid: a.id, aksi: "info" }); masuk = r.terakhirMasuk ? WAKTU(r.terakhirMasuk) : "Belum pernah"; if (dibuat === "–" && r.dibuat) dibuat = WAKTU(r.dibuat); } catch (_) {}
  const el = $("#ad-info"); if (el && A.edit && A.edit.id === a.id) el.innerHTML = `<div><b>${e(dibuat)}</b><small>Dibuat</small></div><div><b>${e(masuk)}</b><small>Terakhir masuk</small></div><div><b>${e(jml)}</b><small>Job dicatat</small></div>`;
}
const LABEL_LOG = { "dj-tambah": "Akun dibuat", "dj-ubah": "Data diubah", "dj-sandi": "Kata sandi direset", "dj-nonaktif": "Dinonaktifkan", "dj-aktif": "Diaktifkan lagi", "dj-kepala": "Ditetapkan kepala divisi", "dj-anggota": "Jabatan kepala dilepas", "dj-kelompok": "Pindah kelompok", "dj-akses": "Akses Daily Job diubah", "dj-keluar": "Semua sesi diakhiri", "dj-hapus": "Akun dihapus" };
async function muatRiwayat(id) {
  const el = $("#ad-riwayat"); if (!el) return;
  try {
    const l = (await getDocs(query(collection(db, "pengguna_log"), where("uid", "==", id)))).docs.map((d) => d.data()).sort((x, y) => (y.waktu && y.waktu.seconds || 0) - (x.waktu && x.waktu.seconds || 0)).slice(0, 20);
    const rinci = (x) => Object.keys(x.ke || {}).map((k) => `${e(k)}: ${e((x.dari || {})[k] ?? "–")} → ${e(x.ke[k] ?? "–")}`).join("; ");
    el.innerHTML = l.length ? l.map((x) => `<div class="ad-ev"><b>${e(LABEL_LOG[x.aksi] || x.aksi)}</b>${rinci(x) ? `<small>${rinci(x)}</small>` : ""}<small>${e(x.oleh || "–")} · ${e(WAKTU(x.waktu))}</small></div>`).join("") : `<p class="mr-sub">Belum ada catatan.</p>`;
  } catch (_) { el.innerHTML = `<p class="mr-sub">Riwayat belum bisa dibaca.</p>`; }
}
async function simpanEdit(t) {
  const x = A.edit, id = x.id, akun = A.akun.find((u) => u.id === id), b = bacaEdit(), d = beda(); if (!d.length || !akun) return;
  if (b.telepon && !H.normalTelepon(b.telepon)) return toast("Nomor telepon tidak valid.", "bahaya"); if (b.mail && !H.emailValid(b.mail)) return toast("Format email tidak valid.", "bahaya"); if (!b.nama) return toast("Isi nama tampil.", "bahaya");
  const logout = d.some((k) => ["username", "kel", "jab", "st"].includes(k));
  if (!(await konfirmasi("Simpan perubahan?", `<ul style="margin:0;padding-left:18px">${d.map((k) => `<li>${LAB[k]}: <b>${e(String(x.awal[k] || "–"))}</b> → <b>${e(String(b[k] || "–"))}</b></li>`).join("")}</ul>${logout ? `<p style="margin:10px 0 0">Semua sesi login akun ini akan berakhir.</p>` : ""}`, "Simpan"))) return;
  t.disabled = true;
  try {
    if (!akun.calon && d.some((k) => ["nama", "username", "telepon", "mail"].includes(k))) await panggil("djAturAnggota", { uid: id, aksi: "ubah", nama: b.nama, username: b.username, telepon: b.telepon, emailKontak: b.mail });
    if (akun.calon && b.kel) await panggil("djKelompokkan", { uid: id, kelompokId: b.kel, jabatan: b.jab }); // akun baru disetujui: jadi anggota divisi
    else if (d.includes("kel") && b.kel) await panggil("djAturAnggota", { uid: id, aksi: "kelompok", kelompokId: b.kel });
    const kepAwal = akun.calon && b.kel ? b.jab : d.includes("kel") ? "anggota" : x.awal.jab; // pindah kelompok melepas jabatan kepala lama
    if (b.jab !== kepAwal) await panggil("djAturAnggota", { uid: id, aksi: b.jab === "kepala" ? "kepala" : "anggota" });
    if (d.includes("akses") && (!akun.calon || b.kel)) await panggil("djAturAnggota", { uid: id, aksi: "akses", dj: b.akses === "lihat" ? 1 : 2 });
    if (d.includes("st") && (!akun.calon || b.kel)) await panggil("djAturAnggota", { uid: id, aksi: b.st === "nonaktif" ? "nonaktif" : "aktif" });
    await muat(); gambar(); tutupLayer(); toast("Perubahan disimpan.");
  } catch (err) { await muat(); gambar(); t.disabled = false; toast(e(err.message || err), "bahaya"); }
}
async function jalan(t, kerja, pesan) {
  t.disabled = true;
  try { await kerja(); await muat(); gambar(); if (pesan) toast(pesan); return true; } catch (err) { toast(e(err.message || err), "bahaya"); return false; } finally { t.disabled = false; }
}
/* Form kelompok (dipakai Pengaturan dan Daily Job): nama, profil, awalan kode unit. */
let formKel = { k: null, sesudah: null, manual: false };
export function bukaFormKelompok(k, { sesudah } = {}) {
  formKel = { k, sesudah: sesudah || null, manual: !!(k && k.awalan) };
  bukaLayer(`${kepalaPanel(k ? "Ubah kelompok" : "Kelompok baru", "Dipakai bersama di Pengaturan dan Daily Job.")}<div class="mr-panel__isi"><div class="mr-form" style="grid-template-columns:1fr" id="kf">
    ${fld("Nama kelompok", `<input id="kf-nama" maxlength="40" value="${e(k ? k.nama : "")}" autocomplete="off">`)}
    ${fld("Profil isian <small>menentukan formulir catat dan dashboard</small>", `<select id="kf-profil"><option value="marketing"${!k || k.profil !== "tracking" ? " selected" : ""}>Marketing</option><option value="tracking"${k && k.profil === "tracking" ? " selected" : ""}>Tracking</option></select>`)}
    ${fld("Awalan kode unit <small>2 sampai 4 huruf</small>", `<input id="kf-awalan" maxlength="4" value="${e(k ? awalanKel(k) : "")}" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase">`)}
    <p class="mr-sub" id="kf-info">Kode anggota: ${e(k ? awalanKel(k) : "XXX")}-01, ${e(k ? awalanKel(k) : "XXX")}-02, … nomor tidak dipakai ulang.</p></div></div>
    <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-ad="kel-simpan">${k ? "Simpan" : "Buat kelompok"}</button></footer>`);
}
async function simpanFormKelompok(t) {
  const k = formKel.k, nama = nilai("kf-nama"), profil = ($("#kf-profil") || {}).value || "marketing", awalan = nilai("kf-awalan").toUpperCase().replace(/[^A-Z]/g, "");
  if (nama.length < 2) return toast("Isi nama kelompok (minimal 2 huruf).", "bahaya");
  if (!/^[A-Z]{2,4}$/.test(awalan)) return toast("Awalan kode 2 sampai 4 huruf (A-Z).", "bahaya");
  if (A.kel.some((x) => x.id !== (k && k.id) && String(x.nama).toLowerCase() === nama.toLowerCase())) return toast("Nama kelompok ini sudah ada.", "bahaya");
  if (A.kel.some((x) => x.id !== (k && k.id) && awalanKel(x) === awalan)) return toast(`Awalan ${e(awalan)} sudah dipakai kelompok lain.`, "bahaya");
  const id = k ? k.id : "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  t.disabled = true;
  try {
    await setDoc(doc(db, "dj_kelompok", id), { nama, profil, awalan, ...(k ? {} : { dibuat: H.hariIni(), kepala: [] }) }, { merge: true });
    A.pilihKel = id; await muat(); gambar(); tutupLayer(); toast(k ? "Kelompok diperbarui." : "Kelompok dibuat."); if (formKel.sesudah) await formKel.sesudah();
  } catch (err) { t.disabled = false; toast(`<b>Belum tersimpan.</b> ${e(err.code || err.message)}`, "bahaya"); }
}
/** Hapus kelompok hanya bila tanpa anggota dan job; selain itu arahkan ke pindah atau arsip. */
export async function hapusKelompok(k) {
  let ang = 0, job = 0;
  try {
    ang = (await getCountFromServer(query(collection(db, "pengguna"), where("kelompokDJ", "==", k.id)))).data().count;
    job = (await getCountFromServer(query(collection(db, "dj_job"), where("kelompokId", "==", k.id)))).data().count;
  } catch (err) { toast(`<b>Belum bisa memeriksa isi kelompok.</b> ${e(err.code || err.message)}`, "bahaya"); return false; }
  if (ang || job) { toast(`<b>${e(k.nama)}</b> masih punya ${ang} anggota dan ${job} job. Pindahkan dulu, atau pakai <b>Arsipkan</b>.`, "bahaya"); return false; }
  if (!(await konfirmasi("Hapus kelompok?", `Kelompok <b>${e(k.nama)}</b> kosong dan dihapus permanen.`, "Hapus"))) return false;
  try { await deleteDoc(doc(db, "dj_kelompok", k.id)); toast("Kelompok dihapus."); return true; } catch (err) { toast(`<b>Belum terhapus.</b> ${e(err.code || err.message)}`, "bahaya"); return false; }
}
const nilai = (id) => (($("#" + id) || {}).value || "").trim();

/* ---------- divisi non-Daily Job (Finance, Legal, CS, dll.): data di divisi-umum.js, satu akun satu divisi ---------- */
const kodeTerpakai = async () => (await getDocs(collection(db, "pengguna"))).docs.map((d) => d.data().kodeSales).filter(Boolean);
const opsiPreset = (pilih) => `<option value="">— pilih peran siap pakai —</option>${semuaPreset().map((p) => `<option value="${e(p.id)}"${p.id === pilih ? " selected" : ""}>${e(p.nama)}</option>`).join("")}`;
function formDivisi(d) {
  bukaLayer(`${kepalaPanel(d ? "Ubah divisi" : "Divisi baru", "Divisi tanpa Daily Job: Finance, Legal, CS, dll.")}<div class="mr-panel__isi"><div class="mr-form" style="grid-template-columns:1fr" id="dv-form" data-id="${e(d ? d.id : "")}">
    ${fld("Nama divisi", `<input id="dv-nama" maxlength="40" value="${e(d ? d.nama : "")}" autocomplete="off">`)}
    ${fld("Peran siap pakai <small>izin modul semua anggota divisi ini</small>", `<select id="dv-preset">${opsiPreset(d && d.presetId)}</select>`)}
    <p class="mr-sub">Izin tiap peran diatur di bagian Peran di halaman Pengaturan ini; halaman atau modul baru muncul di sana otomatis. Divisi yang punya Daily Job dibuat sebagai Kelompok Daily Job.</p></div></div>
    <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-ad="div-simpan">Simpan</button></footer>`);
}
async function simpanFormDivisi(t) {
  const f = $("#dv-form"), id = f.dataset.id, nama = nilai("dv-nama"), presetId = $("#dv-preset").value, lama = id ? divById(id) : null;
  if (!nama) return toast("Isi nama divisi.", "bahaya"); if (!presetId) return toast("Pilih peran siap pakai untuk divisi ini.", "bahaya");
  if (A.div.some((x) => x.id !== id && String(x.nama).toLowerCase() === nama.toLowerCase())) return toast("Nama divisi ini sudah ada.", "bahaya");
  const anggota = lama ? anggotaDiv(id) : [], ganti = lama && lama.presetId !== presetId && anggota.length;
  if (ganti && !(await konfirmasi("Ganti peran siap pakai?", `Izin ${anggota.length} anggota <b>${e(lama.nama)}</b> diganti mengikuti peran <b>${e(presetById(presetId).nama)}</b>. Izin yang pernah diubah per akun ikut tertimpa.`, "Terapkan"))) return;
  t.disabled = true;
  try {
    await simpanDivisi(id, { nama, presetId }); if (ganti) await terapkanPresetKeAnggota({ ...lama, presetId }, anggota, await kodeTerpakai());
    await muat(); if (!id) A.pilihKel = "d:" + (A.div.find((x) => x.nama === nama) || {}).id; gambar(); tutupLayer(); toast("Divisi disimpan.");
  } catch (err) { t.disabled = false; toast(e(err.message || err), "bahaya"); }
}
function panelPindah(id) {
  const a = A.akun.find((x) => x.id === id); if (!a) return;
  const cur = a.divisiId ? "d:" + a.divisiId : a.kelompokDJ ? "k:" + a.kelompokDJ : "", kep = a.divisiId ? jabatanKepalaDiv(a) : jabatanKepala(a);
  bukaLayer(`${kepalaPanel("Pindahkan akun", `${e(a.nama || a.email)} · satu akun satu divisi`)}<div class="mr-panel__isi"><div class="mr-form" style="grid-template-columns:1fr" id="ad-pindah-form" data-id="${e(id)}" data-cur="${e(cur)}" data-kep="${kep ? 1 : 0}">
    ${fld("Divisi atau kelompok", `<select id="ad-tujuan"><option value="">Tanpa divisi (hanya Beranda)</option><optgroup label="Divisi">${divAktif().map((d) => `<option value="d:${e(d.id)}"${cur === "d:" + d.id ? " selected" : ""}>${e(d.nama)} · ${e(namaPreset(d))}</option>`).join("")}</optgroup><optgroup label="Kelompok Daily Job">${kelAktif().map((k) => `<option value="k:${e(k.id)}"${cur === "k:" + k.id ? " selected" : ""}>${e(k.nama)}</option>`).join("")}</optgroup></select>`)}
    ${fld("Jabatan <small>satu kepala per divisi</small>", segJabatan(kep ? "kepala" : "anggota"))}
    <p class="mr-sub">Izin modul mengikuti peran siap pakai divisi (kelompok Daily Job: akses Daily Job kelola, bisa diubah di panel akun). Perpindahan tercatat di riwayat akun dan sesi login akun berakhir.</p></div></div>
    <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-ad="pindah-ok">Pindahkan</button></footer>`);
}
async function simpanPindah(t) {
  const f = $("#ad-pindah-form"), id = f.dataset.id, a = A.akun.find((x) => x.id === id), tujuan = $("#ad-tujuan").value, jab = f.querySelector(".ad-seg").dataset.adJab || "anggota";
  if (!a || (tujuan === f.dataset.cur && (jab === "kepala") === (f.dataset.kep === "1"))) return toast("Tidak ada perubahan.");
  t.disabled = true;
  try {
    if (tujuan.startsWith("k:")) {
      const kid = tujuan.slice(2);
      if (a.peran === "dj") { if (a.kelompokDJ !== kid) await panggil("djAturAnggota", { uid: id, aksi: "kelompok", kelompokId: kid }); await panggil("djAturAnggota", { uid: id, aksi: jab === "kepala" ? "kepala" : "anggota" }); }
      else await panggil("djKelompokkan", { uid: id, kelompokId: kid, jabatan: jab });
    } else {
      if (a.peran === "dj") await panggil("djAturAnggota", { uid: id, aksi: "keluarkan" });
      if (tujuan) await masukkanKeDivisi(a, divById(tujuan.slice(2)), jab, A.div, await kodeTerpakai());
      else if (a.divisiId) await keluarkanDariDivisi(a, A.div);
    }
    await muat(); gambar(); tutupLayer(); toast("Akun dipindahkan.");
  } catch (err) { await muat(); gambar(); t.disabled = false; toast(e(err.message || err), "bahaya"); }
}
/** Aksi divisi non-Daily Job; true bila ditangani. */
async function aksiDivisi(t) {
  const a = t.dataset.ad, d = divById(t.dataset.k);
  if (a === "tampil") { A.tampil = t.dataset.v; gambar(); return true; }
  if (a === "div-baru") { formDivisi(null); return true; }
  if (a === "div-ubah") { formDivisi(d); return true; }
  if (a === "div-simpan") { await simpanFormDivisi(t); return true; }
  if (a === "pindah-u") { panelPindah(t.dataset.id); return true; }
  if (a === "pindah-ok") { await simpanPindah(t); return true; }
  if (a === "div-arsip" || a === "div-pulih") { if (!d) return true; const arsip = a === "div-arsip";
    if (arsip && !(await konfirmasi("Arsipkan divisi?", `<b>${e(d.nama)}</b> tidak muncul lagi di pilihan. Anggotanya tetap tersimpan dan izinnya tidak berubah.`, "Arsipkan"))) return true;
    try { await arsipkanDivisi(d.id, arsip); if (arsip && A.pilihKel === "d:" + d.id) A.pilihKel = ""; await muat(); gambar(); toast(arsip ? "Divisi diarsipkan." : "Divisi dipulihkan."); } catch (err) { toast(e(err.message || err), "bahaya"); } return true; }
  if (a === "div-hapus") { if (!d) return true;
    if (anggotaDiv(d.id).length) { toast("Pindahkan anggotanya dulu, atau arsipkan divisi ini.", "bahaya"); return true; }
    if (!(await konfirmasi("Hapus divisi?", `<b>${e(d.nama)}</b> dihapus permanen.`, "Hapus"))) return true;
    try { await hapusDivisi(d.id); A.pilihKel = ""; await muat(); gambar(); toast("Divisi dihapus."); } catch (err) { toast(e(err.message || err), "bahaya"); } return true; }
  if (a === "kepala-div") { const x = A.akun.find((u) => u.id === t.dataset.id), dv = x && divById(x.divisiId); if (!dv) return true; const jadi = !jabatanKepalaDiv(x);
    if (!(await konfirmasi(jadi ? "Jadikan kepala divisi?" : "Lepas jabatan kepala?", jadi ? `<b>${e(x.nama)}</b> menjadi kepala ${e(dv.nama)}; kepala lama menjadi anggota biasa.` : `<b>${e(x.nama)}</b> menjadi anggota biasa.`, jadi ? "Jadikan kepala" : "Lepas"))) return true;
    try { await updateDoc(doc(db, "divisi", dv.id), { kepala: jadi ? [x.id] : (dv.kepala || []).filter((u) => u !== x.id) }); await muat(); gambar(); toast(jadi ? "Kepala divisi ditetapkan." : "Jabatan kepala dilepas."); } catch (err) { toast(e(err.message || err), "bahaya"); } return true; }
  return false;
}

async function aksi(t) {
  if (await aksiDivisi(t)) return;
  const a = t.dataset.ad, uid = ($("#ad-kelola") || {}).dataset && $("#ad-kelola").dataset.id, akun = A.akun.find((x) => x.id === uid);
  if (a === "kel-pilih") { A.pilihKel = t.dataset.k; return gambar(); }
  if (a === "kel-baru") return bukaFormKelompok(null);
  if (a === "kel-ubah") return bukaFormKelompok(kelById(t.dataset.k));
  if (a === "kel-simpan") return simpanFormKelompok(t);
  if (a === "kel-arsip" || a === "kel-pulih") { const k = kelById(t.dataset.k); if (!k) return; const arsip = a === "kel-arsip";
    if (arsip && !(await konfirmasi("Arsipkan kelompok?", `<b>${e(k.nama)}</b> tidak muncul lagi di pilihan, tetapi anggota dan job tetap tersimpan. Bisa dipulihkan kapan saja.`, "Arsipkan"))) return;
    try { await updateDoc(doc(db, "dj_kelompok", k.id), { arsip }); if (arsip && A.pilihKel === k.id) A.pilihKel = ""; await muat(); gambar(); toast(arsip ? "Kelompok diarsipkan." : "Kelompok dipulihkan."); } catch (err) { toast(e(err.message || err), "bahaya"); } return; }
  if (a === "kel-hapus") { const k = kelById(t.dataset.k); if (k && await hapusKelompok(k)) { A.pilihKel = ""; gambar(); } return; }
  if (a === "pindah") return panelKelola(t.dataset.id, "peran");
  if (a === "kepala-cepat") { const x = A.akun.find((u) => u.id === t.dataset.id); if (!x) return; const jadi = !jabatanKepala(x);
    if (!(await konfirmasi(jadi ? "Jadikan kepala divisi?" : "Lepas jabatan kepala?", jadi ? `<b>${e(x.nama)}</b> menjadi kepala ${e((kelById(x.kelompokDJ) || {}).nama || "kelompok ini")}; kepala lama menjadi anggota biasa.` : `<b>${e(x.nama)}</b> menjadi anggota biasa.`, jadi ? "Jadikan kepala" : "Lepas"))) return;
    await jalan(t, () => panggil("djAturAnggota", { uid: x.id, aksi: jadi ? "kepala" : "anggota" }), jadi ? "Kepala divisi ditetapkan." : "Jabatan kepala dilepas."); return; }
  if (a === "kelola") return panelKelola(t.dataset.id);
  if (a === "jab") { const s = t.closest(".ad-seg"); s.dataset.adJab = t.dataset.v; s.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b === t)); hitung(); return; }
  if (a === "tab") { document.querySelectorAll("#ad-kelola .ad-tab button").forEach((b) => b.classList.toggle("is-on", b === t)); document.querySelectorAll("#ad-kelola [data-tab]").forEach((x) => { x.hidden = x.dataset.tab !== t.dataset.v; }); $("#ad-kaki").hidden = !["profil", "peran"].includes(t.dataset.v); if (t.dataset.v === "riwayat") muatRiwayat($("#ad-kelola").dataset.id); return; }
  if (a === "simpan-ok") return simpanEdit(t);
  if (a === "salin") { try { await navigator.clipboard.writeText(t.dataset.teks); toast("Disalin."); } catch (_) { toast("Tidak bisa menyalin otomatis. Catat manual.", "bahaya"); } return; }
  if (!akun) return;
  if (a === "keluarkan") { if (!(await konfirmasi("Keluarkan dari kelompok?", `${e(akun.nama)} kembali ke Tanpa kelompok dan hanya melihat Beranda sampai dikelompokkan lagi. Job lama tetap atas namanya.`, "Keluarkan"))) return; if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "keluarkan" }), "Dikeluarkan dari kelompok.")) tutupLayer(); return; }
  if (a === "keluar") { if (!(await konfirmasi("Akhiri semua sesi?", `${e(akun.nama)} harus masuk lagi di semua perangkat.`, "Akhiri"))) return; await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "keluar" }), "Semua sesi diakhiri."); return; }
  if (a === "hapus") { if (!(await konfirmasi("Hapus akun ini?", `${e(akun.nama)} dihapus permanen. Job yang pernah dicatat tetap ada atas namanya.`, "Hapus"))) return; if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "hapus" }), "Akun dihapus.")) tutupLayer(); }
}
document.addEventListener("click", (ev) => { const t = ev.target.closest("[data-ad]"); if (t && !t.disabled) aksi(t); });
document.addEventListener("change", (ev) => { if (ev.target && ev.target.closest && ev.target.closest("#ad-kelola")) hitung(); });
document.addEventListener("input", (ev) => { const t = ev.target; if (!t || !t.closest || !t.closest("#ad-kelola")) return; if (t.id === "ad-e-user") return cekUsername(); hitung(); });
document.addEventListener("input", (ev) => {
  const t = ev.target; if (!t || !t.closest || !t.closest("#kf")) return;
  if (t.id === "kf-awalan") { formKel.manual = true; t.value = t.value.toUpperCase().replace(/[^A-Z]/g, ""); }
  if (t.id === "kf-nama" && !formKel.manual) { const a = $("#kf-awalan"); if (a) a.value = H.awalanKelompok(t.value); }
  const aw = ($("#kf-awalan") || {}).value || "XXX", i = $("#kf-info"); if (i) i.textContent = `Kode anggota: ${aw}-01, ${aw}-02, … nomor tidak dipakai ulang.`;
});
