// ===========================================================
// AUTH — logika login/logout, terpisah dari tampilan.
// Kalau nanti mau ganti aturan login (tambah role, dsb),
// cukup ubah di sini, HTML/CSS tidak perlu disentuh.
// ===========================================================
import { auth, db, siapAuth } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { kunciLogin } from "./daily-job-hitung.js";
import { adalahMaster } from "./config-akses.js";
import { hapusSemuaSalinan } from "./cache-lokal.js";
import { muatProfil, tampilGerbang, simpanProfilSaya, muatKegiatan, tambahKegiatan, ubahKegiatan, hapusKegiatan, muatSemuaKegiatan, muatVolume, tambahVolumeBanyak, hapusVolume, muatSemuaVolume } from "./akses.js";
import { periksaSesi, mulaiPemantauSesi, bersihkanSesi } from "./sesi.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

export function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/* Masuk dengan email, username, atau nomor telepon. Akun anggota tim Daily Job (dibuat kepala divisi) dicari lewat dj_login;
   selain itu masukan dianggap email biasa. */
export async function loginIdentitas(masukan, password) {
  await siapAuth;
  const t = String(masukan || "").trim(), kunci = kunciLogin(t); let email = t.includes("@") ? t : "";
  if (kunci) { try { const s = await getDoc(doc(db, "dj_login", kunci)); if (s.exists()) email = s.data().email; } catch (_) { /* tanpa alias: dicoba sebagai email */ } }
  if (!email) { const err = new Error("Akun tidak ditemukan"); err.code = "auth/invalid-credential"; throw err; }
  return signInWithEmailAndPassword(auth, email, password);
}

export function logoutUser() {
  try { sessionStorage.removeItem("islhub-tutup"); sessionStorage.removeItem("islhub-notif-cache"); sessionStorage.removeItem("islhub-login"); } catch (e) {}
  bersihkanSesi();
  hapusSemuaSalinan();
  return signOut(auth);
}

/* Keluar karena aturan sesi (diam 10 menit / lewat 24 jam). Halaman login menampilkan alasannya. */
export async function keluarOtomatis(alasan, { pindah = true } = {}) {
  try { await logoutUser(); } catch (e) { console.error("Gagal keluar otomatis:", e); }
  if (pindah) location.href = "index.html";
  else document.dispatchEvent(new CustomEvent("islhub:sesi-berakhir", { detail: alasan }));
}

/* Lupa kata sandi: email berisi tautan untuk mengatur ulang sandi (bahasa Indonesia). */
export async function kirimResetSandi(email) {
  await siapAuth;
  auth.languageCode = "id";
  await sendPasswordResetEmail(auth, email);
}
export async function daftarUser(nama, email, password) {
  const c = await createUserWithEmailAndPassword(auth, email, password);
  try { await updateProfile(c.user, { displayName: nama }); } catch (_) {}
  return c;
}

/* Gerbang: akun non-master hanya masuk kalau berstatus aktif. Profil tersedia di window.__ISL_PROFIL dan sebagai argumen kedua. */
export function watchAuthState(onLoggedIn, onLoggedOut, opsi = {}) {
  siapAuth.then(() => onAuthStateChanged(auth, async (user) => {
    if (!user) return onLoggedOut();
    const alasan = periksaSesi(user);
    if (alasan) return keluarOtomatis(alasan, { pindah: !opsi.tanpaGerbang });
    mulaiPemantauSesi(user, (a) => keluarOtomatis(a));
    if (opsi.tanpaGerbang) return onLoggedIn(user, null);
    let p;
    try { p = await muatProfil(user); }
    catch (e) { console.error("Profil akun gagal dimuat:", e); p = { uid: user.uid, email: user.email, peran: null, status: "menunggu", galat: e && e.code }; }
    window.__ISL_PROFIL = p;
    window.__islSimpanProfil = data => simpanProfilSaya(user.uid, data);
    window.__islKegiatan = { muat: muatKegiatan, tambah: tambahKegiatan, ubah: ubahKegiatan, hapus: hapusKegiatan, semua: muatSemuaKegiatan };
    window.__islVolume = { muat: muatVolume, tambahBanyak: tambahVolumeBanyak, hapus: hapusVolume, semua: muatSemuaVolume };
    // Pemilik atau admin: menentukan siapa yang melihat pendaftar sales dan boleh mengurus Master Rate (semua halaman).
    window.__ISL_KELOLA = adalahMaster(user.email) || (p.status === "aktif" && p.peran === "admin");
    // dipakai proteksi layar (pintasan.js): akun master dikecualikan dari proteksi
    window.__ISL_MASTER = adalahMaster(user.email);
    window.__ISL_EMAIL = user.email || "";
    if (p.status !== "aktif") return tampilGerbang(p, () => logoutUser().then(() => { location.href = "index.html"; }));
    onLoggedIn(user, p);
  }));
}

export function mapAuthError(code, konteks = "masuk") {
  const pesan = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/missing-email": "Isi email.",
    "auth/missing-password": "Isi kata sandi.",
    "auth/user-not-found": "Email, username, atau kata sandi salah.",
    "auth/wrong-password": "Email, username, atau kata sandi salah.",
    "auth/invalid-credential": "Email, username, atau kata sandi salah.",
    "auth/user-disabled": "Akun ini dinonaktifkan di Firebase. Hubungi admin.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan masuk.",
    "auth/weak-password": "Kata sandi minimal 6 karakter.",
    "auth/network-request-failed": "Koneksi internet bermasalah. Periksa jaringan lalu coba lagi.",
    "auth/operation-not-allowed": "Login email/password belum diaktifkan di Firebase (Authentication > Sign-in method > Email/Password). Hubungi admin.",
    "auth/admin-restricted-operation": "Pembuatan akun baru dinonaktifkan di Firebase (Authentication > Settings > User actions > Enable create). Hubungi admin.",
    "auth/invalid-api-key": "Kunci API Firebase tidak valid. Hubungi admin.",
    "auth/api-key-not-valid": "Kunci API Firebase tidak valid. Hubungi admin.",
  };
  if (pesan[code]) return pesan[code];
  if (String(code || "").startsWith("auth/requests-from-referer")) return "Alamat situs ini belum diizinkan pada API key Firebase (Google Cloud Console > Credentials). Hubungi admin.";
  return `${konteks === "daftar" ? "Pendaftaran gagal" : "Gagal masuk"}. Coba lagi. (kode: ${code || "tidak diketahui"})`;
}
