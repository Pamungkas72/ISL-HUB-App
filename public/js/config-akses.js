// ===========================================================
// AKSES — satu-satunya tempat yang perlu kamu isi sendiri.
// Hanya akun dengan email ini yang boleh MENGEDIT di halaman
// Master Rate. Akun lain (mis. Fathur) hanya bisa melihat.
// Email yang sama juga harus ditulis di firestore.rules
// (lihat firestore.rules.tambahan.txt), supaya pembatasan
// berlaku di sisi server, bukan hanya di tampilan.
// ===========================================================
export const EMAIL_MASTER = "codcodan1@gmail.com";

// Nama dan peran yang ditampilkan di pojok kanan atas. Hanya tampilan; hak akses tetap dari EMAIL_MASTER.
const NAMA_TAMPIL = { "codcodan1@gmail.com": "Ega Mulya · Owner" };
// nama: nama yang diisi saat mendaftar (displayName). Pemilik selalu tampil dengan labelnya.
export function labelAkun(email, nama) {
  const k = String(email || "").trim().toLowerCase();
  return NAMA_TAMPIL[k] || String(nama || "").trim() || email || "";
}

export function adalahMaster(email) {
  if (!email) return false;
  if (EMAIL_MASTER.startsWith("GANTI_")) return false;
  return String(email).trim().toLowerCase() === EMAIL_MASTER.trim().toLowerCase();
}

export function emailMasterBelumDiisi() {
  return EMAIL_MASTER.startsWith("GANTI_");
}
