// Panel "Akses per akun" (master dan admin): sakelar Tidak / Lihat / Kelola per halaman untuk satu akun. Menyimpan pengguna.akses lewat Cloud Function akunAturAkses; ditegakkan di firestore.rules.
// Izin per modul berlaku penuh, tidak terkunci peran dasar (satu-satunya batas: Master Rate Kelola khusus Admin). Daftar halaman dibaca dari navigasi (akses.js MODUL).
// Nilai awal mengikuti peran akun; yang berbeda ditandai "diubah khusus" dan dipertahankan saat hak peran diubah.
import { e, $, toast, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { app } from "./firebase-config.js";
import { navItems } from "./nav-config.js";
import { MODUL, NAMA_LEVEL, PERAN, KET_MODUL, batasModul, levelAkses, itemTersembunyi, ringkasAkses } from "./akses.js";
import { aksesPeranAkun, semuaPreset } from "./peran-akses.js";
import "./pemilih.js";

let P = null; // { ak, akun, dasar, awal, dipilih, sesudah }
/* Arti tiap level per modul, tampil di bawah baris supaya jelas apa yang diizinkan. */
const ARTI = {
  mr: ["Master Rate tidak tampil.", "Melihat tarif, vendor, dan harga minimum (tanpa modal).", "Kelola Master Rate hanya untuk Admin."],
  qt: ["Quotation tidak tampil.", "Hanya membaca quotation; tidak bisa membuat.", "Membuat, mengubah, dan mengirim quotation miliknya sendiri."],
  cu: ["Customer tidak tampil.", "Hanya melihat daftar customer.", "Menambah customer baru dan mengubah yang diajukannya."],
  dj: ["Daily Job tidak tampil.", "Melihat job kelompoknya; tidak bisa mencatat.", "Mencatat dan mengubah job kelompoknya."],
  lg: ["Legal tidak tampil.", "Melihat dokumen Legal miliknya.", "Membuat MOM dan dokumen Legal miliknya."],
};
const arti = (m, v) => (ARTI[m] || ["Tidak tampil.", "Hanya membaca.", "Membaca dan mengubah."])[v];
const baris = (m, n) => {
  const t = batasModul(P.ak.peran, m), v = P.dipilih[m], khusus = v !== P.dasar[m];
  return `<div class="pr-baris" data-pa-m="${m}"><div class="pr-baris__t"><b>${e(n)}</b> ${khusus ? `<span class="st-badge st-badge--warn">diubah khusus</span>` : `<span class="mr-sub">ikut peran</span>`}<small>${e(KET_MODUL[m] || "")}</small><small class="pa-arti">${e(arti(m, v))}</small></div>
    <div class="pr-sg" role="group" aria-label="Akses ${e(n)}">${[0, 1, 2].map((l) => `<button type="button" data-pa="set" data-m="${m}" data-v="${l}" class="pr-lv pr-lv--${l}${v === l ? " is-on" : ""}"${l > t ? " disabled" : ""}>${NAMA_LEVEL[l]}</button>`).join("")}</div></div>`;
};
/* Menu yang akan tampil untuk akun ini dengan pilihan sekarang (peran dasar + akses yang dipilih). */
const menu = () => { const p = { ...P.ak, akses: { ...(P.ak.akses || {}), ...P.dipilih } }; return navItems.filter((i) => !itemTersembunyi(p, i) && !(i.modul && levelAkses(p, i.modul) === 0)).map((i) => i.label); };
const beda = () => MODUL.filter(([m]) => P.dipilih[m] !== P.awal[m]).map(([m]) => m);
const gambar = () => {
  const el = $("#pa-isi"); if (!el) return;
  el.innerHTML = MODUL.map(([m, n]) => baris(m, n)).join("");
  const k = beda().length; $("#pa-hit").textContent = k ? `${k} perubahan belum disimpan` : "Belum ada perubahan"; $("#pa-simpan").disabled = !k;
  const mn = $("#pa-menu"); if (mn) mn.innerHTML = `${ikon("tameng", 16)} <b>Menu setelah masuk:</b> ${menu().map(e).join(" · ")}`;
};
/* Salin dari akun lain atau peran siap pakai (hanya mengisi pilihan; belum tersimpan sampai tombol Simpan). */
const sumberSalin = () => {
  const akun = (P.akun || []).filter((a) => a.id !== P.ak.id && a.peran && !["master", "admin"].includes(a.peran) && a.status === "aktif");
  return `<option value="">Pilih sumber…</option>${akun.length ? `<optgroup label="Akun lain">${akun.map((a) => `<option value="a:${e(a.id)}" data-ket="${e(ringkasAkses(a))}">${e(a.nama || a.email)}</option>`).join("")}</optgroup>` : ""}<optgroup label="Peran siap pakai">${semuaPreset().map((x) => `<option value="p:${e(x.id)}" data-ket="${e(x.ket || "")}">${e(x.nama)}</option>`).join("")}</optgroup>`;
};
export function bukaPanelAkses(ak, { sesudah, akun } = {}) {
  P = { ak, akun, sesudah, dasar: aksesPeranAkun(ak), awal: {}, dipilih: {} };
  MODUL.forEach(([m]) => { P.awal[m] = P.dipilih[m] = levelAkses(ak, m); });
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Akses ${e(ak.nama || ak.email)}</h2><p class="mr-sub">${e((ak.akses && ak.akses.jabatan) || PERAN[ak.peran] || ak.peran)}. Izin tiap halaman diatur bebas; tidak terkunci peran dasar.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi"><label class="mr-f"><span>Salin akses dari</span><select id="pa-salin" data-pemilih aria-label="Salin akses dari">${sumberSalin()}</select></label>
      <div id="pa-isi" class="pr-daftar-hal"></div><div id="pa-menu" class="mr-sub pa-menu"></div>
      <p class="mr-sub">Tidak = menu disembunyikan dan data ditolak. Lihat = hanya membaca. Kelola = membuat dan mengubah miliknya sendiri; Quotation atau Customer Kelola membuat akun bisa membuat quotation seperti Sales. Akun perlu masuk ulang agar menu ikut berubah.</p></div>
    <footer class="mr-panel__kaki dj-kaki"><span class="mr-sub" id="pa-hit">Belum ada perubahan</span><span class="mr-ruang"></span><button class="mr-btn" data-pa="reset">Kembalikan ke peran</button><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-pa="simpan" id="pa-simpan" disabled>Simpan</button></footer>`);
  gambar();
}
document.addEventListener("change", (ev) => {
  if (!P || !ev.target || ev.target.id !== "pa-salin" || !ev.target.value) return;
  const [jenis, id] = [ev.target.value.slice(0, 1), ev.target.value.slice(2)];
  const sumber = jenis === "a" ? (P.akun || []).find((a) => a.id === id) : null, pr = jenis === "p" ? semuaPreset().find((x) => x.id === id) : null;
  MODUL.forEach(([m]) => { const v = sumber ? levelAkses(sumber, m) : pr ? (typeof (pr.akses || {})[m] === "number" ? pr.akses[m] : 0) : P.dipilih[m]; P.dipilih[m] = Math.max(0, Math.min(v, batasModul(P.ak.peran, m))); });
  ev.target.value = ""; ev.target.dispatchEvent(new Event("change")); // kembalikan kolom ke "Pilih sumber…"
  toast("Akses disalin ke pilihan. Periksa lalu tekan Simpan."); gambar();
});
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-pa]"); if (!t || !P) return;
  if (t.dataset.pa === "set") { P.dipilih[t.dataset.m] = +t.dataset.v; return gambar(); }
  if (t.dataset.pa === "reset") { MODUL.forEach(([m]) => { P.dipilih[m] = P.dasar[m]; }); return gambar(); }
  if (t.dataset.pa === "simpan") {
    const akses = {}; MODUL.forEach(([m]) => { akses[m] = P.dipilih[m]; });
    const khusus = MODUL.filter(([m]) => akses[m] !== P.dasar[m]).map(([m]) => m), j = P.ak.akses && P.ak.akses.jabatan;
    if (j) akses.jabatan = j; if (khusus.length) akses.khusus = khusus;
    t.disabled = true;
    try {
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js");
      await httpsCallable(getFunctions(app, "asia-southeast2"), "akunAturAkses")({ uid: P.ak.id, akses });
      P.ak.akses = akses; const s = P.sesudah; P.sesudah = null; tutupLayer(); toast("Akses diperbarui. Akun perlu masuk ulang agar menu ikut berubah."); if (s) s();
    } catch (err) { t.disabled = false; toast("Belum tersimpan: " + e(err.message || err), "bahaya"); }
  }
});
