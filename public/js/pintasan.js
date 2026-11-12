// ===========================================================
// PINTASAN KEYBOARD & PROTEKSI LAYAR
// - Ctrl/⌘+F dan / : fokus ke kolom cari yang sedang tampil (bukan pencarian browser).
// - Ctrl/⌘+Enter : menjalankan tombol simpan pada panel yang terbuka.
// - Halaman rahasia (harga, modal, identitas vendor, quotation) untuk selain akun master:
//   isi kabur saat jendela tidak fokus, watermark email (tidak untuk admin dan sales), klik kanan/salin/cetak diblokir.
// Catatan: browser tidak bisa memblokir screenshot sistem operasi sepenuhnya.
// ===========================================================

const HALAMAN_RAHASIA = ["master-rate", "quotation", "customer"];

const ruteSekarang = () => (location.hash.replace(/^#/, "") || "beranda").split("/")[0];
const dilindungi = () => HALAMAN_RAHASIA.includes(ruteSekarang()) && window.__ISL_MASTER !== true;
const sedangMengetik = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

// kolom cari yang tampil di layar (pencarian tarif di desktop/HP, atau kolom cari tab lain)
function kolomCari() {
  return [...document.querySelectorAll('input[type="search"]')].find((i) => !i.disabled && i.offsetParent !== null) || null;
}

function tombolSimpanAktif() {
  const konfirm = document.querySelector(".mr-konfirm__kotak .mr-btn--utama:not([disabled])");
  if (konfirm) return konfirm;
  // tombol simpan = tombol terakhir di footer panel (Simpan perubahan, Tambah item, dst.)
  const tombol = [...document.querySelectorAll("#mr-layer.is-open .mr-panel__kaki button")].filter((b) => !b.disabled && !b.classList.contains("mr-btn--hapus"));
  return tombol.length ? tombol[tombol.length - 1] : null;
}

// ---------- pintasan ----------
document.addEventListener("keydown", (ev) => {
  const mod = ev.ctrlKey || ev.metaKey;
  if (mod && !ev.altKey && (ev.key === "f" || ev.key === "F")) {
    const cari = kolomCari();
    if (cari) { ev.preventDefault(); cari.focus(); cari.select(); }
    return;
  }
  if (!mod && ev.key === "/" && !sedangMengetik(ev.target)) {
    const cari = kolomCari();
    if (cari) { ev.preventDefault(); cari.focus(); cari.select(); }
    return;
  }
  if (mod && ev.key === "Enter") {
    const simpan = tombolSimpanAktif();
    if (simpan) { ev.preventDefault(); simpan.click(); }
  }
});

// ---------- proteksi layar ----------
const KELAS_KABUR = "isl-kabur";
let timerBuka = 0;

function kaburkan(tahan = 0) {
  aturWatermark();
  if (!dilindungi()) return;
  document.documentElement.classList.add(KELAS_KABUR);
  clearTimeout(timerBuka);
  if (tahan) timerBuka = setTimeout(bukaKabur, tahan);
}
function bukaKabur() { clearTimeout(timerBuka); document.documentElement.classList.remove(KELAS_KABUR); }

window.addEventListener("blur", () => kaburkan());
window.addEventListener("focus", () => setTimeout(bukaKabur, 250));
document.addEventListener("visibilitychange", () => (document.hidden ? kaburkan() : setTimeout(bukaKabur, 250)));
window.addEventListener("beforeprint", () => kaburkan());
window.addEventListener("afterprint", () => bukaKabur());

document.addEventListener("contextmenu", (ev) => {
  if (dilindungi() && !sedangMengetik(ev.target)) ev.preventDefault();
});
document.addEventListener("copy", (ev) => {
  if (dilindungi() && !sedangMengetik(document.activeElement)) ev.preventDefault();
});
document.addEventListener("cut", (ev) => {
  if (dilindungi() && !sedangMengetik(document.activeElement)) ev.preventDefault();
});
document.addEventListener("keydown", (ev) => {
  if (!dilindungi()) return;
  const mod = ev.ctrlKey || ev.metaKey;
  if (ev.key === "PrintScreen") {
    // sebagian sistem menyalin layar ke clipboard: kosongkan dan kaburkan sebentar
    try { navigator.clipboard && navigator.clipboard.writeText(""); } catch (e) { /* abaikan */ }
    kaburkan(2500);
    return;
  }
  if (mod && (ev.key === "p" || ev.key === "P" || ev.key === "s" || ev.key === "S" || ev.key === "u" || ev.key === "U") && !tombolSimpanAktif()) {
    ev.preventDefault();
  }
});

// watermark email di halaman rahasia
const wm = document.createElement("div");
wm.className = "isl-watermark";
wm.hidden = true;
wm.setAttribute("aria-hidden", "true");
document.body.appendChild(wm);
function aturWatermark() {
  const email = window.__ISL_EMAIL || "";
  // akun admin dan sales tidak diberi watermark; proteksi lain (kabur, larangan salin) tetap berlaku
  const tanpaWatermark = !!(window.__ISL && (window.__ISL.admin || window.__ISL.sales) && !window.__ISL.master);
  const aktif = dilindungi() && !!email && !tanpaWatermark;
  wm.hidden = !aktif;
  if (!aktif) return;
  const teks = `${email} · rahasia · ${new Date().toISOString().slice(0, 10)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="180"><text x="20" y="100" transform="rotate(-24 210 90)" font-family="Arial" font-size="15" fill="#10233F" fill-opacity="0.09">${teks.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`;
  wm.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
window.addEventListener("hashchange", aturWatermark);
// email dan status master baru diketahui setelah login
setInterval(aturWatermark, 1000); // ringan: hanya mengubah tampilan bila status berubah
