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

## Divisi Tracking (keputusan 19 Nov 2026, belum dikode)
- **Struktur:** satu kelompok **Tracking** dengan dua subdivisi. **Mobil kecil**: CDE, CDD, Fuso, Tronton, Grand Max Blind Van. **Mobil besar**: Trailer (ekspor, impor, domestik).
- **Pencatatan:** satu baris per pengiriman (DO/surat jalan). Field: customer, asal, tujuan, no. DO, kategori armada, tanggal kirim, target tiba, vendor, driver (nama, telepon), plat nomor, pembayaran (cash/TOP), cost, status POD (belum/sudah kembali + tanggal), status tagihan vendor (belum dikirim/dikirim/dikonfirmasi), catatan. Info tambahan dari pemilik menyusul.
- **Formulir:** desktop = F1 (satu form berbagian), HP = F2 (tiga langkah: Pengiriman, Armada dan vendor, Biaya dan status).
- **Vendor:** tersambung ke Master Rate. Vendor belum ada: dibuat sebagai vendor **Draf** dengan data minimal (nama, alamat, telepon); legalitas dilengkapi admin di Master Rate.
- **KPI Performa Tracking:** volume pengiriman per hari dan per kategori armada; ketepatan (pengiriman tepat waktu, POD kembali tepat waktu); tagihan vendor (dikirim, belum dikonfirmasi, cash lawan TOP); beban per PIC dan backlog (belum POD, terlambat); order masuk terlaksana atau tidak; rute dengan volume terbanyak. Margin rute: **tidak dihitung dulu** (tidak ada harga ke customer).
- **Cost vendor:** semua anggota Tracking bisa melihat dan mengisi cost. Cost masuk ke Master Rate untuk rute dan vendor itu. Bila rute dengan vendor yang sama pernah dipakai, sistem merekomendasikan tarif sebelumnya; bila berubah, tarif terbaru tercatat sebagai rate terbaru.
- **Unit internal:** cost = uang jalan, tercatat di Master Rate sebagai vendor internal dengan pengelompokan "Uang Jalan". Dasar hitung: kalkulator Uang Jalan yang sudah ada (`uang-jalan.js`: BBM, tol, TKBM, operasional).
- **Pemilih kelompok:** master dan admin berpindah tampilan dan performa antar kelompok; Pengaturan tetap khusus master dan admin.

## Akun dan akses (20 Nov 2026)
Keputusan pemilik: satu direktori akun di Pengaturan > Akun dan akses, desain B (per kelompok: kepala divisi di baris pertama, anggota di bawahnya, tombol + Anggota per kelompok, menu ⋯ per akun). Satu kepala per kelompok.
- **Tahap 1 (selesai):** buat akun anggota divisi dengan jabatan, jadikan kepala atau anggota, pindah kelompok, ubah data, reset sandi, nonaktifkan, hapus (`public/js/akun-divisi.js`, Cloud Functions `djBuatAnggota` dan `djAturAnggota`: aksi `kepala`, `anggota`, `kelompok`). Sales, admin, dan lihat saja masih lewat Tambah akun manual di bagian Staf dan sales.
- **Tahap 2 (selesai, 20 Nov 2026):** izin per modul `pengguna.akses` = { mr, qt, cu, dj, lg } (0 tidak, 1 lihat, 2 kelola). Hanya MEMBATASI izin peran (tidak menambah hak); kunci kosong = perilaku lama; master tidak dibatasi. Ditegakkan di `firestore.rules` (fungsi `lvl/baca/kelola`), diuji di `tests/rules`. Pembacaan data tarif/vendor/lokasi terbuka bila Master Rate ATAU Quotation >= lihat (Quotation butuh harga); customer terbuka bila Customer ATAU Quotation >= lihat. UI: panel Akses (akun staf/sales) dan seg Akses Daily Job (akun divisi). Menu modul yang dimatikan disembunyikan. Daily Job lihat saja: tombol catat disembunyikan dan aksi ubah ditolak. Catatan: modul lain belum menyembunyikan tombol ubah untuk level lihat (server menolak). Rencana awal: akses per modul (Master Rate, Quotation, Customer, Daily Job, Legal) dengan tiga level (tidak tampil, lihat, kelola) dan preset per peran, disimpan di `pengguna.akses` dan ditegakkan di `firestore.rules` (bukan hanya menu). Setelah itu, satu formulir Buat akun untuk semua peran.

## Tracking Trailer (mobil besar): konsep dan desain (23 Nov 2026, belum dikode)
Menggantikan bagian "Divisi Tracking" 19 Nov untuk subdivisi Mobil besar. Mobil kecil dibahas setelah ini.
- **Unit:** satu baris = satu shipment = satu ritase (keputusan pemilik). Jenis: Impor, Ekspor, Repo, Domestik (ganti kategori Trailer Ekspor/Impor/Domestik; tambah Repo).
- **Tahap (stepper, satu klik mencatat waktu), selalu berakhir di POD:** Impor: Siap, Pick up, Bongkar, MT return, POD. Ekspor: Siap, Ambil MT, Stuffing, Gate in, POD. Repo: Siap, Pick up, Grounded, POD. Domestik: Siap, Pick up, Bongkar, POD. "Siap" = armada, driver, dokumen sudah ada.
- **Catat dua tahap:** order masuk cukup jenis, customer, sumber order, no. DO, rute, target tiba; armada, dokumen, biaya menyusul.
- **Data tambahan:** no. kontainer dan ukuran (20/40), pelayaran, depo MT (lokasi + nama depo), dokumen (surat jalan wajib/POD, DO pelayaran wajib untuk MT return, SPPB/PIB/TILA untuk impor, kartu ekspor/gate pass + NPE/PEB untuk ekspor).
- **Biaya:** vendor = tarif per ritase dari Master Rate (rute + vendor), tarif terakhir jadi isian awal; internal = uang jalan (`uang-jalan.js`). Pembayaran vendor: cash atau TOP (tempo dari Master Rate vendor), tanggal bayar.
- **Aturan POD:** bayar sebelum POD kembali boleh, tetapi ditandai Berisiko dan wajib isi "janji POD kembali"; pengingat harian. "Siap ditagih" = POD kembali. "Tagihan" = penagihan ke customer (diurus Finance); status "tagihan vendor" 19 Nov diganti "pembayaran vendor" (belum, dibayar, tanggal bayar). Selesai = POD kembali dan vendor lunas.
- **UI Daftar job (dipilih):** opsi B (tabel desktop + kartu HP, dengan stepper tahap, chip POD dan bayar, filter jenis) ditambah strip "perlu tindakan" dari opsi C (Dibayar POD belum, POD terlambat, berangkat hari ini, order tanpa armada). Detail shipment: stepper bertanda waktu, dokumen, armada, biaya, POD. Gambar: desktop dua kolom, HP satu kolom dengan tombol tahap berikutnya di bawah.
- **UI Performa (dipilih):** opsi 1 satu halaman, berurutan: KPI (order masuk, ritase, cost total, cost per ritase) lalu Volume order per minggu (masuk lawan terlaksana), Jenis pengiriman (order, ritase, vendor/internal, cost, cost per ritase), Vendor yang dipakai (ritase, cost, tarif rata-rata), Rute teratas; ditambah kartu pembanding tarif vendor per rute (vendor termurah, dari Master Rate). Risiko POD tidak di Performa; ada di strip tindakan Daftar.
- **Belum dikerjakan:** model data (`job.rinci` baru: jenis, tahap + waktu, kontainer, dokumen, pembayaran, janji POD), pengingat POD, tarif ke Master Rate, impor Excel, PDF.

## Truk Distribusi (mobil kecil): konsep dan desain (23 Nov 2026, belum dikode)
- **Nama UI:** subdivisi besar = **Tracking Trailer**, kecil = **Truk Distribusi** (ganti label "Mobil besar/kecil").
- **Struktur tab:** Daftar job (hanya pengiriman), **Armada** (baru), Performa, Pengaturan. Pekerjaan non-pengiriman (maintenance, dokumen, visit, sewa) hidup di Armada, bukan di Daftar job.
- **Pengiriman:** satu pengiriman = satu ritase. Pola titik: 1→1, 1→banyak drop, banyak pick up→1, banyak→banyak (daftar titik pick up/drop berurutan; jumlah drop dicatat terpisah dari ritase). Tahap: Siap, Pick up, Drop (n/total), POD. Aturan POD/bayar/tagihan sama dengan Trailer.
- **Armada kendaraan:** Blind Van (Grand Max), CDE, CDD, Fuso, Tronton. **Tipe bak** (perlu dikonfirmasi pemilik): Box, Box Reefer ("box river"), Wing Box, Bak ("bug"), Losbak ("lost bug"), Three Way.
- **Uang jalan:** tarif tetap per rute x jenis armada terisi otomatis untuk unit internal. Rute baru: kalkulator (jarak PP, rasio BBM per jenis armada: Blind Van 1:10, CDE 1:7, CDD 1:5, Fuso 1:4, Tronton 1:3; harga solar; tol; TKBM opsional; retribusi/mel; insentif driver borongan; komponen lain), cetak slip untuk driver, simpan sebagai tarif tetap lewat **pengajuan yang disetujui admin**. Memakai modul Uang Jalan yang ada (`uang-jalan.js`; saat ini hanya master/admin, perlu akses baca/hitung untuk anggota Tracking). Vendor: tarif per ritase dari Master Rate, cash/TOP.
- **Armada (sub-tab, keputusan pemilik):** data kendaraan di Daily Job: plat, jenis, tipe bak, masa berlaku KIR/STNK/pajak, jadwal servis (**tanggal dan km**, mana lebih dulu), kontrak sewa (dengan driver / lepas kunci, project, kota, tanggal, visit bulanan). Tab: **Perlu tindakan** (tugas berurutan: lewat tempo, 7 hari, 30 hari; tombol catat perpanjangan/servis/hasil visit), **Kendaraan** (matriks kepatuhan per plat), Sewa unit, Riwayat. Pengingat bertahap 30/14/7 hari lalu harian bila lewat; visit bulanan dibuat otomatis dari kontrak sewa.
- **Performa Distribusi (dipilih: opsi 2, tab fokus):** tab Pengiriman (order masuk, ritase, titik drop, cost, cost per ritase, ritase per hari, jenis armada, vendor, rute, tipe bak), tab Armada dan dokumen (kepatuhan KIR/STNK/pajak/servis), tab Sewa dan project (jumlah, bentuk, kota). Margin tidak dihitung.
- **Daftar job Distribusi:** tabel (desktop) / kartu (HP) dengan chip pola 1→n, stepper tahap + posisi drop, jenis armada + tipe bak, cost; strip tindakan memuat juga ringkasan Armada (KIR lewat, jatuh tempo).
- **Laporan PDF (disetujui):** A4 dua halaman per kelompok, memakai filter periode dan PIC. Trailer: ringkasan, jenis, volume per minggu, vendor, rute, perhatian; lampiran: shipment menunggu POD, siap ditagih, perubahan tarif. Distribusi: ringkasan, jenis armada, tipe bak, vendor, rute; halaman 2: kepatuhan armada, jatuh tempo 30 hari, sewa unit per kota, perawatan selesai. Kolom tanda tangan: Disiapkan, Diperiksa, Diketahui.

## Status implementasi Tracking (24 Nov 2026, sudah di main dan terdeploy)
- **Tracking Trailer:** model tahap per jenis, formulir (kontainer, depo MT, tanggal bayar, janji POD), detail dengan stepper, strip tindakan, Performa, PDF. Berkas: `daily-job-trailer-hitung.js`, `daily-job-tracking.js`, `daily-job-pdf-trailer.js`.
- **Truk Distribusi:** pengiriman multi-titik, tab Armada (koleksi `dj_armada`), uang jalan (koleksi `dj_tarif`, kalkulator, slip, pengajuan ke admin), Performa tab fokus, PDF. Berkas: `daily-job-distribusi-hitung.js`, `daily-job-armada.js`, `daily-job-uangjalan.js`, `daily-job-performa-dz.js`, `daily-job-pdf-distribusi.js`.
- **Pengingat push** 09.00 hari kerja (POD belum kembali, urusan Armada): `functions/dailyjob-tracking-pesan.js`.
- **Performa "Semua"** subdivisi: ringkasan gabungan dua subdivisi dengan tautan Lihat rincian.
- **Ekspor Excel shipment** (menu ⋮ > Ekspor Excel shipment): satu lembar per subdivisi, satu baris per shipment (`daily-job-ekspor.js`).
- **Ditunda:** impor Excel Tracking (menunggu contoh Excel tim), revisi hasil pakai pemilik. Tipe bak (Box Reefer, Bak, Losbak) perlu dikonfirmasi pemilik.
- **Deploy:** otomatis dari `main` (aturan, hosting, Cloud Function) lewat `deploy-firebase.yml`.

## Revisi formulir Tracking Trailer (24 Nov 2026, aturan pemilik)
- **Urutan formulir:** Customer → Subdivisi → **Jenis shipment** (Impor, Ekspor, Repo, Domestik; untuk Distribusi: Jenis armada) → rute. Jenis ditentukan sebelum rute.
- **Multi drop (hanya Domestik):** tombol **+ Tujuan** menambah Tujuan 2 sampai 4 (maks. 4 tujuan, bisa dihapus). Tanpa tombol + Pick up (satu asal). Disimpan di `rinci.tujuanLain`; jenis lain mengosongkannya. Rute di Daftar, Excel, Performa, dan pembanding tarif memakai semua tujuan (`ruteTrailer`).
- **Belum:** tahap Bongkar masih satu untuk semua tujuan (belum per drop).
