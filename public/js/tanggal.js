// ===========================================================
// PEMILIH TANGGAL seragam untuk semua <input type="date">.
// - Bisa diketik langsung: dd/mm/yyyy (garis miring otomatis).
// - Tombol kalender membuka kalender sendiri dengan tombol Batal / Hari ini / OK
//   (kalender bawaan HP tidak punya tombol OK dan tidak bisa diketik).
// Nilai input asli tetap berformat yyyy-mm-dd, jadi kode lain tidak perlu diubah.
// ===========================================================
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const p2 = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;
const hariIni = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
const IKON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';

function keTeks(v) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; }
function keIso(t) {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec((t || "").trim()); if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3]; const x = new Date(y, mo - 1, d);
  if (x.getFullYear() !== y || x.getMonth() !== mo - 1 || x.getDate() !== d) return null;
  return iso(y, mo, d);
}
const nilaiAsli = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

function bukaKalender(nat, teks) {
  const awal = nat.value || hariIni(); let [y, m] = awal.split("-").map(Number); let pilih = nat.value || "";
  const min = nat.min || "", max = nat.max || "";
  const sc = document.createElement("div"); sc.className = "isl-kal-scrim";
  const tutup = () => { sc.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); tutup(); } };
  const gambar = () => {
    const kosong = (new Date(y, m - 1, 1).getDay() + 6) % 7, hari = new Date(y, m, 0).getDate(), h = hariIni();
    let sel = HARI.map((x) => `<div class="isl-kal__h">${x}</div>`).join("") + '<div></div>'.repeat(kosong);
    for (let d = 1; d <= hari; d++) {
      const t = iso(y, m, d), mati = (min && t < min) || (max && t > max);
      sel += `<button type="button" class="isl-kal__d${t === h ? " is-ini" : ""}${t === pilih ? " is-pilih" : ""}" data-t="${t}" ${mati ? "disabled" : ""}>${d}</button>`;
    }
    sc.innerHTML = `<div class="isl-kal" role="dialog" aria-label="Pilih tanggal"><div class="isl-kal__kepala"><button type="button" class="isl-kal__nav" data-n="-1" aria-label="Bulan sebelumnya">‹</button><b>${BULAN[m - 1]} ${y}</b><button type="button" class="isl-kal__nav" data-n="1" aria-label="Bulan berikutnya">›</button></div><div class="isl-kal__grid">${sel}</div><div class="isl-kal__aksi"><button type="button" data-a="batal">Batal</button><button type="button" data-a="ini">Hari ini</button><button type="button" class="is-ok" data-a="ok">OK</button></div></div>`;
  };
  sc.addEventListener("click", (ev) => {
    if (ev.target === sc) return tutup();
    const n = ev.target.closest("[data-n]"), d = ev.target.closest("[data-t]"), a = ev.target.closest("[data-a]");
    if (n) { m += +n.dataset.n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } gambar(); }
    else if (d) { pilih = d.dataset.t; sc.querySelectorAll(".is-pilih").forEach((x) => x.classList.remove("is-pilih")); d.classList.add("is-pilih"); }
    else if (a) {
      if (a.dataset.a === "batal") return tutup();
      if (a.dataset.a === "ini") { const h = hariIni(); if ((min && h < min) || (max && h > max)) return; pilih = h; }
      if (pilih) { nat.value = pilih; teks.classList.remove("is-salah"); nat.dispatchEvent(new Event("input", { bubbles: true })); nat.dispatchEvent(new Event("change", { bubbles: true })); }
      tutup();
    }
  });
  document.addEventListener("keydown", esc); gambar(); document.body.appendChild(sc);
}

function tingkatkan(nat) {
  if (nat.dataset.tgl || nat.type !== "date") return; nat.dataset.tgl = "1";
  const bungkus = document.createElement("span"); bungkus.className = "isl-tgl";
  const teks = document.createElement("input"); teks.type = "text"; teks.className = "isl-tgl__teks"; teks.inputMode = "numeric"; teks.autocomplete = "off"; teks.placeholder = "dd/mm/yyyy"; teks.maxLength = 10;
  if (nat.id) teks.setAttribute("aria-label", nat.getAttribute("aria-label") || "Tanggal");
  const tbl = document.createElement("button"); tbl.type = "button"; tbl.className = "isl-tgl__btn"; tbl.setAttribute("aria-label", "Buka kalender"); tbl.innerHTML = IKON;
  nat.parentNode.insertBefore(bungkus, nat); bungkus.append(teks, nat, tbl);
  nat.classList.add("isl-tgl__native"); nat.tabIndex = -1; nat.setAttribute("aria-hidden", "true");
  const sinkron = () => { teks.value = keTeks(nat.value); teks.disabled = nat.disabled; tbl.disabled = nat.disabled; };
  Object.defineProperty(nat, "value", { configurable: true, get() { return nilaiAsli.get.call(nat); }, set(v) { nilaiAsli.set.call(nat, v); sinkron(); } });
  sinkron();
  const dariTeks = (final) => {
    const t = teks.value; if (!t.trim()) { if (nat.value) { nilaiAsli.set.call(nat, ""); nat.dispatchEvent(new Event("input", { bubbles: true })); nat.dispatchEvent(new Event("change", { bubbles: true })); } teks.classList.remove("is-salah"); return; }
    const v = keIso(t);
    if (v) { teks.classList.remove("is-salah"); if (v !== nat.value) { nilaiAsli.set.call(nat, v); nat.dispatchEvent(new Event("input", { bubbles: true })); nat.dispatchEvent(new Event("change", { bubbles: true })); } }
    else if (final) { teks.classList.add("is-salah"); nilaiAsli.set.call(nat, ""); nat.dispatchEvent(new Event("change", { bubbles: true })); }
  };
  teks.addEventListener("input", () => {
    const d = teks.value.replace(/\D/g, "").slice(0, 8); let t = d;
    if (d.length > 4) t = d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4); else if (d.length > 2) t = d.slice(0, 2) + "/" + d.slice(2);
    if (teks.value !== t && !/[\/\-.]$/.test(teks.value)) teks.value = t;
    dariTeks(false);
  });
  teks.addEventListener("blur", () => dariTeks(true));
  tbl.addEventListener("click", () => bukaKalender(nat, teks));
}

function pindai(akar) { (akar || document).querySelectorAll('input[type="date"]:not([data-tgl])').forEach(tingkatkan); }
let jadwal = 0;
new MutationObserver(() => { if (jadwal) return; jadwal = requestAnimationFrame(() => { jadwal = 0; pindai(); }); }).observe(document.documentElement, { childList: true, subtree: true });
pindai();
