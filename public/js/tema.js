// Tema tampilan (terang / gelap / otomatis ikut perangkat). Dimuat paling awal di <head> supaya tidak berkedip.
// Pilihan disimpan di browser perangkat ini. Dipakai semua halaman, jadi tampilannya seragam.
(function () {
  var K = "isl-tema", URUT = ["otomatis", "terang", "gelap"];
  function baca() { try { var v = localStorage.getItem(K); return URUT.indexOf(v) >= 0 ? v : "otomatis"; } catch (e) { return "otomatis"; } }
  function terap(v) {
    var r = document.documentElement;
    if (v === "terang") r.setAttribute("data-theme", "light");
    else if (v === "gelap") r.setAttribute("data-theme", "dark");
    else r.removeAttribute("data-theme");
  }
  terap(baca());
  window.ISLTema = {
    urut: URUT,
    baca: baca,
    set: function (v) { try { localStorage.setItem(K, v); } catch (e) { /* abaikan */ } terap(v); },
    berikut: function () { var v = URUT[(URUT.indexOf(baca()) + 1) % URUT.length]; window.ISLTema.set(v); return v; },
  };
})();
