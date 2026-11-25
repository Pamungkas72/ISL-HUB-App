// Peringatan galat hilang sendiri setelah 10 detik di semua halaman dan fitur (js/galat-otomatis.js). Di tes memakai 400 ms.
// Jalankan: NODE_PATH=<node_modules berisi playwright> node tests/asap/uji-galat-otomatis.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const PUBLIK = path.join(__dirname, '..', '..', 'public');
let gagal = 0; const cek = (n, ok, cat = '') => { if (!ok) gagal++; console.log(ok ? 'LULUS' : 'GAGAL', n, ok ? '' : '- ' + cat); };

// 1. Setiap halaman HTML (kecuali pengalih) wajib memuat skrip ini, supaya fitur dan halaman baru ikut aturan 10 detik.
fs.readdirSync(PUBLIK).filter((f) => f.endsWith('.html')).forEach((f) => {
  const h = fs.readFileSync(path.join(PUBLIK, f), 'utf8');
  if (h.includes('location.replace')) return; // halaman pengalih
  cek(`${f} memuat galat-otomatis.js`, h.includes('js/galat-otomatis.js'));
});

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent('<body><style>.hidden{display:none}</style><div id="w"></div></body>');
  await p.evaluate(() => { window.__GALAT_MS = 400; });
  await p.addScriptTag({ path: path.join(PUBLIK, 'js', 'galat-otomatis.js') });
  const tunggu = (ms) => p.waitForTimeout(ms);
  const tampil = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }, sel);
  const tambah = (html) => p.evaluate((h) => { document.getElementById('w').insertAdjacentHTML('beforeend', h); }, html);

  // .mr-galat yang dimunculkan lewat atribut hidden (pola form dan panel)
  await tambah('<p class="mr-galat" id="g1" hidden></p>');
  await p.evaluate(() => { const e = document.getElementById('g1'); e.textContent = 'Gagal menyimpan'; e.hidden = false; });
  await tunggu(150); cek('galat form tampil dulu', await tampil('#g1'));
  await tunggu(500); cek('galat form hilang sendiri', !(await tampil('#g1')));
  // pesan baru di elemen yang sama tampil lagi dan menghitung ulang
  await p.evaluate(() => { const e = document.getElementById('g1'); e.textContent = 'Gagal lagi'; e.hidden = false; });
  await tunggu(150); cek('galat baru tampil lagi', await tampil('#g1'));
  await tunggu(300); await p.evaluate(() => { document.getElementById('g1').textContent = 'Gagal ketiga'; });
  await tunggu(300); cek('hitungan ulang saat isi berganti', await tampil('#g1'));
  await tunggu(400); cek('hilang setelah hitungan ulang', !(await tampil('#g1')));

  // toast kegagalan dihapus
  await tambah('<div class="mr-toast mr-toast--bahaya" id="t1"><div class="mr-toast__isi">Ditolak server</div><button class="mr-toast__x">x</button></div>');
  await tunggu(600); cek('toast kegagalan hilang sendiri', (await p.$('#t1')) === null);

  // pola login (class hidden)
  await tambah('<div class="login-error hidden" id="l1"></div>');
  await p.evaluate(() => { const e = document.getElementById('l1'); e.textContent = 'Sandi salah'; e.classList.remove('hidden'); });
  await tunggu(150); cek('galat login tampil', await tampil('#l1'));
  await tunggu(500); cek('galat login hilang sendiri', !(await tampil('#l1')));
  await p.evaluate(() => { const e = document.getElementById('l1'); e.textContent = 'Email tidak terdaftar'; e.classList.remove('hidden'); });
  await tunggu(150); cek('galat login berikutnya tampil lagi', await tampil('#l1'));

  // penanda untuk fitur masa depan
  await tambah('<div role="alert" id="r1">Kendala baru</div><div data-galat id="r2">Kendala lain</div><div class="galat-otomatis" id="r3">Satu lagi</div>');
  await tunggu(150); cek('role=alert tampil dulu', await tampil('#r1'));
  await tunggu(500);
  cek('role=alert hilang sendiri', !(await tampil('#r1')));
  cek('data-galat hilang sendiri', !(await tampil('#r2')));
  cek('class galat-otomatis hilang sendiri', !(await tampil('#r3')));

  // pesan dengan tombol aksi tetap tampil; teks biasa tidak disentuh
  await tambah('<div class="mr-galat" id="a1">Data gagal dimuat <button>Coba lagi</button></div><p id="n1">Catatan biasa</p>');
  await tunggu(700);
  cek('galat dengan tombol aksi tetap tampil', await tampil('#a1'));
  cek('teks biasa tidak disentuh', await tampil('#n1'));

  // banner sinkron: jenis gagal hilang, jenis lain tidak dihitung dengan timer lama
  await tambah('<div id="sk" data-galat>Gagal memperbarui</div>');
  await tunggu(150); await p.evaluate(() => { const e = document.getElementById('sk'); e.removeAttribute('data-galat'); e.textContent = 'Memperbarui…'; });
  await tunggu(600); cek('banner yang berganti jenis tidak ikut disembunyikan', await tampil('#sk'));

  await b.close();
  console.log(gagal ? `${gagal} gagal` : 'semua lulus'); process.exit(gagal ? 1 : 0);
})();
