// ===========================================================
// GAMBAR — memperkecil foto sebelum diunggah (hemat kuota & cepat).
// Foto diperkecil ke sisi terpanjang 1280 px, JPEG kualitas 0.75.
// File non-gambar (mis. PDF) dikembalikan apa adanya.
// ===========================================================
export async function perkecilGambar(file, { maks = 1280, kualitas = 0.75 } = {}) {
  if (!file || !String(file.type).startsWith("image/") || file.type === "image/gif") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const skala = Math.min(1, maks / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * skala));
  const h = Math.max(1, Math.round(bitmap.height * skala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", kualitas));
  if (!blob || blob.size >= file.size) return file; // kalau tidak lebih kecil, pakai aslinya
  const nama = String(file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], nama, { type: "image/jpeg" });
}

/* Tanda tangan atau cap dari foto di atas kertas: latar kertas dibuat transparan, tinta (hitam atau warna cap) dipertahankan,
   lalu gambar dipotong pas di sekeliling tinta. Kertas = kecerahan persentil ke-90 foto. Hasil PNG (data URL), atau null
   kalau latarnya tidak cukup terang untuk dipisahkan dengan aman. */
export async function hapusLatarGambar(file, { maks = 600 } = {}) {
  if (!file || !String(file.type).startsWith("image/") || file.type === "image/gif") return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const skala = Math.min(1, maks / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * skala));
  const h = Math.max(1, Math.round(bitmap.height * skala));
  const kanvas = document.createElement("canvas");
  kanvas.width = w;
  kanvas.height = h;
  const ctx = kanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const piksel = ctx.getImageData(0, 0, w, h);
  const px = piksel.data;

  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 16) continue;
    hist[Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114)]++;
    n++;
  }
  if (!n) return null;
  let kumulatif = 0, kertas = 255;
  for (let l = 0; l < 256; l++) {
    kumulatif += hist[l];
    if (kumulatif >= n * 0.9) { kertas = l; break; }
  }
  if (kertas < 120) return null;

  const jepit = (x) => Math.min(1, Math.max(0, x));
  let kiri = w, atas = h, kanan = -1, bawah = -1;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const gelap = jepit((kertas - 20 - lum) / 90); // tinta hitam atau biru tua: lebih gelap dari kertas
    const warna = jepit((Math.max(r, g, b) - Math.min(r, g, b) - 45) / 50); // cap merah atau biru
    const a = Math.max(gelap, warna);
    const alfa = a * a * (3 - 2 * a); // tepi tinta dibuat tegas, bukan kabur
    px[i + 3] = Math.round(alfa * 255);
    if (alfa > 0.08) {
      const p = (i / 4) % w, q = Math.floor(i / 4 / w);
      if (p < kiri) kiri = p;
      if (p > kanan) kanan = p;
      if (q < atas) atas = q;
      if (q > bawah) bawah = q;
    }
  }
  if (kanan < 0) return null;
  ctx.putImageData(piksel, 0, 0);

  const pad = 4;
  const x0 = Math.max(0, kiri - pad), y0 = Math.max(0, atas - pad);
  const x1 = Math.min(w, kanan + pad + 1), y1 = Math.min(h, bawah + pad + 1);
  const hasil = document.createElement("canvas");
  hasil.width = x1 - x0;
  hasil.height = y1 - y0;
  hasil.getContext("2d").drawImage(kanvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  return hasil.toDataURL("image/png");
}
