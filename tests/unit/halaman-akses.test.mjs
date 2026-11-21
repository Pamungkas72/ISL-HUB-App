// Pengaman hak akses halaman: setiap halaman di navigasi (nav-config.js) wajib punya `modul` + `ket` (muncul otomatis di Pengaturan > Peran)
// atau `selalu: true`. Gagal bila halaman baru ditambahkan tanpa salah satunya, supaya tidak ada halaman yang lolos dari pengaturan hak.
import { navItems } from "../../public/js/nav-config.js";
let gagal = 0; const cek = (n, ok, c = "") => { if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : "- " + c); };
for (const i of navItems) {
  const ok = (typeof i.modul === "string" && /^[a-z]{2,4}$/.test(i.modul) && typeof i.ket === "string" && i.ket.length > 3) || i.selalu === true;
  cek(`halaman "${i.id}" punya modul+ket atau selalu`, ok, "tambahkan `modul: \"xx\"` dan `ket: \"...\"` (atau `selalu: true`) di nav-config.js");
}
const kunci = navItems.filter((i) => i.modul).map((i) => i.modul);
cek("kunci modul unik", new Set(kunci).size === kunci.length, kunci.join(","));
cek("id halaman unik", new Set(navItems.map((i) => i.id)).size === navItems.length);
cek("kunci lama tetap (mr, qt, cu, dj, lg): aturan Firestore memakainya", ["mr", "qt", "cu", "dj", "lg"].every((k) => kunci.includes(k)));
process.exit(gagal ? 1 : 0);
