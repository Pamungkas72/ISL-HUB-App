import { renderNav } from "./nav.js";
import { navItems as semuaNav, SEMBUNYI_PERAN } from "./nav-config.js";
import { adalahMaster, labelAkun } from "./config-akses.js";
import C from "./cadangan.js";

// Dipanggil router (app.html#beranda). Login dan peran sudah diperiksa di app-boot.
let navItems = semuaNav;
export function mulaiBeranda(user, profil) {
  document.getElementById("user-email").textContent = labelAkun(user.email, user.displayName);
  navItems = semuaNav.filter((i) => !((profil && SEMBUNYI_PERAN[profil.peran]) || []).includes(i.id));
  bangunGrid();
  renderNav("beranda");
}


const descriptions = {
  "master-rate": "Kelola tarif modal semua vendor dan lini bisnis, lengkap dengan riwayat harga.",
  pengaturan: "Tema tampilan, cadangan data, dan pemulihan.",
  customer: "Data customer, Rate Disetujui, paket project, dan riwayat quotation serta order.",
  rekap: "Isi kegiatan yang berjalan per periode untuk semua customer sekaligus.",
  laporan: "Laporan order, laba, dan performa penawaran (PDF dan Excel).",
  quotation: "Buat penawaran harga per lini bisnis: PDF, Word, template, dan status persetujuan.",
  klaim: "Input & rekap klaim reimbursement tim.",
  kasus: "Catat & pantau penanganan kasus BD.",
  dailyjob: "Catat job harian tim, pengingat target, dashboard performa, dan laporan PDF.",
  performa: "Pantau revenue, aktivitas, dan target bulanan.",
};

const grid = document.getElementById("module-grid");
function bangunGrid() {
grid.innerHTML = navItems
  .filter((item) => item.id !== "beranda")
  .map((item) => {
    const isActive = item.status === "active";
    const tag = isActive ? "a" : "div";
    const href = isActive ? ` href="${item.href}" style="text-decoration:none;color:inherit"` : "";
    return `
    <${tag} class="module-card"${href}>
      <div class="module-card__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
      </div>
      <h3>${item.label}</h3>
      <p>${descriptions[item.id] || ""}</p>
      <span class="module-card__status ${isActive ? "active" : "soon"}">
        ${isActive ? "Aktif" : "Segera hadir"}
      </span>
    </${tag}>`;
  })
  .join("");
}

// Pemberitahuan tidak ditampilkan di Beranda; muncul di halaman modulnya (lihat htmlPerModul).
