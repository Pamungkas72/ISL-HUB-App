# Deploy ISL HUB v8 ke Firebase Hosting (lewat terminal)

Project: `system-marketing-bd-isl-2026` (sudah di `.firebaserc`). Untuk Netlify drag and drop, lihat `DEPLOY-NETLIFY.md`.

## Sekali saja
```
npm install -g firebase-tools
firebase login
```

## Deploy (jalankan di folder ini, tempat firebase.json berada)
```
firebase deploy --only firestore:rules,storage,hosting
```
- `firestore:rules` dan `storage` **wajib untuk v8**. Aturannya ditulis ulang untuk peran master, sales, dan lihat saja. Tanpa ini, akun sales tidak bisa bekerja dan modal belum terlindungi.
- Pertama kali `storage` di-deploy, Firebase bisa meminta izin akses lintas layanan (Storage membaca dokumen `pengguna` di Firestore). Setujui.
- `hosting` mengunggah isi folder `public/`. File `_headers` tidak ikut tayang (dikecualikan di firebase.json); header keamanan Firebase ada di `firebase.json`.
- Aturan Firestore di sini menggantikan seluruh aturan yang sedang aktif. Baca dulu aturan lama di Console bila ada koleksi lain yang kamu pakai.

Alamat situs: https://system-marketing-bd-isl-2026.web.app

## Urutan setelah deploy v8 (penting)
1. Login sebagai master (`codcodan1@gmail.com`).
2. **Pengaturan > Akun > Pisahkan modal sekarang.** Memindahkan modal dari dokumen biasa ke koleksi khusus master dan mengisi batas harga aman (`hargaMin`). Aman diulang. Tombol Setujui untuk akun sales terkunci sampai langkah ini selesai.
3. Tim lain (mis. Fathur) yang sudah punya akun akan melihat "Akun menunggu persetujuan" sampai kamu menyetujuinya di **Pengaturan > Akun** (pilih peran Lihat saja atau Sales).
4. Sales baru mendaftar lewat tombol **Daftar** di halaman login, lalu kamu setujui, pilih peran Sales, isi kode sales dan target bulanan.
5. Buka Quotation sekali sebagai master: tanda tangan dan cap versi lama dipindah otomatis ke dokumen pengaturan (supaya PDF sales ikut memuat cap).
6. Refresh keras (Ctrl+Shift+R; di HP buka tab baru atau hapus data situs).

## Setelah audit per peran (31 Oktober 2026)
1. **Pasang aturan Firestore** (wajib, ada perubahan): `firebase deploy --only firestore:rules`. Yang berubah: admin boleh membaca semua template (memeriksa modal sebelum menyetujui sales), admin boleh mencatat dan menghapus kegiatan dan volume miliknya, dan koleksi `pengguna_log` (riwayat perubahan akun).
2. **Bersihkan teks modal lama**: sebagai master, buka Pengaturan > Riwayat koreksi rate > "Bersihkan nilai modal dari riwayat koreksi". Sekali saja.
3. **Cek per peran**: masuk sebagai admin dan sales uji, lalu cek:
   - Admin: Laporan tidak tampil di menu, Rekap tampil, Dashboard Performa menampilkan semua sales, tombol Setujui pendaftar bekerja setelah modal terpisah, dan Catat kegiatan di quotation sales bisa disimpan.
   - Sales: tidak ada kolom Modal atau Margin di Rate Disetujui dan detail quotation, tidak ada tab "Order dan Laba", dan tidak ada tombol Koreksi rate atau Tambah format lini.
4. Tes otomatis aturan bisa dijalankan dari Actions > "Tes aturan Firestore", atau lokal: `firebase emulators:exec --only firestore "npm --prefix tests/rules test"`.

## Cek cepat aturan (wajib, karena belum bisa diuji di emulator saat dibangun)
Masuk dengan akun sales uji dan pastikan:
1. Bisa membuat draf, menerbitkan nomor, dan unduh PDF. Customer baru muncul dengan status menunggu persetujuan.
2. Master Rate dan Pengaturan tidak muncul di menu; membuka `master-rate.html` langsung dialihkan.
3. Quotation milik sales lain tidak terlihat. Kolom modal dan margin tidak ada; hanya lampu hijau/kuning/merah.
4. Di Console browser tidak ada galat `permission-denied` saat kerja normal. Kalau ada, catat nama koleksinya dan kirim ke saya.
5. Master: Pengaturan > "Cek koneksi dan aturan Firebase" semua hijau.
6. Master: buka quotation terbit > **Ganti nomor**. Nomor berubah tanpa galat `permission-denied` (aturan ganti nomor sudah diuji di emulator; tetap periksa setelah deploy).

## Setelah deploy (pengaturan Firebase)
1. **Authorized domains**: Firebase Console > Authentication > Settings > Authorized domains. `web.app` dan `firebaseapp.com` biasanya sudah ada.
2. **Pendaftaran email/password** harus aktif: Authentication > Sign-in method > Email/Password.
3. **API key**: kalau dibatasi ke alamat tertentu, tambahkan `https://system-marketing-bd-isl-2026.web.app/*` dan `https://system-marketing-bd-isl-2026.firebaseapp.com/*` di Google Cloud Console > Credentials.
4. **CORS Storage** (opsional, supaya foto tercetak di PDF profil fasilitas), di Google Cloud Shell:
   `gsutil cors set cors-storage.json gs://system-marketing-bd-isl-2026.firebasestorage.app`
   Tambahkan domain Netlify di `cors-storage.json` bila situs juga dipakai di Netlify.

## Satu sumber untuk tampilan (wajib dibaca)
- **Hanya `main` yang di-deploy.** Kerjakan perubahan di branch baru dari `main`, lalu gabungkan ke `main`. Jangan deploy dari branch lain.
- Deploy otomatis berjalan dari `.github/workflows/deploy-firebase.yml` setiap ada push ke `main`. Jangan jalankan workflow itu dengan memilih branch lain.
- Jangan deploy dari folder lama di komputer atau drag-and-drop ke Netlify tanpa lebih dulu menarik `main` terbaru. Versi lama akan menimpa tampilan yang sedang tayang.
- Setelah deploy, buka situs dan lihat teks versi di pojok kanan atas. Kode commit di sana harus sama dengan commit `main` terbaru. Kalau tidak sama, ada deploy lain yang menimpa.

## Catatan
- Rollback: Firebase Console > Hosting > Release history > Rollback.
- Cadangan: berkas cadangan lama (sebelum modal dipisah) tetap bisa dipulihkan; modalnya otomatis dipisah saat dipulihkan.
