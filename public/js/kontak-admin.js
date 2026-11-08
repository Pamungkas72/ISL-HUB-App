// ===========================================================
// KONTAK ADMIN — nomor WhatsApp untuk sales yang baru mendaftar.
// Ubah nomor di sini saja; semua tampilan memakai konstanta ini.
// ===========================================================
export const WA_ADMIN_TAMPILAN = "0896 1000 2730";
export const WA_ADMIN_NOMOR = "6289610002730"; // format internasional tanpa + (62 + 89610002730)

export const linkWaAdmin = (pesan) => `https://wa.me/${WA_ADMIN_NOMOR}?text=${encodeURIComponent(pesan)}`;

const NAMA_PERAN = { admin: "Admin", cs: "CS", sales: "Sales" };
export const pesanDaftarSales = ({ nama, email, peran }) =>
  `Halo Admin ISL HUB, saya sudah mendaftar ${peran ? `akun dengan status ${NAMA_PERAN[peran] || peran}` : "sebagai sales"}.\nNama: ${nama || "-"}\nEmail: ${email || "-"}\nMohon segera disetujui. Terima kasih.`;
