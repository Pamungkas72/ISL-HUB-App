# Keamanan

## Melaporkan kerentanan
Jangan membuka issue publik untuk celah keamanan. Kirim laporan lewat **Security > Report a vulnerability** di halaman repositori ini, atau email ke pemilik proyek (kontak ada di halaman Pengaturan aplikasi). Sertakan langkah menirukan, dampak, dan versi (kode versi tampil di bawah aplikasi).

## Yang perlu diketahui
- Aplikasi ini sistem internal PT Indo Sukses Logistik. Data bisnis ada di Firebase (Firestore dan Storage), **bukan di repositori ini**.
- Akses data diatur oleh `firestore.rules` dan `storage.rules` (peran master, admin, sales, lihat saja). Kunci API Firebase di `public/js/firebase-config.js` memang bersifat publik dan bukan rahasia.
- Rahasia CI (akun layanan deploy, akun uji) hanya ada di GitHub Secrets dan tidak boleh ditulis di berkas atau di issue dan PR.
- Kontribusi dari luar hanya diterima lewat pull request yang ditinjau pemilik. Pemeriksaan CI untuk PR dari fork berjalan tanpa akses rahasia.
