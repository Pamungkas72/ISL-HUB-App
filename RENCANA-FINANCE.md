# Rencana halaman Finance (dicatat 26 Nov 2026, untuk dilanjutkan)

Acuan: alur Mekari Expense (pengajuan, approval berjenjang, pencairan) digabung dengan **order-to-cash** per nomor job.

## Prinsip
- **Nomor job = buku besar mini**: cost, tagihan, pembayaran, profit.
- **Dua lajur status**: Operasional (Open → Berjalan → Selesai) dan Keuangan (Cost keluar → Siap ditagih → Ditagih → Terbayar → **Clear**).
- **Clear = pembayaran customer penuh**, bukan job selesai. Hutang vendor dipantau terpisah (flag), tidak menahan clear.
- Kerangka sama di semua divisi; isi mengikuti kelompok (lihat `RENCANA-DAILY-JOB-DIVISI.md`).

## Permintaan dana internal (keputusan 26 Nov 2026)
- Untuk semua divisi: operasional, proyek, kasus, kegiatan perusahaan. Bukan klaim ke customer.
- Jenis: permintaan dana (cash advance) dan reimbursement.
- Alur: `Diajukan → Disetujui (berjenjang menurut nominal) → Dicairkan → Selesai`.
- **Pertanggungjawaban (bukti, sisa dana) tidak menahan penutupan pengajuan**; dipantau lewat laporan.
- Pengajuan ditempel ke nomor job; tanpa job = overhead divisi.
- Plafon dan jenjang approval diatur per divisi.

## Aturan cost job (keputusan 26 Nov 2026)
- Cost job = dana yang dicairkan, dikoreksi bila ada pertanggungjawaban (sisa dikembalikan atau tambahan).

## Fase
1. **Fase 1 (dikerjakan dulu)**: job ledger (cost, tagihan, profit), permintaan dana tertaut job, status keuangan.
2. Fase 2: antrean "Siap ditagih" (selesai + POD kembali), aging piutang dari TOP, pengingat H-7/H/H+7 (email), radar job menggantung.
3. Fase 3: proyeksi kas 30/60/90 hari, limit kredit customer, rekonsiliasi pembayaran (satu transfer banyak job, bayar sebagian, potongan, selisih), analitik margin, penutupan periode dan jejak audit.

## Ide pendukung
- Tarif standar per rute (master uang jalan): sesuai standar = jenjang rendah, di luar standar naik jenjang.
- Alarm margin bocor: cost menyusul setelah tagihan terbit atau tembus standar.
- Ruang kontrol finance: total piutang, lewat jatuh tempo, job belum ditagih, dana belum dipertanggungjawabkan, margin bulan ini.

## Data yang sudah ada (Daily Job Tracking)
`rinci.cost`, `bayar` (cash/TOP), `pod`, `tagihan` (vendor), `tglBayar`, vendor, plat.

## Catatan teknis
- Divisi Finance sekarang hanya lihat quotation dan customer (`public/js/akses.js`); perlu izin baru.
- Perubahan saldo dan status dana lewat Cloud Functions + `firestore.rules`, bukan dari browser.
- Tampilan baru: 3 opsi desain, masing-masing HP dan desktop, tema gelap dan terang.

## Belum diputuskan
- Nominal batas jenjang approval.
- Struktur koleksi Firestore (job keuangan, pengajuan dana, pembayaran).
- Desain tampilan (3 opsi).
