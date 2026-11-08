# Aturan kerja untuk sesi Claude di repo ini

Catatan dari pemilik proyek (4 Nov 2026). Berlaku untuk semua sesi berikutnya.

## Efisiensi token
1. **Jangan membuat data contoh/tiruan baru.** Pakai yang sudah ada: Firebase tiruan di `tests/audit/firebase-tiruan.js` dan data awal di `tests/audit/data-contoh.js`. Tambah data hanya bila tampilan yang diuji benar-benar tidak bisa dicapai dengan data yang ada.
2. **Tulis kode ringkas**, komentar seperlunya (satu baris yang menjelaskan "mengapa"), jangan menulis ulang berkas yang tidak berubah.
3. **Membangun atau mengubah skrip pemindai/uji: mulai dari satu halaman sampel**, pastikan logikanya benar, baru diperluas. Ini aturan cara menyusun skrip, **bukan** pembatas cakupan audit: bila pemilik meminta audit semua halaman, semua halaman tetap dipindai (daftar `ADEGAN` di `tests/audit/audit-tema.js`).

## Konsistensi tampilan
- Setiap perubahan tampilan harus berlaku dan diperiksa di **HP dan desktop**, tema **gelap dan terang**. Jalankan `tests/audit/audit-tema.js` (4 kombinasi) dan `audit-halaman-lain.js` sebelum menganggap selesai.
- Warna komponen memakai variabel tema; jangan menulis latar terang langsung. Kertas dokumen (pratinjau PDF) boleh tetap putih.
- Pertanyaan dan pilihan kepada pemilik lewat pop-up pilihan, dengan jawaban yang direkomendasikan di urutan pertama. Untuk perubahan visual besar, tunjukkan 3 desain dalam bentuk gambar dulu.

## Bertanya bila ragu (aturan pemilik, 4 Nov 2026)
- **Selalu tanyakan** hal yang masih membingungkan atau butuh keputusan pemilik, jangan ditebak. Contoh: data asli yang tidak bisa diakses, dua tafsir yang sama masuk akal, urutan penggabungan PR.
- Tanyakan **lewat pop-up pilihan** (`AskUserQuestion`), bukan di teks biasa, dan **taruh jawaban yang direkomendasikan di urutan pertama** dengan label "(Recommended)".
- Hal yang sudah jelas dari permintaan, kode, atau aturan di berkas ini tidak perlu ditanyakan.

## Bahasa dokumen (aturan pemilik, 4 Nov 2026)
- **Bila bahasa quotation diganti ke English, SEMUA yang tampil di dokumen (PDF, pratinjau, Word) harus English, di semua lini dan semua quotation yang terbit**: S&K, judul blok, label kolom, satuan, catatan, info, kalimat pembuka/penutup, judul dokumen (tanpa subjudul Indonesia). Hanya isian bebas user (nama customer, rute, lokasi, nama layanan buatan sendiri) yang boleh tetap apa adanya.
- Teks statis lini yang baru ditambahkan di `formulir-lini.js` atau `app-core.js` **wajib punya terjemahan** di `DOK_EN` / `DOK_EN_POLA` (app-core.js) atau `FL.TNC_LINI_EN` (S&K bawaan lini). Uji asap `tests/asap/uji-asap.js` merender dokumen English tiap lini dan gagal bila masih ada teks Indonesia; tambahkan kata Indonesia baru ke pola `ID` di tes itu bila perlu.

## Alur Git otomatis (aturan pemilik, 8 Nov 2026)
- Setelah pekerjaan selesai dan tes lokal lolos, **langsung commit, push ke cabang kerja, dan buat PR ke `main` tanpa bertanya lagi**. Ini menggantikan kebiasaan lama bertanya sebelum membuat PR.
- Jangan push langsung ke `main` (dilindungi ruleset `Lindungi-main`); semua lewat PR.
- **Menggabungkan** PR tetap hanya setelah semua check hijau dan konfirmasi pemilik lewat pop-up. Setelah gabung, pastikan workflow Deploy Firebase sukses.
- Repo ini publik: jangan menulis data pelanggan, harga modal, rekening, kata sandi, atau kunci di kode, catatan, komentar, atau PR.
