/* ===========================================================
   PEMBUAT FORMAT LINI BISNIS BARU (F-02, F-03, F-04)
   Lima langkah: (1) nama dan kode, (2) kolom tabel, (3) bagian tabel, (4) syarat dan ketentuan, (5) pratinjau dan simpan.
   Struktur awal bisa ditebak dari contoh penawaran (Excel, CSV, atau PDF); hasil tebakan WAJIB diperiksa di langkah 2 dan 3.
   Definisi disimpan di Firestore (koleksi format_lini) dan dijalankan mesin tabel di formulir-lini.js.
   Setelah disimpan: lini otomatis dibuat di Master Rate (lini_bisnis) dan butir S&K masuk ke Pengaturan dokumen.
   =========================================================== */
(function () {
  'use strict';
  const FL = window.ISLFL; if (!FL) return;
  const C = () => window.__islCU || {}, QT = () => window.__qt || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const toast = (m, j) => C().toast ? C().toast(m, j) : console.log(m);
  const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  const angkaBukan = t => { const s = String(t ?? '').trim().replace(/^(rp\.?|idr|usd)\s*/i, '').replace(/\s+/g, ''); return /^-?\d{1,3}([.,]\d{3})*([.,]\d+)?$|^-?\d+([.,]\d+)?$/.test(s) && s !== ''; };
  const KODE_RE = /^[a-z][a-z0-9_]{2,29}$/;
  let BD = null, panel = null;

  const awal = () => ({ langkah: 1, nama: '', kode: '', kodeManual: false, ket: '', judul: '', pembuka: '', file: '', tebakan: false,
    kolom: [{ k: 'c0', nama: 'Layanan', num: false, ph: 'Nama layanan' }, { k: 'c1', nama: 'Satuan', num: false, ph: 'per kontainer' }, { k: 'c2', nama: 'Tarif (Rp)', num: true, ph: '0' }, { k: 'c3', nama: 'Keterangan', num: false, ph: 'Opsional' }],
    bagian: [{ judul: 'Layanan', sub: '', teks: '' }], tnc: '' });

  /* ---------- tebak struktur dari baris tabel (array of array of string) ---------- */
  function tebak(rowsMentah) {
    const rows = rowsMentah.map(r => r.map(c => String(c ?? '').trim())).filter(r => r.some(Boolean));
    if (!rows.length) throw new Error('Contoh kosong.');
    let h = rows.findIndex((r, i) => i < 20 && r.filter(Boolean).length >= 3 && r.filter(c => c && !angkaBukan(c)).length >= Math.ceil(r.filter(Boolean).length * 0.6));
    if (h < 0) h = rows.findIndex(r => r.filter(Boolean).length >= 2); if (h < 0) throw new Error('Baris judul kolom tidak ditemukan.');
    const head = rows[h], idx = head.map((c, i) => c ? i : -1).filter(i => i >= 0).filter(i => !/^no\.?$|^nomor$/i.test(head[i]));
    const body = rows.slice(h + 1);
    const kolom = idx.map((ci, n) => {
      const vals = body.map(r => r[ci]).filter(Boolean), namaK = head[ci];
      const num = /harga|tarif|rate|biaya|price|fee|charge|rp\b|\(rp\)|20\s?(ft|')|40\s?(ft|')|usd|idr/i.test(namaK) && !/satuan|keterangan|ket\.?/i.test(namaK) ? true : (vals.length >= 3 && vals.filter(angkaBukan).length / vals.length >= 0.6 && !/satuan|keterangan|ket\.?|uraian|layanan/i.test(namaK));
      return { k: 'c' + n, nama: namaK.slice(0, 40), num, ph: num ? '0' : '', ci };
    });
    if (!kolom.length) throw new Error('Kolom tidak terbaca.');
    if (!kolom.some(k => k.num)) { const t = kolom[kolom.length - 2] || kolom[kolom.length - 1]; if (t) t.num = true; }
    const bagian = []; let cur = null;
    body.forEach(r => {
      const isi = r.filter(Boolean);
      const judulBlok = isi.length === 1 && !angkaBukan(isi[0]) && (r[0] === isi[0] || r[idx[0]] === isi[0] || isi[0].length < 60) && (/^[A-Za-z]\.|^[IVX]+\./.test(isi[0]) || r.indexOf(isi[0]) <= 1);
      if (/^(total|subtotal|catatan|note|terms|syarat)/i.test(isi[0] || '')) return;
      if (judulBlok) { cur = { judul: isi[0].replace(/^([A-Za-z]|[IVX]+)[.)]\s*/, '').slice(0, 60), sub: '', teks: [] }; bagian.push(cur); return; }
      if (isi.length < 2) return;
      if (!cur) { cur = { judul: 'Layanan', sub: '', teks: [] }; bagian.push(cur); }
      const teksK = kolom.filter(k => !k.num && !/keterangan|ket\.?/i.test(k.nama)).slice(0, 3);
      const garis = teksK.map(k => r[k.ci] || '').join(' | ').replace(/(\s\|\s)+$/, '').trim();
      if (garis) cur.teks.push(garis);
    });
    if (!bagian.length) throw new Error('Baris layanan tidak terbaca.');
    return { kolom: kolom.map(({ ci, ...k }) => k), bagian: bagian.map(b => ({ judul: b.judul, sub: b.sub, teks: b.teks.join('\n') })) };
  }

  async function barisDariFile(f) {
    const nama = f.name.toLowerCase();
    if (/\.(xlsx|xls|csv)$/.test(nama)) {
      if (!window.XLSX) throw new Error('Pustaka Excel tidak termuat.');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    }
    if (/\.pdf$/.test(nama)) return barisDariPdf(f);
    throw new Error('Pilih file Excel (.xlsx, .xls), CSV, atau PDF.');
  }
  function muatSkrip(src) { return new Promise((ok, gagal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => gagal(new Error('Gagal memuat ' + src)); document.head.appendChild(s); }); }
  async function barisDariPdf(f) {
    if (!window.pdfjsLib) await muatSkrip('vendor/pdf.min.js');
    const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise, hasil = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
      const tc = await (await pdf.getPage(p)).getTextContent(), baris = [];
      tc.items.filter(i => String(i.str).trim()).forEach(i => { const y = Math.round(i.transform[5]); let b = baris.find(z => Math.abs(z.y - y) <= 3); if (!b) { b = { y, it: [] }; baris.push(b); } b.it.push({ x: i.transform[4], w: i.width || 0, s: String(i.str).trim() }); });
      baris.sort((a, b) => b.y - a.y).forEach(b => {
        b.it.sort((a, c) => a.x - c.x); const cell = []; let akhir = null;
        b.it.forEach(i => { if (akhir !== null && i.x - akhir < 9 && cell.length) cell[cell.length - 1] += ' ' + i.s; else cell.push(i.s); akhir = i.x + i.w; });
        hasil.push(cell);
      });
    }
    return hasil;
  }

  /* ---------- tampilan ---------- */
  const NAMA_LANGKAH = ['Nama dan kode', 'Kolom tabel', 'Bagian tabel', 'Syarat dan ketentuan', 'Pratinjau dan simpan'];
  function html() {
    const L = BD.langkah, nav = `<div class="fl-steps">${NAMA_LANGKAH.map((t, i) => `<span class="fl-chipbtn" aria-pressed="${L === i + 1}">${i + 1} · ${t}</span>`).join('')}</div>`;
    let isi = '';
    if (L === 1) isi = `<div class="fl-kartu"><div class="fl-grid2">
        <label class="fl-f"><span>Nama format lini *</span><input data-pf="nama" value="${esc(BD.nama)}" placeholder="Mis. Cold Chain Pharma" autocomplete="off"></label>
        <label class="fl-f"><span>Kode (huruf kecil, tanpa spasi) *</span><input data-pf="kode" value="${esc(BD.kode)}" placeholder="cold_chain" autocomplete="off"><small class="fl-mut">Dipakai sebagai ID lini di Master Rate. Tidak bisa diganti setelah disimpan.</small></label></div>
      <label class="fl-f"><span>Keterangan singkat</span><input data-pf="ket" value="${esc(BD.ket)}" placeholder="Satu kalimat tentang layanan ini" autocomplete="off"></label>
      <label class="fl-f"><span>Judul dokumen penawaran</span><input data-pf="judul" value="${esc(BD.judul)}" placeholder="Penawaran ${esc(BD.nama || 'Layanan')}" autocomplete="off"></label>
      <label class="fl-f"><span>Kalimat pembuka (opsional)</span><textarea data-pf="pembuka" rows="3" placeholder="Dengan hormat, bersama ini kami sampaikan tarif ... Tarif berlaku sampai {berlaku}.">${esc(BD.pembuka)}</textarea></label></div>
      <div class="fl-kartu"><div class="fl-sub-h">Mulai dari contoh penawaran (opsional)</div><div class="fl-mut">Unggah Excel, CSV, atau PDF contoh penawaran. Sistem menebak kolom dan bagian; <b>hasil tebakan perlu kamu cek di langkah 2 dan 3</b>. File tidak disimpan.</div>
        <input type="file" data-pf-file accept=".xlsx,.xls,.csv,.pdf" style="margin-top:8px">${BD.file ? `<div class="fl-ok" style="margin-top:6px">Ditebak dari <b>${esc(BD.file)}</b>: ${BD.kolom.length} kolom, ${BD.bagian.length} bagian.</div>` : ''}</div>`;
    if (L === 2) isi = `<div class="fl-kartu"><div class="fl-sub-h">Kolom tabel penawaran</div>${BD.tebakan ? '<div class="fl-wajib">Kolom ini hasil tebakan dari contoh. Periksa nama dan jenisnya.</div>' : ''}<div class="fl-mut">Minimal satu kolom teks (uraian layanan) dan satu kolom angka (tarif). Kolom angka berisi Rupiah.</div>
      ${BD.kolom.map((k, i) => `<div class="pf-kol"><input data-pf-k="${i}.nama" value="${esc(k.nama)}" placeholder="Nama kolom" aria-label="Nama kolom"><select data-pf-k="${i}.num" aria-label="Jenis"><option value="0" ${k.num ? '' : 'selected'}>Teks</option><option value="1" ${k.num ? 'selected' : ''}>Angka (Rp)</option></select><input data-pf-k="${i}.ph" value="${esc(k.ph)}" placeholder="Contoh isian" aria-label="Contoh isian">
        <span class="pf-kol__a"><button type="button" class="fl-x" data-pf-a="naik" data-i="${i}" aria-label="Naik" ${i ? '' : 'disabled'}>↑</button><button type="button" class="fl-x" data-pf-a="turun" data-i="${i}" aria-label="Turun" ${i < BD.kolom.length - 1 ? '' : 'disabled'}>↓</button><button type="button" class="fl-x" data-pf-a="kolom-hapus" data-i="${i}" aria-label="Hapus kolom">×</button></span></div>`).join('')}
      <button type="button" class="fl-tambah fl-tambah--kecil" data-pf-a="kolom-tambah">+ Tambah kolom</button></div>`;
    if (L === 3) {
      const teks = BD.kolom.filter(k => !k.num);
      isi = `<div class="fl-kartu"><div class="fl-sub-h">Bagian tabel</div>${BD.tebakan ? '<div class="fl-wajib">Bagian dan layanan ini hasil tebakan dari contoh. Periksa dan rapikan.</div>' : ''}<div class="fl-mut">Tiap bagian jadi satu tabel di PDF (huruf A, B, C diberikan otomatis). Tulis layanan awal satu per baris${teks.length > 1 ? `, kolom dipisah tanda | dengan urutan: ${teks.map(k => esc(k.nama)).join(' | ')}` : ''}. Harga diisi saat membuat quotation.</div>
      ${BD.bagian.map((b, i) => `<div class="fl-bx"><div class="fl-bx__h"><input class="fl-u" data-pf-b="${i}.judul" value="${esc(b.judul)}" placeholder="Nama bagian" aria-label="Nama bagian"><button type="button" class="fl-x fl-x--teks" data-pf-a="bagian-hapus" data-i="${i}" ${BD.bagian.length < 2 ? 'disabled' : ''}>Hapus bagian</button></div>
        <label class="fl-f"><span>Keterangan bagian (opsional)</span><input data-pf-b="${i}.sub" value="${esc(b.sub)}" autocomplete="off"></label>
        <label class="fl-f"><span>Layanan awal (satu per baris)</span><textarea data-pf-b="${i}.teks" rows="5">${esc(b.teks)}</textarea></label></div>`).join('')}
      <button type="button" class="fl-tambah fl-tambah--kecil" data-pf-a="bagian-tambah">+ Tambah bagian</button></div>`;
    }
    if (L === 4) isi = `<div class="fl-kartu"><div class="fl-sub-h">Syarat dan ketentuan khusus lini ini</div><div class="fl-mut">Satu butir per baris. Tersimpan di Pengaturan dokumen sebagai S&amp;K khusus lini ini, bisa diubah lagi di sana. Butir umum tetap ikut otomatis.</div>
      <textarea data-pf="tnc" rows="9" style="width:100%" placeholder="Pembayaran 30 hari setelah invoice diterima.&#10;Tarif belum termasuk PPN.">${esc(BD.tnc)}</textarea></div>`;
    if (L === 5) {
      const d = definisi(), g = galat();
      isi = `${g.length ? `<div class="mr-galat" style="display:block">${g.map(esc).join('<br>')}</div>` : ''}
      <div class="fl-kartu"><div class="fl-sub-h">${esc(d.nama || '(belum diberi nama)')} <span class="fl-tag">${esc(d.kode)}</span></div><div class="fl-mut">${esc(d.ket)}</div>
        ${d.bagian.map((b, bi) => `<div class="fl-bagian">${String.fromCharCode(65 + bi)}. ${esc(b.judul)}</div><div class="fl-tbl"><table><thead><tr>${d.kolom.map(k => `<th${k.num ? ' class="r"' : ''}>${esc(k.nama)}</th>`).join('')}</tr></thead><tbody>${(b.baris.length ? b.baris.slice(0, 4) : [{}]).map(r => `<tr>${d.kolom.map(k => `<td${k.num ? ' class="r"' : ''}>${k.num ? '<span class="fl-mut">harga</span>' : esc(r[k.k] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}</div>
      <div class="fl-kartu"><div class="fl-sub-h">Yang terjadi saat disimpan</div><ul class="pf-ul"><li>Format disimpan di database dan langsung muncul di pilihan “Buat quotation” tanpa deploy ulang.</li><li>Lini <b>${esc(d.kode)}</b> otomatis dibuat di Master Rate untuk diisi tarifnya.</li><li>${d.tnc.length} butir S&amp;K khusus masuk ke Pengaturan dokumen.</li></ul></div>`;
    }
    const L1 = L > 1, L5 = L === 5;
    return `<header class="mr-panel__kepala"><div><h2>Tambah format lini bisnis baru</h2><p class="mr-sub">Langkah ${L} dari 5 · ${NAMA_LANGKAH[L - 1]}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${C().ik ? C().ik('tutup') : '×'}</button></header>
    <div class="mr-panel__isi"><div class="mr-galat" id="pf-galat" hidden></div>${nav}${isi}</div>
    <footer class="mr-panel__kaki">${L1 ? '<button class="mr-btn" data-pf-a="mundur">Kembali</button>' : '<button class="mr-btn" data-aksi="tutup-layer">Batal</button>'}${L5 ? '<button class="mr-btn mr-btn--utama" data-pf-a="simpan">Simpan format lini</button>' : '<button class="mr-btn mr-btn--utama" data-pf-a="maju">Lanjut</button>'}</footer>`;
  }
  function gambar() { if (!panel) return; const y = panel.querySelector('.mr-panel__isi'), top = y ? y.scrollTop : 0; panel.innerHTML = html(); const z = panel.querySelector('.mr-panel__isi'); if (z) z.scrollTop = top; }

  /* ---------- definisi dan validasi ---------- */
  function definisi() {
    const teks = BD.kolom.filter(k => !k.num);
    const kolom = BD.kolom.map((k, i) => ({ k: 'c' + i, nama: String(k.nama || '').trim() || 'Kolom ' + (i + 1), num: !!k.num, ph: k.ph || '' }));
    const teksBaru = kolom.filter(k => !k.num);
    const bagian = BD.bagian.map(b => ({ judul: String(b.judul || '').trim() || 'Layanan', sub: String(b.sub || '').trim(), baris: String(b.teks || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).map(l => { const p = l.split('|').map(x => x.trim()), o = {}; teksBaru.forEach((k, i) => { o[k.k] = p[i] || ''; }); return o; }) }));
    return { kode: BD.kode, nama: String(BD.nama || '').trim(), ket: String(BD.ket || '').trim(), judul: String(BD.judul || '').trim() || (BD.nama ? 'Penawaran ' + BD.nama.trim() : ''), pembuka: String(BD.pembuka || '').trim(), kolom, bagian,
      tnc: String(BD.tnc || '').split(/\r?\n/).map(x => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean), teksJumlah: teks.length };
  }
  function galat(langkah) {
    const g = [], d = definisi(), L = langkah || 5;
    if (L >= 1) {
      if (!d.nama) g.push('Nama format wajib diisi.');
      if (!KODE_RE.test(d.kode)) g.push('Kode hanya huruf kecil, angka, dan garis bawah, diawali huruf, 3 sampai 30 karakter.');
      else if (FL.kodeDipakai(d.kode) || ((window.__islMR || {}).lini || []).some(l => l.id === d.kode)) g.push(`Kode “${d.kode}” sudah dipakai lini lain. Ganti kode.`);
    }
    if (L >= 2) {
      if (!d.kolom.some(k => !k.num)) g.push('Tambahkan minimal satu kolom teks (uraian layanan).');
      if (!d.kolom.some(k => k.num)) g.push('Tambahkan minimal satu kolom angka (tarif).');
      if (new Set(d.kolom.map(k => k.nama.toLowerCase())).size !== d.kolom.length) g.push('Nama kolom tidak boleh kembar.');
    }
    if (L >= 3 && !d.bagian.length) g.push('Minimal satu bagian tabel.');
    return g;
  }
  const periksa = l => { const g = galat(l), el = panel && panel.querySelector('#pf-galat'); if (g.length) { if (el) { el.hidden = false; el.innerHTML = g.map(esc).join('<br>'); } return false; } return true; };

  /* ---------- simpan ---------- */
  async function simpan(btn) {
    const g = galat(5); if (g.length) { gambar(); return; }
    const d = definisi(), tnc = d.tnc, simpananDef = { id: d.kode, kode: d.kode, nama: d.nama, ket: d.ket, judul: d.judul, pembuka: d.pembuka, kolom: d.kolom, bagian: d.bagian, dibuat: Date.now(), oleh: (window.__ISL && window.__ISL.email) || '' };
    btn.disabled = true; btn.textContent = 'Menyimpan…'; const catatan = [];
    try {
      await C().tulisDB(() => { FL.formatBuatan.push(simpananDef); FL.daftarkan(simpananDef); }, () => FL.formatBuatan.some(x => x.id === d.kode));
    } catch (er) { FL.formatBuatan = FL.formatBuatan.filter(x => x.id !== d.kode); btn.disabled = false; btn.textContent = 'Simpan format lini'; const el = panel.querySelector('#pf-galat'); el.hidden = false; el.innerHTML = `<b>GAGAL menyimpan format.</b> Belum ada yang tersimpan.<br>${esc(er.message)}`; return; }
    /* Master Rate: lini baru */
    try {
      if (window.__ISL && window.__ISL.buatLini && !((window.__islMR || {}).lini || []).some(l => l.id === d.kode)) {
        const data = { nama: d.nama, kategori: 'harga_tetap', butuhKontrak: false, aktif: true, deskripsi: d.ket || `Format ${d.nama}`, dariFormat: true };
        await window.__ISL.buatLini('lini_bisnis', d.kode, data, { oleh: window.__ISL.email });
        if (window.__islMR) window.__islMR.lini.push({ id: d.kode, ...data });
        catatan.push('lini dibuat di Master Rate');
      }
    } catch (er) { catatan.push('<b>lini di Master Rate belum terbuat</b> (' + esc(er.message) + '), buat manual lewat Master Rate &gt; Lini bisnis'); }
    /* S&K khusus lini */
    try {
      if (tnc.length) {
        const repo = QT()._Repo, p = clone(QT()._PENG || {}); p.tnc = Array.isArray(p.tnc) ? p.tnc : [];
        tnc.forEach((t, i) => p.tnc.push({ id: `fl-${d.kode}-${i + 1}`, kat: d.kode, kategori: 'lainnya', teks: { id: t, en: '' }, aktif: true }));
        await repo.simpanPengaturan(p); catatan.push(tnc.length + ' butir S&K tersimpan');
      }
    } catch (er) { catatan.push('<b>S&K belum tersimpan</b> (' + esc(er.message) + '), tambahkan di Pengaturan dokumen'); }
    toast(`Format <b>${esc(d.nama)}</b> tersimpan${catatan.length ? ': ' + catatan.join(', ') : ''}. Langsung bisa dipakai di Buat quotation.`);
    if (C().tutupPanel) C().tutupPanel(); panel = null; BD = null;
    if (QT()._Q && QT().gambar) QT().gambar();
  }

  /* ---------- peristiwa ---------- */
  function sinkron(t) {
    if (t.dataset.pf) { BD[t.dataset.pf] = t.value; if (t.dataset.pf === 'kode') { BD.kodeManual = true; BD.kode = slug(t.value) === t.value ? t.value : t.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); } if (t.dataset.pf === 'nama' && !BD.kodeManual) { BD.kode = slug(t.value); const k = panel.querySelector('[data-pf=kode]'); if (k) k.value = BD.kode; } return; }
    if (t.dataset.pfK) { const [i, f] = t.dataset.pfK.split('.'); const k = BD.kolom[+i]; if (!k) return; if (f === 'num') k.num = t.value === '1'; else k[f] = t.value; return; }
    if (t.dataset.pfB) { const [i, f] = t.dataset.pfB.split('.'); const b = BD.bagian[+i]; if (b) b[f] = t.value; }
  }
  document.addEventListener('input', ev => { if (!panel || !BD || !panel.contains(ev.target)) return; sinkron(ev.target); });
  document.addEventListener('change', async ev => {
    const t = ev.target; if (!panel || !BD || !panel.contains(t)) return;
    if (t.dataset && t.dataset.pfK && /\.num$/.test(t.dataset.pfK)) { sinkron(t); gambar(); return; }
    if (t.matches && t.matches('[data-pf-file]') && t.files && t.files[0]) {
      const f = t.files[0]; toast('Membaca contoh penawaran…');
      try { const t2 = tebak(await barisDariFile(f)); BD.kolom = t2.kolom; BD.bagian = t2.bagian; BD.file = f.name; BD.tebakan = true; toast('Tebakan selesai. Periksa kolom di langkah 2 dan bagian di langkah 3.'); }
      catch (er) { toast(`<b>Contoh tidak terbaca.</b> ${esc(er.message)} Isi kolom dan bagian manual di langkah berikutnya.`, 'bahaya'); }
      gambar();
    }
  });
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-pf-a]'); if (!b || !panel || !BD || !panel.contains(b)) return;
    const a = b.dataset.pfA, i = +b.dataset.i;
    if (a === 'maju') { if (!periksa(BD.langkah)) return; BD.langkah++; gambar(); }
    else if (a === 'mundur') { BD.langkah--; gambar(); }
    else if (a === 'kolom-tambah') { const n = BD.kolom.length; BD.kolom.push({ k: 'c' + n, nama: '', num: false, ph: '' }); gambar(); }
    else if (a === 'kolom-hapus') { BD.kolom.splice(i, 1); gambar(); }
    else if (a === 'naik' && i > 0) { [BD.kolom[i - 1], BD.kolom[i]] = [BD.kolom[i], BD.kolom[i - 1]]; gambar(); }
    else if (a === 'turun' && i < BD.kolom.length - 1) { [BD.kolom[i + 1], BD.kolom[i]] = [BD.kolom[i], BD.kolom[i + 1]]; gambar(); }
    else if (a === 'bagian-tambah') { BD.bagian.push({ judul: 'Bagian ' + (BD.bagian.length + 1), sub: '', teks: '' }); gambar(); }
    else if (a === 'bagian-hapus') { if (BD.bagian.length > 1) { BD.bagian.splice(i, 1); gambar(); } }
    else if (a === 'simpan') simpan(b);
  });

  window.ISLPembuat = {
    buka() {
      if (!(C().masterAtauAdmin && C().masterAtauAdmin())) return toast('Hanya pemilik atau admin yang bisa membuat format lini.', 'bahaya');
      BD = awal(); if (C().tutupPanel) C().tutupPanel();
      panel = C().bukaPanel(html(), 'lebar');
    },
    _tebak: tebak
  };
})();
