// Panel "Akses per modul" untuk akun staf dan sales (master dan admin). Menyimpan pengguna.akses; ditegakkan di firestore.rules.
import { e, $, toast, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { db } from "./firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { MODUL, NAMA_LEVEL, BATAS_PERAN, levelAkses, catatLogAkun, PERAN } from "./akses.js";

let P = null; // { ak, dipilih: {mr,qt,...}, sesudah }
const ringkas = (a) => MODUL.filter(([m]) => (BATAS_PERAN[P.ak.peran] || {})[m] > 0).map(([m, n]) => `${n}: ${NAMA_LEVEL[a[m]]}`).join(", ");
const seg = (m, nilai, batas) => `<div class="ad-seg" data-pa-m="${m}">${[0, 1, 2].map((l) => `<button type="button" data-pa="set" data-m="${m}" data-v="${l}" class="${nilai === l ? "is-on" : ""}"${l > batas ? " disabled" : ""}>${NAMA_LEVEL[l]}</button>`).join("")}</div>`;
export function bukaPanelAkses(ak, { sesudah } = {}) {
  const batas = BATAS_PERAN[ak.peran] || {};
  P = { ak, sesudah, awal: {}, dipilih: {} };
  MODUL.forEach(([m]) => { P.awal[m] = P.dipilih[m] = levelAkses(ak, m); });
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Akses ${e(ak.nama || ak.email)}</h2><p class="mr-sub">${e(PERAN[ak.peran] || ak.peran)}. Pengaturan ini hanya membatasi; tidak bisa melebihi izin peran.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi">${MODUL.map(([m, n]) => (batas[m] > 0 ? `<div class="ad-akses"><span><b>${n}</b><small>${m === "mr" ? "Data tarif, vendor, lokasi, uang jalan" : m === "qt" ? "Quotation dan rate; juga membuka data tarif untuk harga" : m === "cu" ? "Daftar dan data customer" : m === "dj" ? "Job harian kelompoknya" : "Kontrak dan MOM"}</small></span>${seg(m, P.dipilih[m], batas[m])}</div>` : `<div class="ad-akses ad-akses--mati"><span><b>${n}</b><small>Tidak tersedia untuk peran ini</small></span></div>`)).join("")}
      <p class="mr-sub">Lihat = hanya membaca. Kelola = membaca dan mengubah sesuai peran. Akun perlu masuk ulang agar menu ikut berubah.</p></div>
    <footer class="mr-panel__kaki dj-kaki"><span class="mr-sub" id="pa-hit">Belum ada perubahan</span><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-pa="simpan" id="pa-simpan" disabled>Simpan</button></footer>`);
}
const beda = () => MODUL.filter(([m]) => P.dipilih[m] !== P.awal[m]).map(([m]) => m);
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-pa]"); if (!t || !P) return;
  if (t.dataset.pa === "set") {
    const m = t.dataset.m; P.dipilih[m] = +t.dataset.v; t.closest(".ad-seg").querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b === t));
    const n = beda().length; $("#pa-hit").textContent = n ? `${n} perubahan belum disimpan` : "Belum ada perubahan"; $("#pa-simpan").disabled = !n; return;
  }
  if (t.dataset.pa === "simpan") {
    const batas = BATAS_PERAN[P.ak.peran] || {}, akses = {}; MODUL.forEach(([m]) => { if (batas[m] > 0) akses[m] = P.dipilih[m]; });
    t.disabled = true;
    try {
      await updateDoc(doc(db, "pengguna", P.ak.id), { akses }); const dari = { akses: ringkas(P.awal) }, ke = { akses: ringkas(P.dipilih) };
      await catatLogAkun({ uid: P.ak.id, email: P.ak.email }, "ubah", dari, ke); P.ak.akses = akses; const s = P.sesudah; P.sesudah = null; tutupLayer(); toast("Akses diperbarui. Akun perlu masuk ulang agar menu ikut berubah."); if (s) s();
    } catch (err) { t.disabled = false; toast("Belum tersimpan: " + e(err.message || err), "bahaya"); }
  }
});
