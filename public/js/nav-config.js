// ===========================================================
// NAV CONFIG — daftar modul Marketing & BD.
// Tambah/ubah/hapus modul cukup edit array ini.
// nav.js otomatis merender ulang di semua halaman.
// Struktur ini juga yang nanti dipakai saat modul ini
// disambungkan ke ISL HUB (id & href jadi acuan integrasi).
// ===========================================================

const icons = {
  home: `<path d="M12 2.5 2.5 10.5V22h7v-6.5h5V22h7V10.5z"/>`,
  rate: `<path fill-rule="evenodd" d="M3 3h9.5L21.5 12 12.5 21 3 11.5z M7.5 5.5a2 2 0 1 0 0 4 2 2 0 1 0 0-4z"/>`,
  quotation: `<path fill-rule="evenodd" d="M6 2h9l4 4v16H6z M9 11h8v1.6H9z M9 15h8v1.6H9z M9 19h5v1.6H9z"/>`,
  klaim: `<path fill-rule="evenodd" d="M5 2h14v19l-2.33-1.5L14.33 21 12 19.5 9.67 21 7.33 19.5 5 21z M8 6.5h8v1.6H8z M8 10.5h8v1.6H8z M8 14.5h5v1.6H8z"/>`,
  kasus: `<path fill-rule="evenodd" d="M8 3h8v4h4v13H4V7h4z M10 5v2h4V5z"/>`,
  dashboard: `<path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5H12z"/>`,
  users: `<circle cx="9" cy="7.5" r="4.5"/><path d="M1 22c0-4.6 3.6-7.5 8-7.5s8 2.9 8 7.5z"/><path d="M17.5 5h3v2.5h2.5v3h-2.5V13h-3v-2.5H15v-3h2.5z"/>`,
  rekap: `<path fill-rule="evenodd" d="M3 4h18v16H3z M5.5 9h13v1.6h-13z M5.5 13.2h13v1.6h-13z M5.5 17.4h13v1.6h-13z"/>`,
  laporan: `<path d="M3 12h4.5v9H3z M9.8 7h4.5v14H9.8z M16.6 3h4.5v18h-4.5z"/>`,
  setelan: `<path d="M3 5h18v2H3z M3 11h18v2H3z M3 17h18v2H3z"/><path fill-rule="evenodd" d="M5.2 6a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0zM6.9 6a1.1 1.1 0 1 1 2.2 0a1.1 1.1 0 1 1 -2.2 0z"/><path fill-rule="evenodd" d="M13.2 12a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0zM14.9 12a1.1 1.1 0 1 1 2.2 0a1.1 1.1 0 1 1 -2.2 0z"/><path fill-rule="evenodd" d="M7.2 18a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0zM8.9 18a1.1 1.1 0 1 1 2.2 0a1.1 1.1 0 1 1 -2.2 0z"/>`,
  uangjalan: `<path fill-rule="evenodd" d="M3 6h18v12H3z M5.5 8.5v7h13v-7z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z"/>`,
  logout: `<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />`,
};

export const navItems = [
  {
    id: "beranda",
    utama: true,
    label: "Beranda",
    href: "app.html#beranda",
    icon: icons.home,
    status: "active",
  },
  {
    id: "master-rate",
    utama: true,
    label: "Master Rate",
    href: "app.html#master-rate",
    icon: icons.rate,
    status: "active",
  },
  {
    id: "quotation",
    utama: true,
    label: "Quotation",
    href: "app.html#quotation",
    icon: icons.quotation,
    status: "active",
  },
  {
    id: "customer",
    utama: true,
    label: "Customer",
    href: "app.html#customer",
    icon: icons.users,
    status: "active",
  },
  {
    id: "rekap",
    label: "Lembar Rekap",
    href: "app.html#rekap",
    icon: icons.rekap,
    status: "active",
    sub: true,
  },
  {
    id: "laporan",
    label: "Laporan Order & Laba",
    href: "app.html#laporan",
    icon: icons.laporan,
    status: "active",
    sub: true,
  },
  {
    id: "uang-jalan",
    label: "Uang Jalan",
    href: "app.html#uang-jalan",
    icon: icons.uangjalan,
    status: "active",
  },
  {
    id: "pengaturan",
    label: "Pengaturan",
    href: "app.html#pengaturan",
    icon: icons.setelan,
    status: "active",
  },
  {
    id: "klaim",
    label: "Klaim",
    href: "#",
    icon: icons.klaim,
    status: "coming-soon",
  },
  {
    id: "kasus",
    label: "Kasus & Project",
    href: "#",
    icon: icons.kasus,
    status: "coming-soon",
  },
  {
    id: "performa",
    utama: true,
    label: "Dashboard Performa",
    href: "app.html#performa",
    icon: icons.dashboard,
    status: "active",
  },
];

// Menu yang disembunyikan per peran (aturan sebenarnya ada di firestore.rules; ini hanya merapikan tampilan).
/* Admin melihat Lembar Rekap, tetapi tidak Laporan Order & Laba (memuat laba). Rute di app-boot.js menjaga hal yang sama. */
export const SEMBUNYI_PERAN = { sales: ["master-rate", "rekap", "laporan", "pengaturan", "uang-jalan"], lihat: ["rekap", "laporan", "performa", "uang-jalan"], admin: ["laporan"] };
export const logoutIcon = icons.logout;
