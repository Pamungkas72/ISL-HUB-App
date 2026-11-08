/* ===========================================================
   UANG JALAN (menu sendiri, 8 Nov 2026): kalkulator uang jalan armada sendiri, master rute, master driver, dan riwayat slip.
   Hanya master dan admin. Biaya internal, tidak masuk penawaran. Data lewat window.__islUJ (app-boot.js; koleksi uj_rute, uj_driver, uj_slip, uj_pengaturan).
   Rumus: BBM = jarak pulang-pergi / rasio (km per liter) x harga solar; total = BBM + tol + TKBM + biaya operasional distribusi (+ insentif untuk driver mitra).
   =========================================================== */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.ISLUJ) return; // sudah terpasang (skrip dimuat ulang saat pindah menu)
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rpNum = v => { const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10); return isFinite(n) ? n : 0; };       // rupiah: titik ribuan diabaikan
  const desimal = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; }; // km, rasio: koma atau titik desimal
  const fmt = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const fmtAngka = n => n ? Math.round(n).toLocaleString('id-ID') : '';
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const hariIni = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const tglId = t => { const d = new Date(t + 'T00:00:00'); return isNaN(d) ? t : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); };
  const LABEL_OPS = 'Biaya mel (distribusi)', SOLAR_AWAL = 6800;
  const BERLAKU = { semua: 'Semua driver', internal: 'Driver internal saja', mitra: 'Driver mitra saja' };

  /* komponen biaya tambahan buatan pemilik (mis. uang parkir): berlaku untuk semua driver, internal saja, atau mitra saja */
  const komponenAktif = (daftar, jenis) => (daftar || []).filter(c => c && c.nama && (c.berlaku === 'semua' || !c.berlaku || c.berlaku === jenis));
  /* ---------- hitung (murni, diuji di Node) ---------- */
  function hitung(i) {
    const jarak = desimal(i.jarak), rasio = desimal(i.rasio), solar = rpNum(i.solar), liter = jarak > 0 && rasio > 0 ? jarak / rasio : 0, bbm = Math.round(liter * solar);
    const baris = [{ k: 'bbm', n: 'BBM', ket: liter ? `${(Math.round(liter * 10) / 10).toLocaleString('id-ID')} liter` : 'isi jarak dan rasio', v: bbm },
      { k: 'tol', n: 'Tol', v: rpNum(i.tol), opsi: true }, { k: 'tkbm', n: 'TKBM', v: rpNum(i.tkbm), opsi: true }, { k: 'ops', n: String(i.labelOps || LABEL_OPS), v: rpNum(i.ops) }];
    if (i.jenis === 'mitra') baris.push({ k: 'ins', n: 'Insentif driver mitra', v: rpNum(i.insentif) });
    komponenAktif(i.komponen, i.jenis).forEach(c => baris.push({ k: 'x:' + c.id, n: c.nama, v: rpNum((i.ekstra || {})[c.id]), opsi: true }));
    return { liter, baris, total: baris.reduce((a, b) => a + b.v, 0) };
  }

  /* ---------- keadaan ---------- */
  const S = { tab: 'kalkulator', rute: [], driver: [], slip: [], peng: { solar: SOLAR_AWAL, labelOps: LABEL_OPS, komponen: [] }, f: null, form: null, muat: false, sibuk: false };
  const baruF = () => ({ id: '', jenis: 'internal', ruteId: '', ruteNama: '', driverId: '', jarak: '', rasio: '', solar: String(S.peng.solar || SOLAR_AWAL), tol: '', tkbm: '', ops: '', insentif: '', catatan: '', ekstra: Object.fromEntries(S.peng.komponen.map(c => [c.id, c.bawaan ? String(c.bawaan) : ''])) });
  const DB = () => window.__islUJ;
  const root = () => document.getElementById('uj-root');
  const toast = (h, j) => { const f = window.__islCU && window.__islCU.toast; if (f) f(h, j); };
  const tanya = o => (window.__islCU && window.__islCU.konfirmasi) ? window.__islCU.konfirmasi(o) : Promise.resolve(confirm(o.judul));
  const ik = n => (window.__islCU && window.__islCU.ik) ? window.__islCU.ik(n, 14) : '';

  const masuk = (f = S.f) => ({ ...f, labelOps: S.peng.labelOps, komponen: S.peng.komponen });
  /* ---------- tampilan ---------- */
  const inp = (f, v, o = {}) => `<input data-uj="${f}" ${o.m ? 'inputmode="decimal"' : 'inputmode="numeric"'} value="${esc(v ?? '')}" placeholder="${esc(o.ph || '0')}" autocomplete="off" aria-label="${esc(o.a || f)}">`;
  const field = (lab, isi, opsi) => `<label class="uj-f"><span>${esc(lab)}${opsi ? ' <em class="uj-opsi">opsional</em>' : ''}</span>${isi}</label>`;
  const tabBtn = (id, t) => `<button type="button" class="uj-tab${S.tab === id ? ' is-aktif' : ''}" data-ujt="tab" data-x="${id}">${t}</button>`;
  function htmlHasil() {
    const h = hitung(masuk());
    return `${h.baris.filter(b => b.v || !b.opsi).map(b => `<div class="uj-r"><span>${esc(b.n)}${b.ket ? ` <small>${esc(b.ket)}</small>` : ''}</span><b>${fmt(b.v)}</b></div>`).join('')}<div class="uj-t"><span>Uang jalan</span><b>${fmt(h.total)}</b></div>`;
  }
  function htmlKalkulator() {
    const f = S.f, mitra = f.jenis === 'mitra', drv = S.driver.filter(d => d.jenis === f.jenis);
    return `<div class="uj-seg" role="group" aria-label="Jenis driver"><button type="button" class="${mitra ? '' : 'is-aktif'}" data-ujt="jenis" data-x="internal">Driver internal (gaji)</button><button type="button" class="${mitra ? 'is-aktif' : ''}" data-ujt="jenis" data-x="mitra">Driver mitra (kontrak)</button></div>
    <div class="uj-grid">
      ${field('Rute (pilih dari master atau ketik)', `<select data-ujs="ruteId"><option value="">Ketik sendiri…</option>${S.rute.map(r => `<option value="${esc(r.id)}"${r.id === f.ruteId ? ' selected' : ''}>${esc(r.nama)}</option>`).join('')}</select>${f.ruteId ? '' : `<input data-uj="ruteNama" value="${esc(f.ruteNama)}" placeholder="mis. Jakarta – Cikarang" autocomplete="off" aria-label="Nama rute">`}`)}
      ${field(`Driver ${mitra ? 'mitra' : 'internal'}`, `<select data-ujs="driverId"><option value="">Tanpa driver terpilih</option>${drv.map(d => `<option value="${esc(d.id)}"${d.id === f.driverId ? ' selected' : ''}>${esc(d.nama)}${d.unit ? ' · ' + esc(d.unit) : ''}</option>`).join('')}</select>`)}
      <div class="uj-g2">${field('Jarak pulang-pergi (km)', inp('jarak', f.jarak, { m: 1, a: 'Jarak pulang-pergi km' }))}${field('Rasio BBM (1 liter = … km)', inp('rasio', f.rasio, { m: 1, ph: '5', a: 'Rasio BBM km per liter' }))}</div>
      <div class="uj-g2">${field('Harga solar (Rp/liter)', inp('solar', fmtAngka(rpNum(f.solar)), { a: 'Harga solar' }))}${field('Tol (Rp)', inp('tol', fmtAngka(rpNum(f.tol)), { a: 'Tol' }), 1)}</div>
      <div class="uj-g2">${field('TKBM (Rp)', inp('tkbm', fmtAngka(rpNum(f.tkbm)), { a: 'TKBM' }), 1)}${field(S.peng.labelOps || LABEL_OPS, inp('ops', fmtAngka(rpNum(f.ops)), { a: S.peng.labelOps || LABEL_OPS }))}</div>
      ${mitra ? field('Insentif driver mitra (Rp)', inp('insentif', fmtAngka(rpNum(f.insentif)), { a: 'Insentif driver' })) : ''}
      ${komponenAktif(S.peng.komponen, f.jenis).map(c => field(c.nama, `<input data-ujx="${esc(c.id)}" inputmode="numeric" value="${esc(fmtAngka(rpNum((f.ekstra || {})[c.id])))}" placeholder="0" autocomplete="off" aria-label="${esc(c.nama)}">`, 1)).join('')}
      <button type="button" class="uj-tambah" data-ujt="kmtambah">+ Tambah komponen biaya</button>
      ${field('Catatan', `<input data-uj="catatan" value="${esc(f.catatan)}" placeholder="Opsional, tampil di slip" autocomplete="off" aria-label="Catatan">`)}
    </div>
    <div class="uj-hasil" id="uj-hasil" aria-live="polite">${htmlHasil()}</div>
    <div class="uj-bar"><div><small>Uang jalan</small><b id="uj-total">${fmt(hitung(masuk(f)).total)}</b></div><button type="button" class="mr-btn" data-ujt="simpan">Simpan</button><button type="button" class="mr-btn mr-btn--utama" data-ujt="pdf-form">Bagikan PDF</button></div>`;
  }
  const dasarRute = r => ({ nama: r.nama || '', jarak: r.jarak || '', tol: r.tol || '', tkbm: r.tkbm || '', ops: r.ops || '', catatan: r.catatan || '' });
  function htmlForm(kol) {
    const f = S.form; if (!f || f.kol !== kol) return '';
    const rute = kol === 'rute';
    return `<div class="uj-kartu uj-formm"><b>${f.id ? 'Ubah' : 'Tambah'} ${rute ? 'rute' : kol === 'komp' ? 'komponen biaya' : 'driver'}</b>
      ${rute ? `${field('Nama rute', `<input data-ujm="nama" value="${esc(f.nama)}" placeholder="mis. Jakarta – Cikarang" autocomplete="off">`)}<div class="uj-g2">${field('Jarak pulang-pergi (km)', `<input data-ujm="jarak" inputmode="decimal" value="${esc(f.jarak)}" placeholder="0">`)}${field('Tol (Rp)', `<input data-ujm="tol" inputmode="numeric" value="${esc(fmtAngka(rpNum(f.tol)))}" placeholder="0">`, 1)}</div><div class="uj-g2">${field('TKBM (Rp)', `<input data-ujm="tkbm" inputmode="numeric" value="${esc(fmtAngka(rpNum(f.tkbm)))}" placeholder="0">`, 1)}${field(S.peng.labelOps || LABEL_OPS, `<input data-ujm="ops" inputmode="numeric" value="${esc(fmtAngka(rpNum(f.ops)))}" placeholder="0">`)}</div>${S.peng.komponen.map(c => field(c.nama + ' (bawaan rute)', `<input data-ujmx="${esc(c.id)}" inputmode="numeric" value="${esc(fmtAngka(rpNum((f.ekstra || {})[c.id])))}" placeholder="0" autocomplete="off">`, 1)).join('')}${field('Catatan', `<input data-ujm="catatan" value="${esc(f.catatan)}" autocomplete="off">`)}`
      : kol === 'komp' ? `${field('Nama komponen biaya', `<input data-ujm="nama" value="${esc(f.nama)}" placeholder="mis. Uang parkir, Biaya timbang, Uang inap" autocomplete="off">`)}<div class="uj-g2">${field('Berlaku untuk', `<select data-ujm="berlaku">${Object.entries(BERLAKU).map(([k, v]) => `<option value="${k}"${(f.berlaku || 'semua') === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`)}${field('Nominal bawaan (Rp)', `<input data-ujm="bawaan" inputmode="numeric" value="${esc(fmtAngka(rpNum(f.bawaan)))}" placeholder="0">`, 1)}</div>`
      : `${field('Nama driver', `<input data-ujm="nama" value="${esc(f.nama)}" autocomplete="off">`)}<div class="uj-seg"><button type="button" class="${f.jenis !== 'mitra' ? 'is-aktif' : ''}" data-ujt="mjenis" data-x="internal">Internal (gaji)</button><button type="button" class="${f.jenis === 'mitra' ? 'is-aktif' : ''}" data-ujt="mjenis" data-x="mitra">Mitra (kontrak)</button></div><div class="uj-g2">${field('Unit atau plat', `<input data-ujm="unit" value="${esc(f.unit)}" placeholder="mis. CDE B 1234 XY" autocomplete="off">`)}${field('Rasio BBM unit (1 liter = … km)', `<input data-ujm="rasio" inputmode="decimal" value="${esc(f.rasio)}" placeholder="5">`)}</div>${f.jenis === 'mitra' ? `<div class="uj-g2">${field('Insentif per trip (Rp)', `<input data-ujm="insentif" inputmode="numeric" value="${esc(fmtAngka(rpNum(f.insentif)))}" placeholder="0">`)}${field('Kontrak atau catatan', `<input data-ujm="catatan" value="${esc(f.catatan)}" placeholder="mis. kontrak sampai Des 2026" autocomplete="off">`)}</div>` : `${field('No. HP', `<input data-ujm="hp" inputmode="tel" value="${esc(f.hp || '')}" autocomplete="off">`)}`}`}
      <p class="mr-galat" data-ujg hidden></p>
      <div class="uj-aksi"><button type="button" class="mr-btn" data-ujt="mbatal">Batal</button><button type="button" class="mr-btn mr-btn--utama" data-ujt="msimpan">Simpan</button></div></div>`;
  }
  function htmlRute() {
    return `${htmlForm('rute')}<div class="uj-tb"><button type="button" class="mr-btn mr-btn--utama mr-btn--kecil" data-ujt="mtambah" data-x="rute">+ Tambah rute</button></div>
    <div class="uj-daftar">${S.rute.length ? S.rute.map(r => `<div class="uj-item"><div><b>${esc(r.nama)}</b><small>${esc(r.jarak || '–')} km · tol ${fmt(rpNum(r.tol))} · TKBM ${fmt(rpNum(r.tkbm))} · ${esc(S.peng.labelOps || LABEL_OPS)} ${fmt(rpNum(r.ops))}</small>${r.catatan ? `<small>${esc(r.catatan)}</small>` : ''}</div><div class="uj-item__a"><button type="button" class="mr-btn mr-btn--kecil" data-ujt="mubah" data-x="rute|${esc(r.id)}">Ubah</button><button type="button" class="mr-btn mr-btn--kecil" data-ujt="mhapus" data-x="rute|${esc(r.id)}" aria-label="Hapus rute ${esc(r.nama)}">Hapus</button></div></div>`).join('') : '<p class="mr-sub">Belum ada rute. Tambahkan rute yang sering dipakai supaya jarak, tol, dan biaya terisi otomatis di kalkulator.</p>'}</div>`;
  }
  function htmlKomponen() {
    return `<p class="mr-sub qt-ket">Komponen biaya tambahan di luar BBM, tol, TKBM, ${esc(S.peng.labelOps || LABEL_OPS)}, dan insentif. Setiap komponen yang dibuat di sini otomatis muncul sebagai isian di kalkulator, ikut terhitung, dan tampil di slip PDF.</p>
    <div class="uj-kartu"><label class="uj-f"><span>Nama biaya bawaan "mel" di kalkulator</span><input data-ujp="labelOps" value="${esc(S.peng.labelOps || LABEL_OPS)}" autocomplete="off" aria-label="Nama biaya bawaan"></label><div class="uj-aksi"><button type="button" class="mr-btn mr-btn--kecil" data-ujt="psimpan">Simpan nama</button></div></div>
    ${htmlForm('komp')}<div class="uj-tb"><button type="button" class="mr-btn mr-btn--utama mr-btn--kecil" data-ujt="mtambah" data-x="komp">+ Tambah komponen biaya</button></div>
    <div class="uj-daftar">${S.peng.komponen.length ? S.peng.komponen.map(c => `<div class="uj-item"><div><b>${esc(c.nama)}</b><small>${esc(BERLAKU[c.berlaku] || BERLAKU.semua)}${c.bawaan ? ` · bawaan ${fmt(rpNum(c.bawaan))}` : ''}</small></div><div class="uj-item__a"><button type="button" class="mr-btn mr-btn--kecil" data-ujt="mubah" data-x="komp|${esc(c.id)}">Ubah</button><button type="button" class="mr-btn mr-btn--kecil" data-ujt="mhapus" data-x="komp|${esc(c.id)}" aria-label="Hapus komponen ${esc(c.nama)}">Hapus</button></div></div>`).join('') : '<p class="mr-sub">Belum ada komponen tambahan.</p>'}</div>`;
  }
  function htmlDriver() {
    return `${htmlForm('driver')}<div class="uj-tb"><button type="button" class="mr-btn mr-btn--utama mr-btn--kecil" data-ujt="mtambah" data-x="driver">+ Tambah driver</button></div>
    <div class="uj-daftar">${S.driver.length ? S.driver.map(d => `<div class="uj-item"><div><b>${esc(d.nama)}</b> <span class="uj-lencana${d.jenis === 'mitra' ? ' uj-lencana--mitra' : ''}">${d.jenis === 'mitra' ? 'Mitra' : 'Internal'}</span><small>${esc(d.unit || 'unit belum diisi')} · rasio 1 : ${esc(d.rasio || '–')}${d.jenis === 'mitra' ? ` · insentif ${fmt(rpNum(d.insentif))}` : ''}</small>${d.catatan ? `<small>${esc(d.catatan)}</small>` : ''}</div><div class="uj-item__a"><button type="button" class="mr-btn mr-btn--kecil" data-ujt="mubah" data-x="driver|${esc(d.id)}">Ubah</button><button type="button" class="mr-btn mr-btn--kecil" data-ujt="mhapus" data-x="driver|${esc(d.id)}" aria-label="Hapus driver ${esc(d.nama)}">Hapus</button></div></div>`).join('') : '<p class="mr-sub">Belum ada driver. Driver internal (gaji) dan mitra (kontrak) disimpan di sini; rasio BBM unit dan insentif mitra terisi otomatis di kalkulator.</p>'}</div>`;
  }
  function htmlRiwayat() {
    return `<div class="uj-daftar">${S.slip.length ? S.slip.map(s => `<div class="uj-item"><div><b>${esc(s.nomor)} · ${esc(s.ruteNama || 'tanpa rute')}</b><small>${esc(tglId(s.tanggal))} · ${esc(s.driverNama || 'tanpa driver')} (${s.jenis === 'mitra' ? 'mitra' : 'internal'}) · <b>${fmt(s.total)}</b></small></div><div class="uj-item__a"><button type="button" class="mr-btn mr-btn--kecil" data-ujt="sbuka" data-x="${esc(s.id)}">Buka</button><button type="button" class="mr-btn mr-btn--kecil" data-ujt="spdf" data-x="${esc(s.id)}">PDF</button><button type="button" class="mr-btn mr-btn--kecil" data-ujt="shapus" data-x="${esc(s.id)}" aria-label="Hapus slip ${esc(s.nomor)}">Hapus</button></div></div>`).join('') : '<p class="mr-sub">Belum ada slip tersimpan. Isi kalkulator lalu tekan Simpan.</p>'}</div>`;
  }
  function gambar() {
    const r = root(); if (!r) return;
    r.innerHTML = `<div class="uj"><div class="uj-kepala"><h2>Uang Jalan</h2><span class="qt-info"><button type="button" class="qt-info__ikon" aria-label="Tentang Uang Jalan"><span aria-hidden="true">i</span></button><span class="qt-info__pop" role="tooltip"><b>Tentang Uang Jalan</b><p>Biaya internal untuk armada sendiri, tidak masuk penawaran. Uang jalan = BBM (jarak ÷ rasio × harga solar) + tol + TKBM + biaya operasional distribusi, ditambah insentif untuk driver mitra. Rute dan driver disimpan di master supaya perhitungan berikutnya terisi otomatis.</p></span></span></div>
      <div class="uj-tabs" role="tablist">${tabBtn('kalkulator', 'Kalkulator')}${tabBtn('rute', 'Master rute')}${tabBtn('driver', 'Master driver')}${tabBtn('komp', 'Komponen')}${tabBtn('riwayat', 'Riwayat')}</div>
      <div class="uj-isi">${S.muat ? '<p class="mr-sub">Memuat…</p>' : S.tab === 'kalkulator' ? htmlKalkulator() : S.tab === 'rute' ? htmlRute() : S.tab === 'driver' ? htmlDriver() : S.tab === 'komp' ? htmlKomponen() : htmlRiwayat()}</div></div>`;
  }
  function segarHasil() { const h = document.getElementById('uj-hasil'), t = document.getElementById('uj-total'); if (h) h.innerHTML = htmlHasil(); if (t) t.textContent = fmt(hitung(masuk()).total); }

  /* ---------- PDF slip ---------- */
  function buatPdf(s) {
    const { jsPDF } = window.jspdf || {}; if (!jsPDF) throw new Error('Pustaka PDF belum termuat. Coba lagi sebentar lagi.');
    const d = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'p', compress: true }), L = 12, R = 148 - 12; let y = 16;
    d.setFont('helvetica', 'bold'); d.setFontSize(13); d.text('SLIP UANG JALAN', L, y); d.setFontSize(9); d.setFont('helvetica', 'normal'); d.text('PT Indo Sukses Logistik', R, y, { align: 'right' }); y += 6;
    d.setDrawColor(40); d.line(L, y, R, y); y += 6;
    const kv = (k, v) => { d.setFont('helvetica', 'normal'); d.setTextColor(110); d.text(k, L, y); d.setTextColor(20); d.setFont('helvetica', 'bold'); d.text(String(v || '-'), L + 30, y); y += 5.5; };
    kv('Nomor', s.nomor); kv('Tanggal', tglId(s.tanggal)); kv('Rute', s.ruteNama); kv('Jarak PP', s.jarak ? `${s.jarak} km` : '-'); kv('Driver', `${s.driverNama || '-'} (${s.jenis === 'mitra' ? 'mitra' : 'internal'})`);
    y += 2; d.line(L, y, R, y); y += 6;
    (s.baris || []).filter(b => b.v || !b.opsi).forEach(b => { d.setFont('helvetica', 'normal'); d.setTextColor(20); d.setFontSize(10); d.text(b.n + (b.ket && b.k === 'bbm' ? `  (${b.ket})` : ''), L, y); d.setFont('helvetica', 'bold'); d.text(fmt(b.v), R, y, { align: 'right' }); y += 6; });
    y += 1; d.setLineWidth(0.5); d.line(L, y, R, y); y += 7; d.setFontSize(12); d.text('TOTAL UANG JALAN', L, y); d.text(fmt(s.total), R, y, { align: 'right' }); y += 8;
    if (s.catatan) { d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(90); d.splitTextToSize('Catatan: ' + s.catatan, R - L).forEach(t => { d.text(t, L, y); y += 4.5; }); }
    y = Math.max(y + 14, 150); d.setFontSize(9); d.setTextColor(60); d.setFont('helvetica', 'normal'); d.text('Dibuat', L + 8, y); d.text('Diterima driver', R - 8, y, { align: 'right' }); d.line(L, y + 18, L + 38, y + 18); d.line(R - 38, y + 18, R, y + 18);
    return d.output('blob');
  }
  async function bagikan(s) {
    const blob = buatPdf(s), nama = `Uang-Jalan-${String(s.nomor).replace(/[^A-Za-z0-9-]/g, '-')}.pdf`, f = new File([blob], nama, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: nama }); return; } catch (er) { if (er && er.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- slip dari isian ---------- */
  function slipDariForm(nomor) {
    const f = S.f, h = hitung(masuk(f)), r = S.rute.find(x => x.id === f.ruteId), d = S.driver.find(x => x.id === f.driverId);
    return { id: f.id || uid('uj'), nomor, tanggal: hariIni(), jenis: f.jenis, ruteId: f.ruteId || '', ruteNama: r ? r.nama : String(f.ruteNama || '').trim(), driverId: f.driverId || '', driverNama: d ? d.nama : '', jarak: desimal(f.jarak), rasio: desimal(f.rasio), solar: rpNum(f.solar), tol: rpNum(f.tol), tkbm: rpNum(f.tkbm), ops: rpNum(f.ops), insentif: f.jenis === 'mitra' ? rpNum(f.insentif) : 0, ekstra: { ...(f.ekstra || {}) }, catatan: String(f.catatan || '').trim(), baris: h.baris, total: h.total, labelOps: S.peng.labelOps };
  }
  const nomorBaru = () => { const t = hariIni(), k = 'UJ-' + t.replace(/-/g, '').slice(2); const n = S.slip.filter(s => String(s.nomor).startsWith(k)).length + 1; return `${k}-${String(n).padStart(2, '0')}`; };
  const dariSlip = s => ({ id: s.id, jenis: s.jenis, ruteId: s.ruteId || '', ruteNama: s.ruteNama || '', driverId: s.driverId || '', jarak: s.jarak ? String(s.jarak) : '', rasio: s.rasio ? String(s.rasio) : '', solar: String(s.solar || ''), tol: String(s.tol || ''), tkbm: String(s.tkbm || ''), ops: String(s.ops || ''), insentif: String(s.insentif || ''), ekstra: { ...Object.fromEntries(S.peng.komponen.map(c => [c.id, ''])), ...(s.ekstra || {}) }, catatan: s.catatan || '' });

  /* ---------- aksi ---------- */
  async function simpanSlip(pdf) {
    const f = S.f; if (!String(f.ruteNama).trim() && !f.ruteId) { toast('Isi atau pilih rute dulu.', 'bahaya'); return null; }
    if (!(hitung(masuk(f)).total > 0)) { toast('Isi jarak, rasio BBM, dan harga solar dulu supaya uang jalan terhitung.', 'bahaya'); return null; }
    const lama = S.slip.find(x => x.id === f.id), s = slipDariForm(lama ? lama.nomor : nomorBaru()); if (lama) s.tanggal = lama.tanggal;
    try { await DB().simpan('uj_slip', s.id, s); if (rpNum(f.solar) && rpNum(f.solar) !== S.peng.solar) { S.peng.solar = rpNum(f.solar); await simpanPeng(); } }
    catch (er) { toast(`<b>GAGAL menyimpan.</b> ${esc(er.message || er)}`, 'bahaya'); return null; }
    const i = S.slip.findIndex(x => x.id === s.id); if (i >= 0) S.slip[i] = s; else S.slip.unshift(s); S.f.id = s.id; return s;
  }
  /* pengaturan umum (harga solar bawaan, nama biaya mel, komponen tambahan) */
  async function simpanPeng(baru) { const p = baru || S.peng; await DB().simpan('uj_pengaturan', 'umum', p); S.peng = p; }
  async function klik(t, x) {
    if (t === 'tab') { S.tab = x; S.form = null; gambar(); }
    else if (t === 'jenis') { S.f.jenis = x; if (S.f.driverId && !S.driver.some(d => d.id === S.f.driverId && d.jenis === x)) S.f.driverId = ''; gambar(); }
    else if (t === 'simpan') { const s = await simpanSlip(); if (s) { toast(`Slip <b>${esc(s.nomor)}</b> tersimpan di Riwayat.`); gambar(); } }
    else if (t === 'pdf-form') { const s = await simpanSlip(); if (!s) return; try { await bagikan(s); gambar(); } catch (er) { toast(esc(er.message), 'bahaya'); } }
    else if (t === 'spdf') { const s = S.slip.find(z => z.id === x); if (s) try { await bagikan(s); } catch (er) { toast(esc(er.message), 'bahaya'); } }
    else if (t === 'sbuka') { const s = S.slip.find(z => z.id === x); if (s) { S.f = dariSlip(s); S.tab = 'kalkulator'; gambar(); } }
    else if (t === 'shapus') { const s = S.slip.find(z => z.id === x); if (!s || !await tanya({ judul: 'Hapus slip?', bahaya: true, aksi: 'Hapus slip', isi: `Slip <b>${esc(s.nomor)}</b> (${esc(s.ruteNama || 'tanpa rute')}, ${fmt(s.total)}) dihapus dari Riwayat.` })) return; try { await DB().hapus('uj_slip', s.id); } catch (er) { return toast(`<b>GAGAL menghapus.</b> ${esc(er.message)}`, 'bahaya'); } S.slip = S.slip.filter(z => z.id !== s.id); gambar(); }
    else if (t === 'kmtambah') { S.tab = 'komp'; S.form = { kol: 'komp', id: '', nama: '', berlaku: 'semua', bawaan: '' }; gambar(); }
    else if (t === 'psimpan') { const v = String((root().querySelector('[data-ujp="labelOps"]') || {}).value || '').trim(); if (!v) return toast('Isi nama biaya.', 'bahaya'); S.peng.labelOps = v; await simpanPeng(); toast('Nama biaya tersimpan.'); gambar(); }
    else if (t === 'mtambah') { S.form = x === 'komp' ? { kol: 'komp', id: '', nama: '', berlaku: 'semua', bawaan: '' } : x === 'rute' ? { kol: 'rute', id: '', nama: '', jarak: '', tol: '', tkbm: '', ops: '', catatan: '', ekstra: {} } : { kol: 'driver', id: '', nama: '', jenis: 'internal', unit: '', rasio: '', insentif: '', catatan: '', hp: '' }; gambar(); }
    else if (t === 'mubah') { const [kol, id] = x.split('|'), d = (kol === 'rute' ? S.rute : kol === 'komp' ? S.peng.komponen : S.driver).find(z => z.id === id); if (d) { S.form = { kol, ...d, ekstra: { ...(d.ekstra || {}) } }; gambar(); } }
    else if (t === 'mbatal') { S.form = null; gambar(); }
    else if (t === 'mjenis') { S.form.jenis = x; gambar(); }
    else if (t === 'msimpan') {
      const f = S.form, g = root().querySelector('[data-ujg]'), salah = m => { g.hidden = false; g.textContent = m; };
      if (!String(f.nama || '').trim()) return salah(f.kol === 'rute' ? 'Isi nama rute.' : 'Isi nama driver.');
      if (f.kol === 'komp') {
        if (S.peng.komponen.some(z => z.id !== f.id && String(z.nama).trim().toLowerCase() === String(f.nama).trim().toLowerCase())) return salah('Nama komponen ini sudah ada.');
        const c = { id: f.id || uid('uk'), nama: String(f.nama).trim(), berlaku: f.berlaku || 'semua', bawaan: rpNum(f.bawaan) }, lama = S.peng.komponen.slice(), i = lama.findIndex(z => z.id === c.id); if (i >= 0) lama[i] = c; else lama.push(c);
        try { await simpanPeng({ ...S.peng, komponen: lama }); } catch (er) { return salah('GAGAL menyimpan: ' + (er.message || er)); }
        if (i < 0) S.f.ekstra[c.id] = c.bawaan ? String(c.bawaan) : ''; S.form = null; toast(`Komponen <b>${esc(c.nama)}</b> tersimpan; sekarang muncul di kalkulator.`); gambar(); return;
      }
      const lis = f.kol === 'rute' ? S.rute : S.driver;
      if (lis.some(z => z.id !== f.id && String(z.nama).trim().toLowerCase() === String(f.nama).trim().toLowerCase())) return salah('Nama ini sudah ada di master.');
      const { kol, ...data } = f; if (f.kol === 'rute') data.ekstra = Object.fromEntries(Object.entries(f.ekstra || {}).filter(([, v]) => rpNum(v) > 0).map(([k, v]) => [k, rpNum(v)])); data.id = f.id || uid(f.kol === 'rute' ? 'ur' : 'ud'); data.nama = String(f.nama).trim();
      try { await DB().simpan(f.kol === 'rute' ? 'uj_rute' : 'uj_driver', data.id, data); } catch (er) { return salah('GAGAL menyimpan: ' + (er.message || er)); }
      const i = lis.findIndex(z => z.id === data.id); if (i >= 0) lis[i] = data; else lis.push(data); lis.sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id')); S.form = null; toast(`${f.kol === 'rute' ? 'Rute' : 'Driver'} <b>${esc(data.nama)}</b> tersimpan.`); gambar();
    }
    else if (t === 'mhapus') {
      const [kol, id] = x.split('|'), lis = kol === 'rute' ? S.rute : kol === 'komp' ? S.peng.komponen : S.driver, d = lis.find(z => z.id === id);
      if (!d || !await tanya({ judul: `Hapus ${kol === 'rute' ? 'rute' : kol === 'komp' ? 'komponen' : 'driver'}?`, bahaya: true, aksi: 'Hapus', isi: `<b>${esc(d.nama)}</b> dihapus dari master. Slip yang sudah tersimpan tidak berubah.` })) return;
      try { if (kol === 'komp') await simpanPeng({ ...S.peng, komponen: S.peng.komponen.filter(z => z.id !== id) }); else await DB().hapus(kol === 'rute' ? 'uj_rute' : 'uj_driver', id); } catch (er) { return toast(`<b>GAGAL menghapus.</b> ${esc(er.message)}`, 'bahaya'); }
      if (kol === 'komp') { delete S.f.ekstra[id]; } else if (kol === 'rute') S.rute = S.rute.filter(z => z.id !== id); else S.driver = S.driver.filter(z => z.id !== id); gambar();
    }
  }
  function pilih(f, v) {
    const F = S.f;
    if (f === 'ruteId') { F.ruteId = v; const r = S.rute.find(z => z.id === v); if (r) { F.jarak = String(r.jarak || ''); F.tol = String(r.tol || ''); F.tkbm = String(r.tkbm || ''); F.ops = String(r.ops || ''); F.ruteNama = r.nama; S.peng.komponen.forEach(c => { const v = (r.ekstra || {})[c.id]; F.ekstra[c.id] = v ? String(v) : (c.bawaan ? String(c.bawaan) : ''); }); } }
    if (f === 'driverId') { F.driverId = v; const d = S.driver.find(z => z.id === v); if (d) { if (d.rasio) F.rasio = String(d.rasio); if (d.jenis === 'mitra') F.insentif = String(d.insentif || ''); } }
    gambar();
  }

  /* ---------- pemasangan ---------- */
  let terpasang = false;
  function pasang() {
    if (terpasang) return; terpasang = true; const r = root();
    r.addEventListener('click', ev => { const b = ev.target.closest('[data-ujt]'); if (b) { ev.preventDefault(); klik(b.dataset.ujt, b.dataset.x); } });
    r.addEventListener('input', ev => {
      const t = ev.target;
      if (t.dataset.uj && S.f) { S.f[t.dataset.uj] = t.value; if (!['ruteNama', 'catatan'].includes(t.dataset.uj)) segarHasil(); }
      else if (t.dataset.ujx && S.f) { S.f.ekstra = S.f.ekstra || {}; S.f.ekstra[t.dataset.ujx] = t.value; segarHasil(); }
      else if (t.dataset.ujmx && S.form) { S.form.ekstra = S.form.ekstra || {}; S.form.ekstra[t.dataset.ujmx] = t.value; }
      else if (t.dataset.ujm && S.form) S.form[t.dataset.ujm] = t.value;
    });
    r.addEventListener('change', ev => { const t = ev.target; if (t.dataset.ujs) pilih(t.dataset.ujs, t.value); });
  }
  async function mulai() {
    const r = root(); if (!r || !DB()) return;
    pasang(); if (!S.f) S.f = baruF(); S.muat = true; gambar();
    try {
      const d = await DB().muat(); const urut = a => (a || []).sort((x, y) => String(x.nama).localeCompare(String(y.nama), 'id'));
      S.rute = urut(d.rute); S.driver = urut(d.driver); S.slip = (d.slip || []).sort((a, b) => String(b.nomor).localeCompare(String(a.nomor)));
      if (d.peng) S.peng = { solar: d.peng.solar || SOLAR_AWAL, labelOps: d.peng.labelOps || LABEL_OPS, komponen: Array.isArray(d.peng.komponen) ? d.peng.komponen : [] };
      if (!S.f.solar) S.f.solar = String(S.peng.solar);
      S.peng.komponen.forEach(c => { if (S.f.ekstra[c.id] === undefined) S.f.ekstra[c.id] = c.bawaan ? String(c.bawaan) : ''; });
    } catch (er) { toast(`<b>Data Uang Jalan belum bisa dimuat.</b> ${esc(er.message || er)}. Pastikan aturan Firestore terbaru sudah terpasang.`, 'bahaya'); }
    S.muat = false; gambar();
  }
  if (typeof window !== 'undefined') window.ISLUJ = { mulai, hitung, buatPdf, _S: S };
  if (typeof module !== 'undefined') module.exports = { hitung };
})();
