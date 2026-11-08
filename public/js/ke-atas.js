// ===========================================================
// KE ATAS — tombol panah di pojok kanan bawah, muncul setelah halaman digulir.
// Dipakai di semua halaman dalam app.html. Tidak bergantung pada modul lain.
// ===========================================================
(function () {
  var AMBANG_PX = 320; // tombol muncul setelah digulir sejauh ini
  var tombol = document.createElement("button");
  tombol.type = "button";
  tombol.className = "ke-atas";
  tombol.setAttribute("aria-label", "Kembali ke atas");
  tombol.title = "Kembali ke atas";
  tombol.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(tombol);

  function posisi() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }
  function perbarui() {
    tombol.classList.toggle("is-tampil", posisi() > AMBANG_PX);
  }
  tombol.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("scroll", perbarui, { passive: true });
  perbarui();
})();
