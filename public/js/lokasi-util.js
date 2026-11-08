// ===========================================================
// LOKASI UTIL — membaca koordinat dari link Google Maps atau angka.
// Link Google Maps APA PUN diterima dan disimpan (tombol "Buka di
// Google Maps" tetap berfungsi). Koordinat dibaca otomatis kalau ada di
// link; kalau tidak ada, koordinat dibiarkan kosong tanpa memblokir simpan.
// Didukung: "-6.3269, 107.1370", derajat-menit-detik (6°19'36"S 107°8'13"E),
// link berisi @lat,lng / ?q= / ?ll= / center= / destination= / !3dLAT!4dLNG /
// place/lat,lng, dan link pendek (maps.app.goo.gl, goo.gl/maps).
// ===========================================================
const valid = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const A = "(-?\\d{1,3}(?:\\.\\d+)?)";
const SEP = "(?:,|%2C)\\s*";

export const urlMaps = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

function dariDms(t) {
  const m = t.match(/(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*["″”]?\s*([NSns])[\s,;]+(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*["″”]?\s*([EWew])/);
  if (!m) return null;
  const n = (x) => Number(String(x).replace(",", "."));
  let lat = n(m[1]) + n(m[2]) / 60 + n(m[3]) / 3600;
  let lng = n(m[5]) + n(m[6]) / 60 + n(m[7]) / 3600;
  if (/s/i.test(m[4])) lat = -lat;
  if (/w/i.test(m[8])) lng = -lng;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

export function parseKoordinat(teks) {
  const t = String(teks || "").trim();
  if (!t) return { ok: true, kosong: true };

  const dms = dariDms(t);
  if (dms && valid(dms.lat, dms.lng)) return { ok: true, ...dms, mapsUrl: urlMaps(dms.lat, dms.lng) };

  const pola = [
    new RegExp(`@${A},\\s*${A}`),
    new RegExp(`[?&](?:q|ll|query|center|destination|daddr|saddr)=${A}${SEP}${A}`),
    new RegExp(`!3d${A}!4d${A}`),
    new RegExp(`/place/${A}${SEP}${A}`),
    new RegExp(`^${A}\\s*[,;\\s]\\s*${A}$`),
  ];
  const adaUrl = /^https?:\/\//i.test(t) || /^(www\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(t);
  for (const p of pola) {
    const m = t.match(p);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (valid(lat, lng)) return { ok: true, lat, lng, mapsUrl: adaUrl ? (/^https?:/i.test(t) ? t : `https://${t}`) : urlMaps(lat, lng) };
    }
  }

  if (adaUrl) {
    const url = /^https?:/i.test(t) ? t : `https://${t}`;
    if (/(google\.[a-z.]+|goo\.gl|maps\.app)/i.test(url)) return { ok: true, lat: null, lng: null, mapsUrl: url, tanpaKoordinat: true };
    return { ok: false, pesan: "Hanya link Google Maps yang diterima. Tempel link dari Google Maps, atau angka koordinat." };
  }
  return { ok: false, pesan: "Tidak terbaca. Tempel link Google Maps (link apa pun dari tombol Bagikan), atau angka koordinat seperti -6.3269, 107.1370." };
}
