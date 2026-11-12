// Kolom satuan: boleh diketik bebas, dan saat mengetik muncul daftar satuan yang cocok.
// Daftar dibatasi tingginya dan bisa digulir, supaya tidak menutupi form (juga di HP).
import { slug } from "./kunci.js";
import { e } from "./ui.js";

const kodeSatuan = (s) => s.kode || s.id;

// Teks yang diketik -> satuan yang sudah ada, atau satuan baru (kode dari slug nama).
export function resolveSatuan(teks, daftar) {
  const nama = String(teks || "").trim().replace(/\s+/g, " ");
  if (!nama) return { kode: "", nama: "", baru: false, kosong: true };
  const n = nama.toLowerCase();
  const ada = daftar.find((s) => kodeSatuan(s) === slug(nama) || String(s.nama).trim().toLowerCase() === n);
  if (ada) return { kode: kodeSatuan(ada), nama: ada.nama, baru: false, kosong: false };
  return { kode: slug(nama), nama, baru: true, kosong: false };
}

// Markup kolom satuan. `nilai` = nama tampilan awal.
export function htmlPilihSatuan(id, nilai) {
  return `<div class="mr-combo" id="${id}-wrap">
    <input id="${id}" type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" value="${e(nilai)}" placeholder="Ketik atau pilih satuan">
    <ul class="mr-combo__daftar" role="listbox" hidden></ul>
    <small>Ketik satuan baru untuk menambahkannya ke daftar satuan.</small>
  </div>`;
}

// Markup kolom ketik + daftar saran umum (mis. nama layanan). `hint` = satu baris petunjuk di bawah kolom.
export function htmlCombo(id, { nilai = "", placeholder = "", hint = "" } = {}) {
  return `<div class="mr-combo" id="${id}-wrap">
    <input id="${id}" type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" value="${e(nilai)}" placeholder="${e(placeholder)}">
    <ul class="mr-combo__daftar" role="listbox" hidden></ul>
    ${hint ? `<small>${e(hint)}</small>` : ""}
  </div>`;
}

export const pasangPilihSatuan = (wrap, ambilDaftar) => pasangCombo(wrap, () => ambilDaftar().map((s) => ({ nama: s.nama, kunci: kodeSatuan(s) })), { baruTeks: (t) => `＋ Tambah “${t}” sebagai satuan baru` });

// Pasang perilaku daftar saran. `ambilDaftar()` -> [{nama, kunci?}], dipanggil setiap kali daftar dibuka.
// `baruTeks(teks)` (opsional) = tulisan baris "tambah baru" bila teks yang diketik belum ada di daftar.
export function pasangCombo(wrap, ambilDaftar, { baruTeks } = {}) {
  const input = wrap.querySelector("input");
  const ul = wrap.querySelector(".mr-combo__daftar");
  let indeks = -1;
  let mengetik = false; // saat baru difokus, tampilkan semua satuan; setelah mengetik, saring

  const tutup = () => { ul.hidden = true; input.setAttribute("aria-expanded", "false"); indeks = -1; };
  const gambar = () => {
    const q = mengetik ? input.value.trim().toLowerCase() : "";
    const daftar = ambilDaftar();
    const cocok = daftar.filter((s) => !q || String(s.nama).toLowerCase().includes(q) || (s.kunci || "").includes(slug(q)));
    const sudahAda = daftar.some((s) => String(s.nama).trim().toLowerCase() === input.value.trim().toLowerCase());
    const item = cocok.map((s) => `<li role="option" data-nama="${e(s.nama)}">${e(s.nama)}</li>`);
    if (baruTeks && mengetik && input.value.trim() && !sudahAda) item.push(`<li role="option" class="mr-combo__baru" data-nama="${e(input.value.trim())}">${e(baruTeks(input.value.trim()))}</li>`);
    if (!item.length) { tutup(); return; }
    ul.innerHTML = item.join("");
    ul.hidden = false;
    input.setAttribute("aria-expanded", "true");
    indeks = -1;
  };
  const pilih = (nama) => { input.value = nama; tutup(); input.dispatchEvent(new Event("change", { bubbles: true })); };
  const sorot = (dir) => {
    const li = [...ul.querySelectorAll("li")];
    if (!li.length || ul.hidden) return;
    indeks = (indeks + dir + li.length) % li.length;
    li.forEach((x, i) => x.classList.toggle("is-aktif", i === indeks));
    li[indeks].scrollIntoView({ block: "nearest" });
  };

  input.addEventListener("focus", () => { mengetik = false; gambar(); input.scrollIntoView({ block: "center", behavior: "smooth" }); });
  input.addEventListener("input", () => { mengetik = true; gambar(); });
  input.addEventListener("blur", () => { mengetik = false; tutup(); });
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); if (ul.hidden) { mengetik = false; gambar(); } sorot(1); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); sorot(-1); }
    else if (ev.key === "Enter" && !ul.hidden && indeks >= 0) { ev.preventDefault(); pilih(ul.querySelectorAll("li")[indeks].dataset.nama); }
    else if (ev.key === "Escape" && !ul.hidden) { ev.stopPropagation(); tutup(); } // Esc menutup daftar saja, bukan panel
  });
  // mousedown (bukan click) supaya input belum kehilangan fokus sebelum item dipilih
  ul.addEventListener("mousedown", (ev) => {
    const li = ev.target.closest("li[data-nama]");
    if (!li) return;
    ev.preventDefault();
    pilih(li.dataset.nama);
  });
}
