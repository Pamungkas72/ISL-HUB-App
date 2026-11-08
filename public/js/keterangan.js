// ===========================================================
// KETERANGAN — teks penjelasan yang tidak memakan ruang halaman.
// ketIkon(teks): ikon ⓘ kecil. Elemen apa pun dengan atribut data-ket juga bisa dipakai (mis. tab).
// Popup muncul saat kursor di atas (atau saat difokus lewat keyboard); di HP, tahan sebentar.
// ===========================================================
import { e } from "./ui.js";
import { ikon } from "./ikon.js";

export function ketIkon(teks, label = "Keterangan") {
  return `<button type="button" class="ket-ikon" data-ket="${e(teks)}" aria-label="${e(label)}">${ikon("info", 15)}</button>`;
}

let pop = null;
let tahan = null;
let sudahTahan = false;

function tampil(el) {
  const teks = el.dataset.ket;
  if (!teks) return;
  if (!pop) {
    pop = document.createElement("div");
    pop.className = "ket-pop";
    pop.setAttribute("role", "tooltip");
  }
  if (!pop.isConnected) document.body.appendChild(pop);
  pop.textContent = teks;
  const r = el.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${r.bottom + 8}px`;
  pop.classList.add("is-tampil");
}

const sembunyi = () => pop && pop.classList.remove("is-tampil");
const dariKeterangan = (ev) => ev.target.closest?.("[data-ket]");

document.addEventListener("mouseover", (ev) => { const el = dariKeterangan(ev); if (el) tampil(el); });
document.addEventListener("mouseout", (ev) => {
  const el = dariKeterangan(ev);
  if (el && !el.contains(ev.relatedTarget)) sembunyi();
});
document.addEventListener("focusin", (ev) => { const el = dariKeterangan(ev); if (el && el.matches(":focus-visible")) tampil(el); });
document.addEventListener("focusout", sembunyi);
document.addEventListener("pointerdown", (ev) => {
  if (ev.pointerType !== "touch") return;
  const el = dariKeterangan(ev);
  if (!el) return;
  sudahTahan = false;
  clearTimeout(tahan);
  tahan = setTimeout(() => { sudahTahan = true; tampil(el); }, 450);
});
document.addEventListener("pointerup", () => {
  clearTimeout(tahan);
  if (sudahTahan) setTimeout(sembunyi, 2500);
});
document.addEventListener("pointercancel", () => { clearTimeout(tahan); sembunyi(); });
// tahan lama menampilkan keterangan, jadi lepasnya jangan sekaligus menekan tombol di bawahnya
document.addEventListener("click", (ev) => {
  if (sudahTahan) {
    sudahTahan = false;
    ev.stopPropagation();
    ev.preventDefault();
    return;
  }
  // ketuk ikon ⓘ di HP: tampilkan sebentar
  const ikonKet = ev.target.closest?.(".ket-ikon");
  if (ikonKet) { tampil(ikonKet); setTimeout(sembunyi, 2500); }
}, true);
