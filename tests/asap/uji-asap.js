// Uji asap halaman Quotation: memuat skrip asli (logo, formulir-lini, sales, app-core) di browser tanpa Firebase, dengan data tiruan,
// lalu merender daftar, editor draf, dan semua bagian Pengaturan dokumen untuk tiap peran (master, admin, sales).
// Menangkap galat seperti "X is not defined" (nama dipakai di modul yang salah) sebelum sampai ke pengguna.
// Berjalan lokal: NODE_PATH=<folder node_modules berisi playwright> node tests/asap/uji-asap.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', '..', 'public') + path.sep;

const gagal = [];
const cek = (kondisi, pesan) => { if (!kondisi) gagal.push(pesan); };

async function ujiPeran(browser, peran) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const err = [];
  p.on('pageerror', e => err.push('PAGE ' + e.message));
  p.on('console', m => { if (m.type() === 'error') err.push('CON ' + m.text().slice(0, 200)); });
  await p.setContent(`<!doctype html><meta charset=utf-8><style>${fs.readFileSync(R + 'css/app.css', 'utf8')}</style>
    <div id="sinkron-banner"></div><nav id="app-nav"></nav><div id="cu-root" class="hidden"></div><div id="qt-root"></div><div id="mr-layer"></div><div id="lp-root" class="hidden"></div><div id="lr-root" class="hidden"></div><div id="pf-root" class="hidden"></div>`);
  await p.evaluate(({ peran }) => {
    const profil = { uid: 'uid-' + peran, email: peran + '@isl.test', peran, status: 'aktif', sembunyi: {} };
    window.__ISL_PROFIL = profil;
    window.__islSimpanProfil = async d => { window.__profilTersimpan = JSON.parse(JSON.stringify(d)); Object.assign(window.__ISL_PROFIL, d); };
    window.__ISL = {
      email: profil.email, master: peran === 'master', kelola: peran !== 'sales', admin: peran === 'admin', sales: peran === 'sales', uid: profil.uid, peran, nama: peran,
      hariIni: () => '2026-11-03', tulis: async (komit, verif) => { komit(); if (verif && !verif()) throw new Error('verifikasi gagal'); }, unggahBlob: async () => '', diagnosa: async () => [],
      buatLini: async () => {}, simpanMarkupLini: async () => {}, tarifTambah: async () => ({}), navAktif: () => {}
    };
    window.__islMR = { tarif: [], vendor: [], lini: [{ id: 'customs_clearance', nama: 'Customs Clearance' }, { id: 'depo', nama: 'Depo' }], satuan: [{ kode: 'per_kontainer', nama: 'per kontainer' }, { kode: 'per_dokumen', nama: 'per dokumen' }, { kode: 'per_hari', nama: 'per hari' }], ref: {}, user: { email: profil.email } };
    const q = (id, status, extra = {}) => ({ id, status, judul: 'Quotation ' + id, customerId: 'c1', customerNama: 'PT Uji', pemilikUid: profil.uid, pemilikNama: 'Staf', baris: [], dibuat: '2026-11-01', labelDraf: 'Draf ' + id, nomor: status === 'draf' ? '' : 'QL/' + id, ...extra });
    window.__ISL_DATA = {
      customers: [{ id: 'c1', nama: 'PT Uji', status: 'aktif', kontak: [{ nama: 'Andi', utama: true }], legalitas: [], alamat: 'Jakarta' }], rates: [], paket: [], orders: [], counters: [], layanan: [], formatLini: [],
      quotations: [q('qa', 'draf'), q('qb', 'terkirim', { dikirim: '2026-11-02', berlakuSampai: '2026-12-01' }), q('qc', 'ditolak', { diputuskan: '2026-11-02' })],
      templates: [{ id: 't1', nama: 'Template Satu', pemilikUid: profil.uid, baris: [], diubah: '2026-11-01' }],
      riwayat: [{ id: 'r1', nomor: 'RW-1', customerNama: 'PT Uji', status: 'terkirim', tanggalKirim: '2026-11-01', pemilikUid: profil.uid }],
      pengaturan: null
    };
  }, { peran });
  for (const f of ['js/logo.js', 'js/formulir-lini.js', 'js/sales.js', 'js/app-core.js']) await p.addScriptTag({ content: fs.readFileSync(R + f, 'utf8') });
  await p.waitForTimeout(400);
  const siap = await p.evaluate(() => !!(window.__qt && window.__qt.gambar));
  cek(siap, `[${peran}] modul quotation tidak termuat: ${err.join(' | ')}`);
  if (!siap) { await p.close(); return; }

  const baris = () => p.evaluate(() => [...document.querySelectorAll('#qt-root tr.cu-baris')].length);
  const menu = () => p.evaluate(() => [...new Set([...document.querySelectorAll('#qt-root .qt-menu__list button')].map(b => b.textContent.trim()))]);
  await p.evaluate(() => { window.__qt._Q.view = 'list'; window.__qt.gambar(); });
  cek(await baris() === 4, `[${peran}] daftar harus berisi 4 baris (3 quotation + 1 riwayat), dapat ${await baris()}`);
  const m = (await menu()).join('|');
  // Hapus permanen, Ganti nomor, dan Tandai perhatian pindah ke halaman detail (tidak lagi di menu baris)
  if (peran === 'master') cek(!/Hapus permanen|Ganti nomor|Tandai perlu/.test(m) && !/Sembunyikan/.test(m), `[master] menu baris salah: ${m}`);
  else cek(/Sembunyikan/.test(m) && !/Hapus permanen|Ganti nomor|Tandai perlu/.test(m), `[${peran}] menu baris salah: ${m}`);

  if (peran !== 'master') {
    await p.evaluate(() => document.querySelector('#qt-root button[data-qt="sembunyikan"][data-id="qb"]').click());
    await p.waitForTimeout(250);
    cek(await baris() === 3, `[${peran}] setelah Sembunyikan harus 3 baris`);
    cek(await p.evaluate(() => !!document.querySelector('.qt-sb-banner')), `[${peran}] penanda disembunyikan tidak muncul`);
    cek(await p.evaluate(() => JSON.stringify(window.__profilTersimpan) === '{"sembunyi":{"quotation":["qb"]}}'), `[${peran}] daftar sembunyi tidak tersimpan ke profil`);
    await p.evaluate(() => document.querySelector('#qt-root button[data-qt="sb-lihat"]').click());
    await p.waitForTimeout(200);
    cek(await baris() === 4, `[${peran}] setelah Tampilkan harus 4 baris`);
    await p.evaluate(() => document.querySelector('#qt-root button[data-qt="tampil-lagi"][data-id="qb"]').click());
    await p.waitForTimeout(250);
    cek(await baris() === 4 && !(await p.evaluate(() => !!document.querySelector('.qt-sb-banner'))), `[${peran}] Tampilkan lagi harus memulihkan dan menghapus penanda`);
  }

  // editor draf: master dan sales boleh Hapus draf; admin hanya Sembunyikan draf
  await p.evaluate(() => { window.__qt._Q.view = 'list'; window.__qt.gambar(); window.__qt.buka('qa'); });
  await p.waitForTimeout(300);
  const bar = (await p.evaluate(() => [...document.querySelectorAll('#qt-root .qt-bar__aksi button')].map(b => b.textContent.trim()))).join('|');
  if (peran === 'admin') cek(/Sembunyikan draf/.test(bar) && !/Hapus draf/.test(bar), `[admin] bar editor salah: ${bar}`);
  else cek(/Hapus draf/.test(bar) && !/Sembunyikan draf/.test(bar), `[${peran}] bar editor salah: ${bar}`);

  // Pengaturan dokumen: setiap bagian harus tampil tanpa galat; admin tidak boleh melihat tombol hapus
  await p.evaluate(() => { window.__qt._Q.edit = null; window.__qt._Q.view = 'list'; window.__qt.gambar(); const t = document.querySelector('#qt-root [data-qt="pengaturan"]'); if (t) t.click(); });
  await p.waitForTimeout(250);
  const seksi = await p.evaluate(() => [...document.querySelectorAll('#qt-root [data-qt="pg-buka"]')].map(b => b.dataset.seksi));
  cek(seksi.length >= 5, `[${peran}] bagian Pengaturan dokumen tidak tampil (${seksi.length})`);
  for (const k of seksi) {
    await p.evaluate(kk => { const b = document.querySelector(`#qt-root [data-qt="pg-buka"][data-seksi="${kk}"]`); if (b) b.click(); }, k);
    await p.waitForTimeout(100);
    const sb = await p.evaluate(() => ({ isi: document.getElementById('qt-root').innerHTML.length, hapus: document.querySelectorAll('#qt-root [data-qt*="hapus"]').length }));
    cek(sb.isi > 500, `[${peran}] bagian ${k} kosong`);
    if (peran === 'admin') cek(sb.hapus === 0, `[admin] bagian ${k} masih menampilkan ${sb.hapus} tombol hapus`);
    await p.evaluate(() => { const b = document.querySelector('#qt-root [data-qt="pg-daftar-bagian"]'); if (b) b.click(); });
  }
  // panel Template saya
  await p.evaluate(() => { const b = document.querySelector('#qt-root [data-qt="pg-buka"][data-seksi="templatesaya"]'); if (b) b.click(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => { const t = document.querySelector('[data-qt="kelola-tmpl"]'); if (t) t.click(); });
  await p.waitForTimeout(250);
  const tombol = (await p.evaluate(() => [...document.querySelectorAll('#ts-isi button')].map(b => b.textContent.trim()))).join('|');
  if (peran === 'admin') cek(/Sembunyikan/.test(tombol) && !/Hapus/.test(tombol), `[admin] panel template salah: ${tombol}`);
  else if (peran === 'master') cek(/Hapus/.test(tombol) && !/Sembunyikan/.test(tombol), `[master] panel template salah: ${tombol}`);
  else cek(/Sembunyikan/.test(tombol) && /Hapus/.test(tombol), `[sales] panel template salah: ${tombol}`);

  // S&K: satu daftar bernomor per lini, tanpa kelompok umum; diubah manual => menjadi milik quotation
  const sk = await p.evaluate(() => {
    const R = window.__qt._R, q = { id: 'x', baris: [], liniManual: ['depo'], bahasa: 'id', tipe: 'satuan', berlakuSampai: '2026-12-01' };
    const dasar = R.tncDasar(q), grup = R.tncGrup(q, 'id', { berlaku: '1 Desember 2026' }, []);
    const ubah = R.tncGrup({ ...q, tncCc: [{ id: 'a', teks: 'Butir sendiri.', aktif: true }, { id: 'b', teks: 'Mati.', aktif: false }] }, 'id', { berlaku: '' }, []);
    return { dasar: dasar.length, grup: grup.length, judul: grup.map(g => g.judul), ubah: ubah.flatMap(g => g.items.map(i => i.teks)), gabung: typeof R.tncGabungAktif, tersedia: typeof R.tncTersedia };
  });
  cek(sk.dasar > 0, `[${peran}] template S&K depo kosong`);
  cek(sk.grup === 1 && sk.judul[0] === '', `[${peran}] S&K harus satu daftar tanpa judul kelompok: ${JSON.stringify(sk.judul)}`);
  cek(sk.ubah.length === 1 && sk.ubah[0] === 'Butir sendiri.', `[${peran}] daftar manual tidak dipakai apa adanya: ${JSON.stringify(sk.ubah)}`);
  const tr = await p.evaluate(() => {
    const R = window.__qt._R, q = { id: 'x', baris: [], liniManual: ['trucking_trailer'], bahasa: 'id', tipe: 'satuan', berlakuSampai: '2026-12-01', topLayanan: 14, topPihak: 7, dendaPihak: 3 };
    const teks = R.tncGrup(q, 'id', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks)), mati = R.tncGrup({ ...q, dendaPihakAktif: false }, 'id', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks));
    return { param: !!R.syaratLini('trucking_trailer'), teks, mati, waktu: teks.filter(t => /^Waktu tunggu/.test(t)).length };
  });
  cek(tr.param, `[${peran}] trailer tidak punya parameter S&K (TOP/denda)`);
  cek(tr.teks.some(t => /Ketentuan pembayaran:[\s\S]*14 hari[\s\S]*7 hari kerja/.test(t)), `[${peran}] trailer tanpa butir Ketentuan pembayaran: ${JSON.stringify(tr.teks)}`);
  cek(tr.teks.some(t => /3% dari nilai invoice/.test(t)), `[${peran}] trailer tanpa butir denda: ${JSON.stringify(tr.teks)}`);
  cek(!tr.mati.some(t => /Keterlambatan pembayaran/.test(t)), `[${peran}] denda nonaktif tetap tampil di trailer`);
  cek(tr.waktu === 0 && !tr.teks.some(t => /waktu tunggu|waiting time/i.test(t)), `[${peran}] butir waktu tunggu bongkar harus sudah dihapus dari S&K trailer: ${tr.waktu}`);
  cek(tr.teks.some(t => /H-1/.test(t)) && tr.teks.some(t => /hari ketiga/.test(t)) && tr.teks.some(t => /Rp 1\.000\.000/.test(t)), `[${peran}] S&K trailer tanpa butir operasional dari surat penawaran customer: ${JSON.stringify(tr.teks)}`);
  cek(!tr.teks.some(t => /(^|[^0-9])4 jam|Kepala Engkel|at cost|fee administrasi/.test(t)), `[${peran}] S&K trailer masih memuat butir lama yang bentrok: ${JSON.stringify(tr.teks)}`);
  // lini yang sudah dihapus master dari daftar Template lini tidak boleh ditawarkan saat membuat quotation
  const sb = await p.evaluate(async () => {
    const MR = window.__islMR, PENG = window.__qt._R.PENG; MR.lini.push({ id: 'uji_format_1', nama: 'UJI format 1', aktif: true });
    window.__ISL_DATA.formatLini = []; if (window.ISLFL) window.ISLFL.muatFormat([{ id: 'uji_format_1', kode: 'uji_format_1', nama: 'UJI format 1', ket: 'x', judul: 'x', pembuka: '', kolom: [{ nama: 'Uraian', num: false, lebar: 60 }, { nama: 'Tarif', num: true, lebar: 40 }], bagian: [{ judul: 'A', baris: [] }] }]);
    const tunggu = () => new Promise(r => setTimeout(r, 150)), teksPanel = () => (document.getElementById('mr-layer') || document.body).innerText;
    const buka = async kunci => { const t = document.querySelector(`#qt-root [data-qt="${kunci}"]`); if (t) t.click(); await tunggu(); const x = teksPanel(); document.querySelectorAll('[data-aksi="tutup-layer"]').forEach(b => b.click()); await tunggu(); return x; };
    window.__qt._Q.edit = null; window.__qt._Q.view = 'list'; window.__qt.gambar(); await tunggu();
    PENG.liniSembunyi = [];
    const wmAda = await buka('manual-word'), fmAda = await buka('baru');
    PENG.liniSembunyi = ['uji_format_1'];
    const wmHilang = await buka('manual-word'), fmHilang = await buka('baru');
    return { wmAda: /UJI format 1/.test(wmAda), wmHilang: /UJI format 1/.test(wmHilang), fmAda: /UJI format 1/.test(fmAda), fmHilang: /UJI format 1/.test(fmHilang), fmMuncul: /Buat quotation/.test(fmAda) };
  });
  if (peran !== 'sales') cek(sb.wmAda && !sb.wmHilang, `[${peran}] Quotation manual (Word): lini ada=${sb.wmAda}, setelah dihapus=${sb.wmHilang}`);
  if (process.env.DBG) console.log(peran, JSON.stringify(sb));
  if (sb.fmMuncul) cek(sb.fmAda && !sb.fmHilang, `[${peran}] Buat quotation: lini ada=${sb.fmAda}, setelah dihapus=${sb.fmHilang}`);
  // bahasa Inggris: S&K CC, Depo, dan Trailer harus berganti ke English walau data lama menyimpan salinan Indonesia di kolom English
  const en = await p.evaluate(() => {
    const R = window.__qt._R, PENG = R.PENG, hasil = {};
    PENG.tnc.forEach(t => { if (t.kat === 'customs_clearance' || t.kat === 'depo' || t.kat === 'trucking_trailer') t.teks.en = t.teks.id; });
    ['customs_clearance', 'depo', 'trucking_trailer'].forEach(l => {
      const q = { id: 'x', baris: [], liniManual: [l], bahasa: 'en', tipe: 'satuan', berlakuSampai: '2026-12-01' };
      const id = R.tncGrup({ ...q, bahasa: 'id' }, 'id', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks)), inggris = R.tncGrup(q, 'en', { berlaku: '' }, []).flatMap(g => g.items.map(i => i.teks));
      hasil[l] = { n: id.length, sama: inggris.filter((t, i) => t === id[i]).length, contoh: inggris.filter((t, i) => t === id[i]).map(x => x.slice(0, 60)) };
    });
    return hasil;
  });
  Object.entries(en).forEach(([l, h]) => cek(h.n > 0 && h.sama === 0, `[${peran}] S&K ${l} masih Indonesia saat bahasa Inggris: ${h.sama} dari ${h.n} butir sama. ${JSON.stringify(h.contoh)}`));
  cek(sk.gabung === 'undefined' && sk.tersedia === 'undefined', `[${peran}] fitur gabung syarat umum masih ada`);

  // editor: daftar S&K bernomor tampil, tanpa kotak gabung; tanpa diubah tetap mengikuti template, diubah => disimpan di quotation
  const ed = await p.evaluate(async () => {
    const Q = window.__qt._Q; Q.edit = null; Q.view = 'list'; window.__qt.gambar(); window.__qt.buka('qa');
    await new Promise(r => setTimeout(r, 200));
    Q.edit.liniManual = ['depo']; window.__qt.gambar(); await new Promise(r => setTimeout(r, 200));
    const d = document.querySelector('details[data-det=tnc]'); if (d) d.open = true;
    const baris = () => document.querySelectorAll('#qt-tnc .qt-cc-row').length, n0 = baris();
    const gabung = !!document.querySelector('#qt-tncgabung');
    const R = window.__qt._R; const dasar = R.tncDasar(Q.edit).length;
    return { n0, gabung, dasar, tombolTambah: !!document.querySelector('#qt-tnc [data-qt="tambah-tcc"]'), pulih: !!document.querySelector('#qt-tnc [data-qt="pulih-tcc"]') };
  });
  cek(ed.n0 > 0 && ed.n0 === ed.dasar, `[${peran}] daftar S&K di editor: ${ed.n0} baris, template ${ed.dasar}`);
  cek(!ed.gabung, `[${peran}] kotak 'Gabungkan syarat umum' masih tampil`);
  cek(ed.tombolTambah, `[${peran}] tombol tambah butir S&K tidak ada`);
  const pv = await p.evaluate(async () => {
    const Q = window.__qt._Q; Q.edit.bahasa = 'en'; window.__qt.gambar(); await new Promise(r => setTimeout(r, 200));
    const d = document.querySelector('details[data-det=tnc]'); if (d) d.open = true;
    const hasil = { en: document.querySelectorAll('#qt-tnc .qt-cc-en').length, baris: document.querySelectorAll('#qt-tnc .qt-cc-row').length, kolomId: !!document.querySelector('#qt-tnc textarea[data-tcc]') };
    Q.edit.bahasa = 'id'; window.__qt.gambar(); await new Promise(r => setTimeout(r, 100));
    hasil.idTanpaEn = document.querySelectorAll('#qt-tnc .qt-cc-en').length;
    return hasil;
  });
  cek(pv.en === pv.baris && pv.baris > 0 && pv.idTanpaEn === 0, `[${peran}] pratinjau English di daftar S&K: ${JSON.stringify(pv)}`);
  const rt = await p.evaluate(async () => {
    const Q = window.__qt._Q, R = window.__qt._R, tunggu = () => new Promise(r => setTimeout(r, 150)), dasar = R.tncDasar(Q.edit).length;
    document.querySelector('#qt-tnc [data-qt="tambah-tcc"]').click(); await tunggu();
    const sesudahTambah = Array.isArray(Q.edit.tncCc) ? Q.edit.tncCc.length : -1;
    const pulihBtn = document.querySelector('#qt-tnc [data-qt="pulih-tcc"]'); if (pulihBtn) pulihBtn.click(); await tunggu();
    return { dasar, sesudahTambah, sesudahPulih: Q.edit.tncCc === undefined };
  });
  cek(rt.sesudahTambah === rt.dasar + 1, `[${peran}] tambah butir: ${rt.sesudahTambah} (seharusnya ${rt.dasar + 1})`);
  cek(rt.sesudahPulih, `[${peran}] 'Kembalikan ke template lini' tidak menghapus daftar milik quotation`);

  // Aturan pemilik (4 Nov 2026): dokumen berbahasa Inggris harus English seluruhnya, di SEMUA lini. Isi form tiap lini lewat UI, lalu pindai teks hasil render.
  if (peran === 'master') {
    const ID = /\b(yang|dan|atau|untuk|dengan|harian|mingguan|bulanan|tarif|biaya|sewa|layanan|keterangan|satuan|kontainer|rute|syarat|ketentuan|dikenakan|sudah|belum|tidak|harga|sesuai|tambahan|penawaran|dari|pada|hari|bulan|orang|lahan|luas|jumlah|rincian|dihitung|ditagihkan|wajib)\b/i;
    const lini = await p.evaluate(() => window.ISLFL.daftar().map(l => l.key));
    for (const k of lini) {
      await p.evaluate(k => { const Q = window.__qt._Q; Q.edit = null; Q.view = 'list'; window.__qt.gambar(); window.__qt.baru('c1'); window.ISLFL.terapkanAwal(Q.edit, k); window.__qt.gambar(); }, k);
      await p.waitForTimeout(150);
      for (let i = 0; i < 3; i++) {
        await p.evaluate(async () => {
          for (const el of [...document.querySelectorAll('#fl-root [data-fl], #fl-root [data-fla="pilih"]')]) {
            if (!document.contains(el)) continue;
            if (el.type === 'checkbox') { if (!el.checked && !/off|sembunyi/.test(el.dataset.fl || '')) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); } }
            else if (el.tagName === 'INPUT' && (el.dataset.fn !== undefined || el.type === 'number')) { if (!el.value || +el.value === 0) { el.value = '1500000'; el.dispatchEvent(new Event('input', { bubbles: true })); } }
            else if (el.tagName === 'INPUT' && el.type === 'text' && !el.value) { el.value = 'Sample'; el.dispatchEvent(new Event('input', { bubbles: true })); }
          }
          await new Promise(r => setTimeout(r, 15));
        });
        await p.waitForTimeout(100);
      }
      const teks = await p.evaluate(async () => { const e = window.__qt._Q.edit; e.customerNama = 'PT Uji'; e.judul = 'Test'; e.bahasa = 'en'; const o = await window.__qt._renderDok(window.__qt._R.bangunModel(e, null), {}, { densitas: 0 }); return o.pages.map(pg => pg.innerText).join('\n'); });
      const sisa = [...new Set(teks.split('\n').map(x => x.trim()).filter(x => x && ID.test(x) && !/Sample|Jakarta|Tanjung Priok/.test(x)))];
      cek(teks.length > 400 && sisa.length === 0, `[master] dokumen English lini ${k} masih memuat teks Indonesia: ${sisa.slice(0, 4).join(' | ') || '(dokumen kosong)'}`);
      cek(!/SURAT PENAWARAN/i.test(teks), `[master] dokumen English lini ${k} masih memuat judul Indonesia`);
    }
  }

  cek(err.length === 0, `[${peran}] galat halaman: ${err.slice(0, 3).join(' | ')}`);
  await p.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const peran of ['master', 'admin', 'sales']) await ujiPeran(browser, peran);
  await browser.close();
  if (gagal.length) { console.error('UJI ASAP GAGAL:\n - ' + gagal.join('\n - ')); process.exit(1); }
  console.log('Uji asap lolos untuk master, admin, dan sales.');
})();
