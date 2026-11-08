// ===========================================================
// RIWAYAT — membuat tombol Kembali perangkat (HP / browser) bekerja per lapisan.
// Lapisan = panel samping, pratinjau, detail customer, editor quotation.
// Contoh: Quotation -> Pratinjau -> Kembali  =>  tutup pratinjau, tetap di Quotation.
//         Quotation (editor) -> Kembali      =>  ke daftar Quotation (bukan loncat ke halaman lain).
//
// Cara kerja: tiap kali ada lapisan baru terbuka, satu entri riwayat ditambahkan. Saat pengguna
// menekan Kembali, lapisan paling atas ditutup. Entri sisa (lapisan yang ditutup lewat tombol di
// layar) dibersihkan otomatis saat Kembali ditekan, jadi tidak perlu menekan Kembali dua kali.
//
// Halaman memanggil:
//   ISLNav.pasang({ lapisan: () => jumlah lapisan terbuka, tutup: () => tutup lapisan teratas (boleh async, true = berhasil) })
//   ISLNav.selaraskan()  // panggil setiap kali lapisan terbuka atau tertutup
// ===========================================================
const NAV = {
  depth: 0,        // jumlah entri riwayat milik kita yang sedang menumpuk di atas entri halaman
  hash: location.hash,
  ignore: 0,       // jumlah popstate buatan sendiri yang harus diabaikan
  pasangan: null,
  sibuk: false,

  pasang(p) { NAV.pasangan = p; },

  lapisan() { return NAV.pasangan ? Math.max(0, Number(NAV.pasangan.lapisan()) || 0) : 0; },

  selaraskan() {
    if (!NAV.pasangan) return;
    const perlu = NAV.lapisan();
    while (perlu > NAV.depth) {
      NAV.depth++;
      try { history.pushState({ isl: NAV.depth }, "", location.href); } catch (e) { /* abaikan */ }
    }
  },

  mundur(n) {
    if (n <= 0) return;
    NAV.ignore++;
    history.go(-n);
    setTimeout(() => { if (NAV.ignore > 0) NAV.ignore--; }, 800); // jaga-jaga kalau popstate tidak datang
  },

  async tekanKembali(ev) {
    if (NAV.ignore > 0) { NAV.ignore = 0; return; }
    if (location.hash !== NAV.hash) { // pindah halaman lewat menu / hash, bukan menutup lapisan
      NAV.hash = location.hash; NAV.depth = (ev.state && ev.state.isl) || 0; return;
    }
    const baru = (ev.state && ev.state.isl) || 0;
    if (baru >= NAV.depth) { NAV.depth = baru; return; } // maju atau sama: tidak diurus
    NAV.depth = baru;
    if (!NAV.pasangan) return;
    if (NAV.lapisan() === 0) { // tidak ada lapisan terbuka: ini entri sisa, lanjutkan mundur sampai keluar halaman
      NAV.mundur(NAV.depth + 1); NAV.depth = 0; return;
    }
    let ok = true;
    try { ok = (await NAV.pasangan.tutup()) !== false; } catch (e) { ok = false; }
    if (!ok) { // dibatalkan (mis. pengguna memilih tetap di draf): kembalikan entri yang baru dipakai
      NAV.depth = baru + 1; try { history.pushState({ isl: NAV.depth }, "", location.href); } catch (e) { /* abaikan */ }
      return;
    }
    const sisa = NAV.lapisan();
    if (NAV.depth > sisa) { NAV.mundur(NAV.depth - sisa); NAV.depth = sisa; }
  },
};

window.addEventListener("popstate", (ev) => NAV.tekanKembali(ev));
window.addEventListener("hashchange", () => { NAV.hash = location.hash; });
window.ISLNav = NAV;
export default NAV;
