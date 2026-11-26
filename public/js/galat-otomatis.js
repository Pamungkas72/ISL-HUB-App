// Peringatan galat, notifikasi kegagalan, dan banner (kecuali lonceng) hilang sendiri tanpa menekan X: 10 detik, 15 detik untuk yang penting (aturan pemilik, 25 dan 26 Nov 2026).
// Penting = banner peringatan/bahaya (.mr-banner--peringatan/--bahaya, .dj-alert--bahaya) atau atribut data-penting. Opt-out khusus: data-tetap (hanya untuk elemen yang bukan pemberitahuan).
// Berlaku di SEMUA halaman dan fitur, termasuk fitur yang akan datang: skrip ini mengamati DOM dan menangani elemen yang cocok dengan SEL.
// Fitur baru cukup memakai salah satu penanda: role="alert", class "galat-otomatis", atau atribut data-galat pada elemen pesan galatnya
// (atau memakai toast / .mr-galat / .login-error yang sudah ada). Elemen yang berisi tombol atau tautan aksi (mis. "Coba lagi") dianggap bagian
// dari halaman, bukan sekadar pemberitahuan, sehingga tidak dihilangkan. Setiap halaman HTML baru WAJIB memuat skrip ini (dijaga tes asap).
(function () {
  if (window.__galatOtomatis) return;
  window.__galatOtomatis = true;
  var LAMA = Number(window.__GALAT_MS) || 10000; // 10 detik; __GALAT_MS hanya untuk tes
  var LAMA_PENTING = Number(window.__GALAT_MS_PENTING) || (Number(window.__GALAT_MS) ? Number(window.__GALAT_MS) * 1.5 : 15000);
  var SEL = '[data-galat],[role="alert"],.galat-otomatis,.mr-galat,.login-error,.mr-toast,.ip-status.is-gagal,.mr-banner,.dj-alert,.qt-sb-banner';
  var PENTING = '.mr-banner--peringatan,.mr-banner--bahaya,.dj-alert--bahaya,[data-penting]';
  var TANDA = 'data-galat-lenyap';
  var gaya = document.createElement('style');
  gaya.textContent = '[' + TANDA + '="1"]{display:none !important}';
  (document.head || document.documentElement).appendChild(gaya);
  var timer = new WeakMap();

  function adaAksi(el) { return !!el.querySelector('button:not(.mr-toast__x):not(.qt-banner-x):not([aria-label^="Tutup"]), a[href], [data-aksi], [data-x]'); }
  function tampil(el) { return !el.hidden && !el.closest('[hidden]') && !el.classList.contains('hidden') && (el.textContent || '').trim().length > 0; }
  function lenyap(el) {
    timer.delete(el);
    if (!el.matches(SEL) || el.hasAttribute('data-tetap')) return; // penanda galat sudah dilepas kodenya (mis. banner berganti jenis)
    if (el.classList.contains('mr-toast') || el.hasAttribute('data-galat-hapus')) el.remove(); else el.setAttribute(TANDA, '1');
  }
  function periksa(el) {
    var t = timer.get(el);
    if (t) { clearTimeout(t); timer.delete(el); }
    if (!tampil(el)) { el.removeAttribute(TANDA); return; } // sudah disembunyikan oleh kodenya sendiri
    if (adaAksi(el) && !el.classList.contains('mr-toast')) return; // pesan dengan tombol aksi tetap tampil
    el.removeAttribute(TANDA); // isi atau status baru dari kode: tampil lagi dan hitung ulang
    timer.set(el, setTimeout(function () { lenyap(el); }, el.matches(PENTING) ? LAMA_PENTING : LAMA));
  }
  function dari(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    var ada = el && el.closest ? el.closest(SEL) : null;
    if (ada) periksa(ada);
  }
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      dari(m.target);
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        dari(n);
        if (n.querySelectorAll) n.querySelectorAll(SEL).forEach(periksa);
      });
    });
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'role', 'data-galat', 'data-penting'] });
  function awal() { document.querySelectorAll(SEL).forEach(periksa); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', awal); else awal();
})();
