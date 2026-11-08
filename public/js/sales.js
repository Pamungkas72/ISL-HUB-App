/* ===========================================================
   SALES — Dashboard Performa (#pf-root), peringkat, tindak lanjut harian, profil sales, ekspor.
   Dimuat sebelum app-core.js; semua akses ke data dilakukan saat render (lewat window.__qt / window.__islCU).
   Aturan poin, ambang margin, dan target ada di bagian ATURAN di bawah, jadi mudah diubah tanpa menyentuh tampilan.
   =========================================================== */
(function () {
  'use strict';
  const ATURAN = {
    poinPerDisetujui: 1,        // sama rata per quotation disetujui (nilai tidak mempengaruhi poin)
    topTerlihat: 3,             // jumlah peringkat teratas yang terlihat semua sales
    ambangMarginKuning: 0.5,    // dari target margin: di bawah ini = merah; antara ini dan target = kuning
    targetBawaan: 0,            // target nilai disetujui per bulan (Rp) bila belum diatur
  };
  const FS = 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
  const S = { bulan: '', bulanAkhir: '', sales: '', fs: null, db: null, ranking: [], publik: [], ajuan: [], sistem: {}, siap: false, muat: false, galat: '' };
  const ISL = () => window.__ISL || {};
  const CU = () => window.__islCU || {};
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rp = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const ik = (n, s) => (CU().ik ? CU().ik(n, s) : '');
  const toast = (h, j) => (CU().toast ? CU().toast(h, j) : console.log(h));
  const bulanIni = () => String((ISL().hariIni && ISL().hariIni()) || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const namaBulan = (b) => { const [y, m] = String(b).split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); };
  const selisihHari = (a, b) => Math.round((new Date(String(b).slice(0, 10) + 'T00:00:00') - new Date(String(a).slice(0, 10) + 'T00:00:00')) / 864e5);
  // quotation sistem + riwayat PDF (quotation di luar sistem, sudah dalam bentuk quotation dengan sumber 'pdf')
  const semuaQ = () => (window.__qt && window.__qt._Repo ? [...window.__qt._Repo.semua(), ...(window.__qt._riwayatQ ? window.__qt._riwayatQ() : [])] : []);
  const totalJual = (q) => Number(q.ringkasan && q.ringkasan.totalJual) || 0;
  /* master: pemilik (menyetujui ajuan hapus dan mengatur target). kelola: pemilik dan admin (melihat semua sales, seperti aturan Firestore). */
  const master = () => !!ISL().master;
  const kelola = () => !!ISL().kelola;

  /* ---------------- hitung ---------------- */
  // Statistik satu orang pada satu bulan dari daftar quotation (sudah disaring per pemilik).
  function hitung(qs, bulan) {
    const aktif = qs.filter((q) => !q.digantikanOleh);
    const dikirim = aktif.filter((q) => String(q.dikirim || '').startsWith(bulan));
    const setuju = qs.filter((q) => q.status === 'disetujui' && String(q.diputuskan || '').startsWith(bulan));
    const tolak = qs.filter((q) => q.status === 'ditolak' && String(q.diputuskan || '').startsWith(bulan));
    const keputusan = setuju.length + tolak.length;
    const respon = [...setuju, ...tolak].filter((q) => q.dikirim && q.diputuskan).map((q) => selisihHari(q.dikirim, q.diputuskan));
    return {
      draf: qs.filter((q) => q.status === 'draf').length,
      terkirim: dikirim.length, disetujui: setuju.length, ditolak: tolak.length,
      menunggu: qs.filter((q) => q.status === 'terkirim' && !q.digantikanOleh).length,
      nilaiDisetujui: setuju.reduce((s, q) => s + totalJual(q), 0),
      poin: setuju.length * ATURAN.poinPerDisetujui,
      win: keputusan ? setuju.length / keputusan * 100 : null,
      respon: respon.length ? respon.reduce((a, b) => a + b, 0) / respon.length : null,
    };
  }
  const milik = (uid) => semuaQ().filter((q) => q.pemilikUid === uid);
  const daftarSales = () => {
    const m = new Map();
    S.publik.forEach((p) => m.set(p.uid, { uid: p.uid, nama: p.nama || p.uid, kode: p.kode || '', target: Number(p.targetBulanan) || null }));
    if (!kelola()) m.set(ISL().uid,{ ...(m.get(ISL().uid) || {}), uid: ISL().uid, nama: ISL().nama || ISL().email, kode: ISL().kodeSales || '' });
    return [...m.values()];
  };
  const targetDari = (s) => (s && s.target) || Number(S.sistem.targetDefault) || ATURAN.targetBawaan;

  /* ---------------- firestore ---------------- */
  async function siapkan() {
    if (S.fs) return;
    const cfg = await import('./firebase-config.js'); S.fs = await import(FS); S.db = cfg.db;
  }
  async function muatData() {
    S.muat = true; S.galat = '';
    try {
      await siapkan(); const { collection, getDocs, doc, getDoc } = S.fs;
      const [a, b] = await Promise.all([getDocs(collection(S.db, 'sales_publik')), getDoc(doc(S.db, 'sistem', 'performa'))]);
      S.publik = a.docs.map((d) => ({ uid: d.id, ...d.data() })); S.sistem = b.exists() ? b.data() : {};
      const r = await getDocs(collection(S.db, 'performa')); S.ranking = r.docs.map((d) => ({ id: d.id, ...d.data() }));
      try {
        const { query, where } = S.fs, aj = await getDocs(ISL().kelola ? collection(S.db, 'qt_ajuan_hapus') : query(collection(S.db, 'qt_ajuan_hapus'), where('pemilikUid', '==', ISL().uid)));
        S.ajuan = aj.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.waktu).localeCompare(String(a.waktu)));
      } catch (e) { S.ajuan = []; }
      S.siap = true;
    } catch (e) { S.galat = (e && (e.code || e.message)) || String(e); S.siap = true; }
    S.muat = false;
  }
  // Menyimpan ringkasan bulan berjalan supaya peringkat bisa dibaca semua sales tanpa membuka quotation orang lain.
  async function simpanRingkasan() {
    try {
      await siapkan(); const { doc, setDoc } = S.fs;
      const daftar = kelola() ? daftarSales() : [{ uid: ISL().uid, nama: ISL().nama || ISL().email }];
      for (const s of daftar) {
        const h = hitung(milik(s.uid), S.bulan);
        if (!kelola() && s.uid !== ISL().uid) continue;
        await setDoc(doc(S.db, 'performa', `${S.bulan}_${s.uid}`), { uid: s.uid, bulan: S.bulan, nama: s.nama, terkirim: h.terkirim, disetujui: h.disetujui, ditolak: h.ditolak, nilaiDisetujui: h.nilaiDisetujui, poin: h.poin, diperbarui: new Date().toISOString() });
        const i = S.ranking.findIndex((x) => x.id === `${S.bulan}_${s.uid}`);
        const baru = { id: `${S.bulan}_${s.uid}`, uid: s.uid, bulan: S.bulan, nama: s.nama, terkirim: h.terkirim, disetujui: h.disetujui, ditolak: h.ditolak, nilaiDisetujui: h.nilaiDisetujui, poin: h.poin };
        if (i >= 0) S.ranking[i] = baru; else S.ranking.push(baru);
      }
    } catch (e) { /* ringkasan bersifat pelengkap; gagal tidak mengganggu dashboard */ }
  }

  /* ---------------- tampilan ---------------- */
  const kartu = (ikon, nilai, label, extra = '') => `<div class="mr-stat__kartu ${extra}"><span class="mr-stat__ikon">${ik(ikon)}</span><div><b>${nilai}</b><small>${label}</small></div></div>`;

  function followUp(uid) {
    const R = window.__qt && window.__qt._R, PENG = (window.__qt && window.__qt._PENG) || {}, batas = PENG.tindakLanjutHari || 3;
    const L = (uid ? milik(uid) : semuaQ()).map((q) => ({ q, h: R.hariTanpaKabar(q) })).filter((x) => x.h !== null && x.h >= batas).sort((a, b) => b.h - a.h);
    return L;
  }
  function telpCustomer(q) {
    const c = CU().cust && CU().cust(q.customerId); if (!c || !c.kontak) return '';
    const k = c.kontak.find((x) => x.utama && x.telp) || c.kontak.find((x) => x.telp); return k ? String(k.telp).replace(/[^\d+]/g, '').replace(/^0/, '62').replace(/^\+/, '') : '';
  }
  const htmlFollowUp = (L) => !L.length ? '<p class="cu-kosong">Tidak ada yang perlu ditindaklanjuti hari ini.</p>' :
    `<div class="pf-fu">${L.slice(0, 30).map(({ q, h }) => { const tel = telpCustomer(q), teks = encodeURIComponent(`Selamat siang, kami dari ISL menindaklanjuti penawaran ${q.nomor || ''}. Apakah ada yang bisa kami bantu?`); return `<div class="pf-fu__r"><div><b>${esc(q.nomor || q.labelDraf || 'Quotation')}</b><div class="mr-sub">${q.sumber === 'pdf' ? 'Riwayat PDF · ' : ''}${esc(q.customerNama || '')} · ${h} hari tanpa kabar · ${rp(totalJual(q))}</div></div><div class="pf-fu__aksi"><button class="mr-btn mr-btn--kecil" data-pf="buka" data-id="${esc(q.id)}" data-jenis="${q.sumber === 'pdf' ? 'riwayat' : 'quotation'}">Buka</button><a class="mr-btn mr-btn--kecil" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${teks}">WhatsApp</a></div></div>`; }).join('')}</div>`;

  function htmlRanking(bulan) {
    const baris = S.ranking.filter((r) => r.bulan === bulan).sort((a, b) => b.poin - a.poin || b.nilaiDisetujui - a.nilaiDisetujui);
    if (!baris.length) return '<p class="cu-kosong">Belum ada data peringkat bulan ini.</p>';
    const saya = ISL().uid, lihat = kelola() ? baris.length : ATURAN.topTerlihat;
    const tampil = baris.map((r, i) => ({ r, i })).filter(({ r, i }) => kelola() || i < lihat || r.uid === saya);
    return `<div class="pf-rank">${tampil.map(({ r, i }) => `<div class="pf-rank__r ${r.uid === saya ? 'is-saya' : ''}"><em class="lp-rank">${i + 1}</em><span>${esc(r.nama || r.uid)}${r.uid === saya ? ' <small>(kamu)</small>' : ''}</span><b>${r.poin} poin</b><small>${r.disetujui} disetujui · ${rp(r.nilaiDisetujui)}</small></div>`).join('')}</div>`;
  }

  function htmlProfil() {
    const I = ISL(); if (kelola()) return '';
    return `<section class="mr-kartu cu-kartu"><h3>Profil sales</h3><div class="pf-profil"><label>Nama<input id="pf-nama" value="${esc(I.nama)}"></label><label>Telepon<input id="pf-telp" inputmode="tel" value="${esc(I.telepon)}"></label>
      <div class="pf-ttd"><span>Tanda tangan</span>${I.ttdSales ? `<img src="${esc(I.ttdSales)}" alt="Tanda tangan">` : '<small class="mr-sub">Belum diunggah</small>'}<input id="pf-ttd" type="file" accept="image/*"></div></div>
      <p class="mr-sub qt-ket" style="margin:8px 0">Tanda tangan ini ikut tercetak di PDF quotation milikmu, bersama cap perusahaan.</p><button class="mr-btn mr-btn--utama" data-pf="simpan-profil">Simpan profil</button></section>`;
  }

  const LABEL_AJUAN = { menunggu: 'Menunggu master', disetujui: 'Disetujui', ditolak: 'Ditolak' };
  function htmlAjuan() {
    const L = master() ? S.ajuan.filter((a) => a.status === 'menunggu') : S.ajuan.slice(0, 10);
    if (!L.length) return '';
    return `<section class="mr-kartu cu-kartu"><h3>Pengajuan hapus quotation${master() ? ` <span class="cu-jml">${L.length}</span>` : ''}</h3><div class="pf-fu">${L.map((a) => `<div class="pf-fu__r"><div><b>${esc(a.nomor || a.quotationId)}</b><div class="mr-sub">${esc(a.customerNama || '')} · ${esc(a.pemilikNama || '')}${master() ? '' : ' · ' + esc(LABEL_AJUAN[a.status] || a.status)}<br>${esc(a.alasan || '')}</div></div>${master() ? `<div class="pf-fu__aksi"><button class="mr-btn mr-btn--kecil mr-btn--bahaya" data-pf="ajuan-setuju" data-id="${esc(a.id)}">Setujui</button><button class="mr-btn mr-btn--kecil" data-pf="ajuan-tolak" data-id="${esc(a.id)}">Tolak</button></div>` : ''}</div>`).join('')}</div></section>`;
  }
  const htmlTargetMaster = () => (master() ? '<p class="mr-sub qt-ket">Target bulanan tiap sales diatur di Pengaturan > Akun.</p>' : '');

  function gambar() {
    const r = document.getElementById('pf-root'); if (!r) return;
    if (!S.bulan) S.bulan = bulanIni();
    const daftar = daftarSales();
    if (kelola() && !S.sales) S.sales = '';
    const uid = kelola() ? S.sales : ISL().uid, qs = uid ? milik(uid) : semuaQ(), h = hitung(qs, S.bulan);
    const sel = uid ? daftar.find((s) => s.uid === uid) : null;
    const tgt = uid ? targetDari(sel) : daftar.reduce((a, s) => a + targetDari(s), 0) || (Number(S.sistem.targetDefault) || 0);
    const cap = tgt ? Math.min(100, Math.round(h.nilaiDisetujui / tgt * 100)) : null;
    r.innerHTML = `
      <div class="pf-bar"><label>Bulan<input type="month" id="pf-bulan" value="${esc(S.bulan)}"></label><label>Ekspor sampai <small>(opsional)</small><input type="month" id="pf-bulan2" value="${esc(S.bulanAkhir)}" min="${esc(S.bulan)}"></label>
        ${kelola() ? `<label>Sales<select id="pf-sales"><option value="">Semua sales</option>${daftar.map((s) => `<option value="${esc(s.uid)}" ${s.uid === S.sales ? 'selected' : ''}>${esc(s.nama)}</option>`).join('')}</select></label>` : ''}
        <span class="mr-ruang"></span><button class="mr-btn" data-pf="excel">${ik('unduh', 16)} Excel</button><button class="mr-btn" data-pf="pdf">${ik('unduh', 16)} PDF</button></div>
      ${S.galat ? `<div class="mr-banner">${ik('info')}<div>Sebagian data belum bisa dimuat (${esc(S.galat)}). Pastikan aturan Firestore terbaru sudah dipasang.</div></div>` : ''}
      <div class="mr-stat">${kartu('kirim', h.terkirim, 'Quotation terkirim')}${kartu('setuju', h.disetujui, `Disetujui · ${rp(h.nilaiDisetujui)}`)}${kartu('target', h.win === null ? '—' : Math.round(h.win) + '%', `Win rate · ${h.ditolak} ditolak`)}${kartu('riwayat', h.respon === null ? '—' : Math.round(h.respon * 10) / 10 + ' hari', 'Rata-rata waktu respon')}</div>
      <div class="mr-stat">${kartu('peringatan', h.menunggu, 'Menunggu keputusan')}${kartu('edit', h.draf, 'Draf')}${kartu('setuju', h.poin, 'Poin bulan ini')}${kartu('target', cap === null ? '—' : cap + '%', tgt ? `Target ${rp(tgt)}` : 'Target belum diatur')}</div>
      ${cap !== null ? `<div class="pf-bartarget"><i style="width:${cap}%"></i></div>` : ''}
      <div class="cu-grid2"><section class="mr-kartu cu-kartu"><h3>Peringkat · ${esc(namaBulan(S.bulan))}</h3>${htmlRanking(S.bulan)}${kelola() ? '' : `<p class="mr-sub qt-ket">Hanya ${ATURAN.topTerlihat} teratas dan posisimu yang tampil.</p>`}</section>
      <section class="mr-kartu cu-kartu"><h3>Tindak lanjut hari ini</h3>${htmlFollowUp(followUp(uid))}</section></div>
      ${htmlAjuan()}
      <div class="cu-grid2">${htmlProfil()}${htmlTargetMaster()}</div>`;
  }

  /* ---------------- ekspor ---------------- */
  function barisEkspor() {
    const uid = kelola() ? S.sales : ISL().uid, a = S.bulan, b = S.bulanAkhir && S.bulanAkhir >= S.bulan ? S.bulanAkhir : S.bulan, dalam = (t) => { const m = String(t || '').slice(0, 7); return !!m && m >= a && m <= b; };
    const qs = (uid ? milik(uid) : semuaQ()).filter((q) => dalam(q.dikirim || q.dibuat) || dalam(q.diputuskan));
    return qs.map((q) => [q.nomor || q.labelDraf || '', q.customerNama || '', q.pemilikNama || '', q.statusRw || q.status, q.dikirim || '', q.diputuskan || '', totalJual(q), q.sumber === 'pdf' ? 'Riwayat PDF' : 'Sistem']);
  }
  const rentang = () => (S.bulanAkhir && S.bulanAkhir > S.bulan ? '_sd_' + S.bulanAkhir : '');
  const KOLOM = ['Nomor', 'Customer', 'Sales', 'Status', 'Dikirim', 'Diputuskan', 'Nilai (Rp)', 'Sumber'];
  function excel() {
    if (!window.XLSX) return toast('Library Excel belum termuat.', 'bahaya');
    const ws = window.XLSX.utils.aoa_to_sheet([KOLOM, ...barisEkspor()]), wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Performa'); window.XLSX.writeFile(wb, `performa-${S.bulan}${rentang()}.xlsx`);
  }
  function pdf() {
    if (!window.jspdf) return toast('Library PDF belum termuat.', 'bahaya');
    const d = new window.jspdf.jsPDF({ orientation: 'landscape' }); d.setFontSize(14); d.text(`Performa Penawaran — ${namaBulan(S.bulan)}${S.bulanAkhir && S.bulanAkhir > S.bulan ? ' s/d ' + namaBulan(S.bulanAkhir) : ''}`, 14, 16);
    d.autoTable({ head: [KOLOM], body: barisEkspor().map((r) => r.map((x, i) => (i === 6 ? rp(x) : x))), startY: 22, styles: { fontSize: 8 } }); d.save(`performa-${S.bulan}${rentang()}.pdf`);
  }

  /* ---------------- aksi ---------------- */
  const angka = (v) => Number(String(v || '').replace(/\D/g, '')) || 0;
  function perkecilGambar(file) {
    return new Promise((ok, gagal) => { const fr = new FileReader(); fr.onerror = gagal; fr.onload = () => { const im = new Image(); im.onerror = gagal; im.onload = () => { const k = Math.min(1, 400 / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/png')); }; im.src = fr.result; }; fr.readAsDataURL(file); });
  }
  async function simpanProfil() {
    try {
      await siapkan(); const { doc, updateDoc } = S.fs, d = { nama: document.getElementById('pf-nama').value.trim(), telepon: document.getElementById('pf-telp').value.trim() };
      const f = document.getElementById('pf-ttd').files[0]; if (f) { d.ttd = window.__islHapusLatar ? await window.__islHapusLatar(f) : await perkecilGambar(f); if (!d.ttd) throw new Error('Latar foto tanda tangan tidak cukup terang. Foto di atas kertas putih.'); }
      await updateDoc(doc(S.db, 'pengguna', ISL().uid), d); Object.assign(window.__ISL, { nama: d.nama, telepon: d.telepon }, d.ttd ? { ttdSales: d.ttd } : {}); toast('Profil tersimpan.'); gambar();
    } catch (e) { toast('Profil gagal disimpan: ' + esc(e.code || e.message), 'bahaya'); }
  }
  // Sales mengajukan hapus untuk quotation yang sudah terbit; master yang menyetujui.
  async function ajukanHapus(q, alasan) {
    await siapkan(); const { doc, setDoc } = S.fs;
    await setDoc(doc(S.db, 'qt_ajuan_hapus', q.id + '_' + Date.now()), { quotationId: q.id, nomor: q.nomor || '', customerNama: q.customerNama || '', alasan: alasan || '', status: 'menunggu', pemilikUid: ISL().uid, pemilikNama: ISL().nama || ISL().email, waktu: new Date().toISOString() });
  }

  async function putuskanAjuan(id, setuju) {
    const a = S.ajuan.find((x) => x.id === id); if (!a) return;
    try {
      const Repo = window.__qt._Repo, q = Repo.baca(a.quotationId); let info = '';
      if (setuju && q) {
        if (['draf', 'ditolak', 'tidak_dipakai'].includes(q.status)) { await Repo.hapusPermanen(q.id); info = 'Quotation dihapus permanen.'; }
        else if (q.status === 'terkirim') { await Repo.tidakDipakai(q.id, 'Diajukan hapus oleh sales: ' + (a.alasan || ''), ISL().hariIni()); info = 'Ditandai Tidak dipakai; terhapus otomatis setelah 30 hari.'; }
        else { toast('Quotation sudah <b>disetujui customer</b> dan rate-nya aktif. Ubah lewat Customer > Rate, lalu tolak pengajuan ini.', 'bahaya'); return; }
      }
      await siapkan(); await S.fs.updateDoc(S.fs.doc(S.db, 'qt_ajuan_hapus', id), { status: setuju ? 'disetujui' : 'ditolak', diputuskan: new Date().toISOString() });
      a.status = setuju ? 'disetujui' : 'ditolak'; toast(setuju ? 'Pengajuan disetujui. ' + info : 'Pengajuan ditolak.'); gambar();
    } catch (e) { toast('Gagal memproses pengajuan: ' + esc(e.message || e.code), 'bahaya'); }
  }
  document.addEventListener('click', (ev) => {
    const e = ev.target.closest('[data-pf]'); if (!e) return; const a = e.dataset.pf;
    if (a === 'buka') { if (window.__islBuka) window.__islBuka({ jenis: e.dataset.jenis || 'quotation', id: e.dataset.id }); }
    else if (a === 'excel') excel(); else if (a === 'pdf') pdf();
    else if (a === 'ajuan-setuju') putuskanAjuan(e.dataset.id, true); else if (a === 'ajuan-tolak') putuskanAjuan(e.dataset.id, false);
    else if (a === 'simpan-profil') simpanProfil();
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'pf-bulan' && t.value) { S.bulan = t.value; gambar(); simpanRingkasan().then(gambar); }
    else if (t.id === 'pf-bulan2') { S.bulanAkhir = t.value; gambar(); }
    else if (t.id === 'pf-sales') { S.sales = t.value; gambar(); }
  });

  window.ISLSales = {
    ATURAN, hitung, ajukanHapus,
    async tampil() { if (!S.bulan) S.bulan = bulanIni(); gambar(); if (!S.siap && !S.muat) { await muatData(); } await simpanRingkasan(); gambar(); },
    gambar,
  };
})();
