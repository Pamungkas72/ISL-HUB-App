// Identitas login anggota tim Daily Job (murni, diuji tests/unit/daily-job-akun.test.js). Salinan logikanya juga ada di public/js/daily-job-hitung.js (klien).
const DOMAIN = "dj.isl-hub.app"; // email sintetis akun yang dibuat kepala divisi; tidak pernah dikirimi surat
const normalUsername = (s) => String(s || "").trim().toLowerCase();
const usernameValid = (s) => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(s);
/** 08xxxx / +62xxxx / 62xxxx -> 628xxxx. Kosong bila bukan nomor telepon yang masuk akal (9 sampai 15 digit). */
function normalTelepon(s) {
  let d = String(s || "").replace(/[^0-9]/g, ""); if (!d) return "";
  if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d;
  return d.length >= 9 && d.length <= 15 ? d : "";
}
const emailValid = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim());
const emailSintetis = (username) => `${normalUsername(username)}@${DOMAIN}`;
/** Kunci dokumen dj_login untuk masukan pengguna: email, nomor telepon, atau username. */
function kunciLogin(masukan) {
  const t = String(masukan || "").trim(); if (!t) return "";
  if (t.includes("@")) return "e_" + t.toLowerCase();
  const tel = /^[+0-9\s().-]+$/.test(t) ? normalTelepon(t) : "";
  return tel ? "p_" + tel : "u_" + normalUsername(t);
}
const sandiValid = (s) => typeof s === "string" && s.length >= 8 && s.length <= 64;
/** Kunci alias pertama yang sudah dipakai akun lain (ada di dj_login dan bukan milik akun ini); null bila tidak ada. Dokumen dj_login publik, jadi tanpa uid: kepemilikan dari daftar alias akun. */
const kunciBentrok = (kunci, ada, milik) => kunci.find((k, i) => ada[i] && !(milik || []).includes(k)) || null;
/* Kode unit anggota divisi: awalan dari nama kelompok (huruf pertama + konsonan berikutnya: Star -> STR, Agora -> AGR) dan nomor urut per kelompok. */
const awalanKelompok = (nama) => { const h = String(nama || "").normalize("NFD").toUpperCase().replace(/[^A-Z]/g, ""); if (!h) return "DJ"; const k = [h[0], ...[...h.slice(1)].filter((c) => !"AEIOU".includes(c))].join("").slice(0, 3); return k.length >= 3 ? k : (k + h.slice(1).replace(new RegExp(`[${k}]`, "g"), "")).slice(0, 3).padEnd(2, "X"); };
const kodeUnitBerikut = (awalan, terpakai) => `${awalan}-${String(terpakai.reduce((m, k) => { const x = String(k || "").match(new RegExp(`^${awalan}-(\\d+)$`)); return x ? Math.max(m, +x[1]) : m; }, 0) + 1).padStart(2, "0")}`;
module.exports = { awalanKelompok, kodeUnitBerikut, kunciBentrok, DOMAIN, normalUsername, usernameValid, normalTelepon, emailValid, emailSintetis, kunciLogin, sandiValid };
