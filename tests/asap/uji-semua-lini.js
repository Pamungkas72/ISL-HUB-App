// Uji perubahan UMUM pada semua jenis quotation: tanggal ringkas pada blok tanda tangan (PDF dan Word) untuk setiap format lini, format bebas (satuan/project), dan bahasa Inggris.
// Berjalan lokal: NODE_PATH=<folder node_modules berisi playwright> node tests/asap/uji-semua-lini.js
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
    window.__ISL = { email: profil.email, master: true, kelola: true, admin: false, sales: false, uid: 'u', peran: 'master', nama: 'master', hariIni: () => '2026-11-04', tulis: async (k, v) => { k(); }, unggahBlob: async () => '', diagnosa: async () => [], buatLini: async () => {}, simpanMarkupLini: async () => {}, tarifTambah: async () => ({}), navAktif: () => {} };
    window.__islMR = { tarif: [], vendor: [], lini: [{ id: 'depo', nama: 'Depo' }, { id: 'customs_clearance', nama: 'Customs Clearance' }], satuan: [], ref: {}, user: { email: profil.email } };
    window.__ISL_DATA = { customers: [{ id: 'c1', nama: 'PT Sinar Makmur Abadi', status: 'aktif', kontak: [], legalitas: [], alamat: 'Jakarta' }], rates: [], paket: [], orders: [], counters: [], layanan: [], quotations: [], templates: [], riwayat: [], pengaturan: null };
  });
  await p.addScriptTag({ content: fs.readFileSync(R + 'vendor/docx.iife.js', 'utf8') });
  for (const f of ['js/logo.js', 'js/formulir-lini.js', 'js/sales.js', 'js/app-core.js']) await p.addScriptTag({ content: fs.readFileSync(R + f, 'utf8') });
  await p.waitForTimeout(400);
  const kunci = await p.evaluate(() => window.ISLFL.daftar().map(l => l.key));
  const hasil = [];
  const kasus = [...kunci.map(k => ({ nama: 'lini:' + k, lini: k })), { nama: 'format bebas (satuan)', lini: '' }, { nama: 'format bebas (project)', lini: '', project: true }, { nama: 'format bebas English', lini: '', en: true }, { nama: 'depo English', lini: 'depo', en: true }];
  for (const k of kasus) {
    const r = await p.evaluate(async k => {
      window.__qt._Q.edit = null; window.__qt.baru('c1'); const e = window.__qt._Q.edit;
      if (k.lini) window.ISLFL.terapkanAwal(e, k.lini);
      else { e.baris = [{ id: 'b1', jenis: 'rate', urut: 0, liniKey: 'depo', liniNama: 'Depo', item: 'LOLO FULL', itemEn: '', deskripsi: '', satuan: 'per kontainer', qty: 2, jual: 150000, modal: 100000 }, { id: 'b2', jenis: 'rate', urut: 1, liniKey: 'customs_clearance', liniNama: 'CC', item: 'PIB', itemEn: '', deskripsi: '', satuan: 'per dokumen', qty: 1, jual: 500000, modal: 300000 }]; e.tipe = k.project ? 'project' : 'satuan'; }
      if (k.en) e.bahasa = 'en';
      e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Uji'; e.berlakuSampai = '2026-12-04';
      if (e.formLini) window.ISLFL.sinkron(e);
      const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]);
      const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 }), pg = h.pages[h.pages.length - 1], t = pg.querySelector('.isl-ttd');
      const o = { ringkas: m.tglRingkas === true, ttd: !!t, rC: t ? t.querySelectorAll('.rC').length : -1, rBt: t ? !!t.querySelector('.rBt .tgl i') : false, islTgl: t ? /Jakarta, \d/.test(t.querySelector('.col').textContent) : null, kepala: !!h.pages[0].querySelector('.isl-hd .n span'), tglLabel: t ? t.querySelector('.rBt .tgl') && t.querySelector('.rBt .tgl').textContent : '', kosong: h.pages.some(x => /Kolom kosong|Empty column/i.test(x.textContent)) };
      h.host.remove();
      // Word
      let word = 'ok'; try { const blob = await window.__qt._buatDocx(m, window.__qt._aset()); word = blob.size > 1000 ? 'ok' : 'kecil'; } catch (er) { word = 'galat: ' + er.message; }
      return { ...o, word };
    }, k);
    hasil.push({ kasus: k.nama, ...r });
  }
  const salah = hasil.filter(x => !(x.ringkas && x.ttd && x.rC === 0 && x.rBt && x.islTgl === false && x.kepala && x.word === 'ok' && !x.kosong));   /* catatan "Kolom kosong" sudah dihapus di semua lini */
  console.log(salah.length ? 'BERMASALAH: ' + JSON.stringify(salah) : 'Semua jenis quotation memakai tanggal ringkas dan tanpa catatan "Kolom kosong".', err.join('|') || '');
  await browser.close();
  process.exit(salah.length || err.length ? 1 : 0);
})();
