// Notifikasi push Daily Job: tiap 09.00, 14.00, 17.00 WIB. Penerima: akun aktif yang mengaktifkan notifikasi di perangkatnya.
// Anggota menerima ringkasan kelompoknya; master dan admin menerima semua kelompok.
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { bangunPesan } = require("./dailyjob-pesan");

const EMAIL_MASTER = "codcodan1@gmail.com";
const TOKEN_MATI = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"];

exports.notifDailyJob = onSchedule({ schedule: "0 9,14,17 * * *", timeZone: "Asia/Jakarta", region: "asia-southeast2" }, async (ev) => {
  const db = admin.firestore(), sekarang = ev.scheduleTime ? new Date(ev.scheduleTime) : new Date();
  const [tok, peng, js] = await Promise.all([db.collection("dj_token").get(), db.collection("pengguna").get(), db.collection("dj_job").get()]);
  const akun = new Map(peng.docs.map((d) => [d.id, d.data()])), jobs = js.docs.map((d) => d.data());
  const perUid = new Map();
  tok.docs.forEach((d) => { const u = d.get("uid"); (perUid.get(u) || perUid.set(u, []).get(u)).push(d); });
  for (const [uid, dokumen] of perUid) {
    const p = akun.get(uid);
    if (!p || p.status !== "aktif") { await Promise.all(dokumen.map((d) => d.ref.delete())); continue; } // akun sudah tidak aktif
    const semua = String(p.email || "").toLowerCase() === EMAIL_MASTER || p.peran === "admin";
    if (!semua && !p.kelompokDJ) continue;
    const lingkup = semua ? jobs : jobs.filter((j) => j.kelompokId === p.kelompokDJ);
    for (const m of bangunPesan(lingkup, sekarang)) {
      const r = await admin.messaging().sendEachForMulticast({ tokens: dokumen.map((d) => d.get("token")), data: { title: m.title, body: m.body, tag: m.tag, url: "app.html#dailyjob" }, webpush: { headers: { Urgency: "high", TTL: "7200" } } });
      await Promise.all(r.responses.map((x, i) => (!x.success && x.error && TOKEN_MATI.includes(x.error.code) ? dokumen[i].ref.delete() : null)));
    }
  }
});
