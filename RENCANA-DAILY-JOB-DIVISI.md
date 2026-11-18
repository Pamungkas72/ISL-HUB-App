# Rencana Daily Job per divisi (dicatat 14 Nov 2026, untuk dilanjutkan)

Urutan: selesaikan **Marketing dan BD** dulu, baru divisi lain.

## Prinsip
- **Dashboard tetap mirip** di semua divisi (KPI, performa per orang, backlog, daftar, laporan).
- **Yang berbeda per divisi:** formulir input, impor massal Excel, dan isi PDF.

## Contoh: divisi Tracking
- Volume pengiriman harian.
- POD sudah kembali atau belum.
- Pembayaran vendor: cash atau TOP.
- Tagihan vendor: sudah dikirim, sudah dikonfirmasi.

## Pertanyaan untuk nanti
- Apakah Tracking mencatat per pengiriman (satu baris per DO/shipment) atau ringkasan harian?
- Status khusus (POD kembali, tagihan terkirim) jadi kolom di job atau jenis job terpisah?
- Template Excel dan PDF per divisi: kolom persisnya dari contoh Excel divisi.
- Divisi lain yang akan dipakai setelah Tracking.

## Usulan teknis (belum dikerjakan)
- Tiap kelompok punya `jenisForm` (mis. `marketing`, `tracking`) yang memilih formulir, pemeta impor Excel, dan bagian PDF.
- Dashboard memakai kolom umum (PIC, kategori, target, selesai); kolom khusus disimpan di `job.rinci`.

## Filter dashboard performa (diputuskan 18 Nov 2026, untuk saat dashboard dipasang lagi)
Dashboard adalah ringkasan laporan, jadi filternya filter laporan, bukan filter daftar.
- **Periode** (selalu terlihat di atas dashboard): Bulan ini (bawaan), Tahun ini, Rentang. Pembanding otomatis ke periode sebelumnya. Dasar hitungan: job masuk, selesai, dan sisa (backlog) pada periode itu.
- **Tombol Filter (panel)**: PIC, Kategori (satu atau beberapa), Kelompok (hanya master/admin).
- **Tidak dipakai**: Status, Prioritas, Masalah (status adalah hasil yang diukur; menyaringnya merusak angka).
- Ringkasan filter aktif tampil di bawah judul. PDF laporan memakai filter yang sama. Atur ulang = Bulan ini, semua PIC/kategori.
- Tren per hari/minggu/bulan otomatis menurut panjang periode.
- Status: tab Performa **dikembalikan** (19 Nov 2026) setelah salah paham: yang diminta dihapus adalah "Dashboard Performa" di navigasi aplikasi (halaman terpisah), bukan tab Performa di Daily Job. Filter memakai desain Q2 (kalimat ringkasan + panel).
- **Desain filter dashboard (dipilih 18 Nov 2026, desain Q2)**: judul "Performa", satu kalimat ringkasan "Menampilkan November 2026 · semua PIC · semua kategori · Ubah" di bawah judul, tanpa chip atau tombol di halaman. "Ubah" membuka satu panel (drawer, sama dengan panel Filter daftar job) berisi Periode (Bulan ini, Tahun ini, Rentang), PIC, Kategori, Kelompok (master/admin), tombol Atur ulang dan Terapkan. Ini menggantikan keputusan "periode selalu terlihat di atas" di atas.

## Daily Job per kelompok: kerangka sama, isi berbeda (dicatat 18 Nov 2026, aturan pemilik)
Tiap divisi punya cara kerja dan karakter sendiri. Yang **sama** di semua kelompok: kerangka halaman (Daftar job, Performa, Pengaturan), gaya tampilan, filter, dan alur (catat, ubah, selesai, bagikan). Yang **berbeda** per kelompok:
1. **Pencatatan job**: konsep formulir sama, tetapi isian (kolom, kategori, satuan, status khusus, data rinci di `job.rinci`) mengikuti divisi.
2. **Daftar job**: kolom dan label yang tampil menyesuaikan isi divisi.
3. **Dashboard Performa**: desain sama, tetapi konten (KPI, tabel, grafik) berbeda per divisi.
4. **Laporan (PDF) dan impor Excel**: isi dan templatenya per divisi.
Akun yang masuk memakai tampilan menurut `pengguna.kelompokDJ`; master dan admin bisa melihat semua kelompok. Usulan teknis: tiap kelompok punya `jenisForm` (mis. `marketing`, `tracking`) yang memilih formulir, kolom daftar, widget dashboard, pemeta impor, dan bagian PDF. Mulai dari Marketing dan BD, lalu divisi lain. Detail tiap divisi ditanyakan ke pemilik sebelum dikerjakan; jangan ditebak.

## Dashboard Performa (halaman sales) disembunyikan (19 Nov 2026)
- Menu dan rute `#performa` ditutup; kode (`sales.js`) dan data tetap ada.
- Profil sales (nama, telepon, tanda tangan) dan Pengajuan hapus quotation **pindah ke Pengaturan** (desain D3: daftar bagian; menu kiri di desktop, daftar baris di HP). Akun sales kini punya Pengaturan dengan isi terbatas: Tampilan dan akun, Profil sales, Pengajuan hapus (status miliknya).
