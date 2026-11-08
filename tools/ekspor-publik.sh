#!/usr/bin/env bash
# Menyalin pohon berkas yang aman dibuka ke folder baru, TANPA riwayat git, untuk repositori publik baru.
# Pakai:  bash tools/ekspor-publik.sh /jalur/folder-baru
# Berkas catatan internal (audit keamanan dan catatan sesi lama) tidak ikut disalin. CLAUDE.md (aturan kerja pemilik) ikut, supaya sesi Claude berikutnya tetap mengikuti aturan itu.
set -euo pipefail
tujuan="${1:-}"
[ -n "$tujuan" ] || { echo "Pakai: bash tools/ekspor-publik.sh /jalur/folder-baru"; exit 1; }
[ ! -e "$tujuan" ] || [ -z "$(ls -A "$tujuan" 2>/dev/null)" ] || { echo "Folder tujuan harus kosong atau belum ada: $tujuan"; exit 1; }
mkdir -p "$tujuan"
# Daftar yang TIDAK disalin (edit bila perlu)
KECUALI='^(AUDIT-.*\.md|CATATAN-SESI\.md|CATATAN-PERUBAHAN-.*\.md)$'
git ls-files | grep -Ev "$KECUALI" | while IFS= read -r f; do
  mkdir -p "$tujuan/$(dirname "$f")"; cp -p "$f" "$tujuan/$f"
done
echo "Selesai: $(find "$tujuan" -type f | wc -l) berkas disalin ke $tujuan"
echo "Berikutnya: git init, commit pertama, buat repositori publik baru di GitHub, lalu isi secret Actions (lihat KEAMANAN-REPO-PUBLIK.md)."
