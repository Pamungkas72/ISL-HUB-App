// Hitungan murni kontrak Legal (tanpa tampilan): status dan batas pengingat. Dipakai legal.js dan notifikasi.js.
export const BATAS_HARI = { mendesak: 30, segera: 60 }; // pengingat 60 dan 30 hari sebelum berakhir
const selisih = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5);
/** Status kontrak dari tanggal berakhir (YYYY-MM-DD): tanpa tanggal = aktif tanpa batas. */
export function statusKontrak(k, now) {
  if (k.draf) return { kode: "draf", sisa: null, label: "Draf" };
  if (!k.berakhir) return { kode: "aktif", sisa: null, label: "Tanpa batas" };
  const s = selisih(k.berakhir, now);
  if (s < 0) return { kode: "berakhir", sisa: s, label: "Berakhir" };
  if (s <= BATAS_HARI.mendesak) return { kode: "mendesak", sisa: s, label: s + " hari" };
  if (s <= BATAS_HARI.segera) return { kode: "segera", sisa: s, label: s + " hari" };
  return { kode: "aktif", sisa: s, label: s + " hari" };
}
