// ===========================================================
// KONTAK ADMIN — nomor WhatsApp untuk sales yang baru mendaftar.
// Ubah nomor di sini saja; semua tampilan memakai konstanta ini.
// ===========================================================
export const WA_ADMIN_TAMPILAN = "0896 1000 2730";
export const WA_ADMIN_NOMOR = "6289610002730"; // format internasional tanpa + (62 + 89610002730)

/* Nomor bebas ketik (0812…, +62 812…, 812…) → 62812… (hanya angka) */
export const normalisasiWa = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d ? "62" + d : ""; };
export const linkWa = (nomor, pesan) => `https://wa.me/${normalisasiWa(nomor)}?text=${encodeURIComponent(pesan)}`;
export const linkWaAdmin = (pesan) => linkWa(WA_ADMIN_NOMOR, pesan);

export const pesanDaftarSales = ({ nama, email }) =>
  `Halo Admin ISL HUB, saya sudah mendaftar sebagai sales.\nNama: ${nama || "-"}\nEmail: ${email || "-"}\nMohon segera disetujui. Terima kasih.`;
export const pesanAkunAktif = ({ nama, kode }) =>
  `Halo ${nama || ""}, akun ISL HUB Anda sudah aktif.${kode ? `\nKode sales Anda: ${kode}` : ""}\nSilakan masuk dengan email dan kata sandi yang Anda daftarkan.`;
export const pesanAkunBaru = ({ nama, email, sandi, kode }) =>
  `Halo ${nama || ""}, akun ISL HUB Anda sudah dibuat.\nEmail: ${email}\nKata sandi sementara: ${sandi}${kode ? `\nKode sales: ${kode}` : ""}\nSegera ganti kata sandi setelah masuk (menu Lupa kata sandi).`;
