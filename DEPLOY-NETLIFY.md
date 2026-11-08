# Deploy ISL HUB v8 ke Netlify (drag and drop)

Netlify hanya menayangkan situs. **Database, login, dan penyimpanan tetap di Firebase.** Aturan Firestore dan Storage tetap dipasang lewat terminal (lihat `DEPLOY-FIREBASE.md`, perintah `firebase deploy --only firestore:rules,storage`).

## Langkah
1. Buka Netlify > Sites > **Add new site > Deploy manually**.
2. Seret **folder `public`** (bukan folder induknya) ke kotak unggah. Pastikan `_headers` ada di dalam `public/`; itu yang memasang header keamanan dan aturan cache.
3. Untuk update, buka site > **Deploys** > seret folder `public` lagi.

## Wajib setelah situs Netlify tayang
1. **Authorized domains**: Firebase Console > Authentication > Settings > Authorized domains > Add domain, isi alamat Netlify (mis. `nama-situs.netlify.app` dan domain sendiri kalau ada). Tanpa ini login gagal dengan pesan domain tidak diizinkan.
2. **API key**: kalau API key dibatasi, tambahkan `https://nama-situs.netlify.app/*` di Google Cloud Console > APIs & Services > Credentials.
3. **CORS Storage** (opsional, untuk foto di PDF): tambahkan alamat Netlify ke `origin` di `cors-storage.json`, lalu jalankan
   `gsutil cors set cors-storage.json gs://system-marketing-bd-isl-2026.firebasestorage.app`
4. Lakukan urutan setelah deploy di `DEPLOY-FIREBASE.md` (pisahkan modal, setujui akun, refresh keras).

## Catatan
- Kalau CSP di `_headers` diubah, ubah juga bagian yang sama di `firebase.json` supaya dua target tetap setara.
- Rollback: Netlify > Deploys > pilih deploy lama > **Publish deploy**.
