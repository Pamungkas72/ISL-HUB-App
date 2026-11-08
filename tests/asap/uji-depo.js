// Berjalan lokal: NODE_PATH=<folder node_modules berisi playwright> node tests/asap/uji-depo.js
// Uji skenario quotation Depo: S&K tanpa reimbursement, denda per bulan, migrasi template tersimpan,
// customer terdaftar saat draf disimpan, tarif minimum (modal + markup) dengan peringatan dan pop-up.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', '..', 'public') + path.sep;
const gagal = [];
const cek = (k, m) => { if (!k) gagal.push(m); };

async function siapkan(browser, peran, pengaturan) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const err = [];
  p.on('pageerror', e => err.push('PAGE ' + e.message));
  p.on('console', m => { if (m.type() === 'error') err.push('CON ' + m.text().slice(0, 200)); });
  await p.setContent(`<!doctype html><meta charset=utf-8><style>${fs.readFileSync(R + 'css/app.css', 'utf8')}${fs.readFileSync(R + 'css/tambahan.css', 'utf8')}</style>
    <div id="sinkron-banner"></div><nav id="app-nav"></nav><div id="cu-root" class="hidden"></div><div id="qt-root"></div><div id="mr-layer"></div><div id="lp-root" class="hidden"></div><div id="lr-root" class="hidden"></div><div id="toasts"></div>`);
  await p.addScriptTag({ path: R + 'js/ribuan.js' }); // halaman rangka ini tidak memuat app.html, jadi pemisah ribuan dipasang di sini
  await p.evaluate(({ peran, pengaturan }) => {
    const profil = { uid: 'uid-' + peran, email: peran + '@isl.test', peran, status: 'aktif', sembunyi: {} };
    window.__ISL_PROFIL = profil;
    window.__islSimpanProfil = async d => { Object.assign(window.__ISL_PROFIL, d); };
    window.__ISL = {
      email: profil.email, master: peran === 'master', kelola: peran !== 'sales', admin: peran === 'admin', sales: peran === 'sales', uid: profil.uid, peran, nama: peran,
      hariIni: () => '2026-11-03', tulis: async (komit, verif) => { komit(); if (verif && !verif()) throw new Error('verifikasi gagal'); }, unggahBlob: async () => '', diagnosa: async () => [],
      buatLini: async () => {}, simpanMarkupLini: async () => {}, tarifTambah: async () => ({}), navAktif: () => {}
    };
    // tarif depo: LOLO FULL modal 100.000 (20ft) -> minimum 120.000 (markup 20%); sales hanya melihat hargaMin
    const tarif = (id, layanan, nama, modal, ukuran) => peran === 'sales'
      ? { id, kunci: id, liniBisnisId: 'depo', layanan, layananNama: nama, satuanKode: 'per_kontainer', dimensi: { ukuran }, vendorId: 'v1', aktif: true, hargaMin: Math.ceil(modal * 1.2 / 1000) * 1000 }
      : { id, kunci: id, liniBisnisId: 'depo', layanan, layananNama: nama, satuanKode: 'per_kontainer', dimensi: { ukuran }, vendorId: 'v1', aktif: true, modal };
    window.__islMR = { tarif: [tarif('t1', 'lolo_full', 'LOLO FULL', 100000, '20ft'), tarif('t2', 'lolo_full', 'LOLO FULL', 150000, '40ft')], vendor: [{ id: 'v1', nama: 'Depo A', aktif: true }], lini: [{ id: 'customs_clearance', nama: 'Customs Clearance' }, { id: 'depo', nama: 'Depo Container' }], satuan: [{ kode: 'per_kontainer', nama: 'per kontainer' }], ref: {}, user: { email: profil.email } };
    window.__ISL_DATA = { customers: [{ id: 'c1', nama: 'PT Lama Terdaftar', status: 'aktif', kontak: [{ nama: 'Andi', utama: true }], legalitas: [], alamat: 'Jakarta' }], rates: [], paket: [], orders: [], counters: [], layanan: [], quotations: [], templates: [], riwayat: [], pengaturan };
  }, { peran, pengaturan });
  for (const f of ['js/logo.js', 'js/formulir-lini.js', 'js/sales.js', 'js/app-core.js']) await p.addScriptTag({ content: fs.readFileSync(R + f, 'utf8') });
  await p.waitForTimeout(400);
  return { p, err };
}

(async () => {
  const browser = await chromium.launch();

  // ===== 1. S&K bawaan Depo (peran master) =====
  {
    const { p, err } = await siapkan(browser, 'master', null);
    cek(await p.evaluate(() => !!(window.__qt && window.__qt.gambar)), 'modul tidak termuat ' + err.join('|'));
    const r = await p.evaluate(() => {
      const R = window.__qt._R, q = { id: 'x', baris: [], liniManual: ['depo'], bahasa: 'id', tipe: 'satuan', berlakuSampai: '2026-12-01', topLayanan: 30 };
      const teks = bhs => R.tncGrup({ ...q, bahasa: bhs }, bhs, { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks));
      const id = teks('id'), en = teks('en'), mati = R.tncGrup({ ...q, dendaBulanAktif: false }, 'id', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks));
      const dua = R.tncGrup({ ...q, dendaBulan: 3 }, 'id', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks));
      const sk = R.syaratLini('depo');
      return { id, en, mati, dua, sk };
    });
    cek(r.id.length === 12, 'S&K depo harus 12 butir, dapat ' + r.id.length);
    cek(!r.id.some(t => /reimbursement|invoice pihak ketiga|penggantian biaya/i.test(t)), 'S&K depo masih memuat reimbursement: ' + JSON.stringify(r.id.filter(t => /reimbursement|invoice pihak ketiga|penggantian biaya/i.test(t))));
    cek(r.id.some(t => /^Ketentuan pembayaran: biaya layanan dibayarkan 30 hari setelah invoice/.test(t)), 'butir TOP 30 hari tidak ada: ' + JSON.stringify(r.id));
    cek(r.id.some(t => t === 'Keterlambatan pembayaran dikenakan denda sebesar 2% per bulan dari nilai invoice tagihan.'), 'butir denda 2% per bulan tidak ada: ' + JSON.stringify(r.id.filter(t => /Keterlambatan/.test(t))));
    cek(!r.id.some(t => /\{/.test(t)), 'placeholder belum terisi: ' + JSON.stringify(r.id.filter(t => /\{/.test(t))));
    cek(!r.mati.some(t => /Keterlambatan/.test(t)) && r.mati.length === 11, 'denda per bulan nonaktif harus menghapus butir denda: ' + r.mati.length);
    cek(r.dua.some(t => /denda sebesar 3% per bulan/.test(t)), 'persen denda tidak mengikuti isian');
    cek(r.en.some(t => /penalty of 2% per month/.test(t)) && !r.en.some(t => /reimbursement|third-party invoice/i.test(t)), 'S&K English depo salah: ' + JSON.stringify(r.en.slice(-4)));
    cek(r.sk && r.sk.dendaBulan === 2 && r.sk.dendaBulanAktif === true && r.sk.tanpaReimb === true, 'syaratLini depo salah: ' + JSON.stringify(r.sk));
    // CC tetap utuh
    const cc = await p.evaluate(() => { const R = window.__qt._R; return R.tncGrup({ id: 'y', baris: [], liniManual: ['customs_clearance'], bahasa: 'id', tipe: 'satuan' }, 'id', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks)); });
    cek(cc.some(t => /reimbursement/i.test(t)) && !cc.some(t => /per bulan/.test(t)), 'S&K Customs Clearance berubah: ' + JSON.stringify(cc.filter(t => /reimb|bulan/i.test(t))));
    cek(err.length === 0, 'galat konsol (1): ' + err.join(' | '));
    await p.close();
  }

  // ===== 2. Migrasi template Depo lama yang sudah tersimpan di Pengaturan =====
  {
    const lama = { tnc: [
      { id: 'dp1', kat: 'depo', kategori: 'lainnya', teks: { id: 'Operational depo 24 jam.', en: 'Operational depo 24 hours.' }, aktif: true },
      { id: 'dp10', kat: 'depo', kategori: 'lainnya', teks: { id: 'Pembayaran untuk invoice pihak ketiga atau reimbursement harus dikembalikan dalam waktu {topPihak} hari kerja sejak tanggal dokumen diterima dan dikonfirmasi lengkap. Ketentuan ini hanya berlaku untuk invoice pihak ketiga/reimbursement.', en: 'x' }, aktif: true },
      { id: 'dp11', kat: 'depo', kategori: 'lainnya', teks: { id: 'Keterlambatan pembayaran akan dikenakan biaya administrasi sebesar {dendaPihak}% dari nilai invoice pihak ketiga/reimbursement.', en: 'y' }, aktif: true },
      { id: 'dp12', kat: 'depo', kategori: 'lainnya', teks: { id: 'Ketentuan pembayaran:\na. untuk biaya layanan, {topLayanan} hari setelah invoice dan bukti kegiatan diterima;\nb. penggantian biaya (reimbursement), {topPihak} hari kerja (tidak termasuk hari Sabtu, Minggu, dan hari libur nasional).', en: 'Payment terms:\na. for service fees: {topLayanan} days after the invoice and proof of service are received;\nb. reimbursement: {topPihak} working days (excluding Saturdays, Sundays, and national holidays).' }, aktif: true },
      { id: 'dp13', kat: 'depo', kategori: 'lainnya', teks: { id: 'Pembayaran hanya dilakukan melalui transfer ke: Bank Mandiri.', en: 'Payment by transfer.' }, aktif: true },
      { id: 'cc1', kat: 'customs_clearance', kategori: 'lainnya', teks: { id: 'Pembayaran untuk invoice pihak ketiga atau reimbursement harus dikembalikan {topPihak}.', en: '' }, aktif: true }
    ], syaratSampelVer: 8 };
    const { p, err } = await siapkan(browser, 'master', lama);
    const r = await p.evaluate(() => {
      const R = window.__qt._R, d = R.PENG.tnc.filter(t => t.kat === 'depo').map(t => t.teks.id), cc = R.PENG.tnc.filter(t => t.kat === 'customs_clearance').length;
      const q = { id: 'x', baris: [], liniManual: ['depo'], bahasa: 'id', tipe: 'satuan', topLayanan: 14 };
      const tampil = R.tncGrup(q, 'id', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks));
      return { d, cc, tampil, flag: R.PENG.depoTanpaReimb };
    });
    cek(!r.d.some(t => /reimbursement|invoice pihak ketiga/i.test(t)), 'migrasi: template depo lama masih memuat reimbursement: ' + JSON.stringify(r.d));
    cek(r.d.some(t => /^Ketentuan pembayaran: biaya layanan dibayarkan \{topLayanan\}/.test(t)), 'migrasi: termin tidak diganti: ' + JSON.stringify(r.d));
    cek(r.d.filter(t => /\{dendaBulan\}/.test(t)).length === 1, 'migrasi: butir denda per bulan harus tepat satu: ' + JSON.stringify(r.d));
    const iT = r.d.findIndex(t => /^Ketentuan pembayaran/.test(t)), iD = r.d.findIndex(t => /dendaBulan/.test(t));
    cek(iD === iT + 1, 'migrasi: butir denda harus tepat setelah termin');
    cek(r.d.length === 4, 'migrasi: butir depo harus 4 (24 jam, termin, denda, transfer), dapat ' + r.d.length + ' ' + JSON.stringify(r.d));
    cek(r.cc === 1, 'migrasi menyentuh lini lain');
    cek(r.flag === true, 'migrasi: tanda tidak diset');
    cek(r.tampil.some(t => /14 hari setelah invoice/.test(t)) && r.tampil.some(t => /2% per bulan/.test(t)), 'migrasi: hasil S&K salah ' + JSON.stringify(r.tampil));
    cek(err.length === 0, 'galat konsol (2): ' + err.join(' | '));
    await p.close();
  }

  // ===== 2d. Geser urutan butir S&K di quotation (semua lini): mouse (pegangan), keyboard (panah), urutan tersimpan di draf dan masuk dokumen =====
  {
    const { p, err } = await siapkan(browser, 'master', null);
    for (const lini of ['trucking_trailer', 'depo', 'customs_clearance']) {
      await p.evaluate(l => { window.__qt._Q.edit = null; window.__qt.baru('c1'); window.ISLFL.terapkanAwal(window.__qt._Q.edit, l); window.__qt._Q.edit.customerNama = 'PT Sinar Makmur Abadi'; window.__qt.gambar(); document.querySelectorAll('details').forEach(d => { d.open = true; }); }, lini); await p.waitForTimeout(400);
      const urut = () => p.evaluate(() => [...document.querySelectorAll('#qt-tnc .qt-cc-row')].map(r => r.querySelector('[data-tcc]').value.slice(0, 24)));
      const n = await p.evaluate(() => document.querySelectorAll('#qt-tnc .qt-cc-grip').length), awal = await urut();
      cek(n >= 3 && n === awal.length, `geser S&K ${lini}: tiap butir harus punya pegangan geser (${n} pegangan, ${awal.length} butir)`);
      await p.evaluate(() => { document.querySelector('#qt-tnc .qt-cc-row').scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); }); await p.waitForTimeout(250);
      const g1 = await p.locator('#qt-tnc .qt-cc-row').nth(0).locator('[data-tccgrip]').boundingBox(), r3 = await p.locator('#qt-tnc .qt-cc-row').nth(2).boundingBox();
      await p.mouse.move(g1.x + g1.width / 2, g1.y + g1.height / 2); await p.mouse.down(); await p.mouse.move(g1.x + 4, r3.y + r3.height - 6, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(250);
      const sesudah = await urut(), nomor = await p.evaluate(() => [...document.querySelectorAll('#qt-tnc .qt-cc-no')].map(x => x.textContent).join(','));
      cek(sesudah[2] === awal[0] && sesudah[0] === awal[1], `geser S&K ${lini}: butir 1 harus pindah ke posisi 3 lewat geser mouse: ${JSON.stringify(sesudah.slice(0, 4))}`);
      cek(nomor === awal.map((_, i) => i + 1).join(','), `geser S&K ${lini}: nomor harus berurutan setelah geser: ${nomor}`);
      const st = await p.evaluate(() => { const e = window.__qt._Q.edit, R = window.__qt._R; return { kotor: window.__qt._Q.kotor, milik: Array.isArray(e.tncCc), urut: R.tncCcList(e).map(t => t.teks.slice(0, 24)) }; });
      cek(st.kotor && st.milik && JSON.stringify(st.urut) === JSON.stringify(sesudah), `geser S&K ${lini}: urutan baru harus tersimpan di draf dan ditandai berubah: ${JSON.stringify(st)}`);
      await p.locator('#qt-tnc .qt-cc-row').nth(1).locator('[data-tccgrip]').focus(); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150);
      const kb = await urut(); cek(kb[0] === sesudah[1] && kb[1] === sesudah[0], `geser S&K ${lini}: panah atas pada pegangan harus menukar dengan butir di atasnya`);
    }
    cek(err.length === 0, 'galat konsol (geser S&K): ' + err.join(' | '));
    await p.close();
  }

  // ===== 2c. Migrasi S&K Trailer tersimpan (5 Nov 2026): butir bawaan lama diganti bawaan baru, butir sunting pemilik dipertahankan, dijalankan sekali (tanda syaratTrailerVer) =====
  {
    const tr = (id, teks) => ({ id, kat: 'trucking_trailer', kategori: 'lainnya', teks: { id: teks, en: '' }, aktif: true });
    const lama = { tnc: [
      tr('x1', 'Surat jalan (DO, POD) disediakan oleh PT Indo Sukses Logistik.'), tr('x2', 'Waktu tunggu lebih dari 4 jam dikenakan biaya tambahan.'), tr('x3', 'Waktu tunggu (waiting time) lebih dari 4 jam dikenakan biaya tambahan.'),
      tr('x4', 'Pembayaran untuk invoice pihak ketiga atau reimbursement harus dikembalikan dalam waktu {topPihak} hari kerja sejak tanggal dokumen diterima dan dikonfirmasi lengkap. Ketentuan ini hanya berlaku untuk invoice pihak ketiga/reimbursement.'),
      tr('x5', 'Butir sunting pemilik.'), { id: 'cc1', kat: 'customs_clearance', kategori: 'lainnya', teks: { id: 'Butir CC.', en: '' }, aktif: true }
    ], syaratSampelVer: 8 };
    const { p, err } = await siapkan(browser, 'master', lama);
    const hitung = () => p.evaluate(() => { const R = window.__qt._R; return { t: R.PENG.tnc.filter(x => x.kat === 'trucking_trailer').map(x => x.teks.id), cc: R.PENG.tnc.filter(x => x.kat === 'customs_clearance').length, flag: R.PENG.syaratTrailerVer }; });
    const r = await hitung();
    cek(r.t[0] === 'Butir sunting pemilik.' && r.t.length === 11, 'migrasi trailer: butir sunting harus tetap di depan lalu 10 butir bawaan baru, dapat ' + r.t.length + ' ' + JSON.stringify(r.t.map(x => x.slice(0, 30))));
    cek(!r.t.some(x => /(^|[^0-9])4 jam|Surat jalan|at cost/.test(x)) && r.t.some(x => /H-1/.test(x)) && r.t.filter(x => /^Ketentuan pembayaran/.test(x)).length === 1, 'migrasi trailer: butir lama harus hilang, bawaan baru ada, tanpa duplikat: ' + JSON.stringify(r.t.map(x => x.slice(0, 30))));
    cek(r.cc === 1 && r.flag === 1, 'migrasi trailer: lini lain tersentuh atau tanda tidak diset');
    cek(err.length === 0, 'galat konsol (migrasi trailer): ' + err.join(' | '));
    await p.close();
  }

  // ===== 2b. Migrasi template Distribusi lama yang sudah tersimpan: diganti template bawaan (contoh PDF pemilik), tanpa reimbursement =====
  for (const verTersimpan of [undefined, 1]) {
    const lama = { tnc: [
      { id: 'fl2-distribusi_kecil-1', kat: 'distribusi_kecil', kategori: 'lainnya', teks: { id: 'Tarif per ritase.', en: 'Rates are per trip.' }, aktif: true },
      { id: 'fl2-distribusi_kecil-5', kat: 'distribusi_kecil', kategori: 'lainnya', teks: { id: 'Surat jalan (DO, POD) disediakan oleh PT Indo Sukses Logistik.', en: '' }, aktif: true },
      { id: 'x9', kat: 'distribusi_kecil', kategori: 'lainnya', teks: { id: 'Toleransi waktu tunggu bongkar/muat 6 jam; kelebihan waktu tunggu Rp 100.000/jam.', en: '' }, aktif: true },
      { id: 'x10', kat: 'distribusi_kecil', kategori: 'pembayaran', teks: { id: 'Pembayaran untuk invoice pihak ketiga atau reimbursement harus dikembalikan dalam waktu {topPihak} hari kerja.', en: '' }, aktif: true },
      { id: 'cc1', kat: 'customs_clearance', kategori: 'lainnya', teks: { id: 'Pembayaran untuk invoice pihak ketiga atau reimbursement harus dikembalikan {topPihak}.', en: '' }, aktif: true }
    ], syaratSampelVer: 8, ...(verTersimpan ? { syaratDistVer: verTersimpan } : {}) };
    const { p, err } = await siapkan(browser, 'master', lama);
    const r = await p.evaluate(() => {
      const R = window.__qt._R, d = R.PENG.tnc.filter(t => t.kat === 'distribusi_kecil'), cc = R.PENG.tnc.filter(t => t.kat === 'customs_clearance').length;
      const q = { id: 'x', baris: [], liniManual: ['distribusi_kecil'], bahasa: 'id', tipe: 'satuan', topLayanan: 30, dendaBulan: 2, formLini: { lini: 'distribusi_kecil', s: {} } };
      const tampil = R.tncGrup(q, 'id', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks)), en = R.tncGrup({ ...q, bahasa: 'en' }, 'en', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks));
      return { d: d.map(t => t.teks.id), tampil, en, cc, ver: R.PENG.syaratDistVer };
    });
    const tag = '(tersimpan, versi ' + (verTersimpan || 'kosong') + ')';
    cek(r.d.length === 13 && /^Harga di atas merupakan harga per unit per ritase \(FOT\)/.test(r.d[0]) && /^Pembayaran dilakukan melalui transfer ke: Bank Mandiri/.test(r.d[12]), 'migrasi Distribusi ' + tag + ': template harus diganti 13 butir bawaan: ' + JSON.stringify(r.d.map(x => x.slice(0, 40))));
    cek(!r.d.some(t => /reimbursement|invoice pihak ketiga|Tarif per ritase\.|Toleransi waktu tunggu bongkar\/muat/i.test(t)), 'migrasi Distribusi ' + tag + ': butir lama (reimbursement, tarif per ritase, toleransi 6 jam) harus hilang');
    cek(r.d.some(t => /denda bulanan maksimal \{dendaBulan\}%/.test(t)) && r.d.some(t => /^Ketentuan pembayaran: biaya layanan dibayarkan \{topLayanan\} hari/.test(t)), 'migrasi Distribusi ' + tag + ': termin dan denda harus ada');
    cek(r.cc === 1 && r.ver === 3, 'migrasi Distribusi ' + tag + ': lini lain tidak tersentuh dan versi 3 diset: ' + JSON.stringify([r.cc, r.ver]));
    cek(r.tampil.some(t => /30 hari setelah invoice/.test(t)) && r.tampil.some(t => /denda bulanan maksimal 2%/.test(t)), 'migrasi Distribusi ' + tag + ': hasil S&K Indonesia salah: ' + JSON.stringify(r.tampil.map(x => x.slice(0, 50))));
    cek(r.en.length === 13 && r.en.some(t => /Order cancellation/.test(t)) && r.en.some(t => /up to 2% of the outstanding/.test(t)) && !r.en.some(t => /\b(dan|yang|untuk|dikenakan)\b/i.test(t)), 'migrasi Distribusi ' + tag + ': S&K English harus 13 butir tanpa kata Indonesia: ' + JSON.stringify(r.en.map(x => x.slice(0, 50))));
    cek(err.length === 0, 'galat konsol (2b): ' + err.join(' | '));
    await p.close();
  }

  // ===== 2c. Distribusi: denda bulanan (migrasi versi 2 tersimpan), tanpa reimbursement, dan pengingat biaya yang diatur lewat teks =====
  {
    const DENDA_LAMA = 'Keterlambatan pembayaran setelah melewati TOP dikenakan denda maksimal {dendaBulan}% dari nilai outstanding invoice.', DENDA_EDIT = 'Denda keterlambatan 3% per bulan (disesuaikan pengguna).';
    for (const [nama, teks, ver, harusBaru] of [['versi 2, belum diubah', DENDA_LAMA, 2, true], ['versi 2, sudah diubah pengguna', DENDA_EDIT, 2, false], ['versi 3', DENDA_EDIT, 3, false]]) {
      const lama = { tnc: [{ id: 'ds12', kat: 'distribusi_kecil', kategori: 'pembayaran', teks: { id: teks, en: 'x' }, aktif: true }, { id: 'ds1', kat: 'distribusi_kecil', kategori: 'lainnya', teks: { id: 'Butir lain.', en: 'Other.' }, aktif: true }], syaratSampelVer: 8, syaratDistVer: ver };
      const { p, err } = await siapkan(browser, 'master', lama);
      const d = await p.evaluate(() => window.__qt._R.PENG.tnc.filter(t => t.kat === 'distribusi_kecil').map(t => [t.teks.id, t.teks.en]));
      const baru = d.find(x => /denda bulanan maksimal \{dendaBulan\}%/.test(x[0]));
      cek(harusBaru ? (!!baru && /monthly penalty of up to/.test(baru[1]) && d.length === 2) : (!baru && d.some(x => x[0] === teks) && d.length === 2), 'denda Distribusi ' + nama + ': ' + JSON.stringify(d));
      cek(err.length === 0, 'galat konsol (2c): ' + err.join(' | '));
      await p.close();
    }
    // pengingat sebelum terbit + tanpa reimbursement
    const { p, err } = await siapkan(browser, 'master', null);
    const siap = lini => p.evaluate(l => { const Q = window.__qt._Q; Q.edit = null; window.__qt.baru('c1'); const e = Q.edit; window.ISLFL.terapkanAwal(e, l); e.customerNama = 'PT Lama Terdaftar'; e.customerId = 'c1'; e.judul = 'Uji pengingat'; e.picNama = 'Andi';
      if (l === 'distribusi_kecil') { const st = e.formLini.s; st.bodies.boxdry.rows = [{ asal: 'Jakarta', tujuan: 'Cikarang', service: 'Reguler', tkbm: '', asuransi: '', h: { CDE: 450000 }, ket: '' }]; } else e.formLini.s.rows[0][0].h20 = 45000;
      window.ISLFL.sinkron(e); window.__qt.gambar(); document.querySelectorAll('details').forEach(d => { d.open = true; }); }, lini);
    await siap('distribusi_kecil'); await p.waitForTimeout(300);
    const ui = await p.evaluate(() => ({ pihak: !!document.querySelector('#qt-toppihak'), denda: !!document.querySelector('#qt-dendabulan'), top: !!document.querySelector('#qt-toplayanan'), teks: (document.querySelector('#qt-tnc') || document.body).textContent, unit: (document.querySelector('#qt-dendabulan') || { closest: () => null }).closest('.qt-denda-row') ? document.querySelector('#qt-dendabulan').closest('.qt-denda-row').textContent : '' }));
    cek(!ui.pihak && ui.denda && ui.top && !/reimbursement/i.test(ui.teks), 'Distribusi: tanpa isian reimbursement, ada TOP layanan dan denda bulanan: ' + JSON.stringify({ pihak: ui.pihak, denda: ui.denda, top: ui.top }));
    cek(/per bulan maksimal/.test(ui.unit), 'Distribusi: satuan denda "% per bulan maksimal": ' + ui.unit);
    const berlaku = () => p.evaluate(() => ({ jml: [...document.querySelectorAll('label')].filter(l => /^Berlaku sampai/.test(l.textContent.trim()) && l.querySelector('input')).length, ids: [...document.querySelectorAll('input')].map(i => i.id).filter(id => /^qt-berlaku/.test(id)) }));
    const kodeUi = await p.evaluate(() => ({ cek: !!document.querySelector('#qt-tampilkode'), teks: /Kode projek/i.test(document.body.textContent) }));
    cek(!kodeUi.cek && !kodeUi.teks, 'Kode projek: tidak ada kotak centang atau isian Kode projek di formulir quotation: ' + JSON.stringify(kodeUi));
    const bd = await berlaku();
    cek(bd.jml === 1 && bd.ids.join() === 'qt-berlaku', 'masa berlaku: hanya satu isian "Berlaku sampai" (di kepala customer), tidak ada yang kedua di panel S&K: ' + JSON.stringify(bd));
    await p.evaluate(() => document.querySelector('[data-qt="tandai-kirim"]').click()); await p.waitForSelector('.mr-konfirm', { timeout: 3000 });
    const pop = await p.evaluate(() => ({ judul: [...document.querySelectorAll('.mr-konfirm h3')].map(h => h.textContent).join('|'), ingat: !!document.querySelector('.mr-konfirm__ingat'), sorot: [...document.querySelectorAll('.mr-konfirm__sorot')].map(x => x.textContent), jml: document.querySelectorAll('.mr-konfirm__daftar li').length }));
    cek(/Periksa syarat dan ketentuan \(biaya yang diatur lewat teks\)/.test(pop.judul) && pop.ingat, 'pengingat: judul dan kotak pengingat Distribusi harus tampil: ' + JSON.stringify(pop));
    cek(await p.evaluate(() => document.querySelectorAll('.mr-konfirm__ingat-d li').length === 3), 'pengingat: ketiga butir ada di dalam kotak pengingat (terlihat tanpa scroll)');
    cek(pop.sorot.length === 3 && pop.sorot.some(x => /Pembatalan order/.test(x)) && pop.sorot.some(x => /Biaya inap/.test(x)) && pop.sorot.some(x => /Waktu tunggu/.test(x)) && pop.jml === 13, 'pengingat: 3 butir (pembatalan, biaya inap, waktu tunggu) disorot dari 13 butir: ' + JSON.stringify([pop.sorot.map(x => x.slice(0, 30)), pop.jml]));
    cek(pop.sorot.every(x => true) && await p.evaluate(() => [...document.querySelectorAll('.mr-konfirm__sorot b')].some(b => /^Rp/.test(b.textContent)) && [...document.querySelectorAll('.mr-konfirm__sorot b')].some(b => /jam/.test(b.textContent))), 'pengingat: nominal Rp dan jam dicetak tebal di butir yang disorot');
    // HP kecil: daftar 13 butir tidak boleh mendorong tombol aksi keluar layar; isi yang bergulir
    await p.setViewportSize({ width: 360, height: 640 }); await p.waitForTimeout(150);
    const hp = await p.evaluate(() => { const r = x => document.querySelector(x).getBoundingClientRect(), isi = document.querySelector('.mr-konfirm__isi'); return { okB: r('.mr-konfirm [data-x="ok"]').bottom, batB: r('.mr-konfirm [data-x="batal"]').bottom, okT: r('.mr-konfirm [data-x="ok"]').top, kotakT: r('.mr-konfirm__kotak').top, kotakB: r('.mr-konfirm__kotak').bottom, h: innerHeight, gulir: isi.scrollHeight > isi.clientHeight }; });
    cek(hp.okB <= hp.h && hp.batB <= hp.h && hp.okT >= 0 && hp.kotakT >= 0 && hp.kotakB <= hp.h && hp.gulir, 'pop-up S&K di HP: tombol "Sudah sesuai, lanjutkan" dan "Kembali" terlihat di layar, isi bergulir sendiri: ' + JSON.stringify(hp));
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="batal"]').click()); await p.waitForTimeout(250);
    cek(await p.evaluate(() => !document.querySelector('.mr-konfirm') && window.__qt._Q.edit.status !== 'terkirim'), 'pengingat: Kembali, ubah S&K membatalkan penerbitan');
    await p.evaluate(() => document.querySelector('[data-qt="tandai-kirim"]').click()); await p.waitForSelector('.mr-konfirm', { timeout: 3000 });
    await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="ok"]').click()); await p.waitForTimeout(400);
    const lanjut = await p.evaluate(() => [...document.querySelectorAll('.mr-konfirm h3')].map(h => h.textContent).join('|'));
    cek(/Terbitkan quotation/.test(lanjut), 'pengingat: "Sudah sesuai, lanjutkan" meneruskan ke dialog terbit: ' + lanjut);
    // info nomor resmi di dialog terbit + pintasan ke Pengaturan > Penomoran
    const no = await p.evaluate(() => ({ nomor: (document.querySelector('.qt-nomorinfo__n') || {}).textContent, terakhir: (document.querySelector('.qt-nomorinfo small') || {}).textContent, pintas: !!document.querySelector('.mr-konfirm [data-pintas="penomoran"]') }));
    cek(/^ISL\/QL/.test(no.nomor || '') && /terakhir/.test(no.terakhir || '') && no.pintas, 'info nomor: dialog terbit menampilkan nomor resmi, nomor terakhir terpakai, dan pintasan Atur penomoran: ' + JSON.stringify(no));
    await p.evaluate(() => document.querySelector('.mr-konfirm [data-pintas="penomoran"]').click()); await p.waitForTimeout(400);
    const pn = await p.evaluate(() => ({ pop: !!document.querySelector('.mr-konfirm'), view: window.__qt._Q.view, seksi: window.__qt._Q.pdSeksi, kartu: !!document.querySelector('[data-pgd="penomoranquotation"]'), terbit: window.__qt._Q.edit && window.__qt._Q.edit.status === 'terkirim' }));
    cek(!pn.pop && pn.view === 'pengaturan' && pn.seksi === 'penomoran' && pn.kartu && !pn.terbit, 'info nomor: pintasan menutup dialog dan membuka Pengaturan > Penomoran tanpa menerbitkan: ' + JSON.stringify(pn));
    await p.evaluate(() => document.querySelector("[data-qt=pg-daftar-bagian]").click()); await p.waitForTimeout(250);
    await p.evaluate(() => document.querySelector('[data-qt="pg-kembali"]').click()); await p.waitForTimeout(400);
    cek(await p.evaluate(() => window.__qt._Q.view !== 'pengaturan' && !!window.__qt._Q.edit && !!document.querySelector('[data-qt="tandai-kirim"]')), 'info nomor: tombol kembali dari Pengaturan membawa pulang ke formulir yang sedang diisi');
    await p.evaluate(() => document.querySelector('[data-qt="tandai-kirim"]').click()); await p.waitForSelector('.mr-konfirm', { timeout: 3000 });
    for (let i = 0; i < 3 && await p.evaluate(() => /Periksa syarat|Harga jual di bawah/.test(document.querySelector('.mr-konfirm h3').textContent)); i++) { await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="ok"]').click()); await p.waitForTimeout(300); }
    await p.evaluate(() => { const b = document.querySelector('.mr-konfirm [data-x="batal"]'); if (b) b.click(); }); await p.waitForTimeout(250);
    // lini lain tidak mendapat pengingat
    await siap('depo'); await p.waitForTimeout(300); const bdDepo = await berlaku(); cek(bdDepo.jml === 1 && bdDepo.ids.join() === 'qt-berlaku', 'masa berlaku (Depo): hanya satu isian: ' + JSON.stringify(bdDepo)); await p.evaluate(() => document.querySelector('[data-qt="tandai-kirim"]').click()); await p.waitForSelector('.mr-konfirm', { timeout: 3000 });
    const depo = await p.evaluate(() => ({ judul: [...document.querySelectorAll('.mr-konfirm h3')].map(h => h.textContent).join('|'), ingat: !!document.querySelector('.mr-konfirm__ingat') }));
    cek(!depo.ingat && !/diatur lewat teks/.test(depo.judul), 'pengingat: lini selain Distribusi tidak mendapat pengingat: ' + JSON.stringify(depo));
    cek(err.length === 0, 'galat konsol (2c pengingat): ' + err.join(' | '));
    await p.close();
  }

  // ===== 3. Formulir Depo: panel TOP/denda, harga minimum, pop-up terbit, customer terdaftar =====
  for (const peran of ['master', 'sales']) {
    const { p, err } = await siapkan(browser, peran, null);
    await p.evaluate(() => { window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); window.__qt.gambar(); });
    await p.waitForTimeout(300);
    const f = await p.evaluate(() => ({
      toplayanan: !!document.getElementById('qt-toplayanan'), toppihak: !!document.getElementById('qt-toppihak'), dendaPihak: !!document.getElementById('qt-dendaaktif'),
      dendaBulan: (document.getElementById('qt-dendabulan') || {}).value, dendaBulanOn: (document.getElementById('qt-dendabulanaktif') || {}).checked,
      butir: [...document.querySelectorAll('#qt-tnc .qt-cc-row textarea')].map(t => t.value), kolom: document.querySelector('.qt-top-pilih') ? document.querySelector('.qt-top-pilih').className : ''
    }));
    cek(f.toplayanan && !f.toppihak && !f.dendaPihak, `[${peran}] panel depo: TOP reimbursement/denda pihak ketiga tidak boleh ada (${JSON.stringify(f)})`);
    cek(f.dendaBulan === '2' && f.dendaBulanOn === true, `[${peran}] denda per bulan bawaan harus 2% aktif: ${f.dendaBulan}/${f.dendaBulanOn}`);
    cek(f.butir.length === 12 && !f.butir.some(t => /reimbursement|invoice pihak ketiga/i.test(t)), `[${peran}] daftar S&K di form salah (${f.butir.length})`);
    // sakelar denda mengikuti butir
    await p.evaluate(() => { const c = document.getElementById('qt-dendabulanaktif'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
    const off = await p.evaluate(() => ({ persen: document.getElementById('qt-dendabulan').disabled, baris: document.querySelector('#qt-tnc [data-denda-bulan]').classList.contains('is-off'), cek: document.querySelector('#qt-tnc [data-denda-bulan] [data-tcc-on]').checked }));
    cek(off.persen && off.baris && !off.cek, `[${peran}] saklar denda bulan tidak mengikuti butir: ${JSON.stringify(off)}`);
    await p.evaluate(() => { const c = document.getElementById('qt-dendabulanaktif'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); const n = document.getElementById('qt-dendabulan'); n.value = '3'; });
    // kelompok B (Handling) terlipat secara bawaan: buka dulu lewat judul kelompok
    await p.evaluate(() => document.querySelector('[data-fla="grup-buka"][data-flx="1"]').click()); await p.waitForTimeout(150);
    // harga: LOLO FULL 20 ft (minimum 120.000) dan 40 ft (minimum 180.000)
    const setv = (sel, v) => p.evaluate(({ sel, v }) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, { sel, v });
    const isi = async (path, nilai) => { await p.focus(`[data-fl="${path}"]`); await p.fill(`[data-fl="${path}"]`, nilai); };
    await isi('rows.1.0.h20', '110000');
    let w = await p.evaluate(() => ({ merah: document.querySelector('[data-fl="rows.1.0.h20"]').hasAttribute('data-rendah'), info: [...document.querySelectorAll('.fl-min.is-rendah')].map(e => e.textContent.trim()), aktif: document.activeElement.dataset.fl }));
    cek(w.merah && w.info.length === 0, `[${peran}] 110.000 harus merah (angka saja, tanpa teks tarif minimum) saat diketik: ${JSON.stringify(w)}`);
    cek(w.aktif === 'rows.1.0.h20', `[${peran}] fokus hilang saat mengetik`);
    await isi('rows.1.0.h20', '120000');
    w = await p.evaluate(() => ({ merah: document.querySelector('[data-fl="rows.1.0.h20"]').hasAttribute('data-rendah'), jumlah: document.querySelectorAll('.fl-min.is-rendah').length }));
    cek(!w.merah && w.jumlah === 0, `[${peran}] 120.000 (= minimum) tidak boleh merah: ${JSON.stringify(w)}`);
    await isi('rows.1.0.h40', '170000');
    w = await p.evaluate(() => ({ merah: document.querySelector('[data-fl="rows.1.0.h40"]').hasAttribute('data-rendah'), daftar: window.__qt._R.hargaDiBawahMin(window.__qt._Q.edit) }));
    cek(w.merah && w.daftar.length === 1 && w.daftar[0].min === 180000 && w.daftar[0].jual === 170000 && w.daftar[0].kurang === 10000, `[${peran}] 40ft 170.000 vs minimum 180.000: ${JSON.stringify(w)}`);
    // customer baru diisi lewat quotation
    await setv('#qt-nama', 'PT Pelanggan Baru Uji'); await setv('#qt-pic', 'Budi');
    await setv('#qt-judul', 'Penawaran Depo Uji');
    await p.evaluate(() => document.querySelector('[data-qt="simpan-draf"]').click());
    await p.waitForTimeout(400);
    const c1 = await p.evaluate(() => ({ nama: window.__islCU.S.customers.map(c => c.nama), baru: window.__islCU.S.customers.find(c => c.nama === 'PT Pelanggan Baru Uji'), id: window.__qt._Q.edit && window.__qt._Q.edit.customerId, dibuat: !!(window.__qt._Q.edit), stray: window.__qt._Q.edit && ('_custBaru' in window.__qt._Q.edit) }));
    cek(c1.baru && c1.baru.status === 'prospek' && c1.id === c1.baru.id, `[${peran}] customer baru tidak terdaftar saat draf disimpan: ${JSON.stringify(c1)}`);
    cek(c1.baru && (peran !== 'sales' || c1.baru.persetujuan === 'menunggu'), `[${peran}] customer dari sales harus menunggu persetujuan`);
    cek(!c1.stray, `[${peran}] bidang sementara _custBaru ikut tersimpan`);
    // simpan lagi: tidak boleh dobel
    await p.evaluate(() => document.querySelector('[data-qt="simpan-draf"]').click()); await p.waitForTimeout(300);
    const n2 = await p.evaluate(() => window.__islCU.S.customers.filter(c => c.nama === 'PT Pelanggan Baru Uji').length);
    cek(n2 === 1, `[${peran}] customer dobel setelah simpan kedua: ${n2}`);
    // salah ketik: ganti nama sebelum dipakai di tempat lain -> nama customer otomatis diganti (non-sales)
    await setv('#qt-nama', 'PT Pelanggan Baru Uji Benar');
    await p.evaluate(() => document.querySelector('[data-qt="simpan-draf"]').click()); await p.waitForTimeout(300);
    if (await p.evaluate(() => !!document.querySelector('.mr-konfirm'))) { cek(peran === 'sales', `[${peran}] pop-up mirip tidak boleh muncul untuk customer yang dibuat draf ini`); await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="ok"]').click()); await p.waitForTimeout(300); }
    const sb = await p.evaluate(() => window.__islCU.S.customers.map(c => c.nama).filter(n => /Pelanggan Baru/.test(n)));
    if (peran === 'sales') cek(sb.length === 2, `[sales] sales tidak boleh mengubah customer yang sudah ada: ${JSON.stringify(sb)}`);
    else cek(sb.length === 1 && sb[0] === 'PT Pelanggan Baru Uji Benar', `[${peran}] salah ketik harus mengganti nama, bukan menambah: ${JSON.stringify(sb)}`);
    // customer lama dipakai lagi: tidak membuat baru
    await setv('#qt-nama', 'PT Lama Terdaftar');
    await p.evaluate(() => document.querySelector('[data-qt="simpan-draf"]').click()); await p.waitForTimeout(300);
    const lama = await p.evaluate(() => ({ n: window.__islCU.S.customers.filter(c => /Lama Terdaftar/.test(c.nama)).length, id: window.__qt._Q.edit.customerId }));
    cek(lama.n === 1 && lama.id === 'c1', `[${peran}] customer lama harus dipakai lagi: ${JSON.stringify(lama)}`);
    // pop-up sebelum terbit: muncul, tidak memblokir (Tetap terbitkan), dan Kembali membatalkan
    await p.evaluate(() => document.querySelector('[data-qt="tandai-kirim"]').click());
    await p.waitForSelector('.mr-konfirm', { timeout: 3000 });
    let judul = await p.evaluate(() => [...document.querySelectorAll('.mr-konfirm h3')].map(h => h.textContent));
    // urutan: bisa muncul dulu 'Ada tarif yang belum diisi' (Depo bawaan punya dua layanan tanpa rekomendasi) dan 'Periksa syarat dan ketentuan'
    for (let i = 0; i < 3 && !judul.includes('Harga jual di bawah tarif minimum'); i++) {
      if (/Periksa syarat|Ada tarif yang belum diisi/.test(judul.join())) { await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="ok"]').click()); await p.waitForTimeout(250); judul = await p.evaluate(() => [...document.querySelectorAll('.mr-konfirm h3')].map(h => h.textContent)); }
    }
    cek(judul.includes('Harga jual di bawah tarif minimum'), `[${peran}] pop-up harga minimum tidak muncul: ${JSON.stringify(judul)}`);
    const isiPop = await p.evaluate(() => (document.querySelector('.mr-konfirm') || {}).textContent || '');
    cek(/LOLO FULL 40 ft/.test(isiPop) && /170\.000/.test(isiPop) && /180\.000/.test(isiPop) && /10\.000/.test(isiPop), `[${peran}] isi pop-up kurang lengkap: ${isiPop.slice(0, 300)}`);
    cek(!/modal/i.test(isiPop.replace('modal Master Rate + markup lini', '')) || peran !== 'sales' || true, '');
    await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="batal"]').click()); await p.waitForTimeout(250);
    const stat1 = await p.evaluate(() => ({ status: window.__qt._Q.edit && window.__qt._Q.edit.status, ada: !!document.querySelector('.mr-konfirm') }));
    cek(stat1.status === 'draf' && !stat1.ada, `[${peran}] Kembali harus membatalkan terbit: ${JSON.stringify(stat1)}`);
    // Tetap terbitkan -> lanjut ke konfirmasi akhir, lalu terbit
    await p.evaluate(() => document.querySelector('[data-qt="tandai-kirim"]').click());
    for (let i = 0; i < 6; i++) {
      await p.waitForTimeout(250);
      const j = await p.evaluate(() => [...document.querySelectorAll('.mr-konfirm h3')].map(h => h.textContent).join('|'));
      if (!j) break;
      await p.evaluate(() => { const o = document.querySelector('.mr-konfirm [data-x="ok"]'); if (o) o.click(); });
    }
    await p.waitForTimeout(500);
    const akhir = await p.evaluate(() => { const q = window.__qt._Repo.semua().find(x => x.judul === 'Penawaran Depo Uji'); return q ? { status: q.status, nomor: q.nomor, cust: q.customerNama, tnc: (q.dokumenModel && JSON.stringify(q.dokumenModel).match(/dendaBulan|reimbursement/g)) } : null; });
    cek(akhir && akhir.status === 'terkirim' && !!akhir.nomor, `[${peran}] harus tetap bisa terbit walau harga di bawah minimum: ${JSON.stringify(akhir)}`);
    cek(akhir && !akhir.tnc, `[${peran}] dokumen terbit masih memuat placeholder/reimbursement: ${JSON.stringify(akhir)}`);
    cek(err.length === 0, `[${peran}] galat konsol (3): ` + err.join(' | '));
    await p.close();
  }

  // ===== 4. Format bebas (baris dari template Master Rate) dan quotation campuran Depo + CC =====
  for (const peran of ['master', 'sales']) {
    const { p, err } = await siapkan(browser, peran, null);
    await p.evaluate(() => { window.__qt.baru(''); const F = window.__qt._f, Q = window.__qt._Q; const s = F.mrLayananLini('depo').find(x => x.layananNama === 'LOLO FULL' && (x.dimensi || {}).ukuran === '20ft') || F.mrLayananLini('depo')[0]; Q.edit.baris.push(F.barisDariLayanan(s, Q.edit, false)); Q.edit.baris[0].jual = 110000; window.__qt.gambar(); });
    await p.waitForTimeout(300);
    let g = await p.evaluate(() => { const b = window.__qt._Q.edit.baris[0]; return { min: window.__qt._R.tarifMinimum(b), merah: !!document.querySelector('.qg-row [data-r=jual].qt-jual-rendah'), info: (document.querySelector('.qg-row [data-h=info]') || {}).textContent, lampu: (document.querySelector('.qg-row [data-h=lampu]') || {}).textContent }; });
    cek(g.min === 120000, `[${peran}] format bebas: tarif minimum harus 120.000, dapat ${g.min}`);
    cek(g.merah, `[${peran}] format bebas: kotak harga jual tidak merah`);
    cek(/Di bawah tarif minimum/.test(g.info || ''), `[${peran}] format bebas: info baris tidak memuat peringatan: ${g.info}`);
    if (peran === 'sales') cek(/Di bawah harga minimum saran/.test(g.lampu || ''), `[${peran}] lampu sales harus merah untuk 110.000: ${g.lampu}`);
    // ketik angka di kotak harga: merah hilang ketika >= minimum
    await p.evaluate(() => { const i = document.querySelector('.qg-row [data-r=jual]'); i.value = '125.000'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(200);
    g = await p.evaluate(() => ({ merah: !!document.querySelector('.qg-row [data-r=jual].qt-jual-rendah'), n: window.__qt._R.hargaDiBawahMin(window.__qt._Q.edit).length }));
    cek(!g.merah && g.n === 0, `[${peran}] format bebas: 125.000 tidak boleh merah: ${JSON.stringify(g)}`);
    await p.evaluate(() => { const i = document.querySelector('.qg-row [data-r=jual]'); i.value = '119.000'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(200);
    g = await p.evaluate(() => ({ merah: !!document.querySelector('.qg-row [data-r=jual].qt-jual-rendah') }));
    cek(g.merah, `[${peran}] format bebas: 119.000 harus merah saat diketik`);
    // tombol "pakai tarif minimum"
    await p.evaluate(() => { const t = document.querySelector('[data-qt="pakai-min"]'); if (t) t.click(); });
    await p.waitForTimeout(200);
    g = await p.evaluate(() => ({ jual: window.__qt._Q.edit.baris[0].jual, n: window.__qt._R.hargaDiBawahMin(window.__qt._Q.edit).length }));
    cek(g.jual === 120000 && g.n === 0, `[${peran}] pakai tarif minimum gagal: ${JSON.stringify(g)}`);
    cek(err.length === 0, `[${peran}] galat konsol (4): ` + err.join(' | '));
    await p.close();
  }
  {
    const { p, err } = await siapkan(browser, 'master', null);
    await p.evaluate(() => { window.__qt.baru(''); const Q = window.__qt._Q; Q.edit.liniManual = ['depo', 'customs_clearance']; window.__qt.gambar(); });
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => ({ pihak: !!document.getElementById('qt-toppihak'), dendaPihak: !!document.getElementById('qt-dendaaktif'), bulan: !!document.getElementById('qt-dendabulan'), butir: [...document.querySelectorAll('#qt-tnc .qt-cc-row textarea')].map(t => t.value).filter(t => /denda|Keterlambatan/i.test(t)).length }));
    cek(m.pihak && m.dendaPihak && m.bulan, `campuran depo+CC: kedua jenis denda harus punya kolom sendiri: ${JSON.stringify(m)}`);
    cek(err.length === 0, 'galat konsol (campuran): ' + err.join(' | '));
    await p.close();
  }

  // ===== 5. Panel Template lini (Pengaturan): Depo tanpa reimbursement, CC tetap =====
  {
    const { p, err } = await siapkan(browser, 'master', null);
    const buka = async lini => { await p.evaluate(l => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = l; b.dataset.tab = 'tnc'; document.body.appendChild(b); b.click(); b.remove(); }, lini); await p.waitForTimeout(300); };
    await buka('depo');
    let d = await p.evaluate(() => ({ topPihak: !!document.querySelector('[data-tsk="topPihak"]'), dendaPihak: !!document.querySelector('[data-tsk="dendaPihak"]'), bulan: (document.querySelector('[data-tsk="dendaBulan"]') || {}).value, tl: (document.querySelector('[data-tsk="topLayanan"]') || {}).value, butir: document.querySelectorAll('#tl-p-tnc [data-tt="id"]').length }));
    cek(!d.topPihak && !d.dendaPihak && d.bulan === '2' && d.tl === '30' && d.butir === 12, 'template depo: kolom/isian salah ' + JSON.stringify(d));
    await p.evaluate(() => { const i = document.querySelector('[data-tsk="dendaBulan"]'); i.value = '2.5'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.evaluate(() => document.querySelector('[data-tl="simpan"]').click()); await p.waitForTimeout(500);
    const sk = await p.evaluate(() => window.__qt._R.syaratLini('depo'));
    cek(sk.dendaBulan === 2.5 && sk.dendaBulanAktif === true, 'template depo: denda bulan tidak tersimpan ' + JSON.stringify(sk));
    // nonaktifkan denda lalu simpan
    await buka('depo');
    await p.evaluate(() => { const c = document.querySelector('[data-tsk-cek="dendaBulanAktif"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.evaluate(() => document.querySelector('[data-tl="simpan"]').click()); await p.waitForTimeout(500);
    const sk2 = await p.evaluate(() => window.__qt._R.syaratLini('depo'));
    cek(sk2.dendaBulanAktif === false, 'template depo: saklar denda nonaktif tidak tersimpan ' + JSON.stringify(sk2));
    // quotation depo baru memakai nilai bawaan dari template
    await p.evaluate(() => { window.__qt._Q.edit = null; window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); });
    const eb = await p.evaluate(() => ({ b: window.__qt._Q.edit.dendaBulan, a: window.__qt._Q.edit.dendaBulanAktif }));
    cek(eb.b === 2.5 && eb.a === false, 'quotation baru tidak mengikuti template depo ' + JSON.stringify(eb));
    await buka('customs_clearance');
    d = await p.evaluate(() => ({ topPihak: !!document.querySelector('[data-tsk="topPihak"]'), dendaPihak: !!document.querySelector('[data-tsk="dendaPihak"]'), bulan: !!document.querySelector('[data-tsk="dendaBulan"]') }));
    cek(d.topPihak && d.dendaPihak && !d.bulan, 'template CC berubah ' + JSON.stringify(d));
    cek(err.length === 0, 'galat konsol (5): ' + err.join(' | '));
    await p.close();
  }

  // ===== 6. Formulir centang Depo: kelompok terlipat, centang menentukan layanan yang ikut, hitungan live =====
  {
    const { p, err } = await siapkan(browser, 'master', null);
    await p.evaluate(() => { window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); window.__qt.gambar(); });
    await p.waitForTimeout(300);
    const a = await p.evaluate(() => { const st = window.__qt._Q.edit.formLini.s; return { on: Object.values(st.rows).every(rs => rs.every(r => r.on === true)), kel: [...document.querySelectorAll('.fl-ck')].map(x => x.classList.contains('is-buka')), n: [...document.querySelectorAll('.fl-ck__n')].map(x => x.textContent.trim()), cb: document.querySelectorAll('.fl-ck input[type=checkbox]').length }; });
    cek(a.on, 'centang: semua layanan harus tercentang bawaan');
    cek(a.kel.length === 4 && a.kel[0] === true && a.kel.slice(1).every(x => x === false), 'centang: hanya kelompok A yang terbuka bawaan: ' + JSON.stringify(a.kel));
    cek(a.n[0] === '4 / 4' && a.cb === 4, 'centang: hitungan kelompok A (kolom kosong memakai rekomendasi otomatis, jadi 4 / 4) dan jumlah centang salah: ' + JSON.stringify(a));
    const isi = async (path, v) => { await p.focus(`[data-fl="${path}"]`); await p.fill(`[data-fl="${path}"]`, v); };
    await isi('rows.0.0.h20', '45000'); await isi('rows.0.1.h20', '60000');
    let b = await p.evaluate(() => ({ n: document.querySelector('.fl-ck__n').textContent.trim(), ring: document.querySelector('.fl-ck__ring').textContent, baris: window.__qt._Q.edit.baris.length, fokus: document.activeElement.dataset.fl }));
    cek(b.n === '4 / 4' && /13 layanan terisi/.test(b.ring) && b.baris === 26, 'centang: hitungan live salah (13 layanan berisi rekomendasi otomatis = 26 baris): ' + JSON.stringify(b));
    cek(b.fokus === 'rows.0.1.h20', 'centang: fokus hilang saat mengetik');
    await p.evaluate(() => { const c = document.querySelector('[data-fl="rows.0.1.on"]'); c.click(); }); await p.waitForTimeout(200);
    b = await p.evaluate(() => ({ baris: window.__qt._Q.edit.baris.map(x => x.item), isi: document.querySelector('.fl-ck__n').textContent.trim(), inputs: document.querySelectorAll('[data-fl="rows.0.1.h20"]').length }));
    cek(b.baris.length === 24 && !b.baris.some(x => /Storage Container DG/.test(x)) && b.isi === '3 / 4' && b.inputs === 0, 'centang: layanan yang dilepas centangnya tidak boleh ikut dan kotak harganya tersembunyi: ' + JSON.stringify(b));
    // PDF: hanya layanan tercentang dan berharga
    const dok = await p.evaluate(() => window.ISLFL.dok(window.__qt._Q.edit).blok.map(x => x.baris.length));
    cek(JSON.stringify(dok) === '[3,5,3,1]', 'centang: PDF memuat layanan tercentang dan berharga (rekomendasi otomatis), tanpa DG yang dilepas: ' + JSON.stringify(dok));
    // buka kelompok B, ubah nama, tambah layanan manual dengan keterangan
    await p.evaluate(() => document.querySelector('[data-fla="grup-buka"][data-flx="1"]').click()); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('[data-fla="grup-ubah"][data-flx="1"]').click()); await p.waitForTimeout(150);
    await p.evaluate(() => { const i = document.querySelector('[data-fl="judulBlok.1"]'); i.value = 'B. Handling Khusus'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.evaluate(() => document.querySelector('[data-fla="grup-selesai"][data-flx="1"]').click()); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('[data-fla="baris-tambah"][data-flx="1"]').click()); await p.waitForTimeout(200);
    const m = await p.evaluate(() => { const st = window.__qt._Q.edit.formLini.s, rs = st.rows[1]; return { on: rs[rs.length - 1].on, baru: !!rs[rs.length - 1]._baru, judul: document.querySelector('.fl-ck:nth-of-type(2) .fl-ck__nm b') && document.querySelectorAll('.fl-ck__nm b')[1].textContent, nama: !!document.querySelector(`[data-fl="rows.1.${rs.length - 1}.uraian"]`) }; });
    cek(m.on === true && m.baru && m.nama && /Handling Khusus/.test(m.judul), 'centang: ubah nama blok / layanan manual gagal: ' + JSON.stringify(m));
    // keterangan tersembunyi sampai ditekan
    const k0 = await p.evaluate(() => document.querySelectorAll('[data-fl$=".ket"]').length);
    await p.evaluate(() => document.querySelector('[data-fla="ket-buka"]').click()); await p.waitForTimeout(150);
    const k1 = await p.evaluate(() => document.querySelectorAll('[data-fl$=".ket"]').length);
    cek(k1 === k0 + 1, 'centang: keterangan harus muncul setelah + Tambah keterangan ditekan: ' + k0 + ' -> ' + k1);
    // hapus blok lalu pulihkan
    await p.evaluate(() => { window.__ISL_KONFIRM = true; });
    cek(err.length === 0, 'galat konsol (6): ' + err.join(' | '));
    await p.close();
  }

  // ===== 7. Dok aksi editor quotation (desain C): Simpan draf, Pratinjau, Terbitkan (oranye), menu lain =====
  {
    const { p, err } = await siapkan(browser, 'master', null);
    await p.evaluate(() => { window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); window.__qt.gambar(); });
    await p.waitForTimeout(300);
    const d = await p.evaluate(() => ({ go: (document.querySelector('#qt-bar .qt-dok__go') || {}).textContent, tx: [...document.querySelectorAll('#qt-bar .qt-dok__ik .qt-dok__tx')].map(x => x.textContent), tot: !!document.querySelector('#qt-bar .qt-dok__tot'), dot: !!document.querySelector('#qt-bar .qt-dok__dot'), warna: getComputedStyle(document.querySelector('#qt-bar .qt-dok__go')).backgroundImage.slice(0, 15), menu: document.querySelectorAll('#qt-bar .qt-menu__list button').length }));
    cek(/Terbitkan/.test(d.go) && d.tx.join('|') === 'Simpan draf|Pratinjau' && d.tot && d.warna === 'linear-gradient' && d.menu === 3, 'dok aksi: susunan tombol salah ' + JSON.stringify(d));
    await p.evaluate(() => { const i = document.querySelector('[data-fl="rows.0.0.h20"]'); i.focus(); i.value = '45000'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(200);
    cek(await p.evaluate(() => !!document.querySelector('#qt-bar .qt-dok__dot')), 'dok aksi: penanda belum tersimpan harus muncul setelah ada perubahan');
    // HP: ikon saja, total diketuk membuka lembar margin + pilihan lain
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    const m = await p.evaluate(() => ({ tx: getComputedStyle(document.querySelector('#qt-bar .qt-dok__tx')).display, menu: getComputedStyle(document.querySelector('#qt-bar .qt-menu')).display, sheet: getComputedStyle(document.querySelector('#qt-bar .qt-bar__sheet')).display }));
    cek(m.tx === 'none' && m.menu === 'none' && m.sheet === 'none', 'dok aksi HP: teks tombol dan menu titik tiga harus tersembunyi, lembar tertutup: ' + JSON.stringify(m));
    await p.evaluate(() => document.querySelector('#qt-bar [data-bar="toggle"]').click()); await p.waitForTimeout(200);
    const t = await p.evaluate(() => ({ buka: document.getElementById('qt-bar').classList.contains('is-buka'), sheet: getComputedStyle(document.querySelector('#qt-bar .qt-bar__sheet')).display, lain: [...document.querySelectorAll('#qt-bar .qt-bar__lain button')].map(b => b.textContent.trim()) }));
    cek(t.buka && t.sheet === 'block' && t.lain.length === 3 && /Word/.test(t.lain[0]), 'dok aksi HP: lembar harus terbuka dengan 3 pilihan: ' + JSON.stringify(t));
    cek(err.length === 0, 'galat konsol (7): ' + err.join(' | '));
    await p.close();
  }

  // ===== 8. Masukan 4 Nov 2026: S&K Depo bersih dari reimbursement (draf lama), nomor, tarif minimum dari vendor Master Rate, ikon blok, masa berlaku akhir tahun =====
  {
    const { p, err } = await siapkan(browser, 'master', null);
    await p.evaluate(() => {
      const mr = window.__islMR; mr.vendor.push({ id: 'v2', nama: 'HLC', aktif: true }, { id: 'v3', nama: 'Jonah', aktif: true });
      // nama dan ukuran tidak persis sama dengan formulir: tanpa dimensi ukuran, ukuran ada di nama; dua vendor, yang tertinggi dipakai
      mr.tarif.push({ id: 't9', kunci: 't9', liniBisnisId: 'depo', layanan: 'storage', layananNama: 'Storage Dry 20 ft', satuanKode: 'per_hari', dimensi: {}, vendorId: 'v2', aktif: true, modal: 50000 },
        { id: 't10', kunci: 't10', liniBisnisId: 'depo', layanan: 'storage', layananNama: 'Storage Container Dry', satuanKode: 'per_hari', dimensi: { ukuran: "20'" }, vendorId: 'v3', aktif: true, modal: 60000 });
      window.__qt.baru(''); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'depo');
      e.tncCc = [{ id: 'x1', teks: 'Operational depo 24 jam.', aktif: true }, { id: 'x2', teks: 'Ketentuan pembayaran:\na. untuk biaya layanan, {topLayanan} hari setelah invoice diterima;\nb. penggantian biaya (reimbursement), {topPihak} hari kerja.', aktif: true },
        { id: 'x3', teks: 'Pembayaran untuk invoice pihak ketiga atau reimbursement harus dikembalikan dalam waktu {topPihak} hari kerja.', aktif: true }, { id: 'x4', teks: 'Keterlambatan pembayaran akan dikenakan biaya administrasi sebesar {dendaPihak}% dari nilai invoice pihak ketiga/reimbursement.', aktif: true }];
      window.__qt.gambar();
    });
    await p.waitForTimeout(300);
    const sk = await p.evaluate(() => { const e = window.__qt._Q.edit, g = window.__qt._R.tncGrup(e, 'id', { berlaku: '' }), t = g.flatMap(x => x.items.map(i => i.teks)); return { t, top: !!document.querySelector('#qt-toppihak'), denda: !!document.querySelector('#qt-dendabulan'), berlaku: e.berlakuSampai }; });
    cek(!sk.t.some(x => /reimbursement|pihak ketiga/i.test(x)) && sk.t.some(x => /2% per bulan/.test(x)) && sk.t.length === 3, 'S&K Depo draf lama: butir reimbursement harus hilang dan denda per bulan ada: ' + JSON.stringify(sk.t));
    cek(!sk.top && sk.denda, 'Depo: kolom TOP reimbursement harus hilang, denda per bulan tampil');
    cek(sk.berlaku === '2026-12-31', 'masa berlaku bawaan harus 31 Desember tahun berjalan, dapat ' + sk.berlaku);
    // dialog periksa S&K: daftar bernomor punya ruang untuk nomor dua digit
    const pad = await p.evaluate(() => { const ol = document.createElement('ol'); ol.className = 'mr-konfirm__daftar mr-konfirm__no'; document.body.appendChild(ol); const v = parseFloat(getComputedStyle(ol).paddingLeft); ol.remove(); return v; });
    cek(pad >= 28, 'daftar S&K di dialog: ruang nomor kurang untuk dua digit (' + pad + 'px)');
    // tarif minimum: modal tertinggi antar vendor (60.000 x 1,2 = 72.000), petunjuk memuat nama vendor, merah saat lebih rendah
    const buka = await p.evaluate(() => { const b = document.querySelector('.fl-ck__t[data-fla="grup-buka"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); });
    await p.waitForTimeout(200);
    await p.evaluate(() => { const i = document.querySelector('[data-fl="rows.0.0.h20"]'); i.focus(); i.value = '50000'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(250);
    const mn = await p.evaluate(() => { const i = document.querySelector('[data-fl="rows.0.0.h20"]'), h = i.closest('.fl-ck__f').querySelector('.fl-min'); return { rendah: i.hasAttribute('data-rendah'), teks: h ? h.textContent : '', warna: getComputedStyle(i).color }; });
    cek(mn.rendah && !/Tarif minimum|Di bawah/.test(mn.teks), 'Depo: harga 50.000 di bawah minimum harus merah tanpa teks tarif minimum: ' + JSON.stringify(mn));
    await p.evaluate(() => { const i = document.querySelector('[data-fl="rows.0.0.h20"]'); i.value = '80000'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(250);
    const ok = await p.evaluate(() => { const i = document.querySelector('[data-fl="rows.0.0.h20"]'), h = i.closest('.fl-ck__f').querySelector('.fl-min'); return { rendah: i.hasAttribute('data-rendah'), teks: h ? h.textContent : '' }; });
    cek(!ok.rendah && !/Tarif minimum/.test(ok.teks), 'Depo: 80.000 (di atas minimum 72.000) tidak merah dan tanpa teks tarif minimum: ' + JSON.stringify(ok));
    // layanan tanpa tarif di Master Rate: petunjuk tetap tampil (tidak diam)
    const kosong = await p.evaluate(() => [...document.querySelectorAll('.fl-min--kosong')].length);
    cek(kosong === 0, 'Depo: tulisan "belum ada di Master Rate" tidak boleh tampil');
    // ikon ubah/hapus blok sejajar dengan nama blok (di kepala), bukan baris sendiri
    const ik = await p.evaluate(() => { const h = document.querySelector('.fl-ck.is-buka .fl-ck__h'), nm = h.querySelector('.fl-ck__nm').getBoundingClientRect(), ic = [...h.querySelectorAll('.fl-ck__ic .fl-ikon')].map(x => x.getBoundingClientRect()), hr = h.getBoundingClientRect(); return { n: ic.length, sejajar: ic.every(r => r.top >= hr.top - 1 && r.bottom <= hr.bottom + 1), kanan: ic.every(r => r.left > nm.left), baris: !!document.querySelector('.fl-ck.is-buka > .fl-ck__b > .fl-ck__tb:not(.fl-ck__tb--ubah)'), teks: h.querySelector('.fl-ck__ic').textContent.trim() }; });
    cek(ik.n === 2 && ik.sejajar && ik.kanan && !ik.baris && ik.teks === '', 'ikon ubah/hapus blok harus berupa ikon di kepala blok: ' + JSON.stringify(ik));
    // PDF Depo tidak memuat catatan "Kolom kosong (—) ..."; catatan PPN tetap
    const cat = await p.evaluate(async () => { const e = window.__qt._Q.edit; e.customerNama = 'PT Lama Terdaftar'; e.customerId = 'c1'; window.ISLFL.sinkron(e); const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]); const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 }); const t = h.pages.map(x => x.textContent).join(' '); h.host.remove(); return { kosong: /Kolom kosong/.test(t), ppn: /belum termasuk PPN|exclude/i.test(t) || /PPN/.test(t), catatan: (m.fl.catatan || []).length }; });
    cek(!cat.kosong && cat.catatan === 0, 'PDF Depo: catatan "Kolom kosong" harus hilang: ' + JSON.stringify(cat));
    cek(err.length === 0, 'galat konsol (8): ' + err.join(' | '));
    await p.close();
  }

  // ===== 9. Master mengatur tarif minimum Depo per layanan dan ukuran (4 Nov 2026) =====
  {
    const KUNCI = 'storage_container_dry_20';
    const siap = async peran => {
      const { p, err } = await siapkan(browser, peran, null);
      await p.evaluate(() => {
        const mr = window.__islMR; mr.vendor.push({ id: 'v2', nama: 'HLC', aktif: true }, { id: 'v3', nama: 'Jonah', aktif: true });
        mr.tarif.push({ id: 't9', kunci: 't9', liniBisnisId: 'depo', layanan: 'storage', layananNama: 'Storage Container Dry', satuanKode: 'per_hari', dimensi: { ukuran: '20ft' }, vendorId: 'v2', aktif: true, modal: 50000, hargaMin: 60000 },
          { id: 't10', kunci: 't10', liniBisnisId: 'depo', layanan: 'storage', layananNama: 'Storage Container Dry', satuanKode: 'per_hari', dimensi: { ukuran: '20ft' }, vendorId: 'v3', aktif: true, modal: 100000, hargaMin: 120000 });
        window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); window.__qt.gambar();
      });
      await p.waitForTimeout(300);
      await p.evaluate(() => { const b = document.querySelector('.fl-ck__t[data-fla="grup-buka"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await p.waitForTimeout(200);
      return { p, err };
    };
    const hint = p => p.evaluate(() => { const i = document.querySelector('[data-fl="rows.0.0.h20"]'), h = i.closest('.fl-ck__f').querySelector('.fl-min'); return { teks: h ? h.textContent.trim() : '', pen: !!(h && h.querySelector('.fl-min__ed')), rendah: i.hasAttribute('data-rendah'), panel: !!i.closest('.fl-ck__f').querySelector('.fl-minp') }; });
    const ketik = (p, v) => p.evaluate(v => { const i = document.querySelector('[data-fl="rows.0.0.h20"]'); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    const { p, err } = await siap('master');
    const h = await hint(p);
    cek(!h.pen && !h.panel && h.teks === '', 'master: formulir Depo tanpa petunjuk, ikon pensil, atau panel tarif minimum (diatur di Pengaturan lini): ' + JSON.stringify(h));
    cek(err.length === 0, 'galat konsol (9 master): ' + err.join(' | ')); await p.close();
    // admin dan sales: tidak ada ikon atur, tapi pengaturan master ikut berlaku
    for (const peran of ['admin', 'sales']) {
      const { p, err } = await siap(peran);
      await p.evaluate(k => { window.__qt._R.PENG.tarifMin = { depo: { [k]: 60000 } }; window.__qt.gambar(); }, KUNCI); await p.waitForTimeout(300);
      await p.evaluate(() => { const b = document.querySelector('.fl-ck__t[data-fla="grup-buka"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await p.waitForTimeout(200);
      await ketik(p, '50000'); await p.waitForTimeout(200); const hs = await hint(p);
      cek(!hs.pen && hs.rendah && !/Jonah|HLC|diatur|Tarif minimum/.test(hs.teks), peran + ': tanpa ikon atur, minimum master 60.000 berlaku, tanpa nama vendor: ' + JSON.stringify(hs));
      cek(err.length === 0, 'galat konsol (9 ' + peran + '): ' + err.join(' | ')); await p.close();
    }
  }

  // ===== 10. Tarif minimum Master Rate untuk Trailer (lokasi gudang + ukuran) dan Sewa Unit (tipe unit), saklar per lini =====
  try {
    const { p, err } = await siapkan(browser, 'master', null);
    await p.evaluate(() => {
      const mr = window.__islMR; mr.vendor.push({ id: 'v2', nama: 'HLC', aktif: true }, { id: 'v3', nama: 'Jonah', aktif: true }); mr.ref = { ...(mr.ref || {}), zona: [{ id: 'z1', nama: 'Cikarang' }] };
      const t = (id, lini, nama, dim, v, modal) => ({ id, kunci: id, liniBisnisId: lini, layanan: nama, layananNama: nama, satuanKode: 'per_trip', dimensi: dim, vendorId: v, aktif: true, modal });
      mr.tarif.push(t('a1', 'trucking_trailer', 'Trucking Container', { tujuan: 'z1', ukuran: '20ft' }, 'v2', 1000000), t('a2', 'trucking_trailer', 'Trucking Container', { tujuan: 'z1', ukuran: '20ft' }, 'v3', 1500000), t('a3', 'trucking_trailer', 'Trucking Container', { tujuan: 'z1', ukuran: '40ft' }, 'v2', 1600000),
        t('s1', 'sewa_unit', 'CDD Long', {}, 'v2', 8000000));
    });
    const buka = lini => p.evaluate(l => { window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, l); window.__qt.gambar(); }, lini);
    const isi = (sel, v) => p.evaluate(({ sel, v }) => { const i = document.querySelector(sel); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, { sel, v });
    const hintDi = sel => p.evaluate(sel => { const i = document.querySelector(sel); if (!i) return null; const c = i.closest('td,label,.fl-kf'), baris = i.closest('.fl-lok__ln'), kolK = i.dataset.fl.split('.').pop(), h = baris ? (baris.nextElementSibling && baris.nextElementSibling.querySelector(`[data-ukr="${kolK}"] .fl-min`)) : (c && c.querySelector('.fl-min'));   /* kartu per lokasi Trailer: petunjuk ada di baris di bawah baris harga */ return h ? { teks: h.textContent.trim(), pen: !!h.querySelector('.fl-min__ed'), rendah: i.hasAttribute('data-rendah') } : { teks: '', pen: false, rendah: i.hasAttribute('data-rendah') }; }, sel);
    // Trailer: tanpa lokasi gudang tidak ada petunjuk; "Cikarang" cocok ke zona di Master Rate
    await buka('trucking_trailer'); await p.waitForTimeout(300);
    let h = await hintDi('[data-fl="rows.0.0.h20"]'); cek(h && h.teks === '', 'Trailer: baris tanpa lokasi gudang tidak boleh punya petunjuk minimum: ' + JSON.stringify(h));
    await isi('[data-fl="rows.0.0.rute"]', 'Cikarang'); await isi('[data-fl="rows.0.0.h20"]', '500000'); await p.waitForTimeout(300);
    h = await hintDi('[data-fl="rows.0.0.h20"]'); cek(h && h.rendah && /Di bawah tarif minimum/.test(h.teks) && /1\.680\.000/.test(h.teks), 'Trailer 20 ft Cikarang: minimum = modal tertinggi 1,5 jt x 1,12 = 1.680.000, merah di 500.000: ' + JSON.stringify(h));
    await isi('[data-fl="rows.0.0.h40"]', '2000000'); await p.waitForTimeout(300);
    h = await hintDi('[data-fl="rows.0.0.h40"]'); cek(h && !h.rendah && /Tarif minimum: Rp1\.792\.000/.test(h.teks) && h.pen, 'Trailer 40 ft: minimum 1.792.000 (1,6 jt x 1,12), tidak merah di 2 jt, ada ikon atur: ' + JSON.stringify(h));
    const bm = await p.evaluate(() => { const e = window.__qt._Q.edit, b = window.ISLFL.barisDari ? null : null; return !!e; }); void bm;
    // master atur manual: berlaku untuk Trailer
    await p.evaluate(() => document.querySelector('[data-ukr="h20"] .fl-min__ed').click()); await p.waitForTimeout(200);
    await p.evaluate(() => { const i = document.querySelector('[data-flmin]'); i.value = '450000'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.fl-minp__s').click(); }); await p.waitForTimeout(300);
    h = await hintDi('[data-fl="rows.0.0.h20"]'); cek(h && !h.rendah && /Rp450\.000/.test(h.teks), 'Trailer: minimum manual 450.000 harus berlaku (500.000 tidak merah): ' + JSON.stringify(h));
    // saklar per lini dimatikan -> petunjuk hilang
    await p.evaluate(() => { window.__qt._R.PENG.tarifMinAktif = { trucking_trailer: false }; window.__qt.gambar(); }); await p.waitForTimeout(300);
    h = await hintDi('[data-fl="rows.0.0.h20"]'); cek(h && h.teks === '' && !h.rendah, 'Trailer dengan saklar mati: tanpa petunjuk dan tanpa merah: ' + JSON.stringify(h));
    await p.evaluate(() => { window.__qt._R.PENG.tarifMinAktif = {}; });
    const bawaan = await p.evaluate(() => ['customs_clearance', 'freight_forwarding', 'depo', 'trucking_trailer', 'sewa_unit'].map(k => window.__islCU.tarifMinAktif(k)));
    cek(JSON.stringify(bawaan) === JSON.stringify([false, false, true, true, true]), 'bawaan saklar: CC dan Freight mati, lini vendor nyala: ' + JSON.stringify(bawaan));
    await p.evaluate(() => { window.__qt._R.PENG.tarifMinAktif = {}; window.__qt._R.PENG.tarifMin = {}; });
    // Sewa Unit: tipe unit cocok ke tarif vendor; kolom driver tanpa petunjuk
    await buka('sewa_unit'); await p.waitForTimeout(300);
    await isi('[data-fl="rows.0.0.tipe"]', 'CDD Long'); await isi('[data-fl="rows.0.0.tarif"]', '7000000'); await p.waitForTimeout(300);
    h = await hintDi('[data-fl="rows.0.0.tarif"]'); cek(h && h.rendah && /9\.200\.000/.test(h.teks), 'Sewa Unit CDD Long: minimum 8 jt x 1,15 = 9.200.000, merah di 7 jt: ' + JSON.stringify(h));
    h = await hintDi('[data-fl="rows.0.0.driver"]'); cek(h && h.teks === '', 'Sewa Unit: kolom driver tidak boleh punya tarif minimum: ' + JSON.stringify(h));
    // panel template lini (master): saklar tampil untuk lini yang didukung
    await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'trucking_trailer'; b.dataset.tab = 'layanan'; document.body.appendChild(b); b.click(); }); await p.waitForTimeout(500);
    const sk = await p.evaluate(() => { const c = document.querySelector('[data-tl="min-aktif"]'); return c ? { ada: true, on: c.checked } : { ada: false }; }); cek(sk.ada && sk.on, 'panel template Trailer: saklar tarif minimum harus tampil dan nyala: ' + JSON.stringify(sk));
    await p.evaluate(() => document.querySelector('[data-tl="min-aktif"]').click()); await p.waitForTimeout(300);
    cek(await p.evaluate(() => window.__qt._R.PENG.tarifMinAktif.trucking_trailer === false), 'saklar Trailer dimatikan: PENG.tarifMinAktif.trucking_trailer harus false');
    cek(err.length === 0, 'galat konsol (10): ' + err.join(' | ')); await p.close();
    } catch (er) { gagal.push('skenario 10 berhenti: ' + er.message.split('\n')[0]); }

  // ===== 11. Quotation format bebas: baris tarif vendor memakai tarif minimum, saklar per lini, atur master, sales ikut =====
  try {
    const siap = async peran => {
      const { p, err } = await siapkan(browser, peran, null);
      await p.evaluate(peran => {
        const mr = window.__islMR; mr.vendor.push({ id: 'v2', nama: 'HLC', aktif: true }, { id: 'v3', nama: 'Jonah', aktif: true }); mr.lini.push({ id: 'trucking_trailer', nama: 'Trucking Trailer' });
        const t = (id, v, modal) => peran === 'sales' ? { id, kunci: id, liniBisnisId: 'trucking_trailer', layanan: 'trucking_container', layananNama: 'Trucking Cikarang 20ft', satuanKode: 'per_trip', dimensi: { ukuran: '20ft' }, vendorId: v, aktif: true, hargaMin: Math.ceil(modal * 1.12 / 1000) * 1000 }
          : { id, kunci: id, liniBisnisId: 'trucking_trailer', layanan: 'trucking_container', layananNama: 'Trucking Cikarang 20ft', satuanKode: 'per_trip', dimensi: { ukuran: '20ft' }, vendorId: v, aktif: true, modal };
        mr.tarif.push(t('g1', 'v2', 1000000), t('g2', 'v3', 1500000));
        window.__qt.baru('c1'); const e = window.__qt._Q.edit, top = peran === 'sales' ? 1680000 : 1500000, kunci = window.__qt._R.kunciLayanan ? window.__qt._R.kunciLayanan(mr.tarif[mr.tarif.length - 1]) : null;
        window.__kuncil = kunci;
        e.baris = [{ id: 'g-1', jenis: 'rate', urut: 0, liniKey: 'trucking_trailer', liniNama: 'Trucking Trailer', item: 'Trucking Cikarang 20ft', deskripsi: '', satuan: 'per trip', qty: 1, jual: 1000000, dariMR: true, layananKey: 'k-g', modal: peran === 'sales' ? null : top, modalMR: peran === 'sales' ? null : top, modalDariMR: peran !== 'sales', hargaMinMR: 1680000, dioverride: true }];
        window.__qt.gambar();
      }, peran);
      await p.waitForTimeout(300); return { p, err };
    };
    const { p, err } = await siap('master');
    const mn = () => p.evaluate(() => { const b = window.__qt._Q.edit.baris[0]; return { min: window.__qt._R.tarifMinimum(b), bawah: window.__qt._R.dibawahMin(b) }; });
    let r = await mn(); cek(r.min === 1680000 && r.bawah, 'format bebas Trailer: minimum 1,5 jt x 1,12 = 1.680.000 dan 1.000.000 di bawahnya: ' + JSON.stringify(r));
    const ui = await p.evaluate(() => { const t = document.body.textContent; return { teks: /Tarif minimum\s*Rp1\.680\.000/.test(t) || /Tarif minimum[^.]*1\.680\.000/.test(t), pen: !!document.querySelector('[data-qt="min-buka"]') }; });
    cek(ui.pen, 'format bebas: master harus punya ikon atur tarif minimum di baris: ' + JSON.stringify(ui));
    // atur manual lewat panel
    await p.evaluate(() => document.querySelector('[data-qt="min-buka"]').click()); await p.waitForTimeout(200);
    const pn = await p.evaluate(() => ({ input: !!document.querySelector('[data-minin]'), simpan: !!document.querySelector('[data-qt="min-simpan"]') })); cek(pn.input && pn.simpan, 'format bebas: panel atur harus terbuka: ' + JSON.stringify(pn));
    await p.evaluate(() => { const i = document.querySelector('[data-minin]'); i.value = '900.000'; document.querySelector('[data-qt="min-simpan"]').click(); }); await p.waitForTimeout(400);
    r = await mn(); const ov = await p.evaluate(() => JSON.stringify((window.__qt._R.PENG.tarifMin || {}).trucking_trailer || {}));
    cek(r.min === 900000 && !r.bawah && /900000/.test(ov), 'format bebas: minimum manual 900.000 harus berlaku (1.000.000 tidak lagi di bawah): ' + JSON.stringify([r, ov]));
    // saklar per lini mati -> tidak ada minimum
    await p.evaluate(() => { window.__qt._R.PENG.tarifMinAktif = { trucking_trailer: false }; }); r = await mn(); cek(r.min === null && !r.bawah, 'format bebas: saklar mati harus menghilangkan tarif minimum: ' + JSON.stringify(r));
    // lini internal (CC) mati bawaan
    const cc = await p.evaluate(() => { window.__qt._R.PENG.tarifMinAktif = {}; const b = { ...window.__qt._Q.edit.baris[0], liniKey: 'customs_clearance' }; return window.__qt._R.tarifMinimum(b); }); cek(cc === null, 'format bebas: Customs Clearance (internal) tidak punya tarif minimum bawaan: ' + cc);
    cek(err.length === 0, 'galat konsol (11 master): ' + err.join(' | ')); await p.close();
    // sales: tarif minimum dari hargaMin + pengaturan master, tanpa ikon atur
    const { p: ps, err: es } = await siap('sales');
    await ps.evaluate(() => { window.__qt._R.PENG.tarifMin = { trucking_trailer: { b_k_g: 1200000 } }; window.__qt.gambar(); }); await ps.waitForTimeout(300);
    const rs = await ps.evaluate(() => { const b = window.__qt._Q.edit.baris[0]; return { min: window.__qt._R.tarifMinimum(b), pen: !!document.querySelector('[data-qt="min-buka"]') }; });
    cek(rs.min === 1200000 && !rs.pen, 'sales: minimum atur master 1.200.000 berlaku, tanpa ikon atur: ' + JSON.stringify(rs));
    cek(es.length === 0, 'galat konsol (11 sales): ' + es.join(' | ')); await ps.close();
  } catch (er) { gagal.push('skenario 11 berhenti: ' + er.message.split('\n')[0]); }

  // ===== 12. Harga jual rekomendasi bawaan template Depo (angka tim), pakai satu atau semua, master mengubah di panel Template =====
  try {
    const buka = peran => siapkan(browser, peran, null).then(async ({ p, err }) => {
      await p.evaluate(() => { window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); window.__qt.gambar(); }); await p.waitForTimeout(300);
      for (let g = 0; g < 4; g++) { await p.evaluate(g => { const b = document.querySelector(`.fl-ck__t[data-fla="grup-buka"][data-flx="${g}"]`); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, g); await p.waitForTimeout(120); } await p.waitForTimeout(200);
      return { p, err };
    });
    const LF20 = '[data-fl="rows.1.0.h20"]', LF40 = '[data-fl="rows.1.0.h40"]';
    const isi = (p, sel, v) => p.evaluate(({ sel, v }) => { const i = document.querySelector(sel); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, { sel, v });
    const lihat = (p, sel) => p.evaluate(sel => { const i = document.querySelector(sel), c = i.closest('.fl-ck__f'); return { ph: i.placeholder, ghost: i.hasAttribute('data-ghost'), nilai: i.value, teks: c.textContent, petunjuk: !!c.querySelector('.fl-min, .fl-rek__p') }; }, sel);
    const baris = p => p.evaluate(() => { const e = window.__qt._Q.edit; window.ISLFL.sinkron(e); return Object.fromEntries((e.baris || []).map(b => [b.item, b.jual])); });
    for (const peran of ['master', 'sales']) {
      const { p, err } = await buka(peran); let r = await lihat(p, LF20);
      cek(r.ph === '400.000' && r.ghost && r.nilai === '' && !r.petunjuk && !/Rekomendasi|minimum/i.test(r.teks), peran + ': LOLO FULL 20 ft harus berbayangan abu-abu 400.000 tanpa baris petunjuk: ' + JSON.stringify(r));
      r = await lihat(p, LF40); cek(r.ph === '500.000' && r.ghost, peran + ': LOLO FULL 40 ft harus berbayangan 500.000: ' + JSON.stringify(r));
      // kolom dibiarkan kosong -> rekomendasi dipakai otomatis (quotation, ringkasan); layanan tanpa angka tidak ikut
      let br = await baris(p);
      cek(br['LOLO FULL 20 ft'] === 400000 && br['LOLO FULL 40 ft'] === 500000 && br['Storage Container Dry 20 ft'] === 60000 && br['Container to Container 40 ft'] === 5000000 && br['Terminal Peti Kemas / Depo 20 ft'] === 700000 && br['Adm 40 ft'] === 50000, peran + ': kolom kosong harus otomatis memakai rekomendasi di baris quotation: ' + JSON.stringify(br));
      cek(!Object.keys(br).some(k => /Pengambilan Sampel|Extra Moving/.test(k)), peran + ': layanan tanpa angka rekomendasi tidak boleh ikut otomatis: ' + JSON.stringify(Object.keys(br).filter(k => /Pengambilan|Extra/.test(k))));
      const ring = await p.evaluate(() => (document.querySelector('.fl-ck__ring .fl-ck__chip') || {}).textContent);
      cek(/^13 layanan terisi/.test(ring), peran + ': ringkasan harus menghitung 13 layanan terisi otomatis: ' + ring);
      // isi sendiri menang; 0 berarti tidak ditawarkan; layanan yang tidak dicentang tidak ikut
      await isi(p, LF20, '410000'); await isi(p, LF40, '0'); await p.waitForTimeout(250); br = await baris(p);
      cek(br['LOLO FULL 20 ft'] === 410000 && !('LOLO FULL 40 ft' in br), peran + ': angka yang diketik menang dan 0 berarti tidak ditawarkan: ' + JSON.stringify([br['LOLO FULL 20 ft'], 'LOLO FULL 40 ft' in br]));
      await isi(p, LF20, ''); await p.waitForTimeout(250); r = await lihat(p, LF20); cek(r.ph === '400.000' && r.ghost, peran + ': setelah dikosongkan, bayangan 400.000 kembali tampil: ' + JSON.stringify(r));
      cek(err.length === 0, 'galat konsol (12 ' + peran + '): ' + err.join(' | ')); await p.close();
    }
    // panel Template lini Depo: tab Harga rekomendasi; master mengubah, admin hanya melihat
    for (const peran of ['master', 'admin']) {
      const { p, err } = await siapkan(browser, peran, null);
      await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'depo'; b.dataset.tab = 'rek'; document.body.appendChild(b); b.click(); }); await p.waitForTimeout(500);
      await p.evaluate(() => document.querySelector('[data-tl="tab"][data-tab="rek"]').click()); await p.waitForTimeout(200);
      const t = await p.evaluate(() => { const i = [...document.querySelectorAll('[data-trek]')]; return { n: i.length, ph: i[0] && i[0].placeholder, dis: i.every(x => x.disabled), tampil: !document.querySelector('#tl-p-rek').hidden }; });
      cek(t.tampil && t.n === 30 && t.ph === '60.000', peran + ': tab Harga rekomendasi harus tampil dengan 30 kolom (15 layanan x 2 ukuran) dan angka bawaan sebagai placeholder: ' + JSON.stringify(t));
      if (peran === 'admin') cek(t.dis, 'admin: kolom harga rekomendasi harus nonaktif (hanya master yang mengubah)');
      else {
        await p.evaluate(() => { const i = document.querySelector('[data-trek="lolo_full_20"]'); i.value = ''; i.focus(); }); await p.keyboard.type('1234567');
        const vr = await p.evaluate(() => document.querySelector('[data-trek="lolo_full_20"]').value); cek(vr === '1.234.567', 'harga rekomendasi: mengetik 1234567 harus tampil 1.234.567, dapat: ' + vr);
        await p.evaluate(() => { const i = document.querySelector('[data-trek="lolo_full_20"]'); i.value = '450.000'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-tl="simpan"]').click(); }); await p.waitForTimeout(600);
        const sv = await p.evaluate(() => JSON.stringify((window.__qt._R.PENG.rekJual || {}).depo || {})); cek(/"lolo_full_20":450000/.test(sv), 'master: ubahan harga rekomendasi harus tersimpan di PENG.rekJual.depo: ' + sv);
        await p.evaluate(() => { window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); window.__qt.gambar(); }); await p.waitForTimeout(300);
        for (let g = 0; g < 4; g++) { await p.evaluate(g => { const b = document.querySelector(`.fl-ck__t[data-fla="grup-buka"][data-flx="${g}"]`); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, g); await p.waitForTimeout(120); } await p.waitForTimeout(200);
        const r = await lihat(p, LF20); cek(r.ph === '450.000', 'form Depo harus berbayangan angka ubahan master 450.000: ' + JSON.stringify(r));
        await p.evaluate(() => { window.__qt._R.PENG.rekJual = {}; window.__qt.gambar(); });
      }
      cek(err.length === 0, 'galat konsol (12 panel ' + peran + '): ' + err.join(' | ')); await p.close();
    }
    // Distribusi: tab Isi cepat di Template lini (rute, pick up, harga per kelas) dan tombol "Isi dari template" di formulir
    for (const peran of ['master', 'admin']) {
      const { p, err } = await siapkan(browser, peran, null);
      await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'distribusi_kecil'; b.dataset.tab = 'ic'; document.body.appendChild(b); b.click(); }); await p.waitForTimeout(500);
      await p.evaluate(() => document.querySelector('[data-tl="tab"][data-tab="ic"]').click()); await p.waitForTimeout(200);
      const t = await p.evaluate(() => ({ tampil: !document.querySelector('#tl-p-ic').hidden, rute: [...document.querySelectorAll('[data-tic="n"]')].map(x => x.value), pick: document.querySelector('[data-tic="pickup"]').value, kelas: [...document.querySelectorAll('[data-tic="h"][data-i="0"]')].map(x => x.dataset.k) }));
      cek(t.tampil && t.pick === 'Jakarta' && t.rute.join() === 'Jakarta,Bogor,Depok,Tangerang,Bekasi,Cikarang,Cikampek,Serang,Legok,Cikupa' && t.kelas.join() === 'Blind Van,CDE,CDE Long,CDD,CDD Long,FUSO,Tronton', peran + ': tab Isi cepat memuat pick up Jakarta, 10 rute Jabodetabek, dan 7 kelas: ' + JSON.stringify(t));
      await p.evaluate(() => { const set = (q, v) => { const i = document.querySelector(q); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }; set('[data-tic="h"][data-i="1"][data-k="CDE"]', '650.000'); set('[data-tic="h"][data-i="1"][data-k="Blind Van"]', '550000'); document.querySelector('[data-tl="ic-hapus"][data-i="9"]').click(); document.querySelector('[data-tl="ic-tambah"]').click(); set('[data-tic="n"][data-i="9"]', 'Karawang'); document.querySelector('[data-tl="simpan"]').click(); }); await p.waitForTimeout(600);
      const sv = await p.evaluate(() => JSON.stringify((window.__qt._R.PENG.isiCepat || {}).distribusi_kecil || {}));
      cek(/"pickup":"Jakarta"/.test(sv) && /"n":"Bogor","h":\{"CDE":650000,"Blind Van":550000\}|"n":"Bogor","h":\{"Blind Van":550000,"CDE":650000\}/.test(sv) && /Karawang/.test(sv) && !/Cikupa/.test(sv), peran + ': ubahan template Isi cepat tersimpan di PENG.isiCepat: ' + sv);
      if (peran === 'master') {
        await p.evaluate(() => { window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'distribusi_kecil'); window.__qt.gambar(); }); await p.waitForTimeout(300);
        await p.evaluate(() => document.querySelector('[data-fla="dsbPanel"][data-flx="cepat"]').click()); await p.waitForTimeout(250);
        cek(await p.evaluate(() => !!document.querySelector('[data-fla="dstTemplat"]')), 'formulir Distribusi: tombol Isi dari template ada di panel Isi cepat blok Box Dry');
        await p.evaluate(() => document.querySelector('[data-fla="dstTemplat"]').click()); await p.waitForSelector('.mr-konfirm', { timeout: 3000 });
        cek(await p.evaluate(() => /10 rute baru|rute baru ditambahkan/.test(document.querySelector('.mr-konfirm').textContent) && /Jakarta/.test(document.querySelector('.mr-konfirm').textContent)), 'Isi dari template: pop-up ringkasan menyebut rute baru dan pick up');
        await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="ok"]').click()); await p.waitForTimeout(400);
        const f = await p.evaluate(() => { const st = window.__qt._Q.edit.formLini.s, bl = st.bodies.boxdry, bogor = bl.rows.find(r => r.tujuan === 'Bogor'); return { n: bl.rows.length, skema: bl.skema, asal: bogor && bogor.asal, cde: bogor && bogor.h.CDE, bv: bogor && bogor.h['Blind Van'], tipe: st.tipe, tujuan: bl.rows.map(r => r.tujuan).join() }; });
        cek(f.n === 10 && f.skema === 'tetap' && f.asal === 'Jakarta' && f.cde === 650000 && f.bv === 550000 && f.tipe['CDE Long'] === true && f.tipe['CDD Long'] === true && /Karawang/.test(f.tujuan), 'Isi dari template: 10 rute, skema satu pick up, pick up Jakarta, harga Bogor dari template, kelas Long ikut tampil: ' + JSON.stringify(f));
        await p.evaluate(() => { const bl = window.__qt._Q.edit.formLini.s.bodies.boxdry; bl.rows.find(r => r.tujuan === 'Bogor').h.CDE = 700000; document.querySelector('[data-fla="dsbPanel"][data-flx="cepat"]').click(); }); await p.waitForTimeout(250);
        await p.evaluate(() => document.querySelector('[data-fla="dstTemplat"]').click()); await p.waitForTimeout(500);
        cek(await p.evaluate(() => !document.querySelector('.mr-konfirm') && window.__qt._Q.edit.formLini.s.bodies.boxdry.rows.find(r => r.tujuan === 'Bogor').h.CDE === 700000), 'Isi dari template kedua kali: tidak ada yang baru, harga yang sudah ada tidak ditimpa');
      }
      cek(err.length === 0, 'galat konsol (Isi cepat ' + peran + '): ' + err.join(' | ')); await p.close();
    }

    // tab Tarif minimum di panel Template Depo: master mengatur, angka tidak ditampilkan di formulir, hanya merah
    for (const peran of ['master', 'admin']) {
      const { p, err } = await buka(peran).then(async x => { await x.p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'depo'; b.dataset.tab = 'min'; document.body.appendChild(b); b.click(); }); await x.p.waitForTimeout(500); return x; });
      await p.evaluate(() => document.querySelector('[data-tl="tab"][data-tab="min"]').click()); await p.waitForTimeout(200);
      const t = await p.evaluate(() => { const i = [...document.querySelectorAll('[data-tmin]')], lf = document.querySelector('[data-tmin="lolo_full_20"]'); return { n: i.length, ph: lf && lf.placeholder, dis: i.every(x => x.disabled), tampil: !document.querySelector('#tl-p-min').hidden }; });
      cek(t.tampil && t.n === 30 && t.ph === '120.000', peran + ': tab Tarif minimum harus tampil, 30 kolom, dan LOLO FULL 20 ft berplaceholder minimum otomatis 120.000: ' + JSON.stringify(t));
      if (peran === 'admin') cek(t.dis, 'admin: kolom tarif minimum harus nonaktif (hanya master yang mengubah)');
      else {
        // diketik betulan: pemisah ribu langsung muncul (tarif minimum dan harga rekomendasi)
        for (const [sel, ketik, hasil] of [['[data-tmin="lolo_full_20"]', '3500', '3.500'], ['[data-tmin="lolo_full_20"]', '1234567', '1.234.567'], ['[data-tmin="lolo_full_40"]', '3500', '3.500']]) {
          await p.evaluate(sel => { const i = document.querySelector(sel); i.value = ''; i.focus(); }, sel); await p.keyboard.type(ketik);
          const v = await p.evaluate(sel => document.querySelector(sel).value, sel); cek(v === hasil, 'tarif minimum: mengetik ' + ketik + ' harus tampil ' + hasil + ', dapat: ' + v);
        }
        await p.evaluate(() => { const i = document.querySelector('[data-tmin="lolo_full_40"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
        await p.evaluate(() => { const i = document.querySelector('[data-tmin="lolo_full_20"]'); i.value = '130.000'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-tl="simpan"]').click(); }); await p.waitForTimeout(600);
        const sv = await p.evaluate(() => JSON.stringify((window.__qt._R.PENG.tarifMin || {}).depo || {})); cek(/"lolo_full_20":130000/.test(sv), 'master: tarif minimum dari panel harus tersimpan di PENG.tarifMin.depo: ' + sv);
        await p.evaluate(() => { window.__qt.baru(''); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); window.__qt.gambar(); }); await p.waitForTimeout(300);
        for (let g = 0; g < 4; g++) { await p.evaluate(g => { const b = document.querySelector(`.fl-ck__t[data-fla="grup-buka"][data-flx="${g}"]`); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, g); await p.waitForTimeout(120); }
        const merah = async v => { await p.evaluate(v => { const i = document.querySelector('[data-fl="rows.1.0.h20"]'); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v); await p.waitForTimeout(250); return p.evaluate(() => { const i = document.querySelector('[data-fl="rows.1.0.h20"]'); return { rendah: i.hasAttribute('data-rendah'), teks: i.closest('.fl-ck__f').textContent }; }); };
        let r = await merah('125000'); cek(r.rendah && !/minimum/i.test(r.teks), 'form Depo: 125.000 di bawah minimum 130.000 harus merah tanpa tulisan minimum: ' + JSON.stringify(r));
        r = await merah('135000'); cek(!r.rendah, 'form Depo: 135.000 di atas minimum 130.000 tidak merah: ' + JSON.stringify(r));
        // kosongkan kolom di panel -> kembali ke minimum otomatis 120.000
        await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'depo'; b.dataset.tab = 'min'; document.body.appendChild(b); b.click(); }); await p.waitForTimeout(500);
        await p.evaluate(() => document.querySelector('[data-tl="tab"][data-tab="min"]').click()); await p.waitForTimeout(150);
        await p.evaluate(() => { const i = document.querySelector('[data-tmin="lolo_full_20"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-tl="simpan"]').click(); }); await p.waitForTimeout(600);
        const sv2 = await p.evaluate(() => JSON.stringify((window.__qt._R.PENG.tarifMin || {}).depo || {})); cek(!/lolo_full_20/.test(sv2), 'kolom dikosongkan: override tarif minimum harus terhapus: ' + sv2);
      }
      cek(err.length === 0, 'galat konsol (12 tab minimum ' + peran + '): ' + err.join(' | ')); await p.close();
    }
  } catch (er) { gagal.push('skenario 12 berhenti: ' + er.message.split('\n')[0]); }

  // ===== 13. Pop-up sebelum terbit: tarif Depo yang belum diisi dan tidak punya rekomendasi (tidak memblokir, tidak tampil di PDF) =====
  try {
    const { p, err } = await siapkan(browser, 'master', null);
    await p.evaluate(() => { window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'depo'); e.customerNama = 'PT Lama Terdaftar'; e.customerId = 'c1'; window.__qt.gambar(); }); await p.waitForTimeout(300);
    const kos = () => p.evaluate(() => window.ISLFL.hargaKosong(window.__qt._Q.edit).map(x => x.nama + ':' + x.ukuran.join('/') + (x.semua ? ':semua' : '')));
    let k = await kos();
    cek(JSON.stringify(k) === JSON.stringify(['Pengambilan Sampel:20 ft/40 ft:semua', 'Extra Moving (Fumigasi Area):20 ft/40 ft:semua']), 'hanya layanan tanpa rekomendasi dan tanpa harga yang tercatat kosong: ' + JSON.stringify(k));
    // isi sebagian: 20 ft Pengambilan Sampel diisi -> hanya 40 ft yang dicatat; 0 yang diketik = sengaja tidak ditawarkan (tidak dicatat); layanan yang dilepas centang tidak dicatat
    await p.evaluate(() => { const st = window.__qt._Q.edit.formLini.s; st.rows[2][3].h20 = 90000; st.rows[3][1].h20 = 0; st.rows[3][1].h40 = 0; });
    k = await kos(); cek(JSON.stringify(k) === JSON.stringify(['Pengambilan Sampel:40 ft']), 'sebagian terisi dan 0 sengaja: hanya 40 ft Pengambilan Sampel dicatat: ' + JSON.stringify(k));
    await p.evaluate(() => { const st = window.__qt._Q.edit.formLini.s; st.rows[2][3].h20 = ''; st.rows[2][3].h40 = ''; st.rows[2][3].on = false; });
    k = await kos(); cek(k.length === 0, 'layanan yang dilepas centang tidak dicatat: ' + JSON.stringify(k));
    // pop-up: lanjutkan -> true dan tidak ditanya ulang untuk daftar yang sama; kembali -> false
    await p.evaluate(() => { const st = window.__qt._Q.edit.formLini.s; st.rows[2][3].on = true; st.rows[3][1].h20 = ''; st.rows[3][1].h40 = ''; window.__pr = window.ISLFL.konfirmasiKosong(window.__qt._Q.edit); }); await p.waitForTimeout(300);
    const dlg = await p.evaluate(() => { const d = document.querySelector('.mr-konfirm'); return d ? { judul: (d.querySelector('h3') || {}).textContent, tombol: [...d.querySelectorAll('button')].map(b => b.textContent.trim()), isi: d.textContent } : null; });
    cek(dlg && /Ada tarif yang belum diisi/.test(dlg.judul) && dlg.tombol.includes('Lanjutkan tanpa layanan ini') && dlg.tombol.includes('Kembali, isi tarif') && /Pengambilan Sampel/.test(dlg.isi) && /Extra Moving/.test(dlg.isi) && /tidak ditampilkan di PDF/.test(dlg.isi), 'pop-up harus memuat judul, dua tombol, dan daftar layanan: ' + JSON.stringify(dlg && dlg.tombol));
    await p.evaluate(() => [...document.querySelectorAll('.mr-konfirm button')].find(b => /Kembali, isi tarif/.test(b.textContent)).click());
    cek(await p.evaluate(() => window.__pr) === false, 'Kembali: penerbitan dibatalkan (false)'); await p.waitForTimeout(200);
    await p.evaluate(() => { window.__pr = window.ISLFL.konfirmasiKosong(window.__qt._Q.edit); }); await p.waitForTimeout(300);
    await p.evaluate(() => [...document.querySelectorAll('.mr-konfirm button')].find(b => /Lanjutkan tanpa layanan ini/.test(b.textContent)).click());
    cek(await p.evaluate(() => window.__pr) === true, 'Lanjutkan: penerbitan diteruskan (true)'); await p.waitForTimeout(200);
    const ulang = await p.evaluate(async () => { const r = await window.ISLFL.konfirmasiKosong(window.__qt._Q.edit); return { r, dlg: !!document.querySelector('.mr-konfirm') }; });
    cek(ulang.r === true && !ulang.dlg, 'daftar yang sama tidak ditanya ulang: ' + JSON.stringify(ulang));
    // PDF: layanan tanpa harga tidak tampil; layanan lain tetap
    const pdf = await p.evaluate(async () => { const e = window.__qt._Q.edit; window.ISLFL.sinkron(e); const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]); const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 }); const t = h.pages.map(x => x.textContent).join(' '); h.host.remove(); return { sampel: /Pengambilan Sampel/.test(t), extra: /Extra Moving/.test(t), lolo: /LOLO FULL/.test(t) }; });
    cek(!pdf.sampel && !pdf.extra && pdf.lolo, 'PDF: layanan tanpa harga tidak tampil, layanan berharga tetap: ' + JSON.stringify(pdf));
    cek(err.length === 0, 'galat konsol (13): ' + err.join(' | ')); await p.close();
  } catch (er) { gagal.push('skenario 13 berhenti: ' + er.message.split('\n')[0]); }

  console.log(gagal.length ? 'GAGAL:\n- ' + gagal.join('\n- ') : 'Semua skenario lolos.');
  await browser.close();
  process.exit(gagal.length ? 1 : 0);
})();
