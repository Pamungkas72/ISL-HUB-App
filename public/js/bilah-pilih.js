// Bilah pilih banyak bersama (desain disetujui 19 Nov 2026): HP = bilah ringkas, aksi lain dan Hapus di menu ⋮;
// desktop = pil melayang di bawah tengah. Dipakai semua halaman yang punya pilih banyak. Aturan: CLAUDE.md.
const TONG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
const X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
/* o: { nama, n, total, semua (atribut data-* tombol Pilih semua, atau null bila sudah semua), batal (atribut), aksi: [{ attr, label, icon }], hapus: { attr, label } | null } */
export function bilahPilih(o) {
  if (!o.n) return '';
  const hp = matchMedia('(max-width: 760px)').matches, semuaTeks = `Pilih semua (${o.total})`;
  const tombolSemua = o.semua ? `<button type="button" class="pbar__l" ${o.semua}>${semuaTeks}</button>` : '';
  if (hp) return `<div class="pbar pbar--hp" role="region" aria-label="${o.nama} terpilih">
    <button type="button" class="pbar__x" ${o.batal} aria-label="Batal pilih">${X}</button>
    <b class="pbar__n">${o.n} dipilih</b><span class="pbar__r"></span>${tombolSemua}
    <details class="pbar__menu"><summary class="pbar__ic" aria-label="Lainnya">⋮</summary><div class="pbar__list">
      ${o.semua ? `<button type="button" ${o.semua}>${semuaTeks}</button>` : ''}
      <button type="button" ${o.batal}>Batal pilih</button>
      ${o.aksi.map(a => `<button type="button" ${a.attr}>${a.icon || ''}${a.label}</button>`).join('')}
      ${o.hapus ? `<button type="button" class="pbar__bahaya" ${o.hapus.attr}>${TONG}${o.hapus.label}…</button>` : ''}
    </div></details></div>`;
  return `<div class="pbar pbar--ds" role="region" aria-label="${o.nama} terpilih">
    <b class="pbar__n">${o.n} dipilih</b>${tombolSemua}
    ${o.aksi.map(a => `<button type="button" class="pbar__a" ${a.attr}>${a.icon || ''}${a.label}</button>`).join('')}
    <button type="button" class="pbar__l" ${o.batal}>Batal</button>
    ${o.hapus ? `<button type="button" class="pbar__ic pbar__ic--bahaya" ${o.hapus.attr} aria-label="${o.hapus.label}" title="${o.hapus.label}">${TONG}</button>` : ''}
  </div>`;
}
window.bilahPilih = bilahPilih;
