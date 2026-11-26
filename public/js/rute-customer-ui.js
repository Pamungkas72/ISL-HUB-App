// Tab "Daftar Rute" di halaman customer (master dan admin): daftar rute eksis + tagihan, unggah Excel, isi tagihan manual. Aturan: firestore.rules (cu_rute, cu_rute_tagihan).
import { db } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { e, $, toast } from "./ui.js";
import * as R from "./rute-customer.js";
import { JENIS_ARMADA } from "./daily-job-distribusi-hitung.js";

const M = { id: "", kunci: "", daftar: [], tag: {}, muat: false, ada: false, cari: "" };
const rp = (n) => (n ? "Rp " + Number(n).toLocaleString("id-ID") : "");
const uang = (id) => (M.tag[id] || {}).tagihan || null;
const sumberTeks = { excel: "Excel", manual: "Manual", tracking: "Tracking" };

async function muat(c) {
  M.id = c.id; M.kunci = R.norm(c.nama); M.muat = true; M.ada = false;
  try {
    const [a, b] = await Promise.all([getDocs(query(collection(db, "cu_rute"), where("kunciCust", "==", M.kunci))), getDocs(query(collection(db, "cu_rute_tagihan"), where("kunciCust", "==", M.kunci)))]);
    M.daftar = a.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => x.rute.localeCompare(y.rute)); M.tag = Object.fromEntries(b.docs.map((d) => [d.id, d.data()])); M.ada = true;
  } catch (err) { console.error(err); toast("Daftar rute belum termuat: " + (err.code || err.message), "bahaya"); }
  M.muat = false; gambar();
}
const gambar = () => { const t = $("#cu-tab"); if (t && t.dataset.rute === M.id) t.innerHTML = isi(); const j = document.querySelector('[data-tab="rute"] .cu-jml'); if (j) j.textContent = M.daftar.length || ""; };
function isi() {
  const l = M.daftar.filter((d) => !M.cari || d.rute.toLowerCase().includes(M.cari.toLowerCase())), kosong = R.tanpaTagihan(M.daftar, M.tag).length;
  if (M.muat && !M.ada) return `<p class="mr-sub">Memuat…</p>`;
  return `${kosong ? `<div class="mr-banner mr-banner--peringatan"><div><b>${kosong} rute belum punya tagihan.</b> Isi kolom Tagihan di bawah atau unggah Excel. Rute baru dari tim Tracking masuk dengan tagihan kosong.</div></div>` : ""}
  <div class="mr-toolbar mr-bar"><div class="mr-bar__filter"><input type="search" class="mr-select" id="rt-cari" placeholder="Cari rute…" value="${e(M.cari)}" aria-label="Cari rute"></div>
  <div class="mr-bar__aksi"><button class="mr-btn" data-rt="templat">Unduh templat Excel</button><label class="mr-btn mr-btn--utama mr-unggah">Unggah Excel<input type="file" accept=".xlsx,.xls,.csv" data-rt-file hidden></label></div></div>
  <div class="mr-kartu mr-tabelkartu"><table class="mr-table rt-tb"><thead><tr><th>Rute</th><th>Jenis armada</th><th class="cu-r">Tagihan (Rp)</th><th>Sumber</th><th class="cu-aksi"></th></tr></thead><tbody>
  <tr class="rt-baru"><td><input class="mr-select" id="rt-n-rute" placeholder="Rute baru, mis. Cikarang - Bogor" aria-label="Rute baru"></td><td><select class="mr-select" id="rt-n-jenis" aria-label="Jenis armada"><option value="">Semua armada</option>${JENIS_ARMADA.map((j) => `<option>${j}</option>`).join("")}</select></td><td><input class="mr-select cu-r" id="rt-n-tagihan" inputmode="numeric" data-ribuan-live placeholder="boleh kosong" aria-label="Tagihan"></td><td></td><td class="cu-aksi"><button class="mr-btn mr-btn--utama" data-rt="tambah">Tambah</button></td></tr>
  ${l.map((d) => `<tr><td><b>${e(d.rute)}</b></td><td>${e(d.jenisArmada || "Semua")}</td><td class="cu-r"><input class="mr-select cu-r${uang(d.id) ? "" : " rt-kosong"}" inputmode="numeric" data-ribuan-live data-rt-tagihan="${e(d.id)}" value="${uang(d.id) ? Number(uang(d.id)).toLocaleString("id-ID") : ""}" placeholder="Belum diisi" aria-label="Tagihan ${e(d.rute)}"></td><td>${sumberTeks[d.sumber] || ""}</td><td class="cu-aksi"><button class="mr-ikonbtn" data-rt="hapus" data-id="${e(d.id)}" aria-label="Hapus rute" title="Hapus">✕</button></td></tr>`).join("")}
  </tbody></table>${l.length ? "" : `<div class="mr-kosong"><p>${M.daftar.length ? "Tidak ada rute pada pencarian ini." : "Belum ada rute. Unggah Excel atau tambah satu per satu; tim Tracking memakainya sebagai pilihan rute."}</p></div>`}</div>`;
}
const simpanRute = async (kol, id, data) => setDoc(doc(db, kol, id), { ...data, diubah: serverTimestamp() });
async function tambah(rute, jenis, tagihan, sumber) {
  const id = R.idRute(M.kunci, rute, jenis), t = R.teksRute(rute);
  await simpanRute("cu_rute", id, { kunciCust: M.kunci, customerId: M.id, rute: t, jenisArmada: jenis || "", sumber, dibuat: Date.now() });
  await simpanRute("cu_rute_tagihan", id, { kunciCust: M.kunci, tagihan: tagihan || null });
  const i = M.daftar.findIndex((d) => d.id === id), d = { id, kunciCust: M.kunci, rute: t, jenisArmada: jenis || "", sumber };
  if (i >= 0) M.daftar[i] = { ...M.daftar[i], ...d }; else M.daftar.push(d); M.tag[id] = { tagihan: tagihan || null }; M.daftar.sort((x, y) => x.rute.localeCompare(y.rute));
}
async function impor(file) {
  if (!window.XLSX) return toast("Pustaka Excel belum termuat. Muat ulang halaman.", "bahaya");
  const wb = window.XLSX.read(await file.arrayBuffer()), { baris, lewat, galat } = R.bacaBaris(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }));
  if (galat || !baris.length) return toast(galat || "Tidak ada rute valid di berkas ini.", "bahaya");
  let ok = 0; for (const b of baris) { const id = R.idRute(M.kunci, b.rute, b.jenisArmada); if (!b.tagihan && uang(id)) b.tagihan = uang(id); try { await tambah(b.rute, b.jenisArmada, b.tagihan, "excel"); ok++; } catch (err) { console.error(err); } }
  gambar(); toast(`${ok} rute tersimpan${lewat ? `, ${lewat} baris dilewati (rute harus minimal dua lokasi)` : ""}${ok < baris.length ? `, ${baris.length - ok} gagal` : ""}.`, ok ? "ok" : "bahaya");
}
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-rt]"); if (!b || !M.id) return; const a = b.dataset.rt;
  if (a === "templat") { if (!window.XLSX) return; const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([["Rute", "Jenis armada", "Tagihan"], ["Cikarang - Bogor", "CDD", 1250000], ["Bekasi - Depok - Bogor", "Fuso", 2000000]]), "Daftar rute"); window.XLSX.writeFile(wb, "Templat-Daftar-Rute.xlsx"); }
  else if (a === "tambah") { const r = $("#rt-n-rute").value; if (!R.bacaBaris([["Rute"], [r]]).baris.length) return toast("Isi rute minimal dua lokasi, mis. Cikarang - Bogor.", "bahaya"); try { await tambah(r, $("#rt-n-jenis").value, R.angkaRp($("#rt-n-tagihan").value), "manual"); gambar(); toast("Rute ditambahkan."); } catch (err) { console.error(err); toast("Belum tersimpan: " + (err.code || err.message), "bahaya"); } }
  else if (a === "hapus") { const d = M.daftar.find((x) => x.id === b.dataset.id); if (!d || !confirm(`Hapus rute ${d.rute}?`)) return; try { await deleteDoc(doc(db, "cu_rute", d.id)); await deleteDoc(doc(db, "cu_rute_tagihan", d.id)); M.daftar = M.daftar.filter((x) => x.id !== d.id); delete M.tag[d.id]; gambar(); } catch (err) { console.error(err); toast("Belum terhapus: " + (err.code || err.message), "bahaya"); } }
});
document.addEventListener("change", async (ev) => {
  const t = ev.target; if (!M.id) return;
  if (t.matches("[data-rt-file]")) { const f = t.files[0]; t.value = ""; if (f) impor(f).catch((err) => { console.error(err); toast("Berkas tidak terbaca: " + err.message, "bahaya"); }); }
  else if (t.matches("[data-rt-tagihan]")) { const id = t.dataset.rtTagihan, n = R.angkaRp(t.value); try { await simpanRute("cu_rute_tagihan", id, { kunciCust: M.kunci, tagihan: n || null }); M.tag[id] = { tagihan: n || null }; gambar(); toast("Tagihan tersimpan."); } catch (err) { console.error(err); toast("Belum tersimpan: " + (err.code || err.message), "bahaya"); } }
});
document.addEventListener("input", (ev) => { if (ev.target.id === "rt-cari") { M.cari = ev.target.value; const t = $("#cu-tab"); if (t) { const p = ev.target.selectionStart; t.innerHTML = isi(); const x = $("#rt-cari"); x.focus(); x.setSelectionRange(p, p); } } });
/** Dipakai app-core.js: isi tab (memuat data sekali per customer) dan jumlah rute untuk lencana tab. */
window.__islRute = { tab: (c) => { setTimeout(() => { const t = $("#cu-tab"); if (t) t.dataset.rute = c.id; if (M.id !== c.id || (!M.ada && !M.muat)) muat(c); }, 0); return M.id === c.id && M.ada ? isi() : `<p class="mr-sub">Memuat…</p>`; }, jumlah: (c) => (M.id === c.id ? M.daftar.length || "" : "") };
