// Penulisan seragam di formulir Tracking: awal kalimat otomatis huruf kapital, kode (no. kontainer, plat, nomor dokumen) semua kapital.
// Aturan murni diuji di tests/unit/daily-job-huruf.test.mjs; pemasangan lewat satu pendengar "input" untuk elemen di dalam .dj-huruf.

/** Huruf pertama kalimat jadi kapital: awal teks, setelah . ! ? dan baris baru. Huruf lain tidak diubah. */
export const awalKalimat = (t) => String(t ?? "").replace(/(^\s*|[.!?]\s+|\n\s*)([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());
/** Kode: semua huruf kapital. */
export const kapital = (t) => String(t ?? "").toUpperCase();
const BIASA = ["date", "number", "tel", "email", "password", "checkbox", "radio", "file", "search", "hidden", "time"];
/** Mode tiap kolom: data-huruf="besar" (semua kapital), "biasa" (tidak diubah), selain itu "kalimat". Kolom angka dan telepon tidak diubah. */
export function modeHuruf(t) {
  if (t.dataset && t.dataset.huruf) return t.dataset.huruf;
  if (BIASA.includes(t.type)) return "biasa";
  const im = t.getAttribute && t.getAttribute("inputmode"); return im && ["numeric", "tel", "decimal", "email"].includes(im) ? "biasa" : "kalimat";
}
/** Pendengar "input": menerapkan aturan pada kolom di dalam .dj-huruf dan menjaga posisi kursor. */
export function aturHuruf(ev) {
  const t = ev.target; if (ev.isComposing || !t || !t.closest || !t.closest(".dj-huruf") || !/^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
  const m = modeHuruf(t); if (m === "biasa") return; const v = t.value, n = m === "besar" ? kapital(v) : awalKalimat(v);
  if (n !== v) { const a = t.selectionStart, b = t.selectionEnd; t.value = n; try { t.setSelectionRange(a, b); } catch (_) { /* tipe tanpa kursor */ } }
}
