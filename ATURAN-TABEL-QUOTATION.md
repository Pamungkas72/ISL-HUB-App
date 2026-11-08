# Aturan tabel quotation

## Pilihan tabel
- **Satu lini bisnis** (mis. hanya Custom Clearance atau hanya Depo): tabel memakai desain tabel milik lini bisnis itu, dari Template per lini bisnis.
- **Lintas lini bisnis** (tarif dari beberapa lini dalam satu penawaran): tabel memakai **tabel universal**.
- Desain tabel universal dibahas setelah semua desain lini bisnis selesai.

## Trucking Trailer
- **Export dan import:** lokasi penentu adalah port (mis. Tanjung Priok). Tabel berisi lokasi gudang, tipe trailer (20 ft, 40 ft) dengan harga, dan keterangan.
- **Domestik:** pengiriman domestik juga memakai trailer. Tabel berisi **satu baris per rute** (asal dan tujuan), dengan kolom harga 20 ft dan 40 ft, dan keterangan. Strukturnya sama dengan ekspor/impor, hanya kolom lokasinya diganti rute.

## Desain per lini
Setiap lini punya satu desain yang dipilih. Lini dengan lebih dari satu jenis tabel memakai satu desain untuk semua jenisnya.
Status: Customs Clearance = **"Kartu ringan" varian C** (4 Nov 2026: pita jalur tipis hijau/merah/biru/oranye + kartu per sub-kelompok, kepala kartu sendiri; dokumen terbit lama tetap desain A). Depo = **"Kartu ringan"** (3 Nov 2026). Trucking Trailer = **"Kartu ringan" Desain A + D2 (4 Nov 2026)**, selaras dengan Customs Clearance varian C: lihat `CATATAN-TAMPILAN.md`. Trucking Distribusi (box/bak) = **"Kartu ringan" pita pick up + kolom Layanan** (4 Nov 2026: pick up lebih dari satu jadi pita per asal di dalam kartu; lihat `CATATAN-TAMPILAN.md`).

## Alur pemilihan tabel Trucking Trailer
1. Saat membuat quotation untuk lini Trucking Trailer, pengguna memilih dulu jenis pengiriman: **Ekspor/Impor** atau **Domestik**.
2. Pilihan Ekspor/Impor memakai tabel ekspor dan impor (lokasi gudang, 20 ft, 40 ft, keterangan).
3. Pilihan Domestik memakai tabel domestik yang sudah disepakati (rute, type 20 ft/40 ft, harga, keterangan).
4. Kedua tabel memakai satu desain: **Desain A + D2**: pita biru ISL per jenis pengiriman, lalu satu kartu dengan kepala kolom sendiri; buntut ada di dalam sel tarif.

## Buntut (Trailer)
- Pilihan buntut: **Rangka, Flatbed, Lowbed, Dolly**. Tiap baris harga punya pilihan **Buntut** (kosong = Rangka standar); harga tetap 20 ft dan 40 ft untuk semua buntut.
- **Buntut kosong tidak memblokir penerbitan.** Tidak ada kewajiban memilih buntut. S&K per buntut hanya wajib untuk buntut non-standar (Flatbed, Lowbed, Dolly) yang punya harga; Rangka tidak.
- **Buntut ada di dalam kolom tarif.** Satu lokasi atau rute bisa punya beberapa buntut. Formulir (web dan HP): satu kartu per lokasi/rute, Rangka di baris harga pertama, tombol "+ Buntut lain" menambah baris harga buntut di kartu yang sama; keterangan opsional per kartu. PDF: satu baris bertumpuk per lokasi.
- **Rangka adalah bawaan dan tidak pernah ditulis di PDF.** Flatbed (oranye), Lowbed (hijau), Dolly (abu) tampil sebagai lencana di samping harganya; buntut ketik bebas lain berlencana abu.
- Keterangan per baris (mis. Head Tronton) opsional, tampil sebagai sub-baris di bawah lokasi atau rute; bila lokasi punya beberapa buntut, keterangan buntut non-Rangka diawali nama buntutnya.
- S&K per buntut wajib diisi di Master Rate untuk setiap buntut yang dipakai di baris tarif, walau chip buntut di atas formulir tidak dicentang.
- Domestik: kolom **Rute** satu teks bebas (2 sampai 3 titik, mis. Jakarta – Surabaya – Bandung). Pemisah `-`, `–`, `>` diseragamkan jadi panah di PDF. Tanpa port.
- Ekspor/Impor: port tampil di pita ("Import dan Export — Pick up Tanjung Priok, Jakarta").

## Tipe unit per quotation (Trucking Distribusi)
- Di atas tabel ada centang tipe unit: CDE, CDD, FUSO, TRONTON. Semua tercentang saat quotation dibuat.
- Kolom tipe yang tidak dicentang tidak tampil di tabel dan PDF, dan harganya tidak ikut dihitung.
- Customer yang hanya meminta satu atau dua tipe cukup menghapus centang tipe lain.

## S&K Trucking Trailer (4 Nov 2026)
- Bawaan baru disusun dari surat penawaran customer yang sudah terbit, ditambah pembayaran ala Customs Clearance: kesepakatan pemilik "angka tertulis di teks" (tidak jadi parameter), kecuali TOP layanan, TOP reimbursement, dan denda pihak ketiga yang sudah berupa parameter.
- 10 butir (butir waktu tunggu bongkar 12 jam dihapus atas permintaan pemilik, 4 Nov 2026): tarif belum termasuk pajak/asuransi kargo/TKBM/handling pelabuhan/container empty; order H-1; biaya inap 50/75/100%; pembatalan hari H Rp 1.000.000; pembatalan muat akibat pemilik barang; tanggung jawab kerusakan dan keamanan; pembayaran invoice pihak ketiga/reimbursement; denda keterlambatan pihak ketiga; Ketentuan pembayaran (TOP layanan dan TOP reimbursement); metode pembayaran.
- Dihapus dari bawaan: waktu tunggu 4 jam, biaya depo at cost, fee administrasi depo, Kepala Engkel/Tronton di keterangan, surat jalan, dan "Payment terms 14 hari" dari Excel koreksi (tombol Excel di Pengaturan kini hanya untuk Distribusi Mobil Kecil).
- **Hanya berlaku untuk S&K Trailer yang belum tersimpan** (pengaturan baru). S&K Trailer yang sudah tersimpan di Pengaturan dokumen tidak diubah; untuk memakai teks baru, sunting butirnya di Pengaturan dokumen > Template lini bisnis > Trucking Trailer. S&K per buntut dari Master Rate tetap ditambahkan di bawahnya.

## Blok REPO (Trucking Trailer, 4 Nov 2026)
- REPO (pemindahan kontainer antar depo, gudang, atau pelabuhan) adalah **blok tabel sendiri**, tidak lagi digabung ke Import dan Export. Urutan blok di formulir dan PDF: **A. Import dan Export, B. REPO, C. Domestik**.
- REPO dan Domestik tidak tampil saat quotation baru dibuat; dimunculkan lewat tombol "tampilkan" di bawah daftar blok. Blok kosong tidak masuk PDF.
- Kolom pertama REPO: **rute bebas asal – tujuan** (seperti Domestik, pemisah jadi panah, tanpa port). Desain tabel sama: pita biru ISL bertuliskan nama blok ("REPO"), kartu dengan kolom Rute, 20 ft, 40 ft, buntut berlencana di dalam sel tarif.
- Draf lama: baris REPO yang dulu digabung ke Import dan Export kini tampil di blok REPO sendiri.

## Daftar tujuan gudang dan harga referensi (Trailer Import dan Export, 4 Nov 2026)
- Hanya untuk blok **Import dan Export** (bukan REPO atau Domestik) dan hanya buntut **Rangka (standar)**. Daftar 41 tujuan gudang dari pemilik (Ancol sampai Berebes, 20 ft dan 40 ft) disimpan sebagai data bawaan sistem (`TRL_REF_EI` di `formulir-lini.js`); angka biru di sumbernya tidak dipakai. Mengganti harga bawaan = perbarui daftar itu.
- Logika sama dengan harga referensi Customs Clearance: tombol **"Isi semua tujuan gudang (rekomendasi)"** menambah kartu untuk semua tujuan yang belum ada (harga kosong); harga referensi tampil transparan di kolom harga; kolom yang dikosongkan **memakai harga referensi di PDF**; baris yang diketik manual dengan nama lokasi cocok (tanpa membedakan huruf besar kecil) juga mendapat referensinya. Sebelum Pratinjau dan Terbitkan muncul pop-up daftar harga yang akan terpakai.
- **Tarif vendor yang lebih tinggi menggantikan referensi:** bila Master Rate punya tarif vendor untuk lokasi dan ukuran yang sama, dan tarif minimumnya (modal vendor tertinggi + markup lini; untuk akun sales batas harga aman) lebih tinggi dari harga bawaan, itu yang dipakai sebagai referensi. Dipakai tarif minimum, bukan modal mentah, supaya referensi tidak menjual di bawah margin dan modal tidak terlihat akun sales.
- Buntut Flatbed, Lowbed, Dolly tidak punya referensi; harga kosong untuk buntut itu tidak masuk PDF. Tujuan yang tidak ada di daftar dan tidak berharga juga tidak masuk PDF.

### Pembaruan 5 Nov 2026: S&K Trailer yang sudah tersimpan ikut diganti
- Pemilik melaporkan S&K di aplikasi live masih lama karena S&K tersimpan di Pengaturan dokumen tidak ikut berubah. Kini ada migrasi satu kali untuk data tersimpan (`pastikanSyaratTrailer`, tanda `PENG.syaratTrailerVer`): butir bawaan lama yang **belum disunting** (daftar di `TRAILER_LAMA`) dibuang dan 10 butir bawaan baru ditambahkan; butir yang sudah disunting atau dibuat pemilik dipertahankan (tampil paling depan). Hanya lini Trailer yang tersentuh. Setelah dijalankan dan tersimpan, butir yang dihapus atau diubah pemilik tidak dikembalikan lagi.
- Draf quotation yang daftar S&K-nya sudah diubah di formulir (`q.tncCc`) dan dokumen yang sudah terbit tidak berubah.

