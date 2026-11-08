// ===========================================================
// UI — alat tampilan bersama (escape teks, toast, panel samping, konfirmasi).
// Dipakai master-rate.js dan form-tambah.js.
// ===========================================================
import { ikon } from "./ikon.js";

export const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const angka = (n) => Number(n).toLocaleString("id-ID");

export function tgl(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function toast(pesan, jenis = "ok") {
  // Halaman tanpa wadah notifikasi (mis. dashboard) tetap bisa menampilkan pesan: wadahnya dibuat otomatis.
  let wadah = $("#mr-toasts");
  if (!wadah) { wadah = document.createElement("div"); wadah.id = "mr-toasts"; document.body.appendChild(wadah); }
  const el = document.createElement("div");
  el.className = `mr-toast mr-toast--${jenis}`;
  el.innerHTML = `<span class="mr-toast__ikon">${ikon(jenis === "ok" ? "cek" : "peringatan", 16)}</span><div class="mr-toast__isi">${pesan}</div><button class="mr-toast__x" aria-label="Tutup">${ikon("tutup", 14)}</button>`;
  $(".mr-toast__x", el).onclick = () => el.remove();
  wadah.appendChild(el);
  if (jenis === "ok") setTimeout(() => el.remove(), 4200);
}

export function bukaLayer(html, { lebar = "drawer" } = {}) {
  tutupLayer();
  const layer = $("#mr-layer");
  layer.innerHTML = `<div class="mr-scrim" data-aksi="tutup-layer"></div><aside class="mr-panel mr-panel--${lebar}" role="dialog" aria-modal="true">${html}</aside>`;
  layer.classList.add("is-open");
  document.body.classList.add("mr-kunci-scroll");
  if (window.ISLNav) window.ISLNav.selaraskan();
  return $(".mr-panel", layer);
}

export function tutupLayer() {
  const layer = $("#mr-layer");
  if (!layer) return;
  layer.classList.remove("is-open");
  layer.innerHTML = "";
  document.body.classList.remove("mr-kunci-scroll");
}

export function konfirmasi(judul, pesan, labelOk = "Lanjutkan") {
  return new Promise((selesai) => {
    const lapis = document.createElement("div");
    lapis.className = "mr-konfirm";
    lapis.innerHTML = `<div class="mr-konfirm__kotak"><h3>${e(judul)}</h3><div class="mr-konfirm__isi">${pesan}</div><div class="mr-konfirm__aksi"><button class="mr-btn" data-x="batal">Batal</button><button class="mr-btn mr-btn--utama" data-x="ok">${e(labelOk)}</button></div></div>`;
    document.body.appendChild(lapis);
    const tutup = (v) => {
      lapis.remove();
      selesai(v);
    };
    $('[data-x="batal"]', lapis).onclick = () => tutup(false);
    $('[data-x="ok"]', lapis).onclick = () => tutup(true);
  });
}

// Konfirmasi yang mengharuskan mengetik kata tertentu (untuk hapus permanen).
export function konfirmasiKetik(judul, pesan, kata, labelOk = "Hapus permanen") {
  return new Promise((selesai) => {
    const lapis = document.createElement("div");
    lapis.className = "mr-konfirm";
    lapis.innerHTML = `<div class="mr-konfirm__kotak"><h3>${e(judul)}</h3><div class="mr-konfirm__isi">${pesan}</div><label class="mr-f" style="margin-top:12px"><span>Ketik <code>${e(kata)}</code> untuk melanjutkan</span><input data-x="ketik" autocomplete="off" placeholder="${e(kata)}"></label><div class="mr-konfirm__aksi"><button class="mr-btn" data-x="batal">Batal</button><button class="mr-btn mr-btn--bahaya" data-x="ok" disabled>${e(labelOk)}</button></div></div>`;
    document.body.appendChild(lapis);
    const ok = $('[data-x="ok"]', lapis);
    const input = $('[data-x="ketik"]', lapis);
    input.focus();
    input.oninput = () => (ok.disabled = input.value.trim() !== kata);
    const tutup = (v) => {
      lapis.remove();
      selesai(v);
    };
    $('[data-x="batal"]', lapis).onclick = () => tutup(false);
    ok.onclick = () => tutup(true);
  });
}
