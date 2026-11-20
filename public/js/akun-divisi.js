// Akun anggota divisi Daily Job per kelompok (Pengaturan > Akun sales dan akses; master dan admin).
// Membuat akun, menetapkan kepala divisi, pindah kelompok, reset sandi, nonaktifkan, hapus. Semua lewat Cloud Functions (functions/dailyjob-akun.js).
import { e, $, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { app, db } from "./firebase-config.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as H from "./daily-job-hitung.js";

const A = { kel: [], akun: [], siap: false, galat: "", root: null, filter: "" };
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
  } catch (err) { console.error(err); A.galat = "Daftar akun divisi belum bisa dibaca."; }
  A.siap = true;
}
const baris = (a, i) => `<div class="ad-baris">${avatar(a.nama, i)}<span class="ad-t"><b>${e(a.nama || "-")}</b><small>@${e(a.username || "")}${a.telepon ? ` · ${e(a.telepon)}` : ""}</small></span>${a.status === "nonaktif" ? `<span class="ad-bd">Nonaktif</span>` : ""}<span class="ad-bd${jabatanKepala(a) ? " ad-bd--k" : ""}">${jabatanKepala(a) ? "Kepala divisi" : "Anggota"}</span><button type="button" class="mr-ikonbtn" data-ad="kelola" data-id="${e(a.id)}" aria-label="Kelola ${e(a.nama)}">${ikon("titik", 18)}</button></div>`;
const urut = (l) => [...l].sort((x, y) => jabatanKepala(y) - jabatanKepala(x) || String(x.nama).localeCompare(String(y.nama), "id"));
function kartuKel(k) {
  const l = urut(A.akun.filter((a) => a.kelompokDJ === k.id));
  return `<div class="ad-kartu"><div class="ad-kh"><span><b>${e(k.nama)}</b><small>Profil ${e(k.profil === "tracking" ? "Tracking" : "Marketing")} · ${l.length} akun</small></span><button type="button" class="mr-btn mr-btn--kecil" data-ad="baru" data-k="${e(k.id)}">${ikon("plus", 14)} Anggota</button></div>${l.map(baris).join("") || `<p class="mr-sub" style="margin:8px 0">Belum ada anggota.</p>`}</div>`;
}
function html() {
  if (!A.siap) return `<p class="mr-sub">Memuat akun divisi…</p>`;
  if (A.galat) return `<p class="mr-sub">${e(A.galat)}</p>`;
  const tanpa = A.akun.filter((a) => !kelById(a.kelompokDJ));
  return `<div class="ad-kepala"><div><h4>Akun divisi Daily Job</h4><p class="mr-sub">Tiap kelompok punya satu kepala divisi yang menilai hasil dan menetapkan target. Anggota hanya membuka Daily Job kelompoknya.</p></div><button type="button" class="mr-btn mr-btn--utama" data-ad="baru">${ikon("plus", 14)} Buat akun</button></div>
    <div class="ad-grid">${A.kel.map(kartuKel).join("") || `<p class="mr-sub">Belum ada kelompok. Buat kelompok dulu di Daily Job > Pengaturan.</p>`}${tanpa.length ? `<div class="ad-kartu"><div class="ad-kh"><span><b>Tanpa kelompok</b><small>${tanpa.length} akun</small></span></div>${tanpa.map(baris).join("")}</div>` : ""}</div>`;
}
const gambar = () => { if (A.root && A.root.isConnected) A.root.innerHTML = html(); };
export async function isiAkunDivisi(root) { A.root = root; gambar(); if (!A.siap) { await muat(); gambar(); } }
const segJabatan = (j) => `<div class="ad-seg" data-ad-jab="${j}"><button type="button" data-ad="jab" data-v="anggota" class="${j === "anggota" ? "is-on" : ""}">Anggota</button><button type="button" data-ad="jab" data-v="kepala" class="${j === "kepala" ? "is-on" : ""}">Kepala divisi</button></div>`;
const kepalaPanel = (judul, sub) => `<header class="mr-panel__kepala"><div><h2>${judul}</h2>${sub ? `<p class="mr-sub">${sub}</p>` : ""}</div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>`;
const opsiKel = (pilih) => A.kel.map((k) => `<option value="${e(k.id)}"${k.id === pilih ? " selected" : ""}>${e(k.nama)}</option>`).join("");
const fld = (lab, isi) => `<label class="mr-f"><span>${lab}</span>${isi}</label>`;

function panelBuat(kid) {
  if (!A.kel.length) return toast("Buat kelompok dulu di Daily Job > Pengaturan.", "bahaya");
  bukaLayer(`${kepalaPanel("Buat akun")}<div class="mr-panel__isi"><div class="mr-form" style="grid-template-columns:1fr" id="ad-buat" data-jab="anggota">
    <div class="ad-seg"><button type="button" data-ad="jenis" data-v="divisi" class="is-on">Anggota divisi</button><button type="button" data-ad="jenis" data-v="staf">Sales, admin, lihat saja</button></div>
    <div id="ad-staf" hidden><p class="mr-sub">Akun sales, admin, dan lihat saja dibuat dari kartu Tambah akun manual di bawah.</p><button type="button" class="mr-btn mr-btn--utama" data-ad="ke-staf">Buka form staf</button></div>
    <div id="ad-divisi" class="mr-form" style="grid-template-columns:1fr">
      ${fld("Nama lengkap", `<input id="ad-nama" maxlength="80" autocomplete="off">`)}${fld("Username <small>huruf kecil, angka, titik, garis bawah, strip</small>", `<input id="ad-user" maxlength="30" autocomplete="off" autocapitalize="none">`)}
      ${fld("Telepon <small>opsional, bisa dipakai masuk</small>", `<input id="ad-tel" type="tel" autocomplete="off">`)}${fld("Email kontak <small>opsional, bisa dipakai masuk</small>", `<input id="ad-mail" type="email" autocomplete="off">`)}
      ${fld("Kata sandi sementara", `<div class="ad-sandi"><input id="ad-sandi" value="${e(H.sandiAcak())}" autocomplete="off" spellcheck="false"><button type="button" class="mr-btn" data-ad="acak">Acak</button></div>`)}
      ${fld("Kelompok", `<select id="ad-kel">${opsiKel(kid || A.kel[0].id)}</select>`)}${fld("Jabatan", segJabatan("anggota"))}
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
function panelKelola(id) {
  const a = A.akun.find((x) => x.id === id); if (!a) return;
  const kep = jabatanKepala(a), mati = a.status === "nonaktif";
  bukaLayer(`${kepalaPanel(e(a.nama), `@${e(a.username || "")} · ${e((kelById(a.kelompokDJ) || {}).nama || "tanpa kelompok")}`)}<div class="mr-panel__isi" id="ad-kelola" data-id="${e(id)}">
    <section class="ad-bag"><h4>Jabatan</h4><p class="mr-sub">Kepala divisi menilai hasil kerja dan menetapkan target. Satu kepala per kelompok.</p>${segJabatan(kep ? "kepala" : "anggota")}<button class="mr-btn" data-ad="jabatan-ok">Simpan jabatan</button></section>
    <section class="ad-bag"><h4>Kelompok</h4><select id="ad-pindah">${opsiKel(a.kelompokDJ)}</select><button class="mr-btn" data-ad="pindah-ok">Pindahkan</button><p class="mr-sub">Job lama tetap di kelompok lamanya.</p></section>
    <section class="ad-bag"><h4>Data masuk</h4>${fld("Nama", `<input id="ad-e-nama" value="${e(a.nama || "")}" maxlength="80">`)}${fld("Telepon", `<input id="ad-e-tel" type="tel" value="${e(a.telepon || "")}">`)}${fld("Email kontak", `<input id="ad-e-mail" type="email" value="${e(a.emailKontak || "")}">`)}<button class="mr-btn" data-ad="data-ok">Simpan data</button></section>
    <section class="ad-bag"><h4>Kata sandi</h4><div class="ad-sandi"><input id="ad-e-sandi" value="${e(H.sandiAcak())}" autocomplete="off" spellcheck="false"><button type="button" class="mr-btn" data-ad="acak-e">Acak</button></div><button class="mr-btn" data-ad="sandi-ok">Reset kata sandi</button><p class="mr-sub">Sesi lama akun ini berakhir.</p></section>
    <section class="ad-bag"><h4>Akun</h4><div class="ad-aksi"><button class="mr-btn" data-ad="${mati ? "aktif" : "nonaktif"}">${mati ? "Aktifkan lagi" : "Nonaktifkan"}</button><button class="mr-btn mr-btn--bahaya" data-ad="hapus">Hapus akun</button></div></section></div>`);
}
async function jalan(t, kerja, pesan) {
  t.disabled = true;
  try { await kerja(); await muat(); gambar(); if (pesan) toast(pesan); return true; } catch (err) { toast(e(err.message || err), "bahaya"); return false; } finally { t.disabled = false; }
}
const nilai = (id) => (($("#" + id) || {}).value || "").trim();
async function aksi(t) {
  const a = t.dataset.ad, uid = ($("#ad-kelola") || {}).dataset && $("#ad-kelola").dataset.id, akun = A.akun.find((x) => x.id === uid);
  if (a === "baru") return panelBuat(t.dataset.k);
  if (a === "kelola") return panelKelola(t.dataset.id);
  if (a === "jenis") { document.querySelectorAll('[data-ad="jenis"]').forEach((b) => b.classList.toggle("is-on", b === t)); $("#ad-staf").hidden = t.dataset.v !== "staf"; $("#ad-divisi").hidden = t.dataset.v === "staf"; $("#ad-buat-ok").hidden = t.dataset.v === "staf"; return; }
  if (a === "ke-staf") { tutupLayer(); const l = document.querySelector("details.st-laci:has(#ta-nama)"); if (l) { l.open = true; l.scrollIntoView({ behavior: "smooth", block: "center" }); } return; }
  if (a === "jab") { const s = t.closest(".ad-seg"); s.dataset.adJab = t.dataset.v; s.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b === t)); const f = $("#ad-buat"); if (f) { f.dataset.jab = t.dataset.v; infoJabatan(); } return; }
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
  if (a === "jabatan-ok") { const j = $("#ad-kelola .ad-seg").dataset.adJab; if ((j === "kepala") === jabatanKepala(akun)) return tutupLayer(); if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: j === "kepala" ? "kepala" : "anggota" }), j === "kepala" ? `${akun.nama} menjadi kepala divisi.` : `${akun.nama} menjadi anggota.`)) tutupLayer(); return; }
  if (a === "pindah-ok") { const k = $("#ad-pindah").value; if (k === akun.kelompokDJ) return tutupLayer(); if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "kelompok", kelompokId: k }), `${akun.nama} pindah ke ${(kelById(k) || {}).nama}.`)) tutupLayer(); return; }
  if (a === "data-ok") { if (nilai("ad-e-tel") && !H.normalTelepon(nilai("ad-e-tel"))) return toast("Nomor telepon tidak valid.", "bahaya"); if (nilai("ad-e-mail") && !H.emailValid(nilai("ad-e-mail"))) return toast("Format email tidak valid.", "bahaya"); if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "ubah", nama: nilai("ad-e-nama"), telepon: nilai("ad-e-tel"), emailKontak: nilai("ad-e-mail") }), "Data diperbarui.")) tutupLayer(); return; }
  if (a === "sandi-ok") { const s = nilai("ad-e-sandi"); if (s.length < 8) return toast("Kata sandi minimal 8 karakter.", "bahaya"); if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "sandi", sandi: s }))) panelKredensial({ nama: akun.nama, username: akun.username, telepon: akun.telepon }, s); return; }
  if (a === "nonaktif" || a === "aktif") { if (a === "nonaktif" && !(await konfirmasi("Nonaktifkan akun ini?", `${e(akun.nama)} tidak bisa masuk lagi. Datanya tetap ada dan bisa diaktifkan lagi.`, "Nonaktifkan"))) return; if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: a }), a === "aktif" ? "Akun aktif lagi." : "Akun dinonaktifkan.")) tutupLayer(); return; }
  if (a === "hapus") { if (!(await konfirmasi("Hapus akun ini?", `${e(akun.nama)} dihapus permanen. Job yang pernah dicatat tetap ada atas namanya.`, "Hapus"))) return; if (await jalan(t, () => panggil("djAturAnggota", { uid, aksi: "hapus" }), "Akun dihapus.")) tutupLayer(); }
}
document.addEventListener("click", (ev) => { const t = ev.target.closest("[data-ad]"); if (t && !t.disabled) aksi(t); });
document.addEventListener("change", (ev) => { if (ev.target && ev.target.id === "ad-kel") infoJabatan(); });
