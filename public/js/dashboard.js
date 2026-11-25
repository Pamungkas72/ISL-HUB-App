import { renderNav } from "./nav.js";
import { navItems as semuaNav, SEMBUNYI_PERAN } from "./nav-config.js";
import { labelAkun } from "./config-akses.js";
import { itemTersembunyi, levelAkses, MODUL_NAV } from "./akses.js";
import { semuaItem, muatUlang, bukaTujuan } from "./notifikasi.js";
import { db } from "./firebase-config.js";
import * as H from "./daily-job-hitung.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Dipanggil router (app.html#beranda). Login dan peran sudah diperiksa di app-boot.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rp = (n) => (n >= 1e9 ? `Rp ${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp ${Math.round(n / 1e6).toLocaleString("id-ID")} jt` : `Rp ${Math.round(n).toLocaleString("id-ID")}`);
const PER = [["bulan", "Bulan ini", "Revenue bulan ini"], ["3bulan", "3 bulan", "Revenue 3 bulan terakhir"], ["tahun", "Tahun ini", "Revenue tahun ini"]];
const St = { per: "bulan", ubahTarget: false, notif: [], dj: null, navItems: semuaNav, nama: "", peran: "" };
let root = null, user = null;

const sapa = () => { const j = new Date().getHours(); return j < 11 ? "Selamat pagi" : j < 15 ? "Selamat siang" : j < 19 ? "Selamat sore" : "Selamat malam"; };
const tanggal = () => new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const kpi = (l, v, d, c = "") => `<div class="bd-kpi"><small>${l}</small><b>${v}</b><span class="${c}">${d}</span></div>`;

function blokRevenue(r, peran) {
  const pr = r.target > 0 ? Math.min(100, Math.round((r.omzet / r.target) * 100)) : null, label = PER.find((p) => p[0] === St.per)[2];
  const naik = r.lalu ? Math.round(((r.omzet - r.lalu) / r.lalu) * 100) : null;
  const sisa = r.sisaHari && r.target > r.omzet ? ` · sisa ${r.sisaHari} hari, butuh ${rp((r.target - r.omzet) / r.sisaHari)}/hari` : "";
  const bagi = St.per === "bulan" ? 1 : St.per === "3bulan" ? 3 : 12;
  const target = St.ubahTarget
    ? `<form class="bd-tg" data-bd-form><label>Target revenue per bulan (Rp)<input name="t" inputmode="numeric" data-ribuan-live value="${esc(String(Math.round(r.target / bagi) || ""))}" autocomplete="off"></label><button class="mr-btn mr-btn--utama" type="submit">Simpan</button><button class="mr-btn" type="button" data-bd="batal">Batal</button></form>`
    : `<small>${pr === null ? "Target belum diatur" : `${pr}% dari target ${rp(r.target)}${esc(sisa)}`}${peran === "master" ? ` · <button class="bd-link" data-bd="target">${r.target > 0 ? "Ubah" : "Atur target"}</button>` : ""}</small>`;
  return `<section class="bd-kartu bd-rev"><div class="bd-rev__atas"><div><small>${label}${r.dariOrder ? "" : " (disetujui)"}</small><div class="bd-rev__nilai">${rp(r.omzet)}${naik === null ? "" : ` <em class="${naik >= 0 ? "up" : "dn"}">${naik >= 0 ? "▲" : "▼"} ${Math.abs(naik)}%</em>`}</div>${target}</div>
    <div class="bd-seg" role="tablist">${PER.map((p) => `<button type="button" role="tab" aria-selected="${p[0] === St.per}" data-bd-per="${p[0]}">${p[1]}</button>`).join("")}</div></div>${pr === null ? "" : `<div class="bd-bar bd-bar--besar"><i style="width:${pr}%"></i></div>`}</section>`;
}
function spark(pts, bawah) {
  const mx = Math.max(...pts, 1), w = 84, h = 26, d = pts.map((v, i) => `${i ? "L" : "M"}${((i * w) / (pts.length - 1)).toFixed(1)} ${(h - 2 - (v / mx) * (h - 6)).toFixed(1)}`).join(" ");
  return `<svg class="bd-spark ${bawah ? "is-bawah" : ""}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/></svg>`;
}
function blokLini(r) {
  const mx = Math.max(...r.lini.map((l) => l.omzet), 1), pct = (l) => (l.margin === null ? "" : `<span class="bd-pil ${l.bawahTarget ? "is-bawah" : ""}">${Math.round(l.margin)}%</span>`);
  const isi = r.lini.length ? `<div class="bd-tabel"><div class="bd-tabel__h"><span>Lini bisnis</span><span>Revenue</span><span>Porsi</span>${r.margin !== null ? "<span>Margin</span>" : ""}<span>Order</span><span>Tren</span></div>${r.lini.map((l) => `<div class="bd-tabel__r"><b>${esc(l.nama)}</b><span class="bd-rv">${rp(l.omzet)}</span><div class="bd-bar"><i class="${l.bawahTarget ? "is-bawah" : ""}" style="width:${Math.round((l.omzet / mx) * 100)}%"></i></div>${r.margin !== null ? pct(l) : ""}<span class="bd-od">${l.order} order</span>${spark(l.tren, l.bawahTarget)}</div>`).join("")}</div>${r.margin !== null ? `<small class="bd-cat">Margin oranye = di bawah target margin lini. Porsi = perbandingan dengan lini terbesar.</small>` : ""}` : `<p class="bd-kosong">Belum ada revenue pada periode ini.</p>`;
  return `<section class="bd-kartu"><h3>Performa per lini bisnis<a href="app.html#laporan">Laporan ›</a></h3>${isi}</section>`;
}
function blokDJ() {
  if (!St.dj || !St.dj.length) return "";
  return `<section class="bd-blok"><h3 class="bd-jud">Daily Job per kelompok<a href="app.html#dailyjob">Semua kelompok ›</a></h3><div class="bd-dj">${St.dj.map((k) => `<a class="bd-kartu bd-djk" href="app.html#dailyjob"><div class="bd-djk__h"><b>${esc(k.nama)}</b><span>Buka ›</span></div><div class="bd-djk__g">${[["Masuk", k.masuk], ["Selesai", k.selesai], ["Backlog", k.backlog], ["Terlambat", k.terlambat]].map((x) => `<div><small>${x[0]}</small><b class="${x[0] === "Terlambat" && x[1] ? "dn" : ""}">${x[1]}</b></div>`).join("")}</div><div class="bd-bar"><i style="width:${k.persenTepat ?? 0}%"></i></div><small>${k.persenTepat === null ? "Belum ada job selesai bulan ini" : `${k.persenTepat}% job selesai tepat waktu`}</small></a>`).join("")}</div></section>`;
}
function blokTugas() {
  const L = St.notif.filter((i) => i.level !== "info").concat(St.notif.filter((i) => i.level === "info")).slice(0, 5);
  return `<section class="bd-kartu"><h3>Perlu tindakan${St.notif.length > 5 ? `<a href="app.html#pemberitahuan">Semua (${St.notif.length}) ›</a>` : ""}</h3>${L.length ? L.map((i) => `<button type="button" class="bd-tugas" data-bd-buka="${esc(i.id)}"><i class="bd-d bd-d--${i.level}"></i><span><b>${esc(i.judul)}</b><small>${esc(i.ket)}</small></span></button>`).join("") : `<p class="bd-kosong">Semua aman. Tidak ada yang perlu ditindaklanjuti.</p>`}</section>`;
}
function pintasan(peran) {
  const ada = (id) => St.navItems.some((i) => i.id === id), ikon = (id) => (St.navItems.find((i) => i.id === id) || semuaNav.find((i) => i.id === id) || {}).icon || "";
  const lv = (id) => (MODUL_NAV[id] ? levelAkses(window.__ISL_PROFIL, MODUL_NAV[id]) : 2); // Kelola = boleh membuat; Lihat = hanya membuka
  const d = [["quotation", lv("quotation") >= 2 ? "Buat quotation" : "Quotation", "#quotation", lv("quotation") >= 2], ["dailyjob", lv("dailyjob") >= 2 ? "Catat Daily Job" : "Daily Job", "#dailyjob"], ["customer", "Customer", "#customer"], [peran === "sales" ? "legal" : "master-rate", peran === "sales" ? "MOM" : "Master Rate", peran === "sales" ? "#legal" : "#master-rate"]].filter((x) => ada(x[0]));
  if (!d.length) return ""; // akun tanpa modul apa pun: tanpa kartu Pintasan
  return `<section class="bd-kartu"><h3>Pintasan</h3><div class="bd-pin">${d.map((x) => `<a href="app.html${x[2]}" class="${x[3] ? "is-utama" : ""}"><svg viewBox="0 0 24 24">${ikon(x[0])}</svg>${x[1]}</a>`).join("")}</div></section>`;
}

function gambar() {
  const pr = window.__ISL || {}, peran = pr.master ? "master" : pr.admin ? "admin" : pr.sales ? "sales" : "lihat", punyaRev = peran !== "lihat" && !!window.__islBeranda;
  const r = punyaRev ? window.__islBeranda.ringkas(St.per) : null, mendesak = St.notif.filter((i) => i.level === "bahaya").length, aksi = St.notif.filter((i) => i.level === "warn").length;
  const nama = (St.nama || "").split(/\s+/)[0], dj = St.dj || [], djTot = dj.reduce((a, k) => ({ b: a.b + k.backlog, t: a.t + k.terlambat, s: a.s + k.selesai, p: a.p + k.tepat }), { b: 0, t: 0, s: 0, p: 0 });
  const first = St.notif.find((i) => i.level === "bahaya") || St.notif[0];
  const hero = St.notif.length ? `<div class="bd-hero"><div><h2>${mendesak + aksi || St.notif.length} hal perlu tindakan hari ini</h2><p>${mendesak} mendesak · ${aksi} perlu aksi</p></div>${first ? `<button type="button" class="bd-hero__b" data-bd-buka="${esc(first.id)}">Mulai dari yang mendesak</button>` : ""}</div>` : "";
  const kDJ = dj.length ? kpi("Job tepat waktu", djTot.s ? `${Math.round((djTot.p / djTot.s) * 100)}%` : "—", "semua kelompok", "up") + kpi("Backlog Daily Job", djTot.b, `${djTot.t} terlambat`, djTot.t ? "dn" : "") : "";
  const kpis = r ? (peran === "sales"
    ? kpi("Quotation saya", r.aktif, `${r.draf} draf`) + kpi("Menunggu respons", r.menunggu, "status terkirim", r.menunggu ? "dn" : "") + kpi("Disetujui", r.setuju, `${r.tolak} ditolak`, "up") + (kDJ || kpi("Order dari QT", r.order, "periode ini"))
    : (r.margin !== null ? kpi("Margin rata-rata", `${r.margin.toFixed(0)}%`, "dari modal") : kpi("Order", r.order, "periode ini")) + kpi("Quotation menang", `${r.setuju} / ${r.setuju + r.tolak}`, r.setuju + r.tolak ? `Win rate ${Math.round((r.setuju / (r.setuju + r.tolak)) * 100)}%` : "belum ada", "up") + (kDJ || kpi("Menunggu respons", r.menunggu, "status terkirim", r.menunggu ? "dn" : "") + kpi("Quotation aktif", r.aktif, `${r.draf} draf`))) : "";
  root.innerHTML = `<div class="bd-top"><div><h1>${sapa()}${nama ? ", " + esc(nama) : ""}</h1><small>${tanggal()}</small></div></div>${hero}
    ${r ? `<div class="bd-kpis">${kpis}</div>${blokRevenue(r, peran)}${blokLini(r)}` : ""}${blokDJ()}
    <div class="bd-dua"><div>${blokTugas()}</div><div class="bd-kol">${pintasan(peran)}</div></div>`;
}

/* Daily Job: KPI bulan ini per kelompok. Master/admin semua kelompok; anggota hanya kelompoknya (aturan sama dengan halaman Daily Job). */
async function muatDJ(profil, kelola) {
  const kel = (profil && profil.kelompokDJ) || null; if (!kelola && !kel) return [];
  const ks = (await getDocs(collection(db, "dj_kelompok"))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((k) => kelola || k.id === kel);
  const js = (await getDocs(kelola ? collection(db, "dj_job") : query(collection(db, "dj_job"), where("kelompokId", "==", kel)))).docs.map((d) => H.dariDok(d.id, d.data()));
  const r = H.rentang("bulan");
  return ks.sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id")).map((k) => { const x = H.hitungKpi(js.filter((j) => j.kelompokId === k.id), r); return { nama: k.nama || "Kelompok", masuk: x.masuk, selesai: x.selesai, tepat: x.tepat, backlog: x.backlog, terlambat: x.terlambat, persenTepat: x.persenTepat }; });
}

export async function mulaiBeranda(u, profil) {
  user = u; root = document.getElementById("bd-root");
  const nm = document.getElementById("user-email"); if (nm) nm.textContent = labelAkun(u.email, u.displayName);
  St.navItems = semuaNav.filter((i) => !itemTersembunyi(profil, i) && !(MODUL_NAV[i.id] && profil && levelAkses(profil, MODUL_NAV[i.id]) === 0)); // modul yang dimatikan tidak tampil (sama dengan menu)
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
  try { St.dj = await muatDJ(profil, !!window.__ISL_KELOLA); gambar(); } catch (e) { console.warn("Daily Job Beranda belum termuat:", e); }
}
