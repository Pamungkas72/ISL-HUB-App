# Rencana halaman Legal (dicatat 19 Nov 2026)

## Keputusan pemilik
- **Desain**: desktop = hub kartu (C), HP = daftar tunggal dengan tab dan chip (B).
- **Akses**: admin dan master saja (`SEMBUNYI_PERAN` di `nav-config.js` menyembunyikan `legal` untuk sales, lihat, dj).
- **Pengingat kontrak habis**: 60 dan 30 hari sebelum berakhir (banner di Legal + notifikasi push yang ada).
- Menu "Legal" di navbar, setelah Daily Job, sebelum Pengaturan.

## Isi halaman
1. **Kontrak**: customer dan vendor. Nomor, pihak, lini bisnis, nilai, mulai, berakhir, status (draft/aktif/segera habis/berakhir), lampiran PDF, riwayat perpanjangan.
2. **Dokumen perusahaan**: akta pendirian, NIB, NPWP, SIUP/izin lain. Berkas, nomor, masa berlaku (opsional, pengingat bila ada).
3. **Template kontrak**: sewa kendaraan, proyek, logistik, lainnya per lini. Versi, isian variabel (nama pihak, nilai, tanggal), hasil PDF.
4. **MOM**: editor (judul, tanggal, tempat, peserta, agenda, pembahasan, keputusan, tindak lanjut + PIC + tenggat) -> PDF instan sesuai contoh dari pemilik. Mendukung bahasa Indonesia dan English (aturan Bahasa dokumen).
5. **MOU/lainnya**: dokumen bebas dengan lampiran.
6. **Pengingat**: banner "Perlu tindakan", daftar Akan berakhir, tindak lanjut MOM yang lewat tenggat.

## Tahap
1. Kerangka halaman, menu, rute, aturan Firestore/Storage, data kontrak + dokumen perusahaan + pengingat.
2. MOM: editor + PDF (menunggu contoh MOM dari pemilik).
3. Template kontrak + pembuat PDF kontrak.

## Pertanyaan terbuka
- Contoh MOM (PDF/gambar) dan logo/kop yang dipakai.
- Daftar isi tiap template kontrak (pasal baku) dari pemilik/legal.

## Keputusan lanjutan (19 Nov 2026)
Tahap awal: **Kontrak berjalan (upload) + pengingat** dan **MOM**. Template kontrak ditunda (belum ada contoh).

### MOM
- **Desain UI**: B (satu halaman, bagian dilipat; pembahasan sebagai kartu). HP: bilah bawah Pratinjau + Buat PDF. Desktop: daftar bagian di kiri, editor di kanan.
- **Desain PDF**: gaya quotation (kop ISL, huruf dan warna sama, kartu dan lencana A/B/C); semua PDF di sistem memakai karakter yang sama. Halaman 1 info, peserta, pembahasan, tindak lanjut, tanda tangan; halaman 2 Capaian Target (diisi manual) dan Dokumentasi foto.
- **Fitur**: tanda tangan dari profil akun (alur sama dengan quotation; penyetuju opsional); tindak lanjut (PIC, tenggat, status); foto dokumentasi; nomor MOM otomatis (MOM/ISL/XI/2026/007); bahasa ID/English (aturan Bahasa dokumen); salin dari MOM lama; bagikan PDF (WhatsApp/email); kaitkan ke customer/kontrak; Draf -> Final (terkunci, revisi = versi baru).
- **Peserta**: ketik bebas + saran dari nama yang pernah dipakai.
- **Akses**: semua akun membuat MOM sendiri; admin/master melihat semua. Menu Legal tampil untuk semua peran, tetapi tab Kontrak dan Dokumen perusahaan hanya admin/master.
- Bagian "Hasil Visit" dibuang; tiap topik bisa diberi label (Meeting/Visit).

### Kontrak berjalan
- Upload PDF kontrak customer/vendor. Data: nomor, pihak, jenis (kontrak/MOU/addendum), lini bisnis, tanggal mulai dan berakhir, nilai, PIC internal.
- Tambahan: perpanjangan otomatis (penanda), catatan, riwayat perpanjangan (lampiran versi baru), status otomatis (aktif/segera habis/berakhir).
- Pengingat: 60 dan 30 hari sebelum berakhir.

## Status pembangunan (19 Nov 2026)
- Terbangun: menu Legal (master, admin, sales), kontrak berjalan (upload PDF, perpanjang, riwayat, pengingat 60/30 hari di banner dan lonceng), MOM (editor, PDF bergaya quotation ID/English, final terkunci, revisi, salin, bagikan, foto), aturan Firestore dan Storage, uji aturan, adegan audit tema.
- File: `js/legal.js`, `js/legal-mom.js`, `js/legal-hitung.js`, `css/legal.css`; hook PDF `window.__islDok` di `app-core.js`.
- Belum: template kontrak (menunggu contoh), pengingat tindak lanjut MOM ke PIC (push), penyetuju MOM dari akun (kini nama + tanda tangan basah).
- Deploy aturan: `firebase deploy --only firestore:rules,storage` (otomatis lewat deploy-firebase.yml saat merge).

## Revisi tata letak (19 Nov 2026)
- Pencarian di paling atas; tombol Buat MOM dan Tambah dokumen di header dihapus; Ringkasan dan tab Semua dihapus (peringatan kontrak jadi banner di tab Kontrak dan tetap di lonceng).
- Tiga tab: **Perusahaan** (kartu kelengkapan per perusahaan grup: induk dan anak, 8 jenis dokumen legalitas, cincin kelengkapan; ketuk untuk detail), **Kontrak** (customer, vendor, MOU; unggah file atau simpan draf), **MOM** (dikelompokkan per bulan).
- Satu tombol + (FAB bulat, bahasa desain Master Rate dan Customer) dengan aksi menurut tab. Koleksi baru `lg_perusahaan` (master dan admin).
