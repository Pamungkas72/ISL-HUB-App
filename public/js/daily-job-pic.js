// PIC Daily Job (murni, diuji tests/unit/daily-job-pic.test.mjs): bawaan nama akun sendiri; boleh diketik, tetapi harus anggota kelompok.
const norm = (t) => String(t ?? "").replace(/\s+/g, " ").trim().toLowerCase();
/** Nama akun yang sedang masuk: nama profil, lalu username, lalu nama tampilan, lalu bagian depan email. */
export const namaAkun = (profil, user) => String((profil && (profil.nama || profil.username)) || (user && user.displayName) || String((user && user.email) || "").split("@")[0] || "").trim();
/** Cocokkan PIC yang diketik dengan daftar anggota (tanpa beda huruf besar). Mengembalikan nama baku, atau "" bila bukan anggota. diri = nama akun sendiri (selalu sah). */
export function cocokPic(pic, anggota, diri = "") {
  const p = norm(pic); if (!p) return "";
  return [diri, ...(anggota || [])].find((n) => n && norm(n) === p) || "";
}
/** Nilai PIC yang disimpan: kosong menjadi nama akun sendiri; PIC lama yang tidak diubah tetap sah; daftar anggota null (belum bisa dimuat) tidak memblokir. ok=false bila ditolak. */
export function tentukanPic(ketik, lama, anggota, diri) {
  const p = String(ketik ?? "").trim() || diri; if (!p) return { ok: true, pic: "" };
  if (norm(p) === norm(lama)) return { ok: true, pic: lama };
  if (!Array.isArray(anggota)) return { ok: true, pic: p };
  const n = cocokPic(p, anggota, diri); return n ? { ok: true, pic: n } : { ok: false, pic: p };
}
