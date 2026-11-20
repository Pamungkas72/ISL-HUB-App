// Akun anggota divisi Daily Job per kelompok (Pengaturan > Akun sales dan akses; master dan admin).
// Membuat akun, menetapkan kepala divisi, pindah kelompok, reset sandi, nonaktifkan, hapus. Semua lewat Cloud Functions (functions/dailyjob-akun.js).
import { e, $, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { app, db } from "./firebase-config.js";
import { collection, getDocs, getDoc, doc, query, where, setDoc, updateDoc, deleteDoc, onSnapshot, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as H from "./daily-job-hitung.js";

const A = { kel: [], akun: [], jobN: {}, pilihKel: "", unsub: null, siap: false, galat: "", root: null, filter: "", edit: null, userOk: true };
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
    A.akun = (await getDocs(query(collection(db, "pengguna"), where("peran", "==", "dj")))).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
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
const baris = (a, i) => `<div class="ad-baris">${avatar(a.nama, i)}<span class="ad-t"><b>${e(a.nama || "-")}</b><small>${a.kodeUnit ? `<b>${e(a.kodeUnit)}</b> · ` : ""}@${e(a.username || "")}${a.telepon ? ` · ${e(a.telepon)}` : ""}</small></span>${a.status === "nonaktif" ? `<span class="ad-bd">Nonaktif</span>` : ""}${a.akses && a.akses.dj === 1 ? `<span class="ad-bd">Lihat saja</span>` : ""}<span class="ad-bd${jabatanKepala(a) ? " ad-bd--k" : ""}">${jabatanKepala(a) ? "Kepala divisi" : "Anggota"}</span><button type="button" class="mr-ikonbtn" data-ad="kelola" data-id="${e(a.id)}" aria-label="Kelola ${e(a.nama)}">${ikon("titik", 18)}</button></div>`;
const urut = (l) => [...l].sort((x, y) => jabatanKepala(y) - jabatanKepala(x) || String(x.nama).localeCompare(String(y.nama), "id"));
const awalanKel = (k) => k.awalan || H.awalanKelompok(k.nama);
const kelAktif = () => A.kel.filter((k) => !k.arsip);
const anggotaKel = (id) => urut(A.akun.filter((a) => a.kelompokDJ === id));
const namaKepala = (k) => { const a = A.akun.find((x) => x.id === (k.kepala || [])[0]); return a ? a.nama : "—"; };
const profilNama = (k) => (k.profil === "tracking" ? "Tracking" : "Marketing");
function detailKel(k, hp) {
  const l = anggotaKel(k.id), kosong = !l.length && !(A.jobN[k.id] > 0);
  const baris2 = (a, i) => `<div class="kd-ang" data-id="${e(a.id)}">${avatar(a.nama, i + 1)}<span class="ad-t"><b>${e(a.nama || "-")}</b><small>${a.kodeUnit ? `<span class="ak-kode">${e(a.kodeUnit)}</span> · ` : ""}@${e(a.username || "")}${a.status === "nonaktif" ? " · Nonaktif" : ""}</small></span>${jabatanKepala(a) ? `<span class="ad-bd ad-bd--k">Kepala</span>` : ""}
    <span class="kd-aksi"><button type="button" class="mr-btn mr-btn--kecil" data-ad="pindah" data-id="${e(a.id)}">Pindah ▾</button>${hp ? "" : `<button type="button" class="mr-btn mr-btn--kecil" data-ad="kepala-cepat" data-id="${e(a.id)}">${jabatanKepala(a) ? "Lepas kepala" : "Jadikan kepala"}</button>`}<button type="button" class="mr-ikonbtn" data-ad="kelola" data-id="${e(a.id)}" aria-label="Atur ${e(a.nama || "akun")}">⋯</button></span></div>`;
  return `<div class="kd-detail" data-k="${e(k.id)}"><div class="kd-judul"><div class="kd-judul__t"><h3>${e(k.nama)}</h3><div class="kd-mini"><span>Profil <b>${profilNama(k)}</b></span><span>Awalan <span class="ak-kode">${e(awalanKel(k))}</span></span>${k.dibuat ? `<span>Dibuat <b>${e(k.dibuat)}</b></span>` : ""}</div></div>
    <div class="kd-judul__a"><button type="button" class="mr-btn mr-btn--kecil" data-ad="kel-ubah" data-k="${e(k.id)}">Ubah</button><button type="button" class="mr-btn mr-btn--kecil" data-ad="kel-arsip" data-k="${e(k.id)}">Arsipkan</button><button type="button" class="mr-btn mr-btn--kecil mr-btn--bahaya${kosong ? "" : " kd-redup"}" data-ad="kel-hapus" data-k="${e(k.id)}" title="${kosong ? "" : "Pindahkan anggota dan job dulu, atau arsipkan"}">Hapus</button></div></div>
    <div class="kd-stat"><div><span class="st-badge st-badge--warn">Kepala divisi</span><b>${e(namaKepala(k))}</b></div><div><span class="st-badge">Anggota</span><b>${l.length}</b></div><div><span class="st-badge st-badge--ok">Job</span><b>${A.jobN[k.id] ?? "–"}</b></div></div>
    <div class="kd-ang-kepala"><h4>Anggota</h4><span><button type="button" class="mr-btn mr-btn--kecil" data-ad="baru" data-k="${e(k.id)}" data-jab="kepala">${ikon("plus", 14)} Kepala</button> <button type="button" class="mr-btn mr-btn--kecil mr-btn--utama" data-ad="baru" data-k="${e(k.id)}">${ikon("plus", 14)} Anggota</button></span></div>
    <div class="kd-daftar">${l.map(baris2).join("") || `<p class="mr-sub" style="margin:10px 0">Belum ada anggota.</p>`}</div></div>`;
}
function html() {
  if (!A.siap) return `<p class="mr-sub">Memuat kelompok divisi…</p>`;
  if (A.galat) return `<p class="mr-sub">${e(A.galat)}</p>`;
  const hp = matchMedia("(max-width: 760px)").matches, ak = kelAktif(), ar = A.kel.filter((k) => k.arsip);
  const kid = ak.some((k) => k.id === A.pilihKel) ? A.pilihKel : (ak[0] || {}).id || "", k = ak.find((x) => x.id === kid);
  const tanpa = A.akun.filter((a) => !kelById(a.kelompokDJ));
  const kepala = `<div class="ad-kepala"><div><h4>Kelompok divisi</h4><p class="mr-sub">Tiap kelompok punya satu kepala divisi yang menilai hasil dan menetapkan target. Dibuat di sini atau di Daily Job, datanya sama. <span class="kd-sync">● Tersinkron</span></p></div><button type="button" class="mr-btn mr-btn--utama" data-ad="kel-baru">${ikon("plus", 14)} Kelompok baru</button></div>`;
  const arsipHtml = ar.length ? `<details class="st-laci"><summary><span>Diarsipkan</span><span class="st-laci-jml">${ar.length} kelompok</span></summary><div class="st-laci-isi">${ar.map((x) => `<div class="kd-ars"><span><b>${e(x.nama)}</b><small>${anggotaKel(x.id).length} anggota · ${A.jobN[x.id] ?? 0} job</small></span><button type="button" class="mr-btn mr-btn--kecil" data-ad="kel-pulih" data-k="${e(x.id)}">Pulihkan</button><button type="button" class="mr-btn mr-btn--kecil mr-btn--bahaya" data-ad="kel-hapus" data-k="${e(x.id)}">Hapus</button></div>`).join("")}</div></details>` : "";
  const tanpaHtml = tanpa.length ? `<div class="kd-detail"><div class="kd-judul"><div class="kd-judul__t"><h3>Tanpa kelompok</h3><div class="kd-mini"><span>${tanpa.length} akun</span></div></div></div><div class="kd-daftar">${tanpa.map((a, i) => `<div class="kd-ang">${avatar(a.nama, i)}<span class="ad-t"><b>${e(a.nama || "-")}</b><small>@${e(a.username || "")}</small></span><span class="kd-aksi"><button type="button" class="mr-btn mr-btn--kecil" data-ad="pindah" data-id="${e(a.id)}">Pindah ▾</button></span></div>`).join("")}</div></div>` : "";
  if (!ak.length) return `${kepala}<div class="st-stat">Belum ada kelompok. Tekan <b>＋ Kelompok baru</b> untuk membuat yang pertama.</div>${arsipHtml}`;
  if (hp) return `${kepala}<div class="ak-chip kd-chip" role="tablist">${ak.map((x) => `<button type="button" role="tab" data-ad="kel-pilih" data-k="${e(x.id)}" class="${x.id === kid ? "is-aktif" : ""}">${e(x.nama)} ${anggotaKel(x.id).length}</button>`).join("")}</div>${detailKel(k, true)}${tanpaHtml}${arsipHtml}`;
  return `${kepala}<div class="kd-dua"><nav class="kd-list" aria-label="Kelompok">${ak.map((x) => `<button type="button" data-ad="kel-pilih" data-k="${e(x.id)}" class="${x.id === kid ? "is-aktif" : ""}"><span><b>${e(x.nama)}</b><small>${profilNama(x)} · ${e(awalanKel(x))}</small></span><i>${anggotaKel(x.id).length}</i></button>`).join("")}</nav><div class="kd-kanan">${detailKel(k, false)}${tanpaHtml}</div></div>${arsipHtml}`;
}
const gambar = () => { if (A.root && A.root.isConnected) A.root.innerHTML = html(); };
export const bukaBuatDivisi = () => panelBuat(); // dipanggil dialog Tambah akun (Pengaturan) untuk kepala atau anggota divisi
export async function isiAkunDivisi(root) { A.root = root; gambar(); langganKelompok(); if (!A.siap) { await muat(); gambar(); } }
const segJabatan = (j) => `<div class="ad-seg" data-ad-jab="${j}"><button type="button" data-ad="jab" data-v="anggota" class="${j === "anggota" ? "is-on" : ""}">Anggota</button><button type="button" data-ad="jab" data-v="kepala" class="${j === "kepala" ? "is-on" : ""}">Kepala divisi</button></div>`;
const kepalaPanel = (judul, sub) => `<header class="mr-panel__kepala"><div><h2>${judul}</h2>${sub ? `<p class="mr-sub">${sub}</p>` : ""}</div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>`;
const opsiKel = (pilih) => A.kel.filter((k) => !k.arsip || k.id === pilih).map((k) => `<option value="${e(k.id)}"${k.id === pilih ? " selected" : ""}>${e(k.nama)}</option>`).join("");
const fld = (lab, isi) => `<label class="mr-f"><span>${lab}</span>${isi}</label>`;

function panelBuat(kid, jab = "anggota") {
  if (!kelAktif().length) return toast("Buat kelompok dulu dengan tombol ＋ Kelompok baru.", "bahaya");
  bukaLayer(`${kepalaPanel("Buat akun")}<div class="mr-panel__isi"><div class="mr-form" style="grid-template-columns:1fr" id="ad-buat" data-jab="${jab}">
    <div class="ad-seg"><button type="button" data-ad="jenis" data-v="divisi" class="is-on">Anggota divisi</button><button type="button" data-ad="jenis" data-v="staf">Sales, admin, lihat saja</button></div>
    <div id="ad-staf" hidden><p class="mr-sub">Akun sales, admin, dan lihat saja dibuat lewat tombol + Tambah akun di bagian atas.</p><button type="button" class="mr-btn mr-btn--utama" data-ad="ke-staf">Buka form staf</button></div>
    <div id="ad-divisi" class="mr-form" style="grid-template-columns:1fr">
      ${fld("Nama lengkap", `<input id="ad-nama" maxlength="80" autocomplete="off">`)}${fld("Username <small>huruf kecil, angka, titik, garis bawah, strip</small>", `<input id="ad-user" maxlength="30" autocomplete="off" autocapitalize="none">`)}
      ${fld("Telepon <small>opsional, bisa dipakai masuk</small>", `<input id="ad-tel" type="tel" autocomplete="off">`)}${fld("Email kontak <small>opsional, bisa dipakai masuk</small>", `<input id="ad-mail" type="email" autocomplete="off">`)}
      ${fld("Kata sandi sementara", `<div class="ad-sandi"><input id="ad-sandi" value="${e(H.sandiAcak())}" autocomplete="off" spellcheck="false"><button type="button" class="mr-btn" data-ad="acak">Acak</button></div>`)}
      ${fld("Kelompok", `<select id="ad-kel">${opsiKel(kid || kelAktif()[0].id)}</select>`)}${fld("Jabatan", segJabatan(jab))}
      <p class="mr-sub" id="ad-jab-info"></p></div></div></div>
    <footer class="mr-panel__kaki dj-kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-ad="buat-ok" id="ad-buat-ok">Buat akun</button></footer>`);
}
function infoJabatan() {
  const f = $("#ad-buat"), i = $("#ad-jab-info"); if (!f || !i) return;
  const k = kelById($("#ad-kel").value), lama = k && (k.kepala || [])[0] && A.akun.find((a) => a.id === k.kepala[0]);
  i.textContent = f.dataset.jab === "kepala" && lama ? `${lama.nama} saat ini kepala ${k.nama}; akan menjadi anggota biasa.` : "";
}
function panelKredensial(a, sandi) {
  const url = location.origin + "/index.html", teks = `Akun ISL HUB (Daily Job)\nNama: ${a.nama}\nMasuk di: ${url}\nUsername: ${a.username}${a.telepon ? ` (atau nomor telepon ${a.telepon})` : ""}\nKata sandi: ${sandi}`;
  bukaLayer(`${kepalaPanel("Akun dibuat", "Catat atau kirim sekarang. Kata sandi tidak ditampilkan lagi.")}<div class="mr-panel__isi"><div class="dj-kred"><div><span>Nama</span><b>${e(a.nama)}</b></div><div><span>Masuk di</span><b>${e(url)}</b></div><div><span>Username</span><b>${e(a.username)}</b></div>${a.telepon ? `<div><span>Atau nomor telepon</span><b>${e(a.telepon)}</b></div>` : ""}<div><span>Kata sandi</span><b class="dj-kred__s">${e(sandi)}</b></div></div></div>
    <footer class="mr-panel__kaki dj-kaki"><button class="mr-btn" data-ad="salin" data-teks="${e(teks)}">Salin</button><span class="mr-ruang"></span><a class="mr-btn mr-btn--utama" target="_blank" rel="noopener" href="https://wa.me/${e(a.telepon || "")}?text=${encodeURIComponent(teks)}">Kirim WhatsApp</a></footer>`);
}
const WAKTU = (w) => { const t = w && w.toDate ? w.toDate() : w ? new Date(w) : null; return t && !isNaN(t) ? t.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–"; };
const segAkses = (v) => `<div class="ad-seg" data-ad-jab="${v}"><button type="button" data-ad="jab" data-v="kelola" class="${v === "kelola" ? "is-on" : ""}">Kelola</button><button type="button" data-ad="jab" data-v="lihat" class="${v === "lihat" ? "is-on" : ""}">Lihat saja</button></div>`;
const segStatus = (st) => `<div class="ad-seg" data-ad-jab="${st}"><button type="button" data-ad="jab" data-v="aktif" class="${st === "aktif" ? "is-on" : ""}">Aktif</button><button type="button" data-ad="jab" data-v="nonaktif" class="${st === "nonaktif" ? "is-on" : ""}">Nonaktif</button></div>`;
function panelKelola(id, tab = "profil") {
  const a = A.akun.find((x) => x.id === id); if (!a) return;
  const kep = jabatanKepala(a), st = a.status === "nonaktif" ? "nonaktif" : "aktif";
  A.edit = { id, awal: { nama: a.nama || "", username: a.username || "", telepon: a.telepon || "", mail: a.emailKontak || "", kel: a.kelompokDJ || "", jab: kep ? "kepala" : "anggota", st, akses: a.akses && a.akses.dj === 1 ? "lihat" : "kelola" } }; A.userOk = true;
  const tabs = [["profil", "Profil"], ["peran", "Peran"], ["aman", "Keamanan"], ["riwayat", "Riwayat"]];
  bukaLayer(`${kepalaPanel("Edit akun")}<div class="mr-panel__isi" id="ad-kelola" data-id="${e(id)}">
    <div class="ad-id">${avatar(a.nama, 1)}<span class="ad-t"><b>${e(a.nama)}</b><small>@${e(a.username || "")} · ${e((kelById(a.kelompokDJ) || {}).nama || "tanpa kelompok")}</small></span><span class="ad-bd">${st === "aktif" ? "Aktif" : "Nonaktif"}</span></div>
    <div class="ad-info" id="ad-info"><div><b>–</b><small>Dibuat</small></div><div><b>–</b><small>Terakhir masuk</small></div><div><b>–</b><small>Job dicatat</small></div></div>
    <div class="ad-tab" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" data-ad="tab" data-v="${k}" class="${k === tab ? "is-on" : ""}">${t}</button>`).join("")}</div>
    <section data-tab="profil"${tab === "profil" ? "" : " hidden"} class="ad-bag">${fld("Nama tampil <small>pojok kanan atas, kartu, log</small>", `<input id="ad-e-nama" value="${e(a.nama || "")}" maxlength="80" autocomplete="off">`)}
      ${fld("Username login", `<input id="ad-e-user" value="${e(a.username || "")}" maxlength="30" autocomplete="off" autocapitalize="none"><small id="ad-e-user-info" class="ad-cek"></small>`)}<p class="ad-catatan" id="ad-user-cat" hidden></p>
      ${fld("Telepon <small>bisa dipakai masuk</small>", `<input id="ad-e-tel" type="tel" value="${e(a.telepon || "")}">`)}${fld("Email kontak <small>bisa dipakai masuk</small>", `<input id="ad-e-mail" type="email" value="${e(a.emailKontak || "")}">`)}
      <p class="mr-sub">Nama PIC di job lama tidak ikut berubah.</p></section>
    <section data-tab="peran"${tab === "peran" ? "" : " hidden"} class="ad-bag">${fld("Kelompok", `<select id="ad-pindah">${opsiKel(a.kelompokDJ)}</select>`)}<p class="mr-sub" style="margin-top:-4px">Job lama tetap di kelompok lamanya.</p>
      ${fld("Jabatan <small>satu kepala per kelompok</small>", segJabatan(kep ? "kepala" : "anggota"))}${fld("Status", segStatus(st))}${fld("Akses Daily Job <small>lihat saja = tidak bisa mencatat atau mengubah job</small>", segAkses(a.akses && a.akses.dj === 1 ? "lihat" : "kelola"))}
      <p class="mr-sub">Jenis akun (anggota divisi) tetap. Untuk Sales atau Admin, buat akun baru lalu nonaktifkan akun ini; job tetap milik kelompok.</p></section>
    <section data-tab="aman"${tab === "aman" ? "" : " hidden"} class="ad-bag"><h4>Kata sandi</h4><div class="ad-sandi"><input id="ad-e-sandi" value="${e(H.sandiAcak())}" autocomplete="off" spellcheck="false"><button type="button" class="mr-btn" data-ad="acak-e">Acak</button></div><button class="mr-btn" data-ad="sandi-ok">Reset kata sandi</button>
      <h4>Sesi login</h4><button class="mr-btn" data-ad="keluar">Akhiri semua sesi</button><p class="mr-sub">Orangnya harus masuk lagi.</p><h4>Hapus akun</h4><button class="mr-btn mr-btn--bahaya" data-ad="hapus">Hapus akun</button></section>
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
    if (d.some((k) => ["nama", "username", "telepon", "mail"].includes(k))) await panggil("djAturAnggota", { uid: id, aksi: "ubah", nama: b.nama, username: b.username, telepon: b.telepon, emailKontak: b.mail });
    if (d.includes("kel")) await panggil("djAturAnggota", { uid: id, aksi: "kelompok", kelompokId: b.kel });
    const kepAwal = d.includes("kel") ? "anggota" : x.awal.jab; // pindah kelompok melepas jabatan kepala lama
    if (b.jab !== kepAwal) await panggil("djAturAnggota", { uid: id, aksi: b.jab === "kepala" ? "kepala" : "anggota" });
    if (d.includes("akses")) await panggil("djAturAnggota", { uid: id, aksi: "akses", dj: b.akses === "lihat" ? 1 : 2 });
    if (d.includes("st")) await panggil("djAturAnggota", { uid: id, aksi: b.st === "nonaktif" ? "nonaktif" : "aktif" });
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
async function aksi(t) {
  const a = t.dataset.ad, uid = ($("#ad-kelola") || {}).dataset && $("#ad-kelola").dataset.id, akun = A.akun.find((x) => x.id === uid);
  if (a === "baru") return panelBuat(t.dataset.k, t.dataset.jab);
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
  if (a === "jenis") { document.querySelectorAll('[data-ad="jenis"]').forEach((b) => b.classList.toggle("is-on", b === t)); $("#ad-staf").hidden = t.dataset.v !== "staf"; $("#ad-divisi").hidden = t.dataset.v === "staf"; $("#ad-buat-ok").hidden = t.dataset.v === "staf"; return; }
  if (a === "ke-staf") { tutupLayer(); document.dispatchEvent(new CustomEvent("ak-buka-tambah")); return; }
  if (a === "jab") { const s = t.closest(".ad-seg"); s.dataset.adJab = t.dataset.v; s.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b === t)); const f = $("#ad-buat"); if (f) { f.dataset.jab = t.dataset.v; infoJabatan(); } else hitung(); return; }
  if (a === "tab") { document.querySelectorAll("#ad-kelola .ad-tab button").forEach((b) => b.classList.toggle("is-on", b === t)); document.querySelectorAll("#ad-kelola [data-tab]").forEach((x) => { x.hidden = x.dataset.tab !== t.dataset.v; }); $("#ad-kaki").hidden = !["profil", "peran"].includes(t.dataset.v); if (t.dataset.v === "riwayat") muatRiwayat($("#ad-kelola").dataset.id); return; }
  if (a === "simpan-ok") return simpanEdit(t);
  if (a === "acak") { $("#ad-sandi").value = H.sandiAcak(); return; }
  if (a === "acak-e") { $("#ad-e-sandi").value = H.sandiAcak(); return; }
  if (a === "salin") { try { await navigator.clipboard.writeText(t.dataset.teks); toast("Disalin."); } catch (_) { toast("Tidak bisa menyalin otomatis. Catat manual.", "bahaya"); } return; }
  if (a === "buat-ok") {
    const x = { kelompokId: $("#ad-kel").value, nama: nilai("ad-nama"), username: nilai("ad-user").toLowerCase(), telepon: nilai("ad-tel"), emailKontak: nilai("ad-mail"), sandi: nilai("ad-sandi"), jabatan: $("#ad-buat").dataset.jab };
    if (!x.nama || !H.usernameValid(x.username)) return toast("Isi nama dan username (3 sampai 30 huruf kecil, angka, titik, garis bawah, strip).", "bahaya");
    if (x.telepon && !H.normalTelepon(x.telepon)) return toast("Nomor telepon tidak valid.", "bahaya"); if (x.emailKontak && !H.emailValid(x.emailKontak)) return toast("Format email tidak valid.", "bahaya"); if (x.sandi.length < 8) return toast("Kata sandi minimal 8 karakter.", "bahaya");
    if (await jalan(t, () => panggil("djBuatAnggota", x))) panelKredensial({ nama: x.nama, username: x.username, telepon: H.normalTelepon(x.telepon) }, x.sandi);
    return;
  }
  if (!akun) return;
  if (a === "sandi-ok") { const s = nilai("ad-e-sandi"); if (s.length < 8) return toast("Kata sandi minimal 8 karakter.", "bahaya"); if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "sandi", sandi: s }))) panelKredensial({ nama: akun.nama, username: akun.username, telepon: akun.telepon }, s); return; }
  if (a === "keluar") { if (!(await konfirmasi("Akhiri semua sesi?", `${e(akun.nama)} harus masuk lagi di semua perangkat.`, "Akhiri"))) return; await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "keluar" }), "Semua sesi diakhiri."); return; }
  if (a === "hapus") { if (!(await konfirmasi("Hapus akun ini?", `${e(akun.nama)} dihapus permanen. Job yang pernah dicatat tetap ada atas namanya.`, "Hapus"))) return; if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "hapus" }), "Akun dihapus.")) tutupLayer(); }
}
document.addEventListener("click", (ev) => { const t = ev.target.closest("[data-ad]"); if (t && !t.disabled) aksi(t); });
document.addEventListener("change", (ev) => { if (ev.target && ev.target.id === "ad-kel") infoJabatan(); if (ev.target && ev.target.closest && ev.target.closest("#ad-kelola")) hitung(); });
document.addEventListener("input", (ev) => { const t = ev.target; if (!t || !t.closest || !t.closest("#ad-kelola")) return; if (t.id === "ad-e-user") return cekUsername(); hitung(); });
document.addEventListener("input", (ev) => {
  const t = ev.target; if (!t || !t.closest || !t.closest("#kf")) return;
  if (t.id === "kf-awalan") { formKel.manual = true; t.value = t.value.toUpperCase().replace(/[^A-Z]/g, ""); }
  if (t.id === "kf-nama" && !formKel.manual) { const a = $("#kf-awalan"); if (a) a.value = H.awalanKelompok(t.value); }
  const aw = ($("#kf-awalan") || {}).value || "XXX", i = $("#kf-info"); if (i) i.textContent = `Kode anggota: ${aw}-01, ${aw}-02, … nomor tidak dipakai ulang.`;
});
