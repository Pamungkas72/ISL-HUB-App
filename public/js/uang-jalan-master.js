// Tab "Uang Jalan" di Master Rate: daftar datar (satu baris = satu rute x armada) + formulir kalkulator.
// Desktop: formulir bergulir bagian bernomor (F1). HP: komponen ditambah lewat chip + pratinjau slip (F3). Hitungan: uang-jalan-hitung.js.
// Tiap baris otomatis tercatat di tab Tarif (vendor Internal, lini Uang Jalan). Koleksi: uj_master, uj_riwayat, uj_pengaturan/umum (db-firebase.js).
import { ikon } from "./ikon.js";
import { e, $, tgl, toast, bukaLayer, tutupLayer, konfirmasi } from "./ui.js";
import { buatKunci, slug } from "./kunci.js";
import { ARMADA, OPSIONAL, SOLAR_AWAL, BULAT_AWAL, armadaDari, rp, angkaRp, desimal, rasioAwal, kunciUJ, namaRute, hitung, rincianSingkat } from "./uang-jalan-hitung.js";

const U = { muat: "belum", pesan: "", master: [], peng: { solar: SOLAR_AWAL, bulat: BULAT_AWAL, rasio: {} }, f: { armada: "semua", cari: "" } };
let X = null, F = null, panelAktif = null; // X = konteks master-rate.js { S, DB, HP, render }; F = isian formulir yang sedang terbuka
const fmt = (n) => Math.round(n || 0).toLocaleString("id-ID");
const ribu = (v) => (angkaRp(v) ? fmt(angkaRp(v)) : "");
const urutArmada = (k) => ARMADA.findIndex((a) => a.k === k);
const kunciTarif = (r) => buatKunci("uang_jalan", "internal", null, slug(r.rute), { armada: r.armadaNama }, "per_trip", null);

let terpasang = false;
export function pasangUJ(konteks) {
  X = konteks; if (terpasang) return; terpasang = true; // dipanggil tiap halaman dibuka; pendengar cukup sekali
  document.addEventListener("input", (ev) => { if (ev.target.id === "uj-cari" || ev.target.id === "uj-cari-bar") { U.f.cari = ev.target.value; X.render(); } });
  document.addEventListener("change", (ev) => { if (ev.target.id === "uj-f-armada") { U.f.armada = ev.target.value; X.render(); } });
}
export async function muatUJ(paksa = false) {
  if (!X || !X.S.kelola || (!paksa && U.muat !== "belum")) return;
  U.muat = "memuat"; X.render();
  try {
    const d = await X.DB.muatUangJalan();
    U.master = d.master.map((r) => ({ ...r, id: r.id })); const p = d.peng || {};
    U.peng = { solar: angkaRp(p.solar) || SOLAR_AWAL, bulat: p.bulat === undefined || p.bulat === null ? BULAT_AWAL : angkaRp(p.bulat), rasio: p.rasio || {} };
    U.muat = "siap";
  } catch (err) { U.muat = "gagal"; U.pesan = err.message || String(err); }
  X.render();
}

// ---------- daftar ----------
const cocokArmada = (r, f) => f === "semua" || (f === "g:kecil" ? r.grup === "Mobil kecil" : f === "g:trailer" ? r.grup === "Trailer" : r.armada === f);
function tampil() {
  const q = U.f.cari.trim().toLowerCase();
  return U.master.filter((r) => cocokArmada(r, U.f.armada) && (!q || `${r.rute} ${r.armadaNama} ${r.catatan || ""}`.toLowerCase().includes(q)))
    .sort((a, b) => String(a.rute).localeCompare(String(b.rute), "id") || urutArmada(a.armada) - urutArmada(b.armada));
}
const hasilBaris = (r) => hitung({ ...r, opsi: r.opsi, manual: r.manual });
const pilSolar = () => `<button type="button" class="ujm-pil" data-aksi="uj-peng">Solar <b>${rp(U.peng.solar)}</b>/liter · Ubah</button>`;
const tagSumber = (r) => (r.manual ? '<span class="ujm-tag ujm-tag--m">Manual</span>' : '<span class="ujm-tag ujm-tag--h">Hitung</span>');
const kosong = () => `<div class="mr-kosong">${ikon("truk", 28)}<p>${U.master.length ? "Tidak ada uang jalan yang cocok dengan filter." : "Belum ada uang jalan. Hitung rute pertama, hasilnya tersimpan di sini dan di tab Tarif."}</p>${X.S.kelola && !U.master.length ? `<button type="button" class="mr-btn mr-btn--utama" data-aksi="uj-tambah">${ikon("plus", 16)}Tambah uang jalan</button>` : ""}</div>`;
function status() {
  if (U.muat === "memuat" || U.muat === "belum") return `<div class="mr-kosong">${ikon("riwayat", 28)}<p>Memuat uang jalan…</p></div>`;
  if (U.muat === "gagal") return `<div class="mr-banner mr-banner--bahaya">${ikon("peringatan")}<div><strong>Uang jalan gagal dimuat.</strong> ${e(U.pesan)}<br><button type="button" class="mr-btn mr-btn--kecil" data-aksi="uj-muat">Coba lagi</button></div></div>`;
  return "";
}
const infoTarif = () => (U.master.length ? `<p class="mr-hint ujm-info">${ikon("truk", 14)}<span><b>${fmt(U.master.length)} baris tarif</b> otomatis tercatat di tab Tarif · vendor Internal · lini Uang Jalan. Ubah angkanya di sini.</span></p>` : "");

export function cariDesk() { return `<label class="mr-cari mr-cari--atas">${ikon("cari", 16)}<input id="uj-cari" type="search" placeholder="Cari rute, armada…" value="${e(U.f.cari)}" autocomplete="off"></label>`; }
export function htmlUJ() {
  const s = status(); if (s) return s;
  const d = tampil(), f = U.f.armada;
  const seg = (v, t) => `<button type="button" class="mr-seg__btn ${f === v ? "is-aktif" : ""}" data-aksi="uj-filter" data-v="${v}">${t}</button>`;
  return `<div class="mr-toolbar ujm-bar"><div class="mr-seg mr-seg--kecil" role="group" aria-label="Kelompok armada">${seg("semua", "Semua")}${seg("g:kecil", "Mobil kecil")}${seg("g:trailer", "Trailer")}</div>
    <select id="uj-f-armada" class="mr-select" aria-label="Armada"><option value="semua">Semua armada</option>${ARMADA.map((a) => `<option value="${a.k}" ${f === a.k ? "selected" : ""}>${e(a.nama)}</option>`).join("")}</select>${pilSolar()}</div>
    ${d.length ? `<div class="mr-kartu mr-tabelkartu"><table class="mr-table ujm-tbl"><thead><tr><th>Rute (pick up → tujuan)</th><th>Armada</th><th>Rincian</th><th class="ujm-r">Uang jalan</th><th>Diperbarui</th><th>Sumber</th></tr></thead><tbody>
    ${d.map((r) => `<tr class="ujm-baris" data-aksi="uj-buka" data-k="${e(r.id)}" tabindex="0"><td><b>${e(r.rute)}</b><small>${e(r.jarak)} km PP</small></td><td><span class="mr-tag">${e(r.armadaNama)}</span></td><td class="ujm-rin">${e(rincianSingkat(hasilBaris(r)))}</td><td class="ujm-r"><b>${fmt(r.total)}</b></td><td>${r.diperbaruiPada ? e(tgl(r.diperbaruiPada)) : "–"}</td><td>${tagSumber(r)}</td></tr>`).join("")}</tbody></table></div>
    <p class="mr-sub ujm-meta">${fmt(d.length)} dari ${fmt(U.master.length)} uang jalan · Rp per trip pulang-pergi</p>` : kosong()}${infoTarif()}`;
}
export function htmlUJHP() {
  const s = status(); if (s) return s;
  const d = tampil(), f = U.f.armada, ch = (v, t) => `<button type="button" class="mr-m-chip ${f === v ? "is-on" : ""}" data-aksi="uj-filter" data-v="${v}" aria-pressed="${f === v}">${t}</button>`;
  return `<div class="mr-m-chips" role="group" aria-label="Armada">${ch("semua", "Semua")}${ch("g:kecil", "Mobil kecil")}${ch("g:trailer", "Trailer")}${ARMADA.map((a) => ch(a.k, e(a.pendek))).join("")}</div>
    <div class="mr-m-meta"><span>${fmt(d.length)} dari ${fmt(U.master.length)} uang jalan</span><span class="mr-ruang"></span>${pilSolar()}</div>
    ${d.length ? `<section class="mr-m-box">${d.map((r) => { const h = hasilBaris(r), lain = h.baris.length - 3; return `<div class="ujm-row" data-aksi="uj-buka" data-k="${e(r.id)}" role="button" tabindex="0"><div class="ujm-row__t"><b>${e(r.rute)}</b><small><span class="mr-tag">${e(r.armadaNama)}</span> ${e(r.jarak)} km PP</small><small>BBM ${fmt(h.bbm)} · Tol ${fmt(angkaRp(r.tol))}${lain > 0 ? ` · +${lain} lain` : ""}</small></div><div class="ujm-row__v"><b>${fmt(r.total)}</b>${r.manual ? tagSumber(r) : ""}</div></div>`; }).join("")}</section>` : kosong()}${infoTarif()}`;
}
export const cariHPUJ = () => `<div class="mr-m-cari"><label class="mr-cari mr-m-cari__in">${ikon("cari", 16)}<input id="uj-cari-bar" type="search" placeholder="Cari rute, armada…" value="${e(U.f.cari)}" autocomplete="off" enterkeyhint="search"></label></div>`;

// ---------- formulir ----------
const rupiah = (k, v, label, extra = "") => `<div class="ujm-in ujm-in--rp"><em>Rp</em><input ${extra} data-ribuan-live inputmode="numeric" value="${e(ribu(v))}" placeholder="0" autocomplete="off" aria-label="${e(label)}"></div>`;
const hitungF = () => hitung({ jarak: F.jarak, rasio: F.rasio, solar: F.solar, tol: F.tol, mel: F.mel, digaji: F.digaji, bulat: U.peng.bulat,
  opsi: Object.fromEntries(OPSIONAL.map((c) => [c.k, F.aktif[c.k] ? F.opsi[c.k] : 0])), lain: F.lain, manual: F.pakaiManual ? F.manual : 0 });
const formDari = (r) => {
  const a = r ? armadaDari(r.armada) : null, o = (r && r.opsi) || {};
  return { asal: r ? r.id : "", pickup: r ? r.pickup : "", tujuan: r ? r.tujuan : "", jarak: r ? String(r.jarak || "").replace(".", ",") : "", armada: r ? r.armada : "cdd", digaji: r ? r.digaji !== false : true,
    rasio: r ? String(r.rasio || "").replace(".", ",") : String(rasioAwal("cdd", U.peng)).replace(".", ","), solar: r ? String(r.solar) : String(U.peng.solar), tol: r ? String(r.tol || "") : "", mel: r ? String(r.mel || "") : "",
    aktif: Object.fromEntries(OPSIONAL.map((c) => [c.k, angkaRp(o[c.k]) > 0])), opsi: Object.fromEntries(OPSIONAL.map((c) => [c.k, angkaRp(o[c.k]) > 0 ? String(o[c.k]) : ""])),
    lain: r ? (r.lain || []).map((c) => ({ nama: c.nama, v: String(c.v) })) : [], pakaiManual: !!(r && r.manual), manual: r && r.manual ? String(r.manual) : "", catatan: r ? r.catatan || "" : "", hp: X.HP(), sudah: !!r };
};
const baris = (nama, ket, kanan, o = {}) => `<div class="ujm-b ${o.mati ? "is-mati" : ""}">${o.sw !== undefined ? `<button type="button" role="switch" aria-checked="${o.sw}" aria-label="${e(nama)}" class="ujm-sw ${o.sw ? "is-on" : ""}" ${o.mati ? "disabled" : ""} data-ujt="sw" data-v="${o.k}"></button>` : ""}<div class="ujm-b__l"><b>${e(nama)}</b>${ket ? `<small>${e(ket)}</small>` : ""}</div><div class="ujm-b__v">${kanan}</div>${o.x ? `<button type="button" class="mr-ikonbtn ujm-x" data-ujt="sw" data-v="${o.k}" aria-label="Hapus ${e(nama)}">${ikon("tutup", 15)}</button>` : ""}</div>`;
const bbmBaris = (h) => `<div class="ujm-b"><div class="ujm-b__l"><b>BBM</b><small>${h.liter ? `${fmt(desimal(F.jarak))} km ÷ ${e(F.rasio)} = ${(Math.round(h.liter * 10) / 10).toLocaleString("id-ID")} liter × ${rp(angkaRp(F.solar))}` : "Isi jarak, rasio, dan harga solar"}</small></div><div class="ujm-b__v"><b>${rp(h.bbm)}</b></div></div>`;
const barisLain = () => F.lain.map((c, i) => `<div class="ujm-b"><div class="ujm-b__l"><input class="ujm-nama" data-ujl="nama" data-i="${i}" value="${e(c.nama)}" placeholder="Nama komponen" autocomplete="off" aria-label="Nama komponen"></div><div class="ujm-b__v">${rupiah("", c.v, "Nominal " + (c.nama || "komponen"), `data-ujl="v" data-i="${i}"`)}</div><button type="button" class="mr-ikonbtn ujm-x" data-ujt="lain-hapus" data-i="${i}" aria-label="Hapus komponen">${ikon("tutup", 15)}</button></div>`).join("");
function htmlKomp() {
  const h = hitungF(), dasar = baris("Tol", "", rupiah("tol", F.tol, "Tol", 'data-uj="tol"')) + baris("Biaya mel", "Retribusi, parkir, dan sejenisnya", rupiah("mel", F.mel, "Biaya mel", 'data-uj="mel"'));
  const opsi = (c) => rupiah(c.k, F.opsi[c.k], c.n, `data-ujo="${c.k}"`), mati = (c) => c.k === "insentif" && F.digaji;
  if (!F.hp) return `<div class="ujm-sec"><h5>2 · Biaya utama</h5>${bbmBaris(h)}${dasar}</div>
    <div class="ujm-sec"><h5>3 · Opsional</h5>${OPSIONAL.map((c) => baris(c.n, mati(c) ? "Tidak berlaku: driver digaji" : c.ket, F.aktif[c.k] && !mati(c) ? opsi(c) : rupiah("", "", c.n, "disabled"), { sw: F.aktif[c.k] && !mati(c), mati: mati(c) || false, k: c.k })).join("")}${barisLain()}<button type="button" class="ujm-tambah" data-ujt="lain">+ Komponen lain</button></div>`;
  const aktif = OPSIONAL.filter((c) => F.aktif[c.k] && !mati(c));
  return `<div class="ujm-sec"><h5>Komponen</h5>${bbmBaris(h)}${dasar}${aktif.map((c) => baris(c.n, c.ket, opsi(c), { x: 1, k: c.k })).join("")}${barisLain()}
    <div class="ujm-lab">Tambah komponen opsional</div><div class="ujm-add">${OPSIONAL.filter((c) => !F.aktif[c.k] || mati(c)).map((c) => (mati(c) ? `<span class="ujm-add__k" title="Hanya untuk driver tidak digaji">${ikon("tameng", 13)} ${e(c.n)}</span>` : `<button type="button" data-ujt="sw" data-v="${c.k}">+ ${e(c.n)}</button>`)).join("")}<button type="button" data-ujt="lain">+ Komponen lain</button></div>${F.digaji ? '<p class="mr-hint">Insentif driver hanya bisa ditambah bila driver tidak digaji.</p>' : ""}</div>`;
}
const slipHtml = (h) => `<div class="ujm-slip"><h6>SLIP UANG JALAN</h6><div class="k"><span>PT Indo Sukses Logistik</span><span>Draf</span></div><hr><div class="k"><span>Rute</span><b>${e(namaRute(F.pickup || "…", F.tujuan || "…"))}</b></div><div class="k"><span>Armada</span><b>${e(armadaDari(F.armada).nama)}</b></div><div class="k"><span>Jarak PP</span><b>${e(F.jarak || "–")} km</b></div><div class="k"><span>Driver</span><b>${F.digaji ? "Digaji" : "Tidak digaji"}</b></div><hr>
  ${h.baris.map((b) => `<div class="b"><span>${e(b.n)}</span><span>${rp(b.v)}</span></div>`).join("")}${h.pembulatan ? `<div class="b m"><span>Pembulatan</span><span>${h.pembulatan > 0 ? "+" : "−"}${fmt(Math.abs(h.pembulatan))}</span></div>` : ""}<hr><div class="t"><span>TOTAL</span><span>${rp(h.total)}</span></div></div>`;
const htmlSum = () => { const h = hitungF(); return `<div class="ujm-sum"><div><span>Subtotal</span><span>${rp(h.subtotal)}</span></div><div><span>Pembulatan ${U.peng.bulat ? rp(U.peng.bulat) : "(mati)"}</span><span>${h.pembulatan >= 0 ? "+" : "−"}${fmt(Math.abs(h.pembulatan))}</span></div><div class="t"><span>Uang jalan terhitung</span><span>${rp(h.hitungTotal)}</span></div></div>`; };
const htmlMan = () => `<div class="ujm-b"><button type="button" role="switch" aria-checked="${F.pakaiManual}" aria-label="Timpa dengan angka manual" class="ujm-sw ${F.pakaiManual ? "is-on" : ""}" data-ujt="manual"></button><div class="ujm-b__l"><b>Timpa dengan angka manual</b><small>Rumus diabaikan, baris diberi tanda Manual</small></div>${F.pakaiManual ? `<div class="ujm-b__v">${rupiah("manual", F.manual, "Angka manual", 'data-uj="manual"')}</div>` : ""}</div>`;
const field = (l, i, ket = "") => `<label class="mr-f"><span>${l}</span>${i}${ket}</label>`;
function htmlIsi() {
  const dari = (id, v, ph, label, suf) => `<div class="ujm-in"><input data-uj="${id}" ${id === "pickup" || id === "tujuan" ? "" : 'inputmode="decimal"'} value="${e(v)}" placeholder="${e(ph)}" autocomplete="off" aria-label="${e(label)}">${suf ? `<em>${suf}</em>` : ""}</div>`;
  const drv = `<div class="mr-seg" role="group" aria-label="Driver"><button type="button" class="mr-seg__btn ${F.digaji ? "is-aktif" : ""}" data-ujt="driver" data-v="1">Digaji</button><button type="button" class="mr-seg__btn ${F.digaji ? "" : "is-aktif"}" data-ujt="driver" data-v="0">Tidak digaji</button></div>`;
  const chip = (a) => `<button type="button" class="ujm-ch ${F.armada === a.k ? "is-on" : ""}" data-ujt="armada" data-v="${a.k}">${e(a.pendek)}</button>`;
  const arm = F.hp ? field("Armada", `<select data-uj="armada">${["Mobil kecil", "Trailer"].map((g) => `<optgroup label="${g}">${ARMADA.filter((a) => a.grup === g).map((a) => `<option value="${a.k}" ${F.armada === a.k ? "selected" : ""}>${e(a.nama)}</option>`).join("")}</optgroup>`).join("")}</select>`)
    : `<div class="mr-f"><span>Armada</span>${["Mobil kecil", "Trailer"].map((g) => `<div class="ujm-lab">${g}</div><div class="ujm-chs">${ARMADA.filter((a) => a.grup === g).map(chip).join("")}</div>`).join("")}</div>`;
  const rute = `<div class="ujm-sec"><h5>${F.hp ? "Rute dan armada" : "1 · Rute dan armada"}</h5><div class="mr-form">${field("Pick up", dari("pickup", F.pickup, "mis. Cikarang", "Pick up"))}${field("Tujuan", dari("tujuan", F.tujuan, "mis. Subang", "Tujuan"))}
    ${field("Jarak pulang-pergi", dari("jarak", F.jarak, "0", "Jarak pulang-pergi", "km"))}${F.hp ? arm : field("Harga solar", `<div class="ujm-in ujm-in--rp"><em>Rp</em><input data-uj="solar" data-ribuan-live inputmode="numeric" value="${e(ribu(F.solar))}" autocomplete="off" aria-label="Harga solar"><em>/liter</em></div>`)}
    ${F.hp ? "" : `<div class="mr-f--lebar">${arm}</div>`}${field("Rasio BBM (1 liter = … km)", dari("rasio", F.rasio, "0", "Rasio BBM"))}<div class="mr-f"><span>Driver</span>${drv}</div></div></div>`;
  return `<div id="ujm-ada"></div>${rute}<div id="ujm-komp">${htmlKomp()}</div>
    <div class="ujm-sec"><h5>${F.hp ? "Hasil" : "4 · Hasil"}</h5><div id="ujm-sum">${htmlSum()}</div><div id="ujm-man">${htmlMan()}</div>${F.hp ? `<button type="button" class="mr-btn ujm-lihat" data-ujt="slip">${ikon("file", 15)}Lihat slip</button><div id="ujm-slip" hidden></div>` : ""}
      <label class="mr-f" style="margin-top:10px"><span>Catatan <em class="ujm-opsi">opsional</em></span><div class="ujm-in"><input data-uj="catatan" value="${e(F.catatan)}" placeholder="mis. muat malam, via tol Cipali" autocomplete="off" aria-label="Catatan"></div></label></div>
    ${F.sudah ? `<div class="ujm-aksi"><button type="button" class="mr-btn" data-ujt="riwayat">${ikon("riwayat", 15)}Riwayat angka</button>${X.S.master ? `<button type="button" class="mr-btn mr-btn--hapus" data-ujt="hapus">${ikon("tong", 15)}Hapus</button>` : ""}</div>` : ""}<div id="ujm-riw" hidden></div><p class="mr-galat" id="ujm-galat" hidden></p>`;
}
const kunciF = () => kunciUJ(F.pickup, F.tujuan, F.armada);
function segar(struktur) {
  if (!panelAktif) return;
  const h = hitungF(), tot = $("#ujm-tot", panelAktif), ada = $("#ujm-ada", panelAktif), k = F.pickup.trim() && F.tujuan.trim() ? kunciF() : "", lama = k && k !== F.asal ? U.master.find((r) => r.id === k) : null;
  if (struktur) $("#ujm-komp", panelAktif).innerHTML = htmlKomp(); else { const b = $("#ujm-komp .ujm-b__l small", panelAktif); if (b) b.outerHTML = `<small>${h.liter ? `${fmt(desimal(F.jarak))} km ÷ ${e(F.rasio)} = ${(Math.round(h.liter * 10) / 10).toLocaleString("id-ID")} liter × ${rp(angkaRp(F.solar))}` : "Isi jarak, rasio, dan harga solar"}</small>`; const v = $("#ujm-komp .ujm-b__v b", panelAktif); if (v) v.textContent = rp(h.bbm); }
  $("#ujm-sum", panelAktif).innerHTML = htmlSum(); if (struktur) $("#ujm-man", panelAktif).innerHTML = htmlMan();
  tot.textContent = rp(h.total);
  ada.innerHTML = lama ? `<div class="ujm-peringatan">Sudah ada di master: <b>${e(lama.rute)} · ${e(lama.armadaNama)} · ${rp(lama.total)}</b>${lama.diperbaruiPada ? ` (diubah ${e(tgl(lama.diperbaruiPada))})` : ""}. Menyimpan memperbarui baris itu; angka lama masuk riwayat.</div>` : "";
  const sl = $("#ujm-slip", panelAktif); if (sl && !sl.hidden) sl.innerHTML = slipHtml(h);
}
function bukaForm(r) {
  if (!X.S.kelola) return;
  F = formDari(r);
  const edit = !!r;
  panelAktif = bukaLayer(`<header class="mr-panel__kepala"><div><h2>${edit ? "Ubah uang jalan" : "Tambah uang jalan"}</h2><p class="mr-sub">${edit ? "Mengubah rute atau armada membuat baris baru." : "Hitung lalu simpan ke master."}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi">${htmlIsi()}</div>
    <footer class="mr-panel__kaki ujm-kaki"><div class="ujm-tot"><small>Uang jalan</small><b id="ujm-tot">${rp(hitungF().total)}</b></div><button type="button" class="mr-btn" data-aksi="tutup-layer">Batal</button><button type="button" class="mr-btn mr-btn--utama" id="ujm-simpan" data-ujt="simpan">Simpan ke master</button></footer>`);
  panelAktif.addEventListener("input", (ev) => {
    const t = ev.target, d = t.dataset || {};
    if (d.uj) { F[d.uj] = t.value; segar(false); }
    else if (d.ujo) { F.opsi[d.ujo] = t.value; segar(false); }
    else if (d.ujl) { F.lain[+d.i][d.ujl] = t.value; segar(false); }
  });
  panelAktif.addEventListener("change", (ev) => { if (ev.target.dataset.uj === "armada") { F.armada = ev.target.value; F.rasio = String(rasioAwal(F.armada, U.peng)).replace(".", ","); const i = $('[data-uj="rasio"]', panelAktif); if (i) i.value = F.rasio; segar(false); } });
  panelAktif.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-ujt]"); if (!b) return; const t = b.dataset.ujt, v = b.dataset.v;
    if (t === "armada") { F.armada = v; F.rasio = String(rasioAwal(v, U.peng)).replace(".", ","); panelAktif.querySelectorAll(".ujm-ch").forEach((c) => c.classList.toggle("is-on", c.dataset.v === v)); const i = $('[data-uj="rasio"]', panelAktif); if (i) i.value = F.rasio; segar(false); }
    else if (t === "driver") { F.digaji = v === "1"; if (F.digaji) { F.aktif.insentif = false; F.opsi.insentif = ""; } panelAktif.querySelectorAll('[data-ujt="driver"]').forEach((c) => c.classList.toggle("is-aktif", (c.dataset.v === "1") === F.digaji)); segar(true); }
    else if (t === "sw") { F.aktif[v] = !F.aktif[v]; if (!F.aktif[v]) F.opsi[v] = ""; segar(true); }
    else if (t === "lain") { F.lain.push({ nama: "", v: "" }); segar(true); const n = panelAktif.querySelectorAll(".ujm-nama"); if (n.length) n[n.length - 1].focus(); }
    else if (t === "lain-hapus") { F.lain.splice(+b.dataset.i, 1); segar(true); }
    else if (t === "manual") { F.pakaiManual = !F.pakaiManual; if (!F.pakaiManual) F.manual = ""; segar(true); }
    else if (t === "slip") { const s = $("#ujm-slip", panelAktif); s.hidden = !s.hidden; if (!s.hidden) { s.innerHTML = slipHtml(hitungF()); s.scrollIntoView({ block: "nearest" }); } }
    else if (t === "riwayat") bukaRiwayat();
    else if (t === "hapus") hapus(r);
    else if (t === "simpan") simpan(b);
  });
  segar(false);
}
async function bukaRiwayat() {
  const w = $("#ujm-riw", panelAktif); if (!w.hidden) { w.hidden = true; return; }
  w.hidden = false; w.innerHTML = '<p class="mr-sub">Memuat riwayat…</p>';
  try {
    const d = await X.DB.muatRiwayatUJ(F.asal);
    w.innerHTML = `<div class="ujm-sec"><h5>Riwayat angka</h5>${d.length ? d.map((x) => `<div class="ujm-hist"><span>${e(tgl(x.tanggal))} · ${e(x.oleh || "")}</span><b>${x.lamaTotal === null || x.lamaTotal === undefined ? "dibuat" : rp(x.lamaTotal) + " →"} ${rp(x.baruTotal)}</b></div>`).join("") : '<p class="mr-sub">Belum ada riwayat.</p>'}</div>`;
  } catch (err) { w.innerHTML = `<p class="mr-galat">Riwayat gagal dimuat: ${e(err.message)}</p>`; }
}
const dataBaris = (h) => ({ pickup: F.pickup.trim(), tujuan: F.tujuan.trim(), rute: namaRute(F.pickup, F.tujuan), armada: F.armada, armadaNama: armadaDari(F.armada).nama, grup: armadaDari(F.armada).grup, digaji: F.digaji, jarak: desimal(F.jarak), rasio: desimal(F.rasio), solar: angkaRp(F.solar), tol: angkaRp(F.tol), mel: angkaRp(F.mel),
  opsi: Object.fromEntries(OPSIONAL.map((c) => [c.k, F.aktif[c.k] && !(c.k === "insentif" && F.digaji) ? angkaRp(F.opsi[c.k]) : 0])), lain: F.lain.filter((c) => c.nama.trim() && angkaRp(c.v) > 0).map((c) => ({ nama: c.nama.trim(), v: angkaRp(c.v) })), bulat: U.peng.bulat,
  manual: F.pakaiManual ? angkaRp(F.manual) : 0, bbm: h.bbm, subtotal: h.subtotal, pembulatan: h.pembulatan, total: h.total, sumber: h.manual ? "manual" : "hitung", catatan: F.catatan.trim() });
async function simpan(tombol) {
  const g = $("#ujm-galat", panelAktif), salah = (m) => { g.textContent = m; g.hidden = false; g.scrollIntoView({ block: "nearest" }); };
  g.hidden = true;
  if (!F.pickup.trim() || !F.tujuan.trim()) return salah("Isi pick up dan tujuan.");
  if (!(desimal(F.jarak) > 0) || !(desimal(F.rasio) > 0)) return salah("Isi jarak pulang-pergi dan rasio BBM supaya BBM terhitung.");
  if (F.pakaiManual && !(angkaRp(F.manual) > 0)) return salah("Isi angka manual, atau matikan saklar timpa.");
  if (F.lain.some((c) => angkaRp(c.v) > 0 && !c.nama.trim())) return salah("Beri nama komponen lain yang sudah ada nominalnya.");
  const h = hitungF(); if (!(h.total > 0)) return salah("Uang jalan masih Rp0. Isi komponen biayanya.");
  const k = kunciF(), lama = U.master.find((r) => r.id === k), data = dataBaris(h), label = tombol.textContent;
  tombol.disabled = true; tombol.textContent = "Menyimpan…";
  try {
    const t = await X.DB.simpanUJ(k, data, { baru: !lama, oleh: X.S.user.email }), row = { ...t, id: k };
    const i = U.master.findIndex((r) => r.id === k); if (i >= 0) U.master[i] = row; else U.master.push(row);
    X.DB.catatRiwayatUJ({ kunci: k, rute: data.rute, armadaNama: data.armadaNama, jenis: lama ? "diubah" : "dibuat", lamaTotal: lama ? lama.total : null, baruTotal: data.total, sumber: data.sumber }, { oleh: X.S.user.email }).catch(() => {});
    let catatan = "";
    try { await sinkronTarif([row]); } catch (err) { catatan = `<br><b>Belum tersinkron ke tab Tarif:</b> ${e(err.message)}`; }
    toast(`<b>Uang jalan tersimpan dan terverifikasi.</b> ${e(data.rute)} · ${e(data.armadaNama)} · ${rp(data.total)}${catatan}`, catatan ? "peringatan" : "ok");
    tutupLayer(); panelAktif = null; X.render();
  } catch (err) { salah("GAGAL menyimpan: " + (err.message || err)); toast(`<b>GAGAL menyimpan uang jalan.</b><br>${e(err.message)}`, "bahaya"); tombol.disabled = false; tombol.textContent = label; }
}
async function hapus(r) {
  if (!r || !await konfirmasi("Hapus uang jalan?", `<b>${e(r.rute)}</b> · ${e(r.armadaNama)} (${rp(r.total)}) dihapus dari master dan dari tab Tarif.`, "Hapus")) return;
  try {
    await X.DB.hapusDokumen("uj_master", r.id);
    X.DB.catatRiwayatUJ({ kunci: r.id, rute: r.rute, armadaNama: r.armadaNama, jenis: "dihapus", lamaTotal: r.total, baruTotal: 0 }, { oleh: X.S.user.email }).catch(() => {});
    U.master = U.master.filter((x) => x.id !== r.id);
    const kt = kunciTarif(r); if (X.S.tarif.some((t) => (t.kunci || t.id) === kt)) { const h = await X.DB.hapusBanyak([kt], { oleh: X.S.user.email }); if (!h.gagal.length) X.S.tarif = X.S.tarif.filter((t) => (t.kunci || t.id) !== kt); }
    toast("<b>Uang jalan dihapus.</b>", "ok"); tutupLayer(); panelAktif = null; X.render();
  } catch (err) { toast(`<b>GAGAL menghapus.</b><br>${e(err.message)}`, "bahaya"); }
}

// ---------- sinkron ke tab Tarif (lini Uang Jalan, vendor Internal; satu arah, angka dari master) ----------
async function pastikanRujukan() {
  const S = X.S, oleh = S.user.email;
  if (!S.lini.some((l) => l.id === "uang_jalan")) S.lini.push(await X.DB.simpanLini("uang_jalan", { nama: "Uang Jalan", kategori: "harga_tetap", aktif: true, kelompok: "Transportasi" }, { baru: true, oleh }));
  let v = S.vendor.find((x) => x.id === "internal");
  if (!v) { v = await X.DB.simpanVendor("internal", { nama: "Internal", namaLengkap: "Internal perusahaan", liniBisnis: ["uang_jalan"], terminBayar: "", kontak: "", aktif: true, catatan: "Tarif yang disediakan perusahaan sendiri (kendaraan, gudang, biaya internal)." }, { baru: true, oleh }); S.vendor.push(v); }
  else if (!(v.liniBisnis || []).includes("uang_jalan")) Object.assign(v, await X.DB.simpanVendor("internal", { liniBisnis: [...(v.liniBisnis || []), "uang_jalan"] }, { baru: false, oleh }));
}
const barisTarif = (r) => ({ liniBisnisId: "uang_jalan", vendorId: "internal", lokasiId: null, layanan: slug(r.rute), layananNama: r.rute, dimensi: { armada: r.armadaNama }, satuanKode: "per_trip", mataUang: "IDR", nilaiAsing: null, modal: r.total, hargaJualSaran: r.total,
  metodeHarga: "tetap", hargaJualReferensi: null, referensiSumber: null, customerId: null, berlakuDari: null, berlakuSampai: null, aktif: true, catatan: "Dikelola dari tab Uang Jalan; ubah angkanya di sana." });
async function sinkronTarif(rows) {
  await pastikanRujukan();
  const S = X.S, baru = [], ubah = [];
  rows.forEach((r) => {
    const kunci = kunciTarif(r), ada = S.tarif.find((t) => (t.kunci || t.id) === kunci);
    if (!ada) baru.push({ jenis: "baru", kunci, baris: barisTarif(r) });
    else if (ada.modal !== r.total) ubah.push({ jenis: "ubah", kunci, liniBisnisId: "uang_jalan", vendorId: "internal", perubahan: [{ field: "modal", lama: ada.modal ?? null, baru: r.total }, { field: "hargaJualSaran", lama: ada.hargaJualSaran ?? null, baru: r.total }] });
  });
  if (!baru.length && !ubah.length) return;
  const h = await X.DB.terapkanBanyak([...baru, ...ubah], { oleh: S.user.email, sumber: "uang_jalan" });
  if (h.gagal.length) throw new Error(h.gagal[0].alasan);
  baru.forEach((b) => S.tarif.push({ ...b.baris, kunci: b.kunci, id: b.kunci, diperbaruiPada: new Date().toISOString(), diperbaruiOleh: S.user.email }));
  ubah.forEach((u) => { const t = S.tarif.find((x) => (x.kunci || x.id) === u.kunci); if (t) u.perubahan.forEach((p) => (t[p.field] = p.baru)); });
}

// ---------- pengaturan: solar, pembulatan, rasio BBM per armada ----------
function bukaPeng() {
  if (!X.S.kelola) return;
  const p = bukaLayer(`<header class="mr-panel__kepala"><div><h2>Pengaturan uang jalan</h2><p class="mr-sub">Berlaku untuk uang jalan baru. Baris lama bisa dihitung ulang setelah disimpan.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi"><div class="ujm-sec"><div class="mr-form"><label class="mr-f"><span>Harga solar (Rp per liter)</span><div class="ujm-in ujm-in--rp"><em>Rp</em><input id="ujp-solar" data-ribuan-live inputmode="numeric" value="${e(ribu(U.peng.solar))}" autocomplete="off"></div></label>
    <label class="mr-f"><span>Pembulatan total</span><select id="ujp-bulat">${[[0, "Tanpa pembulatan"], [500, "Rp500 terdekat"], [1000, "Rp1.000 terdekat"], [5000, "Rp5.000 terdekat"]].map(([v, t]) => `<option value="${v}" ${U.peng.bulat === v ? "selected" : ""}>${t}</option>`).join("")}</select></label></div></div>
    <div class="ujm-sec"><h5>Rasio BBM (1 liter = … km)</h5><div class="mr-form">${ARMADA.map((a) => `<label class="mr-f"><span>${e(a.nama)}</span><div class="ujm-in"><input data-ujr="${a.k}" inputmode="decimal" value="${e(String(rasioAwal(a.k, U.peng)).replace(".", ","))}" autocomplete="off" aria-label="Rasio ${e(a.nama)}"><em>km/liter</em></div></label>`).join("")}</div></div><p class="mr-galat" id="ujp-galat" hidden></p></div>
    <footer class="mr-panel__kaki"><button type="button" class="mr-btn" data-aksi="tutup-layer">Batal</button><button type="button" class="mr-btn mr-btn--utama" id="ujp-simpan">Simpan pengaturan</button></footer>`);
  $("#ujp-simpan", p).onclick = async (ev) => {
    const g = $("#ujp-galat", p), solar = angkaRp($("#ujp-solar", p).value), bulat = angkaRp($("#ujp-bulat", p).value), rasio = {};
    p.querySelectorAll("[data-ujr]").forEach((i) => { rasio[i.dataset.ujr] = desimal(i.value); });
    if (!(solar > 0) || Object.values(rasio).some((v) => !(v > 0))) { g.textContent = "Harga solar dan semua rasio BBM harus lebih dari 0."; g.hidden = false; return; }
    ev.target.disabled = true; ev.target.textContent = "Menyimpan…";
    const lama = U.peng;
    try { await X.DB.simpanPengUJ({ solar, bulat, rasio }, { oleh: X.S.user.email }); U.peng = { solar, bulat, rasio }; }
    catch (err) { g.textContent = "GAGAL menyimpan: " + err.message; g.hidden = false; ev.target.disabled = false; ev.target.textContent = "Simpan pengaturan"; return; }
    tutupLayer(); X.render();
    const hitungUlang = U.master.filter((r) => !r.manual && (solar !== lama.solar || bulat !== lama.bulat));
    if (hitungUlang.length && await konfirmasi("Hitung ulang uang jalan?", `Solar atau pembulatan berubah. Hitung ulang <b>${hitungUlang.length}</b> baris (yang bukan angka manual) dengan pengaturan baru?`, "Hitung ulang")) await hitungUlangSemua(hitungUlang);
    else toast("<b>Pengaturan tersimpan.</b>", "ok");
  };
}
async function hitungUlangSemua(rows) {
  let n = 0, gagal = 0; const ubah = [];
  for (const r of rows) {
    const h = hitung({ ...r, solar: U.peng.solar, bulat: U.peng.bulat, opsi: r.opsi, manual: 0 }); if (h.total === r.total && r.solar === U.peng.solar) continue;
    try {
      const d = { solar: U.peng.solar, bulat: U.peng.bulat, bbm: h.bbm, subtotal: h.subtotal, pembulatan: h.pembulatan, total: h.total }, t = await X.DB.simpanUJ(r.id, d, { baru: false, oleh: X.S.user.email });
      X.DB.catatRiwayatUJ({ kunci: r.id, rute: r.rute, armadaNama: r.armadaNama, jenis: "hitung ulang", lamaTotal: r.total, baruTotal: h.total }, { oleh: X.S.user.email }).catch(() => {});
      const nr = { ...r, ...t, id: r.id }; U.master[U.master.findIndex((x) => x.id === r.id)] = nr; ubah.push(nr); n++;
    } catch (err) { gagal++; }
  }
  let pesan = ""; try { await sinkronTarif(ubah); } catch (err) { pesan = `<br><b>Belum tersinkron ke tab Tarif:</b> ${e(err.message)}`; }
  toast(`<b>${n} baris dihitung ulang.</b>${gagal ? ` ${gagal} gagal, coba lagi.` : ""}${pesan}`, gagal || pesan ? "peringatan" : "ok"); X.render();
}

// ---------- aksi dari master-rate.js ----------
export function aksiUJ(a, el) {
  if (a === "uj-tambah") bukaForm(null);
  else if (a === "uj-buka") bukaForm(U.master.find((r) => r.id === el.dataset.k) || null);
  else if (a === "uj-filter") { U.f.armada = el.dataset.v; X.render(); }
  else if (a === "uj-peng") bukaPeng();
  else if (a === "uj-muat") muatUJ(true);
}
