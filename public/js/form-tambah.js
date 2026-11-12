// ===========================================================
// FORM TAMBAH TARIF — satu formulir untuk semua lini.
// Desktop: satu halaman bersekat (Klasifikasi, Layanan, Harga).
// HP (<=760px): tiga langkah dengan Kembali/Lanjut (CSS: .mr-langkah).
// Aturan per lini ada di form-lini.js.
//
// Alur simpan (berurutan, tiap langkah diverifikasi dari server):
//   1. satuan/vendor baru  2. zona/lokasi baru  3. tarif.
//   Kalau langkah 3 gagal, langkah 1-2 tetap ada (tidak dobel saat
//   dicoba lagi) dan kamu diberi tahu jelas.
// ===========================================================
import { e, $, $$, toast, bukaLayer, tutupLayer, konfirmasi } from "./ui.js";
import { ikon } from "./ikon.js";
import { slug, buatKunci, parseAngka, METODE_HARGA, pasangRibuan, formatInputAngka, formatRp } from "./kunci.js";
import { LINI_ASING, htmlNilaiAsing, pasangNilaiAsing, bacaNilaiAsing } from "./asing.js";
import { htmlPilihSatuan, pasangPilihSatuan, htmlCombo, pasangCombo, resolveSatuan } from "./satuan-combo.js";
import { htmlFasilitas, pasangFasilitas, pilihFasilitasBaru } from "./fasilitas.js";
import { konfigLini, bangunItem, susunSatuan, VENDOR_INTERNAL, markupLini, saranJual } from "./form-lini.js";
import { vendorUntukLini } from "./tampilan-data.js";

// Tarif "mirip" = lini, vendor, satuan, dan lokasi sama, dengan nama layanan yang hanya beda penulisan
// (spasi, tanda baca, huruf besar) atau kata-katanya hampir sama. Kunci beda, jadi tidak tertangkap cek kunci.
const rataNama = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const kataNama = (t) => new Set(String(t || "").toLowerCase().replace(/(\d+)\s+(ft|hc|kg|ton|m2|m3)\b/g, "$1$2").split(/[^a-z0-9]+/).filter(Boolean));
function namaMirip(a, b) {
  if (rataNama(a) && rataNama(a) === rataNama(b)) return true;
  const x = kataNama(a), y = kataNama(b);
  if (x.size < 2 || y.size < 2) return false;
  const sama = [...x].filter((k) => y.has(k)).length;
  return sama / (x.size + y.size - sama) >= 0.8;
}
export function cariMirip(rows, calon) {
  return rows.filter((t) => t.liniBisnisId === calon.liniBisnisId && t.vendorId === calon.vendorId && t.satuanKode === calon.satuanKode && (t.lokasiId || null) === (calon.lokasiId || null) && t.kunci !== calon.kunci
    && (namaMirip(t.layananNama || t.layanan, calon.layananNama) || (t.layanan === calon.layanan && namaMirip(JSON.stringify(t.dimensi || {}), JSON.stringify(calon.dimensi || {})))));
}

export function bukaTambahItem({ S, DB, peta, namaLini, render }) {
  const liniAktif = S.lini.filter((l) => l.aktif !== false);
  let liniId = S.f.lini !== "semua" ? S.f.lini : "";
  // "Belum diatur": tarif boleh disimpan tanpa lini. Lininya dilengkapi nanti lewat Edit tarif.
  let belum = false;
  let sumber = "vendor";
  let langkah = 1;

  const ref = () => ({ zona: S.ref.zona, lokasiDistribusi: S.ref.lokasiDistribusi, openYard: S.ref.openYard, rows: S.tarif, vendorId: vendorTerpilih().id });

  const panel = bukaLayer(`
    <header class="mr-panel__kepala"><div><h2>Tambah tarif</h2><p class="mr-sub" id="t-sub"></p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi">
      <ol class="mr-langkah-nav" id="t-nav"><li data-n="1">Klasifikasi</li><li data-n="2">Layanan</li><li data-n="3">Harga</li></ol>
      <section class="mr-langkah" data-n="1"><h3>1 · Klasifikasi</h3><div class="mr-form">
        <label class="mr-f mr-f--lebar"><span>Lini bisnis *</span><select id="t-lini"><option value="">Pilih lini bisnis…</option>${liniAktif.map((l) => `<option value="${e(l.id)}" ${l.id === liniId ? "selected" : ""}>${e(namaLini(l.id))}</option>`).join("")}<option value="__belum__">Belum diatur (buat lini nanti)</option></select><small class="mr-hint">${liniAktif.length ? "Lini bisnis bisa dilengkapi nanti lewat Edit tarif." : "Belum ada lini bisnis. Tarif tetap bisa disimpan sekarang, lini dibuat nanti."}</small></label>
        <div class="mr-f mr-f--lebar"><span>Pemilik tarif *</span><div class="mr-seg" id="t-sumber"><button type="button" class="mr-seg__btn is-aktif" data-sumber="vendor">Vendor</button><button type="button" class="mr-seg__btn" data-sumber="internal">Internal</button></div></div>
        <label class="mr-f mr-f--lebar" data-w="vendor"><span>Vendor *</span><select id="t-vendor"></select></label>
        <label class="mr-f mr-f--lebar" data-w="vendorBaru" hidden><span>Nama vendor baru *</span><input id="t-vendorBaru" placeholder="Mis. PT Maju Jaya" autocomplete="off"><small>Otomatis didaftarkan ke tab Vendor dan lini ini. Lengkapi identitasnya nanti di tab Vendor.</small></label>
        <p class="mr-hint mr-f--lebar" data-w="internal" hidden>Tarif internal memakai vendor tetap <b>${e(VENDOR_INTERNAL.nama)}</b> (dibuat otomatis bila belum ada).</p>
      </div></section>
      <section class="mr-langkah" data-n="2"><h3>2 · Layanan</h3><div class="mr-form" id="t-layanan"><p class="mr-hint mr-f--lebar">Pilih lini bisnis dulu.</p></div></section>
      <section class="mr-langkah" data-n="3"><h3>3 · Harga</h3><div id="t-harga"></div></section>
      <p class="mr-galat" id="t-galat-l" hidden></p>
    </div>
    <footer class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer" id="t-batal">Batal</button><button class="mr-btn" id="t-kembali">Kembali</button><button class="mr-btn mr-btn--utama" id="t-lanjut">Lanjut</button><button class="mr-btn mr-btn--utama" id="t-simpan" disabled>Tambah item</button></footer>`);

  const val = (id) => ($(`#t-${id}`, panel) ? $(`#t-${id}`, panel).value : "");
  const tampilLangkah = (n) => { langkah = n; panel.dataset.langkah = n; $$("#t-nav li", panel).forEach((li) => li.classList.toggle("is-aktif", +li.dataset.n === n)); };

  // ---------- bangun bagian yang bergantung pada lini ----------
  function gambarForm() {
    $("#t-sub", panel).textContent = belum ? "Belum diatur (buat lini nanti)" : liniId ? namaLini(liniId) : "Pilih lini bisnis dulu";
    $("#t-simpan", panel).disabled = !liniId && !belum;
    const cfg = konfigLini(liniId);
    const rute = cfg.jenis === "rute";

    // vendor: hanya yang relevan untuk lini ini; ISL Internal dipilih lewat tombol Internal
    const vend = (belum || !liniId ? S.vendor.filter((v) => v.aktif !== false) : vendorUntukLini(S.vendor, S.tarif, liniId)).filter((v) => v.id !== VENDOR_INTERNAL.id);
    const pilihLama = val("vendor");
    $("#t-vendor", panel).innerHTML = `<option value="">Pilih vendor…</option>${vend.map((v) => `<option value="${e(v.id)}">${e(v.nama || v.id)}</option>`).join("")}<option value="__baru__">＋ Vendor baru…</option>`;
    if (pilihLama) $("#t-vendor", panel).value = pilihLama;

    if (!liniId && !belum) {
      $("#t-layanan", panel).innerHTML = `<p class="mr-hint mr-f--lebar">Pilih lini bisnis dulu.</p>`;
      $("#t-harga", panel).innerHTML = "";
      return;
    }
    const lokasiField = (id, label, dl, wajib) => `
      <div class="mr-f" data-w="${id}"><span>${label}${wajib ? " *" : ""}</span>${htmlCombo(`t-${id}`, { placeholder: "Ketik atau pilih" })}<small class="mr-hint" id="h-${id}"></small><input id="t-${id}-prov" placeholder="Provinsi (opsional)" hidden></div>`;
    const daftarRute = cfg.koleksi === "trucking_trailer_zona" ? S.ref.zona : S.ref.lokasiDistribusi;
    const lokasiHtml = rute
      ? `${lokasiField("asal", "Asal / pick up (opsional)")}${lokasiField("tujuan", "Tujuan", "", true)}`
      : htmlFasilitas("t", liniId, S, "", { kosong: cfg.lokasi ? "Pilih…" : "Tidak terikat lokasi", label: cfg.lokasi === "open_yard" ? "Lokasi open yard" : "Lokasi / fasilitas", wajib: !!cfg.lokasi });
    const namaLayanan = [...new Set(S.tarif.filter((t) => t.liniBisnisId === liniId).map((t) => t.layananNama).filter(Boolean))];
    $("#t-layanan", panel).innerHTML = `
      <div class="mr-f mr-f--lebar" data-w="nama"><span>Nama layanan *</span>${htmlCombo("t-nama", { placeholder: liniId === "open_yard" ? "Mis. Storage per m2 per bulan" : rute ? "Mis. Trucking 20ft Priok ke Cikarang" : "Mis. Storage Dry 20ft", hint: "Nama yang sama dengan layanan yang sudah ada otomatis memakai kodenya." })}</div>
      ${lokasiHtml}
      <p class="mr-galat mr-f--lebar" ${S.ref.gagal && (rute || cfg.lokasi === "open_yard") ? "" : "hidden"}>Daftar zona/lokasi yang sudah ada gagal dimuat. Nama yang diketik dianggap baru; kalau ternyata sudah ada, tidak akan ditimpa.</p>`;

    pasangCombo($("#t-nama-wrap", panel), () => namaLayanan.map((n) => ({ nama: n })));
    if (rute) ["asal", "tujuan"].forEach((id) => pasangCombo($(`#t-${id}-wrap`, panel), () => daftarRute.map((z) => ({ nama: z.nama }))));
    const lama = { modal: val("modal"), jsaran: val("jsaran"), manual: $("#t-jsaran", panel) ? $("#t-jsaran", panel).dataset.manual : "", metode: val("metode"), catatan: val("catatan"), satuan: val("satuan") };
    const s = susunSatuan(liniId, S.satuan);
    const daftarSatuan = () => { const x = susunSatuan(liniId, S.satuan); return [...x.utama, ...x.lain]; };
    const bawaan = (S.satuan.find((x) => (x.kode || x.id) === s.bawaan) || {}).nama || "";
    $("#t-harga", panel).innerHTML = `
      <div class="mr-form">
        <label class="mr-f mr-f--lebar"><span>Satuan *</span>${htmlPilihSatuan("t-satuan", lama.satuan || bawaan)}</label>
        <label class="mr-f"><span>Modal (Rupiah)</span><div class="mr-f__awalan"><span class="mr-f__rp">Rp</span><input id="t-modal" inputmode="decimal" placeholder="Belum diisi" value="${e(lama.modal)}"></div></label>
        <label class="mr-f"><span>Harga jual rekomendasi (Rp)</span><div class="mr-f__awalan"><span class="mr-f__rp">Rp</span><input id="t-jsaran" inputmode="decimal" placeholder="Otomatis dari modal + markup" value="${e(lama.jsaran)}" ${lama.manual ? 'data-manual="1"' : ""}></div></label>
        <p class="mr-hint mr-f--lebar" id="t-margin">Isi modal untuk melihat margin.</p>
        ${liniId === LINI_ASING ? htmlNilaiAsing("t") : ""}
        <details class="mr-lainnya mr-f--lebar"><summary>Lainnya (metode harga, catatan)</summary><div class="mr-form" style="margin-top:10px">
          <label class="mr-f mr-f--lebar"><span>Metode harga</span><select id="t-metode">${METODE_HARGA.map((m) => `<option value="${m.v}" ${m.v === lama.metode ? "selected" : ""}>${m.t}</option>`).join("")}</select></label>
          <label class="mr-f mr-f--lebar"><span>Catatan</span><textarea id="t-catatan" rows="2">${e(lama.catatan)}</textarea></label>
        </div></details>
      </div>
      <div class="mr-kunci"><small>Kunci item</small><code id="t-kunci">—</code><p class="mr-galat" id="t-galat" hidden></p></div>`;
    pasangPilihSatuan($("#t-satuan-wrap", panel), daftarSatuan);
    if (liniId === LINI_ASING) pasangNilaiAsing(panel, "t");
    if (!rute) pasangFasilitas(panel, "t", liniId, { S, DB, onBaru: (id, nama) => { pilihFasilitasBaru(panel, "t", id, nama); segarkan(); } });
    segarkan();
  }

  // ---------- baca isian ----------
  const ambilV = () => ({
    nama: val("nama"), lokasi: val("lokasi"),
    asal: val("asal"), asalProvinsi: val("asal-prov"), tujuan: val("tujuan"), tujuanProvinsi: val("tujuan-prov"),
  });

  // Vendor yang diketik tapi sudah ada (di lini lain) dipakai ulang, bukan dibuat dobel.
  const vendorTerpilih = () => {
    const tambahLini = (ada) => !belum && !!liniId && !(ada.liniBisnis || []).includes(liniId) && (ada.liniBisnis || []).length > 0;
    if (sumber === "internal") {
      const ada = S.vendor.find((x) => x.id === VENDOR_INTERNAL.id);
      return ada ? { id: ada.id, baru: false, nama: ada.nama, tambahLini: tambahLini(ada) } : { id: VENDOR_INTERNAL.id, baru: true, nama: VENDOR_INTERNAL.nama, internal: true };
    }
    const pilih = val("vendor");
    if (pilih === "__baru__") {
      const nama = val("vendorBaru").trim();
      if (!nama) return { id: "", baru: true, nama: "" };
      const ada = S.vendor.find((x) => x.id === slug(nama) || String(x.nama).trim().toLowerCase() === nama.toLowerCase());
      return ada ? { id: ada.id, baru: false, nama: ada.nama, tambahLini: tambahLini(ada) } : { id: slug(nama), baru: true, nama };
    }
    return { id: pilih, baru: false, nama: "" };
  };

  // satuan diketik bebas: yang belum ada didaftarkan saat tarif disimpan
  const satuanTerpilih = () => {
    const r = resolveSatuan(val("satuan"), S.satuan);
    return r.kosong ? { kode: "", baru: true, nama: "" } : { kode: r.kode, baru: r.baru, nama: r.nama };
  };

  // angka opsional: "" = kosong; tidak valid = pesan salah
  const angka = (id, label, positif) => {
    const mentah = val(id).trim();
    if (mentah === "") return { val: null };
    const p = parseAngka(mentah);
    return !p.ok || (positif && p.val <= 0) ? { salah: `${label} "${mentah}" ${positif ? "harus angka lebih dari 0" : "bukan angka"}` } : { val: p.val };
  };

  // pesan salah per langkah (dipakai tombol Lanjut dan Simpan)
  function cek(n) {
    if (n === 1) {
      const s = [];
      if (!liniId && !belum) s.push("pilih lini bisnis");
      const v = vendorTerpilih();
      if (!v.id) s.push(sumber === "vendor" && val("vendor") === "__baru__" ? "isi nama vendor baru" : "pilih vendor");
      return s;
    }
    if (n === 2) return (liniId || belum) ? bangunItem(liniId, ambilV(), ref()).salah || [] : [];
    const s = [];
    if (!satuanTerpilih().kode) s.push("isi satuan");
    [angka("modal", "modal"), angka("jsaran", "harga jual rekomendasi", true)].forEach((a) => a.salah && s.push(a.salah));
    return s;
  }

  // ---------- segarkan tampilan sesuai isian ----------
  function segarkan() {
    $$("#t-sumber .mr-seg__btn", panel).forEach((b) => b.classList.toggle("is-aktif", b.dataset.sumber === sumber));
    $('[data-w="vendor"]', panel).hidden = sumber !== "vendor";
    $('[data-w="vendorBaru"]', panel).hidden = !(sumber === "vendor" && val("vendor") === "__baru__");
    $('[data-w="internal"]', panel).hidden = sumber !== "internal";
    if (!liniId && !belum) return;
    const cfg = konfigLini(liniId);

    // harga jual rekomendasi otomatis (modal + markup lini) selama belum diubah manual, dan margin
    const modal = angka("modal", "modal").val;
    const pct = markupLini(liniId, S.lini);
    const js = $("#t-jsaran", panel);
    if (js && !js.dataset.manual) { const sj = saranJual(modal, pct); js.value = sj ? formatInputAngka(sj) : ""; }
    const jual = angka("jsaran", "jual", true).val;
    const m = $("#t-margin", panel);
    if (m) m.textContent = modal > 0 && jual ? `Margin ${formatRp(jual - modal)} · ${(((jual - modal) / jual) * 100).toFixed(1).replace(".", ",")}% dari harga jual (markup lini ${pct}% → saran ${formatRp(saranJual(modal, pct))}). ${js && js.dataset.manual ? "Harga manual ini dipakai di quotation." : "Otomatis mengikuti markup lini di quotation."}` : "Isi modal untuk melihat margin; harga jual rekomendasi terisi otomatis dan bisa diubah.";

    // petunjuk lokasi/zona: terdaftar atau baru
    const daftarRef = cfg.jenis === "rute" ? (cfg.koleksi === "trucking_trailer_zona" ? S.ref.zona : S.ref.lokasiDistribusi) : S.ref.openYard;
    ["asal", "tujuan"].forEach((id) => {
      const inp = $(`#t-${id}`, panel), h = $(`#h-${id}`, panel), prov = $(`#t-${id}-prov`, panel);
      if (!inp || !h) return;
      const t = inp.value.trim();
      if (!t) { h.textContent = ""; if (prov) prov.hidden = true; return; }
      const n = t.toLowerCase();
      const ada = daftarRef.find((d) => String(d.nama).trim().toLowerCase() === n || d.id === slug(t));
      h.innerHTML = ada ? `✓ Terdaftar${ada.provinsi ? ` · ${e(ada.provinsi)}` : ""}` : "＋ Baru, akan didaftarkan otomatis";
      h.className = `mr-hint ${ada ? "mr-hint--ok" : "mr-hint--baru"}`;
      if (prov) prov.hidden = !!ada;
    });

    // kunci & duplikat
    const hasil = bangunItem(liniId, ambilV(), ref());
    const vend = vendorTerpilih();
    const sat = satuanTerpilih().kode;
    const g = $("#t-galat", panel), elK = $("#t-kunci", panel);
    if (!g) return;
    if (hasil.salah || !vend.id || !sat) { elK.textContent = "Lengkapi isian dulu"; g.hidden = true; return; }
    const kunci = buatKunci(liniId, vend.id, hasil.lokasiId, hasil.layanan, hasil.dimensi, sat, null);
    elK.textContent = kunci;
    if (peta().has(kunci)) {
      g.innerHTML = "Item dengan kunci ini <b>sudah ada</b>. Cari di tabel lalu edit angkanya, atau ubah isian agar berbeda.";
      g.hidden = false;
      return;
    }
    const mirip = cariMirip(S.tarif, { kunci, liniBisnisId: liniId, vendorId: vend.id, satuanKode: sat, lokasiId: hasil.lokasiId, layanan: hasil.layanan, layananNama: hasil.layananNama, dimensi: hasil.dimensi });
    if (mirip.length) {
      g.innerHTML = `<b>Mungkin dobel.</b> Vendor ini sudah punya tarif mirip: ${mirip.slice(0, 3).map((t) => `<b>${e(t.layananNama || t.layanan)}</b>`).join(", ")}${mirip.length > 3 ? ` dan ${mirip.length - 3} lainnya` : ""}. Kalau sama, edit tarif itu saja. Kalau memang berbeda, tetap bisa disimpan.`;
      g.hidden = false;
    } else g.hidden = true;
  }

  // ---------- simpan ----------
  async function simpan() {
    const gl = $("#t-galat-l", panel);
    const salah = [1, 2, 3].flatMap(cek);
    const asing = liniId === LINI_ASING ? bacaNilaiAsing(panel, "t") : { ok: true, val: null };
    if (!asing.ok) salah.push(asing.pesan);
    if (salah.length) {
      gl.textContent = `Belum bisa disimpan: ${salah.join("; ")}.`;
      gl.hidden = false;
      if (langkah === 3 && [1, 2].some((n) => cek(n).length)) tampilLangkah(cek(1).length ? 1 : 2);
      return;
    }
    gl.hidden = true;
    const hasil = bangunItem(liniId, ambilV(), ref());
    const vend = vendorTerpilih();
    const satPilih = satuanTerpilih(), sat = satPilih.kode;
    const modal = angka("modal", "modal").val;
    // hanya angka yang diketik user yang disimpan; kalau otomatis, quotation menghitung modal + markup lini saat dipakai
    const jualSaran = $("#t-jsaran", panel).dataset.manual ? angka("jsaran", "jual", true).val : null;
    const kunci = buatKunci(liniId, vend.id, hasil.lokasiId, hasil.layanan, hasil.dimensi, sat, null);
    if (peta().has(kunci)) return segarkan();
    const mirip = cariMirip(S.tarif, { kunci, liniBisnisId: liniId, vendorId: vend.id, satuanKode: sat, lokasiId: hasil.lokasiId, layanan: hasil.layanan, layananNama: hasil.layananNama, dimensi: hasil.dimensi });
    if (mirip.length && !(await konfirmasi("Tetap tambah tarif?", `Vendor ini sudah punya tarif mirip:<ul class="mr-konfirm__daftar">${mirip.slice(0, 5).map((t) => `<li>${e(t.layananNama || t.layanan)} <span class="mr-sub" style="display:inline">· ${e(t.kunci)}</span></li>`).join("")}</ul>Simpan hanya kalau layanannya memang berbeda.`, "Tetap simpan"))) return;

    const baris = {
      liniBisnisId: liniId,
      vendorId: vend.id,
      lokasiId: hasil.lokasiId,
      layanan: hasil.layanan,
      layananNama: hasil.layananNama,
      dimensi: hasil.dimensi,
      satuanKode: sat,
      mataUang: "IDR",
      nilaiAsing: asing.val,
      modal,
      hargaJualSaran: jualSaran,
      metodeHarga: val("metode"),
      hargaJualReferensi: null,
      referensiSumber: null,
      customerId: null,
      berlakuDari: null,
      berlakuSampai: null,
      aktif: true,
      catatan: val("catatan").trim(),
    };

    const tombol = $("#t-simpan", panel);
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";
    const sudah = [];
    try {
      if (satPilih.baru) {
        await DB.buatJikaBelumAda("satuan_baku", satPilih.kode, { kode: satPilih.kode, nama: satPilih.nama }, { oleh: S.user.email });
        S.satuan.push({ id: satPilih.kode, kode: satPilih.kode, nama: satPilih.nama });
        sudah.push(`satuan ${satPilih.nama}`);
      }
      if (vend.baru) {
        const data = { nama: vend.nama, namaLengkap: "", liniBisnis: belum ? [] : [liniId], terminBayar: "", kontak: "", aktif: true, catatan: vend.internal ? "Vendor tetap untuk tarif internal." : "Dibuat dari form tambah tarif." };
        const t = await DB.simpanVendor(vend.id, data, { baru: true, oleh: S.user.email });
        S.vendor.push(t);
        sudah.push(`vendor ${vend.nama}`);
      } else if (vend.tambahLini) {
        const lama = S.vendor.find((x) => x.id === vend.id);
        const t = await DB.simpanVendor(vend.id, { liniBisnis: [...(lama.liniBisnis || []), liniId] }, { baru: false, oleh: S.user.email });
        Object.assign(lama, t);
        sudah.push(`${lama.nama} ditambahkan ke lini ${namaLini(liniId)}`);
      }
      for (const lb of hasil.lokasiBaru) {
        await DB.buatJikaBelumAda(lb.koleksi, lb.id, lb.data, { oleh: S.user.email });
        const entri = { id: lb.id, nama: lb.data.namaZona || lb.data.namaLokasi, provinsi: lb.data.provinsi || "" };
        if (lb.koleksi === "trucking_trailer_zona") S.ref.zona.push(entri);
        else if (lb.koleksi === "open_yard_lokasi") S.ref.openYard.push({ ...lb.data, id: lb.id, nama: entri.nama, provinsi: "" });
        else S.ref.lokasiDistribusi.push(entri);
        sudah.push(`${lb.koleksi === "trucking_trailer_zona" ? "zona" : lb.koleksi === "open_yard_lokasi" ? "lokasi (draf)" : "lokasi"} ${entri.nama}`);
      }
      const h = await DB.terapkanBanyak([{ jenis: "baru", kunci, baris }], { oleh: S.user.email, sumber: "tambah_baru" });
      if (h.gagal.length) throw new Error(h.gagal[0].alasan);
      S.tarif.push({ ...baris, kunci, id: kunci, diperbaruiPada: new Date().toISOString(), diperbaruiOleh: S.user.email });
      toast(`<b>Item baru tersimpan dan terverifikasi.</b> ${e(baris.layananNama)}${sudah.length ? `<br>Ikut didaftarkan: ${e(sudah.join(", "))}.` : ""}`, "ok");
      tutupLayer();
      render();
    } catch (err) {
      const catatan = sudah.length ? `<br>Sudah berhasil dibuat sebelum gagal: ${e(sudah.join(", "))}. Aman, tidak akan dobel kalau kamu coba lagi.` : "";
      toast(`<b>GAGAL menyimpan item baru.</b><br>${e(err.message)}${catatan}`, "bahaya");
      if (sudah.length) render();
      tombol.disabled = false;
      tombol.textContent = "Tambah item";
    }
  }

  // ---------- pasang event ----------
  panel.addEventListener("focusin", (ev) => { if (ev.target.id === "t-modal" || ev.target.id === "t-jsaran") pasangRibuan(ev.target); });
  panel.addEventListener("input", (ev) => {
    if (ev.target.id === "t-jsaran") ev.target.dataset.manual = ev.target.value.trim() ? "1" : "";
    segarkan();
  });
  panel.addEventListener("change", (ev) => {
    if (ev.target.id === "t-lini") {
      belum = ev.target.value === "__belum__";
      liniId = belum ? "" : ev.target.value;
      gambarForm();
      return;
    }
    segarkan();
  });
  panel.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-sumber]");
    if (!b) return;
    sumber = b.dataset.sumber;
    segarkan();
  });
  $("#t-lanjut", panel).onclick = () => {
    const s = cek(langkah);
    const gl = $("#t-galat-l", panel);
    gl.hidden = !s.length;
    if (s.length) gl.textContent = `Lengkapi dulu: ${s.join("; ")}.`;
    else tampilLangkah(langkah + 1);
  };
  $("#t-kembali", panel).onclick = () => { $("#t-galat-l", panel).hidden = true; tampilLangkah(langkah - 1); };
  $("#t-simpan", panel).onclick = simpan;
  // HP: footer tersembunyi saat keyboard terbuka, jadi Enter = Lanjut
  panel.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.defaultPrevented && ev.target.tagName === "INPUT" && langkah < 3 && matchMedia("(max-width:760px)").matches) { ev.preventDefault(); $("#t-lanjut", panel).click(); } });
  tampilLangkah(1);
  gambarForm();
}
