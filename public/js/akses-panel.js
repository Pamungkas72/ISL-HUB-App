// Panel "Akses per akun" (master dan admin): sakelar Tidak / Lihat / Kelola per halaman untuk satu akun. Menyimpan pengguna.akses; ditegakkan di firestore.rules.
// Daftar halaman dibaca dari navigasi (akses.js MODUL). Nilai awal mengikuti peran akun; yang berbeda ditandai "diubah khusus" dan dipertahankan saat hak peran diubah.
import { e, $, toast, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { db } from "./firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { MODUL, NAMA_LEVEL, PERAN, KET_MODUL, batasModul, levelAkses, catatLogAkun } from "./akses.js";
import { aksesPeranAkun } from "./peran-akses.js";

let P = null; // { ak, dasar, awal, dipilih, sesudah }
const aktif = () => MODUL.filter(([m]) => batasModul(P.ak.peran, m) > 0);
const ringkas = (a) => aktif().map(([m, n]) => `${n}: ${NAMA_LEVEL[a[m] ?? 0]}`).join(", ");
const baris = (m, n) => {
  const t = batasModul(P.ak.peran, m), v = P.dipilih[m], khusus = v !== P.dasar[m];
  return `<div class="pr-baris" data-pa-m="${m}"><div class="pr-baris__t"><b>${e(n)}</b> ${khusus ? `<span class="st-badge st-badge--warn">diubah khusus</span>` : `<span class="mr-sub">ikut peran</span>`}<small>${e(KET_MODUL[m] || "")}</small></div>
    <div class="pr-sg" role="group" aria-label="Akses ${e(n)}">${[0, 1, 2].map((l) => `<button type="button" data-pa="set" data-m="${m}" data-v="${l}" class="pr-lv pr-lv--${l}${v === l ? " is-on" : ""}"${l > t ? " disabled" : ""}>${NAMA_LEVEL[l]}</button>`).join("")}</div></div>`;
};
const gambar = () => { const el = $("#pa-isi"); if (!el) return; el.innerHTML = aktif().map(([m, n]) => baris(m, n)).join(""); const k = beda().length; $("#pa-hit").textContent = k ? `${k} perubahan belum disimpan` : "Belum ada perubahan"; $("#pa-simpan").disabled = !k; };
const beda = () => aktif().filter(([m]) => P.dipilih[m] !== P.awal[m]).map(([m]) => m);
export function bukaPanelAkses(ak, { sesudah } = {}) {
  P = { ak, sesudah, dasar: aksesPeranAkun(ak), awal: {}, dipilih: {} };
  MODUL.forEach(([m]) => { P.awal[m] = P.dipilih[m] = levelAkses(ak, m); });
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Akses ${e(ak.nama || ak.email)}</h2><p class="mr-sub">${e((ak.akses && ak.akses.jabatan) || PERAN[ak.peran] || ak.peran)}. Hanya membatasi; tidak bisa melebihi batas peran dasar.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi"><div id="pa-isi" class="pr-daftar-hal"></div><p class="mr-sub">Tidak = menu disembunyikan dan data ditolak. Lihat = hanya membaca. Kelola = membaca dan mengubah sesuai peran. Akun perlu masuk ulang agar menu ikut berubah.</p></div>
    <footer class="mr-panel__kaki dj-kaki"><span class="mr-sub" id="pa-hit">Belum ada perubahan</span><span class="mr-ruang"></span><button class="mr-btn" data-pa="reset">Kembalikan ke peran</button><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-pa="simpan" id="pa-simpan" disabled>Simpan</button></footer>`);
  gambar();
}
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-pa]"); if (!t || !P) return;
  if (t.dataset.pa === "set") { P.dipilih[t.dataset.m] = +t.dataset.v; return gambar(); }
  if (t.dataset.pa === "reset") { aktif().forEach(([m]) => { P.dipilih[m] = P.dasar[m]; }); return gambar(); }
  if (t.dataset.pa === "simpan") {
    const akses = {}; aktif().forEach(([m]) => { akses[m] = P.dipilih[m]; });
    const khusus = aktif().filter(([m]) => akses[m] !== P.dasar[m]).map(([m]) => m), j = P.ak.akses && P.ak.akses.jabatan;
    if (j) akses.jabatan = j; if (khusus.length) akses.khusus = khusus;
    t.disabled = true;
    try {
      await updateDoc(doc(db, "pengguna", P.ak.id), { akses }); await catatLogAkun({ uid: P.ak.id, email: P.ak.email }, "ubah", { akses: ringkas(P.awal) }, { akses: ringkas(P.dipilih) });
      P.ak.akses = akses; const s = P.sesudah; P.sesudah = null; tutupLayer(); toast("Akses diperbarui. Akun perlu masuk ulang agar menu ikut berubah."); if (s) s();
    } catch (err) { t.disabled = false; toast("Belum tersimpan: " + e(err.message || err), "bahaya"); }
  }
});
