// Uji tabel PDF desain C "kartu ringan" untuk Depo, Trailer, dan Customs Clearance (dipilih 3 Nov 2026):
// - susunan tabel baru (3 kolom, satuan/keterangan sub-baris, awalan Rp, lencana huruf per kelompok)
// - judul kolom hanya sekali per halaman
// - satu kelompok tidak terpotong antar halaman (pindah utuh ke halaman berikutnya)
// - dokumen terbit lama (kelas isl-dep, 4 kolom) tetap dirender dengan gaya lama
// - tanggal ringkas: tanggal di bawah tanda tangan ISL dihapus (cukup tanggal kepala surat), isian tanggal customer sejajar dengan keterangan nama jelas; dokumen lama tidak berubah
// Berjalan lokal: NODE_PATH=<folder node_modules berisi playwright> node tests/asap/uji-kartu.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', '..', 'public') + path.sep;
const gagal = [];
const cek = (k, m) => { if (!k) gagal.push(m); };

async function siapkan(browser) {
  const p = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.setContent(`<!doctype html><meta charset=utf-8><style>${['style', 'master-rate', 'app', 'tambahan'].map(f => fs.readFileSync(R + 'css/' + f + '.css', 'utf8')).join('')}</style><div id="sinkron-banner"></div><nav id="app-nav"></nav><div id="cu-root" class="hidden"></div><div id="qt-root"></div><div id="mr-layer"></div><div id="lp-root" class="hidden"></div><div id="lr-root" class="hidden"></div><div id="toasts"></div>`);
  await p.evaluate(() => {
    const profil = { uid: 'u', email: 'm@isl.test', peran: 'master', status: 'aktif', sembunyi: {} };
    window.__ISL_PROFIL = profil; window.__islSimpanProfil = async () => {};
    window.__ISL = { email: profil.email, master: true, kelola: true, admin: false, sales: false, uid: 'u', peran: 'master', nama: 'master', hariIni: () => '2026-11-03', tulis: async (k, v) => { k(); }, unggahBlob: async () => '', diagnosa: async () => [], buatLini: async () => {}, simpanMarkupLini: async () => {}, tarifTambah: async () => ({}), navAktif: () => {} };
    window.__islMR = { tarif: [], vendor: [], lini: [{ id: 'depo', nama: 'Depo Container' }, { id: 'trucking_trailer', nama: 'Trucking Trailer' }, { id: 'customs_clearance', nama: 'Customs Clearance' }], satuan: [], ref: {}, user: { email: profil.email } };
    window.__ISL_DATA = { customers: [{ id: 'c1', nama: 'PT Sinar Makmur Abadi', status: 'aktif', kontak: [], legalitas: [], alamat: 'Jakarta' }], rates: [], paket: [], orders: [], counters: [], layanan: [], quotations: [], templates: [], riwayat: [], pengaturan: null };
  });
  for (const f of ['js/logo.js', 'js/formulir-lini.js', 'js/sales.js', 'js/app-core.js']) await p.addScriptTag({ content: fs.readFileSync(R + f, 'utf8') });
  await p.waitForTimeout(400);
  return { p, err };
}

const modelLini = (p, lini) => p.evaluate(lini => {
  window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, lini); const st = e.formLini.s;
  if (lini === 'depo') Object.values(st.rows).forEach((rows, bi) => rows.forEach((r, i) => { r.h20 = 40000 + (bi * 7 + i) * 15000; r.h40 = r.h20 + 25000; if (bi === 2 && i === 3) r.h40 = ''; }));
  else { const k = Object.keys(st.rows)[0]; st.rows[k].forEach((r, i) => { r.h20 = 900000 + i * 150000; r.h40 = 1300000 + i * 150000; r.rute = 'Gudang ' + (i + 1); r.ket = i === 0 ? 'Rangka, Head Tronton' : ''; }); }
  e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Penawaran'; e.berlakuSampai = '2026-12-03'; window.ISLFL.sinkron(e);
  return window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]);
}, lini);

const render = (p, m, d) => p.evaluate(async ({ m, d }) => {
  const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: d });
  await window.__qt._tungguGambar(h.host);
  const hasil = h.pages.map(pg => [...pg.querySelectorAll('table.isl-t.isl-fl')].map(t => ({
    kelas: t.className, baris: t.querySelectorAll('tbody tr').length, thead: t.querySelectorAll('thead').length, th: [...t.querySelectorAll('thead th')].map(x => x.textContent), cap: (t.querySelector('caption') || {}).textContent || '',
    lencana: (t.querySelector('caption .bd') || {}).textContent || '', lanjutan: /lanjutan/i.test(((t.querySelector('caption') || {}).textContent || '') + [...t.querySelectorAll('thead th')].map(x => x.textContent).join('')), kolom: t.querySelectorAll('colgroup col').length,
    sel: [...t.querySelectorAll('tbody tr:first-child td')].map(x => ({ t: x.textContent, rp: !!x.querySelector('.rp'), sat: (x.querySelector('.isl-sat') || {}).textContent || '' }))
  })));
  h.host.remove(); return hasil;
}, { m, d });

(async () => {
  const browser = await chromium.launch();
  const { p, err } = await siapkan(browser);

  // ===== Depo =====
  const depo = await modelLini(p, 'depo');
  cek(depo.fl.blok.length === 4 && depo.fl.blok.every(b => /isl-kartu--dep/.test(b.kelas) && !/isl-dep\b/.test(b.kelas)), 'depo: blok harus berkelas isl-kartu (bukan isl-dep): ' + JSON.stringify(depo.fl.blok.map(b => b.kelas)));
  cek(depo.fl.blok.map(b => b.huruf).join('') === 'ABCD', 'depo: lencana huruf harus A-D berurutan');
  for (const d of [0, 1, 2]) {
    const hal = await render(p, depo, d), semua = hal.flat();
    cek(semua.length === 4 && semua.every(t => !t.lanjutan), `depo d${d}: setiap kelompok harus utuh (empat kartu, tanpa "lanjutan"): ${JSON.stringify(semua.map(t => [t.cap, t.baris, t.lanjutan]))}`);
    cek(hal.every(pg => pg.reduce((a, t) => a + t.thead, 0) <= 1), `depo d${d}: judul kolom harus sekali per halaman`);
    cek(hal.every(pg => !pg.length || pg[0].thead === 1), `depo d${d}: kartu pertama di tiap halaman harus memuat judul kolom`);
    cek(semua.every(t => t.kolom === 3), `depo d${d}: tabel harus 3 kolom (tanpa kolom Note)`);
    const t0 = semua[0]; cek(t0.th.join('|') === 'Layanan|20 ft|40 ft' && t0.lencana === 'A', `depo d${d}: judul kolom/lencana salah: ${JSON.stringify(t0.th)} ${t0.lencana}`);
    cek(t0.sel[0].sat === 'per hari' && t0.sel[1].rp && /45\.000|40\.000/.test(t0.sel[1].t), `depo d${d}: satuan harus sub-baris dan harga berawalan Rp: ${JSON.stringify(t0.sel)}`);
  }
  // kolom kosong tidak diberi awalan Rp
  const hal0 = await render(p, depo, 0), kosong = await p.evaluate(m => { const b = m.fl.blok[2].baris[3].c; return b.map(c => ({ v: c.v, rp: !!c.rp })); }, depo);
  cek(kosong[2].v === '—' && kosong[2].rp === true, 'depo: sel kosong harus tetap berisi tanda "—"');
  cek(hal0.length >= 1, 'depo: tidak ada halaman');

  // ===== Trailer =====
  const trl = await modelLini(p, 'trucking_trailer');
  const tTrl = trl.fl.blok.filter(b => b.jenis === 'tabel'), jTrl = trl.fl.blok.filter(b => b.jenis === 'jalur');
  cek(tTrl.length >= 1 && tTrl.every(b => /isl-kartu--trl/.test(b.kelas) && /isl-kartu--cc/.test(b.kelas)), 'trailer: tabel harus berkelas isl-kartu--trl dan isl-kartu--cc: ' + JSON.stringify(tTrl.map(b => b.kelas)));
  cek(jTrl.length === 1 && jTrl[0].warna === 'isl' && !tTrl.some(b => b.cap) && !/"l":"[A-Za-z]/.test(JSON.stringify(tTrl)), 'trailer: Rangka saja = satu pita biru ISL jenis pengiriman, tanpa lencana buntut dan tanpa caption lama: ' + JSON.stringify(jTrl.map(b => [b.warna, b.teks])));
  const th = (await render(p, trl, 0)).flat();
  cek(th.length >= 1 && th[0].kolom === 3 && th[0].sel[0].sat === 'Rangka, Head Tronton' && th[0].sel[1].rp, 'trailer: keterangan harus sub-baris di bawah lokasi dan harga berawalan Rp: ' + JSON.stringify(th[0] && th[0].sel));

  // buntut di dalam sel tarif: Rangka tanpa lencana, buntut lain berlencana; baris dengan lokasi sama digabung; domestik: rute bebas jadi panah, tanpa port
  const mb = await p.evaluate(() => {
    window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'trucking_trailer'); const st = e.formLini.s;
    st.rows['0'] = [{ g: 'x', rute: 'Cikarang', h20: 2300000, h40: 2400000, bnt: '', ket: 'Head Tronton' }, { g: 'y', rute: 'Cikupa', h20: 2400000, h40: 2500000, bnt: '', ket: '' }, { g: 'x', rute: '', h20: 3000000, h40: 3200000, bnt: 'flatbed', ket: 'Muatan berat' }];
    st.off = {}; st.rows['1'] = [{ g: 'r', rute: 'Depo Cikarang - Gudang Cibitung', h20: 1500000, h40: 1700000, bnt: '', ket: '' }]; st.rows['2'] = [{ rute: 'Jakarta - Surabaya - Bandung', h20: 14000000, h40: 15500000, bnt: '', ket: '' }];
    e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Penawaran'; e.berlakuSampai = '2026-12-03'; window.ISLFL.sinkron(e);
    const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]); return { blok: m.fl.blok, cek: window.ISLFL.validasi(e) };
  });
  const tb2 = mb.blok.filter(b => b.jenis === 'tabel'), jl2 = mb.blok.filter(b => b.jenis === 'jalur');
  cek(jl2.length === 3 && jl2.every(b => b.warna === 'isl') && /Import dan Export — Pick up Tanjung Priok/.test(jl2[0].teks) && jl2[1].teks === 'REPO' && jl2[2].teks === 'Domestik', 'blok: tiga pita biru ISL berurutan Import dan Export (+ port), REPO, Domestik (REPO dan Domestik tanpa port): ' + JSON.stringify(jl2.map(b => b.teks)));
  const [ei, rp, dm] = tb2;
  cek(ei.baris.length === 2 && ei.baris[0].c[0].v === 'Cikarang' && ei.baris[0].c[0].sat === 'Head Tronton · Flatbed: Muatan berat', 'buntut: baris satu kartu (g sama) harus digabung, lokasi diwarisi dari kepala, keterangan kartu tanpa awalan: ' + JSON.stringify(ei.baris.map(r => r.c[0])));
  const ln = ei.baris[0].c[1].ln;
  cek(ln.length === 2 && ln[0].l === '' && ln[0].v === '2.300.000' && ln[1].l === 'Flatbed' && ln[1].w === 'oranye' && ln[1].v === '3.000.000' && !ei.baris[1].c[1].ln.some(x => x.l), 'buntut: Rangka tanpa lencana, Flatbed berlencana oranye di bawahnya: ' + JSON.stringify(ln));
  cek(rp.kolom[0].h === 'Rute' && rp.baris.length === 1 && rp.baris[0].c[0].v === 'Depo Cikarang → Gudang Cibitung' && !ei.baris.some(r => /Cibitung/.test(r.c[0].v)), 'REPO: blok sendiri (tidak digabung ke Import dan Export), rute bebas dengan panah: ' + JSON.stringify(rp.baris.map(r => r.c[0])));
  cek(dm.kolom[0].h === 'Rute' && dm.baris[0].c[0].v === 'Jakarta → Surabaya → Bandung', 'domestik: kolom Rute dan pemisah jadi panah: ' + JSON.stringify(dm.baris[0].c[0]));
  cek(mb.cek.some(x => /Flatbed/.test(x)), 'buntut: S&K Flatbed wajib karena ada tarif Flatbed di baris: ' + JSON.stringify(mb.cek));
  // buntut dikosongkan = Rangka standar: tidak memblokir penerbitan (S&K Rangka tidak wajib), tanpa pilihan buntut apa pun
  const rk = await p.evaluate(() => { window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'trucking_trailer'); const r = e.formLini.s.rows['0'][0]; Object.assign(r, { rute: 'Cikarang', h20: 2300000, h40: 2400000, bnt: '' });
    e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Penawaran'; e.berlakuSampai = '2026-12-03'; window.ISLFL.sinkron(e); return window.ISLFL.validasi(e); });
  cek(!rk.some(x => /buntut/i.test(x)), 'buntut kosong (Rangka standar) tidak boleh memblokir: ' + JSON.stringify(rk));

  // harga referensi Import dan Export (logika seperti Customs Clearance): harga kosong buntut standar memakai referensi; tarif vendor yang lebih tinggi menggantikannya
  const refHasil = () => p.evaluate(() => {
    window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'trucking_trailer'); const st = e.formLini.s;
    st.rows['0'] = [{ g: 'a', rute: 'Cikarang', h20: '', h40: '', bnt: '' }, { g: 'a', rute: '', h20: 3000000, h40: '', bnt: 'Flatbed' }, { g: 'b', rute: 'subang', h20: 4000000, h40: '', bnt: '' }, { g: 'c', rute: 'Gudang Tak Dikenal', h20: '', h40: '', bnt: '' }];
    e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Penawaran'; e.berlakuSampai = '2026-12-03'; window.ISLFL.sinkron(e);
    const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]), t = m.fl.blok.find(b => b.jenis === 'tabel');
    return { baris: t.baris.map(r => [r.c[0].v, (r.c[1].ln || []).map(x => x.v).join('|'), (r.c[2].ln || []).map(x => x.v).join('|')]) };
  });
  const r1 = await refHasil();
  cek(JSON.stringify(r1.baris) === JSON.stringify([['Cikarang', '2.200.000|3.000.000', '2.300.000|—'], ['subang', '4.000.000', '3.300.000']]), 'referensi: harga kosong buntut standar diisi referensi, ketikan tetap, Flatbed tanpa referensi, lokasi tak dikenal tanpa harga tidak masuk: ' + JSON.stringify(r1.baris));
  await p.evaluate(() => { window.__islMR.tarif.push({ id: 'tref1', liniBisnisId: 'trucking_trailer', layanan: 'tp_cikarang', layananNama: 'Tanjung Priok – Cikarang', dimensi: { ukuran: '20ft' }, satuanKode: 'per_trip', vendorId: 'vref', modal: 2500000, aktif: true }); });
  const r2 = await refHasil();
  cek(/^2\.[89]\d\d\.000$|^3\.\d{3}\.000$/.test(r2.baris[0][1].split('|')[0]) && r2.baris[0][2].split('|')[0] === '2.300.000', 'referensi: tarif vendor Master Rate yang lebih tinggi harus menggantikan referensi (20 ft Cikarang), ukuran lain tetap: ' + JSON.stringify(r2.baris));
  await p.evaluate(() => { window.__islMR.tarif = window.__islMR.tarif.filter(t => t.id !== 'tref1'); });

  // kelompok lebih tinggi dari satu halaman: mengalir mulai dari halaman berjalan (bukan halaman kosong), judul kolom dan "lanjutan" di tiap halaman
  const besar = await p.evaluate(m => { const k = JSON.parse(JSON.stringify(m)), b = k.fl.blok.find(x => x.jenis === 'tabel'); for (let i = 0; i < 60; i++) b.baris.push({ c: [{ v: 'Gudang ekstra ' + i, b: true, sat: '' }, { v: '1.000.000', rp: true }, { v: '1.500.000', rp: true }] }); return k; }, trl);
  const hb = await render(p, besar, 0), tb = hb.flat();
  cek(hb[0].length >= 1 && hb[0].slice(-1)[0].baris >= 5, 'kelompok besar: halaman 1 tidak boleh kosong, harus mulai terisi: ' + JSON.stringify(hb.map(pg => pg.map(t => t.baris))));
  cek(tb.reduce((a, t) => a + t.baris, 0) === besar.fl.blok.filter(x => x.jenis === 'tabel').reduce((a, x) => a + x.baris.length, 0), 'kelompok besar: jumlah baris hilang atau dobel');
  cek(tb.slice(1).every(t => t.lanjutan && t.thead === 1), 'kelompok besar: halaman lanjutan harus bertanda lanjutan dan memuat judul kolom');

  // ===== Dokumen terbit lama (kelas isl-dep, 4 kolom) tetap memakai gaya lama =====
  const lama = JSON.parse(JSON.stringify(depo));
  lama.fl.blok = depo.fl.blok.map(b => ({ jenis: 'tabel', kelas: 'isl-dep', cap: b.cap, sub: b.sub, kolom: [{ h: 'Layanan', w: 40, a: 'l' }, { h: '20 ft (Rp)', w: 18, a: 'c' }, { h: '40 ft (Rp)', w: 18, a: 'c' }, { h: 'Note', w: 24, a: 'l' }], baris: b.baris.map(r => ({ c: [r.c[0].v, r.c[1].v, r.c[2].v, r.c[0].sat || '—'] })) }));
  const hl = (await render(p, lama, 0)).flat();
  cek(hl.length >= 4 && hl.every(t => /isl-dep\b/.test(t.kelas) && !/isl-kartu/.test(t.kelas) && t.kolom === 4 && t.thead === 1 && t.lencana === ''), 'dokumen lama: harus tetap gaya isl-dep (4 kolom, judul kolom tiap kelompok, tanpa lencana): ' + JSON.stringify(hl.map(t => [t.kelas, t.kolom, t.thead])));

  // ===== Customs Clearance: kartu ringan (desain C, 4 Nov 2026): pita jalur tipis (hijau, merah, biru PIB/PEB, oranye Layanan Tambahan) + kartu per sub-kelompok, kepala kartu sendiri =====
  const ccModel = (bahasa) => p.evaluate(b => {
    window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'customs_clearance');
    for (let i = 0; i < 31; i++) e.formLini.s.pilih['b' + i] = { jual: 100000 + i * 17000 };
    e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Penawaran'; e.berlakuSampai = '2026-12-31'; e.bahasa = b; window.ISLFL.sinkron(e);
    return window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]);
  }, bahasa);
  const lihatCC = m => p.evaluate(async m => {
    const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 }); await window.__qt._tungguGambar(h.host);
    const tb = h.pages.flatMap(pg => [...pg.querySelectorAll('table.isl-t.isl-fl')]), r = {
      kelas: tb.map(t => t.className), thead: tb.map(t => t.querySelectorAll('thead').length), kepala: tb.map(t => [...t.querySelectorAll('thead th')].map(x => x.textContent.trim())),
      pita: h.pages.flatMap(pg => [...pg.querySelectorAll('.isl-jalur')].map(x => ({ k: x.className, t: x.textContent }))),
      rp: tb.every(t => [...t.querySelectorAll('tbody td.r')].every(td => !td.textContent.trim() || td.textContent.trim() === '—' || !!td.querySelector('.rp'))), sat: tb.every(t => t.querySelectorAll('tbody tr').length === t.querySelectorAll('tbody td:first-child .isl-sat').length),
      baris: tb.reduce((a, t) => a + t.querySelectorAll('tbody tr').length, 0) };
    h.host.remove(); return r;
  }, m);
  const cc = await ccModel('id'), kc = await lihatCC(cc);
  cek(kc.kelas.length >= 8 && kc.kelas.every(k => /isl-kartu--cc/.test(k) && !/isl-d3/.test(k)), 'CC: semua tabel harus berkelas isl-kartu--cc (bukan isl-d3): ' + JSON.stringify(kc.kelas));
  cek(kc.thead.every(n => n === 1) && kc.kepala.every(h => h.length >= 2 && h[0].length > 2), 'CC: tiap kartu harus punya kepala sendiri (judul + kolom harga): ' + JSON.stringify(kc.kepala));
  cek(kc.kepala.some(h => h.join('|').replace(/\s+/g, ' ') === 'FCL — Full Container Load|20 FT|40 FT') && kc.kepala.some(h => h[1] === 'Tarif'), 'CC: kepala kartu FCL (20 FT, 40 FT) dan kartu satu harga (Tarif) harus ada: ' + JSON.stringify(kc.kepala));
  const warna = kc.pita.map(x => (x.k.match(/isl-jalur--k-(\w+)/) || [])[1]).join(',');
  cek(warna === 'hijau,merah,biru,oranye' && kc.pita.every(x => /isl-jalur--kartu/.test(x.k)), 'CC: pita jalur harus hijau, merah, biru (PIB/PEB), oranye (Layanan Tambahan): ' + warna);
  cek(/Green Line/.test(kc.pita[0].t) && /Jalur Hijau/.test(kc.pita[0].t) && /PIB/.test(kc.pita[2].t) && /Layanan Tambahan/.test(kc.pita[3].t), 'CC: judul pita salah: ' + JSON.stringify(kc.pita.map(x => x.t)));
  cek(kc.rp && kc.sat, 'CC: sel harga harus berawalan Rp dan satuan kecil di bawah nama layanan: rp=' + kc.rp + ' sat=' + kc.sat);
  cek(kc.baris === 29, 'CC: 31 layanan terpilih harus jadi 29 baris (20 ft dan 40 ft Green/Red digabung satu baris), dapat ' + kc.baris);
  const kEn = await lihatCC(await ccModel('en'));
  cek(kEn.pita.length === 4 && /^Green Line$/.test(kEn.pita[0].t) && kEn.kepala.some(h => h[1] === 'Price') && kEn.pita[3].t === 'Additional Services', 'CC English: pita dan kepala kartu harus berbahasa Inggris: ' + JSON.stringify([kEn.pita.map(x => x.t), kEn.kepala.map(h => h[1])]));
  // dokumen CC terbit lama (kelas isl-d3, pita polos) tetap memakai gaya lama
  const ccLama = JSON.parse(JSON.stringify(cc));
  ccLama.fl.blok = [{ jenis: 'jalur', warna: 'hijau', teks: 'GREEN LINE — Jalur Hijau' }, { jenis: 'tabel', kelas: 'isl-d3 isl-d3--fcl', kolom: [{ h: 'FCL — Full Container Load', w: 48, a: 'l' }, { h: '20 FT', w: 26, a: 'r' }, { h: '40 FT', w: 26, a: 'r' }], baris: [{ c: [{ v: 'Green line', b: true }, { v: '350.000', sat: 'per kontainer' }, { v: '—' }] }] },
    { jenis: 'tabel', cap: 'Airport Handling', kolom: [{ h: '', w: 72, a: 'l' }, { h: '', w: 28, a: 'r' }], baris: [{ c: [{ v: 'Airport', b: true }, { v: '475.000', sat: 'per KG' }] }], noHeader: true, kelas: 'isl-d3' }];
  const kl = await lihatCC(ccLama);
  cek(kl.kelas.length === 2 && kl.kelas.every(k => /isl-d3/.test(k) && !/isl-kartu/.test(k)) && kl.pita.length === 1 && !/isl-jalur--kartu/.test(kl.pita[0].k), 'CC lama: dokumen terbit harus tetap gaya isl-d3 dan pita polos: ' + JSON.stringify([kl.kelas, kl.pita]));

  // ===== Tanggal ringkas pada blok tanda tangan =====
  const ttd = (m) => p.evaluate(async m => {
    const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 }), pg = h.pages[h.pages.length - 1], t = pg.querySelector('.isl-ttd'), hd = h.pages[0].querySelector('.isl-hd .n span');
    const o = { ada: !!t, kepala: hd ? hd.textContent : '', isl: t ? [...t.querySelectorAll('.col:first-child div')].map(x => x.className) : [], islTeks: t ? t.querySelector('.col:first-child').textContent : '', cust: t ? [...t.querySelectorAll('.col:last-child div')].map(x => x.className) : [], tgl: t ? !!t.querySelector('.rBt .tgl i') : false, rC: t ? t.querySelectorAll('.rC').length : -1 };
    h.host.remove(); return o;
  }, m);
  const tg = await ttd(depo), tgLama = await ttd({ ...depo, tglRingkas: undefined });
  cek(depo.tglRingkas === true, 'tanggal: model baru harus bertanda tglRingkas');
  cek(/^Jakarta, \d/.test(tg.kepala), 'tanggal: tanggal kepala surat harus tetap ada: ' + tg.kepala);
  cek(tg.ada && tg.rC === 0 && !/Jakarta, \d/.test(tg.islTeks), 'tanggal: tanggal di bawah tanda tangan ISL harus hilang: ' + tg.islTeks);
  cek(tg.tgl && tg.cust.includes('rB rBt'), 'tanggal: isian tanggal customer harus sejajar dengan keterangan nama jelas: ' + JSON.stringify(tg.cust));
  cek(tgLama.rC === 2 && /Jakarta, \d/.test(tgLama.islTeks) && !tgLama.tgl, 'tanggal: dokumen terbit lama harus tetap memakai susunan lama (dua baris tanggal): ' + JSON.stringify(tgLama));

  // ===== Trucking Distribusi: kartu per tipe body, kapasitas, pita pick up / rute berpasangan, TKBM dan asuransi per baris, varian long =====
  const dstModel = (bahasa, skema, tkbm, asuransi = ['', '', ''], tipe) => p.evaluate(({ b, skema, tkbm, asuransi, tipe }) => {
    window.__islMR.lini.push({ id: 'distribusi_kecil', nama: 'Trucking Distribusi' });
    window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'distribusi_kecil'); const st = e.formLini.s;
    const mk = (asal, service, tujuan, i, t, a) => ({ asal, tujuan, service, tkbm: t, asuransi: a, h: { CDE: 450000 + i * 50000, 'CDE Long': 700000 + i * 50000, CDD: 650000 + i * 50000 }, ket: i === 0 ? 'Termasuk tol' : '' });
    st.bodies.boxdry.on = false; st.tipe = tipe || st.tipe; st.bodies.reefer = { on: true, skema, rows: [mk('Jakarta (Gudang Marunda)', 'Reguler', 'Cikarang', 0, tkbm[0], asuransi[0]), mk('Jakarta (Gudang Marunda)', 'Reguler', 'Bogor', 1, tkbm[1], asuransi[1]), mk('Bekasi (Gudang Cikarang)', 'Express', 'Karawang', 2, tkbm[2], asuransi[2])] };
    e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Penawaran'; e.berlakuSampai = '2026-12-31'; e.bahasa = b; window.ISLFL.sinkron(e);
    return window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]);
  }, { b: bahasa, skema, tkbm, asuransi, tipe });
  const dstUkur = m => p.evaluate(async m => {
    const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 }); await window.__qt._tungguGambar(h.host);
    const t = h.host.querySelector('table.isl-t.isl-fl'), o = t ? { kelas: t.className, cap: (t.querySelector('caption .bd') || {}).textContent + ' ' + (t.querySelector('caption b') || {}).textContent, cip: (t.querySelector('caption .isl-chip') || {}).textContent || '', th: [...t.querySelectorAll('thead th')].map(x => x.firstChild.textContent), hsub: [...t.querySelectorAll('thead .isl-hsub')].map(x => x.textContent), pita: [...t.querySelectorAll('tr.bag')].map(x => [x.textContent, x.className]), chip: [...t.querySelectorAll('td .isl-chip')].map(x => x.textContent), tujuan: [...t.querySelectorAll('tbody tr:not(.bag) td:first-child')].map(x => x.firstChild.textContent), sat: [...t.querySelectorAll('.isl-sat')].map(x => x.textContent) } : null;
    h.host.remove(); return o;
  }, m);
  const dst = await dstModel('id', 'tetap', ['Termasuk', '', 'Termasuk']), dId = await dstUkur(dst);
  cek(dId && /isl-kartu--dst/.test(dId.kelas) && !/isl-trl|rapat/.test(dId.kelas), 'distribusi: kartu baru harus berkelas isl-kartu--dst (tanpa rapat): ' + (dId && dId.kelas));
  cek(dId && dId.th.join('|') === 'Tujuan|Layanan|CDE|CDD' && /^A Tipe Box Reefer/.test(dId.cap), 'distribusi: kepala kartu dan lencana A (varian long mati bawaan): ' + JSON.stringify(dId && [dId.th, dId.cap]));
  cek(dId && dId.hsub.join('|') === '2 ton · 4 cbm|4 ton · 15 cbm', 'distribusi: kapasitas bawaan harus tampil di bawah nama kolom: ' + JSON.stringify(dId && dId.hsub));
  cek(dId && dId.pita.length === 2 && /Marunda/.test(dId.pita[0][0]) && !/oranye/.test(dId.pita[0][1]) && /Cikarang/.test(dId.pita[1][0]) && /bag--oranye/.test(dId.pita[1][1]), 'distribusi: dua pita pick up (biru, lalu oranye untuk semua Express): ' + JSON.stringify(dId && dId.pita));
  cek(dId && dId.cip === '' && dId.chip.join() === 'TKBM termasuk,Reguler,Reguler,TKBM termasuk,Express', 'distribusi: TKBM sebagian baris: tanpa label kepala, hanya baris yang termasuk ditandai: ' + JSON.stringify(dId && [dId.cip, dId.chip]));
  const dSemua = await dstUkur(await dstModel('id', 'tetap', ['Termasuk', 'Termasuk', 'Termasuk'], ['', 'Termasuk', '']));
  cek(dSemua && dSemua.cip === 'TKBM termasuk' && dSemua.chip.join() === 'Reguler,Asuransi termasuk,Reguler,Express', 'distribusi: TKBM semua baris = satu label di kepala kartu; asuransi hanya satu baris = tanda di baris itu: ' + JSON.stringify(dSemua && [dSemua.cip, dSemua.chip]));
  const dKosong = await dstUkur(await dstModel('id', '', ['', '', '']));
  cek(dKosong && dKosong.pita.length === 0 && dKosong.cip === '' && !dKosong.chip.some(x => /TKBM|Asuransi/.test(x)) && dKosong.tujuan.join() === 'Cikarang,Bogor,Karawang', 'distribusi: draf lama (tanpa skema, TKBM, asuransi) tidak menampilkan pick up atau label: ' + JSON.stringify(dKosong));
  const dPas = await dstUkur(await dstModel('id', 'pasangan', ['', '', '']));
  cek(dPas && dPas.pita.length === 0 && dPas.th[0] === 'Rute' && dPas.tujuan.join() === 'Jakarta (Gudang Marunda) → Cikarang,Jakarta (Gudang Marunda) → Bogor,Bekasi (Gudang Cikarang) → Karawang', 'distribusi: rute berpasangan "asal → tujuan" tanpa pita: ' + JSON.stringify(dPas));
  const dLong = await dstUkur(await dstModel('id', 'tetap', ['', '', ''], ['', '', ''], { 'CDE Long': true }));
  cek(dLong && dLong.th.join('|') === 'Tujuan|Layanan|CDE|CDE Long|CDD', 'distribusi: varian long yang dicentang menjadi kolom: ' + JSON.stringify(dLong && dLong.th));
  cek(dLong && dLong.hsub.join('|') === '2 ton · 4 cbm|2,5 ton · 14 cbm|4 ton · 15 cbm', 'distribusi: kapasitas CDE, CDE Long, dan CDD di kepala kolom: ' + JSON.stringify(dLong && dLong.hsub));
  const dLongKosong = await dstUkur(await dstModel('id', 'tetap', ['', '', ''], ['', '', ''], { 'CDD Long': true }));
  cek(dLongKosong && dLongKosong.th.join('|') === 'Tujuan|Layanan|CDE|CDD|CDD Long', 'distribusi: kelas yang dicentang sendiri (CDD Long) tetap tampil di PDF walau belum ada harga; kelas bawaan kosong tersembunyi: ' + JSON.stringify(dLongKosong && dLongKosong.th));
  const dLepas = await dstUkur(await dstModel('id', 'tetap', ['', '', ''], ['', '', ''], { CDE: false }));
  cek(dLepas && dLepas.th.join('|') === 'Tujuan|Layanan|CDD', 'distribusi: kelas yang dicentang lepas (CDE) hilang dari PDF: ' + JSON.stringify(dLepas && dLepas.th));
  const dEn = await dstUkur(await dstModel('en', 'tetap', ['Termasuk', 'Termasuk', 'Termasuk'], ['', 'Termasuk', '']));
  cek(dEn && dEn.th.slice(0, 2).join('|') === 'Destination|Service' && dEn.cip === 'TKBM included' && dEn.chip.join() === 'Regular,Insurance included,Regular,Express' && /Type Box Reefer/.test(dEn.cap), 'distribusi English: kolom, layanan, TKBM, asuransi, dan judul harus English: ' + JSON.stringify(dEn && [dEn.th, dEn.chip, dEn.cip, dEn.cap]));
  /* dokumen English penuh: tidak boleh ada kata Indonesia (isian bebas user seperti nama rute dan keterangan tidak dihitung) */
  const teksEn = await p.evaluate(async m => { const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 }); await window.__qt._tungguGambar(h.host); const t = h.host.textContent; h.host.remove(); return t; }, await dstModel('en', 'tetap', ['Termasuk', 'Termasuk', 'Termasuk'], ['', 'Termasuk', '']));
  const ID_KATA = /\b(yang|dan|atau|untuk|dengan|tarif|biaya|layanan|keterangan|satuan|syarat|ketentuan|dikenakan|sudah|belum|tidak|harga|sesuai|penawaran|dari|pada|hari|wajib|termasuk|asuransi|kendaraan|pembayaran|keterlambatan|waktu|tunggu|pembatalan|kerusakan|perubahan)\b/gi;
  const sisaId = (String(teksEn).replace(/Termasuk tol/g, '').match(ID_KATA) || []);
  cek(/Order cancellation/.test(teksEn) && /Late payments beyond/.test(teksEn) && /Thank you for your trust/.test(teksEn) && /This quotation is valid until/.test(teksEn), 'distribusi English: S&K, kalimat pembuka dan penutup harus English: ' + String(teksEn).slice(0, 80));
  cek(!sisaId.length, 'distribusi English: masih ada kata Indonesia di dokumen: ' + [...new Set(sisaId)].join(', '));
  /* tarif minimum dari Master Rate: vendor tertinggi untuk tujuan dan kelas kendaraan (+ markup lini, dibulatkan ke atas Rp1.000) */
  const minDst = await p.evaluate(() => {
    const mr = window.__islMR; mr.ref = { zona: [{ id: 'z-cik', nama: 'Cikarang' }] }; mr.vendor = [{ id: 'v1', nama: 'Vendor Satu' }, { id: 'v2', nama: 'Vendor Dua' }];
    const t = (v, m, k) => ({ liniBisnisId: 'distribusi_kecil', vendorId: v, layananNama: 'Distribusi', dimensi: { tujuan: 'z-cik', kendaraan: k }, modal: m, aktif: true });
    mr.tarif = [t('v1', 500000, 'CDE'), t('v2', 520000, 'CDE'), t('v1', 800000, 'CDD')];
    window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'distribusi_kecil'); const st = e.formLini.s;
    st.bodies.boxdry.rows = [{ asal: '', tujuan: 'Cikarang', service: 'Reguler', h: { CDE: 450000, CDD: 900000 }, ket: '' }, { asal: '', tujuan: 'Bogor', service: 'Reguler', h: { CDE: 450000 }, ket: '' }]; window.ISLFL.sinkron(e);
    const o = e.baris.map(b => [b.item, b.minJual]); mr.tarif = []; mr.ref = {}; mr.vendor = []; return o;
  });
  cek(minDst.find(x => /Cikarang CDE$/.test(x[0]))[1] === 572000 && minDst.find(x => /Cikarang CDD$/.test(x[0]))[1] === 880000 && minDst.find(x => /Bogor CDE$/.test(x[0]))[1] === null, 'distribusi: tarif minimum = vendor tertinggi untuk tujuan dan kelas (CDE 572.000, CDD 880.000 dengan markup lini 10%, tujuan tanpa tarif kosong): ' + JSON.stringify(minDst));
  /* Kode projek dihapus (5 Nov 2026): data lama (kodeProjek, tampilKode) diabaikan; dokumen lama yang sudah memuat kolomnya tetap terbaca */
  const kodeInfo = await p.evaluate(async () => {
    const mr = window.__islMR, t = (id, tuj, kend) => ({ id, kunci: id, liniBisnisId: 'distribusi_kecil', layanan: 'distribusi', layananNama: 'Distribusi', satuanKode: 'per_ritase', dimensi: { asal: 'Jakarta', tujuan: tuj, kendaraan: kend }, vendorId: 'v1', aktif: true, modal: 300000 });
    mr.tarif = [t('t1', 'Cikarang', 'CDE'), t('t2', 'Cikarang', 'CDD'), t('t3', 'Cikarang', 'CDE')];
    window.__qt.baru('c1'); const e = window.__qt._Q.edit; e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.judul = 'Uji kode'; e.berlakuSampai = '2026-12-31'; e.tampilKode = true;
    const row = (id, tk, item, harga, kode) => ({ id, jenis: 'rate', urut: 0, liniKey: 'distribusi_kecil', liniNama: 'Distribusi', item, itemEn: '', deskripsi: '', satuan: 'per ritase', qty: 1, jual: harga, modal: null, tarifKunci: tk, kodeProjek: kode, dioverride: true });
    e.baris = [row('b1', 't1', 'Jakarta - Cikarang CDE', 450000, 'Line-A'), row('b2', 't2', 'Jakarta - Cikarang CDD', 650000, 'Line-A'), row('b3', 't3', 'Jakarta - Cikarang CDE', 520000, 'Line-B')];
    const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]), mx = m.bagian[0] && m.bagian[0].matriks;
    const tampil = async mm => { const h = await window.__qt._renderDok(mm, window.__qt._aset(), { watermark: '', densitas: 0 }); await window.__qt._tungguGambar(h.host); const tb = h.host.querySelector('table.isl-t'), th = tb ? [...tb.querySelectorAll('thead th')].map(x => x.textContent.trim()) : []; const sel = tb ? [...tb.querySelectorAll('tbody td')].map(x => x.textContent.trim()) : []; h.host.remove(); return { th, sel }; };
    const baru = await tampil(m);
    const lama = JSON.parse(JSON.stringify(m)); const mxl = lama.bagian[0].matriks; mxl.tail.push({ t: 'kode', h: 'Kode projek' }); mxl.baris[0].kode = 'Line-A'; const lamaHasil = await tampil(lama);
    mr.tarif = []; return { baru, lamaHasil, adaMx: !!mx, jmlBaris: mx ? mx.baris.length : -1 };
  });
  cek(kodeInfo.adaMx && !kodeInfo.baru.th.includes('Kode projek') && !kodeInfo.baru.sel.includes('Line-A'), 'Kode projek: kolom tidak tampil walau data lama (tampilKode, kodeProjek) ada: ' + JSON.stringify(kodeInfo.baru));
  cek(kodeInfo.lamaHasil.th.includes('Kode projek') && kodeInfo.lamaHasil.sel.includes('Line-A'), 'Kode projek: dokumen lama yang sudah memuat kolom tetap terbaca: ' + JSON.stringify(kodeInfo.lamaHasil));
  const dLama = JSON.parse(JSON.stringify(dst)); dLama.fl.blok = [{ jenis: 'tabel', kelas: 'isl-trl', cap: 'Tipe Reefer', sub: 'CDE', kolom: [{ h: 'No', w: 10, a: 'c' }, { h: 'Rute', w: 70, a: 'l' }, { h: 'CDE', w: 20, a: 'c' }], baris: [{ c: ['1', 'Cikarang', '450.000'] }] }];
  const dL = await dstUkur(dLama);
  cek(dL && /isl-trl/.test(dL.kelas) && dL.th.join('|') === 'No|Rute|CDE' && dL.pita.length === 0, 'distribusi: dokumen terbit lama (isl-trl) harus tetap dirender dengan susunan lama: ' + JSON.stringify(dL));

  cek(err.length === 0, 'galat halaman: ' + err.join(' | '));
  await browser.close();
  console.log(gagal.length ? 'GAGAL tabel kartu:\n- ' + gagal.join('\n- ') : 'Tabel kartu Depo, Trailer, Customs Clearance, dan Distribusi lolos (desain C, judul kolom sekali per halaman, kelompok utuh, dokumen lama tidak berubah).');
  process.exit(gagal.length ? 1 : 0);
})();
