// ===========================================================
// WARNA VENDOR — tiap vendor punya warna khusus supaya baris tabel
// mudah dibedakan. Warna disimpan sebagai "hue" (0-359) di dokumen
// vendor (field warnaHue); kalau belum dipilih, dipilihkan otomatis.
// Warna bukan satu-satunya pembeda: selalu disertai inisial dan nama.
// ===========================================================
export const PALET_HUE = [215, 160, 28, 280, 345, 190, 95, 320, 50, 245];

function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function hueVendor(vendor) {
  if (vendor && Number.isFinite(Number(vendor.warnaHue))) return Number(vendor.warnaHue);
  return PALET_HUE[hash(vendor ? vendor.id || vendor.nama : "x") % PALET_HUE.length];
}

export function inisial(nama) {
  const t = String(nama || "?").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
  return ((t[0] || "?")[0] + (t[1] ? t[1][0] : (t[0] || "")[1] || "")).toUpperCase();
}
