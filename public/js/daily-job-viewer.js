// Pratinjau berkas Daily Job tanpa mengunduh: gambar, PDF (pdf.js), Word .docx (mammoth), Excel .xlsx (SheetJS).
// Format lain (.doc, .xls, PowerPoint, dll) hanya unduh. Kertas mengikuti mode gelap dan bisa dipaksa putih. Dipakai di aplikasi dan halaman tautan publik (job.html).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const muatSkrip = (src) => new Promise((ok, gagal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => gagal(new Error("Gagal memuat " + src)); document.body.appendChild(s); });

export function tipeBerkas(nama, mime = "") {
  const n = String(nama || "").toLowerCase(), m = String(mime || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(n) || m.startsWith("image/")) return "gambar";
  if (/\.pdf$/.test(n) || m === "application/pdf") return "pdf";
  if (/\.docx$/.test(n)) return "docx";
  if (/\.(xlsx|xlsm)$/.test(n)) return "xlsx";
  if (/\.(csv)$/.test(n)) return "csv";
  return "lain";
}
export const labelTipe = (t) => ({ gambar: "IMG", pdf: "PDF", docx: "DOC", xlsx: "XLS", csv: "CSV", lain: "FILE" }[t] || "FILE");
export const ukuranTeks = (b) => (!b ? "" : b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1048576).toFixed(1).replace(".", ",") + " MB");

/** Kertas gelap bila tema gelap: dibaca dari variabel --bg. */
export function temaGelap() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(), m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return false; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.45;
}

/** Bersihkan HTML hasil konversi: buang skrip, bingkai, atribut on*, dan tautan javascript:. */
export function bersihkanHtml(html) {
  const dok = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  dok.querySelectorAll("script,style,iframe,object,embed,link,meta,form,base").forEach((x) => x.remove());
  dok.body.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => { if (/^on/i.test(a.name) || (/^(href|src|xlink:href)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name); });
    if (el.tagName === "A") { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
  });
  return dok.body.innerHTML;
}

async function ambil(url) {
  const r = await fetch(url, { mode: "cors" }); if (!r.ok) throw new Error("Berkas tidak bisa dibuka (" + r.status + ").");
  return r.arrayBuffer();
}

async function renderDocx(el, buf) {
  if (!window.mammoth) await muatSkrip("vendor/mammoth.browser.min.js");
  const r = await window.mammoth.convertToHtml({ arrayBuffer: buf });
  el.innerHTML = `<div class="dj-kertas dj-kertas--doc">${bersihkanHtml(r.value) || '<p class="mr-sub">Dokumen kosong.</p>'}</div>`;
}

async function renderXlsx(el, buf, csv) {
  if (!window.XLSX) await muatSkrip("vendor/xlsx.full.min.js");
  const wb = csv ? window.XLSX.read(new TextDecoder().decode(buf), { type: "string" }) : window.XLSX.read(buf, { type: "array" }), nama = wb.SheetNames.slice(0, 8);
  const tampil = (i) => {
    const baris = window.XLSX.utils.sheet_to_json(wb.Sheets[nama[i]], { header: 1, raw: false, defval: "" }), maks = Math.min(baris.length, 200), kol = Math.min(30, Math.max(0, ...baris.slice(0, maks).map((r) => r.length)));
    el.querySelector(".dj-xl__t").innerHTML = `<table>${baris.slice(0, maks).map((r, ri) => `<tr>${Array.from({ length: kol }, (_, c) => (ri === 0 ? `<th>${esc(r[c])}</th>` : `<td>${esc(r[c])}</td>`)).join("")}</tr>`).join("")}</table>
      <p class="mr-sub">${maks < baris.length ? `${maks} dari ${baris.length} baris ditampilkan. Unduh berkas untuk melihat semuanya.` : `${baris.length} baris.`}</p>`;
    el.querySelectorAll(".dj-xl__tab").forEach((b, j) => b.classList.toggle("is-aktif", j === i));
  };
  el.innerHTML = `<div class="dj-kertas dj-kertas--xl"><div class="dj-xl__tabs">${nama.length > 1 ? nama.map((n, i) => `<button type="button" class="dj-xl__tab" data-i="${i}">${esc(n)}</button>`).join("") : ""}</div><div class="dj-xl__t"></div></div>`;
  el.querySelectorAll(".dj-xl__tab").forEach((b) => (b.onclick = () => tampil(+b.dataset.i))); tampil(0);
}

async function renderPdf(el, buf) {
  if (!window.pdfjsLib) await muatSkrip("vendor/pdf.min.js");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise, n = Math.min(pdf.numPages, 20);
  el.innerHTML = `<div class="dj-pdf">${Array.from({ length: n }, (_, i) => `<div class="dj-pdf__h"><canvas data-h="${i + 1}"></canvas><small>Halaman ${i + 1} dari ${pdf.numPages}</small></div>`).join("")}${pdf.numPages > n ? `<p class="mr-sub">${n} halaman pertama ditampilkan. Unduh berkas untuk melihat semuanya.</p>` : ""}</div>`;
  const lebar = Math.max(280, Math.min(900, el.clientWidth - 8 || 600)), dpr = Math.min(2, window.devicePixelRatio || 1);
  for (let i = 1; i <= n; i++) {
    const hal = await pdf.getPage(i), v1 = hal.getViewport({ scale: 1 }), vp = hal.getViewport({ scale: (lebar / v1.width) * dpr }), c = el.querySelector(`canvas[data-h="${i}"]`);
    if (!c) return; c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.style.width = lebar + "px"; c.style.maxWidth = "100%";
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); await hal.render({ canvasContext: x, viewport: vp }).promise;
  }
}

/** Tampilkan pratinjau di el. Mengembalikan {tipe}. Gagal: pesan ramah dengan tombol unduh (bila diizinkan). */
export async function tampilkanPratinjau(el, { url, nama, mime = "", unduh = true }) {
  const tipe = tipeBerkas(nama, mime), unduhHtml = unduh && url ? `<a class="mr-btn mr-btn--utama" href="${esc(url)}" target="_blank" rel="noopener" download>Unduh berkas</a>` : "";
  el.dataset.tipe = tipe;
  if (tipe === "lain") { el.innerHTML = `<div class="dj-pv__kosong"><b>${esc(nama)}</b><p class="mr-sub">Jenis berkas ini tidak bisa dipratinjau di aplikasi. ${unduh ? "Unduh untuk membukanya." : ""}</p>${unduhHtml}</div>`; return { tipe }; }
  el.innerHTML = `<p class="mr-sub dj-pv__muat">Memuat pratinjau…</p>`;
  try {
    if (tipe === "gambar") { el.innerHTML = `<img class="dj-pv__img" src="${esc(url)}" alt="${esc(nama)}">`; return { tipe }; }
    const buf = await ambil(url);
    if (tipe === "pdf") await renderPdf(el, buf); else if (tipe === "docx") await renderDocx(el, buf); else await renderXlsx(el, buf, tipe === "csv");
  } catch (err) { console.warn("Pratinjau gagal:", err); el.innerHTML = `<div class="dj-pv__kosong"><b>${esc(nama)}</b><p class="mr-sub">Pratinjau belum bisa dimuat (${esc(err.message || err)}). ${unduh ? "Unduh berkas untuk membukanya." : ""}</p>${unduhHtml}</div>`; }
  return { tipe };
}
