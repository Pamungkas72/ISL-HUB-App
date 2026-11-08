// ===========================================================
// NAV RENDER — baca nav-config.js, gambar ke <nav id="app-nav">.
// Halaman baru tinggal punya <nav id="app-nav"></nav> kosong,
// tidak perlu tulis ulang daftar menu tiap halaman.
// ===========================================================
import { navItems as semuaNav, logoutIcon, SEMBUNYI_PERAN } from "./nav-config.js";
import { logoutUser } from "./auth.js";
import "./cadangan.js";
import { pasangLonceng } from "./notifikasi.js";
import { gulirTetap } from "./gulir-tetap.js";

const IKON_TEMA = {
  otomatis: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  terang: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  gelap: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
};
// Sidebar desktop bisa dilipat (hanya ikon) atau dipin terbuka. Pilihan disimpan per perangkat; awalnya dilipat.
const KUNCI_SIDEBAR = "islhub-sidebar";
const sidebarLipat = () => { try { return localStorage.getItem(KUNCI_SIDEBAR) !== "buka"; } catch (e) { return true; } };
const simpanSidebar = (lipat) => { try { localStorage.setItem(KUNCI_SIDEBAR, lipat ? "lipat" : "buka"); } catch (e) { /* abaikan: browser tanpa penyimpanan */ } };
/* Status dilipat dipegang di <html> (kelas sb-lipat, sudah dipasang skrip di head), jadi tidak ada lompatan lebar saat pindah halaman. */
function aturSidebar(lipat) {
  document.documentElement.classList.toggle("sb-lipat", lipat);
  const tombol = document.getElementById("btn-sidebar");
  if (!tombol) return;
  tombol.setAttribute("aria-expanded", lipat ? "false" : "true");
  tombol.title = lipat ? "Buka menu" : "Lipat menu";
  tombol.setAttribute("aria-label", tombol.title);
}
const NAMA_TEMA = { otomatis: "Tema: ikut perangkat", terang: "Tema: terang", gelap: "Tema: gelap" };
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

// Tombol tema + Keluar di bilah atas: selalu terlihat, termasuk di HP.
function pasangTombolAtas() {
  const bar = document.querySelector(".app-topbar");
  if (!bar) return;
  let kanan = bar.querySelector(".app-topbar__kanan");
  if (!kanan) {
    kanan = document.createElement("div");
    kanan.className = "app-topbar__kanan";
    const user = bar.querySelector(".app-topbar__user");
    if (user) { user.replaceWith(kanan); kanan.appendChild(user); } else bar.appendChild(kanan);
  }
  kanan.querySelectorAll(".tb-btn:not(.tb-btn--lonceng)").forEach((b) => b.remove());
  const tema = window.ISLTema ? window.ISLTema.baca() : "otomatis";
  kanan.insertAdjacentHTML("beforeend",
    `<button type="button" class="tb-btn" id="btn-tema" title="${NAMA_TEMA[tema]} (klik untuk ganti)" aria-label="${NAMA_TEMA[tema]}">${svg(IKON_TEMA[tema])}</button>
     <button type="button" class="tb-btn tb-btn--keluar" id="btn-logout-atas" title="Keluar dari akun" aria-label="Keluar">${svg(logoutIcon)}<span>Keluar</span></button>`);
  pasangLonceng(kanan);
  kanan.querySelector("#btn-tema").addEventListener("click", () => { if (window.ISLTema) { window.ISLTema.berikut(); pasangTombolAtas(); } });
  kanan.querySelector("#btn-logout-atas").addEventListener("click", keluar);
}
async function keluar() { await logoutUser(); window.location.href = "index.html"; }

export function renderNav(activeId) {
  const nav = document.getElementById("app-nav");
  if (!nav) return;
  const peran = (window.__ISL_PROFIL && window.__ISL_PROFIL.peran) || "";
  const navItems = semuaNav.filter((i) => !(SEMBUNYI_PERAN[peran] || []).includes(i.id));

  const lipat = sidebarLipat();
  const brand = `<button type="button" class="app-nav__brand" id="btn-sidebar" aria-expanded="${lipat ? "false" : "true"}" title="${lipat ? "Buka menu" : "Lipat menu"}">ISL <span>HUB</span></button>`;

  const items = navItems
    .map((item) => {
      const isActive = item.id === activeId;
      const isDisabled = item.status === "coming-soon";
      const classes = [
        "nav-item",
        isActive ? "is-active" : "",
        isDisabled ? "is-disabled" : "",
        item.sub ? "nav-item--sub" : "",
      ].join(" ").trim();

      const badge = isDisabled
        ? `<span class="nav-item__badge">Segera</span>`
        : "";

      if (isDisabled) {
        return `<li class="nav-li--lain"><span class="${classes}" title="Belum tersedia — menyusul di fase berikutnya">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
          <span class="nav-item__teks">${item.label}</span>${badge}
        </span></li>`;
      }

      return `<li${item.utama ? "" : ' class="nav-li--lain"'}><a class="${classes}" href="${item.href}" title="${item.label}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
        <span class="nav-item__teks">${item.label}</span>
      </a></li>`;
    })
    .join("");

  const footer = `<div class="app-nav__footer">
    <button class="nav-item" id="btn-logout" type="button" title="Keluar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${logoutIcon}</svg>
      <span class="app-nav__footer-label">Keluar</span>
    </button>
  </div>`;

  // HP: bilah bawah berisi 4 tab utama + "Lainnya". Sisanya (Lembar Rekap, Laporan, Pengaturan) ada di lembar Lainnya.
  const lain = navItems.filter((i) => !i.utama);
  const lainAktif = lain.some((i) => i.id === activeId);
  const IKON_LAIN = '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>';
  const tombolLain = `<li class="nav-li--lainnya"><button type="button" class="nav-item${lainAktif ? " is-active" : ""}" id="btn-lainnya" aria-expanded="false" aria-controls="nav-lain">${svg(IKON_LAIN)}Lainnya</button></li>`;
  const lembarLain = `<div class="nav-lain" id="nav-lain" hidden>${lain.map((i) => i.status === "coming-soon"
    ? `<span class="nav-lain__i is-disabled">${svg(i.icon)}${i.label}<em>Segera</em></span>`
    : `<a class="nav-lain__i${i.id === activeId ? " is-active" : ""}" href="${i.href}">${svg(i.icon)}${i.label}</a>`).join("")}</div>`;

  nav.innerHTML = `${brand}<ul class="app-nav__list">${items}${tombolLain}</ul>${footer}${lembarLain}`;
  aturSidebar(lipat);
  // Halaman tujuan menu di-prefetch supaya pindah halaman di HP tidak mulai dari nol.
  for (const h of new Set(navItems.map((i) => i.href).filter((h) => h && h !== "#").map((h) => h.split("#")[0]))) {
    if (!document.querySelector(`link[rel="prefetch"][href="${h}"]`)) { const l = document.createElement("link"); l.rel = "prefetch"; l.href = h; document.head.appendChild(l); }
  }
  document.getElementById("btn-sidebar").addEventListener("click", () => { const baru = !sidebarLipat(); simpanSidebar(baru); aturSidebar(baru); });
  const tutupLain = () => { const l = document.getElementById("nav-lain"), b = document.getElementById("btn-lainnya"); if (l) l.hidden = true; if (b) b.setAttribute("aria-expanded", "false"); };
  document.getElementById("btn-lainnya").addEventListener("click", (ev) => { ev.stopPropagation(); const l = document.getElementById("nav-lain"); l.hidden = !l.hidden; ev.currentTarget.setAttribute("aria-expanded", String(!l.hidden)); });
  document.addEventListener("click", (ev) => { if (!ev.target.closest("#nav-lain, #btn-lainnya")) tutupLain(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") tutupLain(); });
  document.querySelectorAll("#nav-lain a").forEach((a) => a.addEventListener("click", tutupLain));

  document.getElementById("btn-logout").addEventListener("click", keluar);
  pasangTombolAtas();
  pasangKeyboardHP();
}

/* Render ulang tanpa mengganggu kolom yang sedang diketik: elemen yang sedang fokus (dan induknya) dipertahankan,
   bagian lain diganti. Dipakai pencarian yang menyaring daftar sambil mengetik, supaya keyboard HP tidak tertutup. */
export function morphKecualiFokus(root, html) {
  const a = document.activeElement;
  if (!root || !a || !root.contains(a) || a === root) { root.innerHTML = html; return; }
  const t = document.createElement(root.tagName); t.innerHTML = html;
  const samakan = (live, baru) => {
    const L = [...live.childNodes], B = [...baru.childNodes];
    if (L.length !== B.length) {
      // jumlah anak berbeda: anak yang berisi kolom fokus TIDAK dipindah; anak lain diganti sesuai susunan baru
      const lf = L.find((n) => n.nodeType === 1 && n.contains(a)), sel = a.id ? "#" + CSS.escape(a.id) : null;
      const bi = sel ? B.findIndex((n) => n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel))) : -1;
      if (!lf || bi < 0 || (lf !== a && !samakan(lf, B[bi]))) return false;
      L.forEach((n) => { if (n !== lf) live.removeChild(n); });
      for (let i = 0; i < bi; i++) live.insertBefore(B[i].cloneNode(true), lf);
      const ref = lf.nextSibling; for (let i = bi + 1; i < B.length; i++) live.insertBefore(B[i].cloneNode(true), ref);
      return true;
    }
    for (let i = 0; i < L.length; i++) {
      const l = L[i], b = B[i];
      if (l.nodeType === 1 && l.contains(a)) {
        if (l === a) continue;
        if (b.nodeType !== 1 || b.tagName !== l.tagName) return false;
        [...b.attributes].forEach((x) => { if (l.getAttribute(x.name) !== x.value) l.setAttribute(x.name, x.value); });
        if (!samakan(l, b)) return false;
      } else if (!(l.nodeType === 3 && b.nodeType === 3 && l.data === b.data) && !(l.isEqualNode && l.isEqualNode(b))) live.replaceChild(b.cloneNode(true), l);
    }
    return true;
  };
  if (!samakan(root, t)) { const id = a.id, pos = a.selectionStart; root.innerHTML = html; const n = id && document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
}
window.ISLMorph = (root, html) => gulirTetap(root, () => morphKecualiFokus(root, html));

/* HP: saat mengetik, menu bawah disembunyikan agar tidak menutupi kolom isian */
let kbPasang = false;
function pasangKeyboardHP() {
  if (kbPasang) return; kbPasang = true;
  const kecil = () => matchMedia("(max-width:760px)").matches;
  // Hanya kolom ketik (keyboard muncul). Select, centang, tombol, dan kolom tanggal tidak dihitung.
  const isian = (el) => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=range]):not([type=color]):not([type=date]):not([readonly]),textarea:not([readonly])') && !el.closest(".mr-konfirm");
  let tKetik = null;
  document.addEventListener("focusin", (e) => {
    if (!kecil() || !isian(e.target)) return;
    document.body.classList.add("kb-buka");
    // setelah keyboard terbuka, pastikan kolom yang diketik tidak tertutup
    clearTimeout(tKetik); const el = e.target;
    tKetik = setTimeout(() => { if (document.activeElement !== el) return; const vv = window.visualViewport, h = vv ? vv.height : innerHeight, r = el.getBoundingClientRect(); if (r.bottom > h - 8 || r.top < 8) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 320);
  });
  document.addEventListener("focusout", () => setTimeout(() => { if (!isian(document.activeElement)) document.body.classList.remove("kb-buka"); }, 150));
}
