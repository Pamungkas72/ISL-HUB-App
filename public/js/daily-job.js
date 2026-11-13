// ===========================================================
// DAILY JOB — catatan job harian tim marketing dan BD, pengingat, dashboard performa, dan laporan PDF.
// Data: dj_job dan dj_kelompok (Firestore), lampiran di Storage dailyjob/{kelompok}/. Aturan: firestore.rules dan storage.rules.
// Akses: tiap akun punya kelompok (pengguna.kelompokDJ); anggota hanya melihat dan mengubah job kelompoknya; master dan admin semua.
// Hitungan murni ada di daily-job-hitung.js.
// ===========================================================
import { renderNav } from "./nav.js";
import { labelAkun } from "./config-akses.js";
import { e, $, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { db } from "./firebase-config.js";
import { unggahBlob } from "./app-store.js";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as H from "./daily-job-hitung.js";
import { statusPush, aktifkanPush, matikanPush, jagaPush } from "./daily-job-push.js";

const S = { u: null, kelola: false, kelompokSaya: null, kelompok: [], jobs: [], akun: [], tab: "performa", periode: "bulan", dari: "", sampai: "", fKel: "", fPic: "", fKat: "", fStatus: "aktif", cari: "", muat: false, galat: "" };
const uid = () => "dj" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtTgl = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const namaKel = (id) => (S.kelompok.find((k) => k.id === id) || {}).nama || "–";
const aman = (u) => (/^https?:\/\//i.test(String(u || "")) ? e(u) : "#"); // hanya tautan http(s) yang dibuka
const WARNA = ["#2F8FDB", "#F7941D", "#2E9E6D", "#8E6BD1", "#D64545", "#12A5A5", "#B58900", "#6B7A8C"];
const rentangAktif = () => (S.periode === "rentang" && S.dari && S.sampai ? [S.dari, S.sampai] : H.rentang(S.periode === "rentang" ? "bulan" : S.periode));

/* ---------- data ---------- */
async function muat() {
  S.muat = true; S.galat = ""; render();
  try {
    const ks = await getDocs(collection(db, "dj_kelompok"));
    S.kelompok = ks.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    const q = S.kelola ? collection(db, "dj_job") : S.kelompokSaya ? query(collection(db, "dj_job"), where("kelompokId", "==", S.kelompokSaya)) : null;
    S.jobs = q ? (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() })) : [];
    if (S.kelola) S.akun = (await getDocs(collection(db, "pengguna"))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.status === "aktif").sort((a, b) => String(a.nama || a.email).localeCompare(String(b.nama || b.email), "id"));
  } catch (err) { console.error(err); S.galat = "Data Daily Job belum bisa dibaca. Pemilik perlu memasang aturan Firestore terbaru (firebase deploy --only firestore:rules,storage)."; }
  S.muat = false; render();
}
const tampak = () => S.jobs.filter((j) => (!S.fKel || j.kelompokId === S.fKel) && (!S.fPic || j.pic === S.fPic) && (!S.fKat || j.kategori === S.fKat));
const daftarPic = () => [...new Set(S.jobs.filter((j) => !S.fKel || j.kelompokId === S.fKel).map((j) => j.pic).filter(Boolean))].sort();

/* ---------- tampilan ---------- */
const opsi = (arr, sel, semua) => `${semua ? `<option value="">${e(semua)}</option>` : ""}${arr.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${e(v)}"${String(v) === String(sel) ? " selected" : ""}>${e(t)}</option>`; }).join("")}`;
const chipT = (j, now) => { const l = H.labelTarget(j, now); return `<span class="dj-chip dj-chip--${l.k || "info"}">${e(l.t)}</span>`; };

function barisJob(j, now) {
  return `<div class="dj-job dj-job--${H.terlambat(j, now) ? "telat" : j.status === "selesai" ? "ok" : "aktif"}" data-dj="buka" data-id="${e(j.id)}" tabindex="0" role="button">
    <div class="dj-job__isi"><b>${e(j.judul)}</b><small>${[j.customer, j.kategori, j.pic, S.kelola && !S.fKel ? namaKel(j.kelompokId) : ""].filter(Boolean).map(e).join(" · ")}</small>
    <small>Target ${fmtTgl(j.tglTarget)}${(j.file || []).length || (j.tautan || []).length ? ` · ${ikon("file", 12)} ${(j.file || []).length + (j.tautan || []).length}` : ""}</small></div>
    <div class="dj-job__aksi">${chipT(j, now)}${H.aktif(j) ? `<button type="button" class="mr-ikonbtn" data-dj="selesai" data-id="${e(j.id)}" title="Tandai selesai" aria-label="Tandai selesai">${ikon("cek", 16)}</button>` : ""}</div></div>`;
}

function htmlBarDeret(d) {
  const cw = ($("#dj-root") || {}).clientWidth || 340, W = Math.max(260, Math.round(innerWidth > 760 ? cw * 0.66 - 40 : cw - 36)), T = 130; // ukuran asli: huruf tidak ikut membesar
  const max = Math.max(1, ...d.flatMap((x) => [x.masuk, x.selesai])), lebar = W / Math.max(1, d.length);
  const lab = (k) => (S.periode === "tahun" ? new Date(k + "-01T00:00:00Z").toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" }) : k.slice(8) + "/" + k.slice(5, 7));
  return `<svg viewBox="0 0 ${W} ${T + 18}" width="${W}" height="${T + 18}" class="dj-svg" role="img" aria-label="Job masuk dan selesai">${d.map((x, i) => {
    const bw = Math.min(14, lebar / 2.6), cx = i * lebar + lebar / 2, h1 = (x.masuk / max) * (T - 14), h2 = (x.selesai / max) * (T - 14);
    return `<g><title>${lab(x.k)}: ${x.masuk} masuk, ${x.selesai} selesai</title><rect x="${cx - bw - 1}" y="${T - h1}" width="${bw}" height="${h1}" rx="2" fill="var(--sky)"/><rect x="${cx + 1}" y="${T - h2}" width="${bw}" height="${h2}" rx="2" fill="var(--success)"/>
    <text x="${cx}" y="${T + 13}" text-anchor="middle" font-size="9" fill="var(--muted)">${lab(x.k)}</text>${x.masuk ? `<text x="${cx - bw / 2 - 1}" y="${T - h1 - 3}" text-anchor="middle" font-size="9" fill="var(--text)">${x.masuk}</text>` : ""}${x.selesai ? `<text x="${cx + bw / 2 + 1}" y="${T - h2 - 3}" text-anchor="middle" font-size="9" fill="var(--text)">${x.selesai}</text>` : ""}</g>`;
  }).join("")}</svg>`;
}

function htmlDonat(kat, total) {
  if (!total) return `<p class="mr-sub">Belum ada job di periode ini.</p>`;
  let off = 0;
  const arc = kat.map((k, i) => { const p = (k.masuk + k.selesai > 0 ? (k.masuk || k.selesai) : 0) / total * 100; const s = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${WARNA[i % WARNA.length]}" stroke-width="6" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${-off}" transform="rotate(-90 21 21)"><title>${e(k.nama)}: ${k.masuk}</title></circle>`; off += p; return s; }).join("");
  return `<div class="dj-donat"><svg viewBox="0 0 42 42" width="120" height="120" role="img" aria-label="Komposisi kategori"><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--border)" stroke-width="6"/>${arc}<text x="21" y="23" text-anchor="middle" font-size="7" font-weight="700" fill="var(--text)">${total}</text></svg>
    <div class="dj-legenda">${kat.map((k, i) => `<button type="button" data-dj="kat" data-v="${e(k.nama)}" class="${S.fKat === k.nama ? "is-aktif" : ""}"><i style="background:${WARNA[i % WARNA.length]}"></i>${e(k.nama)} <b>${k.masuk}</b></button>`).join("")}</div></div>`;
}

function htmlPerforma(now) {
  const r = rentangAktif(), js = tampak(), k = H.hitungKpi(js, r, now), kat = H.per(js, "kategori", r).filter((x) => x.masuk), orang = H.per(js, "pic", r);
  const tot = kat.reduce((n, x) => n + x.masuk, 0), maxO = Math.max(1, ...orang.map((o) => o.selesai + o.aktif));
  const perlu = H.pengingat(js, now), lis = [...perlu.terlambat, ...perlu.hariIni].slice(0, 5);
  const kpi = (judul, nilai, ket, aksi) => `<button type="button" class="dj-kpi" data-dj="${aksi}"><span>${judul}</span><b>${nilai}</b><small>${ket}</small></button>`;
  return `<div id="dj-dash"><div class="dj-kpis">
    ${kpi("Job selesai", k.selesai, `dari ${k.masuk} masuk${k.persenSelesai != null ? ` (${k.persenSelesai}%)` : ""}`, "k-selesai")}
    ${kpi("Tepat waktu", k.persenTepat == null ? "–" : k.persenTepat + "%", `${k.tepat} dari ${k.selesai} selesai`, "k-selesai")}
    ${kpi("Rata-rata selesai", k.rataHari == null ? "–" : String(k.rataHari).replace(".", ",") + " hr", "masuk sampai selesai", "k-selesai")}
    ${kpi("Terlambat", k.terlambat, `backlog ${k.backlog} job`, "k-telat")}</div>
  <div class="dj-grid2"><section class="mr-kartu dj-kartu"><h3>Job masuk dan selesai</h3><div class="dj-lg"><span><i style="background:var(--sky)"></i>Masuk</span><span><i style="background:var(--success)"></i>Selesai</span></div>${htmlBarDeret(H.deret(js, r, S.periode === "tahun" ? "tahun" : "bulan"))}</section>
  <section class="mr-kartu dj-kartu"><h3>Per kategori</h3>${htmlDonat(kat, tot)}</section></div>
  <section class="mr-kartu dj-kartu"><h3>Beban kerja per orang</h3>${orang.length ? orang.map((o) => `<button type="button" class="dj-org${S.fPic === o.nama ? " is-aktif" : ""}" data-dj="pic" data-v="${e(o.nama)}"><span>${e(o.nama)}</span><div class="dj-bar" title="${o.selesai} selesai, ${o.aktif} aktif, bobot selesai ${o.bobot}"><i style="width:${(o.selesai / maxO) * 100}%;background:var(--success)"></i><i style="width:${(o.aktif / maxO) * 100}%;background:var(--sky)"></i></div><b>${o.selesai}/${o.aktif}</b></button>`).join("") + `<p class="mr-sub">Hijau = selesai di periode, biru = masih aktif. Angka: selesai/aktif.</p>` : `<p class="mr-sub">Belum ada data.</p>`}</section>
  <section class="mr-kartu dj-kartu"><h3>Perlu perhatian</h3>${lis.length ? lis.map((j) => barisJob(j, now)).join("") : `<p class="mr-sub">Tidak ada job terlambat atau jatuh tempo hari ini.</p>`}</section></div>`;
}

function htmlDaftar(now) {
  const cari = S.cari.trim().toLowerCase(), r = rentangAktif();
  const f = { aktif: (j) => H.aktif(j), telat: (j) => H.terlambat(j, now), minggu: (j) => H.aktif(j) && H.dalam(j.tglTarget, H.rentang("minggu", now)), selesai: (j) => j.status === "selesai" && H.dalam(j.tglSelesai, r), semua: () => true };
  const dasar = tampak(), n = (k) => dasar.filter(f[k]).length;
  const l = dasar.filter(f[S.fStatus] || f.aktif).filter((j) => !cari || [j.judul, j.customer, j.pic, j.kategori, j.deskripsi].join(" ").toLowerCase().includes(cari)).sort((a, b) => (a.tglTarget || "9").localeCompare(b.tglTarget || "9"));
  return `<div class="dj-chips">${[["aktif", "Aktif"], ["telat", "Terlambat"], ["minggu", "Target minggu ini"], ["selesai", "Selesai (periode)"], ["semua", "Semua"]].map(([k, t]) => `<button type="button" class="mr-chip${S.fStatus === k ? " is-aktif" : ""}" data-dj="status" data-v="${k}">${t} <span>${n(k)}</span></button>`).join("")}</div>
  <input type="search" id="dj-cari" class="dj-cari" placeholder="Cari judul, customer, PIC…" value="${e(S.cari)}" aria-label="Cari job">
  <div class="mr-kartu dj-kartu dj-daftar">${l.length ? l.map((j) => barisJob(j, now)).join("") : `<p class="mr-sub" style="padding:14px">Tidak ada job pada filter ini. Ketuk + untuk mencatat job baru.</p>`}</div>`;
}

function htmlKelompok() {
  const hit = (id) => S.akun.filter((a) => a.kelompokDJ === id).length;
  return `<section class="mr-kartu dj-kartu"><h3>Kelompok</h3><p class="mr-sub">Anggota hanya melihat dan mengubah job kelompoknya. Master dan admin melihat semua.</p>
    ${S.kelompok.map((k) => `<div class="dj-org"><span><b>${e(k.nama)}</b> · ${hit(k.id)} anggota · ${S.jobs.filter((j) => j.kelompokId === k.id).length} job</span><span class="mr-ruang"></span><button class="mr-btn mr-btn--kecil" data-dj="kel-ubah" data-id="${e(k.id)}">Ubah</button><button class="mr-ikonbtn" data-dj="kel-hapus" data-id="${e(k.id)}" aria-label="Hapus kelompok">${ikon("tong", 15)}</button></div>`).join("") || `<p class="mr-sub">Belum ada kelompok.</p>`}
    <button class="mr-btn mr-btn--utama" data-dj="kel-baru">${ikon("plus", 14)} Kelompok baru</button></section>
    <section class="mr-kartu dj-kartu"><h3>Kelompok tiap akun</h3>${S.akun.map((a) => `<label class="dj-org"><span>${e(a.nama || a.email)}<small> ${e(a.email)}</small></span><select data-dj="kel-akun" data-id="${e(a.id)}" aria-label="Kelompok ${e(a.nama || a.email)}">${opsi(S.kelompok.map((k) => [k.id, k.nama]), a.kelompokDJ || "", "Tanpa kelompok")}</select></label>`).join("")}</section>`;
}

function htmlPengingat(now) {
  const p = H.pengingat(tampak(), now);
  if (!p.terlambat.length && !p.hariIni.length && !p.segera.length) return "";
  return `<button type="button" class="dj-alert" data-dj="k-telat"><span><b>${p.terlambat.length} terlambat</b> · ${p.hariIni.length} jatuh tempo hari ini · ${p.segera.length} mulai minggu ini</span><b>Lihat</b></button>`;
}

function render() {
  const el = $("#dj-root"); if (!el) return;
  const now = H.hariIni(), perlu = S.kelola || S.kelompokSaya;
  const tabs = [["performa", "Performa"], ["job", "Daftar job"], ...(S.kelola ? [["kelompok", "Kelompok"]] : [])];
  const ctl = `<div class="dj-bar2"><div class="mr-seg dj-seg" role="group" aria-label="Periode">${[["minggu", "Minggu"], ["bulan", "Bulan"], ["tahun", "Tahun"], ["rentang", "Rentang"]].map(([k, t]) => `<button type="button" class="mr-chip${S.periode === k ? " is-aktif" : ""}" data-dj="periode" data-v="${k}">${t}</button>`).join("")}</div>
    ${S.periode === "rentang" ? `<input type="date" id="dj-dari" value="${e(S.dari)}" aria-label="Dari"><input type="date" id="dj-sampai" value="${e(S.sampai)}" aria-label="Sampai">` : ""}
    ${S.kelola ? `<select data-dj="f-kel" aria-label="Kelompok">${opsi(S.kelompok.map((k) => [k.id, k.nama]), S.fKel, "Semua kelompok")}</select>` : ""}
    <select data-dj="f-pic" aria-label="PIC">${opsi(daftarPic(), S.fPic, "Semua PIC")}</select><select data-dj="f-kat" aria-label="Kategori">${opsi(H.daftarKategori(S.jobs), S.fKat, "Semua kategori")}</select>
    <span class="dj-aksi"><button type="button" class="mr-btn${statusPush(S.u.uid) === "aktif" ? " dj-push-aktif" : ""}" data-dj="push" title="Notifikasi ke perangkat ini: pengingat catat job 09.00, 14.00, 17.00 dan deadline H-1"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg> ${statusPush(S.u.uid) === "aktif" ? "Notifikasi aktif" : "Notifikasi"}</button>${S.kelola ? `<button type="button" class="mr-btn" data-dj="impor" title="Import dari Excel">${ikon("upload", 15)} Import</button>` : ""}<button type="button" class="mr-btn dj-pdf" data-dj="pdf" title="Unduh laporan PDF">${ikon("download", 15)} PDF</button></span></div>`;
  let isi;
  if (S.muat) isi = `<p class="mr-sub">Memuat…</p>`;
  else if (S.galat) isi = `<div class="dj-alert dj-alert--bahaya">${e(S.galat)}</div>`;
  else if (!perlu) isi = `<section class="mr-kartu dj-kartu"><h3>Akun ini belum masuk kelompok</h3><p class="mr-sub">Minta master atau admin menetapkan kelompok Daily Job untuk akun Anda.</p></section>`;
  else isi = (S.tab !== "kelompok" ? ctl + htmlPengingat(now) : "") + (S.tab === "performa" ? htmlPerforma(now) : S.tab === "job" ? htmlDaftar(now) : htmlKelompok());
  el.innerHTML = `<div class="dj-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" class="${S.tab === k ? "is-aktif" : ""}" data-dj="tab" data-v="${k}">${t}</button>`).join("")}</div>${isi}
    ${perlu && !S.muat ? `<button type="button" class="mr-fab" data-dj="baru" aria-label="Catat job baru">${ikon("plus", 22)}<span class="fab-teks">Catat job</span></button>` : ""}`;
}

/* ---------- form catat / ubah job ---------- */
const kelompokPilihan = () => (S.kelola ? S.kelompok : S.kelompok.filter((k) => k.id === S.kelompokSaya));
let berkasBaru = [];
function formJob(j) {
  const baru = !j, d = j || { kelompokId: S.fKel || S.kelompokSaya || (S.kelompok[0] || {}).id || "", status: "baru", prioritas: "sedang", bobot: 2, tglMasuk: H.hariIni(), pic: S.u.nama || "", file: [], tautan: [], catatan: [] };
  berkasBaru = []; d.file = d.file || []; d.tautan = d.tautan || []; d.catatan = d.catatan || [];
  const f = (lab, isi, kelas = "") => `<label class="mr-f ${kelas}"><span>${lab}</span>${isi}</label>`;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>${baru ? "Catat job baru" : "Ubah job"}</h2><p class="mr-sub">${baru ? "Job yang masuk hari ini, baru dikerjakan, atau masih pending." : e(namaKel(d.kelompokId))}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form dj-form" id="dj-form" data-id="${e(d.id || "")}">
    ${f("Judul job *", `<input id="djf-judul" maxlength="200" value="${e(d.judul || "")}" placeholder="mis. Penawaran trucking Jakarta–Surabaya">`, "dj-lebar")}
    ${f("Kategori *", `<select id="djf-kat">${opsi(H.daftarKategori([...S.jobs, d]), d.kategori || "")}<option value="__baru">＋ Kategori baru…</option></select><input id="djf-kat-baru" maxlength="40" placeholder="Nama kategori baru" hidden>`)}
    ${f("Customer", `<input id="djf-cust" value="${e(d.customer || "")}" placeholder="Nama customer">`)}
    ${f("PIC", `<input id="djf-pic" list="djf-piclist" value="${e(d.pic || "")}"><datalist id="djf-piclist">${daftarPic().map((p) => `<option value="${e(p)}">`).join("")}</datalist>`)}
    ${S.kelola ? f("Kelompok", `<select id="djf-kel">${opsi(kelompokPilihan().map((k) => [k.id, k.nama]), d.kelompokId)}</select>`) : ""}
    ${f("Tanggal masuk", `<input type="date" id="djf-masuk" value="${e(d.tglMasuk || "")}">`)}
    ${f("Mulai dikerjakan", `<input type="date" id="djf-mulai" value="${e(d.tglMulai || "")}">`)}
    ${f("Target selesai *", `<input type="date" id="djf-target" value="${e(d.tglTarget || "")}">`)}
    ${f("Status", `<select id="djf-status">${opsi(Object.entries(H.STATUS), d.status)}</select>`)}
    ${f("Tanggal selesai", `<input type="date" id="djf-selesai" value="${e(d.tglSelesai || "")}">`)}
    ${f("Prioritas", `<select id="djf-prio">${opsi(Object.entries(H.PRIORITAS), d.prioritas)}</select>`)}
    ${f("Bobot kerja", `<select id="djf-bobot">${opsi(Object.entries(H.BOBOT).map(([k, t]) => [k, `${t} (${k})`]), d.bobot)}</select>`)}
    ${f("Deskripsi", `<textarea id="djf-desk" rows="3" placeholder="Rincian job, permintaan customer, hasil yang diharapkan">${e(d.deskripsi || "")}</textarea>`, "dj-lebar")}
    <div class="mr-f dj-lebar"><span>File project <small>maks. 4 MB per file (gambar, PDF, Word, Excel, PowerPoint, CSV, ZIP)</small></span>
      <div id="djf-file">${d.file.map((x, i) => `<div class="dj-fl"><a href="${aman(x.url)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(x.nama)}</a><button type="button" class="mr-ikonbtn" data-dj="file-lepas" data-i="${i}" aria-label="Lepas file">${ikon("tutup", 14)}</button></div>`).join("")}</div>
      <input type="file" id="djf-berkas" multiple><div class="dj-tautan"><input id="djf-tl" placeholder="Atau tempel tautan (Drive, OneDrive)"><button type="button" class="mr-btn mr-btn--kecil" data-dj="tautan-tambah">Tambah tautan</button></div>
      <div id="djf-tautan">${d.tautan.map((x, i) => `<div class="dj-fl"><a href="${aman(x.url)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(x.nama || x.url)}</a><button type="button" class="mr-ikonbtn" data-dj="tautan-lepas" data-i="${i}" aria-label="Lepas tautan">${ikon("tutup", 14)}</button></div>`).join("")}</div></div>
    ${f("Catatan progres", `<textarea id="djf-cat" rows="2" placeholder="Tambah catatan baru (tercatat dengan tanggal dan nama)"></textarea>`, "dj-lebar")}
    ${d.catatan.length ? `<div class="mr-f dj-lebar"><span>Riwayat catatan</span>${d.catatan.slice().reverse().map((c) => `<div class="dj-cat"><small>${fmtTgl(c.tgl)} · ${e(c.oleh)}</small>${e(c.teks)}</div>`).join("")}</div>` : ""}
  </div></div>
  <footer class="mr-panel__kaki">${baru ? "" : `<button class="mr-btn mr-btn--bahaya" data-dj="hapus" data-id="${e(d.id)}">Hapus</button>`}<span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="simpan" id="dj-simpan">Simpan</button></footer>`);
  $("#dj-form")._d = d;
  $("#djf-kat").onchange = (ev) => { const n = $("#djf-kat-baru"); n.hidden = ev.target.value !== "__baru"; if (!n.hidden) n.focus(); };
  $("#djf-status").onchange = (ev) => { const s = $("#djf-selesai"); if (ev.target.value === "selesai" && !s.value) s.value = H.hariIni(); if (ev.target.value !== "selesai") s.value = ""; };
  $("#djf-berkas").onchange = (ev) => { berkasBaru.push(...ev.target.files); ev.target.value = ""; tampilBaru(); };
}
const tampilBaru = () => { const w = $("#djf-file"); w.querySelectorAll(".dj-fl--baru").forEach((x) => x.remove()); berkasBaru.forEach((b, i) => w.insertAdjacentHTML("beforeend", `<div class="dj-fl dj-fl--baru"><span>${ikon("upload", 13)} ${e(b.name)} <small>(baru)</small></span><button type="button" class="mr-ikonbtn" data-dj="baru-lepas" data-i="${i}" aria-label="Batalkan">${ikon("tutup", 14)}</button></div>`)); };

async function simpanJob() {
  const form = $("#dj-form"), d = form._d, v = (id) => ($("#" + id) || {}).value || "";
  const judul = v("djf-judul").trim(), target = v("djf-target"), kel = S.kelola ? v("djf-kel") : S.kelompokSaya;
  const kat = v("djf-kat") === "__baru" ? H.rapikanKategori(v("djf-kat-baru"), H.daftarKategori(S.jobs)) : v("djf-kat");
  if (!judul) return toast("Isi judul job.", "bahaya");
  if (!kat) return toast("Isi nama kategori baru.", "bahaya");
  if (!target) return toast("Isi target selesai.", "bahaya");
  if (!kel) return toast("Pilih kelompok. Buat kelompok dulu di tab Kelompok.", "bahaya");
  if (v("djf-masuk") && target < v("djf-masuk")) return toast("Target selesai tidak boleh sebelum tanggal masuk.", "bahaya");
  const tombol = $("#dj-simpan"); tombol.disabled = true; tombol.textContent = "Menyimpan…";
  try {
    const id = form.dataset.id || uid(), file = [...d.file];
    for (const b of berkasBaru) { const path = `dailyjob/${kel}/${id}/${Date.now()}-${b.name.replace(/[^\w.\-]+/g, "_")}`; file.push({ nama: b.name, path, url: await unggahBlob(path, b, b.type || "application/octet-stream") }); }
    const catatan = [...d.catatan]; if (v("djf-cat").trim()) catatan.push({ tgl: H.hariIni(), oleh: S.u.nama || S.u.email, teks: v("djf-cat").trim() });
    const status = v("djf-status"), data = {
      judul, kategori: kat, customer: v("djf-cust").trim(), pic: v("djf-pic").trim(), kelompokId: kel, deskripsi: v("djf-desk").trim(), tglMasuk: v("djf-masuk") || H.hariIni(), tglMulai: v("djf-mulai") || null, tglTarget: target,
      status, tglSelesai: status === "selesai" ? v("djf-selesai") || H.hariIni() : null, prioritas: v("djf-prio"), bobot: +v("djf-bobot") || 2, file, tautan: d.tautan, catatan,
      dibuatOleh: d.dibuatOleh || S.u.uid, dibuatNama: d.dibuatNama || S.u.nama || S.u.email, dibuatPada: d.dibuatPada || H.hariIni(), diubah: serverTimestamp(),
    };
    await setDoc(doc(db, "dj_job", id), data);
    const ada = S.jobs.findIndex((x) => x.id === id), baru = { id, ...data, diubah: null };
    if (ada >= 0) S.jobs[ada] = baru; else S.jobs.push(baru);
    tutupLayer(); render(); toast("Job tersimpan.");
  } catch (err) { console.error(err); toast("Job belum tersimpan: " + e(err.message || err), "bahaya"); tombol.disabled = false; tombol.textContent = "Simpan"; }
}

async function tandaiSelesai(id) {
  const j = S.jobs.find((x) => x.id === id); if (!j) return;
  try { const p = { status: "selesai", tglSelesai: H.hariIni(), diubah: serverTimestamp() }; await updateDoc(doc(db, "dj_job", id), p); Object.assign(j, p, { diubah: null }); render(); toast("Job ditandai selesai."); }
  catch (err) { toast("Belum bisa menyimpan: " + e(err.message || err), "bahaya"); }
}

/* ---------- PDF ---------- */
const tungguLib = async () => { for (let i = 0; i < 40 && !(window.jspdf && window.html2canvas); i++) await new Promise((r) => setTimeout(r, 250)); if (!(window.jspdf && window.html2canvas)) throw new Error("Pustaka PDF belum siap. Coba lagi sebentar lagi."); };
async function unduhPdf() {
  const tombol = $(".dj-pdf"); if (tombol) tombol.disabled = true;
  try {
    await tungguLib();
    const adaDash = S.tab === "performa"; if (!adaDash) { S.tab = "performa"; render(); }
    const root = $("#dj-root"), now = H.hariIni(), r = rentangAktif(), js = tampak(), k = H.hitungKpi(js, r, now);
    root.classList.add("dj-cetak"); // kertas laporan putih
    const cv = await window.html2canvas($("#dj-dash"), { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    root.classList.remove("dj-cetak");
    const { jsPDF } = window.jspdf, pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }), W = pdf.internal.pageSize.getWidth(), Hh = pdf.internal.pageSize.getHeight();
    const kel = S.fKel ? namaKel(S.fKel) : S.kelola ? "Semua kelompok" : namaKel(S.kelompokSaya);
    pdf.setFontSize(16); pdf.setTextColor(10, 61, 102); pdf.text("Laporan Kinerja Daily Job", 12, 14);
    pdf.setFontSize(10); pdf.setTextColor(90, 100, 115); pdf.text(`${kel}  |  Periode ${fmtTgl(r[0])} – ${fmtTgl(r[1])}${S.fPic ? "  |  PIC " + S.fPic : ""}${S.fKat ? "  |  " + S.fKat : ""}  |  Dibuat ${fmtTgl(now)}`, 12, 20);
    const sk = Math.min((W - 24) / cv.width, (Hh - 30) / cv.height); pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 12, 25, cv.width * sk, cv.height * sk);
    const tabel = (judul, baris, kolom) => {
      pdf.addPage("a4", "landscape"); pdf.setFontSize(13); pdf.setTextColor(10, 61, 102); pdf.text(judul, 12, 14);
      pdf.autoTable({ startY: 18, margin: { left: 12, right: 12 }, head: [kolom.map((c) => c[0])], body: baris.map((j, i) => kolom.map((c) => c[1](j, i))), styles: { fontSize: 8, cellPadding: 1.6 }, headStyles: { fillColor: [10, 61, 102] },
        didDrawCell: (h) => { const c = kolom[h.column.index]; if (h.section === "body" && c[2]) { const u = c[2](baris[h.row.index]); if (u) pdf.link(h.cell.x, h.cell.y, h.cell.width, h.cell.height, { url: u }); } } });
    };
    const urut = (a, b) => (a.tglSelesai || a.tglTarget || "").localeCompare(b.tglSelesai || b.tglTarget || "");
    const selesai = js.filter((j) => j.status === "selesai" && H.dalam(j.tglSelesai, r)).sort(urut), aktif = js.filter(H.aktif).sort(urut);
    const fl = (j) => [...(j.file || []).map((x) => x.url), ...(j.tautan || []).map((x) => x.url)];
    const kolomF = [["No", (j, i) => i + 1], ["Job", (j) => j.judul], ["Kategori", (j) => j.kategori || "-"], ["Customer", (j) => j.customer || "-"], ["PIC", (j) => j.pic || "-"], ["Masuk", (j) => fmtTgl(j.tglMasuk)], ["Target", (j) => fmtTgl(j.tglTarget)]];
    if (selesai.length) tabel(`Job selesai (${selesai.length}) — ${k.persenTepat ?? 0}% tepat waktu`, selesai, [...kolomF, ["Selesai", (j) => fmtTgl(j.tglSelesai)], ["File project", (j) => (fl(j).length ? `Buka (${fl(j).length})` : "-"), (j) => fl(j)[0]]]);
    if (aktif.length) tabel(`Job belum selesai (${aktif.length})`, aktif, [...kolomF, ["Status", (j) => H.STATUS[j.status]], ["Posisi", (j) => H.labelTarget(j, now).t]]);
    pdf.save(`daily-job-${r[0]}_${r[1]}.pdf`);
  } catch (err) { console.error(err); toast("PDF belum jadi: " + e(err.message || err), "bahaya"); }
  finally { $("#dj-root")?.classList.remove("dj-cetak"); if (tombol) tombol.disabled = false; }
}


/* ---------- import Excel (master/admin) ---------- */
const NAMA_TIM = "Marketing dan BD";
let rencana = null;
function panelImpor() {
  rencana = null;
  bukaLayer(`<header class="mr-panel__kepala"><div><h2>Import dari Excel</h2><p class="mr-sub">Lembar "Input Tugas Harian": Tanggal Diberikan, PIC, Kategori, Customer, Deskripsi, Deadline, Tanggal Selesai, Keterangan. Impor ulang file yang sama menimpa job impor sebelumnya, bukan menggandakan.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
  <div class="mr-panel__isi"><div class="mr-form"><label class="mr-f dj-lebar"><span>File Excel (.xlsx)</span><input type="file" id="dji-file" accept=".xlsx,.xls"></label>
  <label class="mr-f dj-lebar"><span>Masuk ke kelompok</span><select id="dji-kel">${opsi([...S.kelompok.map((k) => [k.id, k.nama]), ...(S.kelompok.some((k) => k.nama === NAMA_TIM) ? [] : [["__baru", `＋ Buat kelompok "${NAMA_TIM}"`]])], (S.kelompok.find((k) => k.nama === NAMA_TIM) || {}).id || S.fKel || "__baru")}</select></label>
  <div id="dji-hasil" class="dj-lebar mr-sub">${S.kelompok.length ? "Pilih file untuk melihat pratinjau." : "Pilih file untuk melihat pratinjau."}</div></div></div>
  <footer class="mr-panel__kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" data-dj="impor-jalan" id="dji-ok" disabled>Impor</button></footer>`);
  $("#dji-file").onchange = async (ev) => {
    const f = ev.target.files[0], out = $("#dji-hasil"); if (!f) return;
    try {
      for (let i = 0; i < 40 && !window.XLSX; i++) await new Promise((r) => setTimeout(r, 250));
      if (!window.XLSX) throw new Error("Pustaka Excel belum siap. Coba lagi sebentar lagi.");
      const wb = window.XLSX.read(await f.arrayBuffer(), { type: "array" });
      const nama = wb.SheetNames.find((n) => /input tugas/i.test(n)) || wb.SheetNames[0];
      const r = H.petaExcel(window.XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, raw: true, defval: "" }));
      if (r.galat) throw new Error(r.galat);
      const ada = r.jobs.filter((j) => S.jobs.some((x) => x.id === j.id)).length, sel = r.jobs.filter((j) => j.status === "selesai").length;
      rencana = r.jobs; out.innerHTML = `<b>${r.jobs.length} job</b> siap diimpor dari lembar "${e(nama)}": ${sel} selesai, ${r.jobs.length - sel} belum selesai.${ada ? `<br><b>${ada}</b> job impor sebelumnya akan ditimpa.` : ""}
        ${r.peringatan.length ? `<details><summary>${r.peringatan.length} catatan perlu dicek</summary>${r.peringatan.map((x) => `<div>${e(x)}</div>`).join("")}</details>` : ""}`;
      $("#dji-ok").disabled = !r.jobs.length;
    } catch (err) { rencana = null; $("#dji-ok").disabled = true; out.textContent = "File belum bisa dibaca: " + (err.message || err); }
  };
}
async function jalankanImpor() {
  let kel = $("#dji-kel").value; const tombol = $("#dji-ok"); if (!rencana || !kel) return;
  tombol.disabled = true; tombol.textContent = "Mengimpor…"; let n = 0;
  try {
    if (kel === "__baru") { kel = uid(); await setDoc(doc(db, "dj_kelompok", kel), { nama: NAMA_TIM, dibuat: H.hariIni() }); S.kelompok.push({ id: kel, nama: NAMA_TIM, dibuat: H.hariIni() }); }
    const sekarang = H.hariIni();
    for (let i = 0; i < rencana.length; i += 15) await Promise.all(rencana.slice(i, i + 15).map(async (j) => {
      const id = `imp-${kel}-${j.id}`, data = { ...j, kelompokId: kel, tglMasuk: j.tglMasuk || sekarang, dibuatOleh: S.u.uid, dibuatNama: "Import Excel", dibuatPada: sekarang, diimpor: true, diubah: serverTimestamp() };
      await setDoc(doc(db, "dj_job", id), data); n++;
      const ada = S.jobs.findIndex((x) => x.id === id), baru = { ...data, id, diubah: null }; if (ada >= 0) S.jobs[ada] = baru; else S.jobs.push(baru);
    }));
    tutupLayer(); S.fKel = kel; S.periode = "rentang"; const t = S.jobs.filter((x) => x.diimpor).map((x) => x.tglMasuk).sort(); S.dari = t[0]; S.sampai = H.hariIni(); render(); toast(`${n} job diimpor.`);
  } catch (err) { console.error(err); toast(`Impor berhenti setelah ${n} job: ` + e(err.message || err), "bahaya"); tombol.disabled = false; tombol.textContent = "Impor"; }
}

/* ---------- aksi ---------- */
const periksa = (ev) => window.__rute === "dailyjob" || ev.target.closest("#mr-layer");
document.addEventListener("click", async (ev) => {
  if (!periksa(ev)) return;
  const t = ev.target.closest("[data-dj]"); if (!t) return;
  const a = t.dataset.dj, id = t.dataset.id, v = t.dataset.v;
  if (t.tagName === "SELECT" || t.tagName === "INPUT") return;
  if (t.dataset.dj === "selesai") { ev.stopPropagation(); return tandaiSelesai(id); }
  if (a === "tab") { S.tab = v; return render(); }
  if (a === "periode") { S.periode = v; if (v === "rentang" && !S.dari) [S.dari, S.sampai] = H.rentang("bulan"); return render(); }
  if (a === "baru") return formJob(null);
  if (a === "buka") { const j = S.jobs.find((x) => x.id === id); return j && formJob(j); }
  if (a === "k-selesai") { S.fStatus = "selesai"; S.tab = "job"; return render(); }
  if (a === "k-telat") { S.fStatus = "telat"; S.tab = "job"; return render(); }
  if (a === "status") { S.fStatus = v; return render(); }
  if (a === "kat") { S.fKat = S.fKat === v ? "" : v; return render(); }
  if (a === "pic") { S.fPic = S.fPic === v ? "" : v; return render(); }
  if (a === "pdf") return unduhPdf();
  if (a === "push") {
    const st = statusPush(S.u.uid);
    if (st === "aktif") { if (await konfirmasi("Matikan notifikasi?", "Perangkat ini tidak lagi menerima pengingat Daily Job.", "Matikan")) { await matikanPush(S.u.uid); render(); toast("Notifikasi dimatikan di perangkat ini."); } return; }
    if (st === "iphone-pasang") return toast("Di iPhone, tambahkan ISL HUB ke Layar Utama dulu (Bagikan, lalu Tambah ke Layar Utama), buka dari ikon itu, lalu aktifkan notifikasi.", "info");
    if (st === "tidak-didukung") return toast("Browser ini belum mendukung notifikasi. Pakai Chrome, Edge, atau Safari terbaru.", "bahaya");
    if (st === "diblokir") return toast("Notifikasi diblokir untuk situs ini. Izinkan di pengaturan browser (ikon gembok di alamat), lalu coba lagi.", "bahaya");
    try { await aktifkanPush(S.u.uid); render(); toast("Notifikasi aktif di perangkat ini: pengingat 09.00, 14.00, 17.00 dan deadline H-1."); } catch (err) { console.error(err); toast("Notifikasi belum aktif: " + e(err.message || err), "bahaya"); } return;
  }
  if (a === "impor") return panelImpor();
  if (a === "impor-jalan") return jalankanImpor();
  if (a === "simpan") return simpanJob();
  const d = $("#dj-form") && $("#dj-form")._d;
  if (a === "file-lepas") { d.file.splice(+t.dataset.i, 1); return t.closest(".dj-fl").remove(); }
  if (a === "tautan-lepas") { d.tautan.splice(+t.dataset.i, 1); return t.closest(".dj-fl").remove(); }
  if (a === "baru-lepas") { berkasBaru.splice(+t.dataset.i, 1); return tampilBaru(); }
  if (a === "tautan-tambah") { const u = $("#djf-tl").value.trim(); if (!/^https?:\/\//i.test(u)) return toast("Tautan harus diawali http:// atau https://", "bahaya"); d.tautan.push({ url: u, nama: u.replace(/^https?:\/\//, "").slice(0, 60) }); $("#djf-tl").value = ""; return $("#djf-tautan").insertAdjacentHTML("beforeend", `<div class="dj-fl"><a href="${aman(u)}" target="_blank" rel="noopener">${ikon("file", 13)} ${e(u.slice(0, 60))}</a><span class="mr-sub">disimpan saat Simpan</span></div>`); }
  if (a === "hapus") { if (!(await konfirmasi("Hapus job ini?", "Job dan catatannya dihapus permanen. File di Storage tidak ikut dihapus.", "Hapus"))) return; try { await deleteDoc(doc(db, "dj_job", id)); S.jobs = S.jobs.filter((x) => x.id !== id); tutupLayer(); render(); toast("Job dihapus."); } catch (err) { toast("Belum bisa dihapus: " + e(err.message || err), "bahaya"); } return; }
  if (a === "kel-baru" || a === "kel-ubah") {
    const k = S.kelompok.find((x) => x.id === id), nama = (prompt("Nama kelompok / divisi:", k ? k.nama : "") || "").trim(); if (!nama) return;
    const kid = k ? k.id : uid(); try { await setDoc(doc(db, "dj_kelompok", kid), { nama, dibuat: k ? k.dibuat || H.hariIni() : H.hariIni() }); await muat(); toast("Kelompok tersimpan."); } catch (err) { toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } return;
  }
  if (a === "kel-hapus") {
    const k = S.kelompok.find((x) => x.id === id); if (S.jobs.some((j) => j.kelompokId === id)) return toast("Kelompok masih punya job. Pindahkan atau hapus jobnya dulu.", "bahaya");
    if (!(await konfirmasi("Hapus kelompok?", `Kelompok <b>${e(k.nama)}</b> dihapus. Akun anggotanya menjadi tanpa kelompok.`, "Hapus"))) return;
    try { await deleteDoc(doc(db, "dj_kelompok", id)); await Promise.all(S.akun.filter((x) => x.kelompokDJ === id).map((x) => updateDoc(doc(db, "pengguna", x.id), { kelompokDJ: null }))); await muat(); toast("Kelompok dihapus."); } catch (err) { toast("Belum terhapus: " + e(err.message || err), "bahaya"); }
  }
});
document.addEventListener("keydown", (ev) => { if (window.__rute === "dailyjob" && (ev.key === "Enter" || ev.key === " ") && ev.target.matches?.('.dj-job[data-dj="buka"]')) { ev.preventDefault(); ev.target.click(); } });
document.addEventListener("change", async (ev) => {
  if (window.__rute !== "dailyjob") return;
  const t = ev.target, a = t.dataset && t.dataset.dj;
  if (a === "f-kel") { S.fKel = t.value; S.fPic = ""; return render(); }
  if (a === "f-pic") { S.fPic = t.value; return render(); }
  if (a === "f-kat") { S.fKat = t.value; return render(); }
  if (t.id === "dj-dari" || t.id === "dj-sampai") { S[t.id === "dj-dari" ? "dari" : "sampai"] = t.value; return render(); }
  if (a === "kel-akun") { try { await updateDoc(doc(db, "pengguna", t.dataset.id), { kelompokDJ: t.value || null }); const ak = S.akun.find((x) => x.id === t.dataset.id); if (ak) ak.kelompokDJ = t.value || null; toast("Kelompok akun diperbarui."); } catch (err) { toast("Belum tersimpan: " + e(err.message || err), "bahaya"); } }
});
document.addEventListener("input", (ev) => { if (window.__rute === "dailyjob" && ev.target.id === "dj-cari") { S.cari = ev.target.value; const p = ev.target.selectionStart; render(); const n = $("#dj-cari"); if (n) { n.focus(); n.setSelectionRange(p, p); } } });

/* ---------- pintu masuk ---------- */
export async function mulaiDailyJob(user, profil) {
  S.u = { uid: user.uid, email: user.email, nama: (profil && profil.nama) || user.displayName || "" };
  S.kelola = !!window.__ISL_KELOLA; S.kelompokSaya = (profil && profil.kelompokDJ) || null;
  $("#user-email").textContent = labelAkun(user.email, user.displayName); renderNav("dailyjob");
  const el = $("#dj-root"); if (el && !el.dataset.siap) el.dataset.siap = "1";
  if (window.__djBukaForm) { window.__djBukaForm = false; await muat(); if (S.kelola || S.kelompokSaya) formJob(null); return; }
  await muat();
}

/* ---------- pengingat catat job: 09.00, 14.00, 17.00 WIB ---------- */
export function pasangPengingat(user, profil) {
  const kelompok = (profil && profil.kelompokDJ) || null, kelola = !!window.__ISL_KELOLA;
  if (!kelompok && !kelola) return;
  const kunci = "dj-pengingat:" + user.uid, baca = () => { try { return JSON.parse(localStorage.getItem(kunci) || "[]"); } catch (_) { return []; } };
  const tandai = (k) => { try { localStorage.setItem(kunci, JSON.stringify([...baca().filter((x) => x.startsWith(H.hariIni())), k])); } catch (_) { /* tanpa penyimpanan: pengingat muncul lagi saat dibuka */ } };
  const cek = async () => {
    const k = H.slotJatuhTempo(baca()); if (!k || document.getElementById("dj-ingat")) return;
    let p = { terlambat: [], hariIni: [] };
    try { const q = kelola ? collection(db, "dj_job") : query(collection(db, "dj_job"), where("kelompokId", "==", kelompok)); p = H.pengingat((await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }))); } catch (_) { /* tetap ingatkan mencatat */ }
    const jam = k.split("#")[1].padStart(2, "0") + ".00";
    const kotak = document.createElement("div"); kotak.id = "dj-ingat"; kotak.className = "dj-ingat"; kotak.setAttribute("role", "alertdialog");
    kotak.innerHTML = `<b>Pengingat ${jam} · catat daily job</b><p>Catat job baru, yang sedang dikerjakan, dan yang masih pending.${p.terlambat.length || p.hariIni.length ? `<br><b>${p.terlambat.length} terlambat</b> · ${p.hariIni.length} jatuh tempo hari ini.` : ""}</p>
      <div><button class="mr-btn mr-btn--utama" data-x="catat">Catat sekarang</button><button class="mr-btn" data-x="nanti">Tutup</button></div>`;
    document.body.appendChild(kotak);
    kotak.querySelector('[data-x="catat"]').onclick = () => { tandai(k); kotak.remove(); if (window.__rute === "dailyjob") { window.__djBukaForm = false; formJob(null); } else { window.__djBukaForm = true; location.hash = "#dailyjob"; } };
    kotak.querySelector('[data-x="nanti"]').onclick = () => { tandai(k); kotak.remove(); };
  };
  jagaPush(user.uid, (h) => toast(h)); // perbarui token notifikasi; pesan saat aplikasi terbuka jadi toast
  cek(); setInterval(cek, 60000);
}
