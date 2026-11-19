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
