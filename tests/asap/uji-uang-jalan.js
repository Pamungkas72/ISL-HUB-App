// Berjalan lokal: NODE_PATH=<folder node_modules berisi playwright> node tests/asap/uji-uang-jalan.js
// Uji menu Uang Jalan: rumus (BBM = jarak / rasio x solar, tol, TKBM, operasional, insentif mitra), master rute dan driver mengisi kalkulator,
// simpan ke riwayat, PDF slip, hapus dengan konfirmasi. Penyimpanan diganti memori (window.__islUJ).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..', 'public') + path.sep;
const gagal = []; const cek = (k, m) => { if (!k) gagal.push(m); };

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 390, height: 800 } }); const err = [];
  p.on('pageerror', e => err.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') err.push('CON ' + m.text().slice(0, 200)); });
  await p.setContent(`<!doctype html><meta charset=utf-8><style>${['style', 'master-rate', 'app', 'tambahan'].map(f => fs.readFileSync(R + 'css/' + f + '.css', 'utf8')).join('')}</style><div id="uj-root" class="app-content mr"></div>`);
  await p.addScriptTag({ content: fs.readFileSync(R + 'vendor/jspdf.umd.min.js', 'utf8') });
  await p.evaluate(() => {
    const dok = { uj_rute: {}, uj_driver: {}, uj_slip: {}, uj_pengaturan: {} };
    window.__tanya = []; window.__toast = [];
    window.__islCU = { toast: (h, j) => window.__toast.push(h), konfirmasi: async o => { window.__tanya.push(o.judul); return true; }, ik: () => '' };
    window.__islUJ = { muat: async () => ({ rute: Object.values(dok.uj_rute), driver: Object.values(dok.uj_driver), slip: Object.values(dok.uj_slip), peng: dok.uj_pengaturan.umum || null }), simpan: async (k, id, d) => { dok[k][id] = JSON.parse(JSON.stringify(d)); }, hapus: async (k, id) => { delete dok[k][id]; } };
    window.__dok = dok;
  });
  await p.addScriptTag({ content: fs.readFileSync(R + 'js/uang-jalan.js', 'utf8') });
  await p.evaluate(() => window.ISLUJ.mulai()); await p.waitForTimeout(300);
  const isi = (f, v) => p.evaluate(({ f, v }) => { const i = document.querySelector(`[data-uj="${f}"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, { f, v });
  const isiM = (f, v) => p.evaluate(({ f, v }) => { const i = document.querySelector(`[data-ujm="${f}"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, { f, v });
  const klik = sel => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const teks = sel => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  const tunggu = () => p.waitForTimeout(200);

  // 1. rumus: 120 km / 5 km per liter = 24 liter x 6.800 = 163.200; + tol 85.000 + operasional 50.000
  await isi('ruteNama', 'Jakarta – Cikarang'); await isi('jarak', '120'); await isi('rasio', '5'); await isi('tol', '85.000'); await isi('ops', '50.000');
  let t = await teks('#uj-total');
  cek(/298\.200/.test(t), 'rumus internal: 163.200 BBM + 85.000 tol + 50.000 operasional = 298.200: ' + t);
  cek(await p.evaluate(() => !document.querySelector('[data-uj="insentif"]')), 'driver internal tidak punya isian insentif');
  // 2. driver mitra: insentif ikut dihitung; rasio desimal
  await klik('[data-ujt="jenis"][data-x="mitra"]'); await tunggu(); await isi('insentif', '75.000');
  t = await teks('#uj-total'); cek(/373\.200/.test(t), 'mitra: insentif 75.000 ditambahkan = 373.200: ' + t);
  await isi('rasio', '4,5'); t = await teks('#uj-total'); cek(/Rp(\d|\.)+/.test(t) && !/373\.200/.test(t), 'rasio desimal dengan koma dipakai (4,5): ' + t);
  // 3. master rute dan driver
  await klik('[data-ujt="tab"][data-x="rute"]'); await tunggu(); await klik('[data-ujt="mtambah"][data-x="rute"]'); await tunggu();
  await isiM('nama', 'Jakarta – Bandung'); await isiM('jarak', '320'); await isiM('tol', '190000'); await isiM('ops', '60000'); await klik('[data-ujt="msimpan"]'); await tunggu();
  cek(await p.evaluate(() => Object.values(window.__dok.uj_rute).length === 1 && /Jakarta – Bandung/.test(document.querySelector('.uj-daftar').textContent)), 'master rute: tersimpan dan tampil di daftar');
  await klik('[data-ujt="mtambah"][data-x="rute"]'); await tunggu(); await isiM('nama', 'jakarta – bandung'); await klik('[data-ujt="msimpan"]'); await tunggu();
  cek(await p.evaluate(() => !document.querySelector('[data-ujg]').hidden && /sudah ada/.test(document.querySelector('[data-ujg]').textContent)), 'master rute: nama kembar ditolak'); await klik('[data-ujt="mbatal"]'); await tunggu();
  await klik('[data-ujt="tab"][data-x="driver"]'); await tunggu(); await klik('[data-ujt="mtambah"][data-x="driver"]'); await tunggu();
  await isiM('nama', 'Budi Santoso'); await klik('[data-ujt="mjenis"][data-x="mitra"]'); await tunggu(); await isiM('unit', 'CDE B 1234 XY'); await isiM('rasio', '6'); await isiM('insentif', '80000'); await klik('[data-ujt="msimpan"]'); await tunggu();
  cek(await p.evaluate(() => Object.values(window.__dok.uj_driver).some(d => d.nama === 'Budi Santoso' && d.jenis === 'mitra' && d.insentif === '80000')), 'master driver mitra tersimpan dengan insentif dan rasio');
  // 4. kalkulator terisi dari master
  await klik('[data-ujt="tab"][data-x="kalkulator"]'); await tunggu(); await klik('[data-ujt="jenis"][data-x="internal"]'); await klik('[data-ujt="jenis"][data-x="mitra"]'); await tunggu();
  await p.evaluate(() => { const s = document.querySelector('[data-ujs="ruteId"]'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await tunggu();
  await p.evaluate(() => { const s = document.querySelector('[data-ujs="driverId"]'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await tunggu();
  const v = await p.evaluate(() => Object.fromEntries(['jarak', 'rasio', 'tol', 'ops', 'insentif'].map(f => [f, document.querySelector(`[data-uj="${f}"]`).value])));
  cek(v.jarak === '320' && v.rasio === '6' && /190/.test(v.tol) && /60/.test(v.ops) && /80/.test(v.insentif), 'pilih rute dan driver mengisi jarak, rasio, tol, operasional, insentif: ' + JSON.stringify(v));
  t = await teks('#uj-total'); cek(/Rp/.test(t) && /\d/.test(t), 'total terhitung dari master: ' + t);
  // 320/6 = 53,33 L x 6.800 = 362.667 + 190.000 + 60.000 + 80.000 = 692.667
  cek(/692\.667/.test(t), 'total rute Bandung mitra = 692.667: ' + t);
  // 5. simpan dan riwayat; PDF
  await klik('[data-ujt="simpan"]'); await tunggu();
  const s1 = await p.evaluate(() => Object.values(window.__dok.uj_slip)); cek(s1.length === 1 && /^UJ-\d{6}-01$/.test(s1[0].nomor) && s1[0].total === 692667 && s1[0].driverNama === 'Budi Santoso', 'slip tersimpan: nomor UJ-yymmdd-01, total, driver: ' + JSON.stringify(s1.map(x => [x.nomor, x.total])));
  await isi('solar', '7.200'); await klik('[data-ujt="simpan"]'); await tunggu();
  cek(await p.evaluate(() => window.__dok.uj_pengaturan.umum && window.__dok.uj_pengaturan.umum.solar === 7200 && Object.values(window.__dok.uj_slip)[0].total > 692667), 'harga solar yang diubah ikut menghitung ulang dan disimpan sebagai bawaan berikutnya');
  await klik('[data-ujt="simpan"]'); await tunggu(); cek(await p.evaluate(() => Object.values(window.__dok.uj_slip).length === 1), 'simpan lagi memperbarui slip yang sama (tidak ganda)');
  const pdf = await p.evaluate(() => { const b = window.ISLUJ.buatPdf(Object.values(window.__dok.uj_slip)[0]); return { ukuran: b.size, tipe: b.type }; });
  cek(pdf.ukuran > 1500 && /pdf/.test(pdf.tipe), 'PDF slip terbentuk: ' + JSON.stringify(pdf));
  await klik('[data-ujt="tab"][data-x="riwayat"]'); await tunggu();
  cek(await p.evaluate(() => /UJ-\d{6}-01/.test(document.querySelector('.uj-daftar').textContent) && /Rp/.test(document.querySelector('.uj-daftar').textContent)), 'riwayat menampilkan slip dan totalnya');
  // 6. hapus dengan konfirmasi
  await klik('[data-ujt="shapus"]'); await tunggu();
  cek(await p.evaluate(() => window.__tanya.includes('Hapus slip?') && Object.values(window.__dok.uj_slip).length === 0), 'hapus slip meminta konfirmasi lalu terhapus');
  // 6b. komponen biaya buatan pemilik: muncul di kalkulator, ikut terhitung, masuk slip, bisa dibatasi jenis driver, bisa dihapus
  await klik('[data-ujt="tab"][data-x="kalkulator"]'); await tunggu(); await klik('[data-ujt="jenis"][data-x="internal"]'); await tunggu();
  await p.evaluate(() => { const x = document.querySelector('[data-ujs="ruteId"]'); x.value = ''; x.dispatchEvent(new Event('change', { bubbles: true })); }); await tunggu();
  await isi('ruteNama', 'Tes komponen'); await isi('jarak', '100'); await isi('rasio', '5'); await isi('solar', '6.000'); await isi('tol', ''); await isi('tkbm', ''); await isi('ops', ''); // BBM 20 L x 6.000 = 120.000
  cek(/120\.000/.test(await teks('#uj-total')), 'dasar komponen: total 120.000: ' + await teks('#uj-total'));
  await klik('[data-ujt="kmtambah"]'); await tunggu();
  cek(await p.evaluate(() => !!document.querySelector('.uj-formm [data-ujm="berlaku"]')), 'tombol + Tambah komponen biaya di kalkulator membuka form komponen');
  await isiM('nama', 'Uang parkir'); await isiM('bawaan', '20000'); await klik('[data-ujt="msimpan"]'); await tunggu();
  await klik('[data-ujt="mtambah"][data-x="komp"]'); await tunggu(); await isiM('nama', 'Uang inap'); await p.evaluate(() => { const b = document.querySelector('[data-ujm="berlaku"]'); b.value = 'mitra'; b.dispatchEvent(new Event('input', { bubbles: true })); }); await isiM('bawaan', '100000'); await klik('[data-ujt="msimpan"]'); await tunggu();
  cek(await p.evaluate(() => (window.__dok.uj_pengaturan.umum.komponen || []).map(c => c.nama + ':' + c.berlaku).join() === 'Uang parkir:semua,Uang inap:mitra'), 'komponen tersimpan di pengaturan dengan batas jenis driver');
  await klik('[data-ujt="tab"][data-x="kalkulator"]'); await tunggu();
  cek(await p.evaluate(() => !!document.querySelector('[data-ujx]') && document.querySelectorAll('[data-ujx]').length === 1), 'internal: hanya komponen "semua" yang tampil (Uang inap khusus mitra tersembunyi)');
  cek(/140\.000/.test(await teks('#uj-total')), 'nominal bawaan komponen (20.000) langsung ikut terhitung: ' + await teks('#uj-total'));
  await p.evaluate(() => { const i = document.querySelector('[data-ujx]'); i.value = '30.000'; i.dispatchEvent(new Event('input', { bubbles: true })); }); cek(/150\.000/.test(await teks('#uj-total')), 'komponen bisa diubah per slip: ' + await teks('#uj-total'));
  await p.evaluate(() => { const i = document.querySelector('[data-ujx]'); i.value = '20.000'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  cek(/140\.000/.test(await teks('#uj-total')) && /Uang parkir/.test(await teks('#uj-hasil')), 'komponen ikut terhitung dan tampil di rincian: ' + await teks('#uj-total'));
  await klik('[data-ujt="jenis"][data-x="mitra"]'); await tunggu(); await isi('insentif', '0');
  cek(await p.evaluate(() => document.querySelectorAll('[data-ujx]').length === 2), 'mitra: kedua komponen tampil');
  await klik('[data-ujt="jenis"][data-x="internal"]'); await tunggu(); await klik('[data-ujt="simpan"]'); await tunggu();
  const sx = await p.evaluate(() => Object.values(window.__dok.uj_slip).find(x => x.ruteNama === 'Tes komponen'));
  cek(sx && sx.total === 140000 && sx.baris.some(b => b.n === 'Uang parkir' && b.v === 20000), 'slip menyimpan komponen tambahan dan total 140.000: ' + JSON.stringify(sx && sx.baris.map(b => [b.n, b.v])));
  cek(await p.evaluate(() => window.ISLUJ.buatPdf(Object.values(window.__dok.uj_slip).find(x => x.ruteNama === 'Tes komponen')).size > 1500), 'PDF slip dengan komponen tambahan terbentuk');
  await klik('[data-ujt="tab"][data-x="komp"]'); await tunggu(); await p.evaluate(() => { const i = document.querySelector('[data-ujp="labelOps"]'); i.value = 'Biaya mel'; });
  await klik('[data-ujt="psimpan"]'); await tunggu(); cek(await p.evaluate(() => window.__dok.uj_pengaturan.umum.labelOps === 'Biaya mel'), 'nama biaya mel bisa diganti dan tersimpan');
  await klik('[data-ujt="mhapus"][data-x^="komp|"]'); await tunggu();
  cek(await p.evaluate(() => window.__tanya.includes('Hapus komponen?') && window.__dok.uj_pengaturan.umum.komponen.length === 1), 'hapus komponen meminta konfirmasi, slip lama tidak berubah');
  // 7. HP: tombol aksi bawah terlihat, tanpa scroll horizontal
  await klik('[data-ujt="tab"][data-x="kalkulator"]'); await tunggu();
  const hp = await p.evaluate(() => { const b = document.querySelector('.uj-bar').getBoundingClientRect(); return { bawah: b.bottom <= innerHeight, lebar: document.documentElement.scrollWidth <= innerWidth }; });
  cek(hp.bawah && hp.lebar, 'HP: bilah total dan tombol Bagikan PDF terlihat, tidak ada scroll horizontal: ' + JSON.stringify(hp));
  cek(err.length === 0, 'galat konsol: ' + err.join(' | '));
  await browser.close();
  if (gagal.length) { console.log('GAGAL Uang Jalan:\n- ' + gagal.join('\n- ')); process.exit(1); }
  console.log('Uang Jalan lolos: rumus internal dan mitra, master rute dan driver, simpan, riwayat, PDF, hapus, dan tampilan HP.');
})();
