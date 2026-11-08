// Uji kop surat terkunci: posisi garis di bawah logo dan deskripsi kop harus SAMA untuk semua kerapatan tata letak (d0/d1/d2) dan semua isi deskripsi kop (alamat panjang, web, NPWP, kosong).
// Berjalan lokal: NODE_PATH=<folder node_modules berisi playwright> node tests/asap/uji-kop.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', '..', 'public') + path.sep;
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.setContent(`<!doctype html><meta charset=utf-8><style>${['style', 'master-rate', 'app', 'tambahan'].map(f => fs.readFileSync(R + 'css/' + f + '.css', 'utf8')).join('')}</style><div id="sinkron-banner"></div><nav id="app-nav"></nav><div id="cu-root" class="hidden"></div><div id="qt-root"></div><div id="mr-layer"></div><div id="lp-root" class="hidden"></div><div id="lr-root" class="hidden"></div><div id="toasts"></div>`);
  await p.evaluate(() => {
    const profil = { uid: 'u', email: 'm@isl.test', peran: 'master', status: 'aktif', sembunyi: {} };
    window.__ISL_PROFIL = profil; window.__islSimpanProfil = async () => {};
    window.__ISL = { email: profil.email, master: true, kelola: true, admin: false, sales: false, uid: 'u', peran: 'master', nama: 'master', hariIni: () => '2026-11-03', tulis: async (k, v) => { k(); }, unggahBlob: async () => '', diagnosa: async () => [], buatLini: async () => {}, simpanMarkupLini: async () => {}, tarifTambah: async () => ({}), navAktif: () => {} };
    window.__islMR = { tarif: [], vendor: [], lini: [{ id: 'depo', nama: 'Depo Container' }], satuan: [], ref: {}, user: { email: profil.email } };
    window.__ISL_DATA = { customers: [{ id: 'c1', nama: 'PT Sinar Makmur Abadi', status: 'aktif', kontak: [], legalitas: [], alamat: 'Jakarta' }], rates: [], paket: [], orders: [], counters: [], layanan: [], quotations: [], templates: [], riwayat: [], pengaturan: null };
  });
  for (const f of ['js/logo.js', 'js/formulir-lini.js', 'js/sales.js', 'js/app-core.js']) await p.addScriptTag({ content: fs.readFileSync(R + f, 'utf8') });
  await p.waitForTimeout(400);
  const model = await p.evaluate(() => {
    window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'depo'); const st = e.formLini.s;
    st.rows[0].forEach((r, i) => { r.h20 = 40000 + i * 5000; r.h40 = 55000 + i * 5000; }); st.rows[1].forEach((r, i) => { r.h20 = 150000 + i * 20000; r.h40 = 230000 + i * 20000; }); st.rows[2].forEach((r, i) => { r.h20 = 650000 + i * 50000; r.h40 = 900000 + i * 50000; }); st.rows[3].forEach((r, i) => { r.h20 = 350000 + i * 50000; r.h40 = 500000 + i * 50000; });
    e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Penawaran Tarif Depo Container'; e.berlakuSampai = '2026-12-03'; window.ISLFL.sinkron(e);
    return window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]);
  });
  const kopVar = {
    standar: {},
    panjang: { alamat: 'Jl. Sulawesi No.01, Kompleks Pergudangan Tanjung Priok Blok C-12, Kelurahan Kebon Bawang, Kecamatan Tanjung Priok, Jakarta Utara, DKI Jakarta 14320' },
    lengkap: { web: 'www.indosukseslogistik.com', npwp: '01.234.567.8-091.000', tagline: 'Container Yard, Warehousing, Transportation, Customs Clearance and Freight Forwarding' },
    kosong: { tagline: '', telp: '', email: '' }
  };
  const hasil = [];
  for (const [nm, kv] of Object.entries(kopVar)) for (const d of [0, 1, 2]) {
    const r = await p.evaluate(async ({ m, kv, d }) => {
      const mm = { ...m, kop: { ...m.kop, ...kv } };
      const h = await window.__qt._renderDok(mm, window.__qt._aset(), { watermark: '', densitas: d });
      await window.__qt._tungguGambar(h.host);
      const pg = h.pages[0], pr = pg.getBoundingClientRect(), g = pg.querySelector('.isl-kopA-garis').getBoundingClientRect(), kop = pg.querySelector('.isl-kopA').getBoundingClientRect(), lg = pg.querySelector('.isl-kopA .lg').getBoundingClientRect(), ki = pg.querySelector('.ki');
      const o = { garis: +(g.top - pr.top).toFixed(1), kopH: +kop.height.toFixed(1), logoH: +lg.height.toFixed(1), skala: ki.style.transform || '-', halaman: h.n };
      let l2 = null; if (h.pages[1]) { const k2 = h.pages[1].querySelector('.isl-kop2').getBoundingClientRect(); l2 = +(k2.bottom - h.pages[1].getBoundingClientRect().top).toFixed(1); }
      o.garis2 = l2; h.host.remove(); return o;
    }, { m: model, kv, d });
    hasil.push({ kop: nm, d, ...r });
  }
  const garis = new Set(hasil.map(x => x.garis)), g2 = new Set(hasil.filter(x => x.garis2 !== null).map(x => x.garis2));
  console.log('posisi garis halaman 1:', [...garis], '| garis halaman lanjutan:', [...g2], '| galat:', err.join('|') || '-');
  await browser.close();
  const salah = [];
  if (garis.size !== 1) salah.push('posisi garis halaman 1 berubah-ubah: ' + [...garis].join(', '));
  if (g2.size > 1) salah.push('posisi garis halaman lanjutan berubah-ubah: ' + [...g2].join(', '));
  hasil.forEach(x => { if (x.kopH !== 90 || x.logoH !== 72) salah.push(`ukuran kop berubah (${x.kop}, d${x.d}): tinggi ${x.kopH}, logo ${x.logoH}`); });
  if (err.length) salah.push('galat halaman: ' + err.join(' | '));
  console.log(salah.length ? 'GAGAL kop:\n- ' + salah.join('\n- ') : 'Kop terkunci: garis tetap di posisi yang sama pada semua kerapatan dan isi deskripsi.');
  process.exit(salah.length ? 1 : 0);
})();
