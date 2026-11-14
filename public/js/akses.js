// ===========================================================
// AKSES — peran akun (master, sales, lihat saja) dan gerbang persetujuan.
// Master: email di config-akses.js (tidak perlu profil).
// Akun lain: dokumen pengguna/{uid}. Akun baru otomatis berstatus "menunggu" sampai master menyetujui di Pengaturan > Akun.
// Sumber kebenaran sebenarnya ada di firestore.rules; file ini hanya mengatur tampilan.
// ===========================================================
import { auth, db } from "./firebase-config.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { adalahMaster } from "./config-akses.js";
import { WA_ADMIN_TAMPILAN, linkWaAdmin, pesanDaftarSales } from "./kontak-admin.js";

export const PERAN = { master: "Master", admin: "Admin", sales: "Sales", lihat: "Lihat saja", dj: "Anggota Daily Job" };
/* Pendaftaran mandiri hanya untuk sales. Admin dibuat master (Pengaturan > Akun). */
export const PERAN_DIMINTA = { sales: "Sales" };

/* Kode sales otomatis: 3 huruf pertama nama depan (BUD). Bentrok → tambah huruf berikutnya dari nama (BUDI, BUDID, …, maks 6). */
export function kodeSalesOtomatis(nama, terpakai = []) {
  const pakai = new Set(terpakai.map((k) => String(k || "").toUpperCase()));
  const kata = String(nama || "").normalize("NFD").toUpperCase().split(/\s+/).map((w) => w.replace(/[^A-Z]/g, "")).filter(Boolean);
  const semua = kata.join(""), dasar = (kata[0] || "").length >= 3 ? kata[0].slice(0, 3) : semua.slice(0, 3);
  if (dasar.length < 2) return "";
  const sisa = semua.slice(dasar.length);
  for (let k = 0; k <= 3 && k <= sisa.length; k++) { const c = dasar + sisa.slice(0, k); if (!pakai.has(c)) return c; }
  for (const h of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!pakai.has(dasar + h)) return dasar + h;
  return "";
}
export const STATUS_AKUN = { menunggu: "Menunggu persetujuan", aktif: "Aktif", nonaktif: "Nonaktif" };

export async function muatProfil(user) {
  if (adalahMaster(user.email)) return { uid: user.uid, email: user.email, nama: "Master", peran: "master", status: "aktif" };
  const ref = doc(db, "pengguna", user.uid);
  const s = await getDoc(ref);
  if (s.exists()) return { uid: user.uid, ...s.data() };
  let telepon = "";
  try { telepon = sessionStorage.getItem("islhub-telepon-daftar") || ""; sessionStorage.removeItem("islhub-telepon-daftar"); } catch (_) {}
  const p = { email: String(user.email || "").toLowerCase(), nama: user.displayName || "", peranDiminta: "sales", peran: null, status: "menunggu", dibuat: serverTimestamp(), ...(telepon ? { telepon } : {}) };
  await setDoc(ref, p);
  return { uid: user.uid, ...p, dibuat: null };
}

/* Log perubahan akun (koleksi pengguna_log): hanya ditambah, tidak bisa diubah atau dihapus (aturan Firestore).
   Dicatat setelah perubahan berhasil. Gagal mencatat tidak membatalkan perubahan, hanya dicatat di konsol. */
export async function catatLogAkun({ uid, email }, aksi, dari, ke) {
  try {
    await setDoc(doc(collection(db, "pengguna_log")), { uid, email: email || "", aksi, dari: dari || null, ke: ke || null, oleh: auth.currentUser ? auth.currentUser.email || "" : "", waktu: serverTimestamp() });
  } catch (er) { console.warn("Log akun tidak tercatat:", er && er.code); }
}
/* 30 catatan terakhir, terbaru di atas. Hanya staf (pemilik dan admin) yang bisa membaca. */
export async function muatLogAkun() {
  const s = await getDocs(query(collection(db, "pengguna_log"), orderBy("waktu", "desc"), limit(30)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const adalahSales = (p) => !!p && p.peran === "sales" && p.status === "aktif";
export const bolehEdit = (p) => !!p && p.status === "aktif" && (p.peran === "master" || p.peran === "admin" || p.peran === "sales");
/* Admin (pemeliharaan): setingkat master untuk Master Rate dan modal, tetapi tidak untuk rahasia vendor atau akun pemilik. */
export const adalahKelola = (p) => !!p && p.status === "aktif" && (p.peran === "master" || p.peran === "admin");

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Pesan saat profil akun gagal dimuat/disimpan (bukan "menunggu": pada akun baru, master belum melihat apa pun). */
function pesanGalatDaftar(kode, email) {
  const k = String(kode || "tidak diketahui");
  if (k === "permission-denied") return `Akun <b>${esc(email)}</b> berhasil masuk, tetapi data akunnya <b>ditolak server</b> (kode: ${esc(k)}). Kalau ini akun baru, pendaftarannya belum tersimpan dan master belum melihatnya. Biasanya aturan Firestore terbaru belum dipasang. Beritahu admin, lalu tekan Muat ulang.`;
  if (k === "unavailable" || k === "deadline-exceeded" || k === "failed-precondition") return `Akun <b>${esc(email)}</b> berhasil masuk, tetapi koneksi ke server terputus sehingga data akunnya belum bisa dimuat atau disimpan (kode: ${esc(k)}). Periksa internet, lalu tekan Muat ulang.`;
  return `Akun <b>${esc(email)}</b> berhasil masuk, tetapi data akunnya belum bisa dimuat atau disimpan (kode: ${esc(k)}). Tekan Muat ulang. Kalau tetap gagal, beritahu admin.`;
}

export function tampilGerbang(p, keluar) {
  const menunggu = p.status === "menunggu", nonaktif = p.status === "nonaktif", galat = !!p.galat;
  const judul = galat ? "Data akun belum bisa dimuat" : menunggu ? "Akun menunggu persetujuan" : nonaktif ? "Akun dinonaktifkan" : "Akses belum tersedia";
  const isi = galat ? pesanGalatDaftar(p.galat, p.email) : menunggu ? `Akun <b>${esc(p.email)}</b> sudah terdaftar. Master akan menyetujui dan menetapkan perannya. Muat ulang halaman ini setelah disetujui.`
    : nonaktif ? `Akun <b>${esc(p.email)}</b> sudah dinonaktifkan. Hubungi master bila ini keliru.` : `Akun <b>${esc(p.email)}</b> belum punya peran. Hubungi master.`;
  /* warna memakai variabel tema (style.css/tambahan.css), jadi layar ini ikut terang atau gelap seperti halaman lain */
  document.body.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg,#F3F7FB);font-family:Inter,system-ui,sans-serif"><div style="background:var(--surface,#fff);border:1px solid var(--border,#DCE5EF);border-radius:16px;max-width:440px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.25)"><h2 style="margin:0 0 8px;color:var(--head,#10233F)">${judul}</h2><p style="color:var(--muted,#5b6977);line-height:1.6;margin:0 0 18px">${isi}</p><div style="display:flex;gap:8px;flex-wrap:wrap">${menunggu ? `<a href="${linkWaAdmin(pesanDaftarSales({ nama: p.nama, email: p.email }))}" target="_blank" rel="noopener" class="ip-btn ip-btn--wa" style="width:auto">Hubungi admin · ${esc(WA_ADMIN_TAMPILAN)}</a>` : ""}<button id="gt-muat" style="padding:10px 18px;border-radius:99px;border:0;background:linear-gradient(135deg,#f7a559,#e8883a);color:#1d1305;font-weight:800;cursor:pointer">Muat ulang</button><button id="gt-keluar" style="padding:10px 18px;border-radius:99px;border:1px solid var(--border,#c9d3e0);background:var(--surface,#fff);color:var(--text,#10233F);font-weight:700;cursor:pointer">Keluar</button></div></div></div>`;
  document.getElementById("gt-muat").onclick = () => location.reload();
  document.getElementById("gt-keluar").onclick = keluar;
}

/* pengaturan pribadi dan data profil akun sendiri (dibatasi aturan Firestore) */
export const simpanProfilSaya = (uid, data) => updateDoc(doc(db, "pengguna", uid), data);

/* catatan kegiatan per quotation yang sudah disetujui (koleksi qt_kegiatan; dibatasi aturan Firestore) */
export async function muatKegiatan(quotationId) {
  const s = await getDocs(query(collection(db, "qt_kegiatan"), where("quotationId", "==", quotationId)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export const tambahKegiatan = (id, data) => setDoc(doc(db, "qt_kegiatan", id), data);
export const ubahKegiatan = (id, data) => updateDoc(doc(db, "qt_kegiatan", id), data);
export const hapusKegiatan = (id) => deleteDoc(doc(db, "qt_kegiatan", id));
/* catatan volume per baris tarif yang sudah disetujui (koleksi qt_volume; dibatasi aturan Firestore, tanpa modal) */
export async function muatVolume(quotationId) {
  const s = await getDocs(query(collection(db, "qt_volume"), where("quotationId", "==", quotationId)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/* satu periode disimpan sekaligus: semua baris berhasil atau tidak sama sekali */
export async function tambahVolumeBanyak(daftar) {
  const batch = writeBatch(db);
  daftar.forEach(({ id, data }) => batch.set(doc(db, "qt_volume", id), data));
  await batch.commit();
}
export const hapusVolume = (id) => deleteDoc(doc(db, "qt_volume", id));
/* semua catatan volume, untuk laporan master */
export async function muatSemuaVolume() {
  const s = await getDocs(collection(db, "qt_volume"));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/* semua catatan kegiatan, untuk laporan master (aturan Firestore: hanya staf yang boleh membaca) */
export async function muatSemuaKegiatan() {
  const s = await getDocs(collection(db, "qt_kegiatan"));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
