// Pengaturan > Notifikasi (master dan admin): template email, waktu kirim, riwayat per kelompok. Aturan: firestore.rules (notif_pengaturan, dj_email).
// HP: kartu per kejadian (buka-tutup). Desktop: daftar kejadian di kiri, editor dengan pratinjau di kanan.
import { e, $, toast, konfirmasi } from "./ui.js";
import { app, db } from "./firebase-config.js";
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, query, orderBy, limit, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { KEJADIAN, VARIABEL, CONTOH, BAWAAN, render, rapikanSubjek, efektif, ringkasKirim, KOLOM_UI, IZIN_PROFIL, NAMA_HARI, hariKey, bulanKey, batasKuota, LAPORAN_BARU, EMAIL_SAH, ringkasLaporan } from "./notif-isi.js";

const N = { root: null, siap: false, kel: [], dok: {}, riw: [], kelId: "", buka: "", bhs: "id", draf: null, fokus: "nt-isi", galat: "", cust: [], kat: {}, lapId: "", lap: null, pv: null, pvNama: "", kuota: { hari: 0, bulan: 0 }, kuotaBuka: false };
const hp = () => matchMedia("(max-width: 760px)").matches;
const klon = (x) => JSON.parse(JSON.stringify(x));
const kelAktif = () => N.kel.find((k) => k.id === N.kelId) || null;
const daftarKejadian = () => { const k = kelAktif(); return (k && KEJADIAN[k.profil || "marketing"]) || []; };
const WAKTU = (t) => { const d = t ? new Date(t) : null; return d && !isNaN(d) ? d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–"; };
const STATUS = { antre: ["Menunggu", "warn"], mengirim: ["Mengirim", "warn"], terkirim: ["Terkirim", "ok"], gagal: ["Gagal", "bahaya"], "tanpa-email": ["Tanpa email", "warn"], dimatikan: ["Dimatikan", "warn"], batal: ["Dibatalkan", ""], dilewati: ["Dilewati", ""] };

async function muat() {
  try {
    const [k, p, r] = await Promise.all([getDocs(collection(db, "dj_kelompok")), getDocs(collection(db, "notif_pengaturan")), getDocs(query(collection(db, "dj_email"), orderBy("dibuat", "desc"), limit(60))).catch(() => ({ docs: [] }))]);
    N.kel = k.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => !x.arsip).sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    N.dok = Object.fromEntries(p.docs.map((d) => [d.id, d.data()])); N.riw = r.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nk = async (id) => { try { const x = await getDoc(doc(db, "notif_kuota", id)); return (x.exists() ? x.data() : {}).n || 0; } catch (_) { return 0; } };
    N.kuota = { hari: await nk("h_" + hariKey(Date.now())), bulan: await nk("b_" + bulanKey(Date.now())) };
    N.cust = (await getDocs(collection(db, "cu_customers")).catch(() => ({ docs: [] }))).docs.map((d) => ({ id: d.id, nama: (d.data() || {}).nama || "" })).filter((x) => x.nama).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    if (!kelAktif()) N.kelId = (N.kel.find((x) => x.profil === "tracking") || N.kel[0] || {}).id || "";
    N.galat = "";
  } catch (er) { N.galat = er.message || String(er); }
  N.siap = true;
}
const EKSTRA = ["penerima", "laporan", "riwayat"];
const bukaKejadian = (id) => { N.buka = id; const k = kelAktif(); N.draf = id && !EKSTRA.includes(id) && k ? klon(efektif(N.dok[k.id], id)) : null; if (id === "laporan") { N.lapId = ""; N.lap = null; N.pv = null; muatKat(); } };
const peta = (k) => (N.dok[k.id] || {}).penerima || {}, laps = (k) => (N.dok[k.id] || {}).laporan || {};
const profilKel = () => { const k = kelAktif(); return (k && k.profil) || "marketing"; };
const adaLaporan = () => !!KOLOM_UI[profilKel()];
async function muatKat() { const k = kelAktif(); if (!k || N.kat[k.id]) return; try { N.kat[k.id] = [...new Set((await getDocs(query(collection(db, "dj_job"), where("kelompokId", "==", k.id)))).docs.map((d) => (d.data() || {}).kategori).filter(Boolean))].sort(); gambar(); } catch (_) { N.kat[k.id] = []; } }
/* Peta penerima dan laporan ditulis utuh (updateDoc mengganti seluruh bidang) supaya entri yang dihapus benar-benar hilang. */
async function tulisPeta(bidang, nilai) { const k = kelAktif(), ref = doc(db, "notif_pengaturan", k.id); await setDoc(ref, { diubah: serverTimestamp() }, { merge: true }); await updateDoc(ref, { [bidang]: nilai }); (N.dok[k.id] || (N.dok[k.id] = {}))[bidang] = nilai; }

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
  return `<div class="nt-riw">${baris.map((x) => { const [lab, kls] = x.status === "antre" && x.menunggu === "kuota" ? ["Menunggu kuota", "warn"] : STATUS[x.status] || [x.status, ""], jadwal = x.status === "antre" && x.kirimPada > now ? ` · kirim ${WAKTU(x.kirimPada)}` : "";
    return `<div class="nt-rw"><div class="nt-rw__t"><b>${e(x.customer || "–")}</b><small class="mr-sub">${e(x.subjek || "")}</small><small class="mr-sub">${e(x.ke || "tanpa alamat")} · ${WAKTU(x.dibuat)}${jadwal}</small></div><span class="st-badge${kls ? " st-badge--" + kls : ""}">${lab}</span>${x.status === "antre" ? `<button type="button" class="mr-btn mr-btn--kecil" data-nt="batal" data-v="${e(x.id)}">Batalkan</button>` : x.status === "gagal" ? `<button type="button" class="mr-btn mr-btn--kecil" data-nt="ulang" data-v="${e(x.id)}">Kirim ulang</button>` : ""}</div>`; }).join("")}</div>`;
}

/* ---------- penerima per customer ---------- */
function htmlPenerima() {
  const k = kelAktif(), pm = peta(k), ids = Object.keys(pm), lp = Object.entries(laps(k)), bebas = N.cust.filter((c) => !pm[c.id]);
  return `<div class="nt-bagian nt-intro"><b>Penerima per customer</b><small class="mr-sub">Daftar di sini <b>menggantikan</b> email kontak di data Customer untuk kelompok ${e(k.nama)}. Customer tanpa daftar tetap memakai kontak utamanya. Laporan berkala hanya dikirim ke customer yang berlangganan di sini.</small></div>
    <div class="nt-tambah"><input id="nt-cari" list="nt-custlist" placeholder="Cari nama customer…" autocomplete="off" aria-label="Customer"><datalist id="nt-custlist">${bebas.map((c) => `<option value="${e(c.nama)}">`).join("")}</datalist><button type="button" class="mr-btn mr-btn--utama" data-nt="p-cust-tambah">Tambah</button></div>
    ${ids.length ? ids.map((id) => { const p = pm[id], c = N.cust.find((x) => x.id === id), em = p.emails || [], sub = p.laporan || [];
      return `<div class="nt-pc" data-cid="${e(id)}"><div class="nt-pc__h"><b>${e(c ? c.nama : "Customer dihapus")}</b><span class="nt-sp"></span><button type="button" class="mr-link" data-nt="p-cust-hapus" data-v="${e(id)}">Hapus daftar</button></div>
        <div class="nt-em">${em.length ? em.map((x, i) => `<span class="nt-emc">${e(x)}<button type="button" data-nt="p-email-hapus" data-v="${e(id)}" data-i="${i}" aria-label="Hapus ${e(x)}">×</button></span>`).join("") : `<small class="mr-sub">Belum ada email. Customer ini memakai kontak utamanya.</small>`}</div>
        <div class="nt-tambah"><input class="nt-emin" id="nt-em-${e(id)}" type="email" inputmode="email" placeholder="email@perusahaan.com" autocomplete="off" aria-label="Email penerima"><button type="button" class="mr-btn" data-nt="p-email-tambah" data-v="${e(id)}">Tambah email</button></div>
        ${lp.length ? `<div class="nt-lang"><small class="mr-sub">Berlangganan laporan:</small>${lp.map(([lid, l]) => `<label class="nt-cek"><input type="checkbox" data-nt="p-lap" data-v="${e(id)}" data-l="${e(lid)}"${sub.includes(lid) ? " checked" : ""}> ${e(l.nama || "Tanpa nama")}</label>`).join("")}</div>` : ""}</div>`; }).join("") : `<div class="nt-kosong"><b>Belum ada customer dengan daftar penerima.</b><p class="mr-sub">Tambahkan customer di atas, lalu isi email staf yang perlu menerima notifikasi.</p></div>`}`;
}

/* ---------- laporan berkala ---------- */
const cekB = (aksi, v, label, on, off) => `<label class="nt-cek${off ? " is-mati" : ""}"><input type="checkbox" data-nt="${aksi}" data-v="${e(v)}"${on ? " checked" : ""}${off ? " disabled" : ""}> ${label}</label>`;
function htmlLaporan() {
  const k = kelAktif(), pf = profilKel(), daftar = Object.entries(laps(k));
  if (!N.lap) return `<div class="nt-bagian nt-intro"><b>Laporan berkala</b><small class="mr-sub">Rekap otomatis per customer sebagai lampiran email (Excel atau CSV). Isinya hanya pengiriman customer penerima itu sendiri; angka biaya tidak pernah ikut untuk kelompok ini.</small></div>
    ${daftar.length ? daftar.map(([id, l]) => `<div class="nt-pc"><div class="nt-pc__h"><div><b>${e(l.nama || "Tanpa nama")}</b><small class="mr-sub">${e(ringkasLaporan(l))}${l.aktif === false ? " · mati" : ""}</small></div><span class="nt-sp"></span><button type="button" class="mr-btn mr-btn--kecil" data-nt="l-buka" data-v="${e(id)}">Atur</button></div></div>`).join("") : `<div class="nt-kosong"><b>Belum ada laporan.</b><p class="mr-sub">Buat laporan, lalu tambahkan customer yang berlangganan di bagian Penerima.</p></div>`}
    <div class="nt-aksi"><button type="button" class="mr-btn mr-btn--utama" data-nt="l-baru">+ Buat laporan</button></div>`;
  const l = N.lap, izin = IZIN_PROFIL[pf] || [], kat = N.kat[k.id] || [], pc = Object.keys(peta(k)).length ? Object.keys(peta(k)) : N.cust.map((c) => c.id);
  return `<div class="nt-editor nt-lap"><div class="nt-bagian"><b>${N.lapId === "baru" ? "Laporan baru" : "Atur laporan"}</b></div>
    <label class="mr-f"><span>Nama laporan</span><input id="nl-nama" value="${e(l.nama)}" placeholder="mis. Rekap pengiriman mingguan" autocomplete="off"></label>
    <div class="nt-bagian"><b>Jadwal kirim</b><div class="nt-seg">${[["harian", "Harian"], ["mingguan", "Mingguan"], ["bulanan", "Bulanan"]].map(([v, t]) => chip("l-set", "periode:" + v, t, l.periode === v)).join("")}</div>
      ${l.periode === "mingguan" ? `<div class="nt-seg">${NAMA_HARI.map((n, i) => chip("l-set", "hari:" + (i + 1), n, +l.hari === i + 1)).join("")}</div>` : ""}
      ${l.periode === "bulanan" ? `<label class="mr-f nt-kecil"><span>Tanggal (1–28)</span><input id="nl-tgl" type="number" min="1" max="28" value="${e(l.tanggal)}" inputmode="numeric"></label>` : ""}
      <label class="mr-f nt-kecil"><span>Jam kirim (WIB)</span><input id="nl-jam" type="time" value="${e(l.jam)}"></label>
      <small class="mr-sub">${l.periode === "harian" ? "Berisi pengiriman hari sebelumnya." : l.periode === "mingguan" ? "Berisi 7 hari sebelum hari kirim." : "Berisi satu bulan kalender sebelumnya."}</small></div>
    <div class="nt-bagian"><b>Format berkas</b><div class="nt-seg">${chip("l-set", "format:xlsx", "Excel (.xlsx)", l.format === "xlsx")}${chip("l-set", "format:csv", "CSV", l.format === "csv")}<span class="mr-chip is-mati" aria-disabled="true" title="Format PDF belum ditentukan">PDF · menyusul</span></div></div>
    <div class="nt-bagian"><b>Kolom yang disertakan</b><div class="nt-kolom">${(KOLOM_UI[pf] || []).map(([id, lab, iz]) => cekB("l-kolom", id, e(lab) + (izin.includes(iz) ? "" : " 🔒"), l.kolom.includes(id) && izin.includes(iz), !izin.includes(iz))).join("")}</div>
      ${(KOLOM_UI[pf] || []).some(([, , iz]) => !izin.includes(iz)) ? `<small class="mr-sub">🔒 Kolom keuangan (biaya, vendor, tagihan) tidak tersedia untuk kelompok ini dan tidak pernah dikirim ke customer.</small>` : ""}</div>
    <div class="nt-bagian"><b>Filter data</b><div class="nt-seg">${[["semua", "Semua"], ["selesai", "Selesai saja"], ["berjalan", "Belum selesai"]].map(([v, t]) => chip("l-set", "status:" + v, t, (l.filter.status || "semua") === v)).join("")}</div>
      ${kat.length ? `<small class="mr-sub">Jenis armada (kosong = semua):</small><div class="nt-seg">${kat.map((x) => chip("l-kat", e(x), e(x), (l.filter.kategori || []).includes(x))).join("")}</div>` : ""}
      ${cekB("l-kosong", "1", "Tetap kirim walau tidak ada pengiriman pada periode itu", l.kirimBilaKosong)}</div>
    <div class="nt-bagian"><b>Pratinjau data</b><div class="nt-tambah"><input id="nl-cust" list="nl-custlist" placeholder="Pilih customer untuk pratinjau…" autocomplete="off" value="${e(N.pvNama || "")}" aria-label="Customer pratinjau"><datalist id="nl-custlist">${pc.map((id) => (N.cust.find((c) => c.id === id) || {}).nama).filter(Boolean).map((n) => `<option value="${e(n)}">`).join("")}</datalist><button type="button" class="mr-btn" data-nt="l-pv">Pratinjau</button></div>${htmlPv()}</div>
    <div class="nt-aksi">${N.lapId !== "baru" ? `<button type="button" class="mr-btn mr-btn--bahaya" data-nt="l-hapus">Hapus</button>` : ""}<button type="button" class="mr-btn" data-nt="l-tutup">Batal</button><span class="nt-sp"></span><button type="button" class="mr-btn" data-nt="l-uji">Kirim uji ke saya</button><button type="button" class="mr-btn mr-btn--utama" data-nt="l-simpan">Simpan</button></div></div>`;
}
const htmlPv = () => { const v = N.pv; if (!v) return `<small class="mr-sub">Pilih customer lalu Pratinjau untuk melihat data yang akan dikirim.</small>`; if (v.galat) return `<small class="mr-sub" role="alert">${e(v.galat)}</small>`;
  return `<small class="mr-sub">Periode ${e(v.dari)} s.d. ${e(v.sampai)} · ${v.total} pengiriman${v.total > v.rows.length ? ` (10 pertama ditampilkan)` : ""}</small><div class="nt-scroll"><table class="nt-tbl"><thead><tr>${v.header.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${v.rows.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${v.header.length || 1}" class="mr-sub">Tidak ada pengiriman pada periode ini.</td></tr>`}</tbody></table></div>`; };

/* ---------- kuota email ---------- */
const batang = (pakai, maks) => { const p = Math.min(100, Math.round((pakai / maks) * 100)); return `<span class="nt-bar ${p >= 100 ? "is-penuh" : p >= 80 ? "is-hampir" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="${maks}" aria-valuenow="${pakai}"><i style="width:${p}%"></i></span>`; };
function htmlKuota() {
  const b = batasKuota(N.dok._kuota), tunggu = N.riw.filter((x) => x.status === "antre" && x.menunggu === "kuota").length;
  return `<div class="nt-kuota"><div class="nt-kuota__b"><div class="nt-kuota__i"><small>Hari ini</small><b>${N.kuota.hari}</b><small>/ ${b.hari}</small>${batang(N.kuota.hari, b.hari)}</div><div class="nt-kuota__i"><small>Bulan ini</small><b>${N.kuota.bulan}</b><small>/ ${b.bulan}</small>${batang(N.kuota.bulan, b.bulan)}</div><button type="button" class="mr-btn mr-btn--kecil" data-nt="k-atur">${N.kuotaBuka ? "Tutup" : "Atur batas"}</button></div>
    ${tunggu ? `<small class="mr-sub">${tunggu} email menunggu kuota dan dikirim otomatis berurutan setelah kuota tersedia (reset harian 07.00 WIB).</small>` : ""}
    ${N.kuotaBuka ? `<div class="nt-kuota__f"><label class="mr-f nt-kecil"><span>Batas per hari</span><input id="nk-hari" type="number" min="1" value="${b.hari}" inputmode="numeric"></label><label class="mr-f nt-kecil"><span>Batas per bulan</span><input id="nk-bulan" type="number" min="1" value="${b.bulan}" inputmode="numeric"></label><button type="button" class="mr-btn mr-btn--utama" data-nt="k-simpan">Simpan batas</button></div><small class="mr-sub">Samakan dengan paket Resend Anda (gratis: 100 per hari, 3.000 per bulan). Dihitung per alamat penerima. Email yang melewati batas tidak hilang: menunggu antrean sampai kuota tersedia.</small>` : ""}</div>`;
}

/* ---------- tata letak ---------- */
const panel = (id, kj) => (id === "riwayat" ? `<div class="nt-eh"><div><h3>Riwayat terkirim</h3></div></div>${htmlRiwayat()}` : id === "penerima" ? htmlPenerima() : id === "laporan" ? htmlLaporan() : N.draf ? htmlEditor(kj.find((x) => x.id === id) || kj[0]) : "");
function gambar() {
  const r = N.root; if (!r) return;
  if (!N.siap) { r.innerHTML = `<p class="mr-sub">Memuat pengaturan notifikasi…</p>`; return; }
  if (N.galat) { r.innerHTML = `<div class="mr-banner mr-banner--peringatan" role="alert"><div>Tidak bisa memuat pengaturan notifikasi: ${e(N.galat)}</div></div>`; return; }
  const k = kelAktif(), kj = daftarKejadian(), mobile = hp();
  const chips = `<div class="nt-kel">${N.kel.map((x) => chip("kel", e(x.id), e(x.nama), x.id === N.kelId)).join("")}</div>`;
  const kepala = `<div class="ak-kepala"><div><h3>Notifikasi</h3><p>Email otomatis ke customer: isi, penerima, laporan, waktu kirim, dan riwayat. Pengaturan berlaku per kelompok.</p></div></div>${htmlKuota()}${chips}`;
  if (!k) { r.innerHTML = kepala + `<p class="mr-sub">Belum ada kelompok Daily Job.</p>`; return; }
  if (!kj.length) { r.innerHTML = kepala + `<div class="nt-kosong"><b>Belum ada notifikasi email untuk kelompok ${e(k.nama)}.</b><p class="mr-sub">Saat ini notifikasi email tersedia untuk kelompok Tracking. Kejadian untuk kelompok lain akan muncul di sini setelah ditambahkan.</p></div>`; return; }
  if (!mobile && !N.buka) bukaKejadian(kj[0].id);
  const eff = (id) => efektif(N.dok[k.id], id), nP = Object.keys(peta(k)).length, nL = Object.keys(laps(k)).length;
  const extra = [{ id: "penerima", nama: "Penerima per customer", ket: nP ? `${nP} customer` : "Belum ada daftar" }, ...(adaLaporan() ? [{ id: "laporan", nama: "Laporan berkala", ket: nL ? `${nL} laporan` : "Belum ada" }] : []), { id: "riwayat", nama: "Riwayat terkirim", ket: `${N.riw.filter((x) => x.kelompokId === k.id).length} terakhir` }];
  if (mobile) {
    const kartu = (x, sakelar, ket) => { const buka = N.buka === x.id; return `<div class="nt-kartu${buka ? " is-buka" : ""}"><div class="nt-kh" data-nt="buka" data-v="${x.id}" role="button" tabindex="0" aria-expanded="${buka}"><div><b>${e(x.nama)}</b><small class="mr-sub">${e(ket)}</small></div><span class="nt-sp"></span>${sakelar || ""}</div>${buka ? panel(x.id, kj) : ""}</div>`; };
    r.innerHTML = kepala + kj.map((x) => { const f = eff(x.id); return kartu(x, sw(x.id, f.aktif), `${x.ket} · ${f.aktif ? ringkasKirim(f.kirim) : "Mati"}`); }).join("") + extra.map((x) => kartu(x, "", x.ket)).join("");
  } else {
    const item = (x, sakelar, ket) => `<div class="nt-item${N.buka === x.id ? " is-on" : ""}" data-nt="buka" data-v="${x.id}" role="button" tabindex="0"><div><b>${e(x.nama)}</b><small class="mr-sub">${e(ket)}</small></div><span class="nt-sp"></span>${sakelar || ""}</div>`;
    r.innerHTML = kepala + `<div class="nt-dua"><div class="nt-list">${kj.map((x) => { const f = eff(x.id); return item(x, sw(x.id, f.aktif), f.aktif ? ringkasKirim(f.kirim) : "Mati"); }).join("")}${extra.map((x) => item(x, "", x.ket)).join("")}</div><div class="nt-isi">${panel(N.buka, kj)}</div></div>`;
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
function bacaLap() { const l = N.lap; if (!l) return; const n = $("#nl-nama"), j = $("#nl-jam"), t = $("#nl-tgl"), c = $("#nl-cust"); if (n) l.nama = n.value; if (j && j.value) l.jam = j.value; if (t) l.tanggal = Math.min(28, Math.max(1, Math.round(+t.value) || 1)); if (c) N.pvNama = c.value; }
const custDari = (nama) => N.cust.find((c) => c.nama.trim().toLowerCase() === String(nama || "").trim().toLowerCase());
async function panggilUji(kirim) {
  const c = custDari(N.pvNama); if (!c) throw new Error("Pilih customer dari daftar untuk pratinjau.");
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js");
  return (await httpsCallable(getFunctions(app, "asia-southeast2"), "laporanUji")({ kelompokId: N.kelId, customerId: c.id, lap: N.lap, kirim })).data;
}
const sahKirim = (k) => (k.mode === "tunda" && !(k.menit >= 1 && k.menit <= 1440) ? "Menit tunda 1 sampai 1440." : k.mode === "jam" && !(k.jam || []).filter((j) => /^\d\d:\d\d$/.test(j)).length ? "Isi minimal satu jam kirim." : "");

async function aksi(a, v, el) {
  const k = kelAktif(), t = N.buka;
  try {
    if (a === "kel") { N.kelId = v; N.buka = ""; N.draf = null; return gambar(); }
    if (a === "buka") { if (N.buka === v && hp()) { N.buka = ""; N.draf = null; } else bukaKejadian(v); return gambar(); }
    if (a === "aktif") { const f = efektif(N.dok[k.id], v), baru = !f.aktif; await simpanDok(k.id, { [v]: { aktif: baru } }); rekam(k.id, v, { aktif: baru }); if (N.draf && N.buka === v) N.draf.aktif = baru; toast(baru ? "Notifikasi diaktifkan." : "Notifikasi dimatikan."); return gambar(); }
    if (a === "k-atur") { N.kuotaBuka = !N.kuotaBuka; return gambar(); }
    if (a === "k-simpan") {
      const h = Math.round(+$("#nk-hari").value), m = Math.round(+$("#nk-bulan").value); if (!(h >= 1) || !(m >= 1)) return toast("Isi batas harian dan bulanan (minimal 1).", "bahaya"); if (h > m) return toast("Batas harian tidak boleh melebihi batas bulanan.", "bahaya");
      el.disabled = true; await setDoc(doc(db, "notif_pengaturan", "_kuota"), { batasHari: h, batasBulan: m, diubah: serverTimestamp() }, { merge: true }); N.dok._kuota = { ...(N.dok._kuota || {}), batasHari: h, batasBulan: m }; N.kuotaBuka = false; toast("Batas kuota disimpan."); return gambar();
    }
    if (a.startsWith("p-")) {
      const pm = klon(peta(k)), dicentang = !!(el && el.checked);
      if (a === "p-cust-tambah") { const c = custDari($("#nt-cari").value); if (!c) return toast("Pilih customer dari daftar.", "bahaya"); if (pm[c.id]) return toast("Customer sudah ada di daftar.", "bahaya"); pm[c.id] = { emails: [], laporan: [] }; }
      else if (a === "p-cust-hapus") { if (!(await konfirmasi("Hapus daftar penerima?", "Customer ini kembali memakai email kontak utamanya dan berhenti menerima laporan berkala.", "Hapus"))) return; delete pm[v]; }
      else if (a === "p-email-tambah") { const x = (document.getElementById("nt-em-" + v).value || "").trim().toLowerCase(), p = pm[v]; if (!EMAIL_SAH.test(x)) return toast("Alamat email tidak valid.", "bahaya"); if ((p.emails || []).includes(x)) return toast("Email sudah ada di daftar.", "bahaya"); if ((p.emails || []).length >= 20) return toast("Maksimal 20 email per customer.", "bahaya"); p.emails = [...(p.emails || []), x]; }
      else if (a === "p-email-hapus") pm[v].emails.splice(+el.dataset.i, 1);
      else if (a === "p-lap") { const p = pm[v], l = el.dataset.l; p.laporan = dicentang ? [...new Set([...(p.laporan || []), l])] : (p.laporan || []).filter((x) => x !== l); }
      await tulisPeta("penerima", pm); return gambar();
    }
    if (a === "l-baru") { N.lapId = "baru"; N.lap = LAPORAN_BARU(profilKel()); N.pv = null; N.pvNama = ""; return gambar(); }
    if (a === "l-buka") { N.lapId = v; const d = klon(laps(k)[v]); N.lap = { ...LAPORAN_BARU(profilKel()), ...d, filter: { status: "semua", kategori: [], ...(d.filter || {}) } }; N.pv = null; return gambar(); }
    if (a === "l-tutup") { N.lapId = ""; N.lap = null; N.pv = null; return gambar(); }
    if (a.startsWith("l-") && N.lap) {
      bacaLap(); const l = N.lap, ganti = (arr, x) => (arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
      if (a === "l-set") { const [kk, vv] = v.split(":"); if (kk === "status") l.filter.status = vv; else l[kk] = kk === "hari" ? +vv : vv; N.pv = null; return gambar(); }
      if (a === "l-kolom") { l.kolom = ganti(l.kolom, v); N.pv = null; return gambar(); }
      if (a === "l-kat") { l.filter.kategori = ganti(l.filter.kategori || [], v); N.pv = null; return gambar(); }
      if (a === "l-kosong") { l.kirimBilaKosong = !l.kirimBilaKosong; return gambar(); }
      if (a === "l-pv" || a === "l-uji") {
        try { el.disabled = true; N.pv = await panggilUji(a === "l-uji"); if (a === "l-uji") toast(`Laporan uji dikirim ke ${N.pv.ke}.`); } catch (er) { N.pv = { galat: er.message || String(er) }; }
        return gambar();
      }
      if (a === "l-simpan") {
        const izin = IZIN_PROFIL[profilKel()] || [], dipakai = (KOLOM_UI[profilKel()] || []).filter(([id, , iz]) => l.kolom.includes(id) && izin.includes(iz)).map(([id]) => id);
        if (!String(l.nama).trim()) return toast("Beri nama laporan.", "bahaya"); if (!dipakai.length) return toast("Pilih minimal satu kolom.", "bahaya"); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(l.jam)) return toast("Isi jam kirim.", "bahaya");
        const lm = klon(laps(k)), id = N.lapId === "baru" ? "l" + Date.now().toString(36) : N.lapId; lm[id] = { ...l, nama: l.nama.trim(), kolom: dipakai };
        el.disabled = true; await tulisPeta("laporan", lm); N.lapId = ""; N.lap = null; N.pv = null; toast("Laporan disimpan. Tambahkan customer yang berlangganan di Penerima."); return gambar();
      }
      if (a === "l-hapus") {
        if (!(await konfirmasi("Hapus laporan?", `Laporan <b>${e(l.nama || "ini")}</b> dihapus dan berhenti dikirim ke semua customer.`, "Hapus"))) return;
        const lm = klon(laps(k)), pm = klon(peta(k)); delete lm[N.lapId]; Object.values(pm).forEach((p) => { p.laporan = (p.laporan || []).filter((x) => x !== N.lapId); });
        await tulisPeta("laporan", lm); await tulisPeta("penerima", pm); N.lapId = ""; N.lap = null; N.pv = null; toast("Laporan dihapus."); return gambar();
      }
    }
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
    if (t.type !== "checkbox") ev.preventDefault(); aksi(t.dataset.nt, t.dataset.v ?? t.dataset.t, t);
  });
  document.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches(".nt-kh, .nt-item") && N.root && N.root.contains(ev.target)) { ev.preventDefault(); ev.target.click(); } });
  document.addEventListener("input", (ev) => {
    if (!N.root || !N.root.isConnected || !N.draf || !ev.target.closest || !ev.target.closest(".nt-editor")) return;
    if (ev.target.id === "nt-subjek" || ev.target.id === "nt-isi") { N.fokus = ev.target.id; bacaForm(); const p = $("#nt-pv"); if (p) p.innerHTML = htmlPratinjau(); }
  });
  document.addEventListener("focusin", (ev) => { if (ev.target.id === "nt-subjek" || ev.target.id === "nt-isi") N.fokus = ev.target.id; });
  matchMedia("(max-width: 760px)").addEventListener("change", () => { if (N.root && N.root.isConnected) { bacaForm(); bacaLap(); gambar(); } }); // diputar atau diubah ukurannya: pilihan dan draf dipertahankan
}

export async function isiNotifikasi(root) { N.root = root; pasang(); gambar(); if (!N.siap) { await muat(); gambar(); } }
