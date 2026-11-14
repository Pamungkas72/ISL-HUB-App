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
module.exports = { DOMAIN, normalUsername, usernameValid, normalTelepon, emailValid, emailSintetis, kunciLogin, sandiValid };
