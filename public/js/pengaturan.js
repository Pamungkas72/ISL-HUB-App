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
import { PERAN, STATUS_AKUN, catatLogAkun, muatLogAkun, kodeSalesOtomatis } from "./akses.js";
import { linkWa, normalisasiWa, pesanAkunBaru } from "./kontak-admin.js";
import * as MRDB from "./db.js";
import { hitungModalFase2, pisahkanModalFase2 } from "./app-store.js";
import { pasangPembersihan } from "./pembersihan-qt.js";

const S = { akun: [], log: [], akunMuat: false, modal: null, perf: { targetDefault: 0 }, email: "", master: false, admin: false, kelola: false, lokal: [], progres: "", sibuk: false, analisa: null, berkas: null };
const kb = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB");
const wkt = (t) => new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const NAMA_BAGIAN = { master: "Master Rate (tarif, vendor, lini, satuan)", fase2: "Customer, Rate, Quotation, Order, Pengaturan dokumen" };

function render() {
  const tema = window.ISLTema.baca(), umur = C.umurUnduhHari(), auto = C.otomatisAktif();
  const lama = umur === null ? "Belum pernah mengunduh cadangan di perangkat ini." : umur === 0 ? "Terakhir diunduh hari ini." : `Terakhir diunduh ${umur} hari lalu.`;
  const basi = umur === null || umur >= 7;
  const bagianTerbaru = ["master", "fase2"].map((b) => S.lokal.find((x) => x.bagian === b));
  $("#st-root").innerHTML = `
  <div class="st-grid">
    <section class="st-kartu"><h3>Tampilan</h3><p>Berlaku di semua halaman pada perangkat ini.</p>
      <div class="st-pil" role="group" aria-label="Tema">${[["otomatis", "Ikut perangkat"], ["terang", "Terang"], ["gelap", "Gelap"]].map(([k, l]) => `<button type="button" data-tema="${k}" class="${tema === k ? "is-aktif" : ""}">${l}</button>`).join("")}</div>
    </section>

    <section class="st-kartu"><h3>Akun saya</h3><p>Masuk sebagai <b>${e(S.email)}</b>.</p>
      <div class="st-stat">Peran: <span class="st-badge ${S.kelola ? "st-badge--ok" : ""}">${S.master ? "Pemilik (bisa mengubah semua data)" : S.admin ? "Admin (mengelola Master Rate, modal, dan akun sales)" : "Lihat saja"}</span></div>
    </section>
    ${S.kelola ? htmlAkun() : ""}
    ${S.master ? htmlCekFirebase() : ""}

    <section class="st-kartu" style="grid-column:1/-1"><h3>Cadangan data</h3>
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
    ${S.master ? `<section class="st-kartu" style="grid-column:1/-1"><h3>Riwayat koreksi rate</h3><p>Teks koreksi rate yang tersimpan sebelum perbaikan ini memuat nilai modal dan bisa dibaca akun sales. Tombol ini menghapus baris Modal dari teks koreksi lama. Nilai rate, dokumen, dan tanggal tidak berubah.</p><div class="st-baris"><button class="mr-btn" data-st="bersih-koreksi">Bersihkan nilai modal dari riwayat koreksi</button></div><div class="st-stat" id="st-bersih-koreksi"></div></section>` : ""}
  </div>`;
  if (S.kelola) pasangPembersihan(document.getElementById("st-bersih"), { master: S.master });
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
const LABEL_LOG = { setujui: "Disetujui", aktifkan: "Diaktifkan lagi", ubah: "Diubah", nonaktifkan: "Dinonaktifkan", tolak: "Ditolak", hapus: "Dihapus", tambah: "Dibuat manual", "atur-sandi": "Kata sandi diatur master", "kirim-reset-sandi": "Email reset kata sandi dikirim" };
const waktuLog = (v) => { const t = v && typeof v.toDate === "function" ? v.toDate() : v; return t ? wkt(t) : "-"; };
/* Hanya bagian yang berubah yang ditampilkan: peran, status, kode sales, dan target. */
const ringkasLog = (dari, ke) => {
  const bagian = [];
  ["peran", "status", "kode", "target"].forEach((f) => { const a = dari ? dari[f] : null, b = ke ? ke[f] : null; if (String(a ?? "") !== String(b ?? "")) bagian.push(`${f}: ${a ?? "-"} → ${b ?? "-"}`); });
  return bagian.join("; ") || "tanpa perubahan";
};
const htmlLog = () => S.log.length
  ? `<table class="st-tabel"><thead><tr><th>Waktu</th><th>Oleh</th><th>Akun</th><th>Aksi</th><th>Perubahan</th></tr></thead><tbody>${S.log.map((x) => `<tr><td>${waktuLog(x.waktu)}</td><td>${e(x.oleh || "-")}</td><td>${e(x.email || "-")}</td><td>${e(LABEL_LOG[x.aksi] || x.aksi)}</td><td class="mr-sub">${e(ringkasLog(x.dari, x.ke))}</td></tr>`).join("")}</tbody></table>`
  : `<div class="st-stat">Belum ada perubahan yang tercatat.</div>`;
function htmlAkun() {
  const menunggu = S.akun.filter((a) => a.status === "menunggu"), lain = S.akun.filter((a) => a.status !== "menunggu");
  const hapusAkun = S.master ? `<button class="st-hapus" data-st="akun-hapus" aria-label="Hapus akun" title="Hapus akun"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button>` : "";
  const dikunci = (a) => !S.master && (a.peran === "admin" || a.peran === "master");
  /* Peran yang terpilih di daftar. Pendaftar mengikuti permintaannya; admin tidak bisa mengangkat admin, jadi permintaan admin jatuh ke Lihat saja. */
  const peranPilih = (a) => a.peran || (a.peranDiminta === "admin" ? (S.master ? "admin" : "lihat") : "sales");
  const terpakai = S.akun.map((a) => a.kodeSales).filter(Boolean);
  const baris = (a) => { const kodeIsi = a.kodeSales || (a.status === "menunggu" && peranPilih(a) === "sales" ? kodeSalesOtomatis(a.nama, terpakai) : ""); if (!a.kodeSales && kodeIsi) terpakai.push(kodeIsi); return `<tr data-uid="${e(a.id)}"><td><b>${e(a.nama || "-")}</b><div class="mr-sub">${e(a.email)}${a.telepon ? ` · ${e(a.telepon)}` : ""}${a.status === "menunggu" && a.peranDiminta === "admin" ? ` · diminta: <b>Admin</b>` : ""}</div></td>
    <td><select data-akun="peran"><option value="sales" ${peranPilih(a) === "sales" ? "selected" : ""}>Sales</option><option value="lihat" ${peranPilih(a) === "lihat" ? "selected" : ""}>Lihat saja</option>${S.master ? `<option value="admin" ${peranPilih(a) === "admin" ? "selected" : ""}>Admin</option>` : ""}</select></td>
    <td><input data-akun="kode" value="${e(kodeIsi)}" placeholder="Kode" style="width:70px" maxlength="6"></td>
    <td><input data-akun="target" inputmode="numeric" value="${a.targetBulanan ? Number(a.targetBulanan).toLocaleString("id-ID") : ""}" placeholder="${S.perf.targetDefault ? Number(S.perf.targetDefault).toLocaleString("id-ID") : "Target Rp/bln"}" style="width:130px" ${S.master ? "" : "disabled"}></td>
    <td><span class="${warna[a.status] || "st-badge"}">${e(STATUS_AKUN[a.status] || a.status)}</span></td>
    <td class="st-aksi">${dikunci(a) ? `<span class="mr-sub">Dikelola pemilik</span>` : a.status === "menunggu" ? `<button class="mr-btn mr-btn--kecil mr-btn--utama" data-st="akun-setujui" ${S.modal && S.modal.siap ? "" : "aria-disabled=\"true\" style=\"opacity:.55\" title=\"Terkunci: pisahkan modal dulu\""}>Setujui</button><button class="mr-btn mr-btn--kecil" data-st="akun-tolak">Tolak</button>`
      : a.status === "aktif" ? `<button class="mr-btn mr-btn--kecil" data-st="akun-simpan">Simpan</button>${S.master ? `<button class="mr-btn mr-btn--kecil" data-st="akun-sandi">Kata sandi</button>` : ""}<button class="mr-btn mr-btn--kecil mr-btn--bahaya" data-st="akun-nonaktif">Nonaktifkan</button>${hapusAkun}`
      : `<button class="mr-btn mr-btn--kecil" data-st="akun-aktif" ${S.modal && S.modal.siap ? "" : "aria-disabled=\"true\" style=\"opacity:.55\" title=\"Terkunci: pisahkan modal dulu\""}>Aktifkan lagi</button>${hapusAkun}`}</td></tr>`; };
  const m = S.modal;
  /* Admin hanya bisa memisahkan modal Master Rate. Modal quotation dan rate dipisah pemilik, jadi admin diberi tahu, bukan diarahkan ke tombol yang tidak menuntaskan. */
  const modalPeringatan = (x) => S.master ? `<b>Modal belum dipisah.</b> ${x.tarif} tarif dan ${x.fase2} dokumen quotation/rate masih menyimpan modal di dokumen biasa. Pisahkan dulu sebelum menyetujui akun sales. Prosesnya sekali jalan, otomatis, dan bisa diulang.`
    : x.tarif > 0 ? `<b>Modal Master Rate belum dipisah.</b> ${x.tarif} tarif masih menyimpan modal di dokumen biasa. Admin bisa memisahkannya sekarang. Modal quotation dan rate hanya bisa dipisah pemilik, dan akun sales baru bisa disetujui setelah itu.`
    : `<b>Menunggu pemilik.</b> Modal quotation dan rate hanya bisa dipisah dan diperiksa pemilik. Akun sales baru bisa disetujui setelah pemilik memastikan semuanya terpisah.`;
  return `<section class="st-kartu" style="grid-column:1/-1"><h3>Akun sales dan akses</h3>
    <p>Sales mendaftar sendiri dari halaman login dan baru bisa masuk setelah kamu setujui di sini. Akun yang ditolak tetap terdaftar sebagai Nonaktif dan bisa diaktifkan lagi. Akun yang pendaftarannya gagal tersimpan bisa diperbaiki dengan meminta orangnya masuk sekali lagi. Sales hanya melihat quotation miliknya, tanpa modal. Akun yang keluar dinonaktifkan, datanya tetap atas namanya. Akun lama (mis. Fathur) otomatis muncul di sini saat pertama login: setujui sebagai <b>Lihat saja</b>.</p>
    ${m == null ? `<div class="st-stat">Memeriksa keamanan modal…</div>` : m.siap ? `<div class="st-stat"><span class="st-badge st-badge--ok">Modal sudah dipisah</span> Modal hanya tersimpan di koleksi khusus master.</div>`
      : `<div class="mr-banner mr-banner--peringatan"><div>${modalPeringatan(m)}${S.master || m.tarif > 0 ? `<div class="st-baris" style="margin-top:8px"><button class="mr-btn mr-btn--utama" data-st="modal-pisah" ${S.sibuk ? "disabled" : ""}>Pisahkan modal sekarang</button></div>` : ""}<div class="st-stat" id="st-modal-prog"></div></div></div>`}
    ${S.master ? `<div class="st-baris"><label class="mr-sub">Target bulanan bawaan sales (Rp, nilai quotation disetujui)</label><input id="ak-target" inputmode="numeric" value="${S.perf.targetDefault ? Number(S.perf.targetDefault).toLocaleString("id-ID") : ""}" placeholder="0" style="width:160px"><button class="mr-btn mr-btn--kecil" data-st="target-simpan">Simpan target</button></div>` : ""}
    ${menunggu.length ? `<h4 style="margin:12px 0 6px">Menunggu persetujuan (${menunggu.length})</h4><table class="st-tabel"><thead><tr><th>Akun</th><th>Peran</th><th>Kode</th><th>Target</th><th>Status</th><th></th></tr></thead><tbody>${menunggu.map(baris).join("")}</tbody></table>` : ""}
    <details class="st-laci" open><summary><span>Pembersihan quotation</span><span class="st-laci-jml">Diabaikan atau lewat masa</span></summary><div class="st-laci-isi" id="st-bersih"></div></details>
    ${S.master || S.admin ? `<details class="st-laci"><summary><span>Tambah akun manual</span><span class="st-laci-jml">buat login dan profil</span></summary><div class="st-laci-isi">
      <p class="mr-sub">Isi nama dan email saja. Kode sales terisi otomatis dan bisa diubah. Akun langsung aktif dengan kata sandi sementara yang tampil sekali untuk disalin atau dikirim lewat WhatsApp.</p>
      <div class="st-baris"><input id="ta-nama" placeholder="Nama lengkap" autocomplete="off" style="min-width:220px"><input id="ta-email" type="email" placeholder="Email" autocomplete="off" style="min-width:220px"><input id="ta-wa" type="tel" inputmode="tel" placeholder="WhatsApp (opsional)" autocomplete="off" style="width:180px"></div>
      <div class="st-baris"><select id="ta-peran" aria-label="Peran"><option value="sales">Sales</option>${S.master ? '<option value="admin">Admin</option>' : ""}<option value="lihat">Lihat saja</option></select><input id="ta-kode" placeholder="Kode sales (2 sampai 6 huruf)" maxlength="6" autocomplete="off" style="width:200px">${S.master ? `<input id="ta-target" inputmode="numeric" placeholder="Target bulanan (opsional)" autocomplete="off" style="width:200px">` : ""}</div>
      <div class="st-baris"><button class="mr-btn mr-btn--utama" data-st="akun-tambah">Buat akun</button></div>
    </div></details>` : ""}
    <details class="st-laci"><summary><span>Riwayat perubahan akun</span><span class="st-laci-jml">${S.log.length} catatan terakhir</span></summary><div class="st-laci-isi">${htmlLog()}</div></details>
    <details class="st-laci"><summary><span>Akun terdaftar</span><span class="st-laci-jml">${lain.length} akun</span></summary><div class="st-laci-isi">${lain.length ? `<table class="st-tabel"><thead><tr><th>Akun</th><th>Peran</th><th>Kode</th><th>Target</th><th>Status</th><th></th></tr></thead><tbody>${lain.map(baris).join("")}</tbody></table>` : `<div class="st-stat">Belum ada akun lain.</div>`}</div></details>
  </section>`;
}
/* Tambah akun manual (master). Akun login dibuat lewat instance Firebase kedua supaya sesi master tidak berpindah. */
let authTambah = null;
const authTambahAkun = async () => { if (!authTambah) { authTambah = getAuth(initializeApp(app.options, "tambah-akun")); authTambah.languageCode = "id"; await setPersistence(authTambah, inMemoryPersistence); } return authTambah; };
const HURUF_SANDI = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const sandiAcak = (n = 24) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return Array.from(b, (x) => HURUF_SANDI[x % HURUF_SANDI.length]).join(""); };
/* kode sales: hanya huruf A-Z (spasi, angka, tanda baca, dan aksen dibuang); dipakai di nomor quotation */
const bersihKode = (v) => String(v || "").normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase();
document.addEventListener("input", (ev) => {
  const t = ev.target; if (!t) return;
  if (t.id === "ta-kode" || (t.dataset && t.dataset.akun === "kode")) { const b = bersihKode(t.value); if (b !== t.value) t.value = b; if (t.id === "ta-kode") t.dataset.manual = "1"; }
  // kode sales ikut nama selama belum diubah tangan
  if (t.id === "ta-nama" || t.id === "ta-peran") { const k = $("#ta-kode"); if (k && k.dataset.manual !== "1") k.value = $("#ta-peran").value === "sales" ? kodeSalesOtomatis($("#ta-nama").value, S.akun.map((a) => a.kodeSales)) : ""; }
});
document.addEventListener("change", (ev) => { if (ev.target && ev.target.id === "ta-peran") ev.target.dispatchEvent(new Event("input", { bubbles: true })); });
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
  const email = $("#ta-email").value.trim().toLowerCase(), nama = $("#ta-nama").value.trim(), peran = $("#ta-peran").value, kode = bersihKode($("#ta-kode").value), target = S.master ? angkaIn($("#ta-target").value) : null, telepon = normalisasiWa($("#ta-wa").value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Isi email yang valid.", "bahaya");
  if (!nama) return toast("Isi nama lengkap.", "bahaya");
  if (peran === "sales" && !/^[A-Z]{2,6}$/.test(kode)) return toast(`Kode sales "${e(kode)}" belum valid: wajib 2 sampai 6 huruf A-Z, tanpa angka atau spasi.`, "bahaya");
  if (S.akun.some((a) => String(a.email || "").toLowerCase() === email)) return toast("Email ini sudah ada di daftar akun.", "bahaya");
  if (!(await konfirmasi("Buat akun ini?", `Akun login untuk <b>${e(email)}</b> dibuat sebagai <b>${e(PERAN[peran])}</b> dan langsung aktif. Kata sandi sementara akan ditampilkan sekali.`, "Buat akun"))) return;
  const tombol = document.querySelector('[data-st="akun-tambah"]'); if (tombol) { tombol.disabled = true; tombol.textContent = "Membuat akun…"; }
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
    await setDoc(doc(db, "pengguna", uid), { email, nama, peranDiminta: peran, peran, status: "aktif", dibuat: serverTimestamp(), disetujuiPada: serverTimestamp(), dibuatOleh: "manual", kodeSales: peran === "sales" ? kode : null, targetBulanan: peran === "sales" ? target : null, ...(telepon ? { telepon } : {}) });
    if (peran === "sales") await setDoc(doc(db, "sales_publik", uid), { uid, nama, kode, targetBulanan: target || null });
  } catch (er) {
    pulih();
    return toast(`Akun login sudah dibuat, tetapi profilnya gagal disimpan (${e(er.code || er.message)}). Minta orangnya masuk sekali; akunnya akan muncul di Menunggu persetujuan.`, "bahaya");
  }
  await catatLogAkun({ uid, email }, "tambah", null, { peran, status: "aktif", kode: kode || null, target: target ?? null });
  try { await signOut(await authTambahAkun()); } catch (_) {}
  await muatAkun(); render();
  await dialogAkunBaru({ nama, email, sandi, kode: peran === "sales" ? kode : "", telepon });
}
async function muatAkun() {
  try { const snap = await getDocs(collection(db, "pengguna")); S.akun = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.email).localeCompare(String(b.email))); } catch (er) { S.akun = []; toast(`<b>Daftar akun gagal dimuat.</b> ${e(er.code || er.message)}. Pasang aturan Firestore terbaru.`, "bahaya"); }
  try { const p = await getDoc(doc(db, "sistem", "performa")); S.perf = { targetDefault: 0, ...(p.exists() ? p.data() : {}) }; } catch (_) {}
  try { S.log = await muatLogAkun(); } catch (_) { S.log = []; }
  try { const [t, f] = await Promise.all([MRDB.hitungModalBelumDipisah(), hitungModalFase2()]); S.modal = { tarif: t.inline, fase2: f.total, siap: !t.inline && !f.total && f.tandai && !f.gagal.length }; } catch (er) { S.modal = { tarif: "?", fase2: "?", siap: false }; }
  render();
}
const angkaIn = (v) => { const n = Number(String(v || "").replace(/[^\d]/g, "")); return n > 0 ? n : null; };
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
async function aksiAkun(a, tr) {
  const uid = tr && tr.dataset.uid, ak = S.akun.find((x) => x.id === uid); if (a !== "target-simpan" && !ak) return;
  if (a === "akun-hapus" && !S.master) return; // hanya pemilik
  if (a === "target-simpan" && !S.master) return; // target bulanan bawaan hanya pemilik
  const baca = () => ({ peran: tr.querySelector('[data-akun=peran]').value, kodeSales: bersihKode(tr.querySelector('[data-akun=kode]').value), targetBulanan: S.master ? angkaIn(tr.querySelector('[data-akun=target]').value) : null });
  if ((a === "akun-setujui" || a === "akun-aktif") && !(S.modal && S.modal.siap)) {
    // Tombol tidak dimatikan supaya terasa alasannya: kunci ini sengaja (modal harus dipisah dulu).
    const kartu = document.querySelector(".mr-banner--peringatan"); if (kartu) kartu.scrollIntoView({ behavior: "smooth", block: "center" });
    return toast(S.modal == null ? "Sedang memeriksa keamanan modal. Coba lagi sebentar." : S.master ? "<b>Setujui terkunci.</b> Tekan <b>Pisahkan modal sekarang</b> di kartu kuning di atas tabel (cukup sekali), lalu Setujui akan aktif." : "<b>Setujui terkunci.</b> Modal quotation dan rate harus dipisah pemilik lebih dulu.", "bahaya");
  }
  try {
    if (a === "akun-setujui" || a === "akun-simpan" || a === "akun-aktif") {
      const b = baca(), data = { ...b, status: "aktif", disetujuiPada: serverTimestamp() };
      /* Target hanya diatur pemilik. Admin menyimpan akun tanpa menyentuh target yang sudah ada (aturan Firestore juga menolaknya). */
      const target = S.master ? b.targetBulanan : (ak.targetBulanan ?? null);
      if (!S.master) delete data.targetBulanan;
      if (b.peran === "sales" && !/^[A-Z]{2,6}$/.test(b.kodeSales)) return toast("Isi kode sales (2 sampai 6 huruf) untuk akun sales.", "bahaya");
      await updateDoc(doc(db, "pengguna", uid), data);
      if (b.peran === "sales") await setDoc(doc(db, "sales_publik", uid), { uid, nama: ak.nama || ak.email, kode: b.kodeSales, targetBulanan: target || null });
      else await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      await catatLogAkun({ uid, email: ak.email }, a === "akun-setujui" ? "setujui" : a === "akun-aktif" ? "aktifkan" : "ubah", { peran: ak.peran ?? null, status: ak.status, kode: ak.kodeSales || null, target: ak.targetBulanan ?? null }, { peran: b.peran, status: "aktif", kode: b.kodeSales || null, target: target ?? null });
      toast(`Akun <b>${e(ak.email)}</b> ${a === "akun-simpan" ? "diperbarui" : "aktif"} sebagai ${e(PERAN[b.peran])}.`);
    } else if (a === "akun-sandi") {
      if (S.master) await dialogSandi(ak, uid);
    } else if (a === "akun-nonaktif") {
      if (!(await konfirmasi("Nonaktifkan akun?", `<b>${e(ak.email)}</b> tidak bisa masuk lagi. Quotation dan riwayatnya tetap tersimpan atas namanya.`, "Nonaktifkan"))) return;
      await updateDoc(doc(db, "pengguna", uid), { status: "nonaktif" }); await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      await catatLogAkun({ uid, email: ak.email }, "nonaktifkan", { status: ak.status }, { status: "nonaktif" }); toast("Akun dinonaktifkan.");
    } else if (a === "akun-hapus") {
      // Hanya profil di aplikasi yang bisa dihapus dari sini. Login di Firebase Authentication harus dihapus di Firebase Console.
      if (!(await konfirmasi("Hapus akun ini?", `<b>${e(ak.email)}</b> dihapus dari daftar aplikasi. Quotation dan riwayatnya tetap tersimpan atas namanya.<br><br>Login-nya masih ada di Firebase Authentication. Kalau orangnya masih punya akun itu, ia akan muncul lagi sebagai <i>menunggu</i> saat masuk. Untuk menutup akses sepenuhnya, hapus juga akun loginnya di Firebase Console &gt; Authentication.`, "Hapus akun"))) return;
      await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      await deleteDoc(doc(db, "pengguna", uid));
      await catatLogAkun({ uid, email: ak.email }, "hapus", { peran: ak.peran ?? null, status: ak.status }, null);
      toast("Akun dihapus dari daftar aplikasi.");
    } else if (a === "akun-tolak") {
      // Ditolak = nonaktif, bukan dihapus. Akun tetap terlihat di daftar dan bisa diaktifkan lagi.
      // (Menghapus dokumen membuat profil "menunggu" muncul lagi saat orangnya masuk, dan email yang sama tidak bisa didaftar ulang.)
      if (!(await konfirmasi("Tolak pendaftaran?", `<b>${e(ak.email)}</b> tidak bisa masuk. Akunnya tetap ada di daftar sebagai Nonaktif dan bisa diaktifkan lagi kapan saja.`, "Tolak"))) return;
      await updateDoc(doc(db, "pengguna", uid), { status: "nonaktif", peran: null, ditolakPada: serverTimestamp() }); await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      await catatLogAkun({ uid, email: ak.email }, "tolak", { peran: ak.peran ?? ak.peranDiminta ?? null, status: ak.status }, { peran: null, status: "nonaktif" }); toast("Pendaftaran ditolak. Akun ini tidak bisa masuk.");
    }
  } catch (er) { return toast(`<b>Gagal.</b> ${e(er.code || er.message)}`, "bahaya"); }
  await muatAkun();
}
async function muatLokal() { S.lokal = await C.daftarLokal(); render(); if (S.kelola && !S.akunMuat) { S.akunMuat = true; muatAkun(); } }
const progres = (t) => { S.progres = t; const el = $("#st-progres"); if (el) el.textContent = t; };

document.addEventListener("click", async (ev) => {
  if (window.__rute !== "pengaturan") return;
  const t = ev.target.closest("[data-tema],[data-st]"); if (!t) return;
  if (t.dataset.tema) { window.ISLTema.set(t.dataset.tema); render(); return; }
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
  if (a === "akun-tambah") return tambahAkunManual();
  if (a === "cek-firebase") {
    /* Dokumen uji ditulis ke koleksi diagnostik, yang hanya boleh ditulis master (aturan Firestore). */
    if (!S.master) return;
    S.diagJalan = true; render();
    try { S.diag = await window.__ISL.diagnosa(); } catch (er) { S.diag = [{ nama: "Pemeriksaan", ok: false, info: String((er && er.message) || er) }]; }
    S.diagJalan = false; render(); return;
  }
  if (a && (a.startsWith("akun-"))) return aksiAkun(a, t.closest("tr"));
  if (a === "target-simpan") {
    try { await setDoc(doc(db, "sistem", "performa"), { targetDefault: angkaIn($("#ak-target").value) || 0, diperbarui: serverTimestamp() }, { merge: true }); toast("Target bulanan bawaan tersimpan."); } catch (er) { toast(`<b>Gagal.</b> ${e(er.code || er.message)}`, "bahaya"); }
    return muatAkun();
  }
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

NAV.pasang({ lapisan: () => ($("#mr-layer.is-open") ? 1 : 0), tutup: () => { tutupLayer(); return true; } });
document.addEventListener("click", (ev) => { if (window.__rute === "pengaturan" && ev.target.closest('[data-aksi="tutup-layer"]')) tutupLayer(); });

let sudahMuat = false;
/* Dipanggil router (app.html#pengaturan) setiap kali halaman ini dibuka. */
export async function mulaiPengaturan(user, profil) {
  if (profil && profil.peran === "sales") { location.hash = "#quotation"; return; }
  S.email = user.email; S.master = adalahMaster(user.email);
  S.admin = !!profil && profil.peran === "admin" && profil.status === "aktif";
  S.kelola = S.master || S.admin;
  window.__ISL_KELOLA = S.kelola;
  $("#user-email").textContent = labelAkun(user.email, user.displayName); renderNav("pengaturan");
  if (!sudahMuat) { sudahMuat = true; await muatLokal(); } else render();
}
