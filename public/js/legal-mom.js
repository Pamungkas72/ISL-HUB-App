// ===========================================================
// MOM (Minutes of Meeting) — editor satu halaman (bagian bisa dilipat), PDF bergaya quotation, tanda tangan dari profil akun.
// Draf bisa diubah pemiliknya; Final terkunci (revisi = versi baru dengan nomor sama). Nomor otomatis MOM/ISL/XI/2026/007 per tahun.
// PDF memakai window.__islDok (app-core.js): kop, huruf, dan warna sama dengan quotation. Bahasa dokumen: ID atau English penuh.
// ===========================================================
import { e, $, $$, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { doc, getDoc, setDoc, deleteDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { unggahBlob } from "./app-store.js";

let E = null, C = null, saran = []; // E: MOM yang dibuka; C: konteks dari legal.js; saran: nama peserta yang pernah dipakai
const uid = () => "mm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const U = () => window.__ISL;
const hariIni = () => U().hariIni();
const ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const JABATAN = { master: "Owner", admin: "Admin", sales: "Sales" };
const STATUS_TUGAS = [["baru", "Baru"], ["berjalan", "Berjalan"], ["selesai", "Selesai"]];
const LABEL_TOPIK = ["Meeting", "Visit", "Edukasi", "Lainnya"];

/* Label dokumen: dua bahasa penuh (aturan Bahasa dokumen). Isian bebas pengguna tidak diterjemahkan. */
const LBL = {
  id: { judul: "Memorandum of Meeting", sub: "Notulen Rapat", nomor: "Nomor", acara: "Acara", tglWaktu: "Tanggal · Waktu", tempat: "Tempat", peserta: "Peserta", orang: "orang", dari: "Dari", hasil: "Hasil Pembahasan", topik: "topik", agenda: "Agenda", tl: "Tindak Lanjut", tugas: "tugas", pic: "Penanggung jawab", tugasH: "Tugas", tenggat: "Tenggat", status: "Status", capaian: "Capaian Target", tercapai: "Tercapai", tidak: "Tidak Tercapai", no: "No.", dok: "Dokumentasi", notulen: "Notulen", setuju: "Disetujui", draf: "DRAF", hal: (i, n) => `Halaman ${i} dari ${n}`, lanjut: "lanjutan", rev: "Rev.", st: { baru: "Baru", berjalan: "Berjalan", selesai: "Selesai" }, loc: "id-ID", kota: "Jakarta" },
  en: { judul: "Minutes of Meeting", sub: "Meeting Notes", nomor: "Number", acara: "Event", tglWaktu: "Date · Time", tempat: "Venue", peserta: "Attendees", orang: "people", dari: "From", hasil: "Discussion Results", topik: "topics", agenda: "Agenda", tl: "Action Items", tugas: "tasks", pic: "Person in charge", tugasH: "Task", tenggat: "Due date", status: "Status", capaian: "Target Achievement", tercapai: "Achieved", tidak: "Not Achieved", no: "No.", dok: "Documentation", notulen: "Minutes taker", setuju: "Approved by", draf: "DRAFT", hal: (i, n) => `Page ${i} of ${n}`, lanjut: "continued", rev: "Rev.", st: { baru: "New", berjalan: "In progress", selesai: "Done" }, loc: "en-GB", kota: "Jakarta" },
};
const tglPanjang = (s, L) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString(L.loc, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "–");
const tglPendek = (s, L) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString(L.loc, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const waktuTeks = (m) => [m.mulai, m.selesai].filter(Boolean).join(" – ");

/* ---------- model ---------- */
function baru() {
  const p = U(), peran = p.peran || "sales";
  return { id: uid(), status: "draf", versi: 1, bahasa: "id", judul: "", tanggal: hariIni(), mulai: "", selesai: "", tempat: "", customerId: "", customerNama: "", kontrakId: "", isl: [], lain: [], lainNama: "", topik: [{ label: "Meeting", judul: "", mulai: "", selesai: "", agenda: "", poin: [] }], tugas: [], tercapai: [], tidakTercapai: [], foto: [], penyetuju: { nama: "", jabatan: "" }, notulen: p.nama || "", notulenJabatan: JABATAN[peran] || "", ttd: "", nomor: "", pemilikUid: p.uid, pemilikNama: p.nama || p.email || "", pemilikEmail: p.email || "", _baru: true };
}
const salinan = (m) => JSON.parse(JSON.stringify(m));
function dariSumber(src, { kosongkanIsi = true } = {}) { // salin untuk MOM baru: info dan peserta ikut, isi rapat kosong
  const n = baru();
  Object.assign(n, { bahasa: src.bahasa, judul: src.judul, tempat: src.tempat, customerId: src.customerId || "", customerNama: src.customerNama || "", kontrakId: src.kontrakId || "", isl: [...(src.isl || [])], lain: [...(src.lain || [])], lainNama: src.lainNama || "", penyetuju: { ...(src.penyetuju || {}) } });
  if (!kosongkanIsi) Object.assign(n, { topik: salinan(src.topik || []), tugas: salinan(src.tugas || []) });
  return n;
}
const nomorMom = async (tanggal) => {
  const [th, bl] = tanggal.split("-"), ref = doc(C.db, "lg_counters", "mom-" + th);
  const n = await runTransaction(C.db, async (tx) => { const s = await tx.get(ref); const v = (s.exists() ? s.data().nilai : 0) + 1; tx.set(ref, { nilai: v }); return v; });
  return `MOM/ISL/${ROMAWI[+bl]}/${th}/${String(n).padStart(3, "0")}`;
};

/* ---------- PDF ---------- */
const sec = (L, huruf, judul, sub) => `<div class="mm-sh"><span class="mm-bd">${huruf}</span>${e(judul)}${sub ? `<small>${e(sub)}</small>` : ""}</div>`;
function blokPdf(m) {
  const L = LBL[m.bahasa] || LBL.id, blok = [], ttdImg = m.ttd || (m.pemilikUid === U().uid ? window.__islDok.ttdSaya() : "");
  const rev = (m.versi || 1) > 1 ? ` · ${L.rev} ${m.versi}` : "";
  blok.push(`<div><div class="isl-hd"><div><h1>${e(L.judul)}</h1><div class="s">${e(L.sub)}</div></div><div class="n"><small>${e(L.nomor)}</small><b>${e((m.nomor || "—") + rev)}</b><span>${e(L.kota)}, ${e(tglPanjang(m.tanggal, L))}</span></div></div>
    <div class="isl-two mm-info"><div><div class="l">${e(L.acara)}</div><b>${e(m.judul || "–")}</b></div><div><div class="l">${e(L.tglWaktu)}</div><b>${e(tglPendek(m.tanggal, L))}${waktuTeks(m) ? " · " + e(waktuTeks(m)) : ""}</b></div><div><div class="l">${e(L.tempat)}</div><b>${e(m.tempat || "–")}</b></div></div></div>`);
  const lain = m.lainNama || "";
  blok.push(`<div>${sec(L, "A", L.peserta, `${(m.isl || []).length + (m.lain || []).length} ${L.orang}`)}<div class="mm-pr"><div class="mm-bx"><div class="l">${e(L.dari)} ISL (${(m.isl || []).length})</div>${e((m.isl || []).join(" · ") || "–")}</div><div class="mm-bx"><div class="l">${e(L.dari)} ${e(lain || "–")} (${(m.lain || []).length})</div>${e((m.lain || []).join(" · ") || "–")}</div></div></div>`);
  const kartu = (t, i) => `<div class="mm-tp"><div class="h"><b>${t.label && t.label !== "Meeting" ? `<em>${e(t.label)}</em> ` : ""}${i + 1}. ${e(t.judul || "–")}</b><span>${e(waktuTeks(t))}</span></div>${t.agenda ? `<div class="ag">${e(L.agenda)}: ${e(t.agenda)}</div>` : ""}${(t.poin || []).length ? `<ul>${t.poin.map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : ""}</div>`;
  (m.topik || []).forEach((t, i) => blok.push(i === 0 ? `<div>${sec(L, "B", L.hasil, `${m.topik.length} ${L.topik}`)}${kartu(t, i)}</div>` : kartu(t, i)));
  const tg = m.tugas || [], baris = (t) => `<tr><td><b>${e(t.pic || "–")}</b></td><td>${e(t.tugas || "")}</td><td class="c">${e(tglPendek(t.tenggat, L))}</td><td>${e(L.st[t.status] || "")}</td></tr>`;
  for (let i = 0; i < tg.length; i += 7) blok.push(`<div>${i === 0 ? sec(L, "C", L.tl, `${tg.length} ${L.tugas}`) : ""}<table class="mm-t"><thead><tr><th>${e(L.pic)}</th><th>${e(L.tugasH)}</th><th style="text-align:right">${e(L.tenggat)}</th><th>${e(L.status)}</th></tr></thead><tbody>${tg.slice(i, i + 7).map(baris).join("")}</tbody></table></div>`);
  if ((m.tercapai || []).length || (m.tidakTercapai || []).length) {
    const n = Math.max(m.tercapai.length, m.tidakTercapai.length);
    blok.push(`<div>${sec(L, "D", L.capaian)}<table class="mm-t"><thead><tr><th style="width:34px">${e(L.no)}</th><th>${e(L.tercapai)}</th><th>${e(L.tidak)}</th></tr></thead><tbody>${Array.from({ length: n }, (_, i) => `<tr><td class="c">${i + 1}</td><td>${e(m.tercapai[i] || "")}</td><td>${e(m.tidakTercapai[i] || "")}</td></tr>`).join("")}</tbody></table></div>`);
  }
  blok.push(`<div class="isl-ttd" style="margin-top:22px"><div class="col"><div class="lbl"><b>${e(L.notulen)}</b><br>PT Indo Sukses Logistik</div><div class="sg">${ttdImg ? `<img class="tt" src="${e(ttdImg)}" alt="">` : ""}</div><div class="rA">${e(m.notulen || "")}</div><div class="rB">${e(m.notulenJabatan || "")}</div><div class="rC">${e(L.kota)}, ${e(tglPanjang(m.tanggal, L))}</div></div>
    ${m.penyetuju && m.penyetuju.nama ? `<div class="col"><div class="lbl"><b>${e(L.setuju)}</b><br>&nbsp;</div><div class="sg kos"></div><div class="rA">${e(m.penyetuju.nama)}</div><div class="rB">${e(m.penyetuju.jabatan || "")}</div></div>` : ""}</div>`);
  const f = m.foto || [];
  for (let i = 0; i < f.length; i += 2) blok.push(`<div>${i === 0 ? sec(L, "E", L.dok, `${f.length}`) : ""}<div class="mm-ft">${f.slice(i, i + 2).map((x) => `<figure><img src="${e(x.url)}" crossorigin="anonymous" alt=""><figcaption>${e(x.ket || "")}</figcaption></figure>`).join("")}</div></div>`);
  return blok;
}
async function renderPdf(m) {
  if (!window.__islDok) throw new Error("Modul dokumen belum termuat. Muat ulang halaman.");
  const L = LBL[m.bahasa] || LBL.id, no = m.nomor || "—";
  return window.__islDok.render(blokPdf(m), { judul: `${L.judul} No. ${no}`, lanjut: L.lanjut, footer: `PT Indo Sukses Logistik · ${L.judul} No. ${no}`, hal: L.hal, watermark: m.status === "final" ? "" : L.draf });
}
const namaBerkas = (m) => `MOM_${(m.nomor || "Draf").replace(/\//g, "-")}_${(m.judul || "").replace(/[^\w]+/g, "_").slice(0, 30)}.pdf`;
async function pdfBlob(m) { const r = await renderPdf(m); try { const pdf = await window.__islDok.pdf(r.pages); return { blob: pdf.output("blob"), n: r.n }; } finally { r.host.remove(); } }
async function unduh(m) { toast("Membuat PDF…"); try { const { blob } = await pdfBlob(m), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = namaBerkas(m); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("PDF diunduh."); } catch (err) { toast("PDF gagal dibuat. " + e(err.message || err), "bahaya"); } }
async function bagikan(m) {
  try {
    const { blob } = await pdfBlob(m), f = new File([blob], namaBerkas(m), { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) return await navigator.share({ files: [f], title: m.judul || "MOM", text: `${m.judul || "MOM"} (${m.nomor || "Draf"})` });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = namaBerkas(m); a.click();
    window.open("https://wa.me/?text=" + encodeURIComponent(`${m.judul || "MOM"} (${m.nomor || ""}). PDF terlampir.`), "_blank", "noopener");
    toast("PDF diunduh. Lampirkan ke WhatsApp atau email.");
  } catch (err) { if (err && err.name !== "AbortError") toast("Gagal membagikan. " + e(err.message || err), "bahaya"); }
}
async function pratinjau(m) {
  const p = bukaLayer(`<div class="mr-panel__kepala"><h2>Pratinjau PDF</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div><div class="mr-panel__isi mm-pv"><p class="mr-sub">Menyusun halaman…</p></div>`, { lebar: "lebar" });
  try {
    const r = await renderPdf(m), wd = $(".mm-pv", p), k = Math.max(0.3, Math.min(1, (wd.clientWidth - 4) / 794));
    wd.innerHTML = r.pages.map(() => `<div class="mm-pv__h" style="width:${Math.round(794 * k)}px;height:${Math.round(1123 * k)}px"><div style="width:794px;height:1123px;transform:scale(${k});transform-origin:0 0"></div></div>`).join("");
    $$(".mm-pv__h > div", wd).forEach((d, i) => d.appendChild(r.pages[i].cloneNode(true))); r.host.remove();
  } catch (err) { $(".mm-pv", p).innerHTML = `<p class="mr-sub">Pratinjau gagal. ${e(err.message || err)}</p>`; }
}

/* ---------- penyimpanan ---------- */
function data() {
  const { _baru, _kotor, _lihat, ...d } = E; return { ...d, diubah: serverTimestamp(), ...(_baru ? { dibuat: serverTimestamp() } : {}) };
}
async function simpanSaran() {
  const semua = [...new Set([...(E.isl || []), ...(E.lain || []), ...saran])].slice(0, 300);
  try { await setDoc(doc(C.db, "lg_peserta", U().uid), { nama: semua }, { merge: true }); saran = semua; } catch (_) { /* saran nama tidak wajib */ }
}
async function simpan(final = false) {
  if (!E.judul.trim()) return toast("Isi judul atau acara rapat dulu.", "bahaya");
  if (!E.tanggal) return toast("Isi tanggal rapat.", "bahaya");
  const tb = $$("[data-mm-simpan]"); tb.forEach((b) => (b.disabled = true));
  try {
    if (final && E._baru) { E.status = "draf"; await setDoc(doc(C.db, "lg_mom", E.id), data(), { merge: true }); delete E._baru; } // aturan server: dokumen baru harus berstatus draf dulu
    if (final) { if (!E.nomor) E.nomor = await nomorMom(E.tanggal); E.status = "final"; E.ttd = window.__islDok ? window.__islDok.ttdSaya() : ""; E.final = new Date().toISOString().slice(0, 10); }
    await setDoc(doc(C.db, "lg_mom", E.id), data(), { merge: true }); delete E._baru; E._kotor = false; simpanSaran();
    toast(final ? `MOM final: <b>${e(E.nomor)}</b>` : "Draf tersimpan.");
    if (final) { await C.kembali(true); buka(C.S.mom.find((x) => x.id === E.id) || E, C); } else { const i = C.S.mom.findIndex((x) => x.id === E.id), { _baru, ...tersimpan } = E; if (i >= 0) C.S.mom[i] = { ...C.S.mom[i], ...tersimpan }; else C.S.mom.push(tersimpan); ulang(); }
  } catch (err) { console.error(err); if (final) E.status = "draf"; toast("Gagal menyimpan: " + e(err.message || err), "bahaya"); tb.forEach((b) => (b.disabled = false)); }
}

/* ---------- editor ---------- */
const buka_ = new Set(["info"]);
const ringkasSec = { info: () => [E.tanggal ? tglPendek(E.tanggal, LBL.id) : "", E.tempat].filter(Boolean).join(" · "), peserta: () => `${(E.isl || []).length + (E.lain || []).length} orang`, topik: () => `${E.topik.length} topik`, tugas: () => `${E.tugas.length} tugas`, capaian: () => `${E.tercapai.length + E.tidakTercapai.length} butir`, ttd: () => E.notulen || "", foto: () => `${E.foto.length} foto` };
const akor = (id, judul, isi) => `<section class="mm-acc${buka_.has(id) ? " is-buka" : ""}" id="mm-s-${id}"><button type="button" class="mm-acc__h" data-mm-acc="${id}" aria-expanded="${buka_.has(id)}"><b>${judul}</b><span>${e(ringkasSec[id] ? ringkasSec[id]() : "")}</span><i>${ikon("turun", 16)}</i></button><div class="mm-acc__b">${isi}</div></section>`;
const fld = (label, f, v, ex = "") => `<label class="mr-f"><span>${label}</span><input data-f="${f}" value="${e(v)}" ${ex}></label>`;
const chips = (kunci, arr) => `<div class="mm-chips">${arr.map((n, i) => `<span class="mm-chip">${e(n)}<button type="button" data-mm-hapus="${kunci}:${i}" aria-label="Hapus ${e(n)}">${ikon("tutup", 12)}</button></span>`).join("")}<input class="mm-add" data-mm-add="${kunci}" list="mm-saran" placeholder="Tambah nama, tekan Enter" aria-label="Tambah peserta"></div>`;
function kartuTopik(t, i) {
  return `<div class="mm-topik"><div class="mm-topik__h"><b>${i + 1}.</b><select data-f="topik.${i}.label" aria-label="Jenis">${LABEL_TOPIK.map((l) => `<option${t.label === l ? " selected" : ""}>${l}</option>`).join("")}</select><span class="mr-ruang"></span>
    <button type="button" class="mr-ikonbtn" data-mm-geser="topik:${i}:-1" aria-label="Naik" ${i === 0 ? "disabled" : ""}>${ikon("maju", 16).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</button><button type="button" class="mr-ikonbtn" data-mm-geser="topik:${i}:1" aria-label="Turun" ${i === E.topik.length - 1 ? "disabled" : ""}>${ikon("turun", 16)}</button><button type="button" class="mr-ikonbtn" data-mm-del="topik:${i}" aria-label="Hapus topik">${ikon("tong", 16)}</button></div>
    <div class="mr-form">${fld("Pembahasan", `topik.${i}.judul`, t.judul || "", 'maxlength="150"')}<div class="mm-dua"><label class="mr-f"><span>Mulai</span><input type="time" data-f="topik.${i}.mulai" value="${e(t.mulai || "")}"></label><label class="mr-f"><span>Selesai</span><input type="time" data-f="topik.${i}.selesai" value="${e(t.selesai || "")}"></label></div>
    ${fld("Agenda", `topik.${i}.agenda`, t.agenda || "", 'maxlength="200"').replace('class="mr-f"', 'class="mr-f mr-f--lebar"')}
    <label class="mr-f mr-f--lebar"><span>Hasil diskusi <small>satu baris = satu poin</small></span><textarea data-f="topik.${i}.poin" data-arr rows="${Math.max(4, (t.poin || []).length + 1)}">${e((t.poin || []).join("\n"))}</textarea></label></div></div>`;
}
const kartuTugas = (t, i) => `<div class="mm-tugas"><label class="mr-f"><span>Penanggung jawab</span><input data-f="tugas.${i}.pic" value="${e(t.pic || "")}" maxlength="80" list="mm-saran"></label>
  <label class="mr-f mm-tugas__t"><span>Tugas</span><input data-f="tugas.${i}.tugas" value="${e(t.tugas || "")}" maxlength="250"></label><label class="mr-f"><span>Tenggat</span><input type="date" data-f="tugas.${i}.tenggat" value="${e(t.tenggat || "")}"></label>
  <label class="mr-f"><span>Status</span><select data-f="tugas.${i}.status">${STATUS_TUGAS.map(([v, l]) => `<option value="${v}"${t.status === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
  <button type="button" class="mr-ikonbtn" data-mm-del="tugas:${i}" aria-label="Hapus tugas">${ikon("tong", 16)}</button></div>`;
export function tampilEditor() {
  const kunci = !!E._lihat, p = U(), punyaTtd = E.ttd || (E.pemilikUid === p.uid && window.__islDok && window.__islDok.ttdSaya());
  const customers = ((window.__ISL_DATA && window.__ISL_DATA.customers) || []).map((c) => c.nama).filter(Boolean), kontrak = C.S.staf ? C.S.kontrak.filter((k) => k.jenis !== "perusahaan") : [];
  const bar = kunci
    ? `<button class="mr-btn" data-mm="kembali">${ikon("kembali", 16)} Kembali</button><span class="mr-ruang"></span><button class="mr-btn" data-mm="salin">Salin sebagai MOM baru</button><button class="mr-btn" data-mm="revisi">Revisi</button><button class="mr-btn" data-mm="bagikan">Bagikan</button><button class="mr-btn mr-btn--utama" data-mm="unduh">${ikon("download", 16)} Unduh PDF</button>`
    : `<button class="mr-btn" data-mm="kembali">${ikon("kembali", 16)} Kembali</button><span class="mr-ruang"></span>${E._baru ? "" : `<button class="mr-btn mr-btn--bahaya mm-hapus" data-mm="hapus">${ikon("tong", 16)}</button>`}<button class="mr-btn" data-mm="pratinjau">Pratinjau</button><button class="mr-btn" data-mm="draf" data-mm-simpan>Simpan draf</button><button class="mr-btn mr-btn--utama" data-mm="final" data-mm-simpan>Finalkan</button>`;
  const info = `<div class="mr-form">
    ${E._baru && C.S.mom.length ? `<div class="mr-f mr-f--lebar"><button type="button" class="mr-btn mr-btn--kecil" data-mm="salin-lama">${ikon("salin", 14)} Salin dari MOM lama</button></div>` : ""}
    ${fld("Judul / acara", "judul", E.judul, 'maxlength="150"').replace('class="mr-f"', 'class="mr-f mr-f--lebar"')}
    <label class="mr-f"><span>Tanggal</span><input type="date" data-f="tanggal" value="${e(E.tanggal)}"></label>
    <div class="mm-dua"><label class="mr-f"><span>Mulai</span><input type="time" data-f="mulai" value="${e(E.mulai)}"></label><label class="mr-f"><span>Selesai</span><input type="time" data-f="selesai" value="${e(E.selesai)}"></label></div>
    ${fld("Tempat", "tempat", E.tempat, 'maxlength="150"').replace('class="mr-f"', 'class="mr-f mr-f--lebar"')}
    <label class="mr-f"><span>Customer terkait <small>opsional</small></span><input data-f="customerNama" list="mm-cust" value="${e(E.customerNama)}" maxlength="120"><datalist id="mm-cust">${customers.map((n) => `<option value="${e(n)}">`).join("")}</datalist></label>
    ${kontrak.length ? `<label class="mr-f"><span>Kontrak terkait <small>opsional</small></span><select data-f="kontrakId"><option value="">Tanpa kontrak</option>${kontrak.map((k) => `<option value="${e(k.id)}"${E.kontrakId === k.id ? " selected" : ""}>${e(k.pihak)}${k.nomor ? " · " + e(k.nomor) : ""}</option>`).join("")}</select></label>` : ""}
    <div class="mr-f"><span>Bahasa dokumen</span><div class="mr-seg mr-seg--kecil">${[["id", "Indonesia"], ["en", "English"]].map(([v, l]) => `<button type="button" class="mr-seg__btn${E.bahasa === v ? " is-aktif" : ""}" data-mm-bhs="${v}">${l}</button>`).join("")}</div></div></div>`;
  const peserta = `<div class="mr-f"><span>Peserta ISL</span>${chips("isl", E.isl)}</div><div class="mr-f" style="margin-top:12px"><span>Peserta pihak lain</span><div class="mm-dua"><input data-f="lainNama" value="${e(E.lainNama)}" placeholder="Nama pihak, mis. NSI" maxlength="60" aria-label="Nama pihak lain"></div>${chips("lain", E.lain)}</div><datalist id="mm-saran">${saran.map((n) => `<option value="${e(n)}">`).join("")}</datalist>`;
  const topik = `${E.topik.map(kartuTopik).join("")}<button type="button" class="mr-btn mm-tambah" data-mm="topik+">${ikon("plus", 16)} Tambah pembahasan</button>`;
  const tugas = `${E.tugas.map(kartuTugas).join("")}<button type="button" class="mr-btn mm-tambah" data-mm="tugas+">${ikon("plus", 16)} Tambah tugas</button>`;
  const capaian = `<div class="mr-form"><label class="mr-f"><span>Tercapai <small>satu baris = satu butir</small></span><textarea data-f="tercapai" data-arr rows="4">${e(E.tercapai.join("\n"))}</textarea></label><label class="mr-f"><span>Tidak tercapai</span><textarea data-f="tidakTercapai" data-arr rows="4">${e(E.tidakTercapai.join("\n"))}</textarea></label></div>`;
  const ttd = `<div class="mr-form">${fld("Notulen", "notulen", E.notulen, 'maxlength="80"')}${fld("Jabatan notulen", "notulenJabatan", E.notulenJabatan, 'maxlength="60"')}${fld("Disetujui oleh <small>opsional, tanda tangan basah</small>", "penyetuju.nama", (E.penyetuju || {}).nama || "", 'maxlength="80"')}${fld("Jabatan penyetuju", "penyetuju.jabatan", (E.penyetuju || {}).jabatan || "", 'maxlength="60"')}</div>
    <p class="mm-ttd ${punyaTtd ? "" : "mm-ttd--kosong"}">${punyaTtd ? `<img src="${e(E.ttd || window.__islDok.ttdSaya())}" alt="Tanda tangan notulen"> Tanda tangan notulen diambil dari profil akun.` : `Tanda tangan belum diunggah. Unggah di <a href="#pengaturan">Pengaturan</a> agar tampil di PDF.`}</p>`;
  const foto = `<div class="mm-foto">${E.foto.map((f, i) => `<figure><img src="${e(f.url)}" alt=""><input data-f="foto.${i}.ket" value="${e(f.ket || "")}" placeholder="Keterangan foto" maxlength="120" aria-label="Keterangan foto"><button type="button" class="mr-ikonbtn" data-mm-del="foto:${i}" aria-label="Hapus foto">${ikon("tong", 16)}</button></figure>`).join("")}</div><label class="mr-btn mm-tambah">${ikon("foto", 16)} Unggah foto<input type="file" id="mm-file" accept="image/*" multiple hidden></label>`;
  const naskah = kunci ? `<div class="mm-lihat"><div class="mm-lihat__n"><b>${e(E.nomor)}</b><span class="lg-badge lg-badge--ok">Final</span></div><p class="mr-sub">MOM final terkunci. Untuk mengubah isi, buat revisi (versi baru dengan nomor yang sama).</p><div class="mm-pv" id="mm-pv-inline"><p class="mr-sub">Menyusun pratinjau…</p></div></div>` : `<div class="mm-grid"><nav class="mm-outl" aria-label="Bagian">${[["info", "Info rapat"], ["peserta", "Peserta"], ["topik", "Pembahasan"], ["tugas", "Tugas"], ["capaian", "Capaian target"], ["ttd", "Tanda tangan"], ["foto", "Dokumentasi"]].map(([k, l]) => `<button type="button" data-mm-ke="${k}">${l}</button>`).join("")}</nav><div class="mm-akor">${akor("info", "Info rapat", info)}${akor("peserta", "Peserta", peserta)}${akor("topik", "Pembahasan", topik)}${akor("tugas", "Tugas dan tindak lanjut", tugas)}${akor("capaian", "Capaian target", capaian)}${akor("ttd", "Tanda tangan", ttd)}${akor("foto", "Dokumentasi foto", foto)}</div></div>`;
  return `<div class="mm"><div class="mm-kepala"><h2>${kunci ? e(E.judul) : E._baru ? "Buat MOM" : "Ubah MOM"}</h2><p class="mr-sub">${kunci ? "Lihat dan unduh PDF." : "Satu halaman, ketuk bagian untuk membuka. Draf tersimpan di akun Anda."}</p></div>${kunci ? `<div class="mm-bar mm-bar--atas">${bar}</div>${naskah}` : `${naskah}<div class="mm-bar">${bar}</div>`}</div>`;
}
function ulang() { C.segar(); }
const ambil = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), E);
function setPath(path, v) { const k = path.split("."), akhir = k.pop(), o = k.reduce((x, y) => x[y], E); o[akhir] = v; E._kotor = true; }
export function pasangEditor(r) {
  const saring = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  r.oninput = (ev) => { const t = ev.target; if (!t.dataset || !t.dataset.f) return; setPath(t.dataset.f, t.hasAttribute("data-arr") ? saring(t.value) : t.value); };
  r.onchange = (ev) => { const t = ev.target; if (t.matches && t.matches("select[data-f='kontrakId']")) { const k = C.S.kontrak.find((x) => x.id === t.value); if (k && !E.customerNama && k.jenis === "customer") E.customerNama = k.pihak; } };
  r.onkeydown = (ev) => { const t = ev.target; if (t.dataset && t.dataset.mmAdd && (ev.key === "Enter" || ev.key === ",")) { ev.preventDefault(); tambahNama(t); } };
  r.onfocusout = (ev) => { const t = ev.target; if (t.dataset && t.dataset.mmAdd && t.value.trim()) tambahNama(t); };
  const file = $("#mm-file", r); if (file) file.onchange = () => unggahFoto(file);
  if (E._lihat) renderInline();
  r.onclick = async (ev) => {
    const t = ev.target.closest("[data-mm],[data-mm-acc],[data-mm-ke],[data-mm-hapus],[data-mm-del],[data-mm-geser],[data-mm-bhs]"); if (!t) return;
    const d = t.dataset;
    if (d.mmAcc) { const s = $("#mm-s-" + d.mmAcc, r), b = !s.classList.contains("is-buka"); s.classList.toggle("is-buka", b); t.setAttribute("aria-expanded", b); b ? buka_.add(d.mmAcc) : buka_.delete(d.mmAcc); return; }
    if (d.mmKe) { buka_.add(d.mmKe); const s = $("#mm-s-" + d.mmKe, r); s.classList.add("is-buka"); s.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (d.mmBhs) { E.bahasa = d.mmBhs; E._kotor = true; return ulang(); }
    if (d.mmHapus) { const [k, i] = d.mmHapus.split(":"); E[k].splice(+i, 1); E._kotor = true; return ulang(); }
    if (d.mmDel) { const [k, i] = d.mmDel.split(":"); E[k].splice(+i, 1); E._kotor = true; return ulang(); }
    if (d.mmGeser) { const [k, i, s] = d.mmGeser.split(":"), a = +i, b = a + +s; [E[k][a], E[k][b]] = [E[k][b], E[k][a]]; E._kotor = true; return ulang(); }
    const a = d.mm;
    if (a === "topik+") { E.topik.push({ label: "Meeting", judul: "", mulai: "", selesai: "", agenda: "", poin: [] }); buka_.add("topik"); return ulang(); }
    if (a === "tugas+") { E.tugas.push({ pic: "", tugas: "", tenggat: "", status: "baru" }); buka_.add("tugas"); return ulang(); }
    if (a === "kembali") { if (E._kotor && !E._lihat && !(await konfirmasi("Tinggalkan MOM?", "Ada perubahan yang belum disimpan sebagai draf.", "Tinggalkan"))) return; return C.kembali(false); }
    if (a === "draf") return simpan(false);
    if (a === "final") { if (!(await konfirmasi("Finalkan MOM?", "Nomor MOM diterbitkan dan isinya terkunci. Perubahan berikutnya lewat revisi.", "Finalkan"))) return; return simpan(true); }
    if (a === "pratinjau") return pratinjau(E);
    if (a === "unduh") return unduh(E);
    if (a === "bagikan") return bagikan(E);
    if (a === "revisi") { const n = salinan(E); Object.assign(n, { status: "draf", versi: (E.versi || 1) + 1, revisiDari: E.id, id: uid(), ttd: "", final: "", _baru: true, _lihat: false, _kotor: true }); E = n; buka_.add("info"); return ulang(); }
    if (a === "salin") { E = dariSumber(E); return ulang(); }
    if (a === "salin-lama") return pilihLama();
    if (a === "hapus") { if (!(await konfirmasi("Hapus draf MOM?", `<b>${e(E.judul || "MOM")}</b> dihapus permanen.`, "Hapus"))) return; try { await deleteDoc(doc(C.db, "lg_mom", E.id)); toast("Draf dihapus."); C.kembali(true); } catch (err) { toast("Gagal menghapus: " + e(err.message || err), "bahaya"); } }
  };
}
function tambahNama(inp) {
  const k = inp.dataset.mmAdd, v = inp.value.replace(/,/g, "").trim(); inp.value = ""; if (!v) return;
  if (!E[k].includes(v)) { E[k].push(v); E._kotor = true; } ulang(); setTimeout(() => { const n = $(`[data-mm-add="${k}"]`); if (n) n.focus(); }, 0);
}
async function unggahFoto(inp) {
  const fs = [...inp.files]; if (!fs.length) return; toast("Mengunggah foto…");
  for (const f of fs) { try { const path = `mom/${U().uid}/${E.id}/${Date.now()}_${f.name.replace(/[^\w.\-]+/g, "_")}`; E.foto.push({ url: await unggahBlob(path, f, f.type), path, ket: "" }); E._kotor = true; } catch (err) { toast(`Foto ${e(f.name)} gagal: ${e(err.message || err)}`, "bahaya"); } }
  buka_.add("foto"); ulang();
}
function pilihLama() {
  const p = bukaLayer(`<div class="mr-panel__kepala"><h2>Salin dari MOM lama</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div><div class="mr-panel__isi">${C.S.mom.slice().sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))).slice(0, 30).map((m) => `<button type="button" class="lg-baris" data-pl="${e(m.id)}"><span class="lg-baris__t"><b>${e(m.judul || "MOM")}</b><small>${e(tglPendek(m.tanggal, LBL.id))} · ${(m.isl || []).length + (m.lain || []).length} peserta</small></span></button>`).join("")}</div>`, { lebar: "drawer" });
  p.onclick = (ev) => { const b = ev.target.closest("[data-pl]"); if (!b) return; const s = C.S.mom.find((x) => x.id === b.dataset.pl), n = dariSumber(s); n.id = E.id; E = n; tutupLayer(); ulang(); };
}
async function renderInline() {
  const w = $("#mm-pv-inline"); if (!w) return;
  try { const r = await renderPdf(E), k = Math.max(0.3, Math.min(1, (w.clientWidth - 4) / 794)); w.innerHTML = r.pages.map(() => `<div class="mm-pv__h" style="width:${Math.round(794 * k)}px;height:${Math.round(1123 * k)}px"><div style="width:794px;height:1123px;transform:scale(${k});transform-origin:0 0"></div></div>`).join(""); $$(".mm-pv__h > div", w).forEach((d, i) => d.appendChild(r.pages[i].cloneNode(true))); r.host.remove(); } catch (err) { w.innerHTML = `<p class="mr-sub">Pratinjau gagal. ${e(err.message || err)}</p>`; }
}

/* dipanggil legal.js: m = MOM tersimpan atau null (baru) */
export async function buka(m, ctx) {
  C = ctx; E = m ? salinan(m) : baru(); E._lihat = E.status === "final";
  ["tercapai", "tidakTercapai", "isl", "lain", "topik", "tugas", "foto"].forEach((k) => { E[k] = E[k] || []; }); E.penyetuju = E.penyetuju || { nama: "", jabatan: "" };
  C.S.edit = true; ctx.segar(); window.scrollTo(0, 0);
  try { const s = await getDoc(doc(C.db, "lg_peserta", U().uid)); if (s.exists()) { saran = s.data().nama || []; const dl = $("#mm-saran"); if (dl) dl.innerHTML = saran.map((n) => `<option value="${e(n)}">`).join(""); } } catch (_) { /* saran nama tidak wajib */ }
}
