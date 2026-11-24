// Tab Armada Truk Distribusi (tampilan murni): Perlu tindakan, Kendaraan (matriks kepatuhan), Sewa unit, Riwayat, dan isi panel formulir. Aturan: daily-job-distribusi-hitung.js.
import { e } from "./ui.js";
import * as DZ from "./daily-job-distribusi-hitung.js";
import { selisihHari, hariIni } from "./daily-job-hitung.js";

const IK = { kir: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 14l2 2 3.5-4"/>', stnk: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h8M8 14h5"/>', pajak: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>', servis: '<path d="M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2z"/>', visit: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' };
const WARNA = { lewat: "bahaya", mendesak: "bahaya", segera: "warn", bulan: "info", aman: "ok" };
const ikon = (n, w) => `<span class="dj-ai dj-ai--${w}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IK[n]}</svg></span>`;
const tglP = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "–");
const sisaTeks = (s) => (s < 0 ? `lewat ${-s} hari` : s === 0 ? "hari ini" : `${s} hari lagi`);
const chip = (k, t) => `<span class="dj-chip dj-chip--${k}">${t}</span>`;
export const SUB_ARMADA = [["tindakan", "Perlu tindakan"], ["kendaraan", "Kendaraan"], ["sewa", "Sewa unit"], ["riwayat", "Riwayat"]];
const AKSI = { kir: "Catat perpanjangan", stnk: "Catat perpanjangan", pajak: "Catat perpanjangan", servis: "Catat servis", visit: "Catat hasil visit" };
const ketTugas = (t) => (t.tipe === "visit" ? `${e(t.k.sewa.customer || "")} · ${e(t.k.sewa.kota || "")}` : t.tipe === "servis" ? [t.tgl ? "jadwal " + tglP(t.tgl) : "", t.sisaKm != null ? `${t.sisaKm <= 0 ? "lewat " + -t.sisaKm : "sisa " + t.sisaKm} km` : ""].filter(Boolean).join(" · ") : "berlaku " + tglP(t.tgl));

function tugasBaris(t, ubah) {
  return `<div class="dj-arm__t">${ikon(t.tipe, WARNA[t.tingkat])}<div class="dj-arm__i"><b>${t.nama} · ${e(t.k.plat)}</b><small>${sisaTeks(t.sisa)}${ketTugas(t) ? " · " + ketTugas(t) : ""} · ${e([t.k.jenisArmada, t.k.bak].filter(Boolean).join(" "))}</small></div>${ubah ? `<button type="button" class="mr-btn${t.tingkat === "lewat" ? " mr-btn--utama" : ""}" data-dj="arm-tugas" data-id="${e(t.k.id)}" data-v="${t.tipe}">${AKSI[t.tipe]}</button>` : ""}</div>`;
}
function tabTindakan(arm, now, ubah) {
  const l = DZ.tugasArmada(arm, now), kp = DZ.kepatuhan(arm, now), cnt = (t) => l.filter((x) => t.includes(x.tingkat)).length;
  const kpi = (j, n, k = "") => `<div class="dj-kpi dj-kpi--statis ${k}"><span>${j}</span><b>${n}</b></div>`;
  const grup = (j, items) => `<section class="mr-kartu dj-kartu"><div class="dj-kh"><h3>${j}</h3>${chip(items.length ? "warn" : "ok", items.length)}</div>${items.length ? items.map((t) => tugasBaris(t, ubah)).join("") : `<p class="mr-sub">Tidak ada.</p>`}</section>`;
  return `<div class="dj-kpis">${kpi("Lewat tempo", cnt(["lewat"]))}${kpi("≤ 7 hari", cnt(["mendesak"]))}${kpi("8–30 hari", cnt(["segera", "bulan"]))}${kpi("Kendaraan aktif", arm.filter((k) => k.aktif !== false).length)}</div>
  ${arm.length ? grup("Lewat dan ≤ 7 hari", l.filter((x) => x.tingkat === "lewat" || x.tingkat === "mendesak")) + grup("8 – 30 hari", l.filter((x) => x.tingkat === "segera" || x.tingkat === "bulan")) : `<section class="mr-kartu dj-kartu"><p class="mr-sub">Belum ada kendaraan. Tambah kendaraan untuk mendapat pengingat KIR, STNK, pajak, servis, dan visit sewa.</p></section>`}
  <p class="mr-sub dj-kp">KIR ${kp[0].lewat} lewat · STNK ${kp[1].lewat} lewat · Pajak ${kp[2].lewat} lewat · Servis ${kp[3].lewat} lewat</p>`;
}
const sel = (nilai, now) => { if (!nilai) return `<span class="mr-sub">–</span>`; const s = selisihHari(nilai, now), t = DZ.tingkat(s); return chip(WARNA[t], s < 0 ? `lewat ${-s} hr` : tglP(nilai)); };
function tabKendaraan(arm, now, ubah) {
  if (!arm.length) return `<section class="mr-kartu dj-kartu"><p class="mr-sub">Belum ada kendaraan.</p></section>`;
  const sv = (k) => { const x = DZ.servisDue(k, now); return x ? chip(WARNA[DZ.tingkat(x.sisa)], x.sisa < 0 ? "jatuh tempo" : k.servis.tglBerikut ? tglP(k.servis.tglBerikut) : `${x.sisaKm} km`) : `<span class="mr-sub">–</span>`; };
  const sw = (k) => (k.sewa ? chip("info", `${k.sewa.bentuk === "lepas" ? "Lepas kunci" : "Dengan driver"} · ${e(k.sewa.kota || "")}`) : `<span class="mr-sub">Internal</span>`);
  const baris = arm.map((k) => ({ k, h: `data-dj="arm-ubah" data-id="${e(k.id)}"` }));
  return `<div class="mr-kartu dj-kartu dj-tbw dj-arm__tb"><table class="dj-tb"><thead><tr><th>Kendaraan</th><th>KIR</th><th>STNK</th><th>Pajak</th><th>Servis</th><th>Sewa</th></tr></thead><tbody>${baris.map(({ k, h }) => `<tr ${ubah ? h : ""} tabindex="0"><td><b>${e(k.plat)}</b><small>${e([k.jenisArmada, k.bak].filter(Boolean).join(" · "))}${k.aktif === false ? " · nonaktif" : ""}</small></td><td>${sel(k.kir, now)}</td><td>${sel(k.stnk, now)}</td><td>${sel(k.pajak, now)}</td><td>${sv(k)}</td><td>${sw(k)}</td></tr>`).join("")}</tbody></table></div>
  <div class="dj-arm__kt">${baris.map(({ k, h }) => `<div class="mr-kartu dj-kartu" ${ubah ? h : ""} tabindex="0"><div class="dj-kh"><b>${e(k.plat)}</b><small class="mr-sub">${e([k.jenisArmada, k.bak].filter(Boolean).join(" · "))}</small></div><div class="dj-arm__sel"><div><small>KIR</small>${sel(k.kir, now)}</div><div><small>STNK</small>${sel(k.stnk, now)}</div><div><small>Pajak</small>${sel(k.pajak, now)}</div><div><small>Servis</small>${sv(k)}</div></div>${k.sewa ? `<div>${sw(k)}</div>` : ""}</div>`).join("")}</div>`;
}
function tabSewa(arm, now, ubah) {
  const r = DZ.ringkasSewa(arm), l = arm.filter((k) => k.sewa);
  return `<div class="dj-kpis">${[["Project aktif", r.total], ["Dengan driver", r.driver], ["Lepas kunci", r.lepas], ["Kota", r.kota.length]].map(([j, n]) => `<div class="dj-kpi dj-kpi--statis"><span>${j}</span><b>${n}</b></div>`).join("")}</div>
  <section class="mr-kartu dj-kartu"><h3>Sewa unit dan project</h3>${l.length ? l.map((k) => { const vb = DZ.visitBerikut(k), s = vb ? selisihHari(vb, now) : null; return `<div class="dj-arm__t" ${ubah ? `data-dj="arm-ubah" data-id="${e(k.id)}"` : ""}>${ikon("visit", s != null ? WARNA[DZ.tingkat(s)] : "ok")}<div class="dj-arm__i"><b>${e(k.sewa.customer || "–")} · ${e(k.sewa.kota || "–")}</b><small>${e(k.plat)} · ${e([k.jenisArmada, k.bak].filter(Boolean).join(" "))} · ${k.sewa.bentuk === "lepas" ? "lepas kunci" : "dengan driver"} · s/d ${tglP(k.sewa.akhir)}</small></div>${vb ? `<span>${chip(WARNA[DZ.tingkat(s)], "visit " + tglP(vb))}</span>` : ""}</div>`; }).join("") : `<p class="mr-sub">Belum ada unit disewa. Isi bagian "Sewa unit" pada data kendaraan.</p>`}</section>`;
}
function tabRiwayat(arm) {
  const l = arm.flatMap((k) => (k.riwayat || []).map((x) => ({ ...x, plat: k.plat }))).sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)) || (b.waktu || 0) - (a.waktu || 0)).slice(0, 60);
  return `<section class="mr-kartu dj-kartu"><h3>Riwayat perawatan dan dokumen</h3>${l.length ? l.map((x) => `<div class="dj-arm__t">${ikon(x.tipe, "ok")}<div class="dj-arm__i"><b>${e(x.judul || x.tipe)} · ${e(x.plat)}</b><small>${tglP(x.tgl)}${x.biaya ? " · Rp" + Number(x.biaya).toLocaleString("id-ID") : ""}${x.catatan ? " · " + e(x.catatan) : ""}${x.oleh ? " · " + e(x.oleh) : ""}</small></div></div>`).join("") : `<p class="mr-sub">Belum ada catatan perpanjangan, servis, atau visit.</p>`}</section>`;
}
/** Isi tab Armada. ubah = boleh mengubah data. */
export function htmlArmada(arm, sub, now, ubah) {
  const nav = `<div class="mr-seg dj-seg dj-arm__nav" role="group" aria-label="Bagian Armada">${SUB_ARMADA.map(([k, t]) => `<button type="button" class="mr-chip${sub === k ? " is-aktif" : ""}" data-dj="arm-sub" data-v="${k}">${t}</button>`).join("")}</div>`;
  const isi = sub === "kendaraan" ? tabKendaraan(arm, now, ubah) : sub === "sewa" ? tabSewa(arm, now, ubah) : sub === "riwayat" ? tabRiwayat(arm) : tabTindakan(arm, now, ubah);
  return `<div class="dj-arm"><div class="dj-arm__kep">${nav}${ubah ? `<button type="button" class="mr-btn mr-btn--utama" data-dj="arm-baru">+ Kendaraan</button>` : ""}</div>${isi}</div>`;
}
const f = (l, i, k = "") => `<label class="mr-f ${k}"><span>${l}</span>${i}</label>`;
const inp = (id, v, o = "") => `<input id="${id}" value="${e(v ?? "")}" ${o}>`;
const tg = (id, v) => `<input type="date" id="${id}" value="${e(v || "")}">`;
const opsi = (l, pilih, kosong) => `${kosong ? `<option value="">${kosong}</option>` : ""}${l.map((x) => `<option${x === pilih ? " selected" : ""}>${x}</option>`).join("")}`;
/** Isi panel tambah/ubah kendaraan. */
export function htmlFormKendaraan(k) {
  const s = k.servis || {}, w = k.sewa || {};
  return `<div class="mr-form dj-form" style="grid-template-columns:1fr 1fr">
  ${f("Plat nomor *", inp("arm-plat", k.plat, 'placeholder="B 1234 XYZ"'))}${f("Jenis armada", `<select id="arm-jenis">${opsi(DZ.JENIS_ARMADA, k.jenisArmada)}</select>`)}
  ${f("Tipe bak", `<select id="arm-bak">${opsi(DZ.TIPE_BAK, k.bak, "–")}</select>`)}${f("Odometer saat ini (km)", inp("arm-odo", s.odo, 'inputmode="numeric"'))}
  <div class="dj-lng__sub dj-lebar">Masa berlaku dokumen</div>${f("KIR sampai", tg("arm-kir", k.kir))}${f("STNK sampai", tg("arm-stnk", k.stnk))}${f("Pajak sampai", tg("arm-pajak", k.pajak))}<span></span>
  <div class="dj-lng__sub dj-lebar">Jadwal servis (mana yang lebih dulu)</div>${f("Servis berikut: tanggal", tg("arm-sv-tgl", s.tglBerikut))}${f("Servis berikut: km", inp("arm-sv-km", s.kmBerikut, 'inputmode="numeric"'))}${f("Interval (bulan)", inp("arm-sv-bln", s.intervalBln, 'inputmode="numeric" placeholder="3"'))}${f("Interval (km)", inp("arm-sv-ikm", s.intervalKm, 'inputmode="numeric" placeholder="10000"'))}
  <label class="mr-f dj-lebar dj-cek"><input type="checkbox" id="arm-sewa-on" ${k.sewa ? "checked" : ""}> <span>Disewa customer (project)</span></label>
  <div class="dj-arm__sewa dj-lebar" ${k.sewa ? "" : "hidden"}><div class="dj-g2">${f("Customer / project", inp("arm-sw-cust", w.customer))}${f("Kota", inp("arm-sw-kota", w.kota))}${f("Bentuk sewa", `<select id="arm-sw-bentuk"><option value="driver"${w.bentuk !== "lepas" ? " selected" : ""}>Dengan driver</option><option value="lepas"${w.bentuk === "lepas" ? " selected" : ""}>Lepas kunci</option></select>`)}${f("Mulai", tg("arm-sw-mulai", w.mulai))}${f("Berakhir", tg("arm-sw-akhir", w.akhir))}${f("Visit terakhir", tg("arm-sw-visit", w.visitTerakhir))}</div></div>
  ${f("Catatan", `<textarea id="arm-cat" rows="2">${e(k.catatan || "")}</textarea>`, "dj-lebar")}
  <label class="mr-f dj-lebar dj-cek"><input type="checkbox" id="arm-aktif" ${k.aktif === false ? "" : "checked"}> <span>Kendaraan aktif</span></label></div>`;
}
const JUDUL = { kir: "Perpanjangan KIR", stnk: "Perpanjangan STNK", pajak: "Perpanjangan pajak", servis: "Catat servis", visit: "Hasil visit inspeksi" };
export const judulTugas = (t) => JUDUL[t];
/** Isi panel catat tugas (perpanjangan dokumen, servis, visit). */
export function htmlFormTugas(tipe, k) {
  const s = k.servis || {}, h = hariIni();
  if (tipe === "servis") return `<div class="mr-form dj-form" style="grid-template-columns:1fr 1fr">${f("Tanggal servis", tg("tg-tgl", h))}${f("Odometer (km)", inp("tg-odo", s.odo, 'inputmode="numeric"'))}${f("Biaya (Rp)", inp("tg-biaya", "", 'inputmode="numeric"'))}<span></span>${f("Servis berikut: tanggal", tg("tg-next-tgl", ""))}${f("Servis berikut: km", inp("tg-next-km", "", 'inputmode="numeric"'))}${f("Catatan", `<textarea id="tg-cat" rows="2" placeholder="mis. ganti oli, kampas rem"></textarea>`, "dj-lebar")}</div><p class="mr-sub">Tanggal dan km berikutnya terisi dari interval kendaraan bila dikosongkan.</p>`;
  if (tipe === "visit") return `<div class="mr-form dj-form" style="grid-template-columns:1fr 1fr">${f("Tanggal visit", tg("tg-tgl", h))}${f("Odometer (km)", inp("tg-odo", s.odo, 'inputmode="numeric"'))}${f("Kondisi dan temuan", `<textarea id="tg-cat" rows="3" placeholder="kondisi unit, dokumen, perawatan"></textarea>`, "dj-lebar")}</div>`;
  return `<div class="mr-form dj-form" style="grid-template-columns:1fr 1fr">${f(`${JUDUL[tipe].replace("Perpanjangan ", "")} berlaku sampai (baru) *`, tg("tg-baru", ""))}${f("Biaya (Rp)", inp("tg-biaya", "", 'inputmode="numeric"'))}${f("Catatan", `<textarea id="tg-cat" rows="2"></textarea>`, "dj-lebar")}</div>`;
}
