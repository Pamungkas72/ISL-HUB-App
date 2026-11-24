// Profil Tracking Daily Job: formulir pengiriman (desktop satu form berbagian, HP tiga langkah). Tampilan murni; logika di daily-job.js.
import { e } from "./ui.js";
import { SUBDIVISI, TAGIHAN, BAYAR, subdivisiDari, rinci, jenisDariKategori } from "./daily-job-tracking-hitung.js";
import * as TL from "./daily-job-trailer-hitung.js";
import * as DZ from "./daily-job-distribusi-hitung.js";

const f = (lab, isi, kelas = "") => `<label class="mr-f ${kelas}"><span>${lab}</span>${isi}</label>`;
const inp = (id, v, ph = "", ekstra = "") => `<input id="${id}" value="${e(v ?? "")}" placeholder="${e(ph)}" ${ekstra}>`;
/** Chip pilihan tunggal; nilainya disimpan di data-<k> pada #dj-form (lihat aksi t-set). */
export const chipPil = (k, nilai, items) => `<div class="mr-seg dj-seg" role="group">${items.map(([v, l]) => `<button type="button" class="mr-chip${v === nilai ? " is-aktif" : ""}" data-dj="t-set" data-k="${k}" data-v="${v}">${l}</button>`).join("")}</div>`;
const opsiKat = (sub, pilih) => (SUBDIVISI[sub] || SUBDIVISI.kecil).kategori.map((k) => `<option${k === pilih ? " selected" : ""}>${e(k)}</option>`).join("");
const rp = (n) => (n ? Number(n).toLocaleString("id-ID") : "");
export const dataFormTracking = (d) => { const r = rinci(d), sub = r.sub || subdivisiDari(d.kategori) || "kecil"; return { sub, bayar: r.bayar || "cash", pod: r.pod || "belum", tagihan: r.tagihan || "belum" }; };

/** Isi formulir Tracking. c: { picList, vendorList, berkas, lain, tunda } = potongan bersama dengan formulir lain. */
export function htmlFormTracking(d, c) {
  const r = rinci(d), st = dataFormTracking(d);
  return `<div class="dj-lng" data-lng="1"><h4 class="dj-lng__h">1. Pengiriman</h4>
    ${f("Customer *", inp("djt-cust", d.customer, "Nama customer"), "dj-lebar")}
    <div class="mr-f dj-lebar"><span>Subdivisi</span>${chipPil("sub", st.sub, Object.entries(SUBDIVISI).map(([k, s]) => [k, s.nama]))}</div>
    <div class="dj-besar${st.sub === "besar" ? "" : " dj-sembunyi"}">${f("Asal *", inp("djt-asal", r.asal, "mis. Lini 1 Tj. Priok"))}${f("Tujuan *", inp("djt-tujuan", r.tujuan, "mis. Cikarang"))}</div>
    <div class="dj-kecil dj-lebar${st.sub === "besar" ? " dj-sembunyi" : ""}"><div class="dj-lng__sub">Titik pick up dan drop <small id="djt-pola" class="mr-sub"></small></div><div id="djt-titik">${htmlTitik(titikAwal(d))}</div><div class="dj-ttk__tb"><button type="button" class="mr-btn" data-dj="t-tambah" data-v="P">+ Pick up</button><button type="button" class="mr-btn" data-dj="t-tambah" data-v="D">+ Drop</button></div></div>
    <div class="dj-kecil${st.sub === "besar" ? " dj-sembunyi" : ""}">${f("No. DO / surat jalan *", inp("djt-do", r.noDo, "mis. DO-2026-1187", 'data-huruf="besar"'))}</div>${f("Kategori armada / jenis shipment *", `<select id="djf-kat">${opsiKat(st.sub, d.kategori)}</select>`)}
    <div class="dj-besar dj-lebar${st.sub === "besar" ? "" : " dj-sembunyi"}"><div class="dj-lng__sub">Dokumen dan nomor referensi * <small class="mr-sub">isi minimal satu; surat jalan boleh menyusul</small></div><div id="djt-dok">${htmlDokRows(dokAwal(d))}</div><div class="dj-dok__tb"><button type="button" class="mr-btn" data-dj="t-dok-tambah" data-v="">+ Dokumen</button><span id="djt-dok-saran">${htmlSaranDok(d.kategori)}</span></div>
    <div class="dj-lng__sub">Kontainer</div><div class="dj-g2">${f("No. kontainer", inp("djt-kont", r.kontainer, "mis. ABCU 1234567", 'data-huruf="besar"'))}${f("Ukuran", `<select id="djt-ukuran"><option value="">–</option>${TL.UKURAN.map((u) => `<option${u === r.ukuran ? " selected" : ""} value="${u}">${u === "40HC" ? "40 HC" : u + "\u2032"}</option>`).join("")}</select>`)}</div></div>
    <div class="dj-kecil${st.sub === "besar" ? " dj-sembunyi" : ""}">${f("Tipe bak", `<select id="djt-bak"><option value="">–</option>${DZ.TIPE_BAK.map((b) => `<option${b === r.bak ? " selected" : ""}>${b}</option>`).join("")}</select>`)}</div>
    ${f("Tanggal kirim", `<input type="date" id="djt-kirim" value="${e(r.tglKirim || d.tglMasuk || "")}">`)}${f(c.targetLabel, `<input type="date" id="djf-target" value="${e(d.tglTarget || "")}"${c.targetKunci ? " disabled" : ""}>`)}
    ${f("PIC", `<input id="djf-pic" list="djf-piclist" value="${e(d.pic || "")}"><datalist id="djf-piclist">${c.picList.map((p) => `<option value="${e(p)}">`).join("")}</datalist>`)}</div>
  <div class="dj-lng" data-lng="2"><h4 class="dj-lng__h">2. Armada dan vendor</h4>
    ${f("Vendor <small>kosongkan atau isi \"Internal\" bila armada sendiri</small>", `<input id="djt-vendor" list="djt-vendorlist" value="${e(r.vendor || "")}" placeholder="Nama vendor"><datalist id="djt-vendorlist">${c.vendorList.map((p) => `<option value="${e(p)}">`).join("")}</datalist>`, "dj-lebar")}
    ${f("Nama driver", inp("djt-driver", r.driver))}${f("Telepon driver", inp("djt-telp", r.telp, "", 'inputmode="tel"'))}${f("Plat nomor", inp("djt-plat", r.plat, "mis. B 1234 XYZ", 'data-huruf="besar"'))}</div>
  <div class="dj-lng" data-lng="3"><h4 class="dj-lng__h">3. Biaya dan status</h4>
    <div id="djt-uj" class="dj-uj dj-lebar" hidden></div>
    <div class="mr-f dj-lebar"><span>Pembayaran vendor</span>${chipPil("bayar", st.bayar, Object.entries(BAYAR))}</div>
    ${f("Cost (Rp) <small id=\"djt-costinfo\">uang jalan bila armada internal</small>", inp("djt-cost", rp(r.cost), "mis. 2.500.000", 'inputmode="numeric"'))}
    <div class="mr-f dj-lebar"><span>POD</span>${chipPil("pod", st.pod, [["belum", "Belum kembali"], ["kembali", "Sudah kembali"]])}</div>
    ${f("Tanggal POD kembali", `<input type="date" id="djt-tglpod" value="${e(r.tglPod || "")}">`, "dj-tglpod" + (st.pod === "kembali" ? "" : " dj-sembunyi"))}
    <div class="dj-lng__dua">${f("Tanggal bayar vendor <small>kosongkan bila belum dibayar</small>", `<input type="date" id="djt-tglbayar" value="${e(r.tglBayar || "")}">`)}${f("Janji POD kembali <small>wajib bila sudah dibayar sebelum POD kembali</small>", `<input type="date" id="djt-janji" value="${e(r.janjiPod || "")}">`)}</div>
    ${c.status}${c.tunda}
    ${f("Catatan", `<textarea id="djf-desk" rows="2">${e(d.deskripsi || "")}</textarea>`, "dj-lebar")}${c.berkas}${c.lain}</div>`;
}

/** Dokumen dan nomor referensi Trailer (impor/repo/ekspor/domestik): satu baris = jenis dokumen + nomor. Judul job memakai nomor pertama; surat jalan boleh menyusul (wajib saat POD kembali). */
export const DOK_JENIS = ["SPPB", "TILA", "PIB", "BL", "DO pelayaran", "Surat jalan", "PEB", "NPE", "Booking", "Lainnya"];
const SARAN = { impor: ["SPPB", "TILA", "PIB", "BL", "DO pelayaran", "Surat jalan"], repo: ["SPPB", "TILA", "PIB", "BL", "DO pelayaran", "Surat jalan"], ekspor: ["PEB", "NPE", "Booking", "Surat jalan"], domestik: ["Surat jalan"] };
export const saranDok = (kat) => SARAN[jenisDariKategori(kat)] || SARAN.impor;
/** Baris awal: dari rinci.dokNomor; job lama dengan noDo jadi satu baris Surat jalan; job baru satu baris kosong berjenis saran pertama. */
export const dokAwal = (d) => { const r = rinci(d); return Array.isArray(r.dokNomor) && r.dokNomor.length ? r.dokNomor : r.noDo ? [{ jenis: "Surat jalan", no: r.noDo }] : [{ jenis: saranDok(d.kategori || "Trailer Impor")[0], no: "" }]; };
export const htmlDokRows = (rows) => rows.map((x, i) => `<div class="dj-dok" data-i="${i}"><select class="djt-dj" aria-label="Jenis dokumen">${[...new Set([...DOK_JENIS, x.jenis])].map((j) => `<option${j === x.jenis ? " selected" : ""}>${e(j)}</option>`).join("")}</select><input class="djt-dn" data-huruf="besar" value="${e(x.no || "")}" placeholder="Nomor dokumen" aria-label="Nomor dokumen"><button type="button" class="mr-ikonbtn" data-dj="t-dok-hapus" data-i="${i}" aria-label="Hapus dokumen">\u2715</button></div>`).join("");
export const htmlSaranDok = (kat) => saranDok(kat).slice(0, 5).map((j) => `<button type="button" class="dj-chip dj-chip--mu dj-chip--btn" data-dj="t-dok-tambah" data-v="${e(j)}">+ ${e(j)}</button>`).join(" ");
/** Ringkasan untuk judul dan kolom No. DO: nomor pertama yang terisi; jenis ikut ditulis kecuali Surat jalan dan DO pelayaran. */
export const ringkasDok = (rows) => { const x = (rows || []).find((y) => String(y.no || "").trim()); return x ? (["Surat jalan", "DO pelayaran"].includes(x.jenis) ? x.no.trim() : `${x.jenis} ${x.no.trim()}`) : ""; };
/** Titik awal formulir Distribusi: dari rinci.titik; job lama (asal/tujuan) jadi satu pick up dan satu drop; job baru dua titik kosong. */
export const titikAwal = (d) => { const r = rinci(d), t = DZ.titikDari(d); return t.length ? t : [{ t: "P", nama: r.asal || "", kota: "", selesai: null }, { t: "D", nama: r.tujuan || "", kota: "", selesai: null }]; };
/** Baris editor titik; titik yang sudah selesai terkunci (tidak bisa dihapus). */
export function htmlTitik(titik) {
  const n = { P: 0, D: 0 };
  return titik.map((x, i) => { n[x.t]++; const jml = titik.filter((y) => y.t === x.t).length; return `<div class="dj-ttk" data-i="${i}" data-t="${x.t}" data-selesai="${x.selesai || ""}"><span class="dj-chip dj-chip--${x.t === "P" ? "info" : "ok"}">${x.t === "P" ? "Pick up" : "Drop"} ${n[x.t]}</span><input class="djt-tn" value="${e(x.nama || "")}" placeholder="Nama lokasi" aria-label="Nama lokasi"><input class="djt-tk" value="${e(x.kota || "")}" placeholder="Kota" aria-label="Kota"><button type="button" class="mr-ikonbtn" data-dj="t-hapus" data-i="${i}" ${jml < 2 || x.selesai ? "disabled" : ""} aria-label="Hapus titik">✕</button></div>`; }).join("");
}
const fmtW = (w) => { const d = new Date(String(w).length === 16 ? w + ":00+07:00" : w); return isNaN(d) ? "" : d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(".", ":"); };
/** Panel detail Trailer: stepper tahap bertanda waktu, tombol tahap berikut, risiko POD, dan daftar dokumen. ubah = boleh mengubah job. */
export function htmlTrailerDetail(j, ubah, now) {
  const r = rinci(j), jn = TL.jenisTrailer(j); if (!jn) return "";
  const t = TL.tahapJenis(jn), n = TL.kemajuan(j), b = TL.tahapBerikut(j), id = e(j.id), umur = TL.umurPod(j, now);
  const stp = t.map(([k, l], i) => `<li class="${i < n ? "is-ok" : i === n ? "is-now" : ""}"><i></i><div><b>${l}</b><small>${r.tahap && r.tahap[k] ? fmtW(r.tahap[k]) : i === n ? "Berikutnya" : "–"}</small></div></li>`).join("");
  const risiko = TL.dibayarTanpaPod(j) ? `<p class="dj-risiko dj-risiko--bahaya"><b>Berisiko:</b> sudah dibayar ${e(r.tglBayar)}, POD belum kembali${umur ? ` (${umur} hari sejak selesai operasional)` : ""}.${r.janjiPod ? ` Janji POD: ${e(r.janjiPod)}.` : " Isi janji POD kembali."}</p>` : TL.operasionalSelesai(j) && !TL.podKembali(j) ? `<p class="dj-risiko">POD belum kembali${umur ? ` · ${umur} hari` : ""}. Syarat penagihan ke customer.</p>` : "";
  const dok = TL.JENIS[jn].dok.map((x, i) => `<button type="button" class="mr-chip${r.dok && r.dok[i] ? " is-aktif" : ""}" ${ubah ? `data-dj="t-dok" data-id="${id}" data-i="${i}"` : "disabled"} aria-pressed="${!!(r.dok && r.dok[i])}">${r.dok && r.dok[i] ? "✓ " : ""}${e(x)}</button>`).join("");
  return `<div class="mr-kartu dj-kartu dj-trl"><h3>Tahap shipment · ${TL.JENIS[jn].nama}</h3><ol class="dj-stp">${stp}</ol>
    ${ubah ? `<div class="dj-trl__aksi">${b ? `<button type="button" class="mr-btn mr-btn--utama" data-dj="t-tahap" data-id="${id}">Tandai ${e(b[1])} selesai</button>` : ""}${n ? `<button type="button" class="mr-btn" data-dj="t-undo" data-id="${id}">Batalkan tahap terakhir</button>` : ""}</div>` : ""}${risiko}
    <h3>Dokumen</h3><div class="dj-seg mr-seg">${dok}</div></div>`;
}

export const rpJt = (n) => (n >= 1e6 ? "Rp " + (Math.round(n / 1e5) / 10).toLocaleString("id-ID") + " jt" : "Rp " + Math.round(n).toLocaleString("id-ID"));
export const jt = (n) => (n ? (Math.round(n / 1e4) / 100).toLocaleString("id-ID") + " jt" : "–");
export const tab = (judul, kolom, baris, ket = "") => `<section class="mr-kartu dj-kartu"><div class="dj-kh"><h3>${judul}</h3>${ket ? `<small class="mr-sub">${ket}</small>` : ""}</div><div class="dj-tw"><table class="dj-tbl"><thead><tr>${kolom.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${baris.length ? baris.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${kolom.length}" class="mr-sub">Belum ada data pada periode ini.</td></tr>`}</tbody></table></div></section>`;
/** Performa Tracking Trailer: volume order, jenis, vendor, rute, cost, pembanding tarif; risiko POD dalam satu strip. k = hitungTrailer, banding = bandingTarif, bulanan = label minggu. */
export function htmlPerformaTrailer(k, banding, labelMinggu) {
  const kpi = (jd, nilai, ket, kelas = "") => `<div class="dj-kpi dj-kpi--statis ${kelas}"><span>${jd}</span><b>${nilai}</b><small>${ket}</small></div>`;
  const risiko = k.tanpaPod || k.tungguPod || k.siapTagih ? `<div class="dj-tind">${k.tanpaPod ? `<span class="dj-chip dj-chip--bahaya">Dibayar, POD belum <b>${k.tanpaPod}</b> · ${rpJt(k.nilaiTanpaPod)}</span>` : ""}${k.tungguPod ? `<span class="dj-chip dj-chip--warn">Tunggu POD <b>${k.tungguPod}</b></span>` : ""}${k.siapTagih ? `<span class="dj-chip dj-chip--ok">Siap ditagih <b>${k.siapTagih}</b></span>` : ""}</div>` : "";
  const mingguan = k.perMinggu.map((m) => [e(labelMinggu(m.k)), m.order, m.ritase]);
  const bd = banding.map((b) => `<div class="dj-bt"><b>${e(b.rute)}</b><span>${b.pelaku.map((o) => `<i class="${o.nama === b.murah ? "is-murah" : ""}">${e(o.nama)} ${jt(o.rata)}${o.nama === b.murah ? " ✓" : ""}</i>`).join("")}</span></div>`).join("");
  return `<div id="dj-dash">${risiko}<div class="dj-kpis">${kpi("Order masuk", k.order, `${k.ritase} terlaksana${k.persenTerlaksana != null ? ` (${k.persenTerlaksana}%)` : ""}`)}${kpi("Ritase", k.ritase, "shipment berjalan")}${kpi("Cost total", rpJt(k.cost), `Vendor ${jt(k.costVendor)} · uang jalan ${jt(k.costInternal)}`)}${kpi("Cost / ritase", rpJt(k.costPerRitase), "rata-rata")}</div>
  <div class="dj-grid2e">${tab("Volume order per minggu", ["Minggu", "Order", "Ritase"], mingguan)}${tab("Jenis pengiriman", ["Jenis", "Order", "Ritase", "Vendor / Int.", "Cost", "Per rit"], k.perJenis.map((o) => [e(o.nama), o.order, o.ritase, `${o.vendor} / ${o.internal}`, jt(o.cost), jt(o.perRitase)]))}</div>
  <div class="dj-grid2e">${tab("Vendor yang dipakai", ["Vendor", "Ritase", "Cost", "Tarif rata²", "POD telat"], k.perVendor.map((o) => [e(o.nama), o.ritase, jt(o.cost), jt(o.perRitase), o.pod ? `<b class="dj-merah">${o.pod}</b>` : 0]))}${tab("Rute teratas", ["Rute", "Ritase", "Cost", "Per ritase"], k.perRute.map((o) => [e(o.nama), o.ritase, jt(o.cost), jt(o.perRitase)]))}</div>
  <section class="mr-kartu dj-kartu"><h3>Tarif per rute: siapa termurah</h3>${bd || `<p class="mr-sub">Muncul bila satu rute dikerjakan oleh dua vendor atau lebih (atau internal).</p>`}</section></div>`;
}

/** Panel detail Truk Distribusi: stepper (Siap, Pick up, Drop, POD), daftar titik bertanda waktu, tombol langkah berikut, dan risiko POD. */
export function htmlDistribusiDetail(j, ubah, now) {
  const r = rinci(j); if (r.jenis !== "distribusi") return "";
  const n = DZ.kemajuan(j), b = DZ.berikut(j), id = e(j.id), titik = DZ.titikDari(j), nama = ["Siap", "Pick up", "Drop", "POD"];
  const stp = DZ.TAHAP.map(([k, l], i) => `<li class="${i < n ? "is-ok" : i === n ? "is-now" : ""}"><i></i><div><b>${l}</b><small>${i === n ? e(DZ.labelTahap(j)) : i < n ? "Selesai" : "–"}</small></div></li>`).join("");
  const tt = titik.map((x) => `<li class="${x.selesai ? "is-ok" : ""}"><span class="dj-chip dj-chip--${x.t === "P" ? "info" : "ok"}">${x.t === "P" ? "Pick up" : "Drop"}</span><div><b>${e(x.nama || "–")}</b><small>${e([x.kota, x.selesai ? fmtW(x.selesai) : ""].filter(Boolean).join(" · "))}</small></div><span>${x.selesai ? "✓" : ""}</span></li>`).join("");
  const risiko = DZ.dibayarTanpaPod(j) ? `<p class="dj-risiko dj-risiko--bahaya"><b>Berisiko:</b> sudah dibayar ${e(r.tglBayar)}, POD belum kembali.${r.janjiPod ? ` Janji POD: ${e(r.janjiPod)}.` : " Isi janji POD kembali."}</p>` : n === 3 ? `<p class="dj-risiko">POD belum kembali. Syarat penagihan ke customer.</p>` : "";
  return `<div class="mr-kartu dj-kartu dj-trl"><h3>Pengiriman · ${e(DZ.pola(j) || "")} · ${e([j.kategori, r.bak].filter(Boolean).join(" "))}</h3><ol class="dj-stp">${stp}</ol><h3>Titik</h3><ul class="dj-ttkl">${tt}</ul>
    ${ubah ? `<div class="dj-trl__aksi">${b ? `<button type="button" class="mr-btn mr-btn--utama" data-dj="t-titik" data-id="${id}">Tandai ${e(b.label)} selesai</button>` : ""}${n > 1 || r.pod === "kembali" ? `<button type="button" class="mr-btn" data-dj="t-undo" data-id="${id}">Batalkan langkah terakhir</button>` : ""}</div>` : ""}${risiko}</div>`;
}

/** Performa "Semua" subdivisi: ringkasan gabungan Tracking Trailer dan Truk Distribusi; rincian ada di tiap subdivisi. kt = hitungTrailer, kd = hitungDistribusi, armada = { lewat, urusan }. */
export function htmlPerformaGabungan(kt, kd, armada) {
  const tanpa = kt.tanpaPod + kd.tanpaPod, tunggu = kt.tungguPod + kd.tungguPod, order = kt.order + kd.order, rit = kt.ritase + kd.ritase, cost = kt.cost + kd.cost;
  const risiko = tanpa || tunggu || kt.siapTagih ? `<div class="dj-tind">${tanpa ? `<span class="dj-chip dj-chip--bahaya">Dibayar, POD belum <b>${tanpa}</b></span>` : ""}${tunggu ? `<span class="dj-chip dj-chip--warn">Tunggu POD <b>${tunggu}</b></span>` : ""}${kt.siapTagih ? `<span class="dj-chip dj-chip--ok">Siap ditagih (Trailer) <b>${kt.siapTagih}</b></span>` : ""}</div>` : "";
  const kpi = (jd, n, ket) => `<div class="dj-kpi dj-kpi--statis"><span>${jd}</span><b>${n}</b><small>${ket}</small></div>`;
  const baris = (l) => l.map(([a, b]) => `<div class="dj-uj__r"><span>${a}</span><b>${b}</b></div>`).join("");
  const kartu = (jd, sub, isi) => `<section class="mr-kartu dj-kartu"><div class="dj-kh"><h3>${jd}</h3><button type="button" class="mr-btn" data-dj="sub" data-v="${sub}">Lihat rincian</button></div>${isi}</section>`;
  return `<div id="dj-dash">${risiko}<div class="dj-kpis">${kpi("Order masuk", order, `${rit} terlaksana`)}${kpi("Ritase", rit, `Trailer ${kt.ritase} · Distribusi ${kd.ritase}`)}${kpi("Cost total", rpJt(cost), `Trailer ${jt(kt.cost)} · Distribusi ${jt(kd.cost)}`)}${kpi("Cost / ritase", rpJt(rit ? Math.round(cost / rit) : 0), "rata-rata gabungan")}</div>
  <div class="dj-grid2e">${kartu("Tracking Trailer", "besar", baris([["Order masuk", kt.order], ["Ritase", kt.ritase], ["Cost total", rpJt(kt.cost)], ["Cost / ritase", rpJt(kt.costPerRitase)], ["Tunggu POD", kt.tungguPod], ["Dibayar, POD belum", kt.tanpaPod ? `<span class="dj-merah">${kt.tanpaPod} · ${rpJt(kt.nilaiTanpaPod)}</span>` : 0]]))}
  ${kartu("Truk Distribusi", "kecil", baris([["Order masuk", kd.order], ["Ritase", `${kd.ritase} · ${kd.drop} titik drop`], ["Cost total", rpJt(kd.cost)], ["Cost / ritase", rpJt(kd.costPerRitase)], ["Dibayar, POD belum", kd.tanpaPod ? `<span class="dj-merah">${kd.tanpaPod}</span>` : 0], ["Armada: urusan 30 hari", armada.lewat ? `<span class="dj-merah">${armada.urusan} · ${armada.lewat} lewat</span>` : armada.urusan]]))}</div></div>`;
}
