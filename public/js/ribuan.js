/* Pemisah ribuan langsung saat mengetik, untuk semua kolom uang (N-01). Kolom ukuran (luas m2, berat ton, tinggi) sengaja dikecualikan karena titik di sana bisa berarti desimal.
   Dipasang sekali di tingkat dokumen (fase capture) supaya nilai sudah rapi sebelum kode lain membacanya.
   Format Indonesia: titik untuk ribuan, koma untuk desimal (maksimal 2 digit). */
(function () {
  var SEL = 'input[data-fn="1"],input[data-ribuan-live],input[data-kf="modal"],input[data-kf="h"],input[data-kf="m"],input[data-kf="b"],input[data-kf="lolo"],input.mr-inline,#f-modal,#t-modal,[data-r="jual"],[data-r="modal"],[data-r="mgrp"],[data-t="jual"],[data-t="modal"],#qt-kurs,#rf-jual,#rf-modal,.cu-komp [data-f="jual"],.cu-komp [data-f="modal"],#pk-harga,#pk-modal,[data-trek],[data-tmin],[data-o="jual"],[data-o="modal"],[data-rk="jual"],[data-rk="modal"],[data-kr="jual"],[data-rw="nilai"],[data-akun="target"],#ak-target,#t-jsaran,#f-jsaran,#f-hjr,[data-kk="solar"],[data-kk="tol"],[data-kk="lain"],#kg-omzet';
  function rapikan(el) {
    var v = el.value; if (!v) return;
    var pos = el.selectionStart == null ? v.length : el.selectionStart, koma = v.indexOf(','), neg = /^\s*-/.test(v) ? '-' : '';
    var bulat = (koma >= 0 ? v.slice(0, koma) : v).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    var des = koma >= 0 ? v.slice(koma + 1).replace(/\D/g, '').slice(0, 2) : null;
    var f = neg + (bulat ? bulat.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : (koma >= 0 ? '0' : '')) + (des !== null ? ',' + des : '');
    if (f === v) return;
    var sebelum = v.slice(0, pos).replace(/[^\d,]/g, '').length;
    el.value = f;
    var n = 0, p = 0; for (; p < f.length && n < sebelum; p++) if (/[\d,]/.test(f[p])) n++;
    try { el.setSelectionRange(p, p); } catch (e) { /* abaikan */ }
  }
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t && t.tagName === 'INPUT' && t.matches(SEL) && t.getAttribute('data-ribuan-off') == null) rapikan(t);
  }, true);
})();
