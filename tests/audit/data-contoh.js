// Data contoh untuk Firebase tiruan (audit tampilan). Bentuknya mengikuti dokumen asli yang dibaca aplikasi.
const lini = [['depo', 'Depo Container', 20], ['customs_clearance', 'Customs Clearance', 25], ['trucking_trailer', 'Trucking Trailer', 12], ['distribusi_kecil', 'Distribusi Kendaraan Kecil', 10], ['sewa_unit', 'Sewa Unit Kendaraan', 15], ['gudang_plb', 'Gudang PLB', 15], ['warehouse_dry', 'Warehouse Dry', 30], ['open_yard', 'Open Yard', 15], ['sewa_container_empty', 'Sewa Container Empty', 15], ['freight_forwarding', 'Freight Forwarding', 15]];
const satuan = [['per_kontainer', 'per kontainer'], ['per_hari', 'per hari'], ['per_dokumen', 'per dokumen'], ['per_trip', 'per trip'], ['per_bulan', 'per bulan']];
const tarif = [
  ['depo', 'storage_container_dry', 'Storage Container Dry', 'per_hari', { ukuran: '20ft' }, 30000], ['depo', 'storage_container_dry', 'Storage Container Dry', 'per_hari', { ukuran: '40ft' }, 40000],
  ['depo', 'lolo_full', 'LOLO FULL', 'per_kontainer', { ukuran: '20ft' }, 100000], ['depo', 'lolo_full', 'LOLO FULL', 'per_kontainer', { ukuran: '40ft' }, 150000],
  ['customs_clearance', 'pib_green_line', 'PIB Green Line', 'per_dokumen', {}, 400000], ['customs_clearance', 'peb', 'PEB', 'per_dokumen', {}, 350000],
  ['trucking_trailer', 'tanjung_priok_cikarang', 'Tanjung Priok – Cikarang', 'per_trip', { ukuran: '20ft' }, 900000]
];
const awal = { lini_bisnis: {}, satuan_baku: {}, vendor: {}, master_tarif: {}, master_modal: {}, cu_customers: {}, qt_counters: {}, pengguna: {} };
lini.forEach(([id, nama, tm], i) => { awal.lini_bisnis[id] = { nama, aktif: true, urut: i, targetMargin: tm }; });
satuan.forEach(([kode, nama]) => { awal.satuan_baku[kode] = { kode, nama }; });
awal.vendor.v1 = { nama: 'Depo Sentosa', namaLengkap: 'PT Depo Sentosa', aktif: true, liniBisnis: ['depo'], topPerLini: { depo: 30 } };
awal.vendor.v2 = { nama: 'Cakrawala Trans', namaLengkap: 'PT Cakrawala Trans', aktif: true, liniBisnis: ['trucking_trailer'] };
tarif.forEach(([l, ly, nm, sat, dim, modal], i) => { const id = 't' + (i + 1); awal.master_tarif[id] = { liniBisnisId: l, vendorId: l === 'trucking_trailer' ? 'v2' : 'v1', lokasiId: null, layanan: ly, layananNama: nm, dimensi: dim, satuanKode: sat, mataUang: 'IDR', nilaiAsing: null, aktif: true, hargaMin: Math.ceil(modal * 1.2 / 1000) * 1000, kunci: id }; awal.master_modal[id] = { modal }; });
awal.cu_customers.c1 = { nama: 'PT Sinar Makmur Abadi', alias: 'Sinar Makmur', kategori: 'reguler', status: 'aktif', npwp: '01.234.567.8-091.000', alamat: 'Jl. Raya Cakung Cilincing No. 12, Jakarta Utara', kontak: [{ nama: 'Budi Santoso', jabatan: 'Logistics Manager', telp: '0812-0000-1111', email: 'budi@sinarmakmur.test', utama: true }], legalitas: [], termin: 30, bahasa: 'id' };
awal.cu_customers.c2 = { nama: 'CV Bintang Timur', alias: '', kategori: 'vip', status: 'prospek', npwp: '', alamat: 'Bekasi', kontak: [{ nama: 'Sari', jabatan: 'Purchasing', telp: '', email: '', utama: true }], legalitas: [], termin: 30, bahasa: 'id', catatan: 'Dibuat otomatis dari quotation DRAF-001.' };
awal.cu_customers.c3 = { nama: 'PT Nusantara Cargo', alias: 'NC', kategori: 'reguler', status: 'nonaktif', npwp: '', alamat: 'Surabaya', kontak: [], legalitas: [], termin: 45, bahasa: 'en' };
module.exports = { awal };
