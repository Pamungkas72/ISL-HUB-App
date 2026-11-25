// Pemilih pilihan ringkas (desain B, dipilih pemilik 25 Nov 2026): panel rapi menggantikan daftar bawaan peramban untuk <select data-pemilih>.
// Select asli tetap ada (tersembunyi) sebagai sumber nilai, jadi kode yang membaca .value atau mendengar "change" tidak berubah.
// HP: panel setengah layar dari bawah. Desktop: popover di bawah kolom. Opsi boleh punya data-ket (keterangan singkat); pencarian muncul bila pilihan banyak.
import { ikon } from "./ikon.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hp = () => matchMedia("(max-width: 760px)").matches;
let terbuka = null;

function tutup() { if (!terbuka) return; terbuka.scrim.remove(); terbuka.panel.remove(); document.removeEventListener("keydown", terbuka.esc, true); const j = terbuka.jangkar; terbuka = null; if (j && j.isConnected) j.focus(); }

/* Panel generik: grup = [{ label, opsi: [{ v, nama, ket }] }], terpilih = nilai aktif. Mengembalikan Promise nilai yang dipilih (undefined bila ditutup). */
export function bukaPanel(jangkar, grup, { terpilih = "", judul = "Pilih", cari = null } = {}) {
  tutup();
  return new Promise((selesai) => {
    const jumlah = grup.reduce((n, g) => n + g.opsi.length, 0), pakaiCari = cari === null ? jumlah > 6 : cari, mobile = hp();
    const scrim = document.createElement("div"), panel = document.createElement("div");
    scrim.className = "pm-scrim"; panel.className = "pm-panel " + (mobile ? "pm-hp" : "pm-pop");
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", judul);
    panel.innerHTML = `${mobile ? '<div class="pm-pegang"></div>' : ""}${pakaiCari ? `<label class="pm-cari">${ikon("cari", 18)}<input type="search" placeholder="Cari…" aria-label="Cari" autocomplete="off"></label>` : ""}<div class="pm-daftar" role="listbox"></div>`;
    const daftar = panel.querySelector(".pm-daftar");
    const gambar = (q = "") => {
      const k = q.trim().toLowerCase(), cocok = (o) => !k || (o.nama + " " + (o.ket || "")).toLowerCase().includes(k);
      daftar.innerHTML = grup.map((g) => { const o = g.opsi.filter(cocok); return o.length ? `${g.label ? `<div class="pm-grup">${esc(g.label)}</div>` : ""}${o.map((x) => `<button type="button" class="pm-opsi" role="option" aria-selected="${x.v === terpilih}" data-v="${esc(x.v)}"><span><b>${esc(x.nama)}</b>${x.ket ? `<small>${esc(x.ket)}</small>` : ""}</span><i class="pm-rad"></i></button>`).join("")}` : ""; }).join("") || `<p class="pm-kosong">Tidak ada yang cocok.</p>`;
    };
    gambar();
    const pilih = (v) => { tutup(); selesai(v); };
    panel.addEventListener("click", (ev) => { const b = ev.target.closest(".pm-opsi"); if (b) pilih(b.dataset.v); });
    const inp = panel.querySelector("input"); if (inp) inp.addEventListener("input", () => gambar(inp.value));
    const esc2 = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); tutup(); selesai(undefined); } };
    scrim.addEventListener("click", () => { tutup(); selesai(undefined); });
    document.addEventListener("keydown", esc2, true);
    document.body.append(scrim, panel); terbuka = { scrim, panel, esc: esc2, jangkar };
    if (!mobile) { // popover: di bawah kolom, atau di atasnya bila tidak muat
      const r = jangkar.getBoundingClientRect(), lebar = Math.min(Math.max(r.width, 300), innerWidth - 16), kiri = Math.max(8, Math.min(r.left, innerWidth - lebar - 8));
      panel.style.width = lebar + "px"; panel.style.left = kiri + "px";
      const tinggi = panel.offsetHeight, bawah = r.bottom + 6, muat = bawah + tinggi <= innerHeight - 8;
      panel.style.top = (muat ? bawah : Math.max(8, r.top - 6 - tinggi)) + "px";
    }
    const sel = daftar.querySelector('[aria-selected="true"]'); if (sel) sel.scrollIntoView({ block: "nearest" });
    if (inp && !mobile) inp.focus(); else (sel || daftar.querySelector(".pm-opsi") || panel).focus?.();
  });
}

/* ---------- penyempurnaan <select data-pemilih> ---------- */
const teks = (sel) => { const o = sel.selectedOptions[0]; return o ? o.textContent : ""; };
function sinkron(sel) { const b = sel._pm; if (!b) return; b.querySelector(".pm-nilai").textContent = teks(sel) || "Pilih…"; b.disabled = sel.disabled; }
function grupDari(sel) {
  const g = [], umum = { label: "", opsi: [] }, opsi = (o) => ({ v: o.value, nama: o.textContent, ket: o.dataset.ket || "" });
  [...sel.children].forEach((n) => { if (n.tagName === "OPTGROUP") g.push({ label: n.label, opsi: [...n.children].filter((o) => !o.disabled).map(opsi) }); else if (n.tagName === "OPTION" && !n.disabled) umum.opsi.push(opsi(n)); });
  return umum.opsi.length ? [umum, ...g] : g;
}
function pasang(sel) {
  if (sel._pm) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "pm-medan"; b.setAttribute("aria-haspopup", "dialog");
  b.innerHTML = `<span class="pm-nilai"></span>${ikon("turun", 18)}`;
  sel.insertAdjacentElement("afterend", b); sel.classList.add("pm-asli"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true"); sel._pm = b; sinkron(sel);
  sel.addEventListener("change", () => sinkron(sel));
  b.addEventListener("click", async () => {
    const v = await bukaPanel(b, grupDari(sel), { terpilih: sel.value, judul: sel.getAttribute("aria-label") || "Pilih" });
    if (v === undefined || v === sel.value) return;
    sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true })); sinkron(sel);
  });
}
const periksa = (akar) => { if (akar.querySelectorAll) akar.querySelectorAll("select[data-pemilih]").forEach(pasang); };
new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches("select[data-pemilih]")) pasang(n); periksa(n); } }))).observe(document.documentElement, { childList: true, subtree: true });
periksa(document);

/** Menu pilihan dari tombol (mis. Tambah): daftar = [{ v, nama, ket }]; mengembalikan nilai yang dipilih. */
export const pilihDariMenu = (jangkar, daftar, judul = "Pilih") => bukaPanel(jangkar, [{ label: "", opsi: daftar }], { judul, cari: false });
