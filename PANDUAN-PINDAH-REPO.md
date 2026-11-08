# Panduan: pindah ke repositori publik baru, arsipkan yang lama

Dibuat 8 Nov 2026. Tujuan: kerja selanjutnya di repositori **publik baru** (Actions gratis, tanpa riwayat lama), sedangkan repositori sekarang **ISL-Company1818/ISL-HUB** diarsipkan (privat, hanya baca) sebagai catatan sejarah.

Semua langkah GitHub dan Google Cloud dilakukan **pemilik akun**. Perkiraan waktu: 45 sampai 60 menit. Kerjakan berurutan.

Nama yang dipakai di panduan ini (boleh diganti): repositori baru **ISL-HUB-publik**.

---

## Gambaran urutan
| Tahap | Isi | Siapa |
|---|---|---|
| 0 | Persiapan dan cadangan | Pemilik |
| 1 | Membuat repositori baru (kosong, publik) | Pemilik |
| 2 | Mengisi repositori baru dengan berkas bersih | Pemilik atau Claude |
| 3 | Rahasia deploy dan pengaturan keamanan | Pemilik |
| 4 | Uji: CI hijau dan deploy berhasil | Pemilik dan Claude |
| 5 | Mengarsipkan repositori lama | Pemilik |
| 6 | Bekerja di repositori baru (sesi Claude) | Pemilik dan Claude |

**Jangan lompat ke tahap 5** sebelum tahap 4 berhasil. Selama dua repositori sama-sama aktif, pastikan hanya satu yang bisa men-deploy (lihat tahap 5).

---

## Tahap 0. Persiapan
1. Selesaikan atau tutup PR yang masih terbuka di repositori lama. Gabungkan dulu cabang yang berisi skrip ekspor (`tools/ekspor-publik.sh`) ke `main`, atau jalankan skrip dari cabang itu (`git checkout ccr-b4e54d6f-sbez8d`). Perubahan hanya berupa dokumen dan skrip, jadi aman digabung walau CI belum bisa jalan.
2. Cadangkan repositori lama: di komputer, `git clone --mirror https://github.com/ISL-Company1818/ISL-HUB.git` (salinan lengkap dengan riwayat). Simpan di tempat aman.
3. Pastikan aplikasi live berjalan normal. Catat kode versi di bagian bawah aplikasi (mis. `v e926d84 · 08 Nov 2026`). Setelah tahap 4, kode itu harus berubah.

## Tahap 1. Buat repositori baru
1. Buka **github.com/new**.
2. Owner: **ISL-Company1818**. Repository name: **ISL-HUB-publik**.
3. Pilih **Public**.
4. **Jangan** centang Add a README, .gitignore, atau license (repositori harus kosong).
5. Klik **Create repository**.
6. Instal aplikasi **Claude** di repositori baru supaya sesi Claude Code bisa bekerja di sana: buka https://github.com/apps/claude/installations/select_target , pilih ISL-Company1818, lalu tambahkan repositori `ISL-HUB-publik` ke daftar yang diizinkan.

## Tahap 2. Isi repositori baru (tanpa riwayat lama)

### Cara 1 (paling mudah): minta Claude yang mengisi
Mulai sesi Claude Code baru, minta menyalin berkas bersih ke `ISL-HUB-publik`. Claude menjalankan skrip ekspor dan mendorongnya. Anda tinggal memeriksa hasilnya di GitHub.

### Cara 2: lewat komputer Anda
```bash
git clone https://github.com/ISL-Company1818/ISL-HUB.git      # atau pakai folder yang sudah ada
cd ISL-HUB
git checkout ccr-b4e54d6f-sbez8d                               # cabang berisi skrip ekspor, bila belum digabung
bash tools/ekspor-publik.sh ../ISL-HUB-publik                  # salin berkas bersih, tanpa riwayat

cd ../ISL-HUB-publik
```
Periksa dulu isinya sebelum diunggah. Tidak boleh ada yang tercetak oleh perintah ini:
```bash
grep -rIlE "BEGIN (RSA |EC )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}" . --exclude-dir=vendor --exclude-dir=.git
ls *.md        # AUDIT-*, CATATAN-SESI, CATATAN-PERUBAHAN-* tidak ada; CLAUDE.md ada
```
Lalu unggah:
```bash
git init -b main
git add -A
git commit -m "Versi awal repositori publik"
git remote add origin https://github.com/ISL-Company1818/ISL-HUB-publik.git
git push -u origin main
```
Catatan: dorongan pertama ke `main` memicu workflow Deploy Firebase. Bila rahasia belum diisi (tahap 3), deploy gagal; itu wajar dan tidak merusak apa pun. Jalankan ulang setelah tahap 3.

## Tahap 3. Rahasia deploy dan pengaturan keamanan

### 3a. Kunci akun layanan baru (untuk deploy otomatis)
1. Buka **console.cloud.google.com**, pilih proyek **system-marketing-bd-isl-2026**.
2. **IAM & Admin > Service Accounts**. Pakai akun layanan deploy yang sudah ada (peran: *Firebase Rules Admin* dan *Firebase Hosting Admin*), atau buat baru dengan dua peran itu.
3. Buka akun layanan itu, tab **Keys > Add key > Create new key > JSON**. File JSON terunduh. Perlakukan seperti kata sandi: jangan dikirim lewat chat atau email.
4. Di repositori baru: **Settings > Secrets and variables > Actions > New repository secret**. Name: `FIREBASE_SERVICE_ACCOUNT`, Secret: tempel **seluruh isi** file JSON. Simpan.
5. Hapus file JSON dari komputer setelah dipasang.
6. Bila tes manual akun uji dipakai, isi juga `UJI_EMAIL` dan `UJI_PASSWORD` dengan cara yang sama (akun uji, bukan akun master).

### 3b. Pengaturan GitHub repositori baru (Settings)
- **Actions > General**
  - *Fork pull request workflows from outside collaborators*: pilih **Require approval for all outside collaborators** (setiap workflow dari orang luar harus Anda setujui dulu).
  - *Workflow permissions*: **Read repository contents permission**.
- **Advanced Security** (atau Code security): nyalakan **Secret scanning**, **Push protection**, dan **Dependabot alerts**.
- **Rules > Rulesets** (atau Branches): lindungi `main`: wajib lewat pull request, dan wajib status check hijau. Nama check muncul setelah workflow berjalan sekali: `asap`, `aturan`, dan `audit (gelap, hp)`, `audit (gelap, desktop)`, `audit (terang, hp)`, `audit (terang, desktop)`.
- **General**: matikan fitur yang tidak dipakai (Wiki, Projects) bila tidak perlu.

### 3c. Pengaturan Firebase / Google Cloud
- **Kunci API web**: Google Cloud > APIs & Services > Credentials > kunci browser proyek ini > *Application restrictions*: **Websites**, isi domain aplikasi (mis. `system-marketing-bd-isl-2026.web.app`, `system-marketing-bd-isl-2026.firebaseapp.com`, dan domain sendiri bila ada). Pastikan aplikasi live masih bisa login setelah diubah; kalau tidak bisa, kembalikan.
- **Authentication > Settings > Authorized domains**: hanya domain aplikasi.
- **App Check**: nyalakan bila memungkinkan (Firebase Console > App Check).
- **Pendaftaran mandiri**: saat ini siapa pun bisa mendaftar dan statusnya "menunggu" sampai master menyetujui. Bila tidak diperlukan, batasi.
- **Akun master**: nyalakan verifikasi 2 langkah di akun Google `codcodan1@gmail.com` dan akun GitHub pemilik.

## Tahap 4. Uji repositori baru
1. Tab **Actions** di repositori baru: bila muncul tombol *I understand my workflows, go ahead and enable them*, klik.
2. Jalankan ulang workflow **Deploy Firebase** (Actions > Deploy Firebase > Run workflow, cabang `main`). Harus hijau.
3. Buka aplikasi live, muat ulang keras. **Kode versi di bawah aplikasi harus berubah** (kode commit baru dari repositori baru). Cek cepat: login, Quotation, menu Uang Jalan (hanya master dan admin).
4. Buat satu PR kecil uji (mis. ubah satu kata di catatan). Semua check harus hijau. Bila Actions macet dengan pesan penagihan, ingat repositori publik memakai menit gratis tanpa batas; pastikan repositori sudah benar-benar **Public**.
5. Setelah semuanya hijau, lanjut ke tahap 5.

## Tahap 5. Arsipkan repositori lama (ISL-HUB)
Urutannya penting supaya tidak ada dua tempat yang bisa men-deploy:
1. **Matikan Actions di repositori lama**: Settings > Actions > General > **Disable actions**.
2. **Hapus rahasia di repositori lama**: Settings > Secrets and variables > Actions: hapus `FIREBASE_SERVICE_ACCOUNT`, `UJI_EMAIL`, `UJI_PASSWORD`.
3. **Hapus kunci akun layanan lama** di Google Cloud (IAM & Admin > Service Accounts > Keys), jika Anda membuat kunci baru di tahap 3a. Pastikan kunci baru yang dipakai repositori baru tetap ada.
4. Opsional: ganti nama repositori lama menjadi **ISL-HUB-arsip** (Settings > General > Repository name) supaya tidak tertukar.
5. **Arsipkan**: Settings > General > **Danger Zone > Archive this repository**. Repositori jadi hanya-baca dan tetap **privat**. Dapat dibuka kembali kapan saja lewat tombol Unarchive, jadi aman.
6. **Jangan menghapus** repositori lama dan jangan menjadikannya publik: riwayat lamanya memuat catatan audit dan nama pelanggan.

## Tahap 6. Bekerja di repositori baru
1. Mulai **sesi Claude Code baru** dan pilih repositori **ISL-HUB-publik**. Sesi lama yang terikat ke repositori lama tidak dipakai lagi.
2. Aturan kerja Anda (`CLAUDE.md`) ikut terbawa, jadi kebiasaan yang sama berlaku: tanya lewat pop-up, audit tema, dan seterusnya.
3. Alur harian: Claude bekerja di cabang, buat PR, tunggu CI hijau, gabungkan, deploy otomatis berjalan.
4. Aturan baru karena repositori publik: **jangan** menulis data pelanggan, harga modal, nomor rekening, atau kata sandi di kode, catatan `.md`, issue, PR, atau komentar. Isi seperti itu hanya boleh ada di aplikasi (Firestore).
5. Tinjau setiap PR dari orang luar sebelum menyetujui workflow-nya.

---

## Bila ada yang salah
- **Deploy gagal di repositori baru**: periksa rahasia `FIREBASE_SERVICE_ACCOUNT` (isi JSON utuh) dan peran akun layanannya. Repositori lama bisa diaktifkan lagi (Enable actions, Unarchive) untuk kembali sementara.
- **Login aplikasi rusak setelah membatasi kunci API**: longgarkan pembatasan domain di Google Cloud atau tambahkan domain yang terlewat.
- **Berkas penting tidak ikut tersalin**: ambil dari repositori lama (masih utuh) atau dari cadangan mirror tahap 0, lalu commit di repositori baru.

## Ringkasan centang
- [ ] Cadangan mirror repositori lama
- [ ] Repositori baru publik dan kosong dibuat; aplikasi Claude dipasang di sana
- [ ] Berkas bersih terunggah (tanpa AUDIT/CATATAN-SESI/CATATAN-PERUBAHAN, ada CLAUDE.md)
- [ ] Secret `FIREBASE_SERVICE_ACCOUNT` terpasang; pengaturan keamanan GitHub dan Firebase selesai
- [ ] Deploy hijau dan kode versi di aplikasi berubah
- [ ] Actions dimatikan, rahasia dihapus, repositori lama diarsipkan (tetap privat)
- [ ] Sesi Claude baru dimulai di repositori baru
