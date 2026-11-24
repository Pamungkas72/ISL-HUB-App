// Profil Tracking Daily Job: formulir pengiriman (desktop satu form berbagian, HP tiga langkah). Tampilan murni; logika di daily-job.js.
import { e } from "./ui.js";
import { SUBDIVISI, TAGIHAN, BAYAR, subdivisiDari, rinci, jenisDariKategori } from "./daily-job-tracking-hitung.js";
import * as TL from "./daily-job-trailer-hitung.js";
import * as DZ from "./daily-job-distribusi-hitung.js";
import * as P from "./daily-job-pod.js";

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
    ${f(`<span id="djt-katlab">${st.sub === "besar" ? "Jenis shipment *" : "Jenis armada *"}</span>`, `<select id="djf-kat">${opsiKat(st.sub, d.kategori)}</select>`, "dj-lebar")}
    <div class="dj-besar${st.sub === "besar" ? "" : " dj-sembunyi"}">${f("Asal *", inp("djt-asal", r.asal, "mis. Lini 1 Tj. Priok"))}${f("Tujuan *", inp("djt-tujuan", r.tujuan, "mis. Cikarang"))}<div id="djt-multi" class="dj-lebar"${d.kategori === "Trailer Domestik" ? "" : " hidden"}><div id="djt-tujlain">${htmlTujuanLain(r.tujuanLain || [])}</div><div class="dj-ttk__tb"><button type="button" class="mr-btn" id="djt-tujtb" data-dj="t-tuj-tambah"${(r.tujuanLain || []).length >= TL.MAKS_TUJUAN - 1 ? " hidden" : ""}>+ Tujuan</button><small class="mr-sub">Multi drop, maks. ${TL.MAKS_TUJUAN} tujuan</small></div></div></div>
    <div class="dj-kecil dj-lebar${st.sub === "besar" ? " dj-sembunyi" : ""}"><div class="dj-lng__sub">Titik pick up dan drop <small id="djt-pola" class="mr-sub"></small></div><div id="djt-titik">${htmlTitik(titikAwal(d))}</div><div class="dj-ttk__tb"><button type="button" class="mr-btn" data-dj="t-tambah" data-v="P">+ Pick up</button><button type="button" class="mr-btn" data-dj="t-tambah" data-v="D">+ Drop</button></div></div>
    <div class="dj-kecil${st.sub === "besar" ? " dj-sembunyi" : ""}">${f("No. DO / surat jalan *", inp("djt-do", r.noDo, "mis. DO-2026-1187", 'data-huruf="besar"'))}</div>
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
    ${f("Tanggal transfer vendor <small>Cash; kosongkan bila belum. Resi POD dan bukti bayar dicatat di detail</small>", `<input type="date" id="djt-tglbayar" value="${e(r.tglBayar || "")}">`)}
    ${c.status}${c.tunda}
    ${f("Catatan", `<textarea id="djf-desk" rows="2">${e(d.deskripsi || "")}</textarea>`, "dj-lebar")}${c.berkas}${c.lain}</div>`;
}

/** Baris tujuan tambahan (Tujuan 2 dst.) shipment Domestik multi drop. */
export const htmlTujuanLain = (l) => l.map((x, i) => `<div class="dj-tl" data-i="${i}"><span class="dj-chip dj-chip--ok">Tujuan ${i + 2}</span><input class="djt-tl" value="${e(x || "")}" placeholder="mis. Bekasi" aria-label="Tujuan ${i + 2}"><button type="button" class="mr-ikonbtn" data-dj="t-tuj-hapus" data-i="${i}" aria-label="Hapus tujuan ${i + 2}">\u2715</button></div>`).join("");
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
const tglP = (x) => (x ? new Date(String(x).slice(0, 10) + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const berkasLink = (l) => (l || []).map((b) => `<a href="${e(b.url)}" target="_blank" rel="noopener">${e(b.nama)}</a>`).join(" · ");
/** Kartu POD dan pembayaran. Internal: otomatis. Vendor TOP: POD kembali = beres. Vendor Cash: resi POD, transfer (bukti bayar), POD diterima. */
export function htmlPodBayar(j, ubah, opsSelesai, umur) {
  const r = rinci(j), c = P.cara(j), id = e(j.id), pk = r.podKirim || {}, ada = P.resiAda(j);
  if (c === "internal") return `<h3>POD dan pembayaran</h3><p class="dj-risiko">Armada internal: uang jalan dibayar sebelum berangkat, POD kembali otomatis saat tahap operasional terakhir selesai.</p>`;
  if (!opsSelesai && !P.podKembali(j)) return `<h3>POD dan pembayaran · vendor ${c === "top" ? "TOP" : "Cash"}</h3><p class="dj-risiko">Setelah operasional selesai: catat resi POD dari vendor${c === "cash" ? " lalu transfer pembayaran" : ""}.</p>`;
  const btn = (a, t, utama) => (ubah ? `<button type="button" class="mr-btn${utama ? " mr-btn--utama" : ""}" data-dj="${a}" data-id="${id}">${t}</button>` : "");
  const baris = (ok, lab, isi, aksi) => `<li class="${ok ? "is-ok" : ""}"><span class="dj-chip dj-chip--${ok ? "ok" : "mu"}">${lab}</span><div>${isi}</div>${aksi}</li>`;
  const resi = baris(ada, "Resi POD", ada ? `<b>${e([pk.ekspedisi, pk.resi].filter(Boolean).join(" · ") || "Resi terunggah")}</b><small>Dikirim ${e(tglP(pk.tgl))}${pk.berkas && pk.berkas.length ? " · " + berkasLink(pk.berkas) : ""}</small>` : `<b>Belum ada resi dari vendor</b><small>Vendor mengirim surat jalan lewat ekspedisi; catat resinya.</small>`, btn("t-resi", ada ? "Ubah" : "Catat resi POD", !ada));
  const bayar = c === "top" ? baris(false, "Bayar", `<b>TOP</b><small>Finance membayar sesuai tempo di luar sistem. Dianggap beres saat POD diterima.</small>`, "")
    : r.tglBayar ? baris(true, "Bayar", `<b>Ditransfer ${e(tglP(r.tglBayar))}</b><small>${r.buktiBayar && r.buktiBayar.length ? "Bukti: " + berkasLink(r.buktiBayar) : "Belum ada bukti bayar"}</small>`, btn("t-bayar", "Ubah", false))
    : baris(false, "Bayar", ada ? `<b>Perlu ditransfer ke vendor</b><small>Resi sudah ada; transfer lalu unggah bukti bayar.</small>` : `<b>Menunggu resi POD</b><small>Transfer dilakukan setelah resi ada.</small>`, ada ? btn("t-bayar", "Catat pembayaran", true) : "");
  const pod = baris(P.podKembali(j), "POD", P.podKembali(j) ? `<b>Diterima ${e(tglP(r.tglPod))}</b>` : `<b>Belum diterima</b><small>${umur ? umur + " hari sejak operasional selesai. " : ""}Tandai tahap POD di atas saat surat jalan sampai.</small>`, "");
  return `<h3>POD dan pembayaran · vendor ${c === "top" ? "TOP" : "Cash"}</h3><ul class="dj-ttkl dj-podbayar">${resi}${bayar}${pod}</ul>`;
}
const fmtW = (w) => { const d = new Date(String(w).length === 16 ? w + ":00+07:00" : w); return isNaN(d) ? "" : d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(".", ":"); };
/** Panel detail Trailer: stepper tahap bertanda waktu, tombol tahap berikut, risiko POD, dan daftar dokumen. ubah = boleh mengubah job. */
export function htmlTrailerDetail(j, ubah, now) {
  const r = rinci(j), jn = TL.jenisTrailer(j); if (!jn) return "";
  const t = TL.tahapJenis(jn), n = TL.kemajuan(j), b = TL.tahapBerikut(j), id = e(j.id), umur = TL.umurPod(j, now);
  const stp = t.map(([k, l], i) => `<li class="${i < n ? "is-ok" : i === n ? "is-now" : ""}"><i></i><div><b>${l}</b><small>${r.tahap && r.tahap[k] ? fmtW(r.tahap[k]) : i === n ? "Berikutnya" : "–"}</small></div></li>`).join("");
  const dok = TL.JENIS[jn].dok.map((x, i) => `<button type="button" class="mr-chip${r.dok && r.dok[i] ? " is-aktif" : ""}" ${ubah ? `data-dj="t-dok" data-id="${id}" data-i="${i}"` : "disabled"} aria-pressed="${!!(r.dok && r.dok[i])}">${r.dok && r.dok[i] ? "✓ " : ""}${e(x)}</button>`).join("");
  const tj = TL.semuaTujuan(j), titik = [["P", "Pick up", r.asal], ...tj.map((x) => ["D", "Drop", x])].map(([k, l, x]) => `<li><span class="dj-chip dj-chip--${k === "P" ? "info" : "ok"}">${l}</span><div><b>${e(x || "–")}</b></div><span></span></li>`).join("");
  return `<div class="mr-kartu dj-kartu dj-trl"><h3>Pengiriman · 1→${Math.max(1, tj.length)} · ${TL.JENIS[jn].nama}${r.ukuran ? ` ${r.ukuran === "40HC" ? "40 HC" : r.ukuran + "\u2032"}` : ""}</h3><ol class="dj-stp">${stp}</ol><h3>Titik</h3><ul class="dj-ttkl">${titik}</ul>
    ${ubah ? `<div class="dj-trl__aksi">${b ? `<button type="button" class="mr-btn mr-btn--utama" data-dj="t-tahap" data-id="${id}">Tandai ${e(b[1])} selesai</button>` : ""}${n ? `<button type="button" class="mr-btn" data-dj="t-undo" data-id="${id}">Batalkan tahap terakhir</button>` : ""}</div>` : ""}
    ${htmlPodBayar(j, ubah, TL.operasionalSelesai(j), umur)}<h3>Dokumen</h3><div class="dj-seg mr-seg">${dok}</div></div>`;
}

export const rpJt = (n) => (n >= 1e6 ? "Rp " + (Math.round(n / 1e5) / 10).toLocaleString("id-ID") + " jt" : "Rp " + Math.round(n).toLocaleString("id-ID"));
export const jt = (n) => (n ? (Math.round(n / 1e4) / 100).toLocaleString("id-ID") + " jt" : "–");
export const tab = (judul, kolom, baris, ket = "") => `<section class="mr-kartu dj-kartu"><div class="dj-kh"><h3>${judul}</h3>${ket ? `<small class="mr-sub">${ket}</small>` : ""}</div><div class="dj-tw"><table class="dj-tbl"><thead><tr>${kolom.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${baris.length ? baris.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${kolom.length}" class="mr-sub">Belum ada data pada periode ini.</td></tr>`}</tbody></table></div></section>`;
/** Panel detail Truk Distribusi: stepper (Siap, Pick up, Drop, POD), daftar titik bertanda waktu, tombol langkah berikut, dan risiko POD. */
export function htmlDistribusiDetail(j, ubah, now) {
  const r = rinci(j); if (r.jenis !== "distribusi") return "";
  const n = DZ.kemajuan(j), b = DZ.berikut(j), id = e(j.id), titik = DZ.titikDari(j), nama = ["Siap", "Pick up", "Drop", "POD"];
  const stp = DZ.TAHAP.map(([k, l], i) => `<li class="${i < n ? "is-ok" : i === n ? "is-now" : ""}"><i></i><div><b>${l}</b><small>${i === n ? e(DZ.labelTahap(j)) : i < n ? "Selesai" : "–"}</small></div></li>`).join("");
  const tt = titik.map((x) => `<li class="${x.selesai ? "is-ok" : ""}"><span class="dj-chip dj-chip--${x.t === "P" ? "info" : "ok"}">${x.t === "P" ? "Pick up" : "Drop"}</span><div><b>${e(x.nama || "–")}</b><small>${e([x.kota, x.selesai ? fmtW(x.selesai) : ""].filter(Boolean).join(" · "))}</small></div><span>${x.selesai ? "✓" : ""}</span></li>`).join("");
  return `<div class="mr-kartu dj-kartu dj-trl"><h3>Pengiriman · ${e(DZ.pola(j) || "")} · ${e([j.kategori, r.bak].filter(Boolean).join(" "))}</h3><ol class="dj-stp">${stp}</ol><h3>Titik</h3><ul class="dj-ttkl">${tt}</ul>
    ${ubah ? `<div class="dj-trl__aksi">${b ? `<button type="button" class="mr-btn mr-btn--utama" data-dj="t-titik" data-id="${id}">Tandai ${e(b.label)} selesai</button>` : ""}${n > 1 || r.pod === "kembali" ? `<button type="button" class="mr-btn" data-dj="t-undo" data-id="${id}">Batalkan langkah terakhir</button>` : ""}</div>` : ""}${htmlPodBayar(j, ubah, n >= 3, DZ.umurPod(j, now))}</div>`;
}
