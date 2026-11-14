# Rencana Daily Job per divisi (dicatat 14 Nov 2026, untuk dilanjutkan)

Urutan: selesaikan **Marketing dan BD** dulu, baru divisi lain.

## Prinsip
- **Dashboard tetap mirip** di semua divisi (KPI, performa per orang, backlog, daftar, laporan).
- **Yang berbeda per divisi:** formulir input, impor massal Excel, dan isi PDF.

## Contoh: divisi Tracking
- Volume pengiriman harian.
- POD sudah kembali atau belum.
- Pembayaran vendor: cash atau TOP.
- Tagihan vendor: sudah dikirim, sudah dikonfirmasi.

## Pertanyaan untuk nanti
- Apakah Tracking mencatat per pengiriman (satu baris per DO/shipment) atau ringkasan harian?
- Status khusus (POD kembali, tagihan terkirim) jadi kolom di job atau jenis job terpisah?
- Template Excel dan PDF per divisi: kolom persisnya dari contoh Excel divisi.
- Divisi lain yang akan dipakai setelah Tracking.

## Usulan teknis (belum dikerjakan)
- Tiap kelompok punya `jenisForm` (mis. `marketing`, `tracking`) yang memilih formulir, pemeta impor Excel, dan bagian PDF.
- Dashboard memakai kolom umum (PIC, kategori, target, selesai); kolom khusus disimpan di `job.rinci`.
