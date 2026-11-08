// ===========================================================
// FORM TAMBAH ITEM — isiannya menyesuaikan lini bisnis.
// Aturan tiap lini ada di form-lini.js. File ini hanya tampilan
// dan alur simpan.
//
// Alur simpan (berurutan, tiap langkah diverifikasi dari server):
//   1. vendor baru  2. zona/lokasi baru  3. tarif.
//   Kalau langkah 3 gagal, langkah 1-2 tetap ada (tidak dobel saat
//   dicoba lagi) dan kamu diberi tahu jelas.
// ===========================================================
import { e, $, $$, toast, bukaLayer, tutupLayer, konfirmasi } from "./ui.js";
import { ikon } from "./ikon.js";
import { slug, buatKunci, parseAngka, METODE_HARGA, pasangRibuan } from "./kunci.js";
import { LINI_ASING, htmlNilaiAsing, pasangNilaiAsing, bacaNilaiAsing } from "./asing.js";
import { htmlPilihSatuan, pasangPilihSatuan, resolveSatuan } from "./satuan-combo.js";
import { htmlFasilitas, pasangFasilitas, pilihFasilitasBaru } from "./fasilitas.js";
import {
  konfigLini, bangunItem, susunSatuan, KATEGORI_TRUCKING, UKURAN_KONTAINER, KENDARAAN, BODY, TERMINAL_SARAN,
  KEPALA, BUNTUT, JENIS_MUATAN, ITEM_DOMESTIK, batasBerat, kelasDariBerat, peringatanKombinasi,
} from "./form-lini.js";
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

const opt = (daftar, pilih) => daftar.map(([v, t]) => `<option value="${e(v)}" ${v === pilih ? "selected" : ""}>${e(t)}</option>`).join("");

export function bukaTambahItem({ S, DB, peta, namaLini, namaLokasi, render }) {
  const liniAktif = S.lini.filter((l) => l.aktif !== false);
  const liniTetap = S.f.lini !== "semua";
  let liniId = liniTetap ? S.f.lini : "";
  // "Belum diatur": tarif boleh disimpan tanpa lini. Lininya dilengkapi nanti lewat Edit tarif.
  let belum = false;
  let panel;

  const ref = () => ({ zona: S.ref.zona, lokasiDistribusi: S.ref.lokasiDistribusi, openYard: S.ref.openYard, rows: S.tarif, vendorId: vendorTerpilih().id });

  panel = bukaLayer(`
    <header class="mr-panel__kepala"><div><h2>Tambah tarif</h2><p class="mr-sub" id="t-sub">${liniTetap ? e(namaLini(liniId)) : "Pilih lini bisnis dulu"}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi">
      ${liniTetap ? "" : `<label class="mr-f mr-f--lebar" style="margin-bottom:16px"><span>Lini bisnis *</span><select id="t-lini"><option value="">Pilih lini bisnis…</option>${liniAktif.map((l) => `<option value="${e(l.id)}">${e(namaLini(l.id))}</option>`).join("")}<option value="__belum__">Belum diatur (buat lini nanti)</option></select><small class="mr-hint">${liniAktif.length ? "Lini bisnis bisa dilengkapi nanti lewat Edit tarif." : "Belum ada lini bisnis. Tarif tetap bisa disimpan sekarang, lini dibuat nanti."}</small></label>`}
      <div id="t-isi"></div>
    </div>
    <footer class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" id="t-simpan" disabled>Tambah item</button></footer>`);

  // ---------- bangun form untuk lini terpilih ----------
  function gambarForm() {
    const isi = $("#t-isi", panel);
    $("#t-sub", panel).textContent = belum ? "Belum diatur (buat lini nanti)" : liniId ? namaLini(liniId) : "Pilih lini bisnis dulu";
    $("#t-simpan", panel).disabled = !liniId && !belum;
    delete panel.dataset.kategori;
    delete panel.dataset.berat;
    if (!liniId && !belum) {
      isi.innerHTML = "";
      return;
    }
    const cfg = konfigLini(liniId);
    const rowsLini = S.tarif.filter((t) => t.liniBisnisId === liniId);

    // vendor: HANYA yang relevan untuk lini ini (vendor lini lain tidak ditampilkan)
    const vend = belum ? S.vendor.filter((v) => v.aktif !== false) : vendorUntukLini(S.vendor, S.tarif, liniId);
    const vendorOpt = `<option value="">Pilih vendor…</option>${vend.map((v) => `<option value="${e(v.id)}">${e(v.nama || v.id)}</option>`).join("")}<option value="__tanpa__">Belum ditentukan</option><option value="__baru__">＋ Vendor baru…</option>`;

    const daftarSatuan = () => { const s = susunSatuan(liniId, S.satuan); return [...s.utama, ...s.lain]; };
    const bawaan = (S.satuan.find((x) => (x.kode || x.id) === susunSatuan(liniId, S.satuan).bawaan) || {}).nama || "";

    const lokasiField = (id, label, dl) => `
      <div class="mr-f" data-w="${id}"><span data-lb>${label}</span><input id="t-${id}" list="dl-${dl}" autocomplete="off" placeholder="Ketik atau pilih"><small class="mr-hint" id="h-${id}"></small><input id="t-${id}-prov" placeholder="Provinsi (opsional)" hidden></div>`;

    let identitas = "";
    if (cfg.jenis === "trucking") {
      identitas = `
        <div class="mr-f mr-f--lebar" data-w="kategori"><span>Kategori pengiriman *</span>
          <div class="mr-seg" id="t-kategori-seg">${Object.entries(KATEGORI_TRUCKING).map(([k, v]) => `<button type="button" class="mr-seg__btn" data-kat="${k}">${v.nama}</button>`).join("")}</div>
        </div>
        <div class="mr-pola mr-f--lebar" id="t-pola" hidden></div>
        <label class="mr-f mr-f--lebar" data-w="itemJenis" hidden><span>Jenis item Domestik</span><select id="t-itemJenis">${opt(ITEM_DOMESTIK)}</select><small id="t-itemJenis-bantu"></small></label>
        <label class="mr-f" data-w="namaPaket" hidden><span>Nama paket proyekan *</span><input id="t-namaPaket" placeholder="Mis. Pindah pabrik" autocomplete="off"></label>
        <label class="mr-f" data-w="tipeTitik" hidden><span>Jenis titik *</span><select id="t-tipeTitik"><option value="">Pilih…</option><option value="pickup">Pick up tambahan</option><option value="drop">Drop tambahan</option></select></label>
        <label class="mr-f" data-w="muatan"><span>Jenis muatan</span><select id="t-muatan">${opt(JENIS_MUATAN)}</select></label>
        <label class="mr-f" data-w="ukuran"><span>Ukuran kontainer *</span><select id="t-ukuran"><option value="">Pilih…</option>${opt(UKURAN_KONTAINER)}</select></label>
        <label class="mr-f" data-w="kelasMuatan" hidden><span>Kelas / dimensi unit *</span><input id="t-kelasMuatan" placeholder="Mis. excavator 30 ton" autocomplete="off"></label>
        <div class="mr-f mr-f--lebar" data-w="berat"><span>Kelas berat</span>
          <div class="mr-berat"><div class="mr-seg" id="t-berat-seg"><button type="button" class="mr-seg__btn is-aktif" data-berat="normal">Normal</button><button type="button" class="mr-seg__btn" data-berat="berat">Cargo berat</button></div>
          <input id="t-beratKotor" inputmode="decimal" placeholder="Berat kotor (ton), opsional"></div>
          <small id="t-berat-bantu">Cargo berat = berat kotor di atas ${batasBerat("default")} ton. Isi berat kotor untuk memilih kelas otomatis.</small></div>
        <label class="mr-f" data-w="kepala"><span>Kepala (head)</span><select id="t-kepala">${opt(KEPALA)}</select></label>
        <label class="mr-f" data-w="buntut"><span>Buntut</span><select id="t-buntut">${opt(BUNTUT)}</select></label>
        <div class="mr-peringatan mr-f--lebar" id="t-peringatan" hidden></div>
        ${lokasiField("asal", "Asal / pick up", "zona")}
        <label class="mr-f" data-w="terminal"><span data-lb>Pelabuhan/terminal</span><input id="t-terminal" list="dl-terminal" value="Tanjung Priok" autocomplete="off"><small>Tanjung Priok = bawaan.</small></label>
        ${lokasiField("zona", "Kota/zona", "zona")}
        <label class="mr-f" data-w="depoEmpty"><span data-lb>Depo empty</span><input id="t-depoEmpty" list="dl-depo" autocomplete="off" placeholder="Opsional"></label>
        <datalist id="dl-zona">${S.ref.zona.map((z) => `<option value="${e(z.nama)}">`).join("")}</datalist>
        <datalist id="dl-terminal">${TERMINAL_SARAN.map((x) => `<option value="${e(x)}">`).join("")}</datalist>
        <datalist id="dl-depo">${(S.ref.depo.length ? S.ref.depo : S.vendor.filter((v) => (v.liniBisnis || []).includes("depo"))).map((v) => `<option value="${e(v.nama)}">`).join("")}</datalist>`;
    } else if (cfg.jenis === "distribusi") {
      identitas = `
        ${lokasiField("asal", "Pick up di (asal) *", "lok")}
        ${lokasiField("tujuan", "Tujuan *", "lok")}
        <label class="mr-f" data-w="kendaraan"><span>Jenis kendaraan *</span><select id="t-kendaraan"><option value="">Pilih…</option>${opt(KENDARAAN)}</select></label>
        <label class="mr-f" data-w="body"><span>Body *</span><select id="t-body">${opt(BODY, "box")}</select></label>
        <datalist id="dl-lok">${S.ref.lokasiDistribusi.map((z) => `<option value="${e(z.nama)}">`).join("")}</datalist>`;
    } else {
      let lokasiHtml = "";
      if (cfg.lokasi === "pilih" || cfg.lokasi === "open_yard") {
        // fasilitas dari halaman Lokasi (sesuai jenis lini), bisa didaftarkan langsung dari form
        lokasiHtml = htmlFasilitas("t", liniId, S, "", { kosong: "Pilih…", label: cfg.lokasi === "open_yard" ? "Lokasi open yard" : "Lokasi / fasilitas", wajib: true });
      }
      identitas = `
        ${lokasiHtml}
        <label class="mr-f mr-f--lebar" data-w="nama"><span>Nama layanan *</span><input id="t-nama" list="dl-layanan" autocomplete="off" placeholder="${liniId === "open_yard" ? "Mis. Storage per m2 per bulan" : "Mis. Storage Dry 20ft"}"><small>Nama yang sama dengan layanan yang sudah ada otomatis memakai kodenya.</small></label>
        <datalist id="dl-layanan">${[...new Set(rowsLini.map((t) => t.layananNama).filter(Boolean))].map((n) => `<option value="${e(n)}">`).join("")}</datalist>`;
    }

    isi.innerHTML = `
      <div class="mr-form">
        ${identitas}
        <label class="mr-f" data-w="vendor"><span>Vendor *</span><select id="t-vendor">${vendorOpt}</select><small>Hanya vendor milik lini ini yang ditampilkan.</small></label>
        <label class="mr-f" data-w="vendorBaru" hidden><span>Nama vendor baru *</span><input id="t-vendorBaru" placeholder="Mis. PT Maju Jaya" autocomplete="off"><small>Otomatis didaftarkan ke tab Vendor dan lini ini. Lengkapi identitasnya nanti di tab Vendor.</small></label>
        <label class="mr-f" data-w="satuan"><span>Satuan *</span>${htmlPilihSatuan("t-satuan", bawaan)}</label>
        <label class="mr-f"><span>Modal (Rupiah)</span><div class="mr-f__awalan"><span class="mr-f__rp">Rp</span><input id="t-modal" inputmode="decimal" placeholder="Belum diisi"></div></label>
        <label class="mr-f"><span>Harga jual rekomendasi (Rp)</span><div class="mr-f__awalan"><span class="mr-f__rp">Rp</span><input id="t-jsaran" inputmode="decimal" placeholder="Kosong = modal + markup lini"></div><small>Dipakai sebagai saran harga jual saat membuat quotation.</small></label>
        ${liniId === LINI_ASING ? htmlNilaiAsing("t") : ""}
        <label class="mr-f"><span>Metode harga</span><select id="t-metode">${METODE_HARGA.map((m) => `<option value="${m.v}">${m.t}</option>`).join("")}</select></label>
        <label class="mr-f mr-f--lebar"><span>Catatan</span><textarea id="t-catatan" rows="2"></textarea></label>
      </div>
      <p class="mr-galat" id="t-peringatan-ref" ${S.ref.gagal && (cfg.jenis === "trucking" || cfg.jenis === "distribusi" || cfg.lokasi === "open_yard") ? "" : "hidden"}>Daftar zona/lokasi yang sudah ada gagal dimuat. Nama yang diketik dianggap baru; kalau ternyata sudah ada, tidak akan ditimpa.</p>
      <div class="mr-kunci"><small>Kunci item</small><code id="t-kunci">—</code><p class="mr-galat" id="t-galat" hidden></p></div>`;

    pasangPilihSatuan($("#t-satuan-wrap", panel), daftarSatuan);
    if (liniId === LINI_ASING) pasangNilaiAsing(panel, "t");
    pasangFasilitas(panel, "t", liniId, { S, DB, onBaru: (id, nama) => { pilihFasilitasBaru(panel, "t", id, nama); segarkan(); } });
    segarkan();
  }


  // ---------- baca isian ----------
  const val = (id) => ($(`#t-${id}`, panel) ? $(`#t-${id}`, panel).value : "");
  function ambilV() {
    const cfg = konfigLini(liniId);
    const v = {};
    if (cfg.jenis === "trucking") {
      v.kategori = panel.dataset.kategori || "";
      v.itemJenis = v.kategori === "domestik" ? val("itemJenis") || "utama" : "utama";
      v.muatan = val("muatan") || "kontainer";
      v.ukuran = val("ukuran");
      v.kelasMuatan = val("kelasMuatan");
      v.kelasBerat = panel.dataset.berat || "normal";
      v.kepala = val("kepala");
      v.buntut = val("buntut");
      v.terminal = val("terminal");
      v.zona = val("zona");
      v.zonaProvinsi = val("zona-prov");
      v.asal = val("asal");
      v.asalProvinsi = val("asal-prov");
      v.depoEmpty = val("depoEmpty");
      v.tipeTitik = val("tipeTitik");
      v.namaPaket = val("namaPaket");
    } else if (cfg.jenis === "distribusi") {
      v.asal = val("asal");
      v.tujuan = val("tujuan");
      v.asalProvinsi = val("asal-prov");
      v.tujuanProvinsi = val("tujuan-prov");
      v.kendaraan = val("kendaraan");
      v.body = val("body");
    } else {
      v.lokasi = val("lokasi");
      v.nama = val("nama");
      v.dimensi = {}; // dimensi tidak diisi lagi di form tambah item
    }
    return v;
  }

  // Vendor yang diketik tapi sudah ada (di lini lain) dipakai ulang, bukan dibuat dobel.
  const vendorTerpilih = () => {
    const pilih = val("vendor");
    if (pilih === "__tanpa__") return { id: "", baru: false, nama: "", tanpa: true };
    if (pilih === "__baru__") {
      const nama = val("vendorBaru").trim();
      if (!nama) return { id: "", baru: true, nama: "" };
      const ada = S.vendor.find((x) => x.id === slug(nama) || String(x.nama).trim().toLowerCase() === nama.toLowerCase());
      return ada ? { id: ada.id, baru: false, nama: ada.nama, tambahLini: !belum && !(ada.liniBisnis || []).includes(liniId) && (ada.liniBisnis || []).length > 0 } : { id: slug(nama), baru: true, nama };
    }
    return { id: pilih, baru: false, nama: "" };
  };

  // Satuan yang diketik manual: dipakai ulang bila namanya sudah ada, kalau belum didaftarkan otomatis saat item disimpan.
  // satuan diketik bebas: yang belum ada didaftarkan saat tarif disimpan
  const satuanTerpilih = () => {
    const r = resolveSatuan(val("satuan"), S.satuan);
    return r.kosong ? { kode: "", baru: true, nama: "" } : { kode: r.kode, baru: r.baru, nama: r.nama };
  };

  // ---------- segarkan tampilan sesuai isian ----------
  function segarkan() {
    if (!liniId && !belum) return;
    const cfg = konfigLini(liniId);
    const v = ambilV();

    const wb = $('[data-w="vendorBaru"]', panel);
    if (wb) wb.hidden = val("vendor") !== "__baru__";

    if (cfg.jenis === "trucking") {
      const kat = KATEGORI_TRUCKING[v.kategori];
      const dom = v.kategori === "domestik";
      $$("#t-kategori-seg .mr-seg__btn", panel).forEach((b) => b.classList.toggle("is-aktif", b.dataset.kat === v.kategori));
      const pola = $("#t-pola", panel);
      pola.hidden = !kat;
      if (kat) pola.innerHTML = `<div class="mr-pola__judul">Pola ${e(kat.nama)}</div><ol class="mr-pola__langkah">${kat.langkah.map((l, i) => `<li><span>${i + 1}</span>${e(l)}</li>`).join("")}</ol>`;

      const titik = dom && v.itemJenis === "titik_tambahan";
      const proyek = dom && v.itemJenis === "proyekan";
      const nonKon = v.muatan === "non_kontainer";
      const tampil = {
        itemJenis: !!kat && dom,
        namaPaket: proyek,
        tipeTitik: titik,
        muatan: !!kat,
        ukuran: !!kat && !nonKon,
        kelasMuatan: !!kat && nonKon,
        berat: !!kat && !nonKon,
        kepala: !!kat,
        buntut: !!kat,
        asal: !!kat && dom && !titik,
        terminal: !!kat && kat.terminal,
        zona: !!kat && !titik,
        depoEmpty: !!kat && kat.depo,
      };
      Object.entries(tampil).forEach(([id, t]) => {
        const w = $(`[data-w="${id}"]`, panel);
        if (w) w.hidden = !t;
      });
      if (kat) {
        const setLb = (id, teks) => {
          const lb = $(`[data-w="${id}"] [data-lb]`, panel);
          if (lb && teks) lb.textContent = teks + (id === "zona" || id === "asal" ? " *" : "");
        };
        setLb("terminal", kat.label.terminal);
        setLb("zona", kat.label.zona);
        setLb("depoEmpty", kat.label.depoEmpty);
        setLb("asal", kat.label.asal);
      }
      const bantu = $("#t-itemJenis-bantu", panel);
      if (bantu) bantu.textContent = titik ? "Biaya tiap titik pick up/drop tambahan. Quotation menjumlahkan rute utama + titik tambahan." : proyek ? "Satu harga paket untuk pekerjaan khusus (metode harga: proyekan)." : "Harga rute utama per trip.";
      if (proyek && $("#t-metode", panel).dataset.sentuh !== "1") $("#t-metode", panel).value = "proyekan";

      // peringatan kombinasi (tidak memblokir)
      const per = $("#t-peringatan", panel);
      const daftar = kat ? peringatanKombinasi(v) : [];
      per.hidden = !daftar.length;
      per.innerHTML = daftar.map((p) => `<div>${ikon("peringatan", 14)}<span>${e(p)}</span></div>`).join("");
      $$("#t-berat-seg .mr-seg__btn", panel).forEach((b) => b.classList.toggle("is-aktif", b.dataset.berat === v.kelasBerat));
    }

    // petunjuk lokasi/zona: terdaftar atau baru
    const daftarRef = cfg.jenis === "trucking" ? S.ref.zona : cfg.jenis === "distribusi" ? S.ref.lokasiDistribusi : S.ref.openYard;
    ["zona", "asal", "tujuan", "lokasi"].forEach((id) => {
      const inp = $(`#t-${id}`, panel);
      const h = $(`#h-${id}`, panel);
      if (!inp || !h || inp.tagName === "SELECT") return;
      const prov = $(`#t-${id}-prov`, panel);
      const t = inp.value.trim();
      if (!t) {
        h.textContent = "";
        if (prov) prov.hidden = true;
        return;
      }
      const n = t.toLowerCase();
      const ada = daftarRef.find((d) => String(d.nama).trim().toLowerCase() === n || d.id === slug(t));
      if (ada) {
        h.innerHTML = `✓ Terdaftar${ada.provinsi ? ` · ${e(ada.provinsi)}` : ""}`;
        h.className = "mr-hint mr-hint--ok";
        if (prov) prov.hidden = true;
      } else {
        h.innerHTML = cfg.lokasi === "open_yard" ? "＋ Lokasi baru, dibuat sebagai Draf" : "＋ Baru, akan didaftarkan otomatis";
        h.className = "mr-hint mr-hint--baru";
        if (prov) prov.hidden = cfg.lokasi === "open_yard";
      }
    });

    // kunci & duplikat
    const hasil = bangunItem(liniId, v, ref());
    const vend = vendorTerpilih();
    const satPilih = satuanTerpilih(), sat = satPilih.kode;
    const g = $("#t-galat", panel);
    const elK = $("#t-kunci", panel);
    if (hasil.salah || (!vend.id && !vend.tanpa) || !sat) {
      elK.textContent = "Lengkapi isian dulu";
      g.hidden = true;
      return;
    }
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
    const g = $("#t-galat", panel);
    const v = ambilV();
    const hasil = bangunItem(liniId, v, ref());
    const vend = vendorTerpilih();
    const satPilih = satuanTerpilih(), sat = satPilih.kode;
    const salah = hasil.salah ? [...hasil.salah] : [];
    if (!vend.id && !vend.tanpa) salah.push(val("vendor") === "__baru__" ? "isi nama vendor baru" : "pilih vendor");
    if (!sat) salah.push("isi satuan");
    let modal = null;
    const mentah = val("modal").trim();
    if (mentah !== "") {
      const p = parseAngka(mentah);
      if (!p.ok) salah.push(`modal "${mentah}" bukan angka`);
      else modal = p.val;
    }
    let jualSaran = null;
    const mentahJual = val("jsaran").trim();
    if (mentahJual !== "") {
      const p = parseAngka(mentahJual);
      if (!p.ok || p.val <= 0) salah.push(`harga jual rekomendasi "${mentahJual}" harus angka lebih dari 0`);
      else jualSaran = p.val;
    }
    const asing = liniId === LINI_ASING ? bacaNilaiAsing(panel, "t") : { ok: true, val: null };
    if (!asing.ok) salah.push(asing.pesan);
    if (salah.length) {
      g.textContent = `Belum bisa disimpan: ${salah.join("; ")}.`;
      g.hidden = false;
      return;
    }
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
        const data = { nama: vend.nama, namaLengkap: "", liniBisnis: belum ? [] : [liniId], terminBayar: "", kontak: "", aktif: true, catatan: "Dibuat dari form tambah tarif." };
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
    if (ev.target.id === "t-beratKotor") {
      const n = Number(String(ev.target.value).replace(",", "."));
      if (Number.isFinite(n) && n > 0) {
        panel.dataset.berat = kelasDariBerat(n, val("ukuran"));
        const b = $("#t-berat-bantu", panel);
        if (b) b.textContent = `${n} ton → ${panel.dataset.berat === "berat" ? "Cargo berat" : "Normal"} (batas ${batasBerat(val("ukuran"))} ton, berat kotor).`;
      }
    }
    segarkan();
  });
  panel.addEventListener("change", (ev) => {
    if (ev.target.id === "t-lini") {
      belum = ev.target.value === "__belum__";
      liniId = belum ? "" : ev.target.value;
      gambarForm();
      return;
    }
    if (ev.target.id === "t-metode") ev.target.dataset.sentuh = "1";
    segarkan();
  });
  panel.addEventListener("click", (ev) => {
    const b = ev.target.closest(".mr-seg__btn");
    if (!b) return;
    if (b.dataset.kat) panel.dataset.kategori = b.dataset.kat;
    if (b.dataset.berat) {
      panel.dataset.berat = b.dataset.berat;
      const bk = $("#t-beratKotor", panel);
      if (bk) bk.value = "";
      const bb = $("#t-berat-bantu", panel);
      if (bb) bb.textContent = `Cargo berat = berat kotor di atas ${batasBerat(val("ukuran"))} ton. Isi berat kotor untuk memilih kelas otomatis.`;
    }
    segarkan();
  });
  $("#t-simpan", panel).onclick = simpan;
  if (liniId) gambarForm();
}
