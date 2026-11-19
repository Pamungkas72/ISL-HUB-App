import { renderNav } from "./nav.js";
import { navItems as semuaNav, SEMBUNYI_PERAN } from "./nav-config.js";
import { labelAkun } from "./config-akses.js";
import { semuaItem, muatUlang, bukaTujuan } from "./notifikasi.js";

// Dipanggil router (app.html#beranda). Login dan peran sudah diperiksa di app-boot.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rp = (n) => (n >= 1e9 ? `Rp ${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp ${Math.round(n / 1e6).toLocaleString("id-ID")} jt` : `Rp ${Math.round(n).toLocaleString("id-ID")}`);
const PER = [["bulan", "Bulan ini", "Revenue bulan ini"], ["3bulan", "3 bulan", "Revenue 3 bulan terakhir"], ["tahun", "Tahun ini", "Revenue tahun ini"]];
const St = { per: "bulan", ubahTarget: false, notif: [], navItems: semuaNav, nama: "", peran: "" };
let root = null, user = null;

const sapa = () => { const j = new Date().getHours(); return j < 11 ? "Selamat pagi" : j < 15 ? "Selamat siang" : j < 19 ? "Selamat sore" : "Selamat malam"; };
const tanggal = () => new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const kpi = (l, v, d, c = "") => `<div class="bd-kpi"><small>${l}</small><b>${v}</b><span class="${c}">${d}</span></div>`;

function blokRevenue(r, kelola) {
  const pr = r.target > 0 ? Math.min(100, Math.round((r.omzet / r.target) * 100)) : null, label = PER.find((p) => p[0] === St.per)[2];
  const naik = r.lalu ? Math.round(((r.omzet - r.lalu) / r.lalu) * 100) : null;
  const sisa = r.sisaHari && r.target > r.omzet ? `Sisa ${r.sisaHari} hari · butuh ${rp((r.target - r.omzet) / r.sisaHari)}/hari` : r.sisaHari ? `Sisa ${r.sisaHari} hari` : "";
  const target = St.ubahTarget
    ? `<form class="bd-tg" data-bd-form><label>Target revenue per bulan (Rp)<input name="t" inputmode="numeric" value="${esc(String(Math.round(r.target / (St.per === "bulan" ? 1 : St.per === "3bulan" ? 3 : 12)) || ""))}" autocomplete="off"></label><button class="mr-btn mr-btn--utama" type="submit">Simpan</button><button class="mr-btn" type="button" data-bd="batal">Batal</button></form>`
    : `<div class="bd-rev__sub">${r.target > 0 ? `dari target ${rp(r.target)}` : "Target belum diatur"}${kelola === "master" ? ` · <button class="bd-link" data-bd="target">${r.target > 0 ? "Ubah" : "Atur target"}</button>` : ""}</div>`;
  return `<section class="bd-rev"><div class="bd-rev__atas"><div><small>${label}${r.dariOrder ? "" : " (disetujui)"}</small><div class="bd-rev__nilai">${rp(r.omzet)}</div>${target}${naik === null ? "" : `<span class="bd-rev__chip">${naik >= 0 ? "▲" : "▼"} ${Math.abs(naik)}% vs bulan lalu</span>`}</div>
    <div class="bd-seg" role="tablist">${PER.map((p) => `<button type="button" role="tab" aria-selected="${p[0] === St.per}" data-bd-per="${p[0]}">${p[1]}</button>`).join("")}</div></div>
    ${pr === null ? "" : `<div class="bd-rev__bar"><i style="width:${pr}%"></i></div><div class="bd-rev__ket"><span>${pr}% tercapai</span><span>${esc(sisa)}</span></div>`}</section>`;
}
function blokTren(r) {
  const mx = Math.max(...r.tren.map((t) => t.omzet), 1);
  return `<section class="bd-kartu"><h3>Tren revenue 6 bulan</h3><div class="bd-tren">${r.tren.map((t, i) => `<div title="${esc(rp(t.omzet))}"><i class="${i === 5 ? "is-ini" : ""}" style="height:${Math.max(4, Math.round((t.omzet / mx) * 100))}px"></i><span>${t.label}</span></div>`).join("")}</div></section>`;
}
function blokLini(r) {
  const mx = Math.max(...r.lini.map((l) => l.omzet), 1);
  return `<section class="bd-kartu"><h3>Revenue per lini bisnis<a href="app.html#laporan">Laporan ›</a></h3>${r.lini.length ? r.lini.map((l) => `<div class="bd-fn"><span>${esc(l.nama)}</span><div class="bd-bar"><i class="${l.bawahTarget ? "is-bawah" : ""}" style="width:${Math.round((l.omzet / mx) * 100)}%"></i></div><b>${rp(l.omzet)}</b>${l.margin === null ? "" : `<em>${Math.round(l.margin)}%</em>`}</div>`).join("") + (r.margin !== null ? `<small class="bd-cat">Kolom kanan: margin. Oranye = di bawah target margin.</small>` : "") : `<p class="bd-kosong">Belum ada revenue pada periode ini.</p>`}</section>`;
}
const blokTop = (r) => `<section class="bd-kartu"><h3>Customer teratas</h3>${r.top.length ? r.top.map((c, i) => `<div class="bd-baris"><b class="bd-no">${i + 1}</b><div>${esc(c.nama)}</div><b>${rp(c.omzet)}</b></div>`).join("") : `<p class="bd-kosong">Belum ada data.</p>`}</section>`;
function blokTugas() {
  const L = St.notif.filter((i) => i.level !== "info").concat(St.notif.filter((i) => i.level === "info")).slice(0, 5);
  return `<section class="bd-kartu"><h3>Perlu tindakan${St.notif.length > 5 ? `<a href="app.html#pemberitahuan">Semua (${St.notif.length}) ›</a>` : ""}</h3>${L.length ? L.map((i) => `<button type="button" class="bd-tugas" data-bd-buka="${esc(i.id)}"><i class="bd-d bd-d--${i.level}"></i><span><b>${esc(i.judul)}</b><small>${esc(i.ket)}</small></span></button>`).join("") : `<p class="bd-kosong">Semua aman. Tidak ada yang perlu ditindaklanjuti.</p>`}</section>`;
}
function pintasan(peran) {
  const ada = (id) => St.navItems.some((i) => i.id === id), ikon = (id) => (St.navItems.find((i) => i.id === id) || semuaNav.find((i) => i.id === id) || {}).icon || "";
  const d = [["quotation", "Buat quotation", "#quotation", true], ["dailyjob", "Catat Daily Job", "#dailyjob"], ["customer", "Customer", "#customer"], [peran === "sales" ? "legal" : "master-rate", peran === "sales" ? "MOM" : "Master Rate", peran === "sales" ? "#legal" : "#master-rate"]];
  return `<section class="bd-kartu"><h3>Pintasan</h3><div class="bd-pin">${d.filter((x) => ada(x[0])).map((x) => `<a href="app.html${x[2]}" class="${x[3] ? "is-utama" : ""}"><svg viewBox="0 0 24 24">${ikon(x[0])}</svg>${x[1]}</a>`).join("")}</div></section>`;
}

function gambar() {
  const pr = window.__ISL || {}, peran = pr.master ? "master" : pr.admin ? "admin" : pr.sales ? "sales" : "lihat", punyaRev = peran !== "lihat" && !!window.__islBeranda;
  const r = punyaRev ? window.__islBeranda.ringkas(St.per) : null, mendesak = St.notif.filter((i) => i.level === "bahaya").length, aksi = St.notif.filter((i) => i.level === "warn").length;
  const nama = (St.nama || "").split(/\s+/)[0];
  const hero = St.notif.length ? `<div class="bd-hero"><div><h2>${mendesak + aksi || St.notif.length} hal perlu tindakan hari ini</h2><p>${mendesak} mendesak · ${aksi} perlu aksi</p></div></div>` : "";
  const kpis = r ? (peran === "sales"
    ? kpi("Quotation saya", r.aktif, `${r.draf} draf`) + kpi("Menunggu respons", r.menunggu, "status terkirim", r.menunggu ? "dn" : "") + kpi("Disetujui", r.setuju, `${r.tolak} ditolak`, "up") + kpi("Order dari QT", r.order, "periode ini")
    : (r.margin !== null ? kpi("Margin rata-rata", `${r.margin.toFixed(0)}%`, "dari modal") : kpi("Order", r.order, "periode ini")) + kpi("Quotation menang", `${r.setuju} / ${r.setuju + r.tolak}`, r.setuju + r.tolak ? `Win rate ${Math.round((r.setuju / (r.setuju + r.tolak)) * 100)}%` : "belum ada", "up") + kpi("Menunggu respons", r.menunggu, "status terkirim", r.menunggu ? "dn" : "") + kpi("Quotation aktif", r.aktif, `${r.draf} draf`)) : "";
  root.innerHTML = `<div class="bd-top"><div><h1>${sapa()}${nama ? ", " + esc(nama) : ""}</h1><small>${tanggal()}</small></div></div>${hero}
    ${r ? blokRevenue(r, peran) + `<div class="bd-kpis">${kpis}</div><div class="bd-dua">${blokTren(r)}${blokLini(r)}</div>` : ""}
    <div class="bd-dua">${blokTugas()}<div class="bd-kol">${r ? blokTop(r) : ""}${pintasan(peran)}</div></div>`;
}

export async function mulaiBeranda(u, profil) {
  user = u; root = document.getElementById("bd-root");
  const nm = document.getElementById("user-email"); if (nm) nm.textContent = labelAkun(u.email, u.displayName);
  St.navItems = semuaNav.filter((i) => !((profil && SEMBUNYI_PERAN[profil.peran]) || []).includes(i.id));
  St.nama = (profil && profil.nama) || u.displayName || "";
  if (!root.dataset.pasang) {
    root.dataset.pasang = "1";
    root.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-bd-per],[data-bd],[data-bd-buka]"); if (!t) return;
      if (t.dataset.bdPer) { St.per = t.dataset.bdPer; gambar(); }
      else if (t.dataset.bd === "target") { St.ubahTarget = true; gambar(); }
      else if (t.dataset.bd === "batal") { St.ubahTarget = false; gambar(); }
      else if (t.dataset.bdBuka) { const i = St.notif.find((x) => x.id === t.dataset.bdBuka); if (i) bukaTujuan(i.tujuan); }
    });
    root.addEventListener("submit", async (e) => {
      if (!e.target.matches("[data-bd-form]")) return; e.preventDefault();
      const n = Number(String(new FormData(e.target).get("t")).replace(/\D/g, ""));
      try { await window.__islBeranda.simpanTarget(n); St.ubahTarget = false; gambar(); } catch (er) { alert("Target belum tersimpan: " + (er && er.message)); }
    });
  }
  renderNav("beranda"); gambar();
  try { await muatUlang(false); St.notif = semuaItem(); gambar(); } catch (e) { console.warn("Pemberitahuan Beranda belum termuat:", e); }
}
