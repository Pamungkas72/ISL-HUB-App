/* ==========================================================================
   FORMULIR PENAWARAN PER LINI (format yang disepakati Ega, 19–20 Oktober 2026)
   Dipakai di editor quotation (app-core.js) sebagai pengganti tabel "Layanan dan harga"
   untuk quotation yang dibuat dari format lini.

   Tiga lapis, supaya aturan bisa diubah tanpa merombak tampilan:
   1. KONFIGURASI   : daftar lini, kolom, blok, layanan bawaan, S&K bawaan (data murni).
   2. MESIN         : satu mesin per bentuk formulir (tabel, pilih layanan, sewa container,
                      trucking, gudang, open yard, freight forwarding). Tiap mesin mengubah
                      isian menjadi: tampilan input, baris quotation (untuk margin, rate
                      disetujui, laporan), dan blok dokumen PDF.
   3. JEMBATAN      : fungsi yang dipanggil app-core.js (render, sinkron, blok dokumen,
                      syarat, validasi) dan penyimpanan katalog layanan (Firestore).
   ========================================================================== */
(() => {
'use strict';
const FL = window.ISLFL = { versi: 1, katalog: [] };
const UI = { tambah: null, addTipe: false, langkah: 1, ccTambah: null, buka: new Set([0]), ket: new Set(), minBuka: null, kelasAktif: null, bodyAktif: null, dsbPanel: null, barisAktif: null };  /* keadaan tampilan sementara (tidak disimpan) */

/* ============================ UTIL ============================ */
const C = () => window.__islCU || {};
const QT = () => window.__qt || {};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ada = v => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v));
const fmt = (n, d = 2) => ada(n) ? Number(n).toLocaleString('id-ID', { maximumFractionDigits: d }) : '';
const fmtRp = n => ada(n) ? 'Rp' + Math.round(n).toLocaleString('id-ID') : '—';
const angkaDok = n => Math.round(Number(n) || 0).toLocaleString('id-ID');
/* angka dari teks: menerima 1.250.000 / 1250000 / 4,5 / 4.5 / Rp 1.000 */
function num(v) {
  if (v === null || v === undefined) return null; if (typeof v === 'number') return isNaN(v) ? null : v;
  let s = String(v).trim().replace(/^(rp\.?|idr)\s*/i, '').replace(/\s+/g, ''); if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  const n = Number(s.replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n;
}
const bulat1000 = n => Math.ceil(Math.round(n * 100) / 100 / 1000) * 1000;
const normT = s => String(s || '').toLowerCase().replace(/²/g, '2').replace(/[^a-z0-9]+/g, ' ').trim();
const uidF = p => (p || 'f') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const huruf = i => String.fromCharCode(65 + i);
const tanpaHuruf = s => String(s || '').replace(/^[A-Z]\.\s*/, '');
/* modal dan margin hanya untuk akun master. Form lain hanya melihat rekomendasi harga jual. */
const lihatInt = () => { if (!(window.__ISL && window.__ISL.master)) return false; const Q = QT()._Q; return !Q || Q.lihatInt !== false; };
/* rekomendasi harga jual = modal + target persentase lini bisnis */
/* rekomendasi harga jual = modal + target lini, atau saran MR bila ada. Bila ada quotation disetujui customer dengan harga lebih tinggi untuk layanan yang sama, harga itu yang dipakai. */
const rekomendasiJual = (modal, liniKey, nama = null, saran = null) => { const dasar = ada(saran) ? Number(saran) : (ada(modal) ? bulat1000(modal * (1 + targetLini(liniKey) / 100)) : null); const t = nama && QT()._jualSetujui ? QT()._jualSetujui(liniKey, nama) : null; if (!ada(t)) return dasar; return ada(dasar) ? Math.max(dasar, t) : t; };
const rekomendasiHtml = (modal, liniKey, nama = null) => { const v = rekomendasiJual(modal, liniKey, nama); if (!ada(v)) return `<div class="fl-int" data-flo hidden></div>`; const t = nama && QT()._jualSetujui ? QT()._jualSetujui(liniKey, nama) : null; return `<div class="fl-int" data-flo>Rekomendasi harga jual ${fmtRp(v)}${ada(t) && t >= v ? ' · tarif quotation disetujui customer' : ''}</div>`; };
const bisaEdit = () => (C().bisaEdit ? C().bisaEdit() : true);
/* Katalog layanan (layanan_tambahan) dan tipe body hanya bisa disimpan pemilik dan admin (aturan Firestore). Sales tetap mengisi baris penawaran. */
const bisaKatalog = () => !!(window.__ISL && (window.__ISL.master || window.__ISL.admin));
const toast = (m, j) => C().toast ? C().toast(m, j) : console.log(m);
const hariIni = () => (window.__ISL && window.__ISL.hariIni ? window.__ISL.hariIni() : new Date().toISOString().slice(0, 10));
const tambahHari = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const margin = (jual, modal) => (ada(jual) && ada(modal) && modal > 0) ? (jual - modal) / modal * 100 : null;
const fmtPct = p => p === null ? '—' : (Math.round(p * 10) / 10).toLocaleString('id-ID') + '%';
const targetLini = k => { try { const t = C().targetLini ? C().targetLini(k) : null; return ada(t) ? Number(t) : 15; } catch (e) { return 15; } };

/* modal referensi dari Master Rate: yang tertinggi di antara tarif aktif yang cocok (nama layanan, ukuran) */
/* nama layanan cocok bila sama, saling diawali, atau semua kata penting salah satunya ada di yang lain ("Storage Container Dry" ~ "Storage Dry 20ft") */
const kataNama = s => normT(s).split(' ').filter(w => w && !['container', 'kontainer', 'cont', 'ft', 'feet', '20', '40', '20ft', '40ft'].includes(w));
const namaCocok = (a, b) => {
  const x = normT(a), y = normT(b); if (!x || !y) return false;
  if (x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ')) return true;
  const kx = kataNama(a), ky = kataNama(b); if (!kx.length || !ky.length) return false;
  return kx.every(w => ky.includes(w)) || ky.every(w => kx.includes(w));
};
/* ukuran dibandingkan lewat angkanya ("20ft", "20 ft", "20'" sama); bila tarif tidak punya dimensi ukuran, dibaca dari namanya */
const angkaUkuran = s => { const m = String(s || '').match(/\b(20|40|45)\b/) || String(s || '').match(/(20|40|45)/); return m ? m[1] : ''; };
/* label pencocokan tarif: nama layanan + nama zona/lokasi dari dimensi (Trailer menyimpan tujuan sebagai id zona) */
function labelTarif(t, mr) {
  const ref = (mr && mr.ref) || {}, daftar = [...(ref.zona || []), ...(ref.lokasiDistribusi || []), ...(ref.depo || []), ...(ref.warehouse || []), ...(ref.openYard || [])], d = t.dimensi || {};
  const nm = id => { const z = id && daftar.find(x => x.id === id); return z ? (z.nama || '') : ''; };
  return [t.layananNama || t.layanan, nm(d.tujuan), nm(d.asal), nm(d.lokasi)].filter(Boolean).join(' ');
}
function tarifCocokMR(liniKey, nama, dim = {}) {
  const mr = C().MR ? C().MR() : null; if (!mr || !mr.tarif) return [];
  if (!normT(nama)) return [];
  const vNon = new Set((mr.vendor || []).filter(v => v.aktif === false || v.mitra).map(v => v.id));
  return mr.tarif.filter(t => t.liniBisnisId === liniKey && t.aktif !== false && !vNon.has(t.vendorId) && (t.mataUang || 'IDR') === 'IDR').filter(t => {
    if (!namaCocok(labelTarif(t, mr), nama)) return false;
    return Object.entries(dim).every(([k, v]) => {
      if (!ada(v)) return true;
      if (k === 'ukuran') { const u = angkaUkuran(v), tu = t.dimensi && t.dimensi.ukuran !== undefined ? angkaUkuran(t.dimensi.ukuran) : angkaUkuran(t.layananNama || t.layanan); return !u || !tu || u === tu; }
      return !t.dimensi || t.dimensi[k] === undefined || normT(t.dimensi[k]) === normT(v);
    });
  });
}
function modalMR(liniKey, nama, dim = {}) {
  const cocok = tarifCocokMR(liniKey, nama, dim).filter(t => ada(t.modal));
  if (!cocok.length) return null; return Math.max(...cocok.map(t => Number(t.modal)));
}
/* saran harga jual dari Master Rate (kolom "Harga jual rekomendasi"); null bila belum diisi */
function saranMR(liniKey, nama, dim = {}) {
  const cocok = tarifCocokMR(liniKey, nama, dim).filter(t => ada(t.hargaJualSaran));
  if (!cocok.length) return null; return Math.max(...cocok.map(t => Number(t.hargaJualSaran)));
}
/* Tarif minimum (lini yang cfg.tarifMinimum, mis. Depo) = modal tertinggi di Master Rate + markup lini, dibulatkan ke atas Rp1.000.
   Akun sales tidak menerima modal; untuk mereka dipakai batas harga aman (hargaMin) yang dihitung dari modal dan markup yang sama. Hanya penanda, tidak pernah memblokir. */
const masterAkun = () => !!(window.__ISL && window.__ISL.master);
/* kunci pengaturan tarif minimum: nama layanan + ukuran, tanpa titik supaya aman sebagai nama field Firestore */
const kunciMin = (nama, dim) => normT(nama).replace(/ /g, '_') + '_' + angkaUkuran(dim && dim.ukuran) + (dim && dim.kunci ? '_' + dim.kunci.replace(/ /g, '_') : '');
const nilaiMin = t => ada(t.modal) ? bulat1000(Number(t.modal) * (1 + targetLini(t.liniBisnisId) / 100)) : (ada(t.hargaMin) && Number(t.hargaMin) > 0 ? Number(t.hargaMin) : null);
/* nilai minimum tiap vendor di Master Rate untuk layanan dan ukuran ini, tertinggi di atas (satu baris per vendor) */
function minKandidat(liniKey, nama, dim = {}) {
  const mr = C().MR ? C().MR() : null, per = new Map();
  tarifCocokMR(liniKey, nama, dim).forEach(t => { const n = nilaiMin(t); if (!ada(n)) return; const v = mr && (mr.vendor || []).find(x => x.id === t.vendorId), nm = v ? (v.nama || v.namaLengkap || '') : ''; if (!per.has(t.vendorId) || per.get(t.vendorId).min < n) per.set(t.vendorId, { min: n, vendor: nm }); });
  return [...per.values()].sort((x, y) => y.min - x.min);
}
/* nilai yang diatur master (berlaku untuk semua akun); null bila belum diatur */
const minAtur = (liniKey, nama, dim) => { const f = C().tarifMinAtur, v = f ? f(liniKey, kunciMin(nama, dim)) : null; return ada(v) && Number(v) > 0 ? Number(v) : null; };
function tarifMinimumInfo(liniKey, nama, dim = {}) {
  const ov = minAtur(liniKey, nama, dim); if (ov) return { min: ov, vendor: '', atur: true };
  const k = minKandidat(liniKey, nama, dim); return k.length ? { min: k[0].min, vendor: k[0].vendor } : null;
}
function tarifMinimum(liniKey, nama, dim = {}) { const i = tarifMinimumInfo(liniKey, nama, dim); return i ? i.min : null; }
/* harga jual rekomendasi template lini (cfg.rekAwal, dari tim) dan perubahan master (PENG.rekJual): kunci sama dengan tarif minimum (nama layanan + ukuran) */
const rekAtur = (liniKey, nama, dim) => { const f = C().rekJualAtur, v = f ? f(liniKey, kunciMin(nama, dim)) : null; return ada(v) && Number(v) > 0 ? Number(v) : null; };
const rekTemplate = (cfg, sp) => { const o = rekAtur(cfg.liniKey, sp.nama, sp.dim); if (o) return o; const d = (cfg.rekAwal || {})[kunciMin(sp.nama, sp.dim)]; return ada(d) && Number(d) > 0 ? Number(d) : null; };
/* rekomendasi harga jual sel tabel (lini yang punya cfg.rekAwal): angka template (atau ubahan master) mengalahkan harga referensi Master Rate dan modal + markup; bila ada harga yang pernah disetujui customer, yang lebih tinggi dipakai */
function rekSel(cfg, sp) {
  if (!cfg.rekAwal) return null;
  const t = rekTemplate(cfg, sp), v = rekomendasiJual(t === null ? modalMR(cfg.liniKey, sp.nama, sp.dim) : null, cfg.liniKey, sp.nama, t !== null ? t : saranMR(cfg.liniKey, sp.nama, sp.dim));
  return ada(v) && Number(v) > 0 ? bulat1000(Number(v)) : null;
}
/* harga otomatis (lini dengan rekomendasi bawaan, kini Depo): sel harga yang tidak pernah diisi memakai rekomendasi; angka 0 yang diketik berarti tidak ditawarkan */
/* kolom harga kosong menampilkan rekomendasi sebagai bayangan abu-abu (placeholder) dan memakainya otomatis */
const ghostRek = (cfg, b, r, k) => { const rk = rekOtomatis(cfg, b, r, k); return { ph: rk ? fmt(rk) : '0', at: [attrRendah(cfg, b, r, k), rk ? 'data-ghost="1"' : ''].filter(Boolean).join(' ') }; };
const tanpaIsi = v => v === '' || v === undefined || v === null;
const rekOtomatis = (cfg, b, r, k) => { if (!cfg.rekAwal || !tanpaIsi(r[k.k])) return null; const sp = minSpek(cfg, b, r, k); return sp ? rekSel(cfg, sp) : null; };
const barisEf = (cfg, b, r) => cfg.rekAwal ? { ...r, ...Object.fromEntries(b.kolom.filter(k => k.num).map(k => [k.k, rekOtomatis(cfg, b, r, k) ?? r[k.k]])) } : r;
/* apa yang dicocokkan ke Master Rate untuk satu sel harga: bawaan nama layanan (uraian) + ukuran; lini lain memberi cfg.minSpek (null = sel ini tanpa tarif minimum) */
const minSpek = (cfg, b, r, k) => cfg.minSpek ? cfg.minSpek(b, r, k) : { nama: r.uraian, dim: dimUkuran(b, k) };
/* tarif minimum aktif untuk lini ini: dukungan formulirnya (cfg.tarifMinimum) dan saklar di Pengaturan lini */
const minAktifCfg = cfg => !!cfg.tarifMinimum && (C().tarifMinAktif ? C().tarifMinAktif(cfg.liniKey) : true);
const dimUkuran = (b, k) => b.kolom.some(z => z.k === 'h40') ? { ukuran: k.k === 'h40' ? '40ft' : '20ft' } : {};
/* harga yang diketik di bawah tarif minimum: nominal dan kotaknya diberi warna merah (atribut data-rendah) */
const dibawahMin = (cfg, b, r, k) => { if (!minAktifCfg(cfg)) return false; const sp = minSpek(cfg, b, r, k); if (!sp) return false; const mn = tarifMinimum(cfg.liniKey, sp.nama, sp.dim), v = num(barisEf(cfg, b, r)[k.k]); return ada(mn) && ada(v) && v > 0 && v < mn; };
const attrRendah = (cfg, b, r, k) => dibawahMin(cfg, b, r, k) ? 'data-rendah="1"' : '';
/* kotak internal di bawah harga: modal referensi + margin (tidak pernah masuk PDF) */
function htmlInt(jual, modal, liniKey, label = 'Modal', nama = null) {
  if (!lihatInt()) return rekomendasiHtml(modal, liniKey, nama);
  if (!ada(modal)) return `<div class="fl-int" data-flo hidden></div>`;
  const m = margin(jual, modal), rendah = m !== null && m < targetLini(liniKey);
  return `<div class="fl-int ${rendah ? 'is-rendah' : ''}" data-flo>${label} ${fmtRp(modal)}${m !== null ? ` · margin ${fmtPct(m)}${rendah ? ' (di bawah target)' : ''}` : ''}</div>`;
}
/* kolom angka: teks bebas, ditampilkan bertitik ribuan */
const inpAngka = (path, v, ph = '0', extra = '') => `<input class="fl-n" data-fl="${esc(path)}" data-fn="1" inputmode="decimal" value="${esc(fmt(v))}" placeholder="${esc(ph)}" autocomplete="off" ${extra}>`;
const inpTeks = (path, v, ph = '', extra = '') => `<input data-fl="${esc(path)}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" autocomplete="off" ${extra}>`;
const pilihan = (path, opsi, v) => `<select data-fl="${esc(path)}">${opsi.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
const datalist = (id, opsi) => `<datalist id="${esc(id)}">${opsi.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
function getPath(o, p) { return String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
function setPath(o, p, v) { const ks = String(p).split('.'); let t = o; ks.slice(0, -1).forEach((k, i) => { if (t[k] == null || typeof t[k] !== 'object') t[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; t = t[k]; }); t[ks[ks.length - 1]] = v; }
const satuDua = s => String(s || '').split(/\r?\n/).map(x => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean);

/* ============================ KATALOG LAYANAN TAMBAHAN (Firestore: layanan_tambahan) ============================ */
/* dokumen: { id, lini, grup, ...isi, dibuat, oleh }. Disimpan lewat lapisan penyimpanan yang sama (tulis -> baca ulang -> cocokkan). */
FL.muatKatalog = arr => { FL.katalog = Array.isArray(arr) ? arr.map(x => ({ ...x })) : []; };
const katalogHapusBoleh = () => !!(window.__ISL && window.__ISL.master); // hapus katalog hanya master (aturan Firestore)
const katalogLini = (lini, grup) => FL.katalog.filter(k => k.lini === lini && (grup === undefined || k.grup === grup)).sort((a, b) => (a.dibuat || 0) - (b.dibuat || 0));
async function simpanKatalog(item) {
  const c = C(); if (!c.tulisDB) throw new Error('Penyimpanan belum siap.');
  if (!(window.__ISL && (window.__ISL.master || window.__ISL.admin))) throw new Error('Katalog hanya bisa diubah akun master atau admin. Barisnya tetap tersimpan di quotation ini.');
  const doc = { id: uidF('lt'), ...item, dibuat: Date.now(), oleh: (window.__ISL && window.__ISL.email) || '' };
  await c.tulisDB(() => { FL.katalog.push(doc); }, () => FL.katalog.some(x => x.id === doc.id));
  return doc;
}
async function hapusKatalog(id) {
  const c = C(); if (!c.tulisDB) throw new Error('Penyimpanan belum siap.');
  if (!(window.__ISL && window.__ISL.master)) throw new Error('Katalog hanya bisa diubah akun master.');
  await c.tulisDB(() => { FL.katalog = FL.katalog.filter(x => x.id !== id); }, () => !FL.katalog.some(x => x.id === id));
}

/* Terjemahan English butir bawaan di atas (urutan sama). Dipakai saat dokumen berbahasa Inggris; butir yang teksnya diubah user tanpa isian English diterjemahkan otomatis. */
FL.TNC_LINI_EN = {
  depo: ['The depot operates 24 hours.', 'Storage is charged per day from the date the container enters the depot, after the free time expires.', 'Overtime outside working hours is charged per shift at the applicable rate.', 'Labor hours for stripping and stuffing: Monday to Friday 08:00 to 17:00 (one shift), Saturday 08:00 to 12:00.', 'Any damage or loss of containers during the storage period at the depot is the full responsibility of PT Indo Sukses Logistik.'],
  trucking_trailer: [],   /* S&K Trailer: SYARAT_TRAILER_EN di app-core */
  distribusi_kecil: ['Rates are per trip.', 'Express service includes toll fees. Regular service excludes toll fees.', 'Estimated Regular delivery is 1 to 3 days, depending on distance.', 'Long variants (CDE long and CDD long) are IDR 300,000 to IDR 500,000 higher than the standard rate and are billed upon the customer’s request.', 'Delivery documents (DO, POD) are provided by PT Indo Sukses Logistik.', 'Waiting time exceeding 4 hours will be subject to additional charges.'],
  sewa_unit: ['Rental period according to the customer’s choice (monthly, 3, 6, or 12 months).', 'Driver as an add-on is charged per person per month, separately from the unit rental rate.', 'The unit is handed over ready for use. Bare rental (without driver) excludes the driver terms.'],
  customs_clearance: ['Price excludes trucking costs.', 'Charges from relevant authorities (liner charges, packing, demurrage, detention, cleaning, LOLO, mechanic, storage, CFS, DOC, overtime, and the like) are billed cost-to-cost according to official receipts.', 'Additional charges will be confirmed in advance.', 'Marine insurance premium is billed according to the invoice value if required.'],
  gudang_plb: ['The revenue ton basis is the greater of weight (tons) and volume (m3).', 'Monthly storage is charged per multiple of 30 days.', 'Services follow the regulations of the Bonded Logistics Center.'],
  sewa_container_empty: ['The daily rate is calculated from the time the container leaves the depot and applies for the next 24 hours.', 'Return delay tolerance is 2 hours.', 'The container is handed over in clean condition at the start of the rental.', 'Daily and weekly rentals exclude LOLO. Monthly rentals include LOLO.'],
  warehouse_dry: ['Storage rates are calculated based on the number of pallets, tons, revenue tons, or CBM recorded when the goods enter the warehouse.', 'Handling in and handling out are charged per revenue ton or per CBM according to the actual goods.', 'The container stripping rate applies specifically to this warehouse and is separate from depot rates.', 'Additional services (e.g., repacking) are charged as agreed and billed separately.'],
  warehouse_frozen: ['Storage rates are calculated based on the number of pallets, tons, revenue tons, or CBM recorded when the goods enter the warehouse.', 'Handling in and handling out are charged per revenue ton or per CBM according to the actual goods.', 'The container stripping rate applies specifically to this warehouse and is separate from depot rates.', 'Cold storage is rented per chamber, per pallet, or per m² as agreed. The temperature is maintained according to the warehouse classification.', 'Additional services (e.g., repacking) are charged as agreed and billed separately.'],
  open_yard: ['A security deposit must be paid before the yard is handed over.', 'The deposit is refunded after the rental period ends, less any damage to the yard or outstanding amounts.', 'Electricity, water, and other service charges are billed according to usage or actual cost.', 'The yard is handed over in the condition recorded in the handover report.']
};
/* ============================ S&K BAWAAN PER LINI (data awal, dimuat sekali ke Pengaturan dokumen) ============================ */
FL.TNC_LINI = {
  depo: ['Depo beroperasi 24 jam.', 'Storage dihitung per hari sejak kontainer masuk depo, setelah free time berakhir.', 'Overtime di luar jam kerja ditagihkan per shift sesuai tarif.', 'Jam kerja buruh stripping dan stuffing: Senin sampai Jumat pukul 08.00 sampai 17.00 (satu shift), Sabtu pukul 08.00 sampai 12.00.', 'Kerusakan atau kehilangan kontainer selama masa penumpukan di depo menjadi tanggung jawab PT Indo Sukses Logistik.'],
  trucking_trailer: [],   /* S&K Trailer dari SYARAT_TRAILER_BAWAAN di app-core (surat penawaran customer + TOP/reimbursement) */
  distribusi_kecil: ['Tarif per ritase.', 'Service Express sudah termasuk biaya tol. Service Reguler belum termasuk biaya tol.', 'Estimasi pengiriman Reguler 1 sampai 3 hari, tergantung jarak.', 'Varian long (CDE long dan CDD long) lebih tinggi Rp300.000 sampai Rp500.000 dari tarif standar, dan ditagihkan sesuai permintaan customer.', 'Surat jalan (DO, POD) disediakan oleh PT Indo Sukses Logistik.', 'Waktu tunggu lebih dari 4 jam dikenakan biaya tambahan.'],
  sewa_unit: ['Masa sewa sesuai pilihan customer (bulanan, 3, 6, atau 12 bulan).', 'Driver sebagai add-on dihitung per orang per bulan, terpisah dari tarif sewa unit.', 'Unit diserahkan dalam kondisi siap pakai. Sewa lepas kunci tidak termasuk ketentuan driver.'],
  customs_clearance: ['Harga belum termasuk biaya trucking.', 'Biaya dari instansi terkait (liner charges, packing, demurrage, detention, cleaning, LOLO, mechanic, storage, CFS, DOC, overtime, dan sejenisnya) ditagihkan cost to cost sesuai kwitansi resmi.', 'Biaya tambahan akan dikonfirmasi terlebih dahulu.', 'Marine insurance premium ditagihkan sesuai invoice value jika diperlukan.'],
  gudang_plb: ['Basis revenue ton adalah yang lebih besar antara berat (ton) dan volume (m3).', 'Storage bulanan dihitung per kelipatan 30 hari.', 'Layanan mengikuti ketentuan Pusat Logistik Berikat.'],
  sewa_container_empty: ['Argo harian dihitung sejak container keluar dari depo, berlaku 24 jam ke depan.', 'Toleransi keterlambatan pengembalian 2 jam.', 'Container diserahkan dalam kondisi bersih saat pertama disewa.', 'Harian dan mingguan belum termasuk LOLO. Bulanan sudah termasuk LOLO.'],
  warehouse_dry: ['Tarif storage dihitung sesuai jumlah pallet, ton, revenue ton, atau CBM yang tercatat saat barang masuk gudang.', 'Handling in dan handling out dihitung per revenue ton atau per CBM sesuai realisasi barang.', 'Tarif stripping dari kontainer berlaku khusus untuk gudang ini dan terpisah dari tarif depo.', 'Layanan tambahan (mis. repacking) dihitung sesuai kesepakatan dan ditagihkan terpisah.'],
  warehouse_frozen: ['Tarif storage dihitung sesuai jumlah pallet, ton, revenue ton, atau CBM yang tercatat saat barang masuk gudang.', 'Handling in dan handling out dihitung per revenue ton atau per CBM sesuai realisasi barang.', 'Tarif stripping dari kontainer berlaku khusus untuk gudang ini dan terpisah dari tarif depo.', 'Gudang pendingin disewa per chamber, per pallet, atau per m² sesuai perjanjian. Suhu dijaga sesuai klasifikasi gudang.', 'Layanan tambahan (mis. repacking) dihitung sesuai kesepakatan dan ditagihkan terpisah.'],
  open_yard: ['Deposit jaminan wajib dibayar sebelum lahan diserahterimakan.', 'Deposit dikembalikan setelah masa sewa berakhir, dikurangi kerusakan lahan atau tunggakan.', 'Biaya listrik, air, dan layanan lain ditagihkan sesuai pemakaian atau realisasi.', 'Lahan diserahterimakan dalam kondisi yang dicatat di berita acara serah terima.']
};
/* S&K Freight Forwarding (dari ff-master-data.json, disepakati 19 Okt 2026). Bisa diubah di formulir FF, tersimpan di Pengaturan dokumen. */
FL.FF_AWAL = {
  masaBerlakuHari: 5, topHari: 30,
  impor: ['Tarif belum termasuk PPN 11% sesuai peraturan yang berlaku.', 'Bea masuk, PDRI, dan pajak impor tidak termasuk, kecuali term DDP.', 'Tarif berlaku untuk General Cargo ukuran normal. Tidak berlaku untuk barang DG, mudah rusak, atau hewan hidup.', 'Tarif berdasarkan kondisi ROE dan pasar saat penawaran. Dapat berubah dengan atau tanpa pemberitahuan.', 'Tidak termasuk asuransi kargo, inspeksi, detention, demurrage, penyimpanan gudang, dan biaya tunggu, kecuali disebut di tabel.', 'Biaya di luar tabel ditagihkan sesuai realisasi.', 'Kemasan kayu atau palet yang masuk Indonesia wajib disertai sertifikat fumigasi ASLI ISPM 15.', 'Importir atau consignee bertanggung jawab menyediakan dokumen, lisensi, dan perizinan. Komoditas tertentu dapat memerlukan izin tambahan.'],
  ekspor: ['Tarif belum termasuk PPN 11% sesuai peraturan yang berlaku.', 'Bea masuk dan pajak di negara tujuan tidak termasuk, kecuali term DDP.', 'Tarif berlaku untuk General Cargo ukuran normal. Tidak berlaku untuk barang DG, mudah rusak, atau hewan hidup.', 'Tarif berdasarkan kondisi ROE dan pasar saat penawaran. Dapat berubah dengan atau tanpa pemberitahuan.', 'Tidak termasuk inspeksi, penyimpanan gudang, dan biaya tunggu, kecuali disebut di tabel.', 'Biaya di luar tabel ditagihkan sesuai realisasi.', 'Kemasan kayu atau palet wajib memenuhi standar ISPM 15 sesuai ketentuan negara tujuan.', 'Shipper bertanggung jawab menyediakan dokumen ekspor, lisensi, dan perizinan. Komoditas tertentu dapat memerlukan izin tambahan.'],
  klausulModa: { Udara: 'Handling udara di atas batas berat dihitung tambahan per KG sesuai kesepakatan.', Laut: 'Handling kontainer kedua dan seterusnya dalam satu BL dihitung tambahan per kontainer.' },
  klausulTerm: { CIF: 'Term CIF: asuransi kargo sampai tujuan, premi dihitung dari nilai barang dan ditagihkan sesuai polis.' },
  penutup: ['Berat dan volume dasar penghitungan sesuai tabel. Jika realisasi berbeda, tarif menyesuaikan.', 'Masa berlaku penawaran {masaBerlakuHari} hari sejak tanggal terbit.', 'Term pembayaran TOP {topHari} hari sejak invoice diterbitkan.', 'Dengan menyetujui penawaran ini, customer dianggap menyetujui syarat dan ketentuan di atas.']
};
const PENG = () => { const p = QT()._PENG; return typeof p === 'function' ? p() : (p || null); };
FL.ffMaster = () => { const p = PENG(); return (p && p.ffMaster && p.ffMaster.impor) ? p.ffMaster : FL.FF_AWAL; };

/* S&K tipe body (Trucking Distribusi) dan tipe buntut (Trailer): dikelola di Master Rate > Lini Bisnis. Di penawaran hanya dibaca. */
function skTipeMaster(liniKey) {
  const mr = C().MR ? C().MR() : null; const l = mr && (mr.lini || []).find(x => x.id === liniKey);
  return (l && l.skTipe && typeof l.skTipe === 'object') ? l.skTipe : {};
}
FL.skTipeMaster = skTipeMaster;
const BUNTUT = { rangka: 'Rangka', flatbed: 'Flatbed', lowbed: 'Lowbed', dolly: 'Dolly' };
const BODY = {
  boxdry: { nama: 'Box Dry', kelas: ['Blind Van', 'CDE', 'CDD', 'FUSO', 'Tronton'] },
  reefer: { nama: 'Box Reefer', kelas: ['CDE', 'CDD', 'FUSO', 'Tronton'] },
  bak: { nama: 'Bak', kelas: ['CDE', 'CDD', 'FUSO', 'Tronton'] },
  lostbak: { nama: 'Lost bak', kelas: ['CDD', 'FUSO', 'Tronton'] },
  wingbox: { nama: 'Wing Box', kelas: ['Blind Van', 'CDE', 'CDD', 'FUSO', 'Tronton'] },
  threeway: { nama: 'Three way', kelas: ['FUSO', 'Tronton'] },
  towing: { nama: 'Towing', kelas: ['FUSO', 'Tronton'] }
};
FL.BUNTUT = BUNTUT; FL.BODY = BODY;
/* daftar tipe body (bawaan + tambahan dari katalog lini distribusi_kecil, grup "tipe") */
function daftarBody() {
  const o = Object.entries(BODY).map(([k, v]) => ({ key: k, ...v, kelas: v.kelas.flatMap(c => c === 'CDE' || c === 'CDD' ? [c, c + ' Long'] : [c]) }));
  katalogLini('distribusi_kecil', 'tipe').forEach(k => o.push({ key: k.id, nama: k.nama, kelas: k.kelas || [], custom: true, kid: k.id }));
  return o;
}
FL.daftarBody = daftarBody;
/* Blok Distribusi (5 Nov 2026): blok pertama bertipe tertentu memakai kunci tipenya (boxdry); blok tambahan bertipe sama memakai "tipe@n".
   Urutan dan huruf (A, B, ...) mengikuti field urut (waktu dibuat); blok lama tanpa urut mengikuti urutan katalog. */
const tipeBlok = k => String(k).split('@')[0];
function daftarBlok(st) {
  const o = [], b = (st && st.bodies) || {};
  daftarBody().forEach((t, i) => { o.push({ ...t, _u: i - 1000 }); Object.keys(b).filter(k => k.startsWith(t.key + '@')).forEach(k => o.push({ ...t, key: k, tipe: t.key, salinan: true, _u: i - 1000 })); });
  o.forEach(x => { if (b[x.key] && b[x.key].urut) x._u = b[x.key].urut; });
  return o.sort((p, q) => p._u - q._u);
}
const judulBlok = (st, b) => { const j = String(((st.bodies || {})[b.key] || {}).judul || '').trim(); return j || (b.salinan ? `${b.nama} (${b.key.split('@')[1]})` : b.nama); };
const isiBaris = r => !!(String(r.tujuan || '').trim() || String(r.ket || '').trim() || Object.values(r.h || {}).some(v => num(v) > 0));

/* ============================ KALKULATOR BIAYA RUTE (internal, tidak pernah masuk PDF) ============================ */
/* jarak pulang-pergi / konsumsi BBM x harga solar + tol + biaya lain = estimasi biaya per trip. Dasar menimbang uang jalan atau tarif rute. */
/* K-01: kalkulator ada di laci samping, dibuka dari tombol kecil. Isiannya tidak ikut tersimpan ke penawaran. */
const KALK = { rute: '', jarak: '', kmPerLiter: '', solar: '', tol: '', lain: '' };
function htmlKalkulator() {
  if (!lihatInt()) return '';
  return `<div class="fl-baris-tombol" style="margin-top:10px"><button type="button" class="fl-chipbtn" data-fla="kalk-buka">Kalkulator biaya rute (internal)</button><span class="fl-mut">Alat bantu menimbang harga jual. Tidak masuk PDF. Slip uang jalan driver: menu <a href="app.html#uang-jalan">Uang Jalan</a>.</span></div>`;
}
function hasilKalk() { const jarak = num(KALK.jarak) || 0, km = num(KALK.kmPerLiter) || 0, solar = num(KALK.solar) || 0, tol = num(KALK.tol) || 0, lain = num(KALK.lain) || 0, bbm = km > 0 ? jarak / km * solar : 0; return { bbm, tol, lain, total: bbm + tol + lain }; }
function bukaKalkulator() {
  const c = C(); if (!c.bukaPanel) return;
  const f = (k, label, ph, angka = true) => `<label class="fl-f"><span>${label}</span><input data-kk="${k}" ${angka ? 'inputmode="decimal"' : ''} value="${esc(KALK[k] === '' ? '' : (angka ? fmt(KALK[k]) : KALK[k]))}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
  const p = c.bukaPanel(`<header class="mr-panel__kepala"><div><h2>Kalkulator biaya rute</h2><p class="mr-sub">Internal, tidak masuk penawaran</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">×</button></header>
    <div class="mr-panel__isi">${f('rute', 'Rute', 'Patimban – Subang', false)}${f('jarak', 'Jarak pulang-pergi (km)', '0')}${f('kmPerLiter', 'Konsumsi (km per liter)', '4')}${f('solar', 'Harga solar (Rp/liter)', '6.800')}${f('tol', 'Tol (Rp)', '0')}${f('lain', 'Biaya lain (Rp)', 'Parkir, retribusi, makan')}
    <div class="fl-ringkas" id="kk-hasil"></div><div class="fl-mut">Hasil tidak tersimpan. Salin angkanya sendiri ke harga jual bila perlu.</div></div>`, 'sempit');
  const hitung = () => { const h = hasilKalk(), el = p.querySelector('#kk-hasil'); if (el) el.innerHTML = `<div><small>BBM</small><b>${fmtRp(h.bbm)}</b></div><div><small>Tol + lain</small><b>${fmtRp(h.tol + h.lain)}</b></div><div><small>Estimasi biaya per trip</small><b>${fmtRp(h.total)}</b></div>`; };
  p.querySelectorAll('[data-kk]').forEach(i => i.addEventListener('input', () => { KALK[i.dataset.kk] = i.dataset.kk === 'rute' ? i.value : (num(i.value) ?? ''); hitung(); }));
  hitung();
}

/* ============================ KOMPONEN TAMPILAN BERSAMA ============================ */
/* kotak katalog layanan tersimpan (per blok). fields: [{k, nama, ph, num, opsi}] */
function htmlKatalog(st, lini, grup, fields, judulTambah, terpilih) {
  /* KI-01: tombol "tambah item katalog" dan "sekali pakai" dihapus. Item masuk katalog lewat ikon simpan di ujung baris item tambahan. */
  const items = katalogLini(lini, grup);
  if (!items.length) return '';
  const daftar = items.map(c => `<div class="fl-kat__i"><label><input type="checkbox" data-fla="kat-pilih" data-flx="${esc(c.id)}" data-flg="${esc(grup)}" ${terpilih(c.id) ? 'checked' : ''}> <span>${esc(c.label || c.n || c.nama || c.uraian || c.tipe || c.rute || 'Layanan')}</span></label>${bisaEdit() ? `<button type="button" class="fl-x" data-fla="kat-hapus" data-flx="${esc(c.id)}" aria-label="Hapus dari katalog" title="Hapus dari katalog">×</button>` : ''}</div>`).join('');
  return `<div class="fl-kat"><div class="fl-mut">Layanan tersimpan di katalog. Centang untuk masuk ke tabel dan PDF.</div>${daftar}</div>`;
}
const ambilFormKatalog = (root, grup) => { const box = root.querySelector(`[data-flkat="${CSS.escape(grup)}"]`); const o = {}; if (box) box.querySelectorAll('[data-kf]').forEach(x => { o[x.dataset.kf] = x.value.trim(); }); return o; };

/* ============================ MESIN 1: TABEL (Depo, Trailer, Sewa Unit) ============================ */
const MESIN = {};
/* saran jual Master Rate di bawah sel harga (dipakai lini yang kolom pengisiannya hanya harga jual) */
const htmlSaranSel = (cfg, b, r, k, id) => {
  const dim = dimUkuran(b, k);
  if (cfg.tarifMinimum) {
    if (!minAktifCfg(cfg)) return '';
    /* Depo: tanpa teks tarif minimum, rekomendasi, atau ikon atur di formulir (8 Nov 2026): rekomendasi jadi bayangan di kolom harga, minimum cukup angka merah; diatur di Pengaturan lini */
    if (cfg.sembunyiMin) return '';
    const sp = minSpek(cfg, b, r, k); if (!sp) return '<div class="fl-saran fl-min" data-flo hidden></div>';   /* penampung: petunjuk muncul langsung begitu nama lokasi/tipe diisi */
    const inf = tarifMinimumInfo(cfg.liniKey, sp.nama, sp.dim), mn = inf ? inf.min : null, rendah = dibawahMin(cfg, b, r, k), v = num(r[k.k]), master = lihatInt();   /* master dengan tampilan internal menyala */
    const asal = !master ? '' : inf && inf.atur ? ' · diatur master' : inf && inf.vendor ? ` · tertinggi: ${esc(inf.vendor)}` : '';
    /* master: ikon pensil di ujung baris membuka panel kecil (pilih dari vendor Master Rate, ketik manual, atau kembali otomatis) */
    const pen = id && master && bisaEdit() ? `<button type="button" class="fl-min__ed" data-fla="min-buka" data-flx="${esc(id)}" aria-label="Atur tarif minimum" title="Atur tarif minimum untuk semua akun">${IKON_PENSIL}</button>` : '';
    const teks = (ada(mn) ? (rendah ? `▼ Di bawah tarif minimum <b>${fmtRp(mn)}</b> (kurang ${fmtRp(mn - v)})` : `Tarif minimum: <b>${fmtRp(mn)}</b>${asal}`) : 'Tarif minimum: belum ada di Master Rate');
    const kelas = `fl-saran fl-min${rendah ? ' is-rendah' : ''}${ada(mn) ? '' : ' fl-min--kosong'}`;
    return `<div class="${kelas}" data-flo><span>${teks}</span>${pen}</div>${pen && UI.minBuka === id ? panelMin(cfg, sp, id, inf) : ''}`;
  }
  const s = rekomendasiJual(null, cfg.liniKey, r.uraian, saranMR(cfg.liniKey, r.uraian, dim)); return ada(s) ? `<div class="fl-saran">Rekomendasi harga jual: <b>${fmtRp(bulat1000(s))}</b></div>` : '';
};
/* panel kecil atur tarif minimum (hanya master): chip per vendor, kolom ketik manual, tombol otomatis */
function panelMin(cfg, sp, id, inf) {
  const kand = minKandidat(cfg.liniKey, sp.nama, sp.dim), now = inf && inf.min;
  const chip = c => `<button type="button" class="fl-minp__c${inf && inf.atur && c.min === now ? ' is-on' : ''}" data-fla="min-pilih" data-flx="${esc(id)}|${c.min}">${esc(c.vendor || 'Vendor')} <b>${fmtRp(c.min)}</b></button>`;
  return `<div class="fl-minp" data-flminp>${kand.length ? `<div class="fl-minp__ch">${kand.map(chip).join('')}</div>` : '<div class="fl-minp__k">Belum ada tarif vendor di Master Rate. Ketik manual.</div>'}
    <div class="fl-minp__m"><span>Rp</span><input inputmode="numeric" data-fn="1" data-flmin="${esc(id)}" value="${inf && inf.atur ? esc(String(now)) : ''}" placeholder="Ketik manual" aria-label="Tarif minimum manual"><button type="button" class="fl-minp__s" data-fla="min-simpan" data-flx="${esc(id)}">Simpan</button>${inf && inf.atur ? `<button type="button" class="fl-minp__o" data-fla="min-otomatis" data-flx="${esc(id)}">Otomatis</button>` : ''}</div></div>`;
}
MESIN.tabel = {
  awal(cfg) {
    const o = { rows: Object.fromEntries(cfg.bagian.map((b, i) => [String(i), clone(b.baris)])), opsi: clone(cfg.opsiAwal || {}) };
    /* formulir centang: semua layanan tercentang; bila Template lini bisnis sudah disimpan, hanya layanan yang ada di template (dicocokkan dari nama) */
    if (cfg.centang) {
      const T = window.ISLTemplate, tpl = cfg.liniKey && T && T.tersimpan(cfg.liniKey) ? T.baris(cfg.liniKey) : [];
      const cocok = nama => { const n = normT(nama); return tpl.some(x => { const ln = normT(x.layananNama || x.layanan); return ln === n || ln.startsWith(n + ' ') || n.startsWith(ln + ' '); }); };
      Object.values(o.rows).forEach(rows => rows.forEach(r => { r.on = !tpl.length || cocok(r.uraian); }));
    } if (cfg.blokAwalOff) o.off = Object.fromEntries(cfg.blokAwalOff.map(i => [String(i), true])); return o; },
  html(st, cfg, e) {
    let h = cfg.htmlAtas ? cfg.htmlAtas(st, e) : '';
    if (cfg.centang) h += this.ringkasCentang(cfg, st);
    cfg.bagian.forEach((b, bi) => {
      if (st.off && st.off[bi]) return;
      if (b.gabungKe !== undefined) return;
      if (cfg.centang) { h += this.centangBagian(cfg, b, bi, st); return; }
      b.kolom.forEach(k => { if (k.opsi) h += datalist(`fl-dl-${bi}-${k.k}`, k.opsi); });
      h += htmlKatalog(st, cfg.katLini || cfg.key, b.judul, b.kolom.map(k => ({ k: k.k, nama: k.nama, ph: k.ph, num: k.num })), '', id => (st.rows[bi] || []).some(r => r._cid === id));
      if (cfg.kartuHp) { h += this.kartuBagian(cfg, b, bi, st); return; }
      const kepalaB = `<div class="fl-bagian fl-bagian--h">${bisaEdit() ? `<span class="fl-grup-nama">${inpTeks(`judulBlok.${bi}`, judulTampil(st, bi, b), b.judul, 'class="fl-u" aria-label="Nama blok"')}</span>` : `<span>${esc(judulTampil(st, bi, b))}</span>`}${tombolHapusBlok(bi, this)}</div>${b.sub ? `<div class="fl-mut">${esc(b.sub)}</div>` : ''}`;
      if (cfg.htmlKartuLokasi) { h += kepalaB + cfg.htmlKartuLokasi(st, b, bi); return; }
      h += kepalaB + `<div class="fl-tbl"><table><thead><tr>${b.kolom.map(k => `<th${k.num ? ' class="r"' : ''}>${esc(k.nama)}</th>`).join('')}<th></th></tr></thead><tbody>`;
      const rows = st.rows[bi] || [];
      if (!rows.length) h += `<tr><td colspan="${b.kolom.length + 1}" class="fl-mut" style="text-align:center;padding:10px">Belum ada baris. Klik “+ Tambah baris”.</td></tr>`;
      rows.forEach((r, ri) => {
        /* kelompok per tipe container (Sewa Container Empty): judul tipe di atas setiap kelompok */
        if (b.kelompokTipe && (ri === 0 || rows[ri - 1].tipe !== r.tipe)) h += `<tr class="fl-grup"><td colspan="${b.kolom.length + 1}">${esc(r.tipe || '—')}</td></tr>`;
        h += '<tr>' + b.kolom.map(k => {
          const p = `rows.${bi}.${ri}.${k.k}`, v = r[k.k];
          if (k.tetap && !r._baru && !r._cid) return `<td data-label="${esc(k.nama)}">${esc(v)}</td>`;
          if (k.num) return `<td data-label="${esc(k.nama)}">${inpAngka(p, v, k.ph || '0', attrRendah(cfg, b, r, k))}${cfg.saranJual ? htmlSaranSel(cfg, b, r, k, `${bi}.${ri}.${k.k}`) : (cfg.modalSel ? htmlInt(num(v), cfg.modalSel(r, k, bi), cfg.liniKey, 'Modal', cfg.namaSel ? cfg.namaSel(r, k) : null) : '')}</td>`;
          return `<td data-label="${esc(k.nama)}">${inpTeks(p, v, k.ph, k.opsi ? `list="fl-dl-${bi}-${k.k}"` : '')}</td>`;
        }).join('') + `<td class="fl-aksi">${bisaEdit() ? `${bisaKatalog() && (r._baru || r._cid) ? `<button type="button" class="fl-ikon" data-fla="baris-simpan" data-flx="${bi}.${ri}" title="Simpan item ke katalog: jadi referensi tarif untuk item yang sama di penawaran berikutnya" aria-label="Simpan item ke katalog">${IKON_SIMPAN}</button>` : ''}<button type="button" class="fl-x" data-fla="baris-hapus" data-flx="${bi}.${ri}" aria-label="Hapus baris" title="Hapus baris">×</button>` : ''}</td></tr>`;
        const ref = r._baru && !r._cid ? this.refTabel(cfg, b, r) : null;
        if (ref) h += `<tr class="fl-refrow"><td colspan="${b.kolom.length + 1}"><div class="fl-bx__ref" data-flo>Tersimpan di katalog: ${esc(ref.label || '')}${b.kolom.filter(k => k.num && ada(num((ref.vals || {})[k.k]))).map(k => ` · ${esc(k.nama)} ${fmtRp(num(ref.vals[k.k]))}`).join('')} <button type="button" class="fl-tuju" data-fla="baris-ref" data-flx="${bi}.${ri}|${esc(ref.id)}">Pakai referensi ini</button></div></td></tr>`;
      });
      h += `</tbody></table></div>${bisaEdit() ? `<div><button type="button" class="fl-tambah fl-tambah--kecil" data-fla="baris-tambah" data-flx="${bi}">+ Tambah baris</button></div>` : ''}`;
    });
    return h + (cfg.htmlBawah ? cfg.htmlBawah(st, e) : '');
  },
  /* baris buntut standar yang harganya kosong dan akan memakai harga referensi (untuk pop-up konfirmasi sebelum pratinjau dan terbitkan) */
  itemReferensi(st, cfg) {
    const out = [];
    cfg.bagian.forEach((b, bi) => { if (!b.refLokasi || (st.off && st.off[bi])) return; lokasiKartu(st.rows[bi] || []).forEach(r => { if (!bakuBuntut(r) || !String(r.rute || '').trim()) return; [['h20', '20 ft', '20ft'], ['h40', '40 ft', '40ft']].forEach(([k, l, u]) => { if (!(num(r[k]) > 0)) { const v = refTrailer(r.rute, u); if (v) out.push({ nama: `${r.rute} (${l})`, harga: v }); } }); }); });
    return out;
  },
  aksi(a, x, st, cfg, root, g) {
    if (a === 'grup-buka') { const i = +x; if (UI.buka.has(i)) UI.buka.delete(i); else UI.buka.add(i); return true; }
    if (a === 'grup-ubah') { UI.ubahBlok = +x; UI.buka.add(+x); return true; }
    if (a === 'grup-selesai') { UI.ubahBlok = null; return true; }
    if (a === 'ket-buka') { UI.ket.add(String(x)); return true; }
    if (a === 'baris-tambah') { const b = cfg.bagian[+x], o = { _baru: true }; if (cfg.centang) { o.on = true; UI.buka.add(+x); } b.kolom.forEach(k => { o[k.k] = k.default ?? ''; }); if (b.kelompokTipe) { const akhir = (st.rows[+x] || []).slice(-1)[0]; if (akhir) o.tipe = akhir.tipe || ''; } if (cfg.htmlKartuLokasi) o.g = gidBaru(); (st.rows[+x] = st.rows[+x] || []).push(o); return true; }
    if (a === 'baris-hapus') { const [bi, ri] = String(x).split('.').map(Number); st.rows[bi].splice(ri, 1); return true; }
    if (a === 'baris-ref') { const [pos, cid] = String(x).split('|'), [bi, ri] = pos.split('.').map(Number), r = (st.rows[bi] || [])[ri], c = FL.katalog.find(k => k.id === cid); if (!r || !c) return false; cfg.bagian[bi].kolom.forEach(k => { if (c.vals && c.vals[k.k] !== undefined && c.vals[k.k] !== '') r[k.k] = c.vals[k.k]; }); r._cid = c.id; return true; }
    if (a === 'kat-pilih-on' || a === 'kat-pilih-off') {
      const bi = cfg.bagian.findIndex(b => b.judul === g), c = FL.katalog.find(k => k.id === x); if (bi < 0 || !c) return false;
      st.rows[bi] = st.rows[bi] || [];
      if (a === 'kat-pilih-on') { const o = { _cid: c.id }; if (cfg.centang) o.on = true; cfg.bagian[bi].kolom.forEach(k => { o[k.k] = (c.vals || {})[k.k] ?? ''; }); st.rows[bi].push(o); }
      else st.rows[bi] = st.rows[bi].filter(r => r._cid !== x);
      return true;
    }
    return false;
  },
  /* pengisian di HP (dan desktop) untuk lini yang kartuHp: satu kartu per layanan, harga 20 ft dan 40 ft berdampingan */
  kartuBagian(cfg, b, bi, st) {
    const rows = st.rows[bi] || [], p = `rows.${bi}`, uraian = b.kolom.find(k => k.k === 'uraian') || b.kolom[0], satuanK = b.kolom.find(k => k.k === 'satuan');
    const kartu = rows.map((r, ri) => {
      const baru = r._baru || r._cid, nama = uraian.tetap && !baru ? esc(r[uraian.k]) : inpTeks(`${p}.${ri}.${uraian.k}`, r[uraian.k], uraian.ph || 'Nama layanan');
      const sat = satuanK ? (satuanK.tetap && !baru ? esc(r[satuanK.k]) : inpTeks(`${p}.${ri}.${satuanK.k}`, r[satuanK.k], satuanK.ph || '')) : '';
      const angka = b.kolom.filter(k => k.num).map(k => `<label class="fl-kf"><span>${esc(k.nama)}</span>${inpAngka(`${p}.${ri}.${k.k}`, r[k.k], k.ph || '0', attrRendah(cfg, b, r, k))}${cfg.saranJual ? htmlSaranSel(cfg, b, r, k, `${bi}.${ri}.${k.k}`) : ''}</label>`).join('');
      const teks = b.kolom.filter(k => !k.num && !k.tetap && k !== uraian && k !== satuanK).map(k => `<label class="fl-kf fl-kf--lebar"><span>${esc(k.nama)}</span>${inpTeks(`${p}.${ri}.${k.k}`, r[k.k], k.ph || '', k.opsi ? `list="fl-dl-${bi}-${k.k}"` : '')}</label>`).join('');
      const aksi = bisaEdit() ? `${bisaKatalog() && baru ? `<button type="button" class="fl-ikon" data-fla="baris-simpan" data-flx="${bi}.${ri}" title="Simpan item ke katalog: jadi referensi tarif untuk item yang sama di penawaran berikutnya" aria-label="Simpan item ke katalog">${IKON_SIMPAN}</button>` : ''}<button type="button" class="fl-x" data-fla="baris-hapus" data-flx="${bi}.${ri}" aria-label="Hapus baris" title="Hapus baris">×</button>` : '';
      return `<div class="fl-kartu-baris"><div class="fl-kartu-baris__h"><div><div class="fl-kartu-baris__nama">${nama}</div>${sat ? `<div class="fl-kartu-baris__sat">${sat}</div>` : ''}</div>${aksi}</div>${angka}${teks}</div>`;
    }).join('');
    const judulKolom = [uraian.nama || 'Layanan', ...b.kolom.filter(k => k.num).map(k => k.nama), ...b.kolom.filter(k => !k.num && !k.tetap && k !== uraian && k !== satuanK).map(k => k.nama)];
    const hd = `<div class="fl-kartu-hd">${judulKolom.map(t => `<span>${esc(t)}</span>`).join('')}</div>`;
    return `<div class="fl-bagian fl-bagian--h">${bisaEdit() ? `<span class="fl-grup-nama">${inpTeks(`judulBlok.${bi}`, judulTampil(st, bi, b), b.judul, 'class="fl-u" aria-label="Nama blok"')}</span>` : `<span>${esc(judulTampil(st, bi, b))}</span>`}${tombolHapusBlok(bi, this)}</div>${b.sub ? `<div class="fl-mut">${esc(b.sub)}</div>` : ''}${hd}<div class="fl-kartus">${kartu || '<div class="fl-mut" style="text-align:center;padding:10px">Belum ada baris. Klik “+ Tambah baris”.</div>'}</div>${bisaEdit() ? `<div><button type="button" class="fl-tambah fl-tambah--kecil" data-fla="baris-tambah" data-flx="${bi}">+ Tambah baris</button></div>` : ''}`;
  },
  /* ---------- formulir centang (Depo): ringkasan, kelompok yang bisa dilipat, layanan dicentang lalu diisi harga 20 ft dan 40 ft ---------- */
  ringkasCentang(cfg, st) {
    let isi = 0, rendah = 0;
    cfg.bagian.forEach((b, bi) => { if (st.off && st.off[bi]) return; (st.rows[bi] || []).forEach(r0 => { const r = barisEf(cfg, b, r0); if (!rowAktif(r, b.kolom)) return; if (adaHarga(r, b.kolom)) isi++; if (b.kolom.filter(k => k.num).some(k => dibawahMin(cfg, b, r, k))) rendah++; }); });
    return `<div class="fl-ck__ring" data-flo><span class="fl-ck__chip ${isi ? 'ok' : ''}">${isi} layanan terisi</span>${rendah ? `<span class="fl-ck__chip bad">▼ ${rendah} di bawah minimum</span>` : ''}${lihatInt() ? `<span class="fl-ck__chip">Markup ${fmt(targetLini(cfg.liniKey), 1)}%</span>` : ''}</div>`;
  },
  centangBagian(cfg, b, bi, st) {
    const rows = st.rows[bi] || [], ed = bisaEdit(), buka = UI.buka.has(bi), ubah = UI.ubahBlok === bi, numK = b.kolom.filter(k => k.num), ketK = b.kolom.find(k => k.k === 'ket');
    const jml = rows.filter(r => barisTerisi(barisEf(cfg, b, r), b.kolom)).length, judul = tanpaHuruf(judulTampil(st, bi, b));
    const baris = rows.map((r, ri) => {
      const on = rowAktif(r, b.kolom), baru = !!(r._baru || r._cid), p = `rows.${bi}.${ri}`, kunciKet = `${bi}.${ri}`;
      const nama = baru ? inpTeks(`${p}.uraian`, r.uraian, 'Nama layanan', 'aria-label="Nama layanan"') : `<b>${esc(r.uraian)}</b>`;
      const sat = baru ? inpTeks(`${p}.satuan`, r.satuan, 'per kontainer', 'aria-label="Satuan"') : (r.satuan ? `<small>${esc(r.satuan)}</small>` : '');
      const cek = `<input type="checkbox" data-fl="${p}.on" ${on ? 'checked' : ''} aria-label="Tawarkan ${esc(r.uraian || 'layanan')}">`;
      const aksi = ed && baru ? `${bisaKatalog() ? `<button type="button" class="fl-ikon" data-fla="baris-simpan" data-flx="${bi}.${ri}" title="Simpan item ke katalog: jadi referensi tarif untuk item yang sama di penawaran berikutnya" aria-label="Simpan item ke katalog">${IKON_SIMPAN}</button>` : ''}<button type="button" class="fl-x" data-fla="baris-hapus" data-flx="${bi}.${ri}" aria-label="Hapus baris" title="Hapus baris">×</button>` : '';
      const kepala = baru
        ? `<div class="fl-ck__row">${cek}<div class="fl-ck__t2 fl-ck__t2--in">${nama}${sat}</div><span class="fl-ck__aksi">${aksi}</span></div>`
        : `<div class="fl-ck__row"><label class="fl-ck__cbl">${cek}<span class="fl-ck__t2">${nama}${sat}</span></label></div>`;
      if (!on) return `<div class="fl-ck__r">${kepala}</div>`;
      const f = k => `<div class="fl-ck__f"><span>${esc(String(k.nama).replace(/\s*\(Rp\)\s*$/i, ''))}</span><div class="fl-ck__in"><em>Rp</em>${inpAngka(`${p}.${k.k}`, r[k.k], ghostRek(cfg, b, r, k).ph, ghostRek(cfg, b, r, k).at)}</div>${cfg.saranJual ? htmlSaranSel(cfg, b, r, k, `${bi}.${ri}.${k.k}`) : ''}</div>`;
      const ket = ketK ? ((String(r.ket || '').trim() || UI.ket.has(kunciKet))
        ? `<label class="fl-ck__ketw"><span class="fl-ck__kl">Keterangan <small>(tampil di PDF, opsional)</small></span>${inpTeks(`${p}.ket`, r.ket, 'Mis. Buka pintu')}</label>`
        : `<div class="fl-ck__ketw"><button type="button" class="fl-ck__lnk" data-fla="ket-buka" data-flx="${kunciKet}">+ Tambah keterangan</button></div>`) : '';
      return `<div class="fl-ck__r on">${kepala}<div class="fl-ck__f2">${numK.map(f).join('')}</div>${ket}</div>`;
    }).join('');
    /* ubah/hapus blok: ikon sejajar dengan nama blok di kepala kelompok (tanpa baris sendiri); baris nama hanya muncul saat mengubah nama */
    const tb = ed && ubah ? `<div class="fl-ck__tb fl-ck__tb--ubah"><span class="fl-grup-nama">${inpTeks(`judulBlok.${bi}`, judulTampil(st, bi, b), b.judul, 'class="fl-u" data-flblok="1" aria-label="Nama blok"')}</span><button type="button" class="fl-ikon" data-fla="grup-selesai" data-flx="${bi}" aria-label="Selesai mengubah nama blok" title="Selesai (Enter)">${IKON_CEK}</button></div>` : '';
    const ikonBlok = ed && buka && !ubah ? `<span class="fl-ck__ic"><button type="button" class="fl-ikon" data-fla="grup-ubah" data-flx="${bi}" aria-label="Ubah nama blok ${esc(judul)}" title="Ubah nama blok">${IKON_PENSIL}</button><button type="button" class="fl-ikon fl-ikon--b" data-fla="bag-hapus" data-flx="${bi}" aria-label="Hapus blok ${esc(judul)}" title="Hapus blok: disembunyikan dari formulir dan PDF">${IKON_TUTUP}</button></span>` : '';
    const isiBuka = buka ? `<div class="fl-ck__b">${tb}${htmlKatalog(st, cfg.katLini || cfg.key, b.judul, b.kolom.map(k => ({ k: k.k, nama: k.nama, ph: k.ph, num: k.num })), '', id => rows.some(r => r._cid === id))}${baris || '<div class="fl-mut" style="padding:12px">Belum ada layanan. Tambahkan lewat tombol di bawah.</div>'}${ed ? `<div class="fl-ck__tbh"><button type="button" class="fl-tambah" data-fla="baris-tambah" data-flx="${bi}">+ Tambah layanan manual</button></div>` : ''}</div>` : '';
    return `<section class="fl-ck ${buka ? 'is-buka' : ''}"><div class="fl-ck__h"><button type="button" class="fl-ck__t" data-fla="grup-buka" data-flx="${bi}" aria-expanded="${buka}"><span class="fl-ck__bd">${huruf(bi)}</span><span class="fl-ck__nm"><b>${esc(judul)}</b>${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</span></button>${ikonBlok}<button type="button" class="fl-ck__t fl-ck__t--n" data-fla="grup-buka" data-flx="${bi}" tabindex="-1" aria-hidden="true"><span class="fl-ck__n ${jml ? '' : 'kosong'}" data-flo>${jml} / ${rows.length}</span><i class="fl-ck__cv" aria-hidden="true"></i></button></div>${isiBuka}</section>`;
  },
  labelBlok(cfg, k) { const b = cfg.bagian[+k]; return b ? b.judul : null; },
  refTabel(cfg, b, r) { const kol = b.kolom.find(k => !k.num && !k.opsi && k.k !== 'ket') || b.kolom[0], kunci = normT(r[kol.k]); if (!kunci) return null; return katalogLini(cfg.katLini || cfg.key, b.judul).find(c => c.vals && normT(c.vals[kol.k]) === kunci && b.kolom.some(k => k.num && ada(num(c.vals[k.k])) && num(c.vals[k.k]) !== num(r[k.k]))) || null; },
  katItem(cfg, grup, vals) { if (!Object.values(vals).some(Boolean)) throw new Error('Isi minimal satu kolom.'); const b = cfg.bagian.find(z => z.judul === grup); const lab = b ? (b.kolom.filter(k => !k.num).map(k => vals[k.k]).filter(Boolean).join(' – ')) : ''; return { grup, vals, label: lab || Object.values(vals).find(Boolean) || 'Layanan' }; },
  hapusKatalog(st, cfg, id) { Object.keys(st.rows).forEach(k => { st.rows[k] = (st.rows[k] || []).filter(r => r._cid !== id); }); }
};
const adaHarga = (r, kol) => kol.some(k => k.num && ada(num(r[k.k])) && num(r[k.k]) > 0);
/* Lini berformulir centang (Depo): layanan ikut penawaran bila dicentang (r.on) dan berharga. Draf lama tanpa r.on: ikut bila berharga (sama seperti sebelumnya). */
const rowAktif = (r, kol) => r.on !== undefined ? !!r.on : adaHarga(r, kol);
const barisTerisi = (r, kol) => rowAktif(r, kol) && adaHarga(r, kol);

/* ---------- DEPO CONTAINER ---------- */
const kolUkuran = (adm) => [{ k: 'uraian', nama: 'Uraian', tetap: true, ph: 'Nama layanan' }, { k: 'satuan', nama: 'Satuan', tetap: true, ph: 'per kontainer' },
  ...(adm ? [{ k: 'h20', nama: 'Harga satu untuk 20 ft dan 40 ft (Rp)', num: true }] : [{ k: 'h20', nama: '20 ft (Rp)', num: true }, { k: 'h40', nama: '40 ft (Rp)', num: true }]),
  { k: 'ket', nama: 'Keterangan', ph: 'Opsional' }];
const brs = (uraian, satuan, ket = '') => ({ uraian, satuan, h20: '', h40: '', ket });
const LINI = {};
/* Harga jual rekomendasi bawaan template Depo (tabel tarif dari tim, 4 Nov 2026): [20 ft, 40 ft]. Master bisa mengubahnya di Pengaturan > Template lini Depo (PENG.rekJual). */
const REK_DEPO = { 'Storage Container Dry': [60000, 70000], 'Storage Container DG': [80000, 100000], 'Storage Container Reefer': [70000, 100000], 'Storage Empty': [40000, 50000],
  'LOLO FULL': [400000, 500000], 'LOLO EMPTY': [300000, 400000], 'DEPO SHIFTING': [100000, 200000], 'Plugging & Monitoring': [850000, 1200000], 'Adm': [50000, 50000],
  'Container to Truck': [2200000, 2500000], 'Container to Container': [4400000, 5000000], 'Reworks Container / Behandle': [2200000, 2500000], 'Terminal Peti Kemas / Depo': [700000, 800000] };
const rekAwalDari = tabel => Object.fromEntries(Object.entries(tabel).flatMap(([n, [a, b]]) => [[kunciMin(n, { ukuran: '20ft' }), a], [kunciMin(n, { ukuran: '40ft' }), b]]));
LINI.depo = {
  key: 'depo', mesin: 'tabel', liniKey: 'depo', rekAwal: rekAwalDari(REK_DEPO), sembunyiMin: true, nama: 'Depo Container', judul: 'Penawaran Tarif Depo Container',
  ket: 'Centang layanan yang ditawarkan, lalu isi harga 20 ft dan 40 ft. Tarif minimum (modal + markup) tampil di bawah kotak harga.',
  saranJual: true, kartuHp: true, tarifMinimum: true, centang: true,
  bagian: [
    { judul: 'A. Storage', sub: 'Per hari per container', kolom: kolUkuran(), baris: [brs('Storage Container Dry', 'per hari'), brs('Storage Container DG', 'per hari'), brs('Storage Container Reefer', 'per hari'), brs('Storage Empty', 'per hari')] },
    { judul: 'B. Handling', sub: 'Layanan per container', kolom: kolUkuran(), baris: [brs('LOLO FULL', 'per container'), brs('LOLO EMPTY', 'per container'), brs('DEPO SHIFTING', 'per container'), brs('Plugging & Monitoring', 'per hari / per container'), brs('Adm', 'per invoice')] },
    { judul: 'C. Stripping / Stuffing', sub: '', kolom: kolUkuran(), baris: [brs('Container to Truck', 'per container'), brs('Container to Container', 'per container'), brs('Reworks Container / Behandle', 'per container'), brs('Pengambilan Sampel', 'per container', 'Buka pintu')] },
    { judul: 'D. Trucking REPO', sub: '', kolom: kolUkuran(), baris: [brs('Terminal Peti Kemas / Depo', 'per container', 'Belum termasuk biaya gatepass pelabuhan yang berlaku'), brs('Extra Moving (Fumigasi Area)', 'per container')] }
  ],
  modalSel: (r, k) => modalMR('depo', r.uraian, { ukuran: k.k === 'h40' ? '40ft' : k.k === 'h20' && r.h40 !== undefined ? '20ft' : undefined }),
  namaSel: (r, k) => `${r.uraian} ${k.k === 'h40' ? '40 ft' : '20 ft'}`,
  baris(st) {
    const out = [];
    this.bagian.forEach((b, bi) => (st.off && st.off[bi] ? [] : (st.rows[bi] || []).map(r => barisEf(this, b, r))).filter(r => rowAktif(r, b.kolom)).forEach(r => b.kolom.filter(k => k.num).forEach(k => {
      const j = num(r[k.k]); if (!(j > 0)) return; const uk = b.kolom.some(z => z.k === 'h40') ? (k.k === 'h40' ? '40 ft' : '20 ft') : '';
      out.push({ item: `${r.uraian}${uk ? ' ' + uk : ''}`, satuan: r.satuan || 'per kontainer', jual: j, modal: this.modalSel(r, k), min: minAktifCfg(this) ? tarifMinimum(this.liniKey, r.uraian, dimUkuran(b, k)) : null, desk: r.ket || '', bagian: tanpaHuruf(b.judul) });
    })));
    return out;
  },
  /* Desain C (dipilih 3 Nov 2026): kartu per kelompok dengan lencana huruf; satuan dan keterangan jadi sub-baris di bawah nama layanan (tidak ada kolom Note);
     kolom 20 ft dan 40 ft berisi harga dengan awalan Rp. Kelas isl-kartu hanya untuk dokumen baru: dokumen yang sudah terbit dibekukan dengan susunan lama. */
  dok(st) {
    const blok = []; let n = 0;
    this.bagian.forEach((b, bi) => {
      if (st.off && st.off[bi]) return;
      const rows = (st.rows[bi] || []).map(r => barisEf(this, b, r)).filter(r => barisTerisi(r, b.kolom)); if (!rows.length) return;
      const sub = r => [r.satuan, r.ket].filter(Boolean).join(' · ');
      blok.push({ jenis: 'tabel', kelas: 'isl-kartu isl-kartu--dep', huruf: huruf(n++), cap: tanpaHuruf(judulTampil(st, bi, b)), sub: b.sub, kolom: [{ h: 'Layanan', w: 56, a: 'l' }, { h: '20 ft (Rp)', w: 22, a: 'r' }, { h: '40 ft (Rp)', w: 22, a: 'r' }],
        baris: rows.map(r => ({ c: [{ v: r.uraian, b: true, sat: sub(r) }, { v: hargaSel(r.h20), rp: true }, { v: hargaSel(r.h40), rp: true }] })) });
    });
    return { blok, catatan: [] };   /* catatan "Kolom kosong (—) ..." dihapus di semua lini (4 Nov 2026) */
  },
  cek(st) { const n = this.baris(st).length; return { galat: n ? [] : ['Isi minimal satu tarif depo.'], peringatan: [] }; }
};
const hargaSel = v => (ada(num(v)) && num(v) > 0) ? angkaDok(num(v)) : '—';

/* ---------- TRAILER ---------- */
const PICKUP_OPSI = ['Pelabuhan Tanjung Priok', 'Pelabuhan Patimban'];
/* baris satu blok. Blok yang digabung (gabungKe) tidak punya baris sendiri; barisnya ikut blok induknya. */
const rowsBlok = (cfg, st, bi) => {
  const b = cfg.bagian[bi]; if (b.gabungKe !== undefined) return [];
  const anak = cfg.bagian.map((x, j) => (x.gabungKe === bi && !(st.off && st.off[j]) ? (st.rows[j] || []) : [])).flat();
  return denganRef(lokasiKartu([...(st.rows[bi] || []), ...anak]), b);
};
/* UI kartu per lokasi: baris dengan g sama satu kartu. Lokasi hanya diisi di baris kepala (pertama); baris buntut lain mewarisinya. Baris tanpa g (draf lama) berdiri sendiri. */
const gidBaru = () => 'g' + Math.random().toString(36).slice(2, 8);
const kunciKartu = (r, i) => r.g || ('_' + i);
function lokasiKartu(rows) {
  const kepala = new Map(); rows.forEach((r, i) => { const k = kunciKartu(r, i); if (!kepala.has(k)) kepala.set(k, r); });
  return rows.map((r, i) => { const h = kepala.get(kunciKartu(r, i)); return h === r ? { ...r, _kartu: true } : { ...r, rute: h.rute, ket: r.ket || '' }; });
}
function kelompokKartu(rows) { const m = new Map(); rows.forEach((r, i) => { const k = kunciKartu(r, i); (m.get(k) || m.set(k, []).get(k)).push(i); }); return [...m.entries()].map(([key, idx]) => ({ key, idx })); }
/* domestik: satu baris per rute (asal – tujuan), tanpa kolom Pick up */
const kolRepo = () => kolDomestik().map(k => k.k === 'rute' ? { ...k, nama: 'Rute REPO (asal – tujuan, bebas diisi)', ph: 'Depo Cikarang – Gudang Cibitung' } : k);
const kolBuntut = () => ({ k: 'bnt', nama: 'Buntut', ph: 'Rangka (standar)', default: '', opsi: Object.values(BUNTUT) });
const kolDomestik = () => [{ k: 'rute', nama: 'Rute (2 sampai 3 titik, bebas diisi)', ph: 'Jakarta – Surabaya – Bandung' }, { k: 'h20', nama: '20 ft per trip (Rp)', num: true }, { k: 'h40', nama: '40 ft per trip (Rp)', num: true }, kolBuntut(), { k: 'ket', nama: 'Keterangan (opsional)', ph: 'Opsional' }];
/* ekspor dan impor: tabel berisi lokasi gudang, 20 ft, 40 ft, dan keterangan. Lokasi penentu tarif adalah port berlaku (di atas tabel). */
const kolTrailer = () => [{ k: 'rute', nama: 'Lokasi gudang', ph: 'Cikarang' },
  { k: 'h20', nama: '20 ft per trip (Rp)', num: true }, { k: 'h40', nama: '40 ft per trip (Rp)', num: true }, kolBuntut(), { k: 'ket', nama: 'Keterangan (opsional)', ph: 'Mis. Head Tronton' }];
/* buntut per baris: teks bebas dari daftar pilihan; kosong berarti Rangka. Kunci dicocokkan dari nama (Rangka, Flatbed, Lowbed, Dolly); teks lain jadi kelompok sendiri. */
const WARNA_BUNTUT = { flatbed: 'oranye', lowbed: 'hijau', dolly: 'abu' };   /* Rangka = bawaan, tidak diberi lencana */
const kunciBuntut = t => { const x = String(t || '').trim().toLowerCase(); if (!x) return 'rangka'; if (/^(rangka|chassis|chasis)\b/.test(x)) return 'rangka'; return Object.keys(BUNTUT).find(k => k === x || BUNTUT[k].toLowerCase() === x) || ('lain:' + String(t).trim()); };
const URUT_BNT = Object.keys(BUNTUT);
const buntutDipakai = st => { const o = new Set(); Object.values(st.rows || {}).flat().forEach(r => { const k = kunciBuntut(r.bnt); if (BUNTUT[k] && (r.h20 || r.h40)) o.add(k); }); return [...o]; };
/* rute domestik ditulis bebas; pemisah (-, –, >, →) diseragamkan jadi panah supaya rapi di PDF */
const rapiRute = t => String(t || '').trim().replace(/\s*→\s*|\s+[-–—>]+\s+/g, ' → ');
/* Daftar tujuan gudang Import dan Export beserta harga jual referensi (20 ft, 40 ft; buntut Rangka). Referensi saja: dipakai otomatis di PDF bila kolom harga dikosongkan (logika harga referensi Customs Clearance).
   Bila Master Rate punya tarif vendor yang lebih tinggi untuk lokasi dan ukuran yang sama, referensinya naik mengikuti tarif minimum dari vendor itu. Daftar dari pemilik (4 Nov 2026); angka biru di sumbernya tidak dipakai. */
const TRL_REF_EI = [
  ['Ancol', 1600000, 1700000],
  ['Cilincing', 1600000, 1700000],
  ['Marunda', 1600000, 1700000],
  ['Bandengan', 1800000, 1900000],
  ['Pondok Ungu', 1800000, 1900000],
  ['Cakung', 1700000, 1800000],
  ['Pulo Gadung', 1650000, 1750000],
  ['Cibitung', 2200000, 2300000],
  ['Cikarang', 2200000, 2300000],
  ['Karawang', 2400000, 2500000],
  ['Gunung Putri', 2250000, 2350000],
  ['Caringin', 2400000, 2500000],
  ['Cilengsi', 2250000, 2350000],
  ['Karawaci', 2300000, 2400000],
  ['Serpong', 2300000, 2400000],
  ['BSD, Tanam Tekno', 2400000, 2500000],
  ['Bitung', 2400000, 2500000],
  ['Pasar Kemis', 2200000, 2300000],
  ['Jatiuwung/Jatake', 2300000, 2400000],
  ['Cikupa', 2350000, 2450000],
  ['Tigaraksa', 2600000, 2700000],
  ['Balaraja', 2700000, 2800000],
  ['Daan Mogot', 2050000, 2150000],
  ['Cengkareng', 1900000, 2000000],
  ['Kalideres', 2100000, 2200000],
  ['Jurumudi', 2150000, 2250000],
  ['Kapuk Kamal', 2050000, 2150000],
  ['Dadap', 2250000, 2350000],
  ['Cikande', 2800000, 2900000],
  ['Serang', 2850000, 2950000],
  ['Cilegon', 3900000, 4000000],
  ['Merak', 4100000, 4200000],
  ['Cikampek', 2600000, 2700000],
  ['Cibinong', 2300000, 2400000],
  ['Sentul/Bogor', 2400000, 2500000],
  ['Purwakarta', 3000000, 3100000],
  ['Subang', 3200000, 3300000],
  ['Cirebon/Majalengka', 4400000, 4500000],
  ['Bandung', 4000000, 4100000],
  ['Sukabumi', 3500000, 3600000],
  ['Berebes', 5400000, 5500000]
];
const TRL_REF = new Map(TRL_REF_EI.map(([n, a, b]) => [normT(n), [a, b]]));
const bakuBuntut = r => kunciBuntut(r.bnt) === 'rangka';
function refTrailer(nama, ukuran) {
  const e = TRL_REF.get(normT(nama)); if (!e) return null;
  const dasar = ukuran === '40ft' ? e[1] : e[0], v = tarifMinimum('trucking_trailer', nama, { ukuran });
  return ada(v) && v > dasar ? v : dasar;
}
/* harga kosong pada baris buntut standar di blok berdaftar referensi diisi harga referensi (dipakai PDF dan perhitungan, bukan isian formulir) */
function denganRef(rows, b) {
  if (!b.refLokasi) return rows;
  return rows.map(r => { if (!bakuBuntut(r)) return r; const o = { ...r }; ['h20', 'h40'].forEach(k => { if (!(num(r[k]) > 0)) { const v = refTrailer(r.rute, k === 'h40' ? '40ft' : '20ft'); if (v) o[k] = v; } }); return o; });
}
LINI.trucking_trailer = {
  key: 'trucking_trailer', mesin: 'tabel', liniKey: 'trucking_trailer', nama: 'Trailer', judul: 'Penawaran Tarif Trailer',
  saranJual: true, tarifMinimum: true,
  /* tarif minimum: cocokkan lokasi gudang (tujuan/zona) dan ukuran kolom (20/40 ft) ke tarif vendor Trailer di Master Rate. Hanya buntut Rangka (standar), sama seperti harga referensi. */
  minSpek: (b, r, k) => String(r.rute || '').trim() && bakuBuntut(r) ? { nama: r.rute, dim: { ukuran: k.k === 'h40' ? '40ft' : '20ft' } } : null,
  resolusi: lokasiKartu,   /* baris satu kartu mewarisi lokasi dari baris kepala (dipakai panel tarif minimum) */
  ket: 'Blok Import dan Export, REPO, dan Domestik (REPO dan Domestik dipilih saat dibutuhkan). 20 ft dan 40 ft per trip, buntut per baris harga.',

  opsiAwal: { port: 'Tanjung Priok, Jakarta' },
  refJual: refTrailer,   /* penanda: ada harga referensi, jadi pop-up konfirmasi sebelum pratinjau/terbitkan berlaku */
  /* pilih blok saat membuat quotation: Import dan Export tampil, REPO dan Domestik dimunculkan lewat tombol tampilkan */
  blokAwalOff: [1, 2],
  htmlBawah() { return htmlKalkulator(); },
  bagian: [
    { judul: 'A. Import dan Export', sub: 'Berlaku untuk impor dan ekspor', refLokasi: true, kolom: kolTrailer(), baris: [{ g: 'g0', rute: '', h20: '', h40: '', bnt: '', ket: '', _baru: true }] },
    { judul: 'B. REPO', sub: 'Pemindahan kontainer antar depo, gudang, atau pelabuhan. Rute bebas, tanpa port.', kolom: kolRepo(), baris: [], rutaBebas: true },
    { judul: 'C. Domestik', sub: 'Satu baris per rute, harga 20 ft dan 40 ft. Tanpa port.', kolom: kolDomestik(), baris: [], rutaBebas: true }
  ],
  htmlAtas(st) {
    const adaEI = !(st.off && st.off['0']);
    return `<div class="fl-kartu"><div class="fl-sub-h">Jenis pengiriman dan buntut</div>
      <div class="fl-mut">Import dan Export memakai port; Domestik memakai rute bebas tanpa port. Buntut Rangka adalah standar dan tidak ditulis di PDF; hanya Flatbed, Lowbed, atau Dolly yang tampil.</div>
      ${adaEI ? `<label class="fl-f"><span>Port berlaku (menentukan tarif impor dan ekspor)</span>${inpTeks('opsi.port', st.opsi.port, 'Tanjung Priok, Jakarta', 'list="fl-dl-port-trl"')}${datalist('fl-dl-port-trl', ['Tanjung Priok, Jakarta', 'Patimban, Subang', 'Tanjung Perak, Surabaya'])}</label>` : ''}</div>`;
  },
  /* Kartu per lokasi/rute: nama lokasi sekali, di bawahnya satu baris harga per buntut (Rangka standar di baris pertama). */
  htmlKartuLokasi(st, b, bi) {
    const rows = st.rows[bi] || [], res = lokasiKartu(rows), ed = bisaEdit(), domestik = !!b.rutaBebas, kolRute = b.kolom.find(k => k.k === 'rute'), kol = kk => b.kolom.find(z => z.k === kk);
    const phRef = (r, u) => { const v = b.refLokasi && bakuBuntut(r) ? refTrailer(rows[kelompokKartu(rows).find(g => g.idx.includes(rows.indexOf(r))).idx[0]].rute, u) : null; return v ? fmt(v) : '0'; };
    /* tarif minimum Master Rate per sel harga (petunjuk, penanda merah, panel atur untuk master): satu baris penuh di bawah baris harga, dua kolom 20 ft dan 40 ft */
    const minBaris = (rE, ri) => { const h = [['h20', '20 ft'], ['h40', '40 ft']].map(([kk, l]) => { const x = htmlSaranSel(this, b, rE, kol(kk), `${bi}.${ri}.${kk}`); return x ? `<div class="fl-lok__min" data-ukr="${kk}"><small>${l}</small>${x}</div>` : ''; }).join(''); return h ? `<div class="fl-lok__minrow">${h}</div>` : ''; };
    const opsiB = [['', 'Rangka'], ...Object.values(BUNTUT).filter(n => n !== 'Rangka')];
    const pil = (ri, v) => { const val = String(v || '').trim(), baku = kunciBuntut(val), cocok = baku === 'rangka' ? '' : (BUNTUT[baku] || null); return pilihan(`rows.${bi}.${ri}.bnt`, cocok === null ? [...opsiB, [val, val]] : opsiB, cocok === null ? val : cocok); };
    const kartu = kelompokKartu(rows).map(({ key, idx }) => {
      const hi = idx[0], h = rows[hi], ketK = `${bi}.${hi}`, adaKet = String(h.ket || '').trim() || UI.ket.has(ketK);
      const garis = idx.map((ri, n) => { const r = rows[ri];
        return `<div class="fl-lok__ln"><label class="fl-lok__bn fl-bn--${kunciBuntut(r.bnt).replace(/[^a-z]/g, '') || 'rangka'}" aria-label="Buntut" title="Buntut (kosong atau Rangka = standar, tidak ditulis di PDF)">${ed ? pil(ri, r.bnt) : esc(BUNTUT[kunciBuntut(r.bnt)] || r.bnt || 'Rangka')}</label><label class="fl-lok__h">${n ? '' : '<span>20 ft</span>'}${inpAngka(`rows.${bi}.${ri}.h20`, r.h20, phRef(r, '20ft'), 'aria-label="20 ft" ' + attrRendah(this, b, res[ri], kol('h20')))}</label><label class="fl-lok__h">${n ? '' : '<span>40 ft</span>'}${inpAngka(`rows.${bi}.${ri}.h40`, r.h40, phRef(r, '40ft'), 'aria-label="40 ft" ' + attrRendah(this, b, res[ri], kol('h40')))}</label>${ed && n ? `<button type="button" class="fl-x" data-fla="baris-hapus" data-flx="${bi}.${ri}" aria-label="Hapus baris buntut" title="Hapus baris buntut">×</button>` : '<span class="fl-lok__sp"></span>'}</div>${minBaris(res[ri], ri)}`; }).join('');
      return `<div class="fl-lok"><div class="fl-lok__k"><label class="fl-lok__nm"><span>${esc(kolRute ? kolRute.nama : 'Lokasi')}</span>${inpTeks(`rows.${bi}.${hi}.rute`, h.rute, kolRute ? kolRute.ph : '')}</label>${ed ? `<button type="button" class="fl-x" data-fla="lokasi-hapus" data-flx="${bi}|${esc(key)}" aria-label="Hapus ${domestik ? 'rute' : 'lokasi'}" title="Hapus ${domestik ? 'rute' : 'lokasi'} beserta semua buntutnya">×</button>` : ''}</div>${garis}
        ${ed ? `<div class="fl-lok__aksi"><button type="button" class="fl-tambah fl-tambah--kecil" data-fla="buntut-tambah" data-flx="${bi}|${esc(key)}">+ Buntut lain</button>${adaKet ? '' : `<button type="button" class="fl-ck__lnk" data-fla="ket-buka" data-flx="${ketK}">+ Keterangan</button>`}</div>` : ''}
        ${adaKet ? `<label class="fl-f fl-lok__ket"><span>Keterangan (opsional, tampil di bawah ${domestik ? 'rute' : 'lokasi'})</span>${inpTeks(`rows.${bi}.${hi}.ket`, h.ket, 'Mis. Head Tronton')}</label>` : ''}</div>`;
    }).join('');
    const tombolRef = ed && b.refLokasi ? `<div class="fl-baris-tombol" style="margin:6px 0"><button type="button" class="fl-chipbtn" data-fla="isi-ref" data-flx="${bi}">Isi semua tujuan gudang (rekomendasi)</button><span class="fl-mut">${TRL_REF_EI.length} tujuan. Harga yang dikosongkan memakai harga referensi (tampil transparan) dan ikut ke PDF.</span></div>` : '';
    return tombolRef + `<div class="fl-lokasi">${kartu || `<div class="fl-mut" style="text-align:center;padding:10px">Belum ada ${domestik ? 'rute' : 'lokasi'}. Klik “+ Tambah ${domestik ? 'rute' : 'lokasi'}”.</div>`}</div>${ed ? `<div><button type="button" class="fl-tambah fl-tambah--kecil" data-fla="baris-tambah" data-flx="${bi}">+ Tambah ${domestik ? 'rute' : 'lokasi'}</button></div>` : ''}`;
  },
  baris(st) {
    const out = [];
    this.bagian.forEach((b, bi) => (st.off && st.off[bi] ? [] : rowsBlok(this, st, bi)).forEach(r => ['h20', 'h40'].forEach(k => {
      const j = num(r[k]); if (!(j > 0)) return;
      const bk = kunciBuntut(r.bnt), sp = minSpek(this, b, r, { k }), mn = sp && minAktifCfg(this) ? tarifMinimum(this.liniKey, sp.nama, sp.dim) : null;
      out.push({ item: `Trailer ${tanpaHuruf(b.judul)}: ${r.rute || '—'}${bk === 'rangka' ? '' : ' [' + (BUNTUT[bk] || r.bnt) + ']'} (${k === 'h20' ? '20 ft' : '40 ft'})`, satuan: 'per trip', jual: j, modal: null, min: mn, desk: r.ket || '', bagian: tanpaHuruf(b.judul) });
    })));
    return out;
  },
  /* Desain A + D2 (dipilih 4 Nov 2026): pita biru ISL jenis pengiriman (Import dan Export + port, Domestik tanpa port), lalu satu kartu dengan kepala sendiri.
     Buntut ada di dalam sel tarif: Rangka (bawaan) tanpa lencana, Flatbed/Lowbed/Dolly berlencana warna. Baris dengan lokasi atau rute sama digabung jadi satu baris bertumpuk. */
  dok(st) {
    const blok = [], port = String(st.opsi.port || '').trim();
    this.bagian.forEach((b, bi) => {
      if (st.off && st.off[bi]) return;
      const rows = rowsBlok(this, st, bi).filter(r => adaHarga(r, b.kolom)); if (!rows.length) return;
      const domestik = !!b.rutaBebas, kolRute = b.kolom.find(k => k.k === 'rute');
      const nama = r => domestik ? (rapiRute(r.rute) || '—') : (String(r.rute || '').trim() || '—');
      const grup = new Map(); rows.forEach(r => { const n = nama(r), k = n.toLowerCase(); (grup.get(k) || grup.set(k, { n, rs: [] }).get(k)).rs.push(r); });
      const urutB = r => { const k = kunciBuntut(r.bnt); return URUT_BNT.indexOf(k) + 1 || 99; };
      const judul = tanpaHuruf(judulTampil(st, bi, b)), sub = domestik ? '' : (port ? `Pick up ${port}` : '');
      const garis = (rs, kk) => ({ ln: rs.map(r => { const k = kunciBuntut(r.bnt), v = hargaSel(r[kk]); return { l: k === 'rangka' ? '' : (BUNTUT[k] || String(r.bnt).trim()), w: WARNA_BUNTUT[k] || 'abu', v }; }) });
      const ketGab = rs => rs.map(r => { const t = String(r.ket || '').trim(), k = kunciBuntut(r.bnt); return t && (r._kartu || k === 'rangka' || rs.length === 1 ? t : `${BUNTUT[k] || r.bnt}: ${t}`); }).filter(Boolean).join(' · ');
      const judulEn = ({ 'Import dan Export': 'Import and Export', 'Domestik': 'Domestic' })[judul] || judul;   /* nama bawaan diterjemahkan; nama yang diubah pengguna tetap */
      blok.push({ jenis: 'jalur', kartu: true, warna: 'isl', teks: sub ? `${judul} — ${sub}` : judul, teksEn: sub ? `${judulEn} — Pick up ${port}` : judulEn });
      blok.push({ jenis: 'tabel', kelas: 'isl-kartu isl-kartu--cc isl-kartu--trl', kolom: [{ h: domestik ? 'Rute' : (kolRute ? kolRute.nama : 'Lokasi gudang'), hEn: domestik ? 'Route' : 'Warehouse location', w: 44, a: 'l' }, { h: '20 ft', w: 28, a: 'r' }, { h: '40 ft', w: 28, a: 'r' }],
        baris: [...grup.values()].map(g => { const rs = g.rs.slice().sort((x, y) => urutB(x) - urutB(y)); return { c: [{ v: g.n, b: true, sat: ketGab(rs) }, garis(rs, 'h20'), garis(rs, 'h40')] }; }) });
    });
    return { blok, info: [], catatan: [] };
  },
  tnc(st) { const sk = skTipeMaster('trucking_trailer'); return buntutDipakai(st).map(k => ({ judul: `Syarat dan ketentuan tipe buntut ${BUNTUT[k]}`, items: satuDua(sk[k]) })).filter(g => g.items.length); },
  cek(st) {
    const g = [], sk = skTipeMaster('trucking_trailer');
    if (!this.baris(st).length) g.push('Isi minimal satu tarif trailer.');
    buntutDipakai(st).filter(k => k !== 'rangka').forEach(k => { if (!satuDua(sk[k]).length) g.push(`S&K buntut ${BUNTUT[k]} belum diisi di Master Rate > Lini Bisnis > Trucking Trailer.`); });
    return { galat: g, peringatan: [] };
  },
  aksiKhusus(a, x, st) {
    if (a === 'isi-ref') {
      const bi = String(x), pakai = (st.rows[bi] || []).filter(r => String(r.rute || '').trim() || num(r.h20) > 0 || num(r.h40) > 0), ada = new Set(lokasiKartu(pakai).map(r => normT(r.rute)).filter(Boolean));
      const baru = TRL_REF_EI.filter(([n]) => !ada.has(normT(n))).map(([n]) => ({ g: gidBaru(), rute: n, h20: '', h40: '', bnt: '', ket: '', _baru: true }));
      st.rows[bi] = [...pakai, ...baru]; toast(baru.length ? `<b>${baru.length} tujuan gudang ditambahkan.</b> Harga yang dikosongkan memakai harga referensi. Hapus kartu yang tidak ditawarkan.` : 'Semua tujuan gudang sudah ada.'); return true;
    }
    if (a === 'lokasi-hapus') { const [bi, key] = String(x).split('|'); st.rows[bi] = (st.rows[bi] || []).filter((r, i) => kunciKartu(r, i) !== key); return true; }
    if (a === 'buntut-tambah') {
      const [bi, key] = String(x).split('|'), rows = st.rows[bi] || [], kel = kelompokKartu(rows).find(k => k.key === key); if (!kel) return false;
      const head = rows[kel.idx[0]]; if (!head.g) head.g = gidBaru();
      const dipakai = new Set(kel.idx.map(i => kunciBuntut(rows[i].bnt))), berikut = ['flatbed', 'lowbed', 'dolly'].find(k => !dipakai.has(k)) || '';
      rows.splice(kel.idx[kel.idx.length - 1] + 1, 0, { g: head.g, rute: '', h20: '', h40: '', bnt: berikut ? BUNTUT[berikut] : '', ket: '', _baru: true }); return true;
    }
    return false;
  }
};

/* ---------- SEWA UNIT (lepas kunci, dengan driver). Uang jalan per rute dihapus (keputusan 21 Okt 2026). ---------- */
const kolUnit = () => [{ k: 'tipe', nama: 'Tipe', ph: 'CDD Long' }, { k: 'tahun', nama: 'Tahun', ph: '2022' }, { k: 'model', nama: 'Model', ph: 'Box' }, { k: 'tonase', nama: 'Tonase', ph: '4 ton' }, { k: 'kub', nama: 'Kubikasi', ph: '20 m³' }, { k: 'tarif', nama: 'Tarif sewa per bulan (Rp)', num: true }];
/* kolom driver tampil kecuali dipilih Sembunyikan; bila disembunyikan, add-on driver tidak masuk penawaran */
/* nama blok yang ditampilkan: bisa diubah di formulir (st.judulBlok); nama asli dipakai untuk katalog */
const judulTampil = (st, bi, b) => ((st && st.judulBlok) || {})[bi] || b.judul;
const SU_DRIVER = st => (st.opsi || {}).driverTampil !== 'tidak';
LINI.sewa_unit = {
  key: 'sewa_unit', mesin: 'tabel', liniKey: 'sewa_unit', galeri: 'GALERI UNIT', nama: 'Sewa Unit', judul: 'Penawaran Sewa Unit',
  saranJual: true, tarifMinimum: true,
  /* tarif minimum hanya untuk tarif sewa per bulan (bukan add-on driver); cocokkan tipe unit ke tarif vendor Sewa Unit di Master Rate */
  minSpek: (b, r, k) => k.k === 'tarif' && String(r.tipe || '').trim() ? { nama: r.tipe, dim: {} } : null,
  ket: 'Satu tabel per tipe unit. Kolom driver bisa ditampilkan atau disembunyikan di penawaran.',

  opsiAwal: { masa: '12 bulan', driverTampil: 'ya' },
  /* satu tabel untuk semua unit, dikelompokkan per tipe (sama dengan desain A) */
  bagian: [
    { judul: 'Sewa unit', kelompokTipe: true, kolom: [...kolUnit(), { k: 'driver', nama: 'Driver / orang / bulan (Rp)', num: true }, { k: 'jumlah', nama: 'Jumlah driver', ph: '1' }], baris: [{ tipe: 'CDD Long', tahun: '', model: '', tonase: '', kub: '', tarif: '', _baru: true }] },
  ],
  htmlAtas(st) { return `<div class="fl-grid2"><label class="fl-f"><span>Masa sewa</span>${inpTeks('opsi.masa', st.opsi.masa, '12 bulan', 'list="fl-dl-masa-su"')}${datalist('fl-dl-masa-su', ['1 bulan', '3 bulan', '6 bulan', '12 bulan'])}</label><label class="fl-f"><span>Kolom driver di penawaran</span>${pilihan('opsi.driverTampil', [['ya', 'Tampilkan'], ['tidak', 'Sembunyikan']], st.opsi.driverTampil || 'ya')}</label></div>`; },
  baris(st) {
    const out = [], nmU = r => [r.tipe, r.model, r.tahun].filter(Boolean).join(' ');
    (st.rows[0] || []).forEach(r => {
      const j = num(r.tarif), d = num(r.driver), n = num(r.jumlah) || 1;
      const sp = minSpek(this, null, r, { k: 'tarif' });
      if (j > 0) out.push({ item: `Sewa unit ${nmU(r)}`, satuan: 'per bulan', jual: j, modal: null, min: sp && minAktifCfg(this) ? tarifMinimum(this.liniKey, sp.nama, sp.dim) : null, bagian: r.tipe || 'Sewa unit' });
      if (SU_DRIVER(st) && j > 0 && d > 0) out.push({ item: `Driver add-on ${r.tipe || ''}`.trim(), satuan: 'per orang per bulan', qty: n, jual: d, modal: null, bagian: r.tipe || 'Sewa unit' });
    });
    return out;
  },
  dok(st) {
    const showDrv = SU_DRIVER(st), cat = [];
    const units = (st.rows[0] || []).filter(r => num(r.tarif) > 0);
    const adaDrv = showDrv && units.some(r => num(r.driver) > 0);
    const grup = [...new Set(units.map(r => r.tipe || '—'))], baris = [];
    grup.forEach(g => {
      const its = units.filter(r => (r.tipe || '—') === g);
      its.forEach((r, k) => {
        const c = [k === 0 ? { v: g, rs: its.length, b: true } : null, r.model || '—', [r.tahun, r.tonase].filter(Boolean).join(' / ') || '—', hargaSel(r.tarif)];
        if (adaDrv) c.push(num(r.driver) > 0 ? hargaSel(r.driver) : '—');
        baris.push({ c });
      });
    });
    const kolom = adaDrv
      ? [{ h: 'Tipe', w: 18, a: 'l' }, { h: 'Unit', w: 26, a: 'l' }, { h: 'Tahun / tonase', w: 16, a: 'l' }, { h: 'Sewa / bulan (Rp)', w: 20, a: 'r' }, { h: 'Driver / orang (Rp)', w: 20, a: 'r' }]
      : [{ h: 'Tipe', w: 22, a: 'l' }, { h: 'Unit', w: 30, a: 'l' }, { h: 'Tahun / tonase', w: 18, a: 'l' }, { h: 'Sewa / bulan (Rp)', w: 30, a: 'r' }];
    if (adaDrv) { const jml = [...new Set(units.filter(r => num(r.driver) > 0).map(r => String(r.jumlah || '').trim()).filter(Boolean))]; cat.push(`Jumlah driver ${jml.length ? jml.join(' atau ') + ' orang' : '(1 atau 2 orang)'} per unit. Tarif driver adalah tambahan di luar tarif sewa unit.`); }
    return { blok: baris.length ? [{ jenis: 'tabel', cap: 'Rincian Unit dan Tarif Sewa', kolom, baris }] : [], catatan: cat, info: st.opsi.masa ? [['Masa sewa', st.opsi.masa]] : [] };
  },
  varianDipakai(st) { const v = []; if ((st.rows[0] || []).some(r => num(r.tarif) > 0)) v.push('lepas'); if (SU_DRIVER(st) && (st.rows[0] || []).some(r => num(r.tarif) > 0 && num(r.driver) > 0)) v.push('driver'); return v; },
  tnc(st) { const sk = skTipeMaster('sewa_unit'), nm = { lepas: 'sewa unit lepas kunci', driver: 'sewa unit dengan driver' }; return this.varianDipakai(st).map(k => ({ judul: `Syarat dan ketentuan ${nm[k]}`, items: satuDua(sk[k]) })).filter(g => g.items.length); },
  cek(st) {
    const sk = skTipeMaster('sewa_unit'), nm = { lepas: 'lepas kunci', driver: 'dengan driver (jam kerja dan insentif driver)' };
    return { galat: this.baris(st).length ? [] : ['Isi minimal satu tarif sewa unit.'], peringatan: this.varianDipakai(st).filter(k => !satuDua(sk[k]).length).map(k => `S&K khusus sewa unit ${nm[k]} belum diisi di Master Rate > Lini Bisnis > Sewa Unit. Penawaran tetap bisa diterbitkan.`) };
  }
};

/* ============================ MESIN 2: PILIH LAYANAN (Customs Clearance, Gudang PLB) ============================ */
/* Grup tunggal untuk layanan yang diambil dari Template per lini bisnis (urutan template dipakai apa adanya). */
const TPL_GRUP = 'tpl-template';
MESIN.pilih = {
  /* Lini yang sudah punya template di Pengaturan dokumen memakai layanan dari template itu, bukan daftar bawaan. */
  tplAktif(cfg) { const T = window.ISLTemplate; return !!(cfg.liniKey && T && T.tersimpan(cfg.liniKey) && T.baris(cfg.liniKey).length); },
  grupAktif(cfg) { return this.tplAktif(cfg) ? [TPL_GRUP] : cfg.grup; },
  labelGrupTampil(cfg, g) { return g === TPL_GRUP ? 'Layanan dari template lini bisnis' : (cfg.labelGrup ? cfg.labelGrup(g) : g); },
  awal(cfg) {
    /* layanan dari template lini bisnis langsung terpilih; harga jual diisi di form */
    const pilih = {}; if (MESIN.pilih.tplAktif(cfg)) window.ISLTemplate.baris(cfg.liniKey).forEach((_, i) => { pilih['b' + i] = {}; });
    return { pilih, mk: cfg.markupAwal ?? 20, info: clone(cfg.infoAwal || {}) };
  },
  items(cfg, st) {
    const tpl = this.tplAktif(cfg);
    const base = tpl ? window.ISLTemplate.baris(cfg.liniKey).map((x, i) => ({ grup: TPL_GRUP, n: x.layananNama, berlaku: '', satuan: window.ISLTemplate.satuan(x.satuanKode), teks: null, modal: null, key: 'b' + i })) : cfg.layanan.map((l, i) => ({ ...l, key: 'b' + i }));
    const urut = tpl ? [] : (cfg.urut || []), posisi = n => { const i = urut.indexOf(n); return i < 0 ? urut.length : i; };
    const kat = katalogLini(cfg.key).map(k => ({ grup: tpl ? TPL_GRUP : (cfg.grup.includes(k.grup) ? k.grup : (cfg.grupLain || k.grup)), n: k.n, berlaku: k.berlaku, satuan: k.satuan, teks: k.teks || null, modal: ada(k.modal) ? Number(k.modal) : null, key: k.id, custom: true }));
    const out = [];
    /* mode template: item baku (tambahan per KG) tetap ada, di akhir daftar agar tampil setelah item lain di blok Airport */
    const bakuTpl = tpl ? cfg.layanan.map((l, i) => ({ ...l, key: 'bk' + i })).filter(l => l.baku && !base.some(x => ccGrupDari(x.n) === l.grup && /tambah|additional|extra/i.test(x.n))) : [];
    this.grupAktif(cfg).forEach(g => { base.filter(x => x.grup === g && !x.baku).sort((a, b) => posisi(a.n) - posisi(b.n)).forEach(x => out.push(x)); kat.filter(x => x.grup === g).forEach(x => out.push(x)); base.filter(x => x.grup === g && x.baku).sort((a, b) => posisi(a.n) - posisi(b.n)).forEach(x => out.push(x)); });
    out.push(...bakuTpl);
    /* blok disembunyikan berlaku ke kelompok tampil, bukan grup asal, agar form dan PDF sama */
    const grupCek = l => (cfg.kelompokUi && !tpl) ? this.grupEf(cfg, st, l) : l.grup;
    return st && st.off ? out.filter(l => !st.off[grupCek(l)]) : out;
  },
  teksBatas(st, s) { return String(s).replace('{PIB}', st.info.batasPib || '15').replace('{CBM}', st.info.batasCbm || '8').replace('{KG}', st.info.batasKg || '50'); },
  nama(cfg, st, l) { return this.teksBatas(st, l.n); },
  satuan(cfg, st, l) { return this.teksBatas(st, l.satuan || ''); },
  modal(cfg, st, l) { const c = st.pilih[l.key] || {}; if (c.modal !== undefined) return c.modal; const mr = cfg.liniKey ? modalMR(cfg.liniKey, l.n) : null; return ada(mr) ? mr : (ada(l.modal) ? l.modal : null); },
  /* Harga jual referensi (lini yang punya cfg.refJual, mis. Customs Clearance): angka bawaan dari tim, tampil transparan di kolom harga dan dipakai otomatis bila kolom dikosongkan.
     Item "tambahan" baku (tanpa kotak centang) hanya ikut bila ada layanan lain di kelompok yang sama yang dipilih. */
  refJual(cfg, st, l) {
    if (!cfg.refJual || l.teks) return null;
    const r = cfg.refJual(this.nama(cfg, st, l)); if (!ada(r)) return null;
    if (l.baku) { const g = this.grupEf(cfg, st, l); if (!this.items(cfg, st).some(x => !x.baku && st.pilih[x.key] && this.grupEf(cfg, st, x) === g)) return null; }
    return r;
  },
  /* layanan terpilih yang harga jualnya belum diisi dan akan memakai harga referensi (untuk pop-up peringatan) */
  itemReferensi(st, cfg) {
    return this.dipilih(cfg, st).filter(l => !ada((st.pilih[l.key] || {}).jual)).map(l => ({ nama: this.nama(cfg, st, l), harga: this.refJual(cfg, st, l) })).filter(x => ada(x.harga) && x.harga > 0);
  },
  jual(cfg, st, l) { const c = st.pilih[l.key] || {}; if (ada(c.jual)) return c.jual; const ref = this.refJual(cfg, st, l); if (ada(ref)) return ref; return rekomendasiJual(this.modal(cfg, st, l), cfg.liniKey, this.nama(cfg, st, l), cfg.saranJual ? saranMR(cfg.liniKey, l.n) : null); },
  /* kelompok tabel sebuah layanan: pilihan pengguna di formulir (kelompokCC), jika tidak ada dicocokkan dari namanya */
  grupEf(cfg, st, l) {
    if (!cfg.kelompokUi) return l.grup;
    const k = (st.kelompokCC || {})[l.key]; if (k) return k;
    if (cfg.kelompokUiGrup) {
      /* pakai l.grup asli jika sudah termasuk kelompok tampil (mis. gag/gar) */
      if (l.grup && l.grup !== 'tpl-template' && cfg.kelompokUiGrup.has(l.grup)) return l.grup;
      /* untuk item template biasa, deteksi dari nama; yang tidak masuk → lain */
      const g = ccGrupDari(this.nama(cfg, st, l));
      return cfg.kelompokUiGrup.has(g) ? g : CC_GRUP.lain;
    }
    return ccGrupDari(this.nama(cfg, st, l));
  },
  html(st, cfg, e) {
    const int = lihatInt(); let h = cfg.htmlAtas ? cfg.htmlAtas(st) : '';
    const items = this.items(cfg, st);
    /* kelompok CC tampil seluruh daftar contoh (urutan sama dengan tabel); nomor mengikuti kelompok yang berharga, sama dengan tabel */
    const grupTampil = cfg.kelompokUi ? CC_KELOMPOK_UI : this.grupAktif(cfg);
    const bernomor = cfg.kelompokUi ? CC_KELOMPOK_UI.filter(g => items.some(l => this.grupEf(cfg, st, l) === g && (this.jual(cfg, st, l) > 0 || l.teks))) : [];
    const labelH = g => cfg.kelompokUi ? (bernomor.includes(g) ? `${bernomor.indexOf(g) + 1}. ${g}` : g) : this.labelGrupTampil(cfg, g);
    grupTampil.filter(g => !(st.off && st.off[g])).forEach(g => {
      h += `<div class="fl-bagian fl-bagian--h">${cfg.kelompokUi ? headerKelompok(st, g, bernomor, this) : `${cfg.gantiNamaGrup && g !== TPL_GRUP ? `<span class="fl-grup-nama">${inpTeks(`namaGrup.${cfg.grup.indexOf(g)}`, (st.namaGrup || {})[cfg.grup.indexOf(g)] || labelH(g), labelH(g), 'class="fl-u" aria-label="Nama grup"')}</span>` : `<span>${esc(labelH(g))}</span>`}}${tombolHapusBlok(g, this)}`}</div>`;
      if (cfg.htmlGrupAtas) h += cfg.htmlGrupAtas(st, g);
      if (cfg.kelompokUi && !items.some(l => this.grupEf(cfg, st, l) === g)) h += '<div class="fl-mut" style="margin:0 0 10px">Belum ada layanan di kelompok ini. Pindahkan layanan lewat pilihan Kelompok di tabel.</div>';
      items.filter(l => this.grupEf(cfg, st, l) === g).forEach(l => {
        const on = !!st.pilih[l.key], c = st.pilih[l.key] || {}, m = this.modal(cfg, st, l), j = this.jual(cfg, st, l), mg = margin(j, m), rendah = mg !== null && mg < targetLini(cfg.liniKey);
        const saran = cfg.saranJual ? saranMR(cfg.liniKey, l.n) : null, kotakInt = int && !cfg.saranJual;
        const ref = this.refJual(cfg, st, l), pakaiRef = ref !== null && !ada(c.jual);
        const hintRef = ref !== null ? `<div class="fl-ref ${pakaiRef ? '' : 'is-ganti'}" data-flo ${pakaiRef ? '' : 'hidden'}>Harga referensi <b>${fmtRp(ref)}</b> dipakai otomatis karena kolom dikosongkan. Ketik angka untuk menggantinya.</div>` : '';
        if (l.baku) {
          const kHtml = cfg.kelompokUi ? '<div class="fl-f"><span>Kelompok di tabel</span>' + pilihan(`kelompokCC.${l.key}`, opsiKelompok(st), this.grupEf(cfg, st, l)) + '</div>' : '';
          const iHtml = int ? `<div data-flo ${mg === null ? 'hidden' : ''} class="fl-int ${rendah ? 'is-rendah' : ''}">Margin ${fmtPct(mg)} dari ${esc((cfg.labelModal || 'modal').toLowerCase())}${rendah ? ' (di bawah target lini)' : ''}</div>` : rekomendasiHtml(m, cfg.liniKey, this.nama(cfg, st, l));
          h += '<div class="fl-item fl-item--baku"><div class="fl-item__h"><span><b>' + esc(this.nama(cfg, st, l)) + '</b><small>' + esc(this.satuan(cfg, st, l)) + (l.berlaku ? ' · berlaku untuk ' + esc(l.berlaku) : '') + '</small></span></div>' + kHtml + '<div class="fl-harga fl-harga--satu"><label class="fl-kotak"><small>' + (ref !== null ? 'Harga jual' : 'Harga jual (kosong = tidak ditampilkan)') + '</small>' + inpAngka(`pilih.${l.key}.jual`, ref !== null ? (ada(c.jual) ? c.jual : null) : j, ref !== null ? fmt(ref) : 'kosong', ref !== null ? 'data-ghost="1"' : '') + '</label></div>' + hintRef + iHtml + '</div>';
          return;
        }
        h += `<div class="fl-item ${on ? 'is-on' : ''}"><div class="fl-item__h"><label class="fl-item__cek"><input type="checkbox" data-fla="pilih" data-flx="${esc(l.key)}" ${on ? 'checked' : ''} aria-label="Pilih ${esc(this.nama(cfg, st, l))}"><span><b>${esc(this.nama(cfg, st, l))}</b><small>${esc(this.satuan(cfg, st, l))}${l.berlaku ? ' · berlaku untuk ' + esc(l.berlaku) : ''}${l.teks ? ' · ' + esc(l.teks) : ''}</small>${ada(saran) ? `<small class="fl-saran">Rekomendasi harga jual: <b>${fmtRp(bulat1000(saran))}</b></small>` : ''}</span></label>${l.custom && katalogHapusBoleh() ? `<button type="button" class="fl-x" data-fla="kat-hapus" data-flx="${esc(l.key)}" aria-label="Hapus dari katalog" title="Hapus dari katalog">×</button>` : ''}</div>
          ${cfg.kelompokUi ? `<div class="fl-f"><span>Kelompok di tabel</span>${pilihan(`kelompokCC.${l.key}`, opsiKelompok(st), this.grupEf(cfg, st, l))}</div>` : ''}
          ${on ? `<div class="fl-harga ${kotakInt ? '' : 'fl-harga--satu'}">${kotakInt ? `<label class="fl-kotak"><small>${esc(cfg.labelModal || 'Modal')}</small>${inpAngka(`pilih.${l.key}.modal`, m, 'isi')}</label>` : ''}<label class="fl-kotak"><small>Harga jual</small>${inpAngka(`pilih.${l.key}.jual`, ref !== null ? (ada(c.jual) ? c.jual : null) : j, ref !== null ? fmt(ref) : (l.teks ? l.teks : 'isi'), ref !== null ? 'data-ghost="1"' : '')}</label></div>${hintRef}
          ${int ? `<div data-flo ${mg === null ? 'hidden' : ''} class="fl-int ${rendah ? 'is-rendah' : ''}">Margin ${fmtPct(mg)} dari ${esc((cfg.labelModal || 'modal').toLowerCase())}${rendah ? ' (di bawah target lini)' : ''}</div>` : rekomendasiHtml(m, cfg.liniKey, this.nama(cfg, st, l))}` : ''}</div>`;
      });
      h += (cfg.formTambah ? cfg.formTambah(st, cfg, g) : this.formTambah(st, cfg, g));
    });
    return h;
  },
  formTambah() { return ''; },
  katItem(cfg, grup, v) { if (!v.n) throw new Error('Nama layanan wajib diisi.'); return { grup, n: v.n, berlaku: v.berlaku || (cfg.adaBerlaku ? 'Impor & ekspor' : ''), satuan: v.satuan || 'per dokumen', teks: v.teks || null, modal: num(v.modal), label: v.n }; },
  aksi(a, x, st) { if (a === 'pilih') { if (st.pilih[x]) delete st.pilih[x]; else st.pilih[x] = {}; return true; } return false; },
  ubah(path, st) { const m = /^pilih\.([^.]+)\.(modal|mk)$/.exec(path); if (m && st.pilih[m[1]]) delete st.pilih[m[1]].jual; if (path === 'mk') Object.values(st.pilih).forEach(c => { delete c.mk; delete c.jual; }); },
  hapusKatalog(st, cfg, id) { delete st.pilih[id]; },
  dipilih(cfg, st) { return this.items(cfg, st).filter(l => l.baku ? (Number(this.jual(cfg, st, l)) > 0) : !!st.pilih[l.key]); },
  labelBlok(cfg, g) { return this.grupAktif(cfg).includes(g) ? this.labelGrupTampil(cfg, g) : null; },
  baris(st, cfg) { return this.dipilih(cfg, st).map(l => ({ l, j: this.jual(cfg, st, l) })).filter(x => ada(x.j) && x.j > 0).map(({ l, j }) => ({ item: this.nama(cfg, st, l), satuan: this.satuan(cfg, st, l), jual: j, modal: this.modal(cfg, st, l), desk: l.berlaku || '', bagian: l.grup === TPL_GRUP ? '' : tanpaHuruf(l.grup) })); },
  cek(st, cfg) { return { galat: this.baris(st, cfg).length ? [] : ['Pilih layanan dan isi harga jual minimal satu.'], peringatan: [] }; }
};
const P = MESIN.pilih;

/* grup mengikuti contoh quotation Customs Clearance (nomor 1-14), sisanya di "Lainnya" paling bawah */
const CC_GRUP = { gl: 'Green Line Container Handling', gr: 'Red Line Container Handling', gag: 'Airport Handling – Green Line', gar: 'Airport Handling – Red Line', fum: 'Fumigasi', fumx: 'Handling Fumigasi', pib: 'PIB / PEB', kar: 'Karantina hewan/tumbuhan', cooe: 'COO Elektronik', cook: 'COO Konvensional', pick: 'Pick Up / Delivery Document', ext: 'Extend Eksport', book: 'Submit SI', fee: 'Fee Administrasi', lain: 'Lainnya' };
const CC_CONTOH = ['gl', 'gr', 'gag', 'gar', 'fum', 'fumx', 'pib', 'kar', 'cooe', 'cook', 'pick', 'ext', 'book', 'fee'].map(k => CC_GRUP[k]);
/* kelompok tampil di formulir CC: hanya 6 blok utama; sisanya masuk "Lainnya" */
const CC_KELOMPOK_UI = [CC_GRUP.gl, CC_GRUP.gr, CC_GRUP.gag, CC_GRUP.gar, CC_GRUP.pib, CC_GRUP.lain];
const CC_KELOMPOK_UI_SET = new Set(CC_KELOMPOK_UI);
/* Nama blok yang bisa diubah pengguna lewat ikon pensil di formulir CC. Disimpan di st.namaBlokCC[kunci pendek] dan menggantikan judul blok yang sepadan di pratinjau dan PDF. */
const IKON_PENSIL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const IKON_CEK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const namaBlokCC = (st, g) => { const k = CC_GRUP_KEY[g]; return k ? String(((st && st.namaBlokCC) || {})[k] || '').trim() : ''; };
const opsiKelompok = st => CC_KELOMPOK_UI.map(g => [g, namaBlokCC(st, g) || g]);
function headerKelompok(st, g, bernomor, M) {
  const kk = CC_GRUP_KEY[g], nama = namaBlokCC(st, g), no = bernomor.includes(g) ? `${bernomor.indexOf(g) + 1}. ` : '', ubah = UI.ubahBlok === g, ed = bisaEdit();
  const judul = ubah
    ? `<span class="fl-grup-nama">${no ? `<span class="fl-grup-no">${esc(no)}</span>` : ''}${inpTeks(`namaBlokCC.${kk}`, nama || g, g, 'class="fl-u" aria-label="Nama blok" data-flblok="1"')}</span>`
    : `<span>${esc(no + (nama || g))}${nama ? ' <small class="fl-mut">· nama diubah</small>' : ''}</span>`;
  const aksi = !ed ? '' : ubah
    ? `${nama ? `<button type="button" class="fl-x fl-x--teks" data-fla="blok-reset" data-flx="${esc(g)}" title="Kembalikan ke nama asli">Nama asli</button>` : ''}<button type="button" class="fl-ikon" data-fla="blok-selesai" data-flx="${esc(g)}" aria-label="Selesai mengubah nama blok" title="Selesai (Enter)">${IKON_CEK}</button>`
    : `<button type="button" class="fl-ikon" data-fla="blok-ubah" data-flx="${esc(g)}" aria-label="Ubah nama blok ${esc(nama || g)}" title="Ubah nama blok: tampil di pratinjau dan PDF">${IKON_PENSIL}</button>`;
  return `${judul}<span class="fl-bagian__aksi">${aksi}${tombolHapusBlok(g, M)}</span>`;
}
/* nama grup → kunci pendek (kebalikan CC_GRUP) */
const CC_GRUP_KEY = Object.fromEntries(Object.entries(CC_GRUP).map(([k, v]) => [v, k]));
/* Kelompok PDF 021 untuk layanan dari template (dicocokkan dari namanya). Yang tidak cocok masuk "Lainnya". */
const CC_POLA = [
  [/extra moving fumigasi|handling fumigasi/i, 'fumx'], [/fumigasi/i, 'fum'],
  [/airport.*green|green.*airport/i, 'gag'], [/airport.*red|red.*airport/i, 'gar'],
  [/\bgreen\b.*kgs?\b|kgs?\b.*\bgreen\b/i, 'gag'], [/\bred\b.*kgs?\b|kgs?\b.*\bred\b/i, 'gar'],
  [/green line/i, 'gl'], [/red line/i, 'gr'],
  [/pib|peb/i, 'pib'], [/karantina/i, 'kar'],
  [/coo.*elektronik/i, 'cooe'], [/coo.*konvensional/i, 'cook'],
  [/pick ?up|delivery/i, 'pick'], [/extend/i, 'ext'], [/booking|submit si/i, 'book'], [/fee admin/i, 'fee'],
];
/* layanan template Gudang PLB dikelompokkan ke grup A, C, D, atau F menurut namanya */
const plbGrupDari = nama => /storage/i.test(nama) ? 'D. Storage' : /overtime|sewa/i.test(nama) ? 'F. Lainnya' : /handling|lolo|e-?seal|stuffing|stripping/i.test(nama) ? 'C. Handling' : /bc|pib|peb|customs|dokumen/i.test(nama) ? 'A. Customs clearance (pelabuhan)' : 'F. Lainnya';
/* HARGA JUAL REFERENSI Customs Clearance (disebutkan tim, 3 Nov 2026). Master Rate tidak punya modal untuk CC, jadi harga jual diisi dari tabel ini.
   Dicocokkan dari NAMA layanan (bukan urutan), sehingga berlaku untuk layanan bawaan form maupun layanan dari template Master Rate. g = Green Line, r = Red Line.
   fcl20/fcl40 = kontainer pertama; ...t = tambahan; lcl = LCL pertama (di bawah batas CBM); lclt = tambahan per CBM; air = Airport 50 KG pertama; airt = tambahan per KG. */
const CC_REF = {
  g: { fcl20: 300000, fcl20t: 100000, fcl40: 350000, fcl40t: 150000, lcl: 800000, lclt: 250000, air: 800000, airt: 8000 },
  r: { fcl20: 800000, fcl20t: 600000, fcl40: 1000000, fcl40t: 800000, lcl: 1500000, lclt: 500000, air: 1500000, airt: 10000 }
};
function refJualCC(nama) {
  const n = String(nama || '').toLowerCase(), tambah = /tambah|additional|extra/.test(n);
  const jalur = /\bgreen\b/.test(n) ? 'g' : /\bred\b/.test(n) ? 'r' : '';
  if (jalur) {
    const T = CC_REF[jalur];
    if (/kgs?\b|airport/.test(n)) return tambah ? T.airt : T.air;
    if (/\blcl\b|\bcbm\b|\bm3\b/.test(n)) return tambah ? T.lclt : T.lcl;
    const uk = /(^|\D)20\s*(ft|'|feet)?(\D|$)/.test(n) ? '20' : /(^|\D)40\s*(ft|'|feet)?(\D|$)/.test(n) ? '40' : '';
    return uk ? T['fcl' + uk + (tambah ? 't' : '')] : null;  /* tambahan tanpa ukuran: tidak ada referensi */
  }
  if (/pib|peb/.test(n)) return tambah ? 5000 : 250000;
  if (/coo/.test(n)) return /elektronik/.test(n) ? 250000 : /konv/.test(n) ? 350000 : null;
  if (/karantina/.test(n)) return 800000;
  if (/pick ?up|delivery/.test(n)) return 150000;
  if (/fee admin/.test(n)) return 100000;
  if (/extend/.test(n)) return 350000;
  if (/booking|submit si/.test(n)) return 150000;
  return null;
}
const ccGrupDari = nama => { const n = String(nama || ''), hit = CC_POLA.find(([re]) => re.test(n)); return hit ? CC_GRUP[hit[1]] : CC_GRUP.lain; };

LINI.customs_clearance = {
  key: 'customs_clearance', mesin: 'pilih', liniKey: 'customs_clearance', kelompokUi: true, kelompokUiGrup: CC_KELOMPOK_UI_SET, nama: 'Customs Clearance', judul: 'Penawaran Jasa Customs Clearance',
  ket: 'Dokumen, laut, udara, at cost. Biaya operasional internal sebagai dasar margin. Kontrak, Rupiah.',
  labelModal: 'Biaya operasional (internal)', adaBerlaku: true, adaTeks: true,
  infoAwal: { port: 'Tanjung Priok, Jakarta', batasPib: 15, batasCbm: 8, batasKg: 50 },
  refJual: refJualCC,
  grup: [...CC_CONTOH, CC_GRUP.lain],
  grupLain: CC_GRUP.lain,
  saranJual: true,
  labelGrup: g => CC_KELOMPOK_UI_SET.has(g) ? g : CC_GRUP.lain,
  urut: ['Green line 20ft', 'Green line, kontainer tambahan', 'Green line 40ft', 'Green line LCL, di bawah {CBM} CBM', 'Green line LCL, tambahan per CBM', 'Red line 20ft', 'Red line, kontainer tambahan', 'Red line 40ft', 'Red line LCL, di bawah {CBM} CBM', 'Red line LCL, tambahan per CBM', 'Green line, {KG} KG pertama', 'Airport Handling – Green Line, tambahan per KG', 'Red line, {KG} KG pertama', 'Airport Handling – Red Line, tambahan per KG', 'Fumigasi', 'Extra Moving Fumigasi', 'PIB/PEB, di bawah {PIB} item', 'PIB/PEB, tambahan per item', 'Karantina hewan/tumbuhan', 'COO elektronik', 'COO konversional', 'Pick Up / Delivery Document', 'Extend Eksport', 'Booking Kapal', 'Fee Administrasi'],
  layanan: [
    [CC_GRUP.pib, 'PIB/PEB, di bawah {PIB} item', 'Impor & ekspor', 'per dokumen'], [CC_GRUP.pib, 'PIB/PEB, tambahan per item', 'Impor & ekspor', 'per item'], [CC_GRUP.lain, 'Adm doc charge', 'Impor & ekspor', 'per dokumen'], [CC_GRUP.lain, 'Document handling', 'Impor & ekspor', 'per set'], [CC_GRUP.cooe, 'COO elektronik', 'Impor & ekspor', 'per dokumen'], [CC_GRUP.cook, 'COO konversional', 'Impor & ekspor', 'per dokumen'],
    [CC_GRUP.gl, 'Green line 20ft', 'Impor & ekspor', 'per kontainer'], [CC_GRUP.gl, 'Green line 40ft', 'Impor & ekspor', 'per kontainer'], [CC_GRUP.gl, 'Green line, kontainer tambahan', 'Impor & ekspor', 'per kontainer'], [CC_GRUP.gl, 'Green line LCL, di bawah {CBM} CBM', 'Impor & ekspor', 'per shipment'], [CC_GRUP.gl, 'Green line LCL, tambahan per CBM', 'Impor & ekspor', 'per CBM'],
    [CC_GRUP.gr, 'Red line 20ft', 'Impor', 'per kontainer'], [CC_GRUP.gr, 'Red line 40ft', 'Impor', 'per kontainer'], [CC_GRUP.gr, 'Red line, kontainer tambahan', 'Impor', 'per kontainer'], [CC_GRUP.gr, 'Red line LCL, di bawah {CBM} CBM', 'Impor', 'per shipment'], [CC_GRUP.gr, 'Red line LCL, tambahan per CBM', 'Impor', 'per CBM'],
    [CC_GRUP.lain, 'BPOM (jasa)', 'Impor', 'per kontainer'], [CC_GRUP.lain, 'SSM quarantine', 'Impor & ekspor', 'per kontainer'], [CC_GRUP.lain, 'Sticker DG', 'Ekspor', 'per barang'], [CC_GRUP.lain, 'Syahbandar', 'Ekspor', 'per kontainer'],
    [CC_GRUP.gag, 'Green line, {KG} KG pertama', 'Impor & ekspor', 'per {KG} KG'], [CC_GRUP.gag, 'Airport Handling – Green Line, tambahan per KG', 'Impor & ekspor', 'per KG', null, true], [CC_GRUP.gar, 'Red line, {KG} KG pertama', 'Impor', 'per {KG} KG'], [CC_GRUP.gar, 'Airport Handling – Red Line, tambahan per KG', 'Impor', 'per KG', null, true],
    [CC_GRUP.lain, 'Lift on, lift off, storage', 'Impor & ekspor', 'per kontainer', 'At cost'], [CC_GRUP.lain, 'Marine insurance premium', 'Impor & ekspor', 'invoice value', 'Jika diperlukan, at cost'], [CC_GRUP.lain, 'Lainnya', 'Impor & ekspor', 'kasus per kasus', 'At cost'],
    [CC_GRUP.fum, 'Fumigasi', 'Impor & ekspor', 'per container'], [CC_GRUP.fumx, 'Extra Moving Fumigasi', 'Impor & ekspor', 'per container'], [CC_GRUP.kar, 'Karantina hewan/tumbuhan', 'Impor & ekspor', 'per container'], [CC_GRUP.pick, 'Pick Up / Delivery Document', 'Impor & ekspor', 'per delivery'], [CC_GRUP.ext, 'Extend Eksport', 'Ekspor', 'per shipment'], [CC_GRUP.book, 'Booking Kapal', 'Impor & ekspor', 'per shipment'], [CC_GRUP.fee, 'Fee Administrasi', 'Impor & ekspor', 'per invoice']
  ].map(([grup, n, berlaku, satuan, teks, baku]) => ({ grup, n, berlaku, satuan, teks: teks || null, modal: null, baku: baku || false })),
  htmlAtas(st) {
    return `<div class="fl-grid2"><label class="fl-f"><span>Port berlaku</span>${inpTeks('info.port', st.info.port, 'Tanjung Priok, Jakarta', 'list="fl-dl-port"')}${datalist('fl-dl-port', ['Tanjung Priok, Jakarta', 'Patimban, Subang', 'Tanjung Perak, Surabaya'])}</label><label class="fl-f"><span>Batas LCL (CBM)</span>${inpAngka('info.batasCbm', st.info.batasCbm, '8')}</label><label class="fl-f"><span>Batas Airport (KG)</span>${inpAngka('info.batasKg', st.info.batasKg, '50')}</label><label class="fl-f"><span>Batas PIB (jumlah item)</span>${inpAngka('info.batasPib', st.info.batasPib, '10')}</label></div>`;
  },
  baris(st) { return P.baris(st, this); },
  dok(st) {
    /* Desain 3: dikelompokkan per jalur (GREEN LINE / RED LINE), lalu PIB/PEB dan Layanan Tambahan */
    const items = P.dipilih(this, st);
    const nm  = l => P.nama(this, st, l);
    const hr  = l => { const j = P.jual(this, st, l); return j > 0 ? angkaDok(j) : (l.teks || ''); };
    const ok  = l => { const j = P.jual(this, st, l); return j > 0 || l.teks; };
    /* grp: pakai l.grup langsung jika bukan item template (TPL_GRUP) dan bukan 'lain',
       sehingga item airport ("Green line, 50 KG pertama") tidak salah masuk ke grup gl */
    const grp = l => {
      const ov = (st.kelompokCC || {})[l.key]; if (ov) return ov;
      if (l.grup && l.grup !== 'tpl-template' && l.grup !== CC_GRUP.lain) return l.grup;
      return ccGrupDari(nm(l));
    };
    const its = (...ks) => ks.flatMap(k => items.filter(l => grp(l) === CC_GRUP[k]).filter(ok));
    /* nama blok yang diubah di formulir (ikon pensil) menggantikan judul blok yang sepadan; tanpa perubahan, judul bawaan dipakai */
    const namaB = k => namaBlokCC(st, CC_GRUP[k]);
    const jalurB = (k, asal, asalEn) => { const n = namaB(k); return n ? { teks: n, teksEn: n } : { teks: asal, teksEn: asalEn }; };
    const capB = (k, asal, asalEn) => { const n = namaB(k); return n ? { cap: n, hEn: n } : (asalEn ? { cap: asal, hEn: asalEn } : { cap: asal }); };

    const reAdd = /tambahan|additional/i;
    const re20  = /\b20/i;
    const re40  = /\b40/i;
    const reLcl = /\blcl\b/i;

    /* builder tabel FCL: pasangkan item 20ft ↔ 40ft dalam satu baris */
    const barisF = (list) => {
      const baris = [];
      const main20 = list.filter(l => re20.test(nm(l)) && !reAdd.test(nm(l)));
      const main40 = list.filter(l => re40.test(nm(l)) && !reAdd.test(nm(l)));
      const add20  = list.filter(l => reAdd.test(nm(l)) && re20.test(nm(l)));
      const add40  = list.filter(l => reAdd.test(nm(l)) && re40.test(nm(l)));
      const addAny = list.filter(l => reAdd.test(nm(l)) && !re20.test(nm(l)) && !re40.test(nm(l)));
      let no = 0;
      for (let i = 0; i < Math.max(main20.length, main40.length, 1); i++) {
        const l20 = main20[i], l40 = main40[i];
        if (!l20 && !l40) break;
        const a20 = add20[i], a40 = add40[i], aAny = addAny[i];
        const hasAdd = !!(a20 || a40 || aAny);
        const baseNm = nm(l20 || l40).replace(/,?\s*(20|40)\s*ft\b/gi, '').replace(/\s+/g, ' ').trim();
        const sat = (l20 || l40).satuan;
        baris.push({ c: [{ v: String(++no), rs: hasAdd ? 2 : 1 }, { v: baseNm, b: true }, l20 ? hr(l20) : '—', l40 ? hr(l40) : '—', sat] });
        if (hasAdd) {
          const la = a20 || a40 || aAny;
          const addNm = nm(la).replace(/,?\s*(20|40)\s*ft\b/gi, '').replace(/\s+/g, ' ').trim();
          const h20 = a20 ? hr(a20) : (aAny ? hr(aAny) : '—');
          const h40 = a40 ? hr(a40) : (aAny ? hr(aAny) : '—');
          baris.push({ c: [null, { v: addNm, ind: true }, h20, h40, sat] });
        }
      }
      return baris;
    };

    /* builder tabel harga tunggal: main + sub-baris tambahan di bawahnya */
    const barisS = (list) => {
      const baris = [];
      const groups = [];
      list.forEach(l => {
        if (reAdd.test(nm(l)) && groups.length) groups[groups.length - 1].adds.push(l);
        else groups.push({ main: l, adds: [] });  /* "Additional" tanpa layanan utama tetap tampil sebagai barisnya sendiri */
      });
      let no = 0;
      groups.forEach(({ main, adds }) => {
        const rs = 1 + adds.length;
        baris.push({ c: [{ v: String(++no), rs }, { v: nm(main), b: true }, hr(main), main.satuan] });
        adds.forEach(add => baris.push({ c: [null, { v: nm(add), ind: true }, hr(add), add.satuan] }));
      });
      return baris;
    };

    const kolFcl = [
      { h: 'No', hEn: 'NO', w: 6, a: 'c' },
      { h: 'Layanan', hEn: 'SERVICES', w: 36, a: 'l' },
      { h: '20 FT (Rp)', hEn: '20 FT (IDR)', w: 19, a: 'r' },
      { h: '40 FT (Rp)', hEn: '40 FT (IDR)', w: 19, a: 'r' },
      { h: 'Satuan', hEn: 'UOM', w: 20, a: 'c' }
    ];
    const kolS = [
      { h: 'No', hEn: 'NO', w: 6, a: 'c' },
      { h: 'Layanan', hEn: 'SERVICES', w: 48, a: 'l' },
      { h: 'Harga (Rp)', hEn: 'PRICE (IDR)', w: 26, a: 'r' },
      { h: 'Satuan', hEn: 'UOM', w: 20, a: 'c' }
    ];

    /* Desain 3: tanpa kolom No/Satuan, satuan ditulis kecil di bawah harga */
    const kolFcl3 = [
      { h: 'FCL — Full Container Load', hEn: 'FCL — Full Container Load', w: 48, a: 'l' },
      { h: '20 FT', hEn: '20 FT', w: 26, a: 'r' },
      { h: '40 FT', hEn: '40 FT', w: 26, a: 'r' }
    ];
    const kolS3 = [
      { h: '', w: 72, a: 'l' },
      { h: '', w: 28, a: 'r' }
    ];
    /* Desain C "Kartu ringan" untuk CC (4 Nov 2026): satuan kecil di bawah nama layanan, awalan Rp di sel harga, judul kartu ada di baris kepala kartu */
    const hrk = l => { const j = P.jual(this, st, l); return j > 0 ? { v: angkaDok(j), rp: true } : { v: l.teks || '—' }; };
    const barisF3 = (list) => {
      const baris = [];
      const main20 = list.filter(l => re20.test(nm(l)) && !reAdd.test(nm(l)));
      const main40 = list.filter(l => re40.test(nm(l)) && !reAdd.test(nm(l)));
      const add20  = list.filter(l => reAdd.test(nm(l)) && re20.test(nm(l)));
      const add40  = list.filter(l => reAdd.test(nm(l)) && re40.test(nm(l)));
      const addAny = list.filter(l => reAdd.test(nm(l)) && !re20.test(nm(l)) && !re40.test(nm(l)));
      /* nama tanpa ukuran dan tanpa tanda "–" yang tertinggal ("Green Line Container Handling – 20 ft" -> "Green Line Container Handling") */
      const polos = x => nm(x).replace(/,?\s*(20|40)\s*ft\b/gi, '').replace(/\s+/g, ' ').replace(/\s*[–—-]\s*$/, '').trim();
      const sel = l => l ? hrk(l) : { v: '—' };
      const n = Math.max(main20.length, main40.length, add20.length, add40.length, addAny.length);
      for (let i = 0; i < n; i++) {
        const l20 = main20[i], l40 = main40[i], a20 = add20[i], a40 = add40[i], aAny = addAny[i], ada2 = !!(a20 || a40 || aAny);
        if (l20 || l40) {
          baris.push({ c: [{ v: polos(l20 || l40), b: true, sat: (l20 || l40).satuan }, sel(l20), sel(l40)] });
          if (ada2) { const la = a20 || a40 || aAny; baris.push({ c: [{ v: polos(la), b: true, sat: la.satuan }, sel(a20 || aAny), sel(a40 || aAny)] }); }
        } else if (ada2) {
          /* "Additional" tanpa layanan utama: tampil sebagai barisnya sendiri (sebelumnya hilang dari PDF) */
          const la = a20 || a40 || aAny;
          baris.push({ c: [{ v: polos(la), b: true, sat: la.satuan }, sel(a20 || aAny), sel(a40 || aAny)] });
        }
      }
      return baris;
    };
    const barisS3 = (list) => list.map(l => ({ c: [{ v: nm(l), b: true, sat: P.satuan(this, st, l) }, hrk(l)] }));
    const manualK = it => ({ c: [{ v: it.nama, b: true, sat: it.satuan }, it.harga > 0 ? { v: angkaDok(it.harga), rp: true } : { v: '—' }] });
    const barisS3tm = (list, gk) => [...barisS3(list), ...tm(gk).map(manualK)];
    /* kepala kartu: judul di kolom pertama, lalu "Tarif" (satu harga); kartu FCL memakai 20 FT dan 40 FT */
    const kolK = (h, hEn) => [{ h, hEn: hEn || h, w: 72, a: 'l' }, { h: 'Tarif', hEn: 'Price', w: 28, a: 'r' }];
    const KRT = 'isl-kartu isl-kartu--cc';

    const blok = [];

    /* helper: item manual dari st.tambahanCC */
    const tm = gk => (st.off && st.off[CC_GRUP[gk]]) ? [] : ((st.tambahanCC || {})[gk] || []);
    /* append baris manual ke rows barisS (lanjutkan nomor urut) */
    const barisSTm = (list, gk) => {
      const rows = barisS(list);
      const extra = tm(gk);
      if (!extra.length) return rows;
      let no = rows.filter(r => r.c[0] !== null).length;
      extra.forEach(it => rows.push({ c: [{ v: String(++no) }, { v: it.nama, b: true }, it.harga > 0 ? angkaDok(it.harga) : '', it.satuan] }));
      return rows;
    };

    /* ---- GREEN LINE ---- */
    const glFcl = its('gl').filter(l => !reLcl.test(nm(l)));
    const glLcl = its('gl').filter(l => reLcl.test(nm(l)));
    const glAir = its('gag');
    const glManual = tm('gl'), gagManual = tm('gag');
    if (glFcl.length || glLcl.length || glAir.length || glManual.length || gagManual.length) {
      blok.push({ jenis: 'jalur', kartu: true, warna: 'hijau', ...jalurB('gl', 'Green Line — Jalur Hijau', 'Green Line') });
      if (glFcl.length) blok.push({ jenis: 'tabel', kolom: kolFcl3, baris: barisF3(glFcl), kelas: KRT });
      if (glLcl.length) blok.push({ jenis: 'tabel', kolom: kolK('LCL — Less Container Load', 'LCL'), baris: barisS3(glLcl), kelas: KRT });
      if (glAir.length || gagManual.length) { const c = capB('gag', 'Airport Handling'); blok.push({ jenis: 'tabel', kolom: kolK(c.cap, c.hEn), baris: barisS3tm(glAir, 'gag'), kelas: KRT }); }
      if (glManual.length) blok.push({ jenis: 'tabel', kolom: kolK('Layanan Tambahan Green Line', 'Additional – Green Line'), baris: glManual.map(manualK), kelas: KRT });
    }

    /* ---- RED LINE ---- */
    const grFcl = its('gr').filter(l => !reLcl.test(nm(l)));
    const grLcl = its('gr').filter(l => reLcl.test(nm(l)));
    const grAir = its('gar');
    const grManual = tm('gr'), garManual = tm('gar');
    if (grFcl.length || grLcl.length || grAir.length || grManual.length || garManual.length) {
      blok.push({ jenis: 'jalur', kartu: true, warna: 'merah', ...jalurB('gr', 'Red Line — Jalur Merah', 'Red Line') });
      if (grFcl.length) blok.push({ jenis: 'tabel', kolom: kolFcl3, baris: barisF3(grFcl), kelas: KRT });
      if (grLcl.length) blok.push({ jenis: 'tabel', kolom: kolK('LCL — Less Container Load', 'LCL'), baris: barisS3(grLcl), kelas: KRT });
      if (grAir.length || garManual.length) { const c = capB('gar', 'Airport Handling'); blok.push({ jenis: 'tabel', kolom: kolK(c.cap, c.hEn), baris: barisS3tm(grAir, 'gar'), kelas: KRT }); }
      if (grManual.length) blok.push({ jenis: 'tabel', kolom: kolK('Layanan Tambahan Red Line', 'Additional – Red Line'), baris: grManual.map(manualK), kelas: KRT });
    }

    /* ---- PIB / PEB: pita biru ---- */
    const pibIts = its('pib');
    const pibManual = tm('pib');
    if (pibIts.length || pibManual.length) {
      const c = capB('pib', 'PIB / PEB');
      blok.push({ jenis: 'jalur', kartu: true, warna: 'biru', teks: c.cap, teksEn: c.hEn || c.cap });
      blok.push({ jenis: 'tabel', kolom: kolK('Layanan', 'Services'), baris: barisS3tm(pibIts, 'pib'), kelas: KRT });
    }

    /* ---- LAYANAN TAMBAHAN: pita oranye ---- */
    const otherGk = ['kar', 'cooe', 'cook', 'pick', 'ext', 'book', 'fee', 'fum', 'fumx'];
    const otherIts = its('kar', 'cooe', 'cook', 'pick', 'ext', 'book', 'fee', 'fum', 'fumx', 'lain');
    const otherManual = [...otherGk.flatMap(k => tm(k).map(it => ({ ...it, _gk: k }))), ...tm('lain')];
    if (otherIts.length || otherManual.length) {
      const c = capB('lain', 'Layanan Tambahan', 'Additional Services');
      blok.push({ jenis: 'jalur', kartu: true, warna: 'oranye', teks: c.cap, teksEn: c.hEn || c.cap });
      blok.push({ jenis: 'tabel', kolom: kolK('Layanan', 'Services'), baris: [...barisS3(otherIts), ...otherManual.map(manualK)], kelas: KRT });
    }

    return { blok, info: [['Port', st.info.port]].filter(x => x[1]), catatan: [] };
  },
  formTambah(st, cfg, g) {
    const gk = CC_GRUP_KEY[g];
    if (!gk) return '';
    const items = (st.tambahanCC || {})[gk] || [];
    let h = '';
    if (items.length) {
      h += '<div class="fl-tb-list">';
      items.forEach((it, i) => {
        h += `<div class="fl-tb-item"><div class="fl-tb-item__info"><b>${esc(it.nama)}</b><small>${esc(it.satuan)}</small></div>`;
        h += `<label class="fl-kotak fl-tb-item__harga"><small>Harga jual</small>${inpAngka(`tambahanCC.${esc(gk)}.${i}.harga`, it.harga, 'isi')}</label>`;
        h += `<button type="button" class="fl-x" data-fla="cc-tb-hapus" data-flx="${esc(gk)}|${esc(it.id)}" title="Hapus">×</button></div>`;
      });
      h += '</div>';
    }
    if (UI.ccTambah === gk) {
      h += `<div class="fl-tb-form" data-flcctb="${esc(gk)}">
        <label class="fl-f"><span>Nama layanan</span><input data-cctb="nama" placeholder="Nama layanan baru" autocomplete="off"></label>
        <div class="fl-grid2">
          <label class="fl-f"><span>Harga jual (Rp)</span><input data-cctb="harga" data-fn="1" inputmode="decimal" placeholder="0" autocomplete="off"></label>
          <label class="fl-f"><span>Satuan</span><input data-cctb="satuan" placeholder="per KG" autocomplete="off" value="per shipment"></label>
        </div>
        <div class="fl-baris-tombol">
          <button type="button" class="mr-btn mr-btn--utama mr-btn--kecil" data-fla="cc-tb-simpan" data-flx="${esc(gk)}">+ Tambah ke penawaran</button>
          <button type="button" class="mr-btn mr-btn--kecil" data-fla="cc-tb-tutup">Batal</button>
        </div></div>`;
    } else {
      h += `<button type="button" class="fl-tambah fl-tambah--kecil" data-fla="cc-tb-buka" data-flx="${esc(gk)}">+ Tambah Layanan Manual</button>`;
    }
    return h;
  },
  aksiKhusus(a, x, st) {
    if (a === 'blok-ubah') { UI.ubahBlok = String(x); setTimeout(() => { const i = document.querySelector('[data-flblok]'); if (i) { i.focus(); i.select(); } }, 0); return true; }
    if (a === 'blok-selesai') { UI.ubahBlok = null; return true; }
    if (a === 'blok-reset') { const k = CC_GRUP_KEY[String(x)]; if (st.namaBlokCC && k) delete st.namaBlokCC[k]; UI.ubahBlok = null; return true; }
    if (a === 'cc-tb-buka') { UI.ccTambah = String(x); return true; }
    if (a === 'cc-tb-tutup') { UI.ccTambah = null; return true; }
    if (a === 'cc-tb-hapus') {
      const [gk, id] = String(x).split('|');
      if (st.tambahanCC && st.tambahanCC[gk]) {
        st.tambahanCC[gk] = st.tambahanCC[gk].filter(it => it.id !== id);
        if (!st.tambahanCC[gk].length) delete st.tambahanCC[gk];
      }
      return true;
    }
    if (a === 'cc-tb-simpan') {
      const gk = String(x);
      const form = document.querySelector(`[data-flcctb="${CSS.escape(gk)}"]`);
      const nama = (form && form.querySelector('[data-cctb="nama"]') || {}).value || '';
      const harga = num((form && form.querySelector('[data-cctb="harga"]') || {}).value) || 0;
      const satuan = ((form && form.querySelector('[data-cctb="satuan"]') || {}).value || 'per shipment').trim() || 'per shipment';
      if (!nama.trim()) return false;
      if (!st.tambahanCC) st.tambahanCC = {};
      if (!st.tambahanCC[gk]) st.tambahanCC[gk] = [];
      st.tambahanCC[gk].push({ id: uidF('tc'), nama: nama.trim(), harga, satuan });
      UI.ccTambah = null;
      return true;
    }
    return false;
  },
  cek(st) { return P.cek(st, this); }
};
LINI.gudang_plb = {
  key: 'gudang_plb', mesin: 'pilih', liniKey: 'gudang_plb', gantiNamaGrup: true, galeri: 'GALERI GUDANG PLB', nama: 'Gudang PLB', judul: 'Penawaran Jasa Gudang PLB',
  ket: 'Tabel universal bertingkat: customs clearance, handling, storage, lainnya. Modal dari mitra PLB.',

  labelModal: 'Modal (mitra)', infoAwal: { luas: '', masaBulan: '12' },
  grup: ['A. Customs clearance (pelabuhan)', 'C. Handling', 'D. Storage', 'F. Lainnya'],
  layanan: [['A', 'BC 1.6 (per dokumen, per BL)', 'per dokumen'], ['A', 'BC 2.7 (per dokumen, per BL)', 'per dokumen'], ['C', 'LOLO 20ft', 'per kontainer'], ['C', 'LOLO 40ft', 'per kontainer'], ['C', 'Handling in gudang', 'per revenue ton'], ['C', 'Handling out gudang', 'per revenue ton'],
    ['C', 'Handling pelabuhan 20ft, kontainer pertama', 'per kontainer'], ['C', 'Handling pelabuhan 20ft, kontainer berikutnya', 'per kontainer'], ['C', 'Handling pelabuhan 40ft, kontainer pertama', 'per kontainer'], ['C', 'Handling pelabuhan 40ft, kontainer berikutnya', 'per kontainer'], ['C', 'E-Seal', 'per kontainer'],
    ['D', 'Storage harian', 'per revenue ton per hari'], ['D', 'Storage bulanan (lebih dari 30 hari, per kelipatan 30 hari)', 'per ton per bulan'], ['F', 'Overtime hari kerja', 'per jam'], ['F', 'Overtime akhir pekan / libur', 'per jam'], ['F', 'Sewa dedicated per m2 (minimal 2.500 m2)', 'per m2 per bulan']]
    .map(([g, n, satuan]) => ({ grup: { A: 'A. Customs clearance (pelabuhan)', C: 'C. Handling', D: 'D. Storage', F: 'F. Lainnya' }[g], n, satuan, modal: null })),
  ded(st) { return P.dipilih(this, st).find(l => /^Sewa dedicated/i.test(l.n)) || null; },
  harian(st) { return P.dipilih(this, st).find(l => /^Storage harian/i.test(l.n)) || null; },
  htmlAtas(st) {
    if (!this.ded(st)) return '';
    return `<div class="fl-kartu fl-kartu--ded"><div class="fl-sub-h">Sewa lahan dedicated (tarif bulanan)</div><div class="fl-grid2"><label class="fl-f"><span>Luasan minimum (m²) *</span>${inpAngka('info.luas', st.info.luas, '2.500')}</label><label class="fl-f"><span>Masa sewa *</span>${pilihan('info.masaBulan', [['3', '3 bulan'], ['6', '6 bulan'], ['12', '12 bulan']], st.info.masaBulan || '12')}</label></div><div class="fl-mut">Harga = luasan × tarif bulanan × jumlah bulan. Masuk kurang dari sebulan tetap ditagih 1 bulan penuh (tanpa prorata).</div></div>`;
  },
  baris(st) { return P.baris(st, this); },
  /* desain A (bertingkat): nama grup digabung (rowspan) di kolom pertama; layanan pertama tebal, sisanya sub-baris */
  dok(st) {
    const grupDok = l => l.grup === TPL_GRUP ? plbGrupDari(P.nama(this, st, l)) : l.grup;
    const items = P.dipilih(this, st), baris = [];
    this.grup.forEach((g, gi) => {
      const its = items.filter(l => grupDok(l) === g).filter(l => P.jual(this, st, l) > 0), namaG = (st.namaGrup || {})[gi] || g;
      its.forEach((l, k) => { const nm = P.nama(this, st, l); baris.push({ c: [k === 0 ? { v: namaG, rs: its.length, b: true } : null, k === 0 ? { v: nm, b: true } : nm, l.satuan, angkaDok(P.jual(this, st, l))] }); });
    });
    const kolom = [{ h: 'Grup', w: 26, a: 'l' }, { h: 'Layanan', w: 36, a: 'l' }, { h: 'Satuan', w: 16, a: 'l' }, { h: 'Harga jual (Rp)', w: 22, a: 'r' }];
    return { blok: [{ jenis: 'tabel', cap: 'RINCIAN TARIF', kolom, baris }], info: this.ded(st) ? [['Luasan minimum', angkaDok(st.info.luas) + ' m²'], ['Masa sewa dedicated', (st.info.masaBulan || '12') + ' bulan']] : [], catatan: [] };
  },
  tnc(st) {
    const g = [];
    if (this.ded(st)) g.push({ judul: 'Syarat dan ketentuan storage bulanan (dedicated)', items: [`Sewa lahan dedicated wajib dengan luasan minimum ${num(st.info.luas) > 0 ? angkaDok(st.info.luas) : '…'} m² dan masa sewa ${st.info.masaBulan || '12'} bulan.`, 'Tarif dihitung luasan × tarif bulanan × jumlah bulan sewa.', 'Barang yang masuk kurang dari satu bulan tetap ditagih satu bulan penuh karena lahan disewa penuh. Tidak ada prorata.'] });
    if (this.harian(st)) g.push({ judul: 'Syarat dan ketentuan storage harian', items: ['Storage harian ditagih sesuai aktual: jumlah barang × jumlah hari aktual × tarif harian.', 'Tidak ada minimum hari penyimpanan.'] });
    return g;
  },
  cek(st) {
    const r = P.cek(st, this);
    if (this.ded(st)) { const L = num(st.info.luas) || 0; if (!(L > 0)) r.galat.push('Isi luasan minimum untuk sewa dedicated.'); else if (L < 2500) r.peringatan.push('Luasan di bawah 2.500 m² (minimum umum sewa dedicated).'); }
    return r;
  }
};

/* ============================ SEWA CONTAINER EMPTY (MT): baris bebas seperti Depo ============================ */
/* Periode diketik bebas di tiap baris (hanya label di PDF). Modal dari data vendor menjadi referensi per baris. LOLO jadi butir S&K otomatis. */
const TIPE_SCE = [
  ['Dry standard', '10 ft', 150000, 600000, 1000000, 200000], ['Dry standard', '20 ft', 250000, 750000, 1500000, 200000], ['Dry standard', '21 ft', 300000, 900000, 1800000, 200000], ['Dry standard', '20 HC', 300000, 900000, 1800000, 200000],
  ['Dry standard', '40 ft', 450000, 1000000, 3000000, 300000], ['Dry standard', '40 HC', 500000, 1500000, 3500000, 300000], ['Dry standard', '45 HC', 550000, 1800000, 4000000, 300000],
  ['Open side', '20 ft', 450000, 1000000, 3000000, 300000], ['Open side', '40 HC', 650000, 2000000, 5000000, 300000], ['Flat rack', '20 ft', 500000, 2000000, 6000000, 300000], ['Flat rack', '40 ft', 800000, 3000000, 9000000, 300000],
  ['Open top, pakai terpal', '20 ft', 550000, 1800000, 4000000, 300000], ['Open top, pakai terpal', '40 ft', 650000, 2000000, 6000000, 300000], ['Open top, tanpa terpal', '20 ft', 450000, 1500000, 3000000, 300000], ['Open top, tanpa terpal', '40 ft', 550000, 1700000, 5000000, 300000],
  ['Isotank T11 / IMO 1 (24 KL)', '24 KL', 400000, null, 10000000, null], ['Isotank T11 / IMO 1 (25 KL)', '25 KL', 450000, null, 10500000, null], ['Isotank T11 / IMO 1 (26 KL)', '26 KL', 500000, null, 11000000, null]
].map(([g, n, h, m, b, lolo], i) => ({ key: 'b' + i, g, n, h, m, b, lolo }));
const PERIODE_SCE = ['Harian', 'Mingguan', 'Bulanan'];
const jenisPeriode = t => { const x = normT(t); return /bulan|month|bln/.test(x) ? 'b' : /minggu|week|mgg/.test(x) ? 'm' : /hari|day|harian/.test(x) ? 'h' : ''; };
const NAMA_SCE = [...new Set(TIPE_SCE.map(t => t.g))];
const PER_KOL = { harian: 'h', mingguan: 'm', bulanan: 'b' };
const SAT_PERIODE = { h: 'per hari', m: 'per minggu', b: 'per bulan' };
const LABEL_PER = { h: 'Harian', m: 'Mingguan', b: 'Bulanan' };
const barisSce = (tipe, ukuran) => ({ tipe, ukuran, harian: '', mingguan: '', bulanan: '', ket: '' });
/* baris lama (periode + harga satu kolom) dibaca sebagai satu periode */
const hargaSce = r => { if (r.harian || r.mingguan || r.bulanan) return { harian: num(r.harian), mingguan: num(r.mingguan), bulanan: num(r.bulanan) }; const j = jenisPeriode(r.periode); return { harian: j === 'h' ? num(r.harga) : 0, mingguan: j === 'm' ? num(r.harga) : 0, bulanan: j === 'b' ? num(r.harga) : 0 }; };
function modalSce(r, kol) {
  const tipe = normT(r.tipe), uk = normT(r.ukuran), j = PER_KOL[kol] || jenisPeriode(r.periode); if (!tipe || !j) return null;
  const hit = TIPE_SCE.find(t => normT(t.g) === tipe && normT(t.n) === uk) || TIPE_SCE.find(t => normT(t.g + ' ' + t.n) === normT(r.tipe + ' ' + r.ukuran));
  const mr = hit ? null : modalMR('sewa_container_empty', `${r.tipe} ${r.ukuran}`.trim());
  const v = hit ? hit[j] : mr; return ada(v) ? v : null;
}
LINI.sewa_container_empty = { key: 'sewa_container_empty', mesin: 'tabel', liniKey: 'sewa_container_empty', nama: 'Sewa Container Empty', judul: 'Penawaran Sewa Container Empty',
  ket: 'Satu tabel per tipe container. Harga harian, mingguan, dan bulanan diisi di tiap baris. LOLO ditulis di syarat dan ketentuan.',

  bagian: [{ judul: 'A. Tarif sewa container', sub: 'Harga per periode diisi di tiap baris', kelompokTipe: true, baris: [barisSce('Dry standard', '20 ft'), barisSce('Dry standard', '40 ft')],
    kolom: [{ k: 'tipe', nama: 'Tipe container', ph: 'Dry standard', opsi: NAMA_SCE }, { k: 'ukuran', nama: 'Ukuran', ph: '20 ft', opsi: ['10 ft', '20 ft', '21 ft', '20 HC', '40 ft', '40 HC', '45 HC'] }, { k: 'harian', nama: 'Harian (Rp)', num: true }, { k: 'mingguan', nama: 'Mingguan (Rp)', num: true }, { k: 'bulanan', nama: 'Bulanan (Rp)', num: true }, { k: 'ket', nama: 'Keterangan', ph: 'Opsional' }] }],
  modalSel: (r, k) => modalSce(r, k.k),
  namaSel: (r, k) => `Sewa container ${r.tipe || ''} ${r.ukuran || ''} (${LABEL_PER[PER_KOL[k.k]]})`.replace(/\s+/g, ' ').trim(),
  baris(st) { const out = []; (st.rows[0] || []).forEach(r => { const h = hargaSce(r); ['harian', 'mingguan', 'bulanan'].forEach(kol => { const j = PER_KOL[kol]; if (!(h[kol] > 0)) return; out.push({ item: `Sewa container ${r.tipe || ''} ${r.ukuran || ''} (${LABEL_PER[j]})`.replace(/\s+/g, ' ').trim(), satuan: SAT_PERIODE[j], jual: h[kol], modal: modalSce(r, kol), desk: r.ket || '', bagian: 'Tarif sewa container' }); }); }); return out; },
  /* desain C: satu kartu per tipe container, harga harian, mingguan, bulanan berdampingan, keterangan di ujung kanan */
  dok(st) {
    let no = 0; const baris = []; const grup = new Map();
    (st.rows[0] || []).forEach(r => { const h = hargaSce(r); if (!(h.harian > 0 || h.mingguan > 0 || h.bulanan > 0)) return; const g = r.tipe || '—'; if (!grup.has(g)) grup.set(g, []); grup.get(g).push({ r, h }); });
    grup.forEach((items, g) => { baris.push({ g }); items.forEach(({ r, h }) => baris.push({ c: [String(++no), r.ukuran || '—', ...['harian', 'mingguan', 'bulanan'].map(k => h[k] > 0 ? angkaDok(h[k]) : '—'), r.ket || '—'] })); });
    return { blok: [{ jenis: 'tabel', kelas: 'isl-trl', cap: 'RINCIAN TARIF SEWA (Rp)', kolom: [{ h: 'No', w: 6, a: 'c' }, { h: 'Ukuran', w: 16, a: 'l' }, { h: 'Harian', w: 16, a: 'r' }, { h: 'Mingguan', w: 16, a: 'r' }, { h: 'Bulanan', w: 16, a: 'r' }, { h: 'Keterangan', w: 30, a: 'l' }], baris }], info: [], catatan: [] };
  },
  tnc(st) {
    const rows = (st.rows[0] || []).filter(r => num(r.harga) > 0), js = new Set(rows.map(r => jenisPeriode(r.periode))), items = [];
    if (js.has('b')) items.push('Tarif periode bulanan sudah termasuk LOLO.');
    if (js.has('h') || js.has('m')) items.push('Tarif periode harian dan mingguan belum termasuk LOLO.');
    return items.length ? [{ judul: 'Syarat dan ketentuan LOLO', items }] : [];
  },
  cek(st) {
    const rows = st.rows[0] || [], isi = rows.filter(r => num(r.harga) > 0), g = [], w = [];
    if (!isi.length) g.push('Isi minimal satu tarif sewa container.');
    isi.forEach((r, i) => { if (!String(r.periode || '').trim()) g.push(`Baris ${i + 1}: periode wajib diisi (harian, mingguan, bulanan, atau tulisan sendiri).`); else if (!jenisPeriode(r.periode)) w.push(`Baris ${i + 1}: periode "${r.periode}" tidak dikenali sebagai harian, mingguan, atau bulanan, jadi butir LOLO otomatis tidak dibuat untuknya.`); });
    return { galat: g, peringatan: w };
  }
};

/* ============================ MESIN 4: TRUCKING DISTRIBUSI (mobil kecil) ============================ */
const ASAL_AWAL = ['Jakarta (Gudang Marunda)', 'Bekasi (Gudang Cikarang)'];
function modalTrucking(asal, tujuan, kelas) {
  const mr = C().MR ? C().MR() : null; if (!mr || !mr.tarif) return null;
  const t = mr.tarif.filter(x => x.liniBisnisId === 'distribusi_kecil' && x.aktif !== false && ada(x.modal) && x.dimensi && normT(x.dimensi.tujuan) && normT(tujuan).includes(normT(x.dimensi.tujuan)) && (!x.dimensi.kendaraan || normT(x.dimensi.kendaraan) === normT(kelas)));
  return t.length ? Math.max(...t.map(x => Number(x.modal))) : null;
}
/* tipe unit (kelas) yang dicentang untuk quotation ini; default semua aktif */
/* varian long (CDE Long, CDD Long) tersedia sebagai kolom tetapi baru tampil di PDF bila dicentang */
const KELAS_MATI_AWAL = new Set(['CDE Long', 'CDD Long']);
const kelasOn = (st, k) => (st.tipe && st.tipe[k] !== undefined) ? st.tipe[k] !== false : !KELAS_MATI_AWAL.has(k);
/* rute satu kolom: diketik bebas di kolom tujuan (tanpa asal default) */
const ruteDari = r => r.tujuan || r.asal || '—';
/* tarif minimum Distribusi = harga vendor tertinggi di Master Rate untuk tujuan dan kelas kendaraan ini (+ markup lini), dibulatkan ke atas Rp1.000 */
const minDstAktif = () => (C().tarifMinAktif ? C().tarifMinAktif('distribusi_kecil') : true);
const minDstSpek = (r, k) => String(r.tujuan || '').trim() ? { nama: r.tujuan, dim: { kendaraan: k, kunci: normT(k) } } : null;
/* Isi cepat template Distribusi (8 Nov 2026): rute dalam kota dengan pick up Jakarta, kelas Blind Van sampai Tronton. Master mengubah pick up, rute, dan harga di Pengaturan > Template lini (PENG.isiCepat); harga kosong memakai tarif minimum Master Rate. */
const ISI_CEPAT_AWAL = { pickup: 'Jakarta', rute: ['Jakarta', 'Bogor', 'Depok', 'Tangerang', 'Bekasi', 'Cikarang', 'Cikampek', 'Serang', 'Legok', 'Cikupa'].map(n => ({ n, h: {} })) };
const isiCepatTpl = () => { const v = C().isiCepatAtur ? C().isiCepatAtur('distribusi_kecil') : null; return v && Array.isArray(v.rute) && v.rute.length ? v : ISI_CEPAT_AWAL; };
FL.isiCepatAwal = () => JSON.parse(JSON.stringify(ISI_CEPAT_AWAL)); FL.isiCepatTpl = isiCepatTpl; FL.kelasIsiCepat = () => (daftarBody().find(x => x.key === 'boxdry') || { kelas: [] }).kelas;
/* rencana: rute baru ditambahkan, baris yang sudah ada hanya diisi sel kosongnya; harga template, lalu tarif minimum bila template kosong */
function rencanaTemplat(st, K) {
  const t = isiCepatTpl(), bl = st.bodies[K], skm = bl.skema || '', b = daftarBlok(st).find(z => z.key === K), kls = b.kelas, nm = x => String(x || '').trim().toLowerCase();
  const ada0 = (bl.rows || []).filter(isiBaris), skemaBaru = !ada0.length && !skm ? 'tetap' : skm, pk = skemaBaru === 'tetap' ? ((ada0[0] || {}).asal || t.pickup) : skemaBaru === 'pasangan' ? t.pickup : '';
  const baru = [], isi = []; let dariTpl = 0, dariMin = 0;
  t.rute.forEach(rt => {
    const tujuan = String(rt.n || '').trim(); if (!tujuan) return;
    let r = ada0.find(x => nm(x.tujuan) === nm(tujuan)); const lama = !!r; if (!r) { r = { ...barisBaru(null, pk), tujuan }; }
    const h = {}; kls.forEach(k => { if (num((r.h || {})[k]) > 0) return; const v = num((rt.h || {})[k]); if (v > 0) { h[k] = v; dariTpl++; return; } const i = minDstInfo({ ...r, tujuan }, k); if (i && ada(i.min) && i.min > 0) { h[k] = i.min; dariMin++; } });
    if (!lama) baru.push({ r, h }); else if (Object.keys(h).length) isi.push({ r, h });
  });
  return { pk, skemaBaru, baru, isi, dariTpl, dariMin, kls, ada0 };
}
const minDstInfo = (r, k) => { if (!minDstAktif()) return null; const sp = minDstSpek(r, k); return sp ? (tarifMinimumInfo('distribusi_kecil', sp.nama, sp.dim) || { min: null }) : null; };
/* skema pengiriman per tipe body: 'tetap' = satu pick up ke banyak tujuan (pita pick up), 'pasangan' = rute berpasangan asal → tujuan, kosong = tanpa keterangan pick up (draf lama) */
const SKEMA = [['', 'Tanpa keterangan pick up'], ['tetap', 'Satu pick up, banyak tujuan'], ['pasangan', 'Rute berpasangan (asal → tujuan)']];
const ruteSkema = (r, skema) => skema === 'pasangan' && r.asal && r.tujuan ? `${r.asal} → ${r.tujuan}` : ruteDari(r);
/* kapasitas bawaan tiap kelas unit (tampil di bawah nama kolom di PDF); bisa diubah per quotation */
const KAPASITAS = { 'Blind Van': '1 ton · 2 cbm', CDE: '2 ton · 4 cbm', 'CDE Long': '2,5 ton · 14 cbm', CDD: '4 ton · 15 cbm', 'CDD Long': '5 ton · 22 cbm', FUSO: '8 ton · ±30 cbm', Tronton: '12 ton · 50–55 cbm' };
const kapDari = (st, k) => String(((st.kap || {})[k] ?? KAPASITAS[k]) || '').trim();
/* harga FOT: TKBM dan asuransi tidak termasuk kecuali rute ditandai "Termasuk" */
const TERMASUK_OPSI = [['', 'Tidak termasuk'], 'Termasuk'];
const barisBaru = (last, asal) => ({ asal: last ? last.asal : (asal || ''), tujuan: '', service: last ? last.service : 'Reguler', tkbm: last ? (last.tkbm || '') : '', asuransi: last ? (last.asuransi || '') : '', h: {}, ket: '' });
MESIN.trucking = {
  awal() { return { bodies: { boxdry: { on: true, skema: 'tetap', rows: [barisBaru(null)] } } }; },
  asalOpsi(st) { const s = new Set(ASAL_AWAL); Object.values(st.bodies).forEach(b => (b.rows || []).forEach(r => { if (r.asal) s.add(r.asal); })); return [...s]; },
  html(st) {
    /* UI input Distribusi (desain B, 5 Nov 2026): tab tipe body, chip pengaturan (pick up, skema, unit), grid spreadsheet dengan kolom tujuan tetap, dan panel baris dipilih. HP dan desktop memakai DOM yang sama. */
    const sk = skTipeMaster('distribusi_kecil'), edit = bisaEdit();
    const onB = x => !!(st.bodies[x.key] && st.bodies[x.key].on), daftar = daftarBlok(st).filter(onB);
    if (!daftar.some(x => x.key === UI.bodyAktif)) UI.bodyAktif = (daftar[0] || {}).key;
    const b = daftar.find(x => x.key === UI.bodyAktif) || null, K = b && b.key, s = st.bodies[K] || { on: false, rows: [] }, rows = s.rows || [], skm = s.skema || '';
    const kls = b ? b.kelas.filter(k => kelasOn(st, k)) : [], ka = kls.includes(UI.kelasAktif) ? UI.kelasAktif : kls[0];
    const nTuj = x => ((st.bodies[x.key] || {}).rows || []).filter(r => String(r.tujuan || '').trim()).length;
    const tab = (x, i) => `<button type="button" class="fl-dsb__tab" aria-pressed="${x.key === K}" data-fla="dsbBody" data-flx="${esc(x.key)}"><span class="fl-dsb__let">${huruf(i)}</span>${esc(judulBlok(st, x))}<small>${nTuj(x)}</small></button>`;
    /* panel "+ Blok": isinya sama dengan pengaturan blok pertama (tipe body, skema pick up, pick up) */
    const nb = edit ? (UI.blokBaru || (!daftar.length ? (UI.blokBaru = { tipe: 'boxdry', skema: 'tetap', pickup: '', judul: '' }) : null)) : null;
    const panelBaru = !nb ? '' : `<div class="fl-dsb__pn fl-dsb__nb"><div class="fl-sub-h" style="margin:0">Blok baru (${huruf(daftar.length)})</div>
      <div class="fl-mut">Tipe body</div><div class="fl-dsb__opt">${daftarBody().map(t => `<button type="button" class="fl-chipbtn" aria-pressed="${nb.tipe === t.key}" data-fla="bbTipe" data-flx="${esc(t.key)}">${esc(t.nama)}</button>`).join('')}</div>
      <div class="fl-mut">Skema pick up</div><div class="fl-dsb__opt">${SKEMA.map(([v, l]) => `<button type="button" class="fl-chipbtn" aria-pressed="${nb.skema === (v || 'polos')}" data-fla="bbSkema" data-flx="${v || 'polos'}">${esc(l)}</button>`).join('')}</div>
      ${nb.skema === 'tetap' ? `<label class="fl-f"><span>Pick up (berlaku untuk semua tujuan di blok ini)</span><input data-fli="bb-pick" list="fl-dl-asal" value="${esc(nb.pickup || '')}" placeholder="mis. Jakarta (Gudang Marunda)" autocomplete="off"></label>` : ''}
      <label class="fl-f"><span>Judul blok (opsional, tampil di PDF)</span><input data-fli="bb-judul" value="${esc(nb.judul || '')}" placeholder="${esc((daftarBody().find(t => t.key === nb.tipe) || {}).nama || '')}" autocomplete="off"></label>
      <div class="fl-baris-tombol"><button type="button" class="mr-btn mr-btn--utama mr-btn--kecil" data-fla="blokBuat">Buat blok ${huruf(daftar.length)}</button>${daftar.length ? '<button type="button" class="mr-btn mr-btn--kecil" data-fla="blokBatal">Batal</button>' : ''}</div></div>`;
    const chip = (p, label) => `<button type="button" class="fl-chipbtn fl-dsb__chip" aria-pressed="${UI.dsbPanel === p}" data-fla="dsbPanel" data-flx="${p}">${label}</button>`;
    const formTipe = !(edit && bisaKatalog() && UI.addTipe) ? '' : `<div class="fl-dsb__pn"><div class="fl-kat__form" data-flkat="tipe"><div class="fl-mut">Tipe kendaraan baru</div><label class="fl-f"><span>Nama tipe</span><input data-kf="nama" placeholder="Container chassis" autocomplete="off"></label><label class="fl-f"><span>Kelas kendaraan (pisahkan dengan koma)</span><input data-kf="kelas" placeholder="CDE, CDD, Tronton" autocomplete="off"></label>
        <div class="fl-baris-tombol"><button type="button" class="mr-btn mr-btn--utama mr-btn--kecil" data-fla="kat-simpan" data-flg="tipe">Simpan tipe</button><button type="button" class="mr-btn mr-btn--kecil" data-fla="tipe-batal">Batal</button></div></div>
        <div class="fl-baris-tombol"><button type="button" class="mr-btn mr-btn--utama mr-btn--kecil" data-fla="kat-simpan" data-flg="tipe">Simpan tipe</button><button type="button" class="mr-btn mr-btn--kecil" data-fla="tipe-batal">Batal</button></div></div>`;
    let h = `<div class="fl-dsb"><div class="fl-dsb__tabs">${daftar.map(tab).join('')}${edit ? `<button type="button" class="fl-dsb__tab fl-dsb__tab--baru" aria-pressed="${!!nb}" data-fla="blokBuka">+ Blok</button>` : ''}${edit && bisaKatalog() ? '<button type="button" class="fl-dsb__tab" data-fla="tipe-buka">+ Tipe</button>' : ''}</div>${panelBaru}${formTipe}${datalist('fl-dl-asal', this.asalOpsi(st))}`;
    if (!b) return h + '<div class="fl-kartu"><div class="fl-mut">Belum ada blok. Pilih tipe body dan skema pick up di atas, lalu buat blok pertama.</div></div></div>' + htmlKalkulator(st);
    const pick = rows.length ? (rows[0].asal || '') : (s.pickup || ''), skLabel = (SKEMA.find(z => z[0] === skm) || SKEMA[0])[1];
    const sel = (() => { const [bk, n] = String(UI.barisAktif || '').split('.'); return bk === K && rows[+n] ? +n : 0; })();
    const terisi = k => rows.filter(r => num((r.h || {})[k]) > 0).length;
    /* kelas yang dipakai = punya minimal satu harga atau dicentang sendiri; kolom bawaan yang kosong semua tidak dihitung sebagai harga kosong */
    const pakai = kls.filter(k => terisi(k) > 0 || (st.tipe && st.tipe[k] === true));
    const kosong = rows.reduce((n, r) => n + pakai.filter(k => !(num((r.h || {})[k]) > 0)).length, 0), rendahN = rows.reduce((n, r) => n + kls.filter(k => this.rendah(r, k)).length, 0), lengkap = rows.filter(r => String(r.tujuan || '').trim() && pakai.length && pakai.every(k => num((r.h || {})[k]) > 0)).length;
    const barisKosong = rows.filter(r => !String(r.tujuan || '').trim() && !String(r.ket || '').trim() && !Object.values(r.h || {}).some(v => num(v) > 0)).length;
    const ubahBuka = ['ubah', 'pick', 'skema', 'unit'].includes(UI.dsbPanel), skPendek = skm === 'tetap' ? 'Satu pick up' : skm === 'pasangan' ? 'Berpasangan' : 'Tanpa pick up';
    h += `<button type="button" class="fl-dsb__ring" aria-expanded="${ubahBuka}" data-fla="dsbPanel" data-flx="${ubahBuka ? UI.dsbPanel : 'ubah'}"><span>${skm === 'tetap' ? '📍 <b>' + (pick ? esc(pick) : 'Pick up belum diisi') + '</b> · ' : ''}${skPendek} · Unit ${kls.length}</span><em>${ubahBuka ? 'Tutup' : 'Ubah'}</em></button>
      ${ubahBuka ? `<div class="fl-dsb__chips">${skm === 'tetap' ? chip('pick', '📍 ' + (pick ? esc(pick) : 'Pick up belum diisi')) : ''}${chip('skema', esc(skLabel) + ' ▾')}${chip('unit', '⚙ Unit ' + kls.length)}</div>` : ''}
      <div class="fl-dsb__bar">${edit ? `<button type="button" class="fl-chipbtn" data-fla="tujuan-tambah" data-flx="${esc(K)}">+ Tambah baris</button>${chip('cepat', '⚡ Isi cepat ▾')}${chip('blok', '⋮ Blok')}${barisKosong ? `<button type="button" class="fl-chipbtn fl-dsb__kosong" data-fla="dsbKosong" data-flx="${esc(K)}" title="Hapus baris yang belum berisi tujuan, harga, atau keterangan">🗑 Hapus ${barisKosong} baris kosong</button>` : ''}` : ''}<span class="fl-dsb__sum">${rows.length} tujuan · <b class="is-ok">${lengkap} lengkap</b>${rendahN ? ` · <b class="is-warn">${rendahN} di bawah minimum</b>` : ''}${kosong ? ` · ${kosong} harga kosong` : ''}</span></div>`;
    /* panel pengaturan (satu terbuka sekaligus) */
    if (UI.dsbPanel === 'pick' && skm === 'tetap') h += `<div class="fl-dsb__pn"><label class="fl-f"><span>Pick up (berlaku untuk semua tujuan)</span>${inpTeks(`bodies.${K}.pickup`, pick, 'mis. Jakarta (Gudang Marunda)', 'list="fl-dl-asal"')}</label></div>`;
    if (UI.dsbPanel === 'skema') h += `<div class="fl-dsb__pn"><div class="fl-dsb__opt">${SKEMA.map(([v, l]) => `<button type="button" class="fl-chipbtn" aria-pressed="${skm === v}" data-fla="dsbSkema" data-flx="${v || 'polos'}">${esc(l)}</button>`).join('')}</div><div class="fl-mut">Satu pick up: satu isian Pick up untuk semua tujuan. Berpasangan: asal diisi per baris (mis. Jakarta ke Bandung).</div></div>`;
    if (UI.dsbPanel === 'unit') {
      const sengaja = kls.filter(k => !terisi(k) && st.tipe && st.tipe[k] === true), otomatis = kls.filter(k => !terisi(k) && !(st.tipe && st.tipe[k] === true));
      h += `<div class="fl-dsb__pn"><div class="fl-sub-h" style="margin:0">Tipe unit di tabel dan PDF</div><div class="fl-dsb__opt">${b.kelas.map(k => `<button type="button" class="fl-chipbtn" aria-pressed="${kelasOn(st, k)}" data-fla="tipeKelas" data-flx="${esc(k)}">${kelasOn(st, k) ? '✓ ' : ''}${esc(k)}</button>`).join('')}</div>
        ${sengaja.length ? `<div class="fl-dsb__ket">${esc(sengaja.join(', '))}: dicentang tetapi belum ada harga, kolom tampil kosong (—) di PDF.</div>` : ''}${otomatis.length ? `<div class="fl-dsb__ket fl-dsb__ket--info">${esc(otomatis.join(', '))}: belum ada harga, kolom belum tampil di PDF. Centang ulang kelasnya bila ingin tetap tampil.</div>` : ''}
        <div class="fl-sub-h" style="margin:6px 0 0">Kapasitas (tampil di bawah nama kolom di PDF)</div><div class="fl-grid2">${kls.map(k => `<label class="fl-f"><span>${esc(k)}</span>${inpTeks(`kap.${k}`, (st.kap || {})[k] ?? KAPASITAS[k] ?? '', 'mis. 2 ton · 4 cbm')}</label>`).join('')}</div>
        </div>`;
    }
    if (UI.dsbPanel === 'blok' && edit) h += `<div class="fl-dsb__pn"><label class="fl-f"><span>Judul blok (tampil di PDF; kosong = nama tipe)</span>${inpTeks(`bodies.${K}.judul`, (st.bodies[K] || {}).judul || '', judulBlok(st, b))}</label>
      <div class="fl-baris-tombol"><button type="button" class="mr-btn mr-btn--kecil fl-dsb__del" data-fla="blokHapus" data-flx="${esc(K)}">Hapus blok ${esc(huruf(daftar.indexOf(b)))}</button>${b.custom && !b.salinan && bisaKatalog() ? `<button type="button" class="mr-btn mr-btn--kecil" data-fla="kat-hapus" data-flx="${esc(b.kid)}">Hapus tipe dari katalog</button>` : ''}</div></div>`;
    if (UI.dsbPanel === 'cepat' && edit) h += `<div class="fl-dsb__pn">${tipeBlok(K) === 'boxdry' ? `<div class="fl-dsb__opt"><button type="button" class="fl-chipbtn fl-dsb__tpl" data-fla="dstTemplat" data-flx="${esc(K)}" title="Tambah rute Jabodetabek dan harga dari template lini">📍 Isi dari template ${esc(isiCepatTpl().pickup)} (Jabodetabek)</button></div>` : ''}<div class="fl-mut">Isi cepat kolom <b>${esc(ka)}</b> (klik nama kolom di grid untuk memilih kolom lain)</div><div class="fl-dsb__opt">
        <button type="button" class="fl-chipbtn" data-fla="dstSalin" data-flx="${esc(K)}" title="Isi sel kosong dengan harga di atasnya">Salin ke bawah ↓</button>
        ${minDstAktif() ? `<button type="button" class="fl-chipbtn" data-fla="dstMin" data-flx="${esc(K)}" title="Isi sel kosong dengan tarif minimum Master Rate (harga vendor tertinggi untuk tujuan itu)">Isi tarif minimum</button>` : ''}</div>
      <div class="fl-dsb__opt"><span class="fl-dst__pct">sama dengan <select data-fli="src-${esc(K)}">${kls.filter(k => k !== ka).map(k => `<option>${esc(k)}</option>`).join('')}</select> + <input type="number" step="1" value="15" data-fli="pct-${esc(K)}" inputmode="decimal"> %</span><button type="button" class="fl-chipbtn" data-fla="dstIsi" data-flx="${esc(K)}" title="Dibulatkan ke Rp1.000">Terapkan</button></div></div>`;
    /* grid: kolom tujuan beku, geser ke samping untuk kelas lain */
    const tag = (r, ri) => `<button type="button" class="fl-dsb__tags" data-fla="dsbBaris" data-flx="${esc(K)}.${ri}" aria-label="Pilih baris ${esc(r.tujuan || ri + 1)}"><span class="fl-dsb__t fl-dsb__t--${r.service === 'Express' ? 'ex' : 'rg'}">${r.service === 'Express' ? 'EXP' : 'REG'}</span>${r.tkbm === 'Termasuk' ? '<span class="fl-dsb__t fl-dsb__t--ok">T</span>' : ''}${r.asuransi === 'Termasuk' ? '<span class="fl-dsb__t fl-dsb__t--ok">A</span>' : ''}${skm === 'pasangan' && r.asal ? `<span class="fl-dsb__t">${esc(r.asal)}</span>` : ''}</button>`;
    h += `<div class="fl-dsb__main"><div class="fl-dsb__sc"><div class="fl-dsb__g" style="--n:${kls.length}"><div class="fl-dsb__hc fl-dsb__f">Tujuan</div>${kls.map(k => `<button type="button" class="fl-dsb__hc${k === ka ? ' on' : ''}" data-fla="dstKelas" data-flx="${esc(k)}">${esc(k)}<small>${esc(kapDari(st, k))}</small></button>`).join('')}
      ${rows.map((r, ri) => { const P = `bodies.${K}.rows.${ri}`; return `<div class="fl-dsb__r${ri === sel ? ' sel' : ''}"><div class="fl-dsb__f">${inpTeks(`${P}.tujuan`, r.tujuan, 'Tujuan', 'class="fl-dsb__nm"')}${tag(r, ri)}${edit ? `<button type="button" class="fl-x fl-dsb__x" data-fla="tujuan-hapus" data-flx="${esc(K)}.${ri}" aria-label="Hapus baris ${esc(r.tujuan || ri + 1)}" title="Hapus baris ini">×</button>` : ''}</div>${kls.map(k => { const i = minDstInfo(r, k), tt = i && ada(i.min) ? `title="Min ${fmtRp(i.min)}"` : ''; return `<div class="fl-dsb__c${k === ka ? ' on' : ''}">${inpAngka(`${P}.h.${k}`, (r.h || {})[k], '—', `${this.rendah(r, k) ? 'data-rendah="1"' : ''} ${tt}`)}</div>`; }).join('')}</div>`; }).join('')}</div></div>
      ${rows.length ? this.hPanelBaris(st, b, rows, sel, kls, skm, edit) : '<div class="fl-kartu"><div class="fl-mut">Belum ada tujuan. Klik “+ Tambah baris”.</div></div>'}</div>`;
    const skT = satuDua(sk[tipeBlok(K)]);
    if (skT.length) h += `<div class="fl-sk"><b>S&amp;K ${esc(b.nama)} (dari Master Rate)</b><ol>${skT.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`;
    return h + '</div>' + htmlKalkulator(st);
  },
  /* panel baris dipilih: layanan, TKBM, asuransi, keterangan, tarif minimum per kelas, hapus */
  hPanelBaris(st, b, rows, sel, kls, skm, edit) {
    const K = b.key, r = rows[sel], P = `bodies.${K}.rows.${sel}`;
    const sw = (path, on, label) => `<button type="button" class="fl-dsb__sw" aria-pressed="${on}" data-fla="dstTg" data-flx="${esc(path)}"><span>${label}</span><i></i></button>`;
    const adaMin = kls.some(k => { const i = minDstInfo(r, k); return i && ada(i.min); });
    const mins = !minDstAktif() || !String(r.tujuan || '').trim() ? '' : !adaMin ? '<div class="fl-mut">Belum ada tarif vendor di Master Rate untuk tujuan ini.</div>' : kls.map(k => { const id = `dst~${K}~${sel}~${k}`, i = minDstInfo(r, k); if (!i || !ada(i.min)) return ''; return `<div class="fl-dsb__mr"><span>${esc(k)}</span>${this.hMin(r, k, id)}</div>${UI.minBuka === id ? `<div class="fl-dst__pm">${panelMin({ liniKey: 'distribusi_kecil' }, minDstSpek(r, k), id, i)}</div>` : ''}`; }).join('');
    return `<aside class="fl-dsb__ins"><div class="fl-dsb__ins-h"><b>${esc(r.tujuan || 'Baris ' + (sel + 1))}</b><span class="fl-mut">Baris dipilih</span></div>
      ${skm === 'pasangan' ? `<label class="fl-f"><span>Asal</span>${inpTeks(`${P}.asal`, r.asal, 'Asal, mis. Jakarta', 'list="fl-dl-asal"')}</label>` : ''}
      <div class="fl-dsb__seg"><button type="button" class="${r.service !== 'Express' ? 'is-on' : ''}" data-fla="dstSvc" data-flx="${esc(P)}|Reguler">Reguler</button><button type="button" class="ex ${r.service === 'Express' ? 'is-on' : ''}" data-fla="dstSvc" data-flx="${esc(P)}|Express">Express</button></div>
      ${sw(`${P}.tkbm`, r.tkbm === 'Termasuk', 'TKBM termasuk')}${sw(`${P}.asuransi`, r.asuransi === 'Termasuk', 'Asuransi termasuk')}
      <label class="fl-f"><span>Keterangan</span>${inpTeks(`${P}.ket`, r.ket, 'Keterangan (opsional)')}</label>
      ${mins ? `<div class="fl-dsb__mins"><div class="fl-dsb__mt">Tarif minimum Master Rate</div>${mins}</div>` : ''}
      ${edit ? `<button type="button" class="mr-btn mr-btn--kecil fl-dsb__del" data-fla="tujuan-hapus" data-flx="${esc(K)}.${sel}">Hapus baris ini</button>` : ''}</aside>`;
  },
  rendah(r, k) { const i = minDstInfo(r, k), v = num((r.h || {})[k]); return !!(i && ada(i.min) && v > 0 && v < i.min); },
  hMin(r, k, id) {
    const i = minDstInfo(r, k); if (!i) return ''; if (!String(r.tujuan || '').trim()) return '<div class="fl-dst__mn" data-flo hidden></div>';
    const v = num((r.h || {})[k]), master = lihatInt(), rendah = ada(i.min) && v > 0 && v < i.min;
    const asal = !master ? '' : i.atur ? ' · diatur master' : i.vendor ? ` · ${esc(i.vendor)}` : '';
    const pen = master && bisaEdit() ? `<button type="button" class="fl-min__ed" data-fla="min-buka" data-flx="${esc(id)}" aria-label="Atur tarif minimum" title="Atur tarif minimum untuk semua akun">${IKON_PENSIL}</button>` : '';
    const isi = ada(i.min) && bisaEdit() ? `<button type="button" class="fl-dst__pakai" data-fla="dstPakai" data-flx="${esc(id)}" title="Pakai tarif minimum ini sebagai harga">${rendah ? `▼ Min ${fmtRp(i.min)} (kurang ${fmtRp(i.min - v)})` : `Min ${fmtRp(i.min)}`}</button>` : '<span title="Belum ada tarif vendor di Master Rate untuk tujuan dan kelas ini">Min: belum ada</span>';
    return `<div class="fl-dst__mn${rendah ? ' is-rendah' : ''}" data-flo>${isi}<em>${asal}</em>${pen}</div>`;
  },
  ubah(path, st) {
    const m = /^bodies\.([^.]+)\.pickup$/.exec(path); if (!m) return false;
    const b = st.bodies[m[1]], v = getPath(st, path) || ''; (b.rows || []).forEach(r => { r.asal = v; }); if ((b.rows || []).length) delete b.pickup; return false;
  },
  aksi(a, x, st, cfg, root) {
    if (a === 'tipeKelas') { st.tipe = st.tipe || {}; st.tipe[x] = !kelasOn(st, x); return true; }
    if (a === 'dstPakai') { const [, bk, ri, kl] = String(x).split('~'), r = (st.bodies[bk].rows || [])[+ri], i = r && minDstInfo(r, kl); if (i && ada(i.min)) { r.h = r.h || {}; r.h[kl] = i.min; } return true; }
    if (a === 'dstMin') { const k = UI.kelasAktif; (st.bodies[x].rows || []).forEach(r => { r.h = r.h || {}; const i = minDstInfo(r, k); if (i && ada(i.min) && !(num(r.h[k]) > 0)) r.h[k] = i.min; }); return true; }
    if (a === 'dstKelas') { if (x) UI.kelasAktif = x; return true; }
    if (a === 'blokBuka') { UI.blokBaru = UI.blokBaru ? null : { tipe: tipeBlok(UI.bodyAktif || 'boxdry'), skema: 'tetap', pickup: '', judul: '' }; UI.dsbPanel = null; return true; }
    if (a === 'blokBatal') { UI.blokBaru = null; return true; }
    if (a === 'bbTipe' || a === 'bbSkema' || a === 'blokBuat') {
      const nb = UI.blokBaru; if (!nb) return false;
      const rd = n => { const el = root && root.querySelector(`[data-fli="${n}"]`); return el ? el.value : null; }, pk = rd('bb-pick'), jd = rd('bb-judul'); if (pk !== null) nb.pickup = pk; if (jd !== null) nb.judul = jd;
      if (a === 'bbTipe') { nb.tipe = x; return true; } if (a === 'bbSkema') { nb.skema = x; return true; }
      const t = nb.tipe, d = st.bodies[t], pakaiDasar = !d || (!d.on && !(d.rows || []).some(isiBaris)); let key = t;
      if (!pakaiDasar) { let n = 2; while (st.bodies[t + '@' + n]) n++; key = t + '@' + n; }
      const alamat = nb.skema === 'tetap' ? String(nb.pickup || '').trim() : '', blok = st.bodies[key] = { on: true, skema: nb.skema === 'polos' ? '' : nb.skema, urut: Math.max(0, ...Object.values(st.bodies).map(v => v.urut || 0)) + 1, rows: [barisBaru(null, alamat)] };
      if (String(nb.judul || '').trim()) blok.judul = String(nb.judul).trim();
      UI.bodyAktif = key; UI.blokBaru = null; UI.dsbPanel = null; UI.barisAktif = null; return true;
    }
    if (a === 'blokHapus') { delete st.bodies[x]; UI.dsbPanel = null; UI.barisAktif = null; return true; }
    if (a === 'dsbBody') { UI.bodyAktif = x; UI.dsbPanel = null; UI.blokBaru = null; UI.barisAktif = null; return true; }
    if (a === 'dsbPanel') { UI.dsbPanel = UI.dsbPanel === x ? null : x; return true; }
    if (a === 'dsbBaris') { UI.barisAktif = x; return true; }
    if (a === 'dsbSkema') { const b = st.bodies[UI.bodyAktif]; if (b) { b.skema = x === 'polos' ? '' : x; if (b.skema === 'tetap' && b.rows && b.rows.length) { const v = b.rows[0].asal || ''; b.rows.forEach(r => { r.asal = v; }); } } UI.dsbPanel = null; return true; }
    if (a === 'dstTg') { setPath(st, x, getPath(st, x) === 'Termasuk' ? '' : 'Termasuk'); return true; }
    if (a === 'dstSvc') { const [p, v] = String(x).split('|'); setPath(st, p + '.service', v); return true; }
    if (a === 'dstSalin') { const k = UI.kelasAktif; let last = 0; (st.bodies[x].rows || []).forEach(r => { r.h = r.h || {}; const v = num(r.h[k]); if (v > 0) last = v; else if (last > 0) r.h[k] = last; }); return true; }
    if (a === 'dstIsi') {
      const k = UI.kelasAktif, src = root && root.querySelector(`[data-fli="src-${x}"]`), pct = root && root.querySelector(`[data-fli="pct-${x}"]`), p = Number(pct && pct.value);
      if (!src || !Number.isFinite(p)) return false;
      (st.bodies[x].rows || []).forEach(r => { r.h = r.h || {}; const v = num(r.h[src.value]); if (v > 0) r.h[k] = Math.max(0, Math.round(v * (1 + p / 100) / 1000) * 1000); }); return true;
    }
    if (a === 'body') { const b = st.bodies[x] = st.bodies[x] || { on: false, rows: [] }; b.on = !b.on; if (b.on && !b.skema && !b.rows.length) b.skema = 'tetap'; if (b.on && !b.rows.length) b.rows.push(barisBaru(null)); return true; }
    if (a === 'tujuan-tambah') { const b = st.bodies[x]; b.rows.push(barisBaru((b.rows || []).slice(-1)[0], b.pickup)); UI.bodyAktif = x; UI.barisAktif = x + '.' + (b.rows.length - 1); return true; }
    if (a === 'tujuan-hapus') { const [k, i] = String(x).split('.'), b = st.bodies[k]; b.rows.splice(+i, 1); UI.barisAktif = b.rows.length ? k + '.' + Math.min(+i, b.rows.length - 1) : null; return true; }
    if (a === 'dsbKosong') { const b = st.bodies[x]; b.rows = (b.rows || []).filter(r => String(r.tujuan || '').trim() || String(r.ket || '').trim() || Object.values(r.h || {}).some(v => num(v) > 0)); UI.barisAktif = b.rows.length ? x + '.0' : null; return true; }
    if (a === 'tipe-buka') { UI.addTipe = true; return true; } if (a === 'tipe-batal') { UI.addTipe = false; return true; }
    return false;
  },
  katItem(cfg, grup, v) { const kelas = String(v.kelas || '').split(',').map(x => x.trim()).filter(Boolean); if (!v.nama || !kelas.length) throw new Error('Nama tipe dan minimal satu kelas wajib diisi.'); return { grup: 'tipe', nama: v.nama, kelas, label: v.nama }; },
  setelahSimpanKatalog(st) { UI.addTipe = false; },
  hapusKatalog(st, cfg, id) { Object.keys(st.bodies).filter(k => k === id || k.startsWith(id + '@')).forEach(k => delete st.bodies[k]); },
  aktif(st) { return daftarBlok(st).filter(b => st.bodies[b.key] && st.bodies[b.key].on); },
  baris(st) {
    const out = [];
    this.aktif(st).forEach(b => (st.bodies[b.key].rows || []).forEach(r => b.kelas.filter(k => kelasOn(st, k)).forEach(k => { const j = num((r.h || {})[k]); if (j > 0) out.push({ item: `${judulBlok(st, b)} ${ruteSkema(r, st.bodies[b.key].skema)} ${k}`, satuan: 'per ritase', jual: j, modal: modalTrucking(r.asal, r.tujuan, k), min: (minDstInfo(r, k) || {}).min || null, desk: r.ket || '', bagian: 'Tipe ' + b.nama }); })));
    return out;
  },
  dok(st) {
    /* Kartu ringan (4 Nov 2026): satu kartu per tipe body; kapasitas di bawah nama kelas; pita pick up (skema 'tetap') atau "asal → tujuan" (skema 'pasangan');
       kolom Layanan (Reguler/Express); TKBM: satu label di kepala kartu, hanya baris pengecualian yang ditandai; keterangan jadi sub-baris. */
    let n = 0; const blok = [];
    this.aktif(st).forEach(b => {
      const sk = st.bodies[b.key].skema || '', semuaRows = st.bodies[b.key].rows || [];
      /* kelas yang dicentang menentukan kolom PDF. Kelas bawaan yang tidak berisi satu harga pun disembunyikan, kecuali pemilik mencentangnya sendiri (tampil kosong "—"). */
      const kelas = b.kelas.filter(k => kelasOn(st, k) && (semuaRows.some(r => num((r.h || {})[k]) > 0) || (st.tipe && st.tipe[k] === true)));
      const rows = semuaRows.filter(r => kelas.some(k => num((r.h || {})[k]) > 0)); if (!rows.length || !kelas.length) return;
      const wK = Math.floor((100 - 24 - 9) / kelas.length), baris = [];
      /* TKBM dan asuransi: harga FOT, tidak termasuk kecuali ditandai. Bila SEMUA baris di kartu termasuk, cukup satu label di kepala kartu; bila hanya sebagian, hanya baris itu yang diberi tanda. */
      const FIT = [['tkbm', 'TKBM termasuk', 'TKBM included'], ['asuransi', 'Asuransi termasuk', 'Insurance included']].map(([f, id, en]) => ({ f, id, en, n: rows.filter(r => r[f] === 'Termasuk').length }));
      const semua = FIT.filter(x => x.n === rows.length), sebagian = FIT.filter(x => x.n > 0 && x.n < rows.length);
      const cip = semua.length ? [semua.map(x => x.id).join(' · '), semua.map(x => x.en).join(' · ')] : null;
      const tag = r => { const t = sebagian.filter(x => r[x.f] === 'Termasuk'); return t.length ? { tag: t.map(x => x.id).join(' · '), tagEn: t.map(x => x.en).join(' · '), tagK: 'ok' } : {}; };
      const sel = r => ({ v: ruteSkema(r, sk), b: true, sat: r.ket || '', ...tag(r) }), svc = r => r.service === 'Express' ? { v: 'Express', chip: 'ex' } : { v: 'Reguler', vEn: 'Regular', chip: 'rg' }, harga = r => kelas.map(k => ({ v: hargaSel((r.h || {})[k]), rp: true }));
      if (sk === 'tetap') {
        [...new Set(rows.map(r => r.asal || ''))].forEach(a => {
          const g = rows.filter(r => (r.asal || '') === a);
          if (a) baris.push({ g: `Pick up  ${a}`, w: g.every(r => r.service === 'Express') ? 'oranye' : 'biru' });
          g.forEach((r, i) => baris.push({ k: (i === 0 ? 'gf ' : '') + (i === g.length - 1 ? 'gl' : ''), c: [sel(r), svc(r), ...harga(r)] }));
        });
      } else rows.forEach((r, i) => baris.push({ k: (i === 0 ? 'gf ' : '') + (i === rows.length - 1 ? 'gl' : ''), c: [sel(r), svc(r), ...harga(r)] }));
      blok.push({ jenis: 'tabel', huruf: huruf(n++), cap: String(st.bodies[b.key].judul || '').trim() || (b.salinan ? `Tipe ${judulBlok(st, b)}` : `Tipe ${b.nama}`), cip: cip && cip[0], cipEn: cip && cip[1], kelas: 'isl-kartu isl-kartu--dst' + (kelas.length > 5 ? ' isl-kartu--rapat' : ''), kolom: [{ h: sk === 'pasangan' ? 'Rute' : 'Tujuan', hEn: sk === 'pasangan' ? 'Route' : 'Destination', w: 24, a: 'l' }, { h: 'Layanan', hEn: 'Service', w: 9, a: 'c' }, ...kelas.map(k => ({ h: k, sub: kapDari(st, k), w: wK, a: 'r' }))], baris });
    });
    return { blok, catatan: ['Satuan tarif per ritase.'] };
  },
  tnc(st) { const sk = skTipeMaster('distribusi_kecil'); return this.aktif(st).filter(b => !b.salinan).map(b => ({ judul: `Syarat dan ketentuan tipe ${b.nama}`, items: satuDua(sk[b.key]) })).filter(g => g.items.length); },
  cek(st) {
    const sk = skTipeMaster('distribusi_kecil'), g = [], a = this.aktif(st);
    if (!a.length) g.push('Centang minimal satu tipe body.');
    if (a.length && !this.baris(st).length) g.push('Isi minimal satu tarif rute.');
    return { galat: g, peringatan: [] };
  }
};
LINI.distribusi_kecil = { key: 'distribusi_kecil', mesin: 'trucking', liniKey: 'distribusi_kecil', tarifMinimum: true, nama: 'Trucking Distribusi', judul: 'Penawaran Tarif Trucking Distribusi',
  ket: 'Satu modul untuk semua tipe body (box dry, box reefer, bak, lost bak, wing box, three way, towing). S&K umum dari template lini; S&K khusus tipe body (Master Rate) opsional.',
};


/* ============================ GAMBAR (foto galeri): diperkecil di perangkat sebelum disimpan ============================ */
function perkecil(file, maks = 1400, mutu = 0.8) {
  return new Promise((ok, gagal) => {
    if (!/^image\//.test(file.type)) return gagal(new Error('Bukan file gambar.'));
    const r = new FileReader(); r.onerror = () => gagal(new Error('Gagal membaca file.'));
    r.onload = () => { const img = new Image(); img.onerror = () => gagal(new Error('Gambar tidak bisa dibuka.')); img.onload = () => { const s = Math.min(1, maks / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', mutu)); }; img.src = r.result; };
    r.readAsDataURL(file);
  });
}
const htmlGaleri = (arr, path, label) => `<div class="fl-galeri">${(arr || []).map((f, i) => `<figure><img src="${esc(f.src)}" alt="" loading="lazy"><figcaption>${inpTeks(`${path}.${i}.ket`, f.ket, 'Keterangan foto')}</figcaption>${bisaEdit() ? `<button type="button" class="fl-x" data-fla="foto-hapus" data-flx="${path}.${i}" aria-label="Hapus foto" title="Hapus foto">×</button>` : ''}</figure>`).join('')}</div>
  ${bisaEdit() ? `<label class="fl-unggah"><input type="file" accept="image/*" multiple data-flfoto="${path}"> + ${esc(label)}</label>` : ''}<div class="fl-mut">${(arr || []).length ? (arr.length + ' foto. Foto diperkecil otomatis sebelum disimpan.') : 'Belum ada foto.'}</div>`;
/* profil fasilitas dari Master Rate > Lokasi (opsional, untuk mengisi spesifikasi dan galeri) */
function profilUntuk(jenisList) { const r = (window.__islMR && window.__islMR.ref) || {}; return (r.profil || []).filter(p => jenisList.includes(p.jenis)); }
const FAS_LABEL = { office: 'Office', toilet: 'Toilet / kamar mandi', listrik: 'Listrik (kapasitas daya)', sumberAir: 'Air bersih', pagar: 'Pagar keliling', cctv: 'CCTV', security: 'Security 24 jam', parkirTruk: 'Parkir truk', ruangDriver: 'Ruang driver', musholla: 'Musholla', penerangan: 'Penerangan lampu area', genset: 'Genset (cadangan listrik)', apar: 'Pemadam kebakaran (sprinkler / APAR)', dockLeveler: 'Loading dock (jumlah dan spesifikasi)', jembatanTimbang: 'Timbangan truk', wifi: 'Wi-Fi' };
function terapkanProfil(st, p, citraKe) {
  if (!p) return;
  st.spek.nama = p.namaTampil || p.nama || st.spek.nama; st.spek.alamat = p.alamat || st.spek.alamat; st.spek.kota = p.kawasan || st.spek.kota;
  if (ada(p.luasBangunanM2) || ada(p.luasLahanM2)) st.spek.luas = p.luasBangunanM2 || p.luasLahanM2;
  if (p.maps !== undefined && 'maps' in st.spek) st.spek.maps = p.maps || st.spek.maps;
  Object.entries(p.fasilitas || {}).forEach(([k, v]) => { if (!v) return; const lab = FAS_LABEL[k] || k; let f = st.fasilitas.find(x => normT(x.nama) === normT(lab) || normT(x.nama).startsWith(normT(lab).split(' ')[0])); if (!f) st.fasilitas.push(f = { nama: lab, ada: false, detail: '' }); f.ada = true; });
  const fotos = (p.fotos || []).filter(f => f && (f.url || f.src));
  fotos.filter(f => f.kategori !== 'citra').slice(0, 9).forEach(f => { if (!st.foto.some(x => x.src === (f.url || f.src))) st.foto.push({ src: f.url || f.src, ket: f.keterangan || f.ket || '' }); });
  if (citraKe) fotos.filter(f => f.kategori === 'citra').slice(0, 3).forEach(f => { if (!st[citraKe].some(x => x.src === (f.url || f.src))) st[citraKe].push({ src: f.url || f.src, ket: 'Citra satelit' }); });
}
/* baris tarif bersama untuk gudang dan open yard */
function htmlBarisTarif(st, liniKey, satuanOpsi, periodeOpsi) {
  const int = lihatInt();
  /* kartu dikelompokkan per grup tabel (sama dengan desain A di pratinjau); grup bisa diganti lewat pilihan Kelompok */
  const kartu = (r, i) => { const m = num(r.modal), j = jualBaris(st, r, liniKey), mg = margin(j, m), rendah = mg !== null && mg < targetLini(liniKey);
    return `<div class="fl-item ${r.on ? 'is-on' : ''}"><div class="fl-item__h"><label class="fl-item__cek"><input type="checkbox" data-fla="row-on" data-flx="${i}" ${r.on ? 'checked' : ''} aria-label="Masuk penawaran"></label>${inpTeks(`rows.${i}.u`, r.u, 'Uraian layanan', 'class="fl-u"')}${bisaEdit() ? `<button type="button" class="fl-x" data-fla="row-hapus" data-flx="${i}" aria-label="Hapus baris" title="Hapus baris">×</button>` : ''}</div>
      <div class="fl-grid2"><label class="fl-f"><span>Satuan</span>${inpTeks(`rows.${i}.s`, r.s, 'per pallet', `list="fl-dl-sat-${liniKey}"`)}</label><label class="fl-f"><span>Periode</span>${pilihan(`rows.${i}.p`, periodeOpsi, r.p)}</label><label class="fl-f"><span>Kelompok di tabel</span>${pilihan(`rows.${i}.grup`, st.grupOpsi || ['Sewa', 'Handling', 'Layanan tambahan'], r.grup || 'Layanan tambahan')}</label></div>
      <div class="fl-harga ${int ? '' : 'fl-harga--satu'}">${int ? `<label class="fl-kotak"><small>Modal (internal)</small>${inpAngka(`rows.${i}.modal`, r.modal, 'isi')}</label>` : ''}<label class="fl-kotak"><small>Harga jual</small>${inpAngka(`rows.${i}.jual`, j, 'isi')}</label></div>
      ${int ? `<div data-flo ${mg === null ? 'hidden' : ''} class="fl-int ${rendah ? 'is-rendah' : ''}">Margin ${fmtPct(mg)} dari modal${rendah ? ' (di bawah target lini)' : ''}</div>` : rekomendasiHtml(m, liniKey, r.u)}</div>`; };
  const grupList = [...new Set([...(st.grupOpsi || []), ...(st.rows || []).map(r => r.grup || 'Layanan tambahan')])];
  return grupList.map(g => { const ids = (st.rows || []).map((r, i) => [r, i]).filter(([r]) => (r.grup || 'Layanan tambahan') === g); if (!ids.length) return ''; return `<div class="fl-bagian fl-bagian--h"><span>${esc(g)}</span></div>` + ids.map(([r, i]) => kartu(r, i)).join(''); }).join('') + datalist(`fl-dl-sat-${liniKey}`, satuanOpsi);
}
const jualBaris = (st, r, liniKey, nama) => { if (ada(num(r.jual))) return num(r.jual); return rekomendasiJual(num(r.modal), liniKey, nama || r.u); };
const htmlFasilitas = st => `<div class="fl-fas">${st.fasilitas.map((f, i) => `<div class="fl-fas__i ${f.ada ? 'is-on' : ''}"><label><input type="checkbox" data-fla="fas" data-flx="${i}" ${f.ada ? 'checked' : ''}> ${esc(f.nama)}</label>${f.ada ? inpTeks(`fasilitas.${i}.detail`, f.detail, 'Detail, mis. kapasitas atau jumlah') : ''}</div>`).join('')}</div>
  ${bisaEdit() ? `<div class="fl-baris-tombol"><input data-flfas-baru placeholder="Fasilitas lain" autocomplete="off" style="flex:1;min-width:0"><button type="button" class="mr-btn mr-btn--kecil" data-fla="fas-tambah">+ Tambah fasilitas</button></div>` : ''}`;
function aksiBersama(a, x, st, root) {
  if (a === 'row-on') { st.rows[+x].on = !st.rows[+x].on; return true; }
  if (a === 'row-hapus') { st.rows.splice(+x, 1); return true; }
  if (a === 'row-tambah') { st.rows.push({ id: uidF('r'), u: '', s: 'per bulan', p: 'bulanan', modal: null, mk: null, jual: null, on: true, grup: 'Layanan tambahan' }); return true; }
  if (a === 'fas') { st.fasilitas[+x].ada = !st.fasilitas[+x].ada; return true; }
  if (a === 'fas-tambah') { const inp = root.querySelector('[data-flfas-baru]'), n = inp ? inp.value.trim() : ''; if (!n) { toast('Isi nama fasilitas dulu.', 'bahaya'); return false; } st.fasilitas.push({ nama: n, ada: true, detail: '' }); return true; }
  if (a === 'foto-hapus') { const ks = String(x).split('.'), i = +ks.pop(); getPath(st, ks.join('.')).splice(i, 1); return true; }
  return false;
}
const ubahBaris = (path, st) => { const m = /^rows\.(\d+)\.(modal|mk)$/.exec(path); if (m) st.rows[+m[1]].jual = null; if (path === 'mk') st.rows.forEach(r => { r.mk = null; r.jual = null; }); };
/* desain A (bertingkat): nama grup digabung (rowspan) di kolom pertama; layanan pertama tebal, sisanya sub-baris */
const tabelTarifBertingkat = (st, grupUrut, liniKey) => {
  const rows = st.rows.filter(r => r.on && (jualBaris(st, r, liniKey) > 0 || String(r.teks || '').trim()));
  const grup = [...new Set([...grupUrut, ...rows.map(r => r.grup || 'Layanan tambahan')])].filter(g => rows.some(r => (r.grup || 'Layanan tambahan') === g));
  const baris = [];
  grup.forEach(g => {
    const its = rows.filter(r => (r.grup || 'Layanan tambahan') === g);
    its.forEach((r, k) => baris.push({ c: [k === 0 ? { v: g, rs: its.length, b: true } : null, k === 0 ? { v: r.u || '—', b: true } : (r.u || '—'), r.s || '—', r.p || '—', hargaSel(jualBaris(st, r, liniKey))] }));
  });
  return { jenis: 'tabel', cap: 'RINCIAN TARIF', kolom: [{ h: 'Grup', w: 22, a: 'l' }, { h: 'Layanan', w: 34, a: 'l' }, { h: 'Satuan', w: 16, a: 'l' }, { h: 'Periode', w: 10, a: 'l' }, { h: 'Harga jual (Rp)', w: 18, a: 'r' }], baris };
};
const tabelTarifDok = (st, grupUrut, liniKey) => {
  const rows = st.rows.filter(r => r.on && (jualBaris(st, r, liniKey) > 0 || String(r.teks || '').trim())); let no = 0; const baris = [];
  const grup = [...new Set([...grupUrut, ...rows.map(r => r.grup || 'Layanan tambahan')])].filter(g => rows.some(r => (r.grup || 'Layanan tambahan') === g));
  grup.forEach(g => { baris.push({ g }); rows.filter(r => (r.grup || 'Layanan tambahan') === g).forEach(r => baris.push({ c: [String(++no), r.u || '—', r.s || '—', r.p || '—', hargaSel(jualBaris(st, r, liniKey))] })); });
  return { jenis: 'tabel', cap: 'RINCIAN TARIF', kolom: [{ h: 'No', w: 6, a: 'c' }, { h: 'Layanan', w: 44, a: 'l' }, { h: 'Satuan', w: 18, a: 'l' }, { h: 'Periode', w: 13, a: 'l' }, { h: 'Harga (Rp)', w: 19, a: 'r' }], baris };
};
const barisTarif = (st, liniKey) => st.rows.filter(r => r.on && jualBaris(st, r, liniKey) > 0).map(r => ({ item: r.u, satuan: [r.s, r.p && r.p !== 'sekali' ? r.p : ''].filter(Boolean).join(' · '), jual: jualBaris(st, r, liniKey), modal: num(r.modal), bagian: r.grup || 'Layanan tambahan', liniKey }));

/* ============================ MESIN 5: GUDANG (dry, cool room, chiller, frozen) ============================ */
const JENIS_G = { dry: 'Gudang dry', cool: 'Cool room (suhu ruang)', chiller: 'Chiller', frozen: 'Frozen' };
const SUHU_G = { dry: 'Suhu ruang', cool: 'Suhu ruang', chiller: '0 s.d. +5 °C', frozen: '-18 °C atau lebih rendah' };
const SAT_G = ['per pallet', 'per ton', 'per revenue ton', 'per CBM', 'per m²', 'per chamber', 'per kontainer', 'per shipment'];
const HANDLING_G = [['Handling in per revenue ton', 'per revenue ton', 'sekali'], ['Handling in per CBM', 'per CBM', 'sekali'], ['Handling out per revenue ton', 'per revenue ton', 'sekali'], ['Handling out per CBM', 'per CBM', 'sekali'], ['Stripping dari kontainer (proses handling in)', 'per kontainer', 'sekali']].map(([u, s, p]) => ({ u, s, p, grup: 'Handling' }));
const PRESET_G = {
  dry: [['Storage per pallet', 'per pallet', 'harian'], ['Storage per pallet', 'per pallet', 'bulanan'], ['Storage per revenue ton', 'per revenue ton', 'harian'], ['Storage per revenue ton', 'per revenue ton', 'bulanan'], ['Storage per CBM', 'per CBM', 'harian'], ['Storage per CBM', 'per CBM', 'bulanan']].map(([u, s, p]) => ({ u, s, p, grup: 'Storage' })).concat(HANDLING_G),
  frozen: [['Sewa per chamber', 'per chamber', 'bulanan'], ['Sewa per pallet', 'per pallet', 'bulanan'], ['Sewa per pallet', 'per pallet', 'harian'], ['Sewa per m²', 'per m²', 'bulanan']].map(([u, s, p]) => ({ u, s, p, grup: 'Sewa' })).concat(HANDLING_G)
};
PRESET_G.cool = PRESET_G.dry; PRESET_G.chiller = PRESET_G.dry;
const FAS_G = ['CCTV', 'Air bersih', 'Office untuk standby pemilik barang', 'Listrik (kapasitas daya)', 'Loading dock (jumlah dan spesifikasi)', 'One gate system', 'Security 24 jam', 'Toilet / kamar mandi', 'Pagar keliling', 'Genset (cadangan listrik)', 'Pemadam kebakaran (sprinkler / APAR)', 'Parkir truk'];
const barisPreset = (p, on) => ({ id: uidF('r'), u: p.u, s: p.s, p: p.p, grup: p.grup, modal: null, mk: null, jual: null, on: !!on });
MESIN.gudang = {
  awal() { return { spek: { nama: '', jenis: 'dry', alamat: '', kota: '', luas: '', sistem: 'Racking', suhu: SUHU_G.dry, chamber: '' }, fasilitas: FAS_G.map(n => ({ nama: n, ada: false, detail: '' })), foto: [], rows: PRESET_G.dry.map(p => barisPreset(p, false)), mk: 20, masa: '12 bulan', grupOpsi: ['Storage', 'Sewa', 'Handling', 'Layanan tambahan'] }; },
  liniKey(st) { return st.spek.jenis === 'dry' ? 'warehouse_dry' : 'warehouse_frozen'; },
  html(st) {
    const sp = st.spek, prof = profilUntuk(['gudang_dry', 'chiller', 'cold_room', 'frozen']);
    return `${prof.length && bisaEdit() ? `<div class="fl-grid2"><label class="fl-f"><span>Isi dari profil fasilitas (Master Rate &gt; Lokasi)</span><select data-flprofil="gudang"><option value="">Pilih profil gudang…</option>${prof.map(p => `<option value="${esc(p.id)}">${esc(p.namaTampil || p.nama)}</option>`).join('')}</select></label></div>` : ''}
      <div class="fl-bagian">1. Spesifikasi gudang</div>
      <div class="fl-grid2"><label class="fl-f"><span>Nama gudang</span>${inpTeks('spek.nama', sp.nama, 'Gudang Cikarang 2')}</label><label class="fl-f"><span>Jenis gudang</span>${pilihan('spek.jenis', Object.entries(JENIS_G), sp.jenis)}</label>
        <label class="fl-f"><span>Alamat</span>${inpTeks('spek.alamat', sp.alamat, 'Jalan, nomor, kawasan')}</label><label class="fl-f"><span>Kota</span>${inpTeks('spek.kota', sp.kota, 'Cikarang, Bekasi')}</label>
        <label class="fl-f"><span>Luas gudang (m²)</span>${inpAngka('spek.luas', sp.luas, '0')}</label><label class="fl-f"><span>Sistem penyimpanan</span>${pilihan('spek.sistem', ['Racking', 'On floor', 'Racking dan on floor'], sp.sistem)}</label>
        <label class="fl-f"><span>Rentang suhu</span>${inpTeks('spek.suhu', sp.suhu, '0 s.d. +5 °C')}</label>${sp.jenis !== 'dry' ? `<label class="fl-f"><span>Jumlah chamber</span>${inpTeks('spek.chamber', sp.chamber, '6 chamber, masing-masing ±400 m²')}</label>` : ''}
        <label class="fl-f"><span>Masa kontrak</span>${inpTeks('masa', st.masa, '12 bulan', 'list="fl-dl-masa-g"')}${datalist('fl-dl-masa-g', ['12 bulan', '6 bulan', '3 bulan'])}</label></div>
      <div class="fl-mut">Chiller 0 s.d. +5 °C, frozen −18 °C atau lebih rendah, cool room suhu ruang. Rentang bisa diubah.</div>
      <div class="fl-bagian">2. Fasilitas gudang</div><div class="fl-mut">Centang fasilitas yang tersedia lalu isi detailnya.</div>${htmlFasilitas(st)}
      <div class="fl-bagian">3. Galeri foto gudang</div>${htmlGaleri(st.foto, 'foto', 'Tambah foto gudang')}
      <div class="fl-bagian">4. Tabel tarif gudang</div><div class="fl-mut">Storage per pallet, ton, revenue ton, atau CBM, harian atau bulanan. Handling in dan out per revenue ton atau CBM. Stripping dari kontainer diisi terpisah dari tarif depo.</div>
            ${htmlKatalog(st, 'gudang', 'layanan', [{ k: 'u', nama: 'Nama layanan', ph: 'Repacking' }, { k: 's', nama: 'Satuan', ph: 'per revenue ton' }, { k: 'p', nama: 'Periode', opsi: ['sekali', 'harian', 'bulanan'] }, { k: 'modal', nama: 'Modal contoh (opsional, Rp)', num: true }], 'Tambah layanan ke katalog gudang', id => st.rows.some(r => r.cid === id))}
      ${htmlBarisTarif(st, 'gudang', SAT_G, ['harian', 'bulanan', 'sekali'])}${bisaEdit() ? '<button type="button" class="fl-tambah fl-tambah--kecil" data-fla="row-tambah">+ Tambah baris</button>' : ''}`;
  },
  aksi(a, x, st, cfg, root) { return aksiBersama(a, x, st, root); },
  ubah(path, st) { ubahBaris(path, st); if (path === 'spek.jenis') { st.spek.suhu = SUHU_G[st.spek.jenis]; const lama = st.rows.filter(r => r.cid || ada(num(r.jual)) || ada(num(r.modal))); st.rows = [...PRESET_G[st.spek.jenis].map(p => barisPreset(p, false)).filter(p => !lama.some(r => r.u === p.u && r.p === p.p)), ...lama]; return true; } return false; },
  profil(st, id) { terapkanProfil(st, (profilUntuk(['gudang_dry', 'chiller', 'cold_room', 'frozen'])).find(p => p.id === id), null); },
  katItem(cfg, grup, v) { if (!v.u) throw new Error('Nama layanan wajib diisi.'); return { grup: 'layanan', u: v.u, s: v.s || 'per revenue ton', p: v.p || 'sekali', modal: num(v.modal), label: v.u }; },
  katPilih(st, c, on) { if (on) st.rows.push({ id: uidF('r'), u: c.u, s: c.s, p: c.p, modal: ada(c.modal) ? c.modal : null, mk: null, jual: null, on: true, cid: c.id, grup: 'Layanan tambahan' }); else st.rows = st.rows.filter(r => r.cid !== c.id); },
  hapusKatalog(st, cfg, id) { st.rows = st.rows.filter(r => r.cid !== id); },
  baris(st) { return barisTarif(st, this.liniKey(st)); },
  dok(st) {
    const sp = st.spek, f = st.fasilitas.filter(x => x.ada), kv = [['Nama gudang', sp.nama], ['Jenis', JENIS_G[sp.jenis]], ['Rentang suhu', sp.suhu], ['Luas gudang', ada(num(sp.luas)) ? fmt(num(sp.luas)) + ' m²' : ''], ...(sp.jenis !== 'dry' ? [['Jumlah chamber', sp.chamber]] : []), ['Sistem penyimpanan', sp.sistem], ['Lokasi', [sp.alamat, sp.kota].filter(Boolean).join(', ')], ...f.map(x => [x.nama, x.detail || 'Tersedia'])].filter(x => String(x[1] || '').trim());
    const blok = [tabelTarifDok(st, ['Sewa', 'Storage', 'Handling', 'Layanan tambahan'], this.liniKey(st)), { jenis: 'kv', cap: 'SPESIFIKASI GUDANG', baris: kv }];
    if (st.foto.length) blok.push({ jenis: 'galeri', cap: 'GALERI GUDANG', foto: st.foto });
    return { blok, info: st.masa ? [['Masa kontrak', st.masa]] : [], catatan: [] };
  },
  cek(st) { return { galat: this.baris(st).length ? [] : ['Centang dan isi minimal satu tarif gudang.'], peringatan: !st.spek.nama ? ['Nama gudang belum diisi.'] : [] }; }
};
LINI.gudang = { key: 'gudang', mesin: 'gudang', nama: 'Gudang (dry, chiller, frozen)', judul: 'Penawaran Jasa Pergudangan', ket: 'Satu penawaran untuk satu gudang: tarif, spesifikasi, fasilitas, galeri foto.', katLini: 'gudang',
};


/* ============================ MESIN 6: OPEN YARD ============================ */
const FAS_OY = ['Listrik (kapasitas daya)', 'Sumber air', 'Pagar keliling', 'CCTV', 'Security 24 jam', 'Toilet / kamar mandi', 'Office', 'Gudang indoor', 'Penerangan lampu area', 'Akses truk / trailer 40 ft', 'Timbangan truk', 'Pemadam kebakaran', 'Parkir'];
MESIN.oy = {
  awal() { return { spek: { nama: '', luas: '', alamat: '', kota: '', permukaan: 'Beton', maps: '', koord: '' }, fasilitas: FAS_OY.map(n => ({ nama: n, ada: false, detail: '' })), foto: [], citra: [],
    rows: [{ u: 'Sewa lahan', s: 'per m²', p: 'bulanan', grup: 'Sewa' }, { u: 'Listrik (sesuai pemakaian)', s: 'per bulan', p: 'bulanan', grup: 'Layanan tambahan' }, { u: 'Air (sesuai pemakaian)', s: 'per bulan', p: 'bulanan', grup: 'Layanan tambahan' }].map((p, i) => barisPreset(p, i === 0)),
    mk: 20, minLuas: 1000, minMasa: '12 bulan', luasSewa: '', deposit: 2, grupOpsi: ['Sewa', 'Layanan tambahan'] }; },
  hitung(st) { const sewa = st.rows.find(r => r.on && /sewa lahan/i.test(r.u)) || st.rows.find(r => r.on && /m²|m2/.test(r.s)); const h = sewa ? jualBaris(st, sewa) : null, min = num(st.minLuas) || 0, minta = num(st.luasSewa) || 0, tagih = Math.max(min, minta), est = ada(h) ? h * tagih : null, dep = ada(est) ? est * (num(st.deposit) || 0) : null; return { h, min, tagih, est, dep }; },
  html(st) {
    const sp = st.spek, prof = profilUntuk(['open_yard']), x = this.hitung(st);
    return `${prof.length && bisaEdit() ? `<div class="fl-grid2"><label class="fl-f"><span>Isi dari profil fasilitas (Master Rate &gt; Lokasi)</span><select data-flprofil="oy"><option value="">Pilih profil open yard…</option>${prof.map(p => `<option value="${esc(p.id)}">${esc(p.namaTampil || p.nama)}</option>`).join('')}</select></label></div>` : ''}
      <div class="fl-bagian">1. Spesifikasi lahan</div>
      <div class="fl-grid2"><label class="fl-f"><span>Nama lokasi</span>${inpTeks('spek.nama', sp.nama, 'Open Yard Cikarang 1')}</label><label class="fl-f"><span>Luas lahan total (m²)</span>${inpAngka('spek.luas', sp.luas)}</label>
        <label class="fl-f"><span>Alamat</span>${inpTeks('spek.alamat', sp.alamat, 'Jalan, nomor, kawasan')}</label><label class="fl-f"><span>Kota</span>${inpTeks('spek.kota', sp.kota, 'Cikarang, Bekasi')}</label>
        <label class="fl-f"><span>Permukaan lahan</span>${pilihan('spek.permukaan', ['Beton', 'Paving block', 'Aspal', 'Tanah merah / urugan', 'Lainnya'], sp.permukaan)}</label><label class="fl-f"><span>Google Maps (link)</span>${inpTeks('spek.maps', sp.maps, 'https://maps.app.goo.gl/...', 'inputmode="url"')}</label>
        <label class="fl-f"><span>Koordinat (opsional)</span>${inpTeks('spek.koord', sp.koord, '-6.2000, 107.1500')}</label></div>
      <div class="fl-bagian">2. Fasilitas lahan</div>${htmlFasilitas(st)}
      <div class="fl-bagian">3. Galeri foto lahan</div>${htmlGaleri(st.foto, 'foto', 'Tambah foto lahan')}
      <div class="fl-bagian">4. Citra satelit atau foto udara</div>${htmlGaleri(st.citra, 'citra', 'Tambah citra satelit')}
      <div class="fl-bagian">5. Tarif sewa dan deposit</div>
      <div class="fl-grid2"><label class="fl-f"><span>Minimum luas sewa (m²)</span>${inpAngka('minLuas', st.minLuas, '1000')}</label><label class="fl-f"><span>Minimum masa sewa</span>${inpTeks('minMasa', st.minMasa, 'Pilih atau ketik, mis. 9 bulan', 'list="fl-dl-minmasa"')}${datalist('fl-dl-minmasa', ['12 bulan', '6 bulan', '3 bulan'])}</label>
        <label class="fl-f"><span>Luas yang diminta customer (m²)</span>${inpAngka('luasSewa', st.luasSewa, 'Kosongkan untuk pakai minimum')}</label><label class="fl-f"><span>Deposit jaminan (jumlah bulan sewa)</span>${inpAngka('deposit', st.deposit, '2')}</label></div>
      <div class="fl-ringkas" data-flout="oy">${this.ringkasHtml(x)}</div>
            ${htmlKatalog(st, 'open_yard', 'layanan', [{ k: 'u', nama: 'Nama layanan', ph: 'Biaya kebersihan lahan' }, { k: 's', nama: 'Satuan', ph: 'per bulan' }, { k: 'p', nama: 'Periode', opsi: ['bulanan', 'harian', 'sekali'] }, { k: 'modal', nama: 'Modal contoh (opsional, Rp)', num: true }], 'Tambah layanan ke katalog open yard', id => st.rows.some(r => r.cid === id))}
      ${htmlBarisTarif(st, 'open_yard', ['per m²', 'per bulan', 'per kontainer', 'per shipment'], ['bulanan', 'harian', 'sekali'])}${bisaEdit() ? '<button type="button" class="fl-tambah fl-tambah--kecil" data-fla="row-tambah">+ Tambah baris</button>' : ''}`;
  },
  ringkasHtml(x) { return `<div><small>Luas ditagihkan</small><b>${fmt(x.tagih)} m²</b></div><div><small>Estimasi sewa per bulan</small><b>${x.est !== null ? fmtRp(x.est) : '—'}</b></div><div><small>Deposit</small><b>${x.dep !== null ? fmtRp(x.dep) : '—'}</b></div>`; },
  out(st, root) { const el = root.querySelector('[data-flout="oy"]'); if (el) el.innerHTML = this.ringkasHtml(this.hitung(st)); },
  aksi(a, x, st, cfg, root) { return aksiBersama(a, x, st, root); },
  ubah(path, st) { ubahBaris(path, st); return false; },
  profil(st, id) { terapkanProfil(st, profilUntuk(['open_yard']).find(p => p.id === id), 'citra'); },
  katItem(cfg, grup, v) { if (!v.u) throw new Error('Nama layanan wajib diisi.'); return { grup: 'layanan', u: v.u, s: v.s || 'per bulan', p: v.p || 'bulanan', modal: num(v.modal), label: v.u }; },
  katPilih(st, c, on) { MESIN.gudang.katPilih(st, c, on); },
  hapusKatalog(st, cfg, id) { st.rows = st.rows.filter(r => r.cid !== id); },
  baris(st) { return barisTarif(st, 'open_yard'); },
  dok(st) {
    const sp = st.spek, x = this.hitung(st), f = st.fasilitas.filter(z => z.ada), dep = num(st.deposit) || 0;
    const ring = { jenis: 'kv', cap: '', baris: [['Minimum luas sewa', fmt(x.min) + ' m²'], ['Minimum masa sewa', st.minMasa || '—'], ['Luas yang disewa', fmt(x.tagih) + ' m²'], ['Estimasi sewa lahan per bulan', x.est !== null ? `${fmtRp(x.est)} (${angkaDok(x.h)} × ${fmt(x.tagih)} m²)` : '—'], ['Deposit jaminan', dep ? `${dep} bulan sewa${x.dep !== null ? ', ' + fmtRp(x.dep) : ''}` : '—']] };
    const kv = [['Nama lokasi', sp.nama], ['Luas lahan total', ada(num(sp.luas)) ? fmt(num(sp.luas)) + ' m²' : ''], ['Permukaan', sp.permukaan], ['Lokasi', [sp.alamat, sp.kota].filter(Boolean).join(', ')], ['Google Maps', sp.maps], ['Koordinat', sp.koord], ...f.map(z => [z.nama, z.detail || 'Tersedia'])].filter(z => String(z[1] || '').trim());
    const blok = [tabelTarifBertingkat(st, ['Sewa', 'Layanan tambahan'], 'open_yard'), ring, { jenis: 'kv', cap: 'SPESIFIKASI LAHAN', baris: kv }];
    if (st.foto.length) blok.push({ jenis: 'galeri', cap: 'GALERI LAHAN', foto: st.foto });
    if (st.citra.length) blok.push({ jenis: 'galeri', cap: 'CITRA SATELIT DAN FOTO UDARA', foto: st.citra });
    return { blok, info: [], catatan: [] };
  },
  tnc(st) { const x = this.hitung(st), dep = num(st.deposit) || 0; return [{ judul: 'Ketentuan sewa lahan', items: [`Sewa lahan dihitung per m² per bulan. Luas yang ditagihkan tidak kurang dari minimum luas sewa sebesar ${fmt(x.min)} m².`, `Masa sewa minimum ${st.minMasa || '12 bulan'} sejak tanggal serah terima lahan.`, ...(dep ? [`Deposit jaminan sebesar ${dep} bulan sewa wajib dibayar sebelum lahan diserahterimakan.`] : [])] }]; },
  cek(st) { const g = []; if (!this.baris(st).length) g.push('Isi harga sewa lahan.'); if (st.spek.maps && !/^https:\/\//i.test(st.spek.maps)) g.push('Link Google Maps harus diawali https://'); return { galat: g, peringatan: !st.spek.nama ? ['Nama lokasi belum diisi.'] : [] }; }
};
LINI.open_yard = { key: 'open_yard', mesin: 'oy', liniKey: 'open_yard', nama: 'Open Yard', judul: 'Penawaran Sewa Lahan Open Yard', ket: 'Satu penawaran untuk satu lokasi. Per m² per bulan, minimum luas dan masa sewa, deposit.', katLini: 'open_yard',
};


/* ============================ MESIN 7: FREIGHT FORWARDING ============================ */
const BLOK_FF = { A: 'Freight', B: 'Origin local charges', C: 'Destinasi, custom clearance dan trucking' };
const BLOK_FF_DOK = { A: 'Freight charge', B: 'Origin local charges', C: 'Destinasi, custom clearance dan trucking' };
const ATURAN_FF = { 'Impor|EXW': { p: 1, b: 'ABC' }, 'Impor|FOB': { p: 0, b: 'AC' }, 'Impor|CIF': { p: 0, b: 'C' }, 'Impor|DDU': { p: 0, b: 'ABC' }, 'Impor|DDP': { p: 0, b: 'ABC', t: ['Bea masuk, PDRI, PPN impor, dan PPh impor (at cost sesuai SPPB)'] },
  'Ekspor|EXW': { p: 1, b: 'AB' }, 'Ekspor|FOB': { p: 1, b: 'B' }, 'Ekspor|CIF': { p: 1, b: 'AB' }, 'Ekspor|DDU': { p: 1, b: 'ABC' }, 'Ekspor|DDP': { p: 1, b: 'ABC', t: ['Bea masuk dan pajak di negara tujuan (at cost)'] } };
const TERM_FF = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'DDU'];
const CUR_FF = { USD: 'US Dollar', EUR: 'Euro', AUD: 'Australian Dollar', SGD: 'Singapore Dollar', GBP: 'Pound Sterling', MYR: 'Ringgit Malaysia', CNY: 'Yuan China', JPY: 'Yen Jepang', THB: 'Baht Thailand', IDR: 'Rupiah' };
const KECIL_FF = ['CNY', 'JPY', 'THB'];
const bumperOpt = cur => KECIL_FF.includes(cur) ? [1, 5, 10] : [500, 1000];
/* daftar item bawaan per arah dan moda: [blok, nama, satuan, mata uang, jenis tarif] (angka modal diisi dari agent) */
const ITEM_FF = {
  'Impor|Udara': [['A', 'Air freight', 'Per KG', 'USD'], ['B', 'Exwork / pickup charge', 'Per Set', 'USD'], ['B', 'Origin documentation', 'Per Shipment', 'USD'], ['C', 'Handling charge', 'Per Shipment', 'IDR', 'kg'], ['C', 'PIB (Pemberitahuan Impor Barang)', 'Per Shipment', 'IDR'], ['C', 'Fee doc charge', 'Per Shipment', 'IDR'], ['C', 'Delivery', 'Per Shipment', 'IDR']],
  'Impor|Laut': [['A', 'Ocean freight', 'Per Container', 'USD'], ['B', 'Exwork / pickup charge', 'Per Set', 'USD'], ['B', 'Origin THC dan dokumen', 'Per Container', 'USD'], ['C', 'Handling container', 'Per Container', 'IDR', 'container'], ['C', 'PIB (Pemberitahuan Impor Barang)', 'Per Shipment', 'IDR'], ['C', 'DO fee', 'Per BL', 'IDR'], ['C', 'Delivery', 'Per Container', 'IDR']],
  'Ekspor|Udara': [['A', 'Air freight', 'Per KG', 'USD'], ['B', 'Pickup', 'Per Shipment', 'IDR'], ['B', 'PEB (Pemberitahuan Ekspor Barang)', 'Per Shipment', 'IDR'], ['B', 'Handling origin', 'Per Shipment', 'IDR', 'kg'], ['C', 'Destination charges', 'Per Shipment', 'USD'], ['C', 'Delivery', 'Per Shipment', 'USD']],
  'Ekspor|Laut': [['A', 'Ocean freight', 'Per Container', 'USD'], ['B', 'Pickup / trucking ke pelabuhan', 'Per Container', 'IDR'], ['B', 'PEB (Pemberitahuan Ekspor Barang)', 'Per Shipment', 'IDR'], ['B', 'Handling container origin', 'Per Container', 'IDR', 'container'], ['C', 'Destination charges', 'Per Container', 'USD'], ['C', 'Delivery', 'Per Container', 'USD']]
};
const itemFF = ([blok, nama, satuan, cur, tier]) => ({ id: uidF('i'), blok, nama, satuan, qty: 1, cur, modal: null, mode: 'pct', mk: 15, tier: tier || 'none', modal2: null, batas: 50 });
MESIN.ff = {
  awal() { return { arah: 'Impor', term: 'EXW', moda: 'Udara', info: { pol: '', pod: '', commodity: '', berat: '', volume: '', kontainer: 1, pickup: '', delivery: '' }, legs: { pickup: 'auto', delivery: 'auto' }, kurs: { USD: { ref: '', modal: '', bumper: 500 } }, items: ITEM_FF['Impor|Udara'].map(itemFF), inc: [] }; },
  term(st) { return String(st.term || '').trim().toUpperCase(); },
  aturan(st) { return ATURAN_FF[st.arah + '|' + this.term(st)] || null; },
  blokTampil(st) { const a = this.aturan(st); return ['A', 'B', 'C'].filter(b => (!a || a.b.includes(b)) && !(st.off && st.off[b])); },
  labelBlok(cfg, b) { return BLOK_FF[b] ? `${b}. ${BLOK_FF[b]}` : null; },
  legOn(st, leg) { const m = st.legs[leg]; if (m === 'on') return true; if (m === 'off') return false; if (leg === 'delivery') return true; const a = this.aturan(st); return a ? !!a.p : false; },
  kursJual(st, cur) { const k = st.kurs[cur]; return k && num(k.ref) ? Math.ceil(num(k.ref) / (num(k.bumper) || 500)) * (num(k.bumper) || 500) : 0; },
  semuaItem(st) { return [...st.items, ...katalogLini('freight_forwarding').map(k => ({ id: k.id, blok: k.grup, nama: k.nama, satuan: k.satuan || 'Per Shipment', qty: 1, cur: k.cur || 'IDR', modal: num(k.modal), mode: 'rp', mk: 0, tier: 'none', custom: true, ...(st.custom || {})[k.id] }))]; },
  extra(st, it) { if (it.tier === 'container') return Math.max(0, (num(st.info.kontainer) || 0) - 1); if (it.tier === 'kg') return Math.max(0, (num(st.info.berat) || 0) - (num(it.batas) || 50)); return 0; },
  /* by project: tidak ada modal. Tarif = harga jual layanan yang sudah disetujui customer; kosong bila belum ada. */
  hitung(st, it) { const rek = QT()._jualSetujui ? QT()._jualSetujui('freight_forwarding', it.nama) : null, jualRp = ada(rek) ? Math.round(rek / 1000) * 1000 : 0; return { tj: jualRp, tj2: 0, ex: 0, jualAsal: jualRp, modalAsal: 0, jualRp, modalRp: 0, margin: jualRp, kj: 1, km: 1, asing: it.cur !== 'IDR' }; },
  dipakai(st) { const inc = new Set(st.inc || []), b = new Set(this.blokTampil(st)); return this.semuaItem(st).filter(it => b.has(it.blok) && (!it.custom || inc.has(it.id))); },
  riwayat(it) {
    const repo = QT()._Repo, Q = QT()._Q; if (!repo) return null;
    const cari = normT(it.nama) + '|' + it.cur, semua = repo.semua().filter(q => q.formLini && q.formLini.lini === 'freight_forwarding' && (!Q || !Q.edit || q.id !== Q.edit.id)).sort((a, b) => String(b.dibuat || '').localeCompare(String(a.dibuat || '')));
    for (const q of semua) { const x = ((q.formLini.s || {}).items || []).find(y => normT(y.nama) + '|' + y.cur === cari && ada(num(y.modal))); if (x) return num(x.modal); }
    return null;
  },
  html(st) {
    const L = UI.langkah || 1;
    const nav = `<div class="fl-steps">${[[1, 'Info'], [2, 'Biaya'], [3, 'Pratinjau']].map(([n, t]) => `<button type="button" class="fl-chipbtn" data-fla="langkah" data-flx="${n}" aria-pressed="${L === n}">${n} · ${t}</button>`).join('')}</div>`;
    return nav + (L === 1 ? this.hInfo(st) : L === 2 ? this.hBiaya(st) : this.hPreview(st)) + `<div class="fl-baris-tombol" style="justify-content:flex-end;margin-top:10px">${L > 1 ? `<button type="button" class="mr-btn mr-btn--kecil" data-fla="langkah" data-flx="${L - 1}">Kembali</button>` : ''}${L < 3 ? `<button type="button" class="mr-btn mr-btn--utama mr-btn--kecil" data-fla="langkah" data-flx="${L + 1}">Lanjut: ${L === 1 ? 'Biaya' : 'Pratinjau'}</button>` : ''}</div>`;
  },
  hInfo(st) {
    const i = st.info, udara = st.moda === 'Udara', curs = [...new Set(this.semuaItem(st).filter(x => x.cur !== 'IDR').map(x => x.cur))], ff = FL.ffMaster();
    const chip = (path, v, cur) => `<button type="button" class="fl-chipbtn" data-fla="set" data-flx="${path}|${v}" aria-pressed="${String(cur) === String(v)}">${v}</button>`;
    return `<div class="fl-kartu"><div class="fl-sub-h">Arah dan incoterm</div>
      <div class="fl-f"><span>Arah shipment</span><div class="fl-chips">${['Impor', 'Ekspor'].map(t => chip('arah', t, st.arah)).join('')}</div></div>
      <div class="fl-f"><span>Incoterm</span><div class="fl-chips">${['EXW', 'FOB', 'CIF'].map(t => chip('term', t, this.term(st))).join('')}</div>${inpTeks('term', st.term, 'Atau ketik sendiri, misalnya DDP', 'list="fl-dl-term" aria-label="Incoterm manual"')}${datalist('fl-dl-term', TERM_FF)}
        <div class="fl-mut">${this.aturan(st) ? 'Blok biaya mengikuti aturan arah dan term: ' + this.blokTampil(st).join(', ') + '.' : 'Term manual: semua blok biaya ditampilkan. Pickup diatur manual di bawah.'}</div></div>
      <div class="fl-f"><span>Moda</span><div class="fl-chips">${['Udara', 'Laut'].map(t => chip('moda', t, st.moda)).join('')}</div></div>
      <button type="button" class="mr-btn mr-btn--kecil" data-fla="item-bawaan">Muat ulang daftar item bawaan (${esc(st.arah)}, ${esc(st.moda)})</button></div>
      <div class="fl-kartu"><div class="fl-sub-h">Rute dan muatan</div><div class="fl-grid2">
        <label class="fl-f"><span>${udara ? 'Bandara asal (AOL)' : 'Pelabuhan asal (POL)'}</span>${inpTeks('info.pol', i.pol, udara ? 'TSN' : 'Shanghai, China')}</label><label class="fl-f"><span>${udara ? 'Bandara tujuan (AOD)' : 'Pelabuhan tujuan (POD)'}</span>${inpTeks('info.pod', i.pod, udara ? 'CGK' : 'Jakarta, Indonesia')}</label>
        <label class="fl-f"><span>Komoditas</span>${inpTeks('info.commodity', i.commodity, 'Jenis barang')}</label>${udara ? '' : `<label class="fl-f"><span>Jumlah kontainer</span>${inpAngka('info.kontainer', i.kontainer, '1')}</label>`}
        <label class="fl-f"><span>Berat (KG)</span>${inpAngka('info.berat', i.berat, '0')}</label><label class="fl-f"><span>Volume (CBM)</span>${inpAngka('info.volume', i.volume, '0')}</label></div>
        <div class="fl-mut">${udara ? 'Pakai kode bandara, misalnya TSN atau CGK.' : 'Pakai nama kota pelabuhan, misalnya Jakarta, Indonesia.'}</div></div>
      <div class="fl-kartu"><div class="fl-sub-h">Pickup dan delivery</div>
        ${['pickup', 'delivery'].map(leg => `<div class="fl-f"><span>${leg === 'pickup' ? 'Pickup (ambil barang)' : 'Delivery (antar barang)'}</span><div class="fl-chips">${[['auto', 'Otomatis'], ['on', 'Ada'], ['off', 'Tidak ada']].map(([v, l]) => `<button type="button" class="fl-chipbtn" data-fla="set" data-flx="legs.${leg}|${v}" aria-pressed="${st.legs[leg] === v}">${l}</button>`).join('')}</div>
          ${this.legOn(st, leg) ? inpTeks(`info.${leg}`, i[leg], leg === 'pickup' ? 'Alamat pickup' : 'Alamat delivery') : `<div class="fl-mut">Tidak ada ${leg}${leg === 'pickup' ? ' untuk term ' + esc(this.term(st)) : ''}.</div>`}</div>`).join('')}</div>
      <div class="fl-kartu"><div class="fl-sub-h">Kurs per mata uang (internal, tidak tampil di PDF)</div><div class="fl-mut">Kurs diisi di sini sebelum PDF dicetak. Mata uang yang dipakai di item muncul otomatis.</div>
        ${curs.length ? curs.map(c => { const k = st.kurs[c] = st.kurs[c] || { ref: '', modal: '', bumper: bumperOpt(c)[0] }, kj = this.kursJual(st, c); return `<div class="fl-kurs"><div class="fl-kurs__h"><b>${c}</b><span>${esc(CUR_FF[c] || c)}</span></div><div class="fl-grid2"><label class="fl-f"><span>Kurs referensi (Rp)</span>${inpAngka(`kurs.${c}.ref`, k.ref, 'isi kurs')}</label><label class="fl-f"><span>Kurs modal (Rp)</span>${inpAngka(`kurs.${c}.modal`, k.modal, 'isi kurs')}</label></div>
          <div class="fl-f"><span>Bumper (pembulatan ke atas)</span><div class="fl-chips">${bumperOpt(c).map(v => `<button type="button" class="fl-chipbtn" data-fla="set" data-flx="kurs.${c}.bumper|${v}" aria-pressed="${num(k.bumper) === v}">${fmt(v)}</button>`).join('')}</div></div><div class="fl-kj" data-flo>Kurs jual: <b>${kj ? 'Rp' + fmt(kj) + ' / ' + c : 'Isi kurs dulu'}</b></div></div>`; }).join('') : '<div class="fl-mut">Belum ada item dengan mata uang asing.</div>'}</div>
      <details class="fl-kartu"><summary class="fl-sub-h">Template S&amp;K Freight Forwarding (master)</summary>
        <div class="fl-grid2"><label class="fl-f"><span>Masa berlaku default (hari)</span><input data-ffm="masaBerlakuHari" inputmode="numeric" value="${esc(ff.masaBerlakuHari)}"></label><label class="fl-f"><span>TOP default (hari)</span><input data-ffm="topHari" inputmode="numeric" value="${esc(ff.topHari)}"></label></div>
        <label class="fl-f"><span>S&amp;K impor (satu butir per baris)</span><textarea data-ffm="impor" rows="6">${esc((ff.impor || []).join('\n'))}</textarea></label>
        <label class="fl-f"><span>S&amp;K ekspor (satu butir per baris)</span><textarea data-ffm="ekspor" rows="6">${esc((ff.ekspor || []).join('\n'))}</textarea></label>
        <label class="fl-f"><span>Butir penutup ({masaBerlakuHari} dan {topHari} diganti otomatis)</span><textarea data-ffm="penutup" rows="4">${esc((ff.penutup || []).join('\n'))}</textarea></label>
        ${bisaEdit() ? '<button type="button" class="mr-btn mr-btn--kecil" data-fla="ff-simpan-sk">Simpan template S&amp;K FF</button>' : ''}<div class="fl-mut">Berlaku untuk penawaran berikutnya. Penawaran yang sudah terbit tidak berubah.</div></details>`;
  },
  hItem(st, it, idx, int) {
    const c = this.hitung(st, it), prev = this.riwayat(it), d = prev ? (num(it.modal) - prev) / prev * 100 : null, sym = it.cur === 'IDR' ? 'Rp ' : it.cur + ' ', p = it.custom ? `custom.${it.id}` : `items.${idx}`;
    const rv = prev === null ? 'Belum ada riwayat modal' : Math.abs(d) < 0.5 ? 'Sama dengan riwayat' : (d > 0 ? 'Lebih mahal ' : 'Lebih murah ') + fmt(Math.abs(d), 1) + '%';
    return `<article class="fl-item is-on fl-ff">${it.custom ? `<label class="fl-cek"><input type="checkbox" data-fla="ff-inc" data-flx="${esc(it.id)}" ${(st.inc || []).includes(it.id) ? 'checked' : ''}> Masuk penawaran (item tambahan)</label>` : ''}
      <div class="fl-item__h">${it.custom ? `<b class="fl-u">${esc(it.nama)}</b>` : inpTeks(`${p}.nama`, it.nama, 'Nama komponen', 'class="fl-u"')}${bisaEdit() ? (it.custom ? (katalogHapusBoleh() ? `<button type="button" class="fl-x" data-fla="kat-hapus" data-flx="${esc(it.id)}" aria-label="Hapus item tambahan" title="Hapus item tambahan">×</button>` : '') : `${bisaKatalog() && it.baru ? `<button type="button" class="fl-ikon" data-fla="ff-simpan-item" data-flx="${idx}" title="Simpan item ke katalog: jadi referensi tarif untuk item yang sama di penawaran berikutnya" aria-label="Simpan item ke katalog">${IKON_SIMPAN}</button>` : ''}<button type="button" class="fl-x" data-fla="ff-hapus" data-flx="${idx}" aria-label="Hapus item" title="Hapus item">×</button>`) : ''}</div>
      <div class="fl-grid3"><label class="fl-f"><span>Satuan (basis)</span>${inpTeks(`${p}.satuan`, it.satuan, 'Per Shipment')}</label><label class="fl-f"><span>Qty</span>${inpAngka(`${p}.qty`, it.qty, '1')}</label><label class="fl-f"><span>Mata uang</span>${pilihan(`${p}.cur`, Object.keys(CUR_FF).map(k => [k, k + ' · ' + CUR_FF[k]]), it.cur)}</label></div>
      <div class="fl-calc" data-flo>Rekomendasi harga jual dari layanan yang disetujui customer${c.jualRp ? '' : ' belum ada, tarif dikosongkan'}<div class="fl-big">${c.jualRp ? fmtRp(c.jualRp) : '—'}</div>${c.jualRp ? '<span class="fl-badge">Tarif quotation disetujui customer</span>' : ''}</div></article>`;
  },
  hBiaya(st) {
    const int = lihatInt(), semua = this.semuaItem(st); let h = '';
    this.blokTampil(st).forEach(b => {
      const sub = this.dipakai(st).filter(x => x.blok === b).reduce((s, x) => s + this.hitung(st, x).jualRp, 0);
      h += `<div class="fl-kartu"><div class="fl-baris-tombol" style="justify-content:space-between"><div class="fl-sub-h" style="margin:0">${b}. ${esc(BLOK_FF[b])}</div><span class="fl-tag" data-flo>Rp ${fmt(sub)}</span>${tombolHapusBlok(b, this)}</div>
        ${st.items.map((it, i) => it.blok === b ? this.hItem(st, it, i, int) : '').join('')}${semua.filter(x => x.custom && x.blok === b).map(it => this.hItem(st, it, -1, int)).join('')}
        ${bisaEdit() ? `<div class="fl-baris-tombol"><button type="button" class="fl-tambah fl-tambah--kecil" data-fla="ff-tambah" data-flx="${b}">+ Tambah item</button></div>` : ''}</div>`;
    });
    return h;
  },
  hPreview(st) {
    const i = st.info; let gJ = 0, gM = 0, gS = 0, body = '';
    this.blokTampil(st).forEach(b => { let s = 0; body += `<div class="fl-bagian">${b}. ${esc(BLOK_FF_DOK[b])}</div>`; this.dipakai(st).filter(x => x.blok === b).forEach(it => { const c = this.hitung(st, it); s += c.jualRp; gJ += c.jualRp; gM += c.modalRp; if (c.asing) gS += c.modalAsal * (c.kj - c.km); body += `<div class="fl-ln"><span>${esc(it.nama)}</span><b>${fmtRp(c.jualRp)}</b></div>`; }); body += `<div class="fl-ln fl-ln--sub"><span>Subtotal ${b}</span><b>${fmtRp(s)}</b></div>`; });
    return `<div class="fl-kartu"><div class="fl-sub-h">${esc(st.arah)} · ${esc(st.moda)} · ${esc(this.term(st))}</div><div class="fl-mut">${esc(i.pol || '—')} → ${esc(i.pod || '—')} · ${esc(i.commodity || 'komoditas belum diisi')} · ${fmt(num(i.berat))} KG · ${fmt(num(i.volume))} CBM</div>${body}<div class="fl-ln fl-ln--tot"><span>Total</span><b>${fmtRp(gJ)}</b></div></div>
      ${lihatInt() ? `<div class="fl-kartu fl-kartu--int"><div class="fl-sub-h">Ringkasan internal (tidak ikut PDF)</div><div class="fl-ln"><span>Total modal</span><b>${fmtRp(gM)}</b></div><div class="fl-ln"><span>Margin</span><b>${fmtRp(gJ - gM)} (${gM ? fmtPct((gJ - gM) / gM * 100) : '—'})</b></div><div class="fl-ln"><span>Selisih kurs</span><b>${fmtRp(gS)}</b></div></div>` : ''}<div class="fl-mut">Pratinjau PDF lengkap: tombol Pratinjau di bar bawah.</div>`;
  },
  aksi(a, x, st, cfg, root) {
    if (a === 'langkah') { UI.langkah = +x; setTimeout(() => { const r = document.getElementById('fl-root'); if (r) r.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30); return true; }
    if (a === 'set') { const [p, v] = String(x).split('|'); setPath(st, p, /^\d+$/.test(v) ? Number(v) : v); return true; }
    if (a === 'item-bawaan') { st.items = (ITEM_FF[st.arah + '|' + st.moda] || []).map(itemFF); return true; }
    if (a === 'ff-hapus') { st.items.splice(+x, 1); return true; }
    if (a === 'ff-tambah') { const n = itemFF([x, '', 'Per Shipment', 'IDR']); n.baru = true; st.items.push(n); return true; }
    if (a === 'ff-simpan') { return false; }
    if (a === 'ff-inc') { const s = new Set(st.inc || []); s.has(x) ? s.delete(x) : s.add(x); st.inc = [...s]; return true; }
    if (a === 'ff-simpan-sk') { simpanSkFF(root); return false; }
    return false;
  },
  ubah(path, st) { if (/\.cur$/.test(path)) { const c = getPath(st, path); if (c !== 'IDR' && !st.kurs[c]) st.kurs[c] = { ref: '', modal: '', bumper: bumperOpt(c)[0] }; return true; } return /\.(tier|mode)$/.test(path); },
  katItem(cfg, grup, v) { if (!v.nama) throw new Error('Nama item wajib diisi.'); return { grup, nama: v.nama, satuan: v.satuan || 'Per Shipment', cur: v.cur || 'IDR', modal: num(v.modal), label: v.nama }; },
  hapusKatalog(st, cfg, id) { st.inc = (st.inc || []).filter(x => x !== id); if (st.custom) delete st.custom[id]; },
  baris(st) { return [...this.dipakai(st).map(it => ({ it, c: this.hitung(st, it) })).filter(x => x.c.jualRp > 0).map(({ it, c }) => ({ item: it.nama, satuan: it.satuan, jual: c.jualRp, modal: Math.round(c.modalRp) || null, desk: `${it.cur} ${fmt(c.tj)}${c.ex ? ' + ' + fmt(c.ex) + ' × ' + fmt(c.tj2) : ''}`, bagian: BLOK_FF_DOK[it.blok] })), ...barisBlokX(st).map(r => ({ ...r, jual: Math.round(r.jual * r.qty), qty: 1, satuan: r.satuan || '' }))]; },
  dok(st) {
    const i = st.info, udara = st.moda === 'Udara', blokDok = []; let baris = [], no = 0, total = 0;
    /* desain C: satu kartu per blok (judul blok sebagai pita), total di kartu terakhir */
    const KOL_FF = [{ h: 'No', w: 6, a: 'c' }, { h: 'Komponen biaya', w: 34, a: 'l' }, { h: 'Tarif (asal)', w: 18, a: 'r' }, { h: 'Basis', w: 16, a: 'l' }, { h: 'Qty', w: 8, a: 'c' }, { h: 'Jumlah (Rp)', w: 18, a: 'r' }];
    const mulai = cap => { baris = []; blokDok.push({ jenis: 'tabel', kelas: 'isl-trl', cap, kolom: KOL_FF, baris }); };
    const tarifAsal = (it, v) => `${it.cur} ${fmt(v)}`;
    this.blokTampil(st).forEach(b => {
      const its = this.dipakai(st).filter(x => x.blok === b).map(it => ({ it, c: this.hitung(st, it) })).filter(x => x.c.jualRp > 0), tamb = b === 'C' || (b === 'B' && st.arah === 'Ekspor') ? ((this.aturan(st) || {}).t || []) : [];
      if (!its.length && !(b === 'C' && tamb.length)) return;
      mulai(`${b}. ${BLOK_FF_DOK[b]}`); let sub = 0;
      its.forEach(({ it, c }) => {
        const kj = c.kj || 1, dasarRp = it.tier !== 'none' ? Math.round(c.tj * (num(it.qty) || 0) * kj / 1000) * 1000 : c.jualRp;
        const nmDasar = it.tier === 'kg' ? `${it.nama} (s.d. ${fmt(num(it.batas) || 50)} KG)` : it.tier === 'container' ? `${it.nama} (kontainer pertama)` : it.nama;
        baris.push({ c: [String(++no), nmDasar, tarifAsal(it, c.tj), it.satuan, fmt(num(it.qty)), angkaDok(dasarRp)] });
        if (it.tier !== 'none' && c.ex > 0) baris.push({ c: [String(++no), it.tier === 'kg' ? `${it.nama} tambahan (di atas ${fmt(num(it.batas) || 50)} KG)` : `${it.nama} (kontainer tambahan)`, tarifAsal(it, c.tj2), it.tier === 'kg' ? 'Per KG' : 'Per Container', fmt(c.ex), angkaDok(c.jualRp - dasarRp)] });
        sub += c.jualRp;
      });
      if (b === 'C' || (b === 'B' && st.arah === 'Ekspor' && !this.blokTampil(st).includes('C'))) tamb.forEach(t => baris.push({ c: [String(++no), t, 'At cost', 'Sesuai dokumen', '1', 'At cost'] }));
      baris.push({ sub: [`Subtotal ${b}`, angkaDok(sub)] }); total += sub;
    });
    blokXAda(st).forEach((bx, bxi) => {
      const rows = (bx.rows || []).filter(barisXValid); if (!rows.length) return;
      mulai(`${String.fromCharCode(68 + bxi)}. ${String(bx.judul || 'Layanan tambahan').trim()}`); let sub = 0;
      rows.forEach(r => { const q = ada(num(r.qty)) && num(r.qty) > 0 ? num(r.qty) : 1, j = Math.round(num(r.jual) * q); baris.push({ c: [String(++no), String(r.n).trim(), `Rp ${fmt(num(r.jual))}`, r.satuan || '—', fmt(q), angkaDok(j)] }); sub += j; });
      baris.push({ sub: [`Subtotal ${String.fromCharCode(68 + bxi)}`, angkaDok(sub)] }); total += sub;
    });
    mulai(null); baris.push({ tot: ['TOTAL BIAYA PENGIRIMAN', angkaDok(total)] });
    const judul = `${udara ? 'AIR' : 'SEA'} FREIGHT ${st.arah === 'Impor' ? 'IMPORT' : 'EXPORT'} QUOTATION · ${this.term(st)}`;
    const info = [['Komoditas', i.commodity], ['Rute', `${i.pol || '—'} → ${i.pod || '—'}`], ['Berat / volume', [num(i.berat) ? fmt(num(i.berat)) + ' KG' : '', num(i.volume) ? fmt(num(i.volume)) + ' CBM' : '', !udara && num(i.kontainer) ? fmt(num(i.kontainer)) + ' kontainer' : ''].filter(Boolean).join(' · ')], ...(this.legOn(st, 'pickup') ? [['Pickup', i.pickup]] : []), ...(this.legOn(st, 'delivery') ? [['Delivery', i.delivery]] : [])].filter(x => String(x[1] || '').trim());
    return { blok: blokDok, info: [['Jenis', judul], ...info], catatan: [] };
  },
  tncGanti(st) {
    const ff = FL.ffMaster(), t = this.term(st), ganti = s => String(s).replace('{masaBerlakuHari}', ff.masaBerlakuHari).replace('{topHari}', ff.topHari);
    const items = [...(st.arah === 'Ekspor' ? ff.ekspor : ff.impor), ...(ff.klausulModa && ff.klausulModa[st.moda] ? [ff.klausulModa[st.moda]] : []), ...(ff.klausulTerm && ff.klausulTerm[t] ? [ff.klausulTerm[t]] : []), ...(ff.penutup || []).map(ganti)];
    return [{ judul: '', items }];
  },
  cek(st) {
    const g = [], pk = [];
    if (!this.baris(st).length) g.push('Belum ada item dengan tarif disetujui customer.');
    [...new Set(this.dipakai(st).filter(x => x.cur !== 'IDR' && num(x.modal) > 0).map(x => x.cur))].forEach(c => { if (!this.kursJual(st, c)) g.push(`Isi kurs referensi ${c} di langkah 1.`); if (!num((st.kurs[c] || {}).modal)) pk.push(`Kurs modal ${c} belum diisi, margin belum akurat.`); });
    if (!st.info.pol || !st.info.pod) pk.push('Rute asal dan tujuan belum lengkap.');
    return { galat: g, peringatan: pk };
  }
};
async function simpanSkFF(root) {
  const p = PENG(), repo = QT()._Repo; if (!p || !repo) return toast('Pengaturan belum siap.', 'bahaya');
  const v = k => { const el = root.querySelector(`[data-ffm="${k}"]`); return el ? el.value : ''; }, lama = clone(p.ffMaster || FL.FF_AWAL);
  p.ffMaster = { ...lama, masaBerlakuHari: num(v('masaBerlakuHari')) || 5, topHari: num(v('topHari')) || 30, impor: satuDua(v('impor')), ekspor: satuDua(v('ekspor')), penutup: satuDua(v('penutup')) };
  try { await repo.simpanPengaturan(p); toast('Template S&amp;K Freight Forwarding tersimpan dan terverifikasi.'); }
  catch (er) { p.ffMaster = lama; toast(`<b>GAGAL menyimpan.</b> ${esc(er.message)}`, 'bahaya'); }
}
LINI.freight_forwarding = { key: 'freight_forwarding', mesin: 'ff', liniKey: 'freight_forwarding', nama: 'Freight Forwarding', judul: 'Penawaran Freight Forwarding', ket: 'Impor atau ekspor, udara atau laut, EXW/FOB/CIF atau term lain. Kurs dan bumper per penawaran, markup per item.', tipe: 'project',
};



/* ============================ BLOK TAMBAHAN (T-01) DAN HAPUS BLOK (T-02) ============================ */
/* st.blokX = [{ id, judul, rows: [{ id, n, satuan, qty, modal, jual, ket, _cid }] }]  berlaku untuk semua lini.
   st.off = { <kunci blok>: true }  blok bawaan yang disembunyikan (tidak tampil di formulir dan PDF), dipulihkan lewat chip. */
const barisX = () => ({ id: uidF('x'), n: '', satuan: '', qty: 1, modal: null, jual: null, ket: '' });
const blokXAda = st => Array.isArray(st.blokX) ? st.blokX : [];
const barisXValid = r => String(r.n || '').trim() && ada(num(r.jual)) && num(r.jual) > 0;
const blokXRows = st => blokXAda(st).flatMap(b => (b.rows || []).filter(barisXValid).map(r => ({ b, r })));
const refKatalog = (lini, nama) => { const n = normT(nama); return n ? katalogLini(lini, 'tambahan').find(c => normT(c.n) === n) : null; };
function htmlBlokX(st, cfg) {
  const ed = bisaEdit(), int = lihatInt(), lini = cfg.katLini || cfg.key, X = blokXAda(st), dl = katalogLini(lini, 'tambahan');
  let h = dl.length ? datalist('fl-dl-bx', dl.map(c => c.n)) : '';
  X.forEach((b, bi) => {
    h += `<div class="fl-bx"><div class="fl-bx__h">${ed ? inpTeks(`blokX.${bi}.judul`, b.judul, 'Nama blok', 'class="fl-u" aria-label="Nama blok"') : `<b>${esc(b.judul)}</b>`}${ed ? `<button type="button" class="fl-x fl-x--teks" data-fla="bx-hapus" data-flx="${bi}" title="Hapus blok ini beserta barisnya">Hapus blok</button>` : ''}</div>
      <div class="fl-bx__tbl"><div class="fl-bx__hd"><span>Layanan</span><span>Satuan</span><span class="r">Qty</span>${int ? '<span class="r">Modal</span>' : ''}<span class="r">Harga jual</span><span>Keterangan</span><span></span></div>`;
    (b.rows || []).forEach((r, ri) => {
      const p = `blokX.${bi}.rows.${ri}`, ref = refKatalog(lini, r.n), pakaiRef = ref && ((ada(ref.jual) && num(ref.jual) !== num(r.jual)) || (ada(ref.modal) && num(ref.modal) !== num(r.modal)));
      h += `<div class="fl-bx__r"><label class="fl-bx__c" data-l="Layanan">${inpTeks(`${p}.n`, r.n, 'Nama layanan', 'list="fl-dl-bx"')}</label><label class="fl-bx__c" data-l="Satuan">${inpTeks(`${p}.satuan`, r.satuan, 'per kontainer')}</label>
        <label class="fl-bx__c" data-l="Qty">${inpAngka(`${p}.qty`, r.qty, '1')}</label>${int ? `<label class="fl-bx__c" data-l="Modal">${inpAngka(`${p}.modal`, r.modal, 'opsional')}</label>` : ''}<label class="fl-bx__c" data-l="Harga jual">${inpAngka(`${p}.jual`, r.jual, '0')}</label>
        <label class="fl-bx__c" data-l="Keterangan">${inpTeks(`${p}.ket`, r.ket, 'Opsional')}</label>
        <span class="fl-bx__a">${ed ? `${bisaKatalog() ? `<button type="button" class="fl-ikon" data-fla="bx-simpan" data-flx="${bi}.${ri}" title="Simpan ke katalog: jadi referensi tarif untuk item yang sama di penawaran berikutnya" aria-label="Simpan item ke katalog">${IKON_SIMPAN}</button>` : ''}<button type="button" class="fl-x" data-fla="bx-baris-hapus" data-flx="${bi}.${ri}" aria-label="Hapus baris" title="Hapus baris">×</button>` : ''}</span>
        <div class="fl-bx__ref" data-flo ${ref ? '' : 'hidden'}>${ref ? `Tersimpan di katalog: ${ada(ref.jual) ? 'jual ' + fmtRp(ref.jual) : ''}${ada(ref.modal) ? ' · modal ' + fmtRp(ref.modal) : ''}${ref.satuan ? ' · ' + esc(ref.satuan) : ''}${pakaiRef ? ` <button type="button" class="fl-tuju" data-fla="bx-ref" data-flx="${bi}.${ri}|${esc(ref.id)}">Pakai referensi ini</button>` : ' (sama dengan isian)'}` : ''}</div></div>`;
    });
    h += `</div>${ed ? `<div><button type="button" class="fl-tambah fl-tambah--kecil" data-fla="bx-baris" data-flx="${bi}">+ Tambah baris</button></div>` : ''}</div>`;
  });
  return h;
}
const IKON_SIMPAN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>';
/* kunci blok bawaan yang sedang disembunyikan -> chip pemulihan. M.labelBlok(cfg, kunci) menamai blok; mesin tanpa labelBlok tidak mendukung hapus blok. */
function htmlBlokOff(st, cfg, M) {
  const k = Object.keys(st.off || {}).filter(x => st.off[x]); if (!k.length || !M.labelBlok) return '';
  return `<div class="fl-off"><span class="fl-mut">Blok disembunyikan (tidak masuk PDF):</span>${k.map(x => `<button type="button" class="fl-chipbtn" data-fla="bag-pulih" data-flx="${esc(x)}">${esc(M.labelBlok(cfg, x) || x)} ↺ tampilkan</button>`).join('')}</div>`;
}
function htmlBlokBawah(st, cfg, M) {
  return htmlBlokOff(st, cfg, M) + htmlBlokX(st, cfg) + (bisaEdit() ? `<div class="fl-baris-tombol"><button type="button" class="mr-btn mr-btn--kecil" data-fla="bx-tambah-blok">+ Tambah blok</button><span class="fl-mut">Blok baru berisi baris layanan sendiri dan ikut masuk PDF.</span></div>` : '');
}
const IKON_TUTUP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const tombolHapusBlok = (kunci, M) => (bisaEdit() && M.labelBlok) ? `<button type="button" class="fl-x" data-fla="bag-hapus" data-flx="${esc(kunci)}" aria-label="Hapus blok" title="Hapus blok: disembunyikan dari formulir dan PDF">${IKON_TUTUP}</button>` : '';
function dokBlokX(st) {
  return blokXAda(st).map(b => ({ b, rows: (b.rows || []).filter(barisXValid) })).filter(x => x.rows.length).map(({ b, rows }, i) => {
    let no = 0;
    return { jenis: 'tabel', cap: String(b.judul || 'Layanan tambahan').trim(), kolom: [{ h: 'No', w: 6, a: 'c' }, { h: 'Layanan', w: 34, a: 'l' }, { h: 'Satuan', w: 18, a: 'l' }, { h: 'Qty', w: 8, a: 'c' }, { h: 'Tarif (Rp)', w: 16, a: 'r' }, { h: 'Keterangan', w: 18, a: 'l' }],
      baris: rows.map(r => ({ c: [String(++no), String(r.n).trim(), r.satuan || '—', fmt(ada(num(r.qty)) ? num(r.qty) : 1), angkaDok(num(r.jual)), r.ket || '—'] })) };
  });
}
const barisBlokX = st => blokXRows(st).map(({ b, r }) => ({ item: String(r.n).trim(), satuan: r.satuan || '', qty: ada(num(r.qty)) && num(r.qty) > 0 ? num(r.qty) : 1, jual: num(r.jual), modal: ada(num(r.modal)) ? num(r.modal) : null, desk: r.ket || '', bagian: String(b.judul || '').trim() }));
const adaGalatKosong = g => /^(Isi minimal|Pilih |Centang)/.test(g);
function cekGabung(cfg, st) {
  const c = panggil(cfg, 'cek', st) || { galat: [], peringatan: [] };
  const X = blokXAda(st), tambahan = [];
  X.forEach(b => (b.rows || []).forEach(r => { if (String(r.n || '').trim() && !(num(r.jual) > 0)) tambahan.push(`Baris “${String(r.n).trim()}” di blok “${b.judul}” belum punya harga jual.`); if (!String(r.n || '').trim() && num(r.jual) > 0) tambahan.push(`Ada baris di blok “${b.judul}” yang punya harga tetapi belum ada nama layanan.`); }));
  const galat = blokXRows(st).length ? (c.galat || []).filter(g => !adaGalatKosong(g)) : (c.galat || []);
  return { galat: [...galat, ...tambahan.filter(t => /belum ada nama/.test(t))], peringatan: [...(c.peringatan || []), ...tambahan.filter(t => !/belum ada nama/.test(t))] };
}
async function konfirmasiFL(o) { return C().konfirmasi ? await C().konfirmasi(o) : confirm(o.judul); }
/* Pop-up peringatan sebelum Pratinjau dan Terbitkan: layanan yang dicentang tetapi harga jualnya belum diisi akan memakai harga referensi. Ditanya sekali per daftar yang sama. */
let refSetuju = { id: null, sig: '' };
FL.konfirmasiReferensi = async e => {
  const cfg = cfgDari(e && e.formLini); if (!cfg || !cfg.refJual) return true;
  const M = mesinDari(cfg); if (!M || !M.itemReferensi) return true;
  const daftar = M.itemReferensi(e.formLini.s, cfg); if (!daftar.length) return true;
  const sig = JSON.stringify(daftar.map(x => [x.nama, x.harga])); if (refSetuju.id === (e.id || null) && refSetuju.sig === sig) return true;
  const tampil = daftar.slice(0, 12).map(x => `<li><span>${esc(x.nama)}</span> <b>${fmtRp(x.harga)}</b></li>`).join('') + (daftar.length > 12 ? `<li>dan ${daftar.length - 12} layanan lain</li>` : '');
  const ya = await konfirmasiFL({ judul: 'Harga jual belum terisi', aksi: 'Lanjutkan dengan harga referensi', isi: `<p>Tarif ${daftar.length === 1 ? 'layanan ini belum terisi' : `${daftar.length} layanan ini belum terisi`}. Jika tidak diisi, sistem mengisinya otomatis berdasarkan <b>harga referensi jual</b>:</p><ul class="fl-ref-daftar">${tampil}</ul><p>Pilih <b>Lanjutkan</b> untuk memakai harga referensi, atau <b>Batal</b> untuk kembali dan mengisi harganya sendiri.</p>` });
  if (ya) refSetuju = { id: e.id || null, sig };
  return !!ya;
};

/* Depo (lini dengan rekomendasi bawaan): layanan tercentang yang kolom harganya kosong dan tidak punya rekomendasi. Angka 0 yang diketik berarti sengaja tidak ditawarkan. */
FL.hargaKosong = e => {
  const cfg = cfgDari(e && e.formLini); if (!cfg || !cfg.rekAwal) return [];
  const st = e.formLini.s, out = [];
  cfg.bagian.forEach((b, bi) => { if (st.off && st.off[bi]) return; (st.rows[bi] || []).forEach(r => {
    if (!rowAktif(r, b.kolom) || !String(r.uraian || '').trim()) return;
    const ukuran = b.kolom.filter(k => k.num && tanpaIsi(r[k.k]) && rekOtomatis(cfg, b, r, k) === null).map(k => String(k.nama).replace(/\s*\(Rp\)\s*$/i, ''));
    if (ukuran.length) out.push({ nama: String(r.uraian).trim(), ukuran, semua: ukuran.length === b.kolom.filter(k => k.num).length });
  }); });
  return out;
};
/* Pop-up sebelum terbit: ada tarif yang belum diisi. Tidak memblokir; bila dilanjutkan, layanan tanpa harga tidak tampil di PDF. Ditanya sekali per daftar yang sama. */
let kosongSetuju = { id: null, sig: '' };
FL.konfirmasiKosong = async e => {
  const daftar = FL.hargaKosong(e); if (!daftar.length) return true;
  const sig = JSON.stringify(daftar.map(x => [x.nama, x.ukuran])); if (kosongSetuju.id === (e.id || null) && kosongSetuju.sig === sig) return true;
  const tampil = daftar.slice(0, 12).map(x => `<li><b>${esc(x.nama)}</b> <span>${x.semua ? 'belum ada harga' : esc(x.ukuran.join(', ')) + ' belum diisi'}</span></li>`).join('') + (daftar.length > 12 ? `<li>dan ${daftar.length - 12} layanan lain</li>` : '');
  const ya = await konfirmasiFL({ judul: 'Ada tarif yang belum diisi', aksi: 'Lanjutkan tanpa layanan ini', batal: 'Kembali, isi tarif', isi: `<p>${daftar.length === 1 ? 'Satu layanan tercentang belum punya harga' : `${daftar.length} layanan tercentang belum punya harga`} dan tidak ada harga rekomendasinya. Jika dilanjutkan, layanan tanpa harga <b>tidak ditampilkan di PDF</b> (ukuran yang kosong tampil “—”). Penerbitan tidak diblokir.</p><ul class="mr-konfirm__daftar">${tampil}</ul>` });
  if (ya) kosongSetuju = { id: e.id || null, sig };
  return !!ya;
};

/* ============================ JEMBATAN KE EDITOR QUOTATION ============================ */
const URUT_DAFTAR = ['depo', 'distribusi_kecil', 'trucking_trailer', 'sewa_unit', 'customs_clearance', 'gudang_plb', 'sewa_container_empty', 'gudang', 'open_yard', 'freight_forwarding'];
/* ============================ FORMAT LINI BUATAN (F-02..F-04): definisi disimpan di Firestore (format_lini), dijalankan oleh mesin tabel ============================ */
FL.formatBuatan = [];
function cfgDariDef(d) {
  const kolom = (d.kolom || []).map(k => ({ k: k.k, nama: k.nama, num: !!k.num, ph: k.ph || '' })), teks = kolom.filter(k => !k.num), angkaK = kolom.filter(k => k.num);
  const kUr = teks[0] ? teks[0].k : null, kSat = (teks.find(k => /satuan|unit|uom/i.test(k.nama)) || {}).k, huruf = i => String.fromCharCode(65 + (i % 26));
  const bagian = (d.bagian || []).map((b, i) => ({ judul: `${huruf(i)}. ${b.judul}`, sub: b.sub || '', kolom: clone(kolom), baris: (b.baris || []).map(r => Object.fromEntries(kolom.map(k => [k.k, r[k.k] ?? '']))) }));
  const lebar = (() => { const nNum = angkaK.length, nTek = teks.length, sisa = 94 - 15 * nNum; const wTek = nTek ? Math.max(10, Math.floor(sisa / nTek)) : 0; const w = kolom.map(k => k.num ? 15 : wTek); const tot = 6 + w.reduce((a, b) => a + b, 0); return w.map(x => Math.round(x * 100 / tot * 10) / 10); })();
  return { key: d.kode, mesin: 'tabel', liniKey: d.kode, katLini: d.kode, nama: d.nama, judul: d.judul || `Penawaran ${d.nama}`, ket: d.ket || '', pembuka: d.pembuka || '', custom: true, bagian,
    baris(st) {
      const out = [];
      this.bagian.forEach((b, bi) => { if (st.off && st.off[bi]) return; (st.rows[bi] || []).forEach(r => angkaK.forEach(k => {
        const j = num(r[k.k]); const nm = String(r[kUr] || '').trim(); if (!(j > 0) || !nm) return;
        out.push({ item: angkaK.length > 1 ? `${nm} (${k.nama})` : nm, satuan: kSat ? (r[kSat] || '') : '', jual: j, modal: angkaK.length === 1 ? modalMR(d.kode, nm) : null,
          desk: kolom.filter(x => !x.num && x.k !== kUr && x.k !== kSat).map(x => r[x.k]).filter(Boolean).join(' · '), bagian: tanpaHuruf(b.judul) });
      })); });
      return out;
    },
    dok(st) {
      let no = 0; const blok = [];
      this.bagian.forEach((b, bi) => {
        if (st.off && st.off[bi]) return;
        const rows = (st.rows[bi] || []).filter(r => angkaK.some(k => num(r[k.k]) > 0)); if (!rows.length) return;
        blok.push({ jenis: 'tabel', cap: tanpaHuruf(judulTampil(st, bi, b)), sub: b.sub, kolom: [{ h: 'No', w: 6, a: 'c' }, ...kolom.map((k, i) => ({ h: k.nama, w: lebar[i], a: k.num ? 'c' : 'l' }))],
          baris: rows.map(r => ({ c: [String(++no), ...kolom.map(k => k.num ? hargaSel(r[k.k]) : (String(r[k.k] ?? '').trim() || '—'))] })) });
      });
      return { blok, catatan: [] };
    },
    cek(st) { return { galat: this.baris(st).length ? [] : [`Isi minimal satu tarif ${d.nama}.`], peringatan: [] }; } };
}
FL.daftarkan = d => { if (!d || !d.kode) return; if (LINI[d.kode] && !LINI[d.kode].custom) return; LINI[d.kode] = cfgDariDef(d); };
FL.muatFormat = arr => { FL.formatBuatan = Array.isArray(arr) ? arr.map(x => ({ ...x })) : []; FL.formatBuatan.forEach(FL.daftarkan); };
FL.kodeDipakai = k => !!LINI[k];
FL.cfgLini = key => LINI[key] || null;
/* apakah formulir lini ini punya fitur tarif minimum dari Master Rate (untuk saklar di Pengaturan lini) */
FL.dukungMin = k => !!(LINI[k] && LINI[k].tarifMinimum);
/* daftar harga rekomendasi template (untuk tab di Pengaturan lini): blok > layanan > kolom ukuran, dengan angka bawaan */
FL.rekDaftar = lini => {
  const cfg = LINI[lini]; if (!cfg || !cfg.rekAwal) return null;
  return cfg.bagian.map(b => ({ judul: tanpaHuruf(b.judul), baris: b.baris.map(r => ({ nama: r.uraian, sel: b.kolom.filter(k => k.num).map(k => { const sp = minSpek(cfg, b, r, k); if (!sp) return null; const kunci = kunciMin(sp.nama, sp.dim); return { label: String(k.nama).replace(/\s*\(Rp\)\s*$/i, ''), kunci, def: cfg.rekAwal[kunci] ?? null }; }).filter(Boolean) })) }));
};
/* daftar tarif minimum untuk tab di Pengaturan lini: sama dengan rekDaftar, tetapi angka abu-abu = minimum otomatis (modal tertinggi vendor + markup) */
FL.minDaftar = lini => {
  const cfg = LINI[lini]; if (!cfg || !cfg.rekAwal) return null;
  return cfg.bagian.map(b => ({ judul: tanpaHuruf(b.judul), baris: b.baris.map(r => ({ nama: r.uraian, sel: b.kolom.filter(k => k.num).map(k => { const sp = minSpek(cfg, b, r, k); if (!sp) return null; const kand = minKandidat(cfg.liniKey, sp.nama, sp.dim); return { label: String(k.nama).replace(/\s*\(Rp\)\s*$/i, ''), kunci: kunciMin(sp.nama, sp.dim), def: kand.length ? kand[0].min : null }; }).filter(Boolean) })) }));
};
FL.daftar = () => [...URUT_DAFTAR, ...FL.formatBuatan.map(d => d.kode).filter(k => LINI[k] && !URUT_DAFTAR.includes(k))].map(k => ({ key: k, nama: LINI[k].nama, ket: LINI[k].ket, custom: !!LINI[k].custom }));
function migrasiSce(fl) {
  const s = fl && fl.s; if (!s || fl.lini !== 'sewa_container_empty' || s.rows) return;
  const rows = [];
  Object.entries(s.pilih || {}).forEach(([key, c]) => { const t = TIPE_SCE.find(x => x.key === key) || katalogLini('sewa_container_empty', 'tipe').map(k => ({ key: k.id, g: k.g, n: k.n })).find(x => x.key === key); if (!t) return;
    ['harian', 'mingguan', 'bulanan'].forEach(p => { const v = (c || {})[p]; if (v && ada(v.jual) && num(v.jual) > 0) rows.push({ tipe: t.g, ukuran: t.n, periode: p[0].toUpperCase() + p.slice(1), harga: v.jual, ket: '' }); }); });
  fl.s = { rows: { 0: rows.length ? rows : clone(LINI.sewa_container_empty.bagian[0].baris) }, opsi: {} };
}
const cfgDari = fl => { if (fl && fl.lini === 'sewa_container_empty') migrasiSce(fl); return fl && LINI[fl.lini]; };
const mesinDari = cfg => cfg && MESIN[cfg.mesin];
const panggil = (cfg, nama, st, ...arg) => { if (cfg && typeof cfg[nama] === 'function') return cfg[nama](st, ...arg); const M = mesinDari(cfg); if (M && typeof M[nama] === 'function') return M[nama](st, cfg, ...arg); return undefined; };
FL.liniKey = fl => { const cfg = cfgDari(fl); if (!cfg) return ''; if (cfg.liniKey) return cfg.liniKey; const M = mesinDari(cfg); return M && M.liniKey ? M.liniKey(fl.s) : ''; };
FL.nama = fl => { const c = cfgDari(fl); return c ? c.nama : ''; };

/* quotation baru dari format lini */
FL.terapkanAwal = (e, key) => {
  const cfg = LINI[key]; if (!cfg) return; const M = mesinDari(cfg);
  e.formLini = { lini: key, v: FL.versi, s: M.awal(cfg) };
  UI.tambah = null; UI.addTipe = false; UI.langkah = 1; UI.ubahBlok = null; UI.buka = new Set([0]); UI.ket = new Set();
  if (!String(e.judul || '').trim()) e.judul = cfg.judul;
  e.tipe = cfg.tipe || 'satuan'; e.tabelMode = 'lini'; e.modeTambahan = 'rinci';
  /* kalimat pembuka dan penutup: kerangka baku seragam (R.kalimatDasar). Hanya format lini buatan sendiri yang boleh membawa kalimat pembuka sendiri. */
  e.gayaLini = ''; e.presetId = null; e.pembukaEn = ''; e.penutupEn = '';
  e.pembukaTeks = cfg.custom && cfg.pembuka ? cfg.pembuka : null; e.penutupTeks = null;
  if (key === 'freight_forwarding') e.berlakuSampai = tambahHari(hariIni(), Number(FL.ffMaster().masaBerlakuHari) || 5);
  /* nilai bawaan S&K lini ini (masa berlaku, TOP jasa, TOP reimbursement, denda) dari Pengaturan dokumen */
  const R = QT()._R, sk = R && R.syaratLini ? R.syaratLini(key) : null;
  if (sk) Object.assign(e, { berlakuSampai: hariIni().slice(0, 4) + '-12-31', topLayanan: sk.topLayanan, topPihak: sk.topPihak, dendaPihak: sk.dendaPihak, dendaPihakAktif: sk.dendaAktif, dendaBulan: sk.dendaBulan, dendaBulanAktif: sk.dendaBulanAktif });
  FL.sinkron(e);
};
/* isi formulir -> baris quotation (dipakai untuk total, margin, rate disetujui, laporan, Word) */
FL.sinkron = e => {
  const cfg = cfgDari(e && e.formLini); if (!cfg) return;
  const lk = FL.liniKey(e.formLini), nm = (C().namaLini ? C().namaLini(lk) : '') || cfg.nama;
  const rows = [...(panggil(cfg, 'baris', e.formLini.s) || []), ...(cfg.mesin === 'ff' ? [] : barisBlokX(e.formLini.s))];
  e.baris = rows.map((r, i) => {
    const l = r.liniKey || lk, modal = ada(r.modal) ? Math.round(Number(r.modal)) : null;
    return { id: 'fl' + i, jenis: 'rate', urut: i, liniKey: l, liniNama: l === lk ? nm : ((C().namaLini && C().namaLini(l)) || nm), item: String(r.item || '').trim(), itemEn: '', deskripsi: r.desk || '', satuan: r.satuan || '', qty: ada(r.qty) ? Number(r.qty) : 1,
      jual: Math.round(Number(r.jual) || 0), modal, jualSaran: null, dioverride: true, asing: false, bagian: r.bagian || '', modalDariMR: false, dariFormulir: true, minJual: ada(r.min) && Number(r.min) > 0 ? Math.round(Number(r.min)) : null };
  });
};
/* ringkasan untuk kartu daftar / mode baca */
FL.label = q => q && q.formLini ? `Format ${FL.nama(q.formLini)}` : '';

/* P-01: peringatan jadi pintasan. S&K di Master Rate dibuka di tab baru (draf tidak hilang); isian di formulir diberi fokus. */
const TUJU_MR = { 'Sewa Unit': 'sewa_unit', 'Trucking Trailer': 'trucking_trailer', 'Distribusi Kendaraan Kecil': 'distribusi_kecil' };
const TUJU_FOKUS = [[/nama gudang/i, '[data-fl="spek.nama"]'], [/kurs referensi/i, '[data-fl*="kurs"]'], [/google maps/i, '[data-fl="spek.maps"]'], [/harga sewa lahan|tarif|harga jual/i, '#fl-root input[data-fn="1"]']];
function liTuju(t) {
  const m = /Master Rate > Lini Bisnis > ([^.]+)\./.exec(t), id = m && TUJU_MR[m[1].trim()];
  if (id) return `<button type="button" class="fl-tuju" data-tuju-mr="${id}" title="Buka isian S&K di Master Rate (tab baru)">${esc(t)} <span>Isi sekarang ↗</span></button>`;
  const f = TUJU_FOKUS.find(([re]) => re.test(t));
  return f ? `<button type="button" class="fl-tuju" data-tuju-fokus="${esc(f[1])}" title="Ke isian ini">${esc(t)}</button>` : esc(t);
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('.fl-tuju'); if (!b) return;
  if (b.dataset.tujuMr) { window.open('app.html#master-rate', '_blank', 'noopener'); try { localStorage.setItem('islhub-sk-buka', b.dataset.tujuMr); } catch (e) { /* abaikan */ }; return; }
  const el = b.dataset.tujuFokus && document.querySelector(b.dataset.tujuFokus); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); try { el.focus({ preventScroll: true }); } catch (e) { } }
});

/* ---------- tampilan ---------- */
function isiForm(e) {
  const fl = e.formLini, cfg = cfgDari(fl), M = mesinDari(cfg); if (!cfg || !M) return '<div class="fl-mut">Format lini tidak dikenal.</div>';
  const cek = cekGabung(cfg, fl.s);
  const peringatan = [...cek.galat.map(t => `<li class="is-galat">${liTuju(t)}</li>`), ...cek.peringatan.map(t => `<li>${liTuju(t)}</li>`)].join('');
  return `<div class="fl-kepala"><div class="fl-kepala__t"><h3>${esc(cfg.nama)}</h3>${cfg.ket ? `<span class="qt-info"><button type="button" class="qt-info__ikon" aria-label="Tentang ${esc(cfg.nama)}"><span aria-hidden="true">i</span></button><span class="qt-info__pop" role="tooltip"><b>Tentang ${esc(cfg.nama)}</b><p>${esc(cfg.ket)}</p></span></span>` : ''}</div>
    <label class="qt-switch" ${(window.__ISL && window.__ISL.master) ? '' : 'style="display:none"'} title="Tampilkan modal dan margin (internal, tidak ikut PDF)"><input type="checkbox" data-fla="int" ${lihatInt() ? 'checked' : ''}> Tampilkan internal</label></div>
    ${peringatan ? `<ul class="fl-peringatan" data-flo>${peringatan}</ul>` : '<ul class="fl-peringatan" data-flo hidden></ul>'}
    ${M.html(fl.s, cfg, e)}${(cfg.mesin === 'ff' && (UI.langkah || 1) !== 2) ? '' : htmlBlokBawah(fl.s, cfg, M)}${cfg.galeri ? `<div class="fl-bagian">Galeri foto (tampil di PDF)</div>${htmlGaleri(fl.s.foto, 'foto', 'Tambah foto')}` : ''}`;
}
FL.render = e => `<section class="mr-kartu cu-kartu qt-k fl" id="fl-root">${isiForm(e)}</section>`;

/* ---------- dokumen (PDF) ---------- */
FL.dok = (q) => {
  const cfg = cfgDari(q && q.formLini); if (!cfg) return null;
  const d0 = panggil(cfg, 'dok', q.formLini.s) || { blok: [] }, d = cfg.mesin === 'ff' ? d0 : { ...d0, blok: [...(d0.blok || []), ...dokBlokX(q.formLini.s), ...((cfg.galeri && (q.formLini.s.foto || []).length) ? [{ jenis: 'galeri', cap: cfg.galeri, foto: q.formLini.s.foto }] : [])] };
  /* Firestore menolak array di dalam array: baris label-nilai disimpan sebagai objek { k, v } */
  const kv = a => (a || []).map(x => Array.isArray(x) ? { k: String(x[0] ?? ''), v: String(x[1] ?? '') } : x);
  /* aturan tata letak untuk SEMUA lini: blok tabel/kv tanpa baris dibuang, dan pita jalur hanya dipakai bila tepat di atas sebuah tabel yang berisi */
  const ada2 = b => (b.jenis === 'tabel' || b.jenis === 'kv') ? (b.baris || []).length > 0 : true;
  const bersih = (d.blok || []).filter(ada2).filter((b, i, a) => b.jenis !== 'jalur' || (a[i + 1] && a[i + 1].jenis === 'tabel'));
  return { blok: bersih.map(b => b.jenis === 'kv' ? { ...b, baris: kv(b.baris) } : b), info: kv(d.info), catatan: d.catatan || [] };
};
/* syarat tambahan: S&K tipe body/buntut/varian dari master, ketentuan dinamis. FF: menggantikan seluruh S&K. */
FL.tncTambahan = q => { const cfg = cfgDari(q && q.formLini); if (!cfg) return []; return panggil(cfg, 'tnc', q.formLini.s) || []; };
FL.tncGanti = q => { const cfg = cfgDari(q && q.formLini); if (!cfg) return null; const M = mesinDari(cfg); return M && M.tncGanti ? M.tncGanti(q.formLini.s, cfg) : null; };
FL.validasi = q => { const cfg = cfgDari(q && q.formLini); if (!cfg) return []; return cekGabung(cfg, q.formLini.s).galat || []; };

/* ---------- data awal (sekali): S&K per lini dan template FF dimuat ke Pengaturan dokumen ---------- */
/* v2: menambah butir S&K bawaan yang belum ada untuk tiap lini (v1 melewati lini yang sudah punya satu butir, sehingga S&K Trucking Trailer tidak lengkap).
   Dianggap sudah ada bila kemiripan kata >= 0,6 dengan butir yang tersimpan (teks bawaan Pengaturan dan FL.TNC_LINI tidak identik). */
FL.seedPengaturan = p => {
  if (!p || p.seedFL === 'v2') return false;
  p.tnc = Array.isArray(p.tnc) ? p.tnc : [];
  const kata = t => new Set(String(t || '').toLowerCase().match(/[a-z0-9]+/g) || []);
  const mirip = (x, y) => { const u = new Set([...x, ...y]); let i = 0; x.forEach(w => { if (y.has(w)) i++; }); return u.size ? i / u.size : 0; };
  /* CC dan depo mengikuti contoh quotation (lihat pustaka syarat di app-core), jadi tidak diisi dari data lama */
  Object.entries(FL.TNC_LINI).forEach(([kat, list]) => {
    if (kat === 'customs_clearance' || kat === 'depo' || kat === 'distribusi_kecil') return;
    list.forEach((teks, i) => {
      const ada = p.tnc.filter(t => t.kat === kat && t.teks && t.teks.id).map(t => kata(t.teks.id));
      if (ada.some(k => mirip(k, kata(teks)) >= 0.6)) return;
      p.tnc.push({ id: `fl2-${kat}-${i + 1}`, kat, kategori: 'lainnya', teks: { id: teks, en: ((FL.TNC_LINI_EN[kat] || [])[i]) || '' }, aktif: true });
    });
  });
  if (!p.ffMaster) p.ffMaster = clone(FL.FF_AWAL);
  p.seedFL = 'v2'; return true;
};

/* ---------- penyegaran ---------- */
const rootEl = () => document.getElementById('fl-root');
const editAktif = () => { const Q = QT()._Q; return Q && Q.edit && Q.edit.formLini ? Q.edit : null; };
function kabari() { const e = editAktif(); if (!e) return; FL.sinkron(e); if (QT()._ubahFL) QT()._ubahFL(); }
function gambarUlang() {
  const e = editAktif(), r = rootEl(); if (!e || !r) return;
  const a = document.activeElement, fk = a && r.contains(a) && a.dataset ? a.dataset.fl : null, sel = fk && a.selectionStart != null ? [a.selectionStart, a.selectionEnd] : null;
  r.innerHTML = isiForm(e);
  if (fk) { const n = r.querySelector(`[data-fl="${CSS.escape(fk)}"]`); if (n) { n.focus({ preventScroll: true }); try { if (sel) n.setSelectionRange(sel[0], sel[1]); } catch (er) { } } }
  kabari();
}
/* saat mengetik: hanya nilai turunan dan teks hasil yang diperbarui. Kolom yang sedang diketik tidak disentuh, keyboard tidak tertutup. */
function segarNilai() {
  const e = editAktif(), r = rootEl(); if (!e || !r) return;
  const t = document.createElement('div'); t.innerHTML = isiForm(e).replace(/<img\b[^>]*>/g, '<i></i>');
  const a = document.activeElement, L = r.querySelectorAll('[data-fl]'), B = t.querySelectorAll('[data-fl]');
  if (L.length === B.length) L.forEach((el, i) => { const b = B[i]; if (el.dataset.fl === b.dataset.fl && el.hasAttribute('data-rendah') !== b.hasAttribute('data-rendah')) el.toggleAttribute('data-rendah', b.hasAttribute('data-rendah')); if (el.dataset.fl === b.dataset.fl && el.tagName === 'INPUT') { if (el.placeholder !== b.placeholder) el.placeholder = b.placeholder; if (el.hasAttribute('data-ghost') !== b.hasAttribute('data-ghost')) el.toggleAttribute('data-ghost', b.hasAttribute('data-ghost')); } if (el === a || el.dataset.fl !== b.dataset.fl || el.type === 'checkbox' || el.type === 'file') return; if (el.tagName === 'SELECT') { if (el.value !== b.value) el.value = b.value; return; } if (el.value !== b.getAttribute('value')) el.value = b.getAttribute('value') || ''; });
  const LO = r.querySelectorAll('[data-flo]'), BO = t.querySelectorAll('[data-flo]');
  if (LO.length === BO.length) LO.forEach((el, i) => { if (el.contains(a)) return; el.innerHTML = BO[i].innerHTML; el.className = BO[i].className; el.hidden = BO[i].hidden; });
  kabari();
}
let perluGambar = false;
const dalamForm = el => el && el.closest && el.closest('#fl-root');
const isian = el => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea');

document.addEventListener('keydown', ev => {
  const g = ev.target; if (ev.key === 'Enter' && g && g.dataset && g.closest && g.closest('.fl-dsb__c') && dalamForm(g)) {
    const mm = /^(bodies\.[^.]+\.rows\.)(\d+)(\.h\..+)$/.exec(g.dataset.fl || ''); if (mm) { const n = rootEl().querySelector(`[data-fl="${CSS.escape(mm[1] + (+mm[2] + 1) + mm[3])}"]`); if (n) { ev.preventDefault(); n.focus(); n.select && n.select(); return; } }
  }
  const m = ev.target; if (ev.key === 'Enter' && m && m.dataset && m.dataset.flmin !== undefined && dalamForm(m)) { ev.preventDefault(); const bt = m.parentNode.querySelector('[data-fla="min-simpan"]'); if (bt) bt.click(); return; }
  const t = ev.target; if ((ev.key !== 'Enter' && ev.key !== 'Escape') || !t || !t.dataset || t.dataset.flblok === undefined || !dalamForm(t)) return;
  ev.preventDefault(); UI.ubahBlok = null; gambarUlang();
});
document.addEventListener('input', ev => {
  const t = ev.target; if (!dalamForm(t) || !t.dataset || t.dataset.fl === undefined) return;
  const e = editAktif(); if (!e) return; const st = e.formLini.s, cfg = cfgDari(e.formLini), M = mesinDari(cfg);
  if (t.type === 'checkbox') return;
  const v = t.dataset.fn ? num(t.value) : t.value; setPath(st, t.dataset.fl, v);
  const struktur = M.ubah ? M.ubah(t.dataset.fl, st, cfg) : false;
  if (t.tagName === 'SELECT' || struktur === true) { if (t.tagName === 'SELECT') gambarUlang(); else perluGambar = true; }
  if (t.tagName !== 'SELECT') { segarNilai(); perluGambar = true; }
});
document.addEventListener('change', ev => {
  const t = ev.target; if (!dalamForm(t)) return; const e = editAktif(); if (!e) return; const st = e.formLini.s, cfg = cfgDari(e.formLini), M = mesinDari(cfg);
  if (t.dataset.fl !== undefined && t.type === 'checkbox') { setPath(st, t.dataset.fl, t.checked); gambarUlang(); return; }
  if (t.dataset.fl !== undefined && t.dataset.fn && isian(t)) { const n = num(t.value); if (document.activeElement !== t) t.value = fmt(n); }
  if (t.dataset.flfoto) { tambahFoto(t, st); return; }
  if (t.dataset.flprofil !== undefined) { if (t.value && M.profil) { M.profil(st, t.value); toast('Spesifikasi, fasilitas, dan foto diisi dari profil fasilitas. Periksa lagi sebelum diterbitkan.'); } gambarUlang(); return; }
  if (t.dataset.fla === 'kat-pilih') { const c = FL.katalog.find(k => k.id === t.dataset.flx); if (!c) return; if (M.katPilih) M.katPilih(st, c, t.checked); else M.aksi(t.checked ? 'kat-pilih-on' : 'kat-pilih-off', c.id, st, cfg, rootEl(), t.dataset.flg); gambarUlang(); return; }
  if (t.dataset.fla && t.type === 'checkbox') { jalankanAksi(t.dataset.fla, t.dataset.flx, t, e); return; }
});
document.addEventListener('focusout', ev => {
  if (!dalamForm(ev.target)) return;
  setTimeout(() => { const a = document.activeElement; if (perluGambar && !(isian(a) && dalamForm(a))) { perluGambar = false; gambarUlang(); } else if (isian(ev.target) && ev.target.dataset.fn && document.activeElement !== ev.target) ev.target.value = fmt(num(ev.target.value)); }, 60);
});
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('button[data-fla]'); if (!b || !dalamForm(b)) return;
  const e = editAktif(); if (!e) return; ev.preventDefault(); jalankanAksi(b.dataset.fla, b.dataset.flx, b, e);
});
async function jalankanAksi(a, x, el, e) {
  const st = e.formLini.s, cfg = cfgDari(e.formLini), M = mesinDari(cfg), root = rootEl();
  /* Distribusi: baris yang sudah berisi tujuan atau harga dikonfirmasi dulu sebelum dihapus; baris kosong langsung terhapus */
  if (a === 'tujuan-hapus' && cfg.mesin === 'trucking') {
    const [k, i] = String(x).split('.'), r = ((st.bodies[k] || {}).rows || [])[+i], isi = r && (String(r.tujuan || '').trim() || Object.values(r.h || {}).some(v => num(v) > 0));
    if (isi && !(await konfirmasiFL({ judul: 'Hapus baris?', isi: `Baris <b>${esc(r.tujuan || 'tanpa nama')}</b> beserta harganya dihapus dari quotation ini.`, aksi: 'Hapus baris', bahaya: true }))) return;
  }
  if (a === 'blokHapus' && cfg.mesin === 'trucking') {
    const bl = st.bodies[x], n = ((bl || {}).rows || []).filter(isiBaris).length;
    if (n && !(await konfirmasiFL({ judul: 'Hapus blok?', isi: `Blok <b>${esc(judulBlok(st, daftarBlok(st).find(z => z.key === x) || { key: x, nama: x }))}</b> beserta ${n} baris tujuan dan harganya dihapus dari quotation ini.`, aksi: 'Hapus blok', bahaya: true }))) return;
  }
  if (a === 'dstTemplat' && cfg.mesin === 'trucking') {
    const bl = st.bodies[x]; if (!bl || tipeBlok(x) !== 'boxdry') return;
    const p = rencanaTemplat(st, x), jml = p.baru.length + p.isi.length;
    if (!jml) return toast('Semua rute template sudah ada dan harganya terisi. Tidak ada yang perlu ditambahkan.');
    const ring = `<ul class="mr-konfirm__daftar"><li><b>${p.baru.length}</b> rute baru ditambahkan: ${esc(p.baru.map(z => z.r.tujuan).join(', ') || '-')}</li>${p.isi.length ? `<li>Harga kosong diisi di <b>${p.isi.length}</b> rute yang sudah ada</li>` : ''}<li>Pick up: <b>${esc(p.pk || 'tanpa pick up')}</b>${p.skemaBaru !== (bl.skema || '') ? ' (skema diubah ke satu pick up)' : ''}</li><li>Harga dari template: <b>${p.dariTpl}</b> sel${p.dariMin ? `, dari tarif minimum Master Rate: <b>${p.dariMin}</b> sel` : ''}</li><li>Kolom ditampilkan: ${esc(p.kls.join(', '))}</li></ul><p class="mr-sub" style="display:block;margin:0">Baris dan harga yang sudah Anda isi tidak ditimpa. Sel tanpa harga template dan tanpa tarif minimum dibiarkan kosong.</p>`;
    if (!(await konfirmasiFL({ judul: 'Isi dari template?', isi: ring, aksi: 'Isi sekarang' }))) return;
    bl.skema = p.skemaBaru; bl.rows = (bl.rows || []).filter(isiBaris);
    p.baru.forEach(z => { z.r.h = { ...(z.r.h || {}), ...z.h }; bl.rows.push(z.r); }); p.isi.forEach(z => { z.r.h = { ...(z.r.h || {}), ...z.h }; });
    st.tipe = st.tipe || {}; p.kls.forEach(k => { st.tipe[k] = true; }); UI.dsbPanel = null; UI.barisAktif = null; gambarUlang(); return;
  }
  if (a === 'kalk-buka') { bukaKalkulator(); return; }
  if (a === 'foto-hapus' && cfg.galeri) { const ks = String(x).split('.'), i = +ks.pop(), arr = getPath(st, ks.join('.')); if (arr) arr.splice(i, 1); gambarUlang(); return; }
  if (a === 'int') { const Q = QT()._Q; if (Q) Q.lihatInt = el.checked; gambarUlang(); return; }
  if (a === 'bx-tambah-blok') { const X = (st.blokX = blokXAda(st)); X.push({ id: uidF('bx'), judul: 'Blok ' + (X.length + 1), rows: [barisX()] }); gambarUlang(); return; }
  if (a === 'bx-baris') { const b = blokXAda(st)[+x]; if (b) { b.rows.push(barisX()); gambarUlang(); } return; }
  if (a === 'bx-baris-hapus') { const [bi, ri] = String(x).split('.').map(Number), b = blokXAda(st)[bi]; if (b) { b.rows.splice(ri, 1); if (!b.rows.length) b.rows.push(barisX()); gambarUlang(); } return; }
  if (a === 'bx-hapus') {
    const b = blokXAda(st)[+x]; if (!b) return; const n = (b.rows || []).filter(r => String(r.n || '').trim() || ada(num(r.jual))).length;
    if (n && !(await konfirmasiFL({ judul: 'Hapus blok?', isi: `Blok “${esc(b.judul)}” dan ${n} baris di dalamnya dihapus dari penawaran ini.`, aksi: 'Hapus blok', bahaya: true }))) return;
    st.blokX.splice(+x, 1); gambarUlang(); return;
  }
  if (a === 'bx-ref') {
    const [pos, cid] = String(x).split('|'), [bi, ri] = pos.split('.').map(Number), r = ((blokXAda(st)[bi] || {}).rows || [])[ri], c = FL.katalog.find(k => k.id === cid); if (!r || !c) return;
    if (ada(c.jual)) r.jual = c.jual; if (ada(c.modal)) r.modal = c.modal; if (c.satuan && !String(r.satuan || '').trim()) r.satuan = c.satuan; if (c.ket && !String(r.ket || '').trim()) r.ket = c.ket; r._cid = c.id; gambarUlang(); return;
  }
  if (a === 'bx-simpan') {
    const [bi, ri] = String(x).split('.').map(Number), r = ((blokXAda(st)[bi] || {}).rows || [])[ri]; if (!r) return;
    if (!String(r.n || '').trim()) return toast('Isi nama layanan dulu sebelum menyimpan ke katalog.', 'bahaya');
    const lini = cfg.katLini || cfg.key, ada0 = refKatalog(lini, r.n); el.disabled = true;
    try {
      if (ada0) { const c = C(); await c.tulisDB(() => { const k = FL.katalog.find(z => z.id === ada0.id); if (k) Object.assign(k, { satuan: r.satuan || '', modal: ada(num(r.modal)) ? num(r.modal) : null, jual: ada(num(r.jual)) ? num(r.jual) : null, ket: r.ket || '', n: String(r.n).trim(), label: String(r.n).trim() }); }, () => FL.katalog.some(z => z.id === ada0.id && num(z.jual) === num(r.jual))); r._cid = ada0.id; toast('Item di katalog diperbarui. Tarif ini jadi referensi untuk penawaran berikutnya.'); }
      else { const d = await simpanKatalog({ lini, grup: 'tambahan', n: String(r.n).trim(), satuan: r.satuan || '', modal: ada(num(r.modal)) ? num(r.modal) : null, jual: ada(num(r.jual)) ? num(r.jual) : null, ket: r.ket || '', label: String(r.n).trim() }); r._cid = d.id; toast('Item disimpan ke katalog. Tarifnya jadi referensi kalau item yang sama dipakai lagi.'); }
    } catch (er) { toast(`<b>Gagal menyimpan item.</b> ${esc(er.message)}`, 'bahaya'); }
    el.disabled = false; gambarUlang(); return;
  }
  if (a === 'baris-simpan') {
    const [bi, ri] = String(x).split('.').map(Number), b = cfg.bagian[bi], r = (st.rows[bi] || [])[ri]; if (!r) return;
    const vals = {}; b.kolom.forEach(k => { vals[k.k] = r[k.k] ?? ''; });
    let item; try { item = M.katItem(cfg, b.judul, vals); } catch (er) { toast(esc(er.message), 'bahaya'); return; }
    el.disabled = true;
    try {
      const lama = r._cid && FL.katalog.find(z => z.id === r._cid);
      if (lama) { await C().tulisDB(() => { Object.assign(lama, item); }, () => FL.katalog.some(z => z.id === lama.id)); toast('Item di katalog diperbarui. Tarif ini jadi referensi untuk penawaran berikutnya.'); }
      else { const d = await simpanKatalog({ lini: cfg.katLini || cfg.key, ...item }); r._cid = d.id; toast('Item disimpan ke katalog. Tarifnya jadi referensi kalau item yang sama dipakai lagi.'); }
    } catch (er) { toast(`<b>Gagal menyimpan item.</b> ${esc(er.message)}`, 'bahaya'); }
    el.disabled = false; gambarUlang(); return;
  }
  if (a === 'ff-simpan-item') {
    const it = st.items[+x]; if (!it) return; if (!String(it.nama || '').trim()) return toast('Isi nama item dulu sebelum menyimpan ke katalog.', 'bahaya');
    el.disabled = true;
    try { const lama = it._cid && FL.katalog.find(z => z.id === it._cid), data = { grup: it.blok, nama: String(it.nama).trim(), satuan: it.satuan || 'Per Shipment', cur: it.cur || 'IDR', modal: num(it.modal), label: String(it.nama).trim() };
      if (lama) { await C().tulisDB(() => { Object.assign(lama, data); }, () => FL.katalog.some(z => z.id === lama.id)); toast('Item di katalog diperbarui.'); }
      else { const d = await simpanKatalog({ lini: cfg.katLini || cfg.key, ...data }); it._cid = d.id; toast('Item disimpan ke katalog. Muncul sebagai item tambahan yang bisa dicentang di penawaran berikutnya.'); }
    } catch (er) { toast(`<b>Gagal menyimpan item.</b> ${esc(er.message)}`, 'bahaya'); }
    el.disabled = false; gambarUlang(); return;
  }
  if (a === 'bag-hapus') {
    const lab = M.labelBlok ? (M.labelBlok(cfg, x) || x) : x;
    if (!(await konfirmasiFL({ judul: 'Hapus blok?', isi: `Blok “${esc(lab)}” disembunyikan: tidak tampil di formulir dan PDF. Isiannya tetap tersimpan sampai kamu menampilkannya lagi.`, aksi: 'Hapus blok', bahaya: true }))) return;
    (st.off = st.off || {})[x] = true; gambarUlang(); return;
  }
  if (a === 'min-buka') { UI.minBuka = UI.minBuka === String(x) ? null : String(x); gambarUlang(); return; }
  if (a === 'min-pilih' || a === 'min-simpan' || a === 'min-otomatis') {
    if (!masterAkun()) return;
    const [id, pilihan] = String(x).split('|'); let sp;
    if (id.startsWith('dst~')) { const [, bk, ri, kl] = id.split('~'), r = ((st.bodies[bk] || {}).rows || [])[+ri]; sp = r && minDstSpek(r, kl); }
    else { const [bi, ri, kk] = id.split('.'), bg = cfg.bagian[+bi], r = bg && (cfg.resolusi ? cfg.resolusi(st.rows[+bi] || []) : (st.rows[+bi] || []))[+ri], k = bg && bg.kolom.find(z => z.k === kk); if (!r || !k) return; sp = minSpek(cfg, bg, r, k); }
    if (!sp) return;
    let nilai = null;
    if (a === 'min-pilih') nilai = Math.round(Number(pilihan));
    else if (a === 'min-simpan') { const inp = root.querySelector(`[data-flmin="${CSS.escape(id)}"]`); nilai = Math.round(num(inp && inp.value)); if (!(nilai > 0)) { toast('Isi tarif minimum dengan angka lebih dari 0, atau pilih Otomatis.', 'bahaya'); return; } }
    el.disabled = true;
    try { await C().simpanTarifMin(cfg.liniKey, kunciMin(sp.nama, sp.dim), nilai); }
    catch (er) { toast(`<b>Gagal menyimpan tarif minimum.</b> ${esc(er.message)}`, 'bahaya'); el.disabled = false; return; }
    UI.minBuka = null; gambarUlang(); toast(nilai ? 'Tarif minimum tersimpan untuk semua akun.' : 'Tarif minimum kembali otomatis (modal tertinggi).'); return;
  }
  if (a === 'bag-pulih') { if (st.off) delete st.off[x]; gambarUlang(); return; }
  if (a === 'kat-buka') { UI.tambah = el.dataset.flg; gambarUlang(); const f = root.querySelector('[data-flkat] input'); if (f) f.focus(); return; }
  if (a === 'kat-batal') { UI.tambah = null; gambarUlang(); return; }
  if (a === 'kat-simpan') {
    const g = el.dataset.flg, v = ambilFormKatalog(root, g); let item;
    try { item = M.katItem(cfg, g, v); } catch (er) { toast(esc(er.message), 'bahaya'); return; }
    el.disabled = true;
    try { await simpanKatalog({ lini: cfg.katLini || cfg.key, ...item }); toast('Layanan tersimpan di katalog server dan bisa dipakai lagi di penawaran berikutnya.'); UI.tambah = null; UI.addTipe = false; if (M.setelahSimpanKatalog) M.setelahSimpanKatalog(st); }
    catch (er) { toast(`<b>Gagal menyimpan layanan.</b> ${esc(er.message)}`, 'bahaya'); el.disabled = false; return; }
    gambarUlang(); return;
  }
  if (a === 'kat-hapus') {
    const ok = C().konfirmasi ? await C().konfirmasi({ judul: 'Hapus dari katalog?', isi: 'Layanan ini dihapus dari katalog server untuk semua penawaran berikutnya. Penawaran yang sudah terbit tidak berubah.', aksi: 'Hapus', bahaya: true }) : confirm('Hapus layanan ini dari katalog?');
    if (!ok) return;
    try { await hapusKatalog(x); if (M.hapusKatalog) M.hapusKatalog(st, cfg, x); toast('Layanan dihapus dari katalog.'); } catch (er) { toast(`<b>Gagal menghapus.</b> ${esc(er.message)}`, 'bahaya'); return; }
    gambarUlang(); return;
  }
  const ubah = (cfg.aksiKhusus && cfg.aksiKhusus(a, x, st)) || (M.aksi && M.aksi(a, x, st, cfg, root, el.dataset.flg));
  if (ubah) gambarUlang();
}
async function tambahFoto(inp, st) {
  const path = inp.dataset.flfoto, arr = getPath(st, path) || setPath(st, path, []) || getPath(st, path), files = [...(inp.files || [])].slice(0, 12 - arr.length);
  if (!files.length) { if ((inp.files || []).length) toast('Maksimal 12 foto per galeri.', 'bahaya'); return; }
  toast('Memproses foto…');
  for (const f of files) { try { arr.push({ src: await perkecil(f), ket: f.name.replace(/\.[a-z0-9]+$/i, '') }); } catch (er) { toast(`${esc(f.name)}: ${esc(er.message)}`, 'bahaya'); } }
  gambarUlang();
}
})();

/* HP: setiap sel tabel isian diberi label dari judul kolom, agar tampil sebagai kartu (lihat tambahan.css) */
const labelTabelHp = root => root.querySelectorAll('.fl-tbl table').forEach(t => {
  const hs = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
  t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => {
    if (td.tagName === 'TD' && td.colSpan === 1 && !td.hasAttribute('data-label') && hs[i]) td.setAttribute('data-label', hs[i]);
  }));
});
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  let jadwal = false;
  new MutationObserver(() => { if (jadwal) return; jadwal = true; requestAnimationFrame(() => { jadwal = false; labelTabelHp(document); }); }).observe(document.body, { childList: true, subtree: true });
}
