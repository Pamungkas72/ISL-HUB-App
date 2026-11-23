// Uji lini Open Yard (desain B, 23 Nov 2026): tabel sewa + total, layanan tambahan "Sesuai pemakaian", chip ketentuan, lampiran denah, dokumen English, migrasi S&K bawaan.
// Berjalan lokal: NODE_PATH=<folder node_modules berisi playwright> node tests/asap/uji-openyard.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', '..', 'public') + path.sep;
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.setContent(`<!doctype html><meta charset=utf-8><style>${['style', 'master-rate', 'app', 'tambahan'].map(f => fs.readFileSync(R + 'css/' + f + '.css', 'utf8')).join('')}</style><div id="sinkron-banner"></div><nav id="app-nav"></nav><div id="cu-root" class="hidden"></div><div id="qt-root"></div><div id="mr-layer"></div><div id="lp-root" class="hidden"></div><div id="lr-root" class="hidden"></div><div id="toasts"></div>`);
  await p.evaluate(() => {
    const profil = { uid: 'u', email: 'm@isl.test', peran: 'master', status: 'aktif', sembunyi: {} };
    window.__ISL_PROFIL = profil; window.__islSimpanProfil = async () => {};
    window.__ISL = { email: profil.email, master: true, kelola: true, admin: false, sales: false, uid: 'u', peran: 'master', nama: 'master', hariIni: () => '2026-11-04', tulis: async (k) => { k(); }, unggahBlob: async () => '', diagnosa: async () => [], buatLini: async () => {}, simpanMarkupLini: async () => {}, tarifTambah: async () => ({}), navAktif: () => {} };
    window.__islMR = { tarif: [], vendor: [], lini: [{ id: 'depo', nama: 'Depo' }], satuan: [], ref: {}, user: { email: profil.email } };
    window.__ISL_DATA = { customers: [{ id: 'c1', nama: 'PT Sinar Makmur Abadi', status: 'aktif', kontak: [], legalitas: [], alamat: 'Jakarta' }], rates: [], paket: [], orders: [], counters: [], layanan: [], quotations: [], templates: [], riwayat: [], pengaturan: null };
  });
  await p.addScriptTag({ content: fs.readFileSync(R + 'vendor/docx.iife.js', 'utf8') });
  for (const f of ['js/logo.js', 'js/formulir-lini.js', 'js/sales.js', 'js/app-core.js']) await p.addScriptTag({ content: fs.readFileSync(R + f, 'utf8') });
  await p.waitForTimeout(400);
  const hasil = await p.evaluate(async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const buat = async en => {
      window.__qt._Q.edit = null; window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'open_yard');
      const s = e.formLini.s; s.spek.nama = 'Open Yard Cikarang 1'; s.rows[0].jual = 45000; s.rows[1].on = true; s.rows[1].jual = 2500000; s.rows[2].on = true; s.luasSewa = '5000'; s.denah = [{ src: png, ket: 'Blok A' }];
      e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Uji'; e.berlakuSampai = '2026-12-04'; if (en) e.bahasa = 'en'; window.ISLFL.sinkron(e);
      const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]);
      const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 });
      const teks = h.pages.map(pg => pg.textContent).join(' | '), n = h.pages.length, lamp = !!h.pages[n - 1].querySelector('.isl-lamp img'), tot = !!h.pages[0].querySelector('.isl-kartu--oy tr.tot'), chip = h.pages[0].querySelectorAll('.isl-oychip span').length;
      h.host.remove(); return { teks, n, lamp, tot, chip };
    };
    const id = await buat(false), en = await buat(true);
    const lama = ['Deposit jaminan wajib dibayar sebelum lahan diserahterimakan.', 'Biaya listrik, air, dan layanan lain ditagihkan sesuai pemakaian atau realisasi.'];
    const pg = { tnc: [{ id: 'x1', kat: 'open_yard', kategori: 'lainnya', teks: { id: lama[0], en: '' }, aktif: true }, { id: 'x2', kat: 'open_yard', kategori: 'lainnya', teks: { id: 'Butir buatan pemilik.', en: '' }, aktif: true }], seedFL: 'v2' };
    const a = window.ISLFL.seedPengaturan(pg), jml = pg.tnc.filter(t => t.kat === 'open_yard').length, b = window.ISLFL.seedPengaturan(pg);
    return { id, en, mig: { a, b, jml, adaPemilik: pg.tnc.some(t => t.teks.id === 'Butir buatan pemilik.'), lamaHilang: !pg.tnc.some(t => t.teks.id === lama[0]) } };
  });
  const salah = [], cek = (k, m) => { if (!k) salah.push(m); };
  const { id, en, mig } = hasil;
  cek(id.n === 3 && id.lamp, `lampiran denah harus jadi halaman terakhir (halaman ${id.n}, lampiran ${id.lamp})`);
  cek(id.tot && id.chip === 4, `tabel sewa punya baris total dan 4 chip ketentuan (total ${id.tot}, chip ${id.chip})`);
  cek(/225\.000\.000/.test(id.teks) && /Sesuai pemakaian/.test(id.teks) && /Di muka, per 3 bulan/.test(id.teks), 'isi dokumen Indonesia: total 225.000.000, "Sesuai pemakaian", pembayaran');
  cek(/Total rent per month/.test(en.teks) && /Based on usage/.test(en.teks) && /ATTACHMENT: SITE PLAN/.test(en.teks) && /In advance, every 3 months/.test(en.teks) && /Minimum 12 months/.test(en.teks), 'dokumen English memuat terjemahan total, pemakaian, lampiran, pembayaran, masa sewa');
  const ID = /\b(yang|dan|atau|untuk|dengan|tarif|biaya|layanan|keterangan|satuan|syarat|ketentuan|harga|sesuai|tambahan|penawaran|dari|pada|hari|bulan|lahan|luas|jumlah|rincian|dihitung|ditagihkan|wajib|sewa|pemakaian|muka|denah|lampiran)\b/i;
  const sisa = en.teks.replace(/Open Yard Cikarang 1|PT Sinar Makmur Abadi|Sinar Makmur|Blok A|Budi|Jakarta[^|]*?(?=\s|$)|Jl\. [^|]*?(?=Dengan|$)/g, ' ').split(/[|.;:()\n]/).filter(x => ID.test(x));
  cek(!sisa.length, 'dokumen English masih memuat teks Indonesia: ' + sisa.slice(0, 4).join(' // '));
  cek(mig.a && !mig.b && mig.adaPemilik && mig.lamaHilang && mig.jml === 13, `migrasi S&K: sekali jalan, butir pemilik tetap, butir lama hilang, 12 baru + 1 pemilik (jml ${mig.jml}, a ${mig.a}, b ${mig.b})`);
  console.log(salah.length ? 'BERMASALAH:\n- ' + salah.join('\n- ') : 'Open Yard lolos (tabel B, chip, lampiran denah, English, migrasi S&K).', err.join('|') || '');
  await browser.close();
  process.exit(salah.length || err.length ? 1 : 0);
})();
