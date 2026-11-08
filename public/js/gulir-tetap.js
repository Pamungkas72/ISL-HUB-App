// ===========================================================
// GULIR MENDATAR TETAP — tab, kartu KPI, pilihan jenis, tabel, dan bilah langkah yang bisa digeser
// ke samping tidak kembali ke kiri setiap kali halamannya dirender ulang. Posisi geser yang sedang
// lebih dari nol disimpan sebelum isi diganti, lalu dikembalikan pada elemen yang sama.
// Dipakai oleh render innerHTML (dipasang di bawah) dan render morph (nav.js).
// ===========================================================

// jalur indeks anak dari akar sampai elemen
const jalur = (akar, el) => {
  const p = [];
  let n = el;
  while (n && n !== akar) {
    const induk = n.parentElement;
    if (!induk) return null;
    p.unshift(Array.prototype.indexOf.call(induk.children, n));
    n = induk;
  }
  return n === akar ? p : null;
};
const ikuti = (akar, p) => {
  let n = akar;
  for (const i of p) { n = n && n.children[i]; if (!n) return null; }
  return n;
};

// jalankan kerja (render ulang) lalu kembalikan posisi geser seluruh bilah di dalam akar
export function gulirTetap(akar, kerja) {
  const simpan = [];
  akar.querySelectorAll("*").forEach((el) => {
    if (el.scrollLeft > 0) simpan.push({ p: jalur(akar, el), c: el.className, x: el.scrollLeft });
  });
  const hasil = kerja();
  simpan.forEach(({ p, c, x }) => {
    const el = p && ikuti(akar, p);
    if (el && el.className === c) el.scrollLeft = x;
  });
  return hasil;
}

(function pasangInnerHTML() {
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  if (!desc || !desc.set) return;
  Object.defineProperty(Element.prototype, "innerHTML", {
    configurable: true,
    enumerable: desc.enumerable,
    get: desc.get,
    set(html) { gulirTetap(this, () => desc.set.call(this, html)); },
  });
})();
