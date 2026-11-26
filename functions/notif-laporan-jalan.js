// Menjalankan laporan berkala (Cloud Functions): penjadwal mengisi antrean dj_email per customer; pengirim membuat lampiran saat mengirim.
// Pratinjau dan kirim uji lewat callable laporanUji (master/admin). Logika data ada di notif-laporan.js (murni).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const L = require("./notif-laporan");
const X = require("./notif-xlsx");
const { kirimUji } = require("./dailyjob-email-kirim-isi");
const { penerimaDaftar } = require("./dailyjob-email-customer");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const EMAIL_MASTER = "codcodan1@gmail.com", REGION = "asia-southeast2", MIME = { xlsx: "xlsx", csv: "csv" };
const db = () => admin.firestore();
const custList = async () => (await db().collection("cu_customers").get()).docs.map((d) => ({ id: d.id, ...d.data() }));

/** Isi laporan satu customer pada satu rentang: { header, rows, total, c, profil }. Kolom dibatasi izin profil kelompok. */
async function isiLaporan({ kelompokId, customerId, lap, dari, sampai }, custs) {
  const kel = await db().doc(`dj_kelompok/${kelompokId}`).get(); if (!kel.exists) throw new Error("Kelompok tidak ditemukan.");
  const profil = kel.get("profil") || "marketing", c = (custs || (await custList())).find((x) => x.id === customerId); if (!c) throw new Error("Customer tidak ditemukan.");
  const jobs = (await db().collection("dj_job").where("kelompokId", "==", kelompokId).get()).docs.map((d) => d.data());
  const t = L.tabel(profil, lap, L.pilihJob(jobs, c, kelompokId, lap.filter, { dari, sampai }));
  return { ...t, total: t.rows.length, c, profil };
}
const berkas = (format, header, rows, nama) => (format === "csv" ? { nama: nama.replace(/\.\w+$/, ".csv"), base64: Buffer.from(X.csv(header, rows), "utf8").toString("base64") } : { nama, base64: X.xlsx(header, rows, "Laporan").toString("base64") });

/** Dipanggil pengirim saat memproses dokumen antrean berlampiran. null bila tidak ada baris dan laporan tidak diminta tetap dikirim. */
async function buatLampiran(l) {
  const lap = l.lap || {}, r = await isiLaporan({ kelompokId: l.kelompokId, customerId: l.customerId, lap, dari: l.dari, sampai: l.sampai });
  if (!r.total && !lap.kirimBilaKosong) return null;
  return berkas(MIME[lap.format] ? lap.format : "xlsx", r.header, r.rows, L.namaBerkas(lap, l, MIME[lap.format] || "xlsx"));
}

/** Tiap 30 menit: laporan aktif yang jatuh tempo -> satu dokumen antrean per customer pelanggan laporan itu (id tetap: tidak dobel). */
exports.kirimLaporanBerkala = onSchedule({ schedule: "every 30 minutes", timeZone: "Asia/Jakarta", region: REGION }, async () => {
  const now = Date.now(), dok = await db().collection("notif_pengaturan").get(); let custs = null;
  for (const k of dok.docs) {
    const laporan = k.get("laporan") || {}, penerima = k.get("penerima") || {}; if (!Object.keys(laporan).length) continue;
    for (const [lid, lap] of Object.entries(laporan)) {
      if (!lap || lap.aktif === false) continue; const per = L.periode(lap, now); if (!per) continue;
      for (const [cid, p] of Object.entries(penerima)) {
        if (!Array.isArray(p.laporan) || !p.laporan.includes(lid)) continue;
        custs = custs || (await custList()); const c = custs.find((x) => x.id === cid); if (!c || c.emailNotif === false) continue;
        const kepada = penerimaDaftar(c, { penerima: { [cid]: p } }); if (!kepada.length) continue;
        const ref = db().doc(`dj_email/lap_${k.id}_${lid}_${cid}_${per.key}`), r = await isiLaporan({ kelompokId: k.id, customerId: cid, lap, dari: per.dari, sampai: per.sampai }, custs);
        const e = L.emailLaporan(lap, c, per, r.total), kosong = !r.total && !lap.kirimBilaKosong;
        await ref.create({ jobId: null, kunci: ref.id, kelompokId: k.id, tahap: "laporan", customer: c.nama || "", ke: kepada.join(", "), kepada, subjek: e.subjek, isi: e.isi, status: kosong ? "dilewati" : "antre", kirimPada: per.kirimPada, dibuat: now,
          lampiran: { kelompokId: k.id, customerId: cid, dari: per.dari, sampai: per.sampai, lap: { nama: lap.nama, kolom: lap.kolom, filter: lap.filter, format: lap.format, kirimBilaKosong: !!lap.kirimBilaKosong } }, ...(kosong ? { galat: "Tidak ada pengiriman pada periode ini." } : {}) }).catch((er) => { if (er.code !== 6) throw er; });
      }
    }
  }
});

/** Pratinjau (10 baris pertama) dan kirim uji ke email pemanggil. Hanya master/admin. data: { kelompokId, customerId, lap, kirim } */
exports.laporanUji = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async (req) => {
  const a = req.auth; if (!a || !a.token.email) throw new HttpsError("unauthenticated", "Masuk dulu.");
  const email = String(a.token.email).toLowerCase();
  if (email !== EMAIL_MASTER) { const p = await db().doc(`pengguna/${a.uid}`).get(); if (!p.exists || p.get("status") !== "aktif" || p.get("peran") !== "admin") throw new HttpsError("permission-denied", "Hanya master atau admin."); }
  const d = req.data || {}, lap = d.lap || {}, per = L.periode({ ...lap, jam: "00:00" }, Date.now(), true);
  if (!d.kelompokId || !d.customerId || !per) throw new HttpsError("invalid-argument", "Pilih kelompok dan customer.");
  let r; try { r = await isiLaporan({ kelompokId: String(d.kelompokId), customerId: String(d.customerId), lap, dari: per.dari, sampai: per.sampai }); } catch (er) { throw new HttpsError("failed-precondition", er.message); }
  const hasil = { header: r.header, rows: r.rows.slice(0, 10), total: r.total, dari: per.dari, sampai: per.sampai };
  if (d.kirim) {
    const e = L.emailLaporan(lap, r.c, per, r.total), format = MIME[lap.format] ? lap.format : "xlsx";
    const res = await kirimUji(email, "[UJI] " + e.subjek, e.isi, RESEND_API_KEY.value(), fetch, berkas(format, r.header, r.rows, L.namaBerkas(lap, per, MIME[format])));
    if (!res.ok) throw new HttpsError("failed-precondition", `Resend menolak (${res.kode}): ${res.galat}`); hasil.ke = email;
  }
  return hasil;
});
exports.buatLampiran = buatLampiran;
