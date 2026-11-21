// ===========================================================
// PENGATURAN — tema, cadangan data, pemulihan, info akun.
// Cadangan otomatis tidak memakai Firestore/Storage (lihat cadangan.js).
// ===========================================================
import { renderNav } from "./nav.js";
import { adalahMaster, labelAkun } from "./config-akses.js";
import { e, $, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import NAV from "./riwayat.js";
import C from "./cadangan.js";
import { app, db } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, setPersistence, inMemoryPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { aksesPreset, PERAN, STATUS_AKUN, catatLogAkun, muatLogAkun, kodeUnit } from "./akses.js";
import { linkWa, normalisasiWa, pesanAkunBaru } from "./kontak-admin.js";
import * as MRDB from "./db.js";
import { hitungModalFase2, pisahkanModalFase2 } from "./app-store.js";
import { pasangPembersihan } from "./pembersihan-qt.js";
import { isiAkunDivisi, bukaBuatDivisi } from "./akun-divisi.js";
import { semuaPreset, htmlPeran, muatPeran, pasangPeran } from "./peran-akses.js";
import { bukaPanelAkses } from "./akses-panel.js";

const S = { peranLihat: "sales", bag: "", sales: false, akun: [], log: [], akunMuat: false, modal: null, preset: [], cari: "", filter: "semua", pilih: null, tab: "anggota", masuk: null, email: "", master: false, admin: false, kelola: false, lokal: [], progres: "", sibuk: false, analisa: null, berkas: null };
pasangPeran({ akun: () => S.akun, master: () => S.master, render: () => render() }); // editor peran (peran-akses.js)
const IKON_BAG = { umum: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>', profil: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/></svg>', ajuan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>', cad: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a8 3 0 0 1 16 0v10a8 3 0 0 1-16 0zM4 12a8 3 0 0 0 16 0"/></svg>', akses: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' };
const kb = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB");
const wkt = (t) => new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const NAMA_BAGIAN = { master: "Master Rate (tarif, vendor, lini, satuan)", fase2: "Customer, Rate, Quotation, Order, Pengaturan dokumen" };

function render() {
  const tema = window.ISLTema.baca(), umur = C.umurUnduhHari(), auto = C.otomatisAktif();
  const lama = umur === null ? "Belum pernah mengunduh cadangan di perangkat ini." : umur === 0 ? "Terakhir diunduh hari ini." : `Terakhir diunduh ${umur} hari lalu.`;
  const basi = umur === null || umur >= 7;
  const bagianTerbaru = ["master", "fase2"].map((b) => S.lokal.find((x) => x.bagian === b));
  const kUmum = `<section class="st-kartu"><h3>Tampilan</h3><p>Berlaku di semua halaman pada perangkat ini.</p>
      <div class="st-pil" role="group" aria-label="Tema">${[["otomatis", "Ikut perangkat"], ["terang", "Terang"], ["gelap", "Gelap"]].map(([k, l]) => `<button type="button" data-tema="${k}" class="${tema === k ? "is-aktif" : ""}">${l}</button>`).join("")}</div>
    </section>

    <section class="st-kartu"><h3>Akun saya</h3><p>Masuk sebagai <b>${e(S.email)}</b>.</p>
      <div class="st-stat">Peran: <span class="st-badge ${S.kelola ? "st-badge--ok" : ""}">${S.master ? "Pemilik (bisa mengubah semua data)" : S.admin ? "Admin (mengelola Master Rate, modal, dan akun sales)" : "Lihat saja"}</span></div>
    </section>`;
  const kAkses = S.kelola ? htmlAkun() : "";
  const kSistem = `${htmlModal()}
    <section class="st-kartu" style="grid-column:1/-1"><h3>Pembersihan quotation</h3><p>Quotation diabaikan atau lewat masa. Perubahan di sini hanya mengubah status atau menghapus; isi quotation yang sudah terbit tidak diubah.</p><div id="st-bersih"></div></section>
    ${S.master ? htmlCekFirebase() : ""}`;
  const kCad = `<section class="st-kartu" style="grid-column:1/-1"><h3>Cadangan data</h3>
      <p>Cadangan otomatis disimpan <b>di browser PC ini</b>, bukan di Firebase, jadi tidak memakai kuota atau memori Firebase. Dibuat 45 detik setelah perubahan terakhir, dilewati kalau isinya sama, dikompres, dan hanya 8 terakhir per bagian yang disimpan.</p>
      ${basi ? `<div class="mr-banner mr-banner--peringatan"><div><b>Saatnya unduh cadangan ke PC.</b> ${lama} Cadangan di browser bisa hilang kalau data browser dibersihkan, jadi simpan juga filenya.</div></div>` : `<div class="st-stat">${lama}</div>`}
      <div class="st-baris">
        <button class="mr-btn mr-btn--utama" data-st="unduh-lokal" ${bagianTerbaru.some(Boolean) ? "" : "disabled"}>Unduh cadangan terbaru</button>
        <button class="mr-btn" data-st="unduh-penuh" ${S.sibuk ? "disabled" : ""}>Cadangan lengkap dari server</button>
        <label class="qt-cek" style="display:inline-flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="st-auto" ${auto ? "checked" : ""}> Cadangan otomatis di browser</label>
      </div>
      <div class="st-stat" id="st-progres">${e(S.progres)}</div>
      <div class="st-stat"><b>Cadangan lengkap dari server</b> membaca semua data satu kali (beberapa ratus baca, jauh di bawah batas gratis 50.000/hari). Pakai seminggu sekali atau sebelum perubahan besar. Cadangan otomatis tidak membaca server sama sekali.</div>
      <table class="st-tabel"><thead><tr><th>Bagian</th><th>Terakhir</th><th>Isi</th><th>Ukuran</th><th></th></tr></thead><tbody>
        ${["master", "fase2"].map((b, i) => { const x = bagianTerbaru[i]; return `<tr><td>${e(NAMA_BAGIAN[b])}</td>${x ? `<td>${wkt(x.waktu)}</td><td>${Object.values(x.ringkas || {}).reduce((a, c) => a + c, 0)} dokumen</td><td>${kb(x.ukuran)}</td><td><span class="st-badge">${S.lokal.filter((z) => z.bagian === b).length} versi</span></td>` : `<td colspan="4" class="mr-sub">Belum ada. Muncul setelah ada perubahan data${b === "master" ? " di Master Rate" : " (Customer/Quotation)"}.</td>`}</tr>`; }).join("")}
      </tbody></table>
      <div class="st-baris"><button class="mr-btn mr-btn--hapus" data-st="hapus-lokal" ${S.lokal.length ? "" : "disabled"}>Kosongkan cadangan browser</button></div>
    </section>

    <section class="st-kartu" style="grid-column:1/-1"><h3>Pulihkan dari file cadangan</h3>
      <p>Hanya akun master. Pilih file cadangan (.json), lihat dulu ringkasan perubahannya, baru konfirmasi. Tidak ada data yang dihapus: pemulihan hanya menambah dokumen yang hilang dan mengembalikan dokumen yang berubah. Quotation yang sudah terbit dan penghitung nomor tetap dilindungi aturan server.</p>
      <div class="st-baris"><input type="file" id="st-file" accept="application/json,.json" ${S.master ? "" : "disabled"}><span class="mr-sub">${S.master ? "" : (S.kelola ? "Hanya pemilik yang bisa memulihkan cadangan." : "Akun ini hanya bisa melihat.")}</span></div>
      <div id="st-hasil-pulih"></div>
    </section>
    ${S.master ? `<section class="st-kartu" style="grid-column:1/-1"><h3>Riwayat koreksi rate</h3><p>Teks koreksi rate yang tersimpan sebelum perbaikan ini memuat nilai modal dan bisa dibaca akun sales. Tombol ini menghapus baris Modal dari teks koreksi lama. Nilai rate, dokumen, dan tanggal tidak berubah.</p><div class="st-baris"><button class="mr-btn" data-st="bersih-koreksi">Bersihkan nilai modal dari riwayat koreksi</button></div><div class="st-stat" id="st-bersih-koreksi"></div></section>` : ""}`;
  const n = window.ISLSales ? window.ISLSales.jumlahMenunggu() : 0, jmlAj = S.kelola ? n : (window.ISLSales ? window.ISLSales.jumlahMenunggu() : 0);
  const BAG = [
    { id: "umum", label: "Tampilan dan akun", ket: "Tema, peran akun", ikon: "umum", isi: kUmum },
    ...(S.sales ? [{ id: "profil", label: "Profil sales", ket: "Nama, telepon, tanda tangan", ikon: "profil", isi: `<section class="st-kartu"><h3>Profil sales</h3>${window.ISLSales ? window.ISLSales.kontenProfil() : ""}</section>` }] : []),
    ...(S.sales || S.kelola ? [{ id: "ajuan", label: "Pengajuan hapus quotation", ket: S.master ? (jmlAj ? `${jmlAj} menunggu keputusan` : "Tidak ada yang menunggu") : S.sales ? (jmlAj ? `${jmlAj} menunggu master` : "Status pengajuan milikmu") : "Daftar pengajuan sales", badge: jmlAj, ikon: "ajuan", isi: `<section class="st-kartu"><h3>Pengajuan hapus quotation${jmlAj ? ` <span class="cu-jml">${jmlAj}</span>` : ""}</h3><p>${S.master ? "Keputusan ada di tangan pemilik. Quotation yang sudah disetujui customer tidak bisa dihapus dari sini." : S.sales ? "Status pengajuan hapus yang kamu kirim. Master yang memutuskan." : "Pengajuan hapus dari sales. Keputusan ada di tangan pemilik."}</p>${window.ISLSales ? window.ISLSales.kontenAjuan() : ""}</section>` }] : []),
    ...(!S.sales ? [{ id: "cadangan", label: "Cadangan data", ket: "Unduh dan pulihkan", ikon: "cad", isi: kCad }] : []),
    ...(S.kelola ? [{ id: "akses", label: "Akun dan akses", ket: "Divisi, sales, persetujuan", ikon: "akses", badge: S.akun.filter((a) => a.status === "menunggu").length, isi: kAkses }] : []),
    ...(S.kelola ? [{ id: "sistem", label: "Sistem dan data", ket: "Keamanan modal, pembersihan, cek Firebase", ikon: "cad", isi: kSistem }] : []),
  ];
  const hp = matchMedia("(max-width: 760px)").matches, aktif = BAG.find((x) => x.id === S.bag) || (hp ? null : BAG[0]);
  const lencana = (x) => (x.badge ? `<span class="cu-jml">${x.badge}</span>` : "");
  const baris = (x, kls) => `<button type="button" class="${kls}${aktif && aktif.id === x.id ? " is-aktif" : ""}" data-st="bag" data-v="${x.id}"><span class="st-bag__ik">${IKON_BAG[x.ikon]}</span><span class="st-bag__t"><b>${x.label}</b>${hp ? `<small>${x.ket}</small>` : ""}</span>${lencana(x)}<span class="st-bag__p">›</span></button>`;
  $("#st-root").innerHTML = `<div class="st-judul-hp">${hp && aktif ? `<button type="button" class="mr-link" data-st="bag-kembali">‹ Pengaturan</button>` : ""}</div>` + (hp ? (aktif ? `<div class="st-grid">${aktif.isi}</div>` : `<div class="st-daftar">${BAG.map((x) => baris(x, "st-bag")).join("")}</div>`)
    : `<div class="st-dua"><nav class="st-menu" aria-label="Bagian pengaturan">${BAG.map((x) => baris(x, "st-bag")).join("")}</nav><div class="st-isi"><div class="st-grid" style="grid-template-columns:1fr">${aktif.isi}</div></div></div>`);
  if (S.kelola && document.getElementById("ad-root")) isiAkunDivisi(document.getElementById("ad-root"));
  if (S.kelola && document.getElementById("st-bersih")) pasangPembersihan(document.getElementById("st-bersih"), { master: S.master });
}

/* ---------- keamanan modal (master dan admin) ---------- */
function htmlModal() {
  const m = S.modal;
  /* Admin hanya bisa memisahkan modal Master Rate. Modal quotation dan rate dipisah pemilik, jadi admin diberi tahu, bukan diarahkan ke tombol yang tidak menuntaskan. */
  const info = (x) => S.master ? `<b>Modal belum dipisah.</b> ${x.tarif} tarif dan ${x.fase2} dokumen quotation/rate masih menyimpan modal di dokumen biasa. Pisahkan dulu sebelum menyetujui akun sales. Prosesnya sekali jalan, otomatis, dan bisa diulang.`
    : x.tarif > 0 ? `<b>Modal Master Rate belum dipisah.</b> ${x.tarif} tarif masih menyimpan modal di dokumen biasa. Admin bisa memisahkannya sekarang. Modal quotation dan rate hanya bisa dipisah pemilik, dan akun sales baru bisa disetujui setelah itu.`
    : `<b>Menunggu pemilik.</b> Modal quotation dan rate hanya bisa dipisah dan diperiksa pemilik. Akun sales baru bisa disetujui setelah pemilik memastikan semuanya terpisah.`;
  return `<section class="st-kartu" style="grid-column:1/-1"><h3>Keamanan modal</h3><p>Sales hanya melihat quotation miliknya, tanpa modal. Modal disimpan terpisah di koleksi khusus master.</p>
    ${m == null ? `<div class="st-stat">Memeriksa keamanan modal…</div>` : m.siap ? `<div class="st-stat"><span class="st-badge st-badge--ok">Modal sudah dipisah</span> Modal hanya tersimpan di koleksi khusus master.</div>`
      : `<div class="mr-banner mr-banner--peringatan"><div>${info(m)}${S.master || m.tarif > 0 ? `<div class="st-baris" style="margin-top:8px"><button class="mr-btn mr-btn--utama" data-st="modal-pisah" ${S.sibuk ? "disabled" : ""}>Pisahkan modal sekarang</button></div>` : ""}<div class="st-stat" id="st-modal-prog"></div></div></div>`}</section>`;
}

/* ---------- cek koneksi dan aturan Firebase (master dan admin) ---------- */
function htmlCekFirebase() {
  const hasil = (S.diag || []).map((h) => `<div class="st-stat" style="display:flex;gap:8px;align-items:center"><span class="${h.ok ? "st-badge st-badge--ok" : "st-badge"}">${h.ok ? "OK" : "GAGAL"}</span><span>${e(h.nama)}</span>${h.info ? `<span class="mr-sub">${e(h.info)}</span>` : ""}</div>`).join("");
  return `<section class="st-kartu" style="grid-column:1/-1"><h3>Cek koneksi dan aturan Firebase</h3>
    <p>Kalau penyimpanan gagal, jalankan cek ini. Aplikasi mencoba menulis dan menghapus dokumen uji, lalu menunjukkan bagian mana yang ditolak.</p>
    <div class="st-baris"><button class="mr-btn" data-st="cek-firebase" ${S.diagJalan ? "disabled" : ""}>${S.diagJalan ? "Memeriksa…" : "Jalankan cek"}</button></div>
    <div id="st-diag">${hasil}</div></section>`;
}

/* ---------- kelola akun (master) ---------- */
const warna = { menunggu: "st-badge", aktif: "st-badge st-badge--ok", nonaktif: "st-badge" };
const LABEL_LOG = { setujui: "Disetujui", aktifkan: "Diaktifkan lagi", ubah: "Diubah", nonaktifkan: "Dinonaktifkan", tolak: "Ditolak", hapus: "Dihapus", tambah: "Dibuat manual", "dj-tambah": "Akun divisi dibuat", "dj-ubah": "Akun divisi diubah", "dj-sandi": "Kata sandi akun divisi direset", "dj-keluar": "Semua sesi akun divisi diakhiri", "dj-nonaktif": "Akun divisi dinonaktifkan", "dj-aktif": "Akun divisi diaktifkan lagi", "dj-hapus": "Akun divisi dihapus", "dj-kepala": "Ditetapkan kepala divisi", "dj-anggota": "Jabatan kepala dilepas", "dj-kelompok": "Pindah kelompok", "dj-akses": "Akses Daily Job diubah", "atur-sandi": "Kata sandi diatur master", "kirim-reset-sandi": "Email reset kata sandi dikirim" };
const waktuLog = (v) => { const t = v && typeof v.toDate === "function" ? v.toDate() : v; return t ? wkt(t) : "-"; };
/* Hanya bagian yang berubah yang ditampilkan: peran, status, kode sales, dan target. */
const ringkasLog = (dari, ke) => {
  const bagian = [];
  ["peran", "jabatan", "status", "kode", "target", "akses"].forEach((f) => { const a = dari ? dari[f] : null, b = ke ? ke[f] : null; if (String(a ?? "") !== String(b ?? "")) bagian.push(`${f}: ${a ?? "-"} → ${b ?? "-"}`); });
  return bagian.join("; ") || "tanpa perubahan";
};
const htmlLog = () => S.log.length
  ? `<table class="st-tabel"><thead><tr><th>Waktu</th><th>Oleh</th><th>Akun</th><th>Aksi</th><th>Perubahan</th></tr></thead><tbody>${S.log.map((x) => `<tr><td>${waktuLog(x.waktu)}</td><td>${e(x.oleh || "-")}</td><td>${e(x.email || "-")}</td><td>${e(LABEL_LOG[x.aksi] || x.aksi)}</td><td class="mr-sub">${e(ringkasLog(x.dari, x.ke))}</td></tr>`).join("")}</tbody></table>`
  : `<div class="st-stat">Belum ada perubahan yang tercatat.</div>`;
/* ---------- akun dan akses: desktop = daftar + panel detail, HP = tab Anggota / Persetujuan / Peran ---------- */
const WARNA_AV = ["#6c5ce7", "#2e9e6e", "#d9822b", "#2c7be5", "#c0392b", "#7f8c8d"];
const avAk = (a, s = 36) => { const n = String(a.nama || a.email || "?"); let h = 0; for (const c of String(a.id || n)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `<i class="ak-av" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.42)}px;background:${WARNA_AV[h % 6]}" aria-hidden="true">${e(n[0].toUpperCase())}</i>`; };
const kodeTampil = (a) => (a.kodeSales ? `<span class="ak-kode">${e(a.kodeSales)}</span>` : `<span class="mr-sub">-</span>`);
const loginTxt = (uid) => { const t = S.masuk && S.masuk[uid]; if (!t) return "-"; const d = new Date(t), n = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5); const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", "."); return n <= 0 ? `Hari ini ${jam}` : n === 1 ? `Kemarin ${jam}` : `${n} hari lalu`; };
const kodeTerpakai = () => S.akun.map((a) => a.kodeSales).filter(Boolean);
const peranPilih = (a) => a.peran || (a.peranDiminta === "admin" ? (S.master ? "admin" : "lihat") : "sales"); // admin tidak bisa mengangkat admin: permintaan admin jatuh ke Lihat saja
/* Peran siap pakai: bawaan + buatan sendiri (sistem/peran_preset). Nilai pilihan di daftar: "sales" | "lihat" | "admin" atau "p:<id>". */
const presetDari = (v) => (String(v).startsWith("p:") ? semuaPreset().find((x) => "p:" + x.id === v) || null : null);
const peranDasar = (v) => { const p = presetDari(v); return p ? p.peran : v; };
const pilihanAkun = (a) => { const j = a.akses && a.akses.jabatan, p = j && semuaPreset().find((x) => x.nama === j && x.peran === a.peran); return p ? "p:" + p.id : peranPilih(a); };
const namaPeran = (a) => (a.akses && a.akses.jabatan) || PERAN[a.peran] || "-";
const opsiPeran = (v, dis = "") => { const o = (k, l) => `<option value="${k}" ${v === k ? "selected" : ""}>${l}</option>`; return `<select data-akun="peran" ${dis}><optgroup label="Peran dasar">${o("sales", "Sales")}${o("lihat", "Lihat saja")}${S.master ? o("admin", "Admin") : ""}</optgroup><optgroup label="Peran siap pakai">${semuaPreset().map((x) => o("p:" + x.id, e(x.nama))).join("")}</optgroup></select>`; };
const dikunci = (a) => !S.master && (a.peran === "admin" || a.peran === "master");
const kunciModal = () => (S.modal && S.modal.siap ? "" : " aria-disabled=\"true\" style=\"opacity:.55\" title=\"Terkunci: pisahkan modal dulu\"");
const cocokAkun = (a) => { const q = S.cari.trim().toLowerCase(); if (q && !`${a.nama || ""} ${a.email || ""}`.toLowerCase().includes(q)) return false; const f = S.filter; return f === "semua" || (f === "nonaktif" ? a.status === "nonaktif" : a.peran === f); };
const FILTER = [["semua", "Semua"], ["sales", "Sales"], ["admin", "Admin"], ["lihat", "Lihat saja"], ["nonaktif", "Nonaktif"]];

function kartuMenunggu(a) {
  const p = peranPilih(a);
  return `<div class="ak-tunggu" data-uid="${e(a.id)}">${avAk(a, 40)}<div class="ak-tunggu__t"><b>${e(a.nama || "(tanpa nama)")}</b> meminta akses <b>${a.peranDiminta === "admin" ? "Admin" : "Sales"}</b><div class="mr-sub">${e(a.email)}${a.telepon ? ` · ${e(a.telepon)}` : ""}</div></div>
    <div class="ak-tunggu__f">${opsiPeran(p)}<span class="ak-lblkecil">Kode <span class="ak-kode" data-ak="prev">${e(kodeUnit(peranDasar(p), kodeTerpakai()))}</span></span></div>
    <div class="ak-tunggu__a"><button class="mr-btn mr-btn--utama mr-btn--kecil" data-st="akun-setujui"${kunciModal()}>Setujui</button><button class="mr-btn mr-btn--kecil" data-st="akun-tolak">Tolak</button></div></div>`;
}
function panelAkun(a, hp) {
  const aktif = a.status === "aktif";
  const hapus = S.master ? `<button class="mr-btn mr-btn--kecil mr-btn--bahaya" data-st="akun-hapus">Hapus permanen</button>` : "";
  return `<div class="ak-panel" data-uid="${e(a.id)}"><div class="ak-ph">${avAk(a, 48)}<div class="ak-ph__t"><h3>${e(a.nama || "-")}</h3><div class="mr-sub">${e(a.email)}${a.telepon ? ` · ${e(a.telepon)}` : ""}</div></div><button type="button" class="ak-x" data-st="ak-tutup" aria-label="${hp ? "Kembali" : "Tutup"}">${hp ? "‹" : "✕"}</button></div>
    <div class="ak-meta"><span class="${warna[a.status] || "st-badge"}">${e(STATUS_AKUN[a.status] || a.status)}</span>${a.akses && a.akses.jabatan ? `<span class="st-badge">${e(a.akses.jabatan)}</span>` : ""}<span class="mr-sub">Login terakhir: ${e(loginTxt(a.id))}</span></div>
    ${dikunci(a) ? `<p class="mr-sub">Akun ini dikelola pemilik.</p>` : `<label class="ak-lbl">Peran</label>${opsiPeran(pilihanAkun(a), aktif ? "" : "disabled")}
    <label class="ak-lbl">Kode unit (otomatis oleh sistem)</label><div class="ak-kodebox">${kodeTampil(a)}<span class="mr-sub">${a.kodeSales ? "Tidak bisa diubah" : "Dibuat saat akun disetujui"}</span></div>
    <div class="ak-aksi">${aktif ? `<button class="mr-btn mr-btn--utama mr-btn--kecil" data-st="akun-simpan">Simpan</button><button class="mr-btn mr-btn--kecil" data-st="akun-akses">Akses</button>${S.master ? `<button class="mr-btn mr-btn--kecil" data-st="akun-ubah">Ubah data</button><button class="mr-btn mr-btn--kecil" data-st="akun-sandi">Kata sandi</button>` : ""}` : `<button class="mr-btn mr-btn--utama mr-btn--kecil" data-st="akun-aktif"${kunciModal()}>Aktifkan lagi</button>`}</div>
    <div class="ak-aksi ak-bahaya">${aktif ? `<button class="mr-btn mr-btn--kecil mr-btn--bahaya" data-st="akun-nonaktif">Nonaktifkan</button>` : ""}${hapus}</div>`}</div>`;
}
function htmlAkun() {
  const hp = matchMedia("(max-width: 760px)").matches;
  const menunggu = S.akun.filter((a) => a.status === "menunggu"), lain = S.akun.filter((a) => a.status !== "menunggu" && cocokAkun(a));
  const n = (f) => S.akun.filter(f).length, stat = [["Aktif", n((a) => a.status === "aktif"), "st-badge--ok"], ["Menunggu", menunggu.length, "st-badge--warn"], ["Nonaktif", n((a) => a.status === "nonaktif"), ""], ["Admin", n((a) => a.status === "aktif" && a.peran === "admin"), ""]];
  const m = S.modal, peringatan = m && !m.siap ? `<div class="mr-banner mr-banner--peringatan"><div><b>Modal belum dipisah.</b> Menyetujui akun sales terkunci sampai modal dipisah. <button type="button" class="mr-link" data-st="bag" data-v="sistem">Buka Sistem dan data</button></div></div>` : "";
  const cari = `<input type="search" id="ak-cari" class="ak-cari" placeholder="Cari nama atau email" value="${e(S.cari)}" aria-label="Cari akun" autocomplete="off">`;
  const chip = `<div class="ak-chip" role="group" aria-label="Filter peran">${FILTER.map(([k, l]) => `<button type="button" data-st="ak-filter" data-v="${k}" class="${S.filter === k ? "is-aktif" : ""}">${l}</button>`).join("")}</div>`;
  const pilih = S.akun.find((a) => a.id === S.pilih && a.status !== "menunggu") || (hp ? null : lain[0]);
  const tambah = `<button class="mr-btn mr-btn--utama" data-st="akun-buka-tambah">＋ Tambah akun</button>`;
  const kepala = `<div class="ak-kepala"><div><h3>Akun dan akses</h3><p>Kelola siapa yang bisa masuk dan apa yang boleh mereka lakukan.</p></div>${tambah}</div>`;
  const statHtml = `<div class="ak-stat">${stat.map(([t, v, k]) => `<div class="ak-stat__k"><span class="st-badge ${k}">${t}</span><b>${v}</b></div>`).join("")}</div>`;
  const kosong = `<div class="st-stat">${S.akunMuat ? "Tidak ada akun yang cocok." : "Memuat akun…"}</div>`;
  let isi;
  if (!hp) {
    const tabel = lain.length ? `<table class="ak-tb"><thead><tr><th>Akun</th><th>Peran</th><th>Kode</th><th>Login terakhir</th></tr></thead><tbody>${lain.map((a) => `<tr data-uid="${e(a.id)}" data-st="ak-pilih" class="${pilih && pilih.id === a.id ? "is-pilih" : ""}"><td><div class="ak-orang">${avAk(a)}<div><b>${e(a.nama || "-")}</b><div class="mr-sub">${e(a.email)}</div></div></div></td><td>${e(namaPeran(a))}${a.status !== "aktif" ? ` <span class="st-badge">${e(STATUS_AKUN[a.status] || a.status)}</span>` : ""}</td><td>${kodeTampil(a)}</td><td class="mr-sub">${e(loginTxt(a.id))}</td></tr>`).join("")}</tbody></table>` : kosong;
    isi = `${kepala}${statHtml}${peringatan}${menunggu.length ? `<div class="ak-antre"><h4>Menunggu persetujuan (${menunggu.length})</h4>${menunggu.map(kartuMenunggu).join("")}</div>` : ""}<div class="ak-alat">${cari}${chip}</div>
      <div class="ak-dua"><div class="ak-daftar">${tabel}</div><aside class="ak-samping">${pilih ? panelAkun(pilih, false) : `<div class="st-stat">Pilih akun untuk melihat dan mengubah detailnya.</div>`}</aside></div>
      <details class="st-laci" open><summary><span>Peran dan akses halaman</span><span class="st-laci-jml">atur halaman tiap peran</span></summary><div class="st-laci-isi">${htmlPeran(false)}</div></details>
      <details class="st-laci"><summary><span>Riwayat perubahan akun</span><span class="st-laci-jml">${S.log.length} catatan terakhir</span></summary><div class="st-laci-isi">${htmlLog()}</div></details>`;
  } else if (pilih && S.tab === "anggota") isi = panelAkun(pilih, true);
  else {
    const tab = [["anggota", "Anggota"], ["menunggu", `Persetujuan${menunggu.length ? ` ${menunggu.length}` : ""}`], ["peran", "Peran"]];
    const kartu = lain.map((a) => `<button type="button" class="ak-kartu" data-uid="${e(a.id)}" data-st="ak-pilih">${avAk(a, 40)}<span class="ak-kartu__t"><b>${e(a.nama || "-")}</b><small>${e(a.email)}</small><small>${a.status === "aktif" ? `Login ${e(loginTxt(a.id))}` : e(STATUS_AKUN[a.status] || a.status)}</small></span>${kodeTampil(a)}</button>`).join("");
    const badan = S.tab === "menunggu" ? (menunggu.length ? menunggu.map(kartuMenunggu).join("") : `<div class="st-stat">Tidak ada pendaftar yang menunggu.</div>`)
      : S.tab === "peran" ? `<div class="ak-peran-hp">${htmlPeran(true)}</div><h4 style="margin:14px 0 6px">Riwayat perubahan akun</h4>${htmlLog()}`
        : `${statHtml}${peringatan}${cari}${chip}<div class="ak-daftar-hp">${kartu || kosong}</div>`;
    isi = `${kepala}<div class="ak-tab" role="tablist">${tab.map(([k, l]) => `<button type="button" role="tab" aria-selected="${S.tab === k}" data-st="ak-tab" data-v="${k}" class="${S.tab === k ? "is-aktif" : ""}">${l}</button>`).join("")}</div>${badan}`;
  }
  return `<section class="st-kartu ak" style="grid-column:1/-1">${isi}</section>
  <section class="st-kartu" style="grid-column:1/-1"><div id="ad-root" class="ad-root"></div></section>`;
}
/* Tambah akun (master dan admin). Akun login dibuat lewat instance Firebase kedua supaya sesi yang sedang masuk tidak berpindah. */
let authTambah = null;
const authTambahAkun = async () => { if (!authTambah) { authTambah = getAuth(initializeApp(app.options, "tambah-akun")); authTambah.languageCode = "id"; await setPersistence(authTambah, inMemoryPersistence); } return authTambah; };
const HURUF_SANDI = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const sandiAcak = (n = 24) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return Array.from(b, (x) => HURUF_SANDI[x % HURUF_SANDI.length]).join(""); };
document.addEventListener("change", (ev) => {
  const t = ev.target; if (!t) return;
  if (t.id === "ta-peran") {
    const k = $("#ta-kode"), dv = t.value === "divisi"; if (k && !dv) k.textContent = kodeUnit(peranDasar(t.value), kodeTerpakai());
    $("#ta-info-divisi").hidden = !dv; $("#ta-info-staf").hidden = dv; $("#ta-ok").textContent = dv ? "Lanjut" : "Buat akun";
    ["#ta-nama", "#ta-email", "#ta-wa"].forEach((i) => { $(i).disabled = dv; });
  }
  if (t.dataset && t.dataset.akun === "peran") { const p = t.closest(".ak-tunggu"), k = p && p.querySelector('[data-ak="prev"]'); if (k) k.textContent = kodeUnit(peranDasar(t.value), kodeTerpakai()); }
});
document.addEventListener("ak-buka-tambah", () => dialogTambah());
document.addEventListener("input", (ev) => {
  if (ev.target && ev.target.id === "ak-cari") { S.cari = ev.target.value; const p = ev.target.selectionStart; render(); const el = $("#ak-cari"); if (el) { el.focus(); el.setSelectionRange(p, p); } }
});
function dialogTambah() {
  const lapis = document.createElement("div"); lapis.className = "mr-konfirm"; lapis.id = "ak-tambah";
  lapis.innerHTML = `<div class="mr-konfirm__kotak"><h3>Tambah akun</h3><div class="mr-konfirm__isi">
    <label class="ak-lbl">Nama lengkap</label><input id="ta-nama" autocomplete="off" style="width:100%;box-sizing:border-box">
    <label class="ak-lbl">Email</label><input id="ta-email" type="email" autocomplete="off" style="width:100%;box-sizing:border-box">
    <label class="ak-lbl">WhatsApp (opsional)</label><input id="ta-wa" type="tel" inputmode="tel" autocomplete="off" style="width:100%;box-sizing:border-box">
    <label class="ak-lbl">Peran</label><select id="ta-peran" style="width:100%;box-sizing:border-box"><option value="sales">Sales</option>${S.master ? '<option value="admin">Admin</option>' : ""}<option value="lihat">Lihat saja</option>${`<optgroup label="Peran siap pakai">${semuaPreset().map((x) => `<option value="p:${e(x.id)}">${e(x.nama)}</option>`).join("")}</optgroup>`}<option value="divisi">Kepala / anggota divisi (Daily Job)</option></select>
    <p class="mr-sub" id="ta-info-divisi" hidden style="margin:10px 0 0">Nama, username, kelompok, dan jabatan (kepala divisi atau anggota) diisi di langkah berikutnya.</p>
    <p class="mr-sub" id="ta-info-staf" style="margin:10px 0 0">Kode unit <span class="ak-kode" id="ta-kode">${e(kodeUnit("sales", kodeTerpakai()))}</span> dibuat otomatis. Akun langsung aktif dengan kata sandi sementara yang tampil sekali untuk disalin atau dikirim lewat WhatsApp.</p></div>
    <div class="mr-konfirm__aksi"><button class="mr-btn" data-x="batal">Batal</button><button class="mr-btn mr-btn--utama" data-st="akun-tambah" id="ta-ok">Buat akun</button></div></div>`;
  document.body.appendChild(lapis); lapis.querySelector('[data-x="batal"]').onclick = () => lapis.remove(); lapis.querySelector("#ta-nama").focus();
}
/* Sandi sementara tampil sekali: salin atau kirim lewat WhatsApp. */
function dialogAkunBaru(d) {
  return new Promise((selesai) => {
    const pesan = pesanAkunBaru(d), lapis = document.createElement("div"); lapis.className = "mr-konfirm";
    lapis.innerHTML = `<div class="mr-konfirm__kotak"><h3>Akun ${e(d.nama)} dibuat</h3><div class="mr-konfirm__isi">
      <p style="margin:0 0 6px"><b>${e(d.email)}</b>${d.kode ? ` · kode <b>${e(d.kode)}</b>` : ""}</p>
      <p style="margin:0 0 4px" class="mr-sub">Kata sandi sementara (tampil sekali, tidak bisa dilihat lagi):</p>
      <input readonly id="db-sandi" value="${e(d.sandi)}" style="width:100%;box-sizing:border-box;font-family:monospace;font-size:18px" aria-label="Kata sandi sementara"></div>
      <div class="mr-konfirm__aksi"><button class="mr-btn" data-x="salin">Salin pesan</button>${d.telepon ? `<a class="mr-btn mr-btn--utama" href="${e(linkWa(d.telepon, pesan))}" target="_blank" rel="noopener">Kirim via WhatsApp</a>` : ""}<button class="mr-btn" data-x="tutup">Tutup</button></div></div>`;
    document.body.appendChild(lapis);
    const q = (x) => lapis.querySelector(x);
    q('[data-x="salin"]').onclick = async (ev) => { try { await navigator.clipboard.writeText(pesan); ev.target.textContent = "Tersalin"; } catch (_) { q("#db-sandi").select(); ev.target.textContent = "Salin manual"; } };
    q('[data-x="tutup"]').onclick = () => { lapis.remove(); selesai(); };
  });
}
async function tambahAkunManual() {
  if (!S.master && !S.admin) return;
  if ($("#ta-peran").value === "divisi") { $("#ak-tambah").remove(); return bukaBuatDivisi(); } // kepala dan anggota divisi dibuat lewat fungsi server akun divisi
  const email = $("#ta-email").value.trim().toLowerCase(), nama = $("#ta-nama").value.trim(), pilih = $("#ta-peran").value, pr = presetDari(pilih), peran = pr ? pr.peran : pilih, kode = kodeUnit(peran, kodeTerpakai()), telepon = normalisasiWa($("#ta-wa").value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Isi email yang valid.", "bahaya");
  if (!nama) return toast("Isi nama lengkap.", "bahaya");
  if (S.akun.some((a) => String(a.email || "").toLowerCase() === email)) return toast("Email ini sudah ada di daftar akun.", "bahaya");
  const tombol = document.querySelector('#ak-tambah [data-st="akun-tambah"]'); if (tombol) { tombol.disabled = true; tombol.textContent = "Membuat akun…"; }
  const pulih = () => { if (tombol) { tombol.disabled = false; tombol.textContent = "Buat akun"; } };
  let uid = null;
  const sandi = sandiAcak(10);
  try {
    const a = await authTambahAkun();
    uid = (await createUserWithEmailAndPassword(a, email, sandi)).user.uid;
  } catch (er) {
    pulih();
    const pesan = er && er.code === "auth/email-already-in-use" ? "Email ini sudah punya akun login, tetapi belum ada di daftar aplikasi. Minta orangnya masuk sekali agar muncul di Menunggu persetujuan." : `Akun login belum dibuat: ${e(er && (er.code || er.message))}`;
    return toast(pesan, "bahaya");
  }
  try {
    await setDoc(doc(db, "pengguna", uid), { email, nama, peranDiminta: peran, peran, status: "aktif", dibuat: serverTimestamp(), disetujuiPada: serverTimestamp(), dibuatOleh: "manual", kodeSales: kode, ...(telepon ? { telepon } : {}) });
    if (pr) await updateDoc(doc(db, "pengguna", uid), { akses: aksesPreset(pr) }); // aturan Firestore tidak mengizinkan akses saat create
    if (peran === "sales") await setDoc(doc(db, "sales_publik", uid), { uid, nama, kode, targetBulanan: null });
  } catch (er) {
    pulih();
    return toast(`Akun login sudah dibuat, tetapi profilnya gagal disimpan (${e(er.code || er.message)}). Minta orangnya masuk sekali; akunnya akan muncul di Menunggu persetujuan.`, "bahaya");
  }
  await catatLogAkun({ uid, email }, "tambah", null, { peran, jabatan: pr ? pr.nama : null, status: "aktif", kode });
  try { await signOut(await authTambahAkun()); } catch (_) {}
  const l = $("#ak-tambah"); if (l) l.remove();
  await muatAkun(); S.pilih = uid;
  await dialogAkunBaru({ nama, email, sandi, kode, telepon });
}
async function muatAkun() {
  try { const snap = await getDocs(collection(db, "pengguna")); S.akun = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.peran !== "dj").sort((a, b) => String(a.email).localeCompare(String(b.email))); } catch (er) { S.akun = []; toast(`<b>Daftar akun gagal dimuat.</b> ${e(er.code || er.message)}. Pasang aturan Firestore terbaru.`, "bahaya"); }
  try { S.log = await muatLogAkun(); } catch (_) { S.log = []; }
  try { const [t, f] = await Promise.all([MRDB.hitungModalBelumDipisah(), hitungModalFase2()]); S.modal = { tarif: t.inline, fase2: f.total, siap: !t.inline && !f.total && f.tandai && !f.gagal.length }; } catch (er) { S.modal = { tarif: "?", fase2: "?", siap: false }; }
  await muatPeran(); // peran siap pakai (bawaan + buatan sendiri) dan daftar halaman yang sudah ditinjau
  S.akunMuat = true; render();
  if (!S.masuk) { S.masuk = {}; httpsCallable(getFunctions(app, "asia-southeast2"), "loginTerakhir")().then((r) => { S.masuk = (r.data && r.data.masuk) || {}; render(); }).catch(() => { S.masuk = null; }); }
}
/* Kata sandi akun lain (master): kirim email reset, atau ketik kata sandi baru (lewat Cloud Function; butuh paket Blaze). */
function dialogSandi(ak, uid) {
  return new Promise((selesai) => {
    const lapis = document.createElement("div"); lapis.className = "mr-konfirm";
    lapis.innerHTML = `<div class="mr-konfirm__kotak"><h3>Kata sandi ${e(ak.email)}</h3><div class="mr-konfirm__isi">
      <p style="margin:0 0 6px"><b>1. Kirim email reset</b><br><span class="mr-sub">Tautan atur kata sandi dikirim ke emailnya. Master tidak tahu kata sandinya.</span></p>
      <button class="mr-btn" data-x="email">Kirim email reset</button>
      <hr style="margin:14px 0;border:0;border-top:1px solid var(--border,#DCE5EF)">
      <p style="margin:0 0 6px"><b>2. Atur kata sandi baru langsung</b><br><span class="mr-sub">Minimal 8 karakter. Sesi login lamanya berakhir. Sampaikan kata sandinya lewat jalur aman.</span></p>
      <input type="password" id="ds-sandi" autocomplete="new-password" placeholder="Kata sandi baru" style="width:100%;box-sizing:border-box" maxlength="128">
      <label style="display:flex;gap:6px;align-items:center;margin:6px 0 10px"><input type="checkbox" id="ds-lihat"> Tampilkan</label>
      <button class="mr-btn mr-btn--utama" data-x="atur">Simpan kata sandi baru</button></div>
      <div class="mr-konfirm__aksi"><button class="mr-btn" data-x="tutup">Tutup</button></div></div>`;
    document.body.appendChild(lapis);
    const tutup = () => { lapis.remove(); selesai(); }, q = (x) => lapis.querySelector(x);
    q('[data-x="tutup"]').onclick = tutup;
    q("#ds-lihat").onchange = (ev) => { q("#ds-sandi").type = ev.target.checked ? "text" : "password"; };
    q('[data-x="email"]').onclick = async (ev) => {
      ev.target.disabled = true;
      try { await sendPasswordResetEmail(await authTambahAkun(), ak.email); await catatLogAkun({ uid, email: ak.email }, "kirim-reset-sandi", null, null); toast(`Email reset terkirim ke <b>${e(ak.email)}</b>.`); tutup(); }
      catch (er) { ev.target.disabled = false; toast(`Email reset gagal (${e(er.code || er.message)}).`, "bahaya"); }
    };
    q('[data-x="atur"]').onclick = async (ev) => {
      const sandi = q("#ds-sandi").value;
      if (sandi.length < 8) return toast("Kata sandi minimal 8 karakter.", "bahaya");
      ev.target.disabled = true; ev.target.textContent = "Menyimpan…";
      try { await httpsCallable(getFunctions(app, "asia-southeast2"), "aturKataSandi")({ uid, sandi }); toast(`Kata sandi <b>${e(ak.email)}</b> diubah.`); tutup(); }
      catch (er) {
        ev.target.disabled = false; ev.target.textContent = "Simpan kata sandi baru";
        const k = String(er.code || "");
        toast(k.includes("not-found") || k.includes("unavailable") || k.includes("internal") ? "Fitur ubah langsung belum aktif di server (Cloud Function belum ter-deploy; butuh paket Blaze). Pakai email reset dulu." : `Gagal: ${e(er.message || k)}`, "bahaya");
      }
    };
  });
}
/* Ubah nama, email login, dan WhatsApp lewat fungsi server; resolve true bila tersimpan. */
function dialogUbah(ak, uid) {
  return new Promise((selesai) => {
    const lapis = document.createElement("div"); lapis.className = "mr-konfirm";
    lapis.innerHTML = `<div class="mr-konfirm__kotak"><h3>Ubah data akun</h3><div class="mr-konfirm__isi">
      <label class="mr-sub">Nama</label><input id="du-nama" value="${e(ak.nama || "")}" style="width:100%;box-sizing:border-box;margin-bottom:8px">
      <label class="mr-sub">Email login</label><input id="du-email" type="email" value="${e(ak.email || "")}" style="width:100%;box-sizing:border-box;margin-bottom:8px">
      <label class="mr-sub">WhatsApp</label><input id="du-wa" type="tel" value="${e(ak.telepon || "")}" style="width:100%;box-sizing:border-box">
      <p class="mr-sub" style="margin:8px 0 0">Bila email diganti, sesi login lama akun ini berakhir.</p></div>
      <div class="mr-konfirm__aksi"><button class="mr-btn" data-x="tutup">Batal</button><button class="mr-btn mr-btn--utama" data-x="simpan">Simpan</button></div></div>`;
    document.body.appendChild(lapis);
    const q = (x) => lapis.querySelector(x), tutup = (v) => { lapis.remove(); selesai(v); };
    q('[data-x="tutup"]').onclick = () => tutup(false);
    q('[data-x="simpan"]').onclick = async (ev) => {
      const nama = q("#du-nama").value.trim(), email = q("#du-email").value.trim().toLowerCase(), telepon = normalisasiWa(q("#du-wa").value);
      if (!nama || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Isi nama dan email yang valid.", "bahaya");
      if (S.akun.some((x) => x.id !== uid && String(x.email || "").toLowerCase() === email)) return toast("Email ini sudah dipakai akun lain.", "bahaya");
      ev.target.disabled = true; ev.target.textContent = "Menyimpan…";
      try { await httpsCallable(getFunctions(app, "asia-southeast2"), "ubahAkun")({ uid, nama, email, telepon }); tutup(true); }
      catch (er) { ev.target.disabled = false; ev.target.textContent = "Simpan"; toast(`<b>Gagal.</b> ${e(er.code === "functions/internal" ? "Email sudah dipakai di Firebase atau server belum ter-deploy." : er.message || er.code)}`, "bahaya"); }
    };
  });
}
async function aksiAkun(a, tr) {
  const uid = tr && tr.dataset.uid, ak = S.akun.find((x) => x.id === uid); if (!ak) return;
  if (a === "akun-akses") return ak.peran && ak.peran !== "master" ? bukaPanelAkses(ak, { sesudah: render }) : undefined;
  if (a === "akun-hapus" && !S.master) return; // hanya pemilik
  const sel = tr.querySelector("[data-akun=peran]"), peranBaru = sel ? sel.value : peranPilih(ak);
  const pr = presetDari(peranBaru), dasar = peranDasar(peranBaru), punyaJabatan = !!(ak.akses && ak.akses.jabatan);
  /* preset: hak mengikuti preset; peran dasar tanpa preset: hak lama dipertahankan hanya bila peran dan jabatannya tidak berubah */
  const baca = () => ({ peran: dasar, kodeSales: ak.kodeSales || kodeUnit(dasar, kodeTerpakai()), akses: pr ? aksesPreset(pr) : (dasar === ak.peran && !punyaJabatan ? ak.akses || {} : {}) }); // kode unit dibuat sistem; akun lama mempertahankan kodenya
  if ((a === "akun-setujui" || a === "akun-aktif") && !(S.modal && S.modal.siap)) {
    // Tombol tidak dimatikan supaya terasa alasannya: kunci ini sengaja (modal harus dipisah dulu).
    const kartu = document.querySelector(".mr-banner--peringatan"); if (kartu) kartu.scrollIntoView({ behavior: "smooth", block: "center" });
    return toast(S.modal == null ? "Sedang memeriksa keamanan modal. Coba lagi sebentar." : S.master ? "<b>Setujui terkunci.</b> Buka <b>Sistem dan data</b>, tekan <b>Pisahkan modal sekarang</b> (cukup sekali), lalu Setujui akan aktif." : "<b>Setujui terkunci.</b> Modal quotation dan rate harus dipisah pemilik lebih dulu.", "bahaya");
  }
  try {
    if (a === "akun-setujui" || a === "akun-simpan" || a === "akun-aktif") {
      const b = baca();
      await updateDoc(doc(db, "pengguna", uid), { ...b, status: "aktif", disetujuiPada: serverTimestamp() });
      if (b.peran === "sales") await setDoc(doc(db, "sales_publik", uid), { uid, nama: ak.nama || ak.email, kode: b.kodeSales, targetBulanan: ak.targetBulanan ?? null });
      else await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      await catatLogAkun({ uid, email: ak.email }, a === "akun-setujui" ? "setujui" : a === "akun-aktif" ? "aktifkan" : "ubah", { peran: ak.peran ?? null, jabatan: (ak.akses && ak.akses.jabatan) || null, status: ak.status, kode: ak.kodeSales || null }, { peran: b.peran, jabatan: b.akses.jabatan || null, status: "aktif", kode: b.kodeSales || null });
      toast(`Akun <b>${e(ak.email)}</b> ${a === "akun-simpan" ? "diperbarui" : "aktif"} sebagai ${e(PERAN[b.peran])}.`);
    } else if (a === "akun-ubah") {
      if (S.master && await dialogUbah(ak, uid)) toast("Data akun diperbarui.");
      else return;
    } else if (a === "akun-sandi") {
      if (S.master) await dialogSandi(ak, uid);
    } else if (a === "akun-nonaktif") {
      if (!(await konfirmasi("Nonaktifkan akun?", `<b>${e(ak.email)}</b> tidak bisa masuk lagi. Quotation dan riwayatnya tetap tersimpan atas namanya.`, "Nonaktifkan"))) return;
      await updateDoc(doc(db, "pengguna", uid), { status: "nonaktif" }); await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      await catatLogAkun({ uid, email: ak.email }, "nonaktifkan", { status: ak.status }, { status: "nonaktif" }); toast("Akun dinonaktifkan.");
    } else if (a === "akun-hapus") {
      // Fungsi server menghapus profil dan login Firebase Authentication sekaligus (browser tidak bisa menghapus login orang lain); log dicatat di sana.
      if (!(await konfirmasi("Hapus akun ini?", `<b>${e(ak.email)}</b> dihapus permanen dari aplikasi dan dari login Firebase. Quotation dan riwayatnya tetap tersimpan atas namanya. Tidak bisa dibatalkan.`, "Hapus akun"))) return;
      await httpsCallable(getFunctions(app, "asia-southeast2"), "hapusAkun")({ uid });
      toast("Akun dihapus permanen."); S.pilih = null;
    } else if (a === "akun-tolak") {
      // Ditolak = nonaktif, bukan dihapus. Akun tetap terlihat di daftar dan bisa diaktifkan lagi.
      // (Menghapus dokumen membuat profil "menunggu" muncul lagi saat orangnya masuk, dan email yang sama tidak bisa didaftar ulang.)
      if (!(await konfirmasi("Tolak pendaftaran?", `<b>${e(ak.email)}</b> tidak bisa masuk. Akunnya tetap ada di daftar sebagai Nonaktif dan bisa diaktifkan lagi kapan saja.`, "Tolak"))) return;
      await updateDoc(doc(db, "pengguna", uid), { status: "nonaktif", peran: null, ditolakPada: serverTimestamp() }); await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      await catatLogAkun({ uid, email: ak.email }, "tolak", { peran: ak.peran ?? ak.peranDiminta ?? null, status: ak.status }, { peran: null, status: "nonaktif" }); toast("Pendaftaran ditolak. Akun ini tidak bisa masuk.");
    }
  } catch (er) { return toast(`<b>Gagal.</b> ${e(String(er.code || "").startsWith("functions/") ? er.message : (er.code || er.message))}`, "bahaya"); } // galat fungsi server: tampilkan penyebabnya
  await muatAkun();
}
async function muatLokal() { S.lokal = await C.daftarLokal(); render(); if (S.kelola && !S.akunMuat) { S.akunMuat = true; muatAkun(); } }
const progres = (t) => { S.progres = t; const el = $("#st-progres"); if (el) el.textContent = t; };

document.addEventListener("click", async (ev) => {
  if (window.__rute !== "pengaturan") return;
  const t = ev.target.closest("[data-tema],[data-st]"); if (!t) return;
  if (t.dataset.tema) { window.ISLTema.set(t.dataset.tema); render(); return; }
  if (t.dataset.st === "bag") { S.bag = t.dataset.v; render(); return window.scrollTo({ top: 0 }); }
  if (t.dataset.st === "bag-kembali") { S.bag = ""; render(); return window.scrollTo({ top: 0 }); }
  const a = t.dataset.st;
  if (a === "bersih-koreksi") {
    if (!S.master) return;
    if (!(await konfirmasi("Bersihkan nilai modal dari riwayat koreksi?", "Baris Modal di teks koreksi lama dihapus. Nilai rate, dokumen, dan tanggal tidak berubah.", "Bersihkan"))) return;
    const el = $("#st-bersih-koreksi"); if (el) el.textContent = "Membersihkan…";
    try {
      const n = await window.__islBersihkanKoreksi();
      if (el) el.textContent = n ? `${n} rate atau paket dibersihkan dan terverifikasi.` : "Tidak ada yang perlu dibersihkan.";
      toast(n ? `Riwayat koreksi dibersihkan (${n}).` : "Tidak ada riwayat koreksi yang perlu dibersihkan.");
    } catch (er) { if (el) el.textContent = `Gagal: ${er.message}`; toast(`<b>Gagal.</b> ${e(er.message)}`, "bahaya"); }
    return;
  }
  if (a === "akun-buka-tambah") return dialogTambah();
  if (a === "akun-tambah") return tambahAkunManual();
  if (a === "ak-pilih") { S.pilih = t.dataset.uid || (t.closest("[data-uid]") || {}).dataset.uid; render(); return; }
  if (a === "ak-tutup") { S.pilih = null; render(); return; }
  if (a === "peran-pilih") { S.peranLihat = t.dataset.v; render(); return; }
  if (a === "ak-filter") { S.filter = t.dataset.v; render(); return; }
  if (a === "ak-tab") { S.tab = t.dataset.v; S.pilih = null; render(); return; }
  if (a === "cek-firebase") {
    /* Dokumen uji ditulis ke koleksi diagnostik, yang hanya boleh ditulis master (aturan Firestore). */
    if (!S.master) return;
    S.diagJalan = true; render();
    try { S.diag = await window.__ISL.diagnosa(); } catch (er) { S.diag = [{ nama: "Pemeriksaan", ok: false, info: String((er && er.message) || er) }]; }
    S.diagJalan = false; render(); return;
  }
  if (a && (a.startsWith("akun-"))) return aksiAkun(a, t.closest("[data-uid]"));
  if (a === "modal-pisah") {
    if (!(await konfirmasi("Pisahkan modal?", "Modal dipindah ke koleksi khusus master. Quotation, rate, dan tarif tidak berubah isinya. Jangan menutup halaman sampai selesai.", "Pisahkan"))) return;
    S.sibuk = true; render(); const prog = (t2) => { const el = $("#st-modal-prog"); if (el) el.textContent = t2; };
    try {
      prog("Memisahkan modal tarif Master Rate…"); const r1 = await MRDB.pisahkanModal({ oleh: S.email, onProgress: (i, n) => prog(`Master Rate ${i}/${n}…`) });
      // Modal quotation dan rate (cu_*_modal) hanya bisa dipisah pemilik. Admin memisahkan Master Rate saja.
      let r2 = { diproses: 0 };
      if (S.master) { prog("Memisahkan modal quotation, rate, dan template…"); r2 = await pisahkanModalFase2({ oleh: S.email, onProgress: (i, n) => prog(`Quotation dan rate ${i}/${n}…`) }); }
      toast(S.master ? `Selesai. ${r1.diproses} tarif dan ${r2.diproses} dokumen dipisah dan diverifikasi.` : `Modal Master Rate sudah dipisah (${r1.diproses} tarif). Modal quotation dan rate dipisah oleh pemilik.`);
    } catch (er) { toast(`<b>Gagal memisahkan modal.</b> ${e(er.message)}`, "bahaya"); }
    S.sibuk = false; return muatAkun();
  }
  if (a === "unduh-lokal") {
    const o = await C.gabungTerbaru(); if (!Object.keys(o.koleksi).length) return toast("Belum ada cadangan di browser.", "bahaya");
    C.unduh(o); toast("Cadangan diunduh. Simpan file ini di tempat aman (mis. folder Google Drive atau flashdisk)."); render();
  } else if (a === "unduh-penuh") {
    S.sibuk = true; render();
    try { const o = await C.bacaPenuh((i, n, k) => progres(k ? `Membaca ${k}… (${i + 1}/${n})` : "Selesai membaca.")); C.unduh(o); progres(`Selesai. ${o.dibaca} dokumen dibaca${o.dilewati.length ? `, ${o.dilewati.length} koleksi dilewati (${o.dilewati.map((x) => x.koleksi).join(", ")})` : ""}.`); toast("Cadangan lengkap diunduh."); }
    catch (er) { toast(`<b>Gagal membuat cadangan.</b> ${e(er.message)}`, "bahaya"); }
    S.sibuk = false; render();
  } else if (a === "hapus-lokal") {
    if (!(await konfirmasi("Kosongkan cadangan browser?", "Semua cadangan otomatis di browser ini dihapus. Data di Firebase tidak terpengaruh.", "Kosongkan"))) return;
    await C.hapusLokal(); await muatLokal();
  } else if (a === "pulih-terapkan") {
    const p = S.analisa; if (!p || !p.rencana.length) return;
    const ok = await konfirmasi("Pulihkan data?", `<p style="margin:0 0 8px"><b>${p.rencana.length}</b> dokumen akan ditulis ke Firebase (${p.rencana.filter((x) => x.jenis === "baru").length} baru, ${p.rencana.filter((x) => x.jenis === "beda").length} dikembalikan ke isi cadangan). Tidak ada yang dihapus.</p><p class="mr-sub" style="display:block;margin:0">Saran: unduh cadangan lengkap dulu kalau belum, supaya kondisi sekarang juga tersimpan.</p>`, "Pulihkan sekarang");
    if (!ok) return;
    const box = $("#st-hasil-pulih"); box.innerHTML = `<div class="st-stat" id="st-pp">Menulis…</div>`;
    try { const r = await C.terapkanPemulihan(p.rencana, (i, n) => { const x = $("#st-pp"); if (x) x.textContent = `Menulis ${i}/${n}…`; });
      box.innerHTML = `<div class="mr-banner ${r.gagal.length ? "mr-banner--peringatan" : ""}"><div><b>${r.berhasil} dokumen berhasil dipulihkan dan terverifikasi.</b>${r.gagal.length ? `<br>${r.gagal.length} gagal: ${r.gagal.slice(0, 5).map((g) => `${e(g.k)}/${e(g.id)} (${e(g.alasan)})`).join("; ")}` : ""}<br>Muat ulang halaman Master Rate / Customer / Quotation supaya tampilan sesuai database.</div></div>`; }
    catch (er) { box.innerHTML = `<div class="mr-banner mr-banner--peringatan"><div><b>Gagal.</b> ${e(er.message)}</div></div>`; }
    S.analisa = null;
  }
});
document.addEventListener("change", async (ev) => {
  if (window.__rute !== "pengaturan") return;
  const t = ev.target;
  if (t.id === "st-auto") { C.aturOtomatis(t.checked); toast(t.checked ? "Cadangan otomatis di browser aktif." : "Cadangan otomatis di browser dimatikan."); }
  if (t.id === "st-file" && t.files[0]) {
    const box = $("#st-hasil-pulih"); box.innerHTML = `<div class="st-stat" id="st-pp">Membaca file…</div>`;
    try {
      const obj = C.periksaBerkas(JSON.parse(await t.files[0].text()));
      const p = await C.analisaPemulihan(obj, (i, n, k) => { const x = $("#st-pp"); if (x) x.textContent = k ? `Membandingkan ${k}… (${i + 1}/${n})` : "Selesai membandingkan."; });
      S.analisa = p;
      box.innerHTML = `<div class="st-stat">File dibuat <b>${wkt(obj.dibuat)}</b> · sumber <b>${obj.sumber === "server" ? "server (lengkap)" : "browser"}</b>${obj.sumber !== "server" ? ". Cadangan browser berisi data seperti terlihat di layar; periksa ringkasan di bawah dengan teliti." : ""}</div>
        <table class="st-tabel"><thead><tr><th>Koleksi</th><th>Sama</th><th>Hilang di server</th><th>Beda</th><th>Dilewati</th></tr></thead><tbody>${p.ringkas.map((r) => r.galat ? `<tr><td>${e(r.koleksi)}</td><td colspan="4" class="mr-sub">tidak terbaca (${e(r.galat)})</td></tr>` : `<tr><td>${e(r.koleksi)}</td><td>${r.sama}</td><td>${r.baru}</td><td>${r.beda}</td><td>${r.lewat}${r.catatan.length ? ` <span class="mr-sub">(${e(r.catatan.slice(0, 2).join("; "))})</span>` : ""}</td></tr>`).join("")}</tbody></table>
        <div class="st-baris">${p.rencana.length ? `<button class="mr-btn mr-btn--utama" data-st="pulih-terapkan">Pulihkan ${p.rencana.length} dokumen…</button>` : `<span class="st-badge st-badge--ok">Tidak ada yang perlu dipulihkan: data sudah sama dengan file.</span>`}</div>`;
    } catch (er) { box.innerHTML = `<div class="mr-banner mr-banner--peringatan"><div>${e(er.message)}</div></div>`; }
    t.value = "";
  }
});

matchMedia("(max-width: 760px)").addEventListener("change", () => { if (window.__rute === "pengaturan") render(); });
NAV.pasang({ lapisan: () => ($("#mr-layer.is-open") ? 1 : 0), tutup: () => { tutupLayer(); return true; } });
document.addEventListener("click", (ev) => { if (window.__rute === "pengaturan" && ev.target.closest('[data-aksi="tutup-layer"]')) tutupLayer(); });

let sudahMuat = false;
/* Dipanggil router (app.html#pengaturan) setiap kali halaman ini dibuka. */
export async function mulaiPengaturan(user, profil) {
  S.email = user.email; S.master = adalahMaster(user.email); S.sales = !!profil && profil.peran === "sales" && profil.status === "aktif";
  S.admin = !!profil && profil.peran === "admin" && profil.status === "aktif";
  S.kelola = S.master || S.admin;
  window.__ISL_KELOLA = S.kelola;
  $("#user-email").textContent = labelAkun(user.email, user.displayName); renderNav("pengaturan");
  if (window.ISLSales && (S.kelola || S.sales)) { window.ISLSales.saatUbah = render; window.ISLSales.muatAjuan().then(render); } // profil sales dan ajuan hapus pindah ke sini dari Dashboard Performa
  if (!sudahMuat) { sudahMuat = true; await muatLokal(); } else render();
}
