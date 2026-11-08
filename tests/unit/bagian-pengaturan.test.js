// Menguji pengelompokan bagian Pengaturan dokumen di Chromium. Jalankan: NODE_PATH=$(npm root -g) node tests/unit/bagian-pengaturan.test.js
const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../../public/js/app-core.js'), 'utf8').split('\n');
const idx = re => src.findIndex(l => re.test(l));
const a = idx(/^const PGD_ADMIN/), b = idx(/^function viewPengaturan\(\)/);
const kode = src.slice(a, b).join('\n');
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.setContent('<body></body>');
  const hasil = await pg.evaluate(`(() => {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const ik = () => ''; let peran = 'master';
    const masterAtauAdmin = () => peran === 'master' || peran === 'admin', akunAdmin = () => peran === 'admin', akunSales = () => peran === 'sales', bisaEdit = () => true;
    const Q = { pdSeksi: null }; const R = {};
    ${kode}
    const ids = ['kopsurat','penomoranquotation','templateperlinibisni','markup','templatesaya','satuanquotation','tabeldokumenperlinib','pengingatrekapkegiat','penandatangantandata','dokumenumum','kalimatstandar','pustaka'];
    const mk = () => '<div class="cu-judul"><h2>Pengaturan dokumen</h2><div class="cu-judul__tag"></div></div><div class="qt-main">' + ids.map(i => '<details class="mr-kartu qt-pgd" data-pgd="'+i+'"><summary><h3>Kartu '+i+'</h3></summary><p class="mr-sub qt-ket">Ket '+i+'</p><div>ISI-'+i+'</div></details>').join('') + '</div>';
    const keluaran = {};
    for (const p of ['master', 'admin', 'sales']) {
      peran = p; const html = sembunyiKartuPgd(mk());
      Q.pdSeksi = null; const daftar = [...new DOMParser().parseFromString(paginaPengaturan(html), 'text/html').querySelectorAll('.qt-bagian span:first-child')].map(x => x.textContent);
      const halaman = {};
      for (const g of GRUP_PGD) { Q.pdSeksi = g.id; const d = new DOMParser().parseFromString(paginaPengaturan(html), 'text/html'); halaman[g.id] = { isi: [...d.querySelectorAll('.qt-subseksi')].map(x => x.dataset.pgd), simpan: !!d.querySelector('[data-qt="pg-simpan-bagian"]'), judul: (d.querySelector('.qt-seksi__judul h2')||{}).textContent || null, tnc: !!d.querySelector('#pg-tnc') }; }
      Q.pdSeksi = 'markup'; const lama = new DOMParser().parseFromString(paginaPengaturan(html), 'text/html'); // id kartu lama -> grup
      keluaran[p] = { daftar, halaman, markupLama: (lama.querySelector('.qt-seksi__judul h2')||{}).textContent || null, kunci: Object.fromEntries(GRUP_PGD.map(g => [g.id, kunciBagian(g.id)])) };
    }
    return keluaran;
  })()`);
  console.log(JSON.stringify(hasil, null, 1).replace(/\n\s+/g, ' ').replace(/\},/g, '},\n'));
  await br.close();
})();
