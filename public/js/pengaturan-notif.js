// Pengaturan > Notifikasi (master dan admin): template email, waktu kirim, riwayat per kelompok. Aturan: firestore.rules (notif_pengaturan, dj_email).
// HP: kartu per kejadian (buka-tutup). Desktop: daftar kejadian di kiri, editor dengan pratinjau di kanan.
import { e, $, toast } from "./ui.js";
import { app, db } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc, updateDoc, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { KEJADIAN, VARIABEL, CONTOH, BAWAAN, render, rapikanSubjek, efektif, ringkasKirim, KIRIM_BAWAAN } from "./notif-isi.js";

const N = { root: null, siap: false, kel: [], dok: {}, riw: [], kelId: "", buka: "", bhs: "id", draf: null, fokus: "nt-isi", galat: "" };
const hp = () => matchMedia("(max-width: 760px)").matches;
const klon = (x) => JSON.parse(JSON.stringify(x));
const kelAktif = () => N.kel.find((k) => k.id === N.kelId) || null;
const daftarKejadian = () => { const k = kelAktif(); return (k && KEJADIAN[k.profil || "marketing"]) || []; };
const WAKTU = (t) => { const d = t ? new Date(t) : null; return d && !isNaN(d) ? d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–"; };
const STATUS = { antre: ["Menunggu", "warn"], mengirim: ["Mengirim", "warn"], terkirim: ["Terkirim", "ok"], gagal: ["Gagal", "bahaya"], "tanpa-email": ["Tanpa email", "warn"], dimatikan: ["Dimatikan", "warn"], batal: ["Dibatalkan", ""] };

async function muat() {
  try {
    const [k, p, r] = await Promise.all([getDocs(collection(db, "dj_kelompok")), getDocs(collection(db, "notif_pengaturan")), getDocs(query(collection(db, "dj_email"), orderBy("dibuat", "desc"), limit(60))).catch(() => ({ docs: [] }))]);
    N.kel = k.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => !x.arsip).sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    N.dok = Object.fromEntries(p.docs.map((d) => [d.id, d.data()])); N.riw = r.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!kelAktif()) N.kelId = (N.kel.find((x) => x.profil === "tracking") || N.kel[0] || {}).id || "";
    N.galat = "";
  } catch (er) { N.galat = er.message || String(er); }
  N.siap = true;
}
const bukaKejadian = (id) => { N.buka = id; const k = kelAktif(); N.draf = id && id !== "riwayat" && k ? klon(efektif(N.dok[k.id], id)) : null; };

const sw = (t, on) => `<button type="button" class="nt-sw${on ? " is-on" : ""}" role="switch" aria-checked="${on}" aria-label="Aktifkan" data-nt="aktif" data-t="${t}"><i></i></button>`;
const chip = (aksi, v, label, on) => `<button type="button" class="mr-chip${on ? " is-aktif" : ""}" data-nt="${aksi}" data-v="${v}">${label}</button>`;

/* ---------- editor satu kejadian ---------- */
function htmlEditor(kj) {
  const d = N.draf, t = d.tpl[N.bhs], k = d.kirim;
  const waktu = k.mode === "tunda" ? `<label class="mr-f nt-kecil"><span>Tunda (menit)</span><input id="nt-menit" type="number" min="1" max="1440" value="${e(k.menit)}" inputmode="numeric"></label><small class="mr-sub">Email ditahan, jadi salah klik masih bisa dibatalkan di Riwayat. Pengirim memeriksa tiap 5 menit.</small>`
    : k.mode === "jam" ? `<div class="nt-jam-daftar">${(k.jam || []).map((j, i) => `<span class="nt-jam"><input type="time" class="nt-jamin" data-i="${i}" value="${e(j)}" aria-label="Jam kirim"><button type="button" class="mr-ikonbtn" data-nt="jam-hapus" data-v="${i}" aria-label="Hapus jam">×</button></span>`).join("")}<button type="button" class="mr-btn mr-btn--kecil" data-nt="jam-tambah">+ Jam</button></div><label class="nt-cek"><input type="checkbox" id="nt-kerja"${k.hariKerja !== false ? " checked" : ""}> Hanya hari kerja (Senin–Jumat)</label><small class="mr-sub">Waktu WIB. Email yang terjadi di luar jam itu dikumpulkan dan dikirim pada jam berikutnya.</small>`
    : `<small class="mr-sub">Terkirim begitu kejadian terjadi (dalam hitungan detik).</small>`;
  return `<div class="nt-editor" data-t="${kj.id}">
    <div class="nt-eh"><div><h3>${e(kj.nama)}</h3><small class="mr-sub">${e(kj.ket)}</small></div><span class="nt-sp"></span>${sw(kj.id, d.aktif)}</div>
    <div class="nt-bagian"><b>Template</b><div class="nt-seg">${chip("bhs", "id", "Indonesia", N.bhs === "id")}${chip("bhs", "en", "English", N.bhs === "en")}</div><small class="mr-sub">Bahasa mengikuti pengaturan bahasa tiap customer.</small></div>
    <label class="mr-f"><span>Subjek</span><input id="nt-subjek" value="${e(t.subjek)}" autocomplete="off"></label>
    <label class="mr-f"><span>Isi</span><textarea id="nt-isi" rows="9">${e(t.isi)}</textarea></label>
    <div class="nt-var"><small class="mr-sub">Sisipkan:</small>${VARIABEL.map(([v, l]) => `<button type="button" class="mr-chip" data-nt="var" data-v="${v}" title="${e(l)}">{${v}}</button>`).join("")}<button type="button" class="mr-link" data-nt="bawaan">Kembalikan ke bawaan</button></div>
    <div class="nt-bagian"><b>Waktu kirim</b><div class="nt-seg">${chip("mode", "langsung", "Langsung", k.mode === "langsung")}${chip("mode", "tunda", "Tunda", k.mode === "tunda")}${chip("mode", "jam", "Jam tertentu", k.mode === "jam")}</div>${waktu}</div>
    <div class="nt-bagian"><b>Penerima</b><small class="mr-sub">Kontak utama customer (atau kontak lain yang beralamat email). Customer tertentu bisa dimatikan di data Customer.</small></div>
    <div class="nt-bagian"><b>Pratinjau</b><div class="nt-pv" id="nt-pv">${htmlPratinjau()}</div></div>
    <div class="nt-aksi"><button type="button" class="mr-btn" data-nt="uji">Kirim uji ke saya</button><span class="nt-sp"></span><button type="button" class="mr-btn mr-btn--utama" data-nt="simpan">Simpan</button></div></div>`;
}
function htmlPratinjau() {
  const t = N.draf.tpl[N.bhs], sub = rapikanSubjek(render(t.subjek, CONTOH, false));
  return `<div class="nt-pv__s">${e(sub)}</div><div class="nt-pv__i">${e(render(t.isi, CONTOH)).replace(/\n/g, "<br>")}</div>`;
}

/* ---------- riwayat ---------- */
function htmlRiwayat() {
  const k = kelAktif(), now = Date.now(), baris = N.riw.filter((x) => x.kelompokId === (k && k.id)).slice(0, 40);
  if (!baris.length) return `<p class="mr-sub">Belum ada email untuk kelompok ini. Muncul setelah ada job Tracking baru atau selesai.</p>`;
  return `<div class="nt-riw">${baris.map((x) => { const [lab, kls] = STATUS[x.status] || [x.status, ""], jadwal = x.status === "antre" && x.kirimPada > now ? ` · kirim ${WAKTU(x.kirimPada)}` : "";
    return `<div class="nt-rw"><div class="nt-rw__t"><b>${e(x.customer || "–")}</b><small class="mr-sub">${e(x.subjek || "")}</small><small class="mr-sub">${e(x.ke || "tanpa alamat")} · ${WAKTU(x.dibuat)}${jadwal}</small></div><span class="st-badge${kls ? " st-badge--" + kls : ""}">${lab}</span>${x.status === "antre" ? `<button type="button" class="mr-btn mr-btn--kecil" data-nt="batal" data-v="${e(x.id)}">Batalkan</button>` : x.status === "gagal" ? `<button type="button" class="mr-btn mr-btn--kecil" data-nt="ulang" data-v="${e(x.id)}">Kirim ulang</button>` : ""}</div>`; }).join("")}</div>`;
}

/* ---------- tata letak ---------- */
function gambar() {
  const r = N.root; if (!r) return;
  if (!N.siap) { r.innerHTML = `<p class="mr-sub">Memuat pengaturan notifikasi…</p>`; return; }
  if (N.galat) { r.innerHTML = `<div class="mr-banner mr-banner--peringatan" role="alert"><div>Tidak bisa memuat pengaturan notifikasi: ${e(N.galat)}</div></div>`; return; }
  const k = kelAktif(), kj = daftarKejadian(), mobile = hp();
  const chips = `<div class="nt-kel">${N.kel.map((x) => chip("kel", e(x.id), e(x.nama), x.id === N.kelId)).join("")}</div>`;
  const kepala = `<div class="ak-kepala"><div><h3>Notifikasi</h3><p>Email otomatis ke customer: isi, waktu kirim, dan riwayat. Pengaturan berlaku per kelompok.</p></div></div>${chips}`;
  if (!k) { r.innerHTML = kepala + `<p class="mr-sub">Belum ada kelompok Daily Job.</p>`; return; }
  if (!kj.length) { r.innerHTML = kepala + `<div class="nt-kosong"><b>Belum ada notifikasi email untuk kelompok ${e(k.nama)}.</b><p class="mr-sub">Saat ini notifikasi email tersedia untuk kelompok Tracking. Kejadian untuk kelompok lain akan muncul di sini setelah ditambahkan.</p></div>`; return; }
  if (!mobile && !N.buka) bukaKejadian(kj[0].id);
  const eff = (id) => efektif(N.dok[k.id], id);
  if (mobile) {
    r.innerHTML = kepala + kj.map((x) => { const f = eff(x.id), buka = N.buka === x.id;
      return `<div class="nt-kartu${buka ? " is-buka" : ""}"><div class="nt-kh" data-nt="buka" data-v="${x.id}" role="button" tabindex="0" aria-expanded="${buka}"><div><b>${e(x.nama)}</b><small class="mr-sub">${e(x.ket)} · ${e(f.aktif ? ringkasKirim(f.kirim) : "Mati")}</small></div><span class="nt-sp"></span>${sw(x.id, f.aktif)}</div>${buka && N.draf ? htmlEditor(x) : ""}</div>`; }).join("")
      + `<div class="nt-kartu${N.buka === "riwayat" ? " is-buka" : ""}"><div class="nt-kh" data-nt="buka" data-v="riwayat" role="button" tabindex="0" aria-expanded="${N.buka === "riwayat"}"><div><b>Riwayat terkirim</b><small class="mr-sub">Status, batalkan, kirim ulang</small></div></div>${N.buka === "riwayat" ? htmlRiwayat() : ""}</div>`;
  } else {
    const item = (x) => { const f = eff(x.id); return `<div class="nt-item${N.buka === x.id ? " is-on" : ""}" data-nt="buka" data-v="${x.id}" role="button" tabindex="0"><div><b>${e(x.nama)}</b><small class="mr-sub">${e(f.aktif ? ringkasKirim(f.kirim) : "Mati")}</small></div><span class="nt-sp"></span>${sw(x.id, f.aktif)}</div>`; };
    const kanan = N.buka === "riwayat" ? `<div class="nt-eh"><div><h3>Riwayat terkirim</h3></div></div>${htmlRiwayat()}` : N.draf ? htmlEditor(kj.find((x) => x.id === N.buka) || kj[0]) : "";
    r.innerHTML = kepala + `<div class="nt-dua"><div class="nt-list">${kj.map(item).join("")}<div class="nt-item${N.buka === "riwayat" ? " is-on" : ""}" data-nt="buka" data-v="riwayat" role="button" tabindex="0"><div><b>Riwayat terkirim</b><small class="mr-sub">${N.riw.filter((x) => x.kelompokId === k.id).length} terakhir</small></div></div></div><div class="nt-isi">${kanan}</div></div>`;
  }
}

/* ---------- aksi ---------- */
const simpanDok = (kelId, kejadian) => setDoc(doc(db, "notif_pengaturan", kelId), { kejadian, diubah: serverTimestamp() }, { merge: true });
const rekam = (kelId, tahap, bagian) => { const d = N.dok[kelId] || (N.dok[kelId] = {}); d.kejadian = d.kejadian || {}; d.kejadian[tahap] = { ...(d.kejadian[tahap] || {}), ...bagian }; };
function bacaForm() {
  const d = N.draf; if (!d) return;
  const s = $("#nt-subjek"), i = $("#nt-isi"); if (s) d.tpl[N.bhs].subjek = s.value; if (i) d.tpl[N.bhs].isi = i.value;
  const m = $("#nt-menit"); if (m) d.kirim.menit = Math.round(+m.value) || 0;
  const kj = $("#nt-kerja"); if (kj) d.kirim.hariKerja = kj.checked;
  N.root.querySelectorAll(".nt-jamin").forEach((x) => { d.kirim.jam[+x.dataset.i] = x.value; });
}
const sahKirim = (k) => (k.mode === "tunda" && !(k.menit >= 1 && k.menit <= 1440) ? "Menit tunda 1 sampai 1440." : k.mode === "jam" && !(k.jam || []).filter((j) => /^\d\d:\d\d$/.test(j)).length ? "Isi minimal satu jam kirim." : "");

async function aksi(a, v, el) {
  const k = kelAktif(), t = N.buka;
  try {
    if (a === "kel") { N.kelId = v; N.buka = ""; N.draf = null; return gambar(); }
    if (a === "buka") { if (N.buka === v && hp()) { N.buka = ""; N.draf = null; } else bukaKejadian(v); return gambar(); }
    if (a === "aktif") { const f = efektif(N.dok[k.id], v), baru = !f.aktif; await simpanDok(k.id, { [v]: { aktif: baru } }); rekam(k.id, v, { aktif: baru }); if (N.draf && N.buka === v) N.draf.aktif = baru; toast(baru ? "Notifikasi diaktifkan." : "Notifikasi dimatikan."); return gambar(); }
    if (!N.draf && !["batal", "ulang"].includes(a)) return;
    if (a === "bhs") { bacaForm(); N.bhs = v; return gambar(); }
    if (a === "mode") { bacaForm(); N.draf.kirim.mode = v; if (v === "jam" && !(N.draf.kirim.jam || []).length) N.draf.kirim.jam = ["09:00"]; return gambar(); }
    if (a === "jam-tambah") { bacaForm(); N.draf.kirim.jam.push("16:00"); return gambar(); }
    if (a === "jam-hapus") { bacaForm(); N.draf.kirim.jam.splice(+v, 1); return gambar(); }
    if (a === "var") { const f = $("#" + N.fokus) || $("#nt-isi"), p = f.selectionStart ?? f.value.length, x = "{" + v + "}"; f.value = f.value.slice(0, p) + x + f.value.slice((f.selectionEnd ?? p)); f.focus(); f.setSelectionRange(p + x.length, p + x.length); bacaForm(); $("#nt-pv").innerHTML = htmlPratinjau(); return; }
    if (a === "bawaan") { N.draf.tpl[N.bhs] = klon(BAWAAN[t][N.bhs]); return gambar(); }
    if (a === "simpan") {
      bacaForm(); const er = sahKirim(N.draf.kirim); if (er) return toast(er, "bahaya");
      const isi = { aktif: N.draf.aktif, kirim: N.draf.kirim, tpl: N.draf.tpl };
      el.disabled = true; await simpanDok(k.id, { [t]: isi }); rekam(k.id, t, isi); el.disabled = false; toast("Pengaturan notifikasi disimpan."); return gambar();
    }
    if (a === "uji") {
      bacaForm(); el.disabled = true;
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js");
      const r = await httpsCallable(getFunctions(app, "asia-southeast2"), "kirimUjiNotif")({ subjek: N.draf.tpl[N.bhs].subjek, isi: N.draf.tpl[N.bhs].isi });
      el.disabled = false; return toast(`Email uji dikirim ke ${r.data.ke}.`);
    }
    if (a === "batal") { await updateDoc(doc(db, "dj_email", v), { status: "batal" }); const x = N.riw.find((z) => z.id === v); if (x) x.status = "batal"; toast("Email dibatalkan."); return gambar(); }
    if (a === "ulang") { const kirimPada = Date.now(); await updateDoc(doc(db, "dj_email", v), { status: "antre", kirimPada }); const x = N.riw.find((z) => z.id === v); if (x) Object.assign(x, { status: "antre", kirimPada }); toast("Dikirim ulang dalam 5 menit."); return gambar(); }
  } catch (er) { if (el) el.disabled = false; toast("Belum berhasil: " + (er.message || er), "bahaya"); }
}

let terpasang = false;
function pasang() {
  if (terpasang) return; terpasang = true;
  document.addEventListener("click", (ev) => {
    if (!N.root || !N.root.isConnected) return;
    const t = ev.target.closest("[data-nt]"); if (!t || !N.root.contains(t)) return;
    ev.preventDefault(); aksi(t.dataset.nt, t.dataset.v ?? t.dataset.t, t);
  });
  document.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches(".nt-kh, .nt-item") && N.root && N.root.contains(ev.target)) { ev.preventDefault(); ev.target.click(); } });
  document.addEventListener("input", (ev) => {
    if (!N.root || !N.root.isConnected || !N.draf || !ev.target.closest || !ev.target.closest(".nt-editor")) return;
    if (ev.target.id === "nt-subjek" || ev.target.id === "nt-isi") { N.fokus = ev.target.id; bacaForm(); const p = $("#nt-pv"); if (p) p.innerHTML = htmlPratinjau(); }
  });
  document.addEventListener("focusin", (ev) => { if (ev.target.id === "nt-subjek" || ev.target.id === "nt-isi") N.fokus = ev.target.id; });
  matchMedia("(max-width: 760px)").addEventListener("change", () => { if (N.root && N.root.isConnected) { N.buka = ""; N.draf = null; gambar(); } });
}

export async function isiNotifikasi(root) { N.root = root; pasang(); gambar(); if (!N.siap) { await muat(); gambar(); } }
