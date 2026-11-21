// Pengaturan > Akun dan akses > Peran: atur halaman apa yang boleh dibuka tiap peran (Tidak / Lihat / Kelola).
// Daftar halaman dibaca otomatis dari nav-config.js (halaman baru muncul sendiri). Peran siap pakai disimpan di sistem/peran_preset.
// Hanya master yang mengubah hak peran; perubahan diterapkan ke semua akun peran itu (kecuali halaman yang diubah khusus per akun).
import { e, $, toast, konfirmasi } from "./ui.js";
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { navItems } from "./nav-config.js";
import { MODUL, NAMA_LEVEL, PERAN, PRESET_BAWAAN, aksesPreset, batasModul, awalModul, KET_MODUL, catatLogAkun } from "./akses.js";

const K = { kustom: [], dikenal: null, pilih: "sales", draft: null, ctx: null };
export const pasangPeran = (ctx) => { K.ctx = ctx; };

/* Peran siap pakai = bawaan + buatan sendiri; entri buatan dengan id bawaan menimpa (hak yang diubah master). */
export function semuaPreset() {
  const peta = new Map(PRESET_BAWAAN.map((p) => [p.id, { ...p, bawaan: true, diubah: false }]));
  K.kustom.forEach((p) => peta.set(p.id, { ...p, bawaan: PRESET_BAWAAN.some((b) => b.id === p.id), diubah: PRESET_BAWAAN.some((b) => b.id === p.id) }));
  return [...peta.values()];
}
export const presetKustom = () => K.kustom;
const efektif = (p) => { const h = {}; MODUL.forEach(([m]) => { h[m] = Math.max(0, Math.min(typeof (p.akses || {})[m] === "number" ? p.akses[m] : 0, batasModul(p.peran, m))); }); return h; };
const DASAR = [["sales", "Sales", "Peran dasar: membuat quotation sendiri dan memakai data customer."], ["lihat", "Lihat saja", "Peran dasar: hanya membaca data."], ["admin", "Admin", "Peran dasar: mengelola data dan akun sales."]];
export function daftarPeran() {
  const dasar = DASAR.map(([id, nama, ket]) => ({ id, nama, peran: id, tipe: "dasar", ket, akses: Object.fromEntries(MODUL.map(([m]) => [m, awalModul(id, m)])) }));
  const pre = semuaPreset().map((p) => ({ id: "p:" + p.id, kunci: p.id, nama: p.nama, peran: p.peran, tipe: p.bawaan ? "bawaan" : "kustom", diubah: p.diubah, ket: p.ket || `Berdasar ${PERAN[p.peran]}`, akses: efektif(p) }));
  return [...dasar, ...pre];
}
/** Hak bawaan peran sebuah akun (dasar, atau preset menurut akses.jabatan); dipakai panel akses per akun. */
export function aksesPeranAkun(a) {
  const j = a.akses && a.akses.jabatan, p = j && semuaPreset().find((x) => x.nama === j && x.peran === a.peran);
  return p ? efektif(p) : Object.fromEntries(MODUL.map(([m]) => [m, awalModul(a.peran, m)]));
}
const ringkas = (h) => MODUL.map(([m, n]) => `${n}: ${NAMA_LEVEL[h[m] ?? 0]}`).join(", ");

export async function muatPeran() {
  try {
    const d = await getDoc(doc(db, "sistem", "peran_preset")), x = d.exists() ? d.data() : {};
    K.kustom = Array.isArray(x.daftar) ? x.daftar : []; K.dikenal = Array.isArray(x.modulDikenal) ? x.modulDikenal : null;
    if (K.dikenal === null && K.ctx && K.ctx.master()) { K.dikenal = MODUL.map(([m]) => m); await setDoc(doc(db, "sistem", "peran_preset"), { modulDikenal: K.dikenal }, { merge: true }); } // acuan awal: halaman yang ada sekarang bukan "baru"
  } catch (_) { K.kustom = []; }
  return K.kustom;
}
const tulis = (data) => setDoc(doc(db, "sistem", "peran_preset"), { ...data, diperbarui: new Date().toISOString() }, { merge: true });

const jumlah = (r) => K.ctx.akun().filter((a) => a.status !== "menunggu" && (r.tipe === "dasar" ? a.peran === r.peran && !(a.akses && a.akses.jabatan) : a.akses && a.akses.jabatan === r.nama && a.peran === r.peran)).length;
const nilaiDraft = (r, m) => (K.draft && K.draft.id === r.id ? K.draft.akses : r.akses)[m] ?? 0;
const kotor = (r) => !!K.draft && K.draft.id === r.id && MODUL.some(([m]) => (K.draft.akses[m] ?? 0) !== (r.akses[m] ?? 0));
const bisaUbah = (r) => K.ctx.master() && r.tipe !== "dasar";

function baris(r, item, ubah) {
  if (!item.modul) return `<div class="pr-baris pr-redup"><div class="pr-baris__t"><b>${e(item.label)}</b><small>Selalu ada; isinya menyesuaikan peran</small></div><span class="st-badge">Otomatis</span></div>`;
  const m = item.modul, t = batasModul(r.peran, m);
  if (t <= 0) return `<div class="pr-baris pr-redup"><div class="pr-baris__t"><b>${e(item.label)}</b><small>Tidak tersedia untuk peran dasar ${e(PERAN[r.peran])}</small></div><span class="st-badge">—</span></div>`;
  const v = nilaiDraft(r, m);
  return `<div class="pr-baris"><div class="pr-baris__t"><b>${e(item.label)}</b><small>${e(item.ket || KET_MODUL[m] || "")}</small></div><div class="pr-sg" role="group" aria-label="Akses ${e(item.label)}">${[0, 1, 2].map((l) => `<button type="button" data-pr="lv" data-m="${m}" data-v="${l}" class="pr-lv pr-lv--${l}${v === l ? " is-on" : ""}"${!ubah || l > t ? " disabled" : ""}>${NAMA_LEVEL[l]}</button>`).join("")}</div></div>`;
}
function bannerBaru() {
  const baru = K.dikenal ? MODUL.filter(([m]) => !K.dikenal.includes(m)) : [];
  if (!baru.length) return "";
  return `<div class="pr-baru"><span aria-hidden="true">✦</span><div><b>Halaman baru terdeteksi: ${baru.map(([, n]) => e(n)).join(", ")}</b><div class="mr-sub">Awalnya hanya master dan admin. Aktifkan untuk peran lain di editor di bawah.</div></div>${K.ctx.master() ? `<button type="button" class="mr-btn mr-btn--kecil" data-pr="tinjau">Sudah ditinjau</button>` : ""}</div>`;
}
export function htmlPeran(hp) {
  const L = daftarPeran(), r = L.find((x) => x.id === K.pilih) || L[0], ubah = bisaUbah(r), n = jumlah(r), kt = kotor(r);
  const daftar = hp
    ? `<div class="ak-chip pr-chip" role="tablist">${L.map((x) => `<button type="button" role="tab" data-pr="pilih" data-id="${e(x.id)}" class="${x.id === r.id ? "is-aktif" : ""}">${e(x.nama)}</button>`).join("")}${K.ctx.master() ? `<button type="button" data-pr="baru" aria-label="Peran baru">＋</button>` : ""}</div>`
    : `<aside class="pr-daftar" aria-label="Peran"><div class="pr-daftar__k"><span>PERAN</span>${K.ctx.master() ? `<button type="button" class="mr-btn mr-btn--kecil" data-pr="baru">＋ Baru</button>` : ""}</div>${L.map((x) => `<button type="button" data-pr="pilih" data-id="${e(x.id)}" class="${x.id === r.id ? "is-aktif" : ""}"><span><b>${e(x.nama)}</b><small>${x.tipe === "dasar" ? "bawaan sistem" : x.tipe === "bawaan" ? (x.diubah ? "siap pakai · diubah" : "siap pakai") : "buatan sendiri"}</small></span><i>${jumlah(x)} akun</i></button>`).join("")}</aside>`;
  const aksi = `${K.ctx.master() ? `<button type="button" class="mr-btn mr-btn--kecil" data-pr="dup">Duplikat</button>` : ""}<button type="button" class="mr-btn mr-btn--kecil" data-pr="menu">Pratinjau menu</button>${r.tipe === "kustom" && K.ctx.master() ? `<button type="button" class="mr-btn mr-btn--kecil mr-btn--bahaya" data-pr="hapus">Hapus</button>` : ""}${r.diubah && K.ctx.master() ? `<button type="button" class="mr-btn mr-btn--kecil" data-pr="reset">Kembalikan ke bawaan</button>` : ""}`;
  const catatan = r.tipe === "dasar" ? `<p class="mr-sub pr-cat">Peran dasar menentukan batas tertinggi dan tidak diubah. Untuk hak yang lebih sempit atau berbeda, <b>duplikat</b> menjadi peran baru.</p>` : !K.ctx.master() ? `<p class="mr-sub pr-cat">Hanya pemilik yang mengubah hak peran.</p>` : "";
  const bar = ubah ? `<div class="pr-bar"><span class="mr-sub">${kt ? "Ada perubahan belum disimpan" : "Belum ada perubahan"}${kt && n ? ` · berlaku ke ${n} akun` : ""}</span><span class="mr-ruang"></span><button type="button" class="mr-btn" data-pr="batal"${kt ? "" : " disabled"}>Batal</button><button type="button" class="mr-btn mr-btn--utama" data-pr="simpan"${kt ? "" : " disabled"}>Simpan</button></div>` : "";
  return `<div class="pr">${bannerBaru()}<div class="pr-dua">${daftar}<section class="pr-editor"><div class="pr-judul"><div><h3>${e(r.nama)}</h3><div class="mr-sub">${e(r.ket)} · ${n} akun</div></div><div class="pr-aksi">${aksi}</div></div>${catatan}<div class="pr-daftar-hal">${navItems.map((i) => baris(r, i, ubah)).join("")}</div>${bar}</section></div></div>`;
}

/* ----- dialog nama (peran baru / duplikat) dan pratinjau menu ----- */
function dialogNama({ judul, nama = "", peran = null, aksiNama, selesai }) {
  const l = document.createElement("div"); l.className = "mr-konfirm"; l.id = "pr-dialog";
  l.innerHTML = `<div class="mr-konfirm__kotak"><h3>${e(judul)}</h3><div class="mr-konfirm__isi"><label class="ak-lbl">Nama peran</label><input id="pr-nama" maxlength="30" value="${e(nama)}" autocomplete="off" style="width:100%;box-sizing:border-box">
    ${peran ? `<label class="ak-lbl">Peran dasar (batas tertinggi)</label><select id="pr-dasar" style="width:100%;box-sizing:border-box"><option value="sales">Sales</option><option value="lihat">Lihat saja</option></select>` : ""}</div>
    <div class="mr-konfirm__aksi"><button class="mr-btn" data-x="batal">Batal</button><button class="mr-btn mr-btn--utama" data-x="ok">${e(aksiNama)}</button></div></div>`;
  document.body.appendChild(l);
  l.querySelector('[data-x="batal"]').onclick = () => l.remove();
  l.querySelector('[data-x="ok"]').onclick = async () => { const n = $("#pr-nama").value.trim(), d = peran ? $("#pr-dasar").value : null; if (await selesai(n, d)) l.remove(); };
}
function pratinjau(r) {
  const l = document.createElement("div"); l.className = "mr-konfirm"; l.id = "pr-dialog";
  const baris2 = navItems.map((i) => { const v = i.modul ? Math.min(nilaiDraft(r, i.modul), batasModul(r.peran, i.modul)) : 2, t = !i.modul ? "Selalu" : NAMA_LEVEL[v]; return `<div class="pr-menu ${v === 0 ? "pr-menu--off" : ""}"><span>${e(i.label)}</span><span class="pr-menu__s pr-menu__s--${v}">${v === 0 ? "Tidak tampil" : t}</span></div>`; }).join("");
  l.innerHTML = `<div class="mr-konfirm__kotak"><h3>Menu untuk ${e(r.nama)}</h3><div class="mr-konfirm__isi">${baris2}<p class="mr-sub" style="margin:10px 0 0">Menu yang tampil setelah akun masuk ulang.</p></div><div class="mr-konfirm__aksi"><button class="mr-btn mr-btn--utama" data-x="tutup">Tutup</button></div></div>`;
  document.body.appendChild(l); l.querySelector('[data-x="tutup"]').onclick = () => l.remove();
}

/* ----- simpan dan sebarkan ke akun ----- */
async function sebarkan(p) { // p: { nama, peran, akses } -> semua akun yang memakai peran ini; halaman yang diubah khusus per akun dipertahankan
  let n = 0;
  for (const a of K.ctx.akun().filter((x) => x.akses && x.akses.jabatan === p.nama && x.peran === p.peran)) {
    const baru = aksesPreset(p), khusus = (a.akses.khusus || []).filter((k) => MODUL.some(([m]) => m === k));
    khusus.forEach((k) => { if (typeof a.akses[k] === "number") baru[k] = Math.min(a.akses[k], batasModul(a.peran, k)); });
    if (khusus.length) baru.khusus = khusus;
    if (JSON.stringify(baru) === JSON.stringify(a.akses)) continue;
    await updateDoc(doc(db, "pengguna", a.id), { akses: baru });
    await catatLogAkun({ uid: a.id, email: a.email }, "ubah", { akses: ringkas(a.akses) }, { akses: ringkas(baru) }); a.akses = baru; n++;
  }
  return n;
}
async function simpanDaftar(kustom, p) { await tulis({ daftar: kustom }); K.kustom = kustom; return p ? sebarkan(p) : 0; }
const unik = (nama, selainId) => !(DASAR.some(([, n]) => n.toLowerCase() === nama.toLowerCase()) || ["master", "anggota daily job"].includes(nama.toLowerCase()) || semuaPreset().some((p) => p.id !== selainId && p.nama.toLowerCase() === nama.toLowerCase()));

document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-pr]"); if (!t || !K.ctx || window.__rute !== "pengaturan") return;
  const a = t.dataset.pr, L = daftarPeran(), r = L.find((x) => x.id === K.pilih) || L[0], re = () => K.ctx.render();
  try {
    if (a === "pilih") { K.pilih = t.dataset.id; K.draft = null; return re(); }
    if (a === "lv") { if (!K.draft || K.draft.id !== r.id) K.draft = { id: r.id, akses: { ...r.akses } }; K.draft.akses[t.dataset.m] = +t.dataset.v; return re(); }
    if (a === "batal") { K.draft = null; return re(); }
    if (a === "menu") return pratinjau(r);
    if (a === "tinjau") { K.dikenal = MODUL.map(([m]) => m); await tulis({ modulDikenal: K.dikenal }); toast("Halaman baru ditandai sudah ditinjau."); return re(); }
    if (!K.ctx.master()) return;
    if (a === "simpan") {
      const p = semuaPreset().find((x) => "p:" + x.id === r.id); if (!p || !K.draft) return;
      const akses = {}; MODUL.forEach(([m]) => { if (batasModul(p.peran, m) > 0) akses[m] = Math.min(K.draft.akses[m] ?? 0, batasModul(p.peran, m)); });
      const baru = { id: p.id, nama: p.nama, peran: p.peran, ket: p.ket || `Berdasar ${PERAN[p.peran]}`, akses };
      const n = await simpanDaftar(K.kustom.some((x) => x.id === p.id) ? K.kustom.map((x) => (x.id === p.id ? baru : x)) : [...K.kustom, baru], baru);
      K.draft = null; toast(`Hak <b>${e(p.nama)}</b> disimpan${n ? ` dan diterapkan ke ${n} akun` : ""}. Akun perlu masuk ulang agar menu berubah.`); return re();
    }
    if (a === "baru" || a === "dup") {
      return dialogNama({ judul: a === "dup" ? `Duplikat ${r.nama}` : "Peran baru", nama: a === "dup" ? `${r.nama} 2` : "", peran: a === "baru" ? "pilih" : null, aksiNama: a === "dup" ? "Duplikat" : "Buat peran", selesai: async (nama, dasar) => {
        if (nama.length < 2) { toast("Isi nama peran (minimal 2 huruf).", "bahaya"); return false; }
        if (!unik(nama)) { toast("Nama peran ini sudah dipakai.", "bahaya"); return false; }
        const peran = a === "dup" ? (r.peran === "admin" ? "sales" : r.peran) : dasar, id = "u" + Date.now().toString(36), akses = a === "dup" ? { ...r.akses } : {};
        MODUL.forEach(([m]) => { if (batasModul(peran, m) <= 0) delete akses[m]; else akses[m] = Math.min(akses[m] ?? 0, batasModul(peran, m)); });
        await simpanDaftar([...K.kustom, { id, nama, peran, ket: `Berdasar ${PERAN[peran]}`, akses }]); K.pilih = "p:" + id; K.draft = null; toast(`Peran <b>${e(nama)}</b> dibuat. Atur halamannya lalu simpan.`); re(); return true;
      } });
    }
    if (a === "hapus") {
      if (r.tipe !== "kustom") return; const n = jumlah(r);
      if (n) return toast(`<b>${e(r.nama)}</b> masih dipakai ${n} akun. Pindahkan akun ke peran lain dulu.`, "bahaya");
      if (!(await konfirmasi("Hapus peran?", `Peran <b>${e(r.nama)}</b> dihapus dari daftar pilihan.`, "Hapus"))) return;
      await simpanDaftar(K.kustom.filter((x) => "p:" + x.id !== r.id)); K.pilih = "sales"; K.draft = null; toast("Peran dihapus."); return re();
    }
    if (a === "reset") {
      const b = PRESET_BAWAAN.find((x) => "p:" + x.id === r.id); if (!b) return;
      if (!(await konfirmasi("Kembalikan ke bawaan?", `Hak <b>${e(r.nama)}</b> kembali seperti semula dan diterapkan ke akun yang memakainya.`, "Kembalikan"))) return;
      const n = await simpanDaftar(K.kustom.filter((x) => x.id !== b.id), b); K.draft = null; toast(`Hak dikembalikan${n ? ` dan diterapkan ke ${n} akun` : ""}.`); return re();
    }
  } catch (er) { toast(`<b>Gagal.</b> ${e(er.code || er.message)}`, "bahaya"); }
});
