// ===========================================================
// VERSI — menampilkan kode commit dan waktu deploy di pojok kanan atas.
// Baris kedua ditimpa otomatis oleh workflow deploy (lihat .github/workflows/deploy-firebase.yml).
// Di komputer lokal tetap tertulis "lokal".
// ===========================================================
window.ISL_VERSI = "lokal";
(function () {
  function pasang() {
    var el = document.createElement("div");
    el.className = "isl-versi";
    el.textContent = "v " + window.ISL_VERSI;
    el.title = "Versi aplikasi yang sedang tayang";
    document.body.appendChild(el);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pasang);
  else pasang();
})();
