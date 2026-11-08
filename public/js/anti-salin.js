// ===========================================================
// ANTI-SALIN — teks di seluruh aplikasi (web dan aplikasi terpasang di HP) tidak bisa dipilih,
// disalin, atau ditekan lama untuk memunculkan menu salin.
// Kolom isian (input, textarea, contenteditable) tetap bisa diketik dan ditempel.
// ===========================================================
const isian = (el) => !!el && !!el.closest?.('input, textarea, select, [contenteditable="true"]');
const elemenDari = (t) => (t && t.nodeType === 1 ? t : t && t.parentElement);

["copy", "cut", "contextmenu", "selectstart", "dragstart"].forEach((jenis) => {
  document.addEventListener(jenis, (ev) => {
    if (!isian(elemenDari(ev.target))) ev.preventDefault();
  });
});
