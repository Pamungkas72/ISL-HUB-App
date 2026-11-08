# Panduan: membuka repositori ke publik dengan aman

Langkah lengkap pindah ke repositori baru dan mengarsipkan yang lama: lihat `PANDUAN-PINDAH-REPO.md`.

Dibuat 8 Nov 2026. Tujuan: Actions gratis tanpa membuka data bisnis. Semua langkah di bawah dilakukan **pemilik akun GitHub**; Claude tidak bisa mengubah visibilitas atau pengaturan GitHub.

## Pilihan yang disarankan: repositori publik BARU tanpa riwayat
Mengubah repositori lama menjadi publik ikut membuka **seluruh riwayat commit** (350+), termasuk catatan audit keamanan, nama pelanggan di catatan lama, dan diskusi PR. Riwayat itu tidak bisa ditarik kembali. Yang lebih aman:
1. Di repositori ini jalankan `bash tools/ekspor-publik.sh ../isl-hub-publik`. Skrip menyalin berkas terlacak ke folder baru **tanpa riwayat** dan tanpa catatan internal (`AUDIT-*.md`, `CATATAN-SESI.md`, `CATATAN-PERUBAHAN-*.md`; `CLAUDE.md` ikut karena dibutuhkan sesi Claude). Ubah daftar `KECUALI` di skrip bila perlu.
2. Periksa isi folder itu (terutama `*.md` dan `tests/`), lalu `git init`, commit pertama, dan dorong ke repositori publik baru.
3. Biarkan repositori lama **privat** sebagai arsip dengan seluruh riwayat.
4. Di repositori baru isi Secrets: `FIREBASE_SERVICE_ACCOUNT` (disarankan kunci akun layanan baru, hapus yang lama di Google Cloud), `UJI_EMAIL`, `UJI_PASSWORD` bila tes manual dipakai.

Bila tetap memakai repositori yang sama: semua riwayat terbuka. Hapus/pindahkan catatan audit lebih dulu tidak menolong karena sudah ada di riwayat.

## Yang sudah aman
- Tidak ada kunci privat, token, atau kata sandi di berkas terlacak (diperiksa 8 Nov 2026).
- Kunci API Firebase memang publik; sumber `public/` juga sudah bisa diunduh dari situs live.
- Workflow deploy hanya jalan dari `main` milik akun Pamungkas72 (`github.repository_owner`), tidak dari fork.
- Tes CI memakai Firebase tiruan, tanpa rahasia. Workflow yang butuh rahasia hanya `workflow_dispatch` (manual).

## Pengaturan GitHub sebelum dibuka (Settings repositori)
- **Actions > General > Fork pull request workflows**: pilih *Require approval for all outside collaborators*. Workflow permissions: *Read repository contents*.
- **Code security**: nyalakan *Secret scanning* dan *Push protection*, juga *Dependabot alerts*.
- **Branches**: lindungi `main` (wajib PR, wajib CI hijau).
- **Akun master**: nyalakan verifikasi 2 langkah di akun Google `codcodan1@gmail.com` dan di akun GitHub pemilik. Email master tampil di aturan dan kode, jadi waspada phishing.

## Pengaturan Firebase / Google Cloud sebelum dibuka
- Batasi kunci API web (Google Cloud > APIs & Services > Credentials) hanya untuk domain hosting aplikasi.
- Nyalakan **App Check** bila memungkinkan, dan periksa *Authorized domains* di Authentication.
- Pendaftaran mandiri akun baru saat ini terbuka (status "menunggu" sampai disetujui master). Bila tidak diperlukan, matikan atau batasi.
- Pastikan aturan terbaru ter-deploy dan `tests/rules` hijau.

## Setelah publik
- Jangan menulis data pelanggan, harga modal, atau rekening di issue, PR, komentar, atau catatan `.md`.
- Tinjau setiap PR dari luar sebelum menyetujui workflow-nya.

## Catatan: action dikunci ke SHA (8 Nov 2026)
Pengaturan repositori ini mewajibkan setiap GitHub Action dikunci ke SHA commit penuh (Settings > Actions > General > *Require actions to be pinned to a full-length commit SHA*). Semua `uses:` di `.github/workflows/` sudah memakai SHA dengan komentar versi, mis. `actions/checkout@<sha> # v4.4.0`. Akibatnya:
- Menambah action baru wajib memakai SHA, bukan `@v4`. Tanpa itu job gagal di "Set up job" dengan pesan *must be pinned to a full-length commit SHA*.
- Memperbarui versi: ganti SHA dan komentar versinya (SHA tag ada di halaman rilis action itu). Dependabot version updates dapat melakukannya otomatis bila `dependabot.yml` dibuat.
