# Aturan kerja untuk sesi Claude di repo ini

Catatan dari pemilik proyek (4 Nov 2026). Berlaku untuk semua sesi berikutnya.

## Efisiensi token
1. **Jangan membuat data contoh/tiruan baru.** Pakai yang sudah ada: Firebase tiruan di `tests/audit/firebase-tiruan.js` dan data awal di `tests/audit/data-contoh.js`. Tambah data hanya bila tampilan yang diuji benar-benar tidak bisa dicapai dengan data yang ada.
2. **Tulis kode ringkas**, komentar seperlunya (satu baris yang menjelaskan "mengapa"), jangan menulis ulang berkas yang tidak berubah.
3. **Membangun atau mengubah skrip pemindai/uji: mulai dari satu halaman sampel**, pastikan logikanya benar, baru diperluas. Ini aturan cara menyusun skrip, **bukan** pembatas cakupan audit: bila pemilik meminta audit semua halaman, semua halaman tetap dipindai (daftar `ADEGAN` di `tests/audit/audit-tema.js`).

## Konsistensi tampilan
- Setiap perubahan tampilan harus berlaku dan diperiksa di **HP dan desktop**, tema **gelap dan terang**. Audit `tests/audit/audit-tema.js` (4 kombinasi) dan `audit-halaman-lain.js` **tidak dijalankan tiap perubahan**; jalankan hanya di akhir sesi saat pemilik meminta.
- Warna komponen memakai variabel tema; jangan menulis latar terang langsung. Kertas dokumen (pratinjau PDF) boleh tetap putih.
- Pertanyaan dan pilihan kepada pemilik lewat pop-up pilihan, dengan jawaban yang direkomendasikan di urutan pertama. Untuk perubahan visual besar, tunjukkan 3 desain dalam bentuk gambar dulu.

## Bertanya bila ragu (aturan pemilik, 4 Nov 2026)
- **Selalu tanyakan** hal yang masih membingungkan atau butuh keputusan pemilik, jangan ditebak. Contoh: data asli yang tidak bisa diakses, dua tafsir yang sama masuk akal, urutan penggabungan PR.
- Tanyakan **lewat pop-up pilihan** (`AskUserQuestion`), bukan di teks biasa, dan **taruh jawaban yang direkomendasikan di urutan pertama** dengan label "(Recommended)".
- Hal yang sudah jelas dari permintaan, kode, atau aturan di berkas ini tidak perlu ditanyakan.

## Bahasa dokumen (aturan pemilik, 4 Nov 2026)
- **Bila bahasa quotation diganti ke English, SEMUA yang tampil di dokumen (PDF, pratinjau, Word) harus English, di semua lini dan semua quotation yang terbit**: S&K, judul blok, label kolom, satuan, catatan, info, kalimat pembuka/penutup, judul dokumen (tanpa subjudul Indonesia). Hanya isian bebas user (nama customer, rute, lokasi, nama layanan buatan sendiri) yang boleh tetap apa adanya.
- Teks statis lini yang baru ditambahkan di `formulir-lini.js` atau `app-core.js` **wajib punya terjemahan** di `DOK_EN` / `DOK_EN_POLA` (app-core.js) atau `FL.TNC_LINI_EN` (S&K bawaan lini). Uji asap `tests/asap/uji-asap.js` merender dokumen English tiap lini dan gagal bila masih ada teks Indonesia; tambahkan kata Indonesia baru ke pola `ID` di tes itu bila perlu.


## Gaya respon (aturan pemilik, 9 Nov 2026)
1. **Langsung ke inti.** Tanpa kalimat pembuka, penutup, atau penjelasan yang tidak diminta.
2. **Format ringkas.** Poin pendek; tabel bila membandingkan.
3. **Kalimat aktif pendek.** Buang kata sifat, keterangan, dan teori yang tidak ditanyakan.
4. **Tanpa repetisi.** Jangan mengulang instruksi pemilik atau merangkum isi chat.
5. **Tebal hanya untuk kata kunci/jawaban utama.**
6. **Selaraskan dengan gaya coding pemilik** (lihat aturan di atas dan kode yang ada): ringkas, komentar satu baris, variabel tema, Bahasa Indonesia.

## PR dan push (aturan pemilik, 9 Nov 2026)
- **PR dibuat otomatis**, tanpa bertanya, setelah perubahan selesai (bila belum ada PR untuk branch itu).
- Tiap pembaruan: **commit dan push otomatis**, dan PR yang ada ikut terbarui.
- Penggabungan (merge) PR tetap menunggu pemilik.
